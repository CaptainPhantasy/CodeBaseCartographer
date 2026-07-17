/**
 * React Flow-based diagram canvas component
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDiagramStore } from '../stores/useDiagramStore';
import { applyAutoLayout } from '../utils/diagramLayout';
import DiagramNode from './DiagramNode';
import FlowParticles from './FlowParticles';
import FlowInspector from './FlowInspector';
import { DiagramNodeData } from '../types/diagram';
import { GraphData, Link } from '../types';
import { getLLMService, TaskType } from '../services/llmService';
import { apiFetch } from '../services/apiClient';

/**
 * Algorithm: Detect main flow path from inputs to outputs
 * Returns an ORDERED array of edges representing the primary flow path
 */
interface FlowPathEdge {
  edgeId: string;
  sourceId: string;
  targetId: string;
}

function detectMainFlowPath(graphData: GraphData): FlowPathEdge[] {
  const { nodes, links } = graphData;

  if (!nodes.length || !links.length) {
    return [];
  }

  // Find all node IDs
  const nodeIds = new Set(nodes.map(n => n.id));

  // Build adjacency list and find input/output nodes
  const incomingCount = new Map<string, number>();
  const outgoingEdges = new Map<string, Array<{ target: string; link: Link }>>();

  // Initialize counts
  nodes.forEach(n => {
    incomingCount.set(n.id, 0);
    outgoingEdges.set(n.id, []);
  });

  // Count incoming/outgoing edges
  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;

    if (sourceId && targetId && nodeIds.has(sourceId) && nodeIds.has(targetId)) {
      incomingCount.set(targetId, (incomingCount.get(targetId) || 0) + 1);
      outgoingEdges.get(sourceId)?.push({ target: targetId, link });
    }
  });

  // Input nodes: no incoming edges (or type='entry')
  const inputNodes = nodes.filter(n =>
    (incomingCount.get(n.id) || 0) === 0 || n.type === 'entry'
  );

  // Output nodes: no outgoing edges (or type='exit')
  const outputNodes = nodes.filter(n =>
    (outgoingEdges.get(n.id)?.length || 0) === 0 || n.type === 'exit'
  );

  // If no clear outputs, use the last nodes in the graph
  const actualOutputs = outputNodes.length > 0 ? outputNodes :
    nodes.filter(n => (incomingCount.get(n.id) || 0) >= 2).slice(-3);

  const outputIds = new Set(actualOutputs.map(n => n.id));

  // BFS from first input to find the main path to an output
  // Store the actual path as we go
  for (const inputNode of inputNodes) {
    const queue: Array<{ nodeId: string; path: FlowPathEdge[] }> = [
      { nodeId: inputNode.id, path: [] }
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      // Check if we reached an output
      if (outputIds.has(nodeId) && path.length > 0) {
        return path;  // Return the ordered path
      }

      // Explore outgoing edges
      const edges = outgoingEdges.get(nodeId) || [];
      for (const { target, link } of edges) {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
        const edgeId = `edge-${sourceId}-${target}`;
        queue.push({
          nodeId: target,
          path: [...path, { edgeId, sourceId, targetId: target }]
        });
      }
    }
  }

  return [];  // No path found
}

interface LoadedFile {
  path: string;
  content: string;
}

