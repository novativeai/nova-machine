'use client';

import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { VIDEO_CATALOG } from '@/lib/video-catalog';

interface Possibility {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  video: string;
  poster: string;
  gradient: string;
}

// Helper to get ONLY landscape videos (1920x1080) for 16:10 cards
const getLandscapeVideo = (id: string) => {
  const v = VIDEO_CATALOG.find(v => v.id === id && v.aspect === 'landscape');
  return v ? { video: v.video, poster: v.poster, aspect: v.aspect } : null;
};

// Intentional video selection - ONLY landscape videos (verified 1920x1080)
const textVideo = getLandscapeVideo('spaceman-wide');      // 1920x1080 - Dramatic creation
const imageVideo = getLandscapeVideo('explorer-mountain'); // 1920x1080 - Calm image comes to life
const videoVideo = getLandscapeVideo('noir-bar');          // 1920x1080 - Transformation
const sketchVideo = getLandscapeVideo('alien-jungle');     // 1920x1080 - Pure imagination

const POSSIBILITIES: Possibility[] = [
  {
    id: 'text',
    title: 'From Nothing',
    subtitle: 'Text to Video',
    description: 'Describe your vision. Watch it materialize.',
    video: textVideo?.video || '',
    poster: textVideo?.poster || '',
    gradient: 'from-violet-500/20 to-transparent',
  },
  {
    id: 'image',
    title: 'From Still',
    subtitle: 'Image to Video',
    description: 'Breathe life into any photograph.',
    video: imageVideo?.video || '',
    poster: imageVideo?.poster || '',
    gradient: 'from-cyan-500/20 to-transparent',
  },
  {
    id: 'video',
    title: 'From Memory',
    subtitle: 'Video to Video',
    description: 'Transform existing footage into something new.',
    video: videoVideo?.video || '',
    poster: videoVideo?.poster || '',
    gradient: 'from-amber-500/20 to-transparent',
  },
  {
    id: 'sketch',
    title: 'From Imagination',
    subtitle: 'Sketch to Reality',
    description: 'Your roughest ideas become polished visions.',
    video: sketchVideo?.video || '',
    poster: sketchVideo?.poster || '',
    gradient: 'from-rose-500/20 to-transparent',
  },
];

export function PossibilitiesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#0a0a0a] py-32">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.02] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-20 text-center"
        >
          <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
            The possibilities
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/50">
            Every creation starts somewhere. Where will yours begin?
          </p>
        </motion.div>

        {/* Possibility Cards - Exploding Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {POSSIBILITIES.map((possibility, index) => (
            <PossibilityCard
              key={possibility.id}
              possibility={possibility}
              index={index}
              isInView={isInView}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PossibilityCard({
  possibility,
  index,
  isInView,
}: {
  possibility: Possibility;
  index: number;
  isInView: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    videoRef.current?.play().catch(() => {});
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // Staggered explosion animation from center
  const directions = [
    { x: -30, y: -30 }, // top-left
    { x: 30, y: -30 },  // top-right
    { x: -30, y: 30 },  // bottom-left
    { x: 30, y: 30 },   // bottom-right
  ];

  return (
    <motion.div
      initial={{
        opacity: 0,
        x: directions[index].x,
        y: directions[index].y,
        scale: 0.9
      }}
      animate={isInView ? {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1
      } : {}}
      transition={{
        duration: 0.8,
        delay: 0.1 + index * 0.1,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative cursor-pointer"
    >
      {/* Card Container */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm transition-all duration-500 hover:border-white/20 hover:bg-white/[0.04]">
        {/* Video Container */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <video
            ref={videoRef}
            src={possibility.video}
            poster={possibility.poster}
            loop
            muted
            playsInline
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />

          {/* Gradient Overlay */}
          <div className={`absolute inset-0 bg-gradient-to-t ${possibility.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative p-6">
          {/* Subtitle pill */}
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
            {possibility.subtitle}
          </span>

          {/* Title */}
          <h3 className="mt-4 text-2xl font-semibold text-white transition-colors group-hover:text-white">
            {possibility.title}
          </h3>

          {/* Description */}
          <p className="mt-2 text-sm text-white/50 transition-colors group-hover:text-white/70">
            {possibility.description}
          </p>

          {/* Hover indicator */}
          <motion.div
            className="mt-4 flex items-center gap-2 text-sm text-white/40"
            animate={{ x: isHovered ? 5 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <span className="transition-colors group-hover:text-white/80">Explore</span>
            <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
          </motion.div>
        </div>

        {/* Glow effect on hover */}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          <div className={`absolute inset-0 bg-gradient-to-br ${possibility.gradient} blur-xl`} />
        </div>
      </div>
    </motion.div>
  );
}
