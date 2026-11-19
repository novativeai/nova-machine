import { NextRequest, NextResponse } from 'next/server';
import { setAdminStatusByEmail } from '@/lib/firebase-admin';

/**
 * API Route: Set admin status for user
 *
 * SECURITY: Protected by ADMIN_SETUP_SECRET env var.
 * Must be set in .env.local with a strong, unique value.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, secret } = body;

    const ADMIN_SETUP_SECRET = process.env.ADMIN_SETUP_SECRET;

    // Reject if secret not configured or doesn't match
    if (!ADMIN_SETUP_SECRET || ADMIN_SETUP_SECRET === 'change-me-in-production') {
      console.warn('[Admin Setup] Route disabled - set ADMIN_SETUP_SECRET env var');
      return NextResponse.json(
        { error: 'Admin setup route is disabled. Configure ADMIN_SETUP_SECRET.' },
        { status: 503 }
      );
    }

    if (secret !== ADMIN_SETUP_SECRET) {
      console.warn('[Admin Setup] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const success = await setAdminStatusByEmail(email, true);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to set admin status. User may not exist.' },
        { status: 404 }
      );
    }

    console.log(`[Admin Setup] Admin status granted to ${email}`);

    return NextResponse.json({
      success: true,
      message: `Admin status granted to ${email}`,
    });
  } catch (error) {
    console.error('Error setting admin status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
