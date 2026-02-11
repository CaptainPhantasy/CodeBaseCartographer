/**
 * WebSocket Client for real-time file watching
 * Connects to backend WebSocket server to receive file change events
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat/ping-pong for connection health monitoring
 * - Server session tracking
 * - Graceful handling of server restarts
 */

export type FileChangeEvent = {
  type: 'file:changed' | 'file:added' | 'file:deleted';
  path: string;
  timestamp: number;
  content?: string;
  previousContent?: string;
};

export type WelcomeMessage = {
  type: 'welcome';
  data: {
    sessionId: string;
    serverStartTime: number;
    heartbeatInterval: number;
    message: string;
  };
  timestamp: number;
};

export type ReconnectingMessage = {
  type: 'reconnecting';
  data: {
    reason: 'server_restart' | 'connection_lost' | 'manual';
    retryAfter: number;
    message: string;
  };
  timestamp: number;
};

export type WebSocketMessage =
  | FileChangeEvent
  | { type: 'task:updated'; data: unknown; timestamp: number }
  | { type: 'connected' }
  | { type: 'error'; error: string; timestamp?: number }
  | WelcomeMessage
  | ReconnectingMessage
  | { type: 'ping'; data: unknown; timestamp: number }
  | { type: 'pong'; data: unknown; timestamp: number };

type MessageHandler = (message: WebSocketMessage) => void;
type ConnectionChangeHandler = (isConnected: boolean) => void;
type SessionChangeHandler = (sessionId: string | null) => void;

interface ClientState {
  sessionId: string | null;
  serverStartTime: number | null;
  heartbeatInterval: number;
  isReconnecting: boolean;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionChangeHandler> = new Set();
  private sessionHandlers: Set<SessionChangeHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private isWatching = false;
  private clientState: ClientState = {
    sessionId: null,
    serverStartTime: null,
    heartbeatInterval: 30000,
    isReconnecting: false,
  };
  private missedPongs = 0;
  private readonly MAX_MISSED_PONGS = 2;
  private manualDisconnect = false;

  constructor(private url: string = 'ws://localhost:4001') {}

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('WebSocket already connected');
      return;
    }

    try {
      this.manualDisconnect = false;
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.missedPongs = 0;
        this.clientState.isReconnecting = false;
        this.notifyConnectionChange(true);

        // Start heartbeat
        this.startHeartbeat();

        // Send initial message
        this.sendMessage({ type: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        this.notifyConnectionChange(false);

        // Clear session if this wasn't a manual disconnect
        if (!this.manualDisconnect) {
          this.notifySessionChange(null);

          // Attempt to reconnect if watching is enabled
          if (this.isWatching) {
            this.scheduleReconnect();
          }
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.notifyMessageHandlers({ type: 'error', error: 'Connection error' });
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.notifyConnectionChange(false);
    }
  }

  /**
   * Handle incoming message from server
   */
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'welcome':
        // Extract session info from welcome message
        if ('data' in message && typeof message.data === 'object' && message.data) {
          const data = message.data as WelcomeMessage['data'];
          this.clientState.sessionId = data.sessionId;
          this.clientState.serverStartTime = data.serverStartTime;
          this.clientState.heartbeatInterval = data.heartbeatInterval;
          this.notifySessionChange(data.sessionId);
        }
        break;

      case 'reconnecting':
        // Server is restarting, prepare for reconnection
        this.clientState.isReconnecting = true;
        this.stopHeartbeat();

        // Schedule reconnection with server's suggested delay
        if ('data' in message && typeof message.data === 'object' && message.data) {
          const data = message.data as ReconnectingMessage['data'];
          this.reconnectDelay = data.retryAfter || 5000;
        }

        // Close current connection and prepare to reconnect
        if (this.ws) {
          this.ws.close();
        }
        break;

      case 'ping':
        // Respond to server ping with pong
        this.sendMessage({
          type: 'pong',
          data: { timestamp: Date.now() },
          timestamp: Date.now(),
        } as any);
        this.missedPongs = 0;
        break;

      case 'pong':
        // Server responded to our ping
        this.missedPongs = 0;
        break;

      default:
        // Pass all other messages to handlers
        break;
    }

    // Notify all message handlers
    this.notifyMessageHandlers(message);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.manualDisconnect = true;
    this.isWatching = false;
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.clientState = {
      sessionId: null,
      serverStartTime: null,
      heartbeatInterval: 30000,
      isReconnecting: false,
    };
    this.notifySessionChange(null);
    this.notifyConnectionChange(false);
  }

  /**
   * Start watching for file changes
   */
  startWatching(): void {
    this.isWatching = true;
    this.manualDisconnect = false;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }
  }

  /**
   * Stop watching for file changes
   */
  stopWatching(): void {
    this.isWatching = false;
    // Don't disconnect immediately, just stop reconnecting on next disconnect
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && !this.clientState.isReconnecting;
  }

  /**
   * Check if currently watching
   */
  isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Get current session information
   */
  getSessionInfo(): ClientState {
    return { ...this.clientState };
  }

  /**
   * Subscribe to WebSocket messages
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionChange(handler: ConnectionChangeHandler): () => void {
    this.connectionHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to session changes
   */
  onSessionChange(handler: SessionChangeHandler): () => void {
    this.sessionHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.sessionHandlers.delete(handler);
    };
  }

  /**
   * Start heartbeat/ping mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    // Send ping at half the heartbeat interval to be safe
    const pingInterval = Math.max(this.clientState.heartbeatInterval / 2, 15000);

    this.pingTimer = window.setTimeout(() => {
      this.sendPing();
    }, pingInterval);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Send ping to server
   */
  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.missedPongs++;

    // Check if we've missed too many pongs
    if (this.missedPongs > this.MAX_MISSED_PONGS) {
      const errorMsg = 'Server not responding to pings - connection timeout';
      console.warn(`[WebSocket] ${errorMsg}`);

      // Notify handlers before closing
      this.notifyMessageHandlers({
        type: 'error',
        error: errorMsg,
        timestamp: Date.now()
      });

      this.ws.close(1000, 'Server timeout');
      return;
    }

    // Send ping
    this.sendMessage({
      type: 'ping',
      data: { timestamp: Date.now() },
      timestamp: Date.now(),
    } as any);

    // Schedule next ping
    const pingInterval = Math.max(this.clientState.heartbeatInterval / 2, 15000);
    this.pingTimer = window.setTimeout(() => {
      this.sendPing();
    }, pingInterval);
  }

  private sendMessage(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private notifyMessageHandlers(message: WebSocketMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  private notifyConnectionChange(isConnected: boolean): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(isConnected);
      } catch (error) {
        console.error('Error in connection handler:', error);
      }
    });
  }

  private notifySessionChange(sessionId: string | null): void {
    this.sessionHandlers.forEach(handler => {
      try {
        handler(sessionId);
      } catch (error) {
        console.error('Error in session handler:', error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.isWatching = false;
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      // Exponential backoff with jitter
      this.reconnectDelay = Math.min(this.reconnectDelay * 2 + Math.random() * 1000, 30000);
      this.connect();
    }, this.reconnectDelay);
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!wsClient) {
    wsClient = new WebSocketClient();
  }
  return wsClient;
}

export default WebSocketClient;
