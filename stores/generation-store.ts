import { create } from 'zustand';
import type {
  KlingModel,
  NanoBananaModel,
  KlingInput,
  NanoBananaInput,
  GenerationProgress,
  GenerationResult,
  GenerationMetadata,
} from '@/types';

export interface GenerationRequest {
  id: string;
  promptNodeId: string;
  model: KlingModel | NanoBananaModel;
  input: KlingInput | NanoBananaInput;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: GenerationProgress;
  result?: GenerationResult;
  createdAt: Date;
}

interface GenerationState {
  // Queue
  queue: GenerationRequest[];
  activeGeneration: GenerationRequest | null;
  history: GenerationRequest[];

  // Status
  isGenerating: boolean;

  // Operations
  addToQueue: (request: Omit<GenerationRequest, 'status' | 'createdAt'>) => void;
  updateRequest: (id: string, updates: Partial<GenerationRequest>) => void;
  removeFromQueue: (id: string) => void;
  setActiveGeneration: (request: GenerationRequest | null) => void;
  completeGeneration: (id: string, result: GenerationResult) => void;
  failGeneration: (id: string, error: string) => void;
  clearHistory: () => void;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  queue: [],
  activeGeneration: null,
  history: [],
  isGenerating: false,

  addToQueue: (request) => {
    const newRequest: GenerationRequest = {
      ...request,
      status: 'queued',
      createdAt: new Date(),
    };

    set((state) => ({
      queue: [...state.queue, newRequest],
    }));
  },

  updateRequest: (id, updates) => {
    set((state) => ({
      queue: state.queue.map((req) =>
        req.id === id ? { ...req, ...updates } : req
      ),
      activeGeneration:
        state.activeGeneration?.id === id
          ? { ...state.activeGeneration, ...updates }
          : state.activeGeneration,
    }));
  },

  removeFromQueue: (id) => {
    set((state) => ({
      queue: state.queue.filter((req) => req.id !== id),
    }));
  },

  setActiveGeneration: (request) => {
    set({
      activeGeneration: request,
      isGenerating: request !== null,
    });
  },

  completeGeneration: (id, result) => {
    const { activeGeneration, queue } = get();

    if (activeGeneration?.id === id) {
      const completedRequest: GenerationRequest = {
        ...activeGeneration,
        status: 'completed',
        result,
      };

      set((state) => ({
        activeGeneration: null,
        isGenerating: false,
        history: [...state.history, completedRequest],
        queue: state.queue.filter((req) => req.id !== id),
      }));
    }
  },

  failGeneration: (id, error) => {
    const { activeGeneration } = get();

    if (activeGeneration?.id === id) {
      const failedRequest: GenerationRequest = {
        ...activeGeneration,
        status: 'failed',
        result: {
          success: false,
          error,
          requestId: id,
        },
      };

      set((state) => ({
        activeGeneration: null,
        isGenerating: false,
        history: [...state.history, failedRequest],
        queue: state.queue.filter((req) => req.id !== id),
      }));
    }
  },

  clearHistory: () => {
    set({ history: [] });
  },
}));
