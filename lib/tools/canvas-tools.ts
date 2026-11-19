import { nanoid } from 'nanoid';
import { createNode } from '@/stores/canvas-store';
import type { CanvasTool } from './registry';
import type { PromptMode, ElementType, CameraAngle, LensLength, Colorimetry, LightingStyle, LightingKey } from '@/types';

// ============================================================================
// CANVAS TOOL IMPLEMENTATIONS
// ============================================================================

/**
 * Create an Element node (character or object).
 * Use when the user wants to define a character or object for generation.
 */
export const createElementNodeTool: CanvasTool = {
  definition: {
    name: 'create_element_node',
    description: 'Create a character or object element node on the canvas. This defines a reusable character/object that can be referenced in prompts with @name tags.',
    parameters: [
      { name: 'name', type: 'string', description: 'Name of the character or object (e.g., "Alice", "Robot")', required: true },
      { name: 'element_type', type: 'string', description: 'Type of element', required: false, enum: ['character', 'object'] },
      { name: 'position_x', type: 'number', description: 'X position on canvas', required: false },
      { name: 'position_y', type: 'number', description: 'Y position on canvas', required: false },
      { name: 'hashtags', type: 'array', description: 'Hashtags to organize this node', required: false, items: { type: 'string' } },
    ],
  },
  execute: async (args, context) => {
    const name = args.name as string;
    const elementType = (args.element_type as ElementType) || 'character';
    const position = context.getNextPosition(
      args.position_x && args.position_y
        ? { x: args.position_x as number, y: args.position_y as number }
        : undefined
    );

    const node = createNode('element', position, {
      name,
      elementType,
    });

    context.addNode(node);

    // Add hashtags if provided
    const hashtags = args.hashtags as string[] | undefined;
    if (hashtags?.length) {
      for (const tag of hashtags) {
        context.addHashtagToNode(node.id, tag);
      }
    }

    return {
      success: true,
      nodeId: node.id,
      message: `Created ${elementType} element "${name}"`,
    };
  },
};

/**
 * Create a Prompt node with pre-filled text and settings.
 */
export const createPromptNodeTool: CanvasTool = {
  definition: {
    name: 'create_prompt_node',
    description: 'Create a prompt node on the canvas with pre-filled text. This is where generation is triggered from.',
    parameters: [
      { name: 'prompt', type: 'string', description: 'The generation prompt text. Can include @tags like @Alice or @Image1 to reference connected nodes.', required: true },
      { name: 'mode', type: 'string', description: 'Generation mode', required: false, enum: ['video', 'image'] },
      { name: 'duration', type: 'string', description: 'Video duration in seconds', required: false, enum: ['4', '5', '6', '8', '10', '12', '15'] },
      { name: 'aspect_ratio', type: 'string', description: 'Video aspect ratio', required: false, enum: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] },
      { name: 'video_resolution', type: 'string', description: 'Video resolution', required: false, enum: ['480p', '720p', '1080p'] },
      { name: 'image_aspect_ratio', type: 'string', description: 'Image aspect ratio', required: false, enum: ['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16'] },
      { name: 'image_resolution', type: 'string', description: 'Image resolution', required: false, enum: ['1K', '2K', '4K'] },
      { name: 'position_x', type: 'number', description: 'X position on canvas', required: false },
      { name: 'position_y', type: 'number', description: 'Y position on canvas', required: false },
      { name: 'hashtags', type: 'array', description: 'Hashtags to organize this node', required: false, items: { type: 'string' } },
    ],
  },
  execute: async (args, context) => {
    const prompt = args.prompt as string;
    const mode = (args.mode as PromptMode) || 'image';
    const position = context.getNextPosition(
      args.position_x && args.position_y
        ? { x: args.position_x as number, y: args.position_y as number }
        : undefined
    );

    const nodeData: Record<string, unknown> = { prompt, mode };
    if (args.duration) nodeData.duration = args.duration;
    if (args.aspect_ratio) nodeData.aspectRatio = args.aspect_ratio;
    if (args.video_resolution) nodeData.videoResolution = args.video_resolution;
    if (args.image_aspect_ratio) nodeData.imageAspectRatio = args.image_aspect_ratio;
    if (args.image_resolution) nodeData.imageResolution = args.image_resolution;

    const node = createNode('prompt', position, nodeData);
    context.addNode(node);

    const hashtags = args.hashtags as string[] | undefined;
    if (hashtags?.length) {
      for (const tag of hashtags) {
        context.addHashtagToNode(node.id, tag);
      }
    }

    return {
      success: true,
      nodeId: node.id,
      message: `Created ${mode} prompt node`,
    };
  },
};

