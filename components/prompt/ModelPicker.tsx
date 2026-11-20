'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { ModelCategory } from '@/types';
import { cn } from '@/lib/utils';
import { formatUsd } from '@/lib/fal';

export interface ModelOption<T extends string> {
  id: T;
  label: string;
  vendor: string;
  blurb: string;
  /** Estimated fal cost for the current settings, or a reason it can't run. */
  costUsd: number;
  isEstimate: boolean;
  blocker?: string;
}

interface ModelPickerProps<T extends string> {
  category: ModelCategory;
  value: T;
  options: ModelOption<T>[];
  onChange: (id: T) => void;
  disabled?: boolean;
}

const CATEGORY_LABEL: Record<ModelCategory, string> = {
  video: 'Video model',
  image: 'Image model',
  lipsync: 'Lip-sync model',
  speech: 'Speech model',
  sound: 'Audio model',
  music: 'Music model',
};

/**
 * Per-category model switcher. Each row shows what that model would cost for the
 * node's current inputs and settings, so switching is an informed choice.
 */
export function ModelPicker<T extends string>({ category, value, options, onChange, disabled }: ModelPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="nodrag relative" onMouseDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-2 rounded border border-border bg-background px-2 py-1.5 text-left text-xs transition-colors hover:border-white/20 disabled:opacity-50"
        title={CATEGORY_LABEL[category]}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">
          <span className="text-white/40">{CATEGORY_LABEL[category]} · </span>
          <span className="font-medium text-white/90">{current.label}</span>
        </span>
        <ChevronDown className={cn('h-3 w-3 shrink-0 text-white/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="listbox"
          className="nowheel absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-[#141414] p-1 shadow-xl"
        >
          {options.map((option) => {
            const selected = option.id === value;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                  selected ? 'bg-white/10' : 'hover:bg-white/5'
                )}
              >
                <Check className={cn('mt-0.5 h-3 w-3 shrink-0', selected ? 'text-primary' : 'text-transparent')} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-medium text-white/90">{option.label}</span>
                    <span className={cn('shrink-0 text-[10px]', option.blocker ? 'text-amber-400/80' : 'text-white/50')}>
                      {option.blocker ? 'n/a' : `${option.isEstimate ? '~' : ''}${formatUsd(option.costUsd)}`}
                    </span>
                  </span>
                  <span className="block text-[10px] text-white/35">{option.vendor}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-white/50">
                    {option.blocker ?? option.blurb}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
