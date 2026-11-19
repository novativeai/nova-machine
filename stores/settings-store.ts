import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  // User's own fal.ai API key. Persisted only in this browser's localStorage and sent only to fal.ai.
  falApiKey: string;
  setFalApiKey: (key: string) => void;
  clearFalApiKey: () => void;
  hasFalApiKey: () => boolean;
}

const SETTINGS_STORAGE_KEY = 'nova-settings';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      falApiKey: '',

      setFalApiKey: (key) => {
        set({ falApiKey: key.trim() });
      },

      clearFalApiKey: () => {
        set({ falApiKey: '' });
      },

      hasFalApiKey: () => {
        return get().falApiKey.length > 0;
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      skipHydration: typeof window === 'undefined',
    }
  )
);
