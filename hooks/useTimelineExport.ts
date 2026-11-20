'use client';

import { useCallback, useState } from 'react';
import { nanoid } from 'nanoid';
import { createNode, useCanvasStore } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';
import { persistUrlsToR2 } from '@/lib/r2';
import { FAL_KEY_REQUIRED_MESSAGE, runFal, uploadFile } from '@/lib/fal';
import { useSettingsStore } from '@/stores';
import {
  flattenVisual,
  isAudible,
  resolveClips,
  sequenceEnd,
  type TimelineClip,
  type VisualSegment,
} from '@/lib/timeline/layers';
import type {
  ComposeInput,
  ComposeKeyframe,
  ComposeOutput,
  ComposeTrack,
  ImagesToVideoInput,
  TrimVideoInput,
  TrimVideoOutput,
  VideoGenerationOutput,
} from '@/types';

const STILL_FPS = 24;
/** Below this, a source offset or tail is treated as untrimmed. */
const TRIM_EPSILON = 0.04;

export type ExportStage = 'idle' | 'preparing' | 'composing' | 'done' | 'error';

export interface ExportState {
  stage: ExportStage;
  message: string;
  /** 0–1 */
  progress: number;
  url?: string;
  error?: string;
}

/** A black 16:9 frame for gaps, generated in the browser and uploaded once per export. */
async function blackFrame(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create a gap frame'))), 'image/png')
  );
  return new File([blob], 'gap.png', { type: 'image/png' });
}

/** Steps fal must run, counted up front for progress. */
function countSteps(segments: VisualSegment[], audio: TimelineClip[]): number {
  const visual = segments.filter((s) => s.kind !== 'video' || needsTrim(s)).length;
  const audioTrims = audio.filter((c) => c.layer.trimStart > TRIM_EPSILON || c.layer.trimEnd > TRIM_EPSILON).length;
  return visual + audioTrims + 1;
}

function needsTrim(segment: VisualSegment): boolean {
  const clip = segment.clip;
  if (!clip || segment.kind !== 'video') return false;
  const tail = clip.sourceDuration - segment.sourceOffset - segment.duration;
  return segment.sourceOffset > TRIM_EPSILON || tail > TRIM_EPSILON;
}

const ms = (seconds: number) => Math.round(seconds * 1000);

/**
 * Renders the timeline to one MP4 on fal.ai (the user's key):
 * 1. flatten the stacked layers into one programme track (top visible layer wins),
 * 2. cut trimmed video sections (trim-video) and turn stills/gaps into clips (images-to-video),
 * 3. compose the programme with every audible audio layer and the clips' own sound.
 * The result lands on the canvas as an output node.
 */
