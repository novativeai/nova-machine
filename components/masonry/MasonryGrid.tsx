'use client';

import { ReactNode } from 'react';

interface MasonryGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * CSS Columns-based Masonry Grid
 * - 2 columns on mobile/tablet
 * - 3 columns on desktop (lg: 1024px+)
 * - Uses columnFill: 'balance' for even distribution
 */
export function MasonryGrid({ children, className = '' }: MasonryGridProps) {
  return (
    <div
      className={`columns-2 gap-3 lg:columns-3 ${className}`}
      style={{ columnFill: 'balance' }}
    >
      {children}
    </div>
  );
}
