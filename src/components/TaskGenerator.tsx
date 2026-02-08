/**
 * TaskGenerator component - AI-powered task generation interface
 */

import React, { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import {
  generateTasks,
  generateTasksForNode,
  type GeneratedTask,
} from '../services/taskGenerationService';
import type { CreateTaskInput } from '../types/task';

export interface TaskGeneratorProps {
  filePaths?: string[];
  selectedNodeId?: string;
  selectedNodeLabel?: string;
  connectedFiles?: string[];
  onTasksGenerated?: (count: number) => void;
}

const TaskGenerator: React.FC<TaskGeneratorProps> = ({
  filePaths = [],
  selectedNodeId,
  selectedNodeLabel,
  connectedFiles = [],
  onTasksGenerated,
}) => {
  const { createTask } = useTasks();
  const [isGenerating, setIsGenerating] = useState(false);
  const [userGoal, setUserGoal] = useState('');
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [summary, setSummary] = useState('');
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());

  /**
   * Generate tasks from codebase
   */
  const handleGenerate = async () => {
    if (!filePaths.length && !selectedNodeId) {
      setError('No files available for analysis');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedTasks([]);
    setSelectedTasks(new Set());

    try {
      let tasks: GeneratedTask[];

      if (selectedNodeId && connectedFiles.length > 0) {
        // Generate tasks for specific node
        tasks = await generateTasksForNode(
          selectedNodeId,
          selectedNodeLabel || 'Unknown',
          connectedFiles
        );
        setSummary(`Generated ${tasks.length} tasks for component: ${selectedNodeLabel}`);
        setAssumptions([]);
      } else {
        // Generate tasks for entire codebase
        const result = await generateTasks({
          filePaths,
          userGoal: userGoal.trim() || undefined,
        });
        tasks = result.tasks;
        setSummary(result.summary);
        setAssumptions(result.assumptions);
      }

      setGeneratedTasks(tasks);
      // Auto-select all tasks
      setSelectedTasks(new Set(tasks.map((_, i) => i)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate tasks';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Toggle task selection
   */
  const toggleTaskSelection = (index: number) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTasks(newSelected);
  };

  /**
   * Create selected tasks
   */
  const handleCreateTasks = async () => {
    if (selectedTasks.size === 0) {
      setError('No tasks selected');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const tasksToCreate = Array.from(selectedTasks).map(
        (idx) => generatedTasks[idx]
      );

      // Create tasks in parallel with a small delay to avoid rate limits
      for (const task of tasksToCreate) {
        const input: CreateTaskInput = {
          title: task.title,
          description: task.description,
          priority: task.priority,
          files: task.files,
          status: 'pending',
        };
        await createTask(input);
        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      onTasksGenerated?.(tasksToCreate.length);

      // Reset form
      setGeneratedTasks([]);
      setSelectedTasks(new Set());
      setSummary('');
      setAssumptions([]);
      setUserGoal('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create tasks';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Discard generated tasks
   */
  const handleDiscard = () => {
    setGeneratedTasks([]);
    setSelectedTasks(new Set());
    setSummary('');
    setAssumptions([]);
    setError(null);
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🤖</span>
        <h3 className="text-lg font-semibold text-white">AI Task Generator</h3>
      </div>

      {/* Input Section */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {selectedNodeId
            ? `Analyze component: ${selectedNodeLabel}`
            : `Analyze codebase (${filePaths.length} files)`}
        </label>
        {!selectedNodeId && (
          <textarea
            value={userGoal}
            onChange={(e) => setUserGoal(e.target.value)}
            placeholder="Describe your goal (optional): e.g., 'Improve code quality', 'Add testing', 'Fix performance issues'..."
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none resize-none text-sm"
            disabled={isGenerating}
          />
        )}
      </div>

      {/* Generate Button */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || (!filePaths.length && !selectedNodeId)}
          className="flex-1 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <span>✨</span> Generate Tasks
            </>
          )}
        </button>
        {generatedTasks.length > 0 && (
          <>
            <button
              onClick={handleCreateTasks}
              disabled={isGenerating || selectedTasks.size === 0}
              className="px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            >
              Create Selected ({selectedTasks.size})
            </button>
            <button
              onClick={handleDiscard}
              disabled={isGenerating}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Discard
            </button>
          </>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Generated Tasks */}
      {generatedTasks.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          {summary && (
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
              <p className="text-slate-300 text-sm">{summary}</p>
            </div>
          )}

          {/* Assumptions */}
          {assumptions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">Assumptions:</h4>
              <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                {assumptions.map((assumption, idx) => (
                  <li key={idx}>{assumption}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Task List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300">
                Generated Tasks ({generatedTasks.length})
              </span>
              <button
                onClick={() => {
                  if (selectedTasks.size === generatedTasks.length) {
                    setSelectedTasks(new Set());
                  } else {
                    setSelectedTasks(new Set(generatedTasks.map((_, i) => i)));
                  }
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                {selectedTasks.size === generatedTasks.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>

            {generatedTasks.map((task, idx) => {
              const isSelected = selectedTasks.has(idx);
              return (
                <div
                  key={idx}
                  onClick={() => toggleTaskSelection(idx)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-cyan-900/20 border-cyan-700'
                      : 'bg-slate-900/30 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTaskSelection(idx)}
                      className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-800"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium text-sm mb-1">
                        {task.title}
                      </h4>
                      <p className="text-slate-400 text-xs mb-2 line-clamp-2">
                        {task.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            task.priority === 'critical'
                              ? 'bg-red-900/30 text-red-400'
                              : task.priority === 'high'
                              ? 'bg-orange-900/30 text-orange-400'
                              : task.priority === 'medium'
                              ? 'bg-yellow-900/30 text-yellow-400'
                              : 'bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          {task.priority}
                        </span>
                        {task.estimatedEffort && (
                          <span className="text-xs text-slate-500">
                            Effort: {task.estimatedEffort}
                          </span>
                        )}
                        {task.files && task.files.length > 0 && (
                          <span className="text-xs text-slate-500">
                            {task.files.length} file{task.files.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {task.rationale && (
                        <p className="text-slate-500 text-xs mt-2 italic">
                          {task.rationale}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Help Text */}
      {generatedTasks.length === 0 && (
        <p className="text-slate-500 text-xs">
          AI will analyze your codebase and suggest actionable tasks. Select the tasks
          you want to add to your todo list.
        </p>
      )}
    </div>
  );
};

export default TaskGenerator;
