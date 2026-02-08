/**
 * File Type Registry for CodeBaseCartographer
 *
 * Provides a centralized registry for file type handling, including categorization,
 * binary detection, and content processing capabilities.
 */

/**
 * Supported file type categories for organization and analysis
 */
export type FileTypeCategory =
  | 'code'
  | 'config'
  | 'documentation'
  | 'image'
  | 'binary'
  | 'infrastructure'
  | 'style'
  | 'web';

/**
 * Handler interface for processing different file types
 */
export interface FileTypeHandler {
  /** File extensions this handler supports (e.g., ['.ts', '.tsx']) */
  extensions: string[];
  /** Category classification for the file type */
  category: FileTypeCategory;
  /** Whether the file is binary (true) or text (false) */
  binary: boolean;
  /** Optional custom content processor for the file type */
  processContent?: (content: Buffer | string, filePath: string) => Promise<ProcessedContent>;
  /** Maximum size in bytes for processing this file type */
  maxSize?: number;
}

/**
 * Result of processing file content
 */
export interface ProcessedContent {
  /** The processed text content */
  text: string;
  /** Optional metadata about the processed content */
  metadata?: Record<string, any>;
  /** Whether the content should be treated as binary */
  binary?: boolean;
}

/**
 * Default registry of file type handlers
 * Entries can be extended or overridden by registering new handlers
 *
 * INFRASTRUCTURE FILES (handled via name matching, not extensions):
 * - Docker: Dockerfile, *.dockerfile, docker-compose*.yml
 * - Version Control: .gitignore, .dockerignore, .npmignore
 * - CI/CD: .gitlab-ci.yml, .github/workflows/*, Jenkinsfile, Jenkinsfile.*
 * - Package Managers: package.json, requirements.txt, Pipfile, pyproject.toml
 * - Build Systems: go.mod, go.sum, Cargo.toml, Cargo.lock, pom.xml
 * - Gradle: build.gradle, settings.gradle
 * - Version Files: .nvmrc, .node-version, .ruby-version, .python-version
 * - Editor Configs: .editorconfig, .eslintrc*, .prettierrc*
 *
 * Infrastructure files are detected by filename patterns and should be handled
 * separately by the file scanner before extension matching.
 */
export const DEFAULT_REGISTRY: FileTypeHandler[] = [
  // ============================================================
  // CODE FILES (for import analysis)
  // ============================================================
  {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    category: 'code',
    binary: false,
  },
  {
    extensions: ['.py', '.pyw'],
    category: 'code',
    binary: false,
  },
  {
    extensions: ['.java'],
    category: 'code',
    binary: false,
  },
  {
    extensions: ['.go'],
    category: 'code',
    binary: false,
  },
  {
    extensions: ['.rs'],
    category: 'code',
    binary: false,
  },
  {
    extensions: ['.php', '.phtml'],
    category: 'code',
    binary: false,
  },
  {
    extensions: ['.rb'],
    category: 'code',
    binary: false,
  },
  {
    extensions: ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp'],
    category: 'code',
    binary: false,
  },
  {
    extensions: ['.cs', '.csx'],
    category: 'code',
    binary: false,
  },
  {
    extensions: ['.swift'],
    category: 'code',
    binary: false,
  },
  {
    extensions: ['.kt', '.kts'],
    category: 'code',
    binary: false,
  },

  // ============================================================
  // CONFIG & DATA FILES
  // ============================================================
  {
    extensions: ['.json'],
    category: 'config',
    binary: false,
  },
  {
    extensions: ['.yaml', '.yml'],
    category: 'config',
    binary: false,
  },
  {
    extensions: ['.xml'],
    category: 'config',
    binary: false,
  },
  {
    extensions: ['.toml'],
    category: 'config',
    binary: false,
  },
  {
    extensions: ['.ini'],
    category: 'config',
    binary: false,
  },
  {
    extensions: ['.env'],
    category: 'config',
    binary: false,
  },
  {
    extensions: ['.csv'],
    category: 'config',
    binary: false,
  },
  {
    extensions: ['.sql'],
    category: 'config',
    binary: false,
  },

  // ============================================================
  // DOCUMENTATION FILES
  // ============================================================
  {
    extensions: ['.md'],
    category: 'documentation',
    binary: false,
  },
  {
    extensions: ['.txt'],
    category: 'documentation',
    binary: false,
  },
  {
    extensions: ['.rst'],
    category: 'documentation',
    binary: false,
  },
  {
    extensions: ['.pdf'],
    category: 'documentation',
    binary: true,
  },

  // ============================================================
  // STYLE & WEB FILES
  // ============================================================
  {
    extensions: ['.css'],
    category: 'style',
    binary: false,
  },
  {
    extensions: ['.scss', '.sass'],
    category: 'style',
    binary: false,
  },
  {
    extensions: ['.html', '.htm'],
    category: 'web',
    binary: false,
  },
  {
    extensions: ['.svg'],
    category: 'style',
    binary: false,
  },

  // ============================================================
  // IMAGE FILES (binary)
  // ============================================================
  {
    extensions: ['.png'],
    category: 'image',
    binary: true,
  },
  {
    extensions: ['.jpg', '.jpeg'],
    category: 'image',
    binary: true,
  },
  {
    extensions: ['.gif'],
    category: 'image',
    binary: true,
  },
  {
    extensions: ['.webp'],
    category: 'image',
    binary: true,
  },
  {
    extensions: ['.ico'],
    category: 'image',
    binary: true,
  },
  {
    extensions: ['.bmp'],
    category: 'image',
    binary: true,
  },

  // ============================================================
  // BINARY FILES (archives, executables, libraries)
  // ============================================================
  {
    extensions: ['.zip', '.tar', '.gz', '.rar', '.7z'],
    category: 'binary',
    binary: true,
  },
  {
    extensions: ['.exe', '.dll', '.so', '.dylib'],
    category: 'binary',
    binary: true,
  },
];

