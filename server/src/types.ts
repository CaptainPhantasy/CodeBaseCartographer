/**
 * Type definitions for CodeBaseCartographer server
 */

export interface FileEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  timestamp: number;
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  stats?: {
    size: number;
    mtime: Date;
  };
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
}

export interface WriteOperation {
  path: string;
  oldContent: string | null;
  newContent: string;
  timestamp: number;
}

export interface ChangeRecord extends WriteOperation {
  id: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  files: string[];
  dependencies: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: Task['status'];
  priority?: Task['priority'];
  files?: string[];
  dependencies?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: Task['status'];
  priority?: Task['priority'];
  files?: string[];
  dependencies?: string[];
}

export interface WebSocketMessage {
  type: 'file:changed' | 'file:added' | 'file:deleted' | 'task:updated' | 'error';
  data: unknown;
  timestamp: number;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export interface WatcherOptions {
  debounce?: number;
  ignored?: string[];
  persistent?: boolean;
  ignoreInitial?: boolean;
}
