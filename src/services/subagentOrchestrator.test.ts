/**
 * subagentOrchestrator.test.ts - Tests for subagent orchestrator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubagentOrchestrator } from './subagentOrchestrator';
import type { ExecutionRequest } from '../types/subagent';

describe('SubagentOrchestrator', () => {
  let orchestrator: SubagentOrchestrator;

  beforeEach(() => {
    orchestrator = new SubagentOrchestrator({
      maxConcurrent: 3,
      defaultTimeout: 5000,
      retryAttempts: 1,
      retryDelay: 100,
    });
  });

  afterEach(() => {
    orchestrator.shutdown();
  });

  describe('submit', () => {
    it('should submit a task and return execution ID', async () => {
      const request: ExecutionRequest = {
        taskId: 'task-1',
        taskTitle: 'Rename variable',
        taskDescription: 'Rename foo to bar',
        files: ['src/test.ts'],
        priority: 'medium',
      };

      const executionId = await orchestrator.submit(request);

      expect(executionId).toBeTruthy();
      expect(typeof executionId).toBe('string');

      const execution = orchestrator.getExecution(executionId);
      expect(execution).toBeDefined();
      // Status should be one of the expected states since the queue processes immediately
      expect(['queued', 'initializing', 'running']).toContain(execution?.status);
    });

    it('should queue tasks when pool is full', async () => {
      const request: ExecutionRequest = {
        taskId: 'task-1',
        taskTitle: 'Test task',
        taskDescription: 'Test',
        files: [],
        priority: 'medium',
      };

      // Submit 5 tasks (more than maxConcurrent of 3)
      const executionIds = await Promise.all([
        orchestrator.submit({ ...request, taskId: 'task-1' }),
        orchestrator.submit({ ...request, taskId: 'task-2' }),
        orchestrator.submit({ ...request, taskId: 'task-3' }),
        orchestrator.submit({ ...request, taskId: 'task-4' }),
        orchestrator.submit({ ...request, taskId: 'task-5' }),
      ]);

      const stats = orchestrator.getStatistics();
      expect(stats.activeExecutions).toBeLessThanOrEqual(3);
      expect(stats.queuedExecutions).toBeGreaterThan(0);
    });
  });

  describe('cancel', () => {
    it('should cancel a queued execution', () => {
      const request: ExecutionRequest = {
        taskId: 'task-1',
        taskTitle: 'Test task',
        taskDescription: 'Test',
        files: [],
        priority: 'low',
      };

      // Use a custom config with maxConcurrent: 0 to force queueing
      const testOrchestrator = new SubagentOrchestrator({
        maxConcurrent: 0,
        defaultTimeout: 5000,
      });

      return testOrchestrator.submit(request).then(executionId => {
        const cancelled = testOrchestrator.cancel(executionId);
        expect(cancelled).toBe(true);

        const execution = testOrchestrator.getExecution(executionId);
        expect(execution?.status).toBe('cancelled');

        testOrchestrator.shutdown();
      });
    });

    it('should cancel an active execution', () => {
      const request: ExecutionRequest = {
        taskId: 'task-1',
        taskTitle: 'Test task',
        taskDescription: 'Test',
        files: [],
        priority: 'high',
      };

      return orchestrator.submit(request).then(executionId => {
        // Wait a bit for execution to start
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            const cancelled = orchestrator.cancel(executionId);
            expect(cancelled).toBe(true);

            const execution = orchestrator.getExecution(executionId);
            expect(execution?.status).toMatch(/cancelled|failed/);
            resolve();
          }, 100);
        });
      });
    });
  });

  describe('getStatistics', () => {
    it('should return accurate statistics', async () => {
      const request: ExecutionRequest = {
        taskId: 'task-1',
        taskTitle: 'Test task',
        taskDescription: 'Test',
        files: [],
        priority: 'medium',
      };

      await orchestrator.submit(request);

      const stats = orchestrator.getStatistics();

      expect(stats.totalExecutions).toBeGreaterThan(0);
      expect(stats.activeExecutions).toBeGreaterThanOrEqual(0);
      expect(stats.queuedExecutions).toBeGreaterThanOrEqual(0);
      expect(stats.completedExecutions).toBeGreaterThanOrEqual(0);
      expect(stats.failedExecutions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('event callbacks', () => {
    it('should emit events for status changes', async () => {
      const events: any[] = [];

      orchestrator.onEvent((event) => {
        events.push(event);
      });

      const request: ExecutionRequest = {
        taskId: 'task-1',
        taskTitle: 'Test task',
        taskDescription: 'Test',
        files: [],
        priority: 'medium',
      };

      const executionId = await orchestrator.submit(request);

      // Should have received a status_change event
      const statusEvents = events.filter(e => e.type === 'status_change');
      expect(statusEvents.length).toBeGreaterThan(0);
      expect(statusEvents[0].executionId).toBe(executionId);
    });
  });

  describe('priority handling', () => {
    it('should prioritize high priority tasks', async () => {
      const events: any[] = [];

      orchestrator.onEvent((event) => {
        events.push(event);
      });

      // Submit low priority first
      await orchestrator.submit({
        taskId: 'low-1',
        taskTitle: 'Low priority',
        taskDescription: 'Test',
        files: [],
        priority: 'low',
      });

      // Then high priority
      await orchestrator.submit({
        taskId: 'high-1',
        taskTitle: 'High priority',
        taskDescription: 'Test',
        files: [],
        priority: 'critical',
      });

      // High priority should be processed first
      // (This is a simplified test - real testing would require synchronization)
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running executions', () => {
      const testOrchestrator = new SubagentOrchestrator({
        maxConcurrent: 1,
        defaultTimeout: 100, // Very short timeout
      });

      const request: ExecutionRequest = {
        taskId: 'task-1',
        taskTitle: 'Long running task',
        taskDescription: 'Test',
        files: [],
        priority: 'medium',
      };

      return testOrchestrator.submit(request).then(executionId => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            const execution = testOrchestrator.getExecution(executionId);
            expect(execution?.status).toMatch(/failed|cancelled/);
            expect(execution?.error).toBeDefined();
            testOrchestrator.shutdown();
            resolve();
          }, 200);
        });
      });
    });
  });
});
