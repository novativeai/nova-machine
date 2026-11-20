'use client';

import { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertTriangle, AudioLines, DollarSign, Key, Mic, X, Film, Image as ImageIcon, Volume2, VolumeX } from 'lucide-react';
import { TextureButton } from '@/components/ui';
import type {
  AudioKind,
  MusicModelId,
  SoundModelId,
  SpeechModelId,
  ImageModelId,
  LipSyncModelId,
  LipSyncResolution,
  PromptNodeData,
  PromptMode,
  VideoAspectRatio,
  VideoDuration,
  VideoModelId,
  VideoResolution,
  ImageNodeData,
  VideoNodeData,
  ElementNodeData,
  OutputNodeData,
  TagType,
} from '@/types';
import { useCanvasStore, useGenerationStore, useSettingsStore } from '@/stores';
import { useGeneration } from '@/hooks';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_LIPSYNC_MODEL,
  DEFAULT_VIDEO_MODEL,
  formatUsd,
  getModelDisplayName,
  IMAGE_ASPECT_RATIOS,
  IMAGE_MODEL_ORDER,
  IMAGE_MODELS,
  LIPSYNC_MODEL_ORDER,
  LIPSYNC_MODELS,
  planGeneration,
  VIDEO_MODEL_ORDER,
  VIDEO_MODELS,
  parseTags,
  getTagColor,
  formatNameAsTag,
  isValidNameForTag,
  parseNameTags,
} from '@/lib/fal';
import { cn } from '@/lib/utils';
import { HashtagBadges } from './HashtagBadges';
import { TimelineToggle } from '@/components/timeline/TimelineToggle';
import { ModelPicker, type ModelOption } from '@/components/prompt/ModelPicker';
import { AUDIO_KIND_LABEL, AUDIO_MODEL_ORDER, getAudioModel, selectedAudioModel } from '@/lib/fal/audio-models';
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
  const { updateNode, removeNode, getConnectedInputs, getGenerationInputs, getEdgeTag, nodes, edges, highlightNode, clearHighlights } =
    useCanvasStore();
  const { startGeneration } = useGeneration();
  // Per-node generation check — only re-renders when THIS node's generation state changes
  const isThisNodeGenerating = useGenerationStore(
    useCallback((state) => Object.values(state.activeGenerations).some(
      (g) => g.promptNodeId === id
    ), [id])
  );

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

  // Build suggestions for autocomplete - use edge-specific tags for per-prompt scoping
  // For elements with valid names, use name-based tags (e.g., @Alice instead of @Element1)
  const tagSuggestions: TagSuggestion[] = useMemo(() => {
    const suggestions: TagSuggestion[] = [];

    for (const node of connectedNodes) {
      // Get the edge-specific tag for THIS prompt (not the node's first-assigned tag)
      const edgeTag = getEdgeTag(node.id, id);
      if (!edgeTag) continue;

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

      // For elements with valid names, use the name as the display tag
      // e.g., "Alice" becomes "@Alice", "John Doe" becomes "@John_Doe"
      let displayTag = edgeTag;
      let elementTag: string | undefined;

      if (node.type === 'element' && name && isValidNameForTag(name)) {
        displayTag = formatNameAsTag(name);
        elementTag = edgeTag; // Keep original element tag for API
      }

      suggestions.push({
        tag: displayTag,
        type: tagType,
        nodeId: node.id,
        thumbnail,
        name,
        elementTag, // Only set for elements with name-based tags
      });
    }

    return suggestions;
  }, [connectedNodes, getEdgeTag, id]);

  // Tag autocomplete hook
  const autocomplete = useTagAutocomplete(textareaRef, tagSuggestions);

  // Endpoint + estimated cost, from the same planner useGeneration uses.
  // Reads connected nodes fresh so role/duration changes on inputs are reflected.
  const generationInputs = useMemo(
    () => getGenerationInputs(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getGenerationInputs, id, nodes, edges]
  );
  const plan = useMemo(
    () => planGeneration({ ...data, prompt: localPrompt }, generationInputs),
    [data, localPrompt, generationInputs]
  );
  const category = plan.category;
  const isLipSync = category === 'lipsync';

  // Every model of the active category, priced for the current inputs and settings
  const modelOptions = useMemo((): Array<ModelOption<string>> => {
    const draft = { ...data, prompt: localPrompt };
    const price = (override: Partial<PromptNodeData>) => {
      const p = planGeneration({ ...draft, ...override }, generationInputs);
      return { costUsd: p.costUsd, isEstimate: p.isEstimate, blocker: p.blocker };
    };
    if (category === 'image') {
      return IMAGE_MODEL_ORDER.map((m) => ({ ...IMAGE_MODELS[m], ...price({ imageModel: m }) }));
    }
    if (category === 'lipsync') {
      return LIPSYNC_MODEL_ORDER.map((m) => ({ ...LIPSYNC_MODELS[m], ...price({ lipSyncModel: m }) }));
    }
    if (category === 'speech') {
      return AUDIO_MODEL_ORDER.speech.map((m) => ({ ...getAudioModel(m), ...price({ speechModel: m as SpeechModelId }) }));
    }
    if (category === 'sound') {
      return AUDIO_MODEL_ORDER.sound.map((m) => ({ ...getAudioModel(m), ...price({ soundModel: m as SoundModelId }) }));
    }
    if (category === 'music') {
      return AUDIO_MODEL_ORDER.music.map((m) => ({ ...getAudioModel(m), ...price({ musicModel: m as MusicModelId }) }));
    }
    return VIDEO_MODEL_ORDER.map((m) => ({ ...VIDEO_MODELS[m], ...price({ videoModel: m }) }));
  }, [category, data, localPrompt, generationInputs]);
  const isAudioMode = data.mode === 'audio';
  const audioSpec = isAudioMode ? selectedAudioModel(data) : null;
  const selectedModelId =
    category === 'image'
      ? data.imageModel ?? DEFAULT_IMAGE_MODEL
      : category === 'lipsync'
        ? data.lipSyncModel ?? DEFAULT_LIPSYNC_MODEL
        : audioSpec
          ? audioSpec.id
          : data.videoModel ?? DEFAULT_VIDEO_MODEL;
  const handleModelChange = useCallback(
    (modelId: string) => {
      if (category === 'image') updateNode(id, { imageModel: modelId as ImageModelId });
      else if (category === 'lipsync') updateNode(id, { lipSyncModel: modelId as LipSyncModelId });
      else if (category === 'speech') updateNode(id, { speechModel: modelId as SpeechModelId, voice: undefined });
      else if (category === 'sound') updateNode(id, { soundModel: modelId as SoundModelId });
      else if (category === 'music') updateNode(id, { musicModel: modelId as MusicModelId });
      else updateNode(id, { videoModel: modelId as VideoModelId });
    },
    [category, id, updateNode]
  );

  // Check if user has API key configured
  const hasApiKey = useSettingsStore((s) => s.falApiKey.length > 0);

  // Estimated fal.ai cost in USD, and how it was computed
  const estimatedCost = plan.costUsd;
  const costBreakdown = plan.breakdown;

  // Build a map of name tags to their info for parsing
  const nameTagMap = useMemo(() => {
    const map = new Map<string, { type: TagType; elementTag: string; nodeId: string }>();
    for (const suggestion of tagSuggestions) {
      if (suggestion.elementTag) {
        // This is a name-based tag (e.g., @Alice -> @Element1)
        map.set(suggestion.tag, {
          type: suggestion.type,
          elementTag: suggestion.elementTag,
          nodeId: suggestion.nodeId,
        });
      }
    }
    return map;
  }, [tagSuggestions]);

  // Parse all tags from prompt - both standard (@Element1) and name-based (@Alice)
  const parsedTags = useMemo(() => {
    const standardTags = parseTags(localPrompt);
    const nameTags = parseNameTags(localPrompt, Array.from(nameTagMap.keys()));

    // Convert name tags to a compatible format with type info
    const enrichedNameTags = nameTags.map((nt) => {
      const info = nameTagMap.get(nt.tag);
      return {
        tag: nt.tag,
        type: info?.type || ('element' as TagType),
        index: 0,
        startPosition: nt.startPosition,
        endPosition: nt.endPosition,
        isNameTag: true,
        nodeId: info?.nodeId,
      };
    });

    // Combine and sort by position
    return [...standardTags, ...enrichedNameTags].sort(
      (a, b) => a.startPosition - b.startPosition
    );
  }, [localPrompt, nameTagMap]);

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
        // Check if it's a name tag with nodeId already attached
        const isNameTag = 'isNameTag' in tagMatch && tagMatch.isNameTag;
        let nodeId: string | undefined;

        if (isNameTag && 'nodeId' in tagMatch) {
          nodeId = tagMatch.nodeId as string;
        } else {
          // Find by matching the tag (for standard tags like @Element1)
          const node = tagSuggestions.find((s) => s.tag === tagMatch.tag || s.elementTag === tagMatch.tag);
          nodeId = node?.nodeId;
        }

        if (nodeId) {
          const color = getTagColor(tagMatch.type);
          highlightNode(nodeId, color);
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

  // Auto-dismiss errors after 8 seconds
  useEffect(() => {
    if (!data.error) return;

    const timeoutId = setTimeout(() => {
      updateNode(id, { error: undefined });
    }, 8000);

    return () => clearTimeout(timeoutId);
  }, [data.error, id, updateNode]);

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
    if (isThisNodeGenerating) return;

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
  }, [id, isThisNodeGenerating, startGeneration, updateNode, localPrompt]);

  // Show loading shimmer on THIS node when it's generating
  const isGenerating = data.status === 'generating';
  const isImageMode = data.mode === 'image';

  // A prompt is required, except lip-sync where the audio (plus a face or clip) drives the video
  const canGenerate = (localPrompt.trim().length > 0 || isLipSync) && !plan.blocker && !isThisNodeGenerating;

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
          <TimelineToggle nodeId={id} />
          <div className={cn(
            'flex h-6 w-6 items-center justify-center rounded',
            isImageMode ? 'bg-blue-500/20' : isAudioMode ? 'bg-emerald-500/20' : 'bg-primary/20'
          )}>
            {isImageMode ? (
              <ImageIcon className="h-3.5 w-3.5 text-blue-500" />
            ) : isAudioMode ? (
              <AudioLines className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Film className="h-3.5 w-3.5 text-primary" />
            )}
          </div>
          <span className="text-sm font-medium">Prompt</span>
          {isLipSync && (
            <span className="flex items-center gap-1 rounded bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-medium text-pink-300" title="Audio is wired in: this prompt makes a lip-synced performance">
              <Mic className="h-2.5 w-2.5" />
              Lip-sync
            </span>
          )}
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
              data.mode === 'video'
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            disabled={isGenerating}
          >
            <Film className="h-3 w-3" />
            Video
          </button>
          <button
            onClick={() => updateNode(id, { mode: 'audio' as PromptMode })}
            className={cn(
              'flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-all',
              isAudioMode
                ? 'bg-background text-emerald-400 shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            disabled={isGenerating}
            title="Speech, sound and music"
          >
            <AudioLines className="h-3 w-3" />
            Audio
          </button>
        </div>
      </div>

      {/* Audio kind: speech / sound (speech + effects) / music */}
      {isAudioMode && (
        <div className="mb-2 grid grid-cols-3 gap-1 rounded-lg bg-secondary p-0.5" onMouseDown={(e) => e.stopPropagation()}>
          {(['speech', 'sound', 'music'] as const).map((kind: AudioKind) => (
            <button
              key={kind}
              type="button"
              onClick={() => updateNode(id, { audioKind: kind })}
              disabled={isGenerating}
              className={cn(
                'rounded-md py-1 text-[11px] font-medium transition-all',
                (data.audioKind ?? 'speech') === kind ? 'bg-background text-emerald-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              title={kind === 'sound' ? 'Dialogue, effects and ambience in one model' : undefined}
            >
              {AUDIO_KIND_LABEL[kind]}
            </button>
          ))}
        </div>
      )}

      {/* Model picker (per category) */}
      <div className="mb-2">
        <ModelPicker
          category={category}
          value={selectedModelId}
          options={modelOptions}
          onChange={handleModelChange}
          disabled={isGenerating}
        />
      </div>

      {/* Endpoint & cost */}
      <div className="mb-2 rounded bg-secondary px-2 py-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {getModelDisplayName(plan.endpoint)}
          </span>
          <span
            className="flex items-center gap-1 text-xs font-medium text-white/60"
            title="Estimated cost, billed by fal.ai to your own account"
          >
            <DollarSign className="h-3 w-3" />
            {plan.isEstimate ? '~' : ''}{formatUsd(estimatedCost).replace('$', '')}
          </span>
        </div>
        <div className="mt-0.5 text-[10px] leading-snug text-white/35">
          {costBreakdown}
          {plan.isEstimate && ' · estimate'}
        </div>
        {plan.notes.length > 0 && (
          <div className="mt-0.5 text-[10px] leading-snug text-white/45">{plan.notes.join(' · ')}</div>
        )}
      </div>

      {plan.blocker && (
        <div className="mb-2 flex items-start gap-1.5 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[11px] leading-snug text-amber-300/90">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{plan.blocker}</span>
        </div>
      )}

      {/* Connected Tags Preview - Video mode only */}
      {!isImageMode && tagSuggestions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {tagSuggestions.map((suggestion) => {
            const color = getTagColor(suggestion.type);
            // Check if tag is used - matches display tag OR element tag (backwards compatible)
            const isUsed = parsedTags.some((t) =>
              t.tag === suggestion.tag || (suggestion.elementTag && t.tag === suggestion.elementTag)
            );
            return (
              <span
                key={suggestion.nodeId}
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
            ? 'Describe your image... Type @ to reference connected nodes'
            : isAudioMode
              ? (data.audioKind ?? 'speech') === 'speech'
                ? 'Text to speak... audio tags like [whispers] or [laughs] direct the delivery'
                : (data.audioKind ?? 'speech') === 'sound'
                  ? 'Describe the scene: dialogue, sound effects, ambience...'
                  : 'Describe the song: genre, mood, tempo, vocals, structure, length...'
              : isLipSync
              ? 'Optional: direct the performance (mood, gestures, camera)...'
              : 'Describe your video... Type @ to reference connected nodes'
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

      {/* Settings Row - adapts to the chosen model */}
      <div className="mb-3 flex gap-2" onMouseDown={(e) => e.stopPropagation()}>
        {plan.image && (
          <>
            <select
              value={data.imageAspectRatio}
              onChange={(e) => updateNode(id, { imageAspectRatio: e.target.value as PromptNodeData['imageAspectRatio'] })}
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none disabled:opacity-50"
              disabled={isGenerating || plan.image.edit}
              title={plan.image.edit ? 'Edits follow the input images' : 'Aspect ratio'}
            >
              {IMAGE_ASPECT_RATIOS.map((ratio) => (
                <option key={ratio} value={ratio}>{ratio}</option>
              ))}
            </select>
            <select
              value={plan.image.resolution}
              onChange={(e) => updateNode(id, { imageResolution: e.target.value as PromptNodeData['imageResolution'] })}
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              disabled={isGenerating}
              title="Resolution"
            >
              {plan.image.spec.resolutions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </>
        )}

        {plan.video && (
          <>
            <select
              value={String(plan.video.durationSeconds)}
              onChange={(e) => updateNode(id, { duration: e.target.value as VideoDuration })}
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none disabled:opacity-50"
              disabled={isGenerating || plan.video.editing || (plan.video.route === 'reference' && Boolean(plan.video.spec.referenceDuration))}
              title={plan.video.editing ? 'Follows the source video' : 'Duration'}
            >
              {plan.video.spec.durations.map((d) => (
                <option key={d} value={String(d)}>{d}s</option>
              ))}
            </select>
            <select
              value={plan.video.aspectRatio}
              onChange={(e) => updateNode(id, { aspectRatio: e.target.value as VideoAspectRatio })}
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none disabled:opacity-50"
              disabled={isGenerating || plan.video.aspectFollowsFrame || plan.video.editing}
              title={plan.video.aspectFollowsFrame ? 'Follows the start frame' : 'Aspect ratio'}
            >
              {plan.video.spec.aspectRatios.map((ratio) => (
                <option key={ratio} value={ratio}>{ratio}</option>
              ))}
            </select>
            <select
              value={plan.video.resolution}
              onChange={(e) => updateNode(id, { videoResolution: e.target.value as VideoResolution })}
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              disabled={isGenerating}
              title="Resolution"
            >
              {plan.video.spec.resolutions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {plan.video.spec.audio === 'toggle' ? (
              <button
                type="button"
                onClick={() => updateNode(id, { generateAudio: !data.generateAudio })}
                className={cn(
                  'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded border transition-all',
                  data.generateAudio
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                )}
                disabled={isGenerating}
                title={data.generateAudio ? 'Native audio on' : 'Native audio off'}
              >
                {data.generateAudio ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded border border-border text-muted-foreground/60"
                title={plan.video.spec.audio === 'always' ? 'Native audio is always on for this model' : 'This model renders silent video'}
              >
                {plan.video.spec.audio === 'always' ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </span>
            )}
          </>
        )}

        {plan.audio && (
          <>
            {plan.audio.spec.voices && (
              <select
                value={data.voice && plan.audio.spec.voices.includes(data.voice) ? data.voice : plan.audio.spec.defaultVoice}
                onChange={(e) => updateNode(id, { voice: e.target.value })}
                className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                disabled={isGenerating}
                title="Voice"
              >
                {plan.audio.spec.voices.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            )}
            {plan.audio.spec.length && (
              <label className="flex flex-1 items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs" title="Length in seconds">
                <input
                  type="number"
                  min={plan.audio.spec.length.min}
                  max={plan.audio.spec.length.max}
                  step={plan.audio.spec.length.min < 1 ? 0.5 : 1}
                  value={plan.audio.seconds}
                  onChange={(e) => updateNode(id, { audioSeconds: Number(e.target.value) })}
                  className="w-full bg-transparent focus:outline-none"
                  disabled={isGenerating}
                />
                <span className="text-white/40">s</span>
              </label>
            )}
            {plan.audio.spec.instrumentalToggle && (
              <button
                type="button"
                onClick={() => updateNode(id, { instrumental: !data.instrumental })}
                className={cn(
                  'rounded border px-2 py-1.5 text-[11px] transition-all',
                  data.instrumental ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-border bg-background text-muted-foreground'
                )}
                disabled={isGenerating}
              >
                Instrumental
              </button>
            )}
            {!plan.audio.spec.voices && !plan.audio.spec.length && !plan.audio.spec.instrumentalToggle && (
              <span className="flex flex-1 items-center rounded border border-border px-2 py-1.5 text-[11px] text-white/50">
                {plan.audio.spec.kind === 'music' ? 'Set length and structure in the prompt' : 'Length follows the prompt'}
              </span>
            )}
          </>
        )}

        {plan.lipsync && (
          <>
            <span className="flex flex-1 items-center rounded border border-border px-2 py-1.5 text-[11px] text-white/60" title="How the lip-sync source was picked">
              {plan.lipsync.route === 'video'
                ? 'Re-sync connected clip'
                : plan.lipsync.route === 'image'
                  ? 'Animate connected face'
                  : 'Portrait from prompt → lip-sync'}
            </span>
            {plan.lipsync.route === 'generated-face' && (
              <select
                value={data.aspectRatio}
                onChange={(e) => updateNode(id, { aspectRatio: e.target.value as VideoAspectRatio })}
                className="w-20 rounded border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                disabled={isGenerating}
                title="Portrait aspect ratio"
              >
                {(['16:9', '9:16', '1:1', '4:3', '3:4'] as const).map((ratio) => (
                  <option key={ratio} value={ratio}>{ratio}</option>
                ))}
              </select>
            )}
            {plan.lipsync.spec.resolutions.length > 0 && (
              <select
                value={plan.lipsync.resolution}
                onChange={(e) => updateNode(id, { lipSyncResolution: e.target.value as LipSyncResolution })}
                className="w-20 rounded border border-border bg-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                disabled={isGenerating}
                title="Resolution"
              >
                {plan.lipsync.spec.resolutions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
          </>
        )}
      </div>

      {plan.audio && plan.audio.spec.lyrics !== 'none' && !(plan.audio.spec.instrumentalToggle && data.instrumental) && (
        <textarea
          value={data.lyrics ?? ''}
          onChange={(e) => updateNode(id, { lyrics: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder={plan.audio.spec.lyrics === 'required' ? 'Lyrics (required): [verse] ... [chorus] ...' : 'Lyrics (optional): [verse] ... [chorus] ...'}
          rows={4}
          className="nodrag nowheel mb-3 w-full resize-none rounded-lg border border-border bg-transparent p-2 text-xs leading-snug focus:border-primary focus:outline-none"
          disabled={isGenerating}
        />
      )}

      {/* Generate Button */}
      {!hasApiKey ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <Key className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span className="text-xs text-amber-300/80">
            Add your own fal.ai API key (key icon in the header) to generate. It stays in your browser and is sent only to fal.ai.
          </span>
        </div>
      ) : (
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
              : isAudioMode
                ? `Generate ${AUDIO_KIND_LABEL[data.audioKind ?? 'speech']}`
                : isLipSync
                ? 'Generate Lip-sync'
                : 'Generate Video'
          }
        </TextureButton>
      )}

      {/* Error Status */}
      {data.error && (
        <div className="mt-2 flex items-start gap-1.5 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
          <span className="flex-1">{data.error}</span>
          <button
            onClick={() => updateNode(id, { error: undefined })}
            className="mt-0.5 rounded p-0.5 transition-colors hover:bg-destructive/20"
            title="Dismiss error"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Connected Inputs Info - Video mode only */}
      {!isImageMode && connectedNodes.length > 0 && !tagSuggestions.length && (
        <div className="mt-2 text-xs text-muted-foreground">
          {connectedNodes.length} input{connectedNodes.length !== 1 ? 's' : ''}{' '}
          connected (assign tags to reference them)
        </div>
      )}

      {/* Hashtag badges */}
      <HashtagBadges nodeId={id} />

      {/* Output Handle */}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  );
}

export const PromptNode = memo(PromptNodeComponent);
