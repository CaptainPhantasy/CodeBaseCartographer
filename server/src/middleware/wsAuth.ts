/**
 * wsAuth.ts - WebSocket upgrade authentication
 *
 * WebSocket connections bypass the Express middleware chain (the browser
 * sends an HTTP Upgrade request that the ws library handles directly), so
 * the access token must be validated on the upgrade request itself.
 *
 * The token travels as a query parameter (?access_token=...) because the
 * browser WebSocket() constructor cannot set custom request headers.
 */

import type { IncomingMessage } from 'http';
import { URL } from 'url';
import { verifyToken, isAuthEnabled, getAuthConfig } from './auth.js';

/**
 * Extract the access token from the WebSocket upgrade URL.
 * Returns null if no token is present.
 */
export function extractToken(req: IncomingMessage): string | null {
  if (!req.url) return null;
  const parsed = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  return parsed.searchParams.get('access_token');
}

/**
 * Verify the upgrade request. No-op (returns true) when auth is disabled.
 */
export function verifyUpgrade(req: IncomingMessage): boolean {
  if (!isAuthEnabled()) return true;
  const token = extractToken(req);
  if (!token) return false;
  return verifyToken(token, 'access', getAuthConfig());
}
