'use client';

import { memo, useRef, useCallback, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ImageIcon, X, Upload, Loader2 } from 'lucide-react';
import type { ImageNodeData } from '@/types';
import { useCanvasStore, useModalStore } from '@/stores';
import { cn, formatFileSize } from '@/lib/utils';
import { getTagColor } from '@/lib/fal';
import { HashtagBadges } from './HashtagBadges';
import { TimelineToggle } from '@/components/timeline/TimelineToggle';

interface ImageNodeProps {
  id: string;
  data: ImageNodeData;
  selected?: boolean;
}

const ROLE_CYCLE: Array<'reference' | 'start_frame' | 'end_frame'> = [
  'reference',
  'start_frame',
  'end_frame',
];

const ROLE_LABELS: Record<string, string> = {
  reference: 'Reference',
  start_frame: 'Start Frame',
  end_frame: 'End Frame',
};

function ImageNodeComponent({ id, data, selected }: ImageNodeProps) {
  const { removeNode, updateNode } = useCanvasStore();
  const { openFileRoleModal } = useModalStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;

      // Open the role selection modal with targetNodeId to update this node
      openFileRoleModal(file, 'image', { x: 0, y: 0 }, id);

      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [id, openFileRoleModal]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRoleCycle = useCallback(() => {
    const currentIndex = ROLE_CYCLE.indexOf(data.role);
    const nextIndex = (currentIndex + 1) % ROLE_CYCLE.length;
    const nextRole = ROLE_CYCLE[nextIndex];

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 200);

    updateNode(id, { role: nextRole });
  }, [data.role, id, updateNode]);

  const highlightClass = data.isHighlighted
    ? data.tagAssignment?.startsWith('@Image')
      ? 'highlighted-image'
      : data.tagAssignment?.startsWith('@Element')
        ? 'highlighted-element'
        : ''
    : '';

  const tagColor = data.tagAssignment
    ? getTagColor(data.tagAssignment.startsWith('@Image') ? 'image' : 'element')
    : undefined;

  return (
    <div
      className={cn(
        'nova-node w-52 relative',
        selected && 'selected',
        highlightClass
      )}
    >
      {/* Floating Delete Button */}
      <button
        onClick={() => removeNode(id)}
        className="nova-node-delete"
        title="Delete node"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Input Handle for chaining */}
      <Handle type="target" position={Position.Left} id="input" />

      {/* Header */}
      <div className="nova-drag-handle mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TimelineToggle nodeId={id} />
          <div
            className={cn('nova-node-icon', !tagColor && 'nova-node-icon-image')}
            style={tagColor ? { backgroundColor: `${tagColor}20` } : undefined}
          >
            <ImageIcon
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
            <span className="text-sm font-medium">Image</span>
          )}
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Image Preview - Click to pick */}
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all hover:bg-black/30 hover:opacity-100">
            <Upload className="h-6 w-6 text-white" />
          </div>
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

      {/* Role Badge - Clickable to cycle */}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={handleRoleCycle}
          className={cn(
            'rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground transition-all hover:bg-secondary/80 cursor-pointer',
            isAnimating && 'animate-role-pop'
          )}
          title="Click to change role"
        >
          {ROLE_LABELS[data.role]}
        </button>
      </div>

      {/* Character Generation Loading Overlay */}
      {data.isGeneratingCharacter && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Generating character...</span>
          </div>
        </div>
      )}

      <HashtagBadges nodeId={id} />

      {/* Output Handle */}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  );
}

export const ImageNode = memo(ImageNodeComponent);
