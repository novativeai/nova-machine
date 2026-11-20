'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileAudio, Loader2, Music, RotateCcw, Upload, X } from 'lucide-react';
import type { AudioNodeData } from '@/types';
import { useCanvasStore } from '@/stores';
import { cn } from '@/lib/utils';
import { useAudioLoader } from '@/hooks';
import { getModelDisplayName, LIPSYNC_MODEL_ORDER, LIPSYNC_MODELS } from '@/lib/fal/models';
import { formatUsd } from '@/lib/fal/pricing';
import { AUDIO_ACCEPT, AUDIO_FORMATS_LABEL, AUDIO_MAX_SECONDS } from '@/lib/media/audio';
import { HashtagBadges } from './HashtagBadges';
import { TimelineToggle } from '@/components/timeline/TimelineToggle';

interface AudioNodeProps {
  id: string;
  data: AudioNodeData;
  selected?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Whether a drag carries files (ignores node/asset drags inside the canvas). */
function isFileDrag(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files');
}

function AudioNodeComponent({ id, data, selected }: AudioNodeProps) {
  const { removeNode, updateNode } = useCanvasStore();
  const { loadAudio, retryUpload } = useAudioLoader();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const dragDepth = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Local blob preview while the File is in memory; after a reload only the uploaded URL is valid
  const playbackUrl = data.file && data.audioUrl ? data.audioUrl : data.remoteUrl || data.audioUrl;
  const hasAudio = Boolean(playbackUrl);

  // Reset the player whenever the audio is replaced
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [playbackUrl]);

