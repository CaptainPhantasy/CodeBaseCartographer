/**
 * WebSocket server for real-time updates
 *
 * Features:
 * - WebSocket server on separate port
 * - Broadcast events: file:changed, file:added, file:deleted, task:updated
 * - Client connection management
 * - Heartbeat/ping-pong for connection health monitoring
 * - Server crash recovery with state persistence
 * - Graceful reconnection notifications
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer, IncomingMessage } from 'http';
import { verifyUpgrade, extractToken } from './middleware/wsAuth.js';
import { verifyToken, isAuthEnabled, getAuthConfig } from './middleware/auth.js';
import type { WebSocketMessage, FileEvent, Task, WelcomeMessageData, ReconnectingMessageData } from './types.js';
import { writeFile, unlink } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';

/**
 * Client metadata for tracking connection state
 */
interface ClientMetadata {
  ws: WebSocket;
  id: string;
  isAlive: boolean;
  lastPing: number;
  missedPongs: number;
  connectedAt: number;
  /** Access token presented at upgrade (null when auth is disabled). */
  token: string | null;
}

/**
 * Server state for crash recovery
 */
interface ServerState {
  lastShutdown: number;
  sessionId: string;
  clientCount: number;
  serverStartTime: number;
}

/**
 * Extended WebSocket message type with heartbeat support
 */
interface ExtendedWebSocketMessage extends WebSocketMessage {
  type: 'file:changed' | 'file:added' | 'file:deleted' | 'task:updated' | 'error' | 'ping' | 'pong' | 'reconnecting' | 'welcome';
  data: unknown;
  timestamp: number;
}

export class WebSocketServerManager {
  private wss: WebSocketServer | null = null;
  private port: number;
  private clients: Map<WebSocket, ClientMetadata> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly HEARTBEAT_TIMEOUT = 60000; // 60 seconds (client must respond within 2 pings)
  private readonly MAX_MISSED_PONGS = 2;
  private readonly STATE_FILE = './ws-server-state.json';
  private sessionId: string;
  private serverStartTime: number;
  private isShuttingDown = false;

  constructor(port: number = 3001) {
    this.port = port;
    this.serverStartTime = Date.now();
    this.sessionId = this.initializeServerState();
  }

  /**
   * Initialize or recover server state
   */
  private initializeServerState(): string {
    let state: ServerState | null = null;

    // Try to recover previous state
    if (existsSync(this.STATE_FILE)) {
      try {
        const data = readFileSync(this.STATE_FILE, 'utf-8');
        state = JSON.parse(data) as ServerState;
        console.log(`WebSocket server recovered from previous session: ${state.sessionId}`);
        console.log(`Previous shutdown: ${new Date(state.lastShutdown).toISOString()}`);
        console.log(`Previous client count: ${state.clientCount}`);
      } catch (error) {
        console.error('Failed to recover server state:', error);
      }
    }

    // Generate new session ID
    const newSessionId = this.generateSessionId();

    // Save new state
    const newState: ServerState = {
      lastShutdown: Date.now(),
      sessionId: newSessionId,
      clientCount: 0,
      serverStartTime: this.serverStartTime,
    };

    this.saveState(newState).catch((error) => {
      console.error('Failed to save initial server state:', error);
    });

    return newSessionId;
  }

  /**
   * Save server state to disk
   */
  private async saveState(state: ServerState): Promise<void> {
    try {
      await writeFile(this.STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save server state:', error);
    }
  }

  /**
   * Update server state
   */
  private async updateState(): Promise<void> {
    const state: ServerState = {
      lastShutdown: Date.now(),
      sessionId: this.sessionId,
      clientCount: this.clients.size,
      serverStartTime: this.serverStartTime,
    };

    await this.saveState(state);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
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
      // Validate the access token before the handshake completes.
      // Failed upgrades get an HTTP 401 response from the ws library.
      verifyClient: ({ req }: { req: IncomingMessage }) => verifyUpgrade(req),
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      // Auth was already verified by verifyClient during the upgrade.
      // Re-verify defensively in case a future refactor bypasses it.
      if (!verifyUpgrade(req)) {
        ws.close(1008, 'Unauthorized');
        return;
      }
      this.handleConnection(ws, req);
    });

