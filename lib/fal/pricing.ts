// Pure pricing and sizing helpers (no browser/client dependencies) — safe to import server-side.
import type { AudioToVideoModel, GptImageSize, PromptNodeData, VideoResolution } from '@/types';

// ============================================================================
// GPT IMAGE 2.6 SIZING
// ============================================================================

/** Pixel budget per UI resolution tier (4K = the model's 8,294,400 px ceiling). */
const GPT_IMAGE_PIXEL_BUDGET: Record<PromptNodeData['imageResolution'], number> = {
  '1K': 1024 * 1024,
  '2K': 2048 * 2048,
  '4K': 3840 * 2160,
};

const GPT_IMAGE_MIN_PIXELS = 655_360;
const GPT_IMAGE_MAX_PIXELS = 8_294_400;
const GPT_IMAGE_MAX_EDGE = 3840;

/**
 * Explicit {width, height} for GPT Image 2.6 that satisfies its constraints:
 * multiples of 16, max edge 3840, ratio <= 3:1, 655,360–8,294,400 total pixels.
 */
export function getGptImageSize(
  aspectRatio: PromptNodeData['imageAspectRatio'],
  resolution: PromptNodeData['imageResolution']
): GptImageSize {
  const [w, h] = aspectRatio.split(':').map(Number);
  const ratio = w / h;
  const budget = GPT_IMAGE_PIXEL_BUDGET[resolution];

  let width = Math.sqrt(budget * ratio);
  let height = Math.sqrt(budget / ratio);
  const edgeScale = Math.min(1, GPT_IMAGE_MAX_EDGE / Math.max(width, height));
  width *= edgeScale;
  height *= edgeScale;

  // Floor to multiples of 16 (never exceeds the max), then step up if below the minimum
  let snappedW = Math.max(16, Math.floor(width / 16) * 16);
  let snappedH = Math.max(16, Math.floor(height / 16) * 16);
  while (snappedW * snappedH < GPT_IMAGE_MIN_PIXELS) {
    if (snappedW / snappedH < ratio) snappedW += 16;
    else snappedH += 16;
  }
  while (snappedW * snappedH > GPT_IMAGE_MAX_PIXELS) {
    if (snappedW / snappedH > ratio) snappedW -= 16;
    else snappedH -= 16;
  }
  return { width: snappedW, height: snappedH };
}

// ============================================================================
// PRICING (estimated fal.ai cost in USD)
// ============================================================================

/** Seedance 2.5 (US) per second of generated video. */
export const SEEDANCE_PRICE_PER_SECOND: Record<VideoResolution, number> = {
  '480p': 0.2205,
  '720p': 0.473,
  '1080p': 1.164,
};

/**
 * With any video reference, Seedance bills input + output seconds at a lower token rate
 * ($0.0128 vs $0.0214 per 1K tokens at 480p/720p; $0.0140 vs $0.0234 at 1080p ≈ 0.598×).
 */
export const SEEDANCE_VIDEO_REFERENCE_RATE_FACTOR = 0.598;

/** LTX 2.5 audio-to-video per second of INPUT audio, and max accepted audio length. */
export const LTX_A2V_PRICE_PER_SECOND: Record<'pro' | 'fast', number> = { pro: 0.17, fast: 0.13 };
export const LTX_A2V_MAX_AUDIO_SECONDS: Record<'pro' | 'fast', number> = { pro: 10, fast: 20 };
export const LTX_A2V_MIN_AUDIO_SECONDS = 2;

/**
 * GPT Image 2.6 is token-billed ($30 / 1M output image tokens, quality "high").
 * fal publishes no flat per-image price; ~$0.19 per megapixel at high quality is our estimate.
 */
export const GPT_IMAGE_HIGH_COST_PER_MEGAPIXEL = 0.19;

export function calculateVideoCost(
  resolution: VideoResolution,
  outputSeconds: number,
  referenceVideoSeconds = 0
): number {
  const rate = SEEDANCE_PRICE_PER_SECOND[resolution];
  if (referenceVideoSeconds > 0) {
    return rate * SEEDANCE_VIDEO_REFERENCE_RATE_FACTOR * (referenceVideoSeconds + outputSeconds);
  }
  return rate * outputSeconds;
}

