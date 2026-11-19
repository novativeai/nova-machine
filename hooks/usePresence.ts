'use client';

import { useEffect, useCallback, useRef } from 'react';
import {
  doc,
  updateDoc,
  serverTimestamp,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { throttle } from '@/lib/utils';

interface UsePresenceOptions {
  boardId: string | null;
  enabled?: boolean;
}

interface CursorPosition {
  x: number;
  y: number;
}

/**
 * Hook for tracking and updating user presence in collaborative boards
 *
 * Features:
 * - Marks user as online when entering a board
 * - Broadcasts cursor position (throttled)
 * - Heartbeat to keep presence alive
 * - Marks offline on disconnect/unmount
 */
export function usePresence({ boardId, enabled = true }: UsePresenceOptions) {
  const { user, firestoreUser } = useAuth();
  const presenceRef = useRef<ReturnType<typeof doc> | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize presence document
  useEffect(() => {
    if (!boardId || !user || !enabled) {
      presenceRef.current = null;
      isInitializedRef.current = false;
      return;
    }

    const collabId = `${boardId}_${user.uid}`;
    presenceRef.current = doc(db, 'boards', boardId, 'collaborators', collabId);

    // Check if collaborator doc exists, if not this might be the owner on first load
    const initPresence = async () => {
      if (!presenceRef.current) return;

      try {
        const docSnap = await getDoc(presenceRef.current);

        if (docSnap.exists()) {
          // Update existing collaborator
          await updateDoc(presenceRef.current, {
            isOnline: true,
            lastActiveAt: serverTimestamp(),
          });
        } else {
          // Create collaborator doc (for owner or when doc doesn't exist)
          await setDoc(presenceRef.current, {
            id: collabId,
            boardId,
            userId: user.uid,
            displayName:
              firestoreUser?.name ||
              user.displayName ||
              user.email?.split('@')[0] ||
              'User',
            email: user.email || '',
            photoUrl: user.photoURL || firestoreUser?.imageUrl || null,
            role: 'owner', // Will be overwritten if they're actually a collaborator
            isOnline: true,
            lastActiveAt: serverTimestamp(),
            joinedAt: serverTimestamp(),
            invitedBy: user.uid,
            cursorPosition: null,
            selectedNodeIds: [],
          });
        }

        isInitializedRef.current = true;
      } catch (error) {
        console.error('Error initializing presence:', error);
      }
    };

    initPresence();

    // Heartbeat every 30 seconds to keep presence alive
    const heartbeat = setInterval(() => {
      if (presenceRef.current && isInitializedRef.current) {
        updateDoc(presenceRef.current, {
          lastActiveAt: serverTimestamp(),
        }).catch((error) => {
          console.error('Error updating heartbeat:', error);
        });
      }
    }, 30000);

    // Mark offline on unmount
    return () => {
      clearInterval(heartbeat);
      if (presenceRef.current && isInitializedRef.current) {
        updateDoc(presenceRef.current, {
          isOnline: false,
          cursorPosition: null,
        }).catch((error) => {
          console.error('Error marking offline on unmount:', error);
        });
      }
      isInitializedRef.current = false;
    };
  }, [boardId, user, firestoreUser, enabled]);

  // Handle page visibility change
  useEffect(() => {
    if (!presenceRef.current || !enabled) return;

    const handleVisibilityChange = () => {
      if (presenceRef.current && isInitializedRef.current) {
        updateDoc(presenceRef.current, {
          isOnline: document.visibilityState === 'visible',
          lastActiveAt: serverTimestamp(),
        }).catch((error) => {
          console.error('Error updating visibility state:', error);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled]);

  // Handle network online/offline events
  useEffect(() => {
    if (!presenceRef.current || !enabled) return;

    const handleOnline = () => {
      if (presenceRef.current && isInitializedRef.current) {
        updateDoc(presenceRef.current, {
          isOnline: true,
          lastActiveAt: serverTimestamp(),
        }).catch((error) => {
          console.error('Error updating online state:', error);
        });
      }
    };

    const handleOffline = () => {
      if (presenceRef.current && isInitializedRef.current) {
        updateDoc(presenceRef.current, {
          isOnline: false,
          cursorPosition: null,
        }).catch((error) => {
          console.error('Error updating offline state:', error);
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled]);

  // Handle beforeunload - mark offline when user leaves
  useEffect(() => {
    if (!boardId || !user || !enabled) return;

    const handleBeforeUnload = () => {
      if (!presenceRef.current || !isInitializedRef.current) return;

      const collabId = `${boardId}_${user.uid}`;

      // Use sendBeacon with cached token (no async calls during unload)
      // This is fire-and-forget and will complete even as page unloads
      if (navigator.sendBeacon) {
        // Get cached token (don't await - use whatever is available)
        user.getIdToken().then((token) => {
          const blob = new Blob(
            [
              JSON.stringify({
                boardId,
                collabId,
                token,
              }),
            ],
            { type: 'application/json' }
          );
          navigator.sendBeacon('/api/presence/offline', blob);
        }).catch(() => {
          // If token fetch fails, still try direct Firestore update
          if (presenceRef.current) {
            updateDoc(presenceRef.current, {
              isOnline: false,
              cursorPosition: null,
            }).catch(() => {});
          }
        });
      } else {
        // Fallback: try direct update (may not complete during unload)
        if (presenceRef.current) {
          updateDoc(presenceRef.current, {
            isOnline: false,
            cursorPosition: null,
          }).catch(() => {});
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [boardId, user, enabled]);

  // Throttled cursor update (max 20 updates per second = 50ms throttle)
  const updateCursorThrottled = useRef(
    throttle((position: CursorPosition) => {
      if (presenceRef.current && isInitializedRef.current) {
        updateDoc(presenceRef.current, {
          cursorPosition: position,
          lastActiveAt: serverTimestamp(),
        }).catch((error) => {
          console.error('Error updating cursor position:', error);
        });
      }
    }, 50)
  );

  // Cleanup throttle on unmount
  useEffect(() => {
    const throttledFn = updateCursorThrottled.current;
    return () => {
      throttledFn.cancel();
    };
  }, []);

  const updateCursor = useCallback((position: CursorPosition) => {
    updateCursorThrottled.current(position);
  }, []);

  // Update selected nodes (not throttled as selection changes are less frequent)
  const updateSelectedNodes = useCallback((nodeIds: string[]) => {
    if (presenceRef.current && isInitializedRef.current) {
      updateDoc(presenceRef.current, {
        selectedNodeIds: nodeIds,
        lastActiveAt: serverTimestamp(),
      }).catch((error) => {
        console.error('Error updating selected nodes:', error);
      });
    }
  }, []);

  return {
    updateCursor,
    updateSelectedNodes,
  };
}
