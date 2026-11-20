import type {
  AudioNodeData,
  ElementNodeData,
  GenerationModel,
  GptImageSize,
  ImageAspectRatio,
  ImageNodeData,
  ImageResolution,
  LipSyncResolution,
  ModelCategory,
  NovaNode,
  OutputNodeData,
  PromptNodeData,
  VideoAspectRatio,
  VideoNodeData,
  VideoResolution,
} from '@/types';
import {
  coerceImageResolution,
  coerceLipSyncResolution,
  coerceVideoAspect,
  coerceVideoResolution,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_LIPSYNC_MODEL,
  DEFAULT_VIDEO_MODEL,
  IMAGE_MODELS,
  type ImageModelSpec,
  LIPSYNC_MODELS,
  type LipSyncModelSpec,
  type LipSyncRoute,
  nearest,
  VIDEO_MODELS,
  type VideoModelSpec,
  type VideoRoute,
} from './models';
import {
  combineEstimates,
  type CostEstimate,
  getGptImageSize,
  getSeedreamImageSize,
  getTierImageSize,
} from './pricing';
import { resolveAudioMime } from '@/lib/media/audio';
import { type AudioModelSpec, audioSeconds, selectedAudioModel } from './audio-models';

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

function isOutputOfType(node: NovaNode, type: 'image' | 'video', referenceOnly = true): boolean {
  if (node.type !== 'output') return false;
  const data = node.data as OutputNodeData;
  if (data.isPlaceholder) return false;
  return data.outputType === type && (!referenceOnly || data.role === 'reference');
}

/** Audio node with a loaded file (drives lip-sync). */
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

/** Seconds of every video reference (Seedance/Kling bill input + output duration when videos are referenced). */
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

/** Frontal + (generated and connected) views of an element, as far as known without uploading. */
export function elementViewCount(data: ElementNodeData): number {
  const urls = data.referenceRemoteUrls?.length ? data.referenceRemoteUrls : data.referenceImageUrls;
  return urls?.length ?? 0;
}

export interface InputShape {
  startFrame?: NovaNode;
  endFrame?: NovaNode;
  /** Reference-role images and output images converted to references. */
  referenceImages: NovaNode[];
  elements: NovaNode[];
  /** Video nodes and output videos converted to references. */
  videos: NovaNode[];
  videoSeconds: number;
  audio?: NovaNode;
  audioSeconds: number;
  audioMime: string | null;
  /** Lip-sync: clip whose mouth gets re-synced (any video or video output wired in). */
  lipSyncVideo?: NovaNode;
  /** Lip-sync: the face to animate (start frame → character → reference image → output image). */
  faceImage?: NovaNode;
  /** Image mode: every image-bearing input (image nodes, elements, image outputs). */
  editInputs: number;
}

export function analyzeInputs(connectedNodes: NovaNode[]): InputShape {
  const byRole = (role: ImageNodeData['role']) =>
    connectedNodes.find((n) => n.type === 'image' && (n.data as ImageNodeData).role === role);
  const referenceImages = connectedNodes.filter(
    (n) => (n.type === 'image' && (n.data as ImageNodeData).role === 'reference') || isOutputOfType(n, 'image')
  );
  const elements = connectedNodes.filter((n) => n.type === 'element');
  const videos = connectedNodes.filter((n) => n.type === 'video' || isOutputOfType(n, 'video'));
  const audio = getAudioSource(connectedNodes);
  const audioData = audio?.data as AudioNodeData | undefined;
  // A generated image marked "Start frame" animates like an uploaded Start Frame image
  const startFrame = byRole('start_frame') ?? connectedNodes.find(
    (n) => n.type === 'output' && !(n.data as OutputNodeData).isPlaceholder && (n.data as OutputNodeData).role === 'start_frame'
  );

  const elementWithFace = elements.find((n) => {
    const d = n.data as ElementNodeData;
    return Boolean(d.frontalRemoteUrl || d.frontalImageUrl || d.frontalFile);
  });
  const anyOutputImage = connectedNodes.find((n) => isOutputOfType(n, 'image', false));

  const editInputs = connectedNodes.reduce((count, n) => {
    if (n.type === 'image') return count + 1;
    if (n.type === 'element') return count + 1 + elementViewCount(n.data as ElementNodeData);
    if (isOutputOfType(n, 'image', false)) return count + 1;
    return count;
  }, 0);

  return {
    startFrame,
    endFrame: byRole('end_frame'),
    referenceImages,
    elements,
    videos,
    videoSeconds: getReferenceVideoSeconds(connectedNodes),
    audio,
    audioSeconds: audioData?.duration || 0,
    audioMime: audioData ? resolveAudioMime(audioData.file?.type ?? '', audioData.fileName ?? '') : null,
    lipSyncVideo: connectedNodes.find((n) => n.type === 'video' || isOutputOfType(n, 'video', false)),
    faceImage: startFrame ?? elementWithFace ?? referenceImages[0] ?? anyOutputImage,
    editInputs,
  };
}

