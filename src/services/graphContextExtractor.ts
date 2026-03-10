/**
 * GraphContextExtractor - Analyzes codebase files to extract structural context
 * for accurate LLM graph generation
 *
 * Extracts:
 * - File paths and structure
 * - Import/export relationships
 * - Key symbols (functions, classes, constants)
 * - Layer classification (entry, logic, storage, external)
 */

export interface FileContext {
  path: string;
  type: 'entry' | 'logic' | 'storage' | 'external' | 'config' | 'unknown';
  imports: string[];
  exports: string[];
  symbols: SymbolInfo[];
  layer?: number;  // Architectural layer (1=entry, 2=orchestration, etc.)
  summary?: string;
}

export interface SymbolInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'constant' | 'type' | 'variable';
  line?: number;
  exported: boolean;
}

export interface GraphGenerationContext {
  files: FileContext[];
  importGraph: Map<string, string[]>;  // file -> imported files
  exportGraph: Map<string, string[]>;  // file -> exported symbols
  layers: Map<string, number>;         // file -> layer number
  entryPoints: string[];               // Files that are entry points
  externalDependencies: string[];      // External packages used
}

// Layer classification rules
const LAYER_PATTERNS: Array<{
  pattern: RegExp;
  type: FileContext['type'];
  layer: number;
}> = [
  // Entry points
  { pattern: /\/(main|index|app|server|cli|cmd)\.(ts|tsx|js|go|py)$/, type: 'entry', layer: 1 },
  { pattern: /\/bin\//, type: 'entry', layer: 1 },
  { pattern: /\/cmd\//, type: 'entry', layer: 1 },

  // External/API boundaries
  { pattern: /\/(api|routes|handlers|controllers|endpoints)\//, type: 'external', layer: 2 },
  { pattern: /\/(http|grpc|rest)\//, type: 'external', layer: 2 },

  // Orchestration/Logic
  { pattern: /\/(services|app|core|domain|business)\//, type: 'logic', layer: 3 },
  { pattern: /\/internal\/app\//, type: 'logic', layer: 3 },

  // Storage/Data
  { pattern: /\/(db|database|models|repositories|store|storage|data)\//, type: 'storage', layer: 4 },
  { pattern: /\/(migrations|schemas)\//, type: 'storage', layer: 4 },

  // Config
  { pattern: /\/(config|settings|env)\//, type: 'config', layer: 0 },
  { pattern: /\.(env|yaml|yml|json|toml)$/, type: 'config', layer: 0 },
];

// Patterns for extracting imports/exports
const IMPORT_PATTERNS = {
  typescript: [
    /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /require\(['"]([^'"]+)['"]\)/g,
  ],
  go: [
    /"([^"]+)"/g,  // Go imports are just strings in import blocks
  ],
  python: [
    /from\s+([\w.]+)\s+import/g,
    /import\s+([\w.]+)/g,
  ],
};

const EXPORT_PATTERNS = {
  typescript: [
    /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type)\s+(\w+)/g,
    /export\s+\{([^}]+)\}/g,
  ],
  go: [
    /func\s+\(?([A-Z]\w+)\)?/g,  // Exported functions start with capital
    /type\s+([A-Z]\w+)/g,        // Exported types
  ],
  python: [
    /def\s+(\w+)\s*\(/g,
    /class\s+(\w+)/g,
  ],
};

/**
 * Determine file type and layer from path
 */
function classifyFile(path: string): { type: FileContext['type']; layer: number } {
  for (const { pattern, type, layer } of LAYER_PATTERNS) {
    if (pattern.test(path)) {
      return { type, layer };
    }
  }
  return { type: 'unknown', layer: 3 };  // Default to logic layer
}

/**
 * Get file extension category
 */
function getFileLanguage(path: string): 'typescript' | 'go' | 'python' | 'other' {
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path)) return 'typescript';
  if (/\.go$/.test(path)) return 'go';
  if (/\.py$/.test(path)) return 'python';
  return 'other';
}

/**
 * Extract imports from file content
 */
function extractImports(content: string, language: string): string[] {
  const imports: string[] = [];

  // Go special handling - extract from import blocks
  if (language === 'go') {
    // Match single imports: import "fmt"
    const singleImportRegex = /import\s+"([^"]+)"/g;
    let match;
    while ((match = singleImportRegex.exec(content)) !== null) {
      if (match[1]) imports.push(match[1]);
    }

    // Match import blocks: import ( "fmt" "other" )
    const blockRegex = /import\s*\(([\s\S]*?)\)/g;
    let blockMatch;
    while ((blockMatch = blockRegex.exec(content)) !== null) {
      const blockContent = blockMatch[1];
      const stringRegex = /"([^"]+)"/g;
      let strMatch;
      while ((strMatch = stringRegex.exec(blockContent)) !== null) {
        if (strMatch[1]) imports.push(strMatch[1]);
      }
    }

    return [...new Set(imports)];
  }

  // TypeScript/JavaScript/Python handling
  const patterns = IMPORT_PATTERNS[language as keyof typeof IMPORT_PATTERNS] || [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }
  }

  return [...new Set(imports)];
}

