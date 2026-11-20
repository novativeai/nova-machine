import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const TIMELINE_MIN_ZOOM = 4; // px per second
export const TIMELINE_MAX_ZOOM = 400;
export const TIMELINE_MIN_HEIGHT = 180;
export const TIMELINE_MAX_HEIGHT = 640;

interface TimelineState {
  /** Panel expanded (collapsed shows only the header bar). */
  isOpen: boolean;
  height: number;
  /** Horizontal zoom, pixels per second. */
  zoom: number;
  snapping: boolean;
  /** Playhead, seconds. */
  currentTime: number;
  isPlaying: boolean;

  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setHeight: (height: number) => void;
  setZoom: (zoom: number) => void;
  toggleSnapping: () => void;
  seek: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
}

export const useTimelineStore = create<TimelineState>()(
  persist(
    (set) => ({
      isOpen: false,
      height: 300,
      zoom: 40,
      snapping: true,
      currentTime: 0,
      isPlaying: false,

      setOpen: (isOpen) => set({ isOpen }),
      toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
      setHeight: (height) => set({ height: Math.min(TIMELINE_MAX_HEIGHT, Math.max(TIMELINE_MIN_HEIGHT, height)) }),
      setZoom: (zoom) => set({ zoom: Math.min(TIMELINE_MAX_ZOOM, Math.max(TIMELINE_MIN_ZOOM, zoom)) }),
      toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
      seek: (seconds) => set({ currentTime: Math.max(0, seconds) }),
      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
    }),
    {
      name: 'nova-timeline-ui',
      storage: createJSONStorage(() => (typeof window === 'undefined'
        ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
        : localStorage)),
      // Layout preferences only; transport state starts fresh
      partialize: (s) => ({ isOpen: s.isOpen, height: s.height, zoom: s.zoom, snapping: s.snapping }),
      skipHydration: typeof window === 'undefined',
    }
  )
);
