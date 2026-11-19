'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getUserBoards, getUserGenerations, type Board, type Generation } from '@/lib/firestore';
import Link from 'next/link';
import { ApiKeyButton } from '@/components/app/ApiKeyButton';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  const { user, firestoreUser } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      const [boardsData, generationsData] = await Promise.all([
        getUserBoards(user.uid),
        getUserGenerations(user.uid, 5),
      ]);

      setBoards(boardsData.slice(0, 6));
      setGenerations(generationsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0a]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-[#0a0a0a] p-8">
      <div className="mx-auto max-w-6xl space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Welcome back{firestoreUser?.name ? `, ${firestoreUser.name}` : ''}
          </h1>
          <p className="mt-2 text-white/40">
            Here&apos;s what&apos;s happening with your projects
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-4 md:grid-cols-3"
        >
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-sm text-white/40">Total Boards</p>
            <p className="mt-2 text-3xl font-semibold text-white">{boards.length}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-sm text-white/40">Generations</p>
            <p className="mt-2 text-3xl font-semibold text-white">{generations.length}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-sm text-white/40">fal.ai API key</p>
            <div className="mt-3">
              <ApiKeyButton variant="pill" align="left" />
            </div>
            <p className="mt-3 text-[11px] text-white/35">Generations bill your own fal.ai account.</p>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid gap-4 md:grid-cols-2"
        >
          <Link
            href="/canvas"
            className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-8 transition-all hover:border-white/20 hover:bg-white/[0.04]"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/5">
              <span className="text-lg text-white">+</span>
            </div>
            <h3 className="text-xl font-semibold text-white">Create New Project</h3>
            <p className="mt-2 text-sm text-white/40">
              Start with a blank canvas and create something amazing
            </p>
            <span className="mt-4 inline-block text-sm text-white/50 transition-colors group-hover:text-white">
              Get started →
            </span>
          </Link>

          <Link
            href="/dashboard/boards"
            className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-8 transition-all hover:border-white/20 hover:bg-white/[0.04]"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/5">
              <div className="grid grid-cols-2 gap-0.5">
                <div className="h-1.5 w-1.5 rounded-sm bg-white/60" />
                <div className="h-1.5 w-1.5 rounded-sm bg-white/60" />
                <div className="h-1.5 w-1.5 rounded-sm bg-white/60" />
                <div className="h-1.5 w-1.5 rounded-sm bg-white/60" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-white">Browse Templates</h3>
            <p className="mt-2 text-sm text-white/40">
              Start from a pre-made template to speed up your workflow
            </p>
            <span className="mt-4 inline-block text-sm text-white/50 transition-colors group-hover:text-white">
              View templates →
            </span>
          </Link>
        </motion.div>

        {/* Recent Boards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Recent Boards</h2>
            <Link
              href="/dashboard/boards"
              className="text-sm text-white/40 transition-colors hover:text-white"
            >
              View all →
            </Link>
          </div>

          {boards.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/canvas?boardId=${board.id}`}
                  className="group rounded-xl border border-white/10 bg-white/[0.02] transition-all hover:border-white/20 hover:bg-white/[0.04]"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video overflow-hidden rounded-t-xl bg-white/[0.02]">
                    {board.thumbnail ? (
                      <img
                        src={board.thumbnail}
                        alt={board.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="h-6 w-6 rounded border border-white/20" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-white">{board.name}</h3>
                    {board.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-white/40">
                        {board.description}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-white/30">
                      Updated{' '}
                      {board.updatedAt
                        ? formatDistanceToNow(board.updatedAt.toDate(), { addSuffix: true })
                        : 'recently'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/5">
                <div className="h-4 w-4 rounded border border-white/30" />
              </div>
              <h3 className="font-medium text-white">No boards yet</h3>
              <p className="mt-2 text-sm text-white/40">
                Create your first board to get started
              </p>
              <Link
                href="/canvas"
                className="mt-4 inline-block rounded-full bg-white px-6 py-2 text-sm font-medium text-black transition-all hover:opacity-90"
              >
                Create Board
              </Link>
            </div>
          )}
        </motion.div>

        {/* Recent Generations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Recent Generations</h2>
            <Link
              href="/dashboard/history"
              className="text-sm text-white/40 transition-colors hover:text-white"
            >
              View all →
            </Link>
          </div>

          {generations.length > 0 ? (
            <div className="space-y-3">
              {generations.map((gen) => (
                <div
                  key={gen.id}
                  className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4"
                >
                  {/* Thumbnail */}
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-white/[0.02]">
                    {gen.thumbnailUrl ? (
                      <img
                        src={gen.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="h-4 w-4 rounded border border-white/20" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-white">{gen.prompt}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                      <span className="capitalize">{gen.type}</span>
                      <span className="h-1 w-1 rounded-full bg-white/20" />
                      {typeof gen.cost === 'number' && (
                        <>
                          <span title="Estimated cost on your fal.ai account">~${gen.cost.toFixed(2)} on fal.ai</span>
                          <span className="h-1 w-1 rounded-full bg-white/20" />
                        </>
                      )}
                      <span>
                        {gen.createdAt
                          ? formatDistanceToNow(gen.createdAt.toDate(), { addSuffix: true })
                          : 'recently'}
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                        gen.status === 'completed'
                          ? 'bg-white/10 text-white'
                          : gen.status === 'failed'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-white/5 text-white/50'
                      }`}
                    >
                      {gen.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/5">
                <div className="h-4 w-6 rounded border border-white/30" />
              </div>
              <h3 className="font-medium text-white">No generations yet</h3>
              <p className="mt-2 text-sm text-white/40">
                Create your first AI generation to see it here
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
