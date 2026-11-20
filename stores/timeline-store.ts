import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const TIMELINE_MIN_ZOOM = 4; // px per second
export const TIMELINE_MAX_ZOOM = 400;
export const TIMELINE_MIN_HEIGHT = 180;
export const TIMELINE_MAX_HEIGHT = 640;

export type MainView = 'canvas' | 'preview';
export type PreviewAspect = '16:9' | '9:16' | '1:1' | '4:5' | '21:9';

interface TimelineState {
  /** What the main window shows: the node canvas or the programme viewer. */
  mainView: MainView;
  previewAspect: PreviewAspect;
  safeGuides: boolean;
  /** Panel expanded (collapsed shows only the header bar). */
  isOpen: boolean;
  height: number;
  /** Horizontal zoom, pixels per second. */
  zoom: number;
  snapping: boolean;
  /** Playhead, seconds. */
  currentTime: number;
  isPlaying: boolean;

  setMainView: (view: MainView) => void;
  toggleMainView: () => void;
  setPreviewAspect: (aspect: PreviewAspect) => void;
  toggleSafeGuides: () => void;
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
      mainView: 'canvas',
      previewAspect: '16:9',
      safeGuides: false,
      isOpen: false,
      height: 300,
      zoom: 40,
      snapping: true,
      currentTime: 0,
      isPlaying: false,

      setMainView: (mainView) => set({ mainView }),
      toggleMainView: () => set((s) => ({ mainView: s.mainView === 'canvas' ? 'preview' : 'canvas' })),
      setPreviewAspect: (previewAspect) => set({ previewAspect }),
      toggleSafeGuides: () => set((s) => ({ safeGuides: !s.safeGuides })),
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
      partialize: (s) => ({
        isOpen: s.isOpen,
        height: s.height,
        zoom: s.zoom,
        snapping: s.snapping,
        mainView: s.mainView,
        previewAspect: s.previewAspect,
        safeGuides: s.safeGuides,
      }),
      skipHydration: typeof window === 'undefined',
    }
  )
);
