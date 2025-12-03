'use client';

import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useCanvasStore, createNode } from '@/stores';
import { useGenerationStore } from '@/stores';
import { pendingUploads } from './useBackgroundUpload';
import {
  generateVideo,
  generateImage,
  uploadFile,
  selectModel,
  selectImageModel,
  parseTags,
  validateTags,
  calculateCost,
  calculateImageCost,
  getModelDisplayName,
  MODEL_PRICING,
} from '@/lib/fal';
import type {
  KlingInput,
  KlingModel,
  KlingElement,
  KlingImageToVideoInput,
  KlingReferenceToVideoInput,
  KlingVideoToVideoEditInput,
  KlingVideoToVideoReferenceInput,
  NanoBananaModel,
  NanoBananaInput,
  NanoBananaTextToImageInput,
  NanoBananaImageEditInput,
  PromptNodeData,
  ImageNodeData,
  VideoNodeData,
  ElementNodeData,
  OutputNodeData,
  CameraNodeData,
  LightingNodeData,
  NovaNode,
} from '@/types';
import { formatCameraSettings } from '@/components/nodes/CameraNode';
import { formatLightingSettings } from '@/components/nodes/LightingNode';

/**
 * Wait for all pending uploads for the given nodes to complete
 * Returns the updated node data with remoteUrls populated
 */
async function waitForPendingUploads(connectedNodes: NovaNode[]): Promise<void> {
  const uploadPromises: Promise<unknown>[] = [];

  for (const node of connectedNodes) {
    // Check for node-level pending uploads (image/video nodes)
    const nodeUpload = pendingUploads.get(node.id);
    if (nodeUpload) {
      console.log('[Generation] Waiting for pending upload for node:', node.id);
      uploadPromises.push(nodeUpload);
    }

    // Check for element node uploads (frontal and reference)
    if (node.type === 'element') {
      const frontalUpload = pendingUploads.get(`${node.id}:frontal`);
      if (frontalUpload) {
        console.log('[Generation] Waiting for pending frontal upload for element:', node.id);
        uploadPromises.push(frontalUpload);
      }
      const referenceUpload = pendingUploads.get(`${node.id}:references`);
      if (referenceUpload) {
        console.log('[Generation] Waiting for pending reference uploads for element:', node.id);
        uploadPromises.push(referenceUpload);
      }
    }
  }

  if (uploadPromises.length > 0) {
    console.log('[Generation] Waiting for', uploadPromises.length, 'pending upload(s)...');
    await Promise.all(uploadPromises);
    console.log('[Generation] All pending uploads completed');
  }
}

