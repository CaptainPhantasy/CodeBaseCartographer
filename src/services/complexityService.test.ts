/**
 * Tests for complexity service
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCyclomaticComplexity,
  calculateLinesOfCode,
  calculateMaintainabilityIndex,
  getComplexityLevel,
  calculateComplexity,
  getComplexityColor,
  calculateProjectComplexity
} from './complexityService';
import type { ComplexityMetrics } from './complexityService';

describe('complexityService', () => {
  describe('calculateCyclomaticComplexity', () => {
    it('should return 1 for simple code with no decision points', () => {
      const code = 'const x = 1;\nconsole.log(x);';
      expect(calculateCyclomaticComplexity(code)).toBe(1);
    });

    it('should count if statements', () => {
      const code = 'if (x) { return 1; }';
      expect(calculateCyclomaticComplexity(code)).toBe(3); // 1 if * 2 + 1
    });

    it('should count for loops', () => {
      const code = 'for (let i = 0; i < 10; i++) { console.log(i); }';
      expect(calculateCyclomaticComplexity(code)).toBe(3); // 1 for * 2 + 1
    });

    it('should count multiple decision points', () => {
      const code = `
        if (x) { return 1; }
        if (y) { return 2; }
        for (let i = 0; i < 10; i++) { console.log(i); }
      `;
      expect(calculateCyclomaticComplexity(code)).toBe(7); // 3 decisions * 2 + 1
    });
  });

  describe('calculateLinesOfCode', () => {
    it('should count non-empty lines', () => {
      const code = 'const x = 1;\nconst y = 2;';
      expect(calculateLinesOfCode(code)).toBe(2);
    });

    it('should ignore single-line comments', () => {
      const code = 'const x = 1;\n// This is a comment\nconst y = 2;';
      expect(calculateLinesOfCode(code)).toBe(2);
    });

    it('should ignore blank lines', () => {
      const code = 'const x = 1;\n\nconst y = 2;';
      expect(calculateLinesOfCode(code)).toBe(2);
    });

    it('should ignore hash comments', () => {
      const code = 'x = 1\n# comment\ny = 2';
      expect(calculateLinesOfCode(code)).toBe(2);
    });
  });

  describe('calculateMaintainabilityIndex', () => {
    it('should return high index for simple code', () => {
      const mi = calculateMaintainabilityIndex(1, 10);
      expect(mi).toBeGreaterThan(80);
    });

    it('should return lower index for complex code', () => {
      const mi = calculateMaintainabilityIndex(50, 1000);
      expect(mi).toBeLessThan(80);
    });

    it('should clamp to 0-100 range', () => {
      expect(calculateMaintainabilityIndex(1000, 10000)).toBeGreaterThanOrEqual(0);
      expect(calculateMaintainabilityIndex(1, 1)).toBeLessThanOrEqual(100);
    });
  });

  describe('getComplexityLevel', () => {
    it('should return "low" for simple code', () => {
      const metrics: ComplexityMetrics = {
        cyclomatic: 3,
        linesOfCode: 10,
        maintainabilityIndex: 90,
        complexity: 'low'
      };
      expect(getComplexityLevel(metrics)).toBe('low');
    });

    it('should return "medium" for moderate complexity', () => {
      const metrics: ComplexityMetrics = {
        cyclomatic: 8,
        linesOfCode: 50,
        maintainabilityIndex: 70,
        complexity: 'medium'
      };
      expect(getComplexityLevel(metrics)).toBe('medium');
    });

    it('should return "high" for complex code', () => {
      const metrics: ComplexityMetrics = {
        cyclomatic: 15,
        linesOfCode: 100,
        maintainabilityIndex: 50,
        complexity: 'high'
      };
      expect(getComplexityLevel(metrics)).toBe('high');
    });

    it('should return "very-high" for very complex code', () => {
      const metrics: ComplexityMetrics = {
        cyclomatic: 25,
        linesOfCode: 200,
        maintainabilityIndex: 20,
        complexity: 'very-high'
      };
      expect(getComplexityLevel(metrics)).toBe('very-high');
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate all metrics for code', () => {
      const code = `
        if (x) {
          return 1;
        } else {
          return 2;
        }
      `;

      const metrics = calculateComplexity(code);

      expect(metrics).toHaveProperty('cyclomatic');
      expect(metrics).toHaveProperty('linesOfCode');
      expect(metrics).toHaveProperty('maintainabilityIndex');
      expect(metrics).toHaveProperty('complexity');

      expect(metrics.cyclomatic).toBeGreaterThan(0);
      expect(metrics.linesOfCode).toBeGreaterThan(0);
      expect(metrics.maintainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(metrics.maintainabilityIndex).toBeLessThanOrEqual(100);
    });
  });

  describe('getComplexityColor', () => {
    it('should return green for low complexity', () => {
      expect(getComplexityColor('low')).toBe('#10b981');
    });

    it('should return blue for medium complexity', () => {
      expect(getComplexityColor('medium')).toBe('#3b82f6');
    });

    it('should return orange for high complexity', () => {
      expect(getComplexityColor('high')).toBe('#f59e0b');
    });

    it('should return red for very-high complexity', () => {
      expect(getComplexityColor('very-high')).toBe('#ef4444');
    });
  });

  describe('calculateProjectComplexity', () => {
    it('should calculate project-wide metrics', () => {
      const files = [
        { path: 'file1.ts', content: 'const x = 1;' },
        { path: 'file2.ts', content: 'if (y) { return 1; }' }
      ];

      const result = calculateProjectComplexity(files);

      expect(result.totalFiles).toBe(2);
      expect(result.averageCyclomatic).toBeGreaterThan(0);
      expect(result.totalLinesOfCode).toBeGreaterThan(0);
      expect(result.averageMaintainability).toBeGreaterThan(0);
      expect(result.distribution).toHaveProperty('low');
      expect(result.distribution).toHaveProperty('medium');
      expect(result.distribution).toHaveProperty('high');
      expect(result.distribution).toHaveProperty('veryHigh');
      expect(result.files).toHaveLength(2);
    });

    it('should handle empty file list', () => {
      const result = calculateProjectComplexity([]);

      expect(result.totalFiles).toBe(0);
      expect(result.averageCyclomatic).toBe(0);
      expect(result.totalLinesOfCode).toBe(0);
    });
  });
});
