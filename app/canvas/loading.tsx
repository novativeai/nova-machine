'use client';

import { motion } from 'framer-motion';

/**
 * Canvas loading screen.
 * Shown by Next.js when navigating to /canvas (while the page component loads).
 * Displays the Nova Machine logo + a sleek white progress bar.
 */
export default function CanvasLoading() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#0a0a0a]">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mb-8 flex flex-col items-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/5">
          <div className="h-2 w-2 rounded-full bg-white" />
        </div>
        <span className="mt-4 text-sm font-medium tracking-wide text-white/40">
          Nova Machine
        </span>
      </motion.div>

      {/* Progress bar container */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="h-[2px] w-48 overflow-hidden rounded-full bg-white/10"
      >
        {/* Animated progress indicator */}
        <motion.div
          className="h-full rounded-full bg-white"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{
            repeat: Infinity,
            duration: 1.2,
            ease: 'easeInOut',
          }}
          style={{ width: '40%' }}
        />
      </motion.div>
    </div>
  );
}
