/**
 * server.ts - Main Express server with REST API
 *
 * Features:
 * - REST API endpoints for files, tasks, and changes
 * - WebSocket server for real-time updates
 * - File watching integration
 * - Error handling middleware
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { resolve } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { FileWatcher } from './fileWatcher.js';
import { FileOperator } from './fileOperator.js';
import { ChangeJournal } from './changeJournal.js';
import { TaskStore } from './taskStore.js';
import { WebSocketServerManager } from './webSocketServer.js';
import type { CreateTaskInput, UpdateTaskInput } from './types.js';
import {
  requestIdMiddleware,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  FileNotFoundError,
  FileOperationError,
  ValidationError,
  sendSuccess,
  sendError,
  logError
} from './errorHandler.js';

export class Server {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private port: number;
  private wsPort: number;
  private watchPath: string;
  private dbPath: string;

  private fileWatcher: FileWatcher;
  private fileOperator: FileOperator;
  private changeJournal: ChangeJournal;
  private taskStore: TaskStore;
  private wsManager: WebSocketServerManager;

  constructor(
    port: number = 3000,
    wsPort: number = 3001,
    watchPath: string = process.cwd(),
    dbPath: string = './tasks.db'
  ) {
    this.port = port;
    this.wsPort = wsPort;
    this.watchPath = resolve(watchPath);
    this.dbPath = resolve(dbPath);

    this.app = express();
    this.httpServer = createServer(this.app);

    // Initialize components
    this.fileWatcher = new FileWatcher(this.watchPath);
    this.fileOperator = new FileOperator(this.watchPath);
    this.changeJournal = new ChangeJournal();
    this.taskStore = new TaskStore(this.dbPath);
    this.wsManager = new WebSocketServerManager(wsPort);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Add request ID middleware first
    this.app.use(requestIdMiddleware);

    this.app.use(cors());
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup REST API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        watchPath: this.watchPath,
        timestamp: Date.now(),
      });
    });

    // File routes
    this.app.get('/api/files', this.listFiles.bind(this));
    this.app.get('/api/files/*', this.readFile.bind(this));
    this.app.post('/api/files/*', this.writeFile.bind(this));
    this.app.delete('/api/files/*', this.deleteFile.bind(this));

    // Task routes
    this.app.get('/api/tasks', this.listTasks.bind(this));
    this.app.post('/api/tasks', this.createTask.bind(this));
    this.app.get('/api/tasks/:id', this.getTask.bind(this));
    this.app.put('/api/tasks/:id', this.updateTask.bind(this));
    this.app.delete('/api/tasks/:id', this.deleteTask.bind(this));
    this.app.get('/api/tasks/stats/summary', this.getTaskStats.bind(this));

    // Change journal routes
    this.app.get('/api/changes', this.listChanges.bind(this));
    this.app.get('/api/changes/:id', this.getChange.bind(this));
    this.app.post('/api/changes/:id/rollback', this.rollbackChange.bind(this));

    // ElevenLabs proxy routes (for voice preview)
    this.app.get('/api/elevenlabs/preview', this.proxyElevenLabsPreview.bind(this));

    // File open routes (for click-to-open-file in flow chart)
    this.app.get('/api/open-file', this.openFile.bind(this));
  }

  /**
   * Setup error handling middleware (must be last)
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);
    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * GET /api/files - List watched files
   */
  private listFiles = asyncHandler(async (req: Request, res: Response) => {
    const paths = this.fileWatcher.getWatchedPaths();
    sendSuccess(res, {
      files: paths,
      count: paths.length,
    });
  });

  /**
   * GET /api/files/:path - Read file content
   */
  private readFile = asyncHandler(async (req: Request, res: Response) => {
    const path = req.params[0];
    try {
      const file = this.fileOperator.readFile(path);
      sendSuccess(res, file);
    } catch (error) {
      throw new FileNotFoundError(path);
    }
  });

  /**
   * POST /api/files/:path - Write file content
   */
  private writeFile = asyncHandler(async (req: Request, res: Response) => {
    const path = req.params[0];
    const { content } = req.body;

    if (typeof content !== 'string') {
      throw new ValidationError('Content must be a string', { contentType: typeof content });
    }

    // Record old content for change journal
    let oldContent: string | null = null;
    try {
      const existingFile = this.fileOperator.readFile(path);
      oldContent = existingFile.content;
    } catch {
      // File doesn't exist, that's okay
    }

    // Write file
    const writtenPath = this.fileOperator.writeFile(path, content);

    // Record in change journal
    this.changeJournal.record({
      path: writtenPath,
      oldContent,
      newContent: content,
      timestamp: Date.now(),
    });

    sendSuccess(res, {
      path: writtenPath,
      message: 'File written successfully',
    });
  });

  /**
   * DELETE /api/files/:path - Delete a file
   */
  private deleteFile = asyncHandler(async (req: Request, res: Response) => {
    const path = req.params[0];
    const deleted = this.fileOperator.deleteFile(path);

    if (!deleted) {
      throw new FileNotFoundError(path);
    }

    sendSuccess(res, {
      path,
      message: 'File deleted successfully',
    });
  });

  /**
   * GET /api/tasks - List tasks
   */
  private async listTasks(req: Request, res: Response): Promise<void> {
    try {
      const { status, priority, limit, offset } = req.query;

      const tasks = this.taskStore.listTasks({
        status: status as any,
        priority: priority as any,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });

      res.json({
        tasks,
        count: tasks.length,
      });
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

  /**
   * POST /api/tasks - Create task
   */
  private async createTask(req: Request, res: Response): Promise<void> {
    try {
      const input = req.body as CreateTaskInput;

      if (!input.title) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }

      const task = await this.taskStore.createTask(input);

      // Broadcast update
      this.wsManager.broadcastTaskUpdate(task);

      res.status(201).json(task);
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

  /**
   * GET /api/tasks/:id - Get task
   */
  private getTask(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const task = this.taskStore.getTask(id);

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      res.json(task);
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

  /**
   * PUT /api/tasks/:id - Update task
   */
  private async updateTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const input = req.body as UpdateTaskInput;

      const task = await this.taskStore.updateTask(id, input);

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      // Broadcast update
      this.wsManager.broadcastTaskUpdate(task);

      res.json(task);
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

  /**
   * DELETE /api/tasks/:id - Delete task
   */
  private async deleteTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await this.taskStore.deleteTask(id);

      if (!deleted) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      res.json({ message: 'Task deleted successfully' });
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

  /**
   * GET /api/tasks/stats/summary - Get task statistics
   */
  private getTaskStats(req: Request, res: Response): void {
    try {
      const stats = this.taskStore.getTaskCountByStatus();
      res.json(stats);
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

  /**
   * GET /api/changes - List change journal
   */
  private listChanges(req: Request, res: Response): void {
    try {
      const { limit, offset, path } = req.query;

      const changes = this.changeJournal.listChanges({
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
        path: path as string | undefined,
      });

      res.json({
        changes,
        count: changes.length,
      });
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

  /**
   * GET /api/changes/:id - Get change
   */
  private getChange(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const change = this.changeJournal.getChange(id);

      if (!change) {
        res.status(404).json({ error: 'Change not found' });
        return;
      }

      res.json(change);
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

  /**
   * POST /api/changes/:id/rollback - Rollback a change
   */
  private rollbackChange(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const rollback = this.changeJournal.rollbackChange(id);

      if (!rollback) {
        res.status(404).json({ error: 'Change not found' });
        return;
      }

      // Restore old content
      if (rollback.content !== null) {
        this.fileOperator.writeFile(rollback.path, rollback.content, false);
      } else {
        // File didn't exist before, delete it if it exists
        const deleted = this.fileOperator.deleteFile(rollback.path);
        // If file doesn't exist, that's fine - it was a new file creation
        // No error needed as this is the expected state
      }

      res.json({
        message: 'Change rolled back successfully',
        path: rollback.path,
      });
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

  /**
   * GET /api/elevenlabs/preview - Proxy ElevenLabs preview URL to avoid CORS
   */
  private async proxyElevenLabsPreview(req: Request, res: Response): Promise<void> {
    try {
      const { url } = req.query;

      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'URL parameter required' });
        return;
      }

      // Fetch from ElevenLabs with proper headers
      const response = await fetch(url as string, {
        headers: {
          'User-Agent': 'CodebaseCartographer/1.0'
        }
      });

      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch preview' });
        return;
      }

      // Stream the audio back
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      res.setHeader('Access-Control-Allow-Origin', '*');

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error('Preview proxy error:', error);
      res.status(500).json({ error: 'Failed to proxy preview' });
    }
  }

  /**
   * GET /api/open-file - Open a file in the native editor
   * Supports Bear for markdown files on macOS
   */
  private async openFile(req: Request, res: Response): Promise<void> {
    try {
      const { path, editor } = req.query;

      if (!path || typeof path !== 'string') {
        res.status(400).json({ error: 'Path parameter required' });
        return;
      }

      const filePath = path;
      const platform = process.platform;
      const isMarkdown = /\.(md|markdown|mdown|mkd)$/i.test(filePath);
      const requestedEditor = editor?.toString().toLowerCase();

      let command: string;
      let usedEditor: string;

      // On macOS, use Bear for markdown files if requested or auto-detect
      if (platform === 'darwin' && isMarkdown) {
        if (requestedEditor === 'bear') {
          // Use Bear URL scheme for better integration
          command = `open "bear://x-callback-url/open-note?path=${encodeURIComponent(filePath)}"`;
          usedEditor = 'Bear';
        } else if (requestedEditor === 'default' || !requestedEditor) {
          // Try Bear first, fall back to default
          try {
            // Check if Bear is installed
            const { stdout } = await execAsync('mdfind "kMDItemKind == \'Application\' && kMDItemDisplayName == \'Bear\'"');
            if (stdout.trim()) {
              command = `open -a Bear "${filePath}"`;
              usedEditor = 'Bear';
            } else {
              command = `open "${filePath}"`;
              usedEditor = 'default';
            }
          } catch {
            command = `open "${filePath}"`;
            usedEditor = 'default';
          }
        } else {
          // Specific editor requested
          command = `open -a "${requestedEditor}" "${filePath}"`;
          usedEditor = requestedEditor;
        }
      } else if (platform === 'darwin') {
        // Non-markdown or non-Bear on macOS
        if (requestedEditor && requestedEditor !== 'default') {
          command = `open -a "${requestedEditor}" "${filePath}"`;
          usedEditor = requestedEditor;
        } else {
          command = `open "${filePath}"`;
          usedEditor = 'default';
        }
      } else if (platform === 'win32') {
        command = `start "" "${filePath}"`;
        usedEditor = 'default';
      } else if (platform === 'linux') {
        command = `xdg-open "${filePath}"`;
        usedEditor = 'default';
      } else {
        res.status(500).json({ error: `Unsupported platform: ${platform}` });
        return;
      }

      // Execute the open command
      await execAsync(command);

      res.json({
        success: true,
        path: filePath,
        editor: usedEditor,
        isMarkdown,
        message: `File opened in ${usedEditor}`,
      });
    } catch (error) {
      console.error('Open file error:', error);
      res.status(500).json({
        error: 'Failed to open file',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Initialize task store
      await this.taskStore.initialize();

      // Start file watcher
      this.fileWatcher.start();

      // Setup file event handler to broadcast changes
      this.fileWatcher.onFileEvent((event) => {
        this.wsManager.broadcastFileEvent(event);
      });

      // Start WebSocket server
      this.wsManager.start(this.httpServer);

      // Start HTTP server - wait for server to be listening
      await new Promise<void>((resolve, reject) => {
        const handleError = (error: Error) => {
          this.httpServer.off('error', handleError);
          reject(error);
        };

        this.httpServer.once('error', handleError);

        this.httpServer.listen(this.port, () => {
          this.httpServer.off('error', handleError);
          console.log(`HTTP server listening on port ${this.port}`);
          console.log(`WebSocket server listening on port ${this.wsPort}`);
          console.log(`Watching directory: ${this.watchPath}`);
          resolve();
        });
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  public stop(): void {
    this.fileWatcher.stop();
    this.wsManager.stop();
    this.taskStore.close();
    this.httpServer.close();
    console.log('Server stopped');
  }
}