/**
 * Create an Image node (empty or with a URL).
 */
export const createImageNodeTool: CanvasTool = {
  definition: {
    name: 'create_image_node',
    description: 'Create an image reference node on the canvas.',
    parameters: [
      { name: 'role', type: 'string', description: 'Role of the image', required: false, enum: ['reference', 'start_frame', 'end_frame'] },
      { name: 'image_url', type: 'string', description: 'URL of an image to pre-load', required: false },
      { name: 'position_x', type: 'number', description: 'X position', required: false },
      { name: 'position_y', type: 'number', description: 'Y position', required: false },
      { name: 'hashtags', type: 'array', description: 'Hashtags', required: false, items: { type: 'string' } },
    ],
  },
  execute: async (args, context) => {
    const position = context.getNextPosition(
      args.position_x && args.position_y
        ? { x: args.position_x as number, y: args.position_y as number }
        : undefined
    );

    const nodeData: Record<string, unknown> = {};
    if (args.role) nodeData.role = args.role;
    if (args.image_url) {
      nodeData.imageUrl = args.image_url;
      nodeData.thumbnailUrl = args.image_url;
      nodeData.remoteUrl = args.image_url;
      nodeData.uploadStatus = 'completed';
    }

    const node = createNode('image', position, nodeData);
    context.addNode(node);

    const hashtags = args.hashtags as string[] | undefined;
    if (hashtags?.length) {
      for (const tag of hashtags) {
        context.addHashtagToNode(node.id, tag);
      }
    }

    return { success: true, nodeId: node.id, message: 'Created image node' };
  },
};

/**
 * Create a Video node.
 */
export const createVideoNodeTool: CanvasTool = {
  definition: {
    name: 'create_video_node',
    description: 'Create a video reference node on the canvas.',
    parameters: [
      { name: 'role', type: 'string', description: 'Role of the video', required: false, enum: ['reference', 'edit_source'] },
      { name: 'video_url', type: 'string', description: 'URL of a video to pre-load', required: false },
      { name: 'position_x', type: 'number', description: 'X position', required: false },
      { name: 'position_y', type: 'number', description: 'Y position', required: false },
    ],
  },
  execute: async (args, context) => {
    const position = context.getNextPosition(
      args.position_x && args.position_y
        ? { x: args.position_x as number, y: args.position_y as number }
        : undefined
    );

    const nodeData: Record<string, unknown> = {};
    if (args.role) nodeData.role = args.role;
    if (args.video_url) {
      nodeData.videoUrl = args.video_url;
      nodeData.remoteUrl = args.video_url;
      nodeData.uploadStatus = 'completed';
    }

    const node = createNode('video', position, nodeData);
    context.addNode(node);

    return { success: true, nodeId: node.id, message: 'Created video node' };
  },
};

/**
 * Connect two nodes with an edge.
 */
export const connectNodesTool: CanvasTool = {
  definition: {
    name: 'connect_nodes',
    description: 'Connect a source node to a target node with an edge. The source node outputs data that the target node uses as input.',
    parameters: [
      { name: 'source_node_id', type: 'string', description: 'ID of the source node (the one providing output)', required: true },
      { name: 'target_node_id', type: 'string', description: 'ID of the target node (the one receiving input)', required: true },
      { name: 'is_chain_edge', type: 'boolean', description: 'Whether this is a chain edge (output → next prompt in chain)', required: false },
    ],
  },
  execute: async (args, context) => {
    const sourceId = args.source_node_id as string;
    const targetId = args.target_node_id as string;
    const isChainEdge = args.is_chain_edge as boolean | undefined;

    // Validate nodes exist
    const nodes = context.getNodes();
    const sourceNode = nodes.find((n) => n.id === sourceId);
    const targetNode = nodes.find((n) => n.id === targetId);

    if (!sourceNode) {
      return { success: false, error: `Source node "${sourceId}" not found` };
    }
    if (!targetNode) {
      return { success: false, error: `Target node "${targetId}" not found` };
    }

    const edgeId = `edge-${nanoid()}`;
    context.addEdge({
      id: edgeId,
      source: sourceId,
      target: targetId,
      sourceHandle: 'output',
      targetHandle: 'input',
      data: {
        isChainEdge: isChainEdge || false,
        ...(isChainEdge ? { color: '#6B7280' } : {}), // Gray for chain edges
      },
    });

    return {
      success: true,
      edgeId,
      message: `Connected ${sourceNode.type} → ${targetNode.type}`,
    };
  },
};

