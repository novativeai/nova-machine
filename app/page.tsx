'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * Root page (/) - App-first routing like Figma
 * - Authenticated users → /dashboard
 * - Unauthenticated users → /sign-in
 * - Loading → Animated loader
 */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/files');
      } else {
        router.replace('/sign-in');
      }
    }
  }, [user, loading, router]);

  // Loading state
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#0a0a0a]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mb-8 flex flex-col items-center"
      >
        {/* Logo */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
          <div className="h-3 w-3 rounded-full bg-white" />
        </div>
        <p className="mt-6 text-sm font-medium text-white/40">Loading Nova Machine...</p>
      </motion.div>

      {/* Loading bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="h-[2px] w-48 overflow-hidden rounded-full bg-white/10"
      >
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