/**
 * Extract exports/symbols from file content
 */
function extractExports(content: string, language: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const patterns = EXPORT_PATTERNS[language as keyof typeof EXPORT_PATTERNS] || [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        // Parse multiple exports from braces
        const names = match[1].split(',').map(s => s.trim().split(' as ').pop()?.trim()).filter(Boolean);
        for (const name of names) {
          if (name) {
            symbols.push({
              name,
              type: pattern.source.includes('func') ? 'function' :
                    pattern.source.includes('class') ? 'class' :
                    pattern.source.includes('interface') ? 'interface' : 'constant',
              exported: true,
            });
          }
        }
      }
    }
  }

  return symbols;
}

/**
 * Resolve relative import to absolute path
 */
function resolveImport(importPath: string, fromFile: string, projectRoot: string): string | null {
  // Skip external packages
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;  // External dependency
  }

  // Resolve relative path
  const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));

  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    const parts = fromDir.split('/');
    const importParts = importPath.split('/');

    for (const part of importParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }

    return parts.join('/');
  }

  return importPath;
}

/**
 * Extract context from a single file
 */
export function extractFileContext(
  path: string,
  content: string
): FileContext {
  const { type, layer } = classifyFile(path);
  const language = getFileLanguage(path);

  const imports = extractImports(content, language);
  const symbols = extractExports(content, language);
  const exports = symbols.filter(s => s.exported).map(s => s.name);

  // Create summary
  const lines = content.split('\n').length;
  const summary = `${type} file (${lines} lines, ${imports.length} imports, ${exports.length} exports)`;

  return {
    path,
    type,
    imports,
    exports,
    symbols,
    layer,
    summary,
  };
}

/**
 * Build full graph generation context from multiple files
 */
export function buildGraphContext(
  files: Array<{ path: string; content: string }>,
  projectRoot: string = '/'
): GraphGenerationContext {
  const fileContexts: FileContext[] = [];
  const importGraph = new Map<string, string[]>();
  const exportGraph = new Map<string, string[]>();
  const layers = new Map<string, number>();
  const entryPoints: string[] = [];
  const externalDeps = new Set<string>();

  // First pass: extract context from each file
  for (const { path, content } of files) {
    const context = extractFileContext(path, content);
    fileContexts.push(context);

    // Build import graph
    const resolvedImports: string[] = [];
    for (const imp of context.imports) {
      const resolved = resolveImport(imp, path, projectRoot);
      if (resolved) {
        resolvedImports.push(resolved);
      } else {
        // External dependency
        externalDeps.add(imp);
      }
    }
    importGraph.set(path, resolvedImports);

    // Build export graph
    exportGraph.set(path, context.exports);

    // Set layer
    if (context.layer !== undefined) {
      layers.set(path, context.layer);
    }

    // Track entry points
    if (context.type === 'entry') {
      entryPoints.push(path);
    }
  }

  return {
    files: fileContexts,
    importGraph,
    exportGraph,
    layers,
    entryPoints,
    externalDependencies: [...externalDeps],
  };
}

/**
 * Format context for LLM prompt
 */
export function formatContextForLLM(context: GraphGenerationContext, maxFiles: number = 20): string {
  // Sort files by importance (entry points first, then by import count)
  const sortedFiles = [...context.files].sort((a, b) => {
    if (a.type === 'entry' && b.type !== 'entry') return -1;
    if (b.type === 'entry' && a.type !== 'entry') return 1;
    return (b.imports?.length || 0) - (a.imports?.length || 0);
  });

  const topFiles = sortedFiles.slice(0, maxFiles);

  const lines: string[] = [
    '# Codebase Context for Graph Generation',
    '',
    '## Entry Points',
    ...context.entryPoints.map(p => `- ${p}`),
    '',
    '## File Structure',
    ...topFiles.map(f =>
      `- ${f.path} [${f.type}, layer ${f.layer}]` +
      (f.exports.length > 0 ? `\n  Exports: ${f.exports.join(', ')}` : '')
    ),
    '',
    '## Import Relationships',
    ...topFiles.slice(0, 10).map(f => {
      const imports = context.importGraph.get(f.path) || [];
      if (imports.length === 0) return null;
      return `- ${f.path} imports:\n  ${imports.join('\n  ')}`;
    }).filter(Boolean),
    '',
    '## External Dependencies',
    ...context.externalDependencies.slice(0, 20).map(d => `- ${d}`),
  ];

  return lines.join('\n');
}

/**
 * Quick analysis for live codebases
 */
export async function analyzeCodebase(
  rootPath: string,
  filePatterns: string[] = ['**/*.{ts,tsx,js,jsx,go,py}']
): Promise<GraphGenerationContext> {
  // This would integrate with the file watcher or a glob library
  // For now, returns empty context - to be implemented with actual file reading
  return {
    files: [],
    importGraph: new Map(),
    exportGraph: new Map(),
    layers: new Map(),
    entryPoints: [],
    externalDependencies: [],
  };
}

export {
  getFileLanguage,
  classifyFile
};
