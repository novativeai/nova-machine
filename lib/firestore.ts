import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  addDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  BOARDS: 'boards',
  GENERATIONS: 'generations',
  BOARD_COLLABORATORS: 'boardCollaborators',
  BOARD_INVITATIONS: 'boardInvitations',
  BOARD_ACTIVITY: 'boardActivity',
} as const;

// User Management
export interface User {
  uid: string;
  email: string;
  name?: string;
  imageUrl?: string;
  isAdmin?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function createUser(uid: string, data: Partial<User>) {
  const userRef = doc(db, COLLECTIONS.USERS, uid);

  // Check for pre-configured admin document
  let isAdmin = false;
  if (data.email) {
    const placeholderId = `admin_${data.email.replace(/[@.]/g, '_')}`;
    const placeholderRef = doc(db, COLLECTIONS.USERS, placeholderId);
    const placeholderSnap = await getDoc(placeholderRef);

    if (placeholderSnap.exists() && placeholderSnap.data().isPendingSignup) {
      isAdmin = placeholderSnap.data().isAdmin || false;
      // Delete placeholder document
      await deleteDoc(placeholderRef);
      console.log(`✅ Found admin pre-config for ${data.email}, granting admin status`);
    }
  }

  await setDoc(userRef, {
    uid,
    email: data.email,
    name: data.name || null,
    imageUrl: data.imageUrl || null,
    isAdmin, // Apply admin status if pre-configured
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getUser(uid: string): Promise<User | null> {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? (userSnap.data() as User) : null;
}

export async function updateUser(uid: string, data: Partial<User>) {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// Admin status can only be set via the Admin SDK (server-side)
// Client SDK is blocked by Firestore security rules for security

// Board Management
export interface Board {
  id: string;
  userId: string;
  name: string;
  description?: string;
  thumbnail?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: any; // JSON serialized nodes (string) or node array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: any; // JSON serialized edges (string) or edge array
  isPublic: boolean;
  tags: string[];
  ownerId: string;
  collaboratorIds: string[];
  visibility: 'private' | 'team' | 'public';
  nodeCount: number;
  lastEditedBy?: string;
  lastEditedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function createBoard(userId: string, boardData: Omit<Board, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
  const boardsRef = collection(db, COLLECTIONS.BOARDS);
  const docRef = await addDoc(boardsRef, {
    userId,
    ...boardData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getBoard(boardId: string): Promise<Board | null> {
  const boardRef = doc(db, COLLECTIONS.BOARDS, boardId);
  const boardSnap = await getDoc(boardRef);
  return boardSnap.exists() ? { ...boardSnap.data(), id: boardSnap.id } as Board : null;
}

export async function getUserBoards(userId: string): Promise<Board[]> {
  const boardsRef = collection(db, COLLECTIONS.BOARDS);
  const q = query(
    boardsRef,
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Board));
}

export async function getUserAccessibleBoards(userId: string): Promise<Board[]> {
  const boardsRef = collection(db, COLLECTIONS.BOARDS);

  // Get boards where user is the owner
  const ownedBoardsQuery = query(
    boardsRef,
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );

  // Get boards where user is a collaborator
  const collaboratedBoardsQuery = query(
    boardsRef,
    where('collaboratorIds', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );

  const [ownedSnapshot, collaboratedSnapshot] = await Promise.all([
    getDocs(ownedBoardsQuery),
    getDocs(collaboratedBoardsQuery)
  ]);

  const ownedBoards = ownedSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Board));
  const collaboratedBoards = collaboratedSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Board));

  // Combine and deduplicate
  const boardMap = new Map<string, Board>();
  [...ownedBoards, ...collaboratedBoards].forEach(board => {
    boardMap.set(board.id, board);
  });

  // Sort by updatedAt descending
  return Array.from(boardMap.values()).sort((a, b) => {
    const aTime = a.updatedAt?.toMillis() || 0;
    const bTime = b.updatedAt?.toMillis() || 0;
    return bTime - aTime;
  });
}

export async function updateBoard(boardId: string, data: Partial<Board>) {
  const boardRef = doc(db, COLLECTIONS.BOARDS, boardId);
  await updateDoc(boardRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBoard(boardId: string) {
  const boardRef = doc(db, COLLECTIONS.BOARDS, boardId);
  
  // Delete subcollections first to prevent orphaned documents
  const subcollections = ['nodes', 'edges', 'collaborators'];
  
  for (const subcollection of subcollections) {
    const subRef = collection(boardRef, subcollection);
    const snapshot = await getDocs(subRef);
    
    // Batch delete all documents in subcollection
    const batch = [];
    for (const doc of snapshot.docs) {
      batch.push(deleteDoc(doc.ref));
    }
    
    if (batch.length > 0) {
      await Promise.all(batch);
    }
  }
  
  // Delete the board document itself
  await deleteDoc(boardRef);
}

// Generation History
export interface Generation {
  id: string;
  userId: string;
  type: 'video' | 'image';
  model: string;
  prompt: string;
  outputUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  aspectRatio: string;
  resolution?: string;
  cost: number; // Estimated fal.ai cost (USD), billed to the user's own fal account
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
  requestId?: string;
  createdAt: Timestamp;
}

export async function createGeneration(userId: string, data: Omit<Generation, 'id' | 'userId' | 'createdAt'>) {
  const genRef = collection(db, COLLECTIONS.GENERATIONS);
  const docRef = await addDoc(genRef, {
    userId,
    ...data,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateGeneration(generationId: string, data: Partial<Generation>) {
  const genRef = doc(db, COLLECTIONS.GENERATIONS, generationId);
  await updateDoc(genRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function getUserGenerations(userId: string, limitCount = 50): Promise<Generation[]> {
  const genRef = collection(db, COLLECTIONS.GENERATIONS);
  const q = query(
    genRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Generation));
}

// Board Collaboration
export interface BoardCollaborator {
  id: string;
  boardId: string;
  userId: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  role: 'owner' | 'editor' | 'viewer';
  isOnline: boolean;
  lastActiveAt: Timestamp;
  cursorPosition?: { x: number; y: number };
  selectedNodeIds?: string[];
  joinedAt: Timestamp;
  invitedBy: string;
}

export interface BoardInvitation {
  id: string;
  boardId: string;
  boardName: string;
  invitedEmail: string;
  invitedUserId?: string;
  invitedBy: string;
  invitedByName: string;
  role: 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  token: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
}

export interface BoardActivity {
  id: string;
  boardId: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  action: 'board_created' | 'node_added' | 'node_modified' | 'node_deleted' | 'edge_added' | 'edge_deleted' | 'collaborator_joined' | 'collaborator_left' | 'generation_started' | 'generation_completed' | 'board_renamed';
  metadata?: Record<string, unknown>;
  timestamp: Timestamp;
}

// Invitation functions
export async function createBoardInvitation(invitation: Omit<BoardInvitation, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTIONS.BOARD_INVITATIONS), invitation);
  return docRef.id;
}

export async function getInvitationByToken(token: string): Promise<BoardInvitation | null> {
  const q = query(collection(db, COLLECTIONS.BOARD_INVITATIONS), where('token', '==', token), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const inviteDoc = snapshot.docs[0];
  return { id: inviteDoc.id, ...inviteDoc.data() } as BoardInvitation;
}

export async function getPendingInvitationsForEmail(email: string): Promise<BoardInvitation[]> {
  const q = query(
    collection(db, COLLECTIONS.BOARD_INVITATIONS),
    where('invitedEmail', '==', email),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BoardInvitation));
}

export async function acceptInvitation(invitationId: string, userId: string): Promise<void> {
  const inviteRef = doc(db, COLLECTIONS.BOARD_INVITATIONS, invitationId);
  await updateDoc(inviteRef, {
    status: 'accepted',
    invitedUserId: userId,
    acceptedAt: serverTimestamp(),
  });
}

export async function declineInvitation(invitationId: string): Promise<void> {
  const inviteRef = doc(db, COLLECTIONS.BOARD_INVITATIONS, invitationId);
  await updateDoc(inviteRef, { status: 'declined' });
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const inviteRef = doc(db, COLLECTIONS.BOARD_INVITATIONS, invitationId);
  await updateDoc(inviteRef, { status: 'revoked' });
}

// Collaborator functions
export async function addCollaborator(boardId: string, collaborator: Omit<BoardCollaborator, 'id'>): Promise<void> {
  const collabId = `${boardId}_${collaborator.userId}`;
  
  // Use batched write for atomicity
  const collabRef = doc(db, COLLECTIONS.BOARDS, boardId, 'collaborators', collabId);
  const boardRef = doc(db, COLLECTIONS.BOARDS, boardId);
  
  const batch = writeBatch(db);
  batch.set(collabRef, {
    ...collaborator,
    id: collabId,
  });
  batch.update(boardRef, {
    collaboratorIds: arrayUnion(collaborator.userId),
  });
  
  await batch.commit();
}

export async function removeCollaborator(boardId: string, userId: string): Promise<void> {
  const collabId = `${boardId}_${userId}`;
  
  // Use batched write for atomicity
  const collabRef = doc(db, COLLECTIONS.BOARDS, boardId, 'collaborators', collabId);
  const boardRef = doc(db, COLLECTIONS.BOARDS, boardId);
  
  const batch = writeBatch(db);
  batch.delete(collabRef);
  batch.update(boardRef, {
    collaboratorIds: arrayRemove(userId),
  });
  
  await batch.commit();
}

export async function getBoardCollaborators(boardId: string): Promise<BoardCollaborator[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.BOARDS, boardId, 'collaborators'));
  return snapshot.docs.map(doc => doc.data() as BoardCollaborator);
}

export async function getBoardInvitations(boardId: string): Promise<BoardInvitation[]> {
  const q = query(
    collection(db, COLLECTIONS.BOARD_INVITATIONS),
    where('boardId', '==', boardId),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BoardInvitation));
}

export async function checkDuplicateInvitation(boardId: string, email: string): Promise<boolean> {
  const q = query(
    collection(db, COLLECTIONS.BOARD_INVITATIONS),
    where('boardId', '==', boardId),
    where('invitedEmail', '==', email),
    where('status', '==', 'pending'),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

export async function updateCollaboratorRole(
  boardId: string,
  userId: string,
  role: 'editor' | 'viewer'
): Promise<void> {
  const collabId = `${boardId}_${userId}`;
  await updateDoc(doc(db, COLLECTIONS.BOARDS, boardId, 'collaborators', collabId), {
    role,
  });
}

export async function updateCollaboratorPresence(
  boardId: string,
  userId: string,
  presence: { isOnline?: boolean; cursorPosition?: { x: number; y: number }; selectedNodeIds?: string[] }
): Promise<void> {
  const collabId = `${boardId}_${userId}`;
  await updateDoc(doc(db, COLLECTIONS.BOARDS, boardId, 'collaborators', collabId), {
    ...presence,
    lastActiveAt: serverTimestamp(),
  });
}

// Activity logging
export async function logBoardActivity(activity: Omit<BoardActivity, 'id' | 'timestamp'>): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.BOARD_ACTIVITY), {
    ...activity,
    timestamp: serverTimestamp(),
  });
}

export async function getBoardActivity(boardId: string, limitCount = 50): Promise<BoardActivity[]> {
  const q = query(
    collection(db, COLLECTIONS.BOARD_ACTIVITY),
    where('boardId', '==', boardId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BoardActivity));
}

// Check if user has access to board
export async function checkBoardAccess(boardId: string, userId: string): Promise<'owner' | 'editor' | 'viewer' | null> {
  const board = await getBoard(boardId);
  if (!board) return null;

  if (board.userId === userId) return 'owner';

  if (board.collaboratorIds?.includes(userId)) {
    const collabId = `${boardId}_${userId}`;
    const collabDoc = await getDoc(doc(db, COLLECTIONS.BOARDS, boardId, 'collaborators', collabId));
    if (collabDoc.exists()) {
      return collabDoc.data().role;
    }
  }

  return null;
}

// Email validation helper
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
