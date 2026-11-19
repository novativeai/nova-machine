import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { Chain, ChainStep, ChainStepStatus, ChainStatus } from '@/types';

// ============================================================================
// CHAIN GENERATION STORE
// ============================================================================

interface ChainState {
  /** All chains (active, completed, cancelled) */
  chains: Chain[];

  // Chain lifecycle
  createChain: (
    steps: Array<{ promptNodeId: string; placeholderOutputId: string }>,
    name?: string
  ) => string;
  startChain: (chainId: string) => void;
  pauseChain: (chainId: string) => void;

  // Step operations
  setStepStatus: (chainId: string, stepIndex: number, status: ChainStepStatus) => void;
  incrementStepAttempts: (chainId: string, stepIndex: number) => void;
  advanceChain: (chainId: string) => void;
  approveStep: (chainId: string, stepIndex: number) => void;
  redoStep: (chainId: string, stepIndex: number) => void;
  cancelChain: (chainId: string) => void;
  completeChain: (chainId: string) => void;

  // Queries
  getChain: (chainId: string) => Chain | undefined;
  getActiveChain: () => Chain | undefined;
  getStepForOutput: (outputNodeId: string) => { chain: Chain; step: ChainStep; stepIndex: number } | null;
  getStepForPrompt: (promptNodeId: string) => { chain: Chain; step: ChainStep; stepIndex: number } | null;
  isOutputAwaitingValidation: (outputNodeId: string) => boolean;
  isNodeInActiveChain: (nodeId: string) => boolean;

  // Cleanup
  removeChain: (chainId: string) => void;
  removeCompletedChains: () => void;
}

const CHAIN_STORAGE_KEY = 'nova-chains';

