/**
 * TaskCreateDialog component - Form for creating new tasks
 */

import React, { useState, useEffect } from 'react';
import { useTasks } from '../hooks/useTasks';
import type { CreateTaskInput, TaskPriority } from '../types/task';

export interface TaskCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialFiles?: string[];
  initialContext?: string;
}

const TaskCreateDialog: React.FC<TaskCreateDialogProps> = ({
  isOpen,
  onClose,
  initialFiles = [],
  initialContext = '',
}) => {
  const { createTask } = useTasks();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(initialContext);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [files, setFiles] = useState<string[]>(initialFiles);
  const [fileInput, setFileInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription(initialContext);
      setPriority('medium');
      setFiles(initialFiles);
      setFileInput('');
      setError(null);
    }
  }, [isOpen, initialContext, initialFiles]);

  /**
   * Handle file add
   */
  const handleAddFile = () => {
    const trimmed = fileInput.trim();
    if (trimmed && !files.includes(trimmed)) {
      setFiles([...files, trimmed]);
      setFileInput('');
    }
  };

  /**
   * Handle file remove
   */
  const handleRemoveFile = (fileToRemove: string) => {
    setFiles(files.filter((f) => f !== fileToRemove));
  };

  /**
   * Handle form submit
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const input: CreateTaskInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        files: files.length > 0 ? files : undefined,
        status: 'pending',
      };

      await createTask(input);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Create New Task</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Implement user authentication"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task, requirements, and acceptance criteria..."
              rows={5}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Priority
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'low' as TaskPriority, label: 'Low', icon: '○' },
                { value: 'medium' as TaskPriority, label: 'Medium', icon: '◐' },
                { value: 'high' as TaskPriority, label: 'High', icon: '◑' },
                { value: 'critical' as TaskPriority, label: 'Critical', icon: '●' },
              ].map(({ value, label, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  disabled={isSubmitting}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    priority === value
                      ? 'bg-cyan-600 text-white ring-2 ring-cyan-400'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Linked Files */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Linked Files
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={fileInput}
                onChange={(e) => setFileInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFile())}
                placeholder="src/components/MyComponent.tsx"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none font-mono text-sm"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={handleAddFile}
                disabled={isSubmitting || !fileInput.trim()}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            {files.length > 0 && (
              <div className="space-y-1.5">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-3 py-2"
                  >
                    <span className="flex-1 text-cyan-400 font-mono text-sm truncate">
                      {file}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(file)}
                      disabled={isSubmitting}
                      className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex-1 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <span>+</span> Create Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskCreateDialog;
