import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, verifyIdToken } from '@/lib/firebase-admin';

/**
 * API Route: Mark user as offline
 *
 * Security:
 * - Requires Firebase authentication token
 * - Verifies that the user can only update their own presence
 * - Uses Firebase Admin SDK for privileged database access
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { boardId, collabId, token } = body;

    // Validate required fields
    if (!boardId || !collabId) {
      return NextResponse.json(
        { error: 'Missing required fields: boardId and collabId are required' },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid or expired authentication token' },
        { status: 401 }
      );
    }

    // Verify that the collabId matches the authenticated user
    const expectedCollabId = `${boardId}_${decodedToken.uid}`;
    if (collabId !== expectedCollabId) {
      console.error('CollabId mismatch:', {
        provided: collabId,
        expected: expectedCollabId,
      });
      return NextResponse.json(
        { error: 'Unauthorized: Cannot update presence for another user' },
        { status: 403 }
      );
    }

    // Update presence using Admin SDK
    const db = getAdminDb();
    const collabRef = db
      .collection('boards')
      .doc(boardId)
      .collection('collaborators')
      .doc(collabId);

    await collabRef.update({
      isOnline: false,
      cursorPosition: null,
      lastActiveAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating presence:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to update presence', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update presence' },
      { status: 500 }
    );
  }
}
