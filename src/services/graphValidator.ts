/**
 * GraphValidator - Validates and auto-repairs LLM-generated graph data
 *
 * Checks:
 * - Schema validation (required fields, types)
 * - Topological validation (orphan nodes, broken links)
 * - Semantic validation (flow makes sense)
 *
 * Auto-repair strategies:
 * - Remove orphan nodes (no connections)
 * - Fix broken links (source/target doesn't exist)
 * - Detect and highlight cycles
 * - Infer missing entry/exit points
 */

import type { GraphData, Node, Link } from '../types';
import {
  validateDiagramConnectivity,
  detectCycles,
  calculateNodeLevels
} from '../utils/diagramLayout';

// ============================================================================
// TYPES
// ============================================================================

export interface GraphError {
  type: 'schema' | 'topology' | 'semantic';
  severity: 'error' | 'warning';
  message: string;
  nodeId?: string;
  edgeId?: string;
  details?: Record<string, unknown>;
}

export interface GraphWarning {
  type: 'orphan' | 'cycle' | 'missing_metadata' | 'unusual_structure';
  message: string;
  affected: string[];
}

export interface GraphValidationResult {
  isValid: boolean;
  errors: GraphError[];
  warnings: GraphWarning[];
  repaired?: GraphData;
  stats: {
    nodeCount: number;
    edgeCount: number;
    orphanCount: number;
    cycleCount: number;
    connectedComponents: number;
  };
}

// ============================================================================
// VALIDATORS
// ============================================================================

/**
 * Validate schema of graph data
 */
function validateSchema(data: GraphData): GraphError[] {
  const errors: GraphError[] = [];

  // Check required fields
  if (!data.nodes) {
    errors.push({
      type: 'schema',
      severity: 'error',
      message: 'Graph data missing "nodes" array',
    });
    return errors;  // Can't continue without nodes
  }

  if (!data.links) {
    errors.push({
      type: 'schema',
      severity: 'error',
      message: 'Graph data missing "links" array',
    });
    return errors;  // Can't continue without links
  }

  // Validate each node
  for (const node of data.nodes) {
    if (!node.id) {
      errors.push({
        type: 'schema',
        severity: 'error',
        message: 'Node missing required "id" field',
        details: { node },
      });
    }
    if (!node.label) {
      errors.push({
        type: 'schema',
        severity: 'warning',
        message: `Node "${node.id}" missing "label" - using id as label`,
        nodeId: node.id,
      });
    }
    if (!node.type) {
      errors.push({
        type: 'schema',
        severity: 'warning',
        message: `Node "${node.id}" missing "type" - defaulting to "process"`,
        nodeId: node.id,
      });
    }
  }

  // Validate each link
  for (const link of data.links) {
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;

    if (!sourceId || !targetId) {
      errors.push({
        type: 'schema',
        severity: 'error',
        message: 'Link missing "source" or "target"',
        details: { link },
      });
    }
  }

  return errors;
}

/**
 * Validate topology (connections, orphans, cycles)
 */
function validateTopology(data: GraphData): {
  errors: GraphError[];
  warnings: GraphWarning[];
  stats: GraphValidationResult['stats'];
} {
  const errors: GraphError[] = [];
  const warnings: GraphWarning[] = [];

  // Build node ID set
  const nodeIds = new Set(data.nodes.map(n => n.id));

  // Check for broken links (referencing non-existent nodes)
  const brokenLinks: Link[] = [];
  const validLinks: Link[] = [];

  for (const link of data.links) {
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;

    const sourceExists = nodeIds.has(sourceId);
    const targetExists = nodeIds.has(targetId);

    if (!sourceExists || !targetExists) {
      brokenLinks.push(link);
      errors.push({
        type: 'topology',
        severity: 'error',
        message: `Link references non-existent node: ${!sourceExists ? sourceId : targetId}`,
        edgeId: `edge-${sourceId}-${targetId}`,
        details: { source: sourceId, target: targetId },
      });
    } else {
      validLinks.push(link);
    }
  }

  // Check for orphan nodes (no connections)
  const connectedNodes = new Set<string>();
  for (const link of validLinks) {
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;
    connectedNodes.add(sourceId);
    connectedNodes.add(targetId);
  }

  const orphanNodes = data.nodes.filter(n => !connectedNodes.has(n.id));
  if (orphanNodes.length > 0) {
    warnings.push({
      type: 'orphan',
      message: `Found ${orphanNodes.length} orphan nodes with no connections`,
      affected: orphanNodes.map(n => n.id),
    });
  }

  // Check for cycles
  const cycles = detectCyclesFromData(data);
  if (cycles.length > 0) {
    warnings.push({
      type: 'cycle',
      message: `Found ${cycles.length} cycles in the graph`,
      affected: cycles.flat(),
    });
  }

  // Check for entry/exit points
  const entryNodes = data.nodes.filter(n => n.type === 'entry');
  const exitNodes = data.nodes.filter(n => n.type === 'exit');

  if (entryNodes.length === 0) {
    warnings.push({
      type: 'unusual_structure',
      message: 'No entry points defined - will auto-detect from in-degree',
      affected: [],
    });
  }

  if (exitNodes.length === 0) {
    warnings.push({
      type: 'unusual_structure',
      message: 'No exit points defined - will auto-detect from out-degree',
      affected: [],
    });
  }

  // Calculate connected components
  const components = findConnectedComponents(data.nodes, validLinks);

  return {
    errors,
    warnings,
    stats: {
      nodeCount: data.nodes.length,
      edgeCount: validLinks.length,
      orphanCount: orphanNodes.length,
      cycleCount: cycles.length,
      connectedComponents: components.length,
    },
  };
}

