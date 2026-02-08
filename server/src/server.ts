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
import { FileWatcher } from './fileWatcher.js';
import { FileOperator } from './fileOperator.js';
import { ChangeJournal } from './changeJournal.js';
import { TaskStore } from './taskStore.js';
import { WebSocketServerManager } from './webSocketServer.js';
import type { CreateTaskInput, UpdateTaskInput } from './types.js';

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
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Error:', err);
      const errorResponse = FileOperator.handleError(err);
      res.status(500).json(errorResponse);
    });
  }

  /**
   * GET /api/files - List watched files
   */
  private listFiles(req: Request, res: Response): void {
    try {
      const paths = this.fileWatcher.getWatchedPaths();
      res.json({
        files: paths,
        count: paths.length,
      });
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

  /**
   * GET /api/files/:path - Read file content
   */
  private readFile(req: Request, res: Response): void {
    try {
      const path = req.params[0];
      const file = this.fileOperator.readFile(path);
      res.json(file);
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

  /**
   * POST /api/files/:path - Write file content
   */
  private writeFile(req: Request, res: Response): void {
    try {
      const path = req.params[0];
      const { content } = req.body;

      if (typeof content !== 'string') {
        res.status(400).json({ error: 'Content must be a string' });
        return;
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

      res.json({
        path: writtenPath,
        message: 'File written successfully',
      });
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

  /**
   * DELETE /api/files/:path - Delete a file
   */
  private deleteFile(req: Request, res: Response): void {
    try {
      const path = req.params[0];
      const deleted = this.fileOperator.deleteFile(path);

      if (!deleted) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      res.json({
        path,
        message: 'File deleted successfully',
      });
    } catch (error) {
      res.status(500).json(FileOperator.handleError(error));
    }
  }

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
        // File didn't exist before, delete it
        this.fileOperator.deleteFile(rollback.path);
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

      // Start HTTP server
      this.httpServer.listen(this.port, () => {
        console.log(`HTTP server listening on port ${this.port}`);
        console.log(`WebSocket server listening on port ${this.wsPort}`);
        console.log(`Watching directory: ${this.watchPath}`);
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
