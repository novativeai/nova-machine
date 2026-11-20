// Offline stereo mix of every audible timeline layer (audio files and the sound of video
// clips), rendered in the browser so volume, mute/solo, trims and offsets are exact.
import { fetchMediaBytes } from '@/lib/media/fetch-media';
import { encodeWav } from '@/lib/media/wav';
import { isAudible, type TimelineClip } from './layers';

const MIX_SAMPLE_RATE = 48_000;

export interface MixResult {
  file: File;
  /** Layers with no decodable sound (e.g. silent renders), left out of the mix. */
  skipped: string[];
}

/** Render the programme's audio to a WAV file, or null when nothing on the timeline is audible. */
export async function renderMix(clips: TimelineClip[], durationSeconds: number): Promise<MixResult | null> {
  const audible = clips.filter((c) => c.url && c.kind !== 'image' && c.kind !== 'empty' && isAudible(c, clips));
  if (audible.length === 0 || durationSeconds <= 0) return null;

  const ctx = new OfflineAudioContext(2, Math.ceil(durationSeconds * MIX_SAMPLE_RATE), MIX_SAMPLE_RATE);
  const skipped: string[] = [];
  let scheduled = 0;

  await Promise.all(
    audible.map(async (clip) => {
      try {
        const buffer = await ctx.decodeAudioData(await fetchMediaBytes(clip.url!));
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = Math.max(0, Math.min(1, clip.layer.volume));
        source.connect(gain).connect(ctx.destination);
        const length = Math.min(clip.end - clip.start, buffer.duration - clip.layer.trimStart);
        if (length > 0) {
          source.start(clip.start, clip.layer.trimStart, length);
          scheduled += 1;
        }
      } catch {
        // A clip without an audio stream (silent render) stays out of the mix
        skipped.push(clip.label);
      }
    })
  );
  if (scheduled === 0) return null;

  const rendered = await ctx.startRendering();
  const channels = [rendered.getChannelData(0), rendered.getChannelData(1)];
  return { file: new File([encodeWav(channels, MIX_SAMPLE_RATE)], 'mix.wav', { type: 'audio/wav' }), skipped };
}
