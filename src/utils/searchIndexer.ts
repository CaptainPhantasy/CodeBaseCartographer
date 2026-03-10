/**
 * Search Indexer - Builds searchable index from graph data
 */

import { GraphData, Node } from '../types';

/**
 * Search result item
 */
export interface SearchResultItem {
  id: string;
  type: 'node' | 'link';
  label: string;
  description?: string;
  nodeId: string;
  score: number;
  matchedFields: string[];
}

/**
 * Search index structure
 */
interface SearchIndex {
  nodes: Map<string, NodeIndexEntry>;
  links: Map<string, LinkIndexEntry>;
  labels: string[];
  allText: string[];
}

interface NodeIndexEntry {
  node: Node;
  labelLower: string;
  type: string;
  allText: string;
}

interface LinkIndexEntry {
  source: string;
  target: string;
  label?: string;
  labelLower?: string;
}

/**
 * SearchIndexer class
 *
 * Builds and maintains a searchable index over graph data
 * for instant search results with highlighting
 */
export class SearchIndexer {
  private index: SearchIndex;

  constructor() {
    this.index = {
      nodes: new Map(),
      links: new Map(),
      labels: [],
      allText: []
    };
  }

  /**
   * Build search index from graph data
   */
  buildIndex(data: GraphData): void {
    // Clear existing index
    this.index = {
      nodes: new Map(),
      links: new Map(),
      labels: [],
      allText: []
    };

    // Index nodes
    data.nodes.forEach((node) => {
      const labelLower = node.label.toLowerCase();
      const allText = `${node.label} ${node.type}`.toLowerCase();

      const entry: NodeIndexEntry = {
        node,
        labelLower,
        type: node.type,
        allText
      };

      this.index.nodes.set(node.id, entry);
      this.index.labels.push(node.label);
      this.index.allText.push(allText);
    });

    // Index links
    data.links.forEach((link, idx) => {
      const entry: LinkIndexEntry = {
        source: link.source,
        target: link.target,
        label: link.label,
        labelLower: link.label?.toLowerCase()
      };
      this.index.links.set(`link-${idx}`, entry);

      if (link.label) {
        this.index.labels.push(link.label);
        this.index.allText.push(link.label.toLowerCase());
      }
    });
  }

  /**
   * Search for nodes/links matching query
   * Returns sorted results by relevance score
   */
  search(query: string): SearchResultItem[] {
    if (!query.trim()) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const results: SearchResultItem[] = [];

    // Search nodes
    this.index.nodes.forEach((entry, nodeId) => {
      const score = this.calculateScore(entry, queryLower);
      if (score > 0) {
        const matchedFields = this.getMatchedFields(entry, queryLower);
        results.push({
          id: nodeId,
          type: 'node',
          label: entry.node.label,
          description: `Type: ${entry.node.type}`,
          nodeId,
          score,
          matchedFields
        });
      }
    });

    // Search links (by label)
    this.index.links.forEach((entry, linkId) => {
      if (entry.labelLower) {
        const score = this.calculateLinkScore(entry, queryLower);
        if (score > 0) {
          const sourceNode = this.index.nodes.get(entry.source);
          const targetNode = this.index.nodes.get(entry.target);
          results.push({
            id: linkId,
            type: 'link',
            label: entry.label || '',
            description: `${sourceNode?.node.label || entry.source} → ${targetNode?.node.label || entry.target}`,
            nodeId: entry.source, // For navigation, go to source
            score,
            matchedFields: entry.labelLower.includes(queryLower) ? ['label'] : []
          });
        }
      }
    });

    // Sort by score (descending)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): Node | undefined {
    return this.index.nodes.get(nodeId)?.node;
  }

  /**
   * Get all labels for autocomplete
   */
  getAllLabels(): string[] {
    return this.index.labels;
  }

  /**
   * Calculate relevance score for a node
   * Higher score = better match
   */
  private calculateScore(entry: NodeIndexEntry, query: string): number {
    let score = 0;

    // Exact label match = highest score
    if (entry.labelLower === query) {
      score += 100;
    }
    // Label starts with query = high score
    else if (entry.labelLower.startsWith(query)) {
      score += 50;
    }
    // Label contains query = medium score
    else if (entry.labelLower.includes(query)) {
      score += 25;
    }

    // Type match = bonus
    if (entry.type.toLowerCase().includes(query)) {
      score += 10;
    }

    return score;
  }

  /**
   * Calculate relevance score for a link
   */
  private calculateLinkScore(entry: LinkIndexEntry, query: string): number {
    if (!entry.labelLower) return 0;

    if (entry.labelLower === query) return 80;
    if (entry.labelLower.startsWith(query)) return 40;
    if (entry.labelLower.includes(query)) return 20;

    return 0;
  }

  /**
   * Get list of matched fields for highlighting
   */
  private getMatchedFields(entry: NodeIndexEntry, query: string): string[] {
    const matched: string[] = [];

    if (entry.labelLower.includes(query)) {
      matched.push('label');
    }
    if (entry.type.toLowerCase().includes(query)) {
      matched.push('type');
    }

    return matched;
  }
}

/**
 * Singleton instance for global use
 */
let globalIndexer: SearchIndexer | null = null;

export function getSearchIndexer(): SearchIndexer {
  if (!globalIndexer) {
    globalIndexer = new SearchIndexer();
  }
  return globalIndexer;
}

export function resetSearchIndexer(): void {
  globalIndexer = new SearchIndexer();
}
