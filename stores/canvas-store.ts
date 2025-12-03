import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import {
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import type {
  NovaNode,
  NovaEdge,
  NovaNodeData,
  TagType,
  PromptNodeData,
  ImageNodeData,
  VideoNodeData,
  ElementNodeData,
  OutputNodeData,
  CameraNodeData,
  LightingNodeData,
  PromptNode,
  ImageNode,
  VideoNode,
  ElementNode,
  OutputNode,
  CameraNode,
  LightingNode,
} from '@/types';

interface CanvasState {
  // Nodes and Edges
  nodes: NovaNode[];
  edges: NovaEdge[];

  // Selection
  selectedNodes: string[];

  // Node operations
  addNode: (node: NovaNode) => void;
  updateNode: (id: string, data: Partial<NovaNodeData>) => void;
  removeNode: (id: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;

  // Edge operations
  addEdge: (edge: NovaEdge) => void;
  removeEdge: (id: string) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;

  // Selection
  setSelectedNodes: (ids: string[]) => void;

  // Highlighting
  highlightNode: (id: string, color: string) => void;
  clearHighlights: () => void;

  // Tag management
  recalculateTags: () => void;
  getNextTagIndex: (type: TagType) => number;
  getNodeByTag: (tag: string) => NovaNode | undefined;
  getConnectedInputs: (promptNodeId: string) => NovaNode[];
  getEdgeTag: (sourceNodeId: string, targetPromptId: string) => string | undefined;

  // Element connection sync
  syncElementConnections: () => void;

  // Canvas operations
  clearCanvas: () => void;
}

// Create initial prompt node
const initialPromptNode = {
  id: 'initial-prompt',
  type: 'prompt' as const,
  position: { x: 400, y: 200 },
  dragHandle: '.nova-drag-handle',
  data: {
    id: 'initial-prompt',
    prompt: '',
    mode: 'video' as const,
    // Video settings
    duration: '5' as const,
    aspectRatio: '16:9' as const,
    negativePrompt: 'blur, distort, and low quality',
    cfgScale: 0.5,
    // Image settings
    imageAspectRatio: '1:1' as const,
    imageResolution: '1K' as const,
    // Generation state
    status: 'idle' as const,
    progress: 0,
    connectedInputs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

// Storage key for canvas persistence
const CANVAS_STORAGE_KEY = 'nova-canvas-state';

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      nodes: [initialPromptNode],
      edges: [],
      selectedNodes: [],

      // Node operations
      addNode: (node) => {
        set((state) => ({
          nodes: [...state.nodes, node],
        }));
      },

      updateNode: (id, data) => {
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, ...data, updatedAt: new Date() } } as typeof node
              : node
          ) as NovaNode[],
        }));
      },

      removeNode: (id) => {
        set((state) => ({
          nodes: state.nodes.filter((node) => node.id !== id),
          edges: state.edges.filter(
            (edge) => edge.source !== id && edge.target !== id
          ),
        }));
      },

      onNodesChange: (changes) => {
        set((state) => ({
          nodes: applyNodeChanges(changes, state.nodes as never) as unknown as NovaNode[],
        }));
      },

      // Edge operations
      addEdge: (edge) => {
        set((state) => ({
          edges: [...state.edges, edge],
        }));
        // Recalculate tags and sync element connections after adding edge
        get().recalculateTags();
        get().syncElementConnections();
      },

      removeEdge: (id) => {
        set((state) => ({
          edges: state.edges.filter((edge) => edge.id !== id),
        }));
        // Recalculate tags and sync element connections after removing edge
        get().recalculateTags();
        get().syncElementConnections();
      },

      onEdgesChange: (changes) => {
        set((state) => ({
          edges: applyEdgeChanges(changes, state.edges as never) as unknown as NovaEdge[],
        }));
        // Recalculate tags and sync element connections if any edges were removed
        const hasRemovals = changes.some((c) => c.type === 'remove');
        if (hasRemovals) {
          get().recalculateTags();
          get().syncElementConnections();
        }
      },

      // Selection
      setSelectedNodes: (ids) => {
        set({ selectedNodes: ids });
      },

      // Highlighting
      highlightNode: (id, color) => {
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === id
              ? {
                  ...node,
                  data: { ...node.data, isHighlighted: true, highlightColor: color },
                }
              : node
          ) as NovaNode[],
        }));
      },

      clearHighlights: () => {
        set((state) => ({
          nodes: state.nodes.map((node) => ({
            ...node,
            data: { ...node.data, isHighlighted: false, highlightColor: undefined },
          })) as NovaNode[],
        }));
      },

      // Tag management
      // Tags are now scoped per-prompt: each prompt gets @Image1, @Element1, @Video1 starting from 1
      // Tags are stored on edges (per-connection) and nodes display the first assigned tag
      recalculateTags: () => {
        const { nodes, edges } = get();

        // Find all prompt nodes
        const promptNodes = nodes.filter((n) => n.type === 'prompt');

        // Build per-edge tag assignments (edgeId -> tag)
        const edgeTagAssignments = new Map<string, string>();
        // Build per-node tag assignments (nodeId -> tag) - uses first assigned tag for display
        const nodeTagAssignments = new Map<string, string | undefined>();
        // Track which nodes are connected to any prompt
        const connectedNodeIds = new Set<string>();

        // Helper to check if a node should get a tag
        const shouldTagNode = (node: NovaNode): { shouldTag: boolean; tagType: 'image' | 'element' | 'video' | null } => {
          if (node.type === 'image') {
            const data = node.data as ImageNodeData;
            // Only @Image tags for reference role
            if (data.role === 'reference') {
              return { shouldTag: true, tagType: 'image' };
            }
          } else if (node.type === 'element') {
            return { shouldTag: true, tagType: 'element' };
          } else if (node.type === 'video') {
            const data = node.data as VideoNodeData;
            // Only @Video tags for reference role
            if (data.role === 'reference') {
              return { shouldTag: true, tagType: 'video' };
            }
          } else if (node.type === 'output') {
            const data = node.data as OutputNodeData;
            // Output nodes with reference role can be tagged based on their outputType
            if (data.role === 'reference') {
              if (data.outputType === 'image') {
                return { shouldTag: true, tagType: 'image' };
              } else if (data.outputType === 'video') {
                return { shouldTag: true, tagType: 'video' };
              }
            }
          }
          return { shouldTag: false, tagType: null };
        };

        // Process each prompt node independently - this scopes tags per-prompt
        for (const promptNode of promptNodes) {
          // Find edges targeting this prompt (maintain edge order for consistent numbering)
          const promptEdges = edges.filter((e) => e.target === promptNode.id);

          // Group nodes by type for this prompt
          const promptImageEdges: { edge: NovaEdge; node: NovaNode }[] = [];
          const promptElementEdges: { edge: NovaEdge; node: NovaNode }[] = [];
          const promptVideoEdges: { edge: NovaEdge; node: NovaNode }[] = [];

          for (const edge of promptEdges) {
            const node = nodes.find((n) => n.id === edge.source);
            if (!node) continue;

            connectedNodeIds.add(node.id);

            const { shouldTag, tagType } = shouldTagNode(node);
            if (!shouldTag || !tagType) continue;

            if (tagType === 'image') {
              promptImageEdges.push({ edge, node });
            } else if (tagType === 'element') {
              promptElementEdges.push({ edge, node });
            } else if (tagType === 'video') {
              promptVideoEdges.push({ edge, node });
            }
          }

          // Assign tags for this prompt (scoped numbering starting at 1)
          promptImageEdges.forEach(({ edge, node }, index) => {
            const tag = `@Image${index + 1}`;
            edgeTagAssignments.set(edge.id, tag);
            // Set node's tagAssignment only if not already set (first prompt wins)
            if (!nodeTagAssignments.has(node.id)) {
              nodeTagAssignments.set(node.id, tag);
            }
          });

          promptElementEdges.forEach(({ edge, node }, index) => {
            const tag = `@Element${index + 1}`;
            edgeTagAssignments.set(edge.id, tag);
            if (!nodeTagAssignments.has(node.id)) {
              nodeTagAssignments.set(node.id, tag);
            }
          });

          promptVideoEdges.forEach(({ edge, node }, index) => {
            const tag = `@Video${index + 1}`;
            edgeTagAssignments.set(edge.id, tag);
            if (!nodeTagAssignments.has(node.id)) {
              nodeTagAssignments.set(node.id, tag);
            }
          });
        }

        // Clear tags from nodes not connected to any prompt
        nodes.forEach((node) => {
          if (node.type === 'image' || node.type === 'element' || node.type === 'video' || node.type === 'output') {
            if (!connectedNodeIds.has(node.id)) {
              nodeTagAssignments.set(node.id, undefined);
            }
          }
        });

        // Update nodes and edges with new tag assignments
        set((state) => ({
          nodes: state.nodes.map((node) => {
            if (nodeTagAssignments.has(node.id)) {
              const newTag = nodeTagAssignments.get(node.id);
              const currentTag = (node.data as ImageNodeData | VideoNodeData | ElementNodeData | OutputNodeData).tagAssignment;
              if (newTag !== currentTag) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    tagAssignment: newTag,
                    updatedAt: new Date(),
                  },
                };
              }
            }
            return node;
          }) as NovaNode[],
          edges: state.edges.map((edge) => {
            const newTag = edgeTagAssignments.get(edge.id);
            const currentTag = edge.data?.tag;
            if (newTag !== currentTag) {
              return {
                ...edge,
                data: {
                  ...edge.data,
                  tag: newTag,
                },
              };
            }
            return edge;
          }),
        }));
      },

      getNextTagIndex: (type) => {
        const { nodes } = get();
        const prefix = type === 'image' ? '@Image' : type === 'element' ? '@Element' : '@Video';

        const existingIndices = nodes
          .filter((node) => {
            if (node.type === 'image' || node.type === 'video' || node.type === 'element') {
              const data = node.data as ImageNodeData | VideoNodeData | ElementNodeData;
              return data.tagAssignment?.startsWith(prefix);
            }
            return false;
          })
          .map((node) => {
            const data = node.data as ImageNodeData | VideoNodeData | ElementNodeData;
            const match = data.tagAssignment?.match(/\d+$/);
            return match ? parseInt(match[0], 10) : 0;
          });

        return existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 1;
      },

      getNodeByTag: (tag) => {
        const { nodes } = get();
        return nodes.find((node) => {
          if (node.type === 'image' || node.type === 'video' || node.type === 'element' || node.type === 'output') {
            const data = node.data as ImageNodeData | VideoNodeData | ElementNodeData | OutputNodeData;
            return (data as { tagAssignment?: string }).tagAssignment === tag;
          }
          return false;
        });
      },

      getConnectedInputs: (promptNodeId) => {
        const { nodes, edges } = get();
        const connectedEdges = edges.filter((edge) => edge.target === promptNodeId);
        const connectedNodeIds = connectedEdges.map((edge) => edge.source);
        return nodes.filter((node) => connectedNodeIds.includes(node.id));
      },

      getEdgeTag: (sourceNodeId, targetPromptId) => {
        const { edges } = get();
        const edge = edges.find((e) => e.source === sourceNodeId && e.target === targetPromptId);
        return edge?.data?.tag;
      },

      // Element connection sync - populates element nodes with connected image data
      syncElementConnections: () => {
        const { nodes, edges, updateNode } = get();

        // Find all element nodes
        const elementNodes = nodes.filter((n) => n.type === 'element');

        for (const elementNode of elementNodes) {
          // Find edges where this element is the target (incoming connections)
          const incomingEdges = edges.filter((e) => e.target === elementNode.id);

          // Get source nodes that provide images (image nodes or output nodes with images)
          // Maintain edge creation order for consistent frontal/reference assignment
          const imageSourceNodes: NovaNode[] = [];
          for (const edge of incomingEdges) {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            if (!sourceNode) continue;

            if (sourceNode.type === 'image') {
              imageSourceNodes.push(sourceNode);
            } else if (sourceNode.type === 'output') {
              const outputData = sourceNode.data as OutputNodeData;
              if (outputData.outputType === 'image' && outputData.imageUrl) {
                imageSourceNodes.push(sourceNode);
              }
            }
          }

          // Get current connected source IDs to detect changes
          const currentData = elementNode.data as ElementNodeData;
          const previousSourceIds = currentData.connectedImageSourceIds || [];
          const currentSourceIds = imageSourceNodes.map((n) => n.id);

          // If no image sources connected
          if (imageSourceNodes.length === 0) {
            // Only clear if there were previously connected images (to preserve manual uploads)
            if (previousSourceIds.length > 0) {
              updateNode(elementNode.id, {
                frontalImageUrl: '',
                frontalThumbnail: '',
                frontalFile: undefined,
                frontalRemoteUrl: undefined,
                frontalUploadStatus: 'idle',
                referenceImageUrls: [],
                referenceThumbnails: [],
                referenceFiles: undefined,
                referenceRemoteUrls: undefined,
                referenceUploadStatus: 'idle',
                connectedImageSourceIds: [],
              });
            }
            continue;
          }

          // First image becomes frontal, rest become references
          const [frontalSourceNode, ...referenceSourceNodes] = imageSourceNodes;

          // Extract frontal image data
          let frontalData: Partial<ElementNodeData> = {};
          if (frontalSourceNode.type === 'image') {
            const imgData = frontalSourceNode.data as ImageNodeData;
            frontalData = {
              frontalImageUrl: imgData.imageUrl,
              frontalThumbnail: imgData.thumbnailUrl,
              frontalFile: imgData.file,
              frontalRemoteUrl: imgData.remoteUrl,
              frontalUploadStatus: imgData.uploadStatus || 'idle',
            };
          } else if (frontalSourceNode.type === 'output') {
            const outputData = frontalSourceNode.data as OutputNodeData;
            frontalData = {
              frontalImageUrl: outputData.imageUrl || '',
              frontalThumbnail: outputData.thumbnailUrl || outputData.imageUrl || '',
              frontalFile: undefined, // Output nodes don't have files
              frontalRemoteUrl: outputData.imageUrl, // Output URLs are already remote
              frontalUploadStatus: 'completed',
            };
          }

          // Extract reference images data
          const referenceUrls: string[] = [];
          const referenceThumbnails: string[] = [];
          const referenceFiles: File[] = [];
          const referenceRemoteUrls: string[] = [];

          for (const refNode of referenceSourceNodes) {
            if (refNode.type === 'image') {
              const imgData = refNode.data as ImageNodeData;
              referenceUrls.push(imgData.imageUrl);
              referenceThumbnails.push(imgData.thumbnailUrl);
              if (imgData.file) referenceFiles.push(imgData.file);
              if (imgData.remoteUrl) referenceRemoteUrls.push(imgData.remoteUrl);
            } else if (refNode.type === 'output') {
              const outputData = refNode.data as OutputNodeData;
              if (outputData.imageUrl) {
                referenceUrls.push(outputData.imageUrl);
                referenceThumbnails.push(outputData.thumbnailUrl || outputData.imageUrl);
                referenceRemoteUrls.push(outputData.imageUrl);
              }
            }
          }

          // Update element node with connected image data
          updateNode(elementNode.id, {
            ...frontalData,
            referenceImageUrls: referenceUrls,
            referenceThumbnails: referenceThumbnails,
            referenceFiles: referenceFiles.length > 0 ? referenceFiles : undefined,
            referenceRemoteUrls: referenceRemoteUrls.length > 0 ? referenceRemoteUrls : undefined,
            referenceUploadStatus: referenceRemoteUrls.length === referenceUrls.length ? 'completed' : 'idle',
            connectedImageSourceIds: currentSourceIds,
          });
        }
      },

      // Canvas operations
      clearCanvas: () => {
        set({ nodes: [], edges: [], selectedNodes: [] });
      },
    }),
    {
      name: CANVAS_STORAGE_KEY,
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
      // Only persist nodes and edges
      partialize: (state) => ({
        nodes: state.nodes.map((node) => {
          // Clean up non-serializable data
          const cleanData = { ...node.data };
          // Remove File objects as they can't be serialized
          if ('file' in cleanData) delete (cleanData as ImageNodeData).file;
          if ('frontalFile' in cleanData) delete (cleanData as ElementNodeData).frontalFile;
          if ('referenceFiles' in cleanData) delete (cleanData as ElementNodeData).referenceFiles;
          // Reset highlight state
          if ('isHighlighted' in cleanData) {
            (cleanData as ImageNodeData).isHighlighted = false;
            delete (cleanData as ImageNodeData).highlightColor;
          }
          // Reset generating state to idle
          if ('status' in cleanData && (cleanData as PromptNodeData).status === 'generating') {
            (cleanData as PromptNodeData).status = 'idle';
            (cleanData as PromptNodeData).progress = 0;
          }
          // Reset interrupted upload states but keep successful remoteUrls
          if ('uploadStatus' in cleanData) {
            const imageData = cleanData as ImageNodeData;
            if (imageData.uploadStatus === 'uploading') {
              imageData.uploadStatus = 'idle';
            }
          }
          if ('frontalUploadStatus' in cleanData) {
            const elementData = cleanData as ElementNodeData;
            if (elementData.frontalUploadStatus === 'uploading') {
              elementData.frontalUploadStatus = 'idle';
            }
            if (elementData.referenceUploadStatus === 'uploading') {
              elementData.referenceUploadStatus = 'idle';
            }
          }
          return { ...node, data: cleanData };
        }),
        edges: state.edges,
      }),
      // Handle hydration to convert date strings back to Date objects
      // and restore URLs from remote storage (blob URLs are invalid after refresh)
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.nodes = state.nodes.map((node) => {
            const baseData = {
              ...node.data,
              createdAt: new Date(node.data.createdAt),
              updatedAt: new Date(node.data.updatedAt),
            };

            // Handle image nodes - restore from remoteUrl if available
            if (node.type === 'image') {
              const imageData = baseData as ImageNodeData;
              // Blob URLs are invalid after refresh, use remoteUrl if available
              if (imageData.remoteUrl && imageData.uploadStatus === 'completed') {
                imageData.imageUrl = imageData.remoteUrl;
                imageData.thumbnailUrl = imageData.remoteUrl;
              } else if (imageData.imageUrl?.startsWith('blob:')) {
                // Stale blob URL with no remote backup - mark as needing re-upload
                imageData.imageUrl = '';
                imageData.thumbnailUrl = '';
                imageData.uploadStatus = 'idle';
              }
              return { ...node, data: imageData };
            }

            // Handle video nodes - restore from remoteUrl if available
            if (node.type === 'video') {
              const videoData = baseData as VideoNodeData;
              if (videoData.remoteUrl && videoData.uploadStatus === 'completed') {
                videoData.videoUrl = videoData.remoteUrl;
                // Keep thumbnailUrl as is (it's a generated data URL, not a blob)
              } else if (videoData.videoUrl?.startsWith('blob:')) {
                // Stale blob URL with no remote backup
                videoData.videoUrl = '';
                videoData.uploadStatus = 'idle';
              }
              return { ...node, data: videoData };
            }

            // Handle element nodes - restore from remote URLs if available
            if (node.type === 'element') {
              const elementData = baseData as ElementNodeData;
              // Restore frontal image
              if (elementData.frontalRemoteUrl && elementData.frontalUploadStatus === 'completed') {
                elementData.frontalImageUrl = elementData.frontalRemoteUrl;
                elementData.frontalThumbnail = elementData.frontalRemoteUrl;
              } else if (elementData.frontalImageUrl?.startsWith('blob:')) {
                elementData.frontalImageUrl = '';
                elementData.frontalThumbnail = '';
                elementData.frontalUploadStatus = 'idle';
              }
              // Restore reference images
              if (elementData.referenceRemoteUrls?.length && elementData.referenceUploadStatus === 'completed') {
                elementData.referenceImageUrls = elementData.referenceRemoteUrls;
                elementData.referenceThumbnails = elementData.referenceRemoteUrls;
              } else if (elementData.referenceImageUrls?.some((url) => url.startsWith('blob:'))) {
                elementData.referenceImageUrls = [];
                elementData.referenceThumbnails = [];
                elementData.referenceUploadStatus = 'idle';
              }
              return { ...node, data: elementData };
            }

            // Handle output nodes - these use actual URLs (not blob), just fix dates
            if (node.type === 'output') {
              const outputData = baseData as OutputNodeData;
              if (outputData.generationMetadata) {
                outputData.generationMetadata = {
                  ...outputData.generationMetadata,
                  createdAt: new Date(outputData.generationMetadata.createdAt),
                };
              }
              return { ...node, data: outputData };
            }

            return { ...node, data: baseData };
          }) as NovaNode[];
        }
      },
      // Skip hydration on server side
      skipHydration: typeof window === 'undefined',
    }
  )
);

