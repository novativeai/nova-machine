'use client';

import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useCanvasStore, createNode, useChainStore } from '@/stores';
import { useGenerationStore } from '@/stores';
import { pendingUploads } from './useBackgroundUpload';
import { useSettingsStore } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';
import { persistUrlsToR2 } from '@/lib/r2';
import {
  estimateAudioToVideoCost,
  estimateImageCostFromPixels,
  generateAudioToVideo,
  generateImage,
  generateVideo,
  getAudioSource,
  getGptImageSize,
  getModelDisplayName,
  getReferenceVideoSeconds,
  FAL_KEY_REQUIRED_MESSAGE,
  formatNameAsTag,
  isValidNameForTag,
  isVideoEdit,
  LTX_A2V_MAX_AUDIO_SECONDS,
  LTX_A2V_MIN_AUDIO_SECONDS,
  planGeneration,
  translateNameTagsForApi,
  uploadFile,
  validateAllTags,
} from '@/lib/fal';
import type {
  AudioNodeData,
  AudioToVideoModel,
  CameraNodeData,
  ElementNodeData,
  GenerationMetadata,
  ImageGenerationInput,
  ImageModel,
  ImageNodeData,
  LightingNodeData,
  LtxAudioToVideoInput,
  NovaNode,
  OutputNodeData,
  PromptNodeData,
  SeedanceImageToVideoInput,
  SeedanceReferenceToVideoInput,
  SeedanceTextToVideoInput,
  VideoGenerationInput,
  VideoModel,
  VideoNodeData,
  VideoResolution,
} from '@/types';
import { formatCameraSettings } from '@/components/nodes/CameraNode';
import { formatLightingSettings } from '@/components/nodes/LightingNode';

// Seedance 2.5 reference-to-video limits (from the endpoint schema)
const SEEDANCE_MAX_IMAGES = 30;
const SEEDANCE_MAX_VIDEOS = 10;
const SEEDANCE_MAX_FILES = 50;
const SEEDANCE_MIN_VIDEO_SECONDS = 1.8;
const SEEDANCE_MAX_VIDEO_SECONDS = 30.2;
// GPT Image 2.6 edit accepts up to 16 input images
const GPT_IMAGE_MAX_INPUTS = 16;

const VIDEO_HEIGHT: Record<VideoResolution, number> = { '480p': 480, '720p': 720, '1080p': 1080 };

/** Expected output dimensions for a Seedance render (exact size isn't returned by the API). */
function videoDimensions(resolution: VideoResolution, aspectRatio: string): { width: number; height: number } {
  const [w, h] = aspectRatio.split(':').map(Number);
  const short = VIDEO_HEIGHT[resolution];
  if (!w || !h) return { width: Math.round((short * 16) / 9), height: short };
  return w >= h
    ? { width: Math.round((short * w) / h), height: short }
    : { width: short, height: Math.round((short * h) / w) };
}