/**
 * Update data on an existing node.
 */
export const updateNodeDataTool: CanvasTool = {
  definition: {
    name: 'update_node_data',
    description: 'Update fields on an existing node. Use this to modify prompts, names, settings, etc.',
    parameters: [
      { name: 'node_id', type: 'string', description: 'ID of the node to update', required: true },
      { name: 'updates', type: 'object', description: 'Object with fields to update (e.g., { prompt: "new text", mode: "image" })', required: true },
    ],
  },
  execute: async (args, context) => {
    const nodeId = args.node_id as string;
    const updates = args.updates as Record<string, unknown>;

    const nodes = context.getNodes();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      return { success: false, error: `Node "${nodeId}" not found` };
    }

    context.updateNode(nodeId, updates);
    return {
      success: true,
      nodeId,
      message: `Updated ${node.type} node`,
    };
  },
};

/**
 * Trigger generation on a prompt node.
 */
export const startGenerationTool: CanvasTool = {
  definition: {
    name: 'start_generation',
    description: 'Trigger AI generation on a prompt node. The prompt must have text and optionally connected input nodes.',
    parameters: [
      { name: 'prompt_node_id', type: 'string', description: 'ID of the prompt node to generate from', required: true },
    ],
  },
  execute: async (args, context) => {
    const promptNodeId = args.prompt_node_id as string;

    const nodes = context.getNodes();
    const node = nodes.find((n) => n.id === promptNodeId);
    if (!node || node.type !== 'prompt') {
      return { success: false, error: `Prompt node "${promptNodeId}" not found` };
    }

    try {
      await context.startGeneration(promptNodeId);
      return {
        success: true,
        nodeId: promptNodeId,
        message: 'Generation started',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      };
    }
  },
};

/**
 * Convert an image or output node into an element node.
 * This is the "Turn @Image1 into a Character" operation.
 */
export const convertToElementTool: CanvasTool = {
  definition: {
    name: 'convert_to_element',
    description: 'Convert an image or output node into a character/object element node. Copies the image data to a new element node.',
    parameters: [
      { name: 'source_node_id', type: 'string', description: 'ID of the image or output node to convert', required: true },
      { name: 'name', type: 'string', description: 'Name for the new element', required: true },
      { name: 'element_type', type: 'string', description: 'Type of element', required: false, enum: ['character', 'object'] },
    ],
  },
  execute: async (args, context) => {
    const sourceId = args.source_node_id as string;
    const name = args.name as string;
    const elementType = (args.element_type as ElementType) || 'character';

    const nodes = context.getNodes();
    const sourceNode = nodes.find((n) => n.id === sourceId);
    if (!sourceNode) {
      return { success: false, error: `Node "${sourceId}" not found` };
    }

    // Extract image URL from source
    let imageUrl = '';
    let remoteUrl = '';

    if (sourceNode.type === 'image') {
      const data = sourceNode.data as Record<string, unknown>;
      imageUrl = (data.imageUrl as string) || '';
      remoteUrl = (data.remoteUrl as string) || '';
    } else if (sourceNode.type === 'output') {
      const data = sourceNode.data as Record<string, unknown>;
      if (data.outputType === 'image') {
        imageUrl = (data.imageUrl as string) || '';
        remoteUrl = imageUrl; // Output URLs are already remote
      } else {
        return { success: false, error: 'Cannot convert video output to element' };
      }
    } else {
      return { success: false, error: `Node type "${sourceNode.type}" cannot be converted to element` };
    }

    if (!imageUrl) {
      return { success: false, error: 'Source node has no image' };
    }

    // Create element node near the source
    const position = {
      x: sourceNode.position.x,
      y: sourceNode.position.y + 250,
    };

    const elementNode = createNode('element', position, {
      name,
      elementType,
      frontalImageUrl: imageUrl,
      frontalThumbnail: imageUrl,
      frontalRemoteUrl: remoteUrl || undefined,
      frontalUploadStatus: remoteUrl ? 'completed' : 'idle',
    });

    context.addNode(elementNode);

    return {
      success: true,
      nodeId: elementNode.id,
      message: `Converted to ${elementType} element "${name}"`,
    };
  },
};

/**
 * Add a hashtag to a node.
 */
