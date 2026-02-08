/**
 * CodeExecutionPanel.tsx - Execution UI with progress tracking
 *
 * Features:
 * - Real-time progress display
 * - Streaming messages from subagent
 * - File change tracking with diff previews
 * - Execution controls (cancel, retry)
 * - Status indicators
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ExecutionResult, ProgressMessage, FileChange } from '../types/subagent';
import { getOrchestrator } from '../services/subagentOrchestrator';

export interface CodeExecutionPanelProps {
  taskId: string;
  taskTitle: string;
  onClose?: () => void;
}

interface FileChangeWithExpanded extends FileChange {
  expanded?: boolean;
}

const CodeExecutionPanel: React.FC<CodeExecutionPanelProps> = ({
  taskId,
  taskTitle,
  onClose,
}) => {
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [changes, setChanges] = useState<FileChangeWithExpanded[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Subscribe to execution events
  useEffect(() => {
    const orchestrator = getOrchestrator();

    const unsubscribe = orchestrator.onEvent((event) => {
      if (event.executionId === execution?.executionId) {
        const updated = orchestrator.getExecution(event.executionId);
        if (updated) {
          setExecution(updated);
          setChanges(updated.changes.map(c => ({ ...c, expanded: false })));

          if (updated.status === 'completed' || updated.status === 'failed') {
            setIsExecuting(false);
          }
        }
      }
    });

    return unsubscribe;
  }, [execution?.executionId]);

  // Start execution
  const startExecution = useCallback(async () => {
    const orchestrator = getOrchestrator();
    setIsExecuting(true);

    const executionId = await orchestrator.submit({
      taskId,
      taskTitle,
      taskDescription: '', // Will be populated from task
      files: [],
      priority: 'medium',
    });

    const result = orchestrator.getExecution(executionId);
    if (result) {
      setExecution(result);
    }
  }, [taskId, taskTitle]);

  // Cancel execution
  const cancelExecution = useCallback(() => {
    if (execution) {
      const orchestrator = getOrchestrator();
      orchestrator.cancel(execution.executionId);
      setIsExecuting(false);
    }
  }, [execution]);

  // Toggle change expansion
  const toggleChange = useCallback((index: number) => {
    setChanges(prev =>
      prev.map((change, i) =>
        i === index ? { ...change, expanded: !change.expanded } : change
      )
    );
  }, []);

  // Get status color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      queued: 'bg-slate-700 text-slate-300',
      initializing: 'bg-blue-900/30 text-blue-400',
      running: 'bg-yellow-900/30 text-yellow-400',
      awaiting_approval: 'bg-purple-900/30 text-purple-400',
      completed: 'bg-green-900/30 text-green-400',
      failed: 'bg-red-900/30 text-red-400',
      cancelled: 'bg-slate-800 text-slate-400',
      rolled_back: 'bg-orange-900/30 text-orange-400',
    };
    return colors[status] || colors.queued;
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    const icons: Record<string, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅',
    };
    return icons[severity] || icons.info;
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">{taskTitle}</h3>
            {execution && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(execution.status)}`}>
                  {execution.status.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="text-xs text-slate-400">
                  {execution.progress}% complete
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!execution && (
              <button
                onClick={startExecution}
                disabled={isExecuting}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded transition-colors"
              >
                Execute
              </button>
            )}
            {execution && (execution.status === 'running' || execution.status === 'initializing') && (
              <button
                onClick={cancelExecution}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
              >
                Cancel
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {execution && execution.status !== 'queued' && (
          <div className="mt-3">
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300"
                style={{ width: `${execution.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* Messages */}
        {execution && execution.messages.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Progress</h4>
            <div className="space-y-1">
              {execution.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`text-xs p-2 rounded ${
                    msg.severity === 'error'
                      ? 'bg-red-900/20 text-red-400'
                      : msg.severity === 'warning'
                      ? 'bg-yellow-900/20 text-yellow-400'
                      : msg.severity === 'success'
                      ? 'bg-green-900/20 text-green-400'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <span className="mr-1">{getSeverityIcon(msg.severity)}</span>
                  {msg.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Changes */}
        {changes.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2">
              File Changes ({changes.length})
            </h4>
            <div className="space-y-2">
              {changes.map((change, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800 border border-slate-700 rounded overflow-hidden"
                >
                  <button
                    onClick={() => toggleChange(idx)}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={change.expanded ? 'rotate-90' : ''}>▶</span>
                      <span className="text-sm font-mono text-cyan-400">{change.path}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        change.changeType === 'create'
                          ? 'bg-green-900/30 text-green-400'
                          : change.changeType === 'delete'
                          ? 'bg-red-900/30 text-red-400'
                          : 'bg-blue-900/30 text-blue-400'
                      }`}>
                        {change.changeType}
                      </span>
                    </div>
                    {change.changeId && (
                      <span className="text-xs text-slate-500 font-mono">
                        {change.changeId.slice(0, 8)}
                      </span>
                    )}
                  </button>
                  {change.expanded && change.diff && (
                    <div className="px-3 py-2 border-t border-slate-700 bg-slate-900">
                      <pre className="text-xs font-mono text-slate-300 overflow-x-auto">
                        {change.diff}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {execution?.error && (
          <div className="bg-red-900/20 border border-red-900/50 rounded p-3">
            <h4 className="text-sm font-semibold text-red-400 mb-1">Error</h4>
            <p className="text-xs text-red-300">{execution.error.message}</p>
            {execution.error.stack && (
              <details className="mt-2">
                <summary className="text-xs text-red-400 cursor-pointer hover:text-red-300">
                  Stack trace
                </summary>
                <pre className="text-xs text-red-300 mt-2 overflow-x-auto">
                  {execution.error.stack}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Metadata */}
        {execution && execution.status === 'completed' && (
          <div className="bg-slate-800 border border-slate-700 rounded p-3">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-slate-400">Files modified:</div>
              <div className="text-slate-200">{execution.metadata.filesModified}</div>
              <div className="text-slate-400">Lines changed:</div>
              <div className="text-slate-200">{execution.metadata.linesChanged}</div>
              <div className="text-slate-400">Duration:</div>
              <div className="text-slate-200">
                {execution.completedAt && execution.startedAt
                  ? `${((execution.completedAt - execution.startedAt) / 1000).toFixed(2)}s`
                  : 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!execution && !isExecuting && (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">Ready to execute this task</p>
            <p className="text-slate-500 text-xs mt-1">
              Click "Execute" to start the code generation
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeExecutionPanel;
