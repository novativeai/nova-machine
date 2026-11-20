// fal.ai endpoint contracts. Field names, optionality and JSON types mirror each endpoint's
// OpenAPI schema (https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id>), checked 2026-11-20.

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

export type GptImageInput = GptImageTextToImageInput | GptImageEditInput;

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
// SEEDANCE 2.5 (bytedance/seedance-2.5/{us,flash}/{text,image,reference}-to-video; Flash: 480p/720p)
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

export type SeedanceInput =
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
// KLING 4 (kling/v4/{text,image,reference}-to-video)
// ============================================================================

export type KlingAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';

export interface KlingTextToVideoInput {
  prompt: string;
  duration?: number; // 3–30
  resolution?: '720p' | '1080p';
  aspect_ratio?: KlingAspectRatio;
}

/** aspect_ratio is not part of the image-to-video schema (the frame sets it). */
export interface KlingImageToVideoInput {
  start_image_url: string;
  end_image_url?: string;
  prompt?: string;
  duration?: number;
  resolution?: '720p' | '1080p';
}

/** A character/object referenced as @ElementN (max 7). */
export interface KlingElement {
  frontal_image_url: string;
  reference_image_urls?: string[];
}

/**
 * @Image1.. → image_urls (max 10, start/end frames count toward it), @Video1.. → video_urls
 * (max 5, 3–30 s each, 30 s combined), @Element1.. → elements (max 7).
 */
export interface KlingReferenceToVideoInput {
  prompt: string;
  image_urls?: string[];
  video_urls?: string[];
  elements?: KlingElement[];
  start_image_url?: string;
  end_image_url?: string;
  duration?: number;
  resolution?: '720p' | '1080p';
  aspect_ratio?: KlingAspectRatio | 'auto';
}

// ============================================================================
// GEMINI OMNI FLASH 1.2 (google/gemini-omni-flash/v1.2/*) — native audio always on
// ============================================================================

export type GeminiOmniResolution = '360p' | '720p' | '1080p' | '4k';

export interface GeminiOmniTextToVideoInput {
  prompt: string;
  duration?: number; // 3–15
  resolution?: GeminiOmniResolution;
  aspect_ratio?: '16:9' | '9:16';
}

/** At most 10 s when end_image_url is set. */
export interface GeminiOmniImageToVideoInput extends GeminiOmniTextToVideoInput {
  image_url: string;
  end_image_url?: string;
}

/** Media is sent in list order before the prompt (no @ tags): up to 10 images, 3 videos ≤ 15 s. */
export interface GeminiOmniReferenceToVideoInput extends GeminiOmniTextToVideoInput {
  image_urls?: string[];
  reference_video_urls?: string[];
}

// ============================================================================
// VEO 3.1 (fal-ai/veo3.1, /image-to-video, /first-last-frame-to-video, /reference-to-video)
// ============================================================================

export type VeoDuration = '4s' | '6s' | '8s';
export type VeoResolution = '720p' | '1080p' | '4k';

export interface VeoTextToVideoInput {
  prompt: string;
  duration?: VeoDuration;
  resolution?: VeoResolution;
  aspect_ratio?: '16:9' | '9:16';
  generate_audio?: boolean;
}

export interface VeoImageToVideoInput {
  prompt: string;
  image_url: string;
  duration?: VeoDuration;
  resolution?: VeoResolution;
  aspect_ratio?: 'auto' | '16:9' | '9:16';
  generate_audio?: boolean;
}

export interface VeoFirstLastFrameInput {
  prompt: string;
  first_frame_url: string;
  last_frame_url: string;
  duration?: VeoDuration;
  resolution?: VeoResolution;
  aspect_ratio?: 'auto' | '16:9' | '9:16';
  generate_audio?: boolean;
}

/** Subject-consistency references; duration is the const "8s". */
export interface VeoReferenceToVideoInput {
  prompt: string;
  image_urls: string[];
  resolution?: VeoResolution;
  aspect_ratio?: '16:9' | '9:16';
  generate_audio?: boolean;
}

// ============================================================================
// IMAGE MODELS: NANO BANANA 2.1, FLUX 3, SEEDREAM 5.5
// ============================================================================

export interface NanoBananaInput {
  prompt: string;
  image_urls?: string[]; // edit endpoint only
  resolution?: '1K' | '2K' | '4K';
  aspect_ratio?: string; // 'auto' or a ratio from the schema enum
  num_images?: number; // 1–4
  output_format?: 'jpeg' | 'png' | 'webp';
}

export interface Flux3Input {
  prompt: string;
  image_urls?: string[]; // edit-image only, 1–10, image 1..10 order
  aspect_ratio?: string;
  resolution?: '768sq' | '1k' | '1.5k' | '2k' | '4k';
  output_format?: 'jpeg' | 'png';
}

export interface SeedreamInput {
  prompt: string;
  image_urls?: string[]; // edit only, up to 10
  image_size?: GptImageSize | 'auto_1K' | 'auto_1.5K' | 'auto_2K';
  num_images?: number; // 1–6
  output_format?: 'jpeg' | 'png';
}

// ============================================================================
// LIP-SYNC (audio drives the mouth)
// ============================================================================

/** Audio wav/mp3, ≤ 15 MB, 4–300 s. */
export interface OmniHumanInput {
  image_url: string;
  audio_url: string;
  prompt?: string;
}

