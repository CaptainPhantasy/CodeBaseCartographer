/**
 * Content processors index
 * Exports all content processors for easy importing
 * Provides a unified registry and routing mechanism for file processing
 */

import { extname } from 'path';
import type { ProcessedContent } from '../types.js';

// Re-export text processor
export {
  processTextFile,
  isTextFile,
  getSupportedExtensions as getTextSupportedExtensions,
  getSupportedMimeTypes as getTextSupportedMimeTypes,
  textFileHandler,
} from './textProcessor.js';

export type {
  TextProcessedContent,
  FileTypeHandler,
} from './textProcessor.js';

// Re-export config processor
export {
  processYaml,
  processToml,
  processIni,
  processEnv,
  processConfigFile,
} from './configProcessor.js';

// Re-export image processor
export {
  processImage,
  isImageFile,
  getImageMimeType,
  getImageDataUrl,
} from './imageProcessor.js';

export type {
  ProcessedImageContent,
  ImageMetadata,
} from './imageProcessor.js';

// Re-export PDF processor
export {
  processPdf,
} from './pdfProcessor.js';

// Re-export code processor
export {
  processCodeFile,
  isCodeFile,
  getSupportedExtensions as getCodeSupportedExtensions,
  extractImports,
} from './codeProcessor.js';

export type {
  ComplexityMetrics,
  CodeSymbol,
  CodeProcessedContent,
} from './codeProcessor.js';

/**
 * Processor registry that routes files to appropriate processors based on extension
 */
export class ProcessorRegistry {
  private static extensionMap: Map<string, string> = new Map([
    // Text files
    ['.txt', 'text'],
    ['.rst', 'text'],
    ['.log', 'text'],

    // Config files
    ['.yaml', 'config'],
    ['.yml', 'config'],
    ['.toml', 'config'],
    ['.ini', 'config'],
    ['.env', 'config'],

    // Code files
    ['.py', 'code'],
    ['.java', 'code'],
    ['.go', 'code'],
    ['.rs', 'code'],
    ['.php', 'code'],
    ['.rb', 'code'],
    ['.c', 'code'],
    ['.cpp', 'code'],
    ['.cc', 'code'],
    ['.cxx', 'code'],
    ['.h', 'code'],
    ['.hpp', 'code'],
    ['.cs', 'code'],
    ['.swift', 'code'],
    ['.kt', 'code'],
    ['.kts', 'code'],
    ['.ts', 'code'],
    ['.tsx', 'code'],
    ['.js', 'code'],
    ['.jsx', 'code'],
    ['.mjs', 'code'],
    ['.cjs', 'code'],

    // Image files
    ['.png', 'image'],
    ['.jpg', 'image'],
    ['.jpeg', 'image'],
    ['.gif', 'image'],
    ['.webp', 'image'],
    ['.svg', 'image'],
    ['.ico', 'image'],
    ['.bmp', 'image'],

    // PDF files
    ['.pdf', 'pdf'],
  ]);

  /**
   * Get the processor type for a given file extension
   * @param extension - File extension (with or without leading dot)
   * @returns Processor type or null if not supported
   */
  static getProcessorType(extension: string): string | null {
    const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    return this.extensionMap.get(ext) || null;
  }

  /**
   * Check if a file extension is supported
   * @param filePath - File path to check
   * @returns True if file type is supported
   */
  static isSupported(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    return this.extensionMap.has(ext);
  }

  /**
   * Get all supported extensions
   * @returns Array of supported extensions
   */
  static getSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }

  /**
   * Get a processor function for a given file extension
   * @param extension - File extension (with or without leading dot)
   * @returns Processing function or null if not supported
   */
  static getProcessor(extension: string): ((buffer: Buffer, filePath: string) => Promise<ProcessedContent>) | null {
    const type = this.getProcessorType(extension);

    switch (type) {
      case 'text':
        return async (buffer: Buffer, filePath: string) => {
          const { processTextFile } = await import('./textProcessor.js');
          return processTextFile(buffer, filePath);
        };

      case 'config':
        return async (buffer: Buffer, filePath: string) => {
          const { processConfigFile } = await import('./configProcessor.js');
          const content = buffer.toString('utf-8');
          return processConfigFile(filePath, content);
        };

      case 'code':
        return async (buffer: Buffer, filePath: string) => {
          const { processCodeFile } = await import('./codeProcessor.js');
          const content = buffer.toString('utf-8');
          return processCodeFile(content, filePath);
        };

      case 'image':
        return async (buffer: Buffer, filePath: string) => {
          const { processImage } = await import('./imageProcessor.js');
          return processImage(buffer, filePath);
        };

      case 'pdf':
        return async (buffer: Buffer, filePath: string) => {
          const { processPdf } = await import('./pdfProcessor.js');
          return processPdf(buffer, filePath);
        };

      default:
        return null;
    }
  }
}

/**
 * Main entry point for processing files
 * Automatically routes to the appropriate processor based on file extension
 *
 * @param filePath - Path to the file to process
 * @param buffer - File content as a Buffer
 * @returns ProcessedContent with extracted information
 * @throws Error if file type is not supported or processing fails
 *
 * @example
 * ```typescript
 * import { readFile } from 'fs/promises';
 * import { processFile } from './contentProcessors/index.js';
 *
 * const buffer = await readFile('/path/to/file.txt');
 * const result = await processFile('/path/to/file.txt', buffer);
 * console.log(result.summary);
 * ```
 */
export async function processFile(filePath: string, buffer: Buffer): Promise<ProcessedContent> {
  const ext = extname(filePath).toLowerCase();

  // Check if file type is supported
  if (!ProcessorRegistry.isSupported(filePath)) {
    throw new Error(
      `Unsupported file extension: ${ext}. ` +
      `Supported extensions: ${ProcessorRegistry.getSupportedExtensions().join(', ')}`
    );
  }

  // Get the appropriate processor
  const processor = ProcessorRegistry.getProcessor(ext);

  if (!processor) {
    throw new Error(`No processor found for extension: ${ext}`);
  }

  // Process the file
  try {
    return await processor(buffer, filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to process file ${filePath}: ${message}`);
  }
}

/**
 * Type guard to check if content is from text processor
 */
export function isTextProcessedContent(content: ProcessedContent): boolean {
  return 'content' in content && 'metadata' in content && typeof content.content === 'string';
}

/**
 * Type guard to check if content is from image processor
 */
export function isImageProcessedContent(content: ProcessedContent): boolean {
  return 'metadata' in content && content.metadata !== undefined && 'width' in content.metadata;
}

/**
 * Type guard to check if content has summary
 */
export function hasSummary(content: ProcessedContent): boolean {
  return 'summary' in content && typeof content.summary === 'string';
}

/**
 * Type guard to check if content has extracts
 */
export function hasExtracts(content: ProcessedContent): boolean {
  return 'extracts' in content && Array.isArray(content.extracts);
}

/**
 * Type guard to check if content has symbols
 */
export function hasSymbols(content: ProcessedContent): boolean {
  return 'symbols' in content && Array.isArray(content.symbols);
}

/**
 * Type guard to check if content is from code processor
 */
export function isCodeProcessedContent(content: ProcessedContent): boolean {
  return 'metadata' in content &&
         content.metadata !== undefined &&
         'imports' in content.metadata &&
         'complexityMetrics' in content.metadata;
}