export function useGeneration() {
  const {
    nodes,
    edges,
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
    isGenerating,
  } = useGenerationStore();

  /**
   * Build the API input based on connected nodes and model type
   * Uses remoteUrl from background uploads when available, otherwise uploads on demand
   */
  const buildApiInput = useCallback(
    async (promptNodeId: string, promptData: PromptNodeData): Promise<KlingInput> => {
      const connectedNodes = getConnectedInputs(promptNodeId);

      // Check for connected camera nodes and build camera settings string
      const cameraNodes = connectedNodes.filter((n) => n.type === 'camera');
      let cameraSettingsText = '';
      if (cameraNodes.length > 0) {
        const allCameraSettings = cameraNodes
          .map((n) => formatCameraSettings(n.data as CameraNodeData))
          .filter((s) => s.length > 0);
        if (allCameraSettings.length > 0) {
          cameraSettingsText = allCameraSettings.join(', ');
          console.log('[Generation] Camera settings:', cameraSettingsText);
        }
      }

      // Check for connected lighting nodes and build lighting settings string
      const lightingNodes = connectedNodes.filter((n) => n.type === 'lighting');
      let lightingSettingsText = '';
      if (lightingNodes.length > 0) {
        const allLightingSettings = lightingNodes
          .map((n) => formatLightingSettings(n.data as LightingNodeData))
          .filter((s) => s.length > 0);
        if (allLightingSettings.length > 0) {
          lightingSettingsText = allLightingSettings.join(', ');
          console.log('[Generation] Lighting settings:', lightingSettingsText);
        }
      }

      // Append camera and lighting settings to prompt if any
      const settingsParts = [cameraSettingsText, lightingSettingsText].filter((s) => s.length > 0);
      const enhancedPrompt = settingsParts.length > 0
        ? `${promptData.prompt}. ${settingsParts.join('. ')}`
        : promptData.prompt;

      const model = selectModel(
        connectedNodes.map((n) => ({
          nodeId: n.id,
          nodeType: n.type,
          handleId: '',
          tag: getEdgeTag(n.id, promptNodeId),
          // Include outputType for output nodes so model selector can detect video/image inputs
          outputType: n.type === 'output' ? (n.data as OutputNodeData).outputType : undefined,
          // Include role for image nodes so model selector can detect reference vs start/end frames
          role: n.type === 'image' ? (n.data as ImageNodeData).role : undefined,
        })),
        promptData.prompt
      );

      // Collect data from connected nodes, converting files to base64
      const images: { url: string; tag?: string; role: string }[] = [];
      const videos: { url: string; tag?: string }[] = [];
      const elements: KlingElement[] = [];

      for (const node of connectedNodes) {
        if (node.type === 'image') {
          const data = node.data as ImageNodeData;

          // Check for upload error
          if (data.uploadStatus === 'error') {
            throw new Error(`Image "${data.fileName}" failed to upload: ${data.uploadError || 'Unknown error'}`);
          }

          // Use remoteUrl from background upload if available, otherwise upload on demand
          let url: string;
          if (data.remoteUrl) {
            url = data.remoteUrl;
            console.log('[Generation] Using pre-uploaded URL for image:', node.id);
          } else if (data.file) {
            console.log('[Generation] Uploading image on demand:', node.id);
            url = await uploadFile(data.file);
          } else {
            url = data.imageUrl;
          }

          images.push({
            url,
            tag: getEdgeTag(node.id, promptNodeId),
            role: data.role,
          });
        } else if (node.type === 'video') {
          const data = node.data as VideoNodeData;

          // Check for upload error
          if (data.uploadStatus === 'error') {
            throw new Error(`Video "${data.fileName}" failed to upload: ${data.uploadError || 'Unknown error'}`);
          }

          // Use remoteUrl from background upload if available, otherwise upload on demand
          let url: string;
          if (data.remoteUrl) {
            url = data.remoteUrl;
            console.log('[Generation] Using pre-uploaded URL for video:', node.id);
          } else if (data.file) {
            console.log('[Generation] Uploading video on demand:', node.id);
            url = await uploadFile(data.file);
          } else {
            url = data.videoUrl;
          }

          videos.push({
            url,
            tag: getEdgeTag(node.id, promptNodeId),
          });
        } else if (node.type === 'element') {
          const data = node.data as ElementNodeData;

          // Check for upload errors
          if (data.frontalUploadStatus === 'error') {
            throw new Error(`Element "${data.name}" frontal image failed to upload: ${data.frontalUploadError || 'Unknown error'}`);
          }
          if (data.referenceUploadStatus === 'error') {
            throw new Error(`Element "${data.name}" reference images failed to upload: ${data.referenceUploadError || 'Unknown error'}`);
          }

          // Validate that frontal image exists
          if (!data.frontalFile && !data.frontalImageUrl && !data.frontalRemoteUrl) {
            throw new Error(`Element "${data.name}" is missing a frontal image. Please add a frontal image before generating.`);
          }

          // Use remoteUrl from background upload if available, otherwise upload on demand
          let frontalUrl: string;
          if (data.frontalRemoteUrl) {
            frontalUrl = data.frontalRemoteUrl;
            console.log('[Generation] Using pre-uploaded URL for element frontal:', node.id);
          } else if (data.frontalFile) {
            console.log('[Generation] Uploading element frontal on demand:', node.id);
            frontalUrl = await uploadFile(data.frontalFile);
          } else {
            frontalUrl = data.frontalImageUrl;
          }

          // Use remoteUrls from background upload if available, otherwise upload on demand
          let referenceUrls: string[] | undefined;
          if (data.referenceRemoteUrls && data.referenceRemoteUrls.length > 0) {
            referenceUrls = data.referenceRemoteUrls;
            console.log('[Generation] Using pre-uploaded URLs for element references:', node.id);
          } else if (data.referenceFiles && data.referenceFiles.length > 0) {
            console.log('[Generation] Uploading element references on demand:', node.id);
            referenceUrls = await Promise.all(
              data.referenceFiles.map((f) => uploadFile(f))
            );
          } else if (data.referenceImageUrls.length > 0) {
            referenceUrls = data.referenceImageUrls;
          }

          elements.push({
            frontal_image_url: frontalUrl,
            reference_image_urls: referenceUrls,
          });
        } else if (node.type === 'output') {
          // Handle output nodes converted to reference
          const data = node.data as OutputNodeData;
          if (data.role === 'reference') {
            if (data.outputType === 'image' && data.imageUrl) {
              // Treat as image reference
              images.push({
                url: data.imageUrl,
                tag: getEdgeTag(node.id, promptNodeId),
                role: 'reference',
              });
            } else if (data.outputType === 'video' && data.videoUrl) {
              // Treat as video reference
              videos.push({
                url: data.videoUrl,
                tag: getEdgeTag(node.id, promptNodeId),
              });
            }
          }
        }
      }

      // Log what we're about to send
      console.log('[Generation] Building input for model:', model);
      console.log('[Generation] Original Prompt:', promptData.prompt);
      console.log('[Generation] Enhanced Prompt:', enhancedPrompt);
      console.log('[Generation] Elements:', elements.length);
      console.log('[Generation] Images:', images.length);
      console.log('[Generation] Videos:', videos.length);

      // Build input based on model
      switch (model) {
        case 'fal-ai/kling-video/o1/image-to-video': {
          const startFrame = images.find((i) => i.role === 'start_frame');
          const endFrame = images.find((i) => i.role === 'end_frame');

          if (!startFrame) {
            throw new Error('Start frame is required for Image-to-Video');
          }

          const input: KlingImageToVideoInput = {
            prompt: enhancedPrompt,
            start_image_url: startFrame.url,
            end_image_url: endFrame?.url,
            duration: promptData.duration,
            aspect_ratio: promptData.aspectRatio,
            negative_prompt: promptData.negativePrompt,
            cfg_scale: promptData.cfgScale,
          };
          return input;
        }

        case 'fal-ai/kling-video/o1/reference-to-video': {
          // Include images with @Image tags OR role='reference'
          const imageUrls = images
            .filter((i) => i.tag?.startsWith('@Image') || i.role === 'reference')
            .map((i) => i.url);

          const input: KlingReferenceToVideoInput = {
            prompt: enhancedPrompt,
            image_urls: imageUrls.length > 0 ? imageUrls : undefined,
            elements: elements.length > 0 ? elements : undefined,
            duration: promptData.duration,
            aspect_ratio: promptData.aspectRatio,
          };
          return input;
        }

        case 'fal-ai/kling-video/o1/video-to-video/edit': {
          const video = videos[0];
          if (!video) {
            throw new Error('Video is required for Video-to-Video Edit');
          }

          // Include images with @Image tags OR role='reference'
          const imageUrls = images
            .filter((i) => i.tag?.startsWith('@Image') || i.role === 'reference')
            .map((i) => i.url);

          const input: KlingVideoToVideoEditInput = {
            prompt: enhancedPrompt,
            video_url: video.url,
            image_urls: imageUrls.length > 0 ? imageUrls : undefined,
            elements: elements.length > 0 ? elements : undefined,
          };
          return input;
        }

        case 'fal-ai/kling-video/o1/video-to-video/reference': {
          const video = videos[0];
          if (!video) {
            throw new Error('Video is required for Video-to-Video Reference');
          }

          // Include images with @Image tags OR role='reference'
          const imageUrls = images
            .filter((i) => i.tag?.startsWith('@Image') || i.role === 'reference')
            .map((i) => i.url);

          const input: KlingVideoToVideoReferenceInput = {
            prompt: enhancedPrompt,
            video_url: video.url,
            image_urls: imageUrls.length > 0 ? imageUrls : undefined,
            elements: elements.length > 0 ? elements : undefined,
            duration: promptData.duration,
            aspect_ratio: promptData.aspectRatio,
          };
          return input;
        }

        default:
          throw new Error(`Unknown model: ${model}`);
      }
    },
    [getConnectedInputs, getEdgeTag]
  );

  /**
   * Build the API input for image generation (Nano Banana Pro)
   */
  const buildImageApiInput = useCallback(
    async (promptNodeId: string, promptData: PromptNodeData): Promise<NanoBananaInput> => {
      const connectedNodes = getConnectedInputs(promptNodeId);

      // Check for connected camera nodes and build camera settings string
      const cameraNodes = connectedNodes.filter((n) => n.type === 'camera');
      let cameraSettingsText = '';
      if (cameraNodes.length > 0) {
        const allCameraSettings = cameraNodes
          .map((n) => formatCameraSettings(n.data as CameraNodeData))
          .filter((s) => s.length > 0);
        if (allCameraSettings.length > 0) {
          cameraSettingsText = allCameraSettings.join(', ');
          console.log('[Generation] Camera settings for image:', cameraSettingsText);
        }
      }

      // Check for connected lighting nodes and build lighting settings string
      const lightingNodes = connectedNodes.filter((n) => n.type === 'lighting');
      let lightingSettingsText = '';
      if (lightingNodes.length > 0) {
        const allLightingSettings = lightingNodes
          .map((n) => formatLightingSettings(n.data as LightingNodeData))
          .filter((s) => s.length > 0);
        if (allLightingSettings.length > 0) {
          lightingSettingsText = allLightingSettings.join(', ');
          console.log('[Generation] Lighting settings for image:', lightingSettingsText);
        }
      }

      // Append camera and lighting settings to prompt if any
      const settingsParts = [cameraSettingsText, lightingSettingsText].filter((s) => s.length > 0);
      const enhancedPrompt = settingsParts.length > 0
        ? `${promptData.prompt}. ${settingsParts.join('. ')}`
        : promptData.prompt;

      // Debug: Log connected nodes for model selection
      console.log('[Generation] Connected nodes for image mode:', connectedNodes.map((n) => ({
        id: n.id,
        type: n.type,
        outputType: n.type === 'output' ? (n.data as OutputNodeData).outputType : undefined,
      })));

      const modelInputs = connectedNodes.map((n) => ({
        nodeId: n.id,
        nodeType: n.type,
        handleId: '',
        tag: undefined, // No tags in image mode
        outputType: n.type === 'output' ? (n.data as OutputNodeData).outputType : undefined,
      }));

      console.log('[Generation] Model selector inputs:', modelInputs);

      const model = selectImageModel(modelInputs);
      console.log('[Generation] Selected image model:', model);

      // Collect all images from connected nodes (no distinction between types in image mode)
      const imageUrls: string[] = [];

      for (const node of connectedNodes) {
        if (node.type === 'image') {
          const data = node.data as ImageNodeData;

          // Check for upload error
          if (data.uploadStatus === 'error') {
            throw new Error(`Image "${data.fileName}" failed to upload: ${data.uploadError || 'Unknown error'}`);
          }

          // Use remoteUrl from background upload if available, otherwise upload on demand
          let url: string | undefined;
          if (data.remoteUrl) {
            url = data.remoteUrl;
            console.log('[Generation] Using pre-uploaded URL for image:', node.id);
          } else if (data.file) {
            console.log('[Generation] Uploading image on demand:', node.id);
            url = await uploadFile(data.file);
          } else {
            url = data.imageUrl;
          }
          if (url) imageUrls.push(url);
        } else if (node.type === 'element') {
          const data = node.data as ElementNodeData;

          // Check for upload errors
          if (data.frontalUploadStatus === 'error') {
            throw new Error(`Element "${data.name}" frontal image failed to upload: ${data.frontalUploadError || 'Unknown error'}`);
          }
          if (data.referenceUploadStatus === 'error') {
            throw new Error(`Element "${data.name}" reference images failed to upload: ${data.referenceUploadError || 'Unknown error'}`);
          }

          // Use frontal image - remoteUrl first, then file, then url
          if (data.frontalRemoteUrl) {
            imageUrls.push(data.frontalRemoteUrl);
            console.log('[Generation] Using pre-uploaded URL for element frontal:', node.id);
          } else if (data.frontalFile) {
            console.log('[Generation] Uploading element frontal on demand:', node.id);
            imageUrls.push(await uploadFile(data.frontalFile));
          } else if (data.frontalImageUrl) {
            imageUrls.push(data.frontalImageUrl);
          }

          // Also add reference images - remoteUrls first, then files, then urls
          if (data.referenceRemoteUrls && data.referenceRemoteUrls.length > 0) {
            imageUrls.push(...data.referenceRemoteUrls);
            console.log('[Generation] Using pre-uploaded URLs for element references:', node.id);
          } else if (data.referenceFiles && data.referenceFiles.length > 0) {
            console.log('[Generation] Uploading element references on demand:', node.id);
            for (const file of data.referenceFiles) {
              imageUrls.push(await uploadFile(file));
            }
          } else if (data.referenceImageUrls.length > 0) {
            imageUrls.push(...data.referenceImageUrls);
          }
        } else if (node.type === 'output') {
          // Handle output nodes as image input (regardless of role)
          // If user connected it to prompt, they intend to use it as input
          const data = node.data as OutputNodeData;
          if (data.outputType === 'image' && data.imageUrl) {
            imageUrls.push(data.imageUrl);
            console.log('[Generation] Using output node image as input:', node.id);
          }
        }
      }

      console.log('[Generation] Building image input for model:', model);
      console.log('[Generation] Original Prompt:', promptData.prompt);
      console.log('[Generation] Enhanced Prompt:', enhancedPrompt);
      console.log('[Generation] Image URLs:', imageUrls.length);

      if (model === 'fal-ai/nano-banana-pro/edit') {
        // Image editing requires images
        if (imageUrls.length === 0) {
          throw new Error('At least one image is required for image editing');
        }

        // Log the actual image URLs being used
        console.log('[Generation] Edit mode image URLs:', imageUrls);

        // Build edit input with all parameters
        // Use 'auto' aspect ratio to preserve input image dimensions
        const input: NanoBananaImageEditInput = {
          prompt: enhancedPrompt,
          image_urls: imageUrls,
          aspect_ratio: 'auto',
          resolution: promptData.imageResolution,
          output_format: 'png',
        };

        console.log('[Generation] Edit input:', JSON.stringify(input, null, 2));
        return input;
      }

      // Text-to-image
      const input: NanoBananaTextToImageInput = {
        prompt: enhancedPrompt,
        aspect_ratio: promptData.imageAspectRatio,
        resolution: promptData.imageResolution,
        output_format: 'png',
      };
      return input;
    },
    [getConnectedInputs]
  );

  /**
   * Start generation for a prompt node (video or image based on mode)
   */
  const startGeneration = useCallback(
    async (promptNodeId: string) => {
      const promptNode = nodes.find((n) => n.id === promptNodeId);
      if (!promptNode || promptNode.type !== 'prompt') {
        throw new Error('Invalid prompt node');
      }

      const promptData = promptNode.data as PromptNodeData;
      const connectedNodes = getConnectedInputs(promptNodeId);
      const isImageMode = promptData.mode === 'image';

      // Log the prompt data for debugging
      console.log('[Generation] Starting generation for node:', promptNodeId);
      console.log('[Generation] Mode:', promptData.mode);
      console.log('[Generation] Prompt text:', promptData.prompt);
      console.log('[Generation] Connected nodes:', connectedNodes.length);

      // Validate prompt
      if (!promptData.prompt.trim()) {
        throw new Error('Prompt is empty');
      }

      // Mode-specific validation
      if (isImageMode) {
        // Image mode: just needs a prompt
        // Connected images are optional (for editing)
      } else {
        // Video mode: requires connected nodes
        if (connectedNodes.length === 0) {
          throw new Error('No inputs connected to prompt node');
        }

        // Validate tags in prompt (video mode only)
        const usedTags = connectedNodes
          .map((n) => getEdgeTag(n.id, promptNodeId))
          .filter(Boolean) as string[];

        const tagValidation = validateTags(promptData.prompt, usedTags);
        if (!tagValidation.valid) {
          throw new Error(
            `Missing connections for tags: ${tagValidation.missing.join(', ')}`
          );
        }
      }

      // Determine model based on mode
      let model: KlingModel | NanoBananaModel;
      if (isImageMode) {
        model = selectImageModel(
          connectedNodes.map((n) => ({
            nodeId: n.id,
            nodeType: n.type,
            handleId: '',
            tag: undefined,
            // Include outputType for output nodes so model selector can detect image inputs
            outputType: n.type === 'output' ? (n.data as OutputNodeData).outputType : undefined,
          }))
        );
      } else {
        model = selectModel(
          connectedNodes.map((n) => ({
            nodeId: n.id,
            nodeType: n.type,
            handleId: '',
            tag: getEdgeTag(n.id, promptNodeId),
            // Include outputType for output nodes so model selector can detect video/image inputs
            outputType: n.type === 'output' ? (n.data as OutputNodeData).outputType : undefined,
            // Include role for image nodes so model selector can detect reference vs start/end frames
            role: n.type === 'image' ? (n.data as ImageNodeData).role : undefined,
          })),
          promptData.prompt
        );
      }

      // Update prompt node status IMMEDIATELY to show loading feedback
      // Clear any previous error when starting a new generation
      updateNode(promptNodeId, {
        status: 'generating',
        progress: 0,
        selectedModel: model,
        error: undefined,
      });

      // Create request ID early for error tracking
      const requestId = nanoid();

      try {
        // Wait for any pending background uploads to complete before building API input
        // This ensures all remoteUrls are populated in node data
        await waitForPendingUploads(connectedNodes);

        // Re-fetch connected nodes to get updated data with remoteUrls
        const updatedConnectedNodes = getConnectedInputs(promptNodeId);

        // Check for any upload errors after waiting
        for (const node of updatedConnectedNodes) {
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
          }
        }

        if (isImageMode) {
          // IMAGE GENERATION
          const input = await buildImageApiInput(promptNodeId, promptData);

          // Add to queue
          addToQueue({
            id: requestId,
            promptNodeId,
            model,
            input,
          });

          // Start generation
          setActiveGeneration({
            id: requestId,
            promptNodeId,
            model,
            input,
            status: 'processing',
            createdAt: new Date(),
          });

          const result = await generateImage({
            model: model as NanoBananaModel,
            input,
            onQueueUpdate: (update) => {
              if (update.status === 'IN_PROGRESS') {
                updateNode(promptNodeId, {
                  status: 'generating',
                  progress: 50,
                });
              }
            },
          });

          if (result.success && result.data && result.data.images.length > 0) {
            const generatedImage = result.data.images[0];
            const cost = calculateImageCost(model as NanoBananaModel, promptData.imageResolution);

            // Create output node for image
            const promptNodePosition = promptNode.position;
            const outputPosition = {
              x: promptNodePosition.x + 400,
              y: promptNodePosition.y,
            };

            const outputNode = createNode('output', outputPosition, {
              outputType: 'image',
              imageUrl: generatedImage.url,
              thumbnailUrl: generatedImage.url,
              dimensions: { width: generatedImage.width, height: generatedImage.height },
              role: 'output',
              canChain: false, // Images can't be chained for video
              generationMetadata: {
                promptUsed: promptData.prompt,
                modelUsed: model,
                inputNodes: connectedNodes.map((n) => n.id),
                aspectRatio: promptData.imageAspectRatio,
                resolution: promptData.imageResolution,
                createdAt: new Date(),
                requestId: result.requestId || requestId,
                cost,
              },
            });

            addNode(outputNode);

            // Connect prompt to output
            addEdge({
              id: `edge-${nanoid()}`,
              source: promptNodeId,
              target: outputNode.id,
              sourceHandle: 'output',
              targetHandle: 'input',
            });

            // Update prompt node status
            updateNode(promptNodeId, {
              status: 'completed',
              progress: 100,
            });

            completeGeneration(requestId, {
              success: true,
              requestId: result.requestId || requestId,
            });
          } else {
            throw new Error(result.error || 'Image generation failed');
          }
        } else {
          // VIDEO GENERATION
          const input = await buildApiInput(promptNodeId, promptData);

          // Add to queue
          addToQueue({
            id: requestId,
            promptNodeId,
            model,
            input,
          });

          // Start generation
          setActiveGeneration({
            id: requestId,
            promptNodeId,
            model,
            input,
            status: 'processing',
            createdAt: new Date(),
          });

          const result = await generateVideo({
            model: model as KlingModel,
            input: input as KlingInput,
            onQueueUpdate: (update) => {
              if (update.status === 'IN_PROGRESS') {
                updateNode(promptNodeId, {
                  status: 'generating',
                  progress: 50,
                });
              }
            },
          });

          if (result.success && result.data) {
            const durationSeconds = parseInt(promptData.duration, 10);
            const cost = calculateCost(model as KlingModel, durationSeconds);

            // Create output node for video
            const promptNodePosition = promptNode.position;
            const outputPosition = {
              x: promptNodePosition.x + 400,
              y: promptNodePosition.y,
            };

            const outputNode = createNode('output', outputPosition, {
              outputType: 'video',
              videoUrl: result.data.video.url,
              thumbnailUrl: '',
              videoDuration: durationSeconds,
              dimensions: { width: 1920, height: 1080 },
              role: 'output',
              canChain: true,
              generationMetadata: {
                promptUsed: promptData.prompt,
                modelUsed: model,
                inputNodes: connectedNodes.map((n) => n.id),
                duration: durationSeconds,
                aspectRatio: promptData.aspectRatio,
                createdAt: new Date(),
                requestId: result.requestId || requestId,
                cost,
              },
            });

            addNode(outputNode);

            // Connect prompt to output
            addEdge({
              id: `edge-${nanoid()}`,
              source: promptNodeId,
              target: outputNode.id,
              sourceHandle: 'output',
              targetHandle: 'input',
            });

            // Update prompt node status
            updateNode(promptNodeId, {
              status: 'completed',
              progress: 100,
            });

            completeGeneration(requestId, {
              success: true,
              video: {
                url: result.data.video.url,
                fileSize: result.data.video.file_size,
                fileName: result.data.video.file_name,
                contentType: result.data.video.content_type,
              },
              requestId: result.requestId || requestId,
            });
          } else {
            throw new Error(result.error || 'Video generation failed');
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        updateNode(promptNodeId, {
          status: 'error',
          error: errorMessage,
        });

        failGeneration(requestId, errorMessage);
      }
    },
    [
      nodes,
      getConnectedInputs,
      buildApiInput,
      buildImageApiInput,
      updateNode,
      addToQueue,
      setActiveGeneration,
      completeGeneration,
      failGeneration,
      addNode,
      addEdge,
    ]
  );

  /**
   * Get estimated cost for generation
   */
  const getEstimatedCost = useCallback(
    (promptNodeId: string): { cost: number; model: string } | null => {
      const promptNode = nodes.find((n) => n.id === promptNodeId);
      if (!promptNode || promptNode.type !== 'prompt') return null;

      const promptData = promptNode.data as PromptNodeData;
      const connectedNodes = getConnectedInputs(promptNodeId);

      if (connectedNodes.length === 0) return null;

      try {
        const model = selectModel(
          connectedNodes.map((n) => ({
            nodeId: n.id,
            nodeType: n.type,
            handleId: '',
            tag: getEdgeTag(n.id, promptNodeId),
            // Include outputType for output nodes so model selector can detect video/image inputs
            outputType: n.type === 'output' ? (n.data as OutputNodeData).outputType : undefined,
            // Include role for image nodes so model selector can detect reference vs start/end frames
            role: n.type === 'image' ? (n.data as ImageNodeData).role : undefined,
          })),
          promptData.prompt
        );

        const durationSeconds = parseInt(promptData.duration, 10);
        const cost = calculateCost(model, durationSeconds);

        return {
          cost,
          model: getModelDisplayName(model),
        };
      } catch {
        return null;
      }
    },
    [nodes, getConnectedInputs, getEdgeTag]
  );

  return {
    startGeneration,
    getEstimatedCost,
    isGenerating,
  };
}
