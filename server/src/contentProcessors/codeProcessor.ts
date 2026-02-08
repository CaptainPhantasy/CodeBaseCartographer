/**
 * Code content processor for Codebase Cartographer
 * Handles processing of code files in multiple languages, extracting imports,
 * complexity metrics, and key symbols for code analysis.
 */

import { ProcessedContent } from '../types.js';
import { extname } from 'path';

/**
 * Language-specific patterns for import extraction
 */
const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  // Python: import x, from x import y, from x import *
  '.py': [
    /^\s*from\s+([a-zA-Z_][\w.]*)\s+import\s+(?:(\*|(?:\w+\s*(?:,\s*\w+)*)))/gm,
    /^\s*import\s+([a-zA-Z_][\w.]*(?:\s*,\s*[a-zA-Z_][\w.]*)*)/gm,
  ],

  // Java: import x.y.Z, import x.y.*, package x.y.z, import static x.y.Z
  '.java': [
    /^\s*import\s+static\s+([a-zA-Z_][\w.]*)/gm,
    /^\s*import\s+([a-zA-Z_][\w.]*)/gm,
    /^\s*package\s+([a-zA-Z_][\w.]*)/gm,
  ],

  // Go: import "x", import . "x", import x "y"
  '.go': [
    /^\s*import\s+(?:"([^"]+)"|_\s+"([^"]+)"|\.?\s*"([^"]+)")/gm,
  ],

  // Rust: use x::y::{z}, use x::y::z, mod x;
  '.rs': [
    /^\s*use\s+([a-zA-Z_][\w:{}\s*,]*)/gm,
    /^\s*(?:pub\s+)?mod\s+([a-zA-Z_]\w*)/gm,
  ],

  // PHP: use X\Y\Z, require 'x.php', include 'x.php'
  '.php': [
    /^\s*use\s+([a-zA-Z_][\w\\]*)/gm,
    /^\s*(?:require_once|require|include_once|include)\s+(?:['"])([^'"]+)(?:['"])/gm,
  ],

  // Ruby: require 'x', require_relative 'x', require 'x/y'
  '.rb': [
    /^\s*require\s+['"]([^'"]+)['"]/gm,
    /^\s*require_relative\s+['"]([^'"]+)['"]/gm,
    /^\s*autoload\s+[:\[]\s*:(\w+)/gm,
  ],

  // C/C++: #include <x>, #include "x"
  '.c': [
    /^\s*#include\s+(?:<([^>]+)>|["']([^"']+)["'])/gm,
  ],
  '.cpp': [
    /^\s*#include\s+(?:<([^>]+)>|["']([^"']+)["'])/gm,
  ],
  '.cc': [
    /^\s*#include\s+(?:<([^>]+)>|["']([^"']+)["'])/gm,
  ],
  '.cxx': [
    /^\s*#include\s+(?:<([^>]+)>|["']([^"']+)["'])/gm,
  ],
  '.h': [
    /^\s*#include\s+(?:<([^>]+)>|["']([^"']+)["'])/gm,
  ],
  '.hpp': [
    /^\s*#include\s+(?:<([^>]+)>|["']([^"']+)["'])/gm,
  ],

  // C#: using X, using X.Y.Z, using static X.Y
  '.cs': [
    /^\s*using\s+(?:static\s+)?([a-zA-Z_][\w.]*)/gm,
  ],

  // Swift: import X, import class X.Y
  '.swift': [
    /^\s*import\s+(?:typealias\s+)?([a-zA-Z_][\w.]*)/gm,
  ],

  // Kotlin: import x.y.Z, import x.y.*
  '.kt': [
    /^\s*import\s+([a-zA-Z_][\w.]*)/gm,
  ],
  '.kts': [
    /^\s*import\s+([a-zA-Z_][\w.]*)/gm,
  ],

  // TypeScript/JavaScript: import x from 'y', import {x} from 'y', require('x')
  '.ts': [
    /^\s*import\s+(?:(?:\w+|\*\s+as\s+\w+|\{[^}]*\})\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
    /^\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
  ],
  '.tsx': [
    /^\s*import\s+(?:(?:\w+|\*\s+as\s+\w+|\{[^}]*\})\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
    /^\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
  ],
  '.js': [
    /^\s*import\s+(?:(?:\w+|\*\s+as\s+\w+|\{[^}]*\})\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
    /^\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
  ],
  '.jsx': [
    /^\s*import\s+(?:(?:\w+|\*\s+as\s+\w+|\{[^}]*\})\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
    /^\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
  ],
  '.mjs': [
    /^\s*import\s+(?:(?:\w+|\*\s+as\s+\w+|\{[^}]*\})\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
  ],
  '.cjs': [
    /^\s*import\s+(?:(?:\w+|\*\s+as\s+\w+|\{[^}]*\})\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
    /^\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
  ],
};

