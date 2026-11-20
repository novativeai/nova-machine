// Read a media file's bytes in the browser. Direct first (blob:, CORS-enabled hosts); when the
// host sends no CORS headers (R2 public bucket, fal storage) fall back to the same-origin proxy.
export async function fetchMediaBytes(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return (await fetch(url)).arrayBuffer();
  }
  try {
    const direct = await fetch(url, { mode: 'cors' });
    if (direct.ok) return await direct.arrayBuffer();
  } catch {
    // CORS-blocked: use the proxy below
  }
  const proxied = await fetch(`/api/media?url=${encodeURIComponent(url)}`);
  if (!proxied.ok) throw new Error(`Could not read media (${proxied.status})`);
  return proxied.arrayBuffer();
}
