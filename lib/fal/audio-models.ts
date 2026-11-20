// Audio generation catalogue: speech (TTS), sound (speech + effects + ambience in one model)
// and music. Pure. Prices: each endpoint's fal pricing note, 2026-11-20.
import type {
  AudioEndpoint,
  AudioKind,
  AudioModelId,
  ElevenMusicInput,
  ElevenSfxInput,
  ElevenTtsInput,
  GeminiTtsInput,
  LyriaInput,
  MiniMaxMusicInput,
  MusicModelId,
  PromptNodeData,
  SeedAudioInput,
  SoundModelId,
  SpeechModelId,
} from '@/types';
import { type CostEstimate, formatRate, formatSeconds } from './pricing';
import type { FalRequest } from './builders';

export interface AudioPriceArgs {
  characters: number;
  /** Requested or expected output length. */
  seconds: number;
}

export interface AudioModelSpec {
  id: AudioModelId;
  kind: AudioKind;
  label: string;
  vendor: string;
  blurb: string;
  endpoint: AudioEndpoint;
  /** Preset voices (speech models). */
  voices?: readonly string[];
  defaultVoice?: string;
  /** User-set output length, seconds [min, max, default]; null = set by the content/prompt. */
  length: { min: number; max: number; default: number } | null;
  lyrics: 'required' | 'optional' | 'none';
  instrumentalToggle: boolean;
  price: (args: AudioPriceArgs) => CostEstimate;
}

const ELEVEN_VOICES = ['Aria', 'Roger', 'Sarah', 'Laura', 'Charlie', 'George', 'Callum', 'River', 'Liam', 'Charlotte', 'Alice', 'Matilda', 'Will', 'Jessica', 'Eric', 'Chris', 'Brian', 'Daniel', 'Lily', 'Bill'] as const;
const GEMINI_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Zephyr', 'Leda', 'Orus', 'Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Autonoe', 'Callirrhoe', 'Despina', 'Enceladus', 'Erinome', 'Gacrux', 'Iapetus', 'Laomedeia', 'Pulcherrima', 'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 'Umbriel', 'Vindemiatrix', 'Zubenelgenubi'] as const;

function perThousandChars(rate: number, characters: number): CostEstimate {
  return {
    costUsd: (rate * characters) / 1000,
    breakdown: `${characters} char${characters === 1 ? '' : 's'} × ${formatRate(rate)}/1K`,
    isEstimate: false,
  };
}

export const SPEECH_MODELS: Record<SpeechModelId, AudioModelSpec> = {
  'eleven-v4': {
    id: 'eleven-v4',
    kind: 'speech',
    label: 'Eleven v4',
    vendor: 'ElevenLabs',
    blurb: 'Most expressive TTS. Audio tags like [whispers] or [laughs] direct the delivery.',
    endpoint: 'elevenlabs/tts/eleven-v4',
    voices: ELEVEN_VOICES,
    defaultVoice: 'Aria',
    length: null,
    lyrics: 'none',
    instrumentalToggle: false,
    price: ({ characters }) => perThousandChars(0.08, characters),
  },
  'gemini-3.8-flash-tts': {
    id: 'gemini-3.8-flash-tts',
    kind: 'speech',
    label: 'Gemini 3.8 Flash TTS',
    vendor: 'Google',
    blurb: '30 voices, natural direction in plain words, lowest cost per character.',
    endpoint: 'google/gemini-3.8-flash-tts',
    voices: GEMINI_VOICES,
    defaultVoice: 'Kore',
    length: null,
    lyrics: 'none',
    instrumentalToggle: false,
    price: ({ characters }) => perThousandChars(0.045, characters),
  },
};

export const SOUND_MODELS: Record<SoundModelId, AudioModelSpec> = {
  'seed-audio-1.0': {
    id: 'seed-audio-1.0',
    kind: 'sound',
    label: 'Seed Audio 1.0',
    vendor: 'ByteDance',
    blurb: 'One prompt, full soundscape: dialogue, effects and ambience mixed together.',
    endpoint: 'bytedance/seed-audio-1.0',
    length: null,
    lyrics: 'none',
    instrumentalToggle: false,
    price: ({ seconds }) => ({
      costUsd: (0.1875 * seconds) / 60,
      breakdown: `~${formatSeconds(seconds)} × $0.1875/min of output`,
      isEstimate: true,
    }),
  },
  'eleven-sfx-v3': {
    id: 'eleven-sfx-v3',
    kind: 'sound',
    label: 'ElevenLabs SFX v3',
    vendor: 'ElevenLabs',
    blurb: 'Precise sound effects up to 30 s, loopable.',
    endpoint: 'elevenlabs/sound-effects/v3',
    length: { min: 0.5, max: 30, default: 5 },
    lyrics: 'none',
    instrumentalToggle: false,
    price: ({ seconds }) => ({ costUsd: 0.002 * seconds, breakdown: `${formatSeconds(seconds)} × $0.002/s`, isEstimate: false }),
  },
};

