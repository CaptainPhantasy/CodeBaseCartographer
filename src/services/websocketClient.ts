/**
 * WebSocket Client for real-time file watching
 * Connects to backend WebSocket server to receive file change events
 */

export type FileChangeEvent = {
  type: 'file:changed' | 'file:added' | 'file:deleted';
  path: string;
  timestamp: number;
  content?: string;
  previousContent?: string;
};

export type WebSocketMessage = FileChangeEvent | { type: 'connected' } | { type: 'error'; error: string };

type MessageHandler = (message: WebSocketMessage) => void;
type ConnectionChangeHandler = (isConnected: boolean) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionChangeHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isWatching = false;

  constructor(private url: string = 'ws://localhost:3001') {}

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('WebSocket already connected');
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.notifyConnectionChange(true);

        // Send initial message
        this.sendMessage({ type: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.notifyMessageHandlers(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.notifyConnectionChange(false);

        // Attempt to reconnect if watching is enabled
        if (this.isWatching && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
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
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isWatching = false;
    this.notifyConnectionChange(false);
  }

  /**
   * Start watching for file changes
   */
  startWatching(): void {
    this.isWatching = true;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }
  }

  /**
   * Stop watching for file changes
   */
  stopWatching(): void {
    this.isWatching = false;
    // Don't disconnect immediately, just stop reconnecting
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Check if currently watching
   */
  isActive(): boolean {
    return this.isWatching;
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

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    console.log(`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Exponential backoff, max 30s
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
