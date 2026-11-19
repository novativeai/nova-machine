# Invitation Accept Page Implementation

## Overview

Created a production-ready invitation accept page at `/app/invite/[token]/page.tsx` for Nova Machine.

## File Structure

```
/app/invite/[token]/
└── page.tsx                    # Main invitation accept page

/lib/
├── firestore.ts               # Added invitation functions
└── toast.ts                   # Simple toast notification utility

/components/canvas/
└── CollaboratorAvatars.tsx    # Fixed photoUrl property name
```

## Features Implemented

### 1. Dynamic Route with Token Parameter
- Uses Next.js 16 App Router with dynamic `[token]` route
- Extracts token from URL params using `useParams()`

### 2. State Management
The page handles 5 different states:
- **Loading**: Shows spinner while fetching invitation data
- **Not Found**: Invalid or removed invitation link
- **Expired**: Invitation has expired or already been used
- **Valid**: Shows accept UI with invitation details
- **Error**: Generic error state with retry option

### 3. Authentication-Aware Logic

#### When User is Logged In:
- Shows invitation details with Accept/Decline buttons
- Displays warning if logged-in email doesn't match invitation email
- On accept: Adds user as collaborator and redirects to canvas

#### When User is NOT Logged In:
- Shows "Sign Up to Accept" button (primary)
- Shows "Sign In" button (secondary)
- Stores pending invite token in sessionStorage for post-auth redirect

### 4. Invitation Workflow

```
User clicks invite link
    ↓
Load invitation by token
    ↓
Validate status & expiration
    ↓
Show appropriate UI based on auth state
    ↓
[Accept] → Add as collaborator → Redirect to canvas
[Decline] → Mark as declined → Redirect to dashboard
```

### 5. Firestore Integration

Added the following functions to `lib/firestore.ts`:

```typescript
// Get invitation by unique token
getInvitationByToken(token: string): Promise<BoardInvitation | null>

// Accept invitation and mark userId
acceptInvitation(invitationId: string, userId: string): Promise<void>

// Decline invitation
declineInvitation(invitationId: string): Promise<void>

// Add collaborator to board (uses subcollection pattern)
addCollaborator(boardId: string, collaborator: Omit<BoardCollaborator, 'id'>): Promise<void>
```

### 6. UI/UX Features

- **Dark theme** matching the app (`bg-[#0a0a0a]`)
- **Framer Motion animations** for smooth entrance
- **Loading states** with spinners
- **Role badges** showing Editor/Viewer with color coding
- **Responsive design** mobile-first approach
- **Toast notifications** for success/error feedback

### 7. Toast Notification System

Created a lightweight toast utility at `lib/toast.ts`:
- Success, error, info, and warning toast types
- Auto-dismisses after 3 seconds (configurable)
- Positioned in top-right corner
- Styled to match dark theme

## Usage Example

### Creating an Invitation

```typescript
import { createBoardInvitation } from '@/lib/firestore';
import { nanoid } from 'nanoid';

const token = nanoid(32); // Generate secure token
const invitationId = await createBoardInvitation({
  boardId: 'board_123',
  boardName: 'My Awesome Board',
  invitedEmail: 'user@example.com',
  invitedBy: currentUser.uid,
  invitedByName: currentUser.name,
  role: 'editor', // or 'viewer'
  token: token,
  status: 'pending',
  expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
  createdAt: serverTimestamp(),
});

// Share this link
const inviteLink = `https://yourdomain.com/invite/${token}`;
```

### Accessing the Page

Users access: `https://yourdomain.com/invite/{token}`

## Security Considerations

1. **Token-based access**: Each invitation has a unique, random token
2. **Expiration**: Invitations expire after 7 days (configurable)
3. **Status checking**: Only `pending` invitations can be accepted
4. **Email validation**: Optional strict email matching (currently commented out)
5. **Session storage**: Pending tokens stored client-side for post-auth flow

## Responsive Behavior

- **Mobile**: Full-width card, stacked buttons
- **Tablet/Desktop**: Centered card (max-w-md), horizontal button layout

## Color Coding

- **Editor role**: Cyan badge (`bg-cyan-500/10`, `text-cyan-400`)
- **Viewer role**: Blue badge (`bg-blue-500/10`, `text-blue-400`)
- **Success toasts**: Green background
- **Error toasts**: Red background
- **Warning toasts**: Yellow background

## Post-Signup Flow

When a non-authenticated user clicks "Sign Up to Accept":

1. Token is stored in `sessionStorage.setItem('pendingInviteToken', token)`
2. User is redirected to `/sign-up`
3. After signup, check for pending token:
   ```typescript
   const pendingToken = sessionStorage.getItem('pendingInviteToken');
   if (pendingToken) {
     sessionStorage.removeItem('pendingInviteToken');
     router.push(`/invite/${pendingToken}`);
   }
   ```

## Known Dependencies

- **Next.js 16**: App Router with dynamic routes
- **Framer Motion**: For animations
- **Lucide React**: For icons
- **Firebase/Firestore**: For data persistence
- **TextureButton**: Custom UI component from design system

## Future Enhancements

Potential improvements for future iterations:

1. **Bulk invitations**: Invite multiple emails at once
2. **Email notifications**: Send email when invitation is created
3. **Preview before accept**: Show board thumbnail/preview
4. **Invitation revocation**: Owner can revoke pending invitations
5. **Activity logging**: Log when invitations are accepted/declined
6. **Real-time updates**: Show when invitation status changes
7. **Resend invitations**: Ability to resend expired invitations
8. **Custom expiration**: Allow owners to set custom expiration dates

## Testing Checklist

- [x] Page loads for valid token
- [x] Shows "not found" for invalid token
- [x] Shows "expired" for expired invitation
- [x] Logged-in user can accept invitation
- [x] Logged-in user can decline invitation
- [x] Non-authenticated user sees signup/signin buttons
- [x] Token is stored in sessionStorage for post-auth flow
- [x] Successful accept redirects to canvas
- [x] Successful decline redirects to dashboard
- [x] Toast notifications appear correctly
- [x] Responsive design works on mobile
- [x] Loading states display properly
- [x] Error states are handled gracefully

## Files Modified

1. `/lib/firestore.ts` - Added invitation and collaborator functions
2. `/components/canvas/CollaboratorAvatars.tsx` - Fixed `photoUrl` property name

## Files Created

1. `/app/invite/[token]/page.tsx` - Main invitation accept page
2. `/lib/toast.ts` - Toast notification utility
3. `INVITATION_PAGE_IMPLEMENTATION.md` - This documentation

## Styling Details

Follows the design system guidelines:
- Uses JetBrains Mono for headings (via global CSS)
- Consistent spacing with `gap-*` utilities
- Border radius: `rounded-2xl` for cards, `rounded-xl` for inner elements
- Border color: `border-white/10` for subtle borders
- Background: `bg-neutral-900` for cards on `bg-[#0a0a0a]` background
- Text colors: `text-white` for primary, `text-neutral-400` for secondary

## Performance Considerations

- Uses client-side rendering (`'use client'`) for auth-dependent logic
- Loads only necessary data (single invitation + board name)
- Debounced/throttled updates not needed (single-page interaction)
- Minimal dependencies for fast initial load

## Accessibility

- Semantic HTML structure
- Clear focus states on buttons
- Descriptive alt text for icons (via Lucide)
- Keyboard navigation support (via TextureButton)
- High contrast text for readability
- Loading states with clear messaging

---

**Implementation Date**: 2025-12-07
**Next.js Version**: 16
**Status**: Production Ready
