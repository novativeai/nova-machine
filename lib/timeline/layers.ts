// Timeline model. Pure: derives clips from canvas nodes. A node with `data.timeline.enabled`
// is one layer; its media (or, for a prompt, its newest take) is that layer's clip.
import type {
  AudioNodeData,
  ImageNodeData,
  NovaEdge,
  NovaNode,
  OutputNodeData,
  PromptNodeData,
  TimelineLayer,
  VideoNodeData,
} from '@/types';

export const TIMELINE_FPS = 30;
export const DEFAULT_STILL_SECONDS = 4;
/** Shortest clip a trim can leave. */
export const MIN_CLIP_SECONDS = 1 / TIMELINE_FPS;
/** Unknown media length (metadata not loaded yet). */
const FALLBACK_SECONDS = 5;

export type ClipKind = 'video' | 'image' | 'audio' | 'empty';
export type TrackKind = 'visual' | 'audio';

export interface TimelineClip {
  nodeId: string;
  nodeType: NovaNode['type'];
  label: string;
  kind: ClipKind;
  track: TrackKind;
  url?: string;
  thumbnail?: string;
  /** Full source length; Infinity for stills. */
  sourceDuration: number;
  start: number;
  end: number;
  layer: TimelineLayer;
  /** Whether the clip carries its own sound (video with audio, audio files). */
  hasAudio: boolean;
  /** Prompt layers: the output node currently used as the take. */
  takeNodeId?: string;
  takeCount?: number;
}

/** Node types that can become a timeline layer. */
export function canBeTimelineLayer(node: NovaNode): boolean {
  return node.type === 'video' || node.type === 'image' || node.type === 'audio' || node.type === 'output' || node.type === 'prompt';
}

export function defaultLayer(order: number, start: number): TimelineLayer {
  return {
    enabled: true,
    order,
    start,
    trimStart: 0,
    trimEnd: 0,
    stillDuration: DEFAULT_STILL_SECONDS,
    muted: false,
    hidden: false,
    locked: false,
    solo: false,
    volume: 1,
  };
}

interface Media {
  kind: ClipKind;
  url?: string;
  thumbnail?: string;
  duration: number;
  hasAudio: boolean;
  label: string;
  takeNodeId?: string;
  takeCount?: number;
}

function outputMedia(data: OutputNodeData): Media | null {
  if (data.isPlaceholder) return null;
  if (data.outputType === 'video' && data.videoUrl) {
    const silent = data.generationMetadata?.generateAudio === false;
    return {
      kind: 'video',
      url: data.videoUrl,
      thumbnail: data.thumbnailUrl || undefined,
      duration: data.videoDuration || data.generationMetadata?.duration || FALLBACK_SECONDS,
      hasAudio: !silent,
      label: data.generationMetadata?.promptUsed || 'Generated video',
    };
  }
  if (data.outputType === 'image' && data.imageUrl) {
    return { kind: 'image', url: data.imageUrl, thumbnail: data.imageUrl, duration: Infinity, hasAudio: false, label: data.generationMetadata?.promptUsed || 'Generated image' };
  }
  return null;
}

/** Newest take of a prompt: latest video output, else latest image output. */
function promptTake(prompt: NovaNode, nodes: NovaNode[], edges: NovaEdge[]): Media {
  const data = prompt.data as PromptNodeData;
  const outputs = edges
    .filter((e) => e.source === prompt.id)
    .map((e) => nodes.find((n) => n.id === e.target))
    .filter((n): n is NovaNode => Boolean(n) && n!.type === 'output' && !(n!.data as OutputNodeData).isPlaceholder);
  const time = (n: NovaNode) => new Date((n.data as OutputNodeData).generationMetadata?.createdAt ?? n.data.createdAt).getTime();
  const videos = outputs.filter((n) => (n.data as OutputNodeData).outputType === 'video').sort((a, b) => time(b) - time(a));
  const images = outputs.filter((n) => (n.data as OutputNodeData).outputType === 'image').sort((a, b) => time(b) - time(a));
  const take = videos[0] ?? images[0];
  const label = data.prompt.trim() || 'Untitled shot';
  if (!take) {
    return { kind: 'empty', duration: parseInt(data.duration, 10) || FALLBACK_SECONDS, hasAudio: false, label, takeCount: 0 };
  }
  const media = outputMedia(take.data as OutputNodeData)!;
  return { ...media, label, takeNodeId: take.id, takeCount: outputs.length };
}

function nodeMedia(node: NovaNode, nodes: NovaNode[], edges: NovaEdge[]): Media | null {
  switch (node.type) {
    case 'video': {
      const d = node.data as VideoNodeData;
      const url = d.remoteUrl || d.videoUrl;
      return url ? { kind: 'video', url, thumbnail: d.thumbnailUrl || undefined, duration: d.duration || FALLBACK_SECONDS, hasAudio: true, label: d.fileName || 'Video' } : null;
    }
    case 'image': {
      const d = node.data as ImageNodeData;
      const url = d.remoteUrl || d.imageUrl;
      return url ? { kind: 'image', url, thumbnail: d.thumbnailUrl || url, duration: Infinity, hasAudio: false, label: d.fileName || 'Image' } : null;
    }
    case 'audio': {
      const d = node.data as AudioNodeData;
      const url = d.remoteUrl || d.audioUrl;
      return url ? { kind: 'audio', url, duration: d.duration || FALLBACK_SECONDS, hasAudio: true, label: d.fileName || 'Audio' } : null;
    }
    case 'output':
      return outputMedia(node.data as OutputNodeData);
    case 'prompt':
      return promptTake(node, nodes, edges);
    default:
      return null;
  }
}

