'use client';

import { useState, useCallback } from 'react';
import { Folder, Plus, Trash2, Edit2, Check, X, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores';
import type { Project } from '@/types';

/**
 * Project management panel for the AssetSidebar.
 * Displays a list of projects with create/edit/delete functionality.
 *
 * Data flow:
 * - Reads: project store projects, activeProjectId
 * - Writes: project store CRUD operations
 */
export function ProjectPanel() {
  const {
    projects,
    activeProjectId,
    createProject,
    updateProject,
    deleteProject,
    setActiveProject,
  } = useProjectStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    const id = createProject(newName.trim());
    setActiveProject(id);
    setNewName('');
    setIsCreating(false);
  }, [newName, createProject, setActiveProject]);

  const handleStartEdit = useCallback((project: Project) => {
    setEditingId(project.id);
    setEditName(project.name);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId || !editName.trim()) return;
    updateProject(editingId, { name: editName.trim() });
    setEditingId(null);
    setEditName('');
  }, [editingId, editName, updateProject]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteProject(id);
    },
    [deleteProject]
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Create button */}
      {isCreating ? (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') {
                setIsCreating(false);
                setNewName('');
              }
            }}
            placeholder="Project name..."
            autoFocus
            className="flex-1 rounded-md border border-border/50 bg-background/50 px-2 py-1 text-xs text-foreground outline-none focus:border-primary/50"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="rounded-md p-1 text-green-500 hover:bg-green-500/10 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setIsCreating(false);
              setNewName('');
            }}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border/50 px-2 py-1.5 text-xs text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </button>
      )}

      {/* Project list */}
      {projects.length === 0 ? (
        <div className="py-6 text-center">
          <Folder className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-2 text-xs text-muted-foreground/50">No projects yet</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground/30">
            Create a project to organize your work
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            const isEditing = editingId === project.id;

            return (
              <div
                key={project.id}
                className={cn(
                  'group rounded-lg border p-2 transition-colors cursor-pointer',
                  isActive
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/30 hover:border-border/60 hover:bg-muted/20'
                )}
                onClick={() => setActiveProject(isActive ? null : project.id)}
              >
                <div className="flex items-center justify-between">
                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="flex-1 rounded bg-background/50 px-1.5 py-0.5 text-xs outline-none"
                      />
                      <button onClick={handleSaveEdit} className="p-0.5 text-green-500">
                        <Check className="h-3 w-3" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-0.5 text-muted-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Folder className={cn('h-3.5 w-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                        <span className="text-xs font-medium text-foreground">{project.name}</span>
                      </div>
                      <div
                        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleStartEdit(project)}
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="rounded p-0.5 text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Hashtags */}
                {project.hashtags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {project.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-0.5 rounded-full bg-muted/30 px-1.5 py-0 text-[10px] text-muted-foreground"
                      >
                        <Hash className="h-2 w-2" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Board count */}
                <div className="mt-1 text-[10px] text-muted-foreground/50">
                  {project.boardIds.length} board{project.boardIds.length !== 1 ? 's' : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