/**
 * Get the file type handler for a given file extension
 *
 * @param extension - The file extension including the dot (e.g., '.ts', '.json')
 * @returns The FileTypeHandler if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const handler = getFileTypeHandler('.ts');
 * if (handler) {
 *   console.log(handler.category); // 'code'
 * }
 * ```
 */
export function getFileTypeHandler(extension: string): FileTypeHandler | undefined {
  return DEFAULT_REGISTRY.find((handler) =>
    handler.extensions.includes(extension.toLowerCase())
  );
}

/**
 * Check if a file extension corresponds to a binary file type
 *
 * @param extension - The file extension including the dot (e.g., '.png', '.zip')
 * @returns true if the file is binary, false if text or unknown
 *
 * @example
 * ```typescript
 * isBinaryFile('.png'); // true
 * isBinaryFile('.ts');  // false
 * ```
 */
export function isBinaryFile(extension: string): boolean {
  const handler = getFileTypeHandler(extension);
  return handler?.binary ?? false;
}

/**
 * Get all registered file extensions
 *
 * @returns An array of all supported file extensions (including dots)
 *
 * @example
 * ```typescript
 * const extensions = getAllExtensions();
 * // ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', ...]
 * ```
 */
export function getAllExtensions(): string[] {
  const extensions = new Set<string>();
  for (const handler of DEFAULT_REGISTRY) {
    for (const ext of handler.extensions) {
      extensions.add(ext.toLowerCase());
    }
  }
  return Array.from(extensions).sort();
}

/**
 * Get all file extensions for a specific category
 *
 * @param category - The file type category to filter by
 * @returns An array of extensions for the given category
 *
 * @example
 * ```typescript
 * const codeExts = getExtensionsByCategory('code');
 * // ['.js', '.jsx', '.ts', '.tsx']
 * ```
 */
export function getExtensionsByCategory(category: FileTypeCategory): string[] {
  const extensions = new Set<string>();
  for (const handler of DEFAULT_REGISTRY) {
    if (handler.category === category) {
      for (const ext of handler.extensions) {
        extensions.add(ext.toLowerCase());
      }
    }
  }
  return Array.from(extensions).sort();
}

/**
 * Get the category for a given file extension
 *
 * @param extension - The file extension including the dot
 * @returns The category if found, undefined otherwise
 *
 * @example
 * ```typescript
 * getCategory('.ts');  // 'code'
 * getCategory('.json'); // 'config'
 * ```
 */
export function getCategory(extension: string): FileTypeCategory | undefined {
  const handler = getFileTypeHandler(extension);
  return handler?.category;
}

/**
 * Backwards compatibility alias for DEFAULT_REGISTRY
 * @deprecated Use DEFAULT_REGISTRY instead
 */
export const defaultFileTypeRegistry = DEFAULT_REGISTRY;
