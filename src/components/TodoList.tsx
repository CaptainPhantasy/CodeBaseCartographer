/**
 * TodoList component - Drag-and-drop task list with columns
 */

import React, { useState, useCallback } from 'react';
import { useTasks } from '../hooks/useTasks';
import type { Task, TaskStatus } from '../types/task';
import { STATUS_CONFIG } from '../types/task';
import TaskCard from './TaskCard';

const STATUS_COLUMNS: TaskStatus[] = ['pending', 'in_progress', 'completed', 'blocked'];

export interface TodoListProps {
  onNodeClick?: (filePaths: string[]) => void;
  selectedNodeId?: string;
}

const TodoList: React.FC<TodoListProps> = ({ onNodeClick, selectedNodeId }) => {
  const { tasks, loading, error, updateTask, deleteTask } = useTasks();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback((task: Task) => {
    setDraggedTask(task);
  }, []);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  /**
   * Handle drop on column
   */
  const handleDrop = useCallback(
    async (status: TaskStatus) => {
      if (draggedTask && draggedTask.status !== status) {
        await updateTask(draggedTask.id, { status });
      }
      setDraggedTask(null);
    },
    [draggedTask, updateTask]
  );

  /**
   * Handle drag end
   */
  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
  }, []);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-75" />
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-150" />
          <span className="text-slate-400 ml-2">Loading tasks...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
        <p className="text-red-400 text-sm">Error loading tasks: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Group tasks by status
  const tasksByStatus = STATUS_COLUMNS.reduce((acc, status) => {
    acc[status] = tasks.filter((t) => t.status === status);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Tasks</h2>
        <div className="text-sm text-slate-400">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-w-max h-full pb-4">
          {STATUS_COLUMNS.map((status) => {
            const statusInfo = STATUS_CONFIG[status];
            const columnTasks = tasksByStatus[status] || [];

            return (
              <div
                key={status}
                className={`flex-shrink-0 w-80 flex flex-col bg-slate-800/50 rounded-lg border ${status === 'blocked' ? 'border-red-900/30' : 'border-slate-700/50'}`}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(status)}
              >
                {/* Column Header */}
                <div className={`p-3 border-b ${status === 'blocked' ? 'border-red-900/30' : 'border-slate-700/50'} ${statusInfo.bgColor}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                {/* Task List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {columnTasks.length === 0 ? (
                    <div className="text-center py-8">
                      <span className="text-slate-600 text-sm">No tasks</span>
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart(task)}
                        onDragEnd={handleDragEnd}
                        className="cursor-move"
                      >
                        <TaskCard
                          task={task}
                          onUpdate={updateTask}
                          onDelete={deleteTask}
                          onNodeClick={onNodeClick}
                          isDragging={draggedTask?.id === task.id}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TodoList;