interface DiagramViewProps {
  graphData?: GraphData;
  onGraphDataChange?: (data: GraphData) => void;
  loadedFiles?: LoadedFile[];
  loadedFilesSource?: string;
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
        editable: false,
        // Pneumatic tube visualization properties
        filePath: node.filePath,
        functionName: node.functionName,
        line: node.line,
        // Data transformation tracking
        layer: node.layer ?? node.group,
        inputType: node.inputType,
        outputType: node.outputType,
        transforms: node.transforms
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
function graphDataToEdges(graphData: GraphData, flowPathEdgeIds?: Set<string>): Edge[] {
  if (!graphData.links || graphData.links.length === 0) {
    return [];
  }

  // Build node lookup by both ID and by reference (for D3-mutated data)
  const nodeIds = new Set(graphData.nodes.map(n => n.id));

  const validLinks = graphData.links.filter(link => {
    // Handle both string IDs (pristine data) and object references (D3-mutated data)
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;

    // Silently filter invalid links without console spam
    if (!sourceId || !targetId) {
      return false;
    }

    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });

  return validLinks.map((link) => {
    // Extract IDs from either strings or D3-mutated object references
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;
    const edgeId = `edge-${sourceId}-${targetId}`;

    // Check if this edge should be highlighted (main flow path)
    const isHighlighted = flowPathEdgeIds?.has(edgeId) || link.highlight;

    return {
      id: edgeId,
      source: sourceId,
      target: targetId,
      animated: false,  // Disabled - using particles instead
      label: link.label || undefined,
      style: {
        stroke: isHighlighted ? 'rgba(6, 182, 212, 0.4)' : 'rgba(255, 255, 255, 0.15)',  // Highlighted edges more visible
        strokeWidth: 8,                        // Thick, like a tube
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
      },
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
  animated: false,
  style: {
    stroke: 'rgba(255, 255, 255, 0.15)',
    strokeWidth: 8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
};

export default function DiagramView({ graphData, onGraphDataChange, loadedFiles, loadedFilesSource }: DiagramViewProps) {
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

  // Particle animation state
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [activeLayerId, setActiveLayerId] = useState<string>();
  const [currentParticleType, setCurrentParticleType] = useState<'request' | 'response' | null>(null);
  const lastLayerUpdateRef = useRef<number>(0);  // For debouncing layer updates

  // Generate dialog state
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Use graphData if provided and has actual nodes, otherwise use store
  const hasGraphData = graphData?.nodes && graphData.nodes.length > 0;

  // Compute ordered flow path for particle animation
  const flowPathEdges = useMemo(() => {
    if (!hasGraphData || !graphData) return [];
    return detectMainFlowPath(graphData);
  }, [graphData, hasGraphData]);

  // Compute Set of edge IDs for highlighting
  const flowPathEdgeIds = useMemo(() => {
    return new Set(flowPathEdges.map(e => e.edgeId));
  }, [flowPathEdges]);

  const sourceNodes = hasGraphData ? graphDataToNodes(graphData) : storeNodes as Node[];
  const sourceEdges = hasGraphData ? graphDataToEdges(graphData, flowPathEdgeIds) : storeEdges;

  const [nodes, setNodes, onNodesChange] = useNodesState(sourceNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(sourceEdges);

  // Sync with graphData changes
  useEffect(() => {
    if (hasGraphData) {
      const newNodes = graphDataToNodes(graphData);
      const newEdges = graphDataToEdges(graphData, flowPathEdgeIds);
      setNodes(newNodes);
      setEdges(newEdges);
      // Also update store for persistence
      setStoreNodes(newNodes as unknown as any);
      setStoreEdges(newEdges as any);
    }
  }, [graphData, hasGraphData, flowPathEdgeIds, setNodes, setEdges, setStoreNodes, setStoreEdges]);

  // Handle particle entering a node - with debouncing to prevent flicker
  const handleNodeEnter = useCallback((nodeId: string, particleType: 'request' | 'response') => {
    const now = Date.now();
    // Debounce: only update if 100ms has passed since last update
    if (now - lastLayerUpdateRef.current < 100) return;
    lastLayerUpdateRef.current = now;

    setActiveLayerId(nodeId);
    setCurrentParticleType(particleType);
  }, []);

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

  // Handle node click - open file in native editor if filePath is available
  const onNodeClick = useCallback(
    async (_: any, node: Node) => {
      const data = node.data as DiagramNodeData;
      if (data.filePath) {
        try {
          const response = await apiFetch(`/api/open-file?path=${encodeURIComponent(data.filePath)}`);
          if (!response.ok) {
            const error = await response.json();
            console.error('Failed to open file:', error);
          }
        } catch (error) {
          console.error('Failed to open file:', error);
        }
      }
    },
    []
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

  // Generate flow chart from prompt
  const handleGenerateFromPrompt = useCallback(async () => {
    if (!generatePrompt.trim()) return;

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const llmService = getLLMService();
      if (!llmService.isTaskAvailable(TaskType.GRAPH_GENERATION)) {
        throw new Error('Graph generation requires an LLM provider configured in the backend environment.');
      }

      // Use context-aware generation if we have loaded files
      if (loadedFiles && loadedFiles.length > 0) {
        const newData = await llmService.generateGraphDataWithContext(
          generatePrompt,
          { 
            files: loadedFiles, 
            codebasePath: loadedFilesSource 
          },
          { maxAttempts: 3, validateOutput: true }
        );
        if (newData.nodes && newData.links) {
          onGraphDataChange?.(newData);
          setIsGenerateOpen(false);
          setGeneratePrompt('');
        } else {
          throw new Error('Invalid graph data received from LLM');
        }
      } else {
        // Fallback to simple generation without context
        const newData = await llmService.generateGraphData(generatePrompt);
        if (newData.nodes && newData.links) {
          onGraphDataChange?.(newData);
          setIsGenerateOpen(false);
          setGeneratePrompt('');
        } else {
          throw new Error('Invalid graph data received from LLM');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate graph';
      setGenerateError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [generatePrompt, onGraphDataChange, loadedFiles, loadedFilesSource]);

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
          onClick={() => setIsGenerateOpen(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2"
        >
          <span>✨</span> Generate
        </button>
        {!hasGraphData && (
          <button
            onClick={handleAddNode}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2"
          >
            <span>➕</span> Add Node
          </button>
        )}
        <button
          onClick={() => setParticlesEnabled(!particlesEnabled)}
          className={`px-4 py-2 text-white text-sm font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2 ${
            particlesEnabled ? 'bg-green-600 hover:bg-green-500' : 'bg-slate-600 hover:bg-slate-500'
          }`}
        >
          <span>{particlesEnabled ? '🔮' : '⭕'}</span>
          {particlesEnabled ? 'Particles On' : 'Particles Off'}
        </button>
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
        onNodeClick={onNodeClick}
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
        <div className="font-semibold text-slate-300 mb-2">Controls:</div>
        <ul className="space-y-1 mb-3">
          <li>• Drag nodes to reposition</li>
          <li>• Double-click to edit labels</li>
          <li>• Connect from dots on edges</li>
          <li>• Scroll to zoom, drag to pan</li>
        </ul>
        <div className="font-semibold text-slate-300 mb-2">Pneumatic Tube:</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
            <span>Blue sphere = Request (downstream)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500" style={{ transform: 'rotate(45deg)' }}></div>
            <span>Green cube = Response (upstream)</span>
          </div>
        </div>
      </div>

      {/* Particle System */}
      {hasGraphData && particlesEnabled && flowPathEdges.length > 0 && (
        <FlowParticles
          edges={edges}
          nodes={nodes}
          flowPathEdges={flowPathEdges}
          isActive={particlesEnabled}
          onRequestStart={() => setCurrentParticleType('request')}
          onProcessing={() => setCurrentParticleType(null)}
          onResponse={() => setCurrentParticleType('response')}
          onIdle={() => {
            setCurrentParticleType(null);
            setActiveLayerId(undefined);  // Clear inspector when idle
          }}
          onNodeEnter={handleNodeEnter}
        />
      )}

      {/* Flow Inspector */}
      {hasGraphData && particlesEnabled && (
        <FlowInspector
          nodes={nodes}
          activeLayerId={activeLayerId}
          particleType={currentParticleType}
          onClose={() => setActiveLayerId(undefined)}
        />
      )}

      {/* Generate Flow Chart Modal */}
      {isGenerateOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>✨</span> Generate Flow Chart
              </h2>
              <button
                onClick={() => {
                  setIsGenerateOpen(false);
                  setGenerateError(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {/* Context indicator */}
              {loadedFiles && loadedFiles.length > 0 ? (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                    <span>📂</span>
                    <span>Using {loadedFiles.length} loaded files for context-aware generation</span>
                  </div>
                  <p className="text-xs text-green-300/70 mt-1">
                    Source: {loadedFilesSource || 'Local files'} — Graphs will include real file paths and transformations
                  </p>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                    <span>⚠️</span>
                    <span>No files loaded — using description only</span>
                  </div>
                  <p className="text-xs text-amber-300/70 mt-1">
                    Connect a codebase first for accurate flow charts with real file paths
                  </p>
                </div>
              )}
              
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Describe the architecture or flow:
              </label>
              <textarea
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                placeholder="e.g., Web application with React frontend, Express API backend, PostgreSQL database, and Redis cache..."
                className="w-full h-32 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                disabled={isGenerating}
              />
              {generateError && (
                <p className="mt-2 text-sm text-red-400">{generateError}</p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Tip: Include component names, technologies, and data flow direction for best results.
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
              <button
                onClick={() => {
                  setIsGenerateOpen(false);
                  setGenerateError(null);
                }}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateFromPrompt}
                disabled={!generatePrompt.trim() || isGenerating}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">⚙️</span> Generating...
                  </>
                ) : (
                  <>
                    <span>✨</span> Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
