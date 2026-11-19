'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

export type AspectRatio = 'portrait' | 'landscape' | 'square';

export interface MasonryCardProps {
  id: string;
  video: string;
  poster: string;
  aspect: AspectRatio;
  title: string;
  category?: string;
  creator?: string;
  tags?: string[];
  featured?: boolean;
  index: number;
  onClick?: () => void;
}

const ASPECT_RATIOS: Record<AspectRatio, string> = {
  portrait: '9 / 16',
  landscape: '16 / 9',
  square: '1 / 1',
};

export function MasonryCard({
  video,
  poster,
  aspect,
  title,
  category,
  creator,
  tags = [],
  featured,
  index,
  onClick,
}: MasonryCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(cardRef, { once: true, margin: '-50px' });

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
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.02, 0.3) }}
      className="group relative mb-3 cursor-pointer overflow-hidden rounded-xl bg-neutral-900"
      style={{
        aspectRatio: ASPECT_RATIOS[aspect],
        breakInside: 'avoid',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={video}
        poster={poster}
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Content - revealed on hover */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="translate-y-2 transform opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          {category && (
            <span className="text-[10px] uppercase tracking-wider text-white/50">
              {category}
            </span>
          )}
          <h3 className="mt-1 text-sm font-medium leading-tight text-white md:text-base">
            {title}
          </h3>
          {creator && (
            <p className="text-xs text-white/50">by {creator}</p>
          )}
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-white/40"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Border glow on hover */}
      <div className="absolute inset-0 rounded-xl border border-white/0 transition-colors duration-300 group-hover:border-white/20" />

      {/* Featured badge */}
      {featured && (
        <div className="absolute left-3 top-3 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          Featured
        </div>
      )}
    </motion.div>
  );
}