// ============================================================================
// PLAN
// ============================================================================

export interface VideoPlan {
  spec: VideoModelSpec;
  route: VideoRoute;
  durationSeconds: number;
  resolution: VideoResolution;
  aspectRatio: VideoAspectRatio;
  aspectFollowsFrame: boolean;
  audio: boolean;
  editing: boolean;
}

export interface ImagePlan {
  spec: ImageModelSpec;
  edit: boolean;
  resolution: ImageResolution;
  aspectRatio: ImageAspectRatio;
  /** Requested size (explicit-size models) or the expected size (tier models, edits follow inputs). */
  size: GptImageSize;
}

export interface LipSyncPlan {
  spec: LipSyncModelSpec;
  route: LipSyncRoute;
  resolution: LipSyncResolution;
  audioSeconds: number;
  /** generated-face route: the still is made first with the prompt's image model. */
  still?: ImagePlan;
}

export interface AudioPlan {
  spec: AudioModelSpec;
  /** Requested length (or the expected length, for pricing). */
  seconds: number;
}

export interface GenerationPlan extends CostEstimate {
  category: ModelCategory;
  modelLabel: string;
  endpoint: GenerationModel;
  video?: VideoPlan;
  image?: ImagePlan;
  lipsync?: LipSyncPlan;
  audio?: AudioPlan;
  /** When set, generation can't run; the message says what to change. */
  blocker?: string;
  /** Adjustments the model forces (shown under the settings). */
  notes: string[];
}

export function getCategory(promptData: PromptNodeData, connectedNodes: NovaNode[]): ModelCategory {
  if (promptData.mode === 'image') return 'image';
  if (promptData.mode === 'audio') return promptData.audioKind ?? 'speech';
  return getAudioSource(connectedNodes) ? 'lipsync' : 'video';
}

function imageSizeFor(spec: ImageModelSpec, aspect: ImageAspectRatio, resolution: ImageResolution): GptImageSize {
  if (spec.id === 'gpt-image-2.6') return getGptImageSize(aspect, resolution);
  if (spec.id === 'seedream-5.5') return getSeedreamImageSize(aspect, resolution);
  return getTierImageSize(aspect, resolution);
}

export function planImage(
  promptData: PromptNodeData,
  editInputs: number,
  aspectOverride?: ImageAspectRatio
): { plan: ImagePlan; estimate: CostEstimate; blocker?: string } {
  const spec = IMAGE_MODELS[promptData.imageModel ?? DEFAULT_IMAGE_MODEL];
  const resolution = coerceImageResolution(spec, promptData.imageResolution);
  const aspectRatio = aspectOverride ?? promptData.imageAspectRatio;
  const size = imageSizeFor(spec, aspectRatio, resolution);
  const edit = editInputs > 0;
  const plan: ImagePlan = { spec, edit, resolution, aspectRatio, size };
  const estimate = spec.price({ width: size.width, height: size.height, resolution, inputImages: editInputs });
  const blocker = editInputs > spec.maxInputs
    ? `${spec.label} accepts up to ${spec.maxInputs} input images (each character counts its views). You have ${editInputs}.`
    : undefined;
  return {
    plan,
    estimate: edit ? { ...estimate, breakdown: `${estimate.breakdown}; final size follows the inputs` } : estimate,
    blocker,
  };
}

function flattenedImageCount(spec: VideoModelSpec, shape: InputShape, route: VideoRoute): number {
  const frames = (shape.startFrame ? 1 : 0) + (shape.endFrame ? 1 : 0);
  const elementImages = spec.elementMode === 'native'
    ? 0
    : shape.elements.reduce(
        (sum, n) => sum + 1 + Math.min(elementViewCount(n.data as ElementNodeData), spec.limits.elementViews),
        0
      );
  return shape.referenceImages.length + elementImages + (route === 'reference' ? frames : 0);
}

