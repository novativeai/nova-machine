// fal.ai endpoint contracts. Field names, optionality and JSON types mirror each endpoint's
// OpenAPI schema (https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id>), checked 2026-11-19.

// ============================================================================
// GPT IMAGE 2.6 (openai/gpt-image-2.6/sunburst/text-to-image | /edit)
// ============================================================================

/** Explicit size: both edges multiples of 16, max edge 3840, ratio <= 3:1, 655,360–8,294,400 px. */
export interface GptImageSize {
  width: number;
  height: number;
}

export type GptImageSizePreset =
  | 'square_hd'
  | 'square'
  | 'portrait_4_3'
  | 'portrait_16_9'
  | 'landscape_4_3'
  | 'landscape_16_9'
  | 'auto';

export type GptImageQuality = 'auto' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type GptImageOutputFormat = 'jpeg' | 'png' | 'webp';

export interface GptImageTextToImageInput {
  prompt: string;
  image_size?: GptImageSize | GptImageSizePreset;
  quality?: GptImageQuality;
  num_images?: number; // 1–10
  output_format?: GptImageOutputFormat;
  background?: 'auto' | 'transparent' | 'opaque';
}

export interface GptImageEditInput {
  prompt: string;
  image_urls: string[]; // 1–16
  image_size?: GptImageSize | GptImageSizePreset; // 'auto' infers from the inputs
  quality?: GptImageQuality;
  num_images?: number; // 1–10
  output_format?: GptImageOutputFormat;
  background?: 'auto' | 'transparent' | 'opaque';
}

export type ImageGenerationInput = GptImageTextToImageInput | GptImageEditInput;

export interface FalImageFile {
  url: string;
  content_type?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface ImageGenerationOutput {
  images: FalImageFile[];
}

// ============================================================================
// SEEDANCE 2.5 (bytedance/seedance-2.5/us/{text,image,reference}-to-video)
// ============================================================================

/** Seedance takes duration as a STRING enum: "auto" or "4".."30". */
export type SeedanceDuration =
  | 'auto' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | '14' | '15'
  | '16' | '17' | '18' | '19' | '20' | '21' | '22' | '23' | '24' | '25' | '26' | '27'
  | '28' | '29' | '30';

export type SeedanceResolution = '480p' | '720p' | '1080p' | '4k';

export type SeedanceAspectRatio = 'auto' | '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16';

export interface SeedanceTextToVideoInput {
  prompt: string;
  duration?: SeedanceDuration;
  resolution?: SeedanceResolution;
  aspect_ratio?: SeedanceAspectRatio;
  generate_audio?: boolean;
}

/** aspect_ratio is a const "auto" for image-to-video, so it is not sent. */
export interface SeedanceImageToVideoInput {
  image_url: string;
  end_image_url?: string;
  prompt?: string;
  duration?: SeedanceDuration;
  resolution?: SeedanceResolution;
  generate_audio?: boolean;
}

/**
 * Prompt refers to media as @Image1.., @Video1.., @Audio1.. by array position.
 * Limits: 30 images, 10 videos, 10 audios, 50 files total; videos/audios 1.8–30.2 s each and combined.
 * task 'editing' coerces aspect_ratio and duration to auto.
 */
export interface SeedanceReferenceToVideoInput {
  prompt: string;
  image_urls?: string[];
  video_urls?: string[];
  audio_urls?: string[];
  task?: 'auto' | 'reference' | 'editing' | 'extension';
  duration?: SeedanceDuration;
  resolution?: SeedanceResolution;
  aspect_ratio?: SeedanceAspectRatio;
  generate_audio?: boolean;
}

export type VideoGenerationInput =
  | SeedanceTextToVideoInput
  | SeedanceImageToVideoInput
  | SeedanceReferenceToVideoInput;

export interface FalVideoFile {
  url: string;
  content_type?: string | null;
  file_name?: string | null;
  file_size?: number | null;
}

export interface VideoGenerationOutput {
  video: FalVideoFile;
  seed?: number;
}

// ============================================================================
// LTX 2.5 AUDIO-TO-VIDEO (lightricks/ltx-2.5/audio-to-video/{pro,fast})
// ============================================================================

/**
 * Video length follows the audio. Audio 2–20 s (pro: max 10 s).
 * prompt is required when image_url is not provided.
 */
export interface LtxAudioToVideoInput {
  audio_url: string;
  image_url?: string;
  prompt?: string;
  aspect_ratio?: 'auto' | '16:9' | '9:16';
}

export interface LtxAudioToVideoOutput {
  video: FalVideoFile & {
    width?: number | null;
    height?: number | null;
    duration?: number | null;
    fps?: number | null;
    num_frames?: number | null;
  };
}

// ============================================================================
// FAL.AI RESPONSE TYPES
// ============================================================================

export interface FalQueueUpdate {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  logs?: Array<{ message: string }>;
}

export interface FalSubscribeResult<T> {
  data: T;
  requestId: string;
}

// ============================================================================
// FILE UPLOAD TYPES
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