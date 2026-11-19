# Collaborative Canvas Architecture

## Executive Summary

This document outlines a comprehensive real-time collaboration system for Nova Machine's canvas, enabling multiple users to work on the same board simultaneously with live synchronization, cursor presence, and seamless invitation flows.

---

## 1. Firestore Schema Design

### 1.1 Modified `boards` Collection

```typescript
interface Board {
  id: string;                    // Auto-generated
  name: string;
  description?: string;
  thumbnail?: string;

  // Ownership & Access
  ownerId: string;               // Creator's userId (RENAMED from userId)
  visibility: 'private' | 'team' | 'public';

  // Collaborator quick-access (denormalized for queries)
  collaboratorIds: string[];     // Array of userIds with access

  // Canvas State (moved to subcollection for granular sync)
  // nodes: REMOVED - now in boards/{boardId}/nodes subcollection
  // edges: REMOVED - now in boards/{boardId}/edges subcollection

  // Metadata for list views
  nodeCount: number;
  lastEditedBy: string;          // userId of last editor
  lastEditedAt: Timestamp;

  // Standard fields
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 1.2 New `boards/{boardId}/nodes` Subcollection

Each node is a separate document for granular real-time updates:

```typescript
interface NodeDocument {
  id: string;                    // Node ID (document ID)
  type: 'prompt' | 'image' | 'video' | 'element' | 'output' | 'camera' | 'lighting';
  position: { x: number; y: number };
  data: NodeData;                // Type-specific data

  // Collaboration metadata
  lockedBy?: string;             // userId currently editing
  lockExpiresAt?: Timestamp;     // Auto-release after 30s inactivity
  lastModifiedBy: string;
  lastModifiedAt: Timestamp;

  // Version for conflict detection
  version: number;
}
```

### 1.3 New `boards/{boardId}/edges` Subcollection

```typescript
interface EdgeDocument {
  id: string;                    // Edge ID (document ID)
  source: string;                // Source node ID
  target: string;                // Target node ID
  sourceHandle?: string;
  targetHandle?: string;
  type: 'tagged';
  data: {
    tag?: string;
    color?: string;
    animated?: boolean;
  };

  lastModifiedBy: string;
  lastModifiedAt: Timestamp;
  version: number;
}
```

### 1.4 New `boards/{boardId}/collaborators` Subcollection

```typescript
interface CollaboratorDocument {
  id: string;                    // Document ID = {boardId}_{userId}

  userId: string;
  boardId: string;

  // User info (denormalized for display)
  displayName: string;
  email: string;
  photoUrl?: string;

  // Access control
  role: 'owner' | 'editor' | 'viewer';

  // Presence
  isOnline: boolean;
  lastActiveAt: Timestamp;
  cursorPosition?: { x: number; y: number };
  selectedNodeIds?: string[];

  // Timestamps
  joinedAt: Timestamp;
  invitedBy: string;             // userId who invited
}
```

### 1.5 New `boardInvitations` Collection

```typescript
interface BoardInvitation {
  id: string;                    // Auto-generated or custom invite code

  boardId: string;
  boardName: string;             // Denormalized for email/display

  // Invite target
  invitedEmail: string;          // Email address invited
  invitedUserId?: string;        // Resolved if user exists

  // Invite source
  invitedBy: string;             // userId
  invitedByName: string;         // Denormalized

  // Access configuration
  role: 'editor' | 'viewer';

  // Status
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

  // Security
  token: string;                 // Secure random token for link-based invites
  expiresAt: Timestamp;          // 7 days default

  // Timestamps
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
  declinedAt?: Timestamp;
}
```

### 1.6 New `boardActivity` Collection

For activity feed and change history:

```typescript
interface BoardActivity {
  id: string;
  boardId: string;

  userId: string;
  userName: string;
  userPhotoUrl?: string;

