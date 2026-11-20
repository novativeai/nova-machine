// Pure request builders: plan + resolved media URLs → the exact fal.ai input for the endpoint.
// Every field below exists in that endpoint's OpenAPI schema (see types/api.ts).
import type {
  ElementType,
  FalInput,
  Flux3Input,
  GenerationModel,
  GeminiOmniImageToVideoInput,
  GeminiOmniReferenceToVideoInput,
  GeminiOmniResolution,
  GeminiOmniTextToVideoInput,
  GptImageEditInput,
  GptImageTextToImageInput,
  HeyGenAvatarInput,
  KlingElement,
  KlingImageToVideoInput,
  KlingReferenceToVideoInput,
  KlingTextToVideoInput,
  MiniMaxLipSyncInput,
  NanoBananaInput,
  OmniHumanInput,
  SeedanceImageToVideoInput,
  SeedanceReferenceToVideoInput,
  SeedanceTextToVideoInput,
  SeedreamInput,
  SyncImageToVideoInput,
  SyncVideoInput,
  VeedLipSyncInput,
  VeoFirstLastFrameInput,
  VeoImageToVideoInput,
  VeoReferenceToVideoInput,
  VeoResolution,
  VeoTextToVideoInput,
} from '@/types';
import type { ImagePlan, LipSyncPlan, VideoPlan } from './model-selector';

// ============================================================================
// RESOLVED MEDIA
// ============================================================================

export interface ResolvedElement {
  tag?: string;
  name: string;
  kind: ElementType;
  frontal: string;
  /** Other views (three-quarter, side, back, face), best first. */
  views: string[];
  appearance?: string;
}

export interface ResolvedMedia {
  /** Prompt with camera/lighting added and @Name tags translated to @ElementN. */
  prompt: string;
  startFrame?: string;
  endFrame?: string;
  /** Reference images, sorted by tag. */
  images: Array<{ url: string; tag?: string }>;
  elements: ResolvedElement[];
  videos: Array<{ url: string; tag?: string; seconds: number }>;
  audio?: { url: string; seconds: number };
  /** Lip-sync sources */
  lipSyncVideo?: string;
  faceImage?: string;
  /** Face of the singing character, for picking one person in multi-person clips */
  speakerFace?: string;
}

export interface FalRequest {
  endpoint: GenerationModel;
  input: FalInput;
}

const TAG_PATTERN = /@(?:Image|Element|Video)\d+\b/g;

/** Replace canvas tags in one pass, so a remapped tag is never remapped again. */
function remapTags(prompt: string, map: Map<string, string>): string {
  return prompt.replace(TAG_PATTERN, (tag) => map.get(tag) ?? tag);
}

/** "Cast: Alice — short black bob, red jacket. Ben — …" (identity lock for every model). */
export function castNotes(elements: ResolvedElement[], label: (e: ResolvedElement) => string): string {
  const described = elements.filter((e) => e.appearance?.trim());
  if (described.length === 0) return '';
  return `Keep every character identical across the shot. ${described
    .map((e) => `${label(e)}: ${e.appearance!.trim().replace(/\.$/, '')}.`)
    .join(' ')}`;
}

function join(...parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(' ');
}

function range(from: number, to: number, noun: string): string {
  return from === to ? `${noun} ${from}` : `${noun}s ${from}–${to}`;
}

// ============================================================================
// VIDEO
// ============================================================================

/**
 * Flattened reference list for models without native elements:
 * tagged images first (by tag), then untagged images, then each element's frontal + views.
 */
