/**
 * Zustand store for diagram state management
 */

import { create } from 'zustand';
import {
  DiagramNode,
  DiagramEdge,
  DiagramData,
  ViewportState
} from '../types/diagram';

interface DiagramState {
  // Nodes and edges
  nodes: DiagramNode[];
  edges: DiagramEdge[];

  // Viewport state
  viewport: ViewportState;

  // UI state
  selectedNodeId: string | null;
  isEditing: boolean;
  showMiniMap: boolean;

  // Actions
  setNodes: (nodes: DiagramNode[]) => void;
  setEdges: (edges: DiagramEdge[]) => void;
  addNode: (node: DiagramNode) => void;
  updateNode: (id: string, data: Partial<DiagramNode['data']>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: DiagramEdge) => void;
  deleteEdge: (id: string) => void;
  setViewport: (viewport: ViewportState) => void;
  setSelectedNode: (id: string | null) => void;
  setIsEditing: (isEditing: boolean) => void;
  toggleMiniMap: () => void;
  resetDiagram: () => void;
  loadDiagram: (data: DiagramData) => void;
  getDiagram: () => DiagramData;
}

const initialViewport: ViewportState = {
  x: 0,
  y: 0,
  zoom: 1
};

export const useDiagramStore = create<DiagramState>((set, get) => ({
  // Initial state
  nodes: [
    {
      id: '1',
      type: 'custom',
      position: { x: 250, y: 0 },
      data: {
        label: 'Entry Point',
        type: 'entry',
        description: 'Application entry',
        color: '#06b6d4',
        editable: true
      }
    },
    {
      id: '2',
      type: 'custom',
      position: { x: 100, y: 150 },
      data: {
        label: 'Process Logic',
        type: 'logic',
        description: 'Main processing logic',
        color: '#8b5cf6',
        editable: true
      }
    },
    {
      id: '3',
      type: 'custom',
      position: { x: 400, y: 150 },
      data: {
        label: 'Data Storage',
        type: 'storage',
        description: 'Database operations',
        color: '#10b981',
        editable: true
      }
    },
    {
      id: '4',
      type: 'custom',
      position: { x: 250, y: 300 },
      data: {
        label: 'Exit Point',
        type: 'exit',
        description: 'Response handler',
        color: '#f59e0b',
        editable: true
      }
    }
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2', animated: true },
    { id: 'e1-3', source: '1', target: '3', animated: true },
    { id: 'e2-4', source: '2', target: '4' },
    { id: 'e3-4', source: '3', target: '4' }
  ],
  viewport: initialViewport,
  selectedNodeId: null,
  isEditing: false,
  showMiniMap: true,

  // Actions
  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  addNode: (node) => set((state) => ({
    nodes: [...state.nodes, node]
  })),

  updateNode: (id, data) => set((state) => ({
    nodes: state.nodes.map((node) =>
      node.id === id
        ? { ...node, data: { ...node.data, ...data } }
        : node
    )
  })),

  deleteNode: (id) => set((state) => ({
    nodes: state.nodes.filter((node) => node.id !== id),
    edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id)
  })),

  addEdge: (edge) => set((state) => ({
    edges: [...state.edges, edge]
  })),

  deleteEdge: (id) => set((state) => ({
    edges: state.edges.filter((edge) => edge.id !== id)
  })),

  setViewport: (viewport) => set({ viewport }),

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  setIsEditing: (isEditing) => set({ isEditing }),

  toggleMiniMap: () => set((state) => ({
    showMiniMap: !state.showMiniMap
  })),

  resetDiagram: () => set({
    nodes: get().nodes,
    edges: [],
    viewport: initialViewport,
    selectedNodeId: null,
    isEditing: false
  }),

  loadDiagram: (data) => set({
    nodes: data.nodes,
    edges: data.edges,
    viewport: initialViewport
  }),

  getDiagram: () => ({
    nodes: get().nodes,
    edges: get().edges
  })
}));
