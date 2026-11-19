import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createBoard, getUserAccessibleBoards } from '@/lib/firestore';
import { useCanvasStore, useAssetStore } from '@/stores';

/**
 * Auto-creates first board if user doesn't have one
 * Ensures there's always an active board for collaboration
 * 
 * PERFORMANCE: Only runs once on mount, not on every canvas change.
 * Does not depend on nodes/edges to avoid O(n) Firestore queries.
 */
export function useAutoBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, firestoreUser } = useAuth();
  const { nodes, edges } = useCanvasStore();
  const { saveBoard } = useAssetStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (isRunningRef.current) return;
    
    async function initializeBoard() {
      if (!user || !firestoreUser) {
        setIsInitializing(false);
        return;
      }

      // Check if already on a board
      const boardId = searchParams.get('boardId');
      if (boardId) {
        setIsInitializing(false);
        return;
      }

      // Prevent duplicate runs
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      try {
        // Check if user has any boards
        const userBoards = await getUserAccessibleBoards(user.uid);

        if (userBoards.length === 0) {
          // Create first board
          console.log('[Auto-Board] Creating first board...');

          const boardName = 'My First Board';
          const newBoardId = await createBoard(user.uid, {
            name: boardName,
            description: 'Get started with Nova Machine!',
            nodes: JSON.stringify(nodes),
            edges: JSON.stringify(edges),
            isPublic: false,
            tags: [],
            ownerId: user.uid,
            collaboratorIds: [],
            visibility: 'private',
            nodeCount: nodes.length,
          });

          console.log('[Auto-Board] First board created:', newBoardId);

          // Also save to local asset store
          saveBoard(boardName, nodes, edges);
          console.log('[Auto-Board] Board saved to asset store');

          // Redirect to the new board
          router.replace(`/canvas?boardId=${newBoardId}`);
        } else {
          // User has boards but not viewing one - load most recent
          const mostRecentBoard = userBoards[0];
          console.log('[Auto-Board] Loading most recent board:', mostRecentBoard.id);
          router.replace(`/canvas?boardId=${mostRecentBoard.id}`);
        }
      } catch (error) {
        console.error('[Auto-Board] Error initializing board:', error);
        isRunningRef.current = false;
      } finally {
        setIsInitializing(false);
      }
    }

    initializeBoard();
    // Only run once on mount when user/firestoreUser are ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, firestoreUser?.uid]);

  return { isInitializing };
}