/**
 * Complexity metrics for code analysis
 */
export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  linesOfCode: number;
  commentLines: number;
  blankLines: number;
  functionCount: number;
  classCount: number;
}

/**
 * Symbol information for code navigation
 */
export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'enum' | 'variable' | 'constant' | 'type';
  line?: number;
  path: string;
}

/**
 * Extended ProcessedContent for code files
 */
export interface CodeProcessedContent extends ProcessedContent {
  metadata: {
    imports: string[];
    complexityMetrics: ComplexityMetrics;
    symbols: CodeSymbol[];
    language: string;
  };
}

/**
 * Extract imports from code content based on file extension
 *
 * @param content - The source code content
 * @param extension - The file extension (e.g., '.py', '.ts')
 * @returns Array of imported modules/paths
 */
export function extractImports(content: string, extension: string): string[] {
  const patterns = LANGUAGE_PATTERNS[extension.toLowerCase()];
  if (!patterns) {
    return [];
  }

  const imports = new Set<string>();

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    // Reset regex state
    pattern.lastIndex = 0;

    while ((match = pattern.exec(content)) !== null) {
      // Find the first non-undefined capture group
      for (let i = 1; i < match.length; i++) {
        if (match[i] !== undefined) {
          const importPath = match[i].trim();
          if (importPath) {
            // Handle multiple imports in one statement (e.g., import x, y, z)
            if (importPath.includes(',')) {
              const parts = importPath.split(',').map(s => s.trim());
              parts.forEach(p => imports.add(p));
            } else {
              imports.add(importPath);
            }
          }
          break;
        }
      }
    }
  }

  return Array.from(imports).sort();
}

/**
 * Calculate cyclomatic complexity of code
 *
 * Counts decision points: if, for, while, case, catch, &&, ||, ?:
 *
 * @param content - The source code content
 * @returns Cyclomatic complexity number
 */
function calculateCyclomaticComplexity(content: string): number {
  const complexityPatterns = [
    /\bif\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bswitch\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\belse\s+if\b/g,
    /\?\?/g,  // nullish coalescing
    /\?[^:]+:/g,  // ternary operator (rough pattern)
    /&&/g,
    /\|\|/g,
  ];

  let complexity = 1; // Base complexity

  for (const pattern of complexityPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Count lines of code, comments, and blank lines
 *
 * @param content - The source code content
 * @returns Object with line counts
 */
function countLines(content: string): { code: number; comments: number; blank: number } {
  const lines = content.split(/\r\n|\r|\n/);
  let code = 0;
  let comments = 0;
  let blank = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      blank++;
    } else if (trimmed.startsWith('//') || trimmed.startsWith('#') ||
               trimmed.startsWith('/*') || trimmed.startsWith('*') ||
               trimmed.startsWith(';')) {
      comments++;
    } else {
      code++;
    }
  }

  return { code, comments, blank };
}

/**
 * Extract function and class definitions from code
 *
 * @param content - The source code content
 * @param extension - The file extension
 * @returns Array of symbol information
 */
