'use client';

import { DollarSign } from 'lucide-react';
import { useCanvasStore } from '@/stores';
import { formatUsd } from '@/lib/fal';
import type { AudioNodeData, ElementNodeData, GenerationMetadata, OutputNodeData } from '@/types';

interface BoardSpend {
  total: number;
  count: number;
  hasEstimates: boolean;
}

/** Sum the fal.ai cost recorded on every generated output (and generated audio) on the board. */
function selectBoardSpend(nodes: ReturnType<typeof useCanvasStore.getState>['nodes']): BoardSpend {
  let total = 0;
  let count = 0;
  let hasEstimates = false;
  for (const node of nodes) {
    let metadata: GenerationMetadata | undefined;
    if (node.type === 'output') {
      const data = node.data as OutputNodeData;
      if (data.isPlaceholder) continue;
      metadata = data.generationMetadata;
    } else if (node.type === 'audio') {
      metadata = (node.data as AudioNodeData).generationMetadata;
    } else if (node.type === 'element') {
      metadata = (node.data as ElementNodeData).generationMetadata;
    }
    const cost = metadata?.cost;
    if (typeof cost !== 'number' || cost <= 0) continue;
    total += cost;
    count += 1;
    if (metadata?.costIsEstimate) hasEstimates = true;
  }
  return { total, count, hasEstimates };
}

/**
 * Running fal.ai spend for the outputs on this board (what fal bills the user's own account).
 */
export function BoardFalSpend() {
  // Primitive selectors so the header only re-renders when the totals change
  const total = useCanvasStore((s) => selectBoardSpend(s.nodes).total);
  const count = useCanvasStore((s) => selectBoardSpend(s.nodes).count);
  const hasEstimates = useCanvasStore((s) => selectBoardSpend(s.nodes).hasEstimates);

  if (count === 0) return null;

  return (
    <div
      className="flex h-7 items-center gap-1 rounded-md bg-white/5 px-2.5 text-xs font-medium text-white/60"
      title={`fal.ai spend for the ${count} generation${count === 1 ? '' : 's'} on this board, billed to your own fal.ai account${hasEstimates ? ' (some costs are estimates: fal bills those by tokens or compute)' : ''}`}
    >
      <DollarSign className="h-3 w-3" />
      <span>{hasEstimates ? '~' : ''}{formatUsd(total).replace('$', '')}</span>
      <span className="text-white/30">· {count}</span>
    </div>
  );
}
