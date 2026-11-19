import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { Project } from '@/types';

// ============================================================================
// PROJECT STORE
// ============================================================================

interface ProjectState {
  /** All projects */
  projects: Project[];
  /** Currently active project (scopes canvas work) */
  activeProjectId: string | null;
  /** Active hashtag filters for canvas node visibility */
  activeHashtagFilters: string[];

  // Project CRUD
  createProject: (name: string, description?: string) => string;
  updateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
  setActiveProject: (id: string | null) => void;

  // Board association
  addBoardToProject: (projectId: string, boardId: string) => void;
  removeBoardFromProject: (projectId: string, boardId: string) => void;

  // Hashtag operations on projects
  addHashtagToProject: (projectId: string, tag: string) => void;
  removeHashtagFromProject: (projectId: string, tag: string) => void;
  /** Union of all hashtags across all projects */
  getAllHashtags: () => string[];

  // Canvas filtering
  setHashtagFilters: (tags: string[]) => void;
  toggleHashtagFilter: (tag: string) => void;
  clearHashtagFilters: () => void;
  isFilterActive: () => boolean;
}

const PROJECT_STORAGE_KEY = 'nova-projects';

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      activeHashtagFilters: [],

      // ================================================================
      // Project CRUD
      // ================================================================

      createProject: (name, description = '') => {
        const id = nanoid();
        const now = new Date().toISOString();
        const project: Project = {
          id,
          name,
          description,
          hashtags: [],
          boardIds: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          projects: [project, ...state.projects],
        }));
        return id;
      },

      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        }));
      },

      getProject: (id) => {
        return get().projects.find((p) => p.id === id);
      },

      setActiveProject: (id) => {
        set({ activeProjectId: id });
      },

      // ================================================================
      // Board association
      // ================================================================

      addBoardToProject: (projectId, boardId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId && !p.boardIds.includes(boardId)
              ? { ...p, boardIds: [...p.boardIds, boardId], updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      removeBoardFromProject: (projectId, boardId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, boardIds: p.boardIds.filter((id) => id !== boardId), updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      // ================================================================
      // Hashtag operations on projects
      // ================================================================

      addHashtagToProject: (projectId, tag) => {
        const normalizedTag = tag.toLowerCase().replace(/^#/, '').trim();
        if (!normalizedTag) return;
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId && !p.hashtags.includes(normalizedTag)
              ? { ...p, hashtags: [...p.hashtags, normalizedTag], updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      removeHashtagFromProject: (projectId, tag) => {
        const normalizedTag = tag.toLowerCase().replace(/^#/, '').trim();
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, hashtags: p.hashtags.filter((t) => t !== normalizedTag), updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      getAllHashtags: () => {
        const { projects } = get();
        const allTags = new Set<string>();
        for (const project of projects) {
          for (const tag of project.hashtags) {
            allTags.add(tag);
          }
        }
        return Array.from(allTags).sort();
      },

      // ================================================================
      // Canvas filtering
      // ================================================================

      setHashtagFilters: (tags) => {
        set({ activeHashtagFilters: tags });
      },

      toggleHashtagFilter: (tag) => {
        const normalizedTag = tag.toLowerCase().replace(/^#/, '').trim();
        set((state) => {
          const exists = state.activeHashtagFilters.includes(normalizedTag);
          return {
            activeHashtagFilters: exists
              ? state.activeHashtagFilters.filter((t) => t !== normalizedTag)
              : [...state.activeHashtagFilters, normalizedTag],
          };
        });
      },

      clearHashtagFilters: () => {
        set({ activeHashtagFilters: [] });
      },

      isFilterActive: () => {
        return get().activeHashtagFilters.length > 0;
      },
    }),
    {
      name: PROJECT_STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        return localStorage;
      }),
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        // Don't persist filters - they're transient UI state
      }),
      skipHydration: typeof window === 'undefined',
    }
  )
);
