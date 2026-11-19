import type { VideoAspectRatio, VideoDuration } from './nodes';

// ============================================================================
// CHAIN GENERATION TYPES
// ============================================================================

/**
 * Status of an individual step in a generation chain.
 *
 * Flow: pending → generating → awaiting_validation → approved → (next step)
 *                                                  → redo → generating (retry)
 *                                                  → cancelled (chain stops)
 */
export type ChainStepStatus =
  | 'pending'       // Not yet started, waiting for previous step
  | 'generating'    // Currently generating
  | 'awaiting_validation' // Generated, waiting for user approval
  | 'approved'      // User approved, ready to advance
  | 'redo'          // User requested redo, will re-generate
  | 'cancelled';    // User cancelled at this step

/**
 * A single step in a generation chain.
 * Each step maps to one prompt node + one placeholder output node.
 */
export interface ChainStep {
  id: string;
  /** The prompt node for this step */
  promptNodeId: string;
  /** The placeholder output node that will be filled after generation */
  placeholderOutputId: string;
  /** Current status of this step */
  status: ChainStepStatus;
  /** How many times generation has been attempted (increments on redo) */
  attempts: number;
}

/**
 * A generation chain: a linked sequence of prompt→output steps
 * where each output feeds into the next prompt.
 *
 * Visual representation on canvas:
 * [Prompt 1] → [Output 1 (placeholder)] → [Prompt 2] → [Output 2 (placeholder)] → ...
 *
 * Chain edges connect output → next prompt (dashed, gray).
 * Normal edges connect prompt → its own output.
 */
export interface Chain {
  id: string;
  name?: string;
  steps: ChainStep[];
  /** Index of the step currently being processed */
  currentStepIndex: number;
  /** Overall chain status */
  status: ChainStatus;
  createdAt: string; // ISO date string for persistence
}

export type ChainStatus =
  | 'idle'        // Created but not started
  | 'running'     // Currently generating a step
  | 'paused'      // Waiting for user validation
  | 'completed'   // All steps approved
  | 'cancelled';  // User cancelled

/**
 * Data needed to create a chain step (before IDs are assigned).
 */
export interface ChainStepInput {
  /** The prompt text for this step */
  prompt: string;
  /** Generation mode */
  mode: 'video' | 'image';
  /** Position on canvas for the prompt node */
  promptPosition: { x: number; y: number };
  /** Position on canvas for the placeholder output node */
  outputPosition: { x: number; y: number };
  /** IDs of nodes to connect as inputs to this prompt (e.g., element nodes) */
  inputNodeIds?: string[];
  /** Optional prompt settings overrides */
  settings?: {
    duration?: VideoDuration;
    aspectRatio?: VideoAspectRatio;
    imageAspectRatio?: string;
    imageResolution?: '1K' | '2K' | '4K';
  };
}
