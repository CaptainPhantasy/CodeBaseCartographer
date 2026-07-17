/**
 * Behavioral tests for WebSocket upgrade authentication.
 *
 * Spins up a real HTTP server + WebSocketServerManager on an ephemeral port
 * and connects with real ws clients — no mocks. Mirrors the wiring in
 * server.ts start() (WS attached to the HTTP server).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server as HttpServer } from 'http';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { initAuth, buildAuthConfig, resetAuthForTests } from './auth.js';
import { WebSocketServerManager } from '../webSocketServer.js';

const SECRET = 'ws-test-secret';

function signToken(type: 'access' | 'refresh', expiresInSeconds: number): string {
  return jwt.sign({ type }, SECRET, { expiresIn: expiresInSeconds });
}

async function startServer(): Promise<{ httpServer: HttpServer; manager: WebSocketServerManager; baseUrl: string }> {
  const httpServer = createServer();
  const manager = new WebSocketServerManager(0);
  manager.start(httpServer);

  const { promise, resolve } = Promise.withResolvers<{ httpServer: HttpServer; manager: WebSocketServerManager; baseUrl: string }>();
  httpServer.listen(0, '127.0.0.1', () => {
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('No server address');
    resolve({ httpServer, manager, baseUrl: `ws://127.0.0.1:${address.port}` });
  });
  return promise;
}

/** Resolve with the close/error outcome of a connection attempt. */
function attemptConnection(url: string): Promise<{ opened: boolean; closeCode?: number; error?: string }> {
  const { promise, resolve } = Promise.withResolvers<{ opened: boolean; closeCode?: number; error?: string }>();
  const ws = new WebSocket(url);
  let opened = false;
  ws.on('open', () => {
    opened = true;
  });
  ws.on('close', (code) => resolve({ opened, closeCode: code }));
  ws.on('error', (err) => resolve({ opened, error: err.message }));
  return promise;
}

/** Connect and resolve with the first JSON message received. */
function connectAndReadFirstMessage(url: string): Promise<{ ws: WebSocket; message: { type: string } }> {
  const { promise, resolve, reject } = Promise.withResolvers<{ ws: WebSocket; message: { type: string } }>();
  const ws = new WebSocket(url);
  ws.on('message', (data) => resolve({ ws, message: JSON.parse(data.toString()) }));
  ws.on('error', reject);
  return promise;
}

describe('WebSocket upgrade auth', () => {
  let httpServer: HttpServer | null = null;
  let manager: WebSocketServerManager | null = null;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    manager?.stop();
    manager = null;
    if (httpServer) {
      await new Promise((resolve) => httpServer!.close(resolve));
      httpServer = null;
    }
    resetAuthForTests();
    vi.restoreAllMocks();
  });

  it('rejects a connection without an access token (HTTP 401)', async () => {
    initAuth(buildAuthConfig({ AUTH_PASSWORD: 'pw', JWT_SECRET: SECRET }));
    const started = await startServer();
    httpServer = started.httpServer;
    manager = started.manager;

    const result = await attemptConnection(started.baseUrl);
    expect(result.opened).toBe(false);
    expect(result.error).toContain('401');
    expect(manager.getClientCount()).toBe(0);
  });

  it('rejects an expired access token', async () => {
    initAuth(buildAuthConfig({ AUTH_PASSWORD: 'pw', JWT_SECRET: SECRET }));
    const started = await startServer();
    httpServer = started.httpServer;
    manager = started.manager;

    const expired = signToken('access', -10);
    const result = await attemptConnection(`${started.baseUrl}/?access_token=${encodeURIComponent(expired)}`);
    expect(result.opened).toBe(false);
    expect(result.error).toContain('401');
  });

  it('rejects a refresh token used as an access token', async () => {
    initAuth(buildAuthConfig({ AUTH_PASSWORD: 'pw', JWT_SECRET: SECRET }));
    const started = await startServer();
    httpServer = started.httpServer;
    manager = started.manager;

    const refresh = signToken('refresh', 900);
    const result = await attemptConnection(`${started.baseUrl}/?access_token=${encodeURIComponent(refresh)}`);
    expect(result.opened).toBe(false);
    expect(result.error).toContain('401');
  });

  it('accepts a valid access token and sends the welcome message', async () => {
    initAuth(buildAuthConfig({ AUTH_PASSWORD: 'pw', JWT_SECRET: SECRET }));
    const started = await startServer();
    httpServer = started.httpServer;
    manager = started.manager;

    const token = signToken('access', 900);
    const { ws, message } = await connectAndReadFirstMessage(
      `${started.baseUrl}/?access_token=${encodeURIComponent(token)}`
    );
    expect(message.type).toBe('welcome');
    expect(manager.getClientCount()).toBe(1);
    ws.close();
  });

  it('accepts connections without a token when auth is disabled', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    initAuth(buildAuthConfig({ AUTH_DISABLED: 'true' }));
    const started = await startServer();
    httpServer = started.httpServer;
    manager = started.manager;

    const { ws, message } = await connectAndReadFirstMessage(started.baseUrl);
    expect(message.type).toBe('welcome');
    ws.close();
  });
});

