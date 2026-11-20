import type { Node, Edge } from '@xyflow/react';
import type {
  AudioKind,
  GenerationModel,
  MusicModelId,
  SoundModelId,
  SpeechModelId,
  ImageAspectRatio,
  ImageModelId,
  ImageResolution,
  LipSyncModelId,
  LipSyncResolution,
  ModelCategory,
  VideoModelId,
} from './models';

// ============================================================================
// CORE ENUMS & CONSTANTS
// ============================================================================

export type NodeType = 'prompt' | 'image' | 'video' | 'element' | 'output' | 'camera' | 'lighting' | 'audio';

export type TagType = 'image' | 'element' | 'video';

export type PromptMode = 'video' | 'image' | 'audio';

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

// ============================================================================
// TIMELINE
// ============================================================================

/**
 * A node shown on the timeline is one layer (track). The layer lives on the node itself,
 * so it syncs, persists and is deleted together with the node.
 */
export interface TimelineLayer {
  enabled: boolean;
  /** Stacking order: higher draws on top (V2 over V1). */
  order: number;
  /** Where the clip starts on the timeline, seconds. */
  start: number;
  /** Seconds cut from the head / tail of the source media. */
  trimStart: number;
  trimEnd: number;
  /** Clip length for stills (images), seconds. */
  stillDuration: number;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
  solo: boolean;
  /** 0–1, preview mix. */
  volume: number;
}

export interface BaseNodeData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  /** Organizational hashtags (stored without '#' prefix) */
  hashtags?: string[];
  /** Present once the node has been put on the timeline. */
  timeline?: TimelineLayer;
}

export interface PromptNodeData extends BaseNodeData {
  prompt: string;
  mode: PromptMode;
  /** Chosen model per category (defaults: Seedance 2.5, GPT Image 2.6, OmniHuman 2). */
  videoModel?: VideoModelId;
  imageModel?: ImageModelId;
  lipSyncModel?: LipSyncModelId;
  // Video settings (coerced to what the chosen model supports at generation time)
  duration: VideoDuration;
  aspectRatio: VideoAspectRatio;
  videoResolution: VideoResolution;
  generateAudio: boolean;
  // Lip-sync settings
  lipSyncResolution?: LipSyncResolution;
  // Audio mode (speech / sound / music), each with its own model choice
  audioKind?: AudioKind;
  speechModel?: SpeechModelId;
  soundModel?: SoundModelId;
  musicModel?: MusicModelId;
  /** Speech voice (preset name of the chosen speech model). */
  voice?: string;
  /** Requested length for models that take one (sound effects, ElevenLabs/MiniMax music). */
  audioSeconds?: number;
  /** Song lyrics (structure tags like [verse] / [chorus] allowed). */
  lyrics?: string;
  instrumental?: boolean;
  // Image settings
  imageAspectRatio: ImageAspectRatio;
  imageResolution: ImageResolution;
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
  /** View name per generated reference ("three-quarter", "side", "back", "face"). */
  generatedReferenceLabels?: string[];
  /**
   * Identity lock: a short description of the character's fixed appearance, added to every
   * prompt that references this element so all models keep the same face, hair and outfit.
   */
  appearance?: string;
  isDescribing?: boolean;
  /** fal cost of the generated turnaround */
  generationMetadata?: GenerationMetadata;
  /** Turnaround generation state */
  isGeneratingCharacter?: boolean;
  characterGenerationError?: string;
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
  /** 'start_frame': an image output used as the first frame of image-to-video */
  role: 'output' | 'reference' | 'start_frame';
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
  /** Set when the audio was generated (speech, sound or music) */
  generationMetadata?: GenerationMetadata;
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
  suggestedModel?: GenerationModel;
}

// ============================================================================
// GENERATION TYPES
// ============================================================================

/** Seconds as a string (Seedance takes a string enum; other models get the number). */
export type VideoDuration = `${number}`;

export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';

export type VideoResolution = '360p' | '480p' | '720p' | '1080p' | '4k';

export type { GenerationModel, ModelCategory };

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
  /** Category and model picked on the prompt node */
  category?: ModelCategory;
  modelLabel?: string;
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
