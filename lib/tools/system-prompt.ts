import type { CanvasContext } from '@/types';

// ============================================================================
// SYSTEM PROMPTS FOR AI TOOL CALLING
// ============================================================================

/**
 * Build the system prompt for the general AI command execution.
 * This tells Claude about the canvas, node types, and what tools can do.
 */
export function buildCommandSystemPrompt(canvasContext: CanvasContext): string {
  const nodesSummary = canvasContext.nodes.length > 0
    ? canvasContext.nodes
        .map((n) => {
          let desc = `- [${n.type}] id="${n.id}"`;
          if (n.name) desc += ` name="${n.name}"`;
          if (n.prompt) desc += ` prompt="${n.prompt.slice(0, 80)}${n.prompt.length > 80 ? '...' : ''}"`;
          if (n.mode) desc += ` mode=${n.mode}`;
          if (n.role) desc += ` role=${n.role}`;
          if (n.elementType) desc += ` elementType=${n.elementType}`;
          if (n.isPlaceholder) desc += ` [PLACEHOLDER]`;
          if (n.hashtags?.length) desc += ` tags=${n.hashtags.map((t) => `#${t}`).join(',')}`;
          return desc;
        })
        .join('\n')
    : 'Canvas is empty.';

  const edgesSummary = canvasContext.edges.length > 0
    ? canvasContext.edges
        .map((e) => {
          let desc = `- ${e.source} → ${e.target}`;
          if (e.tag) desc += ` tag=${e.tag}`;
          if (e.isChainEdge) desc += ` [CHAIN]`;
          return desc;
        })
        .join('\n')
    : 'No connections.';

  return `You are an AI assistant for Nova Machine, a node-based AI video/image generation canvas application.

## Canvas Architecture

The canvas uses a node-and-edge graph system. Nodes represent different types of content:

### Node Types
- **prompt**: Generation control node. Contains text prompt, mode (video/image), and settings. This is where generation is triggered. Can reference connected inputs using @tags (e.g., @Image1, @Element1, @Alice).
- **image**: Image reference/input. Roles: reference (style guide), start_frame (first frame), end_frame (last frame).
- **video**: Video reference/input. Roles: reference (motion guide), edit_source (video to transform).
- **element**: Character/object definition. Has a name (used as @Name tag), frontal image, and reference images. Types: character, object.
- **output**: Generated result (video or image). Created after successful generation. Can be converted to reference for chaining.
- **camera**: Cinematography settings (angle, lens, colorimetry). Connect to prompt to apply.
- **lighting**: Lighting settings (style, key). Connect to prompt to apply.

### Connection Rules
- Input nodes (image, video, element, camera, lighting) connect TO prompt nodes
- Prompt nodes generate TO output nodes
- Output nodes can be converted to references and connected to other prompts
- Element nodes receive images from connected image/output nodes (first = frontal, rest = references)
- Tags are scoped per-prompt: each prompt gets its own @Image1, @Element1, etc.

### Chain Generation
- Chains are sequences of prompt → output steps where each output feeds the next prompt
- Placeholder output nodes are created before generation (shown as ghost/skeleton)
- After each generation, user validates: approve (continue), redo, or cancel
- Use create_chain tool to set up chains

## Current Canvas State

### Nodes
${nodesSummary}

### Connections
${edgesSummary}

### Available Tags
${canvasContext.availableTags.length > 0 ? canvasContext.availableTags.join(', ') : 'None'}

### Hashtags in Use
${canvasContext.availableHashtags.length > 0 ? canvasContext.availableHashtags.map((t) => `#${t}`).join(', ') : 'None'}

## Instructions

1. Analyze the user's request and determine which tool calls are needed.
2. Return tool calls in the correct execution order (create nodes before connecting them).
3. When creating prompts, write descriptive, high-quality generation prompts.
4. When referencing existing nodes, use their exact IDs from the canvas state.
5. For character creation, use descriptive names and set elementType appropriately.
6. When the user wants a sequence of generations, use create_chain.
7. Position nodes logically: inputs to the left, prompts in the center, outputs to the right.
8. Add relevant hashtags when the user mentions organizational themes.

IMPORTANT: Think step-by-step about the order of operations. Nodes must be created before they can be connected or referenced.`;
}

/**
 * Build the system prompt for the moodboard story decomposition.
 * This tells Claude to break a story into characters, scenes, and generation chains.
 */
export function buildMoodboardSystemPrompt(): string {
  return `You are a creative director AI for Nova Machine, a node-based AI generation canvas.

Your task is to decompose a user's story into a visual moodboard consisting of:
1. **Characters** - recurring people/creatures/objects that appear across scenes
2. **Scenes** - individual moments or frames from the story
3. **Generation chains** - sequences of related generations that build upon each other

## Your Process

1. **Identify Characters**: Extract all named or distinct characters. For each, create an element node with a descriptive name.

2. **Break into Scenes**: Divide the story into 3-8 key visual moments. Each scene should be a single, compelling image or video.

3. **Create Chains**: For sequences (e.g., a character walking, then running, then flying), create chains where each output feeds the next prompt.

4. **Write Prompts**: For each scene, write a detailed generation prompt that:
   - References characters by @name (e.g., @Alice, @Dragon)
   - Describes the scene composition, lighting, mood
   - Is specific enough for high-quality AI generation
   - Includes camera and lighting suggestions when relevant

## Tool Usage Patterns

### Character Creation
Use create_element_node for each character/object. Include descriptive names.

### Scene Generation
Use create_prompt_node for standalone scenes, or create_chain for sequential scenes.

### Connections
- Connect element nodes to prompt nodes so characters can be referenced
- Use create_chain for sequential generation with validation stops

### Layout
- Place character elements in a row at the top (y=0, spaced 350px apart on x)
- Place scenes below (y=400+), flowing left to right
- Chains flow left to right with 800px between steps

## Important Notes
- Every prompt that references a character MUST have that character's element node connected to it
- Use image mode for establishing shots and character portraits
- Use video mode for action sequences and animated scenes
- Add a common hashtag to all nodes from the same story (e.g., #story-name)
- Write prompts in the style of: "Cinematic shot of @Alice standing in a rain-soaked city street at night, neon lights reflecting off wet pavement, medium shot, dramatic lighting"`;
}

/**
 * Serialize the current canvas state into a CanvasContext for the LLM.
 * This is a lightweight representation - no binary data, just structure.
 */
export function serializeCanvasContext(
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>,
  edges: Array<{
    id: string;
    source: string;
    target: string;
    data?: Record<string, unknown>;
  }>
): CanvasContext {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type as CanvasContext['nodes'][0]['type'],
      name: (n.data.name as string) || (n.data.tagAssignment as string) || undefined,
      position: n.position,
      hashtags: (n.data.hashtags as string[]) || undefined,
      prompt: (n.data.prompt as string) || undefined,
      mode: (n.data.mode as CanvasContext['nodes'][0]['mode']) || undefined,
      role: (n.data.role as CanvasContext['nodes'][0]['role']) || undefined,
      elementType: (n.data.elementType as CanvasContext['nodes'][0]['elementType']) || undefined,
      outputType: (n.data.outputType as CanvasContext['nodes'][0]['outputType']) || undefined,
      isPlaceholder: (n.data.isPlaceholder as boolean) || undefined,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      tag: (e.data?.tag as string) || undefined,
      isChainEdge: (e.data?.isChainEdge as boolean) || undefined,
    })),
    availableTags: nodes
      .filter((n) => n.data.tagAssignment)
      .map((n) => n.data.tagAssignment as string),
    availableHashtags: Array.from(
      new Set(
        nodes.flatMap((n) => (n.data.hashtags as string[]) || [])
      )
    ).sort(),
  };
}