// Helper function to create a new node
export function createNode(
  type: NovaNode['type'],
  position: { x: number; y: number },
  data: Partial<NovaNodeData>
): NovaNode {
  const id = nanoid();
  const now = new Date();

  const baseData = {
    id,
    createdAt: now,
    updatedAt: now,
  };

  switch (type) {
    case 'prompt':
      return {
        id,
        type: 'prompt',
        position,
        dragHandle: '.nova-drag-handle',
        data: {
          ...baseData,
          prompt: '',
          mode: 'video',
          // Video settings
          duration: '5',
          aspectRatio: '16:9',
          negativePrompt: 'blur, distort, and low quality',
          cfgScale: 0.5,
          // Image settings
          imageAspectRatio: '1:1',
          imageResolution: '1K',
          // Generation state
          status: 'idle',
          progress: 0,
          connectedInputs: [],
          ...data,
        },
      } as PromptNode;

    case 'image':
      return {
        id,
        type: 'image',
        position,
        dragHandle: '.nova-drag-handle',
        data: {
          ...baseData,
          imageUrl: '',
          thumbnailUrl: '',
          fileName: '',
          fileSize: 0,
          dimensions: { width: 0, height: 0 },
          role: 'reference',
          isHighlighted: false,
          ...data,
        },
      } as ImageNode;

    case 'video':
      return {
        id,
        type: 'video',
        position,
        dragHandle: '.nova-drag-handle',
        data: {
          ...baseData,
          videoUrl: '',
          thumbnailUrl: '',
          fileName: '',
          fileSize: 0,
          duration: 0,
          dimensions: { width: 0, height: 0 },
          role: 'reference',
          isHighlighted: false,
          ...data,
        },
      } as VideoNode;

    case 'element':
      return {
        id,
        type: 'element',
        position,
        dragHandle: '.nova-drag-handle',
        data: {
          ...baseData,
          name: 'New Element',
          elementType: 'character',
          frontalImageUrl: '',
          frontalThumbnail: '',
          referenceImageUrls: [],
          referenceThumbnails: [],
          isHighlighted: false,
          ...data,
        },
      } as ElementNode;

    case 'output':
      return {
        id,
        type: 'output',
        position,
        dragHandle: '.nova-drag-handle',
        data: {
          ...baseData,
          outputType: 'video',
          videoUrl: '',
          thumbnailUrl: '',
          videoDuration: 0,
          dimensions: { width: 0, height: 0 },
          role: 'output',
          canChain: true,
          generationMetadata: {
            promptUsed: '',
            modelUsed: 'fal-ai/kling-video/o1/image-to-video',
            inputNodes: [],
            duration: 0,
            aspectRatio: '16:9',
            createdAt: now,
            requestId: '',
            cost: 0,
          },
          isHighlighted: false,
          ...data,
        },
      } as OutputNode;

    case 'camera':
      return {
        id,
        type: 'camera',
        position,
        dragHandle: '.nova-drag-handle',
        data: {
          ...baseData,
          cameraAngle: '',
          lensLength: '',
          colorimetry: '',
          ...data,
        },
      } as CameraNode;

    case 'lighting':
      return {
        id,
        type: 'lighting',
        position,
        dragHandle: '.nova-drag-handle',
        data: {
          ...baseData,
          lightingStyle: '',
          lightingKey: '',
          ...data,
        },
      } as LightingNode;

    default:
      throw new Error(`Unknown node type: ${type}`);
  }
}
