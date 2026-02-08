/**
 * Dependency Service
 * Calculates and analyzes dependency depths and relationships
 */

import { DiagramNode, DiagramEdge, DiagramData } from '../types/diagram';

export interface NodeDepthInfo {
  nodeId: string;
  depth: number;
  pathFromRoot: string[];
  childrenCount: number;
  parentCount: number;
}

export interface DependencyAnalysis {
  maxDepth: number;
  averageDepth: number;
  depthDistribution: Record<number, number>;
  nodesByDepth: Record<number, string[]>;
  criticalPath: string[];
  circularDependencies: Array<{ source: string; target: string }>;
}

/**
 * Calculate dependency depth for each node
 * Depth = number of hops from the root (nodes with no incoming edges)
 */
export function calculateDependencyDepth(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): Map<string, NodeDepthInfo> {
  const depthMap = new Map<string, NodeDepthInfo>();
  const adjacency = buildAdjacencyList(nodes, edges);
  const incomingEdges = buildIncomingEdgeMap(nodes, edges);

  // Find root nodes (no incoming edges)
  const rootIds = nodes.filter(node =>
    !incomingEdges.has(node.id) || incomingEdges.get(node.id)!.size === 0
  ).map(n => n.id);

  // If no roots found (circular dependency), pick the node with most outgoing edges
  const effectiveRoots = rootIds.length > 0
    ? rootIds
    : [nodes.reduce((max, node) =>
      (adjacency.get(node.id)?.size || 0) > (adjacency.get(max.id)?.size || 0)
        ? node
        : max
    ).id];

  // Calculate depths using BFS
  for (const rootId of effectiveRoots) {
    calculateDepthsBFS(rootId, adjacency, depthMap);
  }

  // Fill in nodes not reached (in disconnected components)
  for (const node of nodes) {
    if (!depthMap.has(node.id)) {
      depthMap.set(node.id, {
        nodeId: node.id,
        depth: 0,
        pathFromRoot: [],
        childrenCount: adjacency.get(node.id)?.size || 0,
        parentCount: incomingEdges.get(node.id)?.size || 0
      });
    }
  }

  // Update children/parent counts
  for (const [nodeId, info] of depthMap) {
    info.childrenCount = adjacency.get(nodeId)?.size || 0;
    info.parentCount = incomingEdges.get(nodeId)?.size || 0;
  }

  return depthMap;
}

/**
 * BFS to calculate depths from a root node
 */
function calculateDepthsBFS(
  rootId: string,
  adjacency: Map<string, Set<string>>,
  depthMap: Map<string, NodeDepthInfo>
): void {
  const queue: Array<{ nodeId: string; path: string[] }> = [
    { nodeId: rootId, path: [rootId] }
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!;

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const depth = path.length - 1;

    // Store depth info
    if (!depthMap.has(nodeId) || depth < depthMap.get(nodeId)!.depth) {
      depthMap.set(nodeId, {
        nodeId,
        depth,
        pathFromRoot: path,
        childrenCount: 0,
        parentCount: 0
      });
    }

    // Enqueue children
    const children = adjacency.get(nodeId) || new Set();
    for (const childId of children) {
      if (!visited.has(childId)) {
        queue.push({
          nodeId: childId,
          path: [...path, childId]
        });
      }
    }
  }
}

/**
 * Build adjacency list (outgoing edges)
 */
function buildAdjacencyList(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  // Initialize all nodes
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }

  // Add edges
  for (const edge of edges) {
    const targets = adjacency.get(edge.source);
    if (targets) {
      targets.add(edge.target);
    }
  }

  return adjacency;
}

/**
 * Build incoming edge map
 */
function buildIncomingEdgeMap(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): Map<string, Set<string>> {
  const incoming = new Map<string, Set<string>>();

  // Initialize all nodes
  for (const node of nodes) {
    incoming.set(node.id, new Set());
  }

  // Add edges
  for (const edge of edges) {
    const sources = incoming.get(edge.target);
    if (sources) {
      sources.add(edge.source);
    }
  }

  return incoming;
}

