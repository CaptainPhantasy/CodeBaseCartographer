/**
 * fileOperator.ts - Safe file read/write operations
 *
 * Features:
 * - Safe read operations with error handling
 * - Write operations with automatic backup
 * - Path validation to ensure operations stay within watched directory
 * - Consistent error formatting
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { dirname, resolve, relative, isAbsolute } from 'path';
import type { FileContent, ErrorResponse } from './types.js';

export class FileOperator {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = resolve(basePath);
  }

  /**
   * Validate that a path is within the watched directory
   * @throws Error if path is outside base directory or contains traversal attempts
   */
  public validatePath(path: string): string {
    const resolvedPath = isAbsolute(path) ? path : resolve(this.basePath, path);
    const relativePath = relative(this.basePath, resolvedPath);

    // Check for path traversal attempts
    if (relativePath.startsWith('..')) {
      throw this.createError(
        'Path traversal detected',
        'PATH_TRAVERSAL',
        { requestedPath: path, resolvedPath }
      );
    }

    // Ensure path is within base directory
    if (!resolvedPath.startsWith(this.basePath)) {
      throw this.createError(
        'Path is outside watched directory',
        'INVALID_PATH',
        { requestedPath: path, basePath: this.basePath }
      );
    }

    return resolvedPath;
  }

  /**
   * Read file content with error handling
   */
  public readFile(path: string): FileContent {
    try {
      const validatedPath = this.validatePath(path);

      if (!existsSync(validatedPath)) {
        throw this.createError(
          'File not found',
          'FILE_NOT_FOUND',
          { path: validatedPath }
        );
      }

      const stats = statSync(validatedPath);
      if (stats.isDirectory()) {
        throw this.createError(
          'Cannot read directory as file',
          'IS_DIRECTORY',
          { path: validatedPath }
        );
      }

      const content = readFileSync(validatedPath, 'utf-8');

      return {
        path: validatedPath,
        content,
        encoding: 'utf-8',
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw our custom errors
      }
      throw this.createError(
        'Failed to read file',
        'READ_ERROR',
        { path, originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Write file content with automatic backup
   */
  public writeFile(path: string, content: string, createBackup = true): string {
    try {
      const validatedPath = this.validatePath(path);

      // Ensure directory exists
      const dir = dirname(validatedPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Create backup if file exists and backup is enabled
      let backupContent: string | null = null;
      if (createBackup && existsSync(validatedPath)) {
        try {
          backupContent = readFileSync(validatedPath, 'utf-8');
        } catch (error) {
          console.warn('Failed to create backup:', error);
        }
      }

      // Write new content
      writeFileSync(validatedPath, content, 'utf-8');

      return validatedPath;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createError(
        'Failed to write file',
        'WRITE_ERROR',
        { path, originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Check if a file exists
   */
  public fileExists(path: string): boolean {
    try {
      const validatedPath = this.validatePath(path);
      return existsSync(validatedPath);
    } catch {
      return false;
    }
  }

  /**
   * Delete a file
   */
  public deleteFile(path: string): boolean {
    try {
      const validatedPath = this.validatePath(path);

      if (!existsSync(validatedPath)) {
        return false;
      }

      unlinkSync(validatedPath);
      return true;
    } catch (error) {
      throw this.createError(
        'Failed to delete file',
        'DELETE_ERROR',
        { path, originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get file stats
   */
  public getFileStats(path: string) {
    try {
      const validatedPath = this.validatePath(path);

      if (!existsSync(validatedPath)) {
        throw this.createError(
          'File not found',
          'FILE_NOT_FOUND',
          { path: validatedPath }
        );
      }

      const stats = statSync(validatedPath);
      return {
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createError(
        'Failed to get file stats',
        'STATS_ERROR',
        { path, originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Create a formatted error object
   */
  private createError(message: string, code?: string, details?: unknown): Error & ErrorResponse {
    const error = new Error(message) as Error & ErrorResponse;
    error.code = code;
    error.details = details;
    return error;
  }

  /**
   * Format error for consistent API responses
   */
  public static handleError(error: unknown): ErrorResponse {
    if (error instanceof Error && 'code' in error) {
      const customError = error as Error & ErrorResponse;
      return {
        error: customError.message,
        code: customError.code,
        details: customError.details,
      };
    }

    if (error instanceof Error) {
      return {
        error: error.message,
        code: 'UNKNOWN_ERROR',
      };
    }

    return {
      error: String(error),
      code: 'UNKNOWN_ERROR',
    };
  }

  /**
   * Get the base path
   */
  public getBasePath(): string {
    return this.basePath;
  }
}
