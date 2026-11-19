'use client';

import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Sun, X } from 'lucide-react';
import type { LightingNodeData, LightingStyle, LightingKey } from '@/types';
import { useCanvasStore } from '@/stores';
import { cn } from '@/lib/utils';
import { HashtagBadges } from './HashtagBadges';

interface LightingNodeProps {
  id: string;
  data: LightingNodeData;
  selected?: boolean;
}

// Lighting style options with display labels
const LIGHTING_STYLE_OPTIONS: { value: LightingStyle; label: string }[] = [
  { value: 'rembrandt', label: 'Rembrandt' },
  { value: 'butterfly', label: 'Butterfly (Paramount)' },
  { value: 'split', label: 'Split Lighting' },
  { value: 'loop', label: 'Loop Lighting' },
  { value: 'broad', label: 'Broad Lighting' },
  { value: 'short', label: 'Short Lighting' },
  { value: 'rim', label: 'Rim/Edge Lighting' },
  { value: 'backlighting', label: 'Backlighting' },
  { value: 'silhouette', label: 'Silhouette' },
  { value: 'three-point', label: 'Three-Point Lighting' },
  { value: 'natural', label: 'Natural Light' },
  { value: 'practical', label: 'Practical Lighting' },
  { value: 'motivated', label: 'Motivated Lighting' },
  { value: 'soft-diffused', label: 'Soft Diffused' },
  { value: 'hard-dramatic', label: 'Hard Dramatic' },
];

// Lighting key/tone options with display labels
const LIGHTING_KEY_OPTIONS: { value: LightingKey; label: string }[] = [
  { value: 'low-key', label: 'Low-Key (Dark, Dramatic)' },
  { value: 'high-key', label: 'High-Key (Bright, Airy)' },
  { value: 'natural-key', label: 'Natural Key (Balanced)' },
  { value: 'chiaroscuro', label: 'Chiaroscuro (Extreme Contrast)' },
  { value: 'flat', label: 'Flat (Even, Minimal Shadow)' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'moody', label: 'Moody' },
  { value: 'ethereal', label: 'Ethereal (Soft, Dreamy)' },
  { value: 'noir', label: 'Film Noir' },
  { value: 'golden-hour', label: 'Golden Hour' },
  { value: 'blue-hour', label: 'Blue Hour' },
];

function LightingNodeComponent({ id, data, selected }: LightingNodeProps) {
  const { removeNode, updateNode } = useCanvasStore();

  const handleStyleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNode(id, { lightingStyle: e.target.value as LightingStyle | '' });
    },
    [id, updateNode]
  );

  const handleKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNode(id, { lightingKey: e.target.value as LightingKey | '' });
    },
    [id, updateNode]
  );

  // Check if any setting is selected
  const hasSettings = data.lightingStyle || data.lightingKey;

  return (
    <div
      className={cn(
        'nova-node w-56 relative',
        selected && 'selected'
      )}
    >
      {/* Floating Delete Button */}
      <button
        onClick={() => removeNode(id)}
        className="nova-node-delete"
        title="Delete node"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Header */}
      <div className="nova-drag-handle mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="nova-node-icon" style={{ backgroundColor: '#FBBF2420' }}>
            <Sun className="h-3.5 w-3.5" style={{ color: '#FBBF24' }} />
          </div>
          <span className="text-sm font-medium">Lighting</span>
        </div>
        {hasSettings && (
          <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-500">
            Active
          </span>
        )}
      </div>

      {/* Lighting Style Dropdown */}
      <div className="mb-2">
        <label className="mb-1 block text-xs text-muted-foreground">
          Lighting Style
        </label>
        <select
          value={data.lightingStyle}
          onChange={handleStyleChange}
          className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-xs focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
        >
          <option value="">None</option>
          {LIGHTING_STYLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Lighting Key Dropdown */}
      <div className="mb-2">
        <label className="mb-1 block text-xs text-muted-foreground">
          Lighting Key
        </label>
        <select
          value={data.lightingKey}
          onChange={handleKeyChange}
          className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-xs focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
        >
          <option value="">None</option>
          {LIGHTING_KEY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Preview of selected settings */}
      {hasSettings && (
        <div className="mt-2 rounded-md bg-yellow-500/10 p-2 text-[10px] text-muted-foreground">
          <div className="font-medium text-yellow-500 mb-1">Applied Settings:</div>
          {data.lightingStyle && (
            <div>
              {LIGHTING_STYLE_OPTIONS.find((o) => o.value === data.lightingStyle)?.label}
            </div>
          )}
          {data.lightingKey && (
            <div>
              {LIGHTING_KEY_OPTIONS.find((o) => o.value === data.lightingKey)?.label}
            </div>
          )}
        </div>
      )}

      <HashtagBadges nodeId={id} />

      {/* Output Handle - connects to prompt node */}
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  );
}

export const LightingNode = memo(LightingNodeComponent);

// Helper function to format lighting settings for prompt
export function formatLightingSettings(data: LightingNodeData): string {
  const parts: string[] = [];

  if (data.lightingStyle) {
    const style = LIGHTING_STYLE_OPTIONS.find((o) => o.value === data.lightingStyle);
    if (style) {
      parts.push(`${style.label} lighting`);
    }
  }

  if (data.lightingKey) {
    const key = LIGHTING_KEY_OPTIONS.find((o) => o.value === data.lightingKey);
    if (key) {
      parts.push(`${key.label}`);
    }
  }

  return parts.join(', ');
}
