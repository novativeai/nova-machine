'use client';

import { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Camera, X } from 'lucide-react';
import type { CameraNodeData, CameraAngle, LensLength, Colorimetry } from '@/types';
import { useCanvasStore } from '@/stores';
import { cn } from '@/lib/utils';
import { HashtagBadges } from './HashtagBadges';

interface CameraNodeProps {
  id: string;
  data: CameraNodeData;
  selected?: boolean;
}

// Camera angle options with display labels
const CAMERA_ANGLE_OPTIONS: { value: CameraAngle; label: string }[] = [
  { value: 'eye-level', label: 'Eye Level' },
  { value: 'low-angle', label: 'Low Angle' },
  { value: 'high-angle', label: 'High Angle' },
  { value: 'dutch-angle', label: 'Dutch Angle' },
  { value: 'birds-eye-view', label: "Bird's Eye View" },
  { value: 'worms-eye-view', label: "Worm's Eye View" },
  { value: 'over-the-shoulder', label: 'Over the Shoulder' },
  { value: 'point-of-view', label: 'Point of View (POV)' },
  { value: 'close-up', label: 'Close-up' },
  { value: 'extreme-close-up', label: 'Extreme Close-up' },
  { value: 'wide-shot', label: 'Wide Shot' },
  { value: 'establishing-shot', label: 'Establishing Shot' },
  { value: 'tracking-shot', label: 'Tracking Shot' },
  { value: 'dolly-zoom', label: 'Dolly Zoom (Vertigo)' },
];

// Lens length options with display labels
const LENS_LENGTH_OPTIONS: { value: LensLength; label: string }[] = [
  { value: '14mm', label: '14mm (Ultra Wide)' },
  { value: '24mm', label: '24mm (Wide)' },
  { value: '35mm', label: '35mm (Standard Wide)' },
  { value: '50mm', label: '50mm (Normal)' },
  { value: '85mm', label: '85mm (Portrait)' },
  { value: '100mm-macro', label: '100mm Macro' },
  { value: '135mm', label: '135mm (Telephoto)' },
  { value: '200mm', label: '200mm (Long Telephoto)' },
  { value: '400mm', label: '400mm (Super Telephoto)' },
];

// Colorimetry options with display labels
const COLORIMETRY_OPTIONS: { value: Colorimetry; label: string }[] = [
  { value: 'natural', label: 'Natural' },
  { value: 'black-and-white', label: 'Black & White' },
  { value: 'teal-and-orange', label: 'Teal & Orange' },
  { value: 'vintage-film', label: 'Vintage Film' },
  { value: 'warm-golden-hour', label: 'Warm Golden Hour' },
  { value: 'cold-blue', label: 'Cold Blue' },
  { value: 'neon-cyberpunk', label: 'Neon Cyberpunk' },
  { value: 'muted-desaturated', label: 'Muted/Desaturated' },
  { value: 'high-contrast', label: 'High Contrast' },
  { value: 'pastel-soft', label: 'Pastel Soft' },
  { value: 'sepia', label: 'Sepia' },
];

function CameraNodeComponent({ id, data, selected }: CameraNodeProps) {
  const { removeNode, updateNode } = useCanvasStore();

  const handleAngleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNode(id, { cameraAngle: e.target.value as CameraAngle | '' });
    },
    [id, updateNode]
  );

  const handleLensChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNode(id, { lensLength: e.target.value as LensLength | '' });
    },
    [id, updateNode]
  );

  const handleColorimetryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNode(id, { colorimetry: e.target.value as Colorimetry | '' });
    },
    [id, updateNode]
  );

  // Check if any setting is selected
  const hasSettings = data.cameraAngle || data.lensLength || data.colorimetry;

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
          <div className="nova-node-icon" style={{ backgroundColor: '#F59E0B20' }}>
            <Camera className="h-3.5 w-3.5" style={{ color: '#F59E0B' }} />
          </div>
          <span className="text-sm font-medium">Camera</span>
        </div>
        {hasSettings && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-500">
            Active
          </span>
        )}
      </div>

      {/* Camera Angle Dropdown */}
      <div className="mb-2">
        <label className="mb-1 block text-xs text-muted-foreground">
          Camera Angle
        </label>
        <select
          value={data.cameraAngle}
          onChange={handleAngleChange}
          className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="">None</option>
          {CAMERA_ANGLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Lens Length Dropdown */}
      <div className="mb-2">
        <label className="mb-1 block text-xs text-muted-foreground">
          Lens Length
        </label>
        <select
          value={data.lensLength}
          onChange={handleLensChange}
          className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="">None</option>
          {LENS_LENGTH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Colorimetry Dropdown */}
      <div className="mb-2">
        <label className="mb-1 block text-xs text-muted-foreground">
          Color Grading
        </label>
        <select
          value={data.colorimetry}
          onChange={handleColorimetryChange}
          className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="">None</option>
          {COLORIMETRY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Preview of selected settings */}
      {hasSettings && (
        <div className="mt-2 rounded-md bg-amber-500/10 p-2 text-[10px] text-muted-foreground">
          <div className="font-medium text-amber-500 mb-1">Applied Settings:</div>
          {data.cameraAngle && (
            <div>
              {CAMERA_ANGLE_OPTIONS.find((o) => o.value === data.cameraAngle)?.label}
            </div>
          )}
          {data.lensLength && (
            <div>
              {LENS_LENGTH_OPTIONS.find((o) => o.value === data.lensLength)?.label}
            </div>
          )}
          {data.colorimetry && (
            <div>
              {COLORIMETRY_OPTIONS.find((o) => o.value === data.colorimetry)?.label}
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

export const CameraNode = memo(CameraNodeComponent);

// Helper function to format camera settings for prompt
export function formatCameraSettings(data: CameraNodeData): string {
  const parts: string[] = [];

  if (data.cameraAngle) {
    const angle = CAMERA_ANGLE_OPTIONS.find((o) => o.value === data.cameraAngle);
    if (angle) {
      parts.push(`${angle.label} shot`);
    }
  }

  if (data.lensLength) {
    const lens = LENS_LENGTH_OPTIONS.find((o) => o.value === data.lensLength);
    if (lens) {
      parts.push(`shot on ${lens.label} lens`);
    }
  }

  if (data.colorimetry) {
    const color = COLORIMETRY_OPTIONS.find((o) => o.value === data.colorimetry);
    if (color) {
      parts.push(`${color.label} color grading`);
    }
  }

  return parts.join(', ');
}
