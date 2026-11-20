'use client';

import { memo, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Video, X, Play, Upload } from 'lucide-react';
import type { VideoNodeData } from '@/types';
import { useCanvasStore, useModalStore } from '@/stores';
import { cn, formatFileSize, formatDuration } from '@/lib/utils';
import { getTagColor } from '@/lib/fal';
import { HashtagBadges } from './HashtagBadges';
import { TimelineToggle } from '@/components/timeline/TimelineToggle';

interface VideoNodeProps {
  id: string;
  data: VideoNodeData;
  selected?: boolean;
}

function VideoNodeComponent({ id, data, selected }: VideoNodeProps) {
  const { removeNode } = useCanvasStore();
  const { openFileRoleModal } = useModalStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('video/')) return;

      // Open the role selection modal with targetNodeId to update this node
      openFileRoleModal(file, 'video', { x: 0, y: 0 }, id);

      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [id, openFileRoleModal]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const highlightClass = data.isHighlighted ? 'highlighted-video' : '';
  const tagColor = data.tagAssignment ? getTagColor('video') : undefined;

  return (
    <div
      className={cn(
        'nova-node w-60 relative',
        selected && 'selected',
        highlightClass
      )}
    >
      {/* Subtle Delete Button */}
      <button
        onClick={() => removeNode(id)}
        className="nova-node-delete"
        title="Delete node"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Input Handle for chaining */}
      <Handle type="target" position={Position.Left} id="input" />

      {/* Header - Drag Handle */}
      <div className="nova-drag-handle mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TimelineToggle nodeId={id} />
          <div
            className={cn('nova-node-icon', !tagColor && 'nova-node-icon-video')}
            style={tagColor ? { backgroundColor: `${tagColor}20` } : undefined}
          >
            <Video
              className="h-3.5 w-3.5"
              style={{ color: tagColor || undefined }}
            />
          </div>
          {data.tagAssignment ? (
            <span
              className="tag-badge"
              style={{
                backgroundColor: `${tagColor}20`,
                color: tagColor,
                borderColor: `${tagColor}40`,
              }}
            >
              {data.tagAssignment}
            </span>
          ) : (
            <span className="text-sm font-medium">Video</span>
          )}
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Video Preview - Click to pick */}
      {data.thumbnailUrl ? (
        <button
          onClick={handleClick}
          className="relative mb-2 aspect-video w-full overflow-hidden rounded-lg bg-secondary transition-opacity hover:opacity-90"
        >
          <img
            src={data.thumbnailUrl}
            alt={data.fileName}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-all hover:bg-black/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Play className="h-5 w-5 text-white" />
            </div>
          </div>
          {data.duration > 0 && (
            <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
              {formatDuration(data.duration)}
            </div>
          )}
        </button>
      ) : (
        <button
          onClick={handleClick}
          className="mb-2 flex aspect-video w-full cursor-pointer items-center justify-center rounded-lg bg-secondary transition-colors hover:bg-secondary/80"
        >
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Upload className="h-6 w-6" />
            <span className="text-xs">Click to select</span>
          </div>
        </button>
      )}

      {/* File Info */}
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="truncate" title={data.fileName}>
          {data.fileName || 'No file selected'}
        </div>
        {data.fileSize > 0 && (
          <div className="flex justify-between">
            <span>{formatFileSize(data.fileSize)}</span>
            {data.dimensions.width > 0 && (
              <span>
                {data.dimensions.width}x{data.dimensions.height}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Role Badge */}
      <div className="mt-2">
        <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {data.role === 'edit_source' ? 'Edit Source' : 'Reference'}
        </span>
      </div>

      <HashtagBadges nodeId={id} />

      {/* Output Handle */}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  );
}

export const VideoNode = memo(VideoNodeComponent);
