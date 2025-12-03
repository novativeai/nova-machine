# NovaMachine Type Definitions

## Core Types

```typescript
// ============================================================================
// NODE TYPES
// ============================================================================

export type NodeType = 'prompt' | 'image' | 'video' | 'element' | 'output';

export type MediaRole =
  | 'reference'      // @Image1, @Image2, etc.
  | 'start_frame'    // For Image-to-Video start
  | 'end_frame'      // For Image-to-Video end
  | 'element'        // @Element1, @Element2
  | 'video_ref'      // @Video1
  | 'edit_source'    // Source video for editing
  | 'output';        // Generated output

export type GenerationStatus =
  | 'idle'
  | 'uploading'
  | 'queued'
  | 'generating'
  | 'completed'
  | 'error';

// ============================================================================
// TAG SYSTEM
// ============================================================================

export type TagType = 'image' | 'element' | 'video';

export interface Tag {
  type: TagType;
  index: number;        // 1, 2, 3, etc.
  label: string;        // "@Image1", "@Element2", etc.
  color: string;        // Hex color for highlighting
  nodeId: string;       // Connected node ID
}

export const TAG_COLORS: Record<TagType, string> = {
  image: '#3B82F6',    // Blue
  element: '#EF4444',  // Red
  video: '#8B5CF6',    // Purple
};

export interface TagMatch {
  tag: string;
  type: TagType;
  index: number;
  startPosition: number;
  endPosition: number;
}

// ============================================================================
// NODE DATA TYPES
// ============================================================================

export interface BaseNodeData {
  id: string;
  type: NodeType;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptNodeData extends BaseNodeData {
  type: 'prompt';
  prompt: string;
  duration: '5' | '10';
  aspectRatio: '16:9' | '9:16' | '1:1';
  negativePrompt: string;
  cfgScale: number;
  status: GenerationStatus;
  progress: number;
  error?: string;
  selectedModel?: KlingModel;
  connectedInputs: ConnectedInput[];
}

export interface ImageNodeData extends BaseNodeData {
  type: 'image';
  imageUrl: string;
  thumbnailUrl: string;
  fileName: string;
  fileSize: number;
  dimensions: { width: number; height: number };
  role: 'reference' | 'start_frame' | 'end_frame';
  tagAssignment?: string;
  isHighlighted: boolean;
}

export interface VideoNodeData extends BaseNodeData {
  type: 'video';
  videoUrl: string;
  thumbnailUrl: string;
  fileName: string;
  fileSize: number;
  duration: number;
  dimensions: { width: number; height: number };
  role: 'reference' | 'edit_source' | 'output';
  tagAssignment?: string;
  isHighlighted: boolean;
}

export interface ElementNodeData extends BaseNodeData {
  type: 'element';
  name: string;
  frontalImageUrl: string;
  frontalThumbnail: string;
  referenceImageUrls: string[];
  referenceThumbnails: string[];
  tagAssignment?: string;
  isHighlighted: boolean;
}

export interface OutputNodeData extends BaseNodeData {
  type: 'output';
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  dimensions: { width: number; height: number };
  role: 'output' | 'reference';
  canChain: boolean;
  generationMetadata: GenerationMetadata;
  isHighlighted: boolean;
}

export type NovaNodeData =
  | PromptNodeData
  | ImageNodeData
  | VideoNodeData
  | ElementNodeData
  | OutputNodeData;

// ============================================================================
// CONNECTION TYPES
// ============================================================================

export interface ConnectedInput {
  nodeId: string;
  nodeType: NodeType;
  tag?: string;
  handleId: string;
}

export interface ConnectionValidation {
  isValid: boolean;
  error?: string;
  suggestedModel?: KlingModel;
}

// ============================================================================
// GENERATION TYPES
// ============================================================================

export type KlingModel =
  | 'fal-ai/kling-video/o1/image-to-video'
  | 'fal-ai/kling-video/o1/reference-to-video'
  | 'fal-ai/kling-video/o1/video-to-video/edit'
  | 'fal-ai/kling-video/o1/video-to-video/reference';

export interface GenerationMetadata {
  promptUsed: string;
  modelUsed: KlingModel;
  inputNodes: string[];
  duration: number;
  aspectRatio: string;
  createdAt: Date;
  requestId: string;
  cost: number;
}

export interface GenerationRequest {
  model: KlingModel;
  input: KlingInput;
  onProgress?: (progress: GenerationProgress) => void;
}

export interface GenerationProgress {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  progress?: number;
  logs?: string[];
  eta?: number;
}

export interface GenerationResult {
  success: boolean;
  video?: {
    url: string;
    fileSize: number;
    fileName: string;
    contentType: string;
  };
  error?: string;
  requestId: string;
}

// ============================================================================
// KLING API INPUT TYPES
// ============================================================================

export interface KlingElement {
  frontal_image_url: string;
  reference_image_urls?: string[];
}

export interface KlingImageToVideoInput {
  prompt: string;
  start_image_url: string;
  end_image_url?: string;
  duration?: '5' | '10';
  aspect_ratio?: '16:9' | '9:16' | '1:1';
  negative_prompt?: string;
  cfg_scale?: number;
}

export interface KlingReferenceToVideoInput {
  prompt: string;
  image_urls?: string[];
  elements?: KlingElement[];
  duration?: '5' | '10';
  aspect_ratio?: '16:9' | '9:16' | '1:1';
}

export interface KlingVideoToVideoEditInput {
  prompt: string;
  video_url: string;
  image_urls?: string[];
  elements?: KlingElement[];
}

export interface KlingVideoToVideoReferenceInput {
  prompt: string;
  video_url: string;
  image_urls?: string[];
  elements?: KlingElement[];
  duration?: '5' | '10';
  aspect_ratio?: '16:9' | '9:16' | '1:1';
}

export type KlingInput =
  | KlingImageToVideoInput
  | KlingReferenceToVideoInput
  | KlingVideoToVideoEditInput
  | KlingVideoToVideoReferenceInput;

export interface KlingOutput {
  video: {
    url: string;
    file_size: number;
    file_name: string;
    content_type: string;
  };
}

// ============================================================================
// MODAL TYPES
// ============================================================================

export interface FileRoleModalData {
  isOpen: boolean;
  file: File | null;
  fileType: 'image' | 'video';
  previewUrl: string;
  position: { x: number; y: number };
}

export interface RoleOption {
  id: string;
  label: string;
  description: string;
  role: MediaRole;
  tagPrefix?: string;
}

export const IMAGE_ROLE_OPTIONS: RoleOption[] = [
  {
    id: 'reference',
    label: '@Image',
    description: 'Use as style/composition reference',
    role: 'reference',
    tagPrefix: '@Image',
  },
  {
    id: 'start_frame',
    label: 'Start Frame',
    description: 'First frame for animation',
    role: 'start_frame',
  },
  {
    id: 'end_frame',
    label: 'End Frame',
    description: 'Last frame for animation',
    role: 'end_frame',
  },
  {
    id: 'element',
    label: '@Element',
    description: 'Character or object definition',
    role: 'element',
    tagPrefix: '@Element',
  },
];

export const VIDEO_ROLE_OPTIONS: RoleOption[] = [
  {
    id: 'reference',
    label: '@Video',
    description: 'Reference for motion and style',
    role: 'video_ref',
    tagPrefix: '@Video',
  },
  {
    id: 'edit_source',
    label: 'Edit Source',
    description: 'Video to edit/transform',
    role: 'edit_source',
  },
];

// ============================================================================
// CANVAS TYPES
// ============================================================================

export interface CanvasState {
  nodes: NovaNode[];
  edges: NovaEdge[];
  selectedNodes: string[];
  zoom: number;
  viewport: { x: number; y: number };
}

export interface NovaNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NovaNodeData;
  selected?: boolean;
  dragging?: boolean;
}

export interface NovaEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: 'default' | 'tagged';
  data?: {
    tag?: string;
    color?: string;
    animated?: boolean;
  };
}

// ============================================================================
// STORE TYPES
// ============================================================================

export interface CanvasStore {
  nodes: NovaNode[];
  edges: NovaEdge[];

  // Node operations
  addNode: (node: NovaNode) => void;
  updateNode: (id: string, data: Partial<NovaNodeData>) => void;
  removeNode: (id: string) => void;

  // Edge operations
  addEdge: (edge: NovaEdge) => void;
  removeEdge: (id: string) => void;

  // Selection
  selectedNodes: string[];
  setSelectedNodes: (ids: string[]) => void;

  // Highlighting
  highlightNode: (id: string, color: string) => void;
  clearHighlights: () => void;

  // Tag management
  getNextTagIndex: (type: TagType) => number;
  getNodeByTag: (tag: string) => NovaNode | undefined;
}

export interface GenerationStore {
  queue: GenerationRequest[];
  activeGeneration: GenerationRequest | null;
  history: GenerationResult[];

  // Queue operations
  addToQueue: (request: GenerationRequest) => void;
  processNext: () => void;
  cancelGeneration: (requestId: string) => void;

  // Status
  isGenerating: boolean;
  currentProgress: GenerationProgress | null;
}

export interface ProjectStore {
  name: string;
  savedAt: Date | null;
  isDirty: boolean;

  // Operations
  save: () => Promise<void>;
  load: (id: string) => Promise<void>;
  reset: () => void;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface FileUploadResult {
  success: boolean;
  url?: string;
  error?: string;
  thumbnail?: string;
  metadata?: {
    fileName: string;
    fileSize: number;
    dimensions?: { width: number; height: number };
    duration?: number;
  };
}

export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}
```

