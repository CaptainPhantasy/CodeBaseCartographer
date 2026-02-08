/**
 * SearchModal - Global search UI with cmd+K trigger
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SearchResultItem } from '../utils/searchIndexer';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: SearchResultItem[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelectResult: (item: SearchResultItem) => void;
}

/**
 * SearchModal Component
 *
 * Global search interface with keyboard navigation
 * Triggered via Cmd+K, provides instant search results
 */
const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  results,
  query,
  onQueryChange,
  onSelectResult
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelectResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [results, selectedIndex, onSelectResult, onClose]);

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

  /**
   * Highlight matching text in result
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

  /**
   * Get icon for result type
   */
  const getTypeIcon = (item: SearchResultItem) => {
    if (item.type === 'link') {
      return <span className="text-slate-400">↗️</span>;
    }
    // Node type icons based on description
    if (item.description?.includes('entry')) return <span className="text-cyan-400">🚪</span>;
    if (item.description?.includes('logic')) return <span className="text-violet-400">⚙️</span>;
    if (item.description?.includes('storage')) return <span className="text-amber-400">💾</span>;
    if (item.description?.includes('exit')) return <span className="text-red-400">🚪</span>;
    return <span className="text-slate-400">⬡</span>;
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
          <span className="text-slate-400">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search nodes, links, functions..."
            className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => onQueryChange('')}
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

        {/* Results list */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              {query ? (
                <>
                  <p className="text-lg mb-2">No results found</p>
                  <p className="text-sm">Try different keywords</p>
                </>
              ) : (
                <>
                  <p className="text-lg mb-2">Start typing to search</p>
                  <p className="text-sm">Search nodes, links, and functions</p>
                </>
              )}
            </div>
          ) : (
            <div className="py-2">
              {results.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => onSelectResult(item)}
                  className={`w-full px-4 py-3 flex items-start gap-3 transition-colors ${
                    idx === selectedIndex
                      ? 'bg-cyan-500/10 border-l-2 border-cyan-500'
                      : 'hover:bg-slate-800 border-l-2 border-transparent'
                  }`}
                >
                  {/* Icon */}
                  <div className="mt-0.5">
                    {getTypeIcon(item)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-200 font-medium">
                        {highlightMatch(item.label, query)}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        item.type === 'node'
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {item.type}
                      </span>
                    </div>
                    {item.description && (
                      <div className="text-sm text-slate-500 mt-0.5">
                        {highlightMatch(item.description, query)}
                      </div>
                    )}
                  </div>

                  {/* Score indicator */}
                  <div className="text-xs text-slate-600">
                    {item.score > 50 && '⭐'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with hints */}
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
          {results.length > 0 && (
            <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
