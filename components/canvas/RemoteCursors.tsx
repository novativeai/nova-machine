'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { BoardCollaborator } from '@/lib/firestore';

interface RemoteCursorsProps {
  boardId: string;
}

const CURSOR_COLORS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

// Stale timeout - 2 minutes (120000ms)
const STALE_TIMEOUT_MS = 2 * 60 * 1000;

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

/**
 * Check if a cursor is stale based on lastActiveAt timestamp
 */
function isCursorStale(lastActiveAt: Timestamp | null | undefined): boolean {
  if (!lastActiveAt) return true;

  const now = Date.now();
  const lastActiveTime = lastActiveAt.toMillis();
  return now - lastActiveTime > STALE_TIMEOUT_MS;
}

export default function RemoteCursors({ boardId }: RemoteCursorsProps) {
  const { user } = useAuth();
  const [remoteCursors, setRemoteCursors] = useState<Map<string, BoardCollaborator>>(new Map());
  const cursorsMapRef = useRef<Map<string, BoardCollaborator>>(new Map());

  useEffect(() => {
    if (!boardId || !user) return;

    const q = query(
      collection(db, 'boards', boardId, 'collaborators'),
      where('isOnline', '==', true)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newCursorsMap = new Map(cursorsMapRef.current);
        let hasChanges = false;

        snapshot.docChanges().forEach((change) => {
          const collaborator = {
            ...change.doc.data(),
            id: change.doc.id,
          } as BoardCollaborator;

          // Skip current user
          if (collaborator.userId === user?.uid) return;

          // Skip if no cursor position
          if (!collaborator.cursorPosition) {
            if (newCursorsMap.has(collaborator.userId)) {
              newCursorsMap.delete(collaborator.userId);
              hasChanges = true;
            }
            return;
          }

          // Check if cursor is stale (handles browser crashes, network issues)
          if (isCursorStale(collaborator.lastActiveAt as Timestamp | null | undefined)) {
            if (newCursorsMap.has(collaborator.userId)) {
              newCursorsMap.delete(collaborator.userId);
              hasChanges = true;
            }
            return;
          }

          if (change.type === 'removed') {
            if (newCursorsMap.has(collaborator.userId)) {
              newCursorsMap.delete(collaborator.userId);
              hasChanges = true;
            }
          } else {
            // Added or modified
            const existingCursor = newCursorsMap.get(collaborator.userId);

            // Only update if cursor actually changed
            if (
              !existingCursor ||
              existingCursor.cursorPosition?.x !== collaborator.cursorPosition?.x ||
              existingCursor.cursorPosition?.y !== collaborator.cursorPosition?.y ||
              existingCursor.displayName !== collaborator.displayName
            ) {
              newCursorsMap.set(collaborator.userId, collaborator);
              hasChanges = true;
            }
          }
        });

        // Only trigger re-render if there were actual changes
        if (hasChanges) {
          cursorsMapRef.current = newCursorsMap;
          setRemoteCursors(new Map(newCursorsMap));
        }
      },
      (error) => {
        console.error('Error listening to remote cursors:', error);
        // Clear cursors on error to prevent showing stale data
        if (cursorsMapRef.current.size > 0) {
          cursorsMapRef.current.clear();
          setRemoteCursors(new Map());
        }
      }
    );

    // Periodic cleanup of stale cursors (every 30 seconds)
    const cleanupInterval = setInterval(() => {
      const newCursorsMap = new Map(cursorsMapRef.current);
      let hasChanges = false;

      for (const [userId, cursor] of newCursorsMap.entries()) {
        if (isCursorStale(cursor.lastActiveAt as Timestamp | null | undefined)) {
          newCursorsMap.delete(userId);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        cursorsMapRef.current = newCursorsMap;
        setRemoteCursors(new Map(newCursorsMap));
      }
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(cleanupInterval);
    };
  }, [boardId, user]);

  if (remoteCursors.size === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {Array.from(remoteCursors.values()).map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute transition-all duration-75 ease-out"
          style={{
            left: cursor.cursorPosition?.x ?? 0,
            top: cursor.cursorPosition?.y ?? 0,
            transform: 'translate(-2px, -2px)',
          }}
        >
          {/* Cursor SVG */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={getUserColor(cursor.userId)}
            className="drop-shadow-md"
          >
            <path d="M5.65 2.95L19.65 12.2L12.85 13.45L9.4 19.85L5.65 2.95Z" />
          </svg>

          {/* Name label */}
          <div
            className="ml-5 -mt-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-lg"
            style={{ backgroundColor: getUserColor(cursor.userId) }}
          >
            {cursor.displayName.split(' ')[0]}
          </div>
        </div>
      ))}
    </div>
  );
}
