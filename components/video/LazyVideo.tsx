'use client';

import { useState, useEffect, useRef } from 'react';

interface LazyVideoProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  className?: string;
  aspectRatio?: string;
  playOnScroll?: boolean;
  playOnHover?: boolean;
  threshold?: number;
}

export function LazyVideo({
  src,
  poster,
  autoPlay = true,
  loop = true,
  muted = true,
  controls = false,
  className = '',
  aspectRatio = '16/9',
  playOnScroll = true,
  playOnHover = false,
  threshold = 0.5,
}: LazyVideoProps) {
  const [isInView, setIsInView] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playOnScroll || !containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);

        if (entry.isIntersecting && autoPlay && !playOnHover && videoRef.current) {
          videoRef.current.play().catch(() => {});
        } else if (!entry.isIntersecting && videoRef.current) {
          videoRef.current.pause();
        }
      },
      { threshold }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [playOnScroll, autoPlay, playOnHover, threshold]);

  // Handle hover play
  useEffect(() => {
    if (!playOnHover || !videoRef.current) return;

    if (isHovered && isInView) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovered, isInView, playOnHover]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={isInView || !playOnScroll ? src : undefined}
        poster={poster}
        autoPlay={autoPlay && !playOnHover}
        loop={loop}
        muted={muted}
        controls={controls}
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Subtle loading state - no spinner, just dark overlay */}
      {!isPlaying && !poster && (
        <div className="absolute inset-0 bg-neutral-950" />
      )}
    </div>
  );
}
