/**
 * Snapshot Service
 * Manages saving and loading of graph states for persistence and comparison
 */

import { DiagramData } from '../types/diagram';
import { GraphNode, GraphLink } from '../types/snapshot';

const SNAPSHOT_STORAGE_KEY = 'codebase-cartographer-snapshots';
const SNAPSHOT_VERSION = '1.0';

export interface SnapshotMetadata {
  id: string;
  name: string;
  description?: string;
  timestamp: number;
  nodeCount: number;
  edgeCount: number;
  tags?: string[];
  version: string;
}

export interface Snapshot extends SnapshotMetadata {
  data: DiagramData;
}

export interface SnapshotExport {
  format: 'json' | 'compressed';
}

/**
 * Snapshot Service class
 */
class SnapshotService {
  private snapshots: Map<string, Snapshot> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Save a snapshot with the given name
   */
  saveSnapshot(
    name: string,
    graphData: DiagramData,
    options?: {
      description?: string;
      tags?: string[];
    }
  ): Snapshot {
    const id = this.generateId(name);
    const snapshot: Snapshot = {
      id,
      name,
      description: options?.description,
      timestamp: Date.now(),
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.edges.length,
      tags: options?.tags,
      version: SNAPSHOT_VERSION,
      data: JSON.parse(JSON.stringify(graphData)) // Deep clone
    };

    this.snapshots.set(id, snapshot);
    this.persistToStorage();
    this.notifyListeners();

    return snapshot;
  }

  /**
   * Load a snapshot by ID
   */
  loadSnapshot(id: string): DiagramData | null {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      return null;
    }

    // Return a deep clone to prevent mutations
    return JSON.parse(JSON.stringify(snapshot.data));
  }

  /**
   * Load a snapshot by name
   */
  loadSnapshotByName(name: string): DiagramData | null {
    const snapshot = Array.from(this.snapshots.values()).find(s => s.name === name);
    if (!snapshot) {
      return null;
    }

    return JSON.parse(JSON.stringify(snapshot.data));
  }

  /**
   * List all snapshots
   */
  listSnapshots(): SnapshotMetadata[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(snapshot => ({
        id: snapshot.id,
        name: snapshot.name,
        description: snapshot.description,
        timestamp: snapshot.timestamp,
        nodeCount: snapshot.nodeCount,
        edgeCount: snapshot.edgeCount,
        tags: snapshot.tags,
        version: snapshot.version
      }));
  }

  /**
   * Get a single snapshot's metadata
   */
  getSnapshot(id: string): SnapshotMetadata | null {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      return null;
    }

    return {
      id: snapshot.id,
      name: snapshot.name,
      description: snapshot.description,
      timestamp: snapshot.timestamp,
      nodeCount: snapshot.nodeCount,
      edgeCount: snapshot.edgeCount,
      tags: snapshot.tags,
      version: snapshot.version
    };
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(id: string): boolean {
    const deleted = this.snapshots.delete(id);
    if (deleted) {
      this.persistToStorage();
      this.notifyListeners();
    }
    return deleted;
  }

  /**
   * Delete a snapshot by name
   */
  deleteSnapshotByName(name: string): boolean {
    const snapshot = Array.from(this.snapshots.entries()).find(([_, s]) => s.name === name);
    if (snapshot) {
      return this.deleteSnapshot(snapshot[0]);
    }
    return false;
  }

  /**
   * Update snapshot metadata
   */
  updateSnapshot(
    id: string,
    updates: {
      name?: string;
      description?: string;
      tags?: string[];
    }
  ): boolean {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      return false;
    }

    if (updates.name) snapshot.name = updates.name;
    if (updates.description !== undefined) snapshot.description = updates.description;
    if (updates.tags) snapshot.tags = updates.tags;

    this.persistToStorage();
    this.notifyListeners();

    return true;
  }

  /**
   * Export snapshot to file
   */
  exportSnapshot(id: string, format: 'json' = 'json'): string {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${id}`);
    }

    if (format === 'json') {
      return JSON.stringify(snapshot, null, 2);
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Import snapshot from file
   */
  importSnapshot(json: string): Snapshot {
    try {
      const imported = JSON.parse(json) as Snapshot;

      // Validate structure
      if (!imported.id || !imported.name || !imported.data) {
        throw new Error('Invalid snapshot format');
      }

      // Generate new ID to avoid conflicts
      const newId = this.generateId(imported.name + '-imported');
      imported.id = newId;

      this.snapshots.set(newId, imported);
      this.persistToStorage();
      this.notifyListeners();

      return imported;
    } catch (error) {
      throw new Error(`Failed to import snapshot: ${error}`);
    }
  }

  /**
   * Compare two snapshots
   */
  compareSnapshots(id1: string, id2: string): {
    addedNodes: number;
    removedNodes: number;
    addedEdges: number;
    removedEdges: number;
    nodeChanges: Array<{ nodeId: string; change: string }>;
  } {
    const snapshot1 = this.snapshots.get(id1);
    const snapshot2 = this.snapshots.get(id2);

    if (!snapshot1 || !snapshot2) {
      throw new Error('One or both snapshots not found');
    }

    const nodes1 = new Set(snapshot1.data.nodes.map(n => n.id));
    const nodes2 = new Set(snapshot2.data.nodes.map(n => n.id));

    const edges1 = new Set(snapshot1.data.edges.map(e => e.id));
    const edges2 = new Set(snapshot2.data.edges.map(e => e.id));

    const addedNodes = [...nodes2].filter(id => !nodes1.has(id)).length;
    const removedNodes = [...nodes1].filter(id => !nodes2.has(id)).length;
    const addedEdges = [...edges2].filter(id => !edges1.has(id)).length;
    const removedEdges = [...edges1].filter(id => !edges2.has(id)).length;

    return {
      addedNodes,
      removedNodes,
      addedEdges,
      removedEdges,
      nodeChanges: []
    };
  }

  /**
   * Subscribe to snapshot changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all snapshots
   */
  clearAll(): void {
    this.snapshots.clear();
    this.persistToStorage();
    this.notifyListeners();
  }

  /**
   * Get storage size in bytes
   */
  getStorageSize(): number {
    const data = JSON.stringify(Array.from(this.snapshots.values()));
    return new Blob([data]).size;
  }

  /**
   * Private: Generate unique ID
   */
  private generateId(name: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${slug}-${timestamp}-${random}`;
  }

  /**
   * Private: Persist to localStorage
   */
  private persistToStorage(): void {
    try {
      const data = JSON.stringify(Array.from(this.snapshots.entries()));
      localStorage.setItem(SNAPSHOT_STORAGE_KEY, data);
    } catch (error) {
      console.error('Failed to persist snapshots:', error);
    }
  }

  /**
   * Private: Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
      if (data) {
        const entries = JSON.parse(data) as Array<[string, Snapshot]>;
        this.snapshots = new Map(entries);
      }
    } catch (error) {
      console.error('Failed to load snapshots:', error);
      this.snapshots = new Map();
    }
  }

  /**
   * Private: Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Export singleton instance
export const snapshotService = new SnapshotService();

