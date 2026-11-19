'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getUserBoards,
  getUserAccessibleBoards,
  updateBoard,
  deleteBoard,
  createBoard,
  type Board,
} from '@/lib/firestore';
import { useFileBrowserStore } from '@/stores/file-browser-store';
import { ProjectCard } from '@/components/app/ProjectCard';
import {
  Plus,
  Clock,
  FileText,
  Users,
  ChevronDown,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FileBrowserPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [sharedBoards, setSharedBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const {
    viewMode,
    sortBy,
    sortDirection,
    searchQuery,
    activeSection,
    setActiveSection,
    renamingBoardId,
    setRenamingBoardId,
    setSortBy,
  } = useFileBrowserStore();

  const loadBoards = useCallback(async () => {
    if (!user) return;
    try {
      const [ownedBoards, accessibleBoards] = await Promise.all([
        getUserBoards(user.uid),
        getUserAccessibleBoards(user.uid),
      ]);
      setBoards(ownedBoards);
      // Shared boards = accessible boards that aren't owned by user
      setSharedBoards(accessibleBoards.filter((b) => b.userId !== user.uid));
    } catch (error) {
      console.error('Error loading boards:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  const handleCreateProject = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const boardId = await createBoard(user.uid, {
        name: 'Untitled',
        description: '',
        thumbnail: '',
        nodes: '[]',
        edges: '[]',
        isPublic: false,
        tags: [],
        ownerId: user.uid,
        collaboratorIds: [],
        visibility: 'private',
        nodeCount: 0,
      });
      router.push(`/canvas?boardId=${boardId}`);
    } catch (error) {
      console.error('Error creating project:', error);
      setCreating(false);
    }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      await updateBoard(id, { name });
      setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
    } catch (error) {
      console.error('Error renaming board:', error);
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!user) return;
    const board = boards.find((b) => b.id === id);
    if (!board) return;
    try {
      const newId = await createBoard(user.uid, {
        name: `${board.name} (copy)`,
        description: board.description || '',
        thumbnail: board.thumbnail || '',
        nodes: board.nodes,
        edges: board.edges,
        isPublic: false,
        tags: board.tags || [],
        ownerId: user.uid,
        collaboratorIds: [],
        visibility: 'private',
        nodeCount: board.nodeCount || 0,
      });
      // Reload boards to reflect the new one
      if (newId) {
        await loadBoards();
      }
    } catch (error) {
      console.error('Error duplicating board:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    try {
      await deleteBoard(id);
      setBoards((prev) => prev.filter((b) => b.id !== id));
    } catch (error) {
      console.error('Error deleting board:', error);
    }
  };

  // Get the boards for the active section
  const activeBoardList = activeSection === 'shared' ? sharedBoards : boards;

  // Filter by search
  const filtered = searchQuery
    ? activeBoardList.filter((b) =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeBoardList;

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortBy === 'createdAt') {
      cmp = (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
    } else {
      cmp = (a.updatedAt?.toMillis() || 0) - (b.updatedAt?.toMillis() || 0);
    }
    return sortDirection === 'desc' ? -cmp : cmp;
  });

  // Recent = top 6 most recently edited (always by updatedAt, independent of user sort)
  const recentBoards = activeSection !== 'shared'
    ? [...filtered]
        .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0))
        .slice(0, 6)
    : [];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Navigation */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-white/5 bg-[#0a0a0a]">
        <div className="flex-1 overflow-y-auto p-3">
          {/* New Project Button */}
          <button
            onClick={handleCreateProject}
            disabled={creating}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition-all hover:bg-white/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? 'Creating...' : 'New project'}
          </button>

          {/* Sections */}
          <nav className="space-y-0.5">
            <SidebarItem
              icon={Clock}
              label="Recent"
              active={activeSection === 'recent'}
              onClick={() => setActiveSection('recent')}
            />
            <SidebarItem
              icon={FileText}
              label="Drafts"
              active={activeSection === 'drafts'}
              onClick={() => setActiveSection('drafts')}
              count={boards.length}
            />
            <SidebarItem
              icon={Users}
              label="Shared with me"
              active={activeSection === 'shared'}
              onClick={() => setActiveSection('shared')}
              count={sharedBoards.length > 0 ? sharedBoards.length : undefined}
            />
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-6">
          {/* Section Header */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-white">
              {activeSection === 'recent' && 'Recent projects'}
              {activeSection === 'drafts' && 'Drafts'}
              {activeSection === 'shared' && 'Shared with me'}
            </h1>

            {/* Sort Control */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30">Sort by</span>
              <button
                onClick={() => {
                  const options: Array<'updatedAt' | 'name' | 'createdAt'> = ['updatedAt', 'name', 'createdAt'];
                  const idx = options.indexOf(sortBy);
                  setSortBy(options[(idx + 1) % options.length]);
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white/70"
              >
                {sortBy === 'updatedAt' && 'Last edited'}
                {sortBy === 'name' && 'Name'}
                {sortBy === 'createdAt' && 'Date created'}
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Recent Files Row (only in recent/drafts view) */}
          {activeSection !== 'shared' && recentBoards.length > 0 && activeSection === 'recent' && (
            <div className="mb-8">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">
                Recently edited
              </h2>
              <div className="grid grid-cols-3 gap-4 xl:grid-cols-4">
                {recentBoards.map((board) => (
                  <ProjectCard
                    key={board.id}
                    board={board}
                    viewMode="grid"
                    isRenaming={renamingBoardId === board.id}
                    onRename={handleRename}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                    onStartRename={setRenamingBoardId}
                    onCancelRename={() => setRenamingBoardId(null)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Files */}
          {sorted.length > 0 ? (
            <div>
              {activeSection === 'recent' && recentBoards.length > 0 && (
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">
                  All projects
                </h2>
              )}

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-3 gap-4 xl:grid-cols-4">
                  {sorted.map((board) => (
                    <ProjectCard
                      key={board.id}
                      board={board}
                      viewMode="grid"
                      isRenaming={renamingBoardId === board.id}
                      onRename={handleRename}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                      onStartRename={setRenamingBoardId}
                      onCancelRename={() => setRenamingBoardId(null)}
                    />
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-white/3">
                  {sorted.map((board) => (
                    <ProjectCard
                      key={board.id}
                      board={board}
                      viewMode="list"
                      isRenaming={renamingBoardId === board.id}
                      onRename={handleRename}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                      onStartRename={setRenamingBoardId}
                      onCancelRename={() => setRenamingBoardId(null)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-24">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/2">
                <FolderOpen className="h-7 w-7 text-white/20" />
              </div>
              <h3 className="text-lg font-medium text-white">
                {searchQuery ? 'No projects found' : 'No projects yet'}
              </h3>
              <p className="mt-2 max-w-sm text-center text-sm text-white/40">
                {searchQuery
                  ? `No projects matching "${searchQuery}". Try a different search.`
                  : 'Create your first project to start generating AI videos and images.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleCreateProject}
                  disabled={creating}
                  className="mt-6 flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-all hover:bg-white/90 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Create project
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Sidebar Item sub-component
function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
  count,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
        active
          ? 'bg-white/5 font-medium text-white'
          : 'text-white/50 hover:bg-white/3 hover:text-white/70'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-white/20">{count}</span>
      )}
    </button>
  );
}
