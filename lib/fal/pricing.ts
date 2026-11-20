// Pure pricing and sizing helpers (no browser/client dependencies) — safe to import server-side.
// Per-model rates live in ./models.ts.
import type { GptImageSize, ImageAspectRatio, ImageResolution } from '@/types';

// ============================================================================
// COST ESTIMATES
// ============================================================================

export interface CostEstimate {
  /** fal.ai cost in USD */
  costUsd: number;
  /** How the number was computed, e.g. "5s × $0.473/s (720p)" */
  breakdown: string;
  /** true when fal bills by tokens/compute and the figure is our estimate rather than a list price */
  isEstimate: boolean;
}

/** "$0.473", "$0.17", "$0.0819" — trims trailing zeros, keeps enough precision for per-unit rates. */
export function formatRate(rate: number): string {
  return `$${Number(rate.toPrecision(3))}`;
}

export function formatSeconds(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}s`;
}

/** Display a USD amount: "<$0.01", "$0.47", "$12.30". */
export function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.01) return '<$0.01';
  return `$${amount.toFixed(2)}`;
}

/** Sum several steps into one estimate ("still: …; lip-sync: …"). */
export function combineEstimates(parts: Array<{ label: string; estimate: CostEstimate }>): CostEstimate {
  return {
    costUsd: parts.reduce((sum, p) => sum + p.estimate.costUsd, 0),
    breakdown: parts.map((p) => `${p.label}: ${p.estimate.breakdown}`).join(' + '),
    isEstimate: parts.some((p) => p.estimate.isEstimate),
  };
}

// ============================================================================
// IMAGE SIZING
// ============================================================================

const IMAGE_PIXEL_BUDGET: Record<ImageResolution, number> = {
  '1K': 1024 * 1024,
  '2K': 2048 * 2048,
  '4K': 3840 * 2160,
};

interface SizeConstraints {
  minPixels: number;
  maxPixels: number;
  maxEdge: number;
}

/** {width, height} for an aspect ratio and pixel budget: multiples of 16, within the model's limits. */
export function getImageSize(
  aspectRatio: ImageAspectRatio,
  resolution: ImageResolution,
  limits: SizeConstraints
): GptImageSize {
  const [w, h] = aspectRatio.split(':').map(Number);
  const ratio = w / h;
  const budget = Math.min(IMAGE_PIXEL_BUDGET[resolution], limits.maxPixels);

  let width = Math.sqrt(budget * ratio);
  let height = Math.sqrt(budget / ratio);
  const edgeScale = Math.min(1, limits.maxEdge / Math.max(width, height));
  width *= edgeScale;
  height *= edgeScale;

  // Floor to multiples of 16 (never exceeds the max), then step up if below the minimum
  let snappedW = Math.max(16, Math.floor(width / 16) * 16);
  let snappedH = Math.max(16, Math.floor(height / 16) * 16);
  while (snappedW * snappedH < limits.minPixels) {
    if (snappedW / snappedH < ratio) snappedW += 16;
    else snappedH += 16;
  }
  while (snappedW * snappedH > limits.maxPixels) {
    if (snappedW / snappedH > ratio) snappedW -= 16;
    else snappedH -= 16;
  }
  return { width: snappedW, height: snappedH };
}

/**
 * GPT Image 2.6: multiples of 16, max edge 3840, ratio <= 3:1, 655,360–8,294,400 total pixels.
 */
export function getGptImageSize(aspectRatio: ImageAspectRatio, resolution: ImageResolution): GptImageSize {
  return getImageSize(aspectRatio, resolution, { minPixels: 655_360, maxPixels: 8_294_400, maxEdge: 3840 });
}

/** Seedream 5.5 custom size (2K tier tops out at ~4.2 MP). */
export function getSeedreamImageSize(aspectRatio: ImageAspectRatio, resolution: ImageResolution): GptImageSize {
  return getImageSize(aspectRatio, resolution, { minPixels: 921_600, maxPixels: 4_194_304, maxEdge: 4096 });
}

/** Expected output size for models that take a resolution tier instead of pixels. */
export function getTierImageSize(aspectRatio: ImageAspectRatio, resolution: ImageResolution): GptImageSize {
  return getImageSize(aspectRatio, resolution, { minPixels: 0, maxPixels: Number.MAX_SAFE_INTEGER, maxEdge: 4096 });
}
