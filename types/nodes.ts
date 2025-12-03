import type { Node, Edge } from '@xyflow/react';

// ============================================================================
// CORE ENUMS & CONSTANTS
// ============================================================================

export type NodeType = 'prompt' | 'image' | 'video' | 'element' | 'output' | 'camera' | 'lighting';

export type TagType = 'image' | 'element' | 'video';

export type PromptMode = 'video' | 'image';

export type MediaRole =
  | 'reference'
  | 'start_frame'
  | 'end_frame'
  | 'element'
  | 'edit_source'
  | 'output';

export type GenerationStatus =
  | 'idle'
  | 'uploading'
  | 'queued'
  | 'generating'
  | 'completed'
  | 'error';

export type UploadStatus = 'idle' | 'uploading' | 'completed' | 'error';

export const TAG_COLORS: Record<TagType, string> = {
  image: '#3B82F6',
  element: '#EF4444',
  video: '#8B5CF6',
};

// ============================================================================
// TAG TYPES
// ============================================================================

export interface Tag {
  type: TagType;
  index: number;
  label: string;
  color: string;
  nodeId: string;
}

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
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptNodeData extends BaseNodeData {
  prompt: string;
  mode: PromptMode;
  // Video-specific settings
  duration: '5' | '10';
  aspectRatio: '16:9' | '9:16' | '1:1';
  negativePrompt: string;
  cfgScale: number;
  // Image-specific settings
  imageAspectRatio: '21:9' | '16:9' | '3:2' | '4:3' | '5:4' | '1:1' | '4:5' | '3:4' | '2:3' | '9:16';
  imageResolution: '1K' | '2K' | '4K';
  // Generation state
  status: GenerationStatus;
  progress: number;
  error?: string;
  selectedModel?: KlingModel | NanoBananaModel;
  connectedInputs: ConnectedInput[];
}

export interface ImageNodeData extends BaseNodeData {
  imageUrl: string; // blob URL for preview, or remote URL for output nodes
  thumbnailUrl: string;
  fileName: string;
  fileSize: number;
  dimensions: { width: number; height: number };
  role: 'reference' | 'start_frame' | 'end_frame';
  tagAssignment?: string;
  isHighlighted: boolean;
  highlightColor?: string;
  file?: File; // Original file for generation (converted to base64 at generation time)
  // Background upload state
  uploadStatus?: UploadStatus;
  remoteUrl?: string; // fal.ai URL after upload
  uploadError?: string;
}

export interface VideoNodeData extends BaseNodeData {
  videoUrl: string; // blob URL for preview, or remote URL for output nodes
  thumbnailUrl: string;
  fileName: string;
  fileSize: number;
  duration: number;
  dimensions: { width: number; height: number };
  role: 'reference' | 'edit_source' | 'output';
  tagAssignment?: string;
  isHighlighted: boolean;
  highlightColor?: string;
  file?: File; // Original file for generation (converted to base64 at generation time)
  // Background upload state
  uploadStatus?: UploadStatus;
  remoteUrl?: string; // fal.ai URL after upload
  uploadError?: string;
}

export type ElementType = 'character' | 'object';

export interface ElementNodeData extends BaseNodeData {
  name: string;
  elementType: ElementType;
  frontalImageUrl: string; // blob URL for preview
  frontalThumbnail: string;
  referenceImageUrls: string[];
  referenceThumbnails: string[];
  tagAssignment?: string;
  isHighlighted: boolean;
  highlightColor?: string;
  frontalFile?: File; // Original frontal image file
  referenceFiles?: File[]; // Original reference image files
  // Background upload state for frontal image
  frontalUploadStatus?: UploadStatus;
  frontalRemoteUrl?: string; // fal.ai URL after upload
  frontalUploadError?: string;
  // Background upload state for reference images
  referenceUploadStatus?: UploadStatus;
  referenceRemoteUrls?: string[]; // fal.ai URLs after upload
  referenceUploadError?: string;
  // Connected image source tracking (live binding)
  // When images are connected, these IDs track the source nodes.
  // When disconnected (IDs existed but now no connections), images are cleared.
  connectedImageSourceIds?: string[];
}

export interface OutputNodeData extends BaseNodeData {
  outputType: 'video' | 'image';
  // Video fields
  videoUrl?: string;
  videoDuration?: number;
  // Image fields
  imageUrl?: string;
  // Common fields
  thumbnailUrl: string;
  dimensions: { width: number; height: number };
  role: 'output' | 'reference';
  canChain: boolean;
  generationMetadata: GenerationMetadata;
  tagAssignment?: string; // For referencing in prompts when role is 'reference'
  isHighlighted: boolean;
  highlightColor?: string;
}

