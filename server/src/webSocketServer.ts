/**
 * WebSocket server for real-time updates
 *
 * Features:
 * - WebSocket server on separate port
 * - Broadcast events: file:changed, file:added, file:deleted, task:updated
 * - Client connection management
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer } from 'http';
import type { WebSocketMessage, FileEvent, Task } from './types.js';

export class WebSocketServerManager {
  private wss: WebSocketServer | null = null;
  private port: number;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number = 3001) {
    this.port = port;
  }

  /**
   * Start the WebSocket server
   */
  public start(server?: HTTPServer): void {
    if (this.wss) {
      throw new Error('WebSocket server is already running');
    }

    this.wss = new WebSocketServer({
      port: server ? undefined : this.port,
      server,
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('WebSocket client connected');
      this.clients.add(ws);

      // Send welcome message
      this.sendToClient(ws, {
        type: 'error',
        data: { message: 'Connected to CodeBaseCartographer server' },
        timestamp: Date.now(),
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    console.log(`WebSocket server listening on port ${this.port}`);
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(ws: WebSocket, message: WebSocketMessage): void {
    // Currently we don't process client messages, but this is where
    // we would handle client requests like "subscribe to path"
    console.log('Received message from client:', message.type);
  }

  /**
   * Stop the WebSocket server
   */
  public stop(): void {
    if (this.wss) {
      // Close all client connections
      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.close();
        }
      });
      this.clients.clear();

      this.wss.close();
      this.wss = null;
      console.log('WebSocket server stopped');
    }
  }

  /**
   * Broadcast a file event to all connected clients
   */
  public broadcastFileEvent(event: FileEvent): void {
    const messageTypeMap: Record<string, WebSocketMessage['type']> = {
      add: 'file:added',
      change: 'file:changed',
      unlink: 'file:deleted',
    };

    const messageType = messageTypeMap[event.type];

    this.broadcast({
      type: messageType,
      data: {
        path: event.path,
        timestamp: event.timestamp,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast a task update to all connected clients
   */
  public broadcastTaskUpdate(task: Task): void {
    this.broadcast({
      type: 'task:updated',
      data: task,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast a generic error to all connected clients
   */
  public broadcastError(error: string, details?: unknown): void {
    this.broadcast({
      type: 'error',
      data: { error, details },
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast a message to all connected clients
   */
  private broadcast(message: WebSocketMessage): void {
    const data = JSON.stringify(message);

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (error) {
          console.error('Failed to send message to client:', error);
          this.clients.delete(client);
        }
      }
    });
  }

  /**
   * Send a message to a specific client
   */
  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message to client:', error);
      }
    }
  }

  /**
   * Get the number of connected clients
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if server is running
   */
  public isRunning(): boolean {
    return this.wss !== null;
  }
}