  action:
    | 'board_created'
    | 'node_added'
    | 'node_modified'
    | 'node_deleted'
    | 'edge_added'
    | 'edge_deleted'
    | 'collaborator_joined'
    | 'collaborator_left'
    | 'generation_started'
    | 'generation_completed'
    | 'board_renamed';

  // Action-specific metadata
  metadata?: {
    nodeId?: string;
    nodeType?: string;
    previousName?: string;
    newName?: string;
    // etc.
  };

  timestamp: Timestamp;
}
```

---

## 2. Invitation System

### 2.1 Invitation Flow Types

#### Type A: Invite Existing User (by email)

```
Owner → Enter email → System checks if user exists →
  → YES: Create invitation + in-app notification → User accepts → Added as collaborator
  → NO: Create invitation + send email → User signs up → Auto-redirect to board
```

#### Type B: Share Link

```
Owner → Generate share link → Copy link → Send via any channel →
  → Recipient clicks link →
    → Logged in: Accept invitation screen → Join board
    → Not logged in: Sign up/Sign in → Accept invitation → Join board
```

### 2.2 Share Link Structure

```
https://novamachine.app/invite/{inviteToken}

inviteToken = base64url(boardId + ":" + randomToken)
Example: https://novamachine.app/invite/abc123_xYz789...
```

### 2.3 Invitation Email Template

```
Subject: [User Name] invited you to collaborate on "[Board Name]"

---

Hi there,

[User Name] has invited you to collaborate on a Nova Machine project:

📋 Project: [Board Name]
👁️ Access Level: [Editor/Viewer]

[Accept Invitation Button]

---

Nova Machine is an AI-powered video generation platform with visual workflows.

If you didn't expect this invitation, you can ignore this email.
```

### 2.4 Invitation States & Transitions

```
┌─────────────┐
│   PENDING   │ ←── Initial state
└──────┬──────┘
       │
       ├────────────────────────────────────────┐
       │                                        │
       ▼                                        ▼
┌─────────────┐                          ┌─────────────┐
│  ACCEPTED   │                          │  DECLINED   │
└─────────────┘                          └─────────────┘

       │ (from PENDING)
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│   EXPIRED   │   │   REVOKED   │
└─────────────┘   └─────────────┘
```

---

## 3. Real-Time Synchronization Architecture

### 3.1 Sync Strategy: Firestore Real-Time Listeners

Instead of complex CRDT/OT, we leverage Firestore's built-in real-time capabilities with granular document updates.

```typescript
// On canvas mount
useEffect(() => {
  if (!boardId || !user) return;

  // Listen to nodes subcollection
  const nodesUnsubscribe = onSnapshot(
    collection(db, 'boards', boardId, 'nodes'),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.doc.metadata.hasPendingWrites) return; // Skip local changes

        const node = change.doc.data() as NodeDocument;

        switch (change.type) {
          case 'added':
            canvasStore.addRemoteNode(node);
            break;
          case 'modified':
            canvasStore.updateRemoteNode(node.id, node);
            break;
          case 'removed':
            canvasStore.removeRemoteNode(node.id);
            break;
        }
      });
    }
  );

  // Listen to edges subcollection
  const edgesUnsubscribe = onSnapshot(
    collection(db, 'boards', boardId, 'edges'),
    (snapshot) => {
      // Similar pattern for edges
    }
  );

  return () => {
    nodesUnsubscribe();
    edgesUnsubscribe();
  };
}, [boardId, user]);
```

### 3.2 Write Strategy: Debounced Batched Updates

For frequent updates (dragging nodes, typing), debounce writes:

```typescript
// In canvas-store.ts
const debouncedNodeUpdate = useMemo(() =>
  debounce(async (nodeId: string, data: Partial<NodeDocument>) => {
    await updateDoc(doc(db, 'boards', boardId, 'nodes', nodeId), {
      ...data,
      lastModifiedBy: user.uid,
      lastModifiedAt: serverTimestamp(),
      version: increment(1),
    });
  }, 300),
  [boardId, user]
);

