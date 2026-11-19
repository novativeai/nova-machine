'use client';

import { useState, useEffect } from 'react';
import { X, Mail, Link2, Check, Trash2, Copy, UserPlus, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import {
  createBoardInvitation,
  getBoardInvitations,
  getBoardCollaborators,
  updateCollaboratorRole,
  removeCollaborator,
  type BoardCollaborator,
  type BoardInvitation,
} from '@/lib/firestore';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
}

type TabType = 'email' | 'link';
type RoleType = 'editor' | 'viewer';
type MessageType = 'error' | 'success' | null;

interface Message {
  type: MessageType;
  text: string;
}

export function ShareModal({ isOpen, onClose, boardId, boardName }: ShareModalProps) {
  const { user, firestoreUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('email');
  const [email, setEmail] = useState('');
  const [emailRole, setEmailRole] = useState<RoleType>('editor');
  const [linkRole, setLinkRole] = useState<RoleType>('editor');
  const [collaborators, setCollaborators] = useState<BoardCollaborator[]>([]);
  const [invitations, setInvitations] = useState<BoardInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (isOpen && boardId) {
      loadCollaborators();
      loadInvitations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, boardId]);

  // Add escape key listener
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const showMessage = (type: MessageType, text: string) => {
    setMessage({ type, text });
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkDuplicateInvitation = (email: string): boolean => {
    return invitations.some(
      (inv) => inv.invitedEmail.toLowerCase() === email.toLowerCase() && inv.status === 'pending'
    );
  };

  const checkExistingCollaborator = (email: string): boolean => {
    return collaborators.some((collab) => collab.email.toLowerCase() === email.toLowerCase());
  };

  const loadCollaborators = async () => {
    try {
      const data = await getBoardCollaborators(boardId);
      setCollaborators(data);
    } catch (error) {
      console.error('Failed to load collaborators:', error);
    }
  };

  const loadInvitations = async () => {
    try {
      const data = await getBoardInvitations(boardId);
      setInvitations(data);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  };

  const handleSendInvitation = async () => {
    if (!email || !user || !firestoreUser) return;

    // Validate email format
    if (!validateEmail(email)) {
      showMessage('error', 'Please enter a valid email address');
      return;
    }

    // Prevent self-invitation
    if (email.toLowerCase() === user.email?.toLowerCase()) {
      showMessage('error', 'You cannot invite yourself');
      return;
    }

    // Check for duplicate pending invitation
    if (checkDuplicateInvitation(email)) {
      showMessage('error', 'An invitation has already been sent to this email');
      return;
    }

    // Check if already a collaborator
    if (checkExistingCollaborator(email)) {
      showMessage('error', 'This user is already a collaborator on this board');
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const token = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      await createBoardInvitation({
        boardId,
        boardName,
        invitedBy: user.uid,
        invitedByName: firestoreUser.name || user.email || 'Unknown',
        invitedEmail: email,
        role: emailRole,
        token,
        status: 'pending',
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: Timestamp.now(),
      });

      // Send invitation email
      try {
        const authToken = await user.getIdToken();
        const response = await fetch('/api/invitations/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            token,
            boardName,
            inviterName: firestoreUser.name || user.email || 'Unknown',
            authToken,
          }),
        });

        if (!response.ok) {
          console.error('Failed to send email:', await response.text());
          // Don't fail the whole operation if email fails
        }
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
        // Don't fail the whole operation if email fails
      }

      setEmail('');
      setEmailRole('editor');
      await loadInvitations();
      showMessage('success', `Invitation sent to ${email}`);
    } catch (error) {
      console.error('Failed to send invitation:', error);
      showMessage('error', 'Failed to send invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const _handleGenerateLink = async () => {
    if (!user || !firestoreUser) return;

    setLinkLoading(true);
    setMessage(null);
    try {
      const token = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      // Create the link invitation in Firestore with 'link' as a special marker for the email
      await createBoardInvitation({
        boardId,
        boardName,
        invitedBy: user.uid,
        invitedByName: firestoreUser.name || user.email || 'Unknown',
        invitedEmail: 'link', // Special marker for link-based invitations
        role: linkRole,
        token,
        status: 'pending',
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: Timestamp.now(),
      });

      const link = `${window.location.origin}/invite/${token}`;
      setInviteLink(link);
      showMessage('success', 'Link generated successfully');
    } catch (error) {
      console.error('Failed to generate link:', error);
      showMessage('error', 'Failed to generate link. Please try again.');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      let linkToCopy = inviteLink;

      // Generate link if it doesn't exist
      if (!linkToCopy) {
        if (!user || !firestoreUser) return;

        setLinkLoading(true);
        setMessage(null);

        const token = nanoid(32);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await createBoardInvitation({
          boardId,
          boardName,
          invitedBy: user.uid,
          invitedByName: firestoreUser.name || user.email || 'Unknown',
          invitedEmail: 'link',
          role: linkRole,
          token,
          status: 'pending',
          expiresAt: Timestamp.fromDate(expiresAt),
          createdAt: Timestamp.now(),
        });

        linkToCopy = `${window.location.origin}/invite/${token}`;
        setInviteLink(linkToCopy);
        setLinkLoading(false);
      }

      // Copy to clipboard
      await navigator.clipboard.writeText(linkToCopy);
      setCopied(true);
      showMessage('success', 'Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      showMessage('error', 'Failed to copy link. Please try again.');
      setLinkLoading(false);
    }
  };

  const handleRoleChange = async (collaborator: BoardCollaborator, newRole: RoleType) => {
    setMessage(null);
    try {
      await updateCollaboratorRole(boardId, collaborator.userId, newRole);
      await loadCollaborators();
      showMessage('success', `Role updated to ${newRole}`);
    } catch (error) {
      console.error('Failed to update role:', error);
      showMessage('error', 'Failed to update role. Please try again.');
    }
  };

  const handleRemoveCollaborator = async (collaborator: BoardCollaborator) => {
    if (!confirm('Are you sure you want to remove this collaborator?')) return;

    setMessage(null);
    try {
      await removeCollaborator(boardId, collaborator.userId);
      await loadCollaborators();
      showMessage('success', 'Collaborator removed successfully');
    } catch (error) {
      console.error('Failed to remove collaborator:', error);
      showMessage('error', 'Failed to remove collaborator. Please try again.');
    }
  };

  const getInitials = (name: string, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Share Board</h2>
              <p className="text-sm text-white/60">{boardName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('email')}
            className={`flex flex-1 items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'email'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            <Mail className="h-4 w-4" />
            Invite by Email
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`flex flex-1 items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'link'
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            <Link2 className="h-4 w-4" />
            Copy Link
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[600px] overflow-y-auto p-6">
          {/* Message Display */}
          {message && (
            <div
              className={`mb-4 flex items-start gap-3 rounded-lg border p-4 ${
                message.type === 'error'
                  ? 'border-red-500/30 bg-red-500/10'
                  : 'border-green-500/30 bg-green-500/10'
              }`}
            >
              {message.type === 'error' ? (
                <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
              ) : (
                <CheckCircle className="h-5 w-5 shrink-0 text-green-400" />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    message.type === 'error' ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  {message.text}
                </p>
              </div>
              <button
                onClick={() => setMessage(null)}
                className="text-white/60 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {activeTab === 'email' ? (
            <div className="space-y-6">
              {/* Email Invite Form */}
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white">Role</label>
                  <select
                    value={emailRole}
                    onChange={(e) => setEmailRole(e.target.value as RoleType)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="editor">Editor - Can edit and comment</option>
                    <option value="viewer">Viewer - Can view only</option>
                  </select>
                </div>

                <button
                  onClick={handleSendInvitation}
                  disabled={!email || loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="h-4 w-4" />
                  {loading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>

              {/* Pending Invitations */}
              {invitations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white/80">Pending Invitations</h3>
                  <div className="space-y-2">
                    {invitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white">
                            {getInitials('', invitation.invitedEmail)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white">{invitation.invitedEmail}</p>
                              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                                Pending
                              </span>
                            </div>
                            <p className="text-xs text-white/60 capitalize">{invitation.role}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Current Collaborators */}
              {collaborators.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white/80">Collaborators</h3>
                  <div className="space-y-2">
                    {collaborators.map((collaborator) => (
                      <div
                        key={collaborator.id}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-center gap-3">
                          {collaborator.photoUrl ? (
                            <img
                              src={collaborator.photoUrl}
                              alt={collaborator.displayName}
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-xs font-medium text-blue-400">
                              {getInitials(collaborator.displayName, collaborator.email)}
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">{collaborator.displayName}</p>
                            <p className="text-xs text-white/60">{collaborator.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {collaborator.role !== 'owner' && (
                            <>
                              <select
                                value={collaborator.role}
                                onChange={(e) => handleRoleChange(collaborator, e.target.value as RoleType)}
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                              </select>
                              <button
                                onClick={() => handleRemoveCollaborator(collaborator)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-red-500/20 hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {collaborator.role === 'owner' && (
                            <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-400">
                              Owner
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Link Settings */}
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">Default Access</label>
                  <select
                    value={linkRole}
                    onChange={(e) => {
                      setLinkRole(e.target.value as RoleType);
                      setInviteLink(''); // Reset link when role changes
                    }}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="editor">Editor - Can edit and comment</option>
                    <option value="viewer">Viewer - Can view only</option>
                  </select>
                </div>

                {/* Generated Link Display */}
                {inviteLink && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-white">Shareable Link</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inviteLink}
                        readOnly
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/80 focus:outline-none"
                      />
                    </div>
                    <p className="text-xs text-white/60">
                      This link expires in 7 days. Anyone with this link will have {linkRole} access.
                    </p>
                  </div>
                )}

                {/* Copy Link Button */}
                <button
                  onClick={handleCopyLink}
                  disabled={linkLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {linkLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Generating...
                    </>
                  ) : copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      {inviteLink ? 'Copy Link' : 'Generate & Copy Link'}
                    </>
                  )}
                </button>

                {/* Info Box */}
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                      <Link2 className="h-3 w-3 text-blue-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-blue-400">Share Securely</p>
                      <p className="text-xs text-white/60">
                        Links expire after 7 days for security. You can always generate a new link if needed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
