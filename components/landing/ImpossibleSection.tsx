'use client';

import { useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { VIDEO_CATALOG } from '@/lib/video-catalog';

interface Showcase {
  id: string;
  video: string;
  poster: string;
  aspect: string;
  caption: string;
  subcaption: string;
}

// Helper to get ONLY landscape videos for full-width showcases (16:9 - 1920x1080)
const getWideShowcase = (id: string, caption: string, subcaption: string): Showcase | null => {
  const v = VIDEO_CATALOG.find(v => v.id === id && v.aspect === 'landscape');
  return v ? { id: v.id, video: v.video, poster: v.poster, aspect: v.aspect, caption, subcaption } : null;
};

// Only LANDSCAPE videos (1920x1080) for full-width cinematic showcases
const SHOWCASES: Showcase[] = [
  getWideShowcase('spaceman-wide', 'From a single photograph', 'A still image becomes a living scene'),
  getWideShowcase('speedboat-chase', 'From twelve words', 'Text transforms into cinematic footage'),
  getWideShowcase('astronaut-flag', 'From rough sketches', 'Imagination meets reality'),
].filter(Boolean) as Showcase[];

export function ImpossibleSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#050505] py-32">
      {/* Background gradient */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ y }}
      >
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-[120px]" />
      </motion.div>

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-20 text-center"
        >
          <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
            Impossible, now possible
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/40">
            Things that couldn&apos;t exist before. Now they can.
          </p>
        </motion.div>

        {/* Full-width showcases */}
        <div className="space-y-8">
          {SHOWCASES.map((showcase, index) => (
            <ShowcaseCard
              key={showcase.id}
              showcase={showcase}
              index={index}
              isInView={isInView}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowcaseCard({
  showcase,
  index,
  isInView,
}: {
  showcase: Showcase;
  index: number;
  isInView: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardInView = useInView(cardRef, { once: false, margin: '-20%' });

  // Play video when in view
  if (cardInView && videoRef.current) {
    videoRef.current.play().catch(() => {});
  } else if (!cardInView && videoRef.current) {
    videoRef.current.pause();
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay: index * 0.2 }}
      className="group relative"
    >
      {/* Video container - full width */}
      <div className="relative aspect-[21/9] overflow-hidden rounded-2xl bg-neutral-900">
        <video
          ref={videoRef}
          src={showcase.video}
          poster={showcase.poster}
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Caption overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={cardInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm uppercase tracking-widest text-white/50">
              {showcase.subcaption}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white md:text-3xl lg:text-4xl">
              {showcase.caption}
            </h3>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
