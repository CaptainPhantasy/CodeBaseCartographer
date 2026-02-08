/**
 * subagentOrchestrator.ts - Pool management for code execution subagents
 *
 * Features:
 * - Max 3 concurrent executions
 * - Timeout handling with configurable limits
 * - Progress streaming via callbacks
 * - Queue management with priority
 * - Error handling and retry logic
 */

import { randomUUID } from 'crypto';
import type {
  ExecutionRequest,
  ExecutionResult,
  ExecutionStatus,
  ProgressMessage,
  FileChange,
  SubagentPoolConfig,
  PoolStatistics,
  ExecutionEvent,
} from '../types/subagent';

/**
 * Default configuration for subagent pool
 */
const DEFAULT_CONFIG: SubagentPoolConfig = {
  maxConcurrent: 3,
  defaultTimeout: 300000, // 5 minutes
  retryAttempts: 2,
  retryDelay: 1000, // 1 second
};

/**
 * Queue item for pending executions
 */
interface QueueItem {
  id: string;
  request: ExecutionRequest;
  priority: number;
  timestamp: number;
}

/**
 * Active execution with state
 */
interface ActiveExecution {
  id: string;
  request: ExecutionRequest;
  result: ExecutionResult;
  startTime: number;
  timeout: NodeJS.Timeout | null;
  abortController: AbortController;
}

/**
 * Callback for execution events
 */
type ExecutionCallback = (event: ExecutionEvent) => void;

/**
 * SubagentOrchestrator - Manages pool of subagent executions
 */
export class SubagentOrchestrator {
  private config: SubagentPoolConfig;
  private queue: Map<string, QueueItem> = new Map();
  private active: Map<string, ActiveExecution> = new Map();
  private history: Map<string, ExecutionResult> = new Map();
  private callbacks: Set<ExecutionCallback> = new Set();
  private processingQueue: boolean = false;

