'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppTopBar } from '@/components/app/AppTopBar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute redirectTo="/sign-in">
      <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0a]">
        <AppTopBar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