  const acceptFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      audioRef.current?.pause();
      setIsValidating(true);
      try {
        await loadAudio(id, file);
      } finally {
        setIsValidating(false);
      }
    },
    [id, loadAudio]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // allow re-selecting the same file after a rejection
      void acceptFile(file);
    },
    [acceptFile]
  );

  // The whole node is a drop target (empty or loaded); stopPropagation keeps the canvas from also handling it
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setIsDragOver(false);
      void acceptFile(e.dataTransfer.files?.[0]);
    },
    [acceptFile]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const isBusy = isValidating || data.uploadStatus === 'uploading';
  const isUploaded = data.uploadStatus === 'completed' && Boolean(data.remoteUrl);
  const uploadError = data.uploadStatus === 'error' ? data.uploadError || 'Upload failed' : null;
  // Lip-sync models whose audio range fits this clip
  const fittingModels = data.duration > 0
    ? LIPSYNC_MODEL_ORDER.filter((m) => {
        const { minSeconds, maxSeconds } = LIPSYNC_MODELS[m].audio;
        return data.duration >= minSeconds && data.duration <= maxSeconds;
      })
    : [];
  const tier = data.duration > 0
    ? fittingModels.length > 0
      ? `Lip-sync ready · ${fittingModels.length}/${LIPSYNC_MODEL_ORDER.length} models`
      : 'Too short for lip-sync'
    : null;

  return (
    <div
      className={cn(
        'nova-node w-64 relative transition-shadow',
        selected && 'selected',
        isDragOver && 'ring-2 ring-purple-500/70'
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Floating Delete Button */}
      <button
        onClick={() => removeNode(id)}
        className="nova-node-delete"
        title="Delete node"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Input Handle - optional face (image or character) for lip-sync */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ top: '50%' }}
      />

      {/* Header */}
      <div className="nova-drag-handle mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TimelineToggle nodeId={id} />
          <div className="nova-node-icon" style={{ backgroundColor: '#A855F720' }}>
            <Music className="h-3.5 w-3.5" style={{ color: '#A855F7' }} />
          </div>
          <span className="text-sm font-medium">Audio</span>
        </div>
        {isUploaded && data.generationMetadata ? (
          <span
            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60"
            title={`${data.generationMetadata.modelLabel ?? getModelDisplayName(data.generationMetadata.modelUsed)} · ${data.generationMetadata.costBreakdown ?? ''} · billed by fal.ai to your account`}
          >
            {data.generationMetadata.costIsEstimate ? '~' : ''}{formatUsd(data.generationMetadata.cost)}
          </span>
        ) : isUploaded ? (
          <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] text-green-400">
            Synced
          </span>
        ) : null}
        {isBusy && (
          <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-400">
            {isValidating ? 'Checking...' : 'Uploading...'}
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        onChange={handleFileSelect}
        className="hidden"
      />

      {!hasAudio ? (
        /* Upload Zone */
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isValidating}
          className={cn(
            'mb-3 flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-6 transition-colors',
            isDragOver
              ? 'border-purple-500/70 bg-purple-500/10'
              : 'border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50'
          )}
        >
          {isValidating ? (
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <FileAudio className="mb-2 h-8 w-8 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-muted-foreground">
            {isDragOver ? 'Release to add audio' : 'Drop audio file'}
          </span>
          <span className="mt-1 text-xs text-muted-foreground/60">
            or click to browse
          </span>
          <span className="mt-2 text-[10px] text-muted-foreground/50">
            {AUDIO_FORMATS_LABEL} · up to {AUDIO_MAX_SECONDS / 60} min · max 15 MB
          </span>
        </button>
      ) : (
        /* Audio Player */
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <FileAudio className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{data.fileName || 'Audio file'}</span>
          </div>

          <audio
            ref={audioRef}
            src={playbackUrl}
            onLoadedMetadata={() => {
              // Backfill duration for boards saved before it was recorded at load time
              const seconds = audioRef.current?.duration;
              if (!data.duration && seconds && Number.isFinite(seconds)) {
                updateNode(id, { duration: seconds });
              }
            }}
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
            }}
            preload="metadata"
          />

          <div
            className={cn(
              'rounded-lg border p-2 transition-colors',
              isDragOver ? 'border-purple-500/70 bg-purple-500/10' : 'border-border bg-secondary/30'
            )}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <div className="flex items-center gap-0.5">
                    <div className="h-3 w-0.5 animate-pulse rounded-full bg-current" />
                    <div className="h-4 w-0.5 animate-pulse rounded-full bg-current" style={{ animationDelay: '0.2s' }} />
                    <div className="h-2 w-0.5 animate-pulse rounded-full bg-current" style={{ animationDelay: '0.4s' }} />
                  </div>
                ) : (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                )}
              </button>

              <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <span className={cn(!isPlaying && currentTime === 0 && 'text-muted-foreground/40')}>
                  {formatTime(currentTime)}
                </span>
                <span className="text-muted-foreground/30">/</span>
                <span>{data.duration > 0 ? formatTime(data.duration) : '--:--'}</span>
              </div>

              {isBusy && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-blue-400" />}
              {!isBusy && isUploaded && <span className="ml-auto text-[10px] text-green-500/80">Ready</span>}
            </div>

            {data.duration > 0 && (
              <div className="mt-2 h-1 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary/50 transition-all duration-200"
                  style={{ width: `${Math.min(100, (currentTime / data.duration) * 100)}%` }}
                />
              </div>
            )}
          </div>

          <div className="mt-1.5 flex items-center justify-between">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isValidating}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Upload className="h-3 w-3" />
              Replace audio
            </button>
            {tier && (
              <span className="text-[10px] text-purple-300/70" title="Video length follows the audio">
                {data.duration.toFixed(1)}s · {tier}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <div className="mb-2 flex items-start gap-1.5 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
          <span className="flex-1">{uploadError}</span>
          {data.file && (
            <button
              onClick={() => retryUpload(id)}
              className="mt-0.5 rounded p-0.5 transition-colors hover:bg-destructive/20"
              title="Retry upload"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* How to use */}
      {!hasAudio && (
        <div className="mb-2 rounded bg-purple-500/5 p-2 text-[10px] text-muted-foreground">
          Connect this node to a <strong className="text-cyan-400">Prompt</strong> to generate a video
          driven by the audio. Optionally connect an <strong className="text-purple-400">Image</strong> to
          the left handle to set the first frame.
        </div>
      )}

      <HashtagBadges nodeId={id} />

      {/* Output Handle - connects to prompt node */}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  );
}

export const AudioNode = memo(AudioNodeComponent);
