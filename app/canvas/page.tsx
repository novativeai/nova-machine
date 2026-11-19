'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { NovaCanvas } from '@/components/canvas/NovaCanvas';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { AssetSidebar } from '@/components/sidebar/AssetSidebar';
import { Header } from '@/components/layout/Header';
import { FloatingToolbar } from '@/components/canvas/FloatingToolbar';
import { FileRoleModal } from '@/components/modals/FileRoleModal';
import { MediaViewer } from '@/components/modals/MediaViewer';
import { ElementConfigModal } from '@/components/modals/ElementConfigModal';
import { BoardLoadModal } from '@/components/modals/BoardLoadModal';
import { ShareModal } from '@/components/modals/ShareModal';
import RemoteCursors from '@/components/canvas/RemoteCursors';
import { CommandBar } from '@/components/ai/CommandBar';
import { HashtagFilter } from '@/components/canvas/HashtagFilter';
import { ReactFlowProvider } from '@xyflow/react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useModalStore } from '@/stores';
import { usePresence, useAutoBoard } from '@/hooks';

function CanvasContent() {
  const searchParams = useSearchParams();
  const boardId = searchParams.get('boardId');
  const { shareModal, closeShareModal } = useModalStore();

  // Auto-create first board if user doesn't have one
  const { isInitializing } = useAutoBoard();

  // Initialize presence tracking for collaborative boards
  const { updateCursor } = usePresence({ boardId, enabled: !!boardId });

  // Show loading state while initializing board
  if (isInitializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Setting up your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="relative flex-1">
          <FloatingToolbar />
          <AssetSidebar />
          <NovaCanvas updateCursor={updateCursor} />
          {/* Remote cursors overlay for collaboration */}
          {boardId && <RemoteCursors boardId={boardId} />}
        </main>
      </div>
      {/* AI Overlays */}
      <CommandBar />
      <HashtagFilter />

      {/* Modals */}
      <FileRoleModal />
      <MediaViewer />
      <ElementConfigModal />
      <BoardLoadModal />
      {/* Share Modal for collaboration */}
      {shareModal.boardId && (
        <ShareModal
          isOpen={shareModal.isOpen}
          onClose={closeShareModal}
          boardId={shareModal.boardId}
          boardName={shareModal.boardName}
        />
      )}
    </div>
  );
}

export default function CanvasPage() {
  return (
    <ProtectedRoute>
      <ReactFlowProvider>
        <Suspense fallback={
          <div className="flex h-screen w-screen items-center justify-center bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        }>
          <CanvasContent />
        </Suspense>
      </ReactFlowProvider>
    </ProtectedRoute>
  );
}
