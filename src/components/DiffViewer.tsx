/**
 * Diff Viewer Component
 * Displays side-by-side or unified diff with syntax highlighting
 */

import React, { useMemo } from 'react';
import * as Diff from 'diff';

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  filePath?: string;
  viewType?: 'side-by-side' | 'unified';
  language?: string;
}

interface DiffLine {
  lineNumber: number;
  content: string;
  type: 'added' | 'removed' | 'unchanged';
}

const DiffViewer: React.FC<DiffViewerProps> = ({
  oldContent,
  newContent,
  filePath,
  viewType = 'unified',
  language = 'text'
}) => {
  const diffLines = useMemo(() => {
    const changes = Diff.diffLines(oldContent, newContent);
    const lines: DiffLine[] = [];
    let oldLineNumber = 1;
    let newLineNumber = 1;

    changes.forEach((change) => {
      const type: DiffLine['type'] = change.added
        ? 'added'
        : change.removed
        ? 'removed'
        : 'unchanged';

      const content = change.value;
      const contentLines = content.split('\n').filter((line, i, arr) => {
        // Filter out the last empty line if present
        return !(i === arr.length - 1 && line === '');
      });

      contentLines.forEach((line) => {
        lines.push({
          lineNumber: type === 'removed' ? oldLineNumber++ : newLineNumber++,
          content: line,
          type
        });

        if (type === 'unchanged') {
          if (change.removed) oldLineNumber++;
          if (change.added) newLineNumber++;
        }
      });
    });

    return lines;
  }, [oldContent, newContent]);

  const highlightCode = (code: string, lang: string): string => {
    // Simple syntax highlighting - in production, you'd use a library like Prism.js or highlight.js
    // This is a basic implementation for demonstration

    if (lang === 'javascript' || lang === 'typescript' || lang === 'tsx' || lang === 'jsx') {
      return code
        .replace(/\/\/.*/g, '<span class="text-green-400">$&</span>') // Comments
        .replace(/('.*?'|".*?"|`.*?`)/g, '<span class="text-yellow-300">$&</span>') // Strings
        .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default)\b/g, '<span class="text-purple-400">$&</span>') // Keywords
        .replace(/\b(true|false|null|undefined)\b/g, '<span class="text-cyan-400">$&</span>') // Literals
        .replace(/\b(\d+)\b/g, '<span class="text-orange-400">$&</span>'); // Numbers
    }

    return code;
  };

  const renderLine = (line: DiffLine, index: number) => {
    const bgColor =
      line.type === 'added'
        ? 'bg-green-900/30'
        : line.type === 'removed'
        ? 'bg-red-900/30'
        : 'bg-transparent';

    const lineNumColor =
      line.type === 'added'
        ? 'text-green-500'
        : line.type === 'removed'
        ? 'text-red-500'
        : 'text-slate-600';

    const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

    return (
      <div
        key={index}
        className={`flex hover:bg-slate-800/50 ${bgColor} transition-colors`}
      >
        <span className={`w-16 text-right pr-4 select-none text-xs font-mono ${lineNumColor} border-r border-slate-800`}>
          {line.lineNumber}
        </span>
        <span className="w-6 text-center select-none text-xs font-mono text-slate-600">
          {prefix}
        </span>
        <code
          className="flex-1 px-2 text-sm font-mono whitespace-pre overflow-x-auto"
          dangerouslySetInnerHTML={{
            __html: highlightCode(line.content, language)
          }}
        />
      </div>
    );
  };

  const addedCount = diffLines.filter((l) => l.type === 'added').length;
  const removedCount = diffLines.filter((l) => l.type === 'removed').length;

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200">Diff View</span>
          {filePath && (
            <span className="text-xs text-slate-400 font-mono truncate max-w-md">
              {filePath}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs">
          {removedCount > 0 && (
            <span className="text-red-400 font-medium">
              -{removedCount} lines
            </span>
          )}
          {addedCount > 0 && (
            <span className="text-green-400 font-medium">
              +{addedCount} lines
            </span>
          )}
        </div>
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-y-auto">
        {diffLines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            No changes detected
          </div>
        ) : (
          <div className="font-mono text-xs">
            {diffLines.map((line, index) => renderLine(line, index))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiffViewer;