/**
 * Validate semantics (does the flow make sense?)
 */
function validateSemantics(data: GraphData): GraphWarning[] {
  const warnings: GraphWarning[] = [];

  // Check for nodes without filePath that should have it
  const codeNodes = data.nodes.filter(
    n => ['logic', 'process', 'storage'].includes(n.type) && !n.filePath
  );

  if (codeNodes.length > 0) {
    warnings.push({
      type: 'missing_metadata',
      message: `${codeNodes.length} code nodes missing filePath - click-to-open won't work`,
      affected: codeNodes.map(n => n.id),
    });
  }

  // Check for unusually large or small graphs
  if (data.nodes.length > 100) {
    warnings.push({
      type: 'unusual_structure',
      message: 'Large graph (>100 nodes) may be difficult to visualize',
      affected: [],
    });
  }

  if (data.nodes.length < 2) {
    warnings.push({
      type: 'unusual_structure',
      message: 'Graph has fewer than 2 nodes - is this a complete architecture?',
      affected: [],
    });
  }

  return warnings;
}

// ============================================================================
// AUTO-REPAIR
// ============================================================================

/**
 * Auto-repair graph data
 */
function repairGraph(data: GraphData): GraphData {
  const nodeIds = new Set(data.nodes.map(n => n.id));

  // 1. Fix missing labels
  const repairedNodes = data.nodes.map(node => ({
    ...node,
    label: node.label || node.id,
    type: node.type || 'process' as const,
    group: node.group ?? 1,
  }));

  // 2. Remove broken links
  const validLinks = data.links.filter(link => {
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;
    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });

  // 3. Normalize link format (ensure strings)
  const repairedLinks: Link[] = validLinks.map(link => ({
    source: typeof link.source === 'string' ? link.source : (link.source as any).id,
    target: typeof link.target === 'string' ? link.target : (link.target as any).id,
    value: link.value ?? 1,
    label: link.label,
  }));

  // 4. Remove orphan nodes (optional - keep them for now as they might be intentional)
  // We'll just flag them in warnings

  // 5. Infer entry/exit points if missing
  const connectedNodes = new Set<string>();
  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();

  for (const node of repairedNodes) {
    incomingCount.set(node.id, 0);
    outgoingCount.set(node.id, 0);
  }

  for (const link of repairedLinks) {
    const sourceId = link.source as string;
    const targetId = link.target as string;
    outgoingCount.set(sourceId, (outgoingCount.get(sourceId) || 0) + 1);
    incomingCount.set(targetId, (incomingCount.get(targetId) || 0) + 1);
    connectedNodes.add(sourceId);
    connectedNodes.add(targetId);
  }

  // Find nodes that could be entry points (no incoming edges)
  const potentialEntries = repairedNodes.filter(
    n => (incomingCount.get(n.id) || 0) === 0 && n.type !== 'entry'
  );

  // Find nodes that could be exit points (no outgoing edges)
  const potentialExits = repairedNodes.filter(
    n => (outgoingCount.get(n.id) || 0) === 0 && n.type !== 'exit'
  );

  // Update types for inferred entry/exit points
  for (const node of repairedNodes) {
    if (potentialEntries.includes(node) && node.type === 'process') {
      node.type = 'entry';
    }
    if (potentialExits.includes(node) && node.type === 'process') {
      node.type = 'exit';
    }
  }

  return {
    nodes: repairedNodes,
    links: repairedLinks,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Detect cycles in graph data
 */
function detectCyclesFromData(data: GraphData): string[][] {
  const graph = new Map<string, string[]>();

  // Build adjacency list
  for (const node of data.nodes) {
    graph.set(node.id, []);
  }

  for (const link of data.links) {
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;

    if (sourceId && targetId && graph.has(sourceId)) {
      graph.get(sourceId)!.push(targetId);
    }
  }

  // DFS to find cycles
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

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

  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId, []);
    }
  }

  return cycles;
}