/** Whether a node currently has media it could show on the timeline. */
export function hasTimelineMedia(node: NovaNode, nodes: NovaNode[], edges: NovaEdge[]): boolean {
  return node.type === 'prompt' || nodeMedia(node, nodes, edges) !== null;
}

export function clipLength(kind: ClipKind, sourceDuration: number, layer: TimelineLayer): number {
  if (kind === 'image') return Math.max(MIN_CLIP_SECONDS, layer.stillDuration);
  return Math.max(MIN_CLIP_SECONDS, sourceDuration - layer.trimStart - layer.trimEnd);
}

export function resolveClips(nodes: NovaNode[], edges: NovaEdge[]): TimelineClip[] {
  const clips: TimelineClip[] = [];
  for (const node of nodes) {
    const layer = node.data.timeline;
    if (!layer?.enabled) continue;
    const media = nodeMedia(node, nodes, edges);
    if (!media) continue;
    const length = clipLength(media.kind, media.duration, layer);
    clips.push({
      nodeId: node.id,
      nodeType: node.type,
      label: media.label,
      kind: media.kind,
      track: media.kind === 'audio' ? 'audio' : 'visual',
      url: media.url,
      thumbnail: media.thumbnail,
      sourceDuration: media.duration,
      start: layer.start,
      end: layer.start + length,
      layer,
      hasAudio: media.hasAudio,
      takeNodeId: media.takeNodeId,
      takeCount: media.takeCount,
    });
  }
  // Tracks top to bottom: visual layers by order (top layer first), then audio layers
  return clips.sort((a, b) => {
    if (a.track !== b.track) return a.track === 'visual' ? -1 : 1;
    return b.layer.order - a.layer.order;
  });
}

export function sequenceEnd(clips: TimelineClip[]): number {
  return clips.reduce((end, c) => Math.max(end, c.end), 0);
}

export function nextLayerOrder(nodes: NovaNode[]): number {
  return nodes.reduce((max, n) => Math.max(max, n.data.timeline?.order ?? 0), 0) + 1;
}

/** Topmost visible visual clip at time t (what the program monitor shows). */
export function activeVisualAt(clips: TimelineClip[], t: number): TimelineClip | undefined {
  return clips
    .filter((c) => c.track === 'visual' && !c.layer.hidden && c.kind !== 'empty' && t >= c.start && t < c.end)
    .sort((a, b) => b.layer.order - a.layer.order)[0];
}

/** Audible per mute/solo (solo on any layer silences the non-soloed ones). */
export function isAudible(clip: TimelineClip, clips: TimelineClip[]): boolean {
  if (!clip.hasAudio) return false;
  const anySolo = clips.some((c) => c.layer.solo);
  return anySolo ? clip.layer.solo : !clip.layer.muted;
}

/** Source time inside the media for timeline time t. */
export function sourceTime(clip: TimelineClip, t: number): number {
  return clip.layer.trimStart + (t - clip.start);
}

/** Snap a time to the nearest target within `threshold` seconds. */
export function snapTime(t: number, targets: number[], threshold: number): number {
  let best = t;
  let bestDistance = threshold;
  for (const target of targets) {
    const d = Math.abs(target - t);
    if (d < bestDistance) {
      best = target;
      bestDistance = d;
    }
  }
  return best;
}

/** "00:01:23:12" (hours:minutes:seconds:frames at 30 fps). */
export function formatTimecode(seconds: number): string {
  const totalFrames = Math.max(0, Math.round(seconds * TIMELINE_FPS));
  const frames = totalFrames % TIMELINE_FPS;
  const totalSeconds = Math.floor(totalFrames / TIMELINE_FPS);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(frames)}`;
}

/** Ruler label "1:05" / "0:30". */
export function formatRulerLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${(Number.isInteger(s) ? s.toString() : s.toFixed(1)).padStart(2, '0')}`;
}

/** Major tick spacing so labels stay ≥ 72 px apart. */
export function rulerStep(pxPerSecond: number): number {
  const steps = [1 / TIMELINE_FPS * 5, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  return steps.find((s) => s * pxPerSecond >= 72) ?? 600;
}

// ============================================================================
// EXPORT FLATTENING
// ============================================================================

export interface VisualSegment {
  kind: 'video' | 'image' | 'gap';
  clip?: TimelineClip;
  start: number;
  duration: number;
  /** Seconds into the source media where this segment begins (video). */
  sourceOffset: number;
}

/**
 * Flatten the stacked visual layers into one programme track: at every moment the
 * topmost visible clip wins, holes become black gaps (what the monitor shows).
 */
export function flattenVisual(clips: TimelineClip[]): VisualSegment[] {
  const visual = clips.filter((c) => c.track === 'visual' && !c.layer.hidden && c.kind !== 'empty');
  const end = sequenceEnd(visual);
  if (end <= 0) return [];
  const bounds = Array.from(new Set([0, end, ...visual.flatMap((c) => [c.start, c.end])]))
    .filter((t) => t >= 0 && t <= end)
    .sort((a, b) => a - b);

  const segments: VisualSegment[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    if (b - a < 1e-6) continue;
    const top = activeVisualAt(visual, (a + b) / 2);
    const last = segments[segments.length - 1];
    if (last && last.clip === top && Math.abs(last.start + last.duration - a) < 1e-6) {
      last.duration += b - a;
      continue;
    }
    segments.push(
      top
        ? { kind: top.kind === 'image' ? 'image' : 'video', clip: top, start: a, duration: b - a, sourceOffset: sourceTime(top, a) }
        : { kind: 'gap', start: a, duration: b - a, sourceOffset: 0 }
    );
  }
  return segments;
}
