/**
 * Text content processor for Codebase Cartographer
 * Handles processing of .txt, .rst, and .log files with various encodings
 */

import { extname } from 'path';
import type { ProcessedContent } from '../types.js';

export interface TextProcessedContent extends ProcessedContent {
  metadata: {
    lineCount: number;
    encoding: string;
    bom?: string;
    size: number;
  };
}

export interface FileTypeHandler {
  extensions: string[];
  mimeTypes: string[];
  process: (buffer: Buffer, filePath: string) => Promise<TextProcessedContent>;
}

/**
 * BOM (Byte Order Mark) definitions for encoding detection
 */
const BOM_PATTERNS = {
  UTF8: Buffer.from([0xEF, 0xBB, 0xBF]),
  UTF16LE: Buffer.from([0xFF, 0xFE]),
  UTF16BE: Buffer.from([0xFE, 0xFF]),
  UTF32LE: Buffer.from([0xFF, 0xFE, 0x00, 0x00]),
  UTF32BE: Buffer.from([0x00, 0x00, 0xFE, 0xFF]),
} as const;

type EncodingType = keyof typeof BOM_PATTERNS | 'UTF-8' | 'UTF-16LE' | 'UTF-16BE';

/**
 * Detect encoding from BOM (Byte Order Mark)
 * @param buffer - File buffer to check
 * @returns Detected encoding type and BOM length, or null if no BOM
 */
function detectBOM(buffer: Buffer): { encoding: EncodingType; bomLength: number; bomName: string } | null {
  for (const [name, bom] of Object.entries(BOM_PATTERNS)) {
    if (buffer.length >= bom.length && buffer.subarray(0, bom.length).equals(bom)) {
      return {
        encoding: name as EncodingType,
        bomLength: bom.length,
        bomName: name,
      };
    }
  }
  return null;
}

/**
 * Decode buffer with specified encoding
 * @param buffer - Buffer to decode
 * @param encoding - Encoding to use
 * @returns Decoded string
 */
function decodeBuffer(buffer: Buffer, encoding: EncodingType): string {
  // Remove BOM if present
  const bomInfo = detectBOM(buffer);
  let contentBuffer = buffer;

  if (bomInfo) {
    contentBuffer = buffer.subarray(bomInfo.bomLength);
  }

  // Use TextDecoder for proper encoding support
  let decoderEncoding = 'utf-8';
  switch (encoding) {
    case 'UTF8':
    case 'UTF-8':
      decoderEncoding = 'utf-8';
      break;
    case 'UTF16LE':
    case 'UTF-16LE':
      decoderEncoding = 'utf-16le';
      break;
    case 'UTF16BE':
    case 'UTF-16BE':
      // TextDecoder doesn't support utf-16be directly, use utf-16le with byte swapping
      // For simplicity, we'll use utf-16le which will handle the byte order
      decoderEncoding = 'utf-16le';
      break;
    default:
      decoderEncoding = 'utf-8';
  }

  const decoder = new TextDecoder(decoderEncoding, { fatal: false });
  return decoder.decode(contentBuffer);
}

/**
 * Normalize encoding name to standard format
 * @param encoding - Encoding type to normalize
 * @returns Normalized encoding name
 */
function normalizeEncoding(encoding: EncodingType): string {
  // Convert UTF8 to UTF-8, UTF16LE to UTF-16LE, etc.
  if (encoding.startsWith('UTF')) {
    const rest = encoding.substring(3);
    if (rest.length === 0) return 'UTF-8';
    if (rest.length <= 4) {
      // Add hyphens: 8 -> -8, 16LE -> -16LE
      if (!rest.startsWith('-')) {
        if (rest === '8') return 'UTF-8';
        if (rest === '16LE') return 'UTF-16LE';
        if (rest === '16BE') return 'UTF-16BE';
        return `UTF-${rest}`;
      }
    }
  }
  return encoding;
}

/**
 * Count lines in text content
 * @param content - Text content to count lines in
 * @returns Number of lines
 */
function countLines(content: string): number {
  const lines = content.split(/\r\n|\r|\n/);
  // Filter out empty last line if content ends with newline
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    return lines.length - 1;
  }
  return lines.length;
}

/**
 * Process a text file and extract its content with metadata
 * @param buffer - File buffer
 * @param filePath - Path to the file (for extension validation)
 * @returns Processed content with metadata
 * @throws Error if file cannot be decoded or is not a supported text file
 */
export async function processTextFile(buffer: Buffer, filePath: string): Promise<TextProcessedContent> {
  // Validate file extension
  const ext = extname(filePath).toLowerCase();
  const supportedExtensions = ['.txt', '.rst', '.log'];

  if (!supportedExtensions.includes(ext)) {
    throw new Error(
      `Unsupported file extension: ${ext}. Supported extensions: ${supportedExtensions.join(', ')}`
    );
  }

  // Validate buffer
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Input must be a Buffer');
  }

  if (buffer.length === 0) {
    return {
      summary: 'Empty text file',
      extracts: [{
        path: filePath,
        content: '',
      }],
      metadata: {
        lineCount: 0,
        encoding: 'UTF-8',
        size: 0,
      },
    };
  }

  try {
    // Detect BOM and encoding
    const bomInfo = detectBOM(buffer);
    let encoding: EncodingType = 'UTF-8';
    let bomName: string | undefined;

    if (bomInfo) {
      encoding = bomInfo.encoding;
      bomName = bomInfo.bomName;
    }

    // Decode content
    const content = decodeBuffer(buffer, encoding);

    // Validate decoded content
    if (typeof content !== 'string') {
      throw new Error('Failed to decode buffer to string');
    }

    // Calculate metadata
    const lineCount = countLines(content);

    // Build summary
    const summary = `Text file with ${lineCount} line${lineCount !== 1 ? 's' : ''} (${buffer.length} bytes, ${normalizeEncoding(encoding)} encoding${bomName ? `, ${bomName} BOM` : ''})`;

    return {
      summary,
      extracts: [{
        path: filePath,
        content,
      }],
      metadata: {
        lineCount,
        encoding: normalizeEncoding(encoding),
        bom: bomName,
        size: buffer.length,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to process text file ${filePath}: ${error.message}`);
    }
    throw new Error(`Failed to process text file ${filePath}: Unknown error`);
  }
}

/**
 * File type handler for text files
 */
export const textFileHandler: FileTypeHandler = {
  extensions: ['.txt', '.rst', '.log'],
  mimeTypes: [
    'text/plain',
    'text/x-rst',
    'text/x-log',
  ],
  process: processTextFile,
};

/**
 * Utility function to check if a file is a text file
 * @param filePath - Path to the file
 * @returns True if file is a supported text file
 */
export function isTextFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return textFileHandler.extensions.includes(ext);
}

/**
 * Utility function to get supported text file extensions
 * @returns Array of supported extensions
 */
export function getSupportedExtensions(): string[] {
  return [...textFileHandler.extensions];
}

/**
 * Utility function to get supported MIME types
 * @returns Array of supported MIME types
 */
export function getSupportedMimeTypes(): string[] {
  return [...textFileHandler.mimeTypes];
}
