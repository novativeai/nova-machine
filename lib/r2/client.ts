import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';
import { AUDIO_MAX_BYTES, AUDIO_MIME_EXTENSIONS } from '@/lib/media/audio';

// ============================================================================
// CLOUDFLARE R2 CLIENT - SERVER SIDE ONLY
// ============================================================================

let _client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!_client) {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'Missing R2 configuration. Required: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY'
      );
    }

    _client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return _client;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error('Missing R2_BUCKET_NAME');
  return bucket;
}

function getPublicUrl(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) throw new Error('Missing R2_PUBLIC_URL');
  return url.replace(/\/$/, ''); // strip trailing slash
}

// ============================================================================
// FILE TYPE HELPERS
// ============================================================================

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
];

const ALLOWED_AUDIO_TYPES = Object.keys(AUDIO_MIME_EXTENSIONS);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function getExtensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    ...AUDIO_MIME_EXTENSIONS,
  };
  return map[contentType] || 'bin';
}

function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    if (ext && ext.length <= 5 && ext.length >= 2) return ext;
  } catch {
    // ignore
  }
  return 'bin';
}

// ============================================================================
// UPLOAD OPERATIONS
// ============================================================================

export interface R2UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

/**
 * Upload a file buffer directly to R2.
 *
 * @param buffer - File data
 * @param contentType - MIME type
 * @param userId - Owner's Firebase UID (used as path prefix for isolation)
 * @param category - Organizational subfolder (uploads, outputs, characters)
 */
export async function uploadFileToR2(
  buffer: Buffer,
  contentType: string,
  userId: string,
  category: 'uploads' | 'outputs' | 'characters' = 'uploads'
): Promise<R2UploadResult> {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${buffer.length} bytes (max ${MAX_FILE_SIZE})`);
  }

  const isImage = ALLOWED_IMAGE_TYPES.includes(contentType);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType);
  const isAudio = ALLOWED_AUDIO_TYPES.includes(contentType);

  if (!isImage && !isVideo && !isAudio) {
    throw new Error(`Unsupported file type: ${contentType}`);
  }
  if (isAudio && buffer.length > AUDIO_MAX_BYTES) {
    throw new Error(`Audio too large: max ${AUDIO_MAX_BYTES / (1024 * 1024)} MB`);
  }

  const ext = getExtensionFromContentType(contentType);
  const key = `${userId}/${category}/${nanoid(12)}.${ext}`;

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return {
    key,
    url: `${getPublicUrl()}/${key}`,
    size: buffer.length,
    contentType,
  };
}

/**
 * Persist a remote URL (e.g., fal.ai generated output) to R2.
 * Downloads the file from the remote URL and re-uploads to R2 for permanent storage.
 *
 * This is the critical function that prevents fal.ai URL expiration from breaking canvases.
 */
export async function persistRemoteUrlToR2(
  remoteUrl: string,
  userId: string,
  category: 'uploads' | 'outputs' | 'characters' = 'outputs'
): Promise<R2UploadResult> {
  // Download from remote
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to download from ${remoteUrl}: ${response.status}`);
  }

  const contentType =
    response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Determine extension from content type or URL
  let ext = getExtensionFromContentType(contentType);
  if (ext === 'bin') {
    ext = getExtensionFromUrl(remoteUrl);
  }

  const key = `${userId}/${category}/${nanoid(12)}.${ext}`;

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return {
    key,
    url: `${getPublicUrl()}/${key}`,
    size: buffer.length,
    contentType,
  };
}

/**
 * Delete a file from R2 by key.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}

/**
 * Check if a file exists in R2.
 */
export async function existsInR2(key: string): Promise<boolean> {
  const client = getR2Client();
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a URL is an R2 public URL.
 */
export function isR2Url(url: string): boolean {
  const publicUrl = process.env.R2_PUBLIC_URL || '';
  return url.startsWith(publicUrl);
}
