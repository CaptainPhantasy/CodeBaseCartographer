/**
 * rollbackService.ts - Service for undoing code changes
 *
 * Features:
 * - Rollback changes via change journal API
 * - Batch rollback for multiple changes
 * - Rollback validation and conflict detection
 * - Error handling and recovery
 */

import type { RollbackRequest, RollbackResult, FileChange } from '../types/subagent';

/**
 * API base URL
 */
const API_BASE = 'http://localhost:3000/api';

/**
 * Rollback service for undoing changes
 */
export class RollbackService {
  /**
   * Rollback a single change by ID
   */
  async rollbackChange(changeId: string): Promise<RollbackResult> {
    try {
      const response = await fetch(`${API_BASE}/changes/${changeId}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rollback change');
      }

      const data = await response.json();

      return {
        success: true,
        filesRestored: [data.path],
        errors: [],
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        filesRestored: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Rollback multiple changes (batch operation)
   */
  async rollbackBatch(request: RollbackRequest): Promise<RollbackResult> {
    const results: RollbackResult = {
      success: true,
      filesRestored: [],
      errors: [],
      timestamp: Date.now(),
    };

    for (const changeId of request.changeIds) {
      const result = await this.rollbackChange(changeId);

      if (result.success) {
        results.filesRestored.push(...result.filesRestored);
      } else {
        results.success = false;
        results.errors.push(...result.errors);
      }
    }

    return results;
  }

  /**
   * Rollback all changes for a specific execution
   */
  async rollbackExecution(
    executionId: string,
    changes: FileChange[]
  ): Promise<RollbackResult> {
    // Extract change IDs from file changes
    const changeIds = changes
      .map(c => c.changeId)
      .filter((id): id is string => id !== undefined);

    if (changeIds.length === 0) {
      return {
        success: false,
        filesRestored: [],
        errors: ['No valid change IDs found'],
        timestamp: Date.now(),
      };
    }

    return this.rollbackBatch({
      executionId,
      changeIds,
      reason: 'Rolling back execution',
    });
  }

  /**
   * Validate if a rollback can be performed safely
   */
  async validateRollback(changeId: string): Promise<{
    valid: boolean;
    conflicts: string[];
    warnings: string[];
  }> {
    try {
      // Get the change details
      const response = await fetch(`${API_BASE}/changes/${changeId}`);

      if (!response.ok) {
        return {
          valid: false,
          conflicts: ['Change not found in journal'],
          warnings: [],
        };
      }

      const change = await response.json();

      // Check for conflicts with newer changes
      const allChangesResponse = await fetch(`${API_BASE}/changes}?path=${change.path}`);
      if (allChangesResponse.ok) {
        const allChanges = await allChangesResponse.json();
        const newerChanges = allChanges.changes.filter(
          (c: any) => c.path === change.path && c.timestamp > change.timestamp
        );

        if (newerChanges.length > 0) {
          return {
            valid: false,
            conflicts: [
              `File has ${newerChanges.length} newer change(s) after this one`,
              'Rolling back may cause conflicts with those changes',
            ],
            warnings: [
              'Consider rolling back newer changes first',
              'Or manually review the file after rollback',
            ],
          };
        }
      }

      return {
        valid: true,
        conflicts: [],
        warnings: [],
      };
    } catch (error) {
      return {
        valid: false,
        conflicts: [error instanceof Error ? error.message : 'Validation failed'],
        warnings: [],
      };
    }
  }

  /**
   * Get all changes from the journal
   */
  async getAllChanges(options?: {
    limit?: number;
    offset?: number;
    path?: string;
  }): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.path) params.append('path', options.path);

      const response = await fetch(`${API_BASE}/changes?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch changes');
      }

      const data = await response.json();
      return data.changes || [];
    } catch (error) {
      console.error('Error fetching changes:', error);
      return [];
    }
  }

  /**
   * Get changes for a specific file
   */
  async getChangesForFile(filePath: string): Promise<any[]> {
    return this.getAllChanges({ path: filePath });
  }
}

// Singleton instance
let rollbackServiceInstance: RollbackService | null = null;

/**
 * Get or create the singleton rollback service instance
 */
export function getRollbackService(): RollbackService {
  if (!rollbackServiceInstance) {
    rollbackServiceInstance = new RollbackService();
  }
  return rollbackServiceInstance;
}
