'use client';

import { Settings, ArrowLeft, Share2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { useModalStore, useAIStore } from '@/stores';
import CollaboratorAvatars from '@/components/canvas/CollaboratorAvatars';
import { ApiKeyButton } from '@/components/app/ApiKeyButton';
import { BoardFalSpend } from './BoardFalSpend';
import { useEffect, useRef, useState } from 'react';
import { getBoard, updateBoard } from '@/lib/firestore';

export function Header() {
  const searchParams = useSearchParams();
  const boardId = searchParams.get('boardId');
  const { openShareModal } = useModalStore();
  const { toggleCommandBar } = useAIStore();
  const [boardName, setBoardName] = useState<string>('Untitled');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Cmd+K keyboard shortcut for AI command bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandBar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommandBar]);

  // Fetch board name when boardId changes
  useEffect(() => {
    if (boardId) {
      getBoard(boardId)
        .then((board) => {
          if (board) {
            setBoardName(board.name);
          }
        })
        .catch((err) => {
          console.error('Failed to load board name:', err);
        });
    }
  }, [boardId]);

  const handleShareClick = () => {
    if (boardId) {
      openShareModal(boardId, boardName);
    }
  };

  const handleStartEditName = () => {
    setNameValue(boardName);
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 50);
  };

  const handleSaveName = async () => {
    setIsEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== boardName && boardId) {
      const previousName = boardName;
      setBoardName(trimmed);
      try {
        await updateBoard(boardId, { name: trimmed });
      } catch (err) {
        console.error('Failed to update board name:', err);
        setBoardName(previousName);
      }
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveName();
    if (e.key === 'Escape') setIsEditingName(false);
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 bg-[#0f0f0f] px-3">
      {/* Left: Back + Board name */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
          title="Back to projects"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="mx-1 h-4 w-px bg-white/10" />

        {/* Logo */}
        <div className="flex h-5 w-5 items-center justify-center rounded-sm border border-white/15 bg-white/5">
          <div className="h-1 w-1 rounded-full bg-white" />
        </div>

        {/* Board Name - inline editable */}
        {isEditingName ? (
          <input
            ref={nameInputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleNameKeyDown}
            className="w-40 rounded bg-white/5 px-1.5 py-0.5 text-sm font-medium text-white outline-none ring-1 ring-white/20 focus:ring-white/40"
          />
        ) : (
          <button
            onClick={handleStartEditName}
            className="rounded px-1.5 py-0.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/5"
            title="Click to rename"
          >
            {boardName}
          </button>
        )}
      </div>

      {/* Center: This space is intentionally left for the FloatingToolbar which overlays the canvas */}
      <div className="flex-1" />

      {/* Right: Collaborators, API Key, Settings */}
      <div className="flex items-center gap-2">
        {/* Collaborator Avatars */}
        {boardId && (
          <CollaboratorAvatars
            boardId={boardId}
            onShareClick={handleShareClick}
          />
        )}

        {/* AI Command Button */}
        <button
          onClick={toggleCommandBar}
          className="flex h-7 items-center gap-1.5 rounded-md bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          title="AI Command Bar (Cmd+K)"
        >
          <Sparkles className="h-3 w-3" />
          <span className="hidden sm:inline">AI</span>
          <kbd className="hidden sm:inline rounded border border-primary/20 px-1 py-0 text-[9px] text-primary/60">
            ⌘K
          </kbd>
        </button>

        {/* Share Button */}
        {boardId && (
          <button
            onClick={handleShareClick}
            className="flex h-7 items-center gap-1.5 rounded-md bg-white/5 px-2.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Share2 className="h-3 w-3" />
            Share
          </button>
        )}

        {/* fal.ai spend for this board */}
        <BoardFalSpend />

        {/* Own fal.ai API key */}
        <ApiKeyButton variant="header" />

        <Link
          href="/"
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
          title="Back to projects"
        >
          <Settings className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  );
}
