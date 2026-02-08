/**
 * Tests for WebSocketClient service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WebSocketClient from './websocketClient';

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
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
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
    client = new WebSocketClient('ws://localhost:3001');
  });

  afterEach(() => {
    client.disconnect();
    global.WebSocket = originalWebSocket;
  });

  it('should create a WebSocket connection', () => {
    expect(client).toBeDefined();
  });

  it('should connect to the server', (done) => {
    const handler = vi.fn();
    client.onConnectionChange(handler);
    client.connect();

    setTimeout(() => {
      expect(handler).toHaveBeenCalledWith(true);
      done();
    }, 10);
  });

  it('should receive messages', (done) => {
    const messageHandler = vi.fn();
    client.onMessage(messageHandler);
    client.connect();

    setTimeout(() => {
      const ws = (client as any).ws as MockWebSocket;
      ws.simulateMessage({ type: 'file:changed', path: '/test/file.ts', timestamp: Date.now() });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'file:changed',
          path: '/test/file.ts'
        })
      );
      done();
    }, 10);
  });

  it('should unsubscribe from message handlers', () => {
    const handler = vi.fn();
    const unsubscribe = client.onMessage(handler);

    unsubscribe();

    // After unsubscribing, handler should not be called
    // This is verified by the handler not being in the handlers set
    expect((client as any).messageHandlers.has(handler)).toBe(false);
  });

  it('should track connection state', () => {
    expect(client.isConnected()).toBe(false);

    client.connect();

    setTimeout(() => {
      expect(client.isConnected()).toBe(true);
    }, 10);
  });

  it('should start and stop watching', () => {
    client.startWatching();
    expect(client.isActive()).toBe(true);

    client.stopWatching();
    expect(client.isActive()).toBe(false);
  });

  it('should handle multiple message handlers', (done) => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    client.onMessage(handler1);
    client.onMessage(handler2);
    client.connect();

    setTimeout(() => {
      const ws = (client as any).ws as MockWebSocket;
      ws.simulateMessage({ type: 'test' });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      done();
    }, 10);
  });

  it('should disconnect properly', (done) => {
    client.connect();

    setTimeout(() => {
      const connectionHandler = vi.fn();
      client.onConnectionChange(connectionHandler);
      client.disconnect();

      expect(client.isConnected()).toBe(false);
      expect(client.isActive()).toBe(false);
      done();
    }, 10);
  });
});
