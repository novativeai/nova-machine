import { create } from 'zustand';
import type { FileRoleModalState } from '@/types';

export interface MediaViewerState {
  isOpen: boolean;
  type: 'video' | 'image';
  url: string;
  title?: string;
  downloadFileName?: string;
}

export interface OpenMediaViewerOptions {
  type: 'video' | 'image';
  url: string;
  title?: string;
  downloadFileName?: string;
}

export interface ElementConfigModalState {
  isOpen: boolean;
  position: { x: number; y: number };
}

export interface BoardLoadModalState {
  isOpen: boolean;
  boardId: string | null;
  boardName: string;
}

export interface ShareModalState {
  isOpen: boolean;
  boardId: string | null;
  boardName: string;
}

interface ModalState {
  // File Role Modal
  fileRoleModal: FileRoleModalState;
  openFileRoleModal: (
    file: File,
    fileType: 'image' | 'video',
    dropPosition: { x: number; y: number },
    targetNodeId?: string
  ) => void;
  closeFileRoleModal: () => void;
  setFileRoleModalPreview: (previewUrl: string) => void;

  // Generation Progress Modal
  generationModal: {
    isOpen: boolean;
    promptNodeId: string | null;
  };
  openGenerationModal: (promptNodeId: string) => void;
  closeGenerationModal: () => void;

  // Media Viewer Modal
  mediaViewer: MediaViewerState;
  openMediaViewer: (options: OpenMediaViewerOptions) => void;
  closeMediaViewer: () => void;

  // Element Config Modal
  elementConfigModal: ElementConfigModalState;
  openElementConfigModal: (position: { x: number; y: number }) => void;
  closeElementConfigModal: () => void;

  // Board Load Modal
  boardLoadModal: BoardLoadModalState;
  openBoardLoadModal: (boardId: string, boardName: string) => void;
  closeBoardLoadModal: () => void;

  // Share Modal
  shareModal: ShareModalState;
  openShareModal: (boardId: string, boardName: string) => void;
  closeShareModal: () => void;
}

const initialFileRoleModal: FileRoleModalState = {
  isOpen: false,
  file: null,
  fileType: 'image',
  previewUrl: '',
  dropPosition: { x: 0, y: 0 },
  targetNodeId: undefined,
};

export const useModalStore = create<ModalState>((set) => ({
  // File Role Modal
  fileRoleModal: initialFileRoleModal,

  openFileRoleModal: (file, fileType, dropPosition, targetNodeId) => {
    const previewUrl = URL.createObjectURL(file);
    set((state) => {
      // Revoke any existing preview URL before creating a new one
      if (state.fileRoleModal.previewUrl) {
        URL.revokeObjectURL(state.fileRoleModal.previewUrl);
      }
      return {
        fileRoleModal: {
          isOpen: true,
          file,
          fileType,
          previewUrl,
          dropPosition,
          targetNodeId,
        },
      };
    });
  },

  closeFileRoleModal: () => {
    set((state) => {
      // Revoke the preview URL to free memory
      if (state.fileRoleModal.previewUrl) {
        URL.revokeObjectURL(state.fileRoleModal.previewUrl);
      }
      return { fileRoleModal: initialFileRoleModal };
    });
  },

  setFileRoleModalPreview: (previewUrl) => {
    set((state) => ({
      fileRoleModal: { ...state.fileRoleModal, previewUrl },
    }));
  },

  // Generation Progress Modal
  generationModal: {
    isOpen: false,
    promptNodeId: null,
  },

  openGenerationModal: (promptNodeId) => {
    set({
      generationModal: {
        isOpen: true,
        promptNodeId,
      },
    });
  },

  closeGenerationModal: () => {
    set({
      generationModal: {
        isOpen: false,
        promptNodeId: null,
      },
    });
  },

  // Media Viewer Modal
  mediaViewer: {
    isOpen: false,
    type: 'video',
    url: '',
    title: undefined,
    downloadFileName: undefined,
  },

  openMediaViewer: (options) => {
    set({
      mediaViewer: {
        isOpen: true,
        type: options.type,
        url: options.url,
        title: options.title,
        downloadFileName: options.downloadFileName,
      },
    });
  },

  closeMediaViewer: () => {
    set({
      mediaViewer: {
        isOpen: false,
        type: 'video',
        url: '',
        title: undefined,
        downloadFileName: undefined,
      },
    });
  },

  // Element Config Modal
  elementConfigModal: {
    isOpen: false,
    position: { x: 0, y: 0 },
  },

  openElementConfigModal: (position) => {
    set({
      elementConfigModal: {
        isOpen: true,
        position,
      },
    });
  },

  closeElementConfigModal: () => {
    set({
      elementConfigModal: {
        isOpen: false,
        position: { x: 0, y: 0 },
      },
    });
  },

  // Board Load Modal
  boardLoadModal: {
    isOpen: false,
    boardId: null,
    boardName: '',
  },

  openBoardLoadModal: (boardId, boardName) => {
    set({
      boardLoadModal: {
        isOpen: true,
        boardId,
        boardName,
      },
    });
  },

  closeBoardLoadModal: () => {
    set({
      boardLoadModal: {
        isOpen: false,
        boardId: null,
        boardName: '',
      },
    });
  },

  // Share Modal
  shareModal: {
    isOpen: false,
    boardId: null,
    boardName: '',
  },

  openShareModal: (boardId, boardName) => {
    set({
      shareModal: {
        isOpen: true,
        boardId,
        boardName,
      },
    });
  },

  closeShareModal: () => {
    set({
      shareModal: {
        isOpen: false,
        boardId: null,
        boardName: '',
      },
    });
  },
}));