function flattenReferences(
  media: ResolvedMedia,
  plan: VideoPlan,
  includeFrames: boolean,
  style: 'tags' | 'prose'
): { imageUrls: string[]; tagMap: Map<string, string>; notes: string[]; labelOf: (e: ResolvedElement) => string } {
  const imageUrls: string[] = [];
  const tagMap = new Map<string, string>();
  const notes: string[] = [];
  const elementLabels = new Map<ResolvedElement, string>();
  const add = (url: string) => {
    imageUrls.push(url);
    return imageUrls.length;
  };
  const imageRef = (n: number) => (style === 'tags' ? `@Image${n}` : `reference image ${n}`);

  for (const image of media.images) {
    const position = add(image.url);
    if (image.tag) tagMap.set(image.tag, imageRef(position));
  }
  if (includeFrames) {
    if (media.startFrame) notes.push(`${imageRef(add(media.startFrame))} is the opening frame.`);
    if (media.endFrame) notes.push(`${imageRef(add(media.endFrame))} is the closing frame.`);
  }
  for (const element of media.elements) {
    const views = element.views.slice(0, plan.spec.limits.elementViews);
    const first = add(element.frontal);
    views.forEach((url) => add(url));
    const last = first + views.length;
    const label = style === 'tags'
      ? `${element.name} (@Image${first})`
      : `${element.name} (${range(first, last, 'reference image')})`;
    elementLabels.set(element, label);
    if (element.tag) tagMap.set(element.tag, style === 'tags' ? `@Image${first}` : `${element.name} (${range(first, last, 'reference image')})`);
    if (views.length > 0) {
      notes.push(
        style === 'tags'
          ? `${views.map((_, i) => `@Image${first + 1 + i}`).join(', ')} show${views.length === 1 ? 's' : ''} the same ${element.kind} as @Image${first} (${element.name}) from other angles.`
          : `${range(first, last, 'Reference image')} all show ${element.name}, the same ${element.kind}, from different angles.`
      );
    }
  }
  return { imageUrls, tagMap, notes, labelOf: (e) => elementLabels.get(e) ?? e.name };
}

function seedanceRequest(plan: VideoPlan, media: ResolvedMedia): FalRequest {
  const duration = String(plan.durationSeconds) as SeedanceTextToVideoInput['duration'];
  const resolution = plan.resolution as SeedanceTextToVideoInput['resolution'];
  const { spec } = plan;

  if (plan.route === 'text') {
    const input: SeedanceTextToVideoInput = {
      prompt: join(media.prompt, castNotes(media.elements, (e) => e.name)),
      duration,
      resolution,
      aspect_ratio: plan.aspectRatio,
      generate_audio: plan.audio,
    };
    return { endpoint: spec.endpoints.text, input };
  }
  if (plan.route === 'image') {
    const input: SeedanceImageToVideoInput = {
      image_url: media.startFrame!,
      prompt: media.prompt,
      duration,
      resolution,
      generate_audio: plan.audio,
    };
    if (media.endFrame) input.end_image_url = media.endFrame;
    return { endpoint: spec.endpoints.image, input };
  }

  const { imageUrls, tagMap, notes, labelOf } = flattenReferences(media, plan, true, 'tags');
  media.videos.forEach((video, i) => {
    if (video.tag) tagMap.set(video.tag, `@Video${i + 1}`);
  });
  const input: SeedanceReferenceToVideoInput = {
    prompt: join(remapTags(media.prompt, tagMap), ...notes, castNotes(media.elements, labelOf)),
    task: plan.editing ? 'editing' : 'reference',
    resolution,
    generate_audio: plan.audio,
  };
  if (imageUrls.length > 0) input.image_urls = imageUrls;
  if (media.videos.length > 0) input.video_urls = media.videos.map((v) => v.url);
  if (!plan.editing) {
    // 'editing' coerces both to auto, so they're only sent for 'reference'
    input.duration = duration;
    input.aspect_ratio = plan.aspectRatio;
  }
  return { endpoint: spec.endpoints.reference!, input };
}

