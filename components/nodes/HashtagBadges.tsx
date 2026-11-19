'use client';

import { memo, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useCanvasStore, useProjectStore } from '@/stores';
import { HashtagInput } from '@/components/ui/HashtagInput';

interface HashtagBadgesProps {
  nodeId: string;
  className?: string;
}

/**
 * Compact hashtag display + inline editor for any node type.
 *
 * Data flow:
 * - Reads: specific node's hashtags via targeted selector (avoids O(n²) re-renders)
 * - Writes: canvas store addHashtagToNode / removeHashtagFromNode
 * - Suggestions: union of project store + all node hashtags from canvas store
 */
export const HashtagBadges = memo(function HashtagBadges({
  nodeId,
  className,
}: HashtagBadgesProps) {
  // FIX: Select only this node's hashtags, not entire nodes array
  const hashtags = useCanvasStore(
    useCallback(
      (s) => {
        const node = s.nodes.find((n) => n.id === nodeId);
        return (node?.data?.hashtags as string[]) || [];
      },
      [nodeId]
    )
  );
  const addHashtagToNode = useCanvasStore((s) => s.addHashtagToNode);
  const removeHashtagFromNode = useCanvasStore((s) => s.removeHashtagFromNode);
  const getAllNodeHashtags = useCanvasStore((s) => s.getAllNodeHashtags);
  const getAllProjectHashtags = useProjectStore((s) => s.getAllHashtags);

  // Memoize suggestions to avoid recreating on every render
  const suggestions = useMemo(
    () => [...new Set([...getAllNodeHashtags(), ...getAllProjectHashtags()])].sort(),
    [getAllNodeHashtags, getAllProjectHashtags]
  );

  const handleAddTag = useCallback(
    (tag: string) => {
      addHashtagToNode(nodeId, tag);
    },
    [nodeId, addHashtagToNode]
  );

  const handleRemoveTag = useCallback(
    (tag: string) => {
      removeHashtagFromNode(nodeId, tag);
    },
    [nodeId, removeHashtagFromNode]
  );

  return (
    <div className={cn('mt-1', className)}>
      <HashtagInput
        tags={hashtags}
        suggestions={suggestions}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        compact
      />
    </div>
  );
});