export const addHashtagTool: CanvasTool = {
  definition: {
    name: 'add_hashtag',
    description: 'Add a #hashtag to a node for organizational purposes.',
    parameters: [
      { name: 'node_id', type: 'string', description: 'ID of the node to tag', required: true },
      { name: 'hashtag', type: 'string', description: 'Hashtag to add (without # prefix)', required: true },
    ],
  },
  execute: async (args, context) => {
    const nodeId = args.node_id as string;
    const hashtag = args.hashtag as string;

    context.addHashtagToNode(nodeId, hashtag);

    return {
      success: true,
      nodeId,
      message: `Added #${hashtag} to node`,
    };
  },
};

/**
 * Create a Camera node with settings.
 */
export const createCameraNodeTool: CanvasTool = {
  definition: {
    name: 'create_camera_node',
    description: 'Create a camera settings node. Connect it to a prompt to apply cinematography settings.',
    parameters: [
      { name: 'camera_angle', type: 'string', description: 'Camera angle style', required: false, enum: ['eye-level', 'low-angle', 'high-angle', 'dutch-angle', 'birds-eye-view', 'worms-eye-view', 'over-the-shoulder', 'point-of-view', 'close-up', 'extreme-close-up', 'wide-shot', 'establishing-shot', 'tracking-shot', 'dolly-zoom'] },
      { name: 'lens_length', type: 'string', description: 'Lens focal length', required: false, enum: ['14mm', '24mm', '35mm', '50mm', '85mm', '100mm-macro', '135mm', '200mm', '400mm'] },
      { name: 'colorimetry', type: 'string', description: 'Color grading style', required: false, enum: ['natural', 'black-and-white', 'teal-and-orange', 'vintage-film', 'warm-golden-hour', 'cold-blue', 'neon-cyberpunk', 'muted-desaturated', 'high-contrast', 'pastel-soft', 'sepia'] },
      { name: 'position_x', type: 'number', description: 'X position', required: false },
      { name: 'position_y', type: 'number', description: 'Y position', required: false },
    ],
  },
  execute: async (args, context) => {
    const position = context.getNextPosition(
      args.position_x && args.position_y
        ? { x: args.position_x as number, y: args.position_y as number }
        : undefined
    );

    const node = createNode('camera', position, {
      cameraAngle: (args.camera_angle as CameraAngle) || '',
      lensLength: (args.lens_length as LensLength) || '',
      colorimetry: (args.colorimetry as Colorimetry) || '',
    });

    context.addNode(node);
    return { success: true, nodeId: node.id, message: 'Created camera node' };
  },
};

/**
 * Create a Lighting node with settings.
 */
export const createLightingNodeTool: CanvasTool = {
  definition: {
    name: 'create_lighting_node',
    description: 'Create a lighting settings node. Connect it to a prompt to apply lighting settings.',
    parameters: [
      { name: 'lighting_style', type: 'string', description: 'Lighting technique', required: false, enum: ['rembrandt', 'butterfly', 'split', 'loop', 'broad', 'short', 'rim', 'backlighting', 'silhouette', 'three-point', 'natural', 'practical', 'motivated', 'soft-diffused', 'hard-dramatic'] },
      { name: 'lighting_key', type: 'string', description: 'Lighting key/tone', required: false, enum: ['low-key', 'high-key', 'natural-key', 'chiaroscuro', 'flat', 'dramatic', 'moody', 'ethereal', 'noir', 'golden-hour', 'blue-hour'] },
      { name: 'position_x', type: 'number', description: 'X position', required: false },
      { name: 'position_y', type: 'number', description: 'Y position', required: false },
    ],
  },
  execute: async (args, context) => {
    const position = context.getNextPosition(
      args.position_x && args.position_y
        ? { x: args.position_x as number, y: args.position_y as number }
        : undefined
    );

    const node = createNode('lighting', position, {
      lightingStyle: (args.lighting_style as LightingStyle) || '',
      lightingKey: (args.lighting_key as LightingKey) || '',
    });

    context.addNode(node);
    return { success: true, nodeId: node.id, message: 'Created lighting node' };
  },
};

/**
 * Create a generation chain: linked sequence of prompt → placeholder_output nodes.
 * Each step's output feeds into the next step's prompt.
 *
 * Data flow:
 * [Prompt1] --edge--> [PlaceholderOutput1] --chain_edge--> [Prompt2] --edge--> [PlaceholderOutput2] ...
 */
