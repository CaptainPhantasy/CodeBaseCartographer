/**
 * Codebase analyzer for CLI and API
 * Analyzes directory structure and builds dependency graphs
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, relative, extname } from 'path';
import { existsSync } from 'fs';
import { getFileTypeHandler, DEFAULT_REGISTRY, type FileTypeCategory } from './fileTypeRegistry.js';
import { processFile } from './contentProcessors/index.js';

export interface AnalysisOptions {
  maxDepth: number;
  ignorePatterns: string[];
  includeComplexity: boolean;
  includeHidden?: boolean;
}

export interface ComplexityMetrics {
  cyclomatic: number;
  linesOfCode: number;
  maintainabilityIndex: number;
}

export interface GraphNode {
  id: string;
  type: 'entry' | 'logic' | 'storage' | 'exit' | 'external' | 'decision' | 'process' | 'infrastructure' | 'documentation' | 'image' | 'config' | 'style' | 'web';
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    type: string;
    color?: string;
    complexity?: ComplexityMetrics;
    depth?: number;
    path?: string;
  };
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  metadata?: {
    analyzedPath: string;
    timestamp: number;
    fileCount: number;
    totalComplexity: number;
  };
}

/**
 * Analyze a codebase and generate graph data
 */
export async function analyzeCodebase(
  rootPath: string,
  options: AnalysisOptions
): Promise<GraphData> {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeMap = new Map<string, GraphNode>();
  let nodeCount = 0;

  // Collect all files
  const files = await collectFiles(rootPath, options.ignorePatterns, [], options.includeHidden);

  // Calculate node positions in a layered layout
  const layers = organizeByDepth(files, rootPath, options.maxDepth);

  // Create nodes for each file
  for (const [depth, filesAtDepth] of Object.entries(layers)) {
    const depthNum = parseInt(depth);
    for (const file of filesAtDepth) {
      const relPath = relative(rootPath, file);
      const ext = extname(file);
      const nodeId = `node-${nodeCount++}`;

      let nodeType: GraphNode['type'] = 'process';
      let color = '#3b82f6';

      // Determine node type and color based on file type from registry
      const handler = getFileTypeHandler(ext);
      if (handler) {
        nodeType = mapCategoryToNodeType(handler.category);
        color = getColorForCategory(handler.category);
      }

      const node: GraphNode = {
        id: nodeId,
        type: nodeType,
        position: {
          x: (nodeCount % 5) * 250 + 100,
          y: depthNum * 200 + 50
        },
        data: {
          label: relPath,
          description: getFileDescription(file),
          type: nodeType,
          color,
          path: file
        }
      };

      // Add complexity metrics if requested
      if (options.includeComplexity) {
        const complexity = await calculateComplexity(file);
        node.data.complexity = complexity;
      }

      nodes.push(node);
      nodeMap.set(relPath, node);
    }
  }

  // Create links based on imports
  for (const file of files) {
    const relPath = relative(rootPath, file);
    const sourceNode = nodeMap.get(relPath);

    if (!sourceNode) continue;

    // Check if file is binary before attempting to read
    const ext = extname(file);
    const handler = getFileTypeHandler(ext);

    // Skip binary files for import extraction
    if (handler?.binary) continue;

    // Only process code files for import extraction
    if (handler?.category !== 'code') continue;

    try {
      const content = await readFile(file, 'utf-8');
      const imports = extractImports(content, ext);

      for (const imp of imports) {
        // Try to find the imported file
        const targetNode = findImportTarget(imp, relPath, nodeMap);
        if (targetNode && targetNode.id !== sourceNode.id) {
          links.push({
            id: `link-${sourceNode.id}-${targetNode.id}`,
            source: sourceNode.id,
            target: targetNode.id,
            animated: true
          });
        }
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }

  // Calculate metadata
  const totalComplexity = options.includeComplexity
    ? nodes.reduce((sum, n) => sum + (n.data.complexity?.cyclomatic || 0), 0)
    : 0;

  return {
    nodes,
    links,
    metadata: {
      analyzedPath: rootPath,
      timestamp: Date.now(),
      fileCount: nodes.length,
      totalComplexity
    }
  };
}

/**
 * Collect all files in a directory recursively
 */
async function collectFiles(
  dirPath: string,
  ignorePatterns: string[],
  files: string[] = [],
  includeHidden: boolean = false
): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    // Always exclude .git directory for security/privacy
    if (entry.name === '.git') continue;

    // Skip hidden files unless explicitly included
    if (!includeHidden && entry.name.startsWith('.')) continue;

    if (ignorePatterns.includes(entry.name)) continue;

    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(fullPath, ignorePatterns, files, includeHidden);
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      const handler = getFileTypeHandler(ext);

      // Include file if it has a registered handler
      if (handler) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Organize files by depth from root
 */
function organizeByDepth(files: string[], rootPath: string, maxDepth: number): Record<number, string[]> {
  const layers: Record<number, string[]> = {};

  for (const file of files) {
    const relPath = relative(rootPath, file);
    const depth = relPath.split('/').length - 1;

    if (depth <= maxDepth) {
      if (!layers[depth]) {
        layers[depth] = [];
      }
      layers[depth].push(file);
    }
  }

  return layers;
}

/**
 * Extract import statements from code
 */
function extractImports(content: string, ext: string): string[] {
  const imports: string[] = [];

  if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
    // ES6 imports
    const es6ImportRegex = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = es6ImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // CommonJS requires
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}

/**
 * Find target node for an import
 */
function findImportTarget(
  importPath: string,
  sourceFile: string,
  nodeMap: Map<string, GraphNode>
): GraphNode | null {
  // Handle relative imports
  if (importPath.startsWith('.')) {
    const sourceDir = sourceFile.split('/').slice(0, -1).join('/');
    const resolved = join(sourceDir, importPath);

    // Try with common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.js'];
    for (const ext of extensions) {
      const withExt = nodeMap.get(resolved + ext);
      if (withExt) return withExt;

      const withoutExt = nodeMap.get(resolved);
      if (withoutExt) return withoutExt;
    }
  }

  // Handle package imports
  const pkgName = importPath.split('/')[0];
  for (const [path, node] of nodeMap) {
    if (path.startsWith(pkgName)) {
      return node;
    }
  }

  return null;
}

/**
 * Get a description for a file based on its type
 */
function getFileDescription(filePath: string): string {
  const ext = extname(filePath);
  const name = filePath.split('/').pop() || '';

  if (name === 'index.ts' || name === 'index.js') {
    return 'Module entry point';
  } else if (name.endsWith('.test.ts') || name.endsWith('.test.js')) {
    return 'Test file';
  } else if (name.endsWith('.service.ts') || name.endsWith('.service.js')) {
    return 'Service module';
  } else if (name.endsWith('.component.tsx') || name.endsWith('.component.ts')) {
    return 'Component';
  } else if (name.endsWith('.hook.ts') || name.endsWith('.hook.js')) {
    return 'Custom hook';
  } else if (name === 'package.json') {
    return 'Package configuration';
  } else if (ext === '.css' || ext === '.scss') {
    return 'Stylesheet';
  } else if (ext === '.md') {
    return 'Documentation';
  }

  return 'Source file';
}

/**
 * Map file type category to graph node type
 */
function mapCategoryToNodeType(category: FileTypeCategory): GraphNode['type'] {
  switch (category) {
    case 'code':
      return 'logic';
    case 'config':
      return 'config';
    case 'documentation':
      return 'documentation';
    case 'image':
      return 'image';
    case 'infrastructure':
      return 'infrastructure';
    case 'style':
      return 'style';
    case 'web':
      return 'web';
    case 'binary':
    default:
      return 'process';
  }
}

/**
 * Get color for a file type category
 */
function getColorForCategory(category: FileTypeCategory): string {
  switch (category) {
    case 'code':
      return '#06b6d4'; // Cyan for TypeScript/JavaScript
    case 'config':
      return '#10b981'; // Green for JSON/YAML
    case 'documentation':
      return '#6b7280'; // Gray for markdown
    case 'image':
      return '#ec4899'; // Pink for images
    case 'infrastructure':
      return '#f59e0b'; // Amber for infrastructure
    case 'style':
      return '#8b5cf6'; // Purple for CSS/SCSS
    case 'web':
      return '#3b82f6'; // Blue for HTML
    case 'binary':
    default:
      return '#9ca3af'; // Gray for binary
  }
}

/**
 * Calculate complexity metrics for a file
 */
async function calculateComplexity(filePath: string): Promise<ComplexityMetrics> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Count non-empty, non-comment lines
    let linesOfCode = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('#')) {
        linesOfCode++;
      }
    }

    // Simple cyclomatic complexity: count decision points
    const decisionPoints = (
      content.match(/\bif\b/g) || []
    ).length + (
      content.match(/\bfor\b/g) || []
    ).length + (
      content.match(/\bwhile\b/g) || []
    ).length + (
      content.match(/\bswitch\b/g) || []
    ).length + (
      content.match(/\bcatch\b/g) || []
    ).length + (
      content.match(/\?\./g) || []
    ).length;

    const cyclomatic = decisionPoints * 2 + 1;

    // Maintainability index (simplified)
    const maintainabilityIndex = Math.max(0, Math.min(100,
      171 - 5.2 * Math.log(linesOfCode) - 0.23 * cyclomatic
    ));

    return {
      cyclomatic,
      linesOfCode,
      maintainabilityIndex: Math.round(maintainabilityIndex)
    };
  } catch (error) {
    return {
      cyclomatic: 1,
      linesOfCode: 0,
      maintainabilityIndex: 100
    };
  }
}
