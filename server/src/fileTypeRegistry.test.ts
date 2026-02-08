/**
 * Comprehensive tests for file type registry
 */

import { describe, it, expect } from 'vitest';
import {
  getFileTypeHandler,
  isBinaryFile,
  getAllExtensions,
  getExtensionsByCategory,
  getCategory,
  DEFAULT_REGISTRY,
  defaultFileTypeRegistry,
  type FileTypeCategory,
} from './fileTypeRegistry';

describe('fileTypeRegistry', () => {
  describe('getFileTypeHandler', () => {
    describe('code file extensions - JavaScript/TypeScript', () => {
      it('should return correct handler for TypeScript files', () => {
        const handler = getFileTypeHandler('.ts');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.ts');
      });

      it('should return correct handler for TypeScript JSX files', () => {
        const handler = getFileTypeHandler('.tsx');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.tsx');
      });

      it('should return correct handler for JavaScript files', () => {
        const handler = getFileTypeHandler('.js');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.js');
      });

      it('should return correct handler for JavaScript JSX files', () => {
        const handler = getFileTypeHandler('.jsx');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.jsx');
      });
    });

    describe('code file extensions - Python', () => {
      it('should return correct handler for Python files', () => {
        const handler = getFileTypeHandler('.py');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.py');
      });

      it('should return correct handler for Python Windows files', () => {
        const handler = getFileTypeHandler('.pyw');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.pyw');
      });
    });

    describe('code file extensions - Java', () => {
      it('should return correct handler for Java files', () => {
        const handler = getFileTypeHandler('.java');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.java');
      });
    });

    describe('code file extensions - Go', () => {
      it('should return correct handler for Go files', () => {
        const handler = getFileTypeHandler('.go');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.go');
      });
    });

    describe('code file extensions - Rust', () => {
      it('should return correct handler for Rust files', () => {
        const handler = getFileTypeHandler('.rs');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.rs');
      });
    });

    describe('code file extensions - PHP', () => {
      it('should return correct handler for PHP files', () => {
        const handler = getFileTypeHandler('.php');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.php');
      });

      it('should return correct handler for PHP HTML files', () => {
        const handler = getFileTypeHandler('.phtml');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.phtml');
      });
    });

    describe('code file extensions - Ruby', () => {
      it('should return correct handler for Ruby files', () => {
        const handler = getFileTypeHandler('.rb');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.rb');
      });
    });

    describe('code file extensions - C/C++', () => {
      it('should return correct handler for C files', () => {
        const handler = getFileTypeHandler('.c');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.c');
      });

      it('should return correct handler for C++ files', () => {
        const handler = getFileTypeHandler('.cpp');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.cpp');
      });

      it('should return correct handler for C++ alternative extension', () => {
        const handler = getFileTypeHandler('.cc');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.cc');
      });

      it('should return correct handler for C++ another alternative', () => {
        const handler = getFileTypeHandler('.cxx');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.cxx');
      });

      it('should return correct handler for C header files', () => {
        const handler = getFileTypeHandler('.h');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.h');
      });

      it('should return correct handler for C++ header files', () => {
        const handler = getFileTypeHandler('.hpp');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.hpp');
      });
    });

    describe('code file extensions - C#', () => {
      it('should return correct handler for C# files', () => {
        const handler = getFileTypeHandler('.cs');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.cs');
      });

      it('should return correct handler for C# script files', () => {
        const handler = getFileTypeHandler('.csx');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.csx');
      });
    });

    describe('code file extensions - Swift', () => {
      it('should return correct handler for Swift files', () => {
        const handler = getFileTypeHandler('.swift');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.swift');
      });
    });

    describe('code file extensions - Kotlin', () => {
      it('should return correct handler for Kotlin files', () => {
        const handler = getFileTypeHandler('.kt');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.kt');
      });

      it('should return correct handler for Kotlin script files', () => {
        const handler = getFileTypeHandler('.kts');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.kts');
      });
    });

    describe('config file extensions', () => {
      it('should return correct handler for JSON files', () => {
        const handler = getFileTypeHandler('.json');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('config');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.json');
      });

      it('should return correct handler for YAML files', () => {
        const handler = getFileTypeHandler('.yaml');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('config');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.yaml');
      });

      it('should return correct handler for YML files', () => {
        const handler = getFileTypeHandler('.yml');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('config');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.yml');
      });

      it('should return correct handler for XML files', () => {
        const handler = getFileTypeHandler('.xml');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('config');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.xml');
      });

      it('should return correct handler for TOML files', () => {
        const handler = getFileTypeHandler('.toml');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('config');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.toml');
      });

      it('should return correct handler for INI files', () => {
        const handler = getFileTypeHandler('.ini');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('config');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.ini');
      });

      it('should return correct handler for ENV files', () => {
        const handler = getFileTypeHandler('.env');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('config');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.env');
      });

      it('should return correct handler for CSV files', () => {
        const handler = getFileTypeHandler('.csv');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('config');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.csv');
      });

      it('should return correct handler for SQL files', () => {
        const handler = getFileTypeHandler('.sql');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('config');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.sql');
      });
    });

    describe('style file extensions', () => {
      it('should return correct handler for CSS files', () => {
        const handler = getFileTypeHandler('.css');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('style');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.css');
      });

      it('should return correct handler for SCSS files', () => {
        const handler = getFileTypeHandler('.scss');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('style');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.scss');
      });

      it('should return correct handler for SASS files', () => {
        const handler = getFileTypeHandler('.sass');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('style');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.sass');
      });

      it('should return correct handler for SVG files (style category, not binary)', () => {
        const handler = getFileTypeHandler('.svg');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('style');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.svg');
      });
    });

    describe('documentation file extensions', () => {
      it('should return correct handler for Markdown files', () => {
        const handler = getFileTypeHandler('.md');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('documentation');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.md');
      });

      it('should return correct handler for text files', () => {
        const handler = getFileTypeHandler('.txt');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('documentation');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.txt');
      });

      it('should return correct handler for reStructuredText files', () => {
        const handler = getFileTypeHandler('.rst');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('documentation');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.rst');
      });

      it('should return correct handler for PDF files with binary=true', () => {
        const handler = getFileTypeHandler('.pdf');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('documentation');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.pdf');
      });
    });

    describe('web file extensions', () => {
      it('should return correct handler for HTML files', () => {
        const handler = getFileTypeHandler('.html');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('web');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.html');
      });

      it('should return correct handler for HTM files', () => {
        const handler = getFileTypeHandler('.htm');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('web');
        expect(handler?.binary).toBe(false);
        expect(handler?.extensions).toContain('.htm');
      });
    });

    describe('image file extensions (binary=true)', () => {
      it('should return correct handler for PNG files with binary=true', () => {
        const handler = getFileTypeHandler('.png');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('image');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.png');
      });

      it('should return correct handler for JPG files with binary=true', () => {
        const handler = getFileTypeHandler('.jpg');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('image');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.jpg');
      });

      it('should return correct handler for JPEG files with binary=true', () => {
        const handler = getFileTypeHandler('.jpeg');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('image');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.jpeg');
      });

      it('should return correct handler for GIF files with binary=true', () => {
        const handler = getFileTypeHandler('.gif');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('image');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.gif');
      });

      it('should return correct handler for WebP files with binary=true', () => {
        const handler = getFileTypeHandler('.webp');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('image');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.webp');
      });

      it('should return correct handler for ICO files with binary=true', () => {
        const handler = getFileTypeHandler('.ico');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('image');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.ico');
      });

      it('should return correct handler for BMP files with binary=true', () => {
        const handler = getFileTypeHandler('.bmp');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('image');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.bmp');
      });
    });

    describe('binary file extensions (binary=true)', () => {
      it('should return correct handler for ZIP files with binary=true', () => {
        const handler = getFileTypeHandler('.zip');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('binary');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.zip');
      });

      it('should return correct handler for TAR files with binary=true', () => {
        const handler = getFileTypeHandler('.tar');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('binary');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.tar');
      });

      it('should return correct handler for GZ files with binary=true', () => {
        const handler = getFileTypeHandler('.gz');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('binary');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.gz');
      });

      it('should return correct handler for RAR files with binary=true', () => {
        const handler = getFileTypeHandler('.rar');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('binary');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.rar');
      });

      it('should return correct handler for 7Z files with binary=true', () => {
        const handler = getFileTypeHandler('.7z');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('binary');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.7z');
      });

      it('should return correct handler for EXE files with binary=true', () => {
        const handler = getFileTypeHandler('.exe');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('binary');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.exe');
      });

      it('should return correct handler for DLL files with binary=true', () => {
        const handler = getFileTypeHandler('.dll');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('binary');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.dll');
      });

      it('should return correct handler for SO files with binary=true', () => {
        const handler = getFileTypeHandler('.so');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('binary');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.so');
      });

      it('should return correct handler for DYLIB files with binary=true', () => {
        const handler = getFileTypeHandler('.dylib');
        expect(handler).toBeDefined();
        expect(handler?.category).toBe('binary');
        expect(handler?.binary).toBe(true);
        expect(handler?.extensions).toContain('.dylib');
      });
    });

    describe('unknown extensions', () => {
      it('should return undefined for unknown extension', () => {
        const handler = getFileTypeHandler('.unknown');
        expect(handler).toBeUndefined();
      });

      it('should return undefined for empty string', () => {
        const handler = getFileTypeHandler('');
        expect(handler).toBeUndefined();
      });

      it('should return undefined for extension without dot', () => {
        const handler = getFileTypeHandler('typescript');
        expect(handler).toBeUndefined();
      });

      it('should return undefined for partial extensions', () => {
        const handler = getFileTypeHandler('.t');
        expect(handler).toBeUndefined();
      });
    });
  });

  describe('isBinaryFile', () => {
    describe('image files return true', () => {
      it('should return true for PNG files', () => {
        expect(isBinaryFile('.png')).toBe(true);
      });

      it('should return true for JPG files', () => {
        expect(isBinaryFile('.jpg')).toBe(true);
      });

      it('should return true for JPEG files', () => {
        expect(isBinaryFile('.jpeg')).toBe(true);
      });

      it('should return true for GIF files', () => {
        expect(isBinaryFile('.gif')).toBe(true);
      });

      it('should return true for WebP files', () => {
        expect(isBinaryFile('.webp')).toBe(true);
      });

      it('should return true for ICO files', () => {
        expect(isBinaryFile('.ico')).toBe(true);
      });

      it('should return true for BMP files', () => {
        expect(isBinaryFile('.bmp')).toBe(true);
      });
    });

    describe('PDF files return true', () => {
      it('should return true for PDF files', () => {
        expect(isBinaryFile('.pdf')).toBe(true);
      });
    });

    describe('binary files return true', () => {
      it('should return true for ZIP files', () => {
        expect(isBinaryFile('.zip')).toBe(true);
      });

      it('should return true for TAR files', () => {
        expect(isBinaryFile('.tar')).toBe(true);
      });

      it('should return true for GZ files', () => {
        expect(isBinaryFile('.gz')).toBe(true);
      });

      it('should return true for RAR files', () => {
        expect(isBinaryFile('.rar')).toBe(true);
      });

      it('should return true for 7Z files', () => {
        expect(isBinaryFile('.7z')).toBe(true);
      });

      it('should return true for EXE files', () => {
        expect(isBinaryFile('.exe')).toBe(true);
      });

      it('should return true for DLL files', () => {
        expect(isBinaryFile('.dll')).toBe(true);
      });

      it('should return true for SO files', () => {
        expect(isBinaryFile('.so')).toBe(true);
      });

      it('should return true for DYLIB files', () => {
        expect(isBinaryFile('.dylib')).toBe(true);
      });
    });

    describe('code files return false', () => {
      it('should return false for TypeScript files', () => {
        expect(isBinaryFile('.ts')).toBe(false);
      });

      it('should return false for JavaScript files', () => {
        expect(isBinaryFile('.js')).toBe(false);
      });

      it('should return false for Python files', () => {
        expect(isBinaryFile('.py')).toBe(false);
      });

      it('should return false for Java files', () => {
        expect(isBinaryFile('.java')).toBe(false);
      });
    });

    describe('config files return false', () => {
      it('should return false for JSON files', () => {
        expect(isBinaryFile('.json')).toBe(false);
      });

      it('should return false for YAML files', () => {
        expect(isBinaryFile('.yaml')).toBe(false);
      });

      it('should return false for YML files', () => {
        expect(isBinaryFile('.yml')).toBe(false);
      });

      it('should return false for XML files', () => {
        expect(isBinaryFile('.xml')).toBe(false);
      });

      it('should return false for TOML files', () => {
        expect(isBinaryFile('.toml')).toBe(false);
      });

      it('should return false for INI files', () => {
        expect(isBinaryFile('.ini')).toBe(false);
      });

      it('should return false for ENV files', () => {
        expect(isBinaryFile('.env')).toBe(false);
      });
    });

    describe('documentation files return false (except PDF)', () => {
      it('should return false for Markdown files', () => {
        expect(isBinaryFile('.md')).toBe(false);
      });

      it('should return false for text files', () => {
        expect(isBinaryFile('.txt')).toBe(false);
      });

      it('should return false for reStructuredText files', () => {
        expect(isBinaryFile('.rst')).toBe(false);
      });
    });

    describe('web files return false', () => {
      it('should return false for HTML files', () => {
        expect(isBinaryFile('.html')).toBe(false);
      });
    });

    describe('style files return false', () => {
      it('should return false for CSS files', () => {
        expect(isBinaryFile('.css')).toBe(false);
      });

      it('should return false for SCSS files', () => {
        expect(isBinaryFile('.scss')).toBe(false);
      });

      it('should return false for SVG files (not binary in registry)', () => {
        expect(isBinaryFile('.svg')).toBe(false);
      });
    });

    describe('unknown extensions', () => {
      it('should return false for unknown extensions', () => {
        expect(isBinaryFile('.unknown')).toBe(false);
      });

      it('should return false for empty string', () => {
        expect(isBinaryFile('')).toBe(false);
      });
    });
  });

  describe('getAllExtensions', () => {
    it('should return an array with all extensions', () => {
      const extensions = getAllExtensions();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('should return sorted array', () => {
      const extensions = getAllExtensions();
      const sortedExtensions = [...extensions].sort();
      expect(extensions).toEqual(sortedExtensions);
    });

    it('should contain JavaScript/TypeScript extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.jsx');
    });

    it('should contain Python extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.py');
      expect(extensions).toContain('.pyw');
    });

    it('should contain Java extension', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.java');
    });

    it('should contain Go extension', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.go');
    });

    it('should contain Rust extension', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.rs');
    });

    it('should contain PHP extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.php');
      expect(extensions).toContain('.phtml');
    });

    it('should contain Ruby extension', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.rb');
    });

    it('should contain C/C++ extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.c');
      expect(extensions).toContain('.cpp');
      expect(extensions).toContain('.cc');
      expect(extensions).toContain('.cxx');
      expect(extensions).toContain('.h');
      expect(extensions).toContain('.hpp');
    });

    it('should contain C# extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.cs');
      expect(extensions).toContain('.csx');
    });

    it('should contain Swift extension', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.swift');
    });

    it('should contain Kotlin extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.kt');
      expect(extensions).toContain('.kts');
    });

    it('should contain all config file extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.json');
      expect(extensions).toContain('.yaml');
      expect(extensions).toContain('.yml');
      expect(extensions).toContain('.xml');
      expect(extensions).toContain('.toml');
      expect(extensions).toContain('.ini');
      expect(extensions).toContain('.env');
      expect(extensions).toContain('.csv');
      expect(extensions).toContain('.sql');
    });

    it('should contain all style file extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.css');
      expect(extensions).toContain('.scss');
      expect(extensions).toContain('.sass');
      expect(extensions).toContain('.svg');
    });

    it('should contain all documentation file extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.md');
      expect(extensions).toContain('.txt');
      expect(extensions).toContain('.rst');
      expect(extensions).toContain('.pdf');
    });

    it('should contain all web file extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.html');
      expect(extensions).toContain('.htm');
    });

    it('should contain all image file extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.png');
      expect(extensions).toContain('.jpg');
      expect(extensions).toContain('.jpeg');
      expect(extensions).toContain('.gif');
      expect(extensions).toContain('.webp');
      expect(extensions).toContain('.ico');
      expect(extensions).toContain('.bmp');
    });

    it('should contain all binary file extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions).toContain('.zip');
      expect(extensions).toContain('.tar');
      expect(extensions).toContain('.gz');
      expect(extensions).toContain('.rar');
      expect(extensions).toContain('.7z');
      expect(extensions).toContain('.exe');
      expect(extensions).toContain('.dll');
      expect(extensions).toContain('.so');
      expect(extensions).toContain('.dylib');
    });

    it('should have no duplicates', () => {
      const extensions = getAllExtensions();
      const uniqueExtensions = new Set(extensions);
      expect(extensions.length).toBe(uniqueExtensions.size);
    });

    it('should return 58 total extensions', () => {
      const extensions = getAllExtensions();
      expect(extensions.length).toBe(58);
    });

    it('should not include extensions without leading dot', () => {
      const extensions = getAllExtensions();
      extensions.forEach((ext) => {
        expect(ext.startsWith('.')).toBe(true);
      });
    });
  });

  describe('getCategory', () => {
    describe('code category', () => {
      it('should return "code" for TypeScript files', () => {
        expect(getCategory('.ts')).toBe('code');
        expect(getCategory('.tsx')).toBe('code');
      });

      it('should return "code" for JavaScript files', () => {
        expect(getCategory('.js')).toBe('code');
        expect(getCategory('.jsx')).toBe('code');
      });

      it('should return "code" for Python files', () => {
        expect(getCategory('.py')).toBe('code');
        expect(getCategory('.pyw')).toBe('code');
      });

      it('should return "code" for Java files', () => {
        expect(getCategory('.java')).toBe('code');
      });

      it('should return "code" for Go files', () => {
        expect(getCategory('.go')).toBe('code');
      });

      it('should return "code" for Rust files', () => {
        expect(getCategory('.rs')).toBe('code');
      });

      it('should return "code" for PHP files', () => {
        expect(getCategory('.php')).toBe('code');
        expect(getCategory('.phtml')).toBe('code');
      });

      it('should return "code" for Ruby files', () => {
        expect(getCategory('.rb')).toBe('code');
      });

      it('should return "code" for C/C++ files', () => {
        expect(getCategory('.c')).toBe('code');
        expect(getCategory('.cpp')).toBe('code');
        expect(getCategory('.h')).toBe('code');
      });

      it('should return "code" for C# files', () => {
        expect(getCategory('.cs')).toBe('code');
      });

      it('should return "code" for Swift files', () => {
        expect(getCategory('.swift')).toBe('code');
      });

      it('should return "code" for Kotlin files', () => {
        expect(getCategory('.kt')).toBe('code');
      });
    });

    describe('config category', () => {
      it('should return "config" for JSON files', () => {
        expect(getCategory('.json')).toBe('config');
      });

      it('should return "config" for YAML files', () => {
        expect(getCategory('.yaml')).toBe('config');
        expect(getCategory('.yml')).toBe('config');
      });

      it('should return "config" for XML files', () => {
        expect(getCategory('.xml')).toBe('config');
      });

      it('should return "config" for TOML files', () => {
        expect(getCategory('.toml')).toBe('config');
      });

      it('should return "config" for INI files', () => {
        expect(getCategory('.ini')).toBe('config');
      });

      it('should return "config" for ENV files', () => {
        expect(getCategory('.env')).toBe('config');
      });

      it('should return "config" for CSV files', () => {
        expect(getCategory('.csv')).toBe('config');
      });

      it('should return "config" for SQL files', () => {
        expect(getCategory('.sql')).toBe('config');
      });
    });

    describe('style category', () => {
      it('should return "style" for CSS files', () => {
        expect(getCategory('.css')).toBe('style');
      });

      it('should return "style" for SCSS files', () => {
        expect(getCategory('.scss')).toBe('style');
      });

      it('should return "style" for SASS files', () => {
        expect(getCategory('.sass')).toBe('style');
      });

      it('should return "style" for SVG files', () => {
        expect(getCategory('.svg')).toBe('style');
      });
    });

    describe('documentation category', () => {
      it('should return "documentation" for Markdown files', () => {
        expect(getCategory('.md')).toBe('documentation');
      });

      it('should return "documentation" for text files', () => {
        expect(getCategory('.txt')).toBe('documentation');
      });

      it('should return "documentation" for reStructuredText files', () => {
        expect(getCategory('.rst')).toBe('documentation');
      });

      it('should return "documentation" for PDF files', () => {
        expect(getCategory('.pdf')).toBe('documentation');
      });
    });

    describe('web category', () => {
      it('should return "web" for HTML files', () => {
        expect(getCategory('.html')).toBe('web');
      });

      it('should return "web" for HTM files', () => {
        expect(getCategory('.htm')).toBe('web');
      });
    });

    describe('image category', () => {
      it('should return "image" for PNG files', () => {
        expect(getCategory('.png')).toBe('image');
      });

      it('should return "image" for JPG files', () => {
        expect(getCategory('.jpg')).toBe('image');
      });

      it('should return "image" for JPEG files', () => {
        expect(getCategory('.jpeg')).toBe('image');
      });

      it('should return "image" for GIF files', () => {
        expect(getCategory('.gif')).toBe('image');
      });

      it('should return "image" for WebP files', () => {
        expect(getCategory('.webp')).toBe('image');
      });

      it('should return "image" for ICO files', () => {
        expect(getCategory('.ico')).toBe('image');
      });

      it('should return "image" for BMP files', () => {
        expect(getCategory('.bmp')).toBe('image');
      });
    });

    describe('binary category', () => {
      it('should return "binary" for ZIP files', () => {
        expect(getCategory('.zip')).toBe('binary');
      });

      it('should return "binary" for TAR files', () => {
        expect(getCategory('.tar')).toBe('binary');
      });

      it('should return "binary" for GZ files', () => {
        expect(getCategory('.gz')).toBe('binary');
      });

      it('should return "binary" for RAR files', () => {
        expect(getCategory('.rar')).toBe('binary');
      });

      it('should return "binary" for 7Z files', () => {
        expect(getCategory('.7z')).toBe('binary');
      });

      it('should return "binary" for EXE files', () => {
        expect(getCategory('.exe')).toBe('binary');
      });

      it('should return "binary" for DLL files', () => {
        expect(getCategory('.dll')).toBe('binary');
      });

      it('should return "binary" for SO files', () => {
        expect(getCategory('.so')).toBe('binary');
      });

      it('should return "binary" for DYLIB files', () => {
        expect(getCategory('.dylib')).toBe('binary');
      });
    });

    describe('unknown extensions', () => {
      it('should return undefined for unknown extension', () => {
        expect(getCategory('.unknown')).toBeUndefined();
      });

      it('should return undefined for empty string', () => {
        expect(getCategory('')).toBeUndefined();
      });

      it('should return undefined for extension without dot', () => {
        expect(getCategory('typescript')).toBeUndefined();
      });
    });
  });

  describe('getExtensionsByCategory', () => {
    it('should return all code extensions', () => {
      const extensions = getExtensionsByCategory('code');
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.jsx');
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
      expect(extensions).toContain('.py');
      expect(extensions).toContain('.pyw');
      expect(extensions).toContain('.java');
      expect(extensions).toContain('.go');
      expect(extensions).toContain('.rs');
      expect(extensions).toContain('.php');
      expect(extensions).toContain('.phtml');
      expect(extensions).toContain('.rb');
      expect(extensions).toContain('.c');
      expect(extensions).toContain('.cpp');
      expect(extensions).toContain('.cc');
      expect(extensions).toContain('.cxx');
      expect(extensions).toContain('.h');
      expect(extensions).toContain('.hpp');
      expect(extensions).toContain('.cs');
      expect(extensions).toContain('.csx');
      expect(extensions).toContain('.swift');
      expect(extensions).toContain('.kt');
      expect(extensions).toContain('.kts');
      expect(extensions.length).toBe(23);
    });

    it('should return all config extensions', () => {
      const extensions = getExtensionsByCategory('config');
      expect(extensions).toEqual(expect.arrayContaining(['.json', '.yaml', '.yml', '.xml', '.toml', '.ini', '.env', '.csv', '.sql']));
      expect(extensions.length).toBe(9);
    });

    it('should return all style extensions', () => {
      const extensions = getExtensionsByCategory('style');
      expect(extensions).toEqual(expect.arrayContaining(['.css', '.scss', '.sass', '.svg']));
      expect(extensions.length).toBe(4);
    });

    it('should return all documentation extensions', () => {
      const extensions = getExtensionsByCategory('documentation');
      expect(extensions).toEqual(expect.arrayContaining(['.md', '.txt', '.rst', '.pdf']));
      expect(extensions.length).toBe(4);
    });

    it('should return all web extensions', () => {
      const extensions = getExtensionsByCategory('web');
      expect(extensions).toEqual(expect.arrayContaining(['.html', '.htm']));
      expect(extensions.length).toBe(2);
    });

    it('should return all image extensions', () => {
      const extensions = getExtensionsByCategory('image');
      expect(extensions).toEqual(
        expect.arrayContaining(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp'])
      );
      expect(extensions.length).toBe(7);
    });

    it('should return all binary extensions', () => {
      const extensions = getExtensionsByCategory('binary');
      expect(extensions).toEqual(
        expect.arrayContaining(['.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib'])
      );
      expect(extensions.length).toBe(9);
    });

    it('should return empty array for unknown category', () => {
      const extensions = getExtensionsByCategory('infrastructure' as FileTypeCategory);
      expect(extensions).toEqual([]);
    });

    it('should return sorted arrays', () => {
      const extensions = getExtensionsByCategory('code');
      const sortedExtensions = [...extensions].sort();
      expect(extensions).toEqual(sortedExtensions);
    });
  });

  describe('case insensitivity', () => {
    describe('extensions work with or without leading dot', () => {
      it('should work with leading dot', () => {
        expect(getFileTypeHandler('.ts')).toBeDefined();
        expect(getFileTypeHandler('.json')).toBeDefined();
        expect(getFileTypeHandler('.png')).toBeDefined();
      });

      it('should not work without leading dot', () => {
        expect(getFileTypeHandler('ts')).toBeUndefined();
        expect(getFileTypeHandler('json')).toBeUndefined();
        expect(getFileTypeHandler('png')).toBeUndefined();
      });
    });

    describe('mixed case extensions work', () => {
      it('should handle uppercase extensions', () => {
        expect(getFileTypeHandler('.TS')).toBeDefined();
        expect(getFileTypeHandler('.JSON')).toBeDefined();
        expect(getFileTypeHandler('.PNG')).toBeDefined();
        expect(getFileTypeHandler('.MD')).toBeDefined();
      });

      it('should handle mixed case extensions', () => {
        expect(getFileTypeHandler('.Ts')).toBeDefined();
        expect(getFileTypeHandler('.JsOn')).toBeDefined();
        expect(getFileTypeHandler('.PnG')).toBeDefined();
        expect(getFileTypeHandler('.Md')).toBeDefined();
      });

      it('should return correct handler for uppercase extension', () => {
        const handler = getFileTypeHandler('.TS');
        expect(handler?.category).toBe('code');
        expect(handler?.binary).toBe(false);
      });

      it('should return correct handler for mixed case extension', () => {
        const handler = getFileTypeHandler('.PnG');
        expect(handler?.category).toBe('image');
        expect(handler?.binary).toBe(true);
      });

      it('should isBinaryFile work with uppercase', () => {
        expect(isBinaryFile('.PNG')).toBe(true);
        expect(isBinaryFile('.ZIP')).toBe(true);
        expect(isBinaryFile('.TS')).toBe(false);
      });

      it('should getCategory work with uppercase', () => {
        expect(getCategory('.TS')).toBe('code');
        expect(getCategory('.JSON')).toBe('config');
        expect(getCategory('.PNG')).toBe('image');
      });
    });
  });

  describe('registry structure validation', () => {
    it('should have defaultFileTypeRegistry as alias for DEFAULT_REGISTRY', () => {
      expect(defaultFileTypeRegistry).toBe(DEFAULT_REGISTRY);
    });

    it('should have required categories', () => {
      const categories = new Set(DEFAULT_REGISTRY.map((h) => h.category));
      expect(categories.has('code')).toBe(true);
      expect(categories.has('config')).toBe(true);
      expect(categories.has('style')).toBe(true);
      expect(categories.has('documentation')).toBe(true);
      expect(categories.has('web')).toBe(true);
      expect(categories.has('image')).toBe(true);
      expect(categories.has('binary')).toBe(true);
    });

    it('should have all handlers with extensions array', () => {
      DEFAULT_REGISTRY.forEach((handler) => {
        expect(Array.isArray(handler.extensions)).toBe(true);
        expect(handler.extensions.length).toBeGreaterThan(0);
      });
    });

    it('should have all handlers with category', () => {
      DEFAULT_REGISTRY.forEach((handler) => {
        expect(handler.category).toBeDefined();
        expect(typeof handler.category).toBe('string');
      });
    });

    it('should have all handlers with binary flag', () => {
      DEFAULT_REGISTRY.forEach((handler) => {
        expect(typeof handler.binary).toBe('boolean');
      });
    });

    it('should have 35 handler entries', () => {
      expect(DEFAULT_REGISTRY.length).toBe(35);
    });
  });

  describe('edge cases', () => {
    it('should handle extension with multiple dots correctly', () => {
      const handler = getFileTypeHandler('.tar.gz');
      expect(handler).toBeUndefined(); // .tar.gz is not in registry
    });

    it('should handle whitespace in extension', () => {
      const handler = getFileTypeHandler('.ts ');
      expect(handler).toBeUndefined();
    });

    it('should handle special characters in extension', () => {
      const handler = getFileTypeHandler('.ts@');
      expect(handler).toBeUndefined();
    });

    it('should handle numeric extensions', () => {
      const handler = getFileTypeHandler('.123');
      expect(handler).toBeUndefined();
    });

    it('should handle very long extensions', () => {
      const handler = getFileTypeHandler('.verylongextensionthatdoesnotexist');
      expect(handler).toBeUndefined();
    });
  });

  describe('integration tests', () => {
    it('should consistently identify file types across all functions', () => {
      const testExtensions = ['.ts', '.json', '.png', '.md', '.zip', '.pdf', '.svg'];

      testExtensions.forEach((ext) => {
        const handler = getFileTypeHandler(ext);
        const category = getCategory(ext);
        const isBinary = isBinaryFile(ext);

        if (handler) {
          expect(handler.category).toBe(category);
          expect(handler.binary).toBe(isBinary);
        }
      });
    });

    it('should maintain consistency between getAllExtensions and getExtensionsByCategory', () => {
      const allExtensions = getAllExtensions();
      const categories: FileTypeCategory[] = ['code', 'config', 'style', 'documentation', 'web', 'image', 'binary'];

      const categorizedExtensions = categories.flatMap((cat) => getExtensionsByCategory(cat));

      // Both should have same length
      expect(allExtensions.length).toBe(categorizedExtensions.length);

      // All categorized extensions should be in all extensions
      categorizedExtensions.forEach((ext) => {
        expect(allExtensions).toContain(ext);
      });
    });

    it('should have binary flag consistent with category', () => {
      const binaryCategories = ['image', 'binary'];
      const textCategories = ['code', 'config', 'style', 'documentation', 'web'];

      DEFAULT_REGISTRY.forEach((handler) => {
        if (binaryCategories.includes(handler.category)) {
          // Image and binary categories should have binary=true
          // Exception: SVG is in style category but not binary, PDF is in documentation and is binary
          if (handler.category === 'image' || handler.category === 'binary') {
            expect(handler.binary).toBe(true);
          }
        }

        if (textCategories.includes(handler.category)) {
          // Text categories should have binary=false
          // Exception: PDF is in documentation but is binary
          if (handler.category !== 'documentation' || !handler.extensions.includes('.pdf')) {
            expect(handler.binary).toBe(false);
          }
        }
      });
    });
  });

  describe('special file type behaviors', () => {
    it('should treat SVG as style (not image) and text (not binary)', () => {
      const handler = getFileTypeHandler('.svg');
      expect(handler?.category).toBe('style');
      expect(handler?.binary).toBe(false);
      expect(isBinaryFile('.svg')).toBe(false);
      expect(getCategory('.svg')).toBe('style');
    });

    it('should treat PDF as documentation and binary', () => {
      const handler = getFileTypeHandler('.pdf');
      expect(handler?.category).toBe('documentation');
      expect(handler?.binary).toBe(true);
      expect(isBinaryFile('.pdf')).toBe(true);
      expect(getCategory('.pdf')).toBe('documentation');
    });

    it('should treat XML as config (not web)', () => {
      const handler = getFileTypeHandler('.xml');
      expect(handler?.category).toBe('config');
      expect(getCategory('.xml')).toBe('config');
    });
  });
});