// On node position change (from React Flow)
const onNodesChange = (changes: NodeChange[]) => {
  changes.forEach((change) => {
    if (change.type === 'position' && change.position) {
      // Update local state immediately
      setNodes((nodes) => applyNodeChanges([change], nodes));

      // Debounce remote update
      debouncedNodeUpdate(change.id, { position: change.position });
    }
  });
};
```

### 3.3 Optimistic Updates with Rollback

```typescript
interface PendingUpdate {
  id: string;
  previousState: NodeDocument;
  newState: Partial<NodeDocument>;
  timestamp: number;
}

const pendingUpdates = new Map<string, PendingUpdate>();

async function updateNodeWithRollback(
  nodeId: string,
  updates: Partial<NodeDocument>
) {
  // Store current state for potential rollback
  const previousState = canvasStore.getNode(nodeId);
  pendingUpdates.set(nodeId, {
    id: nodeId,
    previousState,
    newState: updates,
    timestamp: Date.now(),
  });

  // Apply optimistically
  canvasStore.updateNode(nodeId, updates);

  try {
    await updateDoc(doc(db, 'boards', boardId, 'nodes', nodeId), {
      ...updates,
      lastModifiedBy: user.uid,
      lastModifiedAt: serverTimestamp(),
      version: increment(1),
    });

    // Success - clear pending
    pendingUpdates.delete(nodeId);
  } catch (error) {
    // Rollback on failure
    canvasStore.updateNode(nodeId, previousState);
    pendingUpdates.delete(nodeId);
    toast.error('Failed to save changes');
  }
}
```

---

## 4. User Presence System

### 4.1 Presence Document Updates

```typescript
// Update presence every 10 seconds while canvas is open
const presenceRef = doc(db, 'boards', boardId, 'collaborators', `${boardId}_${user.uid}`);

useEffect(() => {
  // Mark as online
  updateDoc(presenceRef, {
    isOnline: true,
    lastActiveAt: serverTimestamp(),
  });

  // Update periodically
  const interval = setInterval(() => {
    updateDoc(presenceRef, {
      lastActiveAt: serverTimestamp(),
    });
  }, 10000);

  // Mark offline on disconnect
  const handleBeforeUnload = () => {
    // Use sendBeacon for reliable offline marking
    navigator.sendBeacon('/api/presence/offline', JSON.stringify({
      boardId,
      userId: user.uid,
    }));
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    clearInterval(interval);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    updateDoc(presenceRef, { isOnline: false });
  };
}, [boardId, user]);
```

### 4.2 Cursor Position Sync

```typescript
// Track mouse movement with throttling
const throttledCursorUpdate = useMemo(() =>
  throttle((position: { x: number; y: number }) => {
    updateDoc(presenceRef, {
      cursorPosition: position,
      lastActiveAt: serverTimestamp(),
    });
  }, 50), // 20 updates per second max
  [presenceRef]
);

// In canvas component
<ReactFlow
  onMouseMove={(event) => {
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (bounds) {
      const position = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
      throttledCursorUpdate(position);
    }
  }}
/>
```

### 4.3 Remote Cursors Rendering

```typescript
interface RemoteCursor {
  userId: string;
  displayName: string;
  photoUrl?: string;
  position: { x: number; y: number };
  color: string;
}

