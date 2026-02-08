/**
 * GraphViewWithFeatures - Complete integration example
 *
 * Demonstrates how to use all Phase 4 features together:
 * - Focus Mode
 * - Search Modal
 * - Quick Actions Menu
 * - Keyboard Shortcuts
 * - Context Menus
 */

import React, { useState, useCallback, useEffect } from 'react';
import { GraphData, Node } from '../types';
import { getSearchIndexer, SearchResultItem } from '../utils/searchIndexer';
import { useKeyboardShortcuts, getDefaultShortcuts } from '../hooks/useKeyboardShortcuts';
import SearchModal from './SearchModal';
import QuickActionsMenu from './QuickActionsMenu';
import { useContextMenu, getCanvasContextMenuItems } from './ContextMenu';

interface GraphViewWithFeaturesProps {
  children: (props: {
    focusedNodeId: string | null;
    onNodeClick: (nodeId: string) => void;
    searchQuery: string;
  }) => React.ReactNode;
  graphData: GraphData;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onAutoLayout?: () => void;
  onCreateNode?: () => void;
  onFitView?: () => void;
  onToggleMiniMap?: () => void;
  onExport?: () => void;
}

/**
 * GraphViewWithFeatures Component
 *
 * Wrapper that adds all Phase 4 features to any graph view
 */
const GraphViewWithFeatures: React.FC<GraphViewWithFeaturesProps> = ({
  children,
  graphData,
  selectedNodeId: externalSelectedNodeId,
  onNodeSelect,
  onAutoLayout,
  onCreateNode,
  onFitView,
  onToggleMiniMap,
  onExport
}) => {
  // State
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);

  // Context menu
  const { showContextMenu, ContextMenu } = useContextMenu();

  // Update search index when graph data changes
  useEffect(() => {
    const indexer = getSearchIndexer();
    indexer.buildIndex(graphData);
  }, [graphData]);

  // Perform search when query changes
  useEffect(() => {
    const indexer = getSearchIndexer();
    const results = indexer.search(searchQuery);
    setSearchResults(results);
  }, [searchQuery]);

  // Keyboard shortcuts
  const shortcuts = getDefaultShortcuts({
    onOpenQuickActions: () => {
      setIsQuickActionsOpen(true);
      setIsSearchOpen(false);
      setSearchQuery('');
    },
    onFocusNode: () => {
      if (externalSelectedNodeId) {
        setFocusedNodeId(externalSelectedNodeId);
      }
    },
    onClearFocus: () => {
      setFocusedNodeId(null);
    },
    onCloseModals: () => {
      setIsSearchOpen(false);
      setIsQuickActionsOpen(false);
    }
  });

  useKeyboardShortcuts(shortcuts, true);

  // Handle node click
  const handleNodeClick = useCallback((nodeId: string) => {
    onNodeSelect?.(nodeId);
  }, [onNodeSelect]);

  // Handle search result selection
  const handleSearchResultSelect = useCallback((item: SearchResultItem) => {
    setFocusedNodeId(item.nodeId);
    onNodeSelect?.(item.nodeId);
    setIsSearchOpen(false);
    setIsQuickActionsOpen(false);
    setSearchQuery('');
  }, [onNodeSelect]);

  // Handle canvas context menu
  const handleCanvasContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const items = getCanvasContextMenuItems({
        onCreateNode: () => {
          onCreateNode?.();
          setIsQuickActionsOpen(false);
        },
        onAutoLayout: () => {
          onAutoLayout?.();
          setIsQuickActionsOpen(false);
        },
        onFitView: () => {
          onFitView?.();
          setIsQuickActionsOpen(false);
        },
        onZoomIn: () => {
          // Handled by React Flow
        },
        onZoomOut: () => {
          // Handled by React Flow
        },
        onResetZoom: () => {
          // Handled by React Flow
        }
      });
      showContextMenu(event.clientX, event.clientY, items);
    },
    [onCreateNode, onAutoLayout, onFitView, showContextMenu]
  );

  return (
    <div
      className="relative w-full h-full"
      onContextMenu={handleCanvasContextMenu}
    >
      {/* Render the graph view with features */}
      {children({
        focusedNodeId,
        onNodeClick: handleNodeClick,
        searchQuery
      })}

      {/* Focus Mode Banner */}
      {focusedNodeId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-cyan-600/90 backdrop-blur border border-cyan-400 rounded-lg px-4 py-2 shadow-lg">
          <span className="text-sm font-semibold text-white">
            Focus: {graphData.nodes.find(n => n.id === focusedNodeId)?.label || focusedNodeId}
          </span>
          <button
            onClick={() => setFocusedNodeId(null)}
            className="ml-2 px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded transition-colors"
            title="Clear focus (Cmd+Shift+F)"
          >
            Clear
          </button>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="absolute bottom-4 right-4 z-10 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-500">
        <div className="font-semibold text-slate-300 mb-1">Shortcuts:</div>
        <div className="space-y-0.5">
          <div><kbd className="bg-slate-700 px-1 rounded">Cmd+K</kbd> Quick actions</div>
          <div><kbd className="bg-slate-700 px-1 rounded">Cmd+F</kbd> Focus node</div>
          <div><kbd className="bg-slate-700 px-1 rounded">ESC</kbd> Close modals</div>
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        results={searchResults}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onSelectResult={handleSearchResultSelect}
      />

      {/* Quick Actions Menu */}
      <QuickActionsMenu
        isOpen={isQuickActionsOpen}
        onClose={() => setIsQuickActionsOpen(false)}
        searchResults={searchResults}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearchResultSelect={handleSearchResultSelect}
        onFocusNode={() => {
          if (externalSelectedNodeId) {
            setFocusedNodeId(externalSelectedNodeId);
          }
          setIsQuickActionsOpen(false);
        }}
        onClearFocus={() => {
          setFocusedNodeId(null);
          setIsQuickActionsOpen(false);
        }}
        onCreateNode={() => {
          onCreateNode?.();
          setIsQuickActionsOpen(false);
        }}
        onAutoLayout={() => {
          onAutoLayout?.();
          setIsQuickActionsOpen(false);
        }}
        onToggleMiniMap={() => {
          onToggleMiniMap?.();
          setIsQuickActionsOpen(false);
        }}
        onExport={() => {
          onExport?.();
          setIsQuickActionsOpen(false);
        }}
      />

      {/* Context Menu */}
      <ContextMenu />
    </div>
  );
};

export default GraphViewWithFeatures;
