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
  reconnectEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore } from '@/stores';
import { useModalStore } from '@/stores';
import { PromptNode } from '@/components/nodes/PromptNode';
import { ImageNode } from '@/components/nodes/ImageNode';
import { VideoNode } from '@/components/nodes/VideoNode';
import { ElementNode } from '@/components/nodes/ElementNode';
import { OutputNode } from '@/components/nodes/OutputNode';
import { CameraNode } from '@/components/nodes/CameraNode';
import { LightingNode } from '@/components/nodes/LightingNode';
import { TaggedEdge } from '@/components/edges/TaggedEdge';
import { isImageFile, isVideoFile } from '@/lib/utils';
import { getTagColor } from '@/lib/fal';
import { nanoid } from 'nanoid';
import type {
  ImageNodeData,
  VideoNodeData,
  ElementNodeData,
  TagType,
  NovaNode,
  NovaEdge,
} from '@/types';

const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  image: ImageNode,
  video: VideoNode,
  element: ElementNode,
  output: OutputNode,
  camera: CameraNode,
  lighting: LightingNode,
};

const edgeTypes: EdgeTypes = {
  tagged: TaggedEdge,
};

export function NovaCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const edgeReconnectSuccessful = useRef(true);
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    addEdge: addStoreEdge,
    removeEdge,
  } = useCanvasStore();
  const { openFileRoleModal } = useModalStore();

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

      const files = Array.from(event.dataTransfer.files);
      if (files.length === 0) return;

      const file = files[0];
      const isImage = isImageFile(file);
      const isVideo = isVideoFile(file);

      if (!isImage && !isVideo) {
        console.warn('Unsupported file type:', file.type);
        return;
      }

      // Get drop position relative to the canvas
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const dropPosition = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };

      // Open role selection modal
      openFileRoleModal(file, isImage ? 'image' : 'video', dropPosition);
    },
    [openFileRoleModal]
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

  return (
    <div ref={reactFlowWrapper} className="h-full w-full">
      <ReactFlow
        nodes={nodes as unknown as Node[]}
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
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
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
