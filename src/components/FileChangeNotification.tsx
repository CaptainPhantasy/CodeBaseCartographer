/**
 * File Change Notification Component
 * Displays toast notifications for file changes with "View Diff" button
 */

import React, { useState, useEffect } from 'react';

export interface FileChange {
  id: string;
  type: 'file:changed' | 'file:added' | 'file:deleted';
  path: string;
  timestamp: number;
}

interface FileChangeNotificationProps {
  changes: FileChange[];
  onViewDiff?: (path: string) => void;
  autoDismiss?: boolean;
  dismissDelay?: number;
}

const FileChangeNotification: React.FC<FileChangeNotificationProps> = ({
  changes,
  onViewDiff,
  autoDismiss = true,
  dismissDelay = 5000
}) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (autoDismiss) {
      changes.forEach((change) => {
        const timer = setTimeout(() => {
          setDismissed((prev) => new Set(prev).add(change.id));
        }, dismissDelay);

        return () => clearTimeout(timer);
      });
    }
  }, [changes, autoDismiss, dismissDelay]);

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  const visibleChanges = changes.filter((c) => !dismissed.has(c.id));

  if (visibleChanges.length === 0) {
    return null;
  }

  const getChangeIcon = (type: FileChange['type']) => {
    switch (type) {
      case 'file:added':
        return '📄';
      case 'file:deleted':
        return '🗑️';
      case 'file:changed':
        return '✏️';
      default:
        return '📝';
    }
  };

  const getChangeColor = (type: FileChange['type']) => {
    switch (type) {
      case 'file:added':
        return 'border-green-500/50 bg-green-900/20';
      case 'file:deleted':
        return 'border-red-500/50 bg-red-900/20';
      case 'file:changed':
        return 'border-yellow-500/50 bg-yellow-900/20';
      default:
        return 'border-slate-600 bg-slate-800';
    }
  };

  const getChangeLabel = (type: FileChange['type']) => {
    switch (type) {
      case 'file:added':
        return 'File added';
      case 'file:deleted':
        return 'File deleted';
      case 'file:changed':
        return 'File changed';
      default:
        return 'File modified';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full">
      {visibleChanges.map((change) => (
        <div
          key={change.id}
          className={`p-4 rounded-lg border shadow-lg backdrop-blur-sm ${getChangeColor(
            change.type
          )} animate-slide-in transition-all`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">{getChangeIcon(change.type)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-slate-200">
                  {getChangeLabel(change.type)}
                </span>
                <button
                  onClick={() => handleDismiss(change.id)}
                  className="text-slate-400 hover:text-white transition-colors"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate mb-2">
                {change.path}
              </p>
              {change.type !== 'file:deleted' && onViewDiff && (
                <button
                  onClick={() => onViewDiff(change.path)}
                  className="w-full py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  View Diff
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FileChangeNotification;
