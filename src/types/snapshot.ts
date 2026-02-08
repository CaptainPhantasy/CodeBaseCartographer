/**
 * Snapshot types for graph state persistence
 */

import { DiagramNode, DiagramEdge } from './diagram';

export interface GraphNode {
  id: string;
  type: 'entry' | 'logic' | 'storage' | 'exit' | 'external' | 'decision' | 'process';
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    color?: string;
    complexity?: ComplexityMetrics;
    depth?: number;
  };
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

export interface ComplexityMetrics {
  cyclomatic: number;
  linesOfCode: number;
  maintainabilityIndex: number;
}

export interface SnapshotGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  metadata: {
    timestamp: number;
    version: string;
  };
}
