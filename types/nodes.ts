import type { Node, Edge } from '@xyflow/react';

// ============================================================================
// CORE ENUMS & CONSTANTS
// ============================================================================

export type NodeType = 'prompt' | 'image' | 'video' | 'element' | 'output' | 'camera' | 'lighting' | 'audio';

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
  /** Organizational hashtags (stored without '#' prefix) */
  hashtags?: string[];
}

export interface PromptNodeData extends BaseNodeData {
  prompt: string;
  mode: PromptMode;
  // Video-specific settings (Seedance 2.5)
  duration: VideoDuration;
  aspectRatio: VideoAspectRatio; // text-to-video and reference-to-video only
  videoResolution: VideoResolution;
  generateAudio: boolean; // Same price with or without audio
  // Image-specific settings (GPT Image 2.6)
  imageAspectRatio: '21:9' | '16:9' | '3:2' | '4:3' | '5:4' | '1:1' | '4:5' | '3:4' | '2:3' | '9:16';
  imageResolution: '1K' | '2K' | '4K';
  // Generation state
  status: GenerationStatus;
  progress: number;
  error?: string;
  selectedModel?: GenerationModel;
  connectedInputs: ConnectedInput[];
  // Chain generation state
  chainId?: string;
  chainStepIndex?: number;
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
  // Character generation state
  isGeneratingCharacter?: boolean;
  characterGenerationError?: string;
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
  // Generated reference images (from character generation, not from connections)
  // These are preserved by syncElementConnections and merged with connected references
  generatedReferenceUrls?: string[];
  generatedReferenceThumbnails?: string[];
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
  // Character generation state (for image references)
  isGeneratingCharacter?: boolean;
  characterGenerationError?: string;
  // Chain generation state
  isPlaceholder?: boolean; // true = ghost node awaiting generation
  chainId?: string;
  chainStepIndex?: number;
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

export interface AudioNodeData extends BaseNodeData {
  audioUrl: string; // blob URL for preview
  fileName: string;
  fileSize: number;
  duration: number; // audio duration in seconds
  isHighlighted: boolean;
  highlightColor?: string;
  file?: File; // Original file for generation (uploaded to fal.ai)
  // Background upload state
  uploadStatus?: UploadStatus;
  remoteUrl?: string; // fal.ai URL after upload
  uploadError?: string;
}

export type NovaNodeData =
  | PromptNodeData
  | ImageNodeData
  | VideoNodeData
  | ElementNodeData
  | OutputNodeData
  | CameraNodeData
  | LightingNodeData
  | AudioNodeData;

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
export type AudioNode = Node<AudioNodeData & Record<string, unknown>, 'audio'>;

export type NovaNode =
  | PromptNode
  | ImageNode
  | VideoNode
  | ElementNode
  | OutputNode
  | CameraNode
  | LightingNode
  | AudioNode;

// ============================================================================
// EDGE TYPES
// ============================================================================

export interface NovaEdgeData {
  tag?: string;
  color?: string;
  animated?: boolean;
  /** Whether this edge is part of a chain (output → next prompt) */
  isChainEdge?: boolean;
  /** Chain ID this edge belongs to */
  chainId?: string;
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
  suggestedModel?: VideoModel;
}

// ============================================================================
// GENERATION TYPES
// ============================================================================

/** Durations offered in the UI (subset of Seedance's "4".."30" string enum). */
export type VideoDuration = '4' | '5' | '6' | '8' | '10' | '12' | '15';

export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';

export type VideoResolution = '480p' | '720p' | '1080p';

export type VideoModel =
  | 'bytedance/seedance-2.5/us/text-to-video'
  | 'bytedance/seedance-2.5/us/image-to-video'
  | 'bytedance/seedance-2.5/us/reference-to-video';

export type ImageModel =
  | 'openai/gpt-image-2.6/sunburst/text-to-image'
  | 'openai/gpt-image-2.6/sunburst/edit';

export type AudioToVideoModel =
  | 'lightricks/ltx-2.5/audio-to-video/pro'
  | 'lightricks/ltx-2.5/audio-to-video/fast';

export type GenerationModel = VideoModel | ImageModel | AudioToVideoModel;

export interface GenerationMetadata {
  promptUsed: string;
  modelUsed: GenerationModel;
  inputNodes: string[];
  duration?: number; // Video only
  aspectRatio: string;
  resolution?: string; // Image only
  generateAudio?: boolean; // Seedance video only
  createdAt: Date;
  requestId: string;
  /** fal.ai cost in USD for this output (billed to the user's own fal.ai account) */
  cost: number;
  /** How the cost was computed, e.g. "5s × $0.473/s (720p)" */
  costBreakdown?: string;
  /** true when fal bills by tokens and the cost is an estimate */
  costIsEstimate?: boolean;
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

// ============================================================================
// ASSET TYPES (Saved items in Asset Sidebar)
// ============================================================================

export type AssetType = 'board' | 'character' | 'scene';

/**
 * Serialized node for storage (no File objects, dates as strings)
 */
export interface SerializedNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

/**
 * Saved canvas/project state
 */
export interface SavedBoard {
  id: string;
  name: string;
  thumbnail?: string; // First output image or placeholder
  nodes: SerializedNode[];
  edges: NovaEdge[];
  createdAt: string; // ISO date string for storage
  updatedAt: string;
}

/**
 * Saved character/object for reuse
 */
export interface SavedCharacter {
  id: string;
  name: string;
  elementType: ElementType;
  frontalImageUrl: string; // Remote URL (must be uploaded)
  frontalThumbnail: string;
  referenceImageUrls: string[];
  referenceThumbnails: string[];
  createdAt: string;
}

/**
 * Saved scene image reference
 */
export interface SavedScene {
  id: string;
  name: string;
  imageUrl: string; // Remote URL
  thumbnailUrl: string;
  category?: string;
  createdAt: string;
}

/**
 * Asset drag data format for drag-and-drop
 */
export interface AssetDragData {
  type: AssetType;
  id: string;
}