    // Start heartbeat interval
    this.startHeartbeat();

    // Handle process shutdown gracefully
    this.setupShutdownHandlers();

    console.log(`WebSocket server listening on port ${this.port}`);
    console.log(`Session ID: ${this.sessionId}`);
  }

  /**
   * Handle new client connection
   */
  private handleConnection(ws: WebSocket, req?: IncomingMessage): void {
    const clientId = this.generateClientId();
    const now = Date.now();

    const metadata: ClientMetadata = {
      ws,
      id: clientId,
      isAlive: true,
      lastPing: now,
      missedPongs: 0,
      connectedAt: now,
      token: req ? extractToken(req) : null,
    };

    this.clients.set(ws, metadata);
    console.log(`WebSocket client connected: ${clientId} (Total: ${this.clients.size})`);

    // Send welcome message
    this.sendWelcome(ws);

    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      this.handleError(ws, error);
    });

    ws.on('pong', () => {
      this.handlePong(ws);
    });

    // Update state after new connection
    this.updateState().catch((error) => {
      console.error('Failed to update state after connection:', error);
    });
  }

  /**
   * Send welcome message to newly connected client
   */
  private sendWelcome(ws: WebSocket): void {
    const welcomeData: WelcomeMessageData = {
      sessionId: this.sessionId,
      serverStartTime: this.serverStartTime,
      heartbeatInterval: this.HEARTBEAT_INTERVAL,
      message: 'Connected to CodeBaseCartographer WebSocket server',
    };

    this.sendToClient(ws, {
      type: 'welcome',
      data: welcomeData,
      timestamp: Date.now(),
    });
  }

  /**
   * Send reconnection notification to clients
   */
  private broadcastReconnecting(reason: 'server_restart' | 'connection_lost' | 'manual'): void {
    const reconnectData: ReconnectingMessageData = {
      reason,
      retryAfter: 5000, // Suggest retry after 5 seconds
      message: 'Server is restarting, please reconnect',
    };

    this.broadcast({
      type: 'reconnecting',
      data: reconnectData,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as ExtendedWebSocketMessage;

      switch (message.type) {
        case 'pong':
          // Pong is handled by the 'pong' event listener
          break;
        case 'ping':
          // Respond to client ping with pong
          this.sendToClient(ws, {
            type: 'pong',
            data: { timestamp: Date.now() },
            timestamp: Date.now(),
          });
          break;
        default:
          console.log(`Received message from client: ${message.type}`);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(ws: WebSocket): void {
    const metadata = this.clients.get(ws);
    if (metadata) {
      console.log(`WebSocket client disconnected: ${metadata.id} (Total: ${this.clients.size - 1})`);
      this.clients.delete(ws);
      this.updateState().catch((error) => {
        console.error('Failed to update state after disconnection:', error);
      });
    }
  }

  /**
   * Handle client error
   */
  private handleError(ws: WebSocket, error: Error): void {
    const metadata = this.clients.get(ws);
    console.error(`WebSocket error for client ${metadata?.id || 'unknown'}:`, error);
    this.clients.delete(ws);
  }

  /**
   * Handle pong response from client
   */
  private handlePong(ws: WebSocket): void {
    const metadata = this.clients.get(ws);
    if (metadata) {
      metadata.isAlive = true;
      metadata.lastPing = Date.now();
      metadata.missedPongs = 0;
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.checkConnections();
    }, this.HEARTBEAT_INTERVAL);

    console.log(`Heartbeat started with ${this.HEARTBEAT_INTERVAL}ms interval`);
  }

  /**
   * Check all connections and send pings
   */
  private checkConnections(): void {
    const now = Date.now();
    const deadClients: WebSocket[] = [];

    this.clients.forEach((metadata, ws) => {
      // Re-verify the access token on each heartbeat. If it expired, close
      // the connection so the client re-authenticates with a fresh token.
      if (isAuthEnabled() && (!metadata.token || !verifyToken(metadata.token, 'access', getAuthConfig()))) {
        console.log(`Client ${metadata.id} access token expired, closing connection`);
        try {
          ws.close(1008, 'Token expired');
        } catch {
          // close() failures fall through to terminate below
        }
        deadClients.push(ws);
        return;
      }

      if (!metadata.isAlive) {
        metadata.missedPongs++;

        if (metadata.missedPongs >= this.MAX_MISSED_PONGS) {
          console.log(`Client ${metadata.id} missed ${metadata.missedPongs} pings, terminating connection`);
          deadClients.push(ws);
          return;
        }
      }

      // Check if connection has timed out
      if (now - metadata.lastPing > this.HEARTBEAT_TIMEOUT) {
        console.log(`Client ${metadata.id} connection timed out (${now - metadata.lastPing}ms)`);
        deadClients.push(ws);
        return;
      }

      // Send ping and mark as not alive until pong received
      metadata.isAlive = false;

      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.ping();
        } catch (error) {
          console.error(`Failed to send ping to client ${metadata.id}:`, error);
          deadClients.push(ws);
        }
      } else {
        deadClients.push(ws);
      }
    });

    // Remove dead clients
    deadClients.forEach((ws) => {
      try {
        ws.terminate();
      } catch (error) {
        // Ignore termination errors
      }
      this.clients.delete(ws);
    });

    if (deadClients.length > 0) {
      console.log(`Removed ${deadClients.length} dead connections`);
      this.updateState().catch((error) => {
        console.error('Failed to update state after cleanup:', error);
      });
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        return;
      }

      this.isShuttingDown = true;
      console.log(`Received ${signal}, shutting down WebSocket server gracefully...`);

      // Notify clients about impending shutdown
      this.broadcastReconnecting('server_restart');

      // Give clients time to receive the message
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.stop();

      // Update state with shutdown time
      await this.updateState();

      // Clean up state file after successful shutdown
      try {
        await unlink(this.STATE_FILE);
        console.log('Cleaned up server state file');
      } catch (error) {
        console.error('Failed to clean up state file:', error);
      }

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Stop the WebSocket server
   */
  public stop(): void {
    if (this.wss) {
      console.log('Stopping WebSocket server...');

      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Close all client connections
      this.clients.forEach((metadata, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.close(1000, 'Server shutting down');
          } catch (error) {
            console.error(`Failed to close connection for client ${metadata.id}:`, error);
          }
        }
      });

      this.clients.clear();

      // Close server
      this.wss.close((error) => {
        if (error) {
          console.error('Error closing WebSocket server:', error);
        } else {
          console.log('WebSocket server stopped successfully');
        }
      });

      this.wss = null;
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
    const deadClients: WebSocket[] = [];

    this.clients.forEach((metadata, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch (error) {
          console.error(`Failed to send message to client ${metadata.id}:`, error);
          deadClients.push(ws);
        }
      } else {
        deadClients.push(ws);
      }
    });

    // Remove dead clients
    deadClients.forEach((ws) => {
      this.clients.delete(ws);
    });

    if (deadClients.length > 0) {
      this.updateState().catch((error) => {
        console.error('Failed to update state after broadcast cleanup:', error);
      });
    }
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
   * Get server health information
   */
  public getHealthInfo(): {
    sessionId: string;
    serverStartTime: number;
    uptime: number;
    clientCount: number;
    isHealthy: boolean;
  } {
    const uptime = Date.now() - this.serverStartTime;
    return {
      sessionId: this.sessionId,
      serverStartTime: this.serverStartTime,
      uptime,
      clientCount: this.clients.size,
      isHealthy: this.wss !== null,
    };
  }

  /**
   * Check if server is running
   */
  public isRunning(): boolean {
    return this.wss !== null;
  }
}
