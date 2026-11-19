import { NextRequest, NextResponse } from 'next/server';
import { resolveAudioMime } from '@/lib/media/audio';
import { verifyIdToken } from '@/lib/firebase-admin';
import { uploadFileToR2 } from '@/lib/r2';

/**
 * POST /api/r2/upload
 *
 * Upload a file directly to R2.
 * Used by useBackgroundUpload for user-uploaded images/videos.
 *
 * Request: FormData with `file` field
 * Auth: Firebase ID token in Authorization header
 * Response: { url, key, size, contentType }
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

    // 2. Parse file from FormData
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Normalise audio MIME aliases / empty types (e.g. .m4a reported as '') from the file name
    const fileName = file instanceof File ? file.name : '';
    const contentType = resolveAudioMime(file.type, fileName) ?? (file.type || 'application/octet-stream');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Upload to R2
    const result = await uploadFileToR2(buffer, contentType, userId, 'uploads');

    return NextResponse.json({
      url: result.url,
      key: result.key,
      size: result.size,
      contentType: result.contentType,
    });
  } catch (error) {
    console.error('[r2/upload] Error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