function klingRequest(plan: VideoPlan, media: ResolvedMedia): FalRequest {
  const resolution = plan.resolution as KlingTextToVideoInput['resolution'];
  const { spec } = plan;
  if (plan.route === 'text') {
    const input: KlingTextToVideoInput = {
      prompt: join(media.prompt, castNotes(media.elements, (e) => e.name)),
      duration: plan.durationSeconds,
      resolution,
      aspect_ratio: plan.aspectRatio,
    };
    return { endpoint: spec.endpoints.text, input };
  }
  if (plan.route === 'image') {
    const input: KlingImageToVideoInput = {
      start_image_url: media.startFrame!,
      duration: plan.durationSeconds,
      resolution,
    };
    if (media.prompt.trim()) input.prompt = media.prompt;
    if (media.endFrame) input.end_image_url = media.endFrame;
    return { endpoint: spec.endpoints.image, input };
  }

  // Native casting: @ElementN = elements[N-1] with frontal + reference views
  const tagMap = new Map<string, string>();
  media.images.forEach((image, i) => {
    if (image.tag) tagMap.set(image.tag, `@Image${i + 1}`);
  });
  media.videos.forEach((video, i) => {
    if (video.tag) tagMap.set(video.tag, `@Video${i + 1}`);
  });
  const elements: KlingElement[] = media.elements.map((element, i) => {
    if (element.tag) tagMap.set(element.tag, `@Element${i + 1}`);
    const views = element.views.slice(0, spec.limits.elementViews);
    return views.length > 0
      ? { frontal_image_url: element.frontal, reference_image_urls: views }
      : { frontal_image_url: element.frontal };
  });
  const elementLabel = (e: ResolvedElement) => `${e.name} (@Element${media.elements.indexOf(e) + 1})`;
  const input: KlingReferenceToVideoInput = {
    prompt: join(remapTags(media.prompt, tagMap), castNotes(media.elements, elementLabel)),
    duration: plan.durationSeconds,
    resolution,
    aspect_ratio: plan.aspectRatio,
  };
  if (media.images.length > 0) input.image_urls = media.images.map((i) => i.url);
  if (media.videos.length > 0) input.video_urls = media.videos.map((v) => v.url);
  if (elements.length > 0) input.elements = elements;
  if (media.startFrame) input.start_image_url = media.startFrame;
  if (media.endFrame) input.end_image_url = media.endFrame;
  return { endpoint: spec.endpoints.reference!, input };
}

function geminiRequest(plan: VideoPlan, media: ResolvedMedia): FalRequest {
  const { spec } = plan;
  const base: GeminiOmniTextToVideoInput = {
    prompt: media.prompt,
    duration: plan.durationSeconds,
    resolution: plan.resolution as GeminiOmniResolution,
    aspect_ratio: plan.aspectRatio === '9:16' ? '9:16' : '16:9',
  };
  if (plan.route === 'text') {
    return { endpoint: spec.endpoints.text, input: { ...base, prompt: join(media.prompt, castNotes(media.elements, (e) => e.name)) } };
  }
  if (plan.route === 'image') {
    const input: GeminiOmniImageToVideoInput = { ...base, image_url: media.startFrame! };
    if (media.endFrame) input.end_image_url = media.endFrame;
    return { endpoint: spec.endpoints.image, input };
  }
  const { imageUrls, tagMap, notes, labelOf } = flattenReferences(media, plan, true, 'prose');
  media.videos.forEach((video, i) => {
    if (video.tag) tagMap.set(video.tag, `reference video ${i + 1}`);
  });
  const input: GeminiOmniReferenceToVideoInput = {
    ...base,
    prompt: join(remapTags(media.prompt, tagMap), ...notes, castNotes(media.elements, labelOf)),
  };
  if (imageUrls.length > 0) input.image_urls = imageUrls;
  if (media.videos.length > 0) input.reference_video_urls = media.videos.map((v) => v.url);
  return { endpoint: spec.endpoints.reference!, input };
}

