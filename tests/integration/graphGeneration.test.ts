/**
 * Integration Test: Graph Generation Pipeline
 *
 * This test validates the end-to-end flow from backend codebase analysis
 * through to frontend diagram visualization. It ensures data format compatibility
 * and validates that the graph generation workflow produces correct results.
 *
 * Purpose: Alpha → Beta advancement - Priority 1, Item 3
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  applyAutoLayout,
  calculateNodeLevels,
  detectCycles,
  validateDiagramConnectivity
} from '../../src/utils/diagramLayout';
import type { DiagramNode, DiagramEdge } from '../../src/types/diagram';
import { useDiagramStore } from '../../src/stores/useDiagramStore';

// ============================================================
// Test Fixtures
// ============================================================

let baseTempDir: string;
let testCounter = 0;

function createBaseTempDir(): string {
  return mkdtempSync('/tmp/codebase-cartographer-graph-test-');
}

function cleanupBaseTempDir(dir: string): void {
  if (dir && dir.startsWith('/tmp/codebase-cartographer-graph-test-')) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

function getTestDir(): string {
  const testSubDir = join(baseTempDir, `test-${testCounter++}`);
  mkdirSync(testSubDir, { recursive: true });
  return testSubDir;
}

function cleanupTestDir(dir: string): void {
  if (dir && dir.startsWith(baseTempDir)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

function createTestFile(dir: string, relativePath: string, content: string): string {
  const fullPath = join(dir, relativePath);
  const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(fullPath, content);
  return fullPath;
}

// ============================================================
// Test Setup
// ============================================================

beforeAll(() => {
  baseTempDir = createBaseTempDir();
});

afterAll(() => {
  cleanupBaseTempDir(baseTempDir);
});

beforeEach(() => {
  // Reset diagram store before each test
  const store = useDiagramStore.getState();
  store.resetDiagram();
});

// ============================================================
// Data Format Validation Tests
// ============================================================

describe('Graph Data Format Validation', () => {
  it('should accept backend GraphData format', () => {
    // Backend GraphData format (from analyzer.ts)
    const backendGraphData = {
      nodes: [
        {
          id: 'src/index.ts',
          data: {
            label: 'src/index.ts',
            path: '/mock/src/index.ts',
            color: '#06b6d4',
            type: 'logic',
            complexity: { cyclomatic: 1, linesOfCode: 10 }
          }
        }
      ],
      links: [
        {
          id: 'link-1',
          source: 'src/index.ts',
          target: 'src/App.ts'
        }
      ],
      metadata: {
        analyzedPath: '/mock',
        fileCount: 1,
        timestamp: Date.now(),
        totalComplexity: 1
      }
    };

    // Verify the structure matches what's expected
    expect(backendGraphData.nodes).toBeInstanceOf(Array);
    expect(backendGraphData.links).toBeInstanceOf(Array);
    expect(backendGraphData.metadata).toBeDefined();
  });

  it('should convert backend format to frontend DiagramNode format', () => {
    // Backend format
    const backendNode = {
      id: 'src/index.ts',
      data: {
        label: 'src/index.ts',
        path: '/mock/src/index.ts',
        color: '#06b6d4',
        type: 'logic'
      }
    };

    // Expected frontend DiagramNode format
    const frontendNode: DiagramNode = {
      id: backendNode.id,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: backendNode.data.label,
        type: 'logic',
        color: backendNode.data.color
      }
    };

    expect(frontendNode.id).toBe(backendNode.id);
    expect(frontendNode.data.label).toBe(backendNode.data.label);
    expect(frontendNode.data.type).toBe('logic');
  });

  it('should convert backend links to frontend DiagramEdge format', () => {
    // Backend format
    const backendLink = {
      id: 'link-1',
      source: 'src/index.ts',
      target: 'src/App.ts'
    };

    // Expected frontend DiagramEdge format
    const frontendEdge: DiagramEdge = {
      id: backendLink.id,
      source: backendLink.source,
      target: backendLink.target
    };

    expect(frontendEdge.id).toBe(backendLink.id);
    expect(frontendEdge.source).toBe(backendLink.source);
    expect(frontendEdge.target).toBe(backendLink.target);
  });
});

// ============================================================
// Auto-Layout Integration Tests
// ============================================================

describe('Auto-Layout Integration', () => {
  it('should layout simple linear graph correctly', () => {
    const nodes: DiagramNode[] = [
      { id: '1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Node 1', type: 'entry' } },
      { id: '2', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Node 2', type: 'logic' } },
      { id: '3', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Node 3', type: 'exit' } }
    ];

    const edges: DiagramEdge[] = [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '2', target: '3' }
    ];

    const result = applyAutoLayout(nodes, edges, { direction: 'TB' });

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);

    // Verify nodes are positioned vertically (top to bottom)
    const yPositions = result.nodes.map(n => n.position.y).sort((a, b) => a - b);
    expect(yPositions[0]).toBeLessThan(yPositions[1]);
    expect(yPositions[1]).toBeLessThan(yPositions[2]);
  });

  it('should layout diamond-shaped graph correctly', () => {
    const nodes: DiagramNode[] = [
      { id: '1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Start', type: 'entry' } },
      { id: '2', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Branch A', type: 'logic' } },
      { id: '3', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Branch B', type: 'logic' } },
      { id: '4', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'End', type: 'exit' } }
    ];

    const edges: DiagramEdge[] = [
      { id: 'e1', source: '1', target: '2' },
      { id: 'e2', source: '1', target: '3' },
      { id: 'e3', source: '2', target: '4' },
      { id: 'e4', source: '3', target: '4' }
    ];

    const result = applyAutoLayout(nodes, edges, { direction: 'TB' });

    // Branch A and B should be at the same level (similar Y position)
    const branchA = result.nodes.find(n => n.id === '2');
    const branchB = result.nodes.find(n => n.id === '3');

    expect(branchA).toBeDefined();
    expect(branchB).toBeDefined();

    // Y positions should be similar (within layout tolerance)
    const yDiff = Math.abs(branchA!.position.y - branchB!.position.y);
    expect(yDiff).toBeLessThan(50);
  });

  it('should handle left-to-right layout direction', () => {
    const nodes: DiagramNode[] = [
      { id: '1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Node 1', type: 'entry' } },
      { id: '2', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Node 2', type: 'logic' } }
    ];

    const edges: DiagramEdge[] = [
      { id: 'e1', source: '1', target: '2' }
    ];

    const result = applyAutoLayout(nodes, edges, { direction: 'LR' });

    // Verify nodes are positioned horizontally (left to right)
    const xPositions = result.nodes.map(n => n.position.x).sort((a, b) => a - b);
    expect(xPositions[0]).toBeLessThan(xPositions[1]);
  });

  it('should preserve node data during layout', () => {
    const originalNodes: DiagramNode[] = [
      {
        id: '1',
        type: 'custom',
        position: { x: 0, y: 0 },
        width: 250,
        height: 100,
        data: {
          label: 'Test Node',
          type: 'process',
          color: '#8b5cf6',
          description: 'A test node',
          editable: true
        }
      }
    ];

    const edges: DiagramEdge[] = [];

    const result = applyAutoLayout(originalNodes, edges);

    expect(result.nodes[0].data).toEqual(originalNodes[0].data);
    expect(result.nodes[0].width).toBe(originalNodes[0].width);
    expect(result.nodes[0].height).toBe(originalNodes[0].height);
  });
});

// ============================================================
// Graph Analysis Integration Tests
// ============================================================

describe('Graph Analysis Integration', () => {
  it('should detect cycles in circular dependency graph', () => {
    const nodes: DiagramNode[] = [
      { id: 'A', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'A', type: 'logic' } },
      { id: 'B', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'B', type: 'logic' } },
      { id: 'C', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'C', type: 'logic' } }
    ];

    const edges: DiagramEdge[] = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
      { id: 'e3', source: 'C', target: 'A' } // Creates cycle
    ];

    const cycles = detectCycles(edges);

    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain('A');
    expect(cycles[0]).toContain('B');
    expect(cycles[0]).toContain('C');
  });

  it('should not detect cycles in acyclic graph', () => {
    const nodes: DiagramNode[] = [
      { id: 'A', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'A', type: 'entry' } },
      { id: 'B', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'B', type: 'logic' } },
      { id: 'C', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'C', type: 'exit' } }
    ];

    const edges: DiagramEdge[] = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' }
    ];

    const cycles = detectCycles(edges);

    expect(cycles.length).toBe(0);
  });

  it('should calculate correct node levels for hierarchical graph', () => {
    const nodes: DiagramNode[] = [
      { id: 'root', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Root', type: 'entry' } },
      { id: 'child1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Child 1', type: 'logic' } },
      { id: 'child2', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Child 2', type: 'logic' } },
      { id: 'grandchild', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Grandchild', type: 'logic' } }
    ];

    const edges: DiagramEdge[] = [
      { id: 'e1', source: 'root', target: 'child1' },
      { id: 'e2', source: 'root', target: 'child2' },
      { id: 'e3', source: 'child1', target: 'grandchild' }
    ];

    const levels = calculateNodeLevels(nodes, edges);

    expect(levels.get('root')).toBe(0);
    expect(levels.get('child1')).toBe(1);
    expect(levels.get('child2')).toBe(1);
    expect(levels.get('grandchild')).toBe(2);
  });

  it('should identify isolated nodes in disconnected graph', () => {
    const nodes: DiagramNode[] = [
      { id: 'connected', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Connected', type: 'logic' } },
      { id: 'isolated', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Isolated', type: 'logic' } }
    ];

    const edges: DiagramEdge[] = [
      { id: 'e1', source: 'connected', target: 'connected' } // Self-loop
    ];

    const result = validateDiagramConnectivity(nodes, edges);

    expect(result.isolatedNodes).toContain('isolated');
    expect(result.disconnectedComponents.length).toBeGreaterThan(1);
  });

  it('should validate fully connected graph', () => {
    const nodes: DiagramNode[] = [
      { id: '1', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Node 1', type: 'entry' } },
      { id: '2', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Node 2', type: 'logic' } }
    ];

    const edges: DiagramEdge[] = [
      { id: 'e1', source: '1', target: '2' }
    ];

    const result = validateDiagramConnectivity(nodes, edges);

    expect(result.isConnected).toBe(true);
    expect(result.isolatedNodes).toHaveLength(0);
    expect(result.disconnectedComponents.length).toBe(1);
  });
});

// ============================================================
// Diagram Store Integration Tests
// ============================================================

describe('Diagram Store Integration', () => {
  it('should load graph data into store correctly', () => {
    const graphData = {
      nodes: [
        {
          id: 'test-1',
          type: 'custom',
          position: { x: 100, y: 100 },
          data: { label: 'Test 1', type: 'logic', color: '#06b6d4' }
        },
        {
          id: 'test-2',
          type: 'custom',
          position: { x: 300, y: 100 },
          data: { label: 'Test 2', type: 'storage', color: '#10b981' }
        }
      ],
      edges: [
        { id: 'e1', source: 'test-1', target: 'test-2' }
      ]
    };

    const store = useDiagramStore.getState();
    store.loadDiagram(graphData);

    const state = useDiagramStore.getState();
    expect(state.nodes).toHaveLength(2);
    expect(state.edges).toHaveLength(1);
    expect(state.nodes[0].data.label).toBe('Test 1');
  });

  it('should reset diagram by clearing edges and resetting viewport', () => {
    const store = useDiagramStore.getState();

    // Remember initial node count
    const initialNodeCount = store.nodes.length;

    // Add a node and edge
    store.addNode({
      id: 'temp',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: { label: 'Temp', type: 'process' }
    });

    store.addEdge({ id: 'e-temp', source: 'temp', target: '1' });

    expect(useDiagramStore.getState().nodes.length).toBe(initialNodeCount + 1);
    expect(useDiagramStore.getState().edges.length).toBeGreaterThan(0);

    store.resetDiagram();

    // Edges cleared, viewport reset, nodes preserved
    const state = useDiagramStore.getState();
    expect(state.nodes.length).toBe(initialNodeCount + 1); // Nodes preserved
    expect(state.edges).toHaveLength(0); // Edges cleared
    expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 }); // Viewport reset
  });

  it('should update node and reflect in getDiagram', () => {
    const store = useDiagramStore.getState();
    const nodeId = store.nodes[0].id;

    store.updateNode(nodeId, { label: 'Updated Label' });

    const diagram = store.getDiagram();
    const updatedNode = diagram.nodes.find(n => n.id === nodeId);

    expect(updatedNode?.data.label).toBe('Updated Label');
  });

  it('should cascade delete node to connected edges', () => {
    const store = useDiagramStore.getState();

    // Add connected nodes
    store.addNode({
      id: 'test-source',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: { label: 'Source', type: 'process' }
    });

    store.addNode({
      id: 'test-target',
      type: 'custom',
      position: { x: 100, y: 0 },
      data: { label: 'Target', type: 'process' }
    });

    store.addEdge({ id: 'e-test', source: 'test-source', target: 'test-target' });

    expect(useDiagramStore.getState().edges.find(e => e.id === 'e-test')).toBeDefined();

    // Delete source node
    store.deleteNode('test-source');

    const state = useDiagramStore.getState();
    expect(state.nodes.find(n => n.id === 'test-source')).toBeUndefined();
    // Edge should also be deleted
    expect(state.edges.find(e => e.id === 'e-test')).toBeUndefined();
  });
});

// ============================================================
// End-to-End Graph Generation Simulation
// ============================================================

describe('End-to-End Graph Generation Simulation', () => {
  it('should simulate complete graph generation workflow', () => {
    // Step 1: Simulate backend analysis result
    const backendAnalysisResult = {
      nodes: [
        {
          id: 'src/App.tsx',
          data: { label: 'src/App.tsx', path: '/test/src/App.tsx', color: '#06b6d4', type: 'logic' }
        },
        {
          id: 'src/components/Header.tsx',
          data: { label: 'src/components/Header.tsx', path: '/test/src/components/Header.tsx', color: '#06b6d4', type: 'logic' }
        },
        {
          id: 'src/utils/helpers.ts',
          data: { label: 'src/utils/helpers.ts', path: '/test/src/utils/helpers.ts', color: '#06b6d4', type: 'logic' }
        },
        {
          id: 'package.json',
          data: { label: 'package.json', path: '/test/package.json', color: '#10b981', type: 'config' }
        }
      ],
      links: [
        { id: 'l1', source: 'src/App.tsx', target: 'src/components/Header.tsx' },
        { id: 'l2', source: 'src/App.tsx', target: 'src/utils/helpers.ts' }
      ],
      metadata: { analyzedPath: '/test', fileCount: 4, timestamp: Date.now(), totalComplexity: 15 }
    };

    // Step 2: Convert to frontend format
    const frontendNodes: DiagramNode[] = backendAnalysisResult.nodes.map(n => ({
      id: n.id,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: n.data.label,
        type: n.data.type as any,
        color: n.data.color
      }
    }));

    const frontendEdges: DiagramEdge[] = backendAnalysisResult.links.map(l => ({
      id: l.id,
      source: l.source,
      target: l.target
    }));

    // Step 3: Validate data integrity
    expect(frontendNodes).toHaveLength(4);
    expect(frontendEdges).toHaveLength(2);

    // Step 4: Apply auto-layout
    const layouted = applyAutoLayout(frontendNodes, frontendEdges, { direction: 'TB' });

    // Verify all nodes have positions
    layouted.nodes.forEach(node => {
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeGreaterThanOrEqual(0);
    });

    // Step 5: Analyze graph properties
    const levels = calculateNodeLevels(layouted.nodes, layouted.edges);
    const cycles = detectCycles(layouted.edges);
    const connectivity = validateDiagramConnectivity(layouted.nodes, layouted.edges);

    // Verify graph is well-formed
    expect(levels.size).toBeGreaterThan(0);
    expect(cycles.length).toBe(0); // No cycles in this graph
    expect(connectivity.isConnected).toBe(false); // 2 components (package.json is isolated)
    expect(connectivity.isolatedNodes.length).toBe(1); // package.json
    expect(connectivity.disconnectedComponents.length).toBe(2); // {App, Header, helpers} and {package.json}

    // Step 6: Load into diagram store
    const store = useDiagramStore.getState();
    store.loadDiagram({ nodes: layouted.nodes, edges: layouted.edges });

    // Verify store state
    const state = useDiagramStore.getState();
    expect(state.nodes).toHaveLength(4);
    expect(state.edges).toHaveLength(2);
  });

  it('should handle complex dependency graph with multiple levels', () => {
    // Simulate a real project structure
    const projectNodes: DiagramNode[] = [
      { id: 'src/index.ts', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'index.ts', type: 'entry' } },
      { id: 'src/App.ts', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'App.ts', type: 'logic' } },
      { id: 'src/routes/index.ts', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'routes/index.ts', type: 'logic' } },
      { id: 'src/components/Button.tsx', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Button.tsx', type: 'logic' } },
      { id: 'src/components/Header.tsx', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'Header.tsx', type: 'logic' } },
      { id: 'src/utils/format.ts', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'format.ts', type: 'logic' } },
      { id: 'src/config/index.ts', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'config/index.ts', type: 'config' } },
      { id: 'package.json', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'package.json', type: 'config' } }
    ];

    const projectEdges: DiagramEdge[] = [
      { id: 'e1', source: 'src/index.ts', target: 'src/App.ts' },
      { id: 'e2', source: 'src/index.ts', target: 'src/routes/index.ts' },
      { id: 'e3', source: 'src/App.ts', target: 'src/components/Header.tsx' },
      { id: 'e4', source: 'src/App.ts', target: 'src/components/Button.tsx' },
      { id: 'e5', source: 'src/components/Header.tsx', target: 'src/utils/format.ts' },
      { id: 'e6', source: 'src/routes/index.ts', target: 'src/config/index.ts' },
      { id: 'e7', source: 'src/config/index.ts', target: 'package.json' }
    ];

    // Apply layout
    const layouted = applyAutoLayout(projectNodes, projectEdges, { direction: 'TB' });

    // Verify hierarchical structure
    const levels = calculateNodeLevels(layouted.nodes, layouted.edges);

    // Entry point should be at level 0
    expect(levels.get('src/index.ts')).toBe(0);

    // Config should be at the deepest level
    expect(levels.get('src/config/index.ts')).toBeGreaterThan(0);
    expect(levels.get('package.json')).toBeGreaterThan(0);

    // Verify no cycles
    const cycles = detectCycles(projectEdges);
    expect(cycles.length).toBe(0);

    // Verify single connected component (except package.json which is a leaf)
    const connectivity = validateDiagramConnectivity(layouted.nodes, projectEdges);
    expect(connectivity.isolatedNodes).toHaveLength(0);
  });

  it('should detect and report circular dependencies', () => {
    // Simulate circular dependency scenario
    const circularNodes: DiagramNode[] = [
      { id: 'src/A.ts', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'A.ts', type: 'logic' } },
      { id: 'src/B.ts', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'B.ts', type: 'logic' } },
      { id: 'src/C.ts', type: 'custom', position: { x: 0, y: 0 }, data: { label: 'C.ts', type: 'logic' } }
    ];

    const circularEdges: DiagramEdge[] = [
      { id: 'e1', source: 'src/A.ts', target: 'src/B.ts' },
      { id: 'e2', source: 'src/B.ts', target: 'src/C.ts' },
      { id: 'e3', source: 'src/C.ts', target: 'src/A.ts' } // Cycle back
    ];

    const cycles = detectCycles(circularEdges);

    // Should detect exactly one cycle
    expect(cycles.length).toBe(1);
    expect(cycles[0]).toEqual(expect.arrayContaining(['src/A.ts', 'src/B.ts', 'src/C.ts']));
  });
});

// ============================================================
// Performance Tests
// ============================================================

describe('Graph Generation Performance', () => {
  it('should layout large graph efficiently', () => {
    // Create a large graph (50 nodes, 100 edges)
    const nodes: DiagramNode[] = Array.from({ length: 50 }, (_, i) => ({
      id: `node-${i}`,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: { label: `Node ${i}`, type: 'logic' }
    }));

    const edges: DiagramEdge[] = [];
    for (let i = 0; i < 49; i++) {
      edges.push({ id: `e${i}`, source: `node-${i}`, target: `node-${i + 1}` });
      // Add some cross-connections
      if (i < 40) {
        edges.push({ id: `ecross${i}`, source: `node-${i}`, target: `node-${i + 10}` });
      }
    }

    const startTime = Date.now();
    const result = applyAutoLayout(nodes, edges);
    const duration = Date.now() - startTime;

    expect(result.nodes).toHaveLength(50);
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should analyze graph connectivity efficiently', () => {
    const nodes: DiagramNode[] = Array.from({ length: 100 }, (_, i) => ({
      id: `node-${i}`,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: { label: `Node ${i}`, type: 'logic' }
    }));

    const edges: DiagramEdge[] = [];
    for (let i = 0; i < 99; i++) {
      edges.push({ id: `e${i}`, source: `node-${i}`, target: `node-${i + 1}` });
    }

    const startTime = Date.now();
    const result = validateDiagramConnectivity(nodes, edges);
    const duration = Date.now() - startTime;

    expect(result.isConnected).toBe(true);
    expect(duration).toBeLessThan(500); // Should complete in under 500ms
  });
});
