'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useCanvasStore, createNode } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';
import { persistUrlsToR2 } from '@/lib/r2';
import { generateCharacterViews, turnaroundCost } from '@/lib/fal';
import type { GenerationMetadata } from '@/types';
import type { ElementNodeData } from '@/types';

function turnaroundMetadata(views: Array<{ width: number; height: number }>, sourceId: string): GenerationMetadata {
  const { cost, breakdown, isEstimate } = turnaroundCost(views);
  return {
    promptUsed: 'Character turnaround',
    modelUsed: 'openai/gpt-image-2.6/sunburst/edit',
    modelLabel: 'GPT Image 2.6',
    category: 'image',
    inputNodes: [sourceId],
    aspectRatio: 'auto',
    createdAt: new Date(),
    requestId: '',
    cost,
    costBreakdown: breakdown,
    costIsEstimate: isEstimate,
  };
}

/**
 * Hook for generating character ElementNodes from an image.
 * Generates a four-view turnaround in parallel and creates a connected ElementNode.
 * After generation, persists fal.ai output URLs to R2 for permanent storage.
 */
export function useCharacterGeneration() {
  const { addNode, addEdge, updateNode } = useCanvasStore();
  const { user } = useAuth();
  const errorTimersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  const getNextCharacterName = useCallback(() => {
    const currentNodes = useCanvasStore.getState().nodes;
    const existingNames = currentNodes
      .filter((n) => n.type === 'element')
      .map((n) => (n.data as ElementNodeData).name)
      .filter((name) => name?.startsWith('New Character'));

    let index = 1;
    while (existingNames.includes(`New Character ${index}`)) {
      index++;
    }
    return `New Character ${index}`;
  }, []);

  const generateCharacter = useCallback(
    async (
      imageNodeId: string,
      imageUrl: string,
      position: { x: number; y: number }
    ) => {
      updateNode(imageNodeId, { isGeneratingCharacter: true });

      try {
        // Full turnaround in parallel (three-quarter, side, back, face close-up)
        const views = await generateCharacterViews(imageUrl);

        // Character refs need permanent URLs: persist to R2 before creating the node
        let viewUrls = views.map((v) => v.url);
        if (user) {
          try {
            const token = await user.getIdToken();
            const r2Map = await persistUrlsToR2(token, viewUrls.map((url) => ({ url, category: 'characters' as const })));
            viewUrls = viewUrls.map((url) => r2Map.get(url) || url);
          } catch (error) {
            console.warn('[Character Generation] R2 persist failed, using fal.ai URLs:', error);
          }
        }

        // Create ElementNode with persisted references
        const characterName = getNextCharacterName();
        const elementNode = createNode(
          'element',
          {
            x: position.x + 300,
            y: position.y,
          },
          {
            name: characterName,
            elementType: 'character',
            generatedReferenceUrls: viewUrls,
            generatedReferenceThumbnails: viewUrls,
            generatedReferenceLabels: views.map((v) => v.view),
            generationMetadata: turnaroundMetadata(views, imageNodeId),
          }
        );

        addNode(elementNode);

        // Create edge: ImageNode -> ElementNode
        addEdge({
          id: `${imageNodeId}-${elementNode.id}`,
          source: imageNodeId,
          target: elementNode.id,
          sourceHandle: 'output',
          targetHandle: 'input',
        });
      } catch (error) {
        console.error('[Character Generation] Failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Character generation failed';
        updateNode(imageNodeId, { characterGenerationError: errorMessage });
        const timer = setTimeout(() => {
          updateNode(imageNodeId, { characterGenerationError: undefined });
          errorTimersRef.current.delete(timer);
        }, 8000);
        errorTimersRef.current.add(timer);
      } finally {
        updateNode(imageNodeId, { isGeneratingCharacter: false });
      }
    },
    [addNode, addEdge, updateNode, getNextCharacterName, user]
  );

  /**
   * Fill an existing character with the four-view turnaround generated from its frontal image.
   * Views already wired in by hand are kept; generated views replace earlier generated ones.
   */
  const generateTurnaround = useCallback(
    async (elementId: string) => {
      const node = useCanvasStore.getState().nodes.find((n) => n.id === elementId);
      if (!node || node.type !== 'element') return;
      const data = node.data as ElementNodeData;
      const frontal = data.frontalRemoteUrl || (data.frontalImageUrl.startsWith('https://') ? data.frontalImageUrl : '');
      if (!frontal) {
        updateNode(elementId, { characterGenerationError: 'Wait for the frontal image to finish uploading.' });
        return;
      }
      updateNode(elementId, { isGeneratingCharacter: true });
      try {
        const views = await generateCharacterViews(frontal);
        let viewUrls = views.map((v) => v.url);
        if (user) {
          try {
            const token = await user.getIdToken();
            const r2Map = await persistUrlsToR2(token, viewUrls.map((url) => ({ url, category: 'characters' as const })));
            viewUrls = viewUrls.map((url) => r2Map.get(url) || url);
          } catch (error) {
            console.warn('[Turnaround] R2 persist failed, using fal.ai URLs:', error);
          }
        }
        const previousGenerated = new Set(data.generatedReferenceUrls ?? []);
        const manualUrls = data.referenceImageUrls.filter((u) => !previousGenerated.has(u));
        const manualThumbs = data.referenceThumbnails.filter((_, i) => !previousGenerated.has(data.referenceImageUrls[i]));
        const manualRemote = (data.referenceRemoteUrls ?? []).filter((u) => !previousGenerated.has(u));
        const allRemote = manualRemote.length === manualUrls.length;
        updateNode(elementId, {
          generatedReferenceUrls: viewUrls,
          generatedReferenceThumbnails: viewUrls,
          generatedReferenceLabels: views.map((v) => v.view),
          referenceImageUrls: [...manualUrls, ...viewUrls],
          referenceThumbnails: [...manualThumbs, ...viewUrls],
          referenceRemoteUrls: allRemote ? [...manualRemote, ...viewUrls] : data.referenceRemoteUrls,
          referenceUploadStatus: allRemote ? 'completed' : data.referenceUploadStatus,
          generationMetadata: turnaroundMetadata(views, elementId),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Turnaround failed';
        updateNode(elementId, { characterGenerationError: message });
      } finally {
        updateNode(elementId, { isGeneratingCharacter: false });
      }
    },
    [updateNode, user]
  );

  /**
   * Ask Claude for the character's identity lock (fixed visual traits) from its images.
   */
  const describeCharacter = useCallback(
    async (elementId: string) => {
      const node = useCanvasStore.getState().nodes.find((n) => n.id === elementId);
      if (!node || node.type !== 'element' || !user) return;
      const data = node.data as ElementNodeData;
      const imageUrls = [data.frontalRemoteUrl ?? data.frontalImageUrl, ...(data.referenceRemoteUrls ?? data.referenceImageUrls)]
        .filter((u): u is string => Boolean(u) && u.startsWith('https://'));
      if (imageUrls.length === 0) {
        updateNode(elementId, { characterGenerationError: 'Add an uploaded frontal image first.' });
        return;
      }
      updateNode(elementId, { isDescribing: true });
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/ai/describe-character', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: data.name, kind: data.elementType, imageUrls }),
        });
        const json: { appearance?: string; error?: string } = await response.json();
        if (!response.ok || !json.appearance) throw new Error(json.error || 'Description failed');
        updateNode(elementId, { appearance: json.appearance });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Description failed';
        updateNode(elementId, { characterGenerationError: message });
      } finally {
        updateNode(elementId, { isDescribing: false });
      }
    },
    [updateNode, user]
  );

  // Cleanup pending error timers on unmount
  useEffect(() => {
    return () => {
      errorTimersRef.current.forEach(clearTimeout);
      errorTimersRef.current.clear();
    };
  }, []);

  return { generateCharacter, generateTurnaround, describeCharacter, getNextCharacterName };
}
