'use client';

import { memo } from 'react';
import { Hash, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useProjectStore, useCanvasStore } from '@/stores';
import { useShallow } from 'zustand/react/shallow';

// Tag color palette (same as HashtagInput)
const TAG_COLORS = [
  'bg-blue-500/20 text-blue-400 border-blue-500/40',
  'bg-purple-500/20 text-purple-400 border-purple-500/40',
  'bg-green-500/20 text-green-400 border-green-500/40',
  'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'bg-pink-500/20 text-pink-400 border-pink-500/40',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  'bg-red-500/20 text-red-400 border-red-500/40',
  'bg-indigo-500/20 text-indigo-400 border-indigo-500/40',
];

const TAG_ACTIVE_COLORS = [
  'bg-blue-500/40 text-blue-300 border-blue-500/60',
  'bg-purple-500/40 text-purple-300 border-purple-500/60',
  'bg-green-500/40 text-green-300 border-green-500/60',
  'bg-amber-500/40 text-amber-300 border-amber-500/60',
  'bg-pink-500/40 text-pink-300 border-pink-500/60',
  'bg-cyan-500/40 text-cyan-300 border-cyan-500/60',
  'bg-red-500/40 text-red-300 border-red-500/60',
  'bg-indigo-500/40 text-indigo-300 border-indigo-500/60',
];

function getTagColorIndex(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % TAG_COLORS.length;
}

/**
 * Horizontal filter bar showing all available #hashtags.
 * Click a tag to toggle filtering. Active filters dim non-matching nodes on the canvas.
 *
 * Data flow:
 * - Reads: project store filters + canvas store getAllNodeHashtags()
 * - Writes: project store toggleHashtagFilter / clearHashtagFilters
 * - Effect: NovaCanvas reads activeHashtagFilters to apply opacity dimming
 */
export const HashtagFilter = memo(function HashtagFilter() {
  const activeFilters = useProjectStore((s) => s.activeHashtagFilters);
  const toggleFilter = useProjectStore((s) => s.toggleHashtagFilter);
  const clearFilters = useProjectStore((s) => s.clearHashtagFilters);
  // FIX: Use a stable selector that computes tags from nodes directly
  // This avoids calling a function in render that returns a new array each time
  // useShallow: the selector builds a new array, so compare by contents (a new array per
  // read would make React re-render forever)
  const allTags = useCanvasStore(
    useShallow((s) => {
      const tags = new Set<string>();
      for (const node of s.nodes) {
        for (const tag of (node.data.hashtags ?? []) as string[]) tags.add(tag);
      }
      return Array.from(tags).sort();
    })
  );

  // Don't render if no tags exist
  if (allTags.length === 0) return null;

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed left-1/2 top-16 z-40 -translate-x-1/2"
    >
      <div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-card/90 px-3 py-1.5 shadow-lg backdrop-blur-sm">
        <Hash className="h-3 w-3 text-muted-foreground/50" />

        <div className="flex items-center gap-1">
          {allTags.map((tag) => {
            const isActive = activeFilters.includes(tag);
            const colorIndex = getTagColorIndex(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleFilter(tag)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all',
                  isActive
                    ? TAG_ACTIVE_COLORS[colorIndex]
                    : TAG_COLORS[colorIndex],
                  !isActive && hasActiveFilters && 'opacity-50'
                )}
              >
                #{tag}
              </button>
            );
          })}
        </div>

        {/* Clear all filters */}
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={clearFilters}
              className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              title="Clear all filters"
            >
              <X className="h-3 w-3" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});
