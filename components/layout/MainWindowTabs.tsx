'use client';

import { useEffect } from 'react';
import { MonitorPlay, Workflow } from 'lucide-react';
import { useTimelineStore, type MainView } from '@/stores';
import { cn } from '@/lib/utils';

const TABS: Array<{ id: MainView; label: string; icon: typeof Workflow }> = [
  { id: 'canvas', label: 'Canvas', icon: Workflow },
  { id: 'preview', label: 'Preview', icon: MonitorPlay },
];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable));
}

/** Panel tabs of the main window: node canvas or live programme preview (` toggles). */
export function MainWindowTabs() {
  const mainView = useTimelineStore((s) => s.mainView);
  const setMainView = useTimelineStore((s) => s.setMainView);
  const toggleMainView = useTimelineStore((s) => s.toggleMainView);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '`' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      e.preventDefault();
      toggleMainView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleMainView]);

  return (
    <div className="flex h-8 shrink-0 items-stretch border-b border-white/10 bg-[#111]" role="tablist" aria-label="Main window">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = mainView === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMainView(id)}
            className={cn(
              'relative flex items-center gap-1.5 border-r border-white/10 px-3.5 text-xs font-medium transition-colors',
              active ? 'bg-background text-white' : 'text-white/45 hover:bg-white/[0.04] hover:text-white/80'
            )}
            title={`${label} (\` to switch)`}
          >
            <Icon className={cn('h-3.5 w-3.5', active && (id === 'preview' ? 'text-emerald-400' : 'text-primary'))} />
            {label}
            {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400/80" />}
          </button>
        );
      })}
      <div className="flex-1" />
      <span className="hidden items-center pr-3 text-[10px] text-white/25 md:flex">` switches view</span>
    </div>
  );
}
