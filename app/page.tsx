'use client';

import { NovaCanvas } from '@/components/canvas/NovaCanvas';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { Header } from '@/components/layout/Header';
import { FileRoleModal } from '@/components/modals/FileRoleModal';
import { MediaViewer } from '@/components/modals/MediaViewer';
import { ElementConfigModal } from '@/components/modals/ElementConfigModal';
import { ReactFlowProvider } from '@xyflow/react';

export default function Home() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 relative">
            <NovaCanvas />
          </main>
        </div>
        <FileRoleModal />
        <MediaViewer />
        <ElementConfigModal />
      </div>
    </ReactFlowProvider>
  );
}
