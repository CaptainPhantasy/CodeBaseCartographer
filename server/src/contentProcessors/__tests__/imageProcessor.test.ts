/**
 * Tests for image processor
 */

import { describe, it, expect } from 'vitest';
import { processImage, isImageFile, getImageMimeType } from '../imageProcessor';

describe('imageProcessor', () => {
  describe('isImageFile', () => {
    it('should return true for supported image formats', () => {
      expect(isImageFile('/path/to/image.png')).toBe(true);
      expect(isImageFile('/path/to/image.jpg')).toBe(true);
      expect(isImageFile('/path/to/image.jpeg')).toBe(true);
      expect(isImageFile('/path/to/image.gif')).toBe(true);
      expect(isImageFile('/path/to/image.webp')).toBe(true);
      expect(isImageFile('/path/to/image.svg')).toBe(true);
      expect(isImageFile('/path/to/image.ico')).toBe(true);
      expect(isImageFile('/path/to/image.bmp')).toBe(true);
    });

    it('should return true for uppercase extensions', () => {
      expect(isImageFile('/path/to/image.PNG')).toBe(true);
      expect(isImageFile('/path/to/image.JPG')).toBe(true);
    });

    it('should return false for non-image files', () => {
      expect(isImageFile('/path/to/document.pdf')).toBe(false);
      expect(isImageFile('/path/to/script.js')).toBe(false);
      expect(isImageFile('/path/to/style.css')).toBe(false);
      expect(isImageFile('/path/to/data.json')).toBe(false);
    });
  });

  describe('getImageMimeType', () => {
    it('should return correct MIME types for image formats', () => {
      expect(getImageMimeType('/path/to/image.png')).toBe('image/png');
      expect(getImageMimeType('/path/to/image.jpg')).toBe('image/jpeg');
      expect(getImageMimeType('/path/to/image.jpeg')).toBe('image/jpeg');
      expect(getImageMimeType('/path/to/image.gif')).toBe('image/gif');
      expect(getImageMimeType('/path/to/image.webp')).toBe('image/webp');
      expect(getImageMimeType('/path/to/image.svg')).toBe('image/svg+xml');
      expect(getImageMimeType('/path/to/image.ico')).toBe('image/x-icon');
      expect(getImageMimeType('/path/to/image.bmp')).toBe('image/bmp');
    });

    it('should return octet-stream for unknown formats', () => {
      expect(getImageMimeType('/path/to/document.xyz')).toBe('application/octet-stream');
    });
  });

  describe('processImage - SVG handling', () => {
    it('should process SVG files as text', async () => {
      const svgContent = '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="red"/></svg>';
      const buffer = Buffer.from(svgContent, 'utf-8');

      const result = await processImage(buffer, '/path/to/image.svg');

      expect(result.metadata.format).toBe('svg');
      expect(result.metadata.width).toBe(100);
      expect(result.metadata.height).toBe(100);
      expect(result.metadata.channels).toBe(4);
      expect(result.metadata.hasAlpha).toBe(true);
      expect(result.text).toBe(svgContent);
      expect(result.base64).toBeDefined();
    });

    it('should extract dimensions from viewBox when width/height not present', async () => {
      const svgContent = '<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="150" fill="blue"/></svg>';
      const buffer = Buffer.from(svgContent, 'utf-8');

      const result = await processImage(buffer, '/path/to/image.svg');

      expect(result.metadata.width).toBe(200);
      expect(result.metadata.height).toBe(150);
    });
  });

  describe('processImage - Error handling', () => {
    it('should throw error for invalid image buffer', async () => {
      const invalidBuffer = Buffer.from('not an image');

      await expect(processImage(invalidBuffer, '/path/to/image.png')).rejects.toThrow();
    });
  });
});