export const MUSIC_MODELS: Record<MusicModelId, AudioModelSpec> = {
  'lyria-3.5': {
    id: 'lyria-3.5',
    kind: 'music',
    label: 'Lyria 3.5',
    vendor: 'Google DeepMind',
    blurb: 'Full songs with vocals up to a few minutes. Put lyrics, structure and length in the prompt.',
    endpoint: 'google/lyria-3.5',
    length: null,
    lyrics: 'optional',
    instrumentalToggle: false,
    price: () => ({ costUsd: 0.1, breakdown: '$0.10 per generation', isEstimate: false }),
  },
  'eleven-music-2.5': {
    id: 'eleven-music-2.5',
    kind: 'music',
    label: 'ElevenLabs Music 2.5',
    vendor: 'ElevenLabs',
    blurb: 'Studio-quality tracks of an exact length, with an instrumental switch.',
    endpoint: 'elevenlabs/music/v2.5',
    length: { min: 3, max: 300, default: 60 },
    lyrics: 'optional',
    instrumentalToggle: true,
    price: ({ seconds }) => {
      const minutes = Math.max(1, Math.ceil(seconds / 60));
      return { costUsd: 0.6 * minutes, breakdown: `${minutes} min (rounded up) × $0.60`, isEstimate: false };
    },
  },
  'minimax-music-3': {
    id: 'minimax-music-3',
    kind: 'music',
    label: 'MiniMax Music 3',
    vendor: 'MiniMax',
    blurb: 'Sings your exact lyrics with [verse]/[chorus] structure, up to 5 minutes.',
    endpoint: 'minimax/music-3',
    length: { min: 10, max: 300, default: 60 },
    lyrics: 'required',
    instrumentalToggle: false,
    price: ({ seconds }) => ({ costUsd: 0.002 * seconds, breakdown: `up to ${formatSeconds(seconds)} × $0.002/s`, isEstimate: false }),
  },
};

export const AUDIO_MODEL_ORDER: Record<AudioKind, readonly AudioModelId[]> = {
  speech: ['eleven-v4', 'gemini-3.8-flash-tts'],
  sound: ['seed-audio-1.0', 'eleven-sfx-v3'],
  music: ['lyria-3.5', 'eleven-music-2.5', 'minimax-music-3'],
};

export const AUDIO_KIND_LABEL: Record<AudioKind, string> = { speech: 'Speech', sound: 'Audio', music: 'Music' };

export function getAudioModel(id: AudioModelId): AudioModelSpec {
  return (SPEECH_MODELS as Record<string, AudioModelSpec>)[id]
    ?? (SOUND_MODELS as Record<string, AudioModelSpec>)[id]
    ?? (MUSIC_MODELS as Record<string, AudioModelSpec>)[id];
}

/** The audio model the prompt uses for its current audio kind. */
export function selectedAudioModel(promptData: PromptNodeData): AudioModelSpec {
  const kind = promptData.audioKind ?? 'speech';
  if (kind === 'music') return MUSIC_MODELS[promptData.musicModel ?? 'lyria-3.5'];
  if (kind === 'sound') return SOUND_MODELS[promptData.soundModel ?? 'seed-audio-1.0'];
  return SPEECH_MODELS[promptData.speechModel ?? 'eleven-v4'];
}

/** Length the request will ask for (model range applied), or a rough expectation for pricing. */
export function audioSeconds(spec: AudioModelSpec, promptData: PromptNodeData): number {
  if (spec.length) {
    const requested = promptData.audioSeconds ?? spec.length.default;
    return Math.min(spec.length.max, Math.max(spec.length.min, requested));
  }
  // Speech-like content: ~15 characters per second; songs ~2 minutes
  if (spec.kind === 'music') return 120;
  return Math.max(3, Math.round(promptData.prompt.length / 15));
}

export function buildAudioRequest(spec: AudioModelSpec, promptData: PromptNodeData, prompt: string): FalRequest {
  const seconds = audioSeconds(spec, promptData);
  const lyrics = promptData.lyrics?.trim();
  switch (spec.id) {
    case 'eleven-v4': {
      const input: ElevenTtsInput = { text: prompt, voice: promptData.voice ?? spec.defaultVoice, output_format: 'mp3_44100_128' };
      return { endpoint: spec.endpoint, input };
    }
    case 'gemini-3.8-flash-tts': {
      const input: GeminiTtsInput = { prompt, voice: promptData.voice ?? spec.defaultVoice };
      return { endpoint: spec.endpoint, input };
    }
    case 'seed-audio-1.0': {
      const input: SeedAudioInput = { prompt, output_format: 'mp3', sample_rate: 48000 };
      return { endpoint: spec.endpoint, input };
    }
    case 'eleven-sfx-v3': {
      const input: ElevenSfxInput = { text: prompt, duration_seconds: seconds, output_format: 'mp3_44100_128' };
      return { endpoint: spec.endpoint, input };
    }
    case 'lyria-3.5': {
      const input: LyriaInput = { prompt: lyrics ? `${prompt}\n\nLyrics:\n${lyrics}` : prompt };
      return { endpoint: spec.endpoint, input };
    }
    case 'eleven-music-2.5': {
      const input: ElevenMusicInput = {
        prompt: lyrics && !promptData.instrumental ? `${prompt}\n\nLyrics:\n${lyrics}` : prompt,
        music_length_ms: Math.round(seconds * 1000),
        force_instrumental: Boolean(promptData.instrumental),
        output_format: 'mp3_44100_128',
      };
      return { endpoint: spec.endpoint, input };
    }
    case 'minimax-music-3': {
      if (!lyrics) throw new Error('MiniMax Music 3 sings the lyrics you give it. Add lyrics first.');
      const input: MiniMaxMusicInput = { prompt, lyrics, duration: seconds };
      return { endpoint: spec.endpoint, input };
    }
  }
}
