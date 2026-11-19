'use client';

import { useRef } from 'react';
import { VIDEO_CATALOG } from '@/lib/video-catalog';

interface Feature {
  id: string;
  video: string;
  poster: string;
  title: string;
  description: string;
}

// Helper to get ONLY landscape videos (1920x1080) for 16:9 feature cards
const getLandscapeVideo = (id: string) => {
  const v = VIDEO_CATALOG.find(v => v.id === id && v.aspect === 'landscape');
  return v ? { video: v.video, poster: v.poster, aspect: v.aspect } : null;
};

// Intentional selection: ONLY landscape videos (verified 1920x1080)
const nodesVideo = getLandscapeVideo('team-brainstorm');    // 1920x1080 - Collaboration/workflow
const aiVideo = getLandscapeVideo('spaceman-device');       // 1920x1080 - Technology/AI
const chainVideo = getLandscapeVideo('spaceman-approach');  // 1920x1080 - Process/iteration
const controlsVideo = getLandscapeVideo('racing-cockpit');  // 1920x1080 - Control/precision

const FEATURES: Feature[] = [
  {
    id: 'nodes',
    video: nodesVideo?.video || '',
    poster: nodesVideo?.poster || '',
    title: 'Node-Based Canvas',
    description: 'Connect elements visually. No timelines, no complexity.',
  },
  {
    id: 'ai',
    video: aiVideo?.video || '',
    poster: aiVideo?.poster || '',
    title: 'Smart AI Selection',
    description: 'Automatically picks the best model for your inputs.',
  },
  {
    id: 'chain',
    video: chainVideo?.video || '',
    poster: chainVideo?.poster || '',
    title: 'Output Chaining',
    description: 'Use results as new inputs. Iterate endlessly.',
  },
  {
    id: 'controls',
    video: controlsVideo?.video || '',
    poster: controlsVideo?.poster || '',
    title: 'Pro Controls',
    description: 'Camera, lighting, style. Cinema-grade presets.',
  },
];

export function VideoFeatureGrid() {
  return (
    <section id="features" className="bg-[#0a0a0a] py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header - Minimal */}
        <div className="mb-20">
          <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
            Everything you need
          </h2>
          <p className="mt-4 max-w-xl text-lg text-white/50">
            Powerful features, simple interface. Built for creators who want results.
          </p>
        </div>

        {/* Feature Grid - 2x2 */}
        <div className="grid gap-4 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    videoRef.current?.play().catch(() => {});
  };

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      className="group relative overflow-hidden rounded-2xl bg-neutral-900/50"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video */}
      <div className="aspect-video overflow-hidden">
        <video
          ref={videoRef}
          src={feature.video}
          poster={feature.poster}
          loop
          muted
          playsInline
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent" />

      {/* Content - Bottom aligned */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
        <h3 className="mb-2 text-xl font-medium text-white md:text-2xl">
          {feature.title}
        </h3>
        <p className="text-sm text-white/60 md:text-base">
          {feature.description}
        </p>
      </div>
    </div>
  );
}
