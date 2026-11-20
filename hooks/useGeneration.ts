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
  analyzeInputs,
  buildImageRequest,
  buildLipSyncRequest,
  buildVideoRequest,
  combineEstimates,
  FAL_KEY_REQUIRED_MESSAGE,
  formatNameAsTag,
  getModelDisplayName,
  isValidNameForTag,
  planGeneration,
  portraitPrompt,
  type ResolvedElement,
  type ResolvedMedia,
  runFal,
  translateNameTagsForApi,
  uploadFile,
  validateAllTags,
} from '@/lib/fal';
import type { CostEstimate, GenerationPlan } from '@/lib/fal';
import { buildAudioRequest } from '@/lib/fal/audio-models';
import type {
  AudioGenerationOutput,
  AudioNodeData,
  CameraNodeData,
  ElementNodeData,
  FalInput,
  GenerationMetadata,
  ImageGenerationOutput,
  ImageNodeData,
  LightingNodeData,
  LipSyncOutput,
  NovaNode,
  OutputNodeData,
  PromptNodeData,
  VideoGenerationOutput,
  VideoNodeData,
  VideoResolution,
} from '@/types';
import { formatCameraSettings } from '@/components/nodes/CameraNode';
import { formatLightingSettings } from '@/components/nodes/LightingNode';

const VIDEO_HEIGHT: Record<VideoResolution, number> = { '360p': 360, '480p': 480, '720p': 720, '1080p': 1080, '4k': 2160 };

/** Expected output dimensions for a render whose exact size isn't returned by the API. */
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

/** Best identity views first, so models that take fewer views get the most useful ones. */
const VIEW_PRIORITY = ['three-quarter', 'face', 'side', 'back'];

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

/** Frontal image plus ordered views, uploading on demand. */
async function resolveElement(data: ElementNodeData, tag: string | undefined): Promise<ResolvedElement> {
  if (!data.frontalFile && !data.frontalImageUrl && !data.frontalRemoteUrl) {
    throw new Error(`Character "${data.name}" is missing a frontal image. Add one before generating.`);
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

  // Generated turnaround views carry labels: put the most identity-rich first
  const generated = data.generatedReferenceUrls ?? [];
  const labels = data.generatedReferenceLabels ?? [];
  const rank = (url: string) => {
    const i = generated.indexOf(url);
    const label = i >= 0 ? labels[i] : undefined;
    const p = label ? VIEW_PRIORITY.indexOf(label) : -1;
    return p >= 0 ? p : VIEW_PRIORITY.length;
  };
  const views = [...references].sort((a, b) => rank(a) - rank(b));

  return {
    tag,
    name: data.name || tag || 'the character',
    kind: data.elementType,
    frontal,
    views,
    appearance: data.appearance,
  };
}

/** Face close-up of a character when it has one, else its frontal image. */
function elementFaceUrl(element: ResolvedElement, data: ElementNodeData): string {
  const i = (data.generatedReferenceLabels ?? []).indexOf('face');
  const url = i >= 0 ? data.generatedReferenceUrls?.[i] : undefined;
  return url ?? element.frontal;
}

async function resolveAudioUrl(data: AudioNodeData): Promise<string> {
  if (data.remoteUrl) return data.remoteUrl;
  if (data.file) return uploadFile(data.file);
  if (data.audioUrl) {
    // Only a blob URL is available: materialise it and upload
    const blob = await (await fetch(data.audioUrl)).blob();
    return uploadFile(new File([blob], data.fileName || 'audio.mp3', { type: blob.type }));
  }
  throw new Error('Audio file is required for lip-sync. Upload an audio file to the Audio node.');
}

function nodeMediaUrl(node: NovaNode): Promise<string | undefined> {
  if (node.type === 'image') return resolveImageUrl(node.data as ImageNodeData);
  if (node.type === 'video') return resolveVideoUrl(node.data as VideoNodeData);
  if (node.type === 'output') {
    const data = node.data as OutputNodeData;
    return Promise.resolve(data.outputType === 'video' ? data.videoUrl : data.imageUrl);
  }
  return Promise.resolve(undefined);
}

interface OutputPayload {
  outputType: 'video' | 'image';
  url: string;
  dimensions: { width: number; height: number };
  videoDuration?: number;
  metadata: GenerationMetadata;
}

/** Below the prompt's lowest existing result, so new takes never land on top of old ones. */
function nextResultPosition(promptNode: NovaNode, offset: { x: number; y: number }): { x: number; y: number } {
  const { nodes, edges } = useCanvasStore.getState();
  const results = edges
    .filter((e) => e.source === promptNode.id)
    .map((e) => nodes.find((n) => n.id === e.target))
    .filter((n): n is NovaNode => Boolean(n) && (n!.type === 'output' || n!.type === 'audio'));
  const x = promptNode.position.x + offset.x;
  if (results.length === 0) return { x, y: promptNode.position.y + offset.y };
  const bottom = Math.max(...results.map((n) => n.position.y + (n.measured?.height ?? 360)));
  return { x, y: bottom + 32 };
}

/** Length of a remote audio file from its metadata (0 if it can't be read). */
function probeRemoteAudio(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    const done = (seconds: number) => {
      audio.removeAttribute('src');
      resolve(Number.isFinite(seconds) ? seconds : 0);
    };
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done(0);
    audio.src = url;
  });
}

