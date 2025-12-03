'use client';

import { Settings, Sparkles } from 'lucide-react';

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">NovaMachine</h1>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          Beta
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
