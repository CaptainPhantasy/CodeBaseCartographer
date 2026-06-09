/**
 * Diff Modal Component
 * Displays a modal with diff viewer for file changes
 */

import React, { useState, useEffect } from 'react';
import DiffViewer from './DiffViewer';
import { getFileVersionStore } from '../services/fileVersionStore';
import { apiFetch } from '../services/apiClient';

interface DiffModalProps {
  filePath: string | null;
  onClose: () => void;
}

const DiffModal: React.FC<DiffModalProps> = ({ filePath, onClose }) => {
  const [currentContent, setCurrentContent] = useState<string>('');
  const [previousContent, setPreviousContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setCurrentContent('');
      setPreviousContent('');
      setError(null);
      return;
    }

    const loadFileContents = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get previous version from store
        const versionStore = getFileVersionStore();
        const previousVersion = versionStore.getPreviousVersion(filePath);
        setPreviousContent(previousVersion?.content || '');

        // Fetch current content from API
        const response = await apiFetch(`http://localhost:3000/api/files/${encodeURIComponent(filePath)}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const data = await response.json();
        setCurrentContent(data.content || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file contents');
        console.error('Error loading file for diff:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFileContents();
  }, [filePath]);

  if (!filePath) {
    return null;
  }

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      case 'cpp':
      case 'cc':
      case 'cxx':
        return 'cpp';
      case 'c':
        return 'c';
      case 'css':
        return 'css';
      case 'html':
      case 'htm':
        return 'html';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'xml':
        return 'xml';
      case 'yaml':
      case 'yml':
        return 'yaml';
      default:
        return 'text';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl h-[80vh] bg-slate-900 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
          <div>
            <h3 className="text-lg font-semibold text-white">File Changes</h3>
            <p className="text-sm text-slate-400 font-mono mt-1 truncate max-w-2xl">
              {filePath}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-3 text-slate-400">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span>Loading file contents...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-red-400 text-lg mb-2">Error Loading File</div>
                <p className="text-slate-400">{error}</p>
              </div>
            </div>
          ) : (
            <DiffViewer
              oldContent={previousContent}
              newContent={currentContent}
              filePath={filePath}
              language={getLanguageFromPath(filePath)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DiffModal;
