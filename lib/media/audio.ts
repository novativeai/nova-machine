// Audio input spec for lip-sync and audio nodes. Isomorphic: used by the canvas and by the upload routes.

/** fal lip-sync models accept audio up to 15 MB (OmniHuman 2's limit, the strictest). */
export const AUDIO_MAX_BYTES = 15 * 1024 * 1024;

/** Widest range any lip-sync model accepts (each model checks its own range at generation). */
export const AUDIO_MIN_SECONDS = 1;
export const AUDIO_MAX_SECONDS = 900;

/** Canonical MIME type → file extension for every accepted audio format. */
export const AUDIO_MIME_EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
};

/** Browser/OS MIME aliases → canonical MIME type. */
const AUDIO_MIME_ALIASES: Record<string, string> = {
  'audio/mp3': 'audio/mpeg',
  'audio/mpeg3': 'audio/mpeg',
  'audio/x-mpeg': 'audio/mpeg',
  'audio/x-mp3': 'audio/mpeg',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/x-aac': 'audio/aac',
  'audio/aacp': 'audio/aac',
  'audio/vorbis': 'audio/ogg',
  'audio/x-flac': 'audio/flac',
};

/** File extension → canonical MIME type (some browsers report an empty type, e.g. for .m4a). */
const AUDIO_EXTENSION_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  flac: 'audio/flac',
};

/** `accept` attribute for audio file inputs. */
export const AUDIO_ACCEPT = [
  ...Object.keys(AUDIO_MIME_EXTENSIONS),
  ...Object.keys(AUDIO_EXTENSION_MIME).map((ext) => `.${ext}`),
].join(',');

export const AUDIO_FORMATS_LABEL = 'MP3, WAV, M4A, AAC, OGG or FLAC';

/**
 * Canonical audio MIME type for a file, from its reported type or its extension.
 * Returns null when the file is not a supported audio format.
 */
export function resolveAudioMime(type: string, fileName: string): string | null {
  const reported = type.toLowerCase().split(';')[0].trim();
  const canonical = AUDIO_MIME_ALIASES[reported] ?? reported;
  if (AUDIO_MIME_EXTENSIONS[canonical]) return canonical;

  // Empty or generic type (e.g. application/octet-stream): fall back to the extension
  if (!reported || reported === 'application/octet-stream') {
    const ext = fileName.toLowerCase().split('.').pop() ?? '';
    return AUDIO_EXTENSION_MIME[ext] ?? null;
  }
  return null;
}

export function isAudioFile(file: File): boolean {
  return resolveAudioMime(file.type, file.name) !== null;
}