function firstVideoUrl(data: VideoGenerationOutput | LipSyncOutput | undefined): string | undefined {
  return data?.video?.url;
}

export function useGeneration() {
  const { user } = useAuth();

  const {
    updateNode,
    addNode,
    addEdge,
    getGenerationInputs: getConnectedInputs,
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
   * Upload/collect every connected input once, in tag order, for the request builders.
   */
  const resolveMedia = useCallback(
    async (promptNodeId: string, promptData: PromptNodeData, connectedNodes: NovaNode[]): Promise<ResolvedMedia> => {
      const shape = analyzeInputs(connectedNodes);
      const tagOf = (node: NovaNode) => getEdgeTag(node.id, promptNodeId);

      const images = await Promise.all(
        [...shape.referenceImages]
          .sort((a, b) => tagIndex(tagOf(a)) - tagIndex(tagOf(b)))
          .map(async (node) => ({ url: (await nodeMediaUrl(node)) ?? '', tag: tagOf(node) }))
      );
      const elementNodes = [...shape.elements].sort((a, b) => tagIndex(tagOf(a)) - tagIndex(tagOf(b)));
      const elements = await Promise.all(
        elementNodes.map((node) => resolveElement(node.data as ElementNodeData, tagOf(node)))
      );
      const videos = await Promise.all(
        [...shape.videos]
          .sort((a, b) => tagIndex(tagOf(a)) - tagIndex(tagOf(b)))
          .map(async (node) => ({
            url: (await nodeMediaUrl(node)) ?? '',
            tag: tagOf(node),
            seconds: (node.type === 'video'
              ? (node.data as VideoNodeData).duration
              : (node.data as OutputNodeData).videoDuration) || 0,
          }))
      );

      const media: ResolvedMedia = {
        prompt: buildPromptText(promptNodeId, promptData, connectedNodes),
        images: images.filter((i) => i.url),
        elements,
        videos: videos.filter((v) => v.url),
      };
      if (shape.startFrame) media.startFrame = await nodeMediaUrl(shape.startFrame);
      if (shape.endFrame) media.endFrame = await resolveImageUrl(shape.endFrame.data as ImageNodeData);

      if (shape.audio) {
        const audioData = shape.audio.data as AudioNodeData;
        media.audio = { url: await resolveAudioUrl(audioData), seconds: audioData.duration || 0 };
        if (shape.lipSyncVideo) media.lipSyncVideo = await nodeMediaUrl(shape.lipSyncVideo);
        if (shape.faceImage) {
          if (shape.faceImage.type === 'element') {
            const i = elementNodes.indexOf(shape.faceImage);
            media.faceImage = elements[i]?.frontal;
          } else {
            media.faceImage = await nodeMediaUrl(shape.faceImage);
          }
        }
        // Multi-person clip + a wired character: lip-sync only that character's mouth
        if (elementNodes.length > 0 && elements[0]) {
          media.speakerFace = elementFaceUrl(elements[0], elementNodes[0].data as ElementNodeData);
        }
      }
      return media;
    },
    [buildPromptText, getEdgeTag]
  );

  /**
   * Place the result: fill the chain placeholder if this prompt is a chain step,
   * otherwise create an output node wired to the prompt. Then persist to R2.
   */
  const deliverOutput = useCallback(
    (promptNode: NovaNode, promptData: PromptNodeData, output: OutputPayload, offset = { x: 400, y: 0 }) => {
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

      const chainStepInfo = promptData.chainId && offset.y === 0
        ? useChainStore.getState().getStepForPrompt(promptNode.id)
        : null;

      if (chainStepInfo) {
        updateNode(chainStepInfo.step.placeholderOutputId, { ...nodeData, isPlaceholder: false });
        persistOutputToR2(chainStepInfo.step.placeholderOutputId, persistUrls);
        useChainStore.getState().setStepStatus(chainStepInfo.chain.id, chainStepInfo.stepIndex, 'awaiting_validation');
        return;
      }

      const outputNode = createNode('output', nextResultPosition(promptNode, offset), nodeData);
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
      const plan: GenerationPlan = planGeneration(promptData, connectedNodes);

      if (!promptData.prompt.trim() && plan.category !== 'lipsync') {
        throw new Error('Prompt is empty');
      }
      if (plan.blocker) throw new Error(plan.blocker);

      // Validate @tags against connections
      if (connectedNodes.length > 0) {
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

      updateNode(promptNodeId, {
        status: 'generating',
        progress: 0,
        selectedModel: plan.endpoint,
        error: undefined,
      });

      const requestId = nanoid();
      const onQueueUpdate = (update: { status: string }) => {
        if (update.status === 'IN_PROGRESS') {
          updateNode(promptNodeId, { status: 'generating', progress: 50 });
        }
      };
      const track = (endpoint: GenerationPlan['endpoint'], input: FalInput) => {
        addToQueue({ id: requestId, promptNodeId, model: endpoint, input });
        setActiveGeneration({ id: requestId, promptNodeId, model: endpoint, input, status: 'processing', createdAt: new Date() });
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

        const media = await resolveMedia(promptNodeId, promptData, readyNodes);
        const metadataFor = (cost: CostEstimate, extra: Partial<GenerationMetadata> & { requestId: string; aspectRatio: string }): GenerationMetadata => ({
          promptUsed: promptData.prompt,
          modelUsed: plan.endpoint,
          modelLabel: plan.modelLabel,
          category: plan.category,
          inputNodes: connectedNodes.map((n) => n.id),
          createdAt: new Date(),
          cost: cost.costUsd,
          costBreakdown: cost.breakdown,
          costIsEstimate: cost.isEstimate,
          ...extra,
        });

        let output: OutputPayload;
        let falRequestId: string | undefined;

        if (plan.category === 'image' && plan.image) {
          const request = buildImageRequest(plan.image, media);
          track(request.endpoint, request.input);
          const result = await runFal<FalInput, ImageGenerationOutput>(request.endpoint, request.input, onQueueUpdate);
          const image = result.data?.images[0];
          if (!result.success || !image) throw new Error(result.error || 'Image generation failed');

          const width = image.width ?? plan.image.size.width;
          const height = image.height ?? plan.image.size.height;
          // Price the image fal actually rendered (edits follow the inputs' size)
          const actual = plan.image.spec.price({
            width,
            height,
            resolution: plan.image.resolution,
            inputImages: plan.image.edit ? analyzeInputs(readyNodes).editInputs : 0,
          });
          falRequestId = result.requestId;
          output = {
            outputType: 'image',
            url: image.url,
            dimensions: { width, height },
            metadata: metadataFor(actual, {
              modelUsed: request.endpoint,
              aspectRatio: plan.image.edit ? 'auto' : plan.image.aspectRatio,
              resolution: plan.image.resolution,
              requestId: result.requestId || requestId,
            }),
          };
        } else if (plan.category === 'lipsync' && plan.lipsync) {
          const lip = plan.lipsync;
          let faceUrl: string | undefined;
          let stillCost: CostEstimate | undefined;

          if (lip.route === 'generated-face' && lip.still) {
            // Step 1: generate the performer's portrait, keep it on the canvas for reuse
            const stillRequest = buildImageRequest({ ...lip.still, edit: false }, { ...media, prompt: portraitPrompt(media) });
            track(stillRequest.endpoint, stillRequest.input);
            const still = await runFal<FalInput, ImageGenerationOutput>(stillRequest.endpoint, stillRequest.input, onQueueUpdate);
            const image = still.data?.images[0];
            if (!still.success || !image) throw new Error(still.error || 'Portrait generation failed');
            faceUrl = image.url;
            const width = image.width ?? lip.still.size.width;
            const height = image.height ?? lip.still.size.height;
            stillCost = lip.still.spec.price({ width, height, resolution: lip.still.resolution, inputImages: 0 });
            deliverOutput(promptNode, promptData, {
              outputType: 'image',
              url: image.url,
              dimensions: { width, height },
              metadata: metadataFor(stillCost, {
                modelUsed: stillRequest.endpoint,
                modelLabel: lip.still.spec.label,
                category: 'image',
                aspectRatio: lip.still.aspectRatio,
                resolution: lip.still.resolution,
                requestId: still.requestId || requestId,
              }),
            }, { x: 400, y: -320 });
          }

          // Step 2: lip-sync
          const request = buildLipSyncRequest(lip, media, faceUrl);
          track(request.endpoint, request.input);
          const result = await runFal<FalInput, LipSyncOutput>(request.endpoint, request.input, onQueueUpdate);
          const url = firstVideoUrl(result.data);
          if (!result.success || !url) throw new Error(result.error || 'Lip-sync failed: no video returned');

          const seconds = result.data?.duration ?? lip.audioSeconds;
          const lipCost = lip.spec.price({ seconds: seconds || lip.audioSeconds, resolution: lip.resolution });
          const cost = stillCost
            ? combineEstimates([{ label: 'portrait', estimate: stillCost }, { label: 'lip-sync', estimate: lipCost }])
            : lipCost;
          falRequestId = result.requestId;
          output = {
            outputType: 'video',
            url,
            videoDuration: seconds || undefined,
            dimensions: videoDimensions('1080p', promptData.aspectRatio),
            metadata: metadataFor(cost, {
              modelUsed: request.endpoint,
              duration: seconds,
              aspectRatio: 'auto',
              resolution: lip.spec.resolutions.length > 0 ? lip.resolution : undefined,
              requestId: result.requestId || requestId,
            }),
          };
        } else if (plan.audio) {
          // Speech / sound / music → an Audio node on the canvas (ready for lip-sync and the timeline)
          const spec = plan.audio.spec;
          const request = buildAudioRequest(spec, promptData, media.prompt);
          track(request.endpoint, request.input);
          const result = await runFal<FalInput, AudioGenerationOutput>(request.endpoint, request.input, onQueueUpdate);
          const audio = result.data?.audio;
          if (!result.success || !audio?.url) throw new Error(result.error || 'Audio generation failed');

          const seconds = audio.duration ?? result.data?.duration ?? (await probeRemoteAudio(audio.url));
          const actual = spec.price({ characters: promptData.prompt.length, seconds: seconds || plan.audio.seconds });
          const extension = audio.content_type?.includes('wav') ? 'wav' : 'mp3';
          const audioNode = createNode(
            'audio',
            nextResultPosition(promptNode, { x: 400, y: 0 }),
            {
              audioUrl: audio.url,
              remoteUrl: audio.url,
              uploadStatus: 'completed',
              fileName: audio.file_name || `${spec.kind}-${nanoid(6)}.${extension}`,
              fileSize: audio.file_size ?? 0,
              duration: seconds,
              generationMetadata: metadataFor(seconds > 0 ? actual : plan, {
                modelUsed: request.endpoint,
                duration: seconds || undefined,
                aspectRatio: 'n/a',
                requestId: result.requestId || requestId,
              }),
            }
          );
          addNode(audioNode);
          addEdge({
            id: `edge-${nanoid()}`,
            source: promptNode.id,
            target: audioNode.id,
            sourceHandle: 'output',
            targetHandle: 'input',
          });
          updateNode(promptNodeId, { status: 'completed', progress: 100 });
          completeGeneration(requestId, { success: true, requestId: result.requestId || requestId });
          return;
        } else if (plan.video) {
          const video = plan.video;
          const request = buildVideoRequest(video, media);
          track(request.endpoint, request.input);
          const result = await runFal<FalInput, VideoGenerationOutput>(request.endpoint, request.input, onQueueUpdate);
          const url = firstVideoUrl(result.data);
          if (!result.success || !url) throw new Error(result.error || 'Video generation failed');

          const duration = video.editing
            ? media.videos.reduce((s, v) => s + v.seconds, 0) || video.durationSeconds
            : video.durationSeconds;
          const aspectRatio = video.aspectFollowsFrame || video.editing ? 'auto' : video.aspectRatio;
          falRequestId = result.requestId;
          output = {
            outputType: 'video',
            url,
            videoDuration: duration,
            dimensions: videoDimensions(video.resolution, aspectRatio === 'auto' ? '16:9' : aspectRatio),
            metadata: metadataFor(plan, {
              modelUsed: request.endpoint,
              duration,
              aspectRatio,
              resolution: video.resolution,
              generateAudio: video.audio,
              requestId: result.requestId || requestId,
            }),
          };
        } else {
          throw new Error('Nothing to generate');
        }

        deliverOutput(promptNode, promptData, output);
        updateNode(promptNodeId, { status: 'completed', progress: 100 });
        completeGeneration(requestId, {
          success: true,
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
      resolveMedia,
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
      return { cost: plan.costUsd, breakdown: plan.breakdown, model: getModelDisplayName(plan.endpoint) };
    },
    [getConnectedInputs]
  );

  return {
    startGeneration,
    getEstimatedCost,
  };
}
