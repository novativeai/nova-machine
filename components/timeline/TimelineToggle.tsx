'use client';

import { memo, useCallback } from 'react';
import { ChartGantt } from 'lucide-react';
import { useCanvasStore, useTimelineStore } from '@/stores';
import { canBeTimelineLayer, hasTimelineMedia } from '@/lib/timeline/layers';
import { cn } from '@/lib/utils';

interface TimelineToggleProps {
  nodeId: string;
}

/**
 * Per-node switch: on = this node is a layer (track) on the timeline, off = removed.
 * Turning a layer back on restores its previous position and trims.
 */
function TimelineToggleComponent({ nodeId }: TimelineToggleProps) {
  const enabled = useCanvasStore(
    useCallback((s) => Boolean(s.nodes.find((n) => n.id === nodeId)?.data.timeline?.enabled), [nodeId])
  );
  const available = useCanvasStore(
    useCallback((s) => {
      const node = s.nodes.find((n) => n.id === nodeId);
      return Boolean(node && canBeTimelineLayer(node) && hasTimelineMedia(node, s.nodes, s.edges));
    }, [nodeId])
  );
  const toggleTimelineLayer = useCanvasStore((s) => s.toggleTimelineLayer);
  const setOpen = useTimelineStore((s) => s.setOpen);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!available) return;
    if (!enabled) setOpen(true);
    toggleTimelineLayer(nodeId);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      disabled={!available}
      aria-pressed={enabled}
      className={cn(
        'nodrag flex h-5 w-5 items-center justify-center rounded transition-colors',
        enabled
          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
          : 'text-white/30 hover:bg-white/10 hover:text-white/70',
        !available && 'cursor-not-allowed opacity-30 hover:bg-transparent'
      )}
      title={
        !available
          ? 'Add media to put this node on the timeline'
          : enabled
            ? 'On the timeline: click to remove this layer'
            : 'Add to the timeline as a layer'
      }
    >
      <ChartGantt className="h-3 w-3" />
    </button>
  );
}

export const TimelineToggle = memo(TimelineToggleComponent);