export const useChainStore = create<ChainState>()(
  persist(
    (set, get) => ({
      chains: [],

      // ================================================================
      // Chain lifecycle
      // ================================================================

      createChain: (steps, name) => {
        const id = nanoid();
        const chainSteps: ChainStep[] = steps.map((s) => ({
          id: nanoid(),
          promptNodeId: s.promptNodeId,
          placeholderOutputId: s.placeholderOutputId,
          status: 'pending' as const,
          attempts: 0,
        }));

        const chain: Chain = {
          id,
          name,
          steps: chainSteps,
          currentStepIndex: 0,
          status: 'idle',
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          chains: [chain, ...state.chains],
        }));

        return id;
      },

      startChain: (chainId) => {
        set((state) => ({
          chains: state.chains.map((c) =>
            c.id === chainId
              ? {
                  ...c,
                  status: 'running' as ChainStatus,
                  steps: c.steps.map((s, i) =>
                    i === 0 ? { ...s, status: 'generating' as ChainStepStatus } : s
                  ),
                }
              : c
          ),
        }));
      },

      pauseChain: (chainId) => {
        set((state) => ({
          chains: state.chains.map((c) =>
            c.id === chainId ? { ...c, status: 'paused' as ChainStatus } : c
          ),
        }));
      },

      // ================================================================
      // Step operations
      // ================================================================

      setStepStatus: (chainId, stepIndex, status) => {
        set((state) => ({
          chains: state.chains.map((c) => {
            if (c.id !== chainId) return c;
            const newSteps = [...c.steps];
            if (newSteps[stepIndex]) {
              newSteps[stepIndex] = { ...newSteps[stepIndex], status };
            }
            // Update chain status based on step status
            let chainStatus: ChainStatus = c.status;
            if (status === 'awaiting_validation') {
              chainStatus = 'paused';
            } else if (status === 'generating') {
              chainStatus = 'running';
            }
            return { ...c, steps: newSteps, status: chainStatus };
          }),
        }));
      },

      incrementStepAttempts: (chainId, stepIndex) => {
        set((state) => ({
          chains: state.chains.map((c) => {
            if (c.id !== chainId) return c;
            const newSteps = [...c.steps];
            if (newSteps[stepIndex]) {
              newSteps[stepIndex] = {
                ...newSteps[stepIndex],
                attempts: newSteps[stepIndex].attempts + 1,
              };
            }
            return { ...c, steps: newSteps };
          }),
        }));
      },

      advanceChain: (chainId) => {
        set((state) => ({
          chains: state.chains.map((c) => {
            if (c.id !== chainId) return c;
            const nextIndex = c.currentStepIndex + 1;
            if (nextIndex >= c.steps.length) {
              // Chain completed
              return { ...c, status: 'completed' as ChainStatus };
            }
            return {
              ...c,
              currentStepIndex: nextIndex,
              status: 'running' as ChainStatus,
            };
          }),
        }));
      },

      approveStep: (chainId, stepIndex) => {
        const chain = get().getChain(chainId);
        if (!chain) return;

        // Mark step as approved
        get().setStepStatus(chainId, stepIndex, 'approved');

        // Check if this was the last step
        if (stepIndex >= chain.steps.length - 1) {
          get().completeChain(chainId);
        } else {
          // Advance to next step
          get().advanceChain(chainId);
        }
      },

      redoStep: (chainId, stepIndex) => {
        get().setStepStatus(chainId, stepIndex, 'redo');
        get().incrementStepAttempts(chainId, stepIndex);
        // The hook will detect 'redo' status and re-trigger generation
      },

      cancelChain: (chainId) => {
        set((state) => ({
          chains: state.chains.map((c) => {
            if (c.id !== chainId) return c;
            return {
              ...c,
              status: 'cancelled' as ChainStatus,
              steps: c.steps.map((s) =>
                s.status === 'pending' || s.status === 'generating' || s.status === 'awaiting_validation'
                  ? { ...s, status: 'cancelled' as ChainStepStatus }
                  : s
              ),
            };
          }),
        }));
      },

      completeChain: (chainId) => {
        set((state) => ({
          chains: state.chains.map((c) =>
            c.id === chainId ? { ...c, status: 'completed' as ChainStatus } : c
          ),
        }));
      },

      // ================================================================
      // Queries
      // ================================================================

      getChain: (chainId) => {
        return get().chains.find((c) => c.id === chainId);
      },

      getActiveChain: () => {
        return get().chains.find((c) => c.status === 'running' || c.status === 'paused');
      },

      getStepForOutput: (outputNodeId) => {
        for (const chain of get().chains) {
          for (let i = 0; i < chain.steps.length; i++) {
            if (chain.steps[i].placeholderOutputId === outputNodeId) {
              return { chain, step: chain.steps[i], stepIndex: i };
            }
          }
        }
        return null;
      },

      getStepForPrompt: (promptNodeId) => {
        for (const chain of get().chains) {
          for (let i = 0; i < chain.steps.length; i++) {
            if (chain.steps[i].promptNodeId === promptNodeId) {
              return { chain, step: chain.steps[i], stepIndex: i };
            }
          }
        }
        return null;
      },

      isOutputAwaitingValidation: (outputNodeId) => {
        const result = get().getStepForOutput(outputNodeId);
        if (!result) return false;
        return result.step.status === 'awaiting_validation';
      },

      isNodeInActiveChain: (nodeId) => {
        const activeChain = get().getActiveChain();
        if (!activeChain) return false;
        return activeChain.steps.some(
          (s) => s.promptNodeId === nodeId || s.placeholderOutputId === nodeId
        );
      },

      // ================================================================
      // Cleanup
      // ================================================================

      removeChain: (chainId) => {
        set((state) => ({
          chains: state.chains.filter((c) => c.id !== chainId),
        }));
      },

      removeCompletedChains: () => {
        set((state) => ({
          chains: state.chains.filter(
            (c) => c.status !== 'completed' && c.status !== 'cancelled'
          ),
        }));
      },
    }),
    {
      name: CHAIN_STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        return localStorage;
      }),
      partialize: (state) => ({
        chains: state.chains,
      }),
      // On rehydration, reset any 'generating' steps to 'pending'
      // (generation was interrupted by page refresh)
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.chains = state.chains.map((chain) => {
            const wasRunning = chain.status === 'running';
            return {
              ...chain,
              status: wasRunning ? ('paused' as ChainStatus) : chain.status,
              steps: chain.steps.map((step) =>
                step.status === 'generating'
                  ? { ...step, status: 'pending' as ChainStepStatus }
                  : step
              ),
            };
          });
        }
      },
      skipHydration: typeof window === 'undefined',
    }
  )
);