export const createChainTool: CanvasTool = {
  definition: {
    name: 'create_chain',
    description: 'Create a sequential chain of generation steps. Each step has a prompt that generates an output, which feeds into the next prompt. The user validates each output before the chain continues.',
    parameters: [
      { name: 'steps', type: 'array', description: 'Array of step objects. Each step: { prompt: string, mode: "video"|"image" }', required: true, items: { type: 'object' } },
      { name: 'name', type: 'string', description: 'Name for this chain', required: false },
      { name: 'auto_start', type: 'boolean', description: 'Whether to start generation of the first step immediately', required: false },
      { name: 'base_position_x', type: 'number', description: 'Starting X position for the chain layout', required: false },
      { name: 'base_position_y', type: 'number', description: 'Starting Y position for the chain layout', required: false },
      { name: 'input_node_ids', type: 'array', description: 'Node IDs to connect as inputs to the first prompt in the chain', required: false, items: { type: 'string' } },
    ],
  },
  execute: async (args, context) => {
    const steps = args.steps as Array<{ prompt: string; mode?: string }>;
    const chainName = args.name as string | undefined;
    const autoStart = args.auto_start as boolean | undefined;
    const baseX = (args.base_position_x as number) || 400;
    const baseY = (args.base_position_y as number) || 200;
    const inputNodeIds = args.input_node_ids as string[] | undefined;

    if (!steps?.length) {
      return { success: false, error: 'Chain must have at least one step' };
    }

    const createdNodeIds: string[] = [];
    const chainSteps: Array<{ promptNodeId: string; placeholderOutputId: string }> = [];

    // Layout: each step is 800px to the right of the previous
    // Prompt → Output gap is 400px
    const STEP_WIDTH = 800;
    const PROMPT_OUTPUT_GAP = 400;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const promptX = baseX + i * STEP_WIDTH;
      const promptY = baseY;
      const outputX = promptX + PROMPT_OUTPUT_GAP;
      const outputY = promptY;

      // Create prompt node
      const promptNode = createNode('prompt', { x: promptX, y: promptY }, {
        prompt: step.prompt,
        mode: (step.mode as PromptMode) || 'image',
        chainId: 'pending', // Will be set after chain is created
        chainStepIndex: i,
      });

      // Create placeholder output node
      const outputNode = createNode('output', { x: outputX, y: outputY }, {
        isPlaceholder: true,
        chainId: 'pending', // Will be set after chain is created
        chainStepIndex: i,
        outputType: (step.mode as PromptMode) === 'video' ? 'video' : 'image',
      });

      context.addNode(promptNode);
      context.addNode(outputNode);

      // Connect prompt → placeholder output
      context.addEdge({
        id: `edge-${nanoid()}`,
        source: promptNode.id,
        target: outputNode.id,
        sourceHandle: 'output',
        targetHandle: 'input',
      });

      // Connect previous output → this prompt (chain link)
      if (i > 0) {
        const prevOutput = chainSteps[i - 1].placeholderOutputId;
        context.addEdge({
          id: `edge-chain-${nanoid()}`,
          source: prevOutput,
          target: promptNode.id,
          sourceHandle: 'output',
          targetHandle: 'input',
          data: { isChainEdge: true, color: '#6B7280' },
        });
      }

      // Connect external input nodes to first prompt
      if (i === 0 && inputNodeIds?.length) {
        for (const inputId of inputNodeIds) {
          context.addEdge({
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

      createdNodeIds.push(promptNode.id, outputNode.id);
    }

    // Create the chain in chain store
    const chainId = context.createChain(chainSteps, chainName);

    // Update all nodes with the real chain ID
    for (const step of chainSteps) {
      context.updateNode(step.promptNodeId, { chainId });
      context.updateNode(step.placeholderOutputId, { chainId });
    }

    // Auto-start if requested: start chain AND trigger first generation
    if (autoStart && chainSteps.length > 0) {
      context.startChain(chainId);
      // Trigger generation on the first prompt node
      try {
        await context.startGeneration(chainSteps[0].promptNodeId);
      } catch (error) {
        console.error('Chain auto-start generation failed:', error);
      }
    }

    return {
      success: true,
      nodeIds: createdNodeIds,
      message: `Created chain "${chainName || 'Unnamed'}" with ${steps.length} steps`,
    };
  },
};

// ============================================================================
// REGISTRY OF ALL TOOLS
// ============================================================================

export const allCanvasTools: CanvasTool[] = [
  createElementNodeTool,
  createPromptNodeTool,
  createImageNodeTool,
  createVideoNodeTool,
  connectNodesTool,
  updateNodeDataTool,
  startGenerationTool,
  convertToElementTool,
  addHashtagTool,
  createCameraNodeTool,
  createLightingNodeTool,
  createChainTool,
];
