'use client';

import { memo, useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Film,
  Download,
  RefreshCw,
  Play,
  Pause,
  X,
  CheckCircle2,
  Clock,
  Sparkles,
  DollarSign,
  MessageSquare,
  Image as ImageIcon,
  Maximize2,
} from 'lucide-react';
import type { OutputNodeData } from '@/types';
import { useCanvasStore } from '@/stores';
import { useModalStore } from '@/stores';
import { cn, formatDuration, formatCost } from '@/lib/utils';
import { getModelDisplayName } from '@/lib/fal';

interface OutputNodeProps {
  id: string;
  data: OutputNodeData;
  selected?: boolean;
}

function OutputNodeComponent({ id, data, selected }: OutputNodeProps) {
  const { removeNode, updateNode } = useCanvasStore();
  const { openMediaViewer } = useModalStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideoOutput = data.outputType === 'video';
  const isReference = data.role === 'reference';

  const handleConvertToReference = () => {
    updateNode(id, { role: 'reference' });
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoClick = () => {
    setShowVideo(true);
    // Auto-play when showing video
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }, 100);
  };

  const handleOpenFullscreen = () => {
    openMediaViewer({
      type: isVideoOutput ? 'video' : 'image',
      url: isVideoOutput ? data.videoUrl! : data.imageUrl!,
      title: data.generationMetadata.promptUsed,
      downloadFileName: `nova-${data.generationMetadata.requestId || (isVideoOutput ? 'video' : 'image')}`,
    });
  };

  const handleDownload = async () => {
    const url = isVideoOutput ? data.videoUrl : data.imageUrl;
    if (!url || isDownloading) return;

    setIsDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `nova-${data.generationMetadata.requestId || (isVideoOutput ? 'video' : 'image')}.${isVideoOutput ? 'mp4' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const mediaUrl = isVideoOutput ? data.videoUrl : data.imageUrl;

  return (
    <div
      className={cn(
        'nova-node w-72 relative',
        selected && 'selected',
        isReference && (isVideoOutput ? 'ring-2 ring-tag-video/50' : 'ring-2 ring-tag-image/50')
      )}
    >
      {/* Success gradient overlay */}
      <div className={cn(
        'pointer-events-none absolute inset-0 bg-linear-to-br via-transparent to-transparent',
        isVideoOutput ? 'from-green-500/5' : 'from-blue-500/5'
      )} />

      {/* Subtle Delete Button */}
      <button
        onClick={() => removeNode(id)}
        className="nova-node-delete"
        title="Delete node"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Input Handle */}
      <Handle type="target" position={Position.Left} id="input" />

      {/* Header - Drag Handle */}
      <div className="nova-drag-handle mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg',
              isReference
                ? isVideoOutput
                  ? 'bg-linear-to-br from-tag-video/30 to-tag-video/10'
                  : 'bg-linear-to-br from-tag-image/30 to-tag-image/10'
                : isVideoOutput
                  ? 'bg-linear-to-br from-green-500/30 to-green-500/10'
                  : 'bg-linear-to-br from-blue-500/30 to-blue-500/10'
            )}
          >
            {isReference ? (
              isVideoOutput ? (
                <Film className="h-4 w-4 text-tag-video" />
              ) : (
                <ImageIcon className="h-4 w-4 text-tag-image" />
              )
            ) : isVideoOutput ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <ImageIcon className="h-4 w-4 text-blue-500" />
            )}
          </div>
          <div>
            <span className="text-sm font-semibold">
              {isReference
                ? isVideoOutput
                  ? 'Reference Video'
                  : 'Reference Image'
                : isVideoOutput
                  ? 'Generated Video'
                  : 'Generated Image'}
            </span>
            {!isReference && (
              <div className={cn(
                'flex items-center gap-1 text-[10px]',
                isVideoOutput ? 'text-green-500' : 'text-blue-500'
              )}>
                <Sparkles className="h-2.5 w-2.5" />
                Success
              </div>
            )}
          </div>
        </div>

        {/* Tag Badge */}
        {data.tagAssignment && (
          <span
            className={cn(
              'tag-badge',
              isVideoOutput ? 'tag-badge-video' : 'tag-badge-image'
            )}
          >
            {data.tagAssignment}
          </span>
        )}
      </div>

      {/* Media Preview */}
      <div
        className="relative mb-3 aspect-video overflow-hidden rounded-xl bg-black/50 ring-1 ring-white/10 cursor-pointer group"
        onClick={handleOpenFullscreen}
      >
        {mediaUrl ? (
          <>
            {isVideoOutput ? (
              // VIDEO PREVIEW
              <>
                {showVideo ? (
                  <video
                    ref={videoRef}
                    src={data.videoUrl}
                    className="h-full w-full object-contain"
                    loop
                    playsInline
                    onClick={(e) => e.stopPropagation()}
                    onEnded={() => setIsPlaying(false)}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                  />
                ) : (
                  <div
                    className="relative h-full w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVideoClick();
                    }}
                  >
                    {data.thumbnailUrl ? (
                      <img
                        src={data.thumbnailUrl}
                        alt="Generated video"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <video
                        src={data.videoUrl}
                        className="h-full w-full object-contain"
                        preload="metadata"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-all hover:bg-black/30">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md ring-1 ring-white/30 transition-transform hover:scale-110">
                        <Play className="h-7 w-7 text-white ml-1" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Video controls overlay */}
                {showVideo && (
                  <div
                    className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-linear-to-t from-black/80 to-transparent p-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={handlePlayPause}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4 text-white" />
                      ) : (
                        <Play className="h-4 w-4 text-white ml-0.5" />
                      )}
                    </button>
                    <div className="rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                      {formatDuration(data.videoDuration || 0)}
                    </div>
                  </div>
                )}

                {/* Duration badge */}
                {!showVideo && (data.videoDuration || 0) > 0 && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    <Clock className="h-3 w-3" />
                    {formatDuration(data.videoDuration || 0)}
                  </div>
                )}
              </>
            ) : (
              // IMAGE PREVIEW
              <img
                src={data.imageUrl}
                alt="Generated image"
                className="h-full w-full object-contain"
              />
            )}

            {/* Fullscreen button overlay */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
                <Maximize2 className="h-4 w-4 text-white" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {isVideoOutput ? (
              <Film className="h-10 w-10 text-muted-foreground/50" />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
            )}
          </div>
        )}
      </div>

      {/* Prompt Used */}
      {data.generationMetadata.promptUsed && (
        <div className="mb-3 rounded-lg bg-secondary/50 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            Prompt
          </div>
          <p className="text-xs leading-relaxed line-clamp-3">
            {data.generationMetadata.promptUsed}
          </p>
        </div>
      )}

      {/* Generation Metadata */}
      <div className="mb-3 rounded-lg bg-secondary/50 p-2.5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Model</span>
            <span className="font-medium">
              {getModelDisplayName(data.generationMetadata.modelUsed)}
            </span>
          </div>
          {isVideoOutput && data.generationMetadata.duration !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{data.generationMetadata.duration}s</span>
            </div>
          )}
          {!isVideoOutput && data.generationMetadata.resolution && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Resolution</span>
              <span className="font-medium">{data.generationMetadata.resolution}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ratio</span>
            <span className="font-medium">{data.generationMetadata.aspectRatio}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Cost</span>
            <span className="flex items-center gap-0.5 font-medium text-green-500">
              <DollarSign className="h-3 w-3" />
              {formatCost(data.generationMetadata.cost).replace('$', '')}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {mediaUrl && (
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2.5 text-xs font-medium transition-all hover:bg-secondary/80 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className={cn('h-4 w-4', isDownloading && 'animate-pulse')} />
            {isDownloading ? 'Downloading...' : 'Download'}
          </button>
        )}
        {/* Video: Chain button */}
        {!isReference && data.canChain && isVideoOutput && (
          <button
            onClick={handleConvertToReference}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-linear-to-r from-tag-video/20 to-tag-video/10 px-3 py-2.5 text-xs font-medium text-tag-video ring-1 ring-tag-video/30 transition-all hover:from-tag-video/30 hover:to-tag-video/20 active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            Chain
          </button>
        )}
        {/* Image: Use as Reference button */}
        {!isReference && !isVideoOutput && (
          <button
            onClick={handleConvertToReference}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-linear-to-r from-tag-image/20 to-tag-image/10 px-3 py-2.5 text-xs font-medium text-tag-image ring-1 ring-tag-image/30 transition-all hover:from-tag-image/30 hover:to-tag-image/20 active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            Use as Ref
          </button>
        )}
      </div>

      {/* Output Handle (when converted to reference) */}
      {isReference && (
        <Handle type="source" position={Position.Right} id="output" />
      )}
    </div>
  );
}

export const OutputNode = memo(OutputNodeComponent);
