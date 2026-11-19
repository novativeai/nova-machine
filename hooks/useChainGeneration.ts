'use client';

import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useCanvasStore, createNode, useChainStore } from '@/stores';
import { useGeneration } from './useGeneration';
import type { ChainStepInput } from '@/types';

// ============================================================================
// CHAIN GENERATION HOOK
// ============================================================================

/**
 * Hook for managing chain generation: creating linked prompt→output sequences
 * with user validation between each step.
 *
 * Chain Data Flow:
 *
 * 1. createAndStartChain(steps[])
 *    → Creates prompt nodes + placeholder output nodes
 *    → Connects them: Prompt1 → Output1 → Prompt2 → Output2 → ...
 *    → Creates chain in chain-store
 *    → Starts generation on first prompt
 *
 * 2. After generation completes (modified useGeneration.ts):
 *    → Updates placeholder output with real data
 *    → Sets chain step to 'awaiting_validation'
 *    → ChainValidationCard appears below output
 *
 * 3. User approves → approveAndContinue()
 *    → Marks step as approved
 *    → Starts generation on next prompt
 *    → Cycle repeats from step 2
 *
 * 4. User redoes → redoStep()
 *    → Resets placeholder output back to ghost state
 *    → Re-triggers generation on same prompt
 *
 * 5. User cancels → cancelChain()
 *    → Stops chain processing
 *    → Removes remaining placeholder outputs
 *    → Keeps already-generated outputs
 */
