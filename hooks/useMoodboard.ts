'use client';

import { useCallback, useState } from 'react';
import { useCanvasStore } from '@/stores';
import { useAICommand } from './useAICommand';
import { serializeCanvasContext } from '@/lib/tools/system-prompt';
import type { MoodboardResponse, ToolCallResult } from '@/types';

// ============================================================================
// MOODBOARD HOOK
// ============================================================================

/**
 * Hook for the Moodboard tool.
 *
 * Data Flow:
 * 1. User enters story text in MoodboardDialog
 * 2. generateMoodboard() POSTs to /api/ai/moodboard
 * 3. Claude decomposes story into characters + scenes + tool calls
 * 4. Response displayed as plan preview
 * 5. Tool calls executed via useAICommand.executeToolCalls()
 * 6. Nodes appear on canvas in moodboard layout
 * 7. Chains are ready for step-by-step generation
 */
export function useMoodboard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [storyPlan, setStoryPlan] = useState<MoodboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<ToolCallResult[]>([]);
  const { executeToolCalls } = useAICommand();

  /**
   * Generate a moodboard from a story.
   */
  const generateMoodboard = useCallback(
    async (story: string, style?: string): Promise<void> => {
      try {
        setIsGenerating(true);
        setError(null);
        setStoryPlan(null);
        setExecutionResults([]);

        // Call moodboard API
        const response = await fetch('/api/ai/moodboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ story, style }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `API error: ${response.status}`);
        }

        const data: MoodboardResponse = await response.json();
        setStoryPlan(data);

        // Execute tool calls to build the moodboard on canvas
        if (data.toolCalls.length > 0) {
          const results = await executeToolCalls(data.toolCalls);
          setExecutionResults(results);

          const failures = results.filter((r) => !r.success);
          if (failures.length > 0) {
            console.warn(`${failures.length} tool calls failed during moodboard generation`);
          }
        }

        setIsGenerating(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setIsGenerating(false);
      }
    },
    [executeToolCalls]
  );

  /**
   * Reset moodboard state (e.g., when closing the dialog).
   */
  const reset = useCallback(() => {
    setStoryPlan(null);
    setError(null);
    setExecutionResults([]);
  }, []);

  return {
    generateMoodboard,
    isGenerating,
    storyPlan,
    error,
    executionResults,
    reset,
  };
}
