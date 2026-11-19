'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number; // 0-100
  duration?: number; // seconds
  isActive?: boolean;
}

export function ProgressBar({ progress, duration = 15, isActive = false }: ProgressBarProps) {
  return (
    <div className="relative h-0.5 w-full overflow-hidden rounded-full bg-white/10">
      <motion.div
        className="absolute left-0 top-0 h-full bg-[var(--color-landing-accent)]"
        initial={{ width: '0%' }}
        animate={{ width: isActive ? '100%' : `${progress}%` }}
        transition={{
          duration: isActive ? duration : 0.3,
          ease: 'linear',
        }}
      />
    </div>
  );
}
