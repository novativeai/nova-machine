'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  ChartGantt,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Magnet,
  Maximize,
  Pause,
  Play,
  SkipBack,
  StepBack,
  StepForward,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCanvasStore, useTimelineStore, TIMELINE_MAX_ZOOM, TIMELINE_MIN_ZOOM } from '@/stores';
import {
  formatRulerLabel,
  formatTimecode,
  resolveClips,
  rulerStep,
  sequenceEnd,
  TIMELINE_FPS,
  type TimelineClip,
} from '@/lib/timeline/layers';
import { useTimelineExport } from '@/hooks/useTimelineExport';
import { cn } from '@/lib/utils';
import { HEADER_WIDTH, TimelineTrack, TRACK_HEIGHT } from './TimelineTrack';
import { TimelinePreview } from './TimelinePreview';

const BAR_HEIGHT = 34;
const RULER_HEIGHT = 22;
/** Extra room after the last clip, seconds. */
const TAIL_SECONDS = 10;

function trackLabels(clips: TimelineClip[]): Map<string, string> {
  const labels = new Map<string, string>();
  const visual = clips.filter((c) => c.track === 'visual');
  const audio = clips.filter((c) => c.track === 'audio');
  // Top visual layer has the highest number (V3 above V2 above V1)
  visual.forEach((c, i) => labels.set(c.nodeId, `V${visual.length - i}`));
  audio.forEach((c, i) => labels.set(c.nodeId, `A${i + 1}`));
  return labels;
}

/**
 * Bottom-docked timeline. Every node with its timeline icon on is one layer; clips,
 * trims and layer switches are stored on the node, so canvas and timeline stay one model.
 */
