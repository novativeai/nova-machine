import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FileBrowserState {
  viewMode: 'grid' | 'list';
  sortBy: 'updatedAt' | 'name' | 'createdAt';
  sortDirection: 'asc' | 'desc';
  searchQuery: string;
  selectedBoardIds: string[];
  activeSection: 'recent' | 'drafts' | 'shared';
  renamingBoardId: string | null;

  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sort: 'updatedAt' | 'name' | 'createdAt') => void;
  toggleSortDirection: () => void;
  setSearchQuery: (query: string) => void;
  setActiveSection: (section: 'recent' | 'drafts' | 'shared') => void;
  toggleBoardSelection: (id: string) => void;
  selectBoard: (id: string) => void;
  clearSelection: () => void;
  setRenamingBoardId: (id: string | null) => void;
}

export const useFileBrowserStore = create<FileBrowserState>()(
  persist(
    (set) => ({
      viewMode: 'grid',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      searchQuery: '',
      selectedBoardIds: [],
      activeSection: 'recent',
      renamingBoardId: null,

      setViewMode: (mode) => set({ viewMode: mode }),
      setSortBy: (sortBy) => set({ sortBy }),
      toggleSortDirection: () =>
        set((state) => ({
          sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc',
        })),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setActiveSection: (activeSection) => set({ activeSection }),
      toggleBoardSelection: (id) =>
        set((state) => ({
          selectedBoardIds: state.selectedBoardIds.includes(id)
            ? state.selectedBoardIds.filter((bid) => bid !== id)
            : [...state.selectedBoardIds, id],
        })),
      selectBoard: (id) => set({ selectedBoardIds: [id] }),
      clearSelection: () => set({ selectedBoardIds: [] }),
      setRenamingBoardId: (id) => set({ renamingBoardId: id }),
    }),
    {
      name: 'nova-file-browser',
      partialize: (state) => ({
        viewMode: state.viewMode,
        sortBy: state.sortBy,
        sortDirection: state.sortDirection,
        activeSection: state.activeSection,
      }),
      skipHydration: typeof window === 'undefined',
    }
  )
);
