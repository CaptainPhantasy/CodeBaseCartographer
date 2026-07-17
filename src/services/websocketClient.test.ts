/**
 * Tests for WebSocketClient service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WebSocketClient from './websocketClient';

// websocketClient reads the access token from apiClient at connect-time.
// Hoisted mutable state lets each test control the token the mock returns.
const authState = vi.hoisted(() => ({ token: null as string | null }));
vi.mock('./apiClient', () => ({
  getAccessToken: () => authState.token,
}));

/** Resolve once the client reports a live connection (no wall-clock waits). */
function connected(client: WebSocketClient): Promise<void> {
  return new Promise<void>((resolve) => {
    const unsubscribe = client.onConnectionChange((isConnected) => {
      if (isConnected) {
        unsubscribe();
        resolve();
      }
    });
  });
}

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  url: string;

  constructor(url: string) {
    this.url = url;
    // Simulate connection: open on a microtask, after the caller has had a
    // chance to assign onopen (connect() does so synchronously).
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    });
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  // Helper method to simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }
}

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  let originalWebSocket: any;

  beforeEach(() => {
    // Store original WebSocket constructor
    originalWebSocket = global.WebSocket;
    // Replace with mock
    global.WebSocket = MockWebSocket as any;
    authState.token = null;
    client = new WebSocketClient('ws://localhost:3001');
  });

  afterEach(() => {
    client.disconnect();
    global.WebSocket = originalWebSocket;
  });

  it('should create a WebSocket connection', () => {
    expect(client).toBeDefined();
  });

  it('should connect to the server', async () => {
    const handler = vi.fn();
    client.onConnectionChange(handler);
    client.connect();

    await connected(client);
    expect(handler).toHaveBeenCalledWith(true);
  });

  it('should connect with the bare URL when no access token is available', async () => {
    client.connect();
    await connected(client);

    const ws = (client as any).ws as MockWebSocket;
    expect(ws.url).toBe('ws://localhost:3001');
  });

  it('should append the access token to the connection URL', async () => {
    authState.token = 'test-access-token';
    client.connect();
    await connected(client);

    const ws = (client as any).ws as MockWebSocket;
    expect(ws.url).toBe('ws://localhost:3001?access_token=test-access-token');
  });

  it('should receive messages', async () => {
    const messageHandler = vi.fn();
    client.onMessage(messageHandler);
    client.connect();

    await connected(client);
    const ws = (client as any).ws as MockWebSocket;
    ws.simulateMessage({ type: 'file:changed', path: '/test/file.ts', timestamp: Date.now() });

    expect(messageHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'file:changed',
        path: '/test/file.ts'
      })
    );
  });

  it('should unsubscribe from message handlers', () => {
    const handler = vi.fn();
    const unsubscribe = client.onMessage(handler);

    unsubscribe();

    // After unsubscribing, handler should not be called
    // This is verified by the handler not being in the handlers set
    expect((client as any).messageHandlers.has(handler)).toBe(false);
  });

  it('should track connection state', async () => {
    expect(client.isConnected()).toBe(false);

    client.connect();

    await connected(client);
    expect(client.isConnected()).toBe(true);
  });

  it('should start and stop watching', () => {
    client.startWatching();
    expect(client.isActive()).toBe(true);

    client.stopWatching();
    expect(client.isActive()).toBe(false);
  });

  it('should handle multiple message handlers', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    client.onMessage(handler1);
    client.onMessage(handler2);
    client.connect();

    await connected(client);
    const ws = (client as any).ws as MockWebSocket;
    ws.simulateMessage({ type: 'test' });

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it('should disconnect properly', async () => {
    client.connect();

    await connected(client);
    const connectionHandler = vi.fn();
    client.onConnectionChange(connectionHandler);
    client.disconnect();

    expect(client.isConnected()).toBe(false);
    expect(client.isActive()).toBe(false);
  });
});
