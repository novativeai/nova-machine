'use client';

import { useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type Edge,
  type Node,
  type OnReconnect,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { createNode, useCanvasStore, useAssetStore, useModalStore, useProjectStore } from '@/stores';
import { useAudioLoader, validateAudioFile } from '@/hooks';
import { AUDIO_FORMATS_LABEL, isAudioFile } from '@/lib/media/audio';
import { toast } from '@/lib/toast';
import { PromptNode } from '@/components/nodes/PromptNode';
import { ImageNode } from '@/components/nodes/ImageNode';
import { VideoNode } from '@/components/nodes/VideoNode';
import { ElementNode } from '@/components/nodes/ElementNode';
import { OutputNode } from '@/components/nodes/OutputNode';
import { CameraNode } from '@/components/nodes/CameraNode';
import { LightingNode } from '@/components/nodes/LightingNode';
import { AudioNode } from '@/components/nodes/AudioNode';
import { TaggedEdge } from '@/components/edges/TaggedEdge';
import { isImageFile, isVideoFile } from '@/lib/utils';
import { getTagColor } from '@/lib/fal';
import { nanoid } from 'nanoid';
import type {
  ImageNodeData,
  VideoNodeData,
  ElementNodeData,
  NovaNode,
  AssetDragData,
} from '@/types';

const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  image: ImageNode,
  video: VideoNode,
  element: ElementNode,
  output: OutputNode,
  camera: CameraNode,
  lighting: LightingNode,
  audio: AudioNode,
};

const edgeTypes: EdgeTypes = {
  tagged: TaggedEdge,
};

interface NovaCanvasProps {
  updateCursor?: (position: { x: number; y: number }) => void;
}

