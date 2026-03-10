/**
 * Image metadata processor for Codebase Cartographer
 * Extracts metadata and generates base64 representations for vision-capable LLMs
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { extname } from 'path';
import type { ProcessedContent } from '../types.js';

/**
 * Processed content interface for images
 */
export interface ProcessedImageContent extends ProcessedContent {
  metadata: ImageMetadata;
  base64?: string;
  text?: string;
}

/**
 * Image metadata extracted by sharp
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  channels: number;
  hasAlpha: boolean;
  space: string;
}

/**
 * Supported image formats
 */
const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp'];

/**
 * Check if a file is a supported image format
 */
export function isImageFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return SUPPORTED_FORMATS.includes(ext);
}

/**
 * Process an image file and extract metadata
 *
 * For SVG files, treats them as text and returns the SVG content.
 * For other image formats, uses sharp to extract metadata and generate base64.
 *
 * @param buffer - The file content as a Buffer
 * @param filePath - The absolute path to the image file
 * @returns ProcessedContent with metadata and base64 representation
 *
 * @example
 * ```typescript
 * const buffer = readFileSync('/path/to/image.png');
 * const result = await processImage(buffer, '/path/to/image.png');
 * console.log(result.metadata); // { width: 1920, height: 1080, format: 'png', ... }
 * console.log(result.base64); // 'iVBORw0KGgoAAAANS...'
 * ```
 */
export async function processImage(buffer: Buffer, filePath: string): Promise<ProcessedImageContent> {
  const ext = extname(filePath).toLowerCase();

  // Special handling for SVG files - treat as text
  if (ext === '.svg') {
    return processSvg(buffer, filePath);
  }

  // Process binary image formats with sharp
  return processBinaryImage(buffer, filePath);
}

/**
 * Process SVG files as text
 * SVG files are XML-based and should be treated as text rather than binary images
 */
function processSvg(buffer: Buffer, filePath: string): ProcessedImageContent {
  try {
    const svgContent = buffer.toString('utf-8');

    // Extract basic SVG info from the content
    const widthMatch = svgContent.match(/width=["']([^"']+)["']/);
    const heightMatch = svgContent.match(/height=["']([^"']+)["']/);
    const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/);

    let width = 0;
    let height = 0;

    if (viewBoxMatch) {
      const [, , vbWidth, vbHeight] = viewBoxMatch[1].split(/\s+/);
      width = parseFloat(vbWidth) || 0;
      height = parseFloat(vbHeight) || 0;
    } else {
      width = widthMatch ? parseFloat(widthMatch[1]) || 0 : 0;
      height = heightMatch ? parseFloat(heightMatch[1]) || 0 : 0;
    }

    const metadata: ImageMetadata = {
      width,
      height,
      format: 'svg',
      channels: 4, // SVG supports alpha
      hasAlpha: true,
      space: 'srgb'
    };

    const summary = `SVG image (${width}x${height})`;

    return {
      summary,
      extracts: [{
        path: filePath,
        content: svgContent,
      }],
      metadata,
      text: svgContent,
      base64: buffer.toString('base64')
    };
  } catch (error) {
    throw new Error(`Failed to process SVG file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process binary image formats using sharp
 */
async function processBinaryImage(buffer: Buffer, filePath: string): Promise<ProcessedImageContent> {
  try {
    const metadata = await sharp(buffer).metadata();

    if (!metadata.width || !metadata.height || !metadata.format) {
      throw new Error('Could not extract essential metadata from image');
    }

    const imageMetadata: ImageMetadata = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      channels: metadata.channels || 3,
      hasAlpha: metadata.hasAlpha || false,
      space: metadata.space || 'srgb'
    };

    // Generate base64 representation for vision-capable LLMs
    // Convert to PNG format for consistency
    const pngBuffer = await sharp(buffer)
      .png()
      .toBuffer();

    const base64 = pngBuffer.toString('base64');

    const summary = `${imageMetadata.format.toUpperCase()} image (${imageMetadata.width}x${imageMetadata.height}, ${imageMetadata.channels} channel${imageMetadata.channels !== 1 ? 's' : ''}${imageMetadata.hasAlpha ? ', with alpha' : ''})`;

    return {
      summary,
      extracts: [{
        path: filePath,
        content: `[Binary ${imageMetadata.format.toUpperCase()} image - ${buffer.length} bytes]`,
      }],
      metadata: imageMetadata,
      base64
    };
  } catch (error) {
    throw new Error(`Failed to process image file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the MIME type for an image file based on its extension
 *
 * @param filePath - The absolute path to the image file
 * @returns The MIME type string (e.g., 'image/png')
 */
export function getImageMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp'
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Get a data URL for an image file
 * Useful for embedding images in HTML or vision API requests
 *
 * @param buffer - The file content as a Buffer
 * @param filePath - The absolute path to the image file
 * @returns Data URL string (e.g., 'data:image/png;base64,...')
 */
export async function getImageDataUrl(buffer: Buffer, filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();

  // Special handling for SVG
  if (ext === '.svg') {
    const svgContent = buffer.toString('utf-8');
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
  }

  // Convert to PNG for consistency and get base64
  const pngBuffer = await sharp(buffer).png().toBuffer();
  const base64 = pngBuffer.toString('base64');

  return `data:image/png;base64,${base64}`;
}