export function TimelinePanel() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const toggleTimelineLayer = useCanvasStore((s) => s.toggleTimelineLayer);
  const {
    isOpen,
    height,
    zoom,
    snapping,
    currentTime,
    isPlaying,
    toggleOpen,
    setHeight,
    setZoom,
    toggleSnapping,
    seek,
    pause,
    togglePlay,
  } = useTimelineStore();
  const { setCenter, getZoom } = useReactFlow();
  const { state: exportState, exportTimeline, reset: resetExport } = useTimelineExport();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollerWidth, setScrollerWidth] = useState(800);
  const [isDraggingClip, setIsDraggingClip] = useState(false);

  const clips = useMemo(() => resolveClips(nodes, edges), [nodes, edges]);
  const labels = useMemo(() => trackLabels(clips), [clips]);
  const end = sequenceEnd(clips);
  const selectedIds = useMemo(() => new Set(nodes.filter((n) => n.selected).map((n) => n.id)), [nodes]);
  const laneWidth = Math.max((end + TAIL_SECONDS) * zoom, scrollerWidth - HEADER_WIDTH);

  // Snap to every clip edge, the playhead and zero
  const snapTargets = useCallback(
    (nodeId: string) => [0, currentTime, ...clips.filter((c) => c.nodeId !== nodeId).flatMap((c) => [c.start, c.end])],
    [clips, currentTime]
  );

  // Track the scroller width for the minimum lane width
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setScrollerWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen]);

  // Transport clock
  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const t = useTimelineStore.getState().currentTime + (now - last) / 1000;
      last = now;
      if (t >= end) {
        seek(end);
        pause();
        return;
      }
      seek(t);
      frame = requestAnimationFrame(tick);
    };
    if (useTimelineStore.getState().currentTime >= end) seek(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, end, seek, pause]);

  // The monitor (and its media) unmounts when collapsed, so stop the transport too
  useEffect(() => {
    if (!isOpen && isPlaying) pause();
  }, [isOpen, isPlaying, pause]);

  // Keep the playhead in view while playing
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !isPlaying) return;
    const x = currentTime * zoom;
    const visibleStart = el.scrollLeft;
    const visibleEnd = el.scrollLeft + el.clientWidth - HEADER_WIDTH;
    if (x < visibleStart || x > visibleEnd - 40) el.scrollLeft = Math.max(0, x - 80);
  }, [currentTime, zoom, isPlaying]);

  /** Select the node on the canvas (and optionally pan the canvas to it). */
  const selectNode = useCallback(
    (nodeId: string, focusCanvas: boolean) => {
      onNodesChange(nodes.map((n) => ({ type: 'select' as const, id: n.id, selected: n.id === nodeId })));
      if (!focusCanvas) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const w = node.measured?.width ?? 300;
      const h = node.measured?.height ?? 300;
      setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: Math.max(getZoom(), 0.6), duration: 400 });
    },
    [nodes, onNodesChange, setCenter, getZoom]
  );

  // Ruler scrubbing
  const scrubbing = useRef(false);
  const seekFromPointer = (clientX: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left - HEADER_WIDTH + el.scrollLeft;
    seek(Math.round((x / zoom) * TIMELINE_FPS) / TIMELINE_FPS);
  };

  // Resize from the top edge
  const resizeRef = useRef<{ y: number; h: number } | null>(null);

  const fit = () => {
    const width = (scrollerRef.current?.clientWidth ?? 800) - HEADER_WIDTH - 24;
    setZoom(end > 0 ? width / end : 40);
    if (scrollerRef.current) scrollerRef.current.scrollLeft = 0;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
    const frame = 1 / TIMELINE_FPS;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'Home':
        e.preventDefault();
        seek(0);
        break;
      case 'End':
        e.preventDefault();
        seek(end);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seek(currentTime - (e.shiftKey ? 1 : frame));
        break;
      case 'ArrowRight':
        e.preventDefault();
        seek(currentTime + (e.shiftKey ? 1 : frame));
        break;
      case '=':
      case '+':
        setZoom(zoom * 1.25);
        break;
      case '-':
        setZoom(zoom / 1.25);
        break;
      case 's':
      case 'S':
        toggleSnapping();
        break;
      case '\\':
        fit();
        break;
      case 'Delete':
      case 'Backspace': {
        const selectedClip = clips.find((c) => selectedIds.has(c.nodeId));
        if (selectedClip && !selectedClip.layer.locked) {
          e.preventDefault();
          toggleTimelineLayer(selectedClip.nodeId);
        }
        break;
      }
    }
  };

  const step = rulerStep(zoom);
  const ticks: number[] = [];
  for (let t = 0; t <= laneWidth / zoom; t += step) ticks.push(Number(t.toFixed(4)));
  const minor = step / 5;

  const exporting = exportState.stage === 'preparing' || exportState.stage === 'composing';
  const visualCount = clips.filter((c) => c.track === 'visual' && c.kind !== 'empty').length;

  return (
    <>
      {/* Splitter between the canvas window and the timeline window (drag to resize) */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize timeline"
        className="group relative z-30 flex h-1.5 shrink-0 cursor-ns-resize items-center justify-center bg-[#070707]"
        onPointerDown={(e) => {
          e.preventDefault();
          // Pulling the divider of a collapsed timeline opens it from its current height
          const startHeight = isOpen ? height : BAR_HEIGHT;
          if (!isOpen) toggleOpen();
          resizeRef.current = { y: e.clientY, h: startHeight };
          e.currentTarget.setPointerCapture(e.pointerId);
          document.body.style.cursor = 'ns-resize';
        }}
        onPointerMove={(e) => {
          if (resizeRef.current) setHeight(resizeRef.current.h + (resizeRef.current.y - e.clientY));
        }}
        onPointerUp={(e) => {
          resizeRef.current = null;
          document.body.style.cursor = '';
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onDoubleClick={toggleOpen}
        title="Drag to resize · double-click to collapse/expand"
      >
        <div className="h-[3px] w-10 rounded-full bg-white/15 transition-colors group-hover:bg-emerald-400/70" />
      </div>

    <section
      aria-label="Timeline"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative mx-1.5 mb-1.5 flex shrink-0 flex-col overflow-hidden rounded-md border border-white/10 bg-[#0d0d0d] outline-none focus-visible:border-emerald-500/40"
      style={{ height: isOpen ? height : BAR_HEIGHT }}
    >
      {/* Bar: title, transport, timecode, tools, export */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-2" style={{ height: BAR_HEIGHT }}>
        <button
          type="button"
          onClick={toggleOpen}
          className="-ml-2 flex h-full items-center gap-1.5 border-r border-white/10 bg-[#161616] px-3 text-xs font-medium text-white/85 hover:bg-[#1c1c1c]"
          title={isOpen ? 'Collapse timeline' : 'Expand timeline'}
        >
          <ChartGantt className="h-3.5 w-3.5 text-emerald-400" />
          Timeline
          <span className="text-white/35">· {clips.length} layer{clips.length === 1 ? '' : 's'}</span>
          {isOpen ? <ChevronDown className="h-3 w-3 text-white/40" /> : <ChevronUp className="h-3 w-3 text-white/40" />}
        </button>

        <div className="mx-1 h-4 w-px bg-white/10" />

        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => seek(0)} className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white" title="Go to start (Home)">
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => seek(currentTime - 1 / TIMELINE_FPS)} className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white" title="Previous frame (←)">
            <StepBack className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={end <= 0}
            className="rounded bg-white/10 p-1 text-white hover:bg-white/20 disabled:opacity-40"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => seek(currentTime + 1 / TIMELINE_FPS)} className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white" title="Next frame (→)">
            <StepForward className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="font-mono text-[11px] tabular-nums text-emerald-300" title="Playhead (hh:mm:ss:ff, 30 fps)">
          {formatTimecode(currentTime)}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-white/30">/ {formatTimecode(end)}</span>

        <div className="flex-1" />

        {isOpen && (
          <>
            <button
              type="button"
              onClick={toggleSnapping}
              className={cn('rounded p-1 transition-colors', snapping ? 'bg-emerald-500/15 text-emerald-300' : 'text-white/40 hover:bg-white/10')}
              title={`Snapping ${snapping ? 'on' : 'off'} (S; hold Alt while dragging to bypass)`}
            >
              <Magnet className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setZoom(zoom / 1.25)} className="rounded p-1 text-white/60 hover:bg-white/10" title="Zoom out (−)">
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <input
              type="range"
              min={Math.log(TIMELINE_MIN_ZOOM)}
              max={Math.log(TIMELINE_MAX_ZOOM)}
              step={0.01}
              value={Math.log(zoom)}
              onChange={(e) => setZoom(Math.exp(Number(e.target.value)))}
              className="w-24 accent-emerald-400"
              aria-label="Timeline zoom"
            />
            <button type="button" onClick={() => setZoom(zoom * 1.25)} className="rounded p-1 text-white/60 hover:bg-white/10" title="Zoom in (=)">
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={fit} className="rounded p-1 text-white/60 hover:bg-white/10" title="Fit sequence (\)">
              <Maximize className="h-3.5 w-3.5" />
            </button>
            <div className="mx-1 h-4 w-px bg-white/10" />
          </>
        )}

        {exportState.stage === 'done' && exportState.url && (
          <a
            href={exportState.url}
            target="_blank"
            rel="noreferrer"
            onClick={resetExport}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10"
          >
            <Download className="h-3 w-3" />
            Download MP4
          </a>
        )}
        {exportState.stage === 'error' && (
          <button type="button" onClick={resetExport} className="max-w-xs truncate text-[11px] text-red-300" title={exportState.error}>
            {exportState.error}
          </button>
        )}
        <button
          type="button"
          onClick={exportTimeline}
          disabled={exporting || visualCount === 0}
          className="flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-40"
          title="Render the timeline to one MP4 on fal.ai (your key). FFmpeg steps are compute-billed, fractions of a cent each."
        >
          {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {exporting ? `${exportState.message || 'Exporting'} ${Math.round(exportState.progress * 100)}%` : 'Export'}
        </button>
      </div>

      {isOpen && (
        <div className="flex min-h-0 flex-1">
          {/* Programme monitor */}
          <div className="flex shrink-0 items-center justify-center border-r border-white/5 p-2" style={{ width: Math.min(420, ((height - BAR_HEIGHT - 16) * 16) / 9 + 16) }}>
            <div className="aspect-video w-full">
              <TimelinePreview clips={clips} />
            </div>
          </div>

          {/* Tracks */}
          <div
            ref={scrollerRef}
            className="relative min-w-0 flex-1 overflow-auto"
            onWheel={(e) => {
              if (!(e.ctrlKey || e.metaKey)) return;
              e.preventDefault();
              setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
            }}
          >
            <div className="relative" style={{ width: HEADER_WIDTH + laneWidth }}>
              {/* Ruler */}
              <div className="sticky top-0 z-20 flex border-b border-white/10 bg-[#101010]" style={{ height: RULER_HEIGHT }}>
                <div className="sticky left-0 z-30 shrink-0 border-r border-white/10 bg-[#101010]" style={{ width: HEADER_WIDTH }} />
                <div
                  className="relative cursor-text"
                  style={{ width: laneWidth }}
                  onPointerDown={(e) => {
                    scrubbing.current = true;
                    pause();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    seekFromPointer(e.clientX);
                  }}
                  onPointerMove={(e) => {
                    if (scrubbing.current) seekFromPointer(e.clientX);
                  }}
                  onPointerUp={(e) => {
                    scrubbing.current = false;
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                >
                  {ticks.map((t) => (
                    <div key={t} className="absolute top-0 h-full" style={{ left: t * zoom }}>
                      <div className="h-full w-px bg-white/20" />
                      <span className="absolute left-1 top-0.5 font-mono text-[9px] text-white/40">{formatRulerLabel(t)}</span>
                      {[1, 2, 3, 4].map((m) => (
                        <div key={m} className="absolute bottom-0 h-1.5 w-px bg-white/10" style={{ left: m * minor * zoom }} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Layers */}
              {clips.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-6 text-xs text-white/40" style={{ marginLeft: HEADER_WIDTH }}>
                  <ChartGantt className="h-4 w-4" />
                  Turn on the timeline icon on a prompt, video, image, audio or output node to add it as a layer.
                </div>
              ) : (
                clips.map((clip) => (
                  <TimelineTrack
                    key={clip.nodeId}
                    clip={clip}
                    trackLabel={labels.get(clip.nodeId) ?? ''}
                    zoom={zoom}
                    laneWidth={laneWidth}
                    selected={selectedIds.has(clip.nodeId)}
                    snapping={snapping}
                    snapTargets={snapTargets(clip.nodeId)}
                    onSelect={selectNode}
                    onDragStateChange={setIsDraggingClip}
                  />
                ))
              )}

              {/* Playhead */}
              <div
                className={cn('pointer-events-none absolute top-0 z-10 w-px bg-emerald-400', isDraggingClip && 'opacity-60')}
                style={{ left: HEADER_WIDTH + currentTime * zoom, height: RULER_HEIGHT + Math.max(1, clips.length) * TRACK_HEIGHT }}
              >
                <div className="absolute -left-[5px] top-0 h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
    </>
  );
}
