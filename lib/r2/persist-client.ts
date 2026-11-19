/**
 * Client-side helper to persist remote URLs to R2.
 * Called after fal.ai generation completes to make output URLs permanent.
 *
 * Data flow:
 * 1. fal.ai generates media → returns temporary fal.ai CDN URL
 * 2. Client calls persistUrlsToR2() with the fal.ai URLs
 * 3. Server downloads from fal.ai → re-uploads to R2
 * 4. Returns permanent R2 public URLs
 * 5. Client updates node data with R2 URLs
 */

export interface PersistResult {
  originalUrl: string;
  r2Url: string;
  key: string;
  alreadyPersisted?: boolean;
}

export interface PersistError {
  originalUrl: string;
  error: string;
}

export type PersistResponse = PersistResult | PersistError;

function isPersistError(r: PersistResponse): r is PersistError {
  return 'error' in r;
}

/**
 * Persist one or more remote URLs to R2.
 * Returns a map of originalUrl → r2Url for successful persists.
 * Silently logs failures but doesn't throw (generation output is still usable short-term).
 */
export async function persistUrlsToR2(
  authToken: string,
  urls: Array<{ url: string; category?: 'uploads' | 'outputs' | 'characters' }>
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  if (urls.length === 0) return urlMap;

  // Filter out empty/blob URLs
  const validUrls = urls.filter(
    ({ url }) => url && !url.startsWith('blob:') && url.startsWith('http')
  );

  if (validUrls.length === 0) return urlMap;

  try {
    const response = await fetch('/api/r2/persist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ urls: validUrls }),
    });

    if (!response.ok) {
      console.error('[R2 Persist] API error:', response.status);
      return urlMap;
    }

    const data = await response.json();
    const results: PersistResponse[] = (data as { results: PersistResponse[] }).results || [];

    for (const result of results) {
      if (!isPersistError(result)) {
        urlMap.set(result.originalUrl, result.r2Url);
      } else {
        console.warn('[R2 Persist] Failed for:', result.originalUrl, result.error);
      }
    }
  } catch (error) {
    console.error('[R2 Persist] Network error:', error);
  }

  return urlMap;
}

/**
 * Persist a single URL to R2. Convenience wrapper.
 */
export async function persistSingleUrlToR2(
  authToken: string,
  url: string,
  category: 'uploads' | 'outputs' | 'characters' = 'outputs'
): Promise<string> {
  const map = await persistUrlsToR2(authToken, [{ url, category }]);
  return map.get(url) || url; // Fall back to original if persist fails
}
