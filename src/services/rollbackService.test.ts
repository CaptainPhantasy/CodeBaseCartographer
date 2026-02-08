/**
 * rollbackService.test.ts - Tests for rollback service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RollbackService } from './rollbackService';

// Mock fetch
global.fetch = vi.fn();

describe('RollbackService', () => {
  let service: RollbackService;

  beforeEach(() => {
    service = new RollbackService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rollbackChange', () => {
    it('should successfully rollback a change', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ path: '/test/file.ts', message: 'Change rolled back' }),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

      const result = await service.rollbackChange('change-id-123');

      expect(result.success).toBe(true);
      expect(result.filesRestored).toEqual(['/test/file.ts']);
      expect(result.errors).toEqual([]);
    });

    it('should handle rollback failure', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({ error: 'Change not found' }),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

      const result = await service.rollbackChange('invalid-id');

      expect(result.success).toBe(false);
      expect(result.filesRestored).toEqual([]);
      expect(result.errors).toContain('Change not found');
    });
  });

  describe('rollbackBatch', () => {
    it('should rollback multiple changes', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ path: '/test/file.ts', message: 'Change rolled back' }),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      const result = await service.rollbackBatch({
        executionId: 'exec-123',
        changeIds: ['change-1', 'change-2', 'change-3'],
        reason: 'Test rollback',
      });

      expect(result.success).toBe(true);
      expect(result.filesRestored.length).toBe(3);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch rollback', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ path: '/test/file1.ts', message: 'Success' }),
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Not found' }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ path: '/test/file3.ts', message: 'Success' }),
        } as any);

      const result = await service.rollbackBatch({
        executionId: 'exec-123',
        changeIds: ['change-1', 'change-2', 'change-3'],
      });

      expect(result.success).toBe(false);
      expect(result.filesRestored.length).toBe(2);
      expect(result.errors.length).toBe(1);
    });
  });

  describe('validateRollback', () => {
    it('should validate safe rollback', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'change-123',
            path: '/test/file.ts',
            timestamp: 1000,
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ changes: [] }),
        } as any);

      const result = await service.validateRollback('change-123');

      expect(result.valid).toBe(true);
      expect(result.conflicts).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should detect conflicts with newer changes', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'change-123',
            path: '/test/file.ts',
            timestamp: 1000,
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            changes: [
              { path: '/test/file.ts', timestamp: 2000 },
              { path: '/test/file.ts', timestamp: 3000 },
            ],
          }),
        } as any);

      const result = await service.validateRollback('change-123');

      expect(result.valid).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0]).toContain('2 newer change');
    });
  });

  describe('getAllChanges', () => {
    it('should fetch all changes', async () => {
      const mockChanges = [
        { id: 'change-1', path: '/file1.ts', timestamp: 1000 },
        { id: 'change-2', path: '/file2.ts', timestamp: 2000 },
      ];

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: mockChanges, count: 2 }),
      } as any);

      const changes = await service.getAllChanges();

      expect(changes).toEqual(mockChanges);
    });

    it('should fetch changes with filters', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: [], count: 0 }),
      } as any);

      await service.getAllChanges({ limit: 10, offset: 5, path: '/test' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10&offset=5&path=%2Ftest')
      );
    });
  });

  describe('getChangesForFile', () => {
    it('should fetch changes for specific file', async () => {
      const mockChanges = [
        { id: 'change-1', path: '/test/file.ts', timestamp: 1000 },
      ];

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ changes: mockChanges, count: 1 }),
      } as any);

      const changes = await service.getChangesForFile('/test/file.ts');

      expect(changes).toEqual(mockChanges);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('path=%2Ftest%2Ffile.ts')
      );
    });
  });
});
