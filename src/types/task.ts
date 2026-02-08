/**
 * Task types for CodeBaseCartographer
 * Defines task interface matching backend schema
 */

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  files: string[];
  dependencies: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  files?: string[];
  dependencies?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  files?: string[];
  dependencies?: string[];
}

export interface TaskListResponse {
  tasks: Task[];
  count: number;
}

export interface TaskStats {
  [status: string]: number;
}

// Valid status transitions
export const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'blocked'],
  in_progress: ['completed', 'blocked', 'pending'],
  completed: ['in_progress', 'pending'],
  blocked: ['pending', 'in_progress'],
};

// Status display configuration
export const STATUS_CONFIG: Record<TaskStatus, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  pending: {
    label: 'Proposed',
    color: 'text-slate-300',
    bgColor: 'bg-slate-700/50',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/30',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-400',
    bgColor: 'bg-green-900/30',
  },
  blocked: {
    label: 'Blocked',
    color: 'text-red-400',
    bgColor: 'bg-red-900/30',
  },
};

// Priority display configuration
export const PRIORITY_CONFIG: Record<TaskPriority, {
  label: string;
  color: string;
  icon: string;
}> = {
  low: {
    label: 'Low',
    color: 'text-slate-400',
    icon: '○',
  },
  medium: {
    label: 'Medium',
    color: 'text-yellow-400',
    icon: '◐',
  },
  high: {
    label: 'High',
    color: 'text-orange-400',
    icon: '◑',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-500',
    icon: '●',
  },
};
