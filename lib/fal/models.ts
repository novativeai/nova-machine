// Model catalogue: what each fal.ai model accepts, how inputs route to its endpoints, and
// what fal bills for it. Pure (no browser dependencies) so the UI, the generator and the
// server can share one source of truth. Prices: each endpoint's fal pricing note, 2026-11-20.
import type {
  GenerationModel,
  ImageAspectRatio,
  ImageEndpoint,
  ImageModelId,
  ImageResolution,
  LipSyncEndpoint,
  LipSyncModelId,
  LipSyncResolution,
  VideoAspectRatio,
  VideoEndpoint,
  VideoModelId,
  VideoResolution,
} from '@/types';
import { type CostEstimate, formatRate, formatSeconds } from './pricing';
import { MUSIC_MODELS, SOUND_MODELS, SPEECH_MODELS } from './audio-models';

// ============================================================================
// VIDEO
// ============================================================================

/** How the connected inputs map onto a model's endpoints. */
export type VideoRoute = 'text' | 'image' | 'frames' | 'reference';

export interface VideoPriceArgs {
  resolution: VideoResolution;
  outputSeconds: number;
  audio: boolean;
  /** Seconds of reference video sent (input-billed by some models). */
  referenceVideoSeconds: number;
  route: VideoRoute;
}

export interface VideoModelSpec {
  id: VideoModelId;
  label: string;
  vendor: string;
  blurb: string;
  endpoints: { text: VideoEndpoint; image: VideoEndpoint; frames?: VideoEndpoint; reference?: VideoEndpoint };
  durations: readonly number[];
  /** Fixed output length on the reference endpoint (Veo: 8 s). */
  referenceDuration?: number;
  /** Max length when an end frame is given (Gemini Omni: 10 s). */
  maxDurationWithEndFrame?: number;
  resolutions: readonly VideoResolution[];
  aspectRatios: readonly VideoAspectRatio[];
  /** Image-to-video takes its framing from the start frame. */
  imageFollowsFrame: boolean;
  audio: 'toggle' | 'always' | 'none';
  /** Native @ElementN with frontal + reference views, or flattened into reference images. */
  elementMode: 'native' | 'flatten';
  /** @ImageN/@VideoN tags in the prompt, or plain words ("reference image 2"). */
  tagStyle: 'tags' | 'prose';
  /** Seedance 'editing' task: transform a reference video. */
  supportsVideoEdit: boolean;
  limits: {
    images: number;
    videos: number;
    elements: number;
    /** Reference views per native element. */
    elementViews: number;
    videoMinSeconds: number;
    videoMaxSeconds: number;
    videoTotalSeconds: number;
  };
  price: (args: VideoPriceArgs) => CostEstimate;
}

function perSecond(
  rate: number,
  seconds: number,
  note: string,
  isEstimate = false
): CostEstimate {
  return {
    costUsd: rate * seconds,
    breakdown: `${formatSeconds(seconds)} × ${formatRate(rate)}/s (${note})`,
    isEstimate,
  };
}

/** Seedance bills (input + output) seconds at a lower token rate when any video is referenced. */
function seedancePrice(rates: Partial<Record<VideoResolution, number>>, videoFactor: number) {
  return ({ resolution, outputSeconds, referenceVideoSeconds }: VideoPriceArgs): CostEstimate => {
    const rate = rates[resolution] ?? 0;
    if (referenceVideoSeconds > 0) {
      const seconds = referenceVideoSeconds + outputSeconds;
      return {
        costUsd: rate * videoFactor * seconds,
        breakdown: `(${formatSeconds(referenceVideoSeconds)} ref + ${formatSeconds(outputSeconds)} out) × ${formatRate(rate * videoFactor)}/s (${resolution}, video-reference rate)`,
        isEstimate: false,
      };
    }
    return perSecond(rate, outputSeconds, resolution);
  };
}

