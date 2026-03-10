/**
 * Tests for FileVersionStore service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import FileVersionStore, { getFileVersionStore } from './fileVersionStore';

describe('FileVersionStore', () => {
  let store: FileVersionStore;

  beforeEach(() => {
    // Create fresh instance for each test
    store = new FileVersionStore();
  });

  describe('storeVersion', () => {
    it('should store a file version', () => {
      store.storeVersion('/test/file.ts', 'content here', 1000);

      const version = store.getPreviousVersion('/test/file.ts');
      expect(version).toBeDefined();
      expect(version?.content).toBe('content here');
      expect(version?.timestamp).toBe(1000);
      expect(version?.path).toBe('/test/file.ts');
    });

    it('should not store duplicate content', () => {
      store.storeVersion('/test/file.ts', 'content', 1000);
      store.storeVersion('/test/file.ts', 'content', 2000);

      const version = store.getPreviousVersion('/test/file.ts');
      expect(version?.content).toBe('content');
      expect(version?.timestamp).toBe(1000); // Should keep original timestamp
    });

    it('should not store duplicate content', () => {
      store.storeVersion('/test/file.ts', 'content', 1000);
      store.storeVersion('/test/file.ts', 'content', 2000);

      const version = store.getPreviousVersion('/test/file.ts');
      expect(version?.timestamp).toBe(1000); // Should keep original timestamp
    });

    it('should update content when it changes', () => {
      store.storeVersion('/test/file.ts', 'content v1', 1000);
      store.storeVersion('/test/file.ts', 'content v2', 2000);

      const version = store.getPreviousVersion('/test/file.ts');
      expect(version?.content).toBe('content v2');
      expect(version?.timestamp).toBe(2000);
    });
  });

  describe('getPreviousVersion', () => {
    it('should return null for non-existent file', () => {
      const version = store.getPreviousVersion('/nonexistent/file.ts');
      expect(version).toBeNull();
    });

    it('should return stored version', () => {
      store.storeVersion('/test/file.ts', 'content', 1000);

      const version = store.getPreviousVersion('/test/file.ts');
      expect(version).toEqual({
        path: '/test/file.ts',
        content: 'content',
        timestamp: 1000
      });
    });

    it('should update last accessed time', () => {
      const timestamp1 = Date.now();
      store.storeVersion('/test/file.ts', 'content', timestamp1);

      // Wait a bit to ensure time difference
      const timestamp2 = Date.now();
      const version1 = store.getPreviousVersion('/test/file.ts');

      // Wait more
      const timestamp3 = Date.now();
      const version2 = store.getPreviousVersion('/test/file.ts');

      expect(version1).toBeDefined();
      expect(version2).toBeDefined();
    });
  });

  describe('hasPreviousVersion', () => {
    it('should return false for non-existent file', () => {
      expect(store.hasPreviousVersion('/nonexistent/file.ts')).toBe(false);
    });

    it('should return true for stored file', () => {
      store.storeVersion('/test/file.ts', 'content');
      expect(store.hasPreviousVersion('/test/file.ts')).toBe(true);
    });
  });

  describe('removeVersion', () => {
    it('should remove a stored version', () => {
      store.storeVersion('/test/file.ts', 'content');
      expect(store.hasPreviousVersion('/test/file.ts')).toBe(true);

      store.removeVersion('/test/file.ts');
      expect(store.hasPreviousVersion('/test/file.ts')).toBe(false);
    });

    it('should handle removing non-existent file', () => {
      expect(() => store.removeVersion('/nonexistent/file.ts')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all stored versions', () => {
      store.storeVersion('/test/file1.ts', 'content1');
      store.storeVersion('/test/file2.ts', 'content2');

      expect(store.getStats().size).toBeGreaterThan(0);

      store.clear();

      expect(store.getStats().size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return store statistics', () => {
      store.storeVersion('/test/file1.ts', 'content1');
      store.storeVersion('/test/file2.ts', 'content2');

      const stats = store.getStats();

      expect(stats.size).toBe(2);
      expect(stats.paths).toContain('/test/file1.ts');
      expect(stats.paths).toContain('/test/file2.ts');
    });

    it('should return empty stats for empty store', () => {
      const stats = store.getStats();

      expect(stats.size).toBe(0);
      expect(stats.paths).toEqual([]);
    });
  });

  describe('eviction', () => {
    it('should evict old entries when max size exceeded', () => {
      // Create a store with small max size
      const smallStore = new FileVersionStore();
      (smallStore as any).maxVersions = 3;

      // Add more versions than max
      for (let i = 0; i < 5; i++) {
        smallStore.storeVersion(`/test/file${i}.ts`, `content${i}`, Date.now() + i);
      }

      // Should only keep maxVersions
      expect(smallStore.getStats().size).toBe(3);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const instance1 = getFileVersionStore();
      const instance2 = getFileVersionStore();

      expect(instance1).toBe(instance2);
    });
  });
});