/** Wait for the next close event on an already-open WebSocket. */
function waitForClose(ws: WebSocket, timeoutMs = 1000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('close timeout')), timeoutMs);
    ws.once('close', (code: number, reasonBuf: Buffer) => {
      clearTimeout(timer);
      resolve({ code, reason: reasonBuf.toString('utf8') });
    });
  });
}

/** Drive the private heartbeat check by casting around visibility. */
function driveHeartbeat(manager: WebSocketServerManager): void {
  (manager as unknown as { checkConnections: () => void }).checkConnections();
}

describe('WebSocket heartbeat token expiry', () => {
  let httpServer: HttpServer | null = null;
  let manager: WebSocketServerManager | null = null;

  afterEach(async () => {
    manager?.stop();
    manager = null;
    if (httpServer) {
      await new Promise((resolve) => httpServer!.close(resolve));
      httpServer = null;
    }
    resetAuthForTests();
    vi.restoreAllMocks();
  });

  it('closes a live connection when the JWT secret is rotated out from under it', async () => {
    // 1. Init auth with secret A and start the WS server.
    initAuth(buildAuthConfig({ AUTH_PASSWORD: 'pw', JWT_SECRET: 'secret-A' }));
    const started = await startServer();
    httpServer = started.httpServer;
    manager = started.manager;

    // 2. Connect with a token signed under secret A. Token is valid for 15 min,
    //    so the only thing that can invalidate it is a secret rotation.
    const tokenA = jwt.sign({ type: 'access' }, 'secret-A', { expiresIn: 900 });
    const { ws } = await connectAndReadFirstMessage(
      `${started.baseUrl}/?access_token=${encodeURIComponent(tokenA)}`
    );
    expect(manager.getClientCount()).toBe(1);

    // 3. Rotate the auth config to a new secret. The token is unchanged but
    //    verifyToken will now reject it. The websocket library has not received
    //    any new upgrade since the rotation — this exercises the heartbeat
    //    path, not the upgrade path.
    initAuth(buildAuthConfig({ AUTH_PASSWORD: 'pw', JWT_SECRET: 'secret-B' }));

    // 4. Drive the heartbeat and assert the client gets the 1008 close
    //    with the documented reason.
    const closePromise = waitForClose(ws);
    driveHeartbeat(manager);
    const close = await closePromise;

    expect(close.code).toBe(1008);
    expect(close.reason).toBe('Token expired');
    expect(manager.getClientCount()).toBe(0);
  });

  it('closes a live connection when the access token has actually expired', async () => {
    // 1. Init auth and start the server.
    initAuth(buildAuthConfig({ AUTH_PASSWORD: 'pw', JWT_SECRET: SECRET }));
    const started = await startServer();
    httpServer = started.httpServer;
    manager = started.manager;

    // 2. Connect with a token that expires in 1 second. The token is
    //    valid at upgrade time (so we get the welcome message), but the
    //    heartbeat will see it as invalid after ~1s.
    const shortLived = jwt.sign({ type: 'access' }, SECRET, { expiresIn: 1 });
    const { ws } = await connectAndReadFirstMessage(
      `${started.baseUrl}/?access_token=${encodeURIComponent(shortLived)}`
    );
    expect(manager.getClientCount()).toBe(1);

    // 3. Wait past the expiry, then drive the heartbeat.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const closePromise = waitForClose(ws);
    driveHeartbeat(manager);

    const close = await closePromise;
    expect(close.code).toBe(1008);
    expect(close.reason).toBe('Token expired');
    expect(manager.getClientCount()).toBe(0);
  });
});
