'use client';

import { useCallback, useState } from 'react';
import { nanoid } from 'nanoid';
import { createNode, useCanvasStore, useSettingsStore } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';
import { persistUrlsToR2 } from '@/lib/r2';
import { FAL_KEY_REQUIRED_MESSAGE, runFal, uploadFile } from '@/lib/fal';
import { flattenVisual, resolveClips, sequenceEnd, type VisualSegment } from '@/lib/timeline/layers';
import { renderMix } from '@/lib/timeline/mixdown';
import type {
  ImagesToVideoInput,
  MergeAudioVideoInput,
  MergeVideosInput,
  TrimVideoInput,
  TrimVideoOutput,
  VideoGenerationOutput,
} from '@/types';

const STILL_FPS = 30;
const OUTPUT_FPS = 30;
const OUTPUT_SIZE = { width: 1920, height: 1080 };
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
  /** Layers left out of the audio mix (could not be decoded). */
  warning?: string;
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

function needsTrim(segment: VisualSegment): boolean {
  const clip = segment.clip;
  if (!clip || segment.kind !== 'video') return false;
  const tail = clip.sourceDuration - segment.sourceOffset - segment.duration;
  return segment.sourceOffset > TRIM_EPSILON || tail > TRIM_EPSILON;
}

/**
 * Renders the timeline to one MP4 on fal.ai (the user's key), matching the programme monitor:
 * 1. flatten the stacked layers into one programme (top visible layer wins, holes are black),
 * 2. cut trimmed video sections (trim-video) and turn stills/gaps into clips (images-to-video),
 * 3. join the sections in order (merge-videos),
 * 4. mix every audible layer in the browser (exact volume, mute/solo, trims, offsets),
 * 5. lay the mix onto the picture (merge-audio-video).
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

    const programmeSeconds = sequenceEnd(clips.filter((c) => c.track === 'visual'));
    const total = segments.filter((s) => s.kind !== 'video' || needsTrim(s)).length + 3;
    let done = 0;
    let falSteps = 0;
    const step = (message: string) => {
      done += 1;
      setState({ stage: 'preparing', message, progress: Math.min(0.95, done / total) });
    };

    try {
      setState({ stage: 'preparing', message: 'Preparing clips…', progress: 0 });
      let gapUrl: string | undefined;

      // 1–2. One video file per programme section
      const sections: string[] = [];
      for (const segment of segments) {
        if (segment.kind === 'video') {
          const clip = segment.clip!;
          let url = clip.url!;
          if (needsTrim(segment)) {
            const input: TrimVideoInput = { video_url: url, start_time: segment.sourceOffset, duration: segment.duration };
            const trimmed = await runFal<TrimVideoInput, TrimVideoOutput>('fal-ai/workflow-utilities/trim-video', input);
            if (!trimmed.success || !trimmed.data?.video.url) throw new Error(trimmed.error || `Could not trim “${clip.label}”`);
            url = trimmed.data.video.url;
            falSteps += 1;
            step(`Trimmed “${clip.label}”`);
          }
          sections.push(url);
          continue;
        }
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
        sections.push(still.data.video.url);
        falSteps += 1;
        step(segment.kind === 'gap' ? 'Rendered a gap' : `Rendered still “${segment.clip!.label}”`);
      }

      // 3. Join the picture
      let pictureUrl = sections[0];
      if (sections.length > 1) {
        setState({ stage: 'composing', message: 'Joining scenes…', progress: Math.min(0.9, done / total) });
        const input: MergeVideosInput = { video_urls: sections, target_fps: OUTPUT_FPS, resolution: OUTPUT_SIZE };
        const merged = await runFal<MergeVideosInput, VideoGenerationOutput>('fal-ai/ffmpeg-api/merge-videos', input);
        if (!merged.success || !merged.data?.video.url) throw new Error(merged.error || 'Could not join the scenes');
        pictureUrl = merged.data.video.url;
        falSteps += 1;
      }
      step('Scenes joined');

      // 4. Mix the sound in the browser
      setState({ stage: 'composing', message: 'Mixing audio…', progress: Math.min(0.93, done / total) });
      const mix = await renderMix(clips, programmeSeconds);
      step('Audio mixed');

      // 5. Lay the mix onto the picture
      let videoUrl = pictureUrl;
      if (mix) {
        setState({ stage: 'composing', message: 'Finishing the master…', progress: 0.96 });
        const audioUrl = await uploadFile(mix.file);
        const input: MergeAudioVideoInput = { video_url: pictureUrl, audio_url: audioUrl };
        const muxed = await runFal<MergeAudioVideoInput, VideoGenerationOutput>('fal-ai/ffmpeg-api/merge-audio-video', input);
        if (!muxed.success || !muxed.data?.video.url) throw new Error(muxed.error || 'Could not add the audio mix');
        videoUrl = muxed.data.video.url;
        falSteps += 1;
      }

      // Land the master on the canvas, right of everything else
      const maxX = nodes.reduce((m, n) => Math.max(m, n.position.x), 0);
      const minY = nodes.reduce((m, n) => Math.min(m, n.position.y), Number.POSITIVE_INFINITY);
      const outputNode = createNode('output', { x: maxX + 480, y: Number.isFinite(minY) ? minY : 0 }, {
        outputType: 'video',
        videoUrl,
        thumbnailUrl: '',
        videoDuration: programmeSeconds,
        dimensions: OUTPUT_SIZE,
        role: 'output',
        canChain: true,
        generationMetadata: {
          promptUsed: 'Timeline export',
          modelUsed: 'fal-ai/ffmpeg-api/merge-videos',
          modelLabel: 'Timeline export',
          inputNodes: clips.map((c) => c.nodeId),
          duration: programmeSeconds,
          aspectRatio: '16:9',
          createdAt: new Date(),
          requestId: nanoid(),
          // FFmpeg utilities bill compute seconds: fractions of a cent per step
          cost: 0.002 * falSteps,
          costBreakdown: `${falSteps} FFmpeg step${falSteps === 1 ? '' : 's'}, compute-billed (~$0.002 each)`,
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

      setState({
        stage: 'done',
        message: 'Exported to the canvas',
        progress: 1,
        url: videoUrl,
        warning: mix?.skipped.length ? `Not in the mix: ${mix.skipped.join(', ')}` : undefined,
      });
    } catch (error) {
      setState({ stage: 'error', message: '', progress: 0, error: error instanceof Error ? error.message : 'Export failed' });
    }
  }, [user]);

  const reset = useCallback(() => setState({ stage: 'idle', message: '', progress: 0 }), []);

  return { state, exportTimeline, reset };
}