/**
 * Analyze dependency structure
 */
export function analyzeDependencies(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): DependencyAnalysis {
  const depthMap = calculateDependencyDepth(nodes, edges);
  const depths = Array.from(depthMap.values());

  // Calculate statistics
  const maxDepth = Math.max(...depths.map(d => d.depth), 0);
  const averageDepth = depths.length > 0
    ? depths.reduce((sum, d) => sum + d.depth, 0) / depths.length
    : 0;

  // Distribution by depth
  const depthDistribution: Record<number, number> = {};
  const nodesByDepth: Record<number, string[]> = {};

  for (const [nodeId, info] of depthMap) {
    depthDistribution[info.depth] = (depthDistribution[info.depth] || 0) + 1;
    if (!nodesByDepth[info.depth]) {
      nodesByDepth[info.depth] = [];
    }
    nodesByDepth[info.depth].push(nodeId);
  }

  // Find critical path (longest path from root)
  const criticalPath = findCriticalPath(depthMap);

  // Detect circular dependencies
  const circularDependencies = detectCircularDependencies(nodes, edges);

  return {
    maxDepth,
    averageDepth,
    depthDistribution,
    nodesByDepth,
    criticalPath,
    circularDependencies
  };
}

/**
 * Find the critical path (longest path from any root)
 */
function findCriticalPath(depthMap: Map<string, NodeDepthInfo>): string[] {
  let longestPath: string[] = [];

  for (const info of depthMap.values()) {
    if (info.pathFromRoot.length > longestPath.length) {
      longestPath = info.pathFromRoot;
    }
  }

  return longestPath;
}

/**
 * Detect circular dependencies using DFS
 */
function detectCircularDependencies(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): Array<{ source: string; target: string }> {
  const adjacency = buildAdjacencyList(nodes, edges);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: Array<{ source: string; target: string }> = [];

  function dfs(nodeId: string): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) || new Set();
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        dfs(neighborId);
      } else if (recursionStack.has(neighborId)) {
        // Found a cycle
        cycles.push({ source: nodeId, target: neighborId });
      }
    }

    recursionStack.delete(nodeId);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  return cycles;
}

/**
 * Get ring color for depth visualization
 */
export function getDepthColor(depth: number, maxDepth: number): string {
  const colors = [
    '#10b981', // green - root
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // orange
    '#ef4444'  // red - deepest
  ];

  if (maxDepth === 0) return colors[0];

  const index = Math.min(Math.floor((depth / maxDepth) * colors.length), colors.length - 1);
  return colors[index];
}

/**
 * Calculate node positions in concentric rings
 */
export function calculateRingPositions(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  center: { x: number; y: number } = { x: 400, y: 300 }
): Map<string, { x: number; y: number }> {
  const depthMap = calculateDependencyDepth(nodes, edges);
  const positions = new Map<string, { x: number; y: number }>();

  // Group nodes by depth
  const nodesByDepth: Record<number, string[]> = {};
  for (const [nodeId, info] of depthMap) {
    if (!nodesByDepth[info.depth]) {
      nodesByDepth[info.depth] = [];
    }
    nodesByDepth[info.depth].push(nodeId);
  }

  const maxDepth = Math.max(...Object.keys(nodesByDepth).map(Number), 1);

  // Position nodes in rings
  for (const [depth, nodeIds] of Object.entries(nodesByDepth)) {
    const depthNum = parseInt(depth);
    const radius = (depthNum / maxDepth) * 250 + 50; // Min radius 50, max 300

    for (let i = 0; i < nodeIds.length; i++) {
      const angle = (i / nodeIds.length) * 2 * Math.PI;
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);

      positions.set(nodeIds[i], { x, y });
    }
  }

  return positions;
}
