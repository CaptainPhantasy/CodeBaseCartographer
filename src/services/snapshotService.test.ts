/**
 * Tests for snapshot service
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { snapshotService } from './snapshotService';
import { DiagramData } from '../types/diagram';

describe('snapshotService', () => {
  const mockDiagramData: DiagramData = {
    nodes: [
      {
        id: '1',
        type: 'custom',
        position: { x: 100, y: 100 },
        data: {
          label: 'Node 1',
          type: 'process',
          description: 'Test node 1',
          color: '#3b82f6'
        }
      },
      {
        id: '2',
        type: 'custom',
        position: { x: 300, y: 100 },
        data: {
          label: 'Node 2',
          type: 'logic',
          description: 'Test node 2',
          color: '#8b5cf6'
        }
      }
    ],
    edges: [
      {
        id: 'e1-2',
        source: '1',
        target: '2',
        animated: true
      }
    ]
  };

  beforeEach(() => {
    // Clear all snapshots before each test
    snapshotService.clearAll();
  });

  describe('saveSnapshot', () => {
    it('should save a snapshot with a name', () => {
      const snapshot = snapshotService.saveSnapshot('test-snapshot', mockDiagramData);

      expect(snapshot).toHaveProperty('id');
      expect(snapshot.name).toBe('test-snapshot');
      expect(snapshot.nodeCount).toBe(2);
      expect(snapshot.edgeCount).toBe(1);
      expect(snapshot.data).toEqual(mockDiagramData);
    });

    it('should save snapshot with optional metadata', () => {
      const snapshot = snapshotService.saveSnapshot(
        'test-snapshot',
        mockDiagramData,
        {
          description: 'Test description',
          tags: ['test', 'example']
        }
      );

      expect(snapshot.description).toBe('Test description');
      expect(snapshot.tags).toEqual(['test', 'example']);
    });

    it('should generate unique IDs for each snapshot', () => {
      const snapshot1 = snapshotService.saveSnapshot('test-1', mockDiagramData);
      const snapshot2 = snapshotService.saveSnapshot('test-2', mockDiagramData);

      expect(snapshot1.id).not.toBe(snapshot2.id);
    });
  });

  describe('loadSnapshot', () => {
    it('should load a snapshot by ID', () => {
      const saved = snapshotService.saveSnapshot('test-snapshot', mockDiagramData);
      const loaded = snapshotService.loadSnapshot(saved.id);

      expect(loaded).not.toBeNull();
      expect(loaded).toEqual(mockDiagramData);
    });

    it('should return null for non-existent snapshot', () => {
      const loaded = snapshotService.loadSnapshot('non-existent-id');
      expect(loaded).toBeNull();
    });

    it('should return a deep copy to prevent mutations', () => {
      const saved = snapshotService.saveSnapshot('test-snapshot', mockDiagramData);
      const loaded = snapshotService.loadSnapshot(saved.id);

      if (loaded) {
        // Modify the loaded data
        loaded.nodes[0].data.label = 'Modified';

        // Original should be unchanged
        const reloaded = snapshotService.loadSnapshot(saved.id);
        expect(reloaded?.nodes[0].data.label).toBe('Node 1');
      }
    });
  });

  describe('loadSnapshotByName', () => {
    it('should load a snapshot by name', () => {
      snapshotService.saveSnapshot('my-snapshot', mockDiagramData);
      const loaded = snapshotService.loadSnapshotByName('my-snapshot');

      expect(loaded).not.toBeNull();
      expect(loaded).toEqual(mockDiagramData);
    });

    it('should return null for non-existent name', () => {
      const loaded = snapshotService.loadSnapshotByName('non-existent');
      expect(loaded).toBeNull();
    });
  });

  describe('listSnapshots', () => {
    it('should return empty list when no snapshots', () => {
      const list = snapshotService.listSnapshots();
      expect(list).toEqual([]);
    });

    it('should list all snapshots', () => {
      snapshotService.saveSnapshot('snapshot-1', mockDiagramData);
      snapshotService.saveSnapshot('snapshot-2', mockDiagramData);

      const list = snapshotService.listSnapshots();
      expect(list).toHaveLength(2);
    });

    it('should sort by timestamp descending', () => {
      const snapshot1 = snapshotService.saveSnapshot('first', mockDiagramData);
      // Small delay to ensure different timestamp
      const snapshot2 = snapshotService.saveSnapshot('second', mockDiagramData);

      const list = snapshotService.listSnapshots();
      expect(list[0].id).toBe(snapshot2.id);
      expect(list[1].id).toBe(snapshot1.id);
    });

    it('should not include full data in list', () => {
      snapshotService.saveSnapshot('test', mockDiagramData);
      const list = snapshotService.listSnapshots();

      expect(list[0]).not.toHaveProperty('data');
      expect(list[0]).toHaveProperty('id');
      expect(list[0]).toHaveProperty('name');
      expect(list[0]).toHaveProperty('timestamp');
    });
  });

  describe('getSnapshot', () => {
    it('should return snapshot metadata', () => {
      const saved = snapshotService.saveSnapshot('test', mockDiagramData, {
        description: 'Test description'
      });
      const metadata = snapshotService.getSnapshot(saved.id);

      expect(metadata).not.toBeNull();
      expect(metadata?.name).toBe('test');
      expect(metadata?.description).toBe('Test description');
      expect(metadata?.nodeCount).toBe(2);
      expect(metadata?.edgeCount).toBe(1);
    });

    it('should return null for non-existent snapshot', () => {
      const metadata = snapshotService.getSnapshot('non-existent');
      expect(metadata).toBeNull();
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete a snapshot by ID', () => {
      const saved = snapshotService.saveSnapshot('test', mockDiagramData);

      expect(snapshotService.getSnapshot(saved.id)).not.toBeNull();

      const deleted = snapshotService.deleteSnapshot(saved.id);

      expect(deleted).toBe(true);
      expect(snapshotService.getSnapshot(saved.id)).toBeNull();
    });

    it('should return false for non-existent snapshot', () => {
      const deleted = snapshotService.deleteSnapshot('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('deleteSnapshotByName', () => {
    it('should delete a snapshot by name', () => {
      snapshotService.saveSnapshot('test', mockDiagramData);

      expect(snapshotService.loadSnapshotByName('test')).not.toBeNull();

      const deleted = snapshotService.deleteSnapshotByName('test');

      expect(deleted).toBe(true);
      expect(snapshotService.loadSnapshotByName('test')).toBeNull();
    });

    it('should return false for non-existent name', () => {
      const deleted = snapshotService.deleteSnapshotByName('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('updateSnapshot', () => {
    it('should update snapshot metadata', () => {
      const saved = snapshotService.saveSnapshot('test', mockDiagramData);

      const updated = snapshotService.updateSnapshot(saved.id, {
        name: 'updated-name',
        description: 'Updated description'
      });

      expect(updated).toBe(true);

      const metadata = snapshotService.getSnapshot(saved.id);
      expect(metadata?.name).toBe('updated-name');
      expect(metadata?.description).toBe('Updated description');
    });

    it('should not update data, only metadata', () => {
      const saved = snapshotService.saveSnapshot('test', mockDiagramData);

      snapshotService.updateSnapshot(saved.id, { name: 'updated' });

      const loaded = snapshotService.loadSnapshot(saved.id);
      expect(loaded).toEqual(mockDiagramData);
    });

    it('should return false for non-existent snapshot', () => {
      const updated = snapshotService.updateSnapshot('non-existent', {
        name: 'test'
      });
      expect(updated).toBe(false);
    });
  });

  describe('compareSnapshots', () => {
    it('should compare two snapshots', () => {
      const snapshot1 = snapshotService.saveSnapshot('first', mockDiagramData);

      const modifiedData = {
        ...mockDiagramData,
        nodes: [...mockDiagramData.nodes, {
          id: '3',
          type: 'custom' as const,
          position: { x: 500, y: 100 },
          data: { label: 'Node 3', type: 'process', color: '#10b981' }
        }]
      };
      const snapshot2 = snapshotService.saveSnapshot('second', modifiedData);

      const comparison = snapshotService.compareSnapshots(snapshot1.id, snapshot2.id);

      expect(comparison.addedNodes).toBe(1);
      expect(comparison.removedNodes).toBe(0);
    });

    it('should detect removed nodes', () => {
      const snapshot1 = snapshotService.saveSnapshot('first', mockDiagramData);

      const smallerData = {
        ...mockDiagramData,
        nodes: [mockDiagramData.nodes[0]]
      };
      const snapshot2 = snapshotService.saveSnapshot('second', smallerData);

      const comparison = snapshotService.compareSnapshots(snapshot1.id, snapshot2.id);

      expect(comparison.removedNodes).toBe(1);
      expect(comparison.addedNodes).toBe(0);
    });
  });

  describe('exportSnapshot', () => {
    it('should export snapshot as JSON', () => {
      const saved = snapshotService.saveSnapshot('test', mockDiagramData);
      const exported = snapshotService.exportSnapshot(saved.id, 'json');

      const parsed = JSON.parse(exported);
      expect(parsed.id).toBe(saved.id);
      expect(parsed.name).toBe('test');
      expect(parsed.data).toEqual(mockDiagramData);
    });

    it('should throw error for non-existent snapshot', () => {
      expect(() => {
        snapshotService.exportSnapshot('non-existent', 'json');
      }).toThrow();
    });
  });

  describe('importSnapshot', () => {
    it('should import snapshot from JSON', () => {
      const exported = JSON.stringify({
        id: 'original-id',
        name: 'imported-test',
        timestamp: Date.now(),
        nodeCount: 2,
        edgeCount: 1,
        version: '1.0',
        data: mockDiagramData
      });

      const imported = snapshotService.importSnapshot(exported);

      expect(imported.name).toBe('imported-test');
      expect(imported.id).not.toBe('original-id'); // Should generate new ID
      expect(snapshotService.loadSnapshot(imported.id)).toEqual(mockDiagramData);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => {
        snapshotService.importSnapshot('invalid json');
      }).toThrow();
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on changes', () => {
      let called = false;
      const unsubscribe = snapshotService.subscribe(() => {
        called = true;
      });

      snapshotService.saveSnapshot('test', mockDiagramData);

      expect(called).toBe(true);

      unsubscribe();
    });

    it('should unsubscribe correctly', () => {
      let callCount = 0;
      const unsubscribe = snapshotService.subscribe(() => {
        callCount++;
      });

      snapshotService.saveSnapshot('test-1', mockDiagramData);
      unsubscribe();
      snapshotService.saveSnapshot('test-2', mockDiagramData);

      expect(callCount).toBe(1);
    });
  });

  describe('clearAll', () => {
    it('should clear all snapshots', () => {
      snapshotService.saveSnapshot('test-1', mockDiagramData);
      snapshotService.saveSnapshot('test-2', mockDiagramData);

      expect(snapshotService.listSnapshots()).toHaveLength(2);

      snapshotService.clearAll();

      expect(snapshotService.listSnapshots()).toHaveLength(0);
    });
  });
});