function planVideo(promptData: PromptNodeData, connectedNodes: NovaNode[], shape: InputShape): GenerationPlan {
  const spec = VIDEO_MODELS[promptData.videoModel ?? DEFAULT_VIDEO_MODEL];
  const notes: string[] = [];
  let blocker: string | undefined;

  const hasReferences = shape.referenceImages.length > 0 || shape.elements.length > 0 || shape.videos.length > 0;
  let route: VideoRoute;
  if (hasReferences) {
    route = 'reference';
    if (!spec.endpoints.reference) blocker = `${spec.label} has no reference mode.`;
  } else if (shape.startFrame) {
    route = shape.endFrame && spec.endpoints.frames ? 'frames' : 'image';
  } else {
    route = 'text';
    if (shape.endFrame) blocker = "An End Frame needs a Start Frame. Set another image's role to Start Frame.";
  }

  // Limits
  if (shape.videos.length > 0 && spec.limits.videos === 0) {
    blocker = `${spec.label} can't take reference videos. Switch to Seedance 2.5, Kling 4 or Gemini Omni.`;
  } else if (shape.videos.length > spec.limits.videos) {
    blocker = `${spec.label} accepts up to ${spec.limits.videos} reference videos.`;
  }
  if (spec.elementMode === 'native' && shape.elements.length > spec.limits.elements) {
    blocker = `${spec.label} casts up to ${spec.limits.elements} characters per shot. You have ${shape.elements.length}.`;
  }
  const imageCount = flattenedImageCount(spec, shape, route);
  if (route === 'reference' && imageCount > spec.limits.images) {
    blocker = `${spec.label} accepts up to ${spec.limits.images} reference images (characters count their views). You have ${imageCount}.`;
  }
  const knownVideoSeconds = shape.videos
    .map((n) => (n.type === 'video' ? (n.data as VideoNodeData).duration : (n.data as OutputNodeData).videoDuration) || 0)
    .filter((s) => s > 0);
  if (spec.limits.videos > 0 && knownVideoSeconds.some((s) => s < spec.limits.videoMinSeconds || s > spec.limits.videoMaxSeconds)) {
    blocker = `${spec.label}: each reference video must be ${spec.limits.videoMinSeconds}–${spec.limits.videoMaxSeconds} s.`;
  }
  if (spec.limits.videos > 0 && knownVideoSeconds.reduce((a, b) => a + b, 0) > spec.limits.videoTotalSeconds) {
    blocker = `${spec.label}: reference videos must total ${spec.limits.videoTotalSeconds} s or less.`;
  }

  // Settings coerced to the model
  const requested = parseInt(promptData.duration, 10) || spec.durations[0];
  let durationSeconds = nearest(requested, spec.durations);
  if (route === 'reference' && spec.referenceDuration) durationSeconds = spec.referenceDuration;
  if (shape.endFrame && spec.maxDurationWithEndFrame) durationSeconds = Math.min(durationSeconds, spec.maxDurationWithEndFrame);
  if (durationSeconds !== requested) notes.push(`${durationSeconds}s (${spec.label} length)`);

  const resolution = coerceVideoResolution(spec, promptData.videoResolution);
  const aspectRatio = coerceVideoAspect(spec, promptData.aspectRatio);
  const aspectFollowsFrame = (route === 'image' || route === 'frames') && spec.imageFollowsFrame;
  const audio = spec.audio === 'always' || (spec.audio === 'toggle' && promptData.generateAudio);

  const editing = spec.supportsVideoEdit && route === 'reference' && isVideoEdit(promptData.prompt, connectedNodes);
  const outputSeconds = editing && shape.videoSeconds > 0 ? shape.videoSeconds : durationSeconds;
  if (editing) notes.push('Editing: output follows the source video');

  const endpoint = spec.endpoints[route] ?? spec.endpoints.text;
  const estimate = spec.price({
    resolution,
    outputSeconds,
    audio,
    referenceVideoSeconds: route === 'reference' ? shape.videoSeconds : 0,
    route,
  });

  return {
    category: 'video',
    modelLabel: spec.label,
    endpoint,
    video: { spec, route, durationSeconds, resolution, aspectRatio, aspectFollowsFrame, audio, editing },
    ...estimate,
    blocker,
    notes,
  };
}

