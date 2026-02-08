/**
 * TasksView component - Main task management interface
 * Combines TodoList, TaskGenerator, and TaskCreateDialog
 */

import React, { useState } from 'react';
import TodoList from './TodoList';
import TaskGenerator from './TaskGenerator';
import TaskCreateDialog from './TaskCreateDialog';
import type { Node } from '../types';

export interface TasksViewProps {
  filePaths?: string[];
  selectedNode?: Node;
  onNodeClick?: (nodeId: string) => void;
}

const TasksView: React.FC<TasksViewProps> = ({
  filePaths = [],
  selectedNode,
  onNodeClick,
}) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [generatorKey, setGeneratorKey] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);

  /**
   * Handle tasks generated
   */
  const handleTasksGenerated = (count: number) => {
    setNotification(`Created ${count} tasks`);
    setTimeout(() => setNotification(null), 3000);
    // Reset generator to clear state
    setGeneratorKey((prev) => prev + 1);
  };

  /**
   * Handle node click from task card
   */
  const handleNodeClick = (filePaths: string[]) => {
    // For now, just log. Could be enhanced to highlight files in graph
    console.log('Node click requested for files:', filePaths);
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Task Management</h1>
          <p className="text-slate-400 text-sm mt-1">
            {selectedNode
              ? `Tasks for component: ${selectedNode.label}`
              : 'Manage tasks for your codebase'}
          </p>
        </div>
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-cyan-900/20"
        >
          <span className="text-lg">+</span> New Task
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Task Generator - Side Panel */}
        <div className="w-96 flex-shrink-0 overflow-y-auto">
          <TaskGenerator
            key={generatorKey}
            filePaths={filePaths}
            selectedNodeId={selectedNode?.id}
            selectedNodeLabel={selectedNode?.label}
            connectedFiles={selectedNode ? [] : undefined} // Could be populated from graph data
            onTasksGenerated={handleTasksGenerated}
          />
        </div>

        {/* Todo List - Main Board */}
        <div className="flex-1 overflow-hidden">
          <TodoList
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedNode?.id}
          />
        </div>
      </div>

      {/* Create Task Dialog */}
      <TaskCreateDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        initialFiles={selectedNode ? [] : undefined}
        initialContext={
          selectedNode
            ? `Task related to component: ${selectedNode.label}`
            : undefined
        }
      />
    </div>
  );
};

export default TasksView;