function extractSymbols(content: string, extension: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const lines = content.split(/\r\n|\r|\n/);

  const symbolPatterns: Record<string, RegExp[]> = {
    '.py': [
      /(?:^|\s)def\s+([a-zA-Z_]\w*)\s*\(/,
      /(?:^|\s)class\s+([a-zA-Z_]\w*)\s*(?:\(|:)/,
    ],
    '.java': [
      /(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?(?:class|interface|enum)\s+([a-zA-Z_]\w*)/,
      /(?:public|private|protected)?\s*(?:static\s+)?(?:synchronized\s+)?(?:final\s+)?\w+\s+([a-zA-Z_]\w*)\s*\(/,
    ],
    '.ts': [
      /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_]\w*)\s*\(/,
      /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*(?:async\s+)?\(/,
      /(?:export\s+)?class\s+([a-zA-Z_]\w*)/,
      /(?:export\s+)?interface\s+([a-zA-Z_]\w*)/,
      /(?:export\s+)?type\s+([a-zA-Z_]\w*)\s*=/,
      /(?:export\s+)?enum\s+([a-zA-Z_]\w*)/,
    ],
    '.tsx': [
      /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_]\w*)\s*\(/,
      /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*(?:async\s+)?\(/,
      /(?:export\s+)?class\s+([a-zA-Z_]\w*)/,
      /(?:export\s+)?interface\s+([a-zA-Z_]\w*)/,
      /(?:export\s+)?type\s+([a-zA-Z_]\w*)\s*=/,
      /(?:export\s+)?enum\s+([a-zA-Z_]\w*)/,
    ],
    '.js': [
      /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_]\w*)\s*\(/,
      /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*(?:async\s+)?\(/,
      /(?:export\s+)?class\s+([a-zA-Z_]\w*)/,
    ],
    '.jsx': [
      /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_]\w*)\s*\(/,
      /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*(?:async\s+)?\(/,
      /(?:export\s+)?class\s+([a-zA-Z_]\w*)/,
    ],
    '.go': [
      /func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?([a-zA-Z_]\w*)\s*\(/,
      /type\s+([a-zA-Z_]\w*)\s+(?:struct|interface)/,
    ],
    '.rs': [
      /fn\s+([a-zA-Z_]\w*)\s*\(/,
      /struct\s+([a-zA-Z_]\w*)/,
      /enum\s+([a-zA-Z_]\w*)/,
      /trait\s+([a-zA-Z_]\w*)/,
    ],
    '.php': [
      /function\s+([a-zA-Z_]\w*)\s*\(/,
      /class\s+([a-zA-Z_]\w*)/,
      /interface\s+([a-zA-Z_]\w*)/,
      /trait\s+([a-zA-Z_]\w*)/,
    ],
    '.rb': [
      /def\s+([a-zA-Z_]\w*)\s*\(/,
      /class\s+([a-zA-Z_]\w*)/,
      /module\s+([a-zA-Z_]\w*)/,
    ],
    '.cs': [
      /(?:public|private|protected|internal)?\s*(?:static\s+)?(?:abstract\s+)?(?:class|interface|struct|enum)\s+([a-zA-Z_]\w*)/,
      /(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?\w+\s+([a-zA-Z_]\w*)\s*\(/,
    ],
    '.swift': [
      /func\s+([a-zA-Z_]\w*)\s*\(/,
      /class\s+([a-zA-Z_]\w*)/,
      /struct\s+([a-zA-Z_]\w*)/,
      /enum\s+([a-zA-Z_]\w*)/,
      /protocol\s+([a-zA-Z_]\w*)/,
    ],
    '.kt': [
      /fun\s+([a-zA-Z_]\w*)\s*\(/,
      /(?:class|interface|object|enum)\s+([a-zA-Z_]\w*)/,
    ],
  };

  const patterns = symbolPatterns[extension.toLowerCase()] || [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        // Determine symbol type based on the pattern
        let type: CodeSymbol['type'] = 'function';
        const lowerLine = line.toLowerCase();

        if (lowerLine.includes('class')) {
          type = 'class';
        } else if (lowerLine.includes('interface') || lowerLine.includes('protocol') || lowerLine.includes('trait')) {
          type = 'interface';
        } else if (lowerLine.includes('enum')) {
          type = 'enum';
        } else if (lowerLine.includes('struct') || lowerLine.includes('type ')) {
          type = 'type';
        }

        symbols.push({
          name: match[1],
          type,
          line: i + 1,
          path: `${match[1]}`,
        });
      }
    }
  }

  return symbols;
}

/**
 * Get language name from file extension
 *
 * @param extension - The file extension
 * @returns Language name
 */
function getLanguageName(extension: string): string {
  const languageMap: Record<string, string> = {
    '.py': 'Python',
    '.java': 'Java',
    '.go': 'Go',
    '.rs': 'Rust',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.c': 'C',
    '.cpp': 'C++',
    '.cc': 'C++',
    '.cxx': 'C++',
    '.h': 'C/C++',
    '.hpp': 'C++',
    '.cs': 'C#',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.kts': 'Kotlin',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.mjs': 'JavaScript',
    '.cjs': 'JavaScript',
  };

  return languageMap[extension.toLowerCase()] || 'Unknown';
}

/**
 * Process a code file and extract imports, complexity metrics, and symbols
 *
 * @param content - The source code content
 * @param filePath - Path to the file
 * @returns ProcessedContent with imports, complexity metrics, and symbols
 * @throws Error if file type is not supported
 */
export async function processCodeFile(content: string, filePath: string): Promise<ProcessedContent> {
  const extension = extname(filePath).toLowerCase();

  // Validate that this is a code file we support
  if (!LANGUAGE_PATTERNS[extension] && !['.py', '.java', '.go', '.rs', '.php', '.rb', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.cs', '.swift', '.kt', '.kts', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
    throw new Error(
      `Unsupported code file extension: ${extension}. Supported extensions: ${Object.keys(LANGUAGE_PATTERNS).join(', ')}`
    );
  }

  try {
    // Extract imports
    const imports = extractImports(content, extension);

    // Calculate complexity metrics
    const cyclomaticComplexity = calculateCyclomaticComplexity(content);
    const lineCounts = countLines(content);
    const symbols = extractSymbols(content, extension);

    const complexityMetrics: ComplexityMetrics = {
      cyclomaticComplexity,
      linesOfCode: lineCounts.code,
      commentLines: lineCounts.comments,
      blankLines: lineCounts.blank,
      functionCount: symbols.filter(s => s.type === 'function').length,
      classCount: symbols.filter(s => s.type === 'class' || s.type === 'interface').length,
    };

    // Build summary
    const summary = `${getLanguageName(extension)} code file with ${complexityMetrics.linesOfCode} lines of code, ${imports.length} imports, ${complexityMetrics.functionCount} functions, and ${complexityMetrics.classCount} classes/interfaces`;

    // Return ProcessedContent
    const result: ProcessedContent = {
      summary,
      extracts: [
        {
          path: filePath,
          content,
        },
      ],
      symbols: symbols.map(s => ({
        name: s.name,
        type: s.type,
        path: s.path,
        line: s.line,
      })),
      metadata: {
        imports,
        complexityMetrics,
        language: getLanguageName(extension),
      },
    };

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to process code file ${filePath}: ${error.message}`);
    }
    throw new Error(`Failed to process code file ${filePath}: Unknown error`);
  }
}

/**
 * Check if a file is a supported code file
 *
 * @param filePath - Path to the file
 * @returns True if file is a supported code file
 */
export function isCodeFile(filePath: string): boolean {
  const extension = extname(filePath).toLowerCase();
  return extension in LANGUAGE_PATTERNS ||
         ['.py', '.java', '.go', '.rs', '.php', '.rb', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.cs', '.swift', '.kt', '.kts'].includes(extension);
}

/**
 * Get all supported code file extensions
 *
 * @returns Array of supported extensions
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(LANGUAGE_PATTERNS);
}
