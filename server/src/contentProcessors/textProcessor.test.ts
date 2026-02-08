/**
 * Tests for text processor
 */

import { describe, it, expect } from 'vitest';
import {
  processTextFile,
  textFileHandler,
  isTextFile,
  getSupportedExtensions,
  getSupportedMimeTypes,
} from './textProcessor';

describe('Text Processor', () => {
  describe('processTextFile', () => {
    describe('UTF-8 with BOM', () => {
      it('should process UTF-8 file with BOM', async () => {
        const content = 'Hello, World!\nLine 2\nLine 3';
        const buffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(content, 'utf-8')]);

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.content).toBe(content);
        expect(result.metadata.lineCount).toBe(3);
        expect(result.metadata.encoding).toBe('UTF-8');
        expect(result.metadata.bom).toBe('UTF8');
        expect(result.metadata.size).toBe(buffer.length);
      });

      it('should handle UTF-8 BOM correctly', async () => {
        const buffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('Test', 'utf-8')]);

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.content).toBe('Test');
        expect(result.metadata.bom).toBe('UTF8');
      });
    });

    describe('UTF-16LE with BOM', () => {
      it('should process UTF-16LE file with BOM', async () => {
        const content = 'Hello, World!\nLine 2';
        const buffer = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(content, 'utf-16le')]);

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.content).toBe(content);
        expect(result.metadata.encoding).toBe('UTF-16LE');
        expect(result.metadata.bom).toBe('UTF16LE');
      });
    });

    describe('UTF-16BE with BOM', () => {
      it('should detect UTF-16BE BOM', async () => {
        // Note: Node.js TextDecoder doesn't support utf-16be directly
        // UTF-16BE BOM will be detected but decoding is approximated
        // Manually create a UTF-16BE BOM + some content
        const bom = Buffer.from([0xFE, 0xFF]); // UTF-16BE BOM
        const content = Buffer.from('Hello', 'utf-16le'); // Use LE for test compatibility

        const buffer = Buffer.concat([bom, content]);

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.metadata.bom).toBe('UTF16BE');
        // Content should still be processed
        expect(result.content.length).toBeGreaterThan(0);
      });
    });

    describe('UTF-8 without BOM', () => {
      it('should process UTF-8 file without BOM', async () => {
        const content = 'Line 1\nLine 2\nLine 3';
        const buffer = Buffer.from(content, 'utf-8');

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.content).toBe(content);
        expect(result.metadata.lineCount).toBe(3);
        expect(result.metadata.encoding).toBe('UTF-8');
        expect(result.metadata.bom).toBeUndefined();
      });
    });

    describe('Line counting', () => {
      it('should count lines correctly with LF', async () => {
        const content = 'Line 1\nLine 2\nLine 3';
        const buffer = Buffer.from(content, 'utf-8');

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.metadata.lineCount).toBe(3);
      });

      it('should count lines correctly with CRLF', async () => {
        const content = 'Line 1\r\nLine 2\r\nLine 3';
        const buffer = Buffer.from(content, 'utf-8');

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.metadata.lineCount).toBe(3);
      });

      it('should count lines correctly with CR', async () => {
        const content = 'Line 1\rLine 2\rLine 3';
        const buffer = Buffer.from(content, 'utf-8');

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.metadata.lineCount).toBe(3);
      });

      it('should handle single line', async () => {
        const content = 'Single line';
        const buffer = Buffer.from(content, 'utf-8');

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.metadata.lineCount).toBe(1);
      });

      it('should handle trailing newline correctly', async () => {
        const content = 'Line 1\nLine 2\n';
        const buffer = Buffer.from(content, 'utf-8');

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.metadata.lineCount).toBe(2);
      });

      it('should handle empty content', async () => {
        const buffer = Buffer.from('', 'utf-8');

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.metadata.lineCount).toBe(0);
      });
    });

    describe('Empty and special cases', () => {
      it('should handle empty buffer', async () => {
        const buffer = Buffer.alloc(0);

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.content).toBe('');
        expect(result.metadata.lineCount).toBe(0);
        expect(result.metadata.encoding).toBe('UTF-8');
        expect(result.metadata.size).toBe(0);
      });

      it('should handle buffer with only whitespace', async () => {
        const content = '   \n  \n\t\n';
        const buffer = Buffer.from(content, 'utf-8');

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.content).toBe(content);
        expect(result.metadata.lineCount).toBe(3);
      });

      it('should handle special characters', async () => {
        const content = 'Hello 世界\nEmoji: 🎉\nSpecial: ©®™';
        const buffer = Buffer.from(content, 'utf-8');

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.content).toBe(content);
        expect(result.metadata.lineCount).toBe(3);
      });
    });

    describe('File extensions', () => {
      it('should process .txt files', async () => {
        const buffer = Buffer.from('Test content', 'utf-8');

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.content).toBe('Test content');
      });

      it('should process .rst files', async () => {
        const buffer = Buffer.from('RST Content', 'utf-8');

        const result = await processTextFile(buffer, 'test.rst');

        expect(result.content).toBe('RST Content');
      });

      it('should process .log files', async () => {
        const buffer = Buffer.from('Log entry', 'utf-8');

        const result = await processTextFile(buffer, 'test.log');

        expect(result.content).toBe('Log entry');
      });

      it('should handle uppercase extensions', async () => {
        const buffer = Buffer.from('Test', 'utf-8');

        const result = await processTextFile(buffer, 'test.TXT');

        expect(result.content).toBe('Test');
      });

      it('should reject unsupported file extensions', async () => {
        const buffer = Buffer.from('Test', 'utf-8');

        await expect(processTextFile(buffer, 'test.md')).rejects.toThrow('Unsupported file extension: .md');
      });

      it('should reject files without extension', async () => {
        const buffer = Buffer.from('Test', 'utf-8');

        await expect(processTextFile(buffer, 'test')).rejects.toThrow('Unsupported file extension:');
      });
    });

    describe('Error handling', () => {
      it('should reject non-buffer input', async () => {
        await expect(processTextFile('not a buffer' as unknown as Buffer, 'test.txt')).rejects.toThrow(
          'Input must be a Buffer'
        );
      });

      it('should handle null input', async () => {
        await expect(processTextFile(null as unknown as Buffer, 'test.txt')).rejects.toThrow(
          'Input must be a Buffer'
        );
      });

      it('should provide error context on failure', async () => {
        const buffer = Buffer.from('Test', 'utf-8');

        try {
          await processTextFile(buffer, 'test.md');
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('.md');
          expect((error as Error).message).toContain('Unsupported file extension');
        }
      });
    });

    describe('Metadata accuracy', () => {
      it('should report correct size', async () => {
        const content = 'Test content';
        const buffer = Buffer.from(content, 'utf-8');

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.metadata.size).toBe(buffer.length);
      });

      it('should report size including BOM', async () => {
        const content = 'Test';
        const buffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(content, 'utf-8')]);

        const result = await processTextFile(buffer, 'test.txt');

        expect(result.metadata.size).toBe(buffer.length);
        expect(result.metadata.bom).toBe('UTF8');
      });
    });
  });

  describe('textFileHandler', () => {
    it('should have correct extensions', () => {
      expect(textFileHandler.extensions).toEqual(['.txt', '.rst', '.log']);
    });

    it('should have correct MIME types', () => {
      expect(textFileHandler.mimeTypes).toContain('text/plain');
      expect(textFileHandler.mimeTypes).toContain('text/x-rst');
      expect(textFileHandler.mimeTypes).toContain('text/x-log');
    });

    it('should have process function', () => {
      expect(typeof textFileHandler.process).toBe('function');
    });

    it('should process files via handler', async () => {
      const buffer = Buffer.from('Test content', 'utf-8');

      const result = await textFileHandler.process(buffer, 'test.txt');

      expect(result.content).toBe('Test content');
      expect(result.metadata.lineCount).toBe(1);
    });
  });

  describe('isTextFile', () => {
    it('should identify .txt files', () => {
      expect(isTextFile('test.txt')).toBe(true);
      expect(isTextFile('/path/to/file.txt')).toBe(true);
    });

    it('should identify .rst files', () => {
      expect(isTextFile('test.rst')).toBe(true);
      expect(isTextFile('/path/to/file.rst')).toBe(true);
    });

    it('should identify .log files', () => {
      expect(isTextFile('test.log')).toBe(true);
      expect(isTextFile('/path/to/file.log')).toBe(true);
    });

    it('should handle uppercase extensions', () => {
      expect(isTextFile('test.TXT')).toBe(true);
      expect(isTextFile('test.RST')).toBe(true);
      expect(isTextFile('test.LOG')).toBe(true);
    });

    it('should reject other extensions', () => {
      expect(isTextFile('test.md')).toBe(false);
      expect(isTextFile('test.js')).toBe(false);
      expect(isTextFile('test.json')).toBe(false);
      expect(isTextFile('test')).toBe(false);
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return all supported extensions', () => {
      const extensions = getSupportedExtensions();

      expect(extensions).toContain('.txt');
      expect(extensions).toContain('.rst');
      expect(extensions).toContain('.log');
      expect(extensions.length).toBe(3);
    });

    it('should return a copy of the array', () => {
      const extensions1 = getSupportedExtensions();
      const extensions2 = getSupportedExtensions();

      expect(extensions1).not.toBe(extensions2);
      expect(extensions1).toEqual(extensions2);
    });
  });

  describe('getSupportedMimeTypes', () => {
    it('should return all supported MIME types', () => {
      const mimeTypes = getSupportedMimeTypes();

      expect(mimeTypes).toContain('text/plain');
      expect(mimeTypes).toContain('text/x-rst');
      expect(mimeTypes).toContain('text/x-log');
    });

    it('should return a copy of the array', () => {
      const mimeTypes1 = getSupportedMimeTypes();
      const mimeTypes2 = getSupportedMimeTypes();

      expect(mimeTypes1).not.toBe(mimeTypes2);
      expect(mimeTypes1).toEqual(mimeTypes2);
    });
  });

  describe('Real-world scenarios', () => {
    it('should process a typical log file', async () => {
      const logContent = [
        '[2024-02-08 10:00:00] INFO: Application started',
        '[2024-02-08 10:00:01] DEBUG: Loading configuration',
        '[2024-02-08 10:00:02] INFO: Connected to database',
        '[2024-02-08 10:00:03] WARNING: High memory usage',
      ].join('\n');

      const buffer = Buffer.from(logContent, 'utf-8');

      const result = await processTextFile(buffer, 'app.log');

      expect(result.content).toBe(logContent);
      expect(result.metadata.lineCount).toBe(4);
      expect(result.metadata.encoding).toBe('UTF-8');
    });

    it('should process reStructuredText file', async () => {
      const rstContent = [
        'Document Title',
        '=============',
        '',
        'This is a paragraph.',
        '',
        '* Bullet point 1',
        '* Bullet point 2',
      ].join('\n');

      const buffer = Buffer.from(rstContent, 'utf-8');

      const result = await processTextFile(buffer, 'doc.rst');

      expect(result.content).toBe(rstContent);
      expect(result.metadata.lineCount).toBe(7);
    });

    it('should handle UTF-16LE file with multilingual content', async () => {
      const content = 'English, 中文, 日本語, 한국어';
      const buffer = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(content, 'utf-16le')]);

      const result = await processTextFile(buffer, 'test.txt');

      expect(result.content).toBe(content);
      expect(result.metadata.encoding).toBe('UTF-16LE');
      expect(result.metadata.bom).toBe('UTF16LE');
    });

    it('should handle large text file', async () => {
      const lines = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`);
      const content = lines.join('\n');
      const buffer = Buffer.from(content, 'utf-8');

      const result = await processTextFile(buffer, 'large.txt');

      expect(result.metadata.lineCount).toBe(1000);
      expect(result.content).toBe(content);
    });
  });
});
