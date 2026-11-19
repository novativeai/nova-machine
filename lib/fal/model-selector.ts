import type {
  AudioNodeData,
  AudioToVideoModel,
  GenerationModel,
  ImageModel,
  ImageNodeData,
  NovaNode,
  OutputNodeData,
  PromptNodeData,
  VideoModel,
  VideoNodeData,
} from '@/types';
import {
  type CostEstimate,
  estimateAudioToVideoCost,
  estimateImageCost,
  estimateVideoCost,
  LTX_A2V_MAX_AUDIO_SECONDS,
} from './pricing';

/**
 * Edit intent keywords that switch a video reference to Seedance's 'editing' task
 */
const EDIT_KEYWORDS = [
  'edit',
  'change',
  'replace',
  'transform',
  'modify',
  'alter',
  'adjust',
  'convert',
  'turn into',
  'make it',
  'swap',
];

/**
 * Detect if the prompt indicates edit intent
 */
export function detectEditIntent(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  return EDIT_KEYWORDS.some((keyword) => lowerPrompt.includes(keyword));
}

// ============================================================================
// INPUT CLASSIFICATION
// ============================================================================

function isOutputOfType(node: NovaNode, type: 'image' | 'video'): boolean {
  if (node.type !== 'output') return false;
  const data = node.data as OutputNodeData;
  return data.role === 'reference' && data.outputType === type;
}

/** Audio node with a loaded file (drives LTX audio-to-video). */
export function getAudioSource(connectedNodes: NovaNode[]): NovaNode | undefined {
  return connectedNodes.find((n) => {
    if (n.type !== 'audio') return false;
    const data = n.data as AudioNodeData;
    return Boolean(data.audioUrl || data.remoteUrl || data.file);
  });
}

export function hasVideoReference(connectedNodes: NovaNode[]): boolean {
  return connectedNodes.some((n) => n.type === 'video' || isOutputOfType(n, 'video'));
}

/** Images used as references (not start/end frames), including output images converted to references. */
export function hasImageReference(connectedNodes: NovaNode[]): boolean {
  return connectedNodes.some(
    (n) =>
      (n.type === 'image' && (n.data as ImageNodeData).role === 'reference') ||
      isOutputOfType(n, 'image')
  );
}

export function hasFrameImage(connectedNodes: NovaNode[]): boolean {
  return connectedNodes.some((n) => {
    if (n.type !== 'image') return false;
    const role = (n.data as ImageNodeData).role;
    return role === 'start_frame' || role === 'end_frame';
  });
}

/** Seconds of every video reference (Seedance bills input + output duration when videos are referenced). */
export function getReferenceVideoSeconds(connectedNodes: NovaNode[]): number {
  return connectedNodes.reduce((total, n) => {
    if (n.type === 'video') return total + ((n.data as VideoNodeData).duration || 0);
    if (isOutputOfType(n, 'video')) return total + ((n.data as OutputNodeData).videoDuration || 0);
    return total;
  }, 0);
}

/** Video reference + edit wording → Seedance task 'editing' (otherwise 'reference'). */
export function isVideoEdit(prompt: string, connectedNodes: NovaNode[]): boolean {
  return hasVideoReference(connectedNodes) && detectEditIntent(prompt);
}

// ============================================================================
// MODEL SELECTION
// ============================================================================

/**
 * LTX 2.5 audio-to-video tier for a given audio length.
 * Pro accepts up to 10 s, Fast up to 20 s. Unknown length (0) defaults to Pro.
 */
export function selectAudioToVideoModel(audioSeconds: number): AudioToVideoModel {
  return audioSeconds > LTX_A2V_MAX_AUDIO_SECONDS.pro
    ? 'lightricks/ltx-2.5/audio-to-video/fast'
    : 'lightricks/ltx-2.5/audio-to-video/pro';
}

/**
 * Select the Seedance 2.5 endpoint for the connected inputs.
 *
 * 1. Video, element or reference-image inputs → reference-to-video
 *    (@Image / @Video tags map to image_urls / video_urls)
 * 2. Start/end frame images only → image-to-video
 * 3. Prompt only → text-to-video
 */
