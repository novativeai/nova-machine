'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Eye, EyeOff, Key, ShieldCheck, Trash2 } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';
import { cn } from '@/lib/utils';

/** Where users create (and revoke) fal.ai API keys. */
export const FAL_KEYS_URL = 'https://fal.ai/dashboard/keys';

/**
 * How the key is protected. Every line is a property of the code, not a promise:
 * the key lives in this browser's storage, fal requests go browser → fal.ai,
 * and no Nova Machine server route receives it.
 */
export const API_KEY_SECURITY_POINTS = [
  'Stored only in this browser — never sent to or saved on Nova Machine servers or our database.',
  'Sent only to fal.ai, directly from your browser over encrypted HTTPS.',
  'Never shared: collaborators on your boards use their own keys.',
  'Remove it here any time, or revoke it instantly from your fal.ai dashboard.',
] as const;

interface ApiKeyButtonProps {
  /** Compact header button (canvas) vs. bordered pill (projects bar) */
  variant?: 'header' | 'pill';
  /** Which edge of the button the popover lines up with */
  align?: 'left' | 'right';
}

/**
 * Key status button + popover where users add their own fal.ai API key.
 */
export function ApiKeyButton({ variant = 'header', align = 'right' }: ApiKeyButtonProps) {
  const { falApiKey, setFalApiKey, clearFalApiKey } = useSettingsStore();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasKey = falApiKey.length > 0;

  const open = useCallback(() => {
    setDraft(useSettingsStore.getState().falApiKey);
    setRevealed(false);
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setRevealed(false);
    setDraft(''); // don't keep the key in component state longer than needed
  }, []);

  const save = useCallback(() => {
    if (draft.trim()) setFalApiKey(draft);
    else clearFalApiKey();
    close();
  }, [draft, setFalApiKey, clearFalApiKey, close]);

  const remove = useCallback(() => {
    clearFalApiKey();
    close();
  }, [clearFalApiKey, close]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, close]);

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={isOpen ? close : open}
        className={cn(
          'flex items-center gap-1.5 text-xs font-medium transition-colors',
          variant === 'header' ? 'h-7 rounded-md px-2.5' : 'rounded-lg border px-2.5 py-1',
          hasKey
            ? 'border-green-500/10 bg-green-500/10 text-green-400 hover:bg-green-500/15'
            : 'border-amber-500/10 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15'
        )}
        title={hasKey ? 'Your fal.ai API key is connected' : 'Add your own fal.ai API key'}
        aria-expanded={isOpen}
      >
        <Key className="h-3 w-3" />
        {hasKey ? 'Key active' : 'Add your API key'}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="fal.ai API key"
          className={cn(
            'absolute top-full z-50 mt-2 w-80 rounded-lg border border-white/10 bg-[#1a1a1a] p-4 shadow-xl',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <div className="text-sm font-medium text-white">Use your own fal.ai API key</div>
          <p className="mt-1 text-[11px] leading-relaxed text-white/50">
            Nova Machine generates with your fal.ai account, so you get the latest models and fal.ai bills
            you directly for what you use.{' '}
            <a
              href={FAL_KEYS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300"
            >
              Get a key <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </p>

          <form
            className="mt-3 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type={revealed ? 'text' : 'password'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste your fal.ai key"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                className="w-full rounded border border-white/10 bg-white/5 py-1.5 pl-2 pr-7 font-mono text-xs text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                title={revealed ? 'Hide key' : 'Show key'}
              >
                {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <button
              type="submit"
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded border border-green-500/20 bg-green-500/10 text-green-400 transition-colors hover:bg-green-500/20"
              title="Save key"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            {hasKey && (
              <button
                type="button"
                onClick={remove}
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded border border-red-500/20 bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                title="Remove key from this browser"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          <div className="mt-3 rounded-md border border-white/5 bg-white/[0.03] p-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-white/70">
              <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
              How your key is protected
            </div>
            <ul className="space-y-1">
              {API_KEY_SECURITY_POINTS.map((point) => (
                <li key={point} className="flex gap-1.5 text-[10px] leading-relaxed text-white/45">
                  <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-white/30" />
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              Tip: create a dedicated key just for Nova Machine so you can revoke it on its own.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
