'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { VIDEO_CATALOG } from '@/lib/video-catalog';

interface HeroTab {
  id: string;
  label: string;
  video: string;
  poster: string;
  headline: string;
  subheadline: string;
}

// Helper to get video from catalog
const getVideo = (id: string) => {
  const v = VIDEO_CATALOG.find(v => v.id === id);
  return v ? { video: v.video, poster: v.poster } : null;
};

// Intentional selection for hero tabs
const workflowVideo = getVideo('spaceman-wide');
const resultsVideo = getVideo('astronaut-flag');
const featuresVideo = getVideo('speedboat-chase');

const HERO_TABS: HeroTab[] = [
  {
    id: 'workflow',
    label: 'Visual Workflow',
    video: workflowVideo?.video || '',
    poster: workflowVideo?.poster || '',
    headline: 'Create with Nodes',
    subheadline: 'A visual canvas for AI video generation. Connect, configure, create.',
  },
  {
    id: 'generate',
    label: 'AI Generation',
    video: resultsVideo?.video || '',
    poster: resultsVideo?.poster || '',
    headline: 'From Text to Video',
    subheadline: 'Transform ideas into stunning visuals with state-of-the-art AI models.',
  },
  {
    id: 'control',
    label: 'Full Control',
    video: featuresVideo?.video || '',
    poster: featuresVideo?.poster || '',
    headline: 'Precise Control',
    subheadline: 'Camera angles, lighting, style. Every detail at your fingertips.',
  },
];

const TAB_DURATION = 15000; // 15 seconds per tab

export function HeroSection() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const startProgress = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveTab((current) => (current + 1) % HERO_TABS.length);
          return 0;
        }
        return prev + (100 / (TAB_DURATION / 50));
      });
    }, 50);
  }, []);

  useEffect(() => {
    if (!isPaused) {
      startProgress();
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPaused, startProgress]);

  // Handle tab change - play the new video
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (video) {
        if (index === activeTab) {
          video.currentTime = 0;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    });
  }, [activeTab]);

  const handleTabClick = (index: number) => {
    setActiveTab(index);
    setProgress(0);
  };

  const currentTab = HERO_TABS[activeTab];

  return (
    <section
      className="relative h-screen w-full overflow-hidden bg-black"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Video Backgrounds */}
      {HERO_TABS.map((tab, index) => (
        <div
          key={tab.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === activeTab ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <video
            ref={(el) => { videoRefs.current[index] = el; }}
            src={tab.video}
            poster={tab.poster}
            autoPlay={index === 0}
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-black/20" />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Main Content - Centered */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 pt-16">
          <div className="max-w-4xl text-center">
            {/* Headline */}
            <h1
              key={`headline-${activeTab}`}
              className="mb-6 text-5xl font-semibold tracking-tight text-white md:text-7xl lg:text-8xl"
              style={{ animation: 'fadeUp 0.6s ease-out' }}
            >
              {currentTab.headline}
            </h1>

            {/* Subheadline */}
            <p
              key={`sub-${activeTab}`}
              className="mx-auto mb-10 max-w-2xl text-lg text-white/70 md:text-xl"
              style={{ animation: 'fadeUp 0.6s ease-out 0.1s backwards' }}
            >
              {currentTab.subheadline}
            </p>

            {/* CTA Buttons - Minimal */}
            <div
              className="flex flex-col items-center justify-center gap-4 sm:flex-row"
              style={{ animation: 'fadeUp 0.6s ease-out 0.2s backwards' }}
            >
              <Link
                href={!loading && user ? '/canvas' : '/sign-up'}
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

        {/* Tab Navigation - Bottom */}
        <div className="relative z-20 border-t border-white/10 bg-black/50 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl px-6 py-4">
            <div className="flex gap-1">
              {HERO_TABS.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(index)}
                  className={`group relative flex-1 px-4 py-3 text-left transition-colors ${
                    index === activeTab ? 'text-white' : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  {/* Tab Label */}
                  <span className="text-sm font-medium">{tab.label}</span>

                  {/* Progress Bar */}
                  <div className="mt-2 h-px w-full overflow-hidden bg-white/20">
                    <div
                      className="h-full bg-white transition-all duration-100"
                      style={{
                        width: index === activeTab ? `${progress}%` : index < activeTab ? '100%' : '0%',
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe animation */}
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
      `}</style>
    </section>
  );
}
