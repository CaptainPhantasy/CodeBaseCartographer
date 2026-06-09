/**
 * Behavioral tests for security middleware: JWT auth + rate limiting.
 *
 * Spins up a real express app on an ephemeral port and exercises it over
 * HTTP — no mocks. Mirrors the wiring in server.ts setupMiddleware/setupRoutes.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import express from 'express';
import type { Server as HttpServer } from 'http';
import { initAuth, buildAuthConfig, requireAuth, createAuthRouter, resetAuthForTests } from './auth.js';
import { createApiLimiter } from './rateLimit.js';

interface ErrorBody {
  error: { code: string; message: string };
}

interface TokenBody {
  data: { accessToken: string; refreshToken?: string; expiresIn: number };
}

async function listen(app: express.Application): Promise<{ server: HttpServer; baseUrl: string }> {
  const { promise, resolve } = Promise.withResolvers<{ server: HttpServer; baseUrl: string }>();
  const server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected AddressInfo from ephemeral listen');
    }
    resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
  });
  return promise;
}

/** Build an app wired the same way as Server.setupRoutes: open auth routes, gated API. */
function buildAuthedApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter());
  app.use('/api', requireAuth);
  app.get('/api/protected', (req, res) => {
    res.json({ success: true, data: 'secret' });
  });
  return app;
}

describe('auth middleware', () => {
  let server: HttpServer | null = null;

  afterEach(() => {
    server?.close();
    server = null;
    resetAuthForTests();
    vi.restoreAllMocks();
  });

  it('returns 401 for protected routes without a token', async () => {
    initAuth(buildAuthConfig({ AUTH_PASSWORD: 'correct-horse', JWT_SECRET: 'test-secret' }));
    const started = await listen(buildAuthedApp());
    server = started.server;

    const response = await fetch(`${started.baseUrl}/api/protected`);
    expect(response.status).toBe(401);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects login with a wrong password and missing password', async () => {
    initAuth(buildAuthConfig({ AUTH_PASSWORD: 'correct-horse', JWT_SECRET: 'test-secret' }));
    const started = await listen(buildAuthedApp());
    server = started.server;

    const wrong = await fetch(`${started.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
    expect(wrong.status).toBe(401);

    const missing = await fetch(`${started.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(missing.status).toBe(400);
  });

  it('grants access with a token from login and refreshes access tokens', async () => {
    initAuth(buildAuthConfig({ AUTH_PASSWORD: 'correct-horse', JWT_SECRET: 'test-secret' }));
    const started = await listen(buildAuthedApp());
    server = started.server;

    const login = await fetch(`${started.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-horse' }),
    });
    expect(login.status).toBe(200);
    const { data } = (await login.json()) as TokenBody;
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();

    const granted = await fetch(`${started.baseUrl}/api/protected`, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    expect(granted.status).toBe(200);

    // Refresh token must not work as an access token
    const wrongType = await fetch(`${started.baseUrl}/api/protected`, {
      headers: { Authorization: `Bearer ${data.refreshToken}` },
    });
    expect(wrongType.status).toBe(401);

    const refresh = await fetch(`${started.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: data.refreshToken }),
    });
    expect(refresh.status).toBe(200);
    const refreshed = (await refresh.json()) as TokenBody;

    const grantedAgain = await fetch(`${started.baseUrl}/api/protected`, {
      headers: { Authorization: `Bearer ${refreshed.data.accessToken}` },
    });
    expect(grantedAgain.status).toBe(200);
  });

  it('rejects garbage bearer tokens', async () => {
    initAuth(buildAuthConfig({ AUTH_PASSWORD: 'pw', JWT_SECRET: 'secret-a' }));
    const started = await listen(buildAuthedApp());
    server = started.server;

    const garbage = await fetch(`${started.baseUrl}/api/protected`, {
      headers: { Authorization: 'Bearer not.a.jwt' },
    });
    expect(garbage.status).toBe(401);
  });

  it('skips enforcement when AUTH_DISABLED=true', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    initAuth(buildAuthConfig({ AUTH_DISABLED: 'true' }));
    const started = await listen(buildAuthedApp());
    server = started.server;

    const response = await fetch(`${started.baseUrl}/api/protected`);
    expect(response.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('generates a one-time password when AUTH_PASSWORD is unset and stays fail-closed', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const config = initAuth(buildAuthConfig({ JWT_SECRET: 'test-secret' }));
    expect(config.generatedPassword).toBeTruthy();
    const started = await listen(buildAuthedApp());
    server = started.server;

    // Still 401 without token
    const blocked = await fetch(`${started.baseUrl}/api/protected`);
    expect(blocked.status).toBe(401);

    // Generated password works for login
    const login = await fetch(`${started.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: config.generatedPassword }),
    });
    expect(login.status).toBe(200);
    expect(logSpy).toHaveBeenCalled();
  });
});

describe('rate limiting', () => {
  let server: HttpServer | null = null;

  afterEach(() => {
    server?.close();
    server = null;
  });

  it('returns 429 with standard headers once the limit is exceeded', async () => {
    const app = express();
    app.use('/api', createApiLimiter({ windowMs: 60_000, limit: 3, message: 'slow down' }));
    app.get('/api/thing', (req, res) => {
      res.json({ success: true });
    });
    const started = await listen(app);
    server = started.server;

    for (let i = 0; i < 3; i++) {
      const ok = await fetch(`${started.baseUrl}/api/thing`);
      expect(ok.status).toBe(200);
    }

    const limited = await fetch(`${started.baseUrl}/api/thing`);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('ratelimit')).toBeTruthy();
    const body = (await limited.json()) as ErrorBody;
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});
