'use client';

import { memo, useState, useRef, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User, X, Plus, Upload, Box, AlertTriangle } from 'lucide-react';
import type { ElementNodeData } from '@/types';
import { useCanvasStore } from '@/stores';
import { cn } from '@/lib/utils';
import { getTagColor, isValidNameForTag, formatNameAsTag } from '@/lib/fal';
import { HashtagBadges } from './HashtagBadges';

interface ElementNodeProps {
  id: string;
  data: ElementNodeData;
  selected?: boolean;
}

function ElementNodeComponent({ id, data, selected }: ElementNodeProps) {
  const { nodes, removeNode, updateNode } = useCanvasStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const frontalInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  const highlightClass = data.isHighlighted ? 'highlighted-element' : '';
  const tagColor = data.tagAssignment ? getTagColor('element') : undefined;

  // Check for duplicate names among element nodes
  // Only check if the name is valid for tagging (not default "New Element")
  const isDuplicateName = useMemo(() => {
    if (!data.name || !isValidNameForTag(data.name)) {
      return false;
    }
    const normalizedName = data.name.trim().toLowerCase();
    const otherElements = nodes.filter(
      (n) => n.type === 'element' && n.id !== id
    );
    return otherElements.some((n) => {
      const otherData = n.data as ElementNodeData;
      return otherData.name?.trim().toLowerCase() === normalizedName;
    });
  }, [nodes, id, data.name]);

  // Compute display tag: use name-based tag if valid, otherwise fall back to element tag
  const displayTag = useMemo(() => {
    if (!data.tagAssignment) return null;
    if (data.name && isValidNameForTag(data.name)) {
      return formatNameAsTag(data.name);
    }
    return data.tagAssignment;
  }, [data.tagAssignment, data.name]);

  // Handle frontal image selection
  // Note: tagAssignment is handled dynamically by recalculateTags when nodes are connected
  const handleFrontalImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;

      const blobUrl = URL.createObjectURL(file);

      updateNode(id, {
        frontalImageUrl: blobUrl,
        frontalThumbnail: blobUrl,
        frontalFile: file,
        name: data.name === 'New Element' ? file.name.replace(/\.[^/.]+$/, '') : data.name,
      });

      e.target.value = '';
    },
    [id, data.name, updateNode]
  );

  // Handle reference image selection
  const handleReferenceImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newUrls: string[] = [];
      const newThumbnails: string[] = [];
      const newFiles: File[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const blobUrl = URL.createObjectURL(file);
        newUrls.push(blobUrl);
        newThumbnails.push(blobUrl);
        newFiles.push(file);
      }

      updateNode(id, {
        referenceImageUrls: [...(data.referenceImageUrls || []), ...newUrls],
        referenceThumbnails: [...(data.referenceThumbnails || []), ...newThumbnails],
        referenceFiles: [...(data.referenceFiles || []), ...newFiles],
      });

      e.target.value = '';
    },
    [id, data.referenceImageUrls, data.referenceThumbnails, data.referenceFiles, updateNode]
  );

  // Remove a reference image
  const handleRemoveReference = useCallback(
    (index: number) => {
      const newUrls = [...(data.referenceImageUrls || [])];
      const newThumbnails = [...(data.referenceThumbnails || [])];
      const newFiles = [...(data.referenceFiles || [])];

      // Revoke the blob URL
      if (newUrls[index]) {
        URL.revokeObjectURL(newUrls[index]);
      }

      newUrls.splice(index, 1);
      newThumbnails.splice(index, 1);
      newFiles.splice(index, 1);

      updateNode(id, {
        referenceImageUrls: newUrls,
        referenceThumbnails: newThumbnails,
        referenceFiles: newFiles,
      });
    },
    [id, data.referenceImageUrls, data.referenceThumbnails, data.referenceFiles, updateNode]
  );

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNode(id, { name: e.target.value });
  };

  // Handle drag & drop for multiple images
  // First image → frontal, rest → reference images
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      );

      if (files.length === 0) return;

      // First image goes to frontal (only if no frontal image exists)
      const hasFrontal = !!data.frontalImageUrl || !!data.frontalFile;
      let frontalFile: File | null = null;
      let referenceFiles: File[] = [];

      if (!hasFrontal && files.length > 0) {
        frontalFile = files[0];
        referenceFiles = files.slice(1);
      } else {
        referenceFiles = files;
      }

      // Create blob URLs and update node
      const updates: Partial<typeof data> = {};

      if (frontalFile) {
        const blobUrl = URL.createObjectURL(frontalFile);
        updates.frontalImageUrl = blobUrl;
        updates.frontalThumbnail = blobUrl;
        updates.frontalFile = frontalFile;
        if (data.name === 'New Element') {
          updates.name = frontalFile.name.replace(/\.[^/.]+$/, '');
        }
      }

      if (referenceFiles.length > 0) {
        const newUrls: string[] = [];
        const newThumbnails: string[] = [];
        const newFiles: File[] = [];

        for (const file of referenceFiles) {
          const blobUrl = URL.createObjectURL(file);
          newUrls.push(blobUrl);
          newThumbnails.push(blobUrl);
          newFiles.push(file);
        }

        updates.referenceImageUrls = [
          ...(data.referenceImageUrls || []),
          ...newUrls,
        ];
        updates.referenceThumbnails = [
          ...(data.referenceThumbnails || []),
          ...newThumbnails,
        ];
        updates.referenceFiles = [...(data.referenceFiles || []), ...newFiles];
      }

      if (Object.keys(updates).length > 0) {
        updateNode(id, updates);
      }
    },
    [
      id,
      data.frontalImageUrl,
      data.frontalFile,
      data.name,
      data.referenceImageUrls,
      data.referenceThumbnails,
      data.referenceFiles,
      updateNode,
    ]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  return (
    <div
      className={cn(
        'nova-node w-56 relative transition-all',
        selected && 'selected',
        highlightClass,
        isDragOver && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drop overlay */}
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/10">
          <div className="rounded-lg bg-background/90 px-3 py-2 text-center text-sm">
            <Upload className="mx-auto mb-1 h-5 w-5 text-primary" />
            <span className="text-primary">Drop images here</span>
          </div>
        </div>
      )}

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
          <div
            className={cn('nova-node-icon', !tagColor && 'nova-node-icon-element')}
            style={tagColor ? { backgroundColor: `${tagColor}20` } : undefined}
          >
            {data.elementType === 'object' ? (
              <Box
                className="h-3.5 w-3.5"
                style={{ color: tagColor || undefined }}
              />
            ) : (
              <User
                className="h-3.5 w-3.5"
                style={{ color: tagColor || undefined }}
              />
            )}
          </div>
          {displayTag ? (
            <span
              className="tag-badge"
              style={{
                backgroundColor: `${tagColor}20`,
                color: tagColor,
                borderColor: `${tagColor}40`,
              }}
            >
              {displayTag}
            </span>
          ) : (
            <span className="text-sm font-medium">
              {data.elementType === 'object' ? 'Object' : 'Character'}
            </span>
          )}
        </div>
      </div>

      {/* Element Name */}
      <div className="mb-3">
        {isEditingName ? (
          <input
            type="text"
            value={data.name}
            onChange={handleNameChange}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
            className={cn(
              'w-full rounded border bg-background px-2 py-1 text-sm focus:outline-none',
              isDuplicateName ? 'border-amber-500' : 'border-primary'
            )}
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className={cn(
              'w-full rounded px-2 py-1 text-left text-sm hover:bg-secondary',
              isDuplicateName && 'flex items-center gap-1.5'
            )}
          >
            <span className="flex-1 truncate">{data.name || 'Unnamed Element'}</span>
            {isDuplicateName && (
              <span title="Duplicate name - tags may conflict">
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0 text-amber-500"
                />
              </span>
            )}
          </button>
        )}
        {isDuplicateName && !isEditingName && (
          <div className="mt-1 text-[10px] text-amber-500">
            Duplicate name - tags may conflict
          </div>
        )}
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={frontalInputRef}
        type="file"
        accept="image/*"
        onChange={handleFrontalImageSelect}
        className="hidden"
      />
      <input
        ref={referenceInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleReferenceImageSelect}
        className="hidden"
      />

      {/* Frontal Image */}
      <div className="mb-2">
        <div className="mb-1 text-xs text-muted-foreground">Frontal Image</div>
        {data.frontalThumbnail ? (
          <button
            onClick={() => frontalInputRef.current?.click()}
            className="relative aspect-square w-full overflow-hidden rounded-lg bg-secondary transition-opacity hover:opacity-90"
          >
            <img
              src={data.frontalThumbnail}
              alt="Frontal"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all hover:bg-black/30 hover:opacity-100">
              <Upload className="h-6 w-6 text-white" />
            </div>
          </button>
        ) : (
          <button
            onClick={() => frontalInputRef.current?.click()}
            className="flex aspect-square w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/50 transition-colors hover:border-primary hover:bg-secondary"
          >
            <div className="text-center text-xs text-muted-foreground">
              <Upload className="mx-auto mb-1 h-6 w-6" />
              Click to select
            </div>
          </button>
        )}
      </div>

      {/* Reference Images */}
      <div>
        <div className="mb-1 text-xs text-muted-foreground">
          Additional Angles ({data.referenceThumbnails?.length || 0})
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(data.referenceThumbnails || []).slice(0, 2).map((thumb, i) => (
            <div
              key={i}
              className="group relative aspect-square overflow-hidden rounded bg-secondary"
            >
              <img
                src={thumb}
                alt={`Reference ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => handleRemoveReference(i)}
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                title="Remove"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          {(data.referenceThumbnails?.length || 0) > 2 && (
            <div className="flex aspect-square items-center justify-center rounded bg-secondary text-xs text-muted-foreground">
              +{data.referenceThumbnails.length - 2}
            </div>
          )}
          <button
            onClick={() => referenceInputRef.current?.click()}
            className="flex aspect-square items-center justify-center rounded border border-dashed border-border bg-secondary/50 transition-colors hover:border-primary hover:bg-secondary"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <HashtagBadges nodeId={id} />

      {/* Output Handle */}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  );
}

export const ElementNode = memo(ElementNodeComponent);
