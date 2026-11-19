import { fal } from '@fal-ai/client';
import type {
  AudioToVideoModel,
  FalQueueUpdate,
  ImageGenerationInput,
  ImageGenerationOutput,
  ImageModel,
  LtxAudioToVideoInput,
  LtxAudioToVideoOutput,
  VideoGenerationInput,
  VideoGenerationOutput,
  VideoModel,
} from '@/types';
import { formatErrorForDisplay } from './errors';
import { useSettingsStore } from '@/stores/settings-store';

/** Shown whenever an action needs fal.ai but no key is saved. */
export const FAL_KEY_REQUIRED_MESSAGE =
  'Add your fal.ai API key (the key icon in the header) to generate. It is stored only in this browser and sent only to fal.ai.';

/**
 * Point the fal client at the user's own API key.
 * Bring-your-own-key: every fal request goes directly from this browser to fal.ai —
 * the key is never sent to Nova Machine's servers, so there is no server-side fallback key.
 */
export function ensureFalConfig(): void {
  const userApiKey = useSettingsStore.getState().falApiKey;
  if (!userApiKey) throw new Error(FAL_KEY_REQUIRED_MESSAGE);
  fal.config({ credentials: userApiKey });
}

export interface FalRunResult<TOutput> {
  success: boolean;
  data?: TOutput;
  requestId?: string;
  error?: string;
}

/**
 * Submit to a fal queue endpoint and wait for the result.
 */
export async function runFal<TInput extends object, TOutput>(
  endpoint: string,
  input: TInput,
  onQueueUpdate?: (update: FalQueueUpdate) => void
): Promise<FalRunResult<TOutput>> {
  try {
    ensureFalConfig();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : FAL_KEY_REQUIRED_MESSAGE };
  }
  console.log('[FAL Client] Sending to:', endpoint);
  console.log('[FAL Client] Input payload:', JSON.stringify(input, null, 2));

  try {
    const result = await fal.subscribe(endpoint, {
      input: input as Record<string, unknown>,
      logs: true,
      onQueueUpdate: (update) => {
        onQueueUpdate?.({
          status: update.status,
          logs: 'logs' in update ? update.logs : undefined,
        });
      },
    });

    return {
      success: true,
      data: result.data as TOutput,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error(`[FAL Client] ${endpoint} failed:`, error);
    return {
      success: false,
      error: formatErrorForDisplay(error),
    };
  }
}

export function generateVideo(options: {
  model: VideoModel;
  input: VideoGenerationInput;
  onQueueUpdate?: (update: FalQueueUpdate) => void;
}): Promise<FalRunResult<VideoGenerationOutput>> {
  return runFal<VideoGenerationInput, VideoGenerationOutput>(options.model, options.input, options.onQueueUpdate);
}

export function generateImage(options: {
  model: ImageModel;
  input: ImageGenerationInput;
  onQueueUpdate?: (update: FalQueueUpdate) => void;
}): Promise<FalRunResult<ImageGenerationOutput>> {
  return runFal<ImageGenerationInput, ImageGenerationOutput>(options.model, options.input, options.onQueueUpdate);
}

export function generateAudioToVideo(options: {
  model: AudioToVideoModel;
  input: LtxAudioToVideoInput;
  onQueueUpdate?: (update: FalQueueUpdate) => void;
}): Promise<FalRunResult<LtxAudioToVideoOutput>> {
  return runFal<LtxAudioToVideoInput, LtxAudioToVideoOutput>(options.model, options.input, options.onQueueUpdate);
}

// ============================================================================
// FILE UPLOAD
// ============================================================================

/**
 * Upload a file straight from the browser to fal.ai storage with the user's own key.
 * (Used when a background upload didn't produce a URL.)
 */
export async function uploadFile(file: File): Promise<string> {
  ensureFalConfig();
  const url = await fal.storage.upload(file);
  console.log('[Upload] Uploaded to fal.ai storage:', file.name);
  return url;
}

/** Prompt for the side/back turnaround views used to build character elements. */
export function characterViewPrompt(view: 'side' | 'back'): string {
  return `${view === 'side' ? 'Side' : 'Back'} view of the same character, same style and appearance, same clothing and colors, full body, plain background`;
}

/**
 * Generate side + back views of a character from one image with GPT Image 2.6 edit.
 * Returns [sideUrl, backUrl]; throws on failure.
 */
export async function generateCharacterViews(imageUrl: string): Promise<[string, string]> {
  const run = (view: 'side' | 'back') =>
    generateImage({
      model: 'openai/gpt-image-2.6/sunburst/edit',
      input: {
        prompt: characterViewPrompt(view),
        image_urls: [imageUrl],
        image_size: 'auto',
        quality: 'high',
        num_images: 1,
        output_format: 'png',
      },
    });
  const [side, back] = await Promise.all([run('side'), run('back')]);
  const sideUrl = side.data?.images[0]?.url;
  const backUrl = back.data?.images[0]?.url;
  if (!sideUrl || !backUrl) {
    throw new Error(side.error || back.error || 'Failed to generate character views');
  }
  return [sideUrl, backUrl];
}