export function useTimelineExport() {
  const { user } = useAuth();
  const [state, setState] = useState<ExportState>({ stage: 'idle', message: '', progress: 0 });

  const exportTimeline = useCallback(async () => {
    const { nodes, edges, addNode } = useCanvasStore.getState();
    const clips = resolveClips(nodes, edges);
    const segments = flattenVisual(clips);
    if (segments.length === 0) {
      setState({ stage: 'error', message: '', progress: 0, error: 'Put at least one video or image layer on the timeline.' });
      return;
    }
    if (!useSettingsStore.getState().falApiKey) {
      setState({ stage: 'error', message: '', progress: 0, error: FAL_KEY_REQUIRED_MESSAGE });
      return;
    }

    const audioClips = clips.filter((c) => c.track === 'audio' && c.url && isAudible(c, clips));
    const total = countSteps(segments, audioClips);
    let done = 0;
    const step = (message: string) => {
      done += 1;
      setState({ stage: done >= total ? 'composing' : 'preparing', message, progress: Math.min(0.95, done / total) });
    };

    try {
      setState({ stage: 'preparing', message: 'Preparing clips…', progress: 0 });
      let gapUrl: string | undefined;

      // 1–2. Programme track keyframes
      const programme: ComposeKeyframe[] = [];
      const clipAudio: ComposeKeyframe[] = [];
      for (const segment of segments) {
        let url: string;
        if (segment.kind === 'video') {
          const clip = segment.clip!;
          url = clip.url!;
          if (needsTrim(segment)) {
            const input: TrimVideoInput = { video_url: url, start_time: segment.sourceOffset, duration: segment.duration };
            const trimmed = await runFal<TrimVideoInput, TrimVideoOutput>('fal-ai/workflow-utilities/trim-video', input);
            if (!trimmed.success || !trimmed.data?.video.url) throw new Error(trimmed.error || `Could not trim “${clip.label}”`);
            url = trimmed.data.video.url;
            step(`Trimmed “${clip.label}”`);
          }
          if (isAudible(clip, clips)) clipAudio.push({ url, timestamp: ms(segment.start), duration: ms(segment.duration) });
        } else {
          let imageUrl: string;
          if (segment.kind === 'gap') {
            gapUrl ??= await uploadFile(await blackFrame());
            imageUrl = gapUrl;
          } else {
            imageUrl = segment.clip!.url!;
          }
          const input: ImagesToVideoInput = {
            images: [{ url: imageUrl, frames: Math.max(1, Math.round(segment.duration * STILL_FPS)) }],
            fps: STILL_FPS,
          };
          const still = await runFal<ImagesToVideoInput, VideoGenerationOutput>('fal-ai/ffmpeg-api/images-to-video', input);
          if (!still.success || !still.data?.video.url) throw new Error(still.error || 'Could not render a still');
          url = still.data.video.url;
          step(segment.kind === 'gap' ? 'Rendered a gap' : `Rendered still “${segment.clip!.label}”`);
        }
        programme.push({ url, timestamp: ms(segment.start), duration: ms(segment.duration) });
      }

      // Audio layers (trimmed sections cut first)
      const audioTracks: ComposeTrack[] = [];
      for (const clip of audioClips) {
        let url = clip.url!;
        const length = clip.end - clip.start;
        if (clip.layer.trimStart > TRIM_EPSILON || clip.layer.trimEnd > TRIM_EPSILON) {
          const input: TrimVideoInput = { video_url: url, start_time: clip.layer.trimStart, duration: length };
          const trimmed = await runFal<TrimVideoInput, TrimVideoOutput>('fal-ai/workflow-utilities/trim-video', input);
          if (!trimmed.success || !trimmed.data?.video.url) throw new Error(trimmed.error || `Could not trim audio “${clip.label}”`);
          url = trimmed.data.video.url;
          step(`Trimmed audio “${clip.label}”`);
        }
        audioTracks.push({ id: `audio-${clip.nodeId}`, type: 'audio', keyframes: [{ url, timestamp: ms(clip.start), duration: ms(length) }] });
      }
      if (clipAudio.length > 0) audioTracks.push({ id: 'clip-audio', type: 'audio', keyframes: clipAudio });

      // 3. Compose
      setState({ stage: 'composing', message: 'Composing final video…', progress: 0.96 });
      const input: ComposeInput = { tracks: [{ id: 'programme', type: 'video', keyframes: programme }, ...audioTracks] };
      const composed = await runFal<ComposeInput, ComposeOutput>('fal-ai/ffmpeg-api/compose', input);
      if (!composed.success || !composed.data?.video_url) throw new Error(composed.error || 'Compose failed');
      const videoUrl = composed.data.video_url;
      const duration = Math.max(sequenceEnd(clips.filter((c) => c.track === 'visual')), ...audioClips.map((c) => c.end));

      // Land the cut on the canvas, right of everything else
      const maxX = nodes.reduce((m, n) => Math.max(m, n.position.x), 0);
      const minY = nodes.reduce((m, n) => Math.min(m, n.position.y), Number.POSITIVE_INFINITY);
      const outputNode = createNode('output', { x: maxX + 480, y: Number.isFinite(minY) ? minY : 0 }, {
        outputType: 'video',
        videoUrl,
        thumbnailUrl: composed.data.thumbnail_url || '',
        videoDuration: duration,
        dimensions: { width: 1920, height: 1080 },
        role: 'output',
        canChain: true,
        generationMetadata: {
          promptUsed: 'Timeline export',
          modelUsed: 'fal-ai/ffmpeg-api/compose',
          modelLabel: 'Timeline export',
          inputNodes: clips.map((c) => c.nodeId),
          duration,
          aspectRatio: 'auto',
          createdAt: new Date(),
          requestId: composed.requestId || nanoid(),
          // FFmpeg utilities bill compute seconds (fractions of a cent per step)
          cost: 0.0002 * total * 10,
          costBreakdown: `${total} FFmpeg step${total === 1 ? '' : 's'}, compute-billed (~$0.002 each)`,
          costIsEstimate: true,
        },
      });
      addNode(outputNode);

      if (user) {
        try {
          const token = await user.getIdToken();
          const r2Map = await persistUrlsToR2(token, [{ url: videoUrl, category: 'outputs' }]);
          const permanent = r2Map.get(videoUrl);
          if (permanent) useCanvasStore.getState().updateNode(outputNode.id, { videoUrl: permanent });
        } catch (error) {
          console.warn('[Timeline export] R2 persist failed:', error);
        }
      }

      setState({ stage: 'done', message: 'Exported to the canvas', progress: 1, url: videoUrl });
    } catch (error) {
      setState({ stage: 'error', message: '', progress: 0, error: error instanceof Error ? error.message : 'Export failed' });
    }
  }, [user]);

  const reset = useCallback(() => setState({ stage: 'idle', message: '', progress: 0 }), []);

  return { state, exportTimeline, reset };
}
