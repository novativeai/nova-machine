'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, Copy, Trash2, Share2, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Board } from '@/lib/firestore';

interface ProjectCardProps {
  board: Board;
  viewMode: 'grid' | 'list';
  isRenaming: boolean;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onStartRename: (id: string) => void;
  onCancelRename: () => void;
}

export function ProjectCard({
  board,
  viewMode,
  isRenaming,
  onRename,
  onDuplicate,
  onDelete,
  onStartRename,
  onCancelRename,
}: ProjectCardProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [renameValue, setRenameValue] = useState(board.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(board.name);
      setTimeout(() => renameInputRef.current?.select(), 50);
    }
  }, [isRenaming, board.name]);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleOpen = () => {
    router.push(`/canvas?boardId=${board.id}`);
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue.trim() !== board.name) {
      onRename(board.id, renameValue.trim());
    }
    onCancelRename();
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      onCancelRename();
    }
  };

  const timeAgo = board.updatedAt
    ? formatDistanceToNow(board.updatedAt.toDate(), { addSuffix: true })
    : 'recently';

  const menuItems = [
    { icon: ExternalLink, label: 'Open', action: handleOpen },
    { icon: Pencil, label: 'Rename', action: () => { setShowMenu(false); onStartRename(board.id); } },
    { icon: Copy, label: 'Duplicate', action: () => { setShowMenu(false); onDuplicate(board.id); } },
    { icon: Share2, label: 'Share', action: () => { setShowMenu(false); } },
    { icon: Trash2, label: 'Delete', action: () => { setShowMenu(false); onDelete(board.id); }, danger: true },
  ];

  if (viewMode === 'list') {
    return (
      <div
        className="group flex items-center gap-4 rounded-lg border border-transparent px-4 py-3 transition-colors hover:border-white/5 hover:bg-white/2"
        onDoubleClick={handleOpen}
      >
        {/* Thumbnail */}
        <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-white/3">
          {board.thumbnail ? (
            <img src={board.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="h-3 w-3 rounded border border-white/10" />
            </div>
          )}
        </div>

        {/* Name */}
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleRenameKeyDown}
              className="w-full rounded bg-white/5 px-2 py-0.5 text-sm font-medium text-white outline-none ring-1 ring-white/20 focus:ring-white/40"
            />
          ) : (
            <p className="truncate text-sm font-medium text-white">{board.name}</p>
          )}
        </div>

        {/* Last Edited */}
        <span className="shrink-0 text-xs text-white/30">{timeAgo}</span>

        {/* Actions */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/0 transition-colors group-hover:text-white/40 hover:bg-white/5! hover:text-white/60!"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && <ContextMenu items={menuItems} />}
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="group" onDoubleClick={handleOpen}>
      <div className="overflow-hidden rounded-xl border border-white/5 bg-white/1 transition-all hover:border-white/10 hover:bg-white/2">
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden bg-white/2">
          {board.thumbnail ? (
            <img
              src={board.thumbnail}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-linear-to-br from-white/2 to-white/0.5">
              <div className="grid grid-cols-3 gap-1.5 opacity-20">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-2 w-2 rounded-sm bg-white/30" />
                ))}
              </div>
            </div>
          )}

          {/* Hover overlay with menu */}
          <div className="absolute inset-0 flex items-start justify-end bg-linear-to-b from-black/40 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showMenu && <ContextMenu items={menuItems} />}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="px-3.5 py-3">
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleRenameKeyDown}
              className="w-full rounded bg-white/5 px-1.5 py-0.5 text-sm font-medium text-white outline-none ring-1 ring-white/20 focus:ring-white/40"
            />
          ) : (
            <p className="truncate text-sm font-medium text-white">{board.name}</p>
          )}
          <p className="mt-1 text-xs text-white/30">Edited {timeAgo}</p>
        </div>
      </div>
    </div>
  );
}

// Context Menu sub-component
interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  action: () => void;
  danger?: boolean;
}

function ContextMenu({ items }: { items: MenuItem[] }) {
  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-white/10 bg-[#1a1a1a] py-1 shadow-xl">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={(e) => { e.stopPropagation(); item.action(); }}
          className={cn(
            'flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
            item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-white/70 hover:bg-white/5 hover:text-white'
          )}
        >
          <item.icon className="h-3.5 w-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