export function NovaCanvas({ updateCursor }: NovaCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const edgeReconnectSuccessful = useRef(true);
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    addEdge: addStoreEdge,
    removeEdge,
    addNode,
  } = useCanvasStore();
  const { characters, scenes } = useAssetStore();
  const { openFileRoleModal, openBoardLoadModal } = useModalStore();
  const { screenToFlowPosition } = useReactFlow();
  const { applyAudio } = useAudioLoader();
  const activeHashtagFilters = useProjectStore((s) => s.activeHashtagFilters);

  // Apply hashtag filter dimming to nodes
  const filteredNodes = useMemo(() => {
    if (activeHashtagFilters.length === 0) return nodes;
    return nodes.map((node) => {
      const nodeTags = node.data.hashtags || [];
      const matches = activeHashtagFilters.some((filter) =>
        (nodeTags as string[]).includes(filter)
      );
      if (!matches) {
        return {
          ...node,
          className: `${node.className || ''} opacity-20 pointer-events-none`.trim(),
        };
      }
      return node;
    }) as NovaNode[];
  }, [nodes, activeHashtagFilters]);

  const onConnect = useCallback(
    (connection: Connection) => {
      // Find the source node to get its tag color
      const sourceNode = nodes.find((n) => n.id === connection.source);
      let edgeColor = '#525252';
      let edgeTag: string | undefined;

      if (sourceNode) {
        const nodeData = sourceNode.data as
          | ImageNodeData
          | VideoNodeData
          | ElementNodeData;

        if ('tagAssignment' in nodeData && nodeData.tagAssignment) {
          edgeTag = nodeData.tagAssignment;

          // Determine tag type and get color
          if (nodeData.tagAssignment.startsWith('@Image')) {
            edgeColor = getTagColor('image');
          } else if (nodeData.tagAssignment.startsWith('@Element')) {
            edgeColor = getTagColor('element');
          } else if (nodeData.tagAssignment.startsWith('@Video')) {
            edgeColor = getTagColor('video');
          }
        } else {
          // Use node type color if no tag
          switch (sourceNode.type) {
            case 'image':
              edgeColor = '#3B82F6';
              break;
            case 'video':
              edgeColor = '#8B5CF6';
              break;
            case 'element':
              edgeColor = '#EF4444';
              break;
            case 'output':
              edgeColor = '#22C55E';
              break;
            case 'camera':
              edgeColor = '#F59E0B';
              break;
            case 'lighting':
              edgeColor = '#FBBF24';
              break;
            case 'audio':
              edgeColor = '#A855F7';
              break;
          }
        }
      }

      const edge = {
        ...connection,
        id: `edge-${nanoid()}`,
        type: 'tagged',
        data: {
          color: edgeColor,
          tag: edgeTag,
          animated: false,
        },
      };

      addStoreEdge(edge);
    },
    [nodes, addStoreEdge]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // Get drop position relative to the canvas
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const dropPosition = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };

      // Check for asset drag data first
      const assetData = event.dataTransfer.getData('application/nova-asset');
      if (assetData) {
        try {
          const { type, id } = JSON.parse(assetData) as AssetDragData;

          if (type === 'board') {
            // Find the board to get its name
            const { boards } = useAssetStore.getState();
            const board = boards.find((b) => b.id === id);
            if (board) {
              openBoardLoadModal(id, board.name);
            }
            return;
          }

          if (type === 'character') {
            // Create ElementNode from saved character
            const character = characters.find((c) => c.id === id);
            if (character) {
              const nodeId = `element-${nanoid()}`;
              const tagIndex = nodes.filter((n) => n.type === 'element').length + 1;
              const tagAssignment = `@Element${tagIndex}`;

              const newNode: NovaNode = {
                id: nodeId,
                type: 'element',
                position: dropPosition,
                data: {
                  id: nodeId,
                  name: character.name,
                  elementType: character.elementType,
                  frontalImageUrl: character.frontalImageUrl,
                  frontalThumbnail: character.frontalThumbnail,
                  referenceImageUrls: character.referenceImageUrls,
                  referenceThumbnails: character.referenceThumbnails,
                  tagAssignment,
                  isHighlighted: false,
                  frontalRemoteUrl: character.frontalImageUrl,
                  frontalUploadStatus: 'completed',
                  referenceRemoteUrls: character.referenceImageUrls,
                  referenceUploadStatus: 'completed',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              };

              addNode(newNode);
            }
            return;
          }

          if (type === 'scene') {
            // Create ImageNode from saved scene
            const scene = scenes.find((s) => s.id === id);
            if (scene) {
              const nodeId = `image-${nanoid()}`;
              const tagIndex = nodes.filter((n) => n.type === 'image').length + 1;
              const tagAssignment = `@Image${tagIndex}`;

              const newNode: NovaNode = {
                id: nodeId,
                type: 'image',
                position: dropPosition,
                data: {
                  id: nodeId,
                  imageUrl: scene.imageUrl,
                  thumbnailUrl: scene.thumbnailUrl,
                  fileName: scene.name,
                  fileSize: 0,
                  dimensions: { width: 0, height: 0 },
                  role: 'reference',
                  tagAssignment,
                  isHighlighted: false,
                  remoteUrl: scene.imageUrl,
                  uploadStatus: 'completed',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              };

              addNode(newNode);
            }
            return;
          }
        } catch (e) {
          console.error('Failed to parse asset drag data:', e);
        }
      }

      // Handle file drops
      const files = Array.from(event.dataTransfer.files);
      if (files.length === 0) return;

      const file = files[0];

      // Audio: validate first (format, size, 2–20 s), then create a ready Audio node at the drop point
      if (isAudioFile(file)) {
        const clientPoint = { x: event.clientX, y: event.clientY };
        void (async () => {
          const result = await validateAudioFile(file);
          if (typeof result === 'string') {
            toast.error(result);
            return;
          }
          const audioNode = createNode('audio', screenToFlowPosition(clientPoint), {});
          addNode(audioNode);
          applyAudio(audioNode.id, result);
        })();
        return;
      }

      const isImage = isImageFile(file);
      const isVideo = isVideoFile(file);

      if (!isImage && !isVideo) {
        toast.error(`Unsupported file. Drop an image, a video, or audio (${AUDIO_FORMATS_LABEL}).`);
        return;
      }

      // Open role selection modal
      openFileRoleModal(file, isImage ? 'image' : 'video', dropPosition);
    },
    [openFileRoleModal, openBoardLoadModal, characters, scenes, nodes, addNode, screenToFlowPosition, applyAudio]
  );

  // Edge reconnection handlers - allows disconnecting by dragging from handle
  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      edgeReconnectSuccessful.current = true;
      // Remove old edge and add new one with proper styling
      removeEdge(oldEdge.id);

      // Find the source node to get its tag color
      const sourceNode = nodes.find((n) => n.id === newConnection.source);
      let edgeColor = '#525252';
      let edgeTag: string | undefined;

      if (sourceNode) {
        const nodeData = sourceNode.data as
          | ImageNodeData
          | VideoNodeData
          | ElementNodeData;

        if ('tagAssignment' in nodeData && nodeData.tagAssignment) {
          edgeTag = nodeData.tagAssignment;

          if (nodeData.tagAssignment.startsWith('@Image')) {
            edgeColor = getTagColor('image');
          } else if (nodeData.tagAssignment.startsWith('@Element')) {
            edgeColor = getTagColor('element');
          } else if (nodeData.tagAssignment.startsWith('@Video')) {
            edgeColor = getTagColor('video');
          }
        } else {
          switch (sourceNode.type) {
            case 'image':
              edgeColor = '#3B82F6';
              break;
            case 'video':
              edgeColor = '#8B5CF6';
              break;
            case 'element':
              edgeColor = '#EF4444';
              break;
            case 'output':
              edgeColor = '#22C55E';
              break;
            case 'camera':
              edgeColor = '#F59E0B';
              break;
            case 'lighting':
              edgeColor = '#FBBF24';
              break;
            case 'audio':
              edgeColor = '#A855F7';
              break;
          }
        }
      }

      const edge = {
        ...newConnection,
        id: `edge-${nanoid()}`,
        type: 'tagged',
        data: {
          color: edgeColor,
          tag: edgeTag,
          animated: false,
        },
      };

      addStoreEdge(edge);
    },
    [nodes, removeEdge, addStoreEdge]
  );

  const onReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge) => {
      // If reconnect was not successful (dropped in empty space), remove the edge
      if (!edgeReconnectSuccessful.current) {
        removeEdge(edge.id);
      }
      edgeReconnectSuccessful.current = true;
    },
    [removeEdge]
  );

  const minimapNodeColor = useCallback((node: { type?: string }) => {
    switch (node.type) {
      case 'prompt':
        return '#06B6D4';
      case 'image':
        return '#3B82F6';
      case 'video':
        return '#8B5CF6';
      case 'element':
        return '#EF4444';
      case 'output':
        return '#22C55E';
      case 'camera':
        return '#F59E0B';
      case 'lighting':
        return '#FBBF24';
      case 'audio':
        return '#A855F7';
      default:
        return '#525252';
    }
  }, []);

  // Default edge options
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'tagged',
      animated: false,
    }),
    []
  );

  // Handle cursor position updates for collaboration
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!updateCursor) return;

      // Get canvas-relative coordinates
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;

      updateCursor({ x, y });
    },
    [updateCursor]
  );

  const handleMouseLeave = useCallback(() => {
    if (!updateCursor) return;
    // Hide cursor when leaving canvas
    updateCursor({ x: -1, y: -1 });
  }, [updateCursor]);

  return (
    <div
      ref={reactFlowWrapper}
      className="h-full w-full"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <ReactFlow
        nodes={filteredNodes as unknown as Node[]}
        edges={edges as unknown as Edge[]}
        onNodesChange={onNodesChange as unknown as (changes: unknown[]) => void}
        onEdgesChange={onEdgesChange as unknown as (changes: unknown[]) => void}
        onConnect={onConnect}
        onReconnectStart={onReconnectStart}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{
          padding: 0.4,
          maxZoom: 0.85,
        }}
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: '#525252', strokeWidth: 2 }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#262626"
        />
        <Controls
          showZoom
          showFitView
          showInteractive={false}
          position="bottom-left"
        />
        <MiniMap
          nodeColor={minimapNodeColor}
          maskColor="rgba(0, 0, 0, 0.8)"
          position="bottom-right"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
