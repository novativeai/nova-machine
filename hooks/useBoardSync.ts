'use client';

import { useEffect, useCallback, useRef, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  getDocs,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCanvasStore } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';
import type { NovaNode, NovaEdge } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseBoardSyncOptions {
  boardId: string | null;
  enabled?: boolean;
}

interface NodeDocument {
  id: string;
  type: string;
  position: { x: number; y: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  lastModifiedBy: string;
  lastModifiedAt: Timestamp | ReturnType<typeof serverTimestamp>;
  version: number;
}

interface EdgeDocument {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  lastModifiedBy: string;
  lastModifiedAt: Timestamp | ReturnType<typeof serverTimestamp>;
  version: number;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Custom debounce implementation with cancel support
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = function executedFunction(...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

// ============================================================================
// HOOK
// ============================================================================

export function useBoardSync({ boardId, enabled = true }: UseBoardSyncOptions) {
  const { user } = useAuth();
  const { setNodes, setEdges, addNode, updateNode, removeNode } = useCanvasStore();
  const isInitialSync = useRef(true);
  const localChanges = useRef<Set<string>>(new Set());
  const unsubscribers = useRef<Array<() => void>>([]);

  // ============================================================================
  // SUBSCRIBE TO NODES COLLECTION
  // ============================================================================

  useEffect(() => {
    if (!boardId || !enabled || !user) {
      isInitialSync.current = true;
      return;
    }

    const nodesRef = collection(db, 'boards', boardId, 'nodes');

    const unsubscribe = onSnapshot(
      nodesRef,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const nodeData = change.doc.data() as NodeDocument;
          const nodeId = change.doc.id;

          // Skip if this is our own local change
          if (localChanges.current.has(nodeId)) {
            localChanges.current.delete(nodeId);
            return;
          }

          // Skip local pending writes
          if (change.doc.metadata.hasPendingWrites) return;

          const novaNode = {
            id: nodeData.id,
            type: nodeData.type as NovaNode['type'],
            position: nodeData.position,
            data: nodeData.data,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any as NovaNode;

          switch (change.type) {
            case 'added':
              if (!isInitialSync.current) {
                // Only add if not already exists
                const exists = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
                if (!exists) {
                  // Populate cache
                  nodeIdToDocId.current.set(nodeData.id, change.doc.id);
                  addNode(novaNode);
                }
              }
              break;
            case 'modified':
              updateNode(nodeId, nodeData.data);
              // Also update position if changed
              useCanvasStore.setState((state) => ({
                nodes: state.nodes.map((n) =>
                  n.id === nodeId
                    ? { ...n, position: nodeData.position, data: nodeData.data }
                    : n
                ),
              }));
              break;
            case 'removed':
              removeNode(nodeId);
              break;
          }
        });

        // On initial sync, set all nodes
        if (isInitialSync.current && snapshot.docs.length > 0) {
          const allNodes = snapshot.docs.map((doc) => {
            const data = doc.data() as NodeDocument;
            // Populate the nodeId -> docId cache
            nodeIdToDocId.current.set(data.id, doc.id);
            return {
              id: data.id,
              type: data.type,
              position: data.position,
              data: data.data,
            } as NovaNode;
          });
          setNodes(allNodes);
          isInitialSync.current = false;
        } else if (isInitialSync.current && snapshot.docs.length === 0) {
          // Empty board
          isInitialSync.current = false;
        }
      },
      (error) => {
        console.error('Error syncing nodes:', error);
      }
    );

    unsubscribers.current.push(unsubscribe);

    return () => {
      unsubscribe();
      isInitialSync.current = true;
    };
  }, [boardId, enabled, user, addNode, updateNode, removeNode, setNodes]);

  // ============================================================================
  // SUBSCRIBE TO EDGES COLLECTION
  // ============================================================================

  useEffect(() => {
    if (!boardId || !enabled || !user) return;

    const edgesRef = collection(db, 'boards', boardId, 'edges');

    const unsubscribe = onSnapshot(
      edgesRef,
      (snapshot) => {
        if (snapshot.docChanges().length > 0) {
          const allEdges = snapshot.docs.map((doc) => {
            const data = doc.data() as EdgeDocument;
            return {
              id: data.id,
              source: data.source,
              target: data.target,
              sourceHandle: data.sourceHandle,
              targetHandle: data.targetHandle,
              type: data.type,
              data: data.data,
            } as NovaEdge;
          });
          setEdges(allEdges);
        }
      },
      (error) => {
        console.error('Error syncing edges:', error);
      }
    );

    unsubscribers.current.push(unsubscribe);

    return () => unsubscribe();
  }, [boardId, enabled, user, setEdges]);

  // ============================================================================
  // DEBOUNCED SYNC FUNCTION FOR NODE UPDATES
  // ============================================================================

  // Cache: nodeId -> firestoreDocId
  const nodeIdToDocId = useRef<Map<string, string>>(new Map());

