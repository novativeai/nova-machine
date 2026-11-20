'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Expand, Grid2x2, Pause, Play, Shrink, SkipBack, StepBack, StepForward } from 'lucide-react';
import { useCanvasStore, useTimelineStore, type PreviewAspect } from '@/stores';
import { formatTimecode, resolveClips, sequenceEnd, TIMELINE_FPS } from '@/lib/timeline/layers';
import { cn } from '@/lib/utils';
import { TimelinePreview } from './TimelinePreview';

const ASPECTS: readonly PreviewAspect[] = ['16:9', '9:16', '1:1', '4:5', '21:9'];

function ratio(aspect: PreviewAspect): number {
  const [w, h] = aspect.split(':').map(Number);
  return w / h;
}

/**
 * Full-window programme viewer (the main window's "Preview" view): letterboxed frame at the
 * chosen delivery aspect, safe-area guides, scrub bar, transport and fullscreen.
 */
export function ProgramViewer() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const {
    currentTime,
    isPlaying,
    previewAspect,
    safeGuides,
    seek,
    pause,
    togglePlay,
    setPreviewAspect,
    toggleSafeGuides,
  } = useTimelineStore();

  const clips = useMemo(() => resolveClips(nodes, edges), [nodes, edges]);
  const end = sequenceEnd(clips);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fit the frame inside the stage at the delivery aspect (letterbox / pillarbox)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const r = ratio(previewAspect);
      const { clientWidth: w, clientHeight: h } = stage;
      const width = Math.min(w, h * r);
      setFrame({ width: Math.floor(width), height: Math.floor(width / r) });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [previewAspect]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const frameStep = 1 / TIMELINE_FPS;
    if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      seek(currentTime - (e.shiftKey ? 1 : frameStep));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      seek(Math.min(end, currentTime + (e.shiftKey ? 1 : frameStep)));
    } else if (e.key === 'Home') {
      e.preventDefault();
      seek(0);
    } else if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    }
  };

  const progress = end > 0 ? Math.min(1, currentTime / end) : 0;

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex h-full w-full flex-col bg-[#0a0a0a] outline-none"
      aria-label="Programme viewer"
    >
      {/* Stage */}
      <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center p-6">
        <div
          className="relative overflow-hidden bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
          style={{ width: frame.width, height: frame.height }}
          onClick={() => end > 0 && togglePlay()}
        >
          <TimelinePreview clips={clips} hideEmptyHint={end <= 0} />
          {safeGuides && (
            <div className="pointer-events-none absolute inset-0">
              {/* Action safe 93%, title safe 90% */}
              <div className="absolute border border-dashed border-white/35" style={{ inset: '3.5%' }} />
              <div className="absolute border border-dashed border-amber-300/50" style={{ inset: '5%' }} />
              <div className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-white/40" />
              <div className="absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-white/40" />
            </div>
          )}
          {end <= 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-white/35">
              The timeline is empty. Switch on the timeline icon on a node to start the edit.
            </div>
          )}
        </div>
      </div>

      {/* Scrub bar */}
      <div className="px-4">
        <div
          className="group relative h-4 cursor-pointer"
          onPointerDown={(e) => {
            const bar = e.currentTarget;
            pause();
            const seekAt = (clientX: number) => {
              const rect = bar.getBoundingClientRect();
              seek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * end);
            };
            seekAt(e.clientX);
            bar.setPointerCapture(e.pointerId);
            const move = (ev: PointerEvent) => seekAt(ev.clientX);
            const up = () => {
              bar.removeEventListener('pointermove', move);
              bar.removeEventListener('pointerup', up);
            };
            bar.addEventListener('pointermove', move);
            bar.addEventListener('pointerup', up);
          }}
          role="slider"
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuemax={end}
          aria-valuenow={currentTime}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10 transition-all group-hover:h-1.5" />
          <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-emerald-400 transition-all group-hover:h-1.5" style={{ width: `${progress * 100}%` }} />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Transport */}
      <div className="flex h-11 shrink-0 items-center gap-2 px-3">
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => seek(0)} className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white" title="Go to start (Home)">
            <SkipBack className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => seek(currentTime - 1 / TIMELINE_FPS)} className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white" title="Previous frame (←)">
            <StepBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={end <= 0}
            className="mx-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 disabled:opacity-30"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </button>
          <button type="button" onClick={() => seek(Math.min(end, currentTime + 1 / TIMELINE_FPS))} className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white" title="Next frame (→)">
            <StepForward className="h-4 w-4" />
          </button>
        </div>

        <span className="font-mono text-xs tabular-nums text-emerald-300">{formatTimecode(currentTime)}</span>
        <span className="font-mono text-xs tabular-nums text-white/30">/ {formatTimecode(end)}</span>

        <div className="flex-1" />

        <div className="flex items-center rounded-md bg-white/5 p-0.5" role="radiogroup" aria-label="Frame aspect">
          {ASPECTS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={previewAspect === a}
              onClick={() => setPreviewAspect(a)}
              className={cn(
                'rounded px-2 py-0.5 font-mono text-[11px] transition-colors',
                previewAspect === a ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white/80'
              )}
            >
              {a}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleSafeGuides}
          className={cn('rounded p-1.5 transition-colors', safeGuides ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white')}
          title="Title / action safe guides"
          aria-pressed={safeGuides}
        >
          <Grid2x2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={toggleFullscreen} className="rounded p-1.5 text-white/50 hover:bg-white/10 hover:text-white" title="Fullscreen (F)">
          {isFullscreen ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
