import { NextRequest, NextResponse } from 'next/server';

// Route segment config for large file uploads
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('[Upload API] Uploading file:', file.name, 'Size:', file.size);

    // Convert File to ArrayBuffer then to Buffer for Node.js compatibility
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get content type
    const contentType = file.type || 'application/octet-stream';

    // Use fal.ai REST API directly for more control
    // First, initiate the upload to get a signed URL
    const initiateResponse = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_name: file.name,
        content_type: contentType,
      }),
    });

    if (!initiateResponse.ok) {
      const error = await initiateResponse.text();
      console.error('[Upload API] Initiate failed:', error);
      throw new Error(`Failed to initiate upload: ${error}`);
    }

    const { upload_url, file_url } = await initiateResponse.json();

    console.log('[Upload API] Got upload URL, uploading...');

    // Upload the file to the signed URL
    const uploadResponse = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error('[Upload API] Upload to storage failed:', error);
      throw new Error(`Failed to upload file: ${error}`);
    }

    console.log('[Upload API] Upload successful:', file_url);

    return NextResponse.json({ url: file_url });
  } catch (error) {
    console.error('[Upload API] Upload failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