export function selectVideoModel(connectedNodes: NovaNode[]): VideoModel {
  const needsReference =
    hasVideoReference(connectedNodes) ||
    connectedNodes.some((n) => n.type === 'element') ||
    hasImageReference(connectedNodes);

  if (needsReference) return 'bytedance/seedance-2.5/us/reference-to-video';
  if (hasFrameImage(connectedNodes)) return 'bytedance/seedance-2.5/us/image-to-video';
  return 'bytedance/seedance-2.5/us/text-to-video';
}

/**
 * GPT Image 2.6: edit when any image (image node, element, output image) is connected.
 */
export function selectImageModel(connectedNodes: NovaNode[]): ImageModel {
  const hasImages = connectedNodes.some(
    (n) =>
      n.type === 'image' ||
      n.type === 'element' ||
      (n.type === 'output' && (n.data as OutputNodeData).outputType === 'image')
  );
  return hasImages ? 'openai/gpt-image-2.6/sunburst/edit' : 'openai/gpt-image-2.6/sunburst/text-to-image';
}

export interface GenerationPlan extends CostEstimate {
  model: GenerationModel;
  kind: 'video' | 'image' | 'audio-to-video';
}

/**
 * Single source of truth for which endpoint a prompt node will call and what it costs.
 * Used by the prompt node UI and by useGeneration.
 */
export function planGeneration(promptData: PromptNodeData, connectedNodes: NovaNode[]): GenerationPlan {
  if (promptData.mode === 'image') {
    const model = selectImageModel(connectedNodes);
    const estimate = estimateImageCost(promptData.imageAspectRatio, promptData.imageResolution);
    return model === 'openai/gpt-image-2.6/sunburst/edit'
      ? { model, kind: 'image', ...estimate, breakdown: `${estimate.breakdown}; final size follows the inputs` }
      : { model, kind: 'image', ...estimate };
  }

  const audioNode = getAudioSource(connectedNodes);
  if (audioNode) {
    const audioSeconds = (audioNode.data as AudioNodeData).duration || 0;
    const model = selectAudioToVideoModel(audioSeconds);
    if (audioSeconds > 0) {
      return { model, kind: 'audio-to-video', ...estimateAudioToVideoCost(model, audioSeconds) };
    }
    // Length unknown until the file's metadata loads: show the Pro maximum
    const estimate = estimateAudioToVideoCost(model, LTX_A2V_MAX_AUDIO_SECONDS.pro);
    return { model, kind: 'audio-to-video', ...estimate, breakdown: `up to ${estimate.breakdown}` };
  }

  const model = selectVideoModel(connectedNodes);
  const referenceVideoSeconds =
    model === 'bytedance/seedance-2.5/us/reference-to-video' ? getReferenceVideoSeconds(connectedNodes) : 0;
  // 'editing' coerces duration to auto: the output matches the source video's length
  const outputSeconds =
    referenceVideoSeconds > 0 && isVideoEdit(promptData.prompt, connectedNodes)
      ? referenceVideoSeconds
      : parseInt(promptData.duration, 10);
  return {
    model,
    kind: 'video',
    ...estimateVideoCost(promptData.videoResolution, outputSeconds, referenceVideoSeconds),
  };
}

// ============================================================================
// DISPLAY
// ============================================================================

const MODEL_DISPLAY_NAMES: Record<GenerationModel, string> = {
  'bytedance/seedance-2.5/us/text-to-video': 'Seedance 2.5 · Text to Video',
  'bytedance/seedance-2.5/us/image-to-video': 'Seedance 2.5 · Image to Video',
  'bytedance/seedance-2.5/us/reference-to-video': 'Seedance 2.5 · Reference to Video',
  'openai/gpt-image-2.6/sunburst/text-to-image': 'GPT Image 2.6 · Text to Image',
  'openai/gpt-image-2.6/sunburst/edit': 'GPT Image 2.6 · Edit',
  'lightricks/ltx-2.5/audio-to-video/pro': 'LTX 2.5 Pro · Audio to Video',
  'lightricks/ltx-2.5/audio-to-video/fast': 'LTX 2.5 Fast · Audio to Video',
};

/**
 * Human-readable model name. Falls back to the raw id for models saved by older versions.
 */
export function getModelDisplayName(model: GenerationModel | string): string {
  return MODEL_DISPLAY_NAMES[model as GenerationModel] ?? model;
}
