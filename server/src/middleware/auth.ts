/**
 * auth.ts - JWT authentication middleware + auth routes
 *
 * Design (RC-COMPLETION-PLAN "Implement authentication"):
 * - JWT access tokens (15 min) + refresh tokens (7 days), HS256.
 * - POST /api/auth/login    { password } -> { accessToken, refreshToken, expiresIn }
 * - POST /api/auth/refresh  { refreshToken } -> { accessToken, expiresIn }
 * - requireAuth middleware: every other /api route returns 401 without a
 *   valid `Authorization: Bearer <accessToken>` header.
 *
 * Configuration (all env):
 * - JWT_SECRET      secret for signing. If unset, an ephemeral random secret
 *                   is generated at boot (tokens invalidate on restart).
 * - AUTH_PASSWORD   login password. If unset, a random one-time password is
 *                   generated and printed to the server console at boot
 *                   (Jupyter-style), so the server is NEVER fail-open.
 * - AUTH_DISABLED   set to "true" to explicitly opt out (local dev only).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface AuthTokenPayload {
  type: 'access' | 'refresh';
}

export interface AuthConfig {
  disabled: boolean;
  secret: string;
  passwordHash: Buffer;
  generatedPassword: string | null;
}

/**
 * Build auth configuration from environment.
 * Exported for tests; production code uses the module-level singleton below.
 */
export function buildAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const disabled = env.AUTH_DISABLED === 'true';
  const secret = env.JWT_SECRET || randomBytes(32).toString('hex');

  let generatedPassword: string | null = null;
  let password = env.AUTH_PASSWORD;
  if (!password) {
    generatedPassword = randomBytes(16).toString('hex');
    password = generatedPassword;
  }

  return { disabled, secret, passwordHash: createHash('sha256').update(password, 'utf8').digest(), generatedPassword };
}

let activeConfig: AuthConfig | null = null;

/** Initialize (or re-initialize, in tests) the active auth configuration. */
export function initAuth(config: AuthConfig = buildAuthConfig()): AuthConfig {
  activeConfig = config;
  if (config.disabled) {
    console.warn('[auth] AUTH_DISABLED=true — API authentication is OFF. Do not expose this server.');
  } else if (config.generatedPassword) {
    console.log('[auth] No AUTH_PASSWORD set. One-time password for this session:');
    console.log(`[auth]   ${config.generatedPassword}`);
    console.log('[auth] Set AUTH_PASSWORD and JWT_SECRET in the environment for stable credentials.');
  }
  return config;
}

function getConfig(): AuthConfig {
  if (!activeConfig) {
    activeConfig = initAuth();
  }
  return activeConfig;
}

function verifyPassword(candidate: string, config: AuthConfig): boolean {
  const candidateHash = createHash('sha256').update(candidate, 'utf8').digest();
  return timingSafeEqual(candidateHash, config.passwordHash);
}

function signToken(type: AuthTokenPayload['type'], config: AuthConfig): string {
  const expiresIn = type === 'access' ? ACCESS_TOKEN_TTL_SECONDS : REFRESH_TOKEN_TTL_SECONDS;
  return jwt.sign({ type } satisfies AuthTokenPayload, config.secret, { expiresIn });
}

export function verifyToken(token: string, expectedType: AuthTokenPayload['type'], config: AuthConfig): boolean {
  try {
    const payload = jwt.verify(token, config.secret) as AuthTokenPayload & jwt.JwtPayload;
    return payload.type === expectedType;
  } catch {
    return false;
  }
}

function send401(res: Response, message: string): void {
  res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message } });
}

/**
 * Express middleware enforcing a valid Bearer access token.
 * No-op when auth is disabled.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();
  if (config.disabled) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    send401(res, 'Missing Authorization: Bearer token');
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!verifyToken(token, 'access', config)) {
    send401(res, 'Invalid or expired access token');
    return;
  }

  next();
}

/**
 * Router exposing POST /login and POST /refresh.
 * Mounted at /api/auth (NOT behind requireAuth).
 */
export function createAuthRouter(): Router {
  const router = Router();

  router.post('/login', (req: Request, res: Response) => {
    const config = getConfig();
    const password = req.body?.password;
    if (typeof password !== 'string' || password.length === 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'password is required' } });
      return;
    }
    if (!verifyPassword(password, config)) {
      send401(res, 'Invalid password');
      return;
    }
    res.json({
      success: true,
      data: {
        accessToken: signToken('access', config),
        refreshToken: signToken('refresh', config),
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    });
  });

  router.post('/refresh', (req: Request, res: Response) => {
    const config = getConfig();
    const refreshToken = req.body?.refreshToken;
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'refreshToken is required' } });
      return;
    }
    if (!verifyToken(refreshToken, 'refresh', config)) {
      send401(res, 'Invalid or expired refresh token');
      return;
    }
    res.json({
      success: true,
      data: {
        accessToken: signToken('access', config),
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    });
  });

  return router;
}

/** Whether auth is enabled for the active configuration (used by /api/health). */
export function isAuthEnabled(): boolean {
  return !getConfig().disabled;
}

/** Active auth configuration (initializes from env on first use). Used by WS upgrade auth. */
export function getAuthConfig(): AuthConfig {
  return getConfig();
}

/** Test-only: reset the module singleton. */
export function resetAuthForTests(): void {
  activeConfig = null;
}
