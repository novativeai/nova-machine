import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase-admin';
import { persistRemoteUrlToR2 } from '@/lib/r2';

/**
 * POST /api/r2/persist
 *
 * Download a remote URL (e.g., fal.ai generated output) and persist it to R2.
 * This prevents fal.ai temporary URL expiration from breaking saved canvases.
 *
 * Supports batch persistence: pass an array of URLs.
 *
 * Request: { urls: Array<{ url: string, category?: string }> }
 * Auth: Firebase ID token in Authorization header
 * Response: { results: Array<{ originalUrl, r2Url, key } | { originalUrl, error }> }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization' },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = await verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // 2. Parse request
    const body = await req.json();
    const urls: Array<{
      url: string;
      category?: 'uploads' | 'outputs' | 'characters';
    }> = body.urls;

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty urls array' },
        { status: 400 }
      );
    }

    // Cap at 10 per request to prevent abuse
    if (urls.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 URLs per request' },
        { status: 400 }
      );
    }

    // 3. Persist each URL (concurrent)
    const results = await Promise.allSettled(
      urls.map(async ({ url, category }) => {
        // Skip if already an R2 URL
        const r2PublicUrl = process.env.R2_PUBLIC_URL || '';
        if (url.startsWith(r2PublicUrl)) {
          return { originalUrl: url, r2Url: url, key: '', alreadyPersisted: true };
        }

        const result = await persistRemoteUrlToR2(
          url,
          userId,
          category || 'outputs'
        );
        return {
          originalUrl: url,
          r2Url: result.url,
          key: result.key,
        };
      })
    );

    const response = results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        originalUrl: urls[i].url,
        error: result.reason instanceof Error
          ? result.reason.message
          : 'Persist failed',
      };
    });

    return NextResponse.json({ results: response });
  } catch (error) {
    console.error('[r2/persist] Error:', error);
    const message = error instanceof Error ? error.message : 'Persist failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