/**
 * Find connected components
 */
function findConnectedComponents(
  nodes: Node[],
  links: Link[]
): string[][] {
  const adjacencyList = new Map<string, string[]>();

  for (const node of nodes) {
    adjacencyList.set(node.id, []);
  }

  for (const link of links) {
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;

    if (sourceId && targetId) {
      adjacencyList.get(sourceId)?.push(targetId);
      adjacencyList.get(targetId)?.push(sourceId);
    }
  }

  const visited = new Set<string>();
  const components: string[][] = [];

  function bfs(start: string): string[] {
    const component: string[] = [];
    const queue = [start];
    visited.add(start);

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

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      components.push(bfs(node.id));
    }
  }

  return components;
}

// ============================================================================
// MAIN VALIDATOR
// ============================================================================

/**
 * Validate graph data with optional auto-repair
 */
export function validateGraph(
  data: GraphData,
  options: { autoRepair: boolean } = { autoRepair: true }
): GraphValidationResult {
  const allErrors: GraphError[] = [];
  const allWarnings: GraphWarning[] = [];

  // 1. Schema validation
  const schemaErrors = validateSchema(data);
  allErrors.push(...schemaErrors);

  // If schema is broken, can't continue
  if (schemaErrors.some(e => e.severity === 'error')) {
    return {
      isValid: false,
      errors: allErrors,
      warnings: allWarnings,
      stats: {
        nodeCount: data.nodes?.length || 0,
        edgeCount: data.links?.length || 0,
        orphanCount: 0,
        cycleCount: 0,
        connectedComponents: 0,
      },
    };
  }

  // 2. Topology validation
  const topologyResult = validateTopology(data);
  allErrors.push(...topologyResult.errors);
  allWarnings.push(...topologyResult.warnings);

  // 3. Semantic validation
  const semanticWarnings = validateSemantics(data);
  allWarnings.push(...semanticWarnings);

  // 4. Determine if valid
  const hasErrors = allErrors.some(e => e.severity === 'error');
  let repaired: GraphData | undefined;

  // 5. Auto-repair if requested
  if (options.autoRepair) {
    repaired = repairGraph(data);
  } else if (hasErrors) {
    // Only repair if there are errors and autoRepair wasn't explicitly disabled
    repaired = repairGraph(data);
  }

  return {
    isValid: !hasErrors,
    errors: allErrors,
    warnings: allWarnings,
    repaired,
    stats: topologyResult.stats,
  };
}

/**
 * Quick validation check (returns boolean only)
 */
export function isValidGraph(data: GraphData): boolean {
  const result = validateGraph(data, { autoRepair: false });
  return result.isValid;
}

/**
 * Format validation result for LLM feedback
 */
export function formatValidationFeedback(result: GraphValidationResult): string {
  const lines: string[] = [];

  lines.push('# Graph Validation Results');
  lines.push('');
  lines.push(`Status: ${result.isValid ? '✓ VALID' : '✗ INVALID'}`);
  lines.push('');
  lines.push('## Statistics');
  lines.push(`- Nodes: ${result.stats.nodeCount}`);
  lines.push(`- Edges: ${result.stats.edgeCount}`);
  lines.push(`- Orphans: ${result.stats.orphanCount}`);
  lines.push(`- Cycles: ${result.stats.cycleCount}`);
  lines.push(`- Components: ${result.stats.connectedComponents}`);
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('## Errors');
    for (const error of result.errors) {
      lines.push(`- [${error.severity}] ${error.message}`);
      if (error.nodeId) lines.push(`  Node: ${error.nodeId}`);
      if (error.edgeId) lines.push(`  Edge: ${error.edgeId}`);
    }
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('## Warnings');
    for (const warning of result.warnings) {
      lines.push(`- [${warning.type}] ${warning.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export default {
  validateGraph,
  isValidGraph,
  formatValidationFeedback,
};
