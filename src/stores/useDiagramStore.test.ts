/**
 * Tests for diagram store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from '../stores/useDiagramStore';
import { DiagramNode, DiagramEdge } from '../types/diagram';

describe('useDiagramStore', () => {
  describe('initial state', () => {
    it('should have default nodes', () => {
      // Create a fresh store for this test
      const { getState } = useDiagramStore;
      const state = getState();
      expect(state.nodes.length).toBeGreaterThan(0);
    });

    it('should have default edges', () => {
      const { getState } = useDiagramStore;
      const state = getState();
      expect(state.edges.length).toBeGreaterThan(0);
    });

    it('should have default viewport', () => {
      const { getState } = useDiagramStore;
      const state = getState();
      expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });
  });

  describe('setNodes', () => {
    it('should replace all nodes', () => {
      const store = useDiagramStore.getState();
      const newNodes: DiagramNode[] = [
        {
          id: 'test',
          type: 'custom',
          position: { x: 100, y: 100 },
          data: { label: 'Test', type: 'process' }
        }
      ];

      store.setNodes(newNodes);

      expect(useDiagramStore.getState().nodes).toEqual(newNodes);
    });
  });

  describe('addNode', () => {
    it('should add a new node', () => {
      const store = useDiagramStore.getState();
      const newNode: DiagramNode = {
        id: 'new-node',
        type: 'custom',
        position: { x: 50, y: 50 },
        data: { label: 'New Node', type: 'process' }
      };

      store.addNode(newNode);

      const state = useDiagramStore.getState();
      expect(state.nodes).toContainEqual(newNode);
    });
  });

  describe('updateNode', () => {
    it('should update existing node data', () => {
      const store = useDiagramStore.getState();
      // Add a test node first if none exist
      if (store.nodes.length === 0) {
        const testNode: DiagramNode = {
          id: 'test-update',
          type: 'custom',
          position: { x: 0, y: 0 },
          data: { label: 'Test', type: 'process' }
        };
        store.addNode(testNode);
      }

      const nodeId = store.nodes[0].id;

      store.updateNode(nodeId, { label: 'Updated Label' });

      const state = useDiagramStore.getState();
      const updatedNode = state.nodes.find((n) => n.id === nodeId);
      expect(updatedNode?.data.label).toBe('Updated Label');
    });

    it('should preserve existing data when updating', () => {
      const store = useDiagramStore.getState();
      // Add a test node first if none exist
      if (store.nodes.length === 0) {
        const testNode: DiagramNode = {
          id: 'test-preserve',
          type: 'custom',
          position: { x: 0, y: 0 },
          data: { label: 'Test', type: 'process', description: 'Original' }
        };
        store.addNode(testNode);
      }

      const nodeId = store.nodes[0].id;
      const originalDescription = store.nodes[0].data.description;

      store.updateNode(nodeId, { label: 'New Label' });

      const state = useDiagramStore.getState();
      const updatedNode = state.nodes.find((n) => n.id === nodeId);
      expect(updatedNode?.data.description).toBe(originalDescription);
    });
  });

  describe('deleteNode', () => {
    it('should remove node by id', () => {
      const store = useDiagramStore.getState();
      // Add a test node first
      const testNode: DiagramNode = {
        id: `test-delete-${Date.now()}`,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'Test Delete', type: 'process' }
      };
      store.addNode(testNode);

      const nodeId = testNode.id;

      store.deleteNode(nodeId);

      const state = useDiagramStore.getState();
      expect(state.nodes.find((n) => n.id === nodeId)).toBeUndefined();
    });

    it('should remove edges connected to deleted node', () => {
      const store = useDiagramStore.getState();
      // Add test nodes and edge
      const uniqueId = Date.now();
      const node1: DiagramNode = {
        id: `test-node-1-${uniqueId}`,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { label: 'Node 1', type: 'process' }
      };
      const node2: DiagramNode = {
        id: `test-node-2-${uniqueId}`,
        type: 'custom',
        position: { x: 100, y: 0 },
        data: { label: 'Node 2', type: 'process' }
      };
      store.addNode(node1);
      store.addNode(node2);
      const edgeId = `e-test-${uniqueId}`;
      store.addEdge({ id: edgeId, source: node1.id, target: node2.id });

      const nodeId = node1.id;

      store.deleteNode(nodeId);

      const state = useDiagramStore.getState();
      const remainingConnectedEdges = state.edges.filter(
        (e) => e.source === nodeId || e.target === nodeId
      );
      expect(remainingConnectedEdges).toHaveLength(0);
    });
  });

  describe('addEdge', () => {
    it('should add a new edge', () => {
      const store = useDiagramStore.getState();
      const newEdge: DiagramEdge = {
        id: 'e-new',
        source: '1',
        target: '2',
        animated: true
      };

      store.addEdge(newEdge);

      const state = useDiagramStore.getState();
      expect(state.edges).toContainEqual(newEdge);
    });
  });

  describe('deleteEdge', () => {
    it('should remove edge by id', () => {
      const store = useDiagramStore.getState();
      // Add a test edge
      const testEdgeId = `e-test-delete-${Date.now()}`;
      store.addEdge({ id: testEdgeId, source: '1', target: '2' });

      store.deleteEdge(testEdgeId);

      const state = useDiagramStore.getState();
      expect(state.edges.find((e) => e.id === testEdgeId)).toBeUndefined();
    });
  });

  describe('setViewport', () => {
    it('should update viewport state', () => {
      const store = useDiagramStore.getState();
      const newViewport = { x: 100, y: 200, zoom: 1.5 };

      store.setViewport(newViewport);

      expect(useDiagramStore.getState().viewport).toEqual(newViewport);
    });
  });

  describe('toggleMiniMap', () => {
    it('should toggle mini map visibility', () => {
      const store = useDiagramStore.getState();
      const initialState = store.showMiniMap;

      store.toggleMiniMap();

      expect(useDiagramStore.getState().showMiniMap).toBe(!initialState);
    });
  });

  describe('loadDiagram', () => {
    it('should load diagram data', () => {
      const store = useDiagramStore.getState();
      const diagramData = {
        nodes: [
          {
            id: 'loaded-1',
            type: 'custom',
            position: { x: 0, y: 0 },
            data: { label: 'Loaded 1', type: 'process' }
          }
        ],
        edges: [{ id: 'e1', source: 'loaded-1', target: 'loaded-1' }]
      };

      store.loadDiagram(diagramData);

      const state = useDiagramStore.getState();
      expect(state.nodes).toEqual(diagramData.nodes);
      expect(state.edges).toEqual(diagramData.edges);
    });
  });

  describe('getDiagram', () => {
    it('should return current diagram data', () => {
      const store = useDiagramStore.getState();
      const diagram = store.getDiagram();

      expect(diagram).toHaveProperty('nodes');
      expect(diagram).toHaveProperty('edges');
      expect(diagram.nodes).toEqual(store.nodes);
      expect(diagram.edges).toEqual(store.edges);
    });
  });
});
