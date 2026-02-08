/**
 * Tests for diagram layout utilities
 */

import { describe, it, expect } from 'vitest';
import {
  applyAutoLayout,
  calculateNodeLevels,
  detectCycles,
  validateDiagramConnectivity
} from '../utils/diagramLayout';
import { DiagramNode, DiagramEdge } from '../types/diagram';

describe('applyAutoLayout', () => {
  it('should layout nodes in top-to-bottom direction', () => {
    const nodes: DiagramNode[] = [
      { id: '1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Node 1', type: 'process' } },
      { id: '2', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Node 2', type: 'process' } }
    ];
    const edges: DiagramEdge[] = [
      { id: 'e1-2', source: '1', target: '2' }
    ];

    const result = applyAutoLayout(nodes, edges, { direction: 'TB' });

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].position.y).toBeLessThan(result.nodes[1].position.y);
  });

  it('should maintain node data during layout', () => {
    const nodes: DiagramNode[] = [
      {
        id: '1',
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'Test Node', type: 'process', description: 'Test description' }
      }
    ];
    const edges: DiagramEdge[] = [];

    const result = applyAutoLayout(nodes, edges);

    expect(result.nodes[0].data.label).toBe('Test Node');
    expect(result.nodes[0].data.description).toBe('Test description');
  });
});

describe('calculateNodeLevels', () => {
  it('should calculate levels for simple chain', () => {
    const nodes: DiagramNode[] = [
      { id: '1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N1', type: 'process' } },
      { id: '2', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N2', type: 'process' } },
      { id: '3', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N3', type: 'process' } }
    ];
    const edges: DiagramEdge[] = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' }
    ];

    const levels = calculateNodeLevels(nodes, edges);

    expect(levels.get('1')).toBe(0);
    expect(levels.get('2')).toBe(1);
    expect(levels.get('3')).toBe(2);
  });

  it('should handle branching structures', () => {
    const nodes: DiagramNode[] = [
      { id: '1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N1', type: 'process' } },
      { id: '2', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N2', type: 'process' } },
      { id: '3', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N3', type: 'process' } }
    ];
    const edges: DiagramEdge[] = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e1-3', source: '1', target: '3' }
    ];

    const levels = calculateNodeLevels(nodes, edges);

    expect(levels.get('1')).toBe(0);
    expect(levels.get('2')).toBe(1);
    expect(levels.get('3')).toBe(1);
  });
});

describe('detectCycles', () => {
  it('should detect no cycles in acyclic graph', () => {
    const edges: DiagramEdge[] = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' }
    ];

    const cycles = detectCycles(edges);

    expect(cycles).toHaveLength(0);
  });

  it('should detect cycles in cyclic graph', () => {
    const edges: DiagramEdge[] = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e3-1', source: '3', target: '1' }
    ];

    const cycles = detectCycles(edges);

    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should handle self-loops', () => {
    const edges: DiagramEdge[] = [
      { id: 'e1-1', source: '1', target: '1' }
    ];

    const cycles = detectCycles(edges);

    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe('validateDiagramConnectivity', () => {
  it('should identify isolated nodes', () => {
    const nodes: DiagramNode[] = [
      { id: '1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N1', type: 'process' } },
      { id: '2', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N2', type: 'process' } },
      { id: '3', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N3', type: 'process' } }
    ];
    const edges: DiagramEdge[] = [
      { id: 'e1-2', source: '1', target: '2' }
    ];

    const result = validateDiagramConnectivity(nodes, edges);

    expect(result.isolatedNodes).toContain('3');
    expect(result.isolatedNodes).not.toContain('1');
    expect(result.isolatedNodes).not.toContain('2');
  });

  it('should detect connected graph', () => {
    const nodes: DiagramNode[] = [
      { id: '1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N1', type: 'process' } },
      { id: '2', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N2', type: 'process' } }
    ];
    const edges: DiagramEdge[] = [
      { id: 'e1-2', source: '1', target: '2' }
    ];

    const result = validateDiagramConnectivity(nodes, edges);

    expect(result.isConnected).toBe(true);
  });

  it('should detect disconnected components', () => {
    const nodes: DiagramNode[] = [
      { id: '1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N1', type: 'process' } },
      { id: '2', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N2', type: 'process' } },
      { id: '3', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N3', type: 'process' } },
      { id: '4', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'N4', type: 'process' } }
    ];
    const edges: DiagramEdge[] = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e3-4', source: '3', target: '4' }
    ];

    const result = validateDiagramConnectivity(nodes, edges);

    expect(result.isConnected).toBe(false);
    expect(result.disconnectedComponents).toHaveLength(2);
  });
});
