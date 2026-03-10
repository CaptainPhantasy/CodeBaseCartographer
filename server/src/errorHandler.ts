/**
 * Centralized Error Handler for Backend Server
 *
 * Provides consistent error classification, logging, and HTTP response formatting
 * for the Express server and WebSocket services.
 */

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Error categories for consistent handling
 */
export enum ErrorCategory {
  // Network and connectivity
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',

  // Authentication and authorization
  AUTH = 'AUTH',
  PERMISSION = 'PERMISSION',

  // Validation
  VALIDATION = 'VALIDATION',
  INVALID_INPUT = 'INVALID_INPUT',

  // File operations
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_OPERATION = 'FILE_OPERATION',
  FILE_ACCESS = 'FILE_ACCESS',

  // Database operations
  DATABASE = 'DATABASE',
  DATABASE_CONNECTION = 'DATABASE_CONNECTION',

  // Application errors
  CONFIGURATION = 'CONFIGURATION',
  INTERNAL = 'INTERNAL'
}

/**
 * HTTP status codes mapped to error categories
 */
export const HTTP_STATUS_CODES: Record<ErrorCategory, number> = {
  [ErrorCategory.NETWORK]: 503,
  [ErrorCategory.TIMEOUT]: 504,
  [ErrorCategory.RATE_LIMIT]: 429,
  [ErrorCategory.AUTH]: 401,
  [ErrorCategory.PERMISSION]: 403,
  [ErrorCategory.VALIDATION]: 400,
  [ErrorCategory.INVALID_INPUT]: 400,
  [ErrorCategory.FILE_NOT_FOUND]: 404,
  [ErrorCategory.FILE_OPERATION]: 500,
  [ErrorCategory.FILE_ACCESS]: 403,
  [ErrorCategory.DATABASE]: 500,
  [ErrorCategory.DATABASE_CONNECTION]: 503,
  [ErrorCategory.CONFIGURATION]: 500,
  [ErrorCategory.INTERNAL]: 500
};

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly statusCode: number = HTTP_STATUS_CODES[category],
    public readonly isOperational: boolean = true,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, AppError);
  }

  /**
   * Convert to plain object for HTTP response
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        message: this.message,
        category: this.category,
        statusCode: this.statusCode
      }
    };
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCategory.VALIDATION, 400, true, details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication errors
 */
export class AuthError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, ErrorCategory.AUTH, 401, true);
    this.name = 'AuthError';
  }
}

/**
 * Authorization/permission errors
 */
export class PermissionError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, ErrorCategory.PERMISSION, 403, true);
    this.name = 'PermissionError';
  }
}

/**
 * File not found errors
 */
export class FileNotFoundError extends AppError {
  constructor(path: string) {
    super(`File not found: ${path}`, ErrorCategory.FILE_NOT_FOUND, 404, true, { path });
    this.name = 'FileNotFoundError';
  }
}

/**
 * File operation errors
 */
export class FileOperationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCategory.FILE_OPERATION, 500, true, details);
    this.name = 'FileOperationError';
  }
}

/**
 * File access errors
 */
export class FileAccessError extends AppError {
  constructor(path: string, operation: string) {
    super(
      `Access denied for ${operation} on ${path}`,
      ErrorCategory.FILE_ACCESS,
      403,
      true,
      { path, operation }
    );
    this.name = 'FileAccessError';
  }
}

/**
 * Database errors
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCategory.DATABASE, 500, true, details);
    this.name = 'DatabaseError';
  }
}

/**
 * Database connection errors
 */
export class DatabaseConnectionError extends AppError {
  constructor(message: string = 'Database connection failed') {
    super(message, ErrorCategory.DATABASE_CONNECTION, 503, true);
    this.name = 'DatabaseConnectionError';
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCategory.CONFIGURATION, 500, false, details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Internal server errors (unexpected errors)
 */
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', details?: Record<string, unknown>) {
    super(message, ErrorCategory.INTERNAL, 500, false, details);
    this.name = 'InternalError';
  }
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

interface ErrorLogEntry {
  timestamp: string;
  level: 'error' | 'warn';
  category: ErrorCategory;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  requestId?: string;
}

// In-memory error log
const errorLog: ErrorLogEntry[] = [];
const MAX_ERROR_LOG_SIZE = 500;

/**
 * Log an error with structured metadata
 */
export function logError(
  error: unknown,
  context?: {
    requestId?: string;
    operation?: string;
    additionalData?: Record<string, unknown>;
  }
): void {
  const classified = classifyError(error);
  const timestamp = new Date().toISOString();

  const entry: ErrorLogEntry = {
    timestamp,
    level: classified.statusCode >= 500 ? 'error' : 'warn',
    category: classified.category,
    message: error instanceof Error ? error.message : String(error),
    details: {
      ...context?.additionalData,
      operation: context?.operation
    },
    stack: error instanceof Error ? error.stack : undefined,
    requestId: context?.requestId
  };

  // Add to log
  errorLog.push(entry);
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog.shift();
  }

  // Console output with structured formatting
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;
  const requestIdSuffix = entry.requestId ? ` [req: ${entry.requestId.slice(0, 8)}]` : '';

  console.log(`${prefix}${requestIdSuffix} ${entry.message}`);

  if (entry.details && Object.keys(entry.details).length > 0) {
    console.log('Details:', JSON.stringify(entry.details, null, 2));
  }

  if (entry.stack && entry.level === 'error') {
    console.log('Stack:', entry.stack);
  }
}

/**
 * Get error log entries
 */
export function getErrorLog(limit: number = 100): ErrorLogEntry[] {
  return errorLog.slice(-limit);
}

/**
 * Clear error log
 */
