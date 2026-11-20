import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { verifyIdToken } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/ai/describe-character
 *
 * Writes the "identity lock" for a character: a short, model-neutral description of the
 * fixed visual traits (face, hair, build, outfit, palette) seen in its reference images.
 * Nova Machine adds it to every prompt that casts the character, so all video, image and
 * lip-sync models keep the same person across scenes.
 */

interface DescribeCharacterRequest {
  name: string;
  kind: 'character' | 'object';
  imageUrls: string[];
}

interface DescribeCharacterResponse {
  appearance: string;
}

const MAX_IMAGES = 5;

function isDescribeRequest(value: unknown): value is DescribeCharacterRequest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' &&
    (v.kind === 'character' || v.kind === 'object') &&
    Array.isArray(v.imageUrls) &&
    v.imageUrls.length > 0 &&
    v.imageUrls.every((u) => typeof u === 'string' && /^https:\/\//.test(u))
  );
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const decoded = await verifyIdToken(authHeader.slice('Bearer '.length));
  if (!decoded) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const limit = checkRateLimit(decoded.uid, { limit: 20, windowMs: 60_000, prefix: 'describe-character' });
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isDescribeRequest(body)) {
    return NextResponse.json({ error: 'Send a name, kind and 1+ https image URLs.' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });
  const subject = body.kind === 'character' ? 'character' : 'object';

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system:
        'You write identity descriptions that image and video generation models use to keep a subject identical across shots. Describe only fixed, visible traits. Never guess names, age numbers, ethnicity labels or personality.',
      messages: [
        {
          role: 'user',
          content: [
            ...body.imageUrls.slice(0, MAX_IMAGES).map((url) => ({
              type: 'image' as const,
              source: { type: 'url' as const, url },
            })),
            {
              type: 'text' as const,
              text: `These images show the same ${subject}, "${body.name}", from different angles. In one paragraph of at most 45 words, describe what must stay identical in every shot: ${
                subject === 'character'
                  ? 'face shape, eyes, skin tone, hair (style, length, colour), build, outfit pieces with colours and materials, and distinctive accessories or marks'
                  : 'shape, materials, colours, markings and proportions'
              }. Plain comma-separated phrases, no preamble, no quotation marks.`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'The description was declined for these images.' }, { status: 422 });
    }
    const appearance = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!appearance) {
      return NextResponse.json({ error: 'No description returned.' }, { status: 502 });
    }
    const result: DescribeCharacterResponse = { appearance };
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Claude API error: ${error.message}` }, { status: error.status || 500 });
    }
    console.error('describe-character failed:', error);
    return NextResponse.json({ error: 'Description failed' }, { status: 500 });
  }
}
