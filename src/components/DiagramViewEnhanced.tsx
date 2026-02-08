/**
 * Enhanced DiagramView - Integrates Focus Mode, Search, and Context Menus
 */

import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Node,
  Edge,
  OnSelectionChangeParams
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDiagramStore } from '../stores/useDiagramStore';
import { applyAutoLayout } from '../utils/diagramLayout';
import DiagramNode from './DiagramNode';
import { DiagramNodeData, DiagramNode as DiagramNodeType } from '../types/diagram';
import FocusMode from './FocusMode';
import { getSearchIndexer, SearchResultItem } from '../utils/searchIndexer';
import { useContextMenu, getNodeContextMenuItems, getCanvasContextMenuItems } from './ContextMenu';

// Register custom node type
const nodeTypes: NodeTypes = {
  custom: DiagramNode as any
};

// Custom edge styles
const defaultEdgeOptions = {
  animated: true,
  style: { stroke: '#64748b', strokeWidth: 2 }
};

export default function DiagramViewEnhanced() {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    showMiniMap,
    addNode,
    updateNode,
    addEdge: addStoreEdge,
    deleteNode
  } = useDiagramStore();

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Context menu
  const { showContextMenu, ContextMenu } = useContextMenu();

  // Sync store state with local state
  React.useEffect(() => {
    setNodes(storeNodes as Node[]);
  }, [storeNodes, setNodes]);

  React.useEffect(() => {
    setEdges(storeEdges);
  }, [storeEdges, setEdges]);

  // Update search index when data changes
  React.useEffect(() => {
    const indexer = getSearchIndexer();

    // Convert diagram nodes to graph data format for search
    const graphData = {
      nodes: storeNodes.map(n => {
        const data = n.data as DiagramNodeData;
        return {
          id: n.id,
          group: 0,
          label: data.label,
          type: data.type || 'process'
        };
      }),
      links: storeEdges.map(e => ({
        source: e.source as string,
        target: e.target as string,
        value: 1
      }))
    };

    indexer.buildIndex(graphData);
  }, [storeNodes, storeEdges]);

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        id: `e${connection.source}-${connection.target}`,
        animated: true,
        style: { stroke: '#64748b', strokeWidth: 2 }
      };
      setEdges((eds) => addEdge(connection, eds));
      addStoreEdge(newEdge);
    },
    [setEdges, addStoreEdge]
  );

  // Handle node updates
  const onNodeDoubleClick = useCallback(
    (_: any, node: Node) => {
      updateNode(node.id, { editable: true });
    },
    [updateNode]
  );

  // Handle selection change
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      if (selectedNodes && selectedNodes.length > 0) {
        const selectedId = selectedNodes[0].id;
        setSelectedNodeId(selectedId);
      } else {
        setSelectedNodeId(null);
      }
    },
    []
  );

  // Apply auto-layout
  const handleAutoLayout = useCallback(() => {
    const layouted = applyAutoLayout(storeNodes, storeEdges, {
      direction: 'TB',
      nodeSpacing: 100,
      rankSpacing: 150
    });
    setNodes(layouted.nodes as Node[]);
  }, [storeNodes, storeEdges, setNodes]);

  // Add new node
  const handleAddNode = useCallback(() => {
    const newNodeId = `node-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      type: 'custom' as const,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: {
        label: 'New Node',
        type: 'process' as const,
        description: 'Add description',
        color: '#3b82f6',
        editable: true
      }
    };
    addNode(newNode);
  }, [addNode]);

  // Handle node context menu
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      const items = getNodeContextMenuItems(node.id, {
        onFocus: () => setFocusedNodeId(node.id),
        onEdit: () => updateNode(node.id, { editable: true }),
        onDelete: () => {
          deleteNode(node.id);
          if (focusedNodeId === node.id) {
            setFocusedNodeId(null);
          }
        },
        onDuplicate: () => {
          const newNodeId = `node-${Date.now()}`;
          const newNodeData = node.data as DiagramNodeData;
          const newNode: DiagramNodeType = {
            id: newNodeId,
            type: 'custom',
            position: {
              x: node.position.x + 50,
              y: node.position.y + 50
            },
            data: {
              ...newNodeData,
              label: `${newNodeData.label} (copy)`
            }
          };
          addNode(newNode);
        },
        onConnect: () => {
          // Trigger connection mode
          setSelectedNodeId(node.id);
        }
      });
      showContextMenu(event.clientX, event.clientY, items);
    },
    [focusedNodeId, deleteNode, addNode, updateNode, showContextMenu]
  );

  // Handle canvas context menu
  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const items = getCanvasContextMenuItems({
        onCreateNode: handleAddNode,
        onAutoLayout: handleAutoLayout,
        onFitView: () => {
          // Fit view - handled by React Flow controls
        },
        onZoomIn: () => {
          // Handled by React Flow controls
        },
        onZoomOut: () => {
          // Handled by React Flow controls
        },
        onResetZoom: () => {
          // Handled by React Flow controls
        }
      });
      showContextMenu(event.clientX, event.clientY, items);
    },
    [handleAddNode, handleAutoLayout, showContextMenu]
  );

  // Clear focus
  const handleClearFocus = useCallback(() => {
    setFocusedNodeId(null);
  }, []);

  // MiniMap node colors
  const minimapNodeColor = useCallback((node: Node) => {
    const data = node.data as DiagramNodeData;
    return data.color || '#6b7280';
  }, []);

  // Filter nodes based on focus
  const filteredNodes = React.useMemo(() => {
    if (!focusedNodeId) return nodes;

    // Find connected nodes
    const connectedIds = new Set([focusedNodeId]);
    edges.forEach((edge) => {
      if (edge.source === focusedNodeId) {
        connectedIds.add(edge.target as string);
      }
      if (edge.target === focusedNodeId) {
        connectedIds.add(edge.source as string);
      }
    });

    return nodes.filter((n) => connectedIds.has(n.id));
  }, [nodes, focusedNodeId, edges]);

  // Filter edges based on visible nodes
  const filteredEdges = React.useMemo(() => {
    if (!focusedNodeId) return edges;

    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) =>
      visibleNodeIds.has(e.source as string) && visibleNodeIds.has(e.target as string)
    );
  }, [edges, filteredNodes]);

  return (
    <div className="w-full h-full bg-slate-950 relative">
      {/* Focus Mode Banner */}
      {focusedNodeId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-cyan-600/90 backdrop-blur border border-cyan-400 rounded-lg px-4 py-2 shadow-lg">
          <span className="text-sm font-semibold text-white">
            Focus: {(nodes.find(n => n.id === focusedNodeId)?.data as DiagramNodeData)?.label || focusedNodeId}
          </span>
          <span className="text-xs text-cyan-100">
            ({filteredNodes.length} nodes)
          </span>
          <button
            onClick={handleClearFocus}
            className="ml-2 px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={handleAutoLayout}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2"
        >
          <span>📐</span> Auto Layout
        </button>
        <button
          onClick={handleAddNode}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2"
        >
          <span>➕</span> Add Node
        </button>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={filteredNodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            onLabelChange: (id: string, newLabel: string) => {
              updateNode(id, { label: newLabel });
            }
          }
        }))}
        edges={filteredEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        className="bg-slate-950"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#334155"
        />
        <Controls
          className="!bg-slate-900 !border !border-slate-700"
          showZoom={true}
          showFitView={true}
          showInteractive={true}
        />
        {showMiniMap && (
          <MiniMap
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={3}
            nodeBorderRadius={8}
            pannable
            zoomable
            className="!bg-slate-900 !border !border-slate-700"
          />
        )}
      </ReactFlow>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-3 text-xs text-slate-400">
        <div className="font-semibold text-slate-300 mb-1">Controls:</div>
        <ul className="space-y-1">
          <li>• Right-click for context menu</li>
          <li>• Double-click to edit labels</li>
          <li>• Cmd+F to focus selected node</li>
          <li>• Cmd+K for quick actions</li>
        </ul>
      </div>

      {/* Context Menu */}
      <ContextMenu />
    </div>
  );
}
