/**
 * useTaskExecution.ts - Hook for managing task execution with subagent
 *
 * Features:
 * - Execute tasks through subagent orchestrator
 * - Track execution status and progress
 * - Handle rollback of completed tasks
 * - Real-time updates via callbacks
 */

import { useState, useCallback, useEffect } from 'react';
import type { Task } from '../types/task';
import type { ExecutionResult } from '../types/subagent';
import { getOrchestrator } from '../services/subagentOrchestrator';
import { getRollbackService } from '../services/rollbackService';

export interface TaskExecutionState {
  executionId: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'rolling_back';
  progress: number;
  error: string | null;
  result: ExecutionResult | null;
}

export function useTaskExecution() {
  const [state, setState] = useState<TaskExecutionState>({
    executionId: null,
    status: 'idle',
    progress: 0,
    error: null,
    result: null,
  });

  const [taskExecutions, setTaskExecutions] = useState<Map<string, string>>(new Map());

  // Subscribe to execution events
  useEffect(() => {
    const orchestrator = getOrchestrator();

    const unsubscribe = orchestrator.onEvent((event) => {
      if (event.executionId === state.executionId) {
        const result = orchestrator.getExecution(event.executionId);

        if (result) {
          setState(prev => ({
            ...prev,
            result,
            status: result.status === 'completed'
              ? 'completed'
              : result.status === 'failed'
              ? 'failed'
              : prev.status,
            progress: result.progress,
            error: result.error?.message || null,
          }));
        }
      }
    });

    return unsubscribe;
  }, [state.executionId]);

  // Execute a task
  const executeTask = useCallback(async (task: Task) => {
    try {
      setState({
        executionId: null,
        status: 'running',
        progress: 0,
        error: null,
        result: null,
      });

      const orchestrator = getOrchestrator();
      const executionId = await orchestrator.submit({
        taskId: task.id,
        taskTitle: task.title,
        taskDescription: task.description || '',
        files: task.files,
        priority: task.priority,
      });

      setTaskExecutions(prev => new Map(prev).set(task.id, executionId));

      setState(prev => ({
        ...prev,
        executionId,
      }));

      return executionId;
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to execute task',
      }));
      return null;
    }
  }, []);

  // Undo a task execution
  const undoTask = useCallback(async (task: Task) => {
    const executionId = taskExecutions.get(task.id);

    if (!executionId) {
      setState(prev => ({
        ...prev,
        error: 'No execution found for this task',
      }));
      return false;
    }

    try {
      setState(prev => ({
        ...prev,
        status: 'rolling_back',
      }));

      const orchestrator = getOrchestrator();
      const execution = orchestrator.getExecution(executionId);

      if (!execution || execution.changes.length === 0) {
        setState(prev => ({
          ...prev,
          status: 'idle',
          error: 'No changes to rollback',
        }));
        return false;
      }

      const rollbackService = getRollbackService();
      const result = await rollbackService.rollbackExecution(executionId, execution.changes);

      if (result.success) {
        setState({
          executionId: null,
          status: 'idle',
          progress: 0,
          error: null,
          result: null,
        });
        return true;
      } else {
        setState(prev => ({
          ...prev,
          status: 'idle',
          error: result.errors.join(', '),
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'idle',
        error: error instanceof Error ? error.message : 'Rollback failed',
      }));
      return false;
    }
  }, [taskExecutions]);

  // Get execution status for a task
  const getTaskExecutionStatus = useCallback((taskId: string) => {
    const executionId = taskExecutions.get(taskId);
    if (!executionId) return 'idle';

    const orchestrator = getOrchestrator();
    const execution = orchestrator.getExecution(executionId);

    return execution?.status || 'idle';
  }, [taskExecutions]);

  // Cancel a running execution
  const cancelExecution = useCallback((taskId: string) => {
    const executionId = taskExecutions.get(taskId);
    if (executionId) {
      const orchestrator = getOrchestrator();
      return orchestrator.cancel(executionId);
    }
    return false;
  }, [taskExecutions]);

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    state,
    executeTask,
    undoTask,
    getTaskExecutionStatus,
    cancelExecution,
    clearError,
  };
}
