/**
 * rateLimit.ts - Rate limiting middleware
 *
 * Two tiers per RC-COMPLETION-PLAN:
 * - general: 100 requests / 15 minutes for all /api routes
 * - strict:  10 requests / minute for upstream-proxy endpoints (ElevenLabs)
 *
 * Limits are env-overridable so tests and local power users can tune them
 * without code changes.
 */

import { rateLimit } from 'express-rate-limit';
import type { RateLimitRequestHandler } from 'express-rate-limit';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface ApiLimiterOptions {
  windowMs: number;
  limit: number;
  message: string;
}

/**
 * Standard limiter shape for this API: RFC draft-7 headers, JSON error body
 * matching the errorHandler envelope. Exported so tests can build limiters
 * with tight limits.
 */
export function createApiLimiter(options: ApiLimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: options.message } },
  });
}

/** 100 req / 15 min per IP — applied to all /api routes. */
export const generalLimiter = createApiLimiter({
  windowMs: envInt('RATE_LIMIT_GENERAL_WINDOW_MS', 15 * 60 * 1000),
  limit: envInt('RATE_LIMIT_GENERAL_MAX', 100),
  message: 'Too many requests, please try again later.',
});

/** 10 req / min per IP — applied to upstream API proxy endpoints. */
export const strictLimiter = createApiLimiter({
  windowMs: envInt('RATE_LIMIT_STRICT_WINDOW_MS', 60 * 1000),
  limit: envInt('RATE_LIMIT_STRICT_MAX', 10),
  message: 'Proxy rate limit exceeded, please slow down.',
});