export function clearErrorLog(): void {
  errorLog.length = 0;
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Classify an unknown error into an AppError
 */
export function classifyError(error: unknown, defaultDetails?: Record<string, unknown>): AppError {
  // Already classified errors
  if (error instanceof AppError) {
    return error;
  }

  // Standard Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const details = { ...defaultDetails, originalError: error.name };

    // File system errors
    if (message.includes('enoent') || message.includes('no such file')) {
      // Try to extract file path from error
      const match = error.message.match(/['"]([^'"]+)['"]/);
      const path = match ? match[1] : 'unknown';
      return new FileNotFoundError(path);
    }

    if (message.includes('eacces') || message.includes('permission denied')) {
      const match = error.message.match(/['"]([^'"]+)['"]/);
      const path = match ? match[1] : 'unknown';
      return new FileAccessError(path, 'access');
    }

    // Database errors
    if (message.includes('database') || message.includes('sqlite') || message.includes('sql')) {
      return new DatabaseError(error.message, details);
    }

    // Network errors
    if (message.includes('network') || message.includes('connect') || message.includes('econnrefused')) {
      return new AppError(error.message, ErrorCategory.NETWORK, 503, true, details);
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return new AppError(error.message, ErrorCategory.TIMEOUT, 504, true, details);
    }

    // Validation errors
    if (message.includes('invalid') || message.includes('validation') || message.includes('required')) {
      return new ValidationError(error.message, details);
    }

    // Generic internal error
    return new InternalError(error.message, details);
  }

  // String errors
  if (typeof error === 'string') {
    return new InternalError(error, defaultDetails);
  }

  // Unknown error types
  return new InternalError('An unknown error occurred', {
    ...defaultDetails,
    errorType: typeof error
  });
}

// ============================================================================
// EXPRESS ERROR HANDLING MIDDLEWARE
// ============================================================================

import { Request, Response, NextFunction } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
    startTime?: number;
  }
}

/**
 * Generate request ID
 */
function generateRequestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Request ID middleware - adds unique ID to each request
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.id = generateRequestId();
  req.startTime = Date.now();
  next();
}

/**
 * Async error wrapper for route handlers
 * Catches errors in async route handlers and passes them to error middleware
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const message = `Route not found: ${req.method} ${req.path}`;
  logError(new Error(message), { requestId: req.id, operation: 'http_request' });

  res.status(404).json({
    error: {
      message: 'Not Found',
      category: ErrorCategory.FILE_NOT_FOUND,
      statusCode: 404,
      path: req.path,
      method: req.method
    }
  });
}

/**
 * Global error handling middleware
 * Must be added AFTER all routes and middleware
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logError(err, {
    requestId: req.id,
    operation: 'http_request',
    additionalData: {
      method: req.method,
      path: req.path,
      query: req.query,
      duration: req.startTime ? Date.now() - req.startTime : undefined
    }
  });

  // Classify the error
  const classified = classifyError(err);

  // Prepare response
  const response = {
    error: {
      message: classified.message,
      category: classified.category,
      statusCode: classified.statusCode
    }
  };

  // Add details in development mode
  if (process.env.NODE_ENV === 'development' && classified.details) {
    (response.error as Record<string, unknown>).details = classified.details;
    (response.error as Record<string, unknown>).stack = err instanceof Error ? err.stack : undefined;
  }

  // Add request ID
  if (req.id) {
    (response.error as Record<string, unknown>).requestId = req.id;
  }

  res.status(classified.statusCode).json(response);
}

// ============================================================================
// WEBSOCKET ERROR HANDLING
// ============================================================================

import { WebSocket } from 'ws';

/**
 * Safe WebSocket send with error handling
 */
export function safeWsSend(ws: WebSocket, data: unknown): boolean {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  } catch (error) {
    logError(error, { operation: 'websocket_send' });
    return false;
  }
}

/**
 * Handle WebSocket errors
 */
export function handleWsError(ws: WebSocket, error: unknown, context?: Record<string, unknown>): void {
  logError(error, {
    operation: 'websocket',
    additionalData: context
  });

  // Try to send error message to client
  safeWsSend(ws, {
    type: 'error',
    error: {
      message: error instanceof Error ? error.message : 'Unknown error',
      category: classifyError(error).category
    }
  });
}

// ============================================================================
// ERROR HANDLING HELPERS
// ============================================================================

/**
 * Wrap an async function with error handling and logging
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: string
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error, { operation: context });
      throw error;
    }
  }) as T;
}

/**
 * Safely execute an async function with fallback on error
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(error, { operation: context });
    return fallback;
  }
}

/**
 * Safely execute a synchronous function with fallback on error
 */
export function safeSync<T>(
  fn: () => T,
  fallback: T,
  context?: string
): T {
  try {
    return fn();
  } catch (error) {
    logError(error, { operation: context });
    return fallback;
  }
}

// ============================================================================
// ERROR RESPONSE HELPERS
// ============================================================================

/**
 * Send a success response
 */
export function sendSuccess(res: Response, data: unknown, statusCode: number = 200): void {
  res.status(statusCode).json({
    success: true,
    data
  });
}

/**
 * Send an error response
 */
export function sendError(res: Response, error: AppError): void {
  logError(error, { operation: 'http_response' });

  res.status(error.statusCode).json({
    error: {
      message: error.message,
      category: error.category,
      statusCode: error.statusCode
    }
  });
}

/**
 * Send a validation error response
 */
export function sendValidationError(res: Response, message: string, details?: Record<string, unknown>): void {
  const error = new ValidationError(message, details);
  sendError(res, error);
}

/**
 * Send a not found error response
 */
export function sendNotFound(res: Response, resource: string): void {
  const error = new FileNotFoundError(resource);
  sendError(res, error);
}
