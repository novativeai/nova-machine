'use client';

import { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play, Loader2, Settings2, DollarSign, X, Film, Image as ImageIcon } from 'lucide-react';
import { TextureButton } from '@/components/ui';
import type {
  PromptNodeData,
  PromptMode,
  ImageNodeData,
  VideoNodeData,
  ElementNodeData,
  OutputNodeData,
  TagType,
  KlingModel,
  NanoBananaModel,
} from '@/types';
import { useCanvasStore } from '@/stores';
import { useGeneration } from '@/hooks';
import {
  selectModel,
  selectImageModel,
  getModelDisplayName,
  parseTags,
  getTagColor,
  calculateCost,
  calculateImageCost,
} from '@/lib/fal';
import { cn, formatCost } from '@/lib/utils';
import {
  TagAutocomplete,
  useTagAutocomplete,
  type TagSuggestion,
} from '@/components/prompt/TagAutocomplete';

interface PromptNodeProps {
  id: string;
  data: PromptNodeData;
  selected?: boolean;
}

function PromptNodeComponent({ id, data, selected }: PromptNodeProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { updateNode, removeNode, getConnectedInputs, nodes, edges, highlightNode, clearHighlights } =
    useCanvasStore();
  const { startGeneration, isGenerating: isGeneratingGlobal } = useGeneration();

  // Local state for prompt to prevent cursor jumping
  const [localPrompt, setLocalPrompt] = useState(data.prompt);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local prompt from store when it changes externally (e.g., tag insertion)
  useEffect(() => {
    if (data.prompt !== localPrompt) {
      setLocalPrompt(data.prompt);
    }
    // Only sync when store changes, not when local changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.prompt]);

  // Create a stable key for tag-related node changes (excludes isHighlighted to prevent loops)
  // Include element names so autocomplete updates when names change
  const nodeTagsKey = useMemo(() => {
    return nodes
      .filter((n) => n.type === 'image' || n.type === 'element' || n.type === 'video' || n.type === 'output')
      .map((n) => {
        const tag = (n.data as { tagAssignment?: string }).tagAssignment || '';
        const name = n.type === 'element' ? (n.data as ElementNodeData).name : '';
        return `${n.id}:${tag}:${name}`;
      })
      .join(',');
  }, [nodes]);

  // Get connected nodes - depends on edges and nodeTagsKey (not full nodes to avoid highlight loops)
  const connectedNodes = useMemo(() => {
    return getConnectedInputs(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getConnectedInputs, id, edges, nodeTagsKey]);

  // Build suggestions for autocomplete
  const tagSuggestions: TagSuggestion[] = useMemo(() => {
    return connectedNodes
      .filter((node) => {
        const nodeData = node.data as { tagAssignment?: string };
        return nodeData.tagAssignment;
      })
      .map((node) => {
        const nodeData = node.data as ImageNodeData | VideoNodeData | ElementNodeData | OutputNodeData;
        // For output nodes, use their outputType to determine the tag type
        const tagType: TagType = node.type === 'output'
          ? ((nodeData as OutputNodeData).outputType as TagType)
          : (node.type as TagType);

        // Get thumbnail based on node type
        let thumbnail: string | undefined;
        if (node.type === 'element') {
          thumbnail = (nodeData as ElementNodeData).frontalThumbnail;
        } else {
          thumbnail = (nodeData as ImageNodeData | VideoNodeData | OutputNodeData).thumbnailUrl;
        }

        // Get name (only for element nodes)
        const name = node.type === 'element' ? (nodeData as ElementNodeData).name : undefined;

        return {
          tag: (nodeData as { tagAssignment: string }).tagAssignment,
          type: tagType,
          nodeId: node.id,
          thumbnail,
          name,
        };
      });
  }, [connectedNodes]);

  // Tag autocomplete hook
  const autocomplete = useTagAutocomplete(textareaRef, tagSuggestions);

  // Determine selected model based on mode
  const selectedModel = useMemo((): KlingModel | NanoBananaModel | null => {
    const isImageMode = data.mode === 'image';

    if (isImageMode) {
      // Image mode: use nano-banana-pro
      // Text-to-image if no inputs, image-edit if has inputs
      const inputs = connectedNodes.map((node) => ({
        nodeId: node.id,
        nodeType: node.type,
        handleId: '',
        tag: undefined, // No tags in image mode
        outputType: node.type === 'output' ? (node.data as OutputNodeData).outputType : undefined,
      }));
      return selectImageModel(inputs);
    }

    // Video mode: require connected nodes
    if (connectedNodes.length === 0) return null;

    try {
      const inputs = connectedNodes.map((node) => ({
        nodeId: node.id,
        nodeType: node.type,
        handleId: '',
        tag: (node.data as { tagAssignment?: string }).tagAssignment,
        outputType: node.type === 'output' ? (node.data as OutputNodeData).outputType : undefined,
      }));

      return selectModel(inputs, localPrompt);
    } catch {
      return null;
    }
  }, [connectedNodes, localPrompt, data.mode]);

  // Calculate estimated cost based on mode
  const estimatedCost = useMemo(() => {
    if (!selectedModel) return null;

    if (data.mode === 'image') {
      return calculateImageCost(selectedModel as NanoBananaModel, data.imageResolution);
    }

    const durationSeconds = parseInt(data.duration, 10);
    return calculateCost(selectedModel as KlingModel, durationSeconds);
  }, [selectedModel, data.duration, data.mode, data.imageResolution]);

  // Parse tags from prompt and highlight nodes
  const parsedTags = useMemo(() => parseTags(localPrompt), [localPrompt]);

  // Highlight nodes when tags are in prompt (debounced to prevent border flashing)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    // Debounce highlight updates to prevent flashing
    highlightTimeoutRef.current = setTimeout(() => {
      clearHighlights();

      parsedTags.forEach((tagMatch) => {
        const node = tagSuggestions.find((s) => s.tag === tagMatch.tag);
        if (node) {
          const color = getTagColor(tagMatch.type);
          highlightNode(node.nodeId, color);
        }
      });
    }, 300); // Longer debounce to prevent flashing

    // Only clear highlights on unmount, not on every update
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [parsedTags, tagSuggestions, highlightNode, clearHighlights]);

  // Clear highlights on unmount only
  useEffect(() => {
    return () => clearHighlights();
  }, [clearHighlights]);

  // Handle prompt change - use local state for immediate feedback, debounce store sync
  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setLocalPrompt(newValue);

      // Debounce store update to prevent re-renders that cause cursor jumping
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        updateNode(id, { prompt: newValue });
      }, 150);
    },
    [id, updateNode]
  );

  // Cleanup sync timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Handle input with autocomplete check
  const handleInput = useCallback(() => {
    autocomplete.checkForTrigger();
  }, [autocomplete]);

  // Handle tag selection from autocomplete
  const handleTagSelect = useCallback(
    (tag: string) => {
      const newText = autocomplete.insertTag(tag);
      if (newText) {
        updateNode(id, { prompt: newText });
      }
    },
    [autocomplete, updateNode, id]
  );

  // Handle generate
  const handleGenerate = useCallback(async () => {
    if (!selectedModel || isGeneratingGlobal) return;

    // Sync local prompt to store immediately before generation
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    updateNode(id, { prompt: localPrompt });

    try {
      await startGeneration(id);
    } catch (error) {
      console.error('Generation failed:', error);
      updateNode(id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Generation failed',
      });
    }
  }, [id, selectedModel, isGeneratingGlobal, startGeneration, updateNode, localPrompt]);

  // Only show loading shimmer on THIS node when it's generating
  // (isGeneratingGlobal is still used to disable buttons and prevent multiple simultaneous generations)
  const isGenerating = data.status === 'generating';
  const isImageMode = data.mode === 'image';

  // In image mode, we can generate with just a prompt (text-to-image)
  // In video mode, we need connected nodes
  const canGenerate = isImageMode
    ? localPrompt.trim().length > 0 && selectedModel && !isGeneratingGlobal
    : connectedNodes.length > 0 && localPrompt.trim().length > 0 && selectedModel && !isGeneratingGlobal;

  // Render prompt with highlighted tags
  const renderPromptWithTags = () => {
    if (!localPrompt) return null;

    let lastIndex = 0;
    const elements: React.ReactNode[] = [];

    parsedTags.forEach((tag, i) => {
      // Add text before tag
      if (tag.startPosition > lastIndex) {
        elements.push(
          <span key={`text-${i}`}>
            {localPrompt.slice(lastIndex, tag.startPosition)}
          </span>
        );
      }

      // Add highlighted tag - NO padding to maintain cursor alignment
      const color = getTagColor(tag.type);
      elements.push(
        <mark
          key={`tag-${i}`}
          className="rounded-sm"
          style={{
            backgroundColor: `${color}30`,
            color: color,
            // Use box-decoration-break for multi-line tags
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
          }}
        >
          {tag.tag}
        </mark>
      );

      lastIndex = tag.endPosition;
    });

    // Add remaining text
    if (lastIndex < localPrompt.length) {
      elements.push(<span key="text-end">{localPrompt.slice(lastIndex)}</span>);
    }

    return elements;
  };

  return (
    <div
      className={cn(
        'nova-node w-80 relative',
        selected && 'selected',
        isGenerating && 'generating-shimmer'
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

      {/* Input Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="input-1"
        style={{ top: '30%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input-2"
        style={{ top: '50%' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="input-3"
        style={{ top: '70%' }}
      />

      {/* Header - Drag Handle */}
      <div className="nova-drag-handle mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex h-6 w-6 items-center justify-center rounded',
            isImageMode ? 'bg-blue-500/20' : 'bg-primary/20'
          )}>
            {isImageMode ? (
              <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
            ) : (
              <Film className="h-3.5 w-3.5 text-primary" />
            )}
          </div>
          <span className="text-sm font-medium">Prompt</span>
        </div>

        {/* Mode Switcher */}
        <div
          className="flex h-7 items-center rounded-lg bg-secondary p-0.5"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => updateNode(id, { mode: 'image' as PromptMode })}
            className={cn(
              'flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-all',
              isImageMode
                ? 'bg-background text-blue-500 shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            disabled={isGenerating}
          >
            <ImageIcon className="h-3 w-3" />
            Image
          </button>
          <button
            onClick={() => updateNode(id, { mode: 'video' as PromptMode })}
            className={cn(
              'flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-all',
              !isImageMode
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            disabled={isGenerating}
          >
            <Film className="h-3 w-3" />
            Video
          </button>
        </div>
      </div>

      {/* Model & Cost Indicator */}
      {selectedModel && (
        <div className="mb-2 flex items-center justify-between rounded bg-secondary px-2 py-1">
          <span className="text-xs text-muted-foreground">
            {getModelDisplayName(selectedModel)}
          </span>
          {estimatedCost !== null && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <DollarSign className="h-3 w-3" />
              {formatCost(estimatedCost)}
            </span>
          )}
        </div>
      )}

      {/* Connected Tags Preview - Video mode only */}
      {!isImageMode && tagSuggestions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {tagSuggestions.map((suggestion) => {
            const color = getTagColor(suggestion.type);
            const isUsed = parsedTags.some((t) => t.tag === suggestion.tag);
            return (
              <span
                key={suggestion.tag}
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs transition-all',
                  !isUsed && 'opacity-60'
                )}
                style={{
                  backgroundColor: `${color}20`,
                  color: color,
                  boxShadow: isUsed ? `0 0 0 1px ${color}, 0 0 0 3px var(--background)` : undefined,
                }}
              >
                {suggestion.tag}
              </span>
            );
          })}
        </div>
      )}

      {/* Connected Images Indicator - Image mode only */}
      {isImageMode && connectedNodes.length > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded bg-blue-500/10 px-2 py-1">
          <ImageIcon className="h-3 w-3 text-blue-500" />
          <span className="text-xs text-blue-500">
            {connectedNodes.length} image{connectedNodes.length !== 1 ? 's' : ''} connected
          </span>
        </div>
      )}

      {/* Prompt Input with Autocomplete */}
      <div className="relative mb-3">
        {/* Background layer with highlighted tags - must match textarea exactly */}
        <div
          className="pointer-events-none absolute inset-0 min-h-28 max-h-48 overflow-y-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-transparent p-2 text-sm leading-normal font-normal tracking-normal"
          style={{ wordSpacing: 'normal' }}
          aria-hidden="true"
          ref={(el) => {
            // Sync scroll position with textarea
            if (el && textareaRef.current) {
              el.scrollTop = textareaRef.current.scrollTop;
            }
          }}
        >
          {renderPromptWithTags()}
        </div>

        {/* Transparent textarea for input - styles must match overlay exactly */}
        <textarea
          ref={textareaRef}
          value={localPrompt}
          onChange={handlePromptChange}
          onInput={handleInput}
          onScroll={(e) => {
            // Sync overlay scroll with textarea
            const overlay = e.currentTarget.previousSibling as HTMLElement;
            if (overlay) {
              overlay.scrollTop = e.currentTarget.scrollTop;
            }
          }}
          onKeyDown={(e) => {
            if (autocomplete.isOpen && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
              e.stopPropagation();
            }
          }}
          placeholder={isImageMode
            ? "Describe your image..."
            : "Describe your video... Type @ to reference connected nodes"
          }
          className="relative min-h-28 max-h-48 w-full resize-none overflow-y-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-transparent p-2 text-sm leading-normal font-normal tracking-normal text-transparent caret-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          style={{
            wordSpacing: 'normal',
          }}
          disabled={isGenerating}
        />

        {/* Tag Autocomplete Dropdown */}
        <TagAutocomplete
          suggestions={autocomplete.suggestions}
          isOpen={autocomplete.isOpen}
          onSelect={handleTagSelect}
          onClose={autocomplete.close}
          position={autocomplete.position}
        />
      </div>

      {/* Settings Row - Different for Image vs Video mode */}
      <div className="mb-3 flex gap-2">
        {isImageMode ? (
          <>
            {/* Image Mode: Aspect Ratio and Resolution */}
            <select
              value={data.imageAspectRatio}
              onChange={(e) =>
                updateNode(id, {
                  imageAspectRatio: e.target.value as PromptNodeData['imageAspectRatio'],
                })
              }
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              disabled={isGenerating}
            >
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="4:3">4:3</option>
              <option value="3:4">3:4</option>
              <option value="3:2">3:2</option>
              <option value="2:3">2:3</option>
              <option value="21:9">21:9</option>
            </select>
            <select
              value={data.imageResolution}
              onChange={(e) =>
                updateNode(id, {
                  imageResolution: e.target.value as '1K' | '2K' | '4K',
                })
              }
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              disabled={isGenerating}
            >
              <option value="1K">1K</option>
              <option value="2K">2K</option>
              <option value="4K">4K (+$0.15)</option>
            </select>
          </>
        ) : (
          <>
            {/* Video Mode: Duration and Aspect Ratio */}
            <select
              value={data.duration}
              onChange={(e) =>
                updateNode(id, { duration: e.target.value as '5' | '10' })
              }
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              disabled={isGenerating}
            >
              <option value="5">5 seconds</option>
              <option value="10">10 seconds</option>
            </select>
            <select
              value={data.aspectRatio}
              onChange={(e) =>
                updateNode(id, {
                  aspectRatio: e.target.value as '16:9' | '9:16' | '1:1',
                })
              }
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              disabled={isGenerating}
            >
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
            </select>
          </>
        )}
      </div>

      {/* Generate Button */}
      <TextureButton
        onClick={handleGenerate}
        disabled={!canGenerate || isGenerating}
        variant={canGenerate && !isGenerating ? 'accent' : 'secondary'}
        className="w-full"
        loading={isGenerating}
      >
        {isGenerating
          ? `Generating... ${Math.round(data.progress)}%`
          : isImageMode
            ? 'Generate Image'
            : 'Generate Video'
        }
      </TextureButton>

      {/* Status */}
      {data.error && (
        <div className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {data.error}
        </div>
      )}

      {/* Connected Inputs Info - Video mode only */}
      {!isImageMode && connectedNodes.length > 0 && !tagSuggestions.length && (
        <div className="mt-2 text-xs text-muted-foreground">
          {connectedNodes.length} input{connectedNodes.length !== 1 ? 's' : ''}{' '}
          connected (assign tags to reference them)
        </div>
      )}

      {/* Output Handle */}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  );
}

export const PromptNode = memo(PromptNodeComponent);
