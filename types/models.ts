// Model catalogue identifiers. Endpoint ids are the exact fal.ai endpoint_id strings,
// checked against https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id> on 2026-11-20.

/**
 * What a prompt node produces. Lip-sync is video mode with audio wired in; speech, sound
 * (speech + effects in one model) and music are the three audio-mode categories.
 */
export type ModelCategory = 'video' | 'image' | 'lipsync' | 'speech' | 'sound' | 'music';

export type AudioKind = 'speech' | 'sound' | 'music';

export type SpeechModelId = 'eleven-v4' | 'gemini-3.8-flash-tts';
export type SoundModelId = 'seed-audio-1.0' | 'eleven-sfx-v3';
export type MusicModelId = 'lyria-3.5' | 'eleven-music-2.5' | 'minimax-music-3';
export type AudioModelId = SpeechModelId | SoundModelId | MusicModelId;

export type VideoModelId = 'seedance-2.5' | 'seedance-2.5-flash' | 'kling-4' | 'gemini-omni-1.2' | 'veo-3.1';

export type ImageModelId = 'gpt-image-2.6' | 'nano-banana-2.1' | 'flux-3' | 'seedream-5.5';

export type LipSyncModelId = 'omnihuman-2' | 'heygen-avatar-6' | 'minimax-h3-lipsync' | 'sync-3' | 'veed-lipsync-2';

export type VideoEndpoint =
  | 'bytedance/seedance-2.5/us/text-to-video'
  | 'bytedance/seedance-2.5/us/image-to-video'
  | 'bytedance/seedance-2.5/us/reference-to-video'
  | 'bytedance/seedance-2.5/flash/text-to-video'
  | 'bytedance/seedance-2.5/flash/image-to-video'
  | 'bytedance/seedance-2.5/flash/reference-to-video'
  | 'kling/v4/text-to-video'
  | 'kling/v4/image-to-video'
  | 'kling/v4/reference-to-video'
  | 'google/gemini-omni-flash/v1.2/text-to-video'
  | 'google/gemini-omni-flash/v1.2/image-to-video'
  | 'google/gemini-omni-flash/v1.2/reference-to-video'
  | 'fal-ai/veo3.1'
  | 'fal-ai/veo3.1/image-to-video'
  | 'fal-ai/veo3.1/first-last-frame-to-video'
  | 'fal-ai/veo3.1/reference-to-video';

export type ImageEndpoint =
  | 'openai/gpt-image-2.6/sunburst/text-to-image'
  | 'openai/gpt-image-2.6/sunburst/edit'
  | 'google/nano-banana-2.1'
  | 'google/nano-banana-2.1/edit'
  | 'blackforestlabs/flux-3/text-to-image'
  | 'blackforestlabs/flux-3/edit-image'
  | 'bytedance/seedream/v5.5/text-to-image'
  | 'bytedance/seedream/v5.5/edit';

export type LipSyncEndpoint =
  | 'bytedance/omnihuman/v2'
  | 'heygen/avatar-6/image-to-video'
  | 'minimax/h3-max/lip-sync/image-to-video'
  | 'fal-ai/sync-lipsync/v3/image-to-video'
  | 'fal-ai/sync-lipsync/v3'
  | 'veed/lipsync/v2';

export type AudioEndpoint =
  | 'elevenlabs/tts/eleven-v4'
  | 'google/gemini-3.8-flash-tts'
  | 'bytedance/seed-audio-1.0'
  | 'elevenlabs/sound-effects/v3'
  | 'google/lyria-3.5'
  | 'elevenlabs/music/v2.5'
  | 'minimax/music-3';

export type UtilityEndpoint =
  | 'fal-ai/ffmpeg-api/compose'
  | 'fal-ai/ffmpeg-api/merge-videos'
  | 'fal-ai/ffmpeg-api/merge-audio-video'
  | 'fal-ai/ffmpeg-api/images-to-video'
  | 'fal-ai/workflow-utilities/trim-video';

/** Endpoints recorded on outputs made by earlier versions (display only). */
export type LegacyEndpoint =
  | 'lightricks/ltx-2.5/audio-to-video/pro'
  | 'lightricks/ltx-2.5/audio-to-video/fast';

export type GenerationModel = VideoEndpoint | ImageEndpoint | LipSyncEndpoint | AudioEndpoint | UtilityEndpoint | LegacyEndpoint;

export type ImageAspectRatio = '21:9' | '16:9' | '3:2' | '4:3' | '5:4' | '1:1' | '4:5' | '3:4' | '2:3' | '9:16';

export type ImageResolution = '1K' | '2K' | '4K';

/** Output resolution tiers across lip-sync models (each model offers a subset). */
export type LipSyncResolution = '480p' | '768p' | '1080p' | '2k';
