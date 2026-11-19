'use client';

import { useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  ImageIcon,
  Video,
  User,
  Play,
  FrameIcon,
  Loader2,
  X,
  Box,
  ArrowLeft,
} from 'lucide-react';
import { useModalStore, useCanvasStore, createNode } from '@/stores';
import { useBackgroundUpload } from '@/hooks';
import {
  getImageDimensions,
  getVideoDuration,
  generateVideoThumbnail,
  cn,
} from '@/lib/utils';
import type { MediaRole, TagType, ElementType } from '@/types';

interface RoleOptionUI {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  role: MediaRole;
  tagType?: TagType;
  color?: string;
}

const IMAGE_OPTIONS: RoleOptionUI[] = [
  {
    id: 'image-ref',
    label: '@Image',
    description: 'Use as style/composition reference in your prompt',
    icon: <ImageIcon className="h-5 w-5" />,
    role: 'reference',
    tagType: 'image',
    color: '#3B82F6',
  },
  {
    id: 'start-frame',
    label: 'Start Frame',
    description: 'First frame for Image-to-Video animation',
    icon: <FrameIcon className="h-5 w-5" />,
    role: 'start_frame',
  },
  {
    id: 'end-frame',
    label: 'End Frame',
    description: 'Final frame for Image-to-Video animation',
    icon: <FrameIcon className="h-5 w-5" />,
    role: 'end_frame',
  },
  {
    id: 'element',
    label: '@Element',
    description: 'Define a character or object with this as frontal image',
    icon: <User className="h-5 w-5" />,
    role: 'element',
    tagType: 'element',
    color: '#EF4444',
  },
];

const VIDEO_OPTIONS: RoleOptionUI[] = [
  {
    id: 'video-ref',
    label: '@Video',
    description: 'Reference for motion and cinematic style',
    icon: <Video className="h-5 w-5" />,
    role: 'reference',
    tagType: 'video',
    color: '#8B5CF6',
  },
  {
    id: 'edit-source',
    label: 'Edit Source',
    description: 'Video to edit and transform with natural language',
    icon: <Play className="h-5 w-5" />,
    role: 'edit_source',
  },
];

