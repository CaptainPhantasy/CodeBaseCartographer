/**
 * useTasks hook - Task CRUD operations
 * Communicates with backend API at localhost:4000
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskListResponse,
  TaskStats,
} from '../types/task';
import { apiFetch, SERVER_AUTH_SUCCESS_EVENT } from '../services/apiClient';

// Use backend server port (3000 by default)
const API_BASE = 'http://localhost:3000/api';

export interface UseTasksResult {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  stats: TaskStats | null;
  fetchTasks: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, input: UpdateTaskInput) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<boolean>;
  fetchStats: () => Promise<void>;
  getTaskById: (id: string) => Task | undefined;
}

export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TaskStats | null>(null);

  /**
   * Fetch all tasks from API
   */
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch(`${API_BASE}/tasks`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }

      const data: TaskListResponse = await response.json();
      setTasks(data.tasks);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new task
   */
  const createTask = useCallback(async (input: CreateTaskInput): Promise<Task> => {
    setError(null);

    try {
      const response = await apiFetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`Failed to create task: ${response.statusText}`);
      }

      const task: Task = await response.json();
      setTasks((prev) => [task, ...prev]);
      return task;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error creating task:', err);
      throw err;
    }
  }, []);

  /**
   * Update an existing task
   */
  const updateTask = useCallback(
    async (id: string, input: UpdateTaskInput): Promise<Task | null> => {
      setError(null);

      try {
        const response = await apiFetch(`${API_BASE}/tasks/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error(`Failed to update task: ${response.statusText}`);
        }

        const task: Task = await response.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? task : t))
        );
        return task;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('Error updating task:', err);
        return null;
      }
    },
    []
  );

  /**
   * Delete a task
   */
  const deleteTask = useCallback(async (id: string): Promise<boolean> => {
    setError(null);

    try {
      const response = await apiFetch(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete task: ${response.statusText}`);
      }

      setTasks((prev) => prev.filter((t) => t.id !== id));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error deleting task:', err);
      return false;
    }
  }, []);

  /**
   * Fetch task statistics
   */
  const fetchStats = useCallback(async () => {
    try {
      const response = await apiFetch(`${API_BASE}/tasks/stats/summary`);
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }

      const data: TaskStats = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  /**
   * Get a task by ID from local state
   */
  const getTaskById = useCallback(
    (id: string): Task | undefined => {
      return tasks.find((t) => t.id === id);
    },
    [tasks]
  );

  // Fetch tasks on mount, and refetch after a successful server login
  useEffect(() => {
    fetchTasks();
    fetchStats();

    const handleAuthSuccess = () => {
      fetchTasks();
      fetchStats();
    };
    window.addEventListener(SERVER_AUTH_SUCCESS_EVENT, handleAuthSuccess);
    return () => window.removeEventListener(SERVER_AUTH_SUCCESS_EVENT, handleAuthSuccess);
  }, [fetchTasks, fetchStats]);

  return {
    tasks,
    loading,
    error,
    stats,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    fetchStats,
    getTaskById,
  };
}