// Cursor overlay component
function RemoteCursors({ boardId }: { boardId: string }) {
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'boards', boardId, 'collaborators'),
        where('isOnline', '==', true)
      ),
      (snapshot) => {
        const remoteCursors = snapshot.docs
          .filter((doc) => doc.data().userId !== user?.uid)
          .map((doc) => {
            const data = doc.data();
            return {
              userId: data.userId,
              displayName: data.displayName,
              photoUrl: data.photoUrl,
              position: data.cursorPosition || { x: 0, y: 0 },
              color: getUserColor(data.userId),
            };
          });
        setCursors(remoteCursors);
      }
    );

    return unsubscribe;
  }, [boardId, user]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {cursors.map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute transition-all duration-75"
          style={{
            left: cursor.position.x,
            top: cursor.position.y,
            transform: 'translate(-2px, -2px)',
          }}
        >
          {/* Cursor arrow */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill={cursor.color}
            className="drop-shadow-lg"
          >
            <path d="M5 2l14 11.5-6 1-4 6z" />
          </svg>

          {/* User badge */}
          <div
            className="ml-4 -mt-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.photoUrl && (
              <img
                src={cursor.photoUrl}
                alt=""
                className="h-4 w-4 rounded-full"
              />
            )}
            <span>{cursor.displayName.split(' ')[0]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 5. Node Locking for Conflict Prevention

### 5.1 Lock Acquisition

When user starts editing a node (focuses input, starts dragging):

```typescript
async function acquireLock(nodeId: string): Promise<boolean> {
  const nodeRef = doc(db, 'boards', boardId, 'nodes', nodeId);

  try {
    await runTransaction(db, async (transaction) => {
      const nodeDoc = await transaction.get(nodeRef);
      const data = nodeDoc.data();

      // Check if already locked by another user
      if (data?.lockedBy && data.lockedBy !== user.uid) {
        const lockExpiry = data.lockExpiresAt?.toDate();
        if (lockExpiry && lockExpiry > new Date()) {
          throw new Error('LOCKED_BY_OTHER');
        }
      }

      // Acquire lock
      transaction.update(nodeRef, {
        lockedBy: user.uid,
        lockExpiresAt: Timestamp.fromDate(
          new Date(Date.now() + 30000) // 30 second lock
        ),
      });
    });

    return true;
  } catch (error) {
    if (error.message === 'LOCKED_BY_OTHER') {
      toast.info('This node is being edited by another user');
      return false;
    }
    throw error;
  }
}
```

### 5.2 Lock Extension (Heartbeat)

While user is actively editing:

```typescript
useEffect(() => {
  if (!activelyEditingNodeId) return;

  const interval = setInterval(async () => {
    await updateDoc(
      doc(db, 'boards', boardId, 'nodes', activelyEditingNodeId),
      {
        lockExpiresAt: Timestamp.fromDate(
          new Date(Date.now() + 30000)
        ),
      }
    );
  }, 15000); // Extend every 15 seconds

  return () => clearInterval(interval);
}, [activelyEditingNodeId, boardId]);
```

### 5.3 Lock Release

On blur/finish editing:

```typescript
async function releaseLock(nodeId: string) {
  await updateDoc(doc(db, 'boards', boardId, 'nodes', nodeId), {
    lockedBy: deleteField(),
    lockExpiresAt: deleteField(),
  });
}
```

### 5.4 Visual Lock Indicators

```typescript
// In node component
function PromptNode({ data, selected }: NodeProps<PromptNodeData>) {
  const { user } = useAuth();
  const isLockedByOther = data.lockedBy && data.lockedBy !== user?.uid;

  return (
    <div className={cn(
      "relative rounded-xl border bg-neutral-900",
      isLockedByOther && "opacity-75 pointer-events-none"
    )}>
      {isLockedByOther && (
        <div className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-black">
          <LockIcon className="h-3 w-3" />
          <span>Editing</span>
        </div>
      )}

      {/* Node content */}
    </div>
  );
}
```

---

## 6. Complete User Flows

### 6.1 Flow: Owner Invites Existing User

```
┌─────────────────────────────────────────────────────────────────┐
│ OWNER ACTION                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Click "Share" button in canvas header                         │
│ 2. Enter email: "colleague@company.com"                          │
│ 3. Select role: "Editor" or "Viewer"                             │
│ 4. Click "Send Invite"                                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ SYSTEM PROCESSING                                                │
├─────────────────────────────────────────────────────────────────┤
│ 1. Check if email exists in users collection                     │
│    → Found: existingUserId = "user_abc123"                       │
│ 2. Create boardInvitation document                               │
│ 3. Create notification for existingUserId                        │
│ 4. Send email notification                                       │
│ 5. Show "Invitation sent!" toast                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ INVITEE EXPERIENCE                                               │
├─────────────────────────────────────────────────────────────────┤
│ OPTION A: In-App Notification                                    │
│ 1. Sees notification bell with badge                             │
│ 2. Clicks notification                                           │
│ 3. Sees: "[Owner] invited you to [Board Name]"                   │
│ 4. Clicks "Accept" or "Decline"                                  │
│    → Accept: Redirected to board, now collaborator               │
│    → Decline: Notification dismissed                             │
│                                                                  │
│ OPTION B: Email Link                                             │
│ 1. Receives email with invite                                    │
│ 2. Clicks "Accept Invitation"                                    │
│ 3. Opens app (already logged in)                                 │
│ 4. Sees confirmation: "You've joined [Board Name]!"              │
│ 5. Redirected to canvas                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Flow: Owner Invites New User (Not Registered)

```
┌─────────────────────────────────────────────────────────────────┐
│ OWNER ACTION                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Click "Share" button                                          │
│ 2. Enter email: "newperson@gmail.com"                            │
│ 3. Select role: "Editor"                                         │
│ 4. Click "Send Invite"                                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ SYSTEM PROCESSING                                                │
├─────────────────────────────────────────────────────────────────┤
│ 1. Check if email exists → NOT FOUND                             │
│ 2. Create boardInvitation with:                                  │
│    - invitedEmail: "newperson@gmail.com"                         │
│    - invitedUserId: null                                         │
│    - token: "secure_random_token"                                │
│ 3. Send email with invite link                                   │
│ 4. Show: "Invitation sent! They'll need to create an account"    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ NEW USER EXPERIENCE                                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Receives email: "[Owner] invited you to collaborate..."       │
│ 2. Clicks "Accept Invitation"                                    │
│ 3. Opens: /invite/[token]                                        │
│ 4. Not logged in → Shown invite preview:                         │
│    ┌─────────────────────────────────────────────────────────┐   │
│    │  🎬 You're invited to collaborate                       │   │
│    │                                                         │   │
│    │  [Board Thumbnail]                                      │   │
│    │  Board Name: "Product Demo Video"                       │   │
│    │  Invited by: John Smith                                 │   │
│    │  Access: Editor                                         │   │
│    │                                                         │   │
│    │  [Sign Up to Accept]  [Sign In]                         │   │
│    └─────────────────────────────────────────────────────────┘   │
│ 5. Clicks "Sign Up to Accept"                                    │
│ 6. Creates account (invite token stored in session)              │
│ 7. On account creation:                                          │
│    - System checks for pending invites to this email             │
│    - Auto-accepts invitation                                     │
│    - Adds as collaborator                                        │
│ 8. Redirected directly to board canvas                           │
│ 9. Welcome modal: "Welcome! You're now collaborating on..."      │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Flow: Share Link Generation

```
┌─────────────────────────────────────────────────────────────────┐
│ OWNER ACTION                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Click "Share" button                                          │
│ 2. Click "Copy link" tab                                         │
│ 3. Select default role: "Viewer"                                 │
│ 4. Click "Generate Link"                                         │
│ 5. Link copied to clipboard                                      │
│    → https://novamachine.app/invite/Nx7kP9qR...                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ LINK RECIPIENT (Logged In)                                       │
├─────────────────────────────────────────────────────────────────┤
│ 1. Opens link: /invite/[token]                                   │
│ 2. System validates token and checks auth                        │
│ 3. Shows accept screen:                                          │
│    ┌─────────────────────────────────────────────────────────┐   │
│    │  Join "[Board Name]"?                                   │   │
│    │                                                         │   │
│    │  [Board Thumbnail]                                      │   │
│    │  Shared by: John Smith                                  │   │
│    │  Your access: Viewer                                    │   │
│    │                                                         │   │
│    │  [Join Board]  [Cancel]                                 │   │
│    └─────────────────────────────────────────────────────────┘   │
│ 4. Clicks "Join Board"                                           │
│ 5. Added as collaborator → Redirected to canvas                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 Flow: Real-Time Collaboration Session

```
┌─────────────────────────────────────────────────────────────────┐
│ USER A OPENS BOARD                                               │
├─────────────────────────────────────────────────────────────────┤
│ 1. Navigate to /canvas?boardId=xxx                               │
│ 2. Subscribe to nodes, edges, collaborators                      │
│ 3. Update presence: isOnline = true                              │
│ 4. Begin cursor position broadcasting                            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ USER B JOINS                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Opens same board                                              │
│ 2. User A sees: "[User B avatar] joined" toast                   │
│ 3. User A sees User B's cursor appear with name label            │
│ 4. Collaborator avatars appear in header                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ COLLABORATIVE EDITING                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ USER A: Starts editing Prompt Node 1                             │
│ ─────────────────────────────────────                            │
│ 1. Clicks on prompt textarea                                     │
│ 2. Acquires lock on Node 1                                       │
│ 3. User B sees lock indicator on Node 1: "🔒 Editing by [A]"     │
│ 4. User A types: "A cinematic shot of..."                        │
│ 5. Changes sync to Firestore (debounced)                         │
│ 6. User B sees text updating in real-time                        │
│ 7. User A clicks outside → Lock released                         │
│                                                                  │
│ USER B: Drags Image Node 2                                       │
│ ─────────────────────────────────                                │
│ 1. Clicks and drags Image Node                                   │
│ 2. Position updates broadcast in real-time                       │
│ 3. User A sees node moving smoothly                              │
│                                                                  │
│ USER A: Starts AI Generation                                     │
│ ────────────────────────────────                                 │
│ 1. Clicks "Generate" on Prompt Node                              │
│ 2. Activity logged: "User A started generation"                  │
│ 3. User B sees generation progress on Output Node                │
│ 4. When complete, both users see result simultaneously           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.5 Flow: Viewer Role Experience

```
┌─────────────────────────────────────────────────────────────────┐
│ VIEWER CAPABILITIES                                              │
├─────────────────────────────────────────────────────────────────┤
│ ✅ CAN DO:                                                       │
│ • View all nodes and edges                                       │
│ • Pan and zoom canvas                                            │
│ • See real-time changes from editors                             │
│ • See other users' cursors                                       │
│ • View generation results                                        │
│ • Download media files                                           │
│ • View activity feed                                             │
│                                                                  │
│ ❌ CANNOT DO:                                                    │
│ • Add/delete nodes                                               │
│ • Edit node content                                              │
│ • Create/delete edges                                            │
│ • Start generations                                              │
│ • Invite others                                                  │
│ • Change board settings                                          │
│                                                                  │
│ UI INDICATORS:                                                   │
│ • "View Only" badge in header                                    │
│ • Disabled controls/buttons                                      │
│ • Cursor shows hand icon (not pointer)                           │
│ • Toolbar hidden or grayed out                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(boardId) {
      return get(/databases/$(database)/documents/boards/$(boardId)).data.ownerId == request.auth.uid;
    }

    function isCollaborator(boardId) {
      return request.auth.uid in get(/databases/$(database)/documents/boards/$(boardId)).data.collaboratorIds;
    }

    function getCollaboratorRole(boardId) {
      return get(/databases/$(database)/documents/boards/$(boardId)/collaborators/$(boardId)_$(request.auth.uid)).data.role;
    }

    function canEdit(boardId) {
      return isOwner(boardId) || getCollaboratorRole(boardId) in ['owner', 'editor'];
    }

    function canView(boardId) {
      return isOwner(boardId) || isCollaborator(boardId);
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if request.auth.uid == userId;
    }

    // Boards collection
    match /boards/{boardId} {
      // Anyone can read public boards, collaborators can read private
      allow read: if resource.data.visibility == 'public' || canView(boardId);

      // Only owner can delete
      allow delete: if isOwner(boardId);

      // Editors and owners can update
      allow update: if canEdit(boardId);

      // Any authenticated user can create
      allow create: if isAuthenticated() && request.resource.data.ownerId == request.auth.uid;

      // Nodes subcollection
      match /nodes/{nodeId} {
        allow read: if canView(boardId);
        allow write: if canEdit(boardId);
      }

      // Edges subcollection
      match /edges/{edgeId} {
        allow read: if canView(boardId);
        allow write: if canEdit(boardId);
      }

      // Collaborators subcollection
      match /collaborators/{collabId} {
        allow read: if canView(boardId);

        // Only owner can add collaborators
        allow create: if isOwner(boardId);

        // Collaborators can update their own presence
        allow update: if resource.data.userId == request.auth.uid || isOwner(boardId);

        // Only owner can remove collaborators
        allow delete: if isOwner(boardId);
      }
    }

    // Board invitations
    match /boardInvitations/{inviteId} {
      // Invitee can read their invitation
      allow read: if isAuthenticated() && (
        resource.data.invitedUserId == request.auth.uid ||
        resource.data.invitedEmail == request.auth.token.email
      );

      // Board owner can create invitations
      allow create: if isOwner(request.resource.data.boardId);

      // Invitee can update (accept/decline)
      allow update: if resource.data.invitedEmail == request.auth.token.email ||
                       resource.data.invitedUserId == request.auth.uid;

      // Owner can delete (revoke)
      allow delete: if isOwner(resource.data.boardId);
    }

    // Board activity (read-only for collaborators)
    match /boardActivity/{activityId} {
      allow read: if canView(resource.data.boardId);
      allow create: if canEdit(resource.data.boardId);
    }
  }
}
```

---

## 8. UI Components Needed

### 8.1 Share Modal

```
┌────────────────────────────────────────────────────────────────┐
│  Share "[Board Name]"                                     [X]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ [Invite by Email]  [Copy Link]  [Settings]               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📧 Enter email addresses                                 │  │
│  │ ┌──────────────────────────────────────────────────────┐ │  │
│  │ │ email@example.com                              [Add] │ │  │
│  │ └──────────────────────────────────────────────────────┘ │  │
│  │                                                          │  │
│  │ Role: [Editor ▼]                                         │  │
│  │                                                          │  │
│  │                               [Send Invitation]          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ─────────────────────────────────────────────────────────────  │
│                                                                │
│  Current collaborators                                         │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 👤 John Smith (You)              Owner                   │  │
│  │ 👤 Sarah Connor              [Editor ▼]  [🗑️]            │  │
│  │ 👤 pending@email.com (pending)   Editor   [🗑️]           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 8.2 Collaborator Avatars in Header

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎬 Nova Machine    |    [Board Name ▼]    |    [👤][👤][👤][+2] [Share] │
└─────────────────────────────────────────────────────────────────────────┘
                                                  ↑
                                         Overlapping avatars
                                         with online indicators
```

### 8.3 Invitation Accept Page

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│            🎬 Nova Machine                                     │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │            You've been invited!                          │  │
│  │                                                          │  │
│  │    ┌──────────────────────────────────────────────────┐  │  │
│  │    │                                                  │  │  │
│  │    │         [Board Thumbnail]                        │  │  │
│  │    │                                                  │  │  │
│  │    └──────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │    Board: "Product Launch Video"                         │  │
│  │    Invited by: Sarah Connor                              │  │
│  │    Your role: Editor                                     │  │
│  │                                                          │  │
│  │    ┌────────────────┐  ┌────────────────┐               │  │
│  │    │  Accept Invite │  │    Decline     │               │  │
│  │    └────────────────┘  └────────────────┘               │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Update Firestore schema with new collections
- [ ] Migrate existing boards to new structure
- [ ] Add collaboratorIds field to boards
- [ ] Create nodes/edges subcollections from existing data
- [ ] Update canvas-store for Firestore integration
- [ ] Basic real-time sync for nodes and edges

### Phase 2: Invitation System (Week 3)
- [ ] Create Share modal component
- [ ] Implement invitation creation
- [ ] Build /invite/[token] page
- [ ] Email notification integration (SendGrid/Resend)
- [ ] Handle new user signup with pending invite

### Phase 3: Presence & Cursors (Week 4)
- [ ] Implement presence tracking
- [ ] Build remote cursor overlay
- [ ] Add collaborator avatars in header
- [ ] Online/offline indicators
- [ ] "User joined" notifications

### Phase 4: Locking & Polish (Week 5)
- [ ] Node locking mechanism
- [ ] Lock UI indicators
- [ ] Activity feed
- [ ] Viewer role restrictions
- [ ] Performance optimization

### Phase 5: Advanced Features (Week 6+)
- [ ] Comments on nodes
- [ ] @mentions in comments
- [ ] Version history
- [ ] Undo/redo with attribution
- [ ] Offline support with sync

---

## 10. Performance Considerations

### 10.1 Listener Optimization

```typescript
// Only subscribe to necessary fields
const nodesQuery = query(
  collection(db, 'boards', boardId, 'nodes'),
  // Exclude heavy data from initial sync
);

// Use pagination for large boards
const initialNodes = await getDocs(
  query(nodesQuery, limit(100))
);
```

### 10.2 Cursor Update Throttling

```typescript
// Cursor updates: max 20/second
const throttledCursor = throttle(updateCursor, 50);

// Node position updates: max 3/second
const debouncedPosition = debounce(updatePosition, 300);

// Text input: debounce 500ms
const debouncedText = debounce(updateText, 500);
```

### 10.3 Presence Cleanup

```typescript
// Cloud Function to clean stale presence
exports.cleanStalePresence = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const staleThreshold = new Date(Date.now() - 60000); // 1 minute

    const staleCollaborators = await db
      .collectionGroup('collaborators')
      .where('isOnline', '==', true)
      .where('lastActiveAt', '<', staleThreshold)
      .get();

    const batch = db.batch();
    staleCollaborators.forEach((doc) => {
      batch.update(doc.ref, { isOnline: false });
    });

    await batch.commit();
  });
```

---

## 11. Error Handling & Edge Cases

### 11.1 Network Disconnection

```typescript
// Firestore automatically handles reconnection
// But we should show UI indicator

onSnapshot(collection,
  (snapshot) => { /* success */ },
  (error) => {
    if (error.code === 'unavailable') {
      setConnectionStatus('offline');
      toast.warning('Connection lost. Changes will sync when reconnected.');
    }
  }
);
```

### 11.2 Concurrent Deletion

```typescript
// Handle case where node is deleted while another user is editing
onSnapshot(nodeRef, (snapshot) => {
  if (!snapshot.exists()) {
    // Node was deleted
    if (isEditingThisNode) {
      toast.info('This node was deleted by another user');
      closeEditingState();
    }
  }
});
```

### 11.3 Permission Changes

```typescript
// Handle role changes mid-session
onSnapshot(collaboratorRef, (snapshot) => {
  const data = snapshot.data();
  if (data.role !== currentRole) {
    setCurrentRole(data.role);
    if (data.role === 'viewer') {
      toast.info('Your access has been changed to Viewer');
      disableEditing();
    }
  }
});
```

---

## Summary

This architecture provides:

1. **Seamless Real-Time Sync** - Firestore listeners for immediate updates
2. **Intuitive Invitation Flow** - Email invites and share links
3. **Visual Presence** - Cursors, avatars, online indicators
4. **Conflict Prevention** - Node locking with automatic release
5. **Role-Based Access** - Owner, Editor, Viewer permissions
6. **Graceful Degradation** - Handles offline, errors, edge cases

The implementation follows Firebase best practices and builds on the existing Nova Machine architecture while adding the collaborative layer that transforms it into a truly team-based creative tool.
