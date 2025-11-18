import { rateLimitConfig, isProduction } from '@/lib/env';
import { logger } from '@/services/logger';

type BucketKey = string;

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitStore>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const key of Array.from(store.keys())) {
    const value = store.get(key);
    if (value && value.resetTime < now) {
      store.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`Rate limit cleanup: removed ${cleaned} expired entries`);
  }
}, 5 * 60 * 1000);

function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers (for proxied requests)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Fallback for development
  return isProduction ? 'unknown' : '127.0.0.1';
}

function getClientKey(request: Request, scope: string): BucketKey {
  const identifier = getClientIdentifier(request);
  const path = new URL(request.url).pathname;
  return `${scope}:${identifier}:${path}`;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
  limit: number;
  resetTime: number;
}

/**
 * Rate limit function with configurable options
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  message?: string;
}): (request: Request, scope: string) => RateLimitResult {
  return (request: Request, scope: string): RateLimitResult => {
    const identifier = getClientIdentifier(request);
    const key = getClientKey(request, scope);
    const now = Date.now();
    const path = new URL(request.url).pathname;

    let record = store.get(key);

    // Initialize or reset if window expired
    if (!record || record.resetTime < now) {
      record = {
        count: 0,
        resetTime: now + options.windowMs,
      };
      store.set(key, record);
    }

    record.count++;

    const remaining = Math.max(0, options.max - record.count);
    const resetTime = Math.ceil(record.resetTime / 1000);
    const resetInMs = record.resetTime - now;

    // Check if limit exceeded
    if (record.count > options.max) {
      logger.warn('Rate limit exceeded', {
        ip: identifier,
        path,
        count: record.count,
        limit: options.max,
        scope,
      });

      return {
        allowed: false,
        remaining: 0,
        resetInMs,
        limit: options.max,
        resetTime,
      };
    }

    logger.debug('Rate limit check passed', {
      ip: identifier,
      path,
      count: record.count,
      limit: options.max,
      remaining,
      scope,
    });

    return {
      allowed: true,
      remaining,
      resetInMs,
      limit: options.max,
      resetTime,
    };
  };
}

/**
 * Legacy enforceRateLimit function for backward compatibility
 * Uses default rate limit config from environment
 */
export function enforceRateLimit(request: Request, scope: string): RateLimitResult {
  const identifier = getClientIdentifier(request);
  const key = getClientKey(request, scope);
  const now = Date.now();
  const path = new URL(request.url).pathname;

  let record = store.get(key);

  // Initialize or reset if window expired
  if (!record || record.resetTime < now) {
    record = {
      count: 0,
      resetTime: now + rateLimitConfig.windowMs,
    };
    store.set(key, record);
  }

  record.count++;

  const remaining = Math.max(0, rateLimitConfig.maxRequests - record.count);
  const resetTime = Math.ceil(record.resetTime / 1000);
  const resetInMs = record.resetTime - now;

  // Check if limit exceeded
  if (record.count > rateLimitConfig.maxRequests) {
    logger.warn('Rate limit exceeded', {
      ip: identifier,
      path,
      count: record.count,
      limit: rateLimitConfig.maxRequests,
      scope,
    });

    return {
      allowed: false,
      remaining: 0,
      resetInMs,
      limit: rateLimitConfig.maxRequests,
      resetTime,
    };
  }

  logger.debug('Rate limit check passed', {
    ip: identifier,
    path,
    count: record.count,
    limit: rateLimitConfig.maxRequests,
    remaining,
    scope,
  });

  return {
    allowed: true,
    remaining,
    resetInMs,
    limit: rateLimitConfig.maxRequests,
    resetTime,
  };
}

/**
 * Helper function to create rate limit headers object for NextResponse
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
  };
}