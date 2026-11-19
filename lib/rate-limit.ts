/**
 * Simple in-memory rate limiter for API routes
 * Uses a sliding window approach to limit requests per IP
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limit entries
// Key: identifier (IP or user ID), Value: rate limit entry
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Start cleanup interval (only in Node.js environment)
if (typeof global !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional prefix for the key (e.g., 'upload', 'proxy') */
  prefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is rate limited
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const { limit, windowMs, prefix = '' } = config;
  const key = prefix ? `${prefix}:${identifier}` : identifier;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  // If no entry or entry has expired, create a new one
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, newEntry);

    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Increment the count
  entry.count += 1;

  // Check if rate limited
  if (entry.count > limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    success: true,
    limit,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get client IP from request headers
 * Handles various proxy configurations
 */
export function getClientIp(request: Request): string {
  // Check common headers for client IP (in order of preference)
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to a generic identifier if no IP is found
  return 'unknown';
}

// Default rate limit configurations
export const RATE_LIMITS = {
  /** Upload endpoint: 20 requests per minute */
  upload: {
    limit: 20,
    windowMs: 60 * 1000, // 1 minute
    prefix: 'upload',
  },
  /** Proxy endpoint: 60 requests per minute */
  proxy: {
    limit: 60,
    windowMs: 60 * 1000, // 1 minute
    prefix: 'proxy',
  },
  /** Generation endpoint: 10 requests per minute */
  generation: {
    limit: 10,
    windowMs: 60 * 1000, // 1 minute
    prefix: 'generation',
  },
} as const;
