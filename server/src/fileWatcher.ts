/**
 * fileWatcher.ts - Chokidar wrapper with .gitignore-aware path filtering
 *
 * Features:
 * - Debounced file events (500ms default)
 * - .gitignore-aware path filtering
 * - Event emission for add, change, unlink
 * - Support for custom ignore patterns
 */

import chokidar from 'chokidar';
import { parse } from 'path';
import { readFileSync } from 'fs';
import type { FSWatcher } from 'chokidar';
import type { FileEvent, FileChangeEvent, WatcherOptions } from './types.js';

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private eventQueue: Map<string, NodeJS.Timeout> = new Map();
  private debounceTime: number;
  private watchedPath: string;
  private eventCallbacks: Set<(event: FileEvent) => void> = new Set();
  private ignorePatterns: string[] = [];
  private gitignorePatterns: string[] = [];

  constructor(watchedPath: string, options: WatcherOptions = {}) {
    this.watchedPath = watchedPath;
    this.debounceTime = options.debounce ?? 500;
    this.ignorePatterns = options.ignored ?? [];
    this.loadGitignore();
  }

  /**
   * Load and parse .gitignore file if it exists
   */
  private loadGitignore(): void {
    try {
      const gitignorePath = `${this.watchedPath}/.gitignore`;
      const content = readFileSync(gitignorePath, 'utf-8');
      this.gitignorePatterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    } catch (error) {
      // .gitignore doesn't exist or can't be read - that's fine
      this.gitignorePatterns = [];
    }
  }

  /**
   * Check if a path should be ignored based on gitignore and custom patterns
   */
  private shouldIgnore(path: string): boolean {
    const basename = parse(path).base;

    // Check custom ignore patterns
    for (const pattern of this.ignorePatterns) {
      if (path.includes(pattern)) {
        return true;
      }
    }

    // Check gitignore patterns
    for (const pattern of this.gitignorePatterns) {
      if (pattern.includes('*')) {
        // Convert glob pattern to regex
        const regexPattern = pattern
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        const regex = new RegExp(regexPattern);
        if (regex.test(basename) || regex.test(path)) {
          return true;
        }
      } else if (path.endsWith(pattern) || basename === pattern) {
        return true;
      }
    }

    // Always ignore node_modules and .git
    if (path.includes('node_modules') || path.includes('.git')) {
      return true;
    }

    return false;
  }

  /**
   * Debounce file events to avoid multiple rapid-fire events
   */
  private debounceEvent(event: FileChangeEvent): void {
    const key = `${event.type}:${event.path}`;

    // Clear existing timeout for this path/event type
    const existingTimeout = this.eventQueue.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.emitEvent({
        type: event.type,
        path: event.path,
        timestamp: Date.now(),
      });
      this.eventQueue.delete(key);
    }, this.debounceTime);

    this.eventQueue.set(key, timeout);
  }

  /**
   * Emit event to all registered callbacks
   */
  private emitEvent(event: FileEvent): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in file event callback:', error);
      }
    });
  }

  /**
   * Start watching the specified path
   */
  public start(): void {
    if (this.watcher) {
      throw new Error('Watcher is already running');
    }

    const allIgnored = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      ...this.ignorePatterns,
      ...this.gitignorePatterns,
    ];

    this.watcher = chokidar.watch(this.watchedPath, {
      ignored: allIgnored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (path) => {
        if (!this.shouldIgnore(path)) {
          this.debounceEvent({ type: 'add', path });
        }
      })
      .on('change', (path) => {
        if (!this.shouldIgnore(path)) {
          this.debounceEvent({ type: 'change', path });
        }
      })
      .on('unlink', (path) => {
        if (!this.shouldIgnore(path)) {
          this.debounceEvent({ type: 'unlink', path });
        }
      })
      .on('error', (error) => {
        console.error('File watcher error:', error);
      });

    // Wait for watcher to be ready
    this.watcher.on('ready', () => {
      console.log(`File watcher ready: watching ${this.watchedPath}`);
    });
  }

  /**
   * Stop watching
   */
  public stop(): void {
    if (this.watcher) {
      // Clear all pending debounced events
      this.eventQueue.forEach(timeout => clearTimeout(timeout));
      this.eventQueue.clear();

      this.watcher.close();
      this.watcher = null;
      console.log('File watcher stopped');
    }
  }

  /**
   * Register a callback for file events
   */
  public onFileEvent(callback: (event: FileEvent) => void): () => void {
    this.eventCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventCallbacks.delete(callback);
    };
  }

  /**
   * Get list of currently watched paths
   */
  public getWatchedPaths(): string[] {
    if (!this.watcher) {
      return [];
    }
    return Object.keys(this.watcher.getWatched());
  }

  /**
   * Check if watcher is currently running
   */
  public isRunning(): boolean {
    return this.watcher !== null;
  }
}
