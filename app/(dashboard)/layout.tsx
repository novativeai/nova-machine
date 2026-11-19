'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ApiKeyButton } from '@/components/app/ApiKeyButton';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/boards', label: 'Boards' },
  { href: '/dashboard/history', label: 'History' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, firestoreUser, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    // Clear any pending invite tokens on sign out
    sessionStorage.removeItem('pendingInviteToken');
    router.push('/sign-in');
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
        {/* Sidebar */}
        <aside className="flex w-64 flex-col border-r border-white/5 bg-[#050505]">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-white/5 px-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/5">
              <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>
            <span className="text-lg font-semibold text-white">Nova Machine</span>
          </div>

          {/* Own fal.ai API key */}
          <div className="border-b border-white/5 p-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <span className="text-sm text-white/50">Your fal.ai API key</span>
              <div className="mt-3">
                <ApiKeyButton variant="pill" align="left" />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                Stored only in this browser and sent only to fal.ai.
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-black'
                      : 'text-white/50 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="border-t border-white/5 p-4">
            <div className="flex items-center gap-3 rounded-lg px-4 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-sm font-medium text-white">
                {user?.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-white">
                  {firestoreUser?.name || 'User'}
                </p>
                <p className="truncate text-xs text-white/40">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="mt-2 flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
