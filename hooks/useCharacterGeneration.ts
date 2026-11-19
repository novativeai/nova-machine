'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useCanvasStore, createNode } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';
import { persistUrlsToR2 } from '@/lib/r2';
import { generateCharacterViews } from '@/lib/fal';
import type { ElementNodeData } from '@/types';

/**
 * Hook for generating character ElementNodes from an image.
 * Generates side and back views in parallel and creates a connected ElementNode.
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
        // Side and back views in parallel (GPT Image 2.6 edit)
        const [sideImageUrl, backImageUrl] = await generateCharacterViews(imageUrl);

        // Persist generated images to R2 for permanent storage (async, non-blocking for node creation)
        let persistedSideUrl = sideImageUrl;
        let persistedBackUrl = backImageUrl;

        const persistPromise = (async () => {
          if (!user) return;
          try {
            const token = await user.getIdToken();
            const r2Map = await persistUrlsToR2(token, [
              { url: sideImageUrl, category: 'characters' },
              { url: backImageUrl, category: 'characters' },
            ]);
            persistedSideUrl = r2Map.get(sideImageUrl) || sideImageUrl;
            persistedBackUrl = r2Map.get(backImageUrl) || backImageUrl;
          } catch (error) {
            console.warn('[Character Generation] R2 persist failed, using fal.ai URLs:', error);
          }
        })();

        // Wait for R2 persist before creating node (character refs need permanent URLs)
        await persistPromise;

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
            generatedReferenceUrls: [persistedSideUrl, persistedBackUrl],
            generatedReferenceThumbnails: [persistedSideUrl, persistedBackUrl],
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

  // Cleanup pending error timers on unmount
  useEffect(() => {
    return () => {
      errorTimersRef.current.forEach(clearTimeout);
      errorTimersRef.current.clear();
    };
  }, []);

  return { generateCharacter, getNextCharacterName };
}
