/**
 * FocusMode Component - Hides all but selected node + dependencies
 */

import React, { useMemo } from 'react';
import { GraphData, Node } from '../types';

interface FocusModeProps {
  data: GraphData;
  selectedNodeId: string | null;
  onClearFocus: () => void;
  children: (filteredData: GraphData) => React.ReactNode;
}

/**
 * Focus Mode Component
 *
 * Filters graph data to show only the selected node and its direct dependencies.
 * All other nodes are hidden to reduce visual clutter and focus attention.
 */
const FocusMode: React.FC<FocusModeProps> = ({
  data,
  selectedNodeId,
  onClearFocus,
  children
}) => {
  /**
   * Calculate the set of visible nodes based on selected node
   * Includes: selected node + all direct neighbors (incoming + outgoing connections)
   */
  const filteredData = useMemo(() => {
    if (!selectedNodeId) {
      return data; // No focus, return all data
    }

    // Find all connected node IDs
    const connectedIds = new Set<string>([selectedNodeId]);

    // Add sources (nodes that point to selected)
    data.links.forEach((link) => {
      if (link.target === selectedNodeId) {
        connectedIds.add(link.source);
      }
      if (link.source === selectedNodeId) {
        connectedIds.add(link.target);
      }
    });

    // Filter nodes
    const filteredNodes = data.nodes.filter((node) =>
      connectedIds.has(node.id)
    );

    // Filter links (only those between visible nodes)
    const filteredLinks = data.links.filter((link) =>
      connectedIds.has(link.source) && connectedIds.has(link.target)
    );

    return {
      nodes: filteredNodes,
      links: filteredLinks
    };
  }, [data, selectedNodeId]);

  /**
   * Check if focus mode is active
   */
  const isFocused = selectedNodeId !== null;

  /**
   * Get the label of the focused node
   */
  const focusedNodeLabel = useMemo(() => {
    if (!selectedNodeId) return '';
    const node = data.nodes.find((n) => n.id === selectedNodeId);
    return node?.label || '';
  }, [data.nodes, selectedNodeId]);

  if (!isFocused) {
    return <>{children(data)}</>;
  }

  return (
    <div className="relative w-full h-full">
      {/* Focus Mode Banner */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-cyan-600/90 backdrop-blur border border-cyan-400 rounded-lg px-4 py-2 shadow-lg">
        <span className="text-sm font-semibold text-white">
          Focus: {focusedNodeLabel}
        </span>
        <span className="text-xs text-cyan-100">
          ({filteredData.nodes.length} nodes, {filteredData.links.length} links)
        </span>
        <button
          onClick={onClearFocus}
          className="ml-2 px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded transition-colors"
          title="Clear focus (Cmd+Shift+F)"
        >
          ✕ Clear
        </button>
      </div>

      {/* Render filtered graph */}
      <div className="w-full h-full">
        {children(filteredData)}
      </div>

      {/* Dimmed overlay hint */}
      {filteredData.nodes.length < data.nodes.length && (
        <div className="absolute bottom-4 right-4 z-20 text-xs text-slate-500">
          {data.nodes.length - filteredData.nodes.length} nodes hidden
        </div>
      )}
    </div>
  );
};

export default FocusMode;