export const VIDEO_MODELS: Record<VideoModelId, VideoModelSpec> = {
  'seedance-2.5': {
    id: 'seedance-2.5',
    label: 'Seedance 2.5',
    vendor: 'ByteDance',
    blurb: 'Best overall motion and native audio. Up to 30 references, video editing.',
    endpoints: {
      text: 'bytedance/seedance-2.5/us/text-to-video',
      image: 'bytedance/seedance-2.5/us/image-to-video',
      reference: 'bytedance/seedance-2.5/us/reference-to-video',
    },
    durations: [4, 5, 6, 8, 10, 12, 15, 20, 30],
    resolutions: ['480p', '720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    imageFollowsFrame: true,
    audio: 'toggle',
    elementMode: 'flatten',
    tagStyle: 'tags',
    supportsVideoEdit: true,
    limits: { images: 30, videos: 10, elements: 30, elementViews: 4, videoMinSeconds: 1.8, videoMaxSeconds: 30.2, videoTotalSeconds: 30.2 },
    price: seedancePrice({ '480p': 0.2205, '720p': 0.473, '1080p': 1.164 }, 0.598),
  },
  'seedance-2.5-flash': {
    id: 'seedance-2.5-flash',
    label: 'Seedance 2.5 Flash',
    vendor: 'ByteDance',
    blurb: 'Fast, low-cost Seedance tier for drafts. 480p/720p.',
    endpoints: {
      text: 'bytedance/seedance-2.5/flash/text-to-video',
      image: 'bytedance/seedance-2.5/flash/image-to-video',
      reference: 'bytedance/seedance-2.5/flash/reference-to-video',
    },
    durations: [4, 5, 6, 8, 10, 12, 15, 20, 30],
    resolutions: ['480p', '720p'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    imageFollowsFrame: true,
    audio: 'toggle',
    elementMode: 'flatten',
    tagStyle: 'tags',
    supportsVideoEdit: true,
    limits: { images: 30, videos: 10, elements: 30, elementViews: 4, videoMinSeconds: 1.8, videoMaxSeconds: 30.2, videoTotalSeconds: 30.2 },
    price: seedancePrice({ '480p': 0.1345, '720p': 0.3024 }, 0.6),
  },
  'kling-4': {
    id: 'kling-4',
    label: 'Kling 4',
    vendor: 'Kuaishou',
    blurb: 'Strongest character lock: native @Element casting (up to 7) with frontal + reference views.',
    endpoints: {
      text: 'kling/v4/text-to-video',
      image: 'kling/v4/image-to-video',
      reference: 'kling/v4/reference-to-video',
    },
    durations: [3, 5, 8, 10, 15, 20, 30],
    resolutions: ['720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    imageFollowsFrame: true,
    audio: 'none',
    elementMode: 'native',
    tagStyle: 'tags',
    supportsVideoEdit: false,
    limits: { images: 10, videos: 5, elements: 7, elementViews: 3, videoMinSeconds: 3, videoMaxSeconds: 30, videoTotalSeconds: 30 },
    price: ({ resolution, outputSeconds, referenceVideoSeconds }) => {
      if (referenceVideoSeconds > 0) {
        // Video references: billable seconds = input + output, at least twice the output
        const rate = resolution === '1080p' ? 0.141 : 0.094;
        const billable = Math.max(referenceVideoSeconds + outputSeconds, 2 * outputSeconds);
        return {
          costUsd: rate * billable,
          breakdown: `${formatSeconds(billable)} billable (ref + out, min 2× out) × ${formatRate(rate)}/s (${resolution})`,
          isEstimate: false,
        };
      }
      return perSecond(resolution === '1080p' ? 0.235 : 0.157, outputSeconds, resolution);
    },
  },
  'gemini-omni-1.2': {
    id: 'gemini-omni-1.2',
    label: 'Gemini Omni Flash 1.2',
    vendor: 'Google',
    blurb: "Google's newest video model. Native audio, up to 4K, cheapest per second.",
    endpoints: {
      text: 'google/gemini-omni-flash/v1.2/text-to-video',
      image: 'google/gemini-omni-flash/v1.2/image-to-video',
      reference: 'google/gemini-omni-flash/v1.2/reference-to-video',
    },
    durations: [3, 5, 8, 10, 15],
    maxDurationWithEndFrame: 10,
    resolutions: ['360p', '720p', '1080p', '4k'],
    aspectRatios: ['16:9', '9:16'],
    imageFollowsFrame: false,
    audio: 'always',
    elementMode: 'flatten',
    tagStyle: 'prose',
    supportsVideoEdit: false,
    limits: { images: 10, videos: 3, elements: 10, elementViews: 2, videoMinSeconds: 1, videoMaxSeconds: 15, videoTotalSeconds: 45 },
    price: ({ resolution, outputSeconds, route }) => {
      const rates: Partial<Record<VideoResolution, number>> = { '360p': 0.0273, '720p': 0.0819, '1080p': 0.1229, '4k': 0.2457 };
      // References add input-token charges fal does not publish as a flat rate
      return perSecond(rates[resolution] ?? 0, outputSeconds, route === 'reference' ? `${resolution}, + reference tokens` : resolution, route === 'reference');
    },
  },
  'veo-3.1': {
    id: 'veo-3.1',
    label: 'Veo 3.1',
    vendor: 'Google DeepMind',
    blurb: 'Cinematic realism with dialogue audio. 4/6/8 s, first-last frame, 3 subject references.',
    endpoints: {
      text: 'fal-ai/veo3.1',
      image: 'fal-ai/veo3.1/image-to-video',
      frames: 'fal-ai/veo3.1/first-last-frame-to-video',
      reference: 'fal-ai/veo3.1/reference-to-video',
    },
    durations: [4, 6, 8],
    referenceDuration: 8,
    resolutions: ['720p', '1080p', '4k'],
    aspectRatios: ['16:9', '9:16'],
    imageFollowsFrame: true,
    audio: 'toggle',
    elementMode: 'flatten',
    tagStyle: 'prose',
    supportsVideoEdit: false,
    limits: { images: 3, videos: 0, elements: 3, elementViews: 0, videoMinSeconds: 0, videoMaxSeconds: 0, videoTotalSeconds: 0 },
    price: ({ resolution, outputSeconds, audio }) => {
      const rate = resolution === '4k' ? (audio ? 0.6 : 0.4) : audio ? 0.4 : 0.2;
      return perSecond(rate, outputSeconds, `${resolution}, ${audio ? 'with' : 'no'} audio`);
    },
  },
};

export const VIDEO_MODEL_ORDER: readonly VideoModelId[] = ['seedance-2.5', 'kling-4', 'gemini-omni-1.2', 'veo-3.1', 'seedance-2.5-flash'];

// ============================================================================
// IMAGE
// ============================================================================

export interface ImagePriceArgs {
  width: number;
  height: number;
  resolution: ImageResolution;
  inputImages: number;
}

export interface ImageModelSpec {
  id: ImageModelId;
  label: string;
  vendor: string;
  blurb: string;
  endpoints: { text: ImageEndpoint; edit: ImageEndpoint };
  resolutions: readonly ImageResolution[];
  maxInputs: number;
  price: (args: ImagePriceArgs) => CostEstimate;
}

function perMegapixel(rate: number, width: number, height: number, note: string): CostEstimate {
  const mp = (width * height) / 1_000_000;
  return {
    costUsd: rate * mp,
    breakdown: `${width}×${height} (${mp.toFixed(1)} MP) × ~${formatRate(rate)}/MP${note ? `, ${note}` : ''}`,
    isEstimate: true,
  };
}

export const IMAGE_MODELS: Record<ImageModelId, ImageModelSpec> = {
  'gpt-image-2.6': {
    id: 'gpt-image-2.6',
    label: 'GPT Image 2.6',
    vendor: 'OpenAI',
    blurb: 'Most faithful edits and text rendering. Up to 16 inputs.',
    endpoints: { text: 'openai/gpt-image-2.6/sunburst/text-to-image', edit: 'openai/gpt-image-2.6/sunburst/edit' },
    resolutions: ['1K', '2K', '4K'],
    maxInputs: 16,
    // Token-billed ($30 / 1M output image tokens, quality high): ~$0.19 per megapixel
    price: ({ width, height }) => perMegapixel(0.19, width, height, 'high quality'),
  },
  'nano-banana-2.1': {
    id: 'nano-banana-2.1',
    label: 'Nano Banana 2.1',
    vendor: 'Google',
    blurb: 'Best multi-reference character consistency across scenes. Up to 14 inputs.',
    endpoints: { text: 'google/nano-banana-2.1', edit: 'google/nano-banana-2.1/edit' },
    resolutions: ['1K', '2K', '4K'],
    maxInputs: 14,
    // Token-billed; fal's canonical-size figures at medium thinking
    price: ({ resolution }) => {
      const rate = { '1K': 0.04, '2K': 0.059, '4K': 0.134 }[resolution];
      return { costUsd: rate, breakdown: `${resolution} image ≈ ${formatRate(rate)} (token-billed)`, isEstimate: true };
    },
  },
  'flux-3': {
    id: 'flux-3',
    label: 'FLUX 3',
    vendor: 'Black Forest Labs',
    blurb: 'Photoreal detail and lighting. Up to 10 references.',
    endpoints: { text: 'blackforestlabs/flux-3/text-to-image', edit: 'blackforestlabs/flux-3/edit-image' },
    resolutions: ['1K', '2K', '4K'],
    maxInputs: 10,
    // "A 1K (1 MP) image costs $0.048"; scales with resolution
    price: ({ width, height }) => perMegapixel(0.048, width, height, ''),
  },
  'seedream-5.5': {
    id: 'seedream-5.5',
    label: 'Seedream 5.5',
    vendor: 'ByteDance',
    blurb: 'Lowest cost per image, strong stylisation. Up to 10 references.',
    endpoints: { text: 'bytedance/seedream/v5.5/text-to-image', edit: 'bytedance/seedream/v5.5/edit' },
    resolutions: ['1K', '2K'],
    maxInputs: 10,
    price: ({ width, height, inputImages }) => {
      const base = width * height > 2_610_000 ? 0.0405 : 0.03;
      const inputFee = 0.012 * inputImages;
      return {
        costUsd: base + inputFee,
        breakdown: inputImages > 0
          ? `${formatRate(base)} per image + ${inputImages} input${inputImages === 1 ? '' : 's'} × $0.012`
          : `${formatRate(base)} per image (${width}×${height})`,
        isEstimate: false,
      };
    },
  },
};

export const IMAGE_MODEL_ORDER: readonly ImageModelId[] = ['gpt-image-2.6', 'nano-banana-2.1', 'flux-3', 'seedream-5.5'];

export const IMAGE_ASPECT_RATIOS: readonly ImageAspectRatio[] = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'];

// ============================================================================
// LIP-SYNC
// ============================================================================

export type LipSyncRoute = 'image' | 'video' | 'generated-face';

export interface LipSyncModelSpec {
  id: LipSyncModelId;
  label: string;
  vendor: string;
  blurb: string;
  /** Photo/portrait + audio, and/or existing clip + audio. */
  endpoints: { image?: LipSyncEndpoint; video?: LipSyncEndpoint };
  resolutions: readonly LipSyncResolution[];
  /** Which prompt field the model reads, if any. */
  promptField: 'prompt' | 'motion_prompt' | null;
  audio: {
    minSeconds: number;
    maxSeconds: number;
    /** Accepted audio MIME types (null = any format fal accepts). */
    mimes: readonly string[] | null;
  };
  price: (args: { seconds: number; resolution: LipSyncResolution }) => CostEstimate;
}

export const LIPSYNC_MODELS: Record<LipSyncModelId, LipSyncModelSpec> = {
  'omnihuman-2': {
    id: 'omnihuman-2',
    label: 'OmniHuman 2',
    vendor: 'ByteDance',
    blurb: 'Singing and talking performances from one photo: lips, face, body and hands follow the audio.',
    endpoints: { image: 'bytedance/omnihuman/v2' },
    resolutions: [],
    promptField: 'prompt',
    audio: { minSeconds: 4, maxSeconds: 300, mimes: ['audio/mpeg', 'audio/wav'] },
    price: ({ seconds }) => perSecond(0.105, seconds, 'audio length'),
  },
  'heygen-avatar-6': {
    id: 'heygen-avatar-6',
    label: 'HeyGen Avatar 6',
    vendor: 'HeyGen',
    blurb: 'Presenter-grade talking heads from a photo, 1080p or 2K.',
    endpoints: { image: 'heygen/avatar-6/image-to-video' },
    resolutions: ['1080p', '2k'],
    promptField: 'motion_prompt',
    audio: { minSeconds: 1, maxSeconds: 300, mimes: null },
    price: ({ seconds, resolution }) => perSecond(resolution === '2k' ? 0.145 : 0.1, seconds, resolution),
  },
  'minimax-h3-lipsync': {
    id: 'minimax-h3-lipsync',
    label: 'MiniMax H3 Max Lip Sync',
    vendor: 'MiniMax',
    blurb: 'Long-form lip-sync from a photo: up to 15 minutes, transcription-guided.',
    endpoints: { image: 'minimax/h3-max/lip-sync/image-to-video' },
    resolutions: ['480p', '768p', '1080p', '2k'],
    promptField: null,
    audio: { minSeconds: 5, maxSeconds: 900, mimes: null },
    price: ({ seconds, resolution }) => {
      const rate = { '480p': 0.05, '768p': 0.08, '1080p': 0.16, '2k': 0.32 }[resolution];
      const long = seconds > 15;
      return {
        costUsd: rate * seconds * (long ? 1.2 : 1),
        breakdown: `${formatSeconds(seconds)} × ${formatRate(rate)}/s (${resolution})${long ? ' × 1.2 (over 15 s)' : ''}`,
        isEstimate: false,
      };
    },
  },
  'sync-3': {
    id: 'sync-3',
    label: 'Sync 3',
    vendor: 'Sync Labs',
    blurb: 'Re-sync the mouth of an existing clip (or a photo). Picks the singer by face in multi-person shots.',
    endpoints: { image: 'fal-ai/sync-lipsync/v3/image-to-video', video: 'fal-ai/sync-lipsync/v3' },
    resolutions: [],
    promptField: null,
    audio: { minSeconds: 1, maxSeconds: 300, mimes: null },
    price: ({ seconds }) => perSecond(0.1333, seconds, 'output'),
  },
  'veed-lipsync-2': {
    id: 'veed-lipsync-2',
    label: 'VEED Lipsync 2',
    vendor: 'VEED',
    blurb: 'Lowest-cost re-sync of an existing clip to new audio.',
    endpoints: { video: 'veed/lipsync/v2' },
    resolutions: [],
    promptField: null,
    audio: { minSeconds: 1, maxSeconds: 300, mimes: null },
    price: ({ seconds }) => perSecond(0.07, seconds, 'output'),
  },
};

export const LIPSYNC_MODEL_ORDER: readonly LipSyncModelId[] = ['omnihuman-2', 'heygen-avatar-6', 'minimax-h3-lipsync', 'sync-3', 'veed-lipsync-2'];

// ============================================================================
// DEFAULTS & COERCION
// ============================================================================

export const DEFAULT_VIDEO_MODEL: VideoModelId = 'seedance-2.5';
export const DEFAULT_IMAGE_MODEL: ImageModelId = 'gpt-image-2.6';
export const DEFAULT_LIPSYNC_MODEL: LipSyncModelId = 'omnihuman-2';

/** Closest supported value (ties go to the lower option). */
export function nearest(value: number, options: readonly number[]): number {
  return options.reduce((best, option) => (Math.abs(option - value) < Math.abs(best - value) ? option : best), options[0]);
}

const VIDEO_RESOLUTION_ORDER: readonly VideoResolution[] = ['360p', '480p', '720p', '1080p', '4k'];

export function coerceVideoResolution(spec: VideoModelSpec, resolution: VideoResolution): VideoResolution {
  if (spec.resolutions.includes(resolution)) return resolution;
  const index = VIDEO_RESOLUTION_ORDER.indexOf(resolution);
  const ranked = spec.resolutions.map((r) => ({ r, d: Math.abs(VIDEO_RESOLUTION_ORDER.indexOf(r) - index) }));
  ranked.sort((a, b) => a.d - b.d);
  return ranked[0].r;
}

export function coerceVideoAspect(spec: VideoModelSpec, aspect: VideoAspectRatio): VideoAspectRatio {
  if (spec.aspectRatios.includes(aspect)) return aspect;
  const [w, h] = aspect.split(':').map(Number);
  return w >= h ? '16:9' : '9:16';
}

export function coerceImageResolution(spec: ImageModelSpec, resolution: ImageResolution): ImageResolution {
  return spec.resolutions.includes(resolution) ? resolution : spec.resolutions[spec.resolutions.length - 1];
}

export function coerceLipSyncResolution(spec: LipSyncModelSpec, resolution: LipSyncResolution | undefined): LipSyncResolution {
  if (spec.resolutions.length === 0) return '1080p';
  if (resolution && spec.resolutions.includes(resolution)) return resolution;
  return spec.resolutions.includes('1080p') ? '1080p' : spec.resolutions[0];
}

// ============================================================================
// DISPLAY
// ============================================================================

const ROUTE_LABELS: Record<VideoRoute, string> = {
  text: 'Text to Video',
  image: 'Image to Video',
  frames: 'First–Last Frame',
  reference: 'Reference to Video',
};

function buildDisplayNames(): Record<GenerationModel, string> {
  const names: Partial<Record<GenerationModel, string>> = {
    'fal-ai/ffmpeg-api/compose': 'Timeline export · FFmpeg compose',
    'fal-ai/ffmpeg-api/images-to-video': 'FFmpeg · Stills to video',
    'fal-ai/workflow-utilities/trim-video': 'FFmpeg · Trim',
    'lightricks/ltx-2.5/audio-to-video/pro': 'LTX 2.5 Pro · Audio to Video',
    'lightricks/ltx-2.5/audio-to-video/fast': 'LTX 2.5 Fast · Audio to Video',
  };
  for (const spec of Object.values(VIDEO_MODELS)) {
    for (const [route, endpoint] of Object.entries(spec.endpoints) as Array<[VideoRoute, VideoEndpoint | undefined]>) {
      if (endpoint) names[endpoint] = `${spec.label} · ${ROUTE_LABELS[route]}`;
    }
  }
  for (const spec of Object.values(IMAGE_MODELS)) {
    names[spec.endpoints.text] = `${spec.label} · Text to Image`;
    names[spec.endpoints.edit] = `${spec.label} · Edit`;
  }
  for (const spec of Object.values(LIPSYNC_MODELS)) {
    if (spec.endpoints.image) names[spec.endpoints.image] = `${spec.label} · Lip-sync (photo)`;
    if (spec.endpoints.video) names[spec.endpoints.video] = `${spec.label} · Lip-sync (clip)`;
  }
  for (const spec of [...Object.values(SPEECH_MODELS), ...Object.values(SOUND_MODELS), ...Object.values(MUSIC_MODELS)]) {
    names[spec.endpoint] = `${spec.label} · ${spec.kind === 'speech' ? 'Speech' : spec.kind === 'sound' ? 'Audio' : 'Music'}`;
  }
  return names as Record<GenerationModel, string>;
}

const MODEL_DISPLAY_NAMES = buildDisplayNames();

/** Human-readable endpoint name. Falls back to the raw id for unknown endpoints. */
export function getModelDisplayName(model: GenerationModel | string): string {
  return MODEL_DISPLAY_NAMES[model as GenerationModel] ?? model;
}

export function videoRouteLabel(route: VideoRoute): string {
  return ROUTE_LABELS[route];
}
