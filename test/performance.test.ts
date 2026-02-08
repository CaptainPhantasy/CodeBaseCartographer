/**
 * Performance Tests
 * Tests the implementation with 100+ files to verify no performance issues
 */

import { describe, it, expect, beforeEach } from 'vitest';
import FileVersionStore from '../src/services/fileVersionStore';
import * as Diff from 'diff';

describe('Performance Tests', () => {
  describe('FileVersionStore with 100+ files', () => {
    let store: FileVersionStore;

    beforeEach(() => {
      store = new FileVersionStore();
    });

    it('should handle storing 100+ file versions efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        store.storeVersion(
          `/test/directory${Math.floor(i / 10)}/file${i}.ts`,
          `// File content ${i}\nexport const value${i} = ${i};\n`.repeat(10)
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);
      expect(store.getStats().size).toBe(100);
    });

    it('should handle storing 500+ file versions', () => {
      const startTime = performance.now();

      for (let i = 0; i < 500; i++) {
        store.storeVersion(
          `/test/directory${Math.floor(i / 50)}/file${i}.ts`,
          `// File content ${i}\nexport const value${i} = ${i};\n`
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in under 500ms
      expect(duration).toBeLessThan(500);
      expect(store.getStats().size).toBe(500);
    });

    it('should retrieve file versions quickly', () => {
      // Store 100 files
      for (let i = 0; i < 100; i++) {
        store.storeVersion(`/test/file${i}.ts`, `content ${i}`);
      }

      const startTime = performance.now();

      // Retrieve all files
      for (let i = 0; i < 100; i++) {
        const version = store.getPreviousVersion(`/test/file${i}.ts`);
        expect(version).toBeDefined();
        expect(version?.content).toBe(`content ${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in under 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should handle concurrent updates efficiently', () => {
      const files = Array.from({ length: 100 }, (_, i) => ({
        path: `/test/file${i}.ts`,
        content: `// Version 1\nexport const value = ${i};`
      }));

      // Initial store
      files.forEach(file => {
        store.storeVersion(file.path, file.content);
      });

      const startTime = performance.now();

      // Update all files
      files.forEach(file => {
        store.storeVersion(file.path, `// Version 2\n${file.content}`);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should evict old versions when max size reached', () => {
      // Set a small max size for testing
      (store as any).maxVersions = 50;

      // Store more than max
      for (let i = 0; i < 100; i++) {
        store.storeVersion(`/test/file${i}.ts`, `content ${i}`);
      }

      // Should only keep maxVersions
      expect(store.getStats().size).toBe(50);
    });
  });

  describe('Diff calculation performance', () => {
    const generateLargeFile = (lines: number): string => {
      return Array.from({ length: lines }, (_, i) =>
        `export const function${i} = () => {\n  return ${i};\n};`
      ).join('\n');
    };

    it('should diff small files quickly', () => {
      const oldContent = generateLargeFile(10);
      const newContent = generateLargeFile(10).replace('return 5;', 'return 10;');

      const startTime = performance.now();
      const changes = Diff.diffLines(oldContent, newContent);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete in under 10ms
      expect(duration).toBeLessThan(10);
      expect(changes.length).toBeGreaterThan(0);
    });

    it('should diff medium files efficiently', () => {
      const oldContent = generateLargeFile(100);
      const newContent = oldContent.replace(/return \d+;/g, 'return 42;');

      const startTime = performance.now();
      const changes = Diff.diffLines(oldContent, newContent);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete in under 50ms
      expect(duration).toBeLessThan(50);
      expect(changes.length).toBeGreaterThan(0);
    });

    it('should diff large files within acceptable time', () => {
      const oldContent = generateLargeFile(500);
      const newContent = oldContent + '\n// New line at end';

      const startTime = performance.now();
      const changes = Diff.diffLines(oldContent, newContent);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete in under 200ms
      expect(duration).toBeLessThan(200);
      expect(changes.length).toBeGreaterThan(0);
    });

    it('should handle files with many changes', () => {
      const oldContent = generateLargeFile(100);
      // Modify every line
      const newContent = oldContent.split('\n').map(line =>
        line.replace(/export/, 'export // modified')
      ).join('\n');

      const startTime = performance.now();
      const changes = Diff.diffLines(oldContent, newContent);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Memory management', () => {
    let store: FileVersionStore;

    beforeEach(() => {
      store = new FileVersionStore();
    });

    it('should not leak memory when storing and removing versions', () => {
      (store as any).maxVersions = 100;

      // Store many files
      for (let i = 0; i < 200; i++) {
        store.storeVersion(`/test/file${i}.ts`, `content ${i}`.repeat(100));
      }

      // Should evict to max size
      expect(store.getStats().size).toBe(100);

      // Clear and verify
      store.clear();
      expect(store.getStats().size).toBe(0);
    });

    it('should handle large file content efficiently', () => {
      const largeContent = 'x'.repeat(100_000); // 100KB

      const startTime = performance.now();
      store.storeVersion('/test/large-file.ts', largeContent);
      const version = store.getPreviousVersion('/test/large-file.ts');
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete in under 50ms
      expect(duration).toBeLessThan(50);
      expect(version?.content.length).toBe(100_000);
    });
  });

  describe('Concurrent operations', () => {
    it('should handle multiple file changes simultaneously', async () => {
      const store = new FileVersionStore();
      const promises: Promise<void>[] = [];

      const startTime = performance.now();

      // Simulate 100 concurrent file changes
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            store.storeVersion(`/test/file${i}.ts`, `content ${i}`);
          })
        );
      }

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in under 200ms
      expect(duration).toBeLessThan(200);
      expect(store.getStats().size).toBe(100);
    });
  });
});
