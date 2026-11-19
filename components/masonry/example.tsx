'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MasonryGrid } from './MasonryGrid';
import { MasonryCard, AspectRatio } from './MasonryCard';
import { shuffleWithSeed } from './utils';

// Example data structure
interface VideoItem {
  id: string;
  video: string;
  poster: string;
  aspect: AspectRatio;
  title: string;
  category: string;
  creator: string;
  tags: string[];
  featured?: boolean;
}

// Example usage
const EXAMPLE_ITEMS: VideoItem[] = [
  {
    id: '1',
    video: '/videos/example1.mp4',
    poster: '/videos/example1-poster.jpg',
    aspect: 'portrait',
    title: 'Portrait Video',
    category: 'Demo',
    creator: 'Artist 1',
    tags: ['portrait', 'demo'],
  },
  {
    id: '2',
    video: '/videos/example2.mp4',
    poster: '/videos/example2-poster.jpg',
    aspect: 'landscape',
    title: 'Landscape Video',
    category: 'Demo',
    creator: 'Artist 2',
    tags: ['landscape', 'demo'],
    featured: true,
  },
  {
    id: '3',
    video: '/videos/example3.mp4',
    poster: '/videos/example3-poster.jpg',
    aspect: 'square',
    title: 'Square Video',
    category: 'Demo',
    creator: 'Artist 3',
    tags: ['square', 'demo'],
  },
];

export function MasonryGalleryExample() {
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

  // Shuffle items with a fixed seed for consistent layout
  const shuffledItems = useMemo(() => {
    return shuffleWithSeed(EXAMPLE_ITEMS, 42);
  }, []);

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-16">
      <MasonryGrid>
        <AnimatePresence mode="popLayout">
          {shuffledItems.map((item, index) => (
            <MasonryCard
              key={item.id}
              id={item.id}
              video={item.video}
              poster={item.poster}
              aspect={item.aspect}
              title={item.title}
              category={item.category}
              creator={item.creator}
              tags={item.tags}
              featured={item.featured}
              index={index}
              onClick={() => setSelectedVideo(item)}
            />
          ))}
        </AnimatePresence>
      </MasonryGrid>

      {/* Lightbox example */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setSelectedVideo(null)}
        >
          <video
            src={selectedVideo.video}
            poster={selectedVideo.poster}
            autoPlay
            loop
            controls
            className="max-h-[90vh] max-w-[90vw]"
          />
        </div>
      )}
    </div>
  );
}
