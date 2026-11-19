'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface Visionary {
  id: string;
  title: string;
  role: string;
  description: string;
  gradient: string;
  aspectRatio: string;
}

const VISIONARIES: Visionary[] = [
  {
    id: 'filmmaker',
    title: 'The Filmmaker',
    role: 'Pre-visualization',
    description: 'See entire scenes before a single shot is filmed. Iterate on concepts in minutes, not months.',
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    aspectRatio: 'aspect-[21/9]',
  },
  {
    id: 'creator',
    title: 'The Creator',
    role: 'Content at scale',
    description: '10x your output without 10x the effort. Every idea becomes content, instantly.',
    gradient: 'from-rose-500/20 via-pink-500/10 to-transparent',
    aspectRatio: 'aspect-[9/16]',
  },
  {
    id: 'brand',
    title: 'The Brand Builder',
    role: 'Campaign velocity',
    description: 'From concept to campaign in hours, not weeks. Test ideas before committing budget.',
    gradient: 'from-blue-500/20 via-cyan-500/10 to-transparent',
    aspectRatio: 'aspect-video',
  },
  {
    id: 'dreamer',
    title: 'The Dreamer',
    role: 'Pure imagination',
    description: 'Finally see what lives in your imagination. No technical barriers. Just vision.',
    gradient: 'from-violet-500/20 via-purple-500/10 to-transparent',
    aspectRatio: 'aspect-square',
  },
];

export function VisionariesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#0a0a0a] py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-16"
        >
          <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
            Built for visionaries
          </h2>
          <p className="mt-6 max-w-xl text-lg text-white/50">
            Every creator has a different vision. Nova adapts to yours.
          </p>
        </motion.div>

        {/* Horizontal scroll container */}
        <div className="relative -mx-6 px-6">
          <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide">
            {VISIONARIES.map((visionary, index) => (
              <VisionaryCard
                key={visionary.id}
                visionary={visionary}
                index={index}
                isInView={isInView}
              />
            ))}
          </div>

          {/* Scroll hint gradient */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-8 w-32 bg-gradient-to-l from-[#0a0a0a] to-transparent" />
        </div>
      </div>
    </section>
  );
}

function VisionaryCard({
  visionary,
  index,
  isInView,
}: {
  visionary: Visionary;
  index: number;
  isInView: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="group relative w-[340px] flex-shrink-0"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-all duration-500 hover:border-white/20 hover:bg-white/[0.04]">
        {/* Gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${visionary.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />

        {/* Content */}
        <div className="relative">
          {/* Role tag */}
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
            {visionary.role}
          </span>

          {/* Title */}
          <h3 className="mt-6 text-2xl font-semibold text-white">
            {visionary.title}
          </h3>

          {/* Description */}
          <p className="mt-4 text-sm leading-relaxed text-white/50">
            {visionary.description}
          </p>

          {/* Aspect ratio preview */}
          <div className="mt-8">
            <div className={`${visionary.aspectRatio} max-h-32 w-full rounded-lg border border-white/10 bg-white/[0.03]`}>
              <div className="flex h-full items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-white/20" />
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-white/30">
              {visionary.aspectRatio === 'aspect-[21/9]' && 'Cinematic 21:9'}
              {visionary.aspectRatio === 'aspect-[9/16]' && 'Vertical 9:16'}
              {visionary.aspectRatio === 'aspect-video' && 'Standard 16:9'}
              {visionary.aspectRatio === 'aspect-square' && 'Square 1:1'}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
