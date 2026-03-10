/**
 * Tests for graphValidator
 */

import { describe, it, expect } from 'vitest';
import {
  validateGraph,
  isValidGraph,
  formatValidationFeedback
} from './graphValidator';
import type { GraphData } from '../types';

describe('graphValidator', () => {
  describe('validateGraph', () => {
    it('validates correct graph data', () => {
      const data: GraphData = {
        nodes: [
          { id: 'user', label: 'User', type: 'entry', group: 1 },
          { id: 'api', label: 'API', type: 'logic', group: 2 },
        ],
        links: [
          { source: 'user', target: 'api', value: 1 },
        ],
      };

      const result = validateGraph(data, { autoRepair: false });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.nodeCount).toBe(2);
      expect(result.stats.edgeCount).toBe(1);
    });

    it('detects missing nodes array', () => {
      const data = { links: [] } as unknown as GraphData;

      const result = validateGraph(data, { autoRepair: false });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('nodes'))).toBe(true);
    });

    it('detects missing links array', () => {
      const data = { nodes: [] } as unknown as GraphData;

      const result = validateGraph(data, { autoRepair: false });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('links'))).toBe(true);
    });

    it('detects broken links referencing non-existent nodes', () => {
      const data: GraphData = {
        nodes: [
          { id: 'user', label: 'User', type: 'entry', group: 1 },
        ],
        links: [
          { source: 'user', target: 'nonexistent', value: 1 },
        ],
      };

      const result = validateGraph(data, { autoRepair: false });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('non-existent'))).toBe(true);
    });

    it('detects orphan nodes', () => {
      const data: GraphData = {
        nodes: [
          { id: 'user', label: 'User', type: 'entry', group: 1 },
          { id: 'orphan', label: 'Orphan', type: 'logic', group: 2 },
          { id: 'api', label: 'API', type: 'logic', group: 2 },
        ],
        links: [
          { source: 'user', target: 'api', value: 1 },
        ],
      };

      const result = validateGraph(data, { autoRepair: false });

      expect(result.warnings.some(w => w.type === 'orphan')).toBe(true);
      expect(result.stats.orphanCount).toBe(1);
    });

    it('detects cycles', () => {
      const data: GraphData = {
        nodes: [
          { id: 'a', label: 'A', type: 'logic', group: 1 },
          { id: 'b', label: 'B', type: 'logic', group: 1 },
          { id: 'c', label: 'C', type: 'logic', group: 1 },
        ],
        links: [
          { source: 'a', target: 'b', value: 1 },
          { source: 'b', target: 'c', value: 1 },
          { source: 'c', target: 'a', value: 1 },
        ],
      };

      const result = validateGraph(data, { autoRepair: false });

      expect(result.warnings.some(w => w.type === 'cycle')).toBe(true);
      expect(result.stats.cycleCount).toBeGreaterThan(0);
    });

    it('warns about missing filePath on code nodes', () => {
      const data: GraphData = {
        nodes: [
          { id: 'service', label: 'Service', type: 'logic', group: 3 },
        ],
        links: [],
      };

      const result = validateGraph(data, { autoRepair: false });

      expect(result.warnings.some(w => w.type === 'missing_metadata')).toBe(true);
    });
  });

  describe('auto-repair', () => {
    it('adds missing labels', () => {
      const data: GraphData = {
        nodes: [
          { id: 'test', type: 'logic', group: 1 } as any,
        ],
        links: [],
      };

      const result = validateGraph(data, { autoRepair: true });

      expect(result.repaired).toBeDefined();
      expect(result.repaired?.nodes[0].label).toBe('test');
    });

    it('adds missing types (defaults to process, but may infer entry/exit)', () => {
      const data: GraphData = {
        nodes: [
          { id: 'test', label: 'Test', group: 1 } as any,
        ],
        links: [],
      };

      const result = validateGraph(data, { autoRepair: true });

      expect(result.repaired).toBeDefined();
      // With no incoming edges, auto-repair infers this as entry
      expect(result.repaired?.nodes[0].type).toBe('entry');
    });

    it('removes broken links', () => {
      const data: GraphData = {
        nodes: [
          { id: 'user', label: 'User', type: 'entry', group: 1 },
        ],
        links: [
          { source: 'user', target: 'nonexistent', value: 1 },
        ],
      };

      const result = validateGraph(data, { autoRepair: true });

      expect(result.repaired).toBeDefined();
      expect(result.repaired?.links).toHaveLength(0);
    });

    it('normalizes link format', () => {
      const data: GraphData = {
        nodes: [
          { id: 'a', label: 'A', type: 'entry', group: 1 },
          { id: 'b', label: 'B', type: 'logic', group: 2 },
        ],
        links: [
          { source: 'a', target: 'b' } as any,
        ],
      };

      const result = validateGraph(data, { autoRepair: true });

      expect(result.repaired?.links[0].value).toBe(1);
    });

    it('infers entry points from in-degree', () => {
      const data: GraphData = {
        nodes: [
          { id: 'entry', label: 'Entry', type: 'process', group: 1 },
          { id: 'service', label: 'Service', type: 'logic', group: 2 },
        ],
        links: [
          { source: 'entry', target: 'service', value: 1 },
        ],
      };

      const result = validateGraph(data, { autoRepair: true });

      expect(result.repaired?.nodes[0].type).toBe('entry');
    });

    it('infers exit points from out-degree', () => {
      const data: GraphData = {
        nodes: [
          { id: 'service', label: 'Service', type: 'logic', group: 2 },
          { id: 'exit', label: 'Exit', type: 'process', group: 3 },
        ],
        links: [
          { source: 'service', target: 'exit', value: 1 },
        ],
      };

      const result = validateGraph(data, { autoRepair: true });

      expect(result.repaired?.nodes[1].type).toBe('exit');
    });
  });

  describe('isValidGraph', () => {
    it('returns true for valid graphs', () => {
      const data: GraphData = {
        nodes: [{ id: 'a', label: 'A', type: 'entry', group: 1 }],
        links: [],
      };

      expect(isValidGraph(data)).toBe(true);
    });

    it('returns false for invalid graphs', () => {
      const data: GraphData = {
        nodes: [{ id: 'a', label: 'A', type: 'entry', group: 1 }],
        links: [{ source: 'a', target: 'missing', value: 1 }],
      };

      expect(isValidGraph(data)).toBe(false);
    });
  });

  describe('formatValidationFeedback', () => {
    it('formats valid result', () => {
      const data: GraphData = {
        nodes: [{ id: 'a', label: 'A', type: 'entry', group: 1 }],
        links: [],
      };

      const result = validateGraph(data, { autoRepair: false });
      const feedback = formatValidationFeedback(result);

      expect(feedback).toContain('✓ VALID');
      expect(feedback).toContain('Nodes: 1');
    });

    it('formats invalid result with errors', () => {
      const data: GraphData = {
        nodes: [{ id: 'a', label: 'A', type: 'entry', group: 1 }],
        links: [{ source: 'a', target: 'missing', value: 1 }],
      };

      const result = validateGraph(data, { autoRepair: false });
      const feedback = formatValidationFeedback(result);

      expect(feedback).toContain('✗ INVALID');
      expect(feedback).toContain('## Errors');
    });

    it('includes warnings', () => {
      const data: GraphData = {
        nodes: [
          { id: 'a', label: 'A', type: 'logic', group: 1 },
          { id: 'b', label: 'B', type: 'logic', group: 1 },
        ],
        links: [{ source: 'a', target: 'b', value: 1 }],
      };

      const result = validateGraph(data, { autoRepair: false });
      const feedback = formatValidationFeedback(result);

      expect(feedback).toContain('## Warnings');
    });
  });
});