  const syncNode = useMemo(
    () =>
      debounce(async (nodeId: string, updates: Partial<NovaNode>) => {
        if (!boardId || !user) return;

        localChanges.current.add(nodeId);

        try {
          const nodesRef = collection(db, 'boards', boardId, 'nodes');
          
          // Try to find cached doc ID
          const docId = nodeIdToDocId.current.get(nodeId);
          
          if (docId) {
            // Use cached doc ID
            const docRef = doc(nodesRef, docId);
            await updateDoc(docRef, {
              ...updates,
              lastModifiedBy: user.uid,
              lastModifiedAt: serverTimestamp(),
            });
          } else {
            // Fallback: query to find doc (only happens once per node)
            const snapshot = await getDocs(query(nodesRef));
            const nodeDoc = snapshot.docs.find((d) => d.data().id === nodeId);
            
            if (nodeDoc) {
              nodeIdToDocId.current.set(nodeId, nodeDoc.id);
              await updateDoc(nodeDoc.ref, {
                ...updates,
                lastModifiedBy: user.uid,
                lastModifiedAt: serverTimestamp(),
              });
            }
          }
        } catch (error) {
          console.error('Error syncing node:', error);
          localChanges.current.delete(nodeId);
        }
      }, 300),
    [boardId, user]
  );

  // ============================================================================
  // SYNC NODE POSITION (FOR DRAGGING)
  // ============================================================================

  const syncNodePosition = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      syncNode(nodeId, { position });
    },
    [syncNode]
  );

  // ============================================================================
  // SYNC NODE DATA
  // ============================================================================

  const syncNodeData = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nodeId: string, data: any) => {
      syncNode(nodeId, { data });
    },
    [syncNode]
  );

  // ============================================================================
  // ADD NEW NODE TO FIRESTORE
  // ============================================================================

  const addNodeToFirestore = useCallback(
    async (node: NovaNode) => {
      if (!boardId || !user) return;

      const nodeDoc: NodeDocument = {
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        lastModifiedBy: user.uid,
        lastModifiedAt: serverTimestamp(),
        version: 1,
      };

      localChanges.current.add(node.id);

      try {
        await addDoc(collection(db, 'boards', boardId, 'nodes'), nodeDoc);
      } catch (error) {
        console.error('Error adding node to Firestore:', error);
        localChanges.current.delete(node.id);
        throw error;
      }
    },
    [boardId, user]
  );

  // ============================================================================
  // REMOVE NODE FROM FIRESTORE
  // ============================================================================

  const removeNodeFromFirestore = useCallback(
    async (nodeId: string) => {
      if (!boardId) return;

      try {
        const nodesRef = collection(db, 'boards', boardId, 'nodes');
        
        // Try cached doc ID
        const docId = nodeIdToDocId.current.get(nodeId);
        
        if (docId) {
          await deleteDoc(doc(nodesRef, docId));
          nodeIdToDocId.current.delete(nodeId);
        } else {
          // Fallback: query to find doc
          const snapshot = await getDocs(query(nodesRef));
          const nodeDoc = snapshot.docs.find((d) => d.data().id === nodeId);
          
          if (nodeDoc) {
            await deleteDoc(nodeDoc.ref);
          }
        }
      } catch (error) {
        console.error('Error removing node from Firestore:', error);
        throw error;
      }
    },
    [boardId]
  );

  // ============================================================================
  // ADD EDGE TO FIRESTORE
  // ============================================================================

  const addEdgeToFirestore = useCallback(
    async (edge: NovaEdge) => {
      if (!boardId || !user) return;

      const edgeDoc: EdgeDocument = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        type: edge.type || 'tagged',
        data: edge.data || {},
        lastModifiedBy: user.uid,
        lastModifiedAt: serverTimestamp(),
        version: 1,
      };

      try {
        await addDoc(collection(db, 'boards', boardId, 'edges'), edgeDoc);
      } catch (error) {
        console.error('Error adding edge to Firestore:', error);
        throw error;
      }
    },
    [boardId, user]
  );

  // ============================================================================
  // REMOVE EDGE FROM FIRESTORE
  // ============================================================================

  const removeEdgeFromFirestore = useCallback(
    async (edgeId: string) => {
      if (!boardId) return;

      try {
        const edgesRef = collection(db, 'boards', boardId, 'edges');
        const snapshot = await getDocs(query(edgesRef));
        const edgeDoc = snapshot.docs.find((d) => d.data().id === edgeId);

        if (edgeDoc) {
          await deleteDoc(edgeDoc.ref);
        }
      } catch (error) {
        console.error('Error removing edge from Firestore:', error);
        throw error;
      }
    },
    [boardId]
  );

  // ============================================================================
  // CLEANUP ON UNMOUNT
  // ============================================================================

  useEffect(() => {
    return () => {
      // Cleanup all unsubscribers
      unsubscribers.current.forEach((unsubscribe) => unsubscribe());
      unsubscribers.current = [];
      // Cancel any pending debounced sync operations
      syncNode.cancel();
    };
  }, [syncNode]);

  // ============================================================================
  // RETURN API
  // ============================================================================

  return {
    syncNodePosition,
    syncNodeData,
    addNodeToFirestore,
    removeNodeFromFirestore,
    addEdgeToFirestore,
    removeEdgeFromFirestore,
  };
}
