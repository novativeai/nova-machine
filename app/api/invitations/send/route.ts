import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { verifyIdToken } from '@/lib/firebase-admin';
import { InvitationEmail } from '@/emails/InvitationEmail';
import { createElement } from 'react';

// Lazy init to prevent build-time crash when env var is missing
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/**
 * API Route: Send invitation email
 *
 * Security:
 * - Requires Firebase authentication
 * - Only sends emails for valid invitations
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { email, token, boardName, inviterName, authToken } = body;

    // Validate required fields
    if (!email || !token || !boardName || !inviterName) {
      return NextResponse.json(
        { error: 'Missing required fields: email, token, boardName, and inviterName are required' },
        { status: 400 }
      );
    }

    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    try {
      await verifyIdToken(authToken);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid or expired authentication token' },
        { status: 401 }
      );
    }

    // Create invite URL
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${token}`;

    // Calculate expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const expiresAtFormatted = expiresAt.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // Send email using Resend
    const { data, error } = await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'NovaMachine <onboarding@resend.dev>',
      to: email,
      subject: `${inviterName} invited you to collaborate on ${boardName}`,
      react: createElement(InvitationEmail, {
        inviterName,
        boardName,
        inviteUrl,
        expiresAt: expiresAtFormatted,
      }),
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: 'Failed to send email', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id
    });
  } catch (error) {
    console.error('Error sending invitation email:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to send invitation email', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send invitation email' },
      { status: 500 }
    );
  }
}
