import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  SavedBoard,
  SavedCharacter,
  SavedScene,
  SerializedNode,
  NovaNode,
  NovaEdge,
  ElementNodeData,
  OutputNodeData,
} from '@/types';

// Storage key for assets
const ASSETS_STORAGE_KEY = 'nova-assets';

interface AssetState {
  // Saved items
  boards: SavedBoard[];
  characters: SavedCharacter[];
  scenes: SavedScene[];

  // Board operations
  saveBoard: (name: string, nodes: NovaNode[], edges: NovaEdge[]) => string;
  updateBoard: (id: string, name: string, nodes: NovaNode[], edges: NovaEdge[]) => void;
  deleteBoard: (id: string) => void;
  getBoard: (id: string) => SavedBoard | undefined;

  // Character operations
  saveCharacter: (data: ElementNodeData) => string | null;
  deleteCharacter: (id: string) => void;
  getCharacter: (id: string) => SavedCharacter | undefined;

  // Scene operations
  saveScene: (name: string, imageUrl: string, thumbnailUrl: string, category?: string) => string;
  deleteScene: (id: string) => void;
  getScene: (id: string) => SavedScene | undefined;
}

/**
 * Serialize nodes for storage (remove File objects, convert dates)
 */
function serializeNodes(nodes: NovaNode[]): SerializedNode[] {
  return nodes.map((node) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = { ...node.data } as any;

    // Remove File objects (not serializable)
    delete data.file;
    delete data.frontalFile;
    delete data.referenceFiles;

    // Convert Date objects to strings
    if (data.createdAt instanceof Date) {
      data.createdAt = data.createdAt.toISOString();
    }
    if (data.updatedAt instanceof Date) {
      data.updatedAt = data.updatedAt.toISOString();
    }
    if (data.generationMetadata?.createdAt instanceof Date) {
      data.generationMetadata.createdAt = data.generationMetadata.createdAt.toISOString();
    }

    // Clear upload states (will need re-upload)
    if (data.uploadStatus === 'uploading') {
      data.uploadStatus = 'idle';
    }
    if (data.frontalUploadStatus === 'uploading') {
      data.frontalUploadStatus = 'idle';
    }
    if (data.referenceUploadStatus === 'uploading') {
      data.referenceUploadStatus = 'idle';
    }

    // Clear generation states
    if (data.status === 'generating' || data.status === 'uploading') {
      data.status = 'idle';
    }
    data.isGeneratingCharacter = false;

    // Clear highlights
    data.isHighlighted = false;
    delete data.highlightColor;

    return {
      id: node.id,
      type: node.type,
      position: node.position,
      data,
    };
  });
}

/**
 * Get thumbnail from nodes (first output image or undefined)
 */
function extractThumbnail(nodes: NovaNode[]): string | undefined {
  for (const node of nodes) {
    if (node.type === 'output') {
      const data = node.data as OutputNodeData;
      if (data.outputType === 'image' && data.thumbnailUrl) {
        return data.thumbnailUrl;
      }
      if (data.thumbnailUrl) {
        return data.thumbnailUrl;
      }
    }
  }
  return undefined;
}

export const useAssetStore = create<AssetState>()(
  persist(
    (set, get) => ({
      boards: [],
      characters: [],
      scenes: [],

      // ========================================
      // Board Operations
      // ========================================

      saveBoard: (name: string, nodes: NovaNode[], edges: NovaEdge[]) => {
        const id = nanoid();
        const now = new Date().toISOString();
        const thumbnail = extractThumbnail(nodes);

        const board: SavedBoard = {
          id,
          name,
          thumbnail,
          nodes: serializeNodes(nodes),
          edges: edges.map((e) => ({
            ...e,
            data: { ...e.data },
          })),
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          boards: [board, ...state.boards],
        }));

        return id;
      },

      updateBoard: (id: string, name: string, nodes: NovaNode[], edges: NovaEdge[]) => {
        const now = new Date().toISOString();
        const thumbnail = extractThumbnail(nodes);

        set((state) => ({
          boards: state.boards.map((board) =>
            board.id === id
              ? {
                  ...board,
                  name,
                  thumbnail,
                  nodes: serializeNodes(nodes),
                  edges: edges.map((e) => ({
                    ...e,
                    data: { ...e.data },
                  })),
                  updatedAt: now,
                }
              : board
          ),
        }));
      },

      deleteBoard: (id: string) => {
        set((state) => ({
          boards: state.boards.filter((b) => b.id !== id),
        }));
      },

      getBoard: (id: string) => {
        return get().boards.find((b) => b.id === id);
      },

      // ========================================
      // Character Operations
      // ========================================

      saveCharacter: (data: ElementNodeData) => {
        // Require remote URL for frontal image
        if (!data.frontalRemoteUrl) {
          console.warn('Cannot save character: frontal image not uploaded');
          return null;
        }

        const id = nanoid();
        const now = new Date().toISOString();

        const character: SavedCharacter = {
          id,
          name: data.name,
          elementType: data.elementType,
          frontalImageUrl: data.frontalRemoteUrl,
          frontalThumbnail: data.frontalThumbnail || data.frontalRemoteUrl,
          referenceImageUrls: [
            ...(data.referenceRemoteUrls || []),
            ...(data.generatedReferenceUrls || []),
          ],
          referenceThumbnails: [
            ...(data.referenceThumbnails || []),
            ...(data.generatedReferenceThumbnails || []),
          ],
          createdAt: now,
        };

        set((state) => ({
          characters: [character, ...state.characters],
        }));

        return id;
      },

      deleteCharacter: (id: string) => {
        set((state) => ({
          characters: state.characters.filter((c) => c.id !== id),
        }));
      },

      getCharacter: (id: string) => {
        return get().characters.find((c) => c.id === id);
      },

      // ========================================
      // Scene Operations
      // ========================================

      saveScene: (name: string, imageUrl: string, thumbnailUrl: string, category?: string) => {
        const id = nanoid();
        const now = new Date().toISOString();

        const scene: SavedScene = {
          id,
          name,
          imageUrl,
          thumbnailUrl,
          category,
          createdAt: now,
        };

        set((state) => ({
          scenes: [scene, ...state.scenes],
        }));

        return id;
      },

      deleteScene: (id: string) => {
        set((state) => ({
          scenes: state.scenes.filter((s) => s.id !== id),
        }));
      },

      getScene: (id: string) => {
        return get().scenes.find((s) => s.id === id);
      },
    }),
    {
      name: ASSETS_STORAGE_KEY,
      storage: createJSONStorage(() => {
        // Only use localStorage on client side
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      skipHydration: typeof window === 'undefined',
    }
  )
);
