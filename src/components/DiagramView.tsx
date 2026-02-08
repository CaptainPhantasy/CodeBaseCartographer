/**
 * React Flow-based diagram canvas component
 */

import React, { useCallback } from 'react';
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

// Register custom node type
const nodeTypes: NodeTypes = {
  custom: DiagramNode as any
};

// Custom edge styles
const defaultEdgeOptions = {
  animated: true,
  style: { stroke: '#64748b', strokeWidth: 2 }
};

export default function DiagramView() {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    showMiniMap,
    addNode,
    updateNode,
    addEdge: addStoreEdge
  } = useDiagramStore();

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);

  // Sync store state with local state
  React.useEffect(() => {
    setNodes(storeNodes as Node[]);
  }, [storeNodes, setNodes]);

  React.useEffect(() => {
    setEdges(storeEdges);
  }, [storeEdges, setEdges]);

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
        <button
          onClick={handleAddNode}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2"
        >
          <span>➕</span> Add Node
        </button>
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
