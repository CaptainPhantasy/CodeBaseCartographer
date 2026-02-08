/**
 * Dagre-based auto-layout utility for diagram nodes
 */

import dagre from 'dagre';
import {
  DiagramNode,
  DiagramEdge,
  LayoutConfig
} from '../types/diagram';

const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  direction: 'TB', // Top to Bottom
  nodeSpacing: 100,
  rankSpacing: 150
};

/**
 * Apply dagre auto-layout to nodes and edges
 */
export function applyAutoLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  config: Partial<LayoutConfig> = {}
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const layoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...config };

  // Create a new directed graph
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Set graph options
  dagreGraph.setGraph({
    rankdir: layoutConfig.direction,
    nodesep: layoutConfig.nodeSpacing,
    ranksep: layoutConfig.rankSpacing,
    edgesep: 50
  });

  // Add nodes to the graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: node.width || 200,
      height: node.height || 80
    });
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply calculated positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (node.width || 200) / 2,
        y: nodeWithPosition.y - (node.height || 80) / 2
      }
    };
  });

  return {
    nodes: layoutedNodes,
    edges
  };
}

/**
 * Calculate hierarchical levels for nodes
 */
export function calculateNodeLevels(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): Map<string, number> {
  const levels = new Map<string, number>();
  const visited = new Set<string>();

  // Find root nodes (no incoming edges)
  const inDegree = new Map<string, number>();
  nodes.forEach((node) => inDegree.set(node.id, 0));
  edges.forEach((edge) => {
    inDegree.set(
      edge.target,
      (inDegree.get(edge.target) || 0) + 1
    );
  });

  const roots = nodes.filter((node) => (inDegree.get(node.id) || 0) === 0);

  // BFS to calculate levels
  const queue: { id: string; level: number }[] = roots.map((r) => ({
    id: r.id,
    level: 0
  }));

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    levels.set(id, level);

    // Find children and add to queue
    const children = edges.filter((e) => e.source === id);
    children.forEach((edge) => {
      if (!visited.has(edge.target)) {
        queue.push({ id: edge.target, level: level + 1 });
      }
    });
  }

  return levels;
}

/**
 * Detect cycles in the graph
 */
export function detectCycles(edges: DiagramEdge[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const graph = new Map<string, string[]>();

  // Build adjacency list
  edges.forEach((edge) => {
    if (!graph.has(edge.source)) {
      graph.set(edge.source, []);
    }
    graph.get(edge.source)!.push(edge.target);
  });

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      }
    }

    recursionStack.delete(node);
  }

  // Check all nodes
  graph.forEach((_, node) => {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  });

  return cycles;
}

/**
 * Validate diagram connectivity
 */
export function validateDiagramConnectivity(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): {
  isConnected: boolean;
  isolatedNodes: string[];
  disconnectedComponents: string[][];
} {
  const isolatedNodes: string[] = [];
  const components: string[][] = [];
  const visited = new Set<string>();

  // Find nodes with no connections
  const connectedNodes = new Set<string>();
  edges.forEach((edge) => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });

  nodes.forEach((node) => {
    if (!connectedNodes.has(node.id)) {
      isolatedNodes.push(node.id);
    }
  });

  // Find connected components using BFS
  const adjacencyList = new Map<string, string[]>();
  nodes.forEach((node) => adjacencyList.set(node.id, []));
  edges.forEach((edge) => {
    adjacencyList.get(edge.source)!.push(edge.target);
    adjacencyList.get(edge.target)!.push(edge.source);
  });

  function bfs(startNode: string): string[] {
    const component: string[] = [];
    const queue: string[] = [startNode];
    visited.add(startNode);

    while (queue.length > 0) {
      const node = queue.shift()!;
      component.push(node);

      const neighbors = adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return component;
  }

  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      components.push(bfs(node.id));
    }
  });

  return {
    isConnected: components.length <= 1,
    isolatedNodes,
    disconnectedComponents: components
  };
}
