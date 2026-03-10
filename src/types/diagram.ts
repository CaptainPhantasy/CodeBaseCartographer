/**
 * Diagram types for React Flow-based flow chart visualization
 */

import { Node, Edge } from '@xyflow/react';

/**
 * Custom node data structure for diagram nodes
 */
export interface DiagramNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  type: 'entry' | 'logic' | 'storage' | 'exit' | 'external' | 'decision' | 'process';
  color?: string;
  editable?: boolean;
  onLabelChange?: (id: string, label: string) => void;
  // Pneumatic tube visualization properties
  filePath?: string;      // Path to source file for click-to-open
  functionName?: string;  // Entry point function name
  line?: number;          // Line number if specific
  // Data transformation tracking
  layer?: number;         // Architectural layer (1=entry, 2=API, 3=service, 4=storage)
  inputType?: string;     // Type of data this node receives
  outputType?: string;    // Type of data this node produces
  transforms?: string[];  // List of transformations applied to data
}

/**
 * Extended node type for diagram
 */
export type DiagramNode = Node<DiagramNodeData, string | undefined>;

/**
 * Extended edge type for diagram
 */
export interface DiagramEdge extends Edge {
  label?: string;
  animated?: boolean;
}

/**
 * Complete diagram data structure
 */
export interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/**
 * Viewport state for zoom/pan
 */
export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Layout configuration for dagre
 */
export interface LayoutConfig {
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  nodeSpacing: number;
  rankSpacing: number;
}

/**
 * Export for React Flow types
 */
export type { Edge } from '@xyflow/react';