export function FileRoleModal() {
  const { fileRoleModal, closeFileRoleModal } = useModalStore();
  const { addNode, updateNode } = useCanvasStore();
  const { screenToFlowPosition } = useReactFlow();
  const { startUpload, startElementFrontalUpload } = useBackgroundUpload();

  const [selectedRole, setSelectedRole] = useState<RoleOptionUI | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // Element configuration state (second step)
  const [elementType, setElementType] = useState<ElementType | null>(null);
  const [elementName, setElementName] = useState('');
  const [showElementConfig, setShowElementConfig] = useState(false);

  const isUpdatingExistingNode = !!fileRoleModal.targetNodeId;

  // Filter options based on context - exclude Element option when updating existing Image node
  const baseOptions =
    fileRoleModal.fileType === 'image' ? IMAGE_OPTIONS : VIDEO_OPTIONS;
  const options = isUpdatingExistingNode
    ? baseOptions.filter((opt) => opt.role !== 'element')
    : baseOptions;

  // Handle proceeding to element config or direct confirm
  const handleProceed = useCallback(() => {
    if (!selectedRole) return;

    if (selectedRole.role === 'element') {
      // Show element configuration step
      setShowElementConfig(true);
      // Default name from filename
      setElementName(fileRoleModal.file?.name.replace(/\.[^/.]+$/, '') || '');
    } else {
      // Directly confirm for non-element roles
      handleConfirm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole, fileRoleModal.file]);

  const handleBackToRoles = useCallback(() => {
    setShowElementConfig(false);
    setElementType(null);
    setElementName('');
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedRole || !fileRoleModal.file) return;
    // For elements, require type and name
    if (selectedRole.role === 'element' && (!elementType || !elementName.trim())) return;

    setIsProcessing(true);

    try {
      const file = fileRoleModal.file;

      // Create a new blob URL for the node (separate from modal's preview URL)
      // This way the modal can safely revoke its URL without affecting the node
      const blobUrl = URL.createObjectURL(file);

      // Get file metadata
      let dimensions = { width: 0, height: 0 };
      let duration = 0;
      let thumbnailUrl = blobUrl;

      if (fileRoleModal.fileType === 'image') {
        dimensions = await getImageDimensions(file);
      } else {
        duration = await getVideoDuration(file);
        thumbnailUrl = await generateVideoThumbnail(file);
      }

      // Update existing node or create new one
      // Note: tagAssignment is handled dynamically by recalculateTags when nodes are connected
      if (fileRoleModal.targetNodeId) {
        // Update existing node
        if (fileRoleModal.fileType === 'image') {
          updateNode(fileRoleModal.targetNodeId, {
            imageUrl: blobUrl,
            thumbnailUrl,
            fileName: file.name,
            fileSize: file.size,
            dimensions,
            role: selectedRole.role as 'reference' | 'start_frame' | 'end_frame',
            file,
            // Reset upload state for new file
            uploadStatus: 'idle',
            remoteUrl: undefined,
            uploadError: undefined,
          });
          // Start background upload for updated node
          startUpload(fileRoleModal.targetNodeId, file, 'image');
        } else {
          updateNode(fileRoleModal.targetNodeId, {
            videoUrl: blobUrl,
            thumbnailUrl,
            fileName: file.name,
            fileSize: file.size,
            duration,
            role: selectedRole.role as 'reference' | 'edit_source',
            file,
            // Reset upload state for new file
            uploadStatus: 'idle',
            remoteUrl: undefined,
            uploadError: undefined,
          });
          // Start background upload for updated node
          startUpload(fileRoleModal.targetNodeId, file, 'video');
        }
      } else {
        // Calculate position for new node
        const position = screenToFlowPosition(fileRoleModal.dropPosition);

        // Create the appropriate node (storing File for later base64 conversion)
        if (selectedRole.role === 'element') {
          // Create Element node with frontal image
          const node = createNode('element', position, {
            name: elementName.trim(),
            elementType: elementType!,
            frontalImageUrl: blobUrl,
            frontalThumbnail: thumbnailUrl,
            frontalFile: file,
            isHighlighted: false,
          });
          addNode(node);
          // Start background upload for element frontal image
          startElementFrontalUpload(node.id, file);
        } else if (fileRoleModal.fileType === 'image') {
          // Create Image node
          const node = createNode('image', position, {
            imageUrl: blobUrl,
            thumbnailUrl,
            fileName: file.name,
            fileSize: file.size,
            dimensions,
            role: selectedRole.role as 'reference' | 'start_frame' | 'end_frame',
            file, // Store original file for base64 conversion at generation time
            isHighlighted: false,
          });
          addNode(node);
          // Start background upload
          startUpload(node.id, file, 'image');
        } else {
          // Create Video node
          const node = createNode('video', position, {
            videoUrl: blobUrl,
            thumbnailUrl,
            fileName: file.name,
            fileSize: file.size,
            duration,
            dimensions,
            role: selectedRole.role as 'reference' | 'edit_source',
            file, // Store original file for base64 conversion at generation time
            isHighlighted: false,
          });
          addNode(node);
          // Start background upload
          startUpload(node.id, file, 'video');
        }
      }

      closeFileRoleModal();
      setSelectedRole(null);
      setShowElementConfig(false);
      setElementType(null);
      setElementName('');
    } catch (error) {
      console.error('Failed to process file:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [
    selectedRole,
    fileRoleModal,
    screenToFlowPosition,
    addNode,
    updateNode,
    closeFileRoleModal,
    startUpload,
    startElementFrontalUpload,
    elementType,
    elementName,
  ]);

  const handleClose = () => {
    closeFileRoleModal();
    setSelectedRole(null);
    setShowElementConfig(false);
    setElementType(null);
    setElementName('');
  };

  if (!fileRoleModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showElementConfig && (
              <button
                onClick={handleBackToRoles}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <h2 className="text-lg font-semibold">
              {showElementConfig
                ? 'Configure Element'
                : isUpdatingExistingNode
                  ? 'Update'
                  : 'Add'}{' '}
              {!showElementConfig &&
                (fileRoleModal.fileType === 'image' ? 'Image' : 'Video')}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="mb-4 aspect-video overflow-hidden rounded-lg bg-secondary">
          {fileRoleModal.fileType === 'image' ? (
            <img
              src={fileRoleModal.previewUrl}
              alt="Preview"
              className="h-full w-full object-contain"
            />
          ) : (
            <video
              src={fileRoleModal.previewUrl}
              className="h-full w-full object-contain"
              controls
              muted
            />
          )}
        </div>

        {showElementConfig ? (
          <>
            {/* Element Configuration Step */}
            <div className="mb-6 space-y-4">
              {/* Element Type Selection */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  What type of element is this?
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setElementType('character')}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all',
                      elementType === 'character'
                        ? 'border-[#EF4444] bg-[#EF4444]/10'
                        : 'border-border hover:border-muted-foreground/30 hover:bg-secondary/50'
                    )}
                  >
                    <User
                      className="h-5 w-5"
                      style={{ color: elementType === 'character' ? '#EF4444' : undefined }}
                    />
                    <span
                      className="font-medium"
                      style={{ color: elementType === 'character' ? '#EF4444' : undefined }}
                    >
                      Character
                    </span>
                  </button>
                  <button
                    onClick={() => setElementType('object')}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all',
                      elementType === 'object'
                        ? 'border-[#EF4444] bg-[#EF4444]/10'
                        : 'border-border hover:border-muted-foreground/30 hover:bg-secondary/50'
                    )}
                  >
                    <Box
                      className="h-5 w-5"
                      style={{ color: elementType === 'object' ? '#EF4444' : undefined }}
                    />
                    <span
                      className="font-medium"
                      style={{ color: elementType === 'object' ? '#EF4444' : undefined }}
                    >
                      Object
                    </span>
                  </button>
                </div>
              </div>

              {/* Element Name Input */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  {elementType === 'character' ? 'Character Name' : elementType === 'object' ? 'Object Name' : 'Name'}
                </div>
                <input
                  type="text"
                  value={elementName}
                  onChange={(e) => setElementName(e.target.value)}
                  placeholder={elementType === 'character' ? 'e.g., Luna, Hero, Villain' : 'e.g., Magic Sword, Crystal'}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleBackToRoles}
                className="flex-1 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary/80"
                disabled={isProcessing}
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={!elementType || !elementName.trim() || isProcessing}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                  elementType && elementName.trim() && !isProcessing
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'cursor-not-allowed bg-secondary text-muted-foreground'
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Create Element'
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* File name */}
            <div className="mb-4 truncate text-sm text-muted-foreground">
              {fileRoleModal.file?.name}
            </div>

            {/* Role Options */}
            <div className="mb-6 space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                How would you like to use this{' '}
                {fileRoleModal.fileType === 'image' ? 'image' : 'video'}?
              </div>
              <div className="space-y-2">
                {options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSelectedRole(option)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition-all',
                      selectedRole?.id === option.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30 hover:bg-secondary/50'
                    )}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: option.color
                          ? `${option.color}20`
                          : 'var(--color-secondary)',
                        color: option.color || 'var(--color-muted-foreground)',
                      }}
                    >
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <div
                        className="font-medium"
                        style={{ color: option.color || 'inherit' }}
                      >
                        {option.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary/80"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleProceed}
                disabled={!selectedRole || isProcessing}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                  selectedRole && !isProcessing
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'cursor-not-allowed bg-secondary text-muted-foreground'
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : isUpdatingExistingNode ? (
                  'Update Node'
                ) : selectedRole?.role === 'element' ? (
                  'Next'
                ) : (
                  'Add to Canvas'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
