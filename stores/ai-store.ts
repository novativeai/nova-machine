import { create } from 'zustand';
import type { ToolCallRequest } from '@/types';

// ============================================================================
// AI COMMAND BAR STORE
// ============================================================================

interface AIState {
  /** Whether the command bar is open */
  isCommandBarOpen: boolean;
  /** Whether the AI is currently processing a command */
  isProcessing: boolean;
  /** The current plan from the AI (displayed to user before execution) */
  currentPlan: string | null;
  /** Execution progress tracking */
  executionProgress: {
    completed: number;
    total: number;
    currentTool: string | null;
  };
  /** Pending tool calls to execute */
  pendingToolCalls: ToolCallRequest[];
  /** Recent command history (max 20) */
  commandHistory: string[];
  /** Last error if any */
  lastError: string | null;

  // Command bar
  openCommandBar: () => void;
  closeCommandBar: () => void;
  toggleCommandBar: () => void;

  // Processing state
  setProcessing: (val: boolean) => void;
  setPlan: (plan: string | null) => void;
  setPendingToolCalls: (calls: ToolCallRequest[]) => void;
  setProgress: (completed: number, total: number, currentTool?: string) => void;
  setError: (error: string | null) => void;

  // History
  addToHistory: (command: string) => void;
  clearHistory: () => void;

  // Reset
  resetExecution: () => void;
}

const MAX_HISTORY = 20;

export const useAIStore = create<AIState>()((set, get) => ({
  isCommandBarOpen: false,
  isProcessing: false,
  currentPlan: null,
  executionProgress: { completed: 0, total: 0, currentTool: null },
  pendingToolCalls: [],
  commandHistory: [],
  lastError: null,

  // ================================================================
  // Command bar
  // ================================================================

  openCommandBar: () => {
    set({
      isCommandBarOpen: true,
      lastError: null,
      currentPlan: null,
      pendingToolCalls: [],
      executionProgress: { completed: 0, total: 0, currentTool: null },
    });
  },

  closeCommandBar: () => {
    // Only close if not processing
    const { isProcessing } = get();
    if (!isProcessing) {
      set({
        isCommandBarOpen: false,
        currentPlan: null,
        lastError: null,
        pendingToolCalls: [],
      });
    }
  },

  toggleCommandBar: () => {
    const { isCommandBarOpen, openCommandBar, closeCommandBar } = get();
    if (isCommandBarOpen) {
      closeCommandBar();
    } else {
      openCommandBar();
    }
  },

  // ================================================================
  // Processing state
  // ================================================================

  setProcessing: (val) => {
    set({ isProcessing: val });
  },

  setPlan: (plan) => {
    set({ currentPlan: plan });
  },

  setPendingToolCalls: (calls) => {
    set({ pendingToolCalls: calls });
  },

  setProgress: (completed, total, currentTool) => {
    set({
      executionProgress: {
        completed,
        total,
        currentTool: currentTool ?? null,
      },
    });
  },

  setError: (error) => {
    set({ lastError: error, isProcessing: false });
  },

  // ================================================================
  // History
  // ================================================================

  addToHistory: (command) => {
    set((state) => {
      const trimmed = command.trim();
      if (!trimmed) return state;
      // Deduplicate: remove if already exists, then prepend
      const filtered = state.commandHistory.filter((c) => c !== trimmed);
      return {
        commandHistory: [trimmed, ...filtered].slice(0, MAX_HISTORY),
      };
    });
  },

  clearHistory: () => {
    set({ commandHistory: [] });
  },

  // ================================================================
  // Reset
  // ================================================================

  resetExecution: () => {
    set({
      isProcessing: false,
      currentPlan: null,
      pendingToolCalls: [],
      executionProgress: { completed: 0, total: 0, currentTool: null },
      lastError: null,
    });
  },
}));
