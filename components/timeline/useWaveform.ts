'use client';

import { useEffect, useState } from 'react';

const PEAK_BUCKETS = 2000;
const cache = new Map<string, Float32Array>();
const inflight = new Map<string, Promise<Float32Array | null>>();

/** Normalised peak envelope of an audio (or video) file, decoded once per URL. */
async function decodePeaks(url: string): Promise<Float32Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const AudioCtx = window.AudioContext;
    const ctx = new AudioCtx();
    try {
      const audio = await ctx.decodeAudioData(buffer);
      const channel = audio.getChannelData(0);
      const size = Math.max(1, Math.floor(channel.length / PEAK_BUCKETS));
      const peaks = new Float32Array(Math.min(PEAK_BUCKETS, Math.ceil(channel.length / size)));
      let max = 0;
      for (let b = 0; b < peaks.length; b++) {
        let peak = 0;
        const end = Math.min(channel.length, (b + 1) * size);
        for (let i = b * size; i < end; i += 4) peak = Math.max(peak, Math.abs(channel[i]));
        peaks[b] = peak;
        max = Math.max(max, peak);
      }
      if (max > 0) for (let b = 0; b < peaks.length; b++) peaks[b] /= max;
      return peaks;
    } finally {
      void ctx.close();
    }
  } catch {
    // Cross-origin without CORS, or undecodable: the clip renders without a waveform
    return null;
  }
}

export function useWaveform(url: string | undefined): Float32Array | null {
  const [peaks, setPeaks] = useState<Float32Array | null>(() => (url ? cache.get(url) ?? null : null));

  useEffect(() => {
    if (!url) return;
    const cached = cache.get(url);
    if (cached) {
      setPeaks(cached);
      return;
    }
    let cancelled = false;
    let job = inflight.get(url);
    if (!job) {
      job = decodePeaks(url);
      inflight.set(url, job);
    }
    job.then((result) => {
      inflight.delete(url);
      if (result) cache.set(url, result);
      if (!cancelled) setPeaks(result);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return peaks;
}
