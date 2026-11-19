'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useFileBrowserStore } from '@/stores/file-browser-store';
import { ApiKeyButton } from './ApiKeyButton';
import { UserMenu } from './UserMenu';
import {
  Search,
  LayoutGrid,
  List,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppTopBar() {
  const { viewMode, setViewMode, searchQuery, setSearchQuery } = useFileBrowserStore();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 200);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  // Cmd+K shortcut
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const input = document.getElementById('app-search-input');
      input?.focus();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 bg-[#0f0f0f] px-4">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-white/5">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
          <span className="text-sm font-semibold text-white">Nova Machine</span>
        </Link>
      </div>

      {/* Center: Search */}
      <div className="flex max-w-md flex-1 items-center justify-center px-8">
        <div
          className={cn(
            'flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 transition-all',
            isSearchFocused
              ? 'border-white/20 bg-white/5'
              : 'border-white/5 bg-white/[0.02] hover:border-white/10'
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-white/30" />
          <input
            id="app-search-input"
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search projects..."
            className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
          {localSearch ? (
            <button
              onClick={() => { setLocalSearch(''); setSearchQuery(''); }}
              className="text-white/30 hover:text-white/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/30 sm:inline-block">
              {'\u2318'}K
            </kbd>
          )}
        </div>
      </div>

      {/* Right: View toggle, API Key, User */}
      <div className="flex items-center gap-2">
        {/* View Mode Toggle */}
        <div className="flex items-center rounded-lg border border-white/5 bg-white/[0.02] p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
              viewMode === 'grid'
                ? 'bg-white/10 text-white'
                : 'text-white/30 hover:text-white/60'
            )}
            title="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
              viewMode === 'list'
                ? 'bg-white/10 text-white'
                : 'text-white/30 hover:text-white/60'
            )}
            title="List view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Own fal.ai API key */}
        <ApiKeyButton variant="pill" />

        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-white/5" />

        {/* User Menu */}
        <UserMenu />
      </div>
    </header>
  );
}
