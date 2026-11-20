'use client';

import { memo, useEffect, useRef } from 'react';
import { Film } from 'lucide-react';
import { useTimelineStore } from '@/stores';
import { activeVisualAt, isAudible, sourceTime, type TimelineClip } from '@/lib/timeline/layers';

interface TimelinePreviewProps {
  clips: TimelineClip[];
  /** Hide the built-in "nothing here" hint when the host shows its own. */
  hideEmptyHint?: boolean;
}

/** Drift allowed before a playing element is re-seeked (seconds). */
const PLAY_TOLERANCE = 0.3;
const SCRUB_TOLERANCE = 0.03;

/**
 * Programme monitor: shows the topmost visible clip at the playhead and plays every
 * audible layer in sync with the transport. Media elements stay mounted so cuts are instant.
 */
function TimelinePreviewComponent({ clips, hideEmptyHint = false }: TimelinePreviewProps) {
  const currentTime = useTimelineStore((s) => s.currentTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const mediaRefs = useRef(new Map<string, HTMLMediaElement>());

  // At the very end of the programme keep the last frame on screen (no black flash)
  const active = activeVisualAt(clips, currentTime) ?? (currentTime > 0 ? activeVisualAt(clips, currentTime - 1 / 30) : undefined);
  const mediaClips = clips.filter((c) => (c.kind === 'video' || c.kind === 'audio') && c.url);

  useEffect(() => {
    for (const clip of mediaClips) {
      const el = mediaRefs.current.get(clip.nodeId);
      if (!el) continue;
      const inRange = currentTime >= clip.start && currentTime < clip.end;
      const audible = isAudible(clip, clips);
      el.muted = !audible;
      el.volume = Math.min(1, Math.max(0, clip.layer.volume));

      if (!inRange) {
        if (!el.paused) el.pause();
        // Park upcoming clips on their first frame
        if (currentTime < clip.start && Math.abs(el.currentTime - clip.layer.trimStart) > SCRUB_TOLERANCE && el.readyState > 0) {
          el.currentTime = clip.layer.trimStart;
        }
        continue;
      }
      const target = sourceTime(clip, currentTime);
      const tolerance = isPlaying ? PLAY_TOLERANCE : SCRUB_TOLERANCE;
      if (el.readyState > 0 && Math.abs(el.currentTime - target) > tolerance) el.currentTime = target;
      // Only the shown picture (or audible layers) needs to run
      const needed = audible || clip === active;
      if (isPlaying && needed && el.paused) void el.play().catch(() => undefined);
      if ((!isPlaying || !needed) && !el.paused) el.pause();
    }
  });

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-md bg-black">
      {clips
        .filter((c) => c.track === 'visual' && c.url)
        .map((clip) =>
          clip.kind === 'video' ? (
            <video
              key={clip.nodeId}
              ref={(el) => {
                if (el) mediaRefs.current.set(clip.nodeId, el);
                else mediaRefs.current.delete(clip.nodeId);
              }}
              src={clip.url}
              preload="auto"
              playsInline
              className="absolute inset-0 h-full w-full object-contain"
              style={{ visibility: clip === active ? 'visible' : 'hidden' }}
            />
          ) : clip.kind === 'image' ? (
            <img
              key={clip.nodeId}
              src={clip.url}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
              style={{ visibility: clip === active ? 'visible' : 'hidden' }}
            />
          ) : null
        )}
      {clips
        .filter((c) => c.kind === 'audio' && c.url)
        .map((clip) => (
          <audio
            key={clip.nodeId}
            ref={(el) => {
              if (el) mediaRefs.current.set(clip.nodeId, el);
              else mediaRefs.current.delete(clip.nodeId);
            }}
            src={clip.url}
            preload="auto"
          />
        ))}
      {!active && !hideEmptyHint && (
        <div className="pointer-events-none flex flex-col items-center gap-1 text-white/25">
          <Film className="h-5 w-5" />
          <span className="text-[10px]">{clips.some((c) => c.track === 'visual') ? 'No picture at playhead' : 'Add a video or image layer'}</span>
        </div>
      )}
      {active && (
        <div className="pointer-events-none absolute bottom-1 left-1 max-w-[90%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/70">
          {active.label}
        </div>
      )}
    </div>
  );
}

export const TimelinePreview = memo(TimelinePreviewComponent);
