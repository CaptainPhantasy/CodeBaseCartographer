/**
 * taskStore.ts - SQLite database for task persistence
 *
 * Features:
 * - SQLite database initialization
 * - Tasks table with full schema
 * - CRUD operations
 * - Indexes on status and priority
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import initSqlJs, { Database, SqlValue } from 'sql.js';
import type { Task, CreateTaskInput, UpdateTaskInput } from './types.js';

export class TaskStore {
  private db: Database | null = null;
  private dbPath: string;
  private isInitialized = false;

  constructor(dbPath: string) {
    this.dbPath = resolve(dbPath);
  }

  /**
   * Initialize SQLite database and create schema
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize sql.js
      const SQL = await initSqlJs();

      // Load existing database or create new one
      if (existsSync(this.dbPath)) {
        const buffer = readFileSync(this.dbPath);
        this.db = new SQL.Database(buffer);
      } else {
        this.db = new SQL.Database();
        this.createSchema();
        await this.save();
      }

      this.isInitialized = true;
      console.log(`Task store initialized: ${this.dbPath}`);
    } catch (error) {
      throw new Error(`Failed to initialize task store: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create database schema
   */
  private createSchema(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Create tasks table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'medium',
        files TEXT,
        dependencies TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `);

    // Create indexes
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status
      ON tasks(status)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_tasks_priority
      ON tasks(priority)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at
      ON tasks(createdAt)
    `);
  }

  /**
   * Save database to disk
   */
  private async save(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.db) {
      throw new Error('Task store not initialized. Call initialize() first.');
    }
  }

  /**
   * Convert database row to Task object
   */
  private rowToTask(row: SqlValue[]): Task {
    return {
      id: String(row[0]),
      title: String(row[1]),
      description: String(row[2] ?? ''),
      status: String(row[3]) as Task['status'],
      priority: String(row[4]) as Task['priority'],
      files: row[5] ? JSON.parse(String(row[5])) : [],
      dependencies: row[6] ? JSON.parse(String(row[6])) : [],
      createdAt: Number(row[7]),
      updatedAt: Number(row[8]),
    };
  }

  /**
   * Create a new task
   */
  public async createTask(input: CreateTaskInput): Promise<Task> {
    this.ensureInitialized();

    const { randomUUID } = await import('crypto');
    const now = Date.now();

    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? '',
      status: input.status ?? 'pending',
      priority: input.priority ?? 'medium',
      files: input.files ?? [],
      dependencies: input.dependencies ?? [],
      createdAt: now,
      updatedAt: now,
    };

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.run(
      `INSERT INTO tasks (id, title, description, status, priority, files, dependencies, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.status,
        task.priority,
        JSON.stringify(task.files),
        JSON.stringify(task.dependencies),
        task.createdAt,
        task.updatedAt,
      ]
    );

    await this.save();
    return task;
  }

  /**
   * Get a task by ID
   */
  public getTask(id: string): Task | undefined {
    this.ensureInitialized();

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    stmt.bind([id]);
    const result = stmt.getAsObject() as Record<string, SqlValue>;
    stmt.free();

    if (!result || Object.keys(result).length === 0) {
      return undefined;
    }

    return this.rowToTask(Object.values(result));
  }

  /**
   * Update a task
   */
  public async updateTask(id: string, input: UpdateTaskInput): Promise<Task | undefined> {
    this.ensureInitialized();

    const existing = this.getTask(id);
    if (!existing) {
      return undefined;
    }

    const updated: Task = {
      ...existing,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      status: input.status ?? existing.status,
      priority: input.priority ?? existing.priority,
      files: input.files ?? existing.files,
      dependencies: input.dependencies ?? existing.dependencies,
      updatedAt: Date.now(),
    };

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.run(
      `UPDATE tasks
       SET title = ?, description = ?, status = ?, priority = ?, files = ?, dependencies = ?, updatedAt = ?
       WHERE id = ?`,
      [
        updated.title,
        updated.description,
        updated.status,
        updated.priority,
        JSON.stringify(updated.files),
        JSON.stringify(updated.dependencies),
        updated.updatedAt,
        id,
      ]
    );

    await this.save();
    return updated;
  }

  /**
   * Delete a task
   */
  public async deleteTask(id: string): Promise<boolean> {
    this.ensureInitialized();

    const existing = this.getTask(id);
    if (!existing) {
      return false;
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    this.db.run('DELETE FROM tasks WHERE id = ?', [id]);
    await this.save();
    return true;
  }

  /**
   * List all tasks with optional filtering
   */
  public listTasks(filters?: {
    status?: Task['status'];
    priority?: Task['priority'];
    limit?: number;
    offset?: number;
  }): Task[] {
    this.ensureInitialized();

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    let query = 'SELECT * FROM tasks';
    const params: SqlValue[] = [];

    // Build WHERE clause
    const conditions: string[] = [];
    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.priority) {
      conditions.push('priority = ?');
      params.push(filters.priority);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Add sorting and pagination
    query += ' ORDER BY createdAt DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.db.prepare(query);
    stmt.bind(params);
    const results: Task[] = [];

    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, SqlValue>;
      results.push(this.rowToTask(Object.values(row)));
    }

    stmt.free();
    return results;
  }

  /**
   * Get task count by status
   */
  public getTaskCountByStatus(): Record<string, number> {
    this.ensureInitialized();

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      SELECT status, COUNT(*) as count
      FROM tasks
      GROUP BY status
    `);

    const result: Record<string, number> = {};

    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, SqlValue>;
      result[String(row.status)] = Number(row.count);
    }

    stmt.free();
    return result;
  }

  /**
   * Close the database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }
}
