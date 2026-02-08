/**
 * QuickActionsMenu - Single entry point for quick actions (Cmd+K)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SearchResultItem } from '../utils/searchIndexer';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  description?: string;
  action: () => void;
  category?: string;
}

interface QuickActionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  graphData?: any;
  searchResults?: SearchResultItem[];
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onSearchResultSelect?: (item: SearchResultItem) => void;
  onFocusNode?: () => void;
  onClearFocus?: () => void;
  onCreateNode?: () => void;
  onAutoLayout?: () => void;
  onToggleMiniMap?: () => void;
  onExport?: () => void;
}

/**
 * QuickActionsMenu Component
 *
 * Unified command palette triggered by Cmd+K
 * Provides quick access to all common actions
 */
const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({
  isOpen,
  onClose,
  searchResults = [],
  searchQuery = '',
  onSearchQueryChange,
  onSearchResultSelect,
  onFocusNode,
  onClearFocus,
  onCreateNode,
  onAutoLayout,
  onToggleMiniMap,
  onExport
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'actions' | 'search'>('actions');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Available quick actions
  const quickActions: QuickAction[] = [
    {
      id: 'focus-node',
      label: 'Focus Selected Node',
      icon: '🎯',
      description: 'Show only selected node and dependencies',
      action: () => {
        onFocusNode?.();
        onClose();
      },
      category: 'View'
    },
    {
      id: 'clear-focus',
      label: 'Clear Focus',
      icon: '👁️',
      description: 'Show all nodes',
      action: () => {
        onClearFocus?.();
        onClose();
      },
      category: 'View'
    },
    {
      id: 'create-node',
      label: 'Create New Node',
      icon: '➕',
      description: 'Add a new node to the graph',
      action: () => {
        onCreateNode?.();
        onClose();
      },
      category: 'Edit'
    },
    {
      id: 'auto-layout',
      label: 'Auto Layout',
      icon: '📐',
      description: 'Apply automatic layout to graph',
      action: () => {
        onAutoLayout?.();
        onClose();
      },
      category: 'View'
    },
    {
      id: 'toggle-minimap',
      label: 'Toggle Mini Map',
      icon: '🗺️',
      description: 'Show/hide the mini map',
      action: () => {
        onToggleMiniMap?.();
        onClose();
      },
      category: 'View'
    },
    {
      id: 'export',
      label: 'Export Graph',
      icon: '📤',
      description: 'Export graph as image or JSON',
      action: () => {
        onExport?.();
        onClose();
      },
      category: 'File'
    }
  ];

  // Reset mode and selection when opened
  useEffect(() => {
    if (isOpen) {
      setMode('actions');
      setSelectedIndex(0);
      onSearchQueryChange?.('');
      inputRef.current?.focus();
    }
  }, [isOpen, onSearchQueryChange]);

  // Update mode based on query
  useEffect(() => {
    if (searchQuery.trim()) {
      setMode('search');
    } else {
      setMode('actions');
    }
  }, [searchQuery]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults, mode]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = mode === 'search' ? searchResults : quickActions;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < items.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (mode === 'search' && searchResults[selectedIndex]) {
          onSearchResultSelect?.(searchResults[selectedIndex]);
        } else if (mode === 'actions' && quickActions[selectedIndex]) {
          quickActions[selectedIndex].action();
        }
        onClose();
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [mode, searchResults, selectedIndex, quickActions, onSearchResultSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const items = mode === 'search' ? searchResults : quickActions;
  const hasResults = items.length > 0;

  /**
   * Highlight matching text
   */
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, idx) =>
      regex.test(part) ? (
        <mark key={idx} className="bg-cyan-500/30 text-cyan-300 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl mx-4 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header with search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
          <span className="text-slate-400">
            {mode === 'search' ? '🔍' : '⚡'}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            placeholder={
              mode === 'search'
                ? 'Search nodes, links...'
                : 'What do you want to do?'
            }
            className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange?.('')}
              className="p-1 hover:bg-slate-800 rounded transition-colors"
              title="Clear search"
            >
              ✕
            </button>
          )}
          <kbd className="px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded">
            ESC
          </kbd>
        </div>

        {/* Content */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto"
        >
          {!hasResults ? (
            <div className="py-8 text-center text-slate-500">
              {mode === 'search' ? (
                <>
                  <p className="text-lg mb-2">No results found</p>
                  <p className="text-sm">Try different keywords</p>
                </>
              ) : null}
            </div>
          ) : (
            <div className="py-2">
              {/* Show category header for actions */}
              {mode === 'actions' && (
                <div className="px-4 py-1 text-xs text-slate-500 font-semibold uppercase">
                  Quick Actions
                </div>
              )}

              {mode === 'actions' &&
                quickActions.map((action, idx) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      action.action();
                      onClose();
                    }}
                    className={`w-full px-4 py-3 flex items-start gap-3 transition-colors ${
                      idx === selectedIndex
                        ? 'bg-cyan-500/10 border-l-2 border-cyan-500'
                        : 'hover:bg-slate-800 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="mt-0.5 text-xl">{action.icon}</div>
                    <div className="flex-1 text-left">
                      <div className="text-slate-200 font-medium">
                        {action.label}
                      </div>
                      {action.description && (
                        <div className="text-sm text-slate-500 mt-0.5">
                          {action.description}
                        </div>
                      )}
                    </div>
                    {action.category && (
                      <span className="text-xs text-slate-600">{action.category}</span>
                    )}
                  </button>
                ))}

              {mode === 'search' &&
                searchResults.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSearchResultSelect?.(item);
                      onClose();
                    }}
                    className={`w-full px-4 py-3 flex items-start gap-3 transition-colors ${
                      idx === selectedIndex
                        ? 'bg-cyan-500/10 border-l-2 border-cyan-500'
                        : 'hover:bg-slate-800 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="mt-0.5">
                      {item.type === 'link' ? (
                        <span className="text-slate-400">↗️</span>
                      ) : (
                        <span className="text-cyan-400">⬡</span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200 font-medium">
                          {highlightMatch(item.label, searchQuery)}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            item.type === 'node'
                              ? 'bg-violet-500/20 text-violet-400'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {item.type}
                        </span>
                      </div>
                      {item.description && (
                        <div className="text-sm text-slate-500 mt-0.5">
                          {highlightMatch(item.description, searchQuery)}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">Enter</kbd> Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">ESC</kbd> Close
            </span>
          </div>
          {hasResults && (
            <span>{items.length} result{items.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickActionsMenu;
