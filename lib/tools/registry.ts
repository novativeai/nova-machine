import type { CanvasToolDefinition, ToolCallRequest, ToolCallResult } from '@/types';
import type { NovaNode, NovaEdge, NovaNodeData } from '@/types';

// ============================================================================
// TOOL EXECUTION CONTEXT
// ============================================================================

/**
 * Context provided to every tool execution.
 * Contains all the store actions and helpers needed to manipulate the canvas.
 */
export interface ToolExecutionContext {
  // Canvas store actions
  addNode: (node: NovaNode) => void;
  updateNode: (id: string, data: Partial<NovaNodeData>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: NovaEdge) => void;
  removeEdge: (id: string) => void;
  getNodes: () => NovaNode[];
  getEdges: () => NovaEdge[];
  getConnectedInputs: (promptNodeId: string) => NovaNode[];

  // Hashtag actions
  addHashtagToNode: (nodeId: string, tag: string) => void;

  // Chain store actions
  createChain: (
    steps: Array<{ promptNodeId: string; placeholderOutputId: string }>,
    name?: string
  ) => string;
  startChain: (chainId: string) => void;

  // Position helper
  getNextPosition: (basePosition?: { x: number; y: number }) => { x: number; y: number };

  // Generation trigger (async - starts generation on a prompt node)
  startGeneration: (promptNodeId: string) => Promise<void>;
}

// ============================================================================
// CANVAS TOOL INTERFACE
// ============================================================================

/**
 * A canvas tool combines:
 * 1. A definition (sent to the LLM for tool use decisions)
 * 2. An execute function (runs client-side to manipulate canvas state)
 */
export interface CanvasTool {
  definition: CanvasToolDefinition;
  execute: (
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ) => Promise<ToolCallResult>;
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

class ToolRegistryImpl {
  private tools = new Map<string, CanvasTool>();

  /**
   * Register a tool. Throws if a tool with the same name already exists.
   */
  register(tool: CanvasTool): void {
    if (this.tools.has(tool.definition.name)) {
      console.warn(`Tool "${tool.definition.name}" already registered, overwriting.`);
    }
    this.tools.set(tool.definition.name, tool);
  }

  /**
   * Register multiple tools at once.
   */
  registerAll(tools: CanvasTool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get all tool definitions (for sending to the LLM).
   */
  getDefinitions(): CanvasToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /**
   * Get tool definitions formatted for Claude API tool_use.
   * Converts our ToolParameter[] to JSON Schema format.
   */
  getClaudeToolDefinitions(): Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.definition.name,
      description: t.definition.description,
      input_schema: {
        type: 'object',
        properties: Object.fromEntries(
          t.definition.parameters.map((p) => [
            p.name,
            {
              type: p.type,
              description: p.description,
              ...(p.enum ? { enum: p.enum } : {}),
              ...(p.items ? { items: p.items } : {}),
            },
          ])
        ),
        required: t.definition.parameters
          .filter((p) => p.required)
          .map((p) => p.name),
      },
    }));
  }

  /**
   * Execute a tool call by name.
   */
  async execute(
    request: ToolCallRequest,
    context: ToolExecutionContext
  ): Promise<ToolCallResult> {
    const tool = this.tools.get(request.name);
    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${request.name}`,
      };
    }

    try {
      return await tool.execute(request.arguments, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during tool execution',
      };
    }
  }

  /**
   * Execute a sequence of tool calls in order.
   * Returns results for each call. Stops on first critical failure.
   */
  async executeSequence(
    requests: ToolCallRequest[],
    context: ToolExecutionContext,
    onProgress?: (completed: number, total: number, currentTool: string) => void
  ): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      onProgress?.(i, requests.length, request.name);

      const result = await this.execute(request, context);
      results.push(result);

      if (!result.success) {
        console.error(`Tool "${request.name}" failed:`, result.error);
        // Continue execution for non-critical failures
        // (individual node creation failure shouldn't stop the whole chain)
      }
    }

    onProgress?.(requests.length, requests.length, 'done');
    return results;
  }

  /**
   * Check if a tool is registered.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get the count of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }
}

// Singleton registry
export const toolRegistry = new ToolRegistryImpl();
