import { fal } from '@fal-ai/client';
import type {
  FalQueueUpdate,
  ImageEndpoint,
  ImageGenerationInput,
  ImageGenerationOutput,
  LipSyncEndpoint,
  LipSyncInput,
  LipSyncOutput,
  VideoEndpoint,
  VideoGenerationInput,
  VideoGenerationOutput,
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
  model: VideoEndpoint;
  input: VideoGenerationInput;
  onQueueUpdate?: (update: FalQueueUpdate) => void;
}): Promise<FalRunResult<VideoGenerationOutput>> {
  return runFal<VideoGenerationInput, VideoGenerationOutput>(options.model, options.input, options.onQueueUpdate);
}

export function generateImage(options: {
  model: ImageEndpoint;
  input: ImageGenerationInput;
  onQueueUpdate?: (update: FalQueueUpdate) => void;
}): Promise<FalRunResult<ImageGenerationOutput>> {
  return runFal<ImageGenerationInput, ImageGenerationOutput>(options.model, options.input, options.onQueueUpdate);
}

export function generateLipSync(options: {
  model: LipSyncEndpoint;
  input: LipSyncInput;
  onQueueUpdate?: (update: FalQueueUpdate) => void;
}): Promise<FalRunResult<LipSyncOutput>> {
  return runFal<LipSyncInput, LipSyncOutput>(options.model, options.input, options.onQueueUpdate);
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

export type CharacterView = 'three-quarter' | 'side' | 'back' | 'face';

/** Turnaround views generated for every character: the identity references all models receive. */
export const CHARACTER_VIEWS: readonly CharacterView[] = ['three-quarter', 'side', 'back', 'face'];

const VIEW_DESCRIPTIONS: Record<CharacterView, string> = {
  'three-quarter': 'Three-quarter front view of the same character, full body',
  side: 'Side profile view of the same character, full body',
  back: 'Back view of the same character, full body',
  face: 'Close-up portrait of the same character facing the camera, head and shoulders, mouth relaxed and clearly visible',
};

/** Prompt for one turnaround view. */
export function characterViewPrompt(view: CharacterView): string {
  return `${VIEW_DESCRIPTIONS[view]}. Identical face, hairstyle, skin tone, body shape, clothing, colors and accessories; same art style; neutral pose; plain light-grey studio background; no text.`;
}

/**
 * Character turnaround from one image with GPT Image 2.6 edit (the most faithful editor):
 * three-quarter, side, back and face close-up, in that order. Throws if any view fails.
 */
export async function generateCharacterViews(imageUrl: string): Promise<Array<{ view: CharacterView; url: string }>> {
  const results = await Promise.all(
    CHARACTER_VIEWS.map((view) =>
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
      }).then((result) => ({ view, result }))
    )
  );
  const failed = results.find(({ result }) => !result.data?.images[0]?.url);
  if (failed) throw new Error(failed.result.error || `Failed to generate the ${failed.view} view`);
  return results.map(({ view, result }) => ({ view, url: result.data!.images[0].url }));
}
