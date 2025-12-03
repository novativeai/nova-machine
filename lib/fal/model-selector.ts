import type { ConnectedInput, KlingModel, NanoBananaModel, GenerationModel, NovaNode } from '@/types';

/**
 * Edit intent keywords that indicate video editing mode
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

/**
 * Select the appropriate KLing model based on connected inputs
 *
 * Decision Tree:
 * 1. Has Video?
 *    - Yes + Edit Intent → VIDEO-TO-VIDEO/EDIT
 *    - Yes + No Edit → VIDEO-TO-VIDEO/REFERENCE
 * 2. Has Elements?
 *    - Yes → REFERENCE-TO-VIDEO
 * 3. Has Images?
 *    - Has @Image tags → REFERENCE-TO-VIDEO
 *    - No tags (start/end frames) → IMAGE-TO-VIDEO
 * 4. No valid inputs → Error
 */
export function selectModel(
  inputs: ConnectedInput[],
  prompt: string
): KlingModel {
  // Consider output nodes with reference role as their output type
  const hasVideo = inputs.some(
    (i) => i.nodeType === 'video' || (i.nodeType === 'output' && i.outputType === 'video')
  );
  const hasElements = inputs.some((i) => i.nodeType === 'element');
  const hasImages = inputs.some(
    (i) => i.nodeType === 'image' || (i.nodeType === 'output' && i.outputType === 'image')
  );
  const isEditIntent = detectEditIntent(prompt);

  // Video inputs take priority
  if (hasVideo) {
    return isEditIntent
      ? 'fal-ai/kling-video/o1/video-to-video/edit'
      : 'fal-ai/kling-video/o1/video-to-video/reference';
  }

  // Elements require reference-to-video
  if (hasElements) {
    return 'fal-ai/kling-video/o1/reference-to-video';
  }

  // Images can be either reference or image-to-video
  if (hasImages) {
    const hasTaggedImages = inputs.some(
      (i) => i.nodeType === 'image' && i.tag?.startsWith('@Image')
    );
    const hasReferenceImages = inputs.some(
      (i) => i.nodeType === 'image' && i.role === 'reference'
    );

    // If images have @Image tags or role='reference', use reference-to-video
    if (hasTaggedImages || hasReferenceImages) {
      return 'fal-ai/kling-video/o1/reference-to-video';
    }

    // Otherwise use image-to-video (for start/end frames)
    return 'fal-ai/kling-video/o1/image-to-video';
  }

  throw new Error('No valid inputs connected to prompt node');
}

/**
 * Select the appropriate Nano Banana Pro model based on connected inputs
 *
 * Decision Tree:
 * 1. Has any images connected (including output nodes with image outputType)? → Edit mode
 * 2. No images → Text to Image
 */
export function selectImageModel(inputs: ConnectedInput[]): NanoBananaModel {
  console.log('[Model Selector] Checking inputs for image model:', inputs);

  const hasImages = inputs.some((i) => {
    const isImage = i.nodeType === 'image';
    const isElement = i.nodeType === 'element';
    const isOutputImage = i.nodeType === 'output' && i.outputType === 'image';

    console.log(`[Model Selector] Input ${i.nodeId}: type=${i.nodeType}, outputType=${i.outputType}, isImage=${isImage}, isElement=${isElement}, isOutputImage=${isOutputImage}`);

    return isImage || isElement || isOutputImage;
  });

  const model = hasImages ? 'fal-ai/nano-banana-pro/edit' : 'fal-ai/nano-banana-pro';
  console.log('[Model Selector] hasImages:', hasImages, '-> model:', model);

  return model;
}

/**
 * Get human-readable model name for video models
 */
export function getVideoModelDisplayName(model: KlingModel): string {
  const names: Record<KlingModel, string> = {
    'fal-ai/kling-video/o1/image-to-video': 'Image to Video',
    'fal-ai/kling-video/o1/reference-to-video': 'Reference to Video',
    'fal-ai/kling-video/o1/video-to-video/edit': 'Video Edit',
    'fal-ai/kling-video/o1/video-to-video/reference': 'Video Reference',
  };
  return names[model];
}

/**
 * Get human-readable model name for image models
 */
export function getImageModelDisplayName(model: NanoBananaModel): string {
  const names: Record<NanoBananaModel, string> = {
    'fal-ai/nano-banana-pro': 'Text to Image',
    'fal-ai/nano-banana-pro/edit': 'Image Edit',
  };
  return names[model];
}

/**
 * Get human-readable model name (supports both video and image models)
 */
export function getModelDisplayName(model: GenerationModel): string {
  const videoNames: Record<KlingModel, string> = {
    'fal-ai/kling-video/o1/image-to-video': 'Image to Video',
    'fal-ai/kling-video/o1/reference-to-video': 'Reference to Video',
    'fal-ai/kling-video/o1/video-to-video/edit': 'Video Edit',
    'fal-ai/kling-video/o1/video-to-video/reference': 'Video Reference',
  };

  const imageNames: Record<NanoBananaModel, string> = {
    'fal-ai/nano-banana-pro': 'Text to Image',
    'fal-ai/nano-banana-pro/edit': 'Image Edit',
  };

  return videoNames[model as KlingModel] ?? imageNames[model as NanoBananaModel] ?? model;
}

/**
 * Validate that all required inputs are present for the selected model
 */
export function validateInputsForModel(
  model: KlingModel,
  inputs: ConnectedInput[],
  nodes: NovaNode[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (model) {
    case 'fal-ai/kling-video/o1/image-to-video': {
      const hasStartFrame = inputs.some((i) => {
        const node = nodes.find((n) => n.id === i.nodeId);
        return node?.type === 'image' && node.data.role === 'start_frame';
      });

      if (!hasStartFrame) {
        errors.push('Start frame image is required for Image-to-Video');
      }
      break;
    }

    case 'fal-ai/kling-video/o1/reference-to-video': {
      const hasImageOrElement =
        inputs.some((i) => i.nodeType === 'image') ||
        inputs.some((i) => i.nodeType === 'element');

      if (!hasImageOrElement) {
        errors.push('At least one @Image or @Element is required');
      }
      break;
    }

    case 'fal-ai/kling-video/o1/video-to-video/edit':
    case 'fal-ai/kling-video/o1/video-to-video/reference': {
      const hasVideo = inputs.some((i) => i.nodeType === 'video');
      if (!hasVideo) {
        errors.push('A video input is required');
      }
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
