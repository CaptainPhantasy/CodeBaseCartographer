/**
 * changeJournal.ts - Undo/rollback system for file operations
 *
 * Features:
 * - Record every write operation with timestamp, path, oldContent, newContent
 * - Retrieve individual changes
 * - Rollback to oldContent
 * - List all recorded changes
 */

import { randomUUID } from 'crypto';
import type { ChangeRecord, WriteOperation } from './types.js';

export class ChangeJournal {
  private changes: Map<string, ChangeRecord> = new Map();
  private maxChanges: number = 1000; // Prevent unbounded memory growth

  /**
   * Record a write operation in the journal
   */
  public record(operation: WriteOperation): ChangeRecord {
    const record: ChangeRecord = {
      id: randomUUID(),
      ...operation,
    };

    this.changes.set(record.id, record);

    // Prevent unbounded growth
    if (this.changes.size > this.maxChanges) {
      // Remove oldest entry (first in Map iteration order)
      const firstKey = this.changes.keys().next().value;
      if (firstKey) {
        this.changes.delete(firstKey);
      }
    }

    return record;
  }

  /**
   * Get a specific change by ID
   */
  public getChange(id: string): ChangeRecord | undefined {
    return this.changes.get(id);
  }

  /**
   * Rollback a change - returns the old content that should be restored
   */
  public rollbackChange(id: string): { path: string; content: string | null } | undefined {
    const change = this.changes.get(id);
    if (!change) {
      return undefined;
    }

    return {
      path: change.path,
      content: change.oldContent,
    };
  }

  /**
   * List all recorded changes, optionally filtered
   */
  public listChanges(options?: {
    limit?: number;
    offset?: number;
    path?: string;
  }): ChangeRecord[] {
    let changes = Array.from(this.changes.values());

    // Sort by timestamp descending (newest first)
    changes.sort((a, b) => b.timestamp - a.timestamp);

    // Filter by path if specified
    if (options?.path) {
      changes = changes.filter(change =>
        change.path.includes(options.path!)
      );
    }

    // Apply offset
    if (options?.offset) {
      changes = changes.slice(options.offset);
    }

    // Apply limit
    if (options?.limit) {
      changes = changes.slice(0, options.limit);
    }

    return changes;
  }

  /**
   * Get changes for a specific file
   */
  public getChangesForFile(path: string): ChangeRecord[] {
    return this.listChanges({ path });
  }

  /**
   * Clear all recorded changes
   */
  public clear(): void {
    this.changes.clear();
  }

  /**
   * Get total number of recorded changes
   */
  public size(): number {
    return this.changes.size;
  }

  /**
   * Remove a specific change from the journal
   */
  public remove(id: string): boolean {
    return this.changes.delete(id);
  }

  /**
   * Export all changes as JSON
   */
  public export(): string {
    const changes = Array.from(this.changes.values());
    return JSON.stringify(changes, null, 2);
  }

  /**
   * Import changes from JSON (replaces current journal)
   */
  public import(json: string): void {
    try {
      const changes = JSON.parse(json) as ChangeRecord[];
      this.changes.clear();

      for (const change of changes) {
        this.changes.set(change.id, change);
      }
    } catch (error) {
      throw new Error('Failed to import changes: invalid JSON format');
    }
  }
}
