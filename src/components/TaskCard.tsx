/**
 * TaskCard component - Individual task display with status controls
 */

import React, { useState } from 'react';
import type { Task } from '../types/task';
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  STATUS_TRANSITIONS,
} from '../types/task';

export interface TaskCardProps {
  task: Task;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onNodeClick?: (filePaths: string[]) => void;
  isDragging?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onUpdate,
  onDelete,
  onNodeClick,
  isDragging = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const statusInfo = STATUS_CONFIG[task.status];
  const priorityInfo = PRIORITY_CONFIG[task.priority];

  const handleStatusChange = (newStatus: typeof task.status) => {
    onUpdate(task.id, { status: newStatus });
  };

  const handlePriorityChange = (newPriority: typeof task.priority) => {
    onUpdate(task.id, { priority: newPriority });
  };

  const handleFileClick = (file: string) => {
    if (onNodeClick) {
      onNodeClick([file]);
    }
  };

  return (
    <div
      className={`bg-slate-800 border border-slate-700 rounded-lg p-4 transition-all ${
        isDragging ? 'opacity-50 scale-95' : 'hover:border-slate-600'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm truncate">
            {task.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs px-2 py-0.5 rounded ${statusInfo.bgColor} ${statusInfo.color}`}
            >
              {statusInfo.label}
            </span>
            <span className={`text-xs ${priorityInfo.color} flex items-center gap-1`}>
              {priorityInfo.icon} {priorityInfo.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▼' : '▶'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
            title="Delete task"
          >
            🗑
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="space-y-3 mt-3 pt-3 border-t border-slate-700">
          {/* Description */}
          {task.description && (
            <p className="text-slate-300 text-sm whitespace-pre-wrap">
              {task.description}
            </p>
          )}

          {/* Status Controls */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                const isCurrent = status === task.status;
                const isValid = STATUS_TRANSITIONS[task.status].includes(
                  status as typeof task.status
                );

                return (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status as typeof task.status)}
                    disabled={!isValid && !isCurrent}
                    className={`text-xs px-2.5 py-1 rounded transition-colors ${
                      isCurrent
                        ? `${config.bgColor} ${config.color} ring-1 ring-current`
                        : isValid
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority Controls */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">
              Priority
            </label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => {
                const isCurrent = priority === task.priority;
                return (
                  <button
                    key={priority}
                    onClick={() => handlePriorityChange(priority as typeof task.priority)}
                    className={`text-xs px-2.5 py-1 rounded transition-colors ${
                      isCurrent
                        ? `${config.color} bg-slate-700 ring-1 ring-current`
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {config.icon} {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Linked Files */}
          {task.files.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">
                Linked Files ({task.files.length})
              </label>
              <div className="space-y-1">
                {task.files.map((file, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleFileClick(file)}
                    className="w-full text-left text-xs bg-slate-900/50 hover:bg-slate-700/50 text-cyan-400 hover:text-cyan-300 px-2.5 py-1.5 rounded font-mono truncate transition-colors"
                    title={file}
                  >
                    {file}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {task.dependencies.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">
                Dependencies ({task.dependencies.length})
              </label>
              <div className="flex flex-wrap gap-1.5">
                {task.dependencies.map((dep) => (
                  <span
                    key={dep}
                    className="text-xs bg-slate-900/50 text-slate-400 px-2 py-1 rounded font-mono"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
            Created: {new Date(task.createdAt).toLocaleString()}
            {task.updatedAt !== task.createdAt && (
              <span className="ml-3">
                Updated: {new Date(task.updatedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 max-w-sm mx-4 shadow-xl">
            <h3 className="text-white font-semibold mb-2">Delete Task?</h3>
            <p className="text-slate-300 text-sm mb-4">
              Are you sure you want to delete "{task.title}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(task.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskCard;
