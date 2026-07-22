/**
 * apiClient.ts - Authenticated fetch wrapper for the backend API
 *
 * The backend (server/src/middleware/auth.ts) protects every /api route with
 * JWT Bearer auth. This module owns the token lifecycle on the client:
 *
 * - access token: in-memory only (never persisted)
 * - refresh token: sessionStorage (cleared when the browser closes)
 * - apiFetch(): attaches Authorization, transparently refreshes the access
 *   token once on 401, and emits `server-auth-required` when interactive
 *   login is needed (ServerAuthGate listens for it).
 */

export const SERVER_AUTH_REQUIRED_EVENT = 'server-auth-required';
export const SERVER_AUTH_SUCCESS_EVENT = 'server-auth-success';

const REFRESH_TOKEN_STORAGE_KEY = 'cartographer_server_refresh_token';

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

interface TokenResponse {
  success: boolean;
  data?: { accessToken: string; refreshToken?: string; expiresIn: number };
  error?: { code: string; message: string };
}

function getRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeTokens(access: string, refresh?: string): void {
  accessToken = access;
  if (refresh) {
    try {
      sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refresh);
    } catch {
      // sessionStorage unavailable (private mode) — access token still works in-memory
    }
  }
}

export function clearServerTokens(): void {
  accessToken = null;
  try {
    sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Current in-memory access token, or null when not authenticated.
 * Used by the WebSocket client to authenticate the upgrade request
 * (browsers cannot set custom headers on WebSocket connections).
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Derive the API origin ('' for same-origin/relative URLs) from a request URL. */
function apiOrigin(url: string): string {
  if (url.startsWith('/')) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/**
 * Login against the backend. On success, tokens are stored and
 * `server-auth-success` is dispatched so data hooks can refetch.
 */
export async function serverLogin(password: string, origin: string = ''): Promise<{ ok: boolean; message?: string }> {
  const response = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const body = (await response.json()) as TokenResponse;
  if (!response.ok || !body.data) {
    return { ok: false, message: body.error?.message ?? `Login failed (HTTP ${response.status})` };
  }
  storeTokens(body.data.accessToken, body.data.refreshToken);
  window.dispatchEvent(new CustomEvent(SERVER_AUTH_SUCCESS_EVENT));
  return { ok: true };
}

/** Exchange the stored refresh token for a new access token. Deduplicates concurrent refreshes. */
async function refreshAccessToken(origin: string): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${origin}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;
      const body = (await response.json()) as TokenResponse;
      if (!body.data) return false;
      storeTokens(body.data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * Drop-in replacement for fetch() against the backend API.
 * Attaches the Bearer token, refreshes once on 401, and notifies the auth
 * gate when interactive login is required. Returns the final Response so
 * existing call-site error handling keeps working.
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const origin = apiOrigin(url);

  const request = (token: string | null): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  let response = await request(accessToken);
  if (response.status !== 401) return response;

  // Access token missing/expired — try a silent refresh, then retry once.
  if (await refreshAccessToken(origin)) {
    response = await request(accessToken);
    if (response.status !== 401) return response;
  }

  clearServerTokens();
  window.dispatchEvent(new CustomEvent(SERVER_AUTH_REQUIRED_EVENT, { detail: { origin } }));
  return response;
}
