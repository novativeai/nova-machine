'use client';

import { useCallback } from 'react';
import { useCanvasStore } from '@/stores';
import { toast } from '@/lib/toast';
import {
  AUDIO_FORMATS_LABEL,
  AUDIO_MAX_BYTES,
  AUDIO_MAX_SECONDS,
  AUDIO_MIN_SECONDS,
  resolveAudioMime,
} from '@/lib/media/audio';
import type { AudioNodeData } from '@/types';
import { useBackgroundUpload } from './useBackgroundUpload';

const PROBE_TIMEOUT_MS = 10_000;

export interface ValidatedAudio {
  /** File re-typed with its canonical MIME type (what gets uploaded) */
  file: File;
  /** Duration in seconds, read from the file's metadata */
  seconds: number;
}

/** Read an audio file's duration from its metadata. */
export function probeAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const finish = (fn: () => void) => {
      clearTimeout(timer);
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new Error('timeout'))), PROBE_TIMEOUT_MS);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const seconds = audio.duration;
      finish(() =>
        Number.isFinite(seconds) && seconds > 0 ? resolve(seconds) : reject(new Error('no duration'))
      );
    };
    audio.onerror = () => finish(() => reject(new Error('unreadable')));
    audio.src = url;
  });
}

/**
 * Check a file against the LTX 2.5 audio-to-video input rules.
 * Returns the validated audio, or a user-facing error message.
 */
export async function validateAudioFile(file: File): Promise<ValidatedAudio | string> {
  const mime = resolveAudioMime(file.type, file.name);
  if (!mime) return `Unsupported audio format. Use ${AUDIO_FORMATS_LABEL}.`;
  if (file.size > AUDIO_MAX_BYTES) {
    return `Audio is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is ${AUDIO_MAX_BYTES / (1024 * 1024)} MB.`;
  }

  let seconds: number;
  try {
    seconds = await probeAudioDuration(file);
  } catch {
    return `Could not read "${file.name}". Try re-exporting it as MP3 or WAV.`;
  }
  if (seconds < AUDIO_MIN_SECONDS || seconds > AUDIO_MAX_SECONDS) {
    return `Audio must be ${AUDIO_MIN_SECONDS}–${AUDIO_MAX_SECONDS} seconds for audio-to-video (this clip is ${seconds.toFixed(1)}s). Trim it and try again.`;
  }

  const typed = file.type === mime ? file : new File([file], file.name, { type: mime, lastModified: file.lastModified });
  return { file: typed, seconds };
}

/**
 * Load audio into Audio nodes: validate, show a local preview immediately,
 * and upload in the background (a newer file replaces an in-flight upload).
 */
export function useAudioLoader() {
  const { updateNode } = useCanvasStore();
  const { startUpload } = useBackgroundUpload();

  /** Put already-validated audio on a node and start its upload. */
  const applyAudio = useCallback(
    (nodeId: string, audio: ValidatedAudio) => {
      const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
      const previousUrl = node?.type === 'audio' ? (node.data as AudioNodeData).audioUrl : '';

      updateNode(nodeId, {
        audioUrl: URL.createObjectURL(audio.file),
        fileName: audio.file.name,
        fileSize: audio.file.size,
        duration: audio.seconds,
        file: audio.file,
        uploadStatus: 'uploading',
        uploadError: undefined,
        remoteUrl: undefined,
      });
      if (previousUrl.startsWith('blob:')) URL.revokeObjectURL(previousUrl);

      // Failures are recorded on the node by the upload hook (shown with a retry button)
      startUpload(nodeId, audio.file, 'audio').catch(() => undefined);
    },
    [updateNode, startUpload]
  );

  /** Validate and load a file into an existing Audio node. Returns false (with a toast) if rejected. */
  const loadAudio = useCallback(
    async (nodeId: string, file: File): Promise<boolean> => {
      const result = await validateAudioFile(file);
      if (typeof result === 'string') {
        toast.error(result);
        return false;
      }
      applyAudio(nodeId, result);
      return true;
    },
    [applyAudio]
  );

  /** Re-run a failed upload for the file already on the node. */
  const retryUpload = useCallback(
    (nodeId: string) => {
      const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
      const file = node?.type === 'audio' ? (node.data as AudioNodeData).file : undefined;
      if (file) startUpload(nodeId, file, 'audio').catch(() => undefined);
    },
    [startUpload]
  );

  return { applyAudio, loadAudio, retryUpload };
}
