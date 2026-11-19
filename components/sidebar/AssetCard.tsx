'use client';

import { useState } from 'react';
import { Trash2, GripVertical, Edit2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssetType, AssetDragData } from '@/types';

interface AssetCardProps {
  type: AssetType;
  id: string;
  name: string;
  thumbnail?: string;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
  onClick?: () => void;
  className?: string;
}

export function AssetCard({
  type,
  id,
  name,
  thumbnail,
  onDelete,
  onRename,
  onClick,
  className,
}: AssetCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);

  const handleDragStart = (e: React.DragEvent) => {
    const dragData: AssetDragData = { type, id };
    e.dataTransfer.setData('application/nova-asset', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleRename = () => {
    if (onRename && editName.trim() && editName !== name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setEditName(name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };

  const handleCardClick = () => {
    if (!isEditing && onClick) {
      onClick();
    }
  };

  const placeholderColors: Record<AssetType, string> = {
    board: 'bg-blue-500/20',
    character: 'bg-red-500/20',
    scene: 'bg-green-500/20',
  };

  return (
    <div
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleCardClick}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      className={cn(
        'group relative rounded-lg border border-border bg-card p-1.5 transition-all hover:border-primary/50 hover:bg-secondary/50',
        !isEditing && (onClick ? 'cursor-pointer' : 'cursor-grab'),
        isDragging && 'opacity-50 ring-2 ring-primary',
        className
      )}
    >
      {/* Drag handle indicator */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-50">
        <GripVertical className="h-3 w-3" />
      </div>

      {/* Thumbnail */}
      <div
        className={cn(
          'aspect-video w-full overflow-hidden rounded-md',
          !thumbnail && placeholderColors[type]
        )}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={name}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No preview
          </div>
        )}
      </div>

      {/* Label / Rename Input */}
      <div className="mt-1.5 px-0.5">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded border border-border bg-background px-1 py-0.5 text-xs focus:border-primary focus:outline-none"
              autoFocus
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRename();
              }}
              className="flex h-4 w-4 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90"
              title="Save"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCancelRename();
              }}
              className="flex h-4 w-4 items-center justify-center rounded bg-secondary text-secondary-foreground hover:bg-secondary/80"
              title="Cancel"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1">
            <div className="truncate text-xs font-medium text-foreground">
              {name}
            </div>
            {onRename && showDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="flex h-4 w-4 items-center justify-center rounded hover:bg-secondary"
                title="Rename"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete button */}
      {onDelete && showDelete && !isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md transition-transform hover:scale-110"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
