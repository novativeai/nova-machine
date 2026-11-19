'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { BoardCollaborator } from '@/lib/firestore';

interface CollaboratorAvatarsProps {
  boardId: string;
  onShareClick: () => void;
}

export default function CollaboratorAvatars({ boardId, onShareClick }: CollaboratorAvatarsProps) {
  const [collaborators, setCollaborators] = useState<BoardCollaborator[]>([]);
  const { user } = useAuth();
  const MAX_VISIBLE = 4;

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'boards', boardId, 'collaborators'),
      (snapshot) => {
        const collabs = snapshot.docs.map(doc => doc.data() as BoardCollaborator);
        setCollaborators(collabs);
      }
    );
    return () => unsubscribe();
  }, [boardId]);

  const visibleCollaborators = collaborators.slice(0, MAX_VISIBLE);
  const remainingCount = collaborators.length - MAX_VISIBLE;

  const getInitials = (displayName?: string, email?: string): string => {
    if (displayName) {
      const parts = displayName.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return displayName.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return '??';
  };

  return (
    <div className="flex items-center">
      {/* Collaborator Avatars */}
      <div className="flex items-center">
        {visibleCollaborators.map((collaborator, index) => {
          const isCurrentUser = user?.uid === collaborator.userId;
          const initials = getInitials(collaborator.displayName, collaborator.email);

          return (
            <div
              key={collaborator.userId}
              className="relative -ml-2 first:ml-0 group"
              style={{ zIndex: MAX_VISIBLE - index }}
            >
              {/* Avatar */}
              {collaborator.photoUrl ? (
                <img
                  src={collaborator.photoUrl}
                  alt={collaborator.displayName || collaborator.email}
                  className={`h-8 w-8 rounded-full ring-2 object-cover transition-all ${
                    isCurrentUser
                      ? 'ring-blue-500'
                      : 'ring-[#0a0a0a] group-hover:ring-neutral-700'
                  }`}
                />
              ) : (
                <div
                  className={`h-8 w-8 rounded-full ring-2 flex items-center justify-center text-xs font-medium transition-all ${
                    isCurrentUser
                      ? 'ring-blue-500 bg-blue-600 text-white'
                      : 'ring-[#0a0a0a] bg-neutral-700 text-neutral-300 group-hover:ring-neutral-700'
                  }`}
                >
                  {initials}
                </div>
              )}

              {/* Online Indicator */}
              {collaborator.isOnline && (
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-[#0a0a0a]" />
              )}

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                {collaborator.displayName || collaborator.email}
                {isCurrentUser && ' (You)'}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
              </div>
            </div>
          );
        })}

        {/* Remaining Count Badge */}
        {remainingCount > 0 && (
          <div
            className="relative -ml-2 group"
            style={{ zIndex: 0 }}
          >
            <div className="h-8 w-8 rounded-full ring-2 ring-[#0a0a0a] bg-neutral-800 text-neutral-300 flex items-center justify-center text-xs font-medium group-hover:ring-neutral-700 transition-all">
              +{remainingCount}
            </div>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
              {remainingCount} more {remainingCount === 1 ? 'person' : 'people'}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
            </div>
          </div>
        )}
      </div>

      {/* Share Button */}
      <button
        onClick={onShareClick}
        className="ml-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Share
      </button>
    </div>
  );
}
