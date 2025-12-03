'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useModalStore } from '@/stores';
import { cn, formatDuration } from '@/lib/utils';

export function MediaViewer() {
  const { mediaViewer, closeMediaViewer } = useModalStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const isVideo = mediaViewer.type === 'video';

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!mediaViewer.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMediaViewer();
      } else if (isVideo && e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
      } else if (isVideo && e.key === 'm') {
        setIsMuted((prev) => !prev);
      } else if (e.key === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mediaViewer.isOpen, isVideo, closeMediaViewer]);

  // Auto-hide controls for video
  useEffect(() => {
    if (!isVideo || !mediaViewer.isOpen) return;

    let timeout: NodeJS.Timeout;
    const hideControls = () => {
      if (isPlaying) {
        timeout = setTimeout(() => setShowControls(false), 3000);
      }
    };

    hideControls();

    return () => clearTimeout(timeout);
  }, [isVideo, isPlaying, mediaViewer.isOpen]);

  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(mediaViewer.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${mediaViewer.downloadFileName || 'nova-output'}.${isVideo ? 'mp4' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(mediaViewer.url, '_blank');
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeMediaViewer();
    }
  };

  if (!mediaViewer.isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
      onClick={handleBackdropClick}
      onMouseMove={handleMouseMove}
    >
      {/* Close Button */}
      <button
        onClick={closeMediaViewer}
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20"
        title="Close (Esc)"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Title */}
      {mediaViewer.title && (
        <div
          className={cn(
            'absolute top-4 left-4 right-20 z-10 transition-opacity duration-300',
            showControls ? 'opacity-100' : 'opacity-0'
          )}
        >
          <p className="truncate rounded-lg bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-sm">
            {mediaViewer.title}
          </p>
        </div>
      )}

      {/* Media Content */}
      <div className="relative max-h-[90vh] max-w-[90vw]">
        {isVideo ? (
          <>
            <video
              ref={videoRef}
              src={mediaViewer.url}
              className="max-h-[90vh] max-w-[90vw] rounded-lg"
              loop
              playsInline
              autoPlay
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={handlePlayPause}
            />

            {/* Video Controls */}
            <div
              className={cn(
                'absolute bottom-0 left-0 right-0 rounded-b-lg bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300',
                showControls ? 'opacity-100' : 'opacity-0'
              )}
            >
              {/* Progress Bar */}
              <div className="mb-3 flex items-center gap-3">
                <span className="w-12 text-xs text-white">
                  {formatDuration(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/30 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
                <span className="w-12 text-right text-xs text-white">
                  {formatDuration(duration)}
                </span>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Play/Pause */}
                  <button
                    onClick={handlePlayPause}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20"
                    title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5 ml-0.5" />
                    )}
                  </button>

                  {/* Mute */}
                  <button
                    onClick={toggleMute}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20"
                    title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                  >
                    {isMuted ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Download */}
                  <button
                    onClick={handleDownload}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20"
                    title="Download"
                  >
                    <Download className="h-5 w-5" />
                  </button>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20"
                    title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-5 w-5" />
                    ) : (
                      <Maximize2 className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <img
              src={mediaViewer.url}
              alt={mediaViewer.title || 'Generated image'}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />

            {/* Image Controls */}
            <div
              className={cn(
                'absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/60 p-2 backdrop-blur-sm transition-opacity duration-300',
                showControls ? 'opacity-100' : 'opacity-0'
              )}
            >
              {/* Download */}
              <button
                onClick={handleDownload}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20"
                title="Download"
              >
                <Download className="h-5 w-5" />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20"
                title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div
        className={cn(
          'absolute bottom-4 left-4 text-xs text-white/50 transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        {isVideo ? (
          <span>Space: Play/Pause | M: Mute | F: Fullscreen | Esc: Close</span>
        ) : (
          <span>F: Fullscreen | Esc: Close</span>
        )}
      </div>
    </div>
  );
}
