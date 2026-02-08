/**
 * React Flow-based diagram canvas component
 */

import React, { useCallback, useEffect } from 'react';
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
  Node
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDiagramStore } from '../stores/useDiagramStore';
import { applyAutoLayout } from '../utils/diagramLayout';
import DiagramNode from './DiagramNode';
import { DiagramNodeData } from '../types/diagram';
import { GraphData } from '../types';

interface DiagramViewProps {
  graphData?: GraphData;
}

// Helper to convert GraphData to ReactFlow nodes
function graphDataToNodes(graphData: GraphData): Node[] {
  if (!graphData.nodes || graphData.nodes.length === 0) {
    return [];
  }

  // Auto-layout nodes in a grid
  const gridCols = Math.ceil(Math.sqrt(graphData.nodes.length));
  const nodeSpacing = 200;

  return graphData.nodes.map((node, index) => {
    const row = Math.floor(index / gridCols);
    const col = index % gridCols;

    return {
      id: node.id || `node-${index}`,
      type: 'custom',
      position: {
        x: col * nodeSpacing + 100,
        y: row * nodeSpacing + 100
      },
      data: {
        label: node.label || node.id || `Node ${index}`,
        type: getNodeColorFromNodeType(node.type),
        description: `${node.type || 'node'}${node.group ? ` (group ${node.group})` : ''}`,
        color: getNodeColorHexFromType(node.type),
        editable: false
      }
    };
  });
}

// Helper to get node color from type
function getNodeColorFromNodeType(type: string): string {
  const colors: Record<string, string> = {
    'entry': 'entry',
    'logic': 'logic',
    'process': 'process',
    'storage': 'storage',
    'exit': 'exit',
    'external': 'external',
    'decision': 'decision',
    'default': 'process'
  };
  return colors[type] || 'process';
}

function getNodeColorHexFromType(type: string): string {
  const colors: Record<string, string> = {
    'entry': '#06b6d4',
    'logic': '#8b5cf6',
    'process': '#6366f1',
    'storage': '#10b981',
    'exit': '#f59e0b',
    'external': '#ef4444',
    'decision': '#f59e0b',
    'default': '#6b7280'
  };
  return colors[type] || '#6b7280';
}

// Helper to convert GraphData links to ReactFlow edges
function graphDataToEdges(graphData: GraphData) {
  if (!graphData.links || graphData.links.length === 0) {
    console.warn('[DiagramView] No links provided in graphData. Nodes will appear without connections.');
    return [];
  }

  // Build node lookup by both ID and by reference (for D3-mutated data)
  const nodeIds = new Set(graphData.nodes.map(n => n.id));
  const nodeRefs = new WeakSet(graphData.nodes);

  const validLinks = graphData.links.filter(link => {
    // Handle both string IDs (pristine data) and object references (D3-mutated data)
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;

    if (!sourceId || !targetId) {
      console.warn(`[DiagramView] Invalid link: source="${link.source}", target="${link.target}" - missing IDs`);
      return false;
    }

    const valid = nodeIds.has(sourceId) && nodeIds.has(targetId);
    if (!valid) {
      console.warn(`[DiagramView] Invalid link: source="${sourceId}", target="${targetId}" - node IDs not found`);
    }
    return valid;
  });

  if (validLinks.length < graphData.links.length) {
    console.warn(`[DiagramView] Filtered ${graphData.links.length - validLinks.length} invalid links`);
  }

  if (validLinks.length === 0) {
    console.warn('[DiagramView] No valid links after filtering. Flow chart will show unconnected nodes.');
  } else {
    console.log(`[DiagramView] Rendering ${validLinks.length} edges connecting ${graphData.nodes.length} nodes`);
  }

  return validLinks.map((link) => {
    // Extract IDs from either strings or D3-mutated object references
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;

    return {
      id: `edge-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      animated: true,
      label: link.label || undefined,
      style: { stroke: '#06b6d4', strokeWidth: 2 },
      type: 'smoothstep' as const
    };
  });
}


// Register custom node type
const nodeTypes: NodeTypes = {
  custom: DiagramNode as any
};

// Custom edge styles
const defaultEdgeOptions = {
  animated: true,
  style: { stroke: '#64748b', strokeWidth: 2 }
};

export default function DiagramView({ graphData }: DiagramViewProps) {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    showMiniMap,
    addNode,
    updateNode,
    addEdge: addStoreEdge,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges
  } = useDiagramStore();

  // Use graphData if provided and has actual nodes, otherwise use store
  const hasGraphData = graphData?.nodes && graphData.nodes.length > 0;
  const sourceNodes = hasGraphData ? graphDataToNodes(graphData) : storeNodes as Node[];
  const sourceEdges = hasGraphData ? graphDataToEdges(graphData) : storeEdges;

  const [nodes, setNodes, onNodesChange] = useNodesState(sourceNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(sourceEdges);

  // Sync with graphData changes
  useEffect(() => {
    if (hasGraphData) {
      const newNodes = graphDataToNodes(graphData);
      const newEdges = graphDataToEdges(graphData);
      setNodes(newNodes);
      setEdges(newEdges);
      // Also update store for persistence
      setStoreNodes(newNodes as unknown as any);
      setStoreEdges(newEdges);
    }
  }, [graphData, hasGraphData, setNodes, setEdges, setStoreNodes, setStoreEdges]);

  // Sync store state with local state (for manual editing)
  useEffect(() => {
    if (!hasGraphData) {
      setNodes(storeNodes as Node[]);
    }
  }, [storeNodes, setNodes, hasGraphData]);

  useEffect(() => {
    if (!hasGraphData) {
      setEdges(storeEdges);
    }
  }, [storeEdges, setEdges, hasGraphData]);

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
      // Trigger inline editing
      updateNode(node.id, { editable: true });
    },
    [updateNode]
  );

  // Apply auto-layout
  const handleAutoLayout = useCallback(() => {
    const nodesToLayout = hasGraphData ? nodes : storeNodes;
    const edgesToLayout = hasGraphData ? edges : storeEdges;

    const layouted = applyAutoLayout(
      nodesToLayout as any,
      edgesToLayout as any,
      {
        direction: 'TB',
        nodeSpacing: 100,
        rankSpacing: 150
      }
    );
    setNodes(layouted.nodes as unknown as Node[]);
  }, [storeNodes, storeEdges, nodes, edges, hasGraphData, setNodes]);

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

  // MiniMap node colors
  const minimapNodeColor = useCallback((node: Node) => {
    const data = node.data as DiagramNodeData;
    return data.color || '#6b7280';
  }, []);

  return (
    <div className="w-full h-full bg-slate-950 relative">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={handleAutoLayout}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2"
        >
          <span>📐</span> Auto Layout
        </button>
        {!hasGraphData && (
          <button
            onClick={handleAddNode}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2"
          >
            <span>➕</span> Add Node
          </button>
        )}
        {/* Data Source Indicator */}
        <div className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
          hasGraphData
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-slate-700/50 text-slate-400 border border-slate-600'
        }`}>
          <span className={`w-2 h-2 rounded-full ${hasGraphData ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
          {hasGraphData
            ? `Codebase: ${nodes.length} nodes, ${edges.length} edges`
            : 'Manual Mode'
          }
        </div>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            onLabelChange: (id: string, newLabel: string) => {
              updateNode(id, { label: newLabel });
            }
          }
        }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
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
          <li>• Drag nodes to reposition</li>
          <li>• Double-click to edit labels</li>
          <li>• Connect from dots on edges</li>
          <li>• Scroll to zoom, drag to pan</li>
        </ul>
      </div>
    </div>
  );
}
