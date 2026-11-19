'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Users, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getInvitationByToken,
  declineInvitation,
  addCollaborator,
  getBoard,
  checkBoardAccess,
  type BoardInvitation,
  type BoardCollaborator,
} from '@/lib/firestore';
import { db } from '@/lib/firebase';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { TextureButton } from '@/components/ui/texture-button';
import { toast } from '@/lib/toast';

type InviteState = 'loading' | 'not-found' | 'expired' | 'revoked' | 'valid' | 'error';

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const { user, firestoreUser, loading: authLoading } = useAuth();

  const [state, setState] = useState<InviteState>('loading');
  const [invitation, setInvitation] = useState<BoardInvitation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [boardName, setBoardName] = useState<string>('');

  const token = params.token as string;

  useEffect(() => {
    async function loadInvitation() {
      if (!token) {
        setState('not-found');
        return;
      }

      try {
        const invite = await getInvitationByToken(token);

        if (!invite) {
          setState('not-found');
          return;
        }

        // Check if expired or revoked
        const now = new Date();
        const expiresAt = invite.expiresAt.toDate();

        if (now > expiresAt) {
          setState('expired');
          setInvitation(invite);
          return;
        }

        if (invite.status === 'revoked') {
          setState('revoked');
          setInvitation(invite);
          return;
        }

        if (invite.status !== 'pending') {
          setState('expired');
          setInvitation(invite);
          return;
        }

        // Load board name
        const board = await getBoard(invite.boardId);
        if (board) {
          setBoardName(board.name);
        }

        setInvitation(invite);
        setState('valid');
      } catch (error) {
        console.error('Failed to load invitation:', error);
        setState('error');
      }
    }

    loadInvitation();
  }, [token]);

  useEffect(() => {
    // Store pending invite token for post-signup redirect
    if (state === 'valid' && !user) {
      sessionStorage.setItem('pendingInviteToken', token);
    }
  }, [state, user, token]);

  async function handleAccept() {
    if (!invitation || !user || !firestoreUser) return;

    setIsProcessing(true);

    try {
      // Check if user already has access to the board
      const existingAccess = await checkBoardAccess(invitation.boardId, user.uid);

      if (existingAccess === 'owner') {
        toast.info('You already own this board');
        sessionStorage.removeItem('pendingInviteToken');
        router.push(`/canvas?boardId=${invitation.boardId}`);
        return;
      }

      if (existingAccess === 'editor' || existingAccess === 'viewer') {
        toast.info('You are already a collaborator on this board');
        sessionStorage.removeItem('pendingInviteToken');
        router.push(`/canvas?boardId=${invitation.boardId}`);
        return;
      }

      // Use transaction to handle race conditions
      await runTransaction(db, async (transaction) => {
        const inviteRef = doc(db, 'boardInvitations', invitation.id);
        const inviteDoc = await transaction.get(inviteRef);

        if (!inviteDoc.exists()) {
          throw new Error('Invitation not found');
        }

        const currentInvite = inviteDoc.data() as BoardInvitation;

        // Re-validate invitation status
        const now = new Date();
        const expiresAt = currentInvite.expiresAt.toDate();

        if (now > expiresAt) {
          throw new Error('This invitation has expired');
        }

        if (currentInvite.status === 'revoked') {
          throw new Error('This invitation has been revoked');
        }

        if (currentInvite.status !== 'pending') {
          throw new Error('This invitation is no longer available');
        }

        // Update invitation status
        transaction.update(inviteRef, {
          status: 'accepted',
          invitedUserId: user.uid,
          acceptedAt: serverTimestamp(),
        });
      });

      // Add user as collaborator (outside transaction)
      const collaborator: Omit<BoardCollaborator, 'id'> = {
        boardId: invitation.boardId,
        userId: user.uid,
        displayName: firestoreUser.name || user.displayName || user.email || 'User',
        email: user.email || invitation.invitedEmail,
        photoUrl: user.photoURL || undefined,
        role: invitation.role,
        isOnline: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lastActiveAt: new Date() as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        joinedAt: new Date() as any,
        invitedBy: invitation.invitedBy,
      };

      await addCollaborator(invitation.boardId, collaborator);

      toast.success(`You've joined ${boardName || 'the board'}!`);

      // Clean up sessionStorage
      sessionStorage.removeItem('pendingInviteToken');

      // Redirect to canvas
      router.push(`/canvas?boardId=${invitation.boardId}`);
    } catch (error: unknown) {
      console.error('Failed to accept invitation:', error);

      // Handle specific error messages
      const errorMessage = error instanceof Error ? error.message : 'Failed to accept invitation. Please try again.';

      if (errorMessage.includes('expired') || errorMessage.includes('revoked') || errorMessage.includes('no longer available')) {
        toast.error(errorMessage);
        // Reload to show correct state
        window.location.reload();
      } else {
        toast.error('Failed to accept invitation. Please try again.');
        setIsProcessing(false);
      }
    }
  }

  async function handleDecline() {
    if (!invitation) return;

    setIsProcessing(true);

    try {
      await declineInvitation(invitation.id);
      toast.info('Invitation declined');
      router.push('/');
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      toast.error('Failed to decline invitation. Please try again.');
      setIsProcessing(false);
    }
  }

  function handleSignIn() {
    // Store token for after sign-in
    sessionStorage.setItem('pendingInviteToken', token);
    router.push('/sign-in');
  }

  function handleSignUp() {
    // Store token for after sign-up
    sessionStorage.setItem('pendingInviteToken', token);
    router.push('/sign-up');
  }

  // Loading state
  if (authLoading || state === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
          <p className="text-neutral-400">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (state === 'not-found') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Invitation Not Found</h1>
            <p className="text-neutral-400 mb-6">
              This invitation link is invalid or has been removed.
            </p>
            <TextureButton onClick={() => router.push('/')} variant="secondary">
              Go to Dashboard
            </TextureButton>
          </div>
        </motion.div>
      </div>
    );
  }

  // Expired state
  if (state === 'expired') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Invitation Expired</h1>
            <p className="text-neutral-400 mb-6">
              This invitation has expired or has already been used. Please contact the board owner
              for a new invitation.
            </p>
            <TextureButton onClick={() => router.push('/')} variant="secondary">
              Go to Dashboard
            </TextureButton>
          </div>
        </motion.div>
      </div>
    );
  }

  // Revoked state
  if (state === 'revoked') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Invitation Revoked</h1>
            <p className="text-neutral-400 mb-6">
              This invitation has been revoked by the board owner. Please contact them if you believe
              this is an error.
            </p>
            <TextureButton onClick={() => router.push('/')} variant="secondary">
              Go to Dashboard
            </TextureButton>
          </div>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something Went Wrong</h1>
            <p className="text-neutral-400 mb-6">
              Unable to load this invitation. Please try again later.
            </p>
            <TextureButton onClick={() => window.location.reload()} variant="secondary">
              Try Again
            </TextureButton>
          </div>
        </motion.div>
      </div>
    );
  }

  // Valid invitation
  if (!invitation) return null;

  const emailMatches = user?.email === invitation.invitedEmail;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-neutral-900 border border-white/10 rounded-2xl p-8">
          {/* Icon */}
          <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="h-8 w-8 text-cyan-500" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            You've been invited!
          </h1>

          {/* Board Preview */}
          <div className="bg-neutral-800/50 border border-white/5 rounded-xl p-6 mb-6 space-y-3">
            <div>
              <p className="text-sm text-neutral-500 mb-1">Board</p>
              <p className="text-white font-semibold">{boardName || invitation.boardName}</p>
            </div>

            <div>
              <p className="text-sm text-neutral-500 mb-1">Invited by</p>
              <p className="text-white">{invitation.invitedByName}</p>
            </div>

            <div>
              <p className="text-sm text-neutral-500 mb-1">Your role</p>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${
                  invitation.role === 'editor'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}
              >
                {invitation.role === 'editor' ? 'Editor' : 'Viewer'}
              </span>
            </div>
          </div>

          {/* Auth-aware actions */}
          {user ? (
            <>
              {/* Logged in */}
              {!emailMatches && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-400 text-center">
                    This invitation was sent to{' '}
                    <span className="font-semibold">{invitation.invitedEmail}</span>
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <TextureButton
                  onClick={handleDecline}
                  variant="secondary"
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Decline'}
                </TextureButton>

                <TextureButton
                  onClick={handleAccept}
                  variant="accent"
                  disabled={isProcessing}
                  loading={isProcessing}
                  className="flex-1"
                >
                  Accept Invite
                </TextureButton>
              </div>
            </>
          ) : (
            <>
              {/* Not logged in */}
              <div className="space-y-3">
                <TextureButton
                  onClick={handleSignUp}
                  variant="accent"
                  className="w-full"
                  disabled={isProcessing}
                >
                  Sign Up to Accept
                </TextureButton>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-neutral-900 text-neutral-500">
                      Already have an account?
                    </span>
                  </div>
                </div>

                <TextureButton
                  onClick={handleSignIn}
                  variant="secondary"
                  className="w-full"
                  disabled={isProcessing}
                >
                  Sign In
                </TextureButton>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
