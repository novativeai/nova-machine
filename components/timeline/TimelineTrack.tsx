'use client';

import { memo, useRef, useState } from 'react';
import { Eye, EyeOff, Film, Image as ImageIcon, Lock, Music, Sparkles, Unlock, Volume2, VolumeX, X } from 'lucide-react';
import type { TimelineLayer } from '@/types';
import { useCanvasStore } from '@/stores';
import { clipLength, MIN_CLIP_SECONDS, snapTime, type TimelineClip } from '@/lib/timeline/layers';
import { cn } from '@/lib/utils';
import { useWaveform } from './useWaveform';

export const TRACK_HEIGHT = 44;
export const HEADER_WIDTH = 188;
const EDGE_PX = 7;
const SNAP_PX = 8;

interface TimelineTrackProps {
  clip: TimelineClip;
  trackLabel: string;
  zoom: number;
  laneWidth: number;
  selected: boolean;
  snapping: boolean;
  /** Edges of the other clips plus the playhead, for snapping. */
  snapTargets: number[];
  onSelect: (nodeId: string, focusCanvas: boolean) => void;
  onDragStateChange: (dragging: boolean) => void;
}

type DragMode = 'move' | 'trim-start' | 'trim-end';

const KIND_STYLE: Record<TimelineClip['kind'], { bg: string; border: string; icon: typeof Film }> = {
  video: { bg: 'bg-violet-500/25', border: 'border-violet-400/50', icon: Film },
  image: { bg: 'bg-sky-500/25', border: 'border-sky-400/50', icon: ImageIcon },
  audio: { bg: 'bg-emerald-500/20', border: 'border-emerald-400/50', icon: Music },
  empty: { bg: 'bg-white/5', border: 'border-dashed border-white/25', icon: Sparkles },
};

function Waveform({ url, clip, width }: { url?: string; clip: TimelineClip; width: number }) {
  const peaks = useWaveform(url);
  if (!peaks || width < 4) return null;
  // Visible window of the source
  const total = clip.sourceDuration;
  const from = Math.floor((clip.layer.trimStart / total) * peaks.length);
  const to = Math.ceil(((total - clip.layer.trimEnd) / total) * peaks.length);
  const bars = Math.max(1, Math.floor(width / 2));
  const span = Math.max(1, to - from);
  const path: string[] = [];
  for (let i = 0; i < bars; i++) {
    const start = from + Math.floor((i / bars) * span);
    const end = Math.max(start + 1, from + Math.floor(((i + 1) / bars) * span));
    let peak = 0;
    for (let j = start; j < end && j < peaks.length; j++) peak = Math.max(peak, peaks[j]);
    const h = Math.max(1, peak * 26);
    path.push(`M${i * 2 + 1} ${15 - h / 2}v${h}`);
  }
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0.5 h-[30px] w-full" viewBox={`0 0 ${bars * 2} 30`} preserveAspectRatio="none">
      <path d={path.join('')} stroke="currentColor" strokeWidth="1" className="text-emerald-300/60" />
    </svg>
  );
}

