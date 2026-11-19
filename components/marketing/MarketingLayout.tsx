'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, firestoreUser, signOut, loading } = useAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
  };

  // Get user initials for fallback avatar
  const getInitials = () => {
    if (firestoreUser?.name) {
      return firestoreUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a]">
      {/* Navigation - Minimal, black/white only, NO ICONS */}
      <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Logo - Text only */}
          <Link href="/" className="text-xl font-semibold tracking-tight text-white">
            Nova Machine
          </Link>

          {/* Navigation Links - Desktop */}
          <div className="hidden items-center gap-10 md:flex">
            <Link
              href="/#features"
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              Features
            </Link>
            <Link
              href="/gallery"
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              Gallery
            </Link>
          </div>

          {/* CTA Buttons / User Menu */}
          <div className="hidden items-center gap-6 md:flex">
            {!loading && user ? (
              /* User is logged in - show profile dropdown */
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80"
                >
                  {user.photoURL || firestoreUser?.imageUrl ? (
                    <img
                      src={user.photoURL || firestoreUser?.imageUrl}
                      alt="Profile"
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white ring-2 ring-white/10">
                      {getInitials()}
                    </div>
                  )}
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] py-1 shadow-xl">
                    <div className="border-b border-white/10 px-4 py-3">
                      <p className="truncate text-sm font-medium text-white">
                        {firestoreUser?.name || 'User'}
                      </p>
                      <p className="truncate text-xs text-white/40">
                        {user.email}
                      </p>
                    </div>
                    <Link
                      href="/"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/canvas"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      Open Canvas
                    </Link>
                    <div className="border-t border-white/10">
                      <button
                        onClick={handleSignOut}
                        className="block w-full px-4 py-2.5 text-left text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* User not logged in - show sign in/up buttons */
              <>
                <Link
                  href="/sign-in"
                  className="text-sm text-white/60 transition-colors hover:text-white"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle - CSS lines only */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex flex-col gap-1.5 p-2 md:hidden"
            aria-label="Toggle menu"
          >
            <span className={`h-px w-6 bg-white transition-all duration-300 ${mobileMenuOpen ? 'translate-y-[5px] rotate-45' : ''}`} />
            <span className={`h-px w-6 bg-white transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`h-px w-6 bg-white transition-all duration-300 ${mobileMenuOpen ? '-translate-y-[5px] -rotate-45' : ''}`} />
          </button>
        </nav>

        {/* Mobile Menu */}
        <div className={`overflow-hidden transition-all duration-300 md:hidden ${mobileMenuOpen ? 'max-h-96' : 'max-h-0'}`}>
          <div className="border-t border-white/5 bg-[#0a0a0a] px-6 py-8">
            <div className="flex flex-col gap-6">
              <Link
                href="/#features"
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg text-white/80 transition-colors hover:text-white"
              >
                Features
              </Link>
              <Link
                href="/gallery"
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg text-white/80 transition-colors hover:text-white"
              >
                Gallery
              </Link>
              <div className="mt-4 flex flex-col gap-4 border-t border-white/10 pt-6">
                {!loading && user ? (
                  /* User logged in - mobile menu */
                  <>
                    <div className="flex items-center gap-3 pb-2">
                      {user.photoURL || firestoreUser?.imageUrl ? (
                        <img
                          src={user.photoURL || firestoreUser?.imageUrl}
                          alt="Profile"
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-medium text-white">
                          {getInitials()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">
                          {firestoreUser?.name || 'User'}
                        </p>
                        <p className="text-xs text-white/40">{user.email}</p>
                      </div>
                    </div>
                    <Link
                      href="/"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-lg text-white/80 transition-colors hover:text-white"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/canvas"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-full bg-white py-3 text-center text-base font-medium text-black"
                    >
                      Open Canvas
                    </Link>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setMobileMenuOpen(false);
                      }}
                      className="text-lg text-white/60 text-left"
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  /* Not logged in */
                  <>
                    <Link
                      href="/sign-in"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-lg text-white/60"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/sign-up"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-full bg-white py-3 text-center text-base font-medium text-black"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer - Minimal, no icons */}
      <footer className="border-t border-white/5 bg-[#0a0a0a]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-12 md:grid-cols-4">
            {/* Brand */}
            <div className="md:col-span-1">
              <Link href="/" className="text-lg font-semibold text-white">
                Nova Machine
              </Link>
              <p className="mt-4 text-sm leading-relaxed text-white/40">
                AI-powered video generation with visual workflows.
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-white/60">
                Product
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/#features" className="text-sm text-white/40 transition-colors hover:text-white">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/gallery" className="text-sm text-white/40 transition-colors hover:text-white">
                    Gallery
                  </Link>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-white/60">
                Resources
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/docs" className="text-sm text-white/40 transition-colors hover:text-white">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/api" className="text-sm text-white/40 transition-colors hover:text-white">
                    API
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-white/60">
                Legal
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/privacy" className="text-sm text-white/40 transition-colors hover:text-white">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-sm text-white/40 transition-colors hover:text-white">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-16 border-t border-white/5 pt-8 text-center text-xs text-white/30">
            © {new Date().getFullYear()} Nova Machine
          </div>
        </div>
      </footer>
    </div>
  );
}