export function useChainGeneration() {
  const { startGeneration } = useGeneration();

  /**
   * Create a complete chain and start generation on the first step.
   *
   * @param steps - Array of step definitions (prompt, mode, positions, inputs)
   * @returns chainId
   */
  const createAndStartChain = useCallback(
    async (steps: ChainStepInput[]): Promise<string> => {
      const { addNode, addEdge, updateNode } = useCanvasStore.getState();
      const { createChain, startChain, setStepStatus } = useChainStore.getState();

      if (steps.length === 0) {
        throw new Error('Chain must have at least one step');
      }

      const chainSteps: Array<{ promptNodeId: string; placeholderOutputId: string }> = [];

      // Create all nodes first
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // Create prompt node with chain metadata
        const promptNode = createNode('prompt', step.promptPosition, {
          prompt: step.prompt,
          mode: step.mode,
          chainId: 'pending', // Will be set after chain creation
          chainStepIndex: i,
          ...(step.settings || {}),
        });

        // Create placeholder output node
        const outputNode = createNode('output', step.outputPosition, {
          isPlaceholder: true,
          chainId: 'pending',
          chainStepIndex: i,
          outputType: step.mode === 'video' ? 'video' : 'image',
        });

        addNode(promptNode);
        addNode(outputNode);

        // Connect prompt → placeholder output
        addEdge({
          id: `edge-${nanoid()}`,
          source: promptNode.id,
          target: outputNode.id,
          sourceHandle: 'output',
          targetHandle: 'input',
        });

        // Connect previous output → this prompt (chain link)
        if (i > 0) {
          const prevOutput = chainSteps[i - 1].placeholderOutputId;
          addEdge({
            id: `edge-chain-${nanoid()}`,
            source: prevOutput,
            target: promptNode.id,
            sourceHandle: 'output',
            targetHandle: 'input',
            data: { isChainEdge: true, color: '#6B7280' },
          });
        }

        // Connect external input nodes to this prompt
        if (step.inputNodeIds?.length) {
          for (const inputId of step.inputNodeIds) {
            addEdge({
              id: `edge-${nanoid()}`,
              source: inputId,
              target: promptNode.id,
              sourceHandle: 'output',
              targetHandle: 'input',
            });
          }
        }

        chainSteps.push({
          promptNodeId: promptNode.id,
          placeholderOutputId: outputNode.id,
        });
      }

      // Create chain in store
      const chainId = createChain(chainSteps);

      // Update all nodes with real chain ID
      for (const step of chainSteps) {
        updateNode(step.promptNodeId, { chainId });
        updateNode(step.placeholderOutputId, { chainId });
      }

      // Start chain and trigger first generation
      startChain(chainId);
      setStepStatus(chainId, 0, 'generating');

      try {
        await startGeneration(chainSteps[0].promptNodeId);
      } catch (error) {
        console.error('Chain first step generation failed:', error);
        setStepStatus(chainId, 0, 'pending');
      }

      return chainId;
    },
    [startGeneration]
  );

  /**
   * User approved the current step's output. Continue to next step.
   */
  const approveAndContinue = useCallback(
    async (chainId: string, stepIndex: number): Promise<void> => {
      const chainStore = useChainStore.getState();
      const chain = chainStore.getChain(chainId);
      if (!chain) return;

      // Mark step as approved
      chainStore.approveStep(chainId, stepIndex);

      // If there's a next step, start its generation
      const nextIndex = stepIndex + 1;
      if (nextIndex < chain.steps.length) {
        chainStore.setStepStatus(chainId, nextIndex, 'generating');
        try {
          await startGeneration(chain.steps[nextIndex].promptNodeId);
        } catch (error) {
          console.error('Chain next step generation failed:', error);
          chainStore.setStepStatus(chainId, nextIndex, 'pending');
        }
      }
    },
    [startGeneration]
  );

  /**
   * User wants to redo the current step. Reset output and re-generate.
   */
  const redoStep = useCallback(
    async (chainId: string, stepIndex: number): Promise<void> => {
      const chainStore = useChainStore.getState();
      const chain = chainStore.getChain(chainId);
      if (!chain) return;

      const step = chain.steps[stepIndex];
      if (!step) return;

      // Reset the placeholder output back to ghost state
      const { updateNode } = useCanvasStore.getState();
      updateNode(step.placeholderOutputId, {
        isPlaceholder: true,
        videoUrl: undefined,
        imageUrl: undefined,
        thumbnailUrl: '',
      });

      // Mark step for redo and re-trigger generation
      chainStore.redoStep(chainId, stepIndex);
      chainStore.setStepStatus(chainId, stepIndex, 'generating');

      // Reset prompt node status
      updateNode(step.promptNodeId, {
        status: 'idle',
        progress: 0,
        error: undefined,
      });

      try {
        await startGeneration(step.promptNodeId);
      } catch (error) {
        console.error('Chain redo generation failed:', error);
        chainStore.setStepStatus(chainId, stepIndex, 'pending');
      }
    },
    [startGeneration]
  );

  /**
   * User cancels the chain. Stop processing and clean up.
   * Keeps already-generated outputs, removes remaining placeholders.
   */
  const cancelChain = useCallback(
    (chainId: string): void => {
      const chainStore = useChainStore.getState();
      const chain = chainStore.getChain(chainId);
      if (!chain) return;

      // Cancel the chain
      chainStore.cancelChain(chainId);

      // Clean up nodes for steps that never completed generation
      const { removeNode } = useCanvasStore.getState();
      for (const step of chain.steps) {
        if (step.status === 'pending' || step.status === 'cancelled') {
          const nodes = useCanvasStore.getState().nodes;

          // Remove placeholder outputs that weren't generated yet
          const outputNode = nodes.find((n) => n.id === step.placeholderOutputId);
          if (outputNode && outputNode.data && (outputNode.data as Record<string, unknown>).isPlaceholder) {
            removeNode(step.placeholderOutputId);
          }

          // Remove orphaned prompt nodes for unstarted steps
          // (keep prompt nodes for steps that were at least attempted)
          if (step.attempts === 0) {
            removeNode(step.promptNodeId);
          }
        }
      }
    },
    []
  );

  return {
    createAndStartChain,
    approveAndContinue,
    redoStep,
    cancelChain,
  };
}