/** Tag index for sorting ("@Image3" → 3); untagged media sort last. */
function tagIndex(tag: string | undefined): number {
  const match = tag?.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

/**
 * Wait for all pending uploads for the given nodes to complete
 */
async function waitForPendingUploads(connectedNodes: NovaNode[]): Promise<void> {
  const uploadPromises: Promise<unknown>[] = [];

  for (const node of connectedNodes) {
    const nodeUpload = pendingUploads.get(node.id);
    if (nodeUpload) uploadPromises.push(nodeUpload);

    if (node.type === 'element') {
      const frontalUpload = pendingUploads.get(`${node.id}:frontal`);
      if (frontalUpload) uploadPromises.push(frontalUpload);
      const referenceUpload = pendingUploads.get(`${node.id}:references`);
      if (referenceUpload) uploadPromises.push(referenceUpload);
    }
  }

  if (uploadPromises.length > 0) {
    console.log('[Generation] Waiting for', uploadPromises.length, 'pending upload(s)...');
    await Promise.all(uploadPromises);
  }
}

/** Throw if any connected node failed its background upload. */
function assertNoUploadErrors(nodes: NovaNode[]): void {
  for (const node of nodes) {
    if (node.type === 'image') {
      const data = node.data as ImageNodeData;
      if (data.uploadStatus === 'error') {
        throw new Error(`Image "${data.fileName}" failed to upload: ${data.uploadError || 'Unknown error'}`);
      }
    } else if (node.type === 'video') {
      const data = node.data as VideoNodeData;
      if (data.uploadStatus === 'error') {
        throw new Error(`Video "${data.fileName}" failed to upload: ${data.uploadError || 'Unknown error'}`);
      }
    } else if (node.type === 'element') {
      const data = node.data as ElementNodeData;
      if (data.frontalUploadStatus === 'error') {
        throw new Error(`Element "${data.name}" frontal image failed to upload: ${data.frontalUploadError || 'Unknown error'}`);
      }
      if (data.referenceUploadStatus === 'error') {
        throw new Error(`Element "${data.name}" reference images failed to upload: ${data.referenceUploadError || 'Unknown error'}`);
      }
    } else if (node.type === 'audio') {
      const data = node.data as AudioNodeData;
      if (data.uploadStatus === 'error') {
        throw new Error(`Audio "${data.fileName}" failed to upload: ${data.uploadError || 'Unknown error'}`);
      }
    }
  }
}

async function resolveImageUrl(data: ImageNodeData): Promise<string> {
  if (data.remoteUrl) return data.remoteUrl;
  if (data.file) return uploadFile(data.file);
  return data.imageUrl;
}

async function resolveVideoUrl(data: VideoNodeData): Promise<string> {
  if (data.remoteUrl) return data.remoteUrl;
  if (data.file) return uploadFile(data.file);
  return data.videoUrl;
}

/** Frontal image followed by reference views, uploading on demand. */
async function resolveElementUrls(data: ElementNodeData): Promise<string[]> {
  if (!data.frontalFile && !data.frontalImageUrl && !data.frontalRemoteUrl) {
    throw new Error(`Element "${data.name}" is missing a frontal image. Please add a frontal image before generating.`);
  }

  const frontal = data.frontalRemoteUrl
    ? data.frontalRemoteUrl
    : data.frontalFile
      ? await uploadFile(data.frontalFile)
      : data.frontalImageUrl;

  let references: string[] = [];
  if (data.referenceRemoteUrls && data.referenceRemoteUrls.length > 0) {
    references = data.referenceRemoteUrls;
  } else if (data.referenceFiles && data.referenceFiles.length > 0) {
    references = await Promise.all(data.referenceFiles.map((f) => uploadFile(f)));
  } else if (data.referenceImageUrls.length > 0) {
    references = data.referenceImageUrls;
  }

  return [frontal, ...references];
}

async function resolveAudioUrl(data: AudioNodeData): Promise<string> {
  if (data.remoteUrl) return data.remoteUrl;
  if (data.file) return uploadFile(data.file);
  if (data.audioUrl) {
    // Only a blob URL is available: materialise it and upload
    const blob = await (await fetch(data.audioUrl)).blob();
    return uploadFile(new File([blob], data.fileName || 'audio.mp3', { type: blob.type }));
  }
  throw new Error('Audio file is required for audio-to-video. Please upload an audio file to the Audio node.');
}

interface OutputPayload {
  outputType: 'video' | 'image';
  url: string;
  dimensions: { width: number; height: number };
  videoDuration?: number;
  metadata: GenerationMetadata;
}

export function useGeneration() {
  const { user } = useAuth();

  const {
    updateNode,
    addNode,
    addEdge,
    getConnectedInputs,
    getEdgeTag,
  } = useCanvasStore();

  const {
    addToQueue,
    setActiveGeneration,
    completeGeneration,
    failGeneration,
  } = useGenerationStore();

  /**
   * Persist fal.ai output URLs to R2 in the background and swap them into the output node.
   */
  const persistOutputToR2 = useCallback(
    async (outputNodeId: string, urls: { imageUrl?: string; videoUrl?: string }) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const urlsToPersist: Array<{ url: string; category: 'outputs' }> = [];
        if (urls.videoUrl) urlsToPersist.push({ url: urls.videoUrl, category: 'outputs' });
        if (urls.imageUrl) urlsToPersist.push({ url: urls.imageUrl, category: 'outputs' });
        if (urlsToPersist.length === 0) return;

        const r2Map = await persistUrlsToR2(token, urlsToPersist);
        if (r2Map.size === 0) return;

        const update: Record<string, unknown> = {};
        if (urls.videoUrl && r2Map.has(urls.videoUrl)) {
          update.videoUrl = r2Map.get(urls.videoUrl);
        }
        if (urls.imageUrl && r2Map.has(urls.imageUrl)) {
          update.imageUrl = r2Map.get(urls.imageUrl);
          update.thumbnailUrl = r2Map.get(urls.imageUrl);
        }
        if (Object.keys(update).length > 0) updateNode(outputNodeId, update);
      } catch (error) {
        // Non-fatal: fal.ai URL still works short-term
        console.warn('[R2 Persist] Failed to persist output:', error);
      }
    },
    [user, updateNode]
  );

  /**
   * Prompt text sent to the API: user prompt + camera/lighting settings,
   * with element name tags (@Alice) translated to their edge tags (@Element1).
   */
  const buildPromptText = useCallback(
    (promptNodeId: string, promptData: PromptNodeData, connectedNodes: NovaNode[]): string => {
      const settingsParts = [
        connectedNodes
          .filter((n) => n.type === 'camera')
          .map((n) => formatCameraSettings(n.data as CameraNodeData))
          .filter((s) => s.length > 0)
          .join(', '),
        connectedNodes
          .filter((n) => n.type === 'lighting')
          .map((n) => formatLightingSettings(n.data as LightingNodeData))
          .filter((s) => s.length > 0)
          .join(', '),
      ].filter((s) => s.length > 0);

      let prompt = settingsParts.length > 0
        ? `${promptData.prompt}. ${settingsParts.join('. ')}`
        : promptData.prompt;

      const nameTagMap = new Map<string, string>();
      for (const node of connectedNodes) {
        if (node.type !== 'element') continue;
        const data = node.data as ElementNodeData;
        const elementTag = getEdgeTag(node.id, promptNodeId);
        if (data.name && isValidNameForTag(data.name) && elementTag) {
          nameTagMap.set(formatNameAsTag(data.name), elementTag);
        }
      }
      if (nameTagMap.size > 0) prompt = translateNameTagsForApi(prompt, nameTagMap);

      return prompt;
    },
    [getEdgeTag]
  );

  /**
   * Seedance 2.5 input. For reference-to-video, canvas tags are remapped to Seedance's
   * positional tags: @ImageN → its index in image_urls, @ElementN → its frontal image's
   * index (reference views appended and described), @VideoN → its index in video_urls.
   */
  const buildVideoInput = useCallback(
    async (
      promptNodeId: string,
      promptData: PromptNodeData,
      connectedNodes: NovaNode[],
      model: VideoModel
    ): Promise<VideoGenerationInput> => {
      const prompt = buildPromptText(promptNodeId, promptData, connectedNodes);

      if (model === 'bytedance/seedance-2.5/us/text-to-video') {
        const input: SeedanceTextToVideoInput = {
          prompt,
          duration: promptData.duration,
          resolution: promptData.videoResolution,
          aspect_ratio: promptData.aspectRatio,
          generate_audio: promptData.generateAudio,
        };
        return input;
      }

      if (model === 'bytedance/seedance-2.5/us/image-to-video') {
        const frame = (role: ImageNodeData['role']) =>
          connectedNodes.find((n) => n.type === 'image' && (n.data as ImageNodeData).role === role);
        const startNode = frame('start_frame');
        const endNode = frame('end_frame');
        if (!startNode) {
          throw new Error('Image-to-video needs a Start Frame image. Set an image\'s role to Start Frame.');
        }
        const input: SeedanceImageToVideoInput = {
          image_url: await resolveImageUrl(startNode.data as ImageNodeData),
          prompt,
          duration: promptData.duration,
          resolution: promptData.videoResolution,
          generate_audio: promptData.generateAudio,
        };
        if (endNode) input.end_image_url = await resolveImageUrl(endNode.data as ImageNodeData);
        return input;
      }

      // Reference-to-video
      const taggedImages: Array<{ url: string; tag?: string }> = [];
      const untaggedImages: string[] = [];
      const elements: Array<{ tag?: string; label: string; kind: string; urls: string[] }> = [];
      const videos: Array<{ url: string; tag?: string; seconds: number }> = [];

      for (const node of connectedNodes) {
        const tag = getEdgeTag(node.id, promptNodeId);
        if (node.type === 'image') {
          const url = await resolveImageUrl(node.data as ImageNodeData);
          if (tag?.startsWith('@Image')) taggedImages.push({ url, tag });
          else untaggedImages.push(url); // start/end frames act as plain references here
        } else if (node.type === 'element') {
          const data = node.data as ElementNodeData;
          elements.push({
            tag,
            label: data.name || tag || 'the element',
            kind: data.elementType,
            urls: await resolveElementUrls(data),
          });
        } else if (node.type === 'video') {
          const data = node.data as VideoNodeData;
          videos.push({ url: await resolveVideoUrl(data), tag, seconds: data.duration || 0 });
        } else if (node.type === 'output') {
          const data = node.data as OutputNodeData;
          if (data.role !== 'reference') continue;
          if (data.outputType === 'image' && data.imageUrl) {
            if (tag?.startsWith('@Image')) taggedImages.push({ url: data.imageUrl, tag });
            else untaggedImages.push(data.imageUrl);
          } else if (data.outputType === 'video' && data.videoUrl) {
            videos.push({ url: data.videoUrl, tag, seconds: data.videoDuration || 0 });
          }
        }
      }

      const tagMap = new Map<string, string>();
      const imageUrls: string[] = [];
      const addImage = (url: string): number => {
        imageUrls.push(url);
        return imageUrls.length;
      };

      taggedImages.sort((a, b) => tagIndex(a.tag) - tagIndex(b.tag));
      for (const image of taggedImages) {
        const position = addImage(image.url);
        if (image.tag) tagMap.set(image.tag, `@Image${position}`);
      }
      for (const url of untaggedImages) addImage(url);

      const elementNotes: string[] = [];
      elements.sort((a, b) => tagIndex(a.tag) - tagIndex(b.tag));
      for (const element of elements) {
        const [frontal, ...views] = element.urls;
        const frontalPosition = addImage(frontal);
        if (element.tag) tagMap.set(element.tag, `@Image${frontalPosition}`);
        if (views.length > 0) {
          const viewTags = views.map((url) => `@Image${addImage(url)}`);
          elementNotes.push(
            `${viewTags.join(', ')} show${viewTags.length === 1 ? 's' : ''} the same ${element.kind} as @Image${frontalPosition} (${element.label}) from other angles.`
          );
        }
      }

      videos.sort((a, b) => tagIndex(a.tag) - tagIndex(b.tag));
      videos.forEach((video, i) => {
        if (video.tag) tagMap.set(video.tag, `@Video${i + 1}`);
      });

      if (imageUrls.length > SEEDANCE_MAX_IMAGES) {
        throw new Error(`Seedance accepts up to ${SEEDANCE_MAX_IMAGES} reference images (elements count each view). You have ${imageUrls.length}.`);
      }
      if (videos.length > SEEDANCE_MAX_VIDEOS) {
        throw new Error(`Seedance accepts up to ${SEEDANCE_MAX_VIDEOS} reference videos.`);
      }
      if (imageUrls.length + videos.length > SEEDANCE_MAX_FILES) {
        throw new Error(`Seedance accepts up to ${SEEDANCE_MAX_FILES} reference files in total.`);
      }
      const knownVideoSeconds = videos.map((v) => v.seconds).filter((s) => s > 0);
      if (knownVideoSeconds.some((s) => s < SEEDANCE_MIN_VIDEO_SECONDS || s > SEEDANCE_MAX_VIDEO_SECONDS)) {
        throw new Error(`Each reference video must be ${SEEDANCE_MIN_VIDEO_SECONDS}–${SEEDANCE_MAX_VIDEO_SECONDS} seconds long.`);
      }
      if (knownVideoSeconds.reduce((a, b) => a + b, 0) > SEEDANCE_MAX_VIDEO_SECONDS) {
        throw new Error(`Reference videos must total ${SEEDANCE_MAX_VIDEO_SECONDS} seconds or less.`);
      }

      // Single pass so remapped tags can never be remapped again
      const remapped = prompt.replace(/@(?:Image|Element|Video)\d+\b/g, (tag) => tagMap.get(tag) ?? tag);
      const finalPrompt = elementNotes.length > 0 ? `${remapped} ${elementNotes.join(' ')}` : remapped;

      const editing = isVideoEdit(promptData.prompt, connectedNodes);
      const input: SeedanceReferenceToVideoInput = {
        prompt: finalPrompt,
        task: editing ? 'editing' : 'reference',
        resolution: promptData.videoResolution,
        generate_audio: promptData.generateAudio,
      };
      if (imageUrls.length > 0) input.image_urls = imageUrls;
      if (videos.length > 0) input.video_urls = videos.map((v) => v.url);
      if (!editing) {
        // 'editing' coerces both to auto, so they're only sent for 'reference'
        input.duration = promptData.duration;
        input.aspect_ratio = promptData.aspectRatio;
      }
      return input;
    },
    [buildPromptText, getEdgeTag]
  );

  /**
   * GPT Image 2.6 input: explicit size for text-to-image, 'auto' (follow inputs) for edits.
   */
  const buildImageInput = useCallback(
    async (
      promptNodeId: string,
      promptData: PromptNodeData,
      connectedNodes: NovaNode[],
      model: ImageModel
    ): Promise<ImageGenerationInput> => {
      const prompt = buildPromptText(promptNodeId, promptData, connectedNodes);

      if (model === 'openai/gpt-image-2.6/sunburst/text-to-image') {
        return {
          prompt,
          image_size: getGptImageSize(promptData.imageAspectRatio, promptData.imageResolution),
          quality: 'high',
          num_images: 1,
          output_format: 'png',
        };
      }

      const imageUrls: string[] = [];
      for (const node of connectedNodes) {
        if (node.type === 'image') {
          imageUrls.push(await resolveImageUrl(node.data as ImageNodeData));
        } else if (node.type === 'element') {
          imageUrls.push(...(await resolveElementUrls(node.data as ElementNodeData)));
        } else if (node.type === 'output') {
          const data = node.data as OutputNodeData;
          if (data.outputType === 'image' && data.imageUrl) imageUrls.push(data.imageUrl);
        }
      }

      if (imageUrls.length === 0) throw new Error('At least one image is required for image editing');
      if (imageUrls.length > GPT_IMAGE_MAX_INPUTS) {
        throw new Error(`Image editing accepts up to ${GPT_IMAGE_MAX_INPUTS} input images. You have ${imageUrls.length}.`);
      }

      return {
        prompt,
        image_urls: imageUrls,
        image_size: 'auto',
        quality: 'high',
        num_images: 1,
        output_format: 'png',
      };
    },
    [buildPromptText]
  );

  /**
   * LTX 2.5 audio-to-video input. First frame: an image wired into the Audio node,
   * otherwise a Start Frame image connected to the prompt. Prompt is optional with an image.
   */
  const buildAudioToVideoInput = useCallback(
    async (
      promptNodeId: string,
      promptData: PromptNodeData,
      connectedNodes: NovaNode[],
      model: AudioToVideoModel
    ): Promise<{ input: LtxAudioToVideoInput; audioSeconds: number }> => {
      const audioNode = getAudioSource(connectedNodes);
      if (!audioNode) throw new Error('Connect an Audio node with a file for audio-to-video');
      const audioData = audioNode.data as AudioNodeData;

      const audioSeconds = audioData.duration || 0;
      const maxSeconds = model === 'lightricks/ltx-2.5/audio-to-video/fast'
        ? LTX_A2V_MAX_AUDIO_SECONDS.fast
        : LTX_A2V_MAX_AUDIO_SECONDS.pro;
      if (audioSeconds > 0 && (audioSeconds < LTX_A2V_MIN_AUDIO_SECONDS || audioSeconds > maxSeconds)) {
        throw new Error(`Audio must be ${LTX_A2V_MIN_AUDIO_SECONDS}–${LTX_A2V_MAX_AUDIO_SECONDS.fast} seconds for audio-to-video (this clip is ${audioSeconds.toFixed(1)}s).`);
      }

      const { nodes: allNodes, edges: allEdges } = useCanvasStore.getState();
      const upstreamImage = allEdges
        .filter((e) => e.target === audioNode.id)
        .map((e) => allNodes.find((n) => n.id === e.source))
        .find((n): n is NovaNode =>
          Boolean(n) &&
          (n!.type === 'image' || (n!.type === 'output' && (n!.data as OutputNodeData).outputType === 'image'))
        );
      const firstFrameNode =
        upstreamImage ??
        connectedNodes.find((n) => n.type === 'image' && (n.data as ImageNodeData).role === 'start_frame');

      let imageUrl: string | undefined;
      if (firstFrameNode?.type === 'image') imageUrl = await resolveImageUrl(firstFrameNode.data as ImageNodeData);
      else if (firstFrameNode?.type === 'output') imageUrl = (firstFrameNode.data as OutputNodeData).imageUrl;

      const prompt = buildPromptText(promptNodeId, promptData, connectedNodes).trim();
      if (!imageUrl && !prompt) throw new Error('Add a prompt or connect a first-frame image for audio-to-video');

      const input: LtxAudioToVideoInput = {
        audio_url: await resolveAudioUrl(audioData),
        aspect_ratio: promptData.aspectRatio === '16:9' || promptData.aspectRatio === '9:16' ? promptData.aspectRatio : 'auto',
      };
      if (imageUrl) input.image_url = imageUrl;
      if (prompt) input.prompt = prompt;
      return { input, audioSeconds };
    },
    [buildPromptText]
  );

  /**
   * Place the result: fill the chain placeholder if this prompt is a chain step,
   * otherwise create an output node wired to the prompt. Then persist to R2.
   */
  const deliverOutput = useCallback(
    (promptNode: NovaNode, promptData: PromptNodeData, output: OutputPayload) => {
      const isVideo = output.outputType === 'video';
      const nodeData = {
        outputType: output.outputType,
        ...(isVideo
          ? { videoUrl: output.url, thumbnailUrl: '', videoDuration: output.videoDuration }
          : { imageUrl: output.url, thumbnailUrl: output.url }),
        dimensions: output.dimensions,
        role: 'output' as const,
        canChain: isVideo,
        generationMetadata: output.metadata,
      };
      const persistUrls = isVideo ? { videoUrl: output.url } : { imageUrl: output.url };

      const chainStepInfo = promptData.chainId
        ? useChainStore.getState().getStepForPrompt(promptNode.id)
        : null;

      if (chainStepInfo) {
        updateNode(chainStepInfo.step.placeholderOutputId, { ...nodeData, isPlaceholder: false });
        persistOutputToR2(chainStepInfo.step.placeholderOutputId, persistUrls);
        useChainStore.getState().setStepStatus(chainStepInfo.chain.id, chainStepInfo.stepIndex, 'awaiting_validation');
        return;
      }

      const outputNode = createNode(
        'output',
        { x: promptNode.position.x + 400, y: promptNode.position.y },
        nodeData
      );
      addNode(outputNode);
      addEdge({
        id: `edge-${nanoid()}`,
        source: promptNode.id,
        target: outputNode.id,
        sourceHandle: 'output',
        targetHandle: 'input',
      });
      persistOutputToR2(outputNode.id, persistUrls);
    },
    [updateNode, addNode, addEdge, persistOutputToR2]
  );

  /**
   * Start generation for a prompt node
   */
  const startGeneration = useCallback(
    async (promptNodeId: string) => {
      const promptNode = useCanvasStore.getState().nodes.find((n) => n.id === promptNodeId);
      if (!promptNode || promptNode.type !== 'prompt') {
        throw new Error('Invalid prompt node');
      }

      const promptData = promptNode.data as PromptNodeData;
      const connectedNodes = getConnectedInputs(promptNodeId);

      if (!promptData.prompt.trim() && !getAudioSource(connectedNodes)) {
        throw new Error('Prompt is empty');
      }

      // Validate @tags against connections (video mode only)
      if (promptData.mode === 'video' && connectedNodes.length > 0) {
        const usedTags = connectedNodes
          .map((n) => getEdgeTag(n.id, promptNodeId))
          .filter(Boolean) as string[];
        const nameTagToElementTag = new Map<string, string>();
        for (const node of connectedNodes) {
          if (node.type !== 'element') continue;
          const data = node.data as ElementNodeData;
          const elementTag = getEdgeTag(node.id, promptNodeId);
          if (data.name && isValidNameForTag(data.name) && elementTag) {
            nameTagToElementTag.set(formatNameAsTag(data.name), elementTag);
          }
        }
        const tagValidation = validateAllTags(promptData.prompt, usedTags, nameTagToElementTag);
        if (!tagValidation.valid) {
          throw new Error(`Missing connections for tags: ${tagValidation.missing.join(', ')}`);
        }
      }

      const plan = planGeneration(promptData, connectedNodes);

      updateNode(promptNodeId, {
        status: 'generating',
        progress: 0,
        selectedModel: plan.model,
        error: undefined,
      });

      const requestId = nanoid();
      const onQueueUpdate = (update: { status: string }) => {
        if (update.status === 'IN_PROGRESS') {
          updateNode(promptNodeId, { status: 'generating', progress: 50 });
        }
      };

      try {
        await waitForPendingUploads(connectedNodes);
        // Re-read connected nodes so background-upload remoteUrls are present
        const readyNodes = getConnectedInputs(promptNodeId);
        assertNoUploadErrors(readyNodes);

        // Bring-your-own-key: generation runs on the user's fal.ai account
        if (!useSettingsStore.getState().falApiKey) {
          throw new Error(FAL_KEY_REQUIRED_MESSAGE);
        }

        const baseMetadata = {
          promptUsed: promptData.prompt,
          modelUsed: plan.model,
          inputNodes: connectedNodes.map((n) => n.id),
          createdAt: new Date(),
          cost: plan.costUsd,
          costBreakdown: plan.breakdown,
          costIsEstimate: plan.isEstimate,
        };

        let output: OutputPayload;
        let falRequestId: string | undefined;
        let videoFile: { url: string; fileSize: number; fileName: string; contentType: string } | undefined;

        if (plan.kind === 'image') {
          const model = plan.model as ImageModel;
          const input = await buildImageInput(promptNodeId, promptData, readyNodes, model);
          addToQueue({ id: requestId, promptNodeId, model, input });
          setActiveGeneration({ id: requestId, promptNodeId, model, input, status: 'processing', createdAt: new Date() });

          const result = await generateImage({ model, input, onQueueUpdate });
          const image = result.data?.images[0];
          if (!result.success || !image) throw new Error(result.error || 'Image generation failed');

          const requested = 'image_urls' in input
            ? null
            : getGptImageSize(promptData.imageAspectRatio, promptData.imageResolution);
          const width = image.width ?? requested?.width ?? 0;
          const height = image.height ?? requested?.height ?? 0;
          // Price the image fal actually rendered (edits follow the inputs' size)
          const actualCost = width > 0 && height > 0 ? estimateImageCostFromPixels(width, height) : null;
          falRequestId = result.requestId;
          output = {
            outputType: 'image',
            url: image.url,
            dimensions: { width, height },
            metadata: {
              ...baseMetadata,
              ...(actualCost && {
                cost: actualCost.costUsd,
                costBreakdown: actualCost.breakdown,
                costIsEstimate: actualCost.isEstimate,
              }),
              aspectRatio: 'image_urls' in input ? 'auto' : promptData.imageAspectRatio,
              resolution: promptData.imageResolution,
              requestId: result.requestId || requestId,
            },
          };
        } else if (plan.kind === 'audio-to-video') {
          const model = plan.model as AudioToVideoModel;
          const { input, audioSeconds } = await buildAudioToVideoInput(promptNodeId, promptData, readyNodes, model);
          addToQueue({ id: requestId, promptNodeId, model, input });
          setActiveGeneration({ id: requestId, promptNodeId, model, input, status: 'processing', createdAt: new Date() });

          const result = await generateAudioToVideo({ model, input, onQueueUpdate });
          const video = result.data?.video;
          if (!result.success || !video) throw new Error(result.error || 'Audio-to-video generation failed: no video returned');

          const duration = video.duration ?? audioSeconds;
          // Billed on the input audio length
          const actualCost = audioSeconds > 0 ? estimateAudioToVideoCost(model, audioSeconds) : null;
          falRequestId = result.requestId;
          videoFile = {
            url: video.url,
            fileSize: video.file_size ?? 0,
            fileName: video.file_name ?? 'ltx-video.mp4',
            contentType: video.content_type ?? 'video/mp4',
          };
          output = {
            outputType: 'video',
            url: video.url,
            videoDuration: duration,
            dimensions: { width: video.width ?? 1920, height: video.height ?? 1080 },
            metadata: {
              ...baseMetadata,
              ...(actualCost && {
                cost: actualCost.costUsd,
                costBreakdown: actualCost.breakdown,
                costIsEstimate: actualCost.isEstimate,
              }),
              duration,
              aspectRatio: input.aspect_ratio ?? 'auto',
              requestId: result.requestId || requestId,
            },
          };
        } else {
          const model = plan.model as VideoModel;
          const input = await buildVideoInput(promptNodeId, promptData, readyNodes, model);
          addToQueue({ id: requestId, promptNodeId, model, input });
          setActiveGeneration({ id: requestId, promptNodeId, model, input, status: 'processing', createdAt: new Date() });

          const result = await generateVideo({ model, input, onQueueUpdate });
          const video = result.data?.video;
          if (!result.success || !video) throw new Error(result.error || 'Video generation failed');

          const isEditTask = 'task' in input && input.task === 'editing';
          const duration = isEditTask
            ? getReferenceVideoSeconds(readyNodes) || parseInt(promptData.duration, 10)
            : parseInt(promptData.duration, 10);
          // Image-to-video and edits follow the source's framing
          const aspectRatio = model === 'bytedance/seedance-2.5/us/image-to-video' || isEditTask
            ? 'auto'
            : promptData.aspectRatio;
          falRequestId = result.requestId;
          videoFile = {
            url: video.url,
            fileSize: video.file_size ?? 0,
            fileName: video.file_name ?? 'seedance-video.mp4',
            contentType: video.content_type ?? 'video/mp4',
          };
          output = {
            outputType: 'video',
            url: video.url,
            videoDuration: duration,
            dimensions: videoDimensions(promptData.videoResolution, aspectRatio === 'auto' ? '16:9' : aspectRatio),
            metadata: {
              ...baseMetadata,
              duration,
              aspectRatio,
              resolution: promptData.videoResolution,
              generateAudio: promptData.generateAudio,
              requestId: result.requestId || requestId,
            },
          };
        }

        deliverOutput(promptNode, promptData, output);
        updateNode(promptNodeId, { status: 'completed', progress: 100 });
        completeGeneration(requestId, {
          success: true,
          video: videoFile,
          requestId: falRequestId || requestId,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        updateNode(promptNodeId, { status: 'error', error: errorMessage });
        failGeneration(requestId, errorMessage);
      }
    },
    [
      getConnectedInputs,
      getEdgeTag,
      buildVideoInput,
      buildImageInput,
      buildAudioToVideoInput,
      deliverOutput,
      updateNode,
      addToQueue,
      setActiveGeneration,
      completeGeneration,
      failGeneration,
    ]
  );

  /**
   * Estimated fal.ai cost (USD) and model label for a prompt node
   */
  const getEstimatedCost = useCallback(
    (promptNodeId: string): { cost: number; breakdown: string; model: string } | null => {
      const promptNode = useCanvasStore.getState().nodes.find((n) => n.id === promptNodeId);
      if (!promptNode || promptNode.type !== 'prompt') return null;
      const plan = planGeneration(promptNode.data as PromptNodeData, getConnectedInputs(promptNodeId));
      return { cost: plan.costUsd, breakdown: plan.breakdown, model: getModelDisplayName(plan.model) };
    },
    [getConnectedInputs]
  );

  return {
    startGeneration,
    getEstimatedCost,
  };
}
