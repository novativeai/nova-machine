import { fal } from '@fal-ai/client';
import type {
  KlingModel,
  KlingInput,
  KlingOutput,
  KlingImageToVideoInput,
  KlingReferenceToVideoInput,
  KlingVideoToVideoEditInput,
  KlingVideoToVideoReferenceInput,
  NanoBananaModel,
  NanoBananaInput,
  NanoBananaOutput,
  GenerationModel,
  FalQueueUpdate,
} from '@/types';

// Configure fal client to use proxy for client-side usage
fal.config({
  proxyUrl: '/api/fal/proxy',
});

export interface GenerateVideoOptions {
  model: KlingModel;
  input: KlingInput;
  onQueueUpdate?: (update: FalQueueUpdate) => void;
}

export interface GenerateVideoResult {
  success: boolean;
  data?: KlingOutput;
  requestId?: string;
  error?: string;
}

/**
 * Generate a video using the specified KLing model
 */
export async function generateVideo(
  options: GenerateVideoOptions
): Promise<GenerateVideoResult> {
  const { model, input, onQueueUpdate } = options;

  // Log the full input being sent to fal.ai
  console.log('[FAL Client] Sending to model:', model);
  console.log('[FAL Client] Input payload:', JSON.stringify(input, null, 2));

  try {
    const result = await fal.subscribe(model, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (onQueueUpdate) {
          onQueueUpdate({
            status: update.status,
            logs: 'logs' in update ? update.logs : undefined,
          });
        }
      },
    });

    return {
      success: true,
      data: result.data as KlingOutput,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error('Video generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

export interface GenerateImageOptions {
  model: NanoBananaModel;
  input: NanoBananaInput;
  onQueueUpdate?: (update: FalQueueUpdate) => void;
}

export interface GenerateImageResult {
  success: boolean;
  data?: NanoBananaOutput;
  requestId?: string;
  error?: string;
}

/**
 * Generate an image using the specified Nano Banana Pro model
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  const { model, input, onQueueUpdate } = options;

  // Log the full input being sent to fal.ai
  console.log('[FAL Client] Sending to image model:', model);
  console.log('[FAL Client] Image input payload:', JSON.stringify(input, null, 2));

  try {
    const result = await fal.subscribe(model, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        console.log('[FAL Client] Queue update:', JSON.stringify(update, null, 2));
        if (onQueueUpdate) {
          onQueueUpdate({
            status: update.status,
            logs: 'logs' in update ? update.logs : undefined,
          });
        }
      },
    });

    console.log('[FAL Client] Image generation result:', JSON.stringify(result, null, 2));
    return {
      success: true,
      data: result.data as NanoBananaOutput,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error('[FAL Client] Image generation failed:', error);
    // Log full error details for debugging
    if (error && typeof error === 'object') {
      console.error('[FAL Client] Error object keys:', Object.keys(error));
      console.error('[FAL Client] Error details:', JSON.stringify(error, null, 2));
      if ('body' in error) {
        console.error('[FAL Client] Error body:', JSON.stringify((error as { body: unknown }).body, null, 2));
      }
      if ('status' in error) {
        console.error('[FAL Client] Error status:', (error as { status: unknown }).status);
      }
      if ('message' in error) {
        console.error('[FAL Client] Error message:', (error as { message: unknown }).message);
      }
    }

    // Extract error message from various possible formats
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object') {
      if ('message' in error && typeof (error as { message: string }).message === 'string') {
        errorMessage = (error as { message: string }).message;
      } else if ('body' in error) {
        const body = (error as { body: unknown }).body;
        if (body && typeof body === 'object' && 'detail' in body) {
          errorMessage = String((body as { detail: unknown }).detail);
        }
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// FILE UPLOAD
// ============================================================================

/**
 * Upload a file to fal.ai storage via dedicated server-side upload route
 * This bypasses the proxy to handle large files
 */
export async function uploadFile(file: File): Promise<string> {
  console.log('[Upload] Starting upload for:', file.name, 'Size:', file.size);

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/fal/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  const { url } = await response.json();
  console.log('[Upload] Upload complete:', url);
  return url;
}

// ============================================================================
// PRICING
// ============================================================================

/**
 * Video model pricing per second
 */
export const VIDEO_MODEL_PRICING: Record<KlingModel, number> = {
  'fal-ai/kling-video/o1/image-to-video': 0.112,
  'fal-ai/kling-video/o1/reference-to-video': 0.112,
  'fal-ai/kling-video/o1/video-to-video/edit': 0.168,
  'fal-ai/kling-video/o1/video-to-video/reference': 0.168,
};

/**
 * Image model pricing per image (base rate for 1K, 4K is double)
 */
export const IMAGE_MODEL_PRICING: Record<NanoBananaModel, { base: number; '4K': number }> = {
  'fal-ai/nano-banana-pro': { base: 0.15, '4K': 0.30 },
  'fal-ai/nano-banana-pro/edit': { base: 0.15, '4K': 0.30 },
};

// Legacy export for backward compatibility
export const MODEL_PRICING = VIDEO_MODEL_PRICING;

/**
 * Calculate estimated cost for video generation
 */
export function calculateVideoCost(model: KlingModel, durationSeconds: number): number {
  return VIDEO_MODEL_PRICING[model] * durationSeconds;
}

/**
 * Calculate estimated cost for image generation
 */
export function calculateImageCost(model: NanoBananaModel, resolution: '1K' | '2K' | '4K' = '1K'): number {
  const pricing = IMAGE_MODEL_PRICING[model];
  return resolution === '4K' ? pricing['4K'] : pricing.base;
}

/**
 * Calculate estimated cost for generation (legacy support)
 */
export function calculateCost(model: KlingModel, durationSeconds: number): number {
  return calculateVideoCost(model, durationSeconds);
}

/**
 * Type guards for input types
 */
export function isImageToVideoInput(
  input: KlingInput
): input is KlingImageToVideoInput {
  return 'start_image_url' in input;
}

export function isReferenceToVideoInput(
  input: KlingInput
): input is KlingReferenceToVideoInput {
  return 'image_urls' in input || 'elements' in input;
}

export function isVideoToVideoEditInput(
  input: KlingInput
): input is KlingVideoToVideoEditInput {
  return 'video_url' in input && !('duration' in input);
}

export function isVideoToVideoReferenceInput(
  input: KlingInput
): input is KlingVideoToVideoReferenceInput {
  return 'video_url' in input && 'duration' in input;
}