function veoRequest(plan: VideoPlan, media: ResolvedMedia): FalRequest {
  const { spec } = plan;
  const duration = `${plan.durationSeconds}s` as VeoTextToVideoInput['duration'];
  const resolution = plan.resolution as VeoResolution;
  const aspect = plan.aspectRatio === '9:16' ? '9:16' : '16:9';
  if (plan.route === 'text') {
    const input: VeoTextToVideoInput = {
      prompt: join(media.prompt, castNotes(media.elements, (e) => e.name)),
      duration,
      resolution,
      aspect_ratio: aspect,
      generate_audio: plan.audio,
    };
    return { endpoint: spec.endpoints.text, input };
  }
  if (plan.route === 'image') {
    const input: VeoImageToVideoInput = {
      prompt: media.prompt,
      image_url: media.startFrame!,
      duration,
      resolution,
      aspect_ratio: 'auto',
      generate_audio: plan.audio,
    };
    return { endpoint: spec.endpoints.image, input };
  }
  if (plan.route === 'frames') {
    const input: VeoFirstLastFrameInput = {
      prompt: media.prompt,
      first_frame_url: media.startFrame!,
      last_frame_url: media.endFrame!,
      duration,
      resolution,
      aspect_ratio: 'auto',
      generate_audio: plan.audio,
    };
    return { endpoint: spec.endpoints.frames!, input };
  }
  const { imageUrls, tagMap, notes, labelOf } = flattenReferences(media, plan, true, 'prose');
  const input: VeoReferenceToVideoInput = {
    prompt: join(remapTags(media.prompt, tagMap), ...notes, castNotes(media.elements, labelOf)),
    image_urls: imageUrls,
    resolution,
    aspect_ratio: aspect,
    generate_audio: plan.audio,
  };
  return { endpoint: spec.endpoints.reference!, input };
}

export function buildVideoRequest(plan: VideoPlan, media: ResolvedMedia): FalRequest {
  switch (plan.spec.id) {
    case 'seedance-2.5':
    case 'seedance-2.5-flash':
      return seedanceRequest(plan, media);
    case 'kling-4':
      return klingRequest(plan, media);
    case 'gemini-omni-1.2':
      return geminiRequest(plan, media);
    case 'veo-3.1':
      return veoRequest(plan, media);
  }
}

// ============================================================================
// IMAGE
// ============================================================================

/** All image inputs in prompt order, with tags and characters described by position ("image 3"). */
export function flattenImageInputs(media: ResolvedMedia): { urls: string[]; prompt: string } {
  const urls: string[] = [];
  const tagMap = new Map<string, string>();
  const notes: string[] = [];
  const labels = new Map<ResolvedElement, string>();
  const add = (url: string) => {
    urls.push(url);
    return urls.length;
  };
  for (const image of media.images) {
    const n = add(image.url);
    if (image.tag) tagMap.set(image.tag, `image ${n}`);
  }
  if (media.startFrame) add(media.startFrame);
  if (media.endFrame) add(media.endFrame);
  for (const element of media.elements) {
    const first = add(element.frontal);
    element.views.forEach((url) => add(url));
    const last = first + element.views.length;
    const label = `${element.name} (${range(first, last, 'image')})`;
    labels.set(element, label);
    if (element.tag) tagMap.set(element.tag, label);
    if (element.views.length > 0) notes.push(`${range(first, last, 'Image')} all show ${element.name} from different angles; keep their face, hair and outfit exactly.`);
  }
  return {
    urls,
    prompt: join(remapTags(media.prompt, tagMap), ...notes, castNotes(media.elements, (e) => labels.get(e) ?? e.name)),
  };
}

export function buildImageRequest(plan: ImagePlan, media: ResolvedMedia): FalRequest {
  const { spec } = plan;
  const { urls, prompt } = plan.edit
    ? flattenImageInputs(media)
    : { urls: [] as string[], prompt: join(media.prompt, castNotes(media.elements, (e) => e.name)) };
  if (plan.edit && urls.length === 0) throw new Error('At least one image is required for image editing');

  switch (spec.id) {
    case 'gpt-image-2.6': {
      if (!plan.edit) {
        const input: GptImageTextToImageInput = { prompt, image_size: plan.size, quality: 'high', num_images: 1, output_format: 'png' };
        return { endpoint: spec.endpoints.text, input };
      }
      const input: GptImageEditInput = { prompt, image_urls: urls, image_size: 'auto', quality: 'high', num_images: 1, output_format: 'png' };
      return { endpoint: spec.endpoints.edit, input };
    }
    case 'nano-banana-2.1': {
      const input: NanoBananaInput = {
        prompt,
        resolution: plan.resolution,
        aspect_ratio: plan.edit ? 'auto' : plan.aspectRatio,
        num_images: 1,
        output_format: 'png',
      };
      if (plan.edit) input.image_urls = urls;
      return { endpoint: plan.edit ? spec.endpoints.edit : spec.endpoints.text, input };
    }
    case 'flux-3': {
      const input: Flux3Input = {
        prompt,
        aspect_ratio: plan.edit ? 'auto' : plan.aspectRatio,
        resolution: plan.resolution === '1K' ? '1k' : plan.resolution === '2K' ? '2k' : '4k',
        output_format: 'png',
      };
      if (plan.edit) input.image_urls = urls;
      return { endpoint: plan.edit ? spec.endpoints.edit : spec.endpoints.text, input };
    }
    case 'seedream-5.5': {
      const input: SeedreamInput = { prompt, image_size: plan.size, num_images: 1, output_format: 'png' };
      if (plan.edit) input.image_urls = urls;
      return { endpoint: plan.edit ? spec.endpoints.edit : spec.endpoints.text, input };
    }
  }
}

