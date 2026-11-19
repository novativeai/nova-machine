'use client';

import { useState, useRef } from 'react';
import { VIDEO_CATALOG } from '@/lib/video-catalog';

interface GalleryVideo {
  id: string;
  video: string;
  poster: string;
  title: string;
  category: string;
}

// Helper to get ONLY portrait videos for 9:16 gallery grid
const getPortraitVideo = (id: string): GalleryVideo | null => {
  const v = VIDEO_CATALOG.find(v => v.id === id && v.aspect === 'portrait');
  return v ? { id: v.id, video: v.video, poster: v.poster, title: v.title, category: v.category } : null;
};

// Intentional selection: ONLY portrait videos (verified 1080x1920)
const GALLERY_VIDEOS: GalleryVideo[] = [
  getPortraitVideo('spaceman-hero'),       // 1080x1920 Sci-fi portrait
  getPortraitVideo('rock-climbing'),       // 1080x1920 Sports portrait
  getPortraitVideo('astronaut-ladder'),    // 1080x1920 Space portrait
  getPortraitVideo('skateboard-downhill'), // 1080x1920 Action portrait
  getPortraitVideo('skincare-routine'),    // 1080x1920 Lifestyle portrait
  getPortraitVideo('yoga-sunrise'),        // 1080x1920 Wellness portrait
].filter(Boolean) as GalleryVideo[];

export function VideoGallery() {
  const [selectedVideo, setSelectedVideo] = useState<GalleryVideo | null>(null);

  return (
    <section id="gallery" className="bg-[#0a0a0a] py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header - Minimal */}
        <div className="mb-16">
          <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
            See what&apos;s possible
          </h2>
          <p className="mt-4 max-w-xl text-lg text-white/50">
            Real videos created by real users. Your ideas, brought to life.
          </p>
        </div>

        {/* Video Grid - 3 columns, vertical videos */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY_VIDEOS.map((item) => (
            <GalleryCard
              key={item.id}
              video={item}
              onClick={() => setSelectedVideo(item)}
            />
          ))}
        </div>

        {/* View All Link - minimal */}
        <div className="mt-12 text-center">
          <a
            href="/gallery"
            className="inline-block rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-white/10"
          >
            View Full Gallery
          </a>
        </div>
      </div>

      {/* Lightbox Modal - no icons */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
          onClick={() => setSelectedVideo(null)}
        >
          {/* Close button - text only, no X icon */}
          <button
            onClick={() => setSelectedVideo(null)}
            className="absolute right-6 top-6 text-sm text-white/60 transition-colors hover:text-white"
            aria-label="Close"
          >
            Close
          </button>

          <div
            className="relative max-h-[90vh] w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={selectedVideo.video}
              poster={selectedVideo.poster}
              autoPlay
              loop
              controls
              playsInline
              className="h-full w-full rounded-xl"
            />

            <div className="mt-4 text-center">
              <span className="text-xs uppercase tracking-wider text-white/40">
                {selectedVideo.category}
              </span>
              <h3 className="mt-1 text-xl font-medium text-white">
                {selectedVideo.title}
              </h3>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function GalleryCard({
  video,
  onClick,
}: {
  video: GalleryVideo;
  onClick: () => void;
}) {
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
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative aspect-9/16 overflow-hidden rounded-xl bg-neutral-900 transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-white/20"
    >
      <video
        ref={videoRef}
        src={video.video}
        poster={video.poster}
        loop
        muted
        playsInline
        className="h-full w-full object-cover"
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      {/* Info on hover */}
      <div className="absolute bottom-0 left-0 right-0 translate-y-full p-6 transition-transform group-hover:translate-y-0">
        <span className="text-xs uppercase tracking-wider text-white/50">
          {video.category}
        </span>
        <h3 className="mt-1 text-lg font-medium text-white">
          {video.title}
        </h3>
      </div>
    </button>
  );
}
