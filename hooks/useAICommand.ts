'use client';

import { useCallback } from 'react';
import { useCanvasStore, useAIStore, useChainStore } from '@/stores';
import { toolRegistry, type ToolExecutionContext } from '@/lib/tools/registry';
import { allCanvasTools } from '@/lib/tools/canvas-tools';
import { serializeCanvasContext } from '@/lib/tools/system-prompt';
import { getNextPosition } from '@/lib/tools/layout';
import { useGeneration } from './useGeneration';
import type { AICommandResponse, ToolCallRequest, ToolCallResult } from '@/types';

// ============================================================================
// AI COMMAND HOOK
// ============================================================================

// Register tools once
let toolsRegistered = false;
function ensureToolsRegistered() {
  if (!toolsRegistered) {
    toolRegistry.registerAll(allCanvasTools);
    toolsRegistered = true;
  }
}

/**
 * Hook for executing AI commands on the canvas.
 *
 * Data flow:
 * 1. User types command in CommandBar
 * 2. executeCommand() builds canvas context from stores
 * 3. POSTs to /api/ai/execute with { command, canvasContext }
 * 4. Receives { plan, toolCalls, isChain } from Claude
 * 5. Displays plan to user via AI store
 * 6. Executes toolCalls sequentially via ToolRegistry
 * 7. Each tool call manipulates canvas store directly
 */
export function useAICommand() {
  const { startGeneration } = useGeneration();

  /**
   * Build the ToolExecutionContext that provides canvas store actions to tools.
   * This bridges the gap between server-side tool selection and client-side execution.
   */
  const buildExecutionContext = useCallback((): ToolExecutionContext => {
    const canvasState = useCanvasStore.getState();
    const chainState = useChainStore.getState();

    return {
      addNode: canvasState.addNode,
      updateNode: canvasState.updateNode,
      removeNode: canvasState.removeNode,
      addEdge: canvasState.addEdge,
      removeEdge: canvasState.removeEdge,
      getNodes: () => useCanvasStore.getState().nodes,
      getEdges: () => useCanvasStore.getState().edges,
      getConnectedInputs: canvasState.getConnectedInputs,
      addHashtagToNode: canvasState.addHashtagToNode,
      createChain: chainState.createChain,
      startChain: chainState.startChain,
      getNextPosition: (basePosition) => {
        const nodes = useCanvasStore.getState().nodes;
        const existingPositions = nodes.map((n) => n.position);
        return getNextPosition(existingPositions, basePosition);
      },
      startGeneration,
    };
  }, [startGeneration]);

  /**
   * Execute a sequence of tool calls using the registry.
   */
  const executeToolCalls = useCallback(
    async (toolCalls: ToolCallRequest[]): Promise<ToolCallResult[]> => {
      ensureToolsRegistered();
      const context = buildExecutionContext();
      const aiStore = useAIStore.getState();

      const results: ToolCallResult[] = [];
      for (let i = 0; i < toolCalls.length; i++) {
        const call = toolCalls[i];
        aiStore.setProgress(i, toolCalls.length, call.name);

        const result = await toolRegistry.execute(call, context);
        results.push(result);

        if (!result.success) {
          console.error(`Tool "${call.name}" failed:`, result.error);
        }
      }

      aiStore.setProgress(toolCalls.length, toolCalls.length, 'done');
      return results;
    },
    [buildExecutionContext]
  );

  /**
   * Execute a natural language command.
   * Full flow: command → API → plan + tool calls → execution.
   */
  const executeCommand = useCallback(
    async (command: string): Promise<void> => {
      const aiStore = useAIStore.getState();

      try {
        aiStore.setProcessing(true);
        aiStore.addToHistory(command);
        aiStore.setError(null);

        // Build canvas context from current state
        const { nodes, edges } = useCanvasStore.getState();
        const canvasContext = serializeCanvasContext(
          nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data as Record<string, unknown>,
          })),
          edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            data: e.data as Record<string, unknown> | undefined,
          }))
        );

        // Call AI API
        const response = await fetch('/api/ai/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command, canvasContext }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `API error: ${response.status}`);
        }

        const data: AICommandResponse = await response.json();

        // Show plan
        aiStore.setPlan(data.plan);
        aiStore.setPendingToolCalls(data.toolCalls);

        // Execute tool calls
        if (data.toolCalls.length > 0) {
          await executeToolCalls(data.toolCalls);
        }

        aiStore.setProcessing(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        aiStore.setError(message);
        aiStore.setProcessing(false);
      }
    },
    [executeToolCalls]
  );

  return {
    executeCommand,
    executeToolCalls,
    buildExecutionContext,
  };
}
