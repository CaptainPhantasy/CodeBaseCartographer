/**
 * Integration test: End-to-end rename variable task
 *
 * This test simulates the complete workflow:
 * 1. Create a task to rename a variable
 * 2. Execute the task
 * 3. Monitor progress
 * 4. Verify file changes
 * 5. Test rollback
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SubagentOrchestrator, getOrchestrator } from '../../src/services/subagentOrchestrator';
import { getRollbackService } from '../../src/services/rollbackService';
import type { ExecutionRequest, FileChange } from '../../src/types/subagent';

describe('End-to-End: Rename Variable Task', () => {
  const orchestrator = getOrchestrator({
    maxConcurrent: 1,
    defaultTimeout: 30000,
  });
  const rollbackService = getRollbackService();

  let executionId: string;
  let executionResult: any;

  beforeAll(async () => {
    // Ensure server is running
    const response = await fetch('http://localhost:3000/api/health');
    expect(response.ok).toBe(true);
  });

  it('should execute a simple rename variable task', async () => {
    // Step 1: Submit the task
    const request: ExecutionRequest = {
      taskId: 'rename-var-001',
      taskTitle: 'Rename "foo" to "bar" in utils.ts',
      taskDescription: 'Rename the variable "foo" to "bar" to improve code clarity',
      files: ['src/utils.ts'],
      priority: 'medium',
      timeout: 30000,
    };

    executionId = await orchestrator.submit(request);

    expect(executionId).toBeTruthy();
    console.log('Task submitted with execution ID:', executionId);

    // Step 2: Monitor execution
    await new Promise<void>((resolve) => {
      const unsubscribe = orchestrator.onEvent((event) => {
        if (event.executionId === executionId) {
          const result = orchestrator.getExecution(executionId);
          console.log(`Status: ${result?.status}, Progress: ${result?.progress}%`);

          if (result?.status === 'completed' || result?.status === 'failed') {
            executionResult = result;
            unsubscribe();
            resolve();
          }
        }
      });
    });

    // Step 3: Verify completion
    expect(executionResult.status).toBe('completed');
    expect(executionResult.progress).toBe(100);
    expect(executionResult.changes.length).toBeGreaterThan(0);
    console.log('Execution completed successfully');
  });

  it('should have generated valid file changes', () => {
    expect(executionResult.changes).toBeDefined();
    expect(executionResult.changes.length).toBeGreaterThan(0);

    const firstChange = executionResult.changes[0] as FileChange;
    expect(firstChange.path).toBeTruthy();
    expect(firstChange.changeType).toBeTruthy();
    expect(['create', 'update', 'delete']).toContain(firstChange.changeType);

    console.log('File changes:', executionResult.changes);
  });

  it('should have a valid diff for changes', () => {
    const firstChange = executionResult.changes[0] as FileChange;

    if (firstChange.changeType !== 'delete') {
      expect(firstChange.diff).toBeTruthy();
      expect(typeof firstChange.diff).toBe('string');

      // Verify diff format (should have @@ markers)
      expect(firstChange.diff).toContain('@@');

      console.log('Diff preview:', firstChange.diff?.substring(0, 200));
    }
  });

  it('should have recorded change in journal', async () => {
    const firstChange = executionResult.changes[0] as FileChange;

    if (firstChange.changeId) {
      // Verify change exists in journal
      const response = await fetch(
        `http://localhost:3000/api/changes/${firstChange.changeId}`
      );

      expect(response.ok).toBe(true);
      const change = await response.json();
      expect(change.id).toBe(firstChange.changeId);
      expect(change.path).toBe(firstChange.path);

      console.log('Change recorded in journal:', change.id);
    }
  });

  it('should be able to rollback the change', async () => {
    const firstChange = executionResult.changes[0] as FileChange;

    if (firstChange.changeId) {
      // Validate rollback first
      const validation = await rollbackService.validateRollback(firstChange.changeId);
      console.log('Rollback validation:', validation);

      // Perform rollback
      const rollbackResult = await rollbackService.rollbackChange(firstChange.changeId);

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.filesRestored.length).toBeGreaterThan(0);
      expect(rollbackResult.errors).toEqual([]);

      console.log('Rollback completed:', rollbackResult);
    }
  });

  it('should verify file was restored', async () => {
    const firstChange = executionResult.changes[0] as FileChange;

    if (firstChange.changeId && firstChange.oldContent) {
      // Read the file to verify it was restored
      const response = await fetch(
        `http://localhost:3000/api/files/${encodeURIComponent(firstChange.path)}`
      );

      expect(response.ok).toBe(true);
      const file = await response.json();

      // File should contain the old content
      expect(file.content).toContain(firstChange.oldContent.substring(0, 50));

      console.log('File restored successfully');
    }
  });

  it('should report accurate statistics', () => {
    const stats = orchestrator.getStatistics();

    expect(stats.totalExecutions).toBeGreaterThan(0);
    expect(stats.completedExecutions).toBeGreaterThan(0);
    expect(stats.averageExecutionTime).toBeGreaterThan(0);

    console.log('Orchestrator statistics:', stats);
  });

  afterAll(() => {
    orchestrator.shutdown();
    console.log('Test cleanup completed');
  });
});
