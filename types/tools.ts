// ============================================================================
// AI TOOL CALLING TYPES
// ============================================================================

import type { NodeType, PromptMode, MediaRole, ElementType } from './nodes';

/**
 * JSON Schema-like parameter definition for a canvas tool.
 * Used to generate the tool definitions sent to the LLM.
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  enum?: string[];
  items?: { type: string }; // For array types
}

/**
 * Definition of a canvas tool (sent to LLM for tool use).
 */
export interface CanvasToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

/**
 * A single tool call request returned by the LLM.
 */
export interface ToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Result of executing a single tool call.
 */
export interface ToolCallResult {
  success: boolean;
  /** ID of created or modified node */
  nodeId?: string;
  /** IDs of all created nodes (for multi-node tools like create_chain) */
  nodeIds?: string[];
  /** ID of created edge */
  edgeId?: string;
  /** Human-readable message */
  message?: string;
  error?: string;
}

/**
 * Serialized canvas context sent to the LLM for decision-making.
 * Lightweight representation - no file data, just structure.
 */
export interface CanvasContext {
  nodes: NodeSummary[];
  edges: EdgeSummary[];
  availableTags: string[];
  availableHashtags: string[];
}

export interface NodeSummary {
  id: string;
  type: NodeType;
  /** Element name, or tag assignment */
  name?: string;
  position: { x: number; y: number };
  hashtags?: string[];
  /** For prompt nodes - the prompt text */
  prompt?: string;
  /** For prompt nodes - the mode */
  mode?: PromptMode;
  /** For image/video nodes - the role */
  role?: MediaRole;
  /** For element nodes - the type */
  elementType?: ElementType;
  /** For output nodes - the output type */
  outputType?: 'video' | 'image';
  /** Whether this is a placeholder output (chain) */
  isPlaceholder?: boolean;
}

export interface EdgeSummary {
  id: string;
  source: string;
  target: string;
  tag?: string;
  isChainEdge?: boolean;
}

/**
 * Request body for the AI command execution API route.
 */
export interface AICommandRequest {
  command: string;
  canvasContext: CanvasContext;
}

/**
 * Response from the AI command execution API route.
 */
export interface AICommandResponse {
  /** LLM's explanation of what it will do */
  plan: string;
  /** Ordered list of tool calls to execute */
  toolCalls: ToolCallRequest[];
  /** Whether this creates a chain (triggers chain generation flow) */
  isChain: boolean;
}

/**
 * Request body for the moodboard API route.
 */
export interface MoodboardRequest {
  story: string;
  /** Optional style guidance */
  style?: string;
}

/**
 * Response from the moodboard API route.
 */
export interface MoodboardResponse {
  /** LLM's breakdown of the story */
  plan: string;
  /** Characters identified */
  characters: Array<{ name: string; description: string }>;
  /** Scenes identified */
  scenes: Array<{ title: string; description: string; characters: string[] }>;
  /** Ordered tool calls to create the full moodboard */
  toolCalls: ToolCallRequest[];
}
