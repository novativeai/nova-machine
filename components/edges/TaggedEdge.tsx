'use client';

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Position,
} from '@xyflow/react';
import type { NovaEdgeData } from '@/types';

interface TaggedEdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  data?: NovaEdgeData;
  selected?: boolean;
  markerEnd?: string;
}

function TaggedEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: TaggedEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeColor = data?.color || '#525252';
  const isAnimated = data?.animated || false;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: edgeColor,
          strokeWidth: selected ? 3 : 2,
          filter: selected ? `drop-shadow(0 0 4px ${edgeColor})` : undefined,
        }}
        className={isAnimated ? 'animated-edge' : ''}
      />
      {data?.tag && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <span
              className="rounded px-1.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${edgeColor}30`,
                color: edgeColor,
                border: `1px solid ${edgeColor}50`,
              }}
            >
              {data.tag}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const TaggedEdge = memo(TaggedEdgeComponent);
