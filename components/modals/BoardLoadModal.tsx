'use client';

import { AlertTriangle } from 'lucide-react';
import { useModalStore, useAssetStore, useCanvasStore } from '@/stores';

export function BoardLoadModal() {
  const { boardLoadModal, closeBoardLoadModal } = useModalStore();
  const { boards } = useAssetStore();
  const { setNodes, setEdges, clearSelection } = useCanvasStore();

  const handleLoad = () => {
    if (!boardLoadModal.boardId) return;

    const board = boards.find((b) => b.id === boardLoadModal.boardId);
    if (!board) {
      closeBoardLoadModal();
      return;
    }

    // Clear selection first
    clearSelection();

    // Convert serialized nodes back to NovaNodes
    const restoredNodes = board.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        createdAt: new Date(node.data.createdAt as string),
        updatedAt: new Date(node.data.updatedAt as string),
      },
    }));

    // Load the board
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setNodes(restoredNodes as any);
    setEdges(board.edges);

    closeBoardLoadModal();
  };

  if (!boardLoadModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeBoardLoadModal}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        {/* Warning Icon */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-2 text-center text-lg font-semibold">Load Board</h2>

        {/* Description */}
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Loading <span className="font-medium text-foreground">{boardLoadModal.boardName}</span> will
          replace your current canvas. Any unsaved changes will be lost.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={closeBoardLoadModal}
            className="flex-1 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary/80"
          >
            Cancel
          </button>
          <button
            onClick={handleLoad}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Load Board
          </button>
        </div>
      </div>
    </div>
  );
}
