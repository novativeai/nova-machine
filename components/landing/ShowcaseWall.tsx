'use client';

import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { VIDEO_CATALOG } from '@/lib/video-catalog';

interface ShowcaseVideo {
  id: string;
  video: string;
  poster: string;
}

// Helper to get ONLY portrait videos for vertical cards
const getPortraitVideo = (id: string): ShowcaseVideo | null => {
  const v = VIDEO_CATALOG.find((v) => v.id === id && v.aspect === 'portrait');
  return v ? { id: v.id, video: v.video, poster: v.poster } : null;
};

// 3 columns with portrait videos - 5 videos each for good variety
const COLUMN_1: ShowcaseVideo[] = [
  getPortraitVideo('spaceman-hero'),
  getPortraitVideo('rock-climbing'),
  getPortraitVideo('skateboard-downhill'),
  getPortraitVideo('motocross-whip'),
  getPortraitVideo('tactical-stairs'),
].filter(Boolean) as ShowcaseVideo[];

const COLUMN_2: ShowcaseVideo[] = [
  getPortraitVideo('yoga-sunrise'),
  getPortraitVideo('astronaut-ladder'),
  getPortraitVideo('skincare-routine'),
  getPortraitVideo('smartphone-demo'),
  getPortraitVideo('window-contemplation'),
].filter(Boolean) as ShowcaseVideo[];

const COLUMN_3: ShowcaseVideo[] = [
  getPortraitVideo('detective-thinking'),
  getPortraitVideo('kayak-rapids'),
  getPortraitVideo('spaceman-hero'),
  getPortraitVideo('rock-climbing'),
  getPortraitVideo('yoga-sunrise'),
].filter(Boolean) as ShowcaseVideo[];

export function ShowcaseWall() {
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
          className="mb-16 text-center"
        >
          <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
            The showcase
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/50">
            Created with Nova Machine
          </p>
        </motion.div>

        {/* Marquee Grid - 3 columns like gallery */}
        <div className="relative h-[700px] overflow-hidden rounded-2xl">
          {/* Gradient overlays for fade effect */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-[#0a0a0a] to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-[#0a0a0a] to-transparent" />

          {/* 3 Column Grid */}
          <div className="grid h-full grid-cols-3 gap-4">
            <MarqueeColumn videos={COLUMN_1} duration={45} direction="up" />
            <MarqueeColumn videos={COLUMN_2} duration={40} direction="down" />
            <MarqueeColumn videos={COLUMN_3} duration={50} direction="up" />
          </div>
        </div>
      </div>
    </section>
  );
}

function MarqueeColumn({
  videos,
  duration,
  direction,
}: {
  videos: ShowcaseVideo[];
  duration: number;
  direction: 'up' | 'down';
}) {
  // Duplicate videos for seamless loop (2x is enough)
  const allVideos = [...videos, ...videos];

  return (
    <div className="relative h-full overflow-hidden">
      <div
        className={`flex flex-col gap-4 ${direction === 'up' ? 'animate-marquee-up' : 'animate-marquee-down'}`}
        style={{
          animationDuration: `${duration}s`,
        }}
      >
        {allVideos.map((video, index) => (
          <VideoCard key={`${video.id}-${index}`} video={video} />
        ))}
      </div>
    </div>
  );
}

function VideoCard({ video }: { video: ShowcaseVideo }) {
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

  return (
    <div
      className="group relative shrink-0 overflow-hidden rounded-xl transition-transform duration-300 hover:scale-[1.02]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="aspect-[9/16] overflow-hidden rounded-xl bg-neutral-900">
        <video
          ref={videoRef}
          src={video.video}
          poster={video.poster}
          loop
          muted
          playsInline
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Hover overlay */}
      <div
        className={`pointer-events-none absolute inset-0 rounded-xl border-2 transition-all duration-300 ${
          isHovered ? 'border-white/20' : 'border-transparent'
        }`}
      />
    </div>
  );
}
