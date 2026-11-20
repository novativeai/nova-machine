import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * GET /api/media?url=<encoded>
 *
 * Same-origin read of the app's own media for in-browser audio work (waveforms, the timeline
 * mixdown). The R2 public bucket and fal storage don't send CORS headers, so the browser can
 * play their files but not decode them. Only those hosts are allowed; anything else is refused.
 */

const FAL_HOST = /(^|\.)fal\.media$/;
const MAX_BYTES = 200 * 1024 * 1024;

function allowedHost(target: URL): boolean {
  if (target.protocol !== 'https:') return false;
  if (FAL_HOST.test(target.hostname)) return true;
  const r2 = process.env.R2_PUBLIC_URL;
  if (!r2) return false;
  try {
    return target.hostname === new URL(r2).hostname;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const limit = checkRateLimit(getClientIp(request), { limit: 120, windowMs: 60_000, prefix: 'media' });
  if (!limit.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const raw = new URL(request.url).searchParams.get('url');
  let target: URL;
  try {
    target = new URL(raw ?? '');
  } catch {
    return NextResponse.json({ error: 'A valid url is required' }, { status: 400 });
  }
  if (!allowedHost(target)) return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });

  const upstream = await fetch(target, { redirect: 'error' });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: 502 });
  }
  const size = Number(upstream.headers.get('content-length') ?? 0);
  if (size > MAX_BYTES) return NextResponse.json({ error: 'File too large' }, { status: 413 });

  return new Response(upstream.body, {
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      ...(size > 0 ? { 'content-length': String(size) } : {}),
      'cache-control': 'private, max-age=3600',
    },
  });
}