function planLipSync(promptData: PromptNodeData, shape: InputShape): GenerationPlan {
  const spec = LIPSYNC_MODELS[promptData.lipSyncModel ?? DEFAULT_LIPSYNC_MODEL];
  const resolution = coerceLipSyncResolution(spec, promptData.lipSyncResolution);
  const notes: string[] = [];
  let blocker: string | undefined;

  let route: LipSyncRoute;
  if (shape.lipSyncVideo) {
    route = 'video';
    if (!spec.endpoints.video) blocker = `${spec.label} animates photos. To re-sync an existing clip, pick Sync 3 or VEED Lipsync 2.`;
  } else if (shape.faceImage) {
    route = 'image';
    if (!spec.endpoints.image) blocker = `${spec.label} re-syncs existing clips. Connect a video, or pick a photo model (OmniHuman 2, HeyGen, MiniMax, Sync 3).`;
  } else {
    route = 'generated-face';
    if (!spec.endpoints.image) blocker = `${spec.label} needs a video to re-sync. Connect a clip, or pick a photo model.`;
    else if (!promptData.prompt.trim()) blocker = 'Connect a face (image or character), or describe the singer so a portrait is generated first.';
  }

  const audioSeconds = shape.audioSeconds;
  if (audioSeconds > 0 && (audioSeconds < spec.audio.minSeconds || audioSeconds > spec.audio.maxSeconds)) {
    blocker = `${spec.label} takes ${spec.audio.minSeconds}–${spec.audio.maxSeconds} s of audio (this clip is ${audioSeconds.toFixed(1)} s).`;
  }
  if (spec.audio.mimes && shape.audioMime && !spec.audio.mimes.includes(shape.audioMime)) {
    blocker = `${spec.label} needs MP3 or WAV audio. Convert the file or pick another lip-sync model.`;
  }

  // Sync 3 uses cut_off: the output ends with whichever of clip/audio is shorter
  const clipSeconds = shape.lipSyncVideo
    ? (shape.lipSyncVideo.type === 'video'
        ? (shape.lipSyncVideo.data as VideoNodeData).duration
        : (shape.lipSyncVideo.data as OutputNodeData).videoDuration) || 0
    : 0;
  const billedSeconds = route === 'video' && spec.id === 'sync-3' && clipSeconds > 0
    ? Math.min(clipSeconds, audioSeconds || clipSeconds)
    : audioSeconds;
  const knownSeconds = billedSeconds > 0 ? billedSeconds : 10;
  const lipEstimate = spec.price({ seconds: knownSeconds, resolution });
  const lipCost = billedSeconds > 0 ? lipEstimate : { ...lipEstimate, breakdown: `per 10 s: ${lipEstimate.breakdown}`, isEstimate: true };

  let still: ImagePlan | undefined;
  let estimate: CostEstimate = lipCost;
  if (route === 'generated-face') {
    const stillAspect: ImageAspectRatio = promptData.aspectRatio;
    const stillPlan = planImage(promptData, 0, stillAspect);
    still = stillPlan.plan;
    notes.push(`Portrait made first with ${still.spec.label}`);
    estimate = combineEstimates([
      { label: 'portrait', estimate: stillPlan.estimate },
      { label: 'lip-sync', estimate: lipCost },
    ]);
  }

  const endpoint = (route === 'video' ? spec.endpoints.video : spec.endpoints.image) ?? spec.endpoints.image ?? spec.endpoints.video!;
  return {
    category: 'lipsync',
    modelLabel: spec.label,
    endpoint,
    lipsync: { spec, route, resolution, audioSeconds, still },
    ...estimate,
    blocker,
    notes,
  };
}

function planAudio(promptData: PromptNodeData, category: ModelCategory): GenerationPlan {
  const spec = selectedAudioModel(promptData);
  const seconds = audioSeconds(spec, promptData);
  const estimate = spec.price({ characters: promptData.prompt.length, seconds });
  let blocker: string | undefined;
  if (spec.lyrics === 'required' && !promptData.lyrics?.trim()) blocker = `${spec.label} sings the lyrics you give it. Add lyrics below.`;
  const notes: string[] = [];
  if (spec.kind === 'speech') notes.push(`Voice: ${promptData.voice && spec.voices?.includes(promptData.voice) ? promptData.voice : spec.defaultVoice}`);
  return { category, modelLabel: spec.label, endpoint: spec.endpoint, audio: { spec, seconds }, ...estimate, blocker, notes };
}

/**
 * Single source of truth for which endpoint a prompt node will call and what it costs.
 * Used by the prompt node UI and by useGeneration.
 */
export function planGeneration(promptData: PromptNodeData, connectedNodes: NovaNode[]): GenerationPlan {
  const shape = analyzeInputs(connectedNodes);
  const category = getCategory(promptData, connectedNodes);

  if (category === 'image') {
    const { plan, estimate, blocker } = planImage(promptData, shape.editInputs);
    return {
      category,
      modelLabel: plan.spec.label,
      endpoint: plan.edit ? plan.spec.endpoints.edit : plan.spec.endpoints.text,
      image: plan,
      ...estimate,
      blocker,
      notes: plan.resolution !== promptData.imageResolution ? [`${plan.resolution} (${plan.spec.label} max)`] : [],
    };
  }
  if (category === 'lipsync') return planLipSync(promptData, shape);
  if (category === 'speech' || category === 'sound' || category === 'music') return planAudio(promptData, category);
  return planVideo(promptData, connectedNodes, shape);
}

export { getModelDisplayName } from './models';