export interface HeyGenAvatarInput {
  image_url: string;
  audio_url: string;
  motion_prompt?: string;
  resolution?: '1080p' | '2k';
}

/** Audio ≥ 5 s, up to 15 min. */
export interface MiniMaxLipSyncInput {
  image_url: string;
  audio_url: string;
  resolution?: '480P' | '768P' | '1080P' | '2K';
}

export interface SyncImageToVideoInput {
  image_url: string;
  audio_url: string;
}

export type SyncMode = 'cut_off' | 'loop' | 'bounce' | 'silence' | 'remap';

export interface SyncVideoInput {
  video_url: string;
  audio_url: string;
  sync_mode?: SyncMode;
  options?: {
    /** Lip-sync only the person matching this face when several are in frame. */
    active_speaker_detection?: { face_image?: string; auto_detect?: boolean };
  };
}

export interface VeedLipSyncInput {
  video_url: string;
  audio_url: string;
}

export interface LipSyncOutput {
  video: FalVideoFile;
  duration?: number;
}

// ============================================================================
// AUDIO GENERATION (speech, sound, music)
// ============================================================================

/** $0.08 / 1K characters. Audio tags like [whispering] are supported in text. */
export interface ElevenTtsInput {
  text: string;
  voice?: string;
  stability?: number;
  output_format?: 'mp3_44100_128';
}

/** $0.045 / 1K characters. Delivery direction goes in style_instructions, not the transcript. */
export interface GeminiTtsInput {
  prompt: string;
  voice?: string;
  style_instructions?: string;
}

/** Speech + sound effects + ambience from one prompt. $0.1875 / output minute. */
export interface SeedAudioInput {
  prompt: string;
  output_format?: 'wav' | 'mp3';
  sample_rate?: 44100 | 48000;
}

/** 0.5–30 s; omit duration to let the model choose. */
export interface ElevenSfxInput {
  text: string;
  duration_seconds?: number;
  output_format?: 'mp3_44100_128';
}

/** Full songs up to a few minutes; length is set in the prompt. $0.10 per generation. */
export interface LyriaInput {
  prompt: string;
}

/** $0.60 per output minute, rounded up. Length 3–600 s via music_length_ms. */
export interface ElevenMusicInput {
  prompt: string;
  music_length_ms?: number;
  force_instrumental?: boolean;
  output_format?: 'mp3_44100_128';
}

/** Lyrics required; duration is an upper bound (1–300 s). */
export interface MiniMaxMusicInput {
  prompt: string;
  lyrics: string;
  duration?: number;
}

export type AudioGenerationInput =
  | ElevenTtsInput
  | GeminiTtsInput
  | SeedAudioInput
  | ElevenSfxInput
  | LyriaInput
  | ElevenMusicInput
  | MiniMaxMusicInput;

export interface FalAudioFile {
  url: string;
  content_type?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  duration?: number | null;
}

export interface AudioGenerationOutput {
  audio: FalAudioFile;
  duration?: number;
  lyrics?: string | null;
}

// ============================================================================
// FFMPEG UTILITIES (timeline export)
// ============================================================================

export interface ComposeKeyframe {
  url: string;
  timestamp: number; // ms
  duration: number; // ms
}

export interface ComposeTrack {
  id: string;
  type: 'video' | 'audio' | 'image';
  keyframes: ComposeKeyframe[];
}

/** Exactly one visual track; any number of audio tracks. */
export interface ComposeInput {
  tracks: ComposeTrack[];
}

export interface ComposeOutput {
  video_url: string;
  thumbnail_url: string;
}

/** Concatenate videos in order (min 2). Resolution edges 512–2048. */
export interface MergeVideosInput {
  video_urls: string[];
  target_fps?: number;
  resolution?: { width: number; height: number };
}

/** Lay an audio file onto a video as its sound track. */
export interface MergeAudioVideoInput {
  video_url: string;
  audio_url: string;
  start_offset?: number;
}

export interface ImagesToVideoInput {
  images: Array<{ url: string; frames: number }>;
  fps?: number;
}

export interface TrimVideoInput {
  video_url: string;
  start_time: number;
  duration?: number;
}

export interface TrimVideoOutput {
  video: FalVideoFile;
  trimmed_duration?: number;
  original_duration?: number;
}

// ============================================================================
// REQUEST UNIONS
// ============================================================================

export type VideoGenerationInput =
  | SeedanceInput
  | KlingTextToVideoInput
  | KlingImageToVideoInput
  | KlingReferenceToVideoInput
  | GeminiOmniTextToVideoInput
  | GeminiOmniImageToVideoInput
  | GeminiOmniReferenceToVideoInput
  | VeoTextToVideoInput
  | VeoImageToVideoInput
  | VeoFirstLastFrameInput
  | VeoReferenceToVideoInput;

export type ImageGenerationInput = GptImageInput | NanoBananaInput | Flux3Input | SeedreamInput;

export type LipSyncInput =
  | OmniHumanInput
  | HeyGenAvatarInput
  | MiniMaxLipSyncInput
  | SyncImageToVideoInput
  | SyncVideoInput
  | VeedLipSyncInput;

export type UtilityInput = ComposeInput | MergeVideosInput | MergeAudioVideoInput | ImagesToVideoInput | TrimVideoInput;

export type FalInput = VideoGenerationInput | ImageGenerationInput | LipSyncInput | AudioGenerationInput | UtilityInput;

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