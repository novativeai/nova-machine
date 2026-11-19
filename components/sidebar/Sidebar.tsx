'use client';

import { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  ImageIcon,
  Video,
  User,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Camera,
  Sun,
  Music,
} from 'lucide-react';
import { useCanvasStore, useModalStore, createNode } from '@/stores';
import { cn } from '@/lib/utils';

interface NodeTypeOption {
  type: 'prompt' | 'image' | 'video' | 'element' | 'camera' | 'lighting' | 'audio';
  label: string;
  icon: React.ReactNode;
  description: string;
}

const NODE_TYPES: NodeTypeOption[] = [
  {
    type: 'prompt',
    label: 'Prompt',
    icon: <MessageSquare className="h-5 w-5" />,
    description: 'Central generation hub',
  },
  {
    type: 'image',
    label: 'Image',
    icon: <ImageIcon className="h-5 w-5" />,
    description: 'Reference or frame image',
  },
  {
    type: 'video',
    label: 'Video',
    icon: <Video className="h-5 w-5" />,
    description: 'Video input or reference',
  },
  {
    type: 'element',
    label: 'Element',
    icon: <User className="h-5 w-5" />,
    description: 'Character or object',
  },
  {
    type: 'camera',
    label: 'Camera',
    icon: <Camera className="h-5 w-5" />,
    description: 'Cinematography settings',
  },
  {
    type: 'lighting',
    label: 'Lighting',
    icon: <Sun className="h-5 w-5" />,
    description: 'Lighting style and mood',
  },
  {
    type: 'audio',
    label: 'Audio',
    icon: <Music className="h-5 w-5" />,
    description: 'Audio that drives the video (LTX 2.5, 2–20s)',
  },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { addNode } = useCanvasStore();
  const { openElementConfigModal } = useModalStore();
  const { screenToFlowPosition } = useReactFlow();

  const handleAddNode = (type: NodeTypeOption['type']) => {
    // Get center of viewport
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const position = screenToFlowPosition({
      x: centerX,
      y: centerY,
    });

    // Add slight randomness to avoid stacking
    position.x += Math.random() * 100 - 50;
    position.y += Math.random() * 100 - 50;

    // For element nodes, open the config modal first
    if (type === 'element') {
      openElementConfigModal(position);
      return;
    }

    const node = createNode(type, position, {});
    addNode(node);
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-card transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex h-10 items-center justify-center border-b border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      {/* Node Types */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className={cn('mb-2', !isCollapsed && 'px-2')}>
          {!isCollapsed && (
            <h2 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Add Nodes
            </h2>
          )}
        </div>

        <div className="space-y-1">
          {NODE_TYPES.map((nodeType) => (
            <button
              key={nodeType.type}
              onClick={() => handleAddNode(nodeType.type)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-secondary',
                isCollapsed && 'justify-center px-2'
              )}
              title={isCollapsed ? nodeType.label : undefined}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                {nodeType.icon}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{nodeType.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {nodeType.description}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className="border-t border-border p-3">
          <div className="text-xs text-muted-foreground">
            Drag & drop files to canvas or click to add nodes
          </div>
        </div>
      )}
    </aside>
  );
}
