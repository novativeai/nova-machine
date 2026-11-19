'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  User,
  Image as ImageIcon,
  Plus,
  FolderOpen,
  FileText,
  Folder,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAssetStore, useCanvasStore } from '@/stores';
import { AssetCard } from './AssetCard';
import { ProjectPanel } from './ProjectPanel';
type TabType = 'board' | 'character' | 'scene' | 'project';

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'project', label: 'Projects', icon: <Folder className="h-4 w-4" /> },
  { id: 'board', label: 'Boards', icon: <LayoutGrid className="h-4 w-4" /> },
  { id: 'character', label: 'Characters', icon: <User className="h-4 w-4" /> },
  { id: 'scene', label: 'Scenes', icon: <ImageIcon className="h-4 w-4" /> },
];

export function AssetSidebar() {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('board');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');

  const { boards, characters, scenes, saveBoard, updateBoard, deleteBoard, deleteCharacter, deleteScene } =
    useAssetStore();
  const { nodes, edges, clearCanvas } = useCanvasStore();

  const handleNewBoard = () => {
    if (confirm('Create a new board? This will clear the current canvas.')) {
      clearCanvas();
      router.push('/canvas');
    }
  };

  const handleLoadBoard = (boardId: string) => {
    router.push(`/canvas?boardId=${boardId}`);
  };

  const handleRenameBoard = (boardId: string, newName: string) => {
    const board = boards.find(b => b.id === boardId);
    if (board) {
      // Helper to safely parse dates from serialized data
      const parseDate = (value: unknown): Date => {
        if (value instanceof Date) return value;
        if (typeof value === 'string' || typeof value === 'number') {
          return new Date(value);
        }
        return new Date();
      };

      // Convert serialized nodes back to NovaNode format for updateBoard
      const boardNodes = board.nodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          createdAt: parseDate(n.data.createdAt),
          updatedAt: parseDate(n.data.updatedAt),
        }
      }));
      updateBoard(boardId, newName, boardNodes as Parameters<typeof updateBoard>[2], board.edges as Parameters<typeof updateBoard>[3]);
    }
  };

  const handleSaveBoard = () => {
    if (!saveName.trim()) return;
    saveBoard(saveName.trim(), nodes, edges);
    setSaveName('');
    setShowSaveInput(false);
  };

  const handleSaveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveBoard();
    } else if (e.key === 'Escape') {
      setSaveName('');
      setShowSaveInput(false);
    }
  };

  const renderEmptyState = (type: TabType) => {
    const messages: Record<TabType, { title: string; desc: string }> = {
      project: {
        title: 'No projects',
        desc: 'Create a project to organize your work',
      },
      board: {
        title: 'No saved boards',
        desc: 'Save your current canvas as a board',
      },
      character: {
        title: 'No saved characters',
        desc: 'Save characters from Element nodes',
      },
      scene: {
        title: 'No saved scenes',
        desc: 'Save image references as scenes',
      },
    };

    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <FolderOpen className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <div className="text-sm font-medium text-muted-foreground">
          {messages[type].title}
        </div>
        <div className="mt-1 text-xs text-muted-foreground/70">
          {messages[type].desc}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'board':
        return boards.length === 0 ? (
          renderEmptyState('board')
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {boards.map((board) => (
              <AssetCard
                key={board.id}
                type="board"
                id={board.id}
                name={board.name}
                thumbnail={board.thumbnail}
                onClick={() => handleLoadBoard(board.id)}
                onRename={(newName) => handleRenameBoard(board.id, newName)}
                onDelete={() => deleteBoard(board.id)}
              />
            ))}
          </div>
        );

      case 'character':
        return characters.length === 0 ? (
          renderEmptyState('character')
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {characters.map((character) => (
              <AssetCard
                key={character.id}
                type="character"
                id={character.id}
                name={character.name}
                thumbnail={character.frontalThumbnail}
                onDelete={() => deleteCharacter(character.id)}
              />
            ))}
          </div>
        );

      case 'scene':
        return scenes.length === 0 ? (
          renderEmptyState('scene')
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {scenes.map((scene) => (
              <AssetCard
                key={scene.id}
                type="scene"
                id={scene.id}
                name={scene.name}
                thumbnail={scene.thumbnailUrl}
                onDelete={() => deleteScene(scene.id)}
              />
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  if (isCollapsed) {
    return (
      <div className="fixed right-4 top-20 z-40 flex flex-col gap-1 rounded-xl border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur-sm">
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Expand assets"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setIsCollapsed(false);
            }}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
            title={tab.label}
          >
            {tab.icon}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="fixed right-4 top-20 z-40 flex w-72 flex-col rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium">Assets</span>
        <button
          onClick={() => setIsCollapsed(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Collapse"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Project Panel */}
      {activeTab === 'project' && (
        <div className="flex-1 overflow-y-auto p-2">
          <ProjectPanel />
        </div>
      )}

      {/* Save action for boards */}
      {activeTab === 'board' && (
        <div className="border-b border-border p-2 space-y-2">
          {/* New Board Button */}
          <button
            onClick={handleNewBoard}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <FileText className="h-3.5 w-3.5" />
            New Board
          </button>

          {/* Save Board Section */}
          {showSaveInput ? (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={handleSaveKeyDown}
                placeholder="Board name..."
                className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveBoard}
                disabled={!saveName.trim()}
                className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveInput(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-secondary py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              <Plus className="h-3.5 w-3.5" />
              Save Current Board
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-2">
        {renderContent()}
      </div>

      {/* Footer hint */}
      <div className="border-t border-border px-3 py-2 text-center text-[10px] text-muted-foreground">
        Drag items onto canvas to use
      </div>
    </div>
  );
}