  constructor(config?: Partial<SubagentPoolConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a callback for execution events
   */
  public onEvent(callback: ExecutionCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Emit an event to all registered callbacks
   */
  private emitEvent(event: ExecutionEvent): void {
    this.callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in execution callback:', error);
      }
    });
  }

  /**
   * Submit a task for execution
   */
  public async submit(request: ExecutionRequest): Promise<string> {
    const executionId = randomUUID();

    // Create execution result
    const result: ExecutionResult = {
      executionId,
      taskId: request.taskId,
      status: 'queued',
      progress: 0,
      messages: [],
      changes: [],
      startedAt: Date.now(),
      metadata: {
        filesModified: 0,
        linesChanged: 0,
        subagentVersion: '1.0.0',
      },
    };

    // Add to queue
    const queueItem: QueueItem = {
      id: executionId,
      request,
      priority: this.getPriorityValue(request.priority),
      timestamp: Date.now(),
    };

    this.queue.set(executionId, queueItem);
    this.history.set(executionId, result);

    this.emitEvent({
      type: 'status_change',
      executionId,
      timestamp: Date.now(),
      data: { status: 'queued' },
    });

    // Try to process queue
    this.processQueue();

    return executionId;
  }

  /**
   * Cancel an execution
   */
  public cancel(executionId: string): boolean {
    // Check active executions
    const active = this.active.get(executionId);
    if (active) {
      active.abortController.abort();
      if (active.timeout) {
        clearTimeout(active.timeout);
      }

      this.updateStatus(executionId, 'cancelled');
      this.active.delete(executionId);
      this.processQueue();
      return true;
    }

    // Check queued executions
    const queued = this.queue.get(executionId);
    if (queued) {
      this.queue.delete(executionId);
      this.updateStatus(executionId, 'cancelled');
      return true;
    }

    return false;
  }

  /**
   * Get execution result by ID
   */
  public getExecution(executionId: string): ExecutionResult | undefined {
    return this.history.get(executionId);
  }

  /**
   * Get all active executions
   */
  public getActiveExecutions(): ExecutionResult[] {
    return Array.from(this.active.values()).map(a => a.result);
  }

  /**
   * Get all queued executions
   */
  public getQueuedExecutions(): ExecutionResult[] {
    return Array.from(this.queue.values()).map(q => this.history.get(q.id)!);
  }

  /**
   * Get pool statistics
   */
  public getStatistics(): PoolStatistics {
    const completed = Array.from(this.history.values()).filter(
      r => r.status === 'completed'
    );

    const totalExecutionTime = completed.reduce((sum, r) => {
      return sum + (r.completedAt! - r.startedAt);
    }, 0);

    return {
      totalExecutions: this.history.size,
      activeExecutions: this.active.size,
      queuedExecutions: this.queue.size,
      completedExecutions: completed.length,
      failedExecutions: Array.from(this.history.values()).filter(
        r => r.status === 'failed'
      ).length,
      averageExecutionTime: completed.length > 0
        ? totalExecutionTime / completed.length
        : 0,
    };
  }

  /**
   * Process the execution queue
   */
  private processQueue(): void {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    try {
      // Sort queue by priority (highest first) and timestamp
      const sorted = Array.from(this.queue.entries()).sort(([, a], [, b]) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.timestamp - b.timestamp; // Earlier timestamp first
      });

      // Start as many as we can
      for (const [executionId, queueItem] of sorted) {
        if (this.active.size >= this.config.maxConcurrent) {
          break;
        }

        this.queue.delete(executionId);
        this.startExecution(queueItem);
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Start an execution
   */
  private startExecution(queueItem: QueueItem): void {
    const { id, request } = queueItem;

    const abortController = new AbortController();
    const timeout = request.timeout || this.config.defaultTimeout;

    // Create active execution
    const active: ActiveExecution = {
      id,
      request,
      result: this.history.get(id)!,
      startTime: Date.now(),
      timeout: null,
      abortController,
    };

    this.active.set(id, active);
    this.updateStatus(id, 'initializing');

    // Set up timeout
    active.timeout = setTimeout(() => {
      if (this.active.has(id)) {
        abortController.abort();
        this.failExecution(id, 'Execution timeout exceeded');
      }
    }, timeout);

    // Start the actual execution (simulated for now)
    this.simulateExecution(active);
  }

  /**
   * Simulate execution (replace with actual subagent call)
   * TODO: Integrate with actual AI service for code execution
   */
  private async simulateExecution(active: ActiveExecution): Promise<void> {
    const { id, request, result } = active;

    try {
      this.updateStatus(id, 'running');

      // Simulate progress updates
      const steps = [
        { progress: 10, message: 'Analyzing task requirements...' },
        { progress: 25, message: 'Reading source files...' },
        { progress: 40, message: 'Generating code changes...' },
        { progress: 60, message: 'Validating changes...' },
        { progress: 80, message: 'Applying changes...' },
        { progress: 95, message: 'Verifying results...' },
        { progress: 100, message: 'Complete!' },
      ];

      for (const step of steps) {
        await this.delay(500);
        this.addMessage(id, {
          id: randomUUID(),
          timestamp: Date.now(),
          severity: 'info',
          message: step.message,
        });
        this.updateProgress(id, step.progress);
      }

      // Simulate file changes
      if (request.files.length > 0) {
        const change: FileChange = {
          path: request.files[0],
          changeType: 'update',
          oldContent: '// Old content\n',
          newContent: '// New content\n',
          diff: '@@ -1,1 +1,1 @@\n-// Old content\n+// New content\n',
          changeId: randomUUID(),
        };
        this.addChange(id, change);
      }

      this.completeExecution(id);
    } catch (error) {
      this.failExecution(id, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Complete an execution successfully
   */
  private completeExecution(executionId: string): void {
    const active = this.active.get(executionId);
    if (!active) return;

    if (active.timeout) {
      clearTimeout(active.timeout);
    }

    active.result.status = 'completed';
    active.result.progress = 100;
    active.result.completedAt = Date.now();

    this.active.delete(executionId);

    this.emitEvent({
      type: 'complete',
      executionId,
      timestamp: Date.now(),
      data: active.result,
    });

    this.processQueue();
  }

  /**
   * Fail an execution
   */
  private failExecution(executionId: string, errorMessage: string): void {
    const active = this.active.get(executionId);
    if (!active) return;

    if (active.timeout) {
      clearTimeout(active.timeout);
    }

    active.result.status = 'failed';
    active.result.error = {
      message: errorMessage,
      code: 'EXECUTION_FAILED',
    };
    active.result.completedAt = Date.now();

    this.addMessage(executionId, {
      id: randomUUID(),
      timestamp: Date.now(),
      severity: 'error',
      message: errorMessage,
    });

    this.active.delete(executionId);

    this.emitEvent({
      type: 'error',
      executionId,
      timestamp: Date.now(),
      data: { error: errorMessage },
    });

    this.processQueue();
  }

  /**
   * Update execution status
   */
  private updateStatus(executionId: string, status: ExecutionStatus): void {
    const result = this.history.get(executionId);
    if (result) {
      result.status = status;
      this.emitEvent({
        type: 'status_change',
        executionId,
        timestamp: Date.now(),
        data: { status },
      });
    }
  }

  /**
   * Update execution progress
   */
  private updateProgress(executionId: string, progress: number): void {
    const result = this.history.get(executionId);
    if (result) {
      result.progress = Math.min(100, Math.max(0, progress));
      this.emitEvent({
        type: 'progress',
        executionId,
        timestamp: Date.now(),
        data: { progress },
      });
    }
  }

  /**
   * Add a message to execution
   */
  private addMessage(executionId: string, message: ProgressMessage): void {
    const result = this.history.get(executionId);
    if (result) {
      result.messages.push(message);
      this.emitEvent({
        type: 'progress',
        executionId,
        timestamp: Date.now(),
        data: { message },
      });
    }
  }

  /**
   * Add a file change to execution
   */
  private addChange(executionId: string, change: FileChange): void {
    const result = this.history.get(executionId);
    if (result) {
      result.changes.push(change);
      result.metadata.filesModified++;

      if (change.diff) {
        const linesChanged = change.diff.split('\n').filter(
          line => line.startsWith('+') || line.startsWith('-')
        ).length;
        result.metadata.linesChanged += linesChanged;
      }

      this.emitEvent({
        type: 'file_change',
        executionId,
        timestamp: Date.now(),
        data: { change },
      });
    }
  }

  /**
   * Get numeric priority value
   */
  private getPriorityValue(priority: string): number {
    const values: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return values[priority] || 0;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear all history
   */
  public clearHistory(): void {
    this.history.clear();
  }

  /**
   * Shutdown orchestrator
   */
  public shutdown(): void {
    // Cancel all active executions
    for (const [id, active] of this.active.entries()) {
      active.abortController.abort();
      if (active.timeout) {
        clearTimeout(active.timeout);
      }
      this.updateStatus(id, 'cancelled');
    }

    this.active.clear();
    this.queue.clear();
    this.callbacks.clear();
  }
}

// Singleton instance
let orchestratorInstance: SubagentOrchestrator | null = null;

/**
 * Get or create the singleton orchestrator instance
 */
export function getOrchestrator(config?: Partial<SubagentPoolConfig>): SubagentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new SubagentOrchestrator(config);
  }
  return orchestratorInstance;
}