// ============================================================================
// LIP-SYNC
// ============================================================================

/**
 * Lip-sync request. `faceUrl` is the photo to animate (wired face or the generated portrait).
 */
export function buildLipSyncRequest(plan: LipSyncPlan, media: ResolvedMedia, faceUrl?: string): FalRequest {
  const { spec } = plan;
  const audioUrl = media.audio?.url;
  if (!audioUrl) throw new Error('Connect an Audio node with a file for lip-sync');
  const direction = join(media.prompt, castNotes(media.elements, (e) => e.name));

  if (plan.route === 'video') {
    const videoUrl = media.lipSyncVideo;
    if (!videoUrl) throw new Error('Connect the clip to re-sync');
    if (spec.id === 'sync-3') {
      const input: SyncVideoInput = { video_url: videoUrl, audio_url: audioUrl, sync_mode: 'cut_off' };
      // Several people in frame: only the wired character's mouth follows the audio
      if (media.speakerFace) input.options = { active_speaker_detection: { face_image: media.speakerFace } };
      return { endpoint: spec.endpoints.video!, input };
    }
    const input: VeedLipSyncInput = { video_url: videoUrl, audio_url: audioUrl };
    return { endpoint: spec.endpoints.video!, input };
  }

  const imageUrl = faceUrl ?? media.faceImage;
  if (!imageUrl) throw new Error('Connect a face image or character for lip-sync');
  switch (spec.id) {
    case 'omnihuman-2': {
      const input: OmniHumanInput = { image_url: imageUrl, audio_url: audioUrl };
      if (direction) input.prompt = direction;
      return { endpoint: spec.endpoints.image!, input };
    }
    case 'heygen-avatar-6': {
      const input: HeyGenAvatarInput = {
        image_url: imageUrl,
        audio_url: audioUrl,
        resolution: plan.resolution === '2k' ? '2k' : '1080p',
      };
      if (direction) input.motion_prompt = direction;
      return { endpoint: spec.endpoints.image!, input };
    }
    case 'minimax-h3-lipsync': {
      const map: Record<string, MiniMaxLipSyncInput['resolution']> = { '480p': '480P', '768p': '768P', '1080p': '1080P', '2k': '2K' };
      const input: MiniMaxLipSyncInput = { image_url: imageUrl, audio_url: audioUrl, resolution: map[plan.resolution] };
      return { endpoint: spec.endpoints.image!, input };
    }
    case 'sync-3': {
      const input: SyncImageToVideoInput = { image_url: imageUrl, audio_url: audioUrl };
      return { endpoint: spec.endpoints.image!, input };
    }
    case 'veed-lipsync-2':
      throw new Error(`${spec.label} needs a video to re-sync`);
  }
}

/** Portrait prompt for the generated-face route (front-facing, mouth clearly visible). */
export function portraitPrompt(media: ResolvedMedia): string {
  return join(
    media.prompt,
    castNotes(media.elements, (e) => e.name),
    'Front-facing performer, face and mouth clearly visible and well lit, shoulders up to waist framing, no text.'
  );
}
