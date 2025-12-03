// ============================================================================
// NANO BANANA PRO API TYPES
// ============================================================================

export interface NanoBananaTextToImageInput {
  prompt: string;
  num_images?: number;
  aspect_ratio?: '21:9' | '16:9' | '3:2' | '4:3' | '5:4' | '1:1' | '4:5' | '3:4' | '2:3' | '9:16';
  resolution?: '1K' | '2K' | '4K';
  output_format?: 'jpeg' | 'png' | 'webp';
  sync_mode?: boolean;
}

export interface NanoBananaImageEditInput {
  prompt: string;
  image_urls: string[];
  num_images?: number;
  aspect_ratio?: 'auto' | '21:9' | '16:9' | '3:2' | '4:3' | '5:4' | '1:1' | '4:5' | '3:4' | '2:3' | '9:16';
  resolution?: '1K' | '2K' | '4K';
  output_format?: 'jpeg' | 'png' | 'webp';
  sync_mode?: boolean;
}

export type NanoBananaInput = NanoBananaTextToImageInput | NanoBananaImageEditInput;

export interface NanoBananaImageFile {
  url: string;
  content_type: string;
  file_name: string;
  file_size: number;
  width: number;
  height: number;
}

export interface NanoBananaOutput {
  images: NanoBananaImageFile[];
  description?: string;
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