function TimelineTrackComponent({
  clip,
  trackLabel,
  zoom,
  laneWidth,
  selected,
  snapping,
  snapTargets,
  onSelect,
  onDragStateChange,
}: TimelineTrackProps) {
  const updateTimelineLayer = useCanvasStore((s) => s.updateTimelineLayer);
  const toggleTimelineLayer = useCanvasStore((s) => s.toggleTimelineLayer);
  const [draft, setDraft] = useState<TimelineLayer | null>(null);
  const dragRef = useRef<{ mode: DragMode; x: number; layer: TimelineLayer; moved: boolean } | null>(null);

  const layer = draft ?? clip.layer;
  const length = clipLength(clip.kind, clip.sourceDuration, layer);
  const left = layer.start * zoom;
  const width = Math.max(4, length * zoom);
  const style = KIND_STYLE[clip.kind];
  const Icon = style.icon;
  const locked = clip.layer.locked;

  const computeDraft = (mode: DragMode, base: TimelineLayer, deltaSeconds: number, snap: boolean): TimelineLayer => {
    const threshold = snap ? SNAP_PX / zoom : 0;
    const baseLength = clipLength(clip.kind, clip.sourceDuration, base);
    if (mode === 'move') {
      let start = Math.max(0, base.start + deltaSeconds);
      if (threshold > 0) {
        // Snap either edge of the clip
        const snappedStart = snapTime(start, snapTargets, threshold);
        const snappedEnd = snapTime(start + baseLength, snapTargets, threshold) - baseLength;
        start = Math.abs(snappedStart - start) <= Math.abs(snappedEnd - start) ? snappedStart : snappedEnd;
      }
      return { ...base, start: Math.max(0, start) };
    }
    if (mode === 'trim-start') {
      let newStart = base.start + deltaSeconds;
      if (threshold > 0) newStart = snapTime(newStart, snapTargets, threshold);
      const end = base.start + baseLength;
      if (clip.kind === 'image') {
        newStart = Math.min(Math.max(0, newStart), end - MIN_CLIP_SECONDS);
        return { ...base, start: newStart, stillDuration: end - newStart };
      }
      // Can't reveal media before the source begins
      const earliest = base.start - base.trimStart;
      newStart = Math.min(Math.max(Math.max(0, earliest), newStart), end - MIN_CLIP_SECONDS);
      return { ...base, start: newStart, trimStart: base.trimStart + (newStart - base.start) };
    }
    let newEnd = base.start + baseLength + deltaSeconds;
    if (threshold > 0) newEnd = snapTime(newEnd, snapTargets, threshold);
    if (clip.kind === 'image') {
      return { ...base, stillDuration: Math.max(MIN_CLIP_SECONDS, newEnd - base.start) };
    }
    const latest = base.start + (clip.sourceDuration - base.trimStart);
    newEnd = Math.max(base.start + MIN_CLIP_SECONDS, Math.min(latest, newEnd));
    return { ...base, trimEnd: clip.sourceDuration - base.trimStart - (newEnd - base.start) };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(clip.nodeId, false);
    if (locked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = e.clientX - rect.left;
    const canTrim = clip.kind !== 'empty';
    const mode: DragMode = canTrim && offset <= EDGE_PX ? 'trim-start' : canTrim && rect.right - e.clientX <= EDGE_PX ? 'trim-end' : 'move';
    dragRef.current = { mode, x: e.clientX, layer: clip.layer, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    onDragStateChange(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 2) return;
    drag.moved = true;
    // Alt/Option disables snapping for the gesture, like most NLEs
    setDraft(computeDraft(drag.mode, drag.layer, dx / zoom, snapping && !e.altKey));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    onDragStateChange(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (drag?.moved && draft) {
      updateTimelineLayer(clip.nodeId, {
        start: draft.start,
        trimStart: draft.trimStart,
        trimEnd: draft.trimEnd,
        stillDuration: draft.stillDuration,
      });
    }
    setDraft(null);
  };

  const headerButton = (active: boolean, title: string, onClick: () => void, children: React.ReactNode, activeClass: string) => (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold transition-colors',
        active ? activeClass : 'text-white/35 hover:bg-white/10 hover:text-white/80'
      )}
    >
      {children}
    </button>
  );

  return (
    <div className={cn('flex border-b border-white/5', selected && 'bg-white/[0.03]')} style={{ height: TRACK_HEIGHT }}>
      {/* Track header */}
      <div
        className={cn(
          'sticky left-0 z-20 flex shrink-0 items-center gap-1 border-r border-white/10 bg-[#121212] px-1.5',
          selected && 'bg-[#1a1a1a]'
        )}
        style={{ width: HEADER_WIDTH }}
        onClick={() => onSelect(clip.nodeId, true)}
        title="Click to select this node on the canvas"
      >
        <span className={cn('w-6 shrink-0 text-[10px] font-semibold', clip.track === 'audio' ? 'text-emerald-400/80' : 'text-violet-300/80')}>
          {trackLabel}
        </span>
        <Icon className="h-3 w-3 shrink-0 text-white/40" />
        <span className="min-w-0 flex-1 truncate text-[11px] text-white/70">{clip.label}</span>
        {clip.track === 'visual' &&
          headerButton(layer.hidden, layer.hidden ? 'Show layer' : 'Hide layer', () => updateTimelineLayer(clip.nodeId, { hidden: !layer.hidden }),
            layer.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />, 'bg-white/10 text-amber-300')}
        {clip.hasAudio &&
          headerButton(layer.muted, layer.muted ? 'Unmute' : 'Mute', () => updateTimelineLayer(clip.nodeId, { muted: !layer.muted }),
            layer.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />, 'bg-red-500/20 text-red-300')}
        {clip.hasAudio &&
          headerButton(layer.solo, 'Solo', () => updateTimelineLayer(clip.nodeId, { solo: !layer.solo }), 'S', 'bg-amber-500/25 text-amber-300')}
        {headerButton(layer.locked, layer.locked ? 'Unlock' : 'Lock', () => updateTimelineLayer(clip.nodeId, { locked: !layer.locked }),
          layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />, 'bg-white/10 text-white/80')}
        {headerButton(false, 'Remove from timeline', () => toggleTimelineLayer(clip.nodeId), <X className="h-3 w-3" />, '')}
      </div>

      {/* Lane */}
      <div className="relative" style={{ width: laneWidth }}>
        <div
          role="button"
          tabIndex={-1}
          aria-label={`${clip.label} clip`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => onSelect(clip.nodeId, true)}
          className={cn(
            'group absolute top-1 bottom-1 overflow-hidden rounded border text-[10px] text-white/80 select-none',
            style.bg,
            style.border,
            selected && 'ring-2 ring-white/70',
            layer.hidden && 'opacity-40',
            locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
          )}
          style={{
            left,
            width,
            backgroundImage: clip.thumbnail && clip.kind !== 'audio' ? `url(${clip.thumbnail})` : undefined,
            backgroundSize: 'auto 100%',
            backgroundRepeat: 'repeat-x',
            backgroundBlendMode: 'overlay',
          }}
          title={`${clip.label} · ${length.toFixed(2)}s${clip.takeCount ? ` · take ${clip.takeCount} of ${clip.takeCount}` : ''}${locked ? ' · locked' : ''}`}
        >
          {clip.kind === 'audio' && <Waveform url={clip.url} clip={{ ...clip, layer }} width={width} />}
          <div className="pointer-events-none relative flex items-center gap-1 px-1.5 pt-0.5">
            <Icon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate font-medium drop-shadow">{clip.kind === 'empty' ? `${clip.label} · not generated yet` : clip.label}</span>
          </div>
          {!locked && clip.kind !== 'empty' && (
            <>
              <span className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-white/0 group-hover:bg-white/30" />
              <span className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-white/0 group-hover:bg-white/30" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const TimelineTrack = memo(TimelineTrackComponent);