## Model Selection Decision Tree

```typescript
/**
 * Model Selection Logic
 *
 * Decision tree for selecting the appropriate KLing model based on inputs:
 *
 * 1. Has Video Input?
 *    ├── YES → Is it for editing (prompt contains edit keywords)?
 *    │         ├── YES → VIDEO-TO-VIDEO/EDIT
 *    │         └── NO  → VIDEO-TO-VIDEO/REFERENCE
 *    └── NO  → Continue...
 *
 * 2. Has Elements?
 *    ├── YES → REFERENCE-TO-VIDEO
 *    └── NO  → Continue...
 *
 * 3. Has Images?
 *    ├── YES → Has both start and end frame?
 *    │         ├── YES → IMAGE-TO-VIDEO (with end frame)
 *    │         └── NO  → Has @Image references?
 *    │                   ├── YES → REFERENCE-TO-VIDEO
 *    │                   └── NO  → IMAGE-TO-VIDEO (single frame)
 *    └── NO  → ERROR: No valid inputs
 */

export function selectModel(inputs: ConnectedInput[], prompt: string): KlingModel {
  const hasVideo = inputs.some(i => i.nodeType === 'video');
  const hasElements = inputs.some(i => i.nodeType === 'element');
  const hasImages = inputs.some(i => i.nodeType === 'image');

  const editKeywords = ['edit', 'change', 'replace', 'transform', 'modify'];
  const isEditIntent = editKeywords.some(kw =>
    prompt.toLowerCase().includes(kw)
  );

  if (hasVideo) {
    return isEditIntent
      ? 'fal-ai/kling-video/o1/video-to-video/edit'
      : 'fal-ai/kling-video/o1/video-to-video/reference';
  }

  if (hasElements) {
    return 'fal-ai/kling-video/o1/reference-to-video';
  }

  if (hasImages) {
    const hasTaggedImages = inputs.some(
      i => i.nodeType === 'image' && i.tag?.startsWith('@Image')
    );

    if (hasTaggedImages) {
      return 'fal-ai/kling-video/o1/reference-to-video';
    }

    return 'fal-ai/kling-video/o1/image-to-video';
  }

  throw new Error('No valid inputs connected to prompt node');
}
```

## Tag Parsing

```typescript
/**
 * Tag Parsing Utilities
 */

const TAG_REGEX = {
  image: /@Image(\d+)/g,
  element: /@Element(\d+)/g,
  video: /@Video(\d+)/g,
};

export function parseTags(prompt: string): TagMatch[] {
  const matches: TagMatch[] = [];

  for (const [type, regex] of Object.entries(TAG_REGEX)) {
    let match;
    const re = new RegExp(regex.source, 'g');

    while ((match = re.exec(prompt)) !== null) {
      matches.push({
        tag: match[0],
        type: type as TagType,
        index: parseInt(match[1], 10),
        startPosition: match.index,
        endPosition: match.index + match[0].length,
      });
    }
  }

  return matches.sort((a, b) => a.startPosition - b.startPosition);
}

export function validateTags(
  tags: TagMatch[],
  connectedNodes: ConnectedInput[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const tag of tags) {
    const hasConnection = connectedNodes.some(
      node => node.tag === tag.tag
    );

    if (!hasConnection) {
      missing.push(tag.tag);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
```
