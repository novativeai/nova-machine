'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { VIDEO_CATALOG } from '@/lib/video-catalog';

interface HeroVideo {
  id: string;
  video: string;
  poster: string;
}

interface HeroCategory {
  id: string;
  label: string;
  headline: string;
  subheadline: string;
  videos: HeroVideo[];
}

// Helper to get ONLY landscape videos (16:9) for hero
const getWideVideo = (videoId: string): HeroVideo | null => {
  const v = VIDEO_CATALOG.find((v) => v.id === videoId && v.aspect === 'landscape');
  return v ? { id: v.id, video: v.video, poster: v.poster } : null;
};

// Three categories, each with 4 LANDSCAPE videos ONLY (verified 1920x1080)
const HERO_CATEGORIES: HeroCategory[] = [
  {
    id: 'cinematic',
    label: 'Cinematic Worlds',
    headline: 'Create Cinematic Worlds',
    subheadline:
      'Build immersive universes with AI-powered video generation. From sci-fi epics to fantastical realms.',
    videos: [
      getWideVideo('spaceman-wide'),
      getWideVideo('spaceman-reveal'),
      getWideVideo('alien-jungle'),
      getWideVideo('spaceship-condor'),
    ].filter(Boolean) as HeroVideo[],
  },
  {
    id: 'impossible',
    label: 'Impossible Moments',
    headline: 'Capture the Impossible',
    subheadline:
      'Transform ideas into breathtaking visuals. Moments that could never exist, now brought to life.',
    videos: [
      getWideVideo('astronaut-flag'),
      getWideVideo('astronaut-desert'),
      getWideVideo('spaceman-approach'),
      getWideVideo('spaceman-descent'),
    ].filter(Boolean) as HeroVideo[],
  },
  {
    id: 'motion',
    label: 'Motion Without Limits',
    headline: 'Endless Motion',
    subheadline:
      "Speed, action, adrenaline. Create dynamic footage that pushes the boundaries of what's possible.",
    videos: [
      getWideVideo('speedboat-chase'),
      getWideVideo('racing-cockpit'),
      getWideVideo('drone-racing'),
      getWideVideo('rally-car'),
    ].filter(Boolean) as HeroVideo[],
  },
];

const VIDEO_DURATION = 5000; // 5 seconds per video

export function HeroCarousel() {
  const [activeCategory, setActiveCategory] = useState(0);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const isTransitioningRef = useRef(false);

  const currentCategory = HERO_CATEGORIES[activeCategory];
  const currentVideo = currentCategory.videos[activeVideoIndex];

  // Advance to the next video
  const advanceToNext = () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    const videosInCategory = HERO_CATEGORIES[activeCategory].videos.length;
    const nextVideoIndex = activeVideoIndex + 1;

    if (nextVideoIndex >= videosInCategory) {
      // Move to next category
      const nextCategoryIndex = (activeCategory + 1) % HERO_CATEGORIES.length;
      setActiveCategory(nextCategoryIndex);
      setActiveVideoIndex(0);
    } else {
      // Move to next video in same category
      setActiveVideoIndex(nextVideoIndex);
    }

    setProgress(0);

    // Reset transition lock after a short delay
    setTimeout(() => {
      isTransitioningRef.current = false;
    }, 100);
  };

  // Start the progress animation
  const startProgress = () => {
    // Clear any existing interval
    if (progressIntervalRef.current) {
      cancelAnimationFrame(progressIntervalRef.current);
    }

    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const newProgress = Math.min((elapsed / VIDEO_DURATION) * 100, 100);

      setProgress(newProgress);

      if (newProgress < 100) {
        progressIntervalRef.current = requestAnimationFrame(animate);
      } else {
        // Video duration complete, advance
        advanceToNext();
      }
    };

    progressIntervalRef.current = requestAnimationFrame(animate);
  };

  // Stop progress animation
  const stopProgress = () => {
    if (progressIntervalRef.current) {
      cancelAnimationFrame(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Handle video playback when active video changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset and play the video
    video.currentTime = 0;
    video.load();

    const playVideo = async () => {
      try {
        await video.play();
        startProgress();
      } catch (error) {
        // Autoplay failed, still start progress
        console.warn('Autoplay failed:', error);
        startProgress();
      }
    };

    playVideo();

    return () => {
      stopProgress();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activeVideoIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProgress();
    };
  }, []);

  const handleCategoryClick = (index: number) => {
    if (index === activeCategory) return;

    stopProgress();
    setActiveCategory(index);
    setActiveVideoIndex(0);
    setProgress(0);
  };

  // Calculate progress for each category's progress bar
  const getCategoryProgress = (categoryIndex: number): number => {
    if (categoryIndex < activeCategory) return 100;
    if (categoryIndex > activeCategory) return 0;

    const videosInCategory = HERO_CATEGORIES[categoryIndex].videos.length;
    const completedVideos = activeVideoIndex;
    const currentVideoProgress = progress / 100;

    return ((completedVideos + currentVideoProgress) / videosInCategory) * 100;
  };

  return (
    <section className="relative h-screen w-full overflow-hidden bg-black">
      {/* Single Active Video */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          key={currentVideo.id}
          src={currentVideo.video}
          poster={currentVideo.poster}
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-black/20" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Main Content - Centered */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 pt-16">
          <div className="max-w-4xl text-center">
            {/* Headline */}
            <h1
              key={`headline-${activeCategory}`}
              className="hero-fade-up mb-6 text-5xl font-semibold tracking-tight text-white md:text-7xl lg:text-8xl"
            >
              {currentCategory.headline}
            </h1>

            {/* Subheadline */}
            <p
              key={`sub-${activeCategory}`}
              className="hero-fade-up-delay mx-auto mb-10 max-w-2xl text-lg text-white/70 md:text-xl"
            >
              {currentCategory.subheadline}
            </p>

            {/* CTA Buttons */}
            <div className="hero-fade-up-delay-2 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/sign-up"
                className="rounded-full bg-white px-8 py-3.5 text-sm font-medium text-black transition-all hover:opacity-90"
              >
                Start Creating
              </Link>
              <Link
                href="/#features"
                className="rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/10"
              >
                See How It Works
              </Link>
            </div>
          </div>
        </div>

        {/* Category Navigation - Bottom */}
        <div className="relative z-20 border-t border-white/10 bg-black/50 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl px-6 py-4">
            <div className="flex gap-1">
              {HERO_CATEGORIES.map((category, index) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(index)}
                  className={`group relative flex-1 px-4 py-3 text-left transition-colors ${
                    index === activeCategory
                      ? 'text-white'
                      : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  {/* Category Label */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{category.label}</span>
                    {/* Video indicator dots */}
                    <div className="flex gap-1">
                      {category.videos.map((_, vidIdx) => (
                        <div
                          key={vidIdx}
                          className={`h-1 w-1 rounded-full transition-colors ${
                            index === activeCategory && vidIdx === activeVideoIndex
                              ? 'bg-white'
                              : index === activeCategory && vidIdx < activeVideoIndex
                                ? 'bg-white/60'
                                : 'bg-white/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2 h-px w-full overflow-hidden bg-white/20">
                    <div
                      className="h-full bg-white"
                      style={{
                        width: `${getCategoryProgress(index)}%`,
                        transition: 'width 50ms linear',
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hero-fade-up {
          animation: fadeUp 0.6s ease-out forwards;
        }

        .hero-fade-up-delay {
          animation: fadeUp 0.6s ease-out 0.1s backwards;
        }

        .hero-fade-up-delay-2 {
          animation: fadeUp 0.6s ease-out 0.2s backwards;
        }
      `}</style>
    </section>
  );
}
