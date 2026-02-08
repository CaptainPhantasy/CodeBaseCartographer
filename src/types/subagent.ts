/**
 * subagent.ts - Execution result types for subagent operations
 *
 * Defines the contract for code execution by subagents with:
 * - Real-time progress streaming
 * - Change tracking with diffs
 * - Error handling and rollback support
 */

/**
 * Execution status for a subagent task
 */
export type ExecutionStatus =
  | 'queued'           // Waiting in pool
  | 'initializing'     // Starting up
  | 'running'          // Actively executing
  | 'awaiting_approval' // Waiting for user confirmation
  | 'completed'        // Finished successfully
  | 'failed'           // Errored out
  | 'cancelled'        // User cancelled
  | 'rolled_back';     // Changes were undone

/**
 * Severity level for execution messages
 */
export type MessageSeverity = 'info' | 'warning' | 'error' | 'success';

/**
 * Single progress message from subagent
 */
export interface ProgressMessage {
  id: string;
  timestamp: number;
  severity: MessageSeverity;
  message: string;
  details?: string;
  code?: string; // Error code if applicable
}

/**
 * File change with diff information
 */
export interface FileChange {
  path: string;
  changeType: 'create' | 'update' | 'delete';
  oldContent?: string;
  newContent?: string;
  diff?: string; // Unified diff format
  changeId?: string; // ID from change journal for rollback
}

/**
 * Complete execution result from subagent
 */
export interface ExecutionResult {
  executionId: string;
  taskId: string;
  status: ExecutionStatus;
  progress: number; // 0-100
  messages: ProgressMessage[];
  changes: FileChange[];
  startedAt: number;
  completedAt?: number;
  error?: {
    message: string;
    code: string;
    stack?: string;
  };
  metadata: {
    filesModified: number;
    linesChanged: number;
    subagentVersion: string;
  };
}

/**
 * Request to execute a task
 */
export interface ExecutionRequest {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  files: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number; // milliseconds
}

/**
 * Configuration for subagent pool
 */
export interface SubagentPoolConfig {
  maxConcurrent: number;
  defaultTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Event emitted during execution
 */
export interface ExecutionEvent {
  type: 'progress' | 'status_change' | 'file_change' | 'error' | 'complete';
  executionId: string;
  timestamp: number;
  data: unknown;
}

/**
 * Approval request for destructive operations
 */
export interface ApprovalRequest {
  executionId: string;
  operation: string;
  description: string;
  files: string[];
  risks: string[];
  preview?: string; // Diff preview or code snippet
}

/**
 * Approval response
 */
export interface ApprovalResponse {
  approved: boolean;
  executionId: string;
  cancelExecution?: boolean;
}

/**
 * Rollback request
 */
export interface RollbackRequest {
  executionId: string;
  changeIds: string[];
  reason?: string;
}

/**
 * Rollback result
 */
export interface RollbackResult {
  success: boolean;
  filesRestored: string[];
  errors: string[];
  timestamp: number;
}

/**
 * Statistics for the execution pool
 */
export interface PoolStatistics {
  totalExecutions: number;
  activeExecutions: number;
  queuedExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
}
