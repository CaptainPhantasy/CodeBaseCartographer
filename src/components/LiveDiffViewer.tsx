/**
 * LiveDiffViewer.tsx - Real-time diff visualization
 *
 * Features:
 * - Show diffs as changes happen
 * - Syntax highlighting for code
 * - Side-by-side or unified view
 * - Change statistics
 */

import React, { useState, useEffect } from 'react';
import type { FileChange } from '../types/subagent';

export interface LiveDiffViewerProps {
  changes: FileChange[];
  autoScroll?: boolean;
  maxHeight?: string;
}

type ViewMode = 'unified' | 'side-by-side';

const LiveDiffViewer: React.FC<LiveDiffViewerProps> = ({
  changes,
  autoScroll = true,
  maxHeight = '500px',
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('unified');
  const [selectedChange, setSelectedChange] = useState<number | null>(null);

  // Auto-select latest change
  useEffect(() => {
    if (autoScroll && changes.length > 0 && selectedChange === null) {
      setSelectedChange(changes.length - 1);
    }
  }, [changes.length, autoScroll, selectedChange]);

  // Calculate statistics
  const stats = changes.reduce((acc, change) => {
    if (change.diff) {
      const additions = (change.diff.match(/\n\+/g) || []).length;
      const deletions = (change.diff.match(/\n-/g) || []).length;
      return {
        additions: acc.additions + additions,
        deletions: acc.deletions + deletions,
        files: acc.files + 1,
      };
    }
    return acc;
  }, { additions: 0, deletions: 0, files: 0 });

  // Get change type color
  const getChangeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      create: 'text-green-400 bg-green-900/30',
      update: 'text-blue-400 bg-blue-900/30',
      delete: 'text-red-400 bg-red-900/30',
    };
    return colors[type] || colors.update;
  };

  // Render unified diff
  const renderUnifiedDiff = (change: FileChange) => {
    if (!change.diff) {
      return (
        <div className="text-slate-400 text-sm p-4">
          No diff available for this change
        </div>
      );
    }

    const lines = change.diff.split('\n');
    return (
      <div className="font-mono text-xs">
        {lines.map((line, idx) => {
          const lineClass = line.startsWith('+')
            ? 'bg-green-900/20 text-green-300'
            : line.startsWith('-')
            ? 'bg-red-900/20 text-red-300'
            : line.startsWith('@@')
            ? 'bg-purple-900/30 text-purple-300 font-bold'
            : 'text-slate-300';

          return (
            <div key={idx} className={`px-2 ${lineClass}`}>
              {line || ' '}
            </div>
          );
        })}
      </div>
    );
  };

  // Render side-by-side diff
  const renderSideBySideDiff = (change: FileChange) => {
    if (!change.oldContent || !change.newContent) {
      return renderUnifiedDiff(change);
    }

    const oldLines = change.oldContent.split('\n');
    const newLines = change.newContent.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);

    return (
      <div className="font-mono text-xs grid grid-cols-2 gap-1">
        <div className="bg-red-900/10">
          <div className="bg-red-900/30 text-red-300 px-2 py-1 font-bold sticky top-0">
            REMOVED
          </div>
          {oldLines.map((line, idx) => (
            <div key={idx} className="px-2 text-slate-300 border-b border-slate-700/50">
              {line || ' '}
            </div>
          ))}
        </div>
        <div className="bg-green-900/10">
          <div className="bg-green-900/30 text-green-300 px-2 py-1 font-bold sticky top-0">
            ADDED
          </div>
          {newLines.map((line, idx) => (
            <div key={idx} className="px-2 text-slate-300 border-b border-slate-700/50">
              {line || ' '}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const selectedChangeData = selectedChange !== null ? changes[selectedChange] : null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-white font-semibold">Live Diff Viewer</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">{stats.files} files</span>
              <span className="text-green-400">+{stats.additions}</span>
              <span className="text-red-400">-{stats.deletions}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('unified')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'unified'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Unified
            </button>
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'side-by-side'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Side by Side
            </button>
          </div>
        </div>
      </div>

      <div className="flex" style={{ maxHeight }}>
        {/* File list */}
        <div className="w-64 border-r border-slate-700 overflow-y-auto">
          <div className="p-2 space-y-1">
            {changes.map((change, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedChange(idx)}
                className={`w-full text-left p-2 rounded transition-colors ${
                  selectedChange === idx
                    ? 'bg-blue-900/30 border border-blue-700'
                    : 'hover:bg-slate-800 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-mono text-cyan-400 truncate flex-1">
                    {change.path.split('/').pop()}
                  </span>
                  <span className={`text-xs px-1 py-0.5 rounded ${getChangeTypeColor(change.changeType)}`}>
                    {change.changeType === 'create' ? '+' : change.changeType === 'delete' ? '-' : '±'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 truncate mt-0.5">
                  {change.path}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-y-auto">
          {selectedChangeData ? (
            <div>
              {/* File header */}
              <div className="bg-slate-800 px-4 py-2 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-mono text-cyan-400">
                      {selectedChangeData.path}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {selectedChangeData.changeType === 'create'
                        ? 'New file created'
                        : selectedChangeData.changeType === 'delete'
                        ? 'File deleted'
                        : 'File modified'}
                    </div>
                  </div>
                  {selectedChangeData.changeId && (
                    <div className="text-xs text-slate-500">
                      Change ID: {selectedChangeData.changeId.slice(0, 8)}
                    </div>
                  )}
                </div>
              </div>

              {/* Diff content */}
              <div className="overflow-x-auto">
                {viewMode === 'unified'
                  ? renderUnifiedDiff(selectedChangeData)
                  : renderSideBySideDiff(selectedChangeData)}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <p className="text-sm">No changes to display</p>
                <p className="text-xs mt-1">
                  {changes.length === 0
                    ? 'Execute a task to see changes'
                    : 'Select a file from the list to view its diff'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveDiffViewer;
