import { create } from 'zustand';
import type {
  GenerationModel,
  GenerationProgress,
  GenerationResult,
  ImageGenerationInput,
  LtxAudioToVideoInput,
  VideoGenerationInput,
} from '@/types';

export interface GenerationRequest {
  id: string;
  promptNodeId: string;
  model: GenerationModel;
  input: VideoGenerationInput | ImageGenerationInput | LtxAudioToVideoInput;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: GenerationProgress;
  result?: GenerationResult;
  createdAt: Date;
}

interface GenerationState {
  // Queue
  queue: GenerationRequest[];
  activeGenerations: Record<string, GenerationRequest>; // keyed by request ID
  history: GenerationRequest[];

  // Operations
  addToQueue: (request: Omit<GenerationRequest, 'status' | 'createdAt'>) => void;
  updateRequest: (id: string, updates: Partial<GenerationRequest>) => void;
  removeFromQueue: (id: string) => void;
  setActiveGeneration: (request: GenerationRequest | null) => void;
  completeGeneration: (id: string, result: GenerationResult) => void;
  failGeneration: (id: string, error: string) => void;
  isNodeGenerating: (promptNodeId: string) => boolean;
  clearHistory: () => void;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  queue: [],
  activeGenerations: {},
  history: [],

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
      activeGenerations: state.activeGenerations[id]
        ? { ...state.activeGenerations, [id]: { ...state.activeGenerations[id], ...updates } }
        : state.activeGenerations,
    }));
  },

  removeFromQueue: (id) => {
    set((state) => ({
      queue: state.queue.filter((req) => req.id !== id),
    }));
  },

  setActiveGeneration: (request) => {
    if (request === null) return;
    set((state) => ({
      activeGenerations: { ...state.activeGenerations, [request.id]: request },
    }));
  },

  completeGeneration: (id, result) => {
    const { activeGenerations } = get();
    const activeGeneration = activeGenerations[id];

    if (activeGeneration) {
      const completedRequest: GenerationRequest = {
        ...activeGeneration,
        status: 'completed',
        result,
      };

      set((state) => {
        const { [id]: _, ...remaining } = state.activeGenerations;
        // Cap history at 50 entries to prevent memory leaks
        const newHistory = [...state.history, completedRequest].slice(-50);
        return {
          activeGenerations: remaining,
          history: newHistory,
          queue: state.queue.filter((req) => req.id !== id),
        };
      });
    }
  },

  failGeneration: (id, error) => {
    const { activeGenerations } = get();
    const activeGeneration = activeGenerations[id];

    if (activeGeneration) {
      const failedRequest: GenerationRequest = {
        ...activeGeneration,
        status: 'failed',
        result: {
          success: false,
          error,
          requestId: id,
        },
      };

      set((state) => {
        const { [id]: _, ...remaining } = state.activeGenerations;
        // Cap history at 50 entries to prevent memory leaks
        const newHistory = [...state.history, failedRequest].slice(-50);
        return {
          activeGenerations: remaining,
          history: newHistory,
          queue: state.queue.filter((req) => req.id !== id),
        };
      });
    }
  },

  isNodeGenerating: (promptNodeId) => {
    const { activeGenerations } = get();
    return Object.values(activeGenerations).some(
      (g) => g.promptNodeId === promptNodeId
    );
  },

  clearHistory: () => {
    set({ history: [] });
  },
}));