// Camera angle options - popular Hollywood cinematography styles
export type CameraAngle =
  | 'eye-level'
  | 'low-angle'
  | 'high-angle'
  | 'dutch-angle'
  | 'birds-eye-view'
  | 'worms-eye-view'
  | 'over-the-shoulder'
  | 'point-of-view'
  | 'close-up'
  | 'extreme-close-up'
  | 'wide-shot'
  | 'establishing-shot'
  | 'tracking-shot'
  | 'dolly-zoom';

// Lens length options - common focal lengths
export type LensLength =
  | '14mm'
  | '24mm'
  | '35mm'
  | '50mm'
  | '85mm'
  | '100mm-macro'
  | '135mm'
  | '200mm'
  | '400mm';

// Colorimetry/color grading options - popular Hollywood looks
export type Colorimetry =
  | 'natural'
  | 'black-and-white'
  | 'teal-and-orange'
  | 'vintage-film'
  | 'warm-golden-hour'
  | 'cold-blue'
  | 'neon-cyberpunk'
  | 'muted-desaturated'
  | 'high-contrast'
  | 'pastel-soft'
  | 'sepia';

export interface CameraNodeData extends BaseNodeData {
  cameraAngle: CameraAngle | '';
  lensLength: LensLength | '';
  colorimetry: Colorimetry | '';
}

// Lighting style options - popular cinematography lighting techniques
export type LightingStyle =
  | 'rembrandt'
  | 'butterfly'
  | 'split'
  | 'loop'
  | 'broad'
  | 'short'
  | 'rim'
  | 'backlighting'
  | 'silhouette'
  | 'three-point'
  | 'natural'
  | 'practical'
  | 'motivated'
  | 'soft-diffused'
  | 'hard-dramatic';

// Lighting key/tone options - overall lighting intensity and contrast
export type LightingKey =
  | 'low-key'
  | 'high-key'
  | 'natural-key'
  | 'chiaroscuro'
  | 'flat'
  | 'dramatic'
  | 'moody'
  | 'ethereal'
  | 'noir'
  | 'golden-hour'
  | 'blue-hour';

export interface LightingNodeData extends BaseNodeData {
  lightingStyle: LightingStyle | '';
  lightingKey: LightingKey | '';
}

export type NovaNodeData =
  | PromptNodeData
  | ImageNodeData
  | VideoNodeData
  | ElementNodeData
  | OutputNodeData
  | CameraNodeData
  | LightingNodeData;

// ============================================================================
// REACT FLOW NODE TYPES
// ============================================================================

// React Flow requires data to extend Record<string, unknown>
// Using intersection types to satisfy this constraint while keeping our strict types
export type PromptNode = Node<PromptNodeData & Record<string, unknown>, 'prompt'>;
export type ImageNode = Node<ImageNodeData & Record<string, unknown>, 'image'>;
export type VideoNode = Node<VideoNodeData & Record<string, unknown>, 'video'>;
export type ElementNode = Node<ElementNodeData & Record<string, unknown>, 'element'>;
export type OutputNode = Node<OutputNodeData & Record<string, unknown>, 'output'>;
export type CameraNode = Node<CameraNodeData & Record<string, unknown>, 'camera'>;
export type LightingNode = Node<LightingNodeData & Record<string, unknown>, 'lighting'>;

export type NovaNode =
  | PromptNode
  | ImageNode
  | VideoNode
  | ElementNode
  | OutputNode
  | CameraNode
  | LightingNode;

// ============================================================================
// EDGE TYPES
// ============================================================================

export interface NovaEdgeData {
  tag?: string;
  color?: string;
  animated?: boolean;
}

export type NovaEdge = Edge<NovaEdgeData & Record<string, unknown>>;

// ============================================================================
// CONNECTION TYPES
// ============================================================================

export interface ConnectedInput {
  nodeId: string;
  nodeType: NodeType;
  tag?: string;
  handleId: string;
  outputType?: 'video' | 'image'; // For output nodes converted to reference
  role?: MediaRole; // For image nodes - determines if it's a reference or start/end frame
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

export type NanoBananaModel =
  | 'fal-ai/nano-banana-pro'
  | 'fal-ai/nano-banana-pro/edit';

export type GenerationModel = KlingModel | NanoBananaModel;

export interface GenerationMetadata {
  promptUsed: string;
  modelUsed: GenerationModel;
  inputNodes: string[];
  duration?: number; // Video only
  aspectRatio: string;
  resolution?: string; // Image only
  createdAt: Date;
  requestId: string;
  cost: number;
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
// MODAL TYPES
// ============================================================================

export interface FileRoleModalState {
  isOpen: boolean;
  file: File | null;
  fileType: 'image' | 'video';
  previewUrl: string;
  dropPosition: { x: number; y: number };
  targetNodeId?: string; // If set, update this node instead of creating new
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
    role: 'reference',
    tagPrefix: '@Video',
  },
  {
    id: 'edit_source',
    label: 'Edit Source',
    description: 'Video to edit/transform',
    role: 'edit_source',
  },
];