export function calculateAudioToVideoCost(model: AudioToVideoModel, audioSeconds: number): number {
  const tier = model === 'lightricks/ltx-2.5/audio-to-video/fast' ? 'fast' : 'pro';
  return LTX_A2V_PRICE_PER_SECOND[tier] * audioSeconds;
}

export function calculateImageCost(
  aspectRatio: PromptNodeData['imageAspectRatio'],
  resolution: PromptNodeData['imageResolution'],
  numImages = 1
): number {
  const { width, height } = getGptImageSize(aspectRatio, resolution);
  return calculateImageCostFromPixels(width, height, numImages);
}

/** Cost of an image from its actual pixel size (used once fal returns the real dimensions). */
export function calculateImageCostFromPixels(width: number, height: number, numImages = 1): number {
  return ((width * height) / 1_000_000) * GPT_IMAGE_HIGH_COST_PER_MEGAPIXEL * numImages;
}

// ============================================================================
// COST BREAKDOWNS (shown on nodes)
// ============================================================================

export interface CostEstimate {
  /** Estimated fal.ai cost in USD */
  costUsd: number;
  /** How the number was computed, e.g. "5s × $0.473/s (720p)" */
  breakdown: string;
  /** true when fal bills by tokens and the figure is our estimate rather than a list price */
  isEstimate: boolean;
}

/** "$0.473", "$0.17", "$0.0819" — trims trailing zeros, keeps enough precision for per-unit rates. */
function formatRate(rate: number): string {
  return `$${Number(rate.toPrecision(3))}`;
}

function formatSeconds(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}s`;
}

/** Display a USD amount: "<$0.01", "$0.47", "$12.30". */
export function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.01) return '<$0.01';
  return `$${amount.toFixed(2)}`;
}

export function estimateVideoCost(
  resolution: VideoResolution,
  outputSeconds: number,
  referenceVideoSeconds = 0
): CostEstimate {
  const rate = SEEDANCE_PRICE_PER_SECOND[resolution];
  if (referenceVideoSeconds > 0) {
    return {
      costUsd: calculateVideoCost(resolution, outputSeconds, referenceVideoSeconds),
      breakdown: `(${formatSeconds(referenceVideoSeconds)} ref + ${formatSeconds(outputSeconds)} out) × ${formatRate(rate * SEEDANCE_VIDEO_REFERENCE_RATE_FACTOR)}/s (${resolution}, video-reference rate)`,
      isEstimate: false,
    };
  }
  return {
    costUsd: calculateVideoCost(resolution, outputSeconds),
    breakdown: `${formatSeconds(outputSeconds)} × ${formatRate(rate)}/s (${resolution})`,
    isEstimate: false,
  };
}

export function estimateAudioToVideoCost(model: AudioToVideoModel, audioSeconds: number): CostEstimate {
  const tier = model === 'lightricks/ltx-2.5/audio-to-video/fast' ? 'fast' : 'pro';
  return {
    costUsd: calculateAudioToVideoCost(model, audioSeconds),
    breakdown: `${formatSeconds(audioSeconds)} of audio × ${formatRate(LTX_A2V_PRICE_PER_SECOND[tier])}/s (LTX ${tier === 'pro' ? 'Pro' : 'Fast'})`,
    isEstimate: false,
  };
}

export function estimateImageCostFromPixels(width: number, height: number): CostEstimate {
  const megapixels = (width * height) / 1_000_000;
  return {
    costUsd: calculateImageCostFromPixels(width, height),
    breakdown: `${width}×${height} (${megapixels.toFixed(1)} MP) × ~${formatRate(GPT_IMAGE_HIGH_COST_PER_MEGAPIXEL)}/MP, high quality`,
    isEstimate: true,
  };
}

export function estimateImageCost(
  aspectRatio: PromptNodeData['imageAspectRatio'],
  resolution: PromptNodeData['imageResolution']
): CostEstimate {
  const { width, height } = getGptImageSize(aspectRatio, resolution);
  return estimateImageCostFromPixels(width, height);
}
