/**
 * SearchIndexer Tests
 */

import { SearchIndexer, getSearchIndexer, resetSearchIndexer } from './searchIndexer';
import { GraphData } from '../types';

describe('SearchIndexer', () => {
  let indexer: SearchIndexer;
  let mockData: GraphData;

  beforeEach(() => {
    indexer = new SearchIndexer();
    resetSearchIndexer();

    mockData = {
      nodes: [
        { id: '1', group: 1, label: 'UserAuth', type: 'entry' },
        { id: '2', group: 1, label: 'DatabaseService', type: 'storage' },
        { id: '3', group: 1, label: 'APIGateway', type: 'logic' },
        { id: '4', group: 1, label: 'ResponseHandler', type: 'exit' }
      ],
      links: [
        { source: '1', target: '3', value: 1, label: 'authenticates' },
        { source: '3', target: '2', value: 1, label: 'queries' },
        { source: '2', target: '4', value: 1, label: 'returns data' }
      ]
    };
  });

  describe('buildIndex', () => {
    it('builds index from graph data', () => {
      indexer.buildIndex(mockData);

      expect(indexer.getAllLabels()).toContain('UserAuth');
      expect(indexer.getAllLabels()).toContain('DatabaseService');
      expect(indexer.getAllLabels()).toContain('authenticates');
    });

    it('clears existing index when building new one', () => {
      indexer.buildIndex(mockData);
      expect(indexer.getAllLabels().length).toBeGreaterThan(0);

      const emptyData: GraphData = { nodes: [], links: [] };
      indexer.buildIndex(emptyData);

      expect(indexer.getAllLabels()).toHaveLength(0);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      indexer.buildIndex(mockData);
    });

    it('returns empty array for empty query', () => {
      const results = indexer.search('');
      expect(results).toHaveLength(0);
    });

    it('finds exact matches', () => {
      const results = indexer.search('UserAuth');
      expect(results).toHaveLength(1);
      expect(results[0].label).toBe('UserAuth');
      expect(results[0].score).toBeGreaterThan(50);
    });

    it('finds partial matches', () => {
      const results = indexer.search('auth');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.label.includes('auth'))).toBe(true);
    });

    it('searches link labels', () => {
      const results = indexer.search('authenticates');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.label === 'authenticates')).toBe(true);
    });

    it('sorts results by relevance score', () => {
      const results = indexer.search('Service');
      expect(results).toHaveLength(1);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('returns empty array when no matches found', () => {
      const results = indexer.search('NonExistent');
      expect(results).toHaveLength(0);
    });

    it('is case-insensitive', () => {
      const lowerResults = indexer.search('userauth');
      const upperResults = indexer.search('USERAUTH');
      const mixedResults = indexer.search('UsErAuTh');

      expect(lowerResults.length).toBeGreaterThan(0);
      expect(upperResults.length).toBeGreaterThan(0);
      expect(mixedResults.length).toBeGreaterThan(0);
    });
  });

  describe('getNode', () => {
    beforeEach(() => {
      indexer.buildIndex(mockData);
    });

    it('returns node by ID', () => {
      const node = indexer.getNode('1');
      expect(node).toBeDefined();
      expect(node?.label).toBe('UserAuth');
    });

    it('returns undefined for non-existent node', () => {
      const node = indexer.getNode('999');
      expect(node).toBeUndefined();
    });
  });

  describe('getAllLabels', () => {
    beforeEach(() => {
      indexer.buildIndex(mockData);
    });

    it('returns all node and link labels', () => {
      const labels = indexer.getAllLabels();
      expect(labels).toContain('UserAuth');
      expect(labels).toContain('DatabaseService');
      expect(labels).toContain('authenticates');
      expect(labels).toContain('queries');
    });
  });

  describe('Global instance', () => {
    it('returns singleton instance', () => {
      const instance1 = getSearchIndexer();
      const instance2 = getSearchIndexer();

      expect(instance1).toBe(instance2);
    });

    it('can be reset', () => {
      const instance1 = getSearchIndexer();
      resetSearchIndexer();
      const instance2 = getSearchIndexer();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Relevance scoring', () => {
    beforeEach(() => {
      indexer.buildIndex(mockData);
    });

    it('gives highest score to exact label match', () => {
      const results = indexer.search('UserAuth');
      expect(results[0].score).toBe(100);
    });

    it('gives high score to prefix match', () => {
      const results = indexer.search('User');
      expect(results[0].score).toBe(50);
    });

    it('gives medium score to contains match', () => {
      const results = indexer.search('vice');
      expect(results[0].score).toBe(25);
    });

    it('gives bonus for type match', () => {
      const results = indexer.search('storage');
      expect(results.some(r => r.description?.includes('storage'))).toBe(true);
    });
  });
});
