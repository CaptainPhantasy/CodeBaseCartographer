/**
 * Centralized Error Handler for Frontend
 *
 * Provides consistent error classification, logging, and user notification
 * across the entire Codebase Cartographer application.
 */

import { sanitizeError } from './errorSanitizer';

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

/**
 * Error categories for consistent handling and user messaging
 */
export enum ErrorCategory {
  // Network and connectivity issues
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',

  // Authentication and authorization
  AUTH = 'AUTH',
  API_KEY_MISSING = 'API_KEY_MISSING',
  API_KEY_INVALID = 'API_KEY_INVALID',

  // Validation and input errors
  VALIDATION = 'VALIDATION',
  INVALID_INPUT = 'INVALID_INPUT',

  // Provider-specific errors
  PROVIDER = 'PROVIDER',
  UNSUPPORTED_CAPABILITY = 'UNSUPPORTED_CAPABILITY',

  // Application errors
  CONFIGURATION = 'CONFIGURATION',
  FILE_OPERATION = 'FILE_OPERATION',
  ENCRYPTION = 'ENCRYPTION',

  // Unknown/unexpected errors
  UNKNOWN = 'UNKNOWN'
}

/**
 * Error severity levels for logging and user notification
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

/**
 * Base application error class with structured metadata
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public readonly userMessage?: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, AppError);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.userMessage || this.getDefaultUserMessage();
  }

  /**
   * Get default user message based on error category
   */
  private getDefaultUserMessage(): string {
    switch (this.category) {
      case ErrorCategory.NETWORK:
        return 'Network connection issue. Please check your internet connection.';
      case ErrorCategory.TIMEOUT:
        return 'Request timed out. Please try again.';
      case ErrorCategory.RATE_LIMIT:
        return 'Too many requests. Please wait a moment and try again.';
      case ErrorCategory.AUTH:
      case ErrorCategory.API_KEY_MISSING:
      case ErrorCategory.API_KEY_INVALID:
        return 'Authentication issue. Please check your API key configuration.';
      case ErrorCategory.VALIDATION:
      case ErrorCategory.INVALID_INPUT:
        return 'Invalid input. Please check your entry and try again.';
      case ErrorCategory.PROVIDER:
        return 'Service provider error. Please try again later.';
      case ErrorCategory.UNSUPPORTED_CAPABILITY:
        return 'This feature is not supported by the selected provider.';
      case ErrorCategory.CONFIGURATION:
        return 'Configuration error. Please check your settings.';
      case ErrorCategory.FILE_OPERATION:
        return 'File operation failed. Please check file permissions.';
      case ErrorCategory.ENCRYPTION:
        return 'Security error. Please check your PIN configuration.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Convert to plain object for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: sanitizeError(this.message),
      category: this.category,
      severity: this.severity,
      userMessage: this.getUserMessage(),
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Network-related errors (connectivity, DNS, etc.)
 */
export class NetworkError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorCategory.NETWORK, ErrorSeverity.MEDIUM, undefined, context);
    this.name = 'NetworkError';
  }
}

/**
 * Request timeout errors
 */
export class TimeoutError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorCategory.TIMEOUT, ErrorSeverity.MEDIUM, undefined, context);
    this.name = 'TimeoutError';
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends AppError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    const userMessage = retryAfter
      ? `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
      : undefined;

    super(message, ErrorCategory.RATE_LIMIT, ErrorSeverity.MEDIUM, userMessage, context);
    this.name = 'RateLimitError';
  }
}

/**
 * Authentication and API key errors
 */
export class AuthError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorCategory.AUTH, ErrorSeverity.HIGH, undefined, context);
    this.name = 'AuthError';
  }
}

/**
 * Missing API key configuration
 */
export class ApiKeyMissingError extends AppError {
  constructor(providerId: string) {
    const userMessage = `Please configure your ${providerId} API key in Settings.`;
    super(`No API key configured for ${providerId}`, ErrorCategory.API_KEY_MISSING, ErrorSeverity.HIGH, userMessage, { providerId });
    this.name = 'ApiKeyMissingError';
  }
}

/**
 * Invalid API key
 */
export class ApiKeyInvalidError extends AppError {
  constructor(providerId: string, context?: Record<string, unknown>) {
    const userMessage = `Your ${providerId} API key appears to be invalid. Please check it in Settings.`;
    super(`Invalid API key for ${providerId}`, ErrorCategory.API_KEY_INVALID, ErrorSeverity.HIGH, userMessage, { providerId, ...context });
    this.name = 'ApiKeyInvalidError';
  }
}

/**
 * Input validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string, userMessage?: string, context?: Record<string, unknown>) {
    super(message, ErrorCategory.VALIDATION, ErrorSeverity.LOW, userMessage, context);
    this.name = 'ValidationError';
  }
}

/**
 * Provider-specific errors
 */
export class ProviderError extends AppError {
  constructor(
    providerId: string,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, ErrorCategory.PROVIDER, ErrorSeverity.MEDIUM, undefined, { providerId, ...context });
    this.name = 'ProviderError';
  }
}

/**
 * Unsupported capability errors
 */
export class UnsupportedCapabilityError extends AppError {
  constructor(providerId: string, capability: string) {
    const userMessage = `The ${capability} feature is not supported by ${providerId}. Please select a different provider.`;
    super(`${providerId} does not support ${capability}`, ErrorCategory.UNSUPPORTED_CAPABILITY, ErrorSeverity.LOW, userMessage, { providerId, capability });
    this.name = 'UnsupportedCapabilityError';
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorCategory.CONFIGURATION, ErrorSeverity.HIGH, undefined, context);
    this.name = 'ConfigurationError';
  }
}

/**
 * File operation errors
 */
export class FileOperationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorCategory.FILE_OPERATION, ErrorSeverity.MEDIUM, undefined, context);
    this.name = 'FileOperationError';
  }
}

/**
 * Encryption/security errors
 */
export class EncryptionError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, ErrorCategory.ENCRYPTION, ErrorSeverity.HIGH, undefined, context);
    this.name = 'EncryptionError';
  }
}

// ============================================================================
// ERROR CONTEXT TRACKING
// ============================================================================

interface ErrorContext {
  component?: string;
  operation?: string;
  providerId?: string;
  userId?: string;
  additionalData?: Record<string, unknown>;
}

let globalErrorContext: Partial<ErrorContext> = {};

/**
 * Set global error context that will be included in all error logs
 */
export function setErrorContext(context: Partial<ErrorContext>): void {
  globalErrorContext = { ...globalErrorContext, ...context };
}

/**
 * Clear global error context
 */
export function clearErrorContext(): void {
  globalErrorContext = {};
}

/**
 * Get current error context
 */
export function getErrorContext(): Partial<ErrorContext> {
  return { ...globalErrorContext };
}

// ============================================================================
// ERROR CLASSIFICATION UTILITIES
// ============================================================================

/**
 * Classify an unknown error into an AppError with appropriate category
 */
export function classifyError(error: unknown, defaultContext?: Record<string, unknown>): AppError {
  // Already classified errors
  if (error instanceof AppError) {
    return error;
  }

  // Standard Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const context = { ...defaultContext, originalError: error.name };

    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return new NetworkError(error.message, context);
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return new TimeoutError(error.message, context);
    }

    // Rate limit errors
    if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
      return new RateLimitError(error.message, undefined, context);
    }

    // Auth errors
    if (message.includes('unauthorized') || message.includes('401') || message.includes('authentication')) {
      return new AuthError(error.message, context);
    }

    // Validation errors
    if (message.includes('invalid') || message.includes('validation') || message.includes('required')) {
      return new ValidationError(error.message, undefined, context);
    }

    // Generic error with context
    return new AppError(error.message, ErrorCategory.UNKNOWN, ErrorSeverity.MEDIUM, undefined, context);
  }

  // String errors
  if (typeof error === 'string') {
    return new AppError(error, ErrorCategory.UNKNOWN, ErrorSeverity.MEDIUM, undefined, defaultContext);
  }

  // Unknown error types
  return new AppError(
    'An unknown error occurred',
    ErrorCategory.UNKNOWN,
    ErrorSeverity.MEDIUM,
    undefined,
    { ...defaultContext, errorType: typeof error }
  );
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

interface ErrorLogEntry {
  timestamp: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  context: Record<string, unknown>;
  operation?: string;
  stack?: string;
}

// In-memory error log (circular buffer of last 100 errors)
const errorLog: ErrorLogEntry[] = [];
const MAX_ERROR_LOG_SIZE = 100;

/**
 * Log an error with structured metadata
 */
export function logError(error: unknown, additionalContext?: Record<string, unknown>): void {
  const classified = classifyError(error, additionalContext);

  // Extract operation from additionalContext if present
  const operation = additionalContext?.operation as string | undefined;

  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    category: classified.category,
    severity: classified.severity,
    message: sanitizeError(classified.message),
    userMessage: classified.getUserMessage(),
    context: {
      ...globalErrorContext,
      ...classified.context,
      ...additionalContext
    },
    operation,
    stack: classified.stack
  };

  // Add to in-memory log
  errorLog.push(entry);
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog.shift();
  }

  // Console logging with appropriate severity
  const logMethod = classified.severity === ErrorSeverity.CRITICAL || classified.severity === ErrorSeverity.HIGH
    ? console.error
    : classified.severity === ErrorSeverity.MEDIUM
    ? console.warn
    : console.log;

  const logPrefix = `[${classified.category}] [${classified.severity}]`;

  if (process.env.NODE_ENV === 'development') {
    logMethod(logPrefix, classified.message, entry.context);
    if (entry.stack) {
      logMethod('Stack trace:', entry.stack);
    }
  } else {
    // Production: minimal logging
    logMethod(logPrefix, entry.userMessage);
  }
}

/**
 * Get recent error log entries
 */
export function getErrorLog(limit: number = 50): ErrorLogEntry[] {
  return errorLog.slice(-limit);
}

/**
 * Clear error log
 */
export function clearErrorLog(): void {
  errorLog.length = 0;
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
      logError(error, { function: context || fn.name, args });
      throw error; // Re-throw for caller to handle
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
// USER NOTIFICATION INTEGRATION
// ============================================================================

/**
 * Error notification callback type
 */
export type ErrorNotificationCallback = (error: AppError) => void;

let notificationCallback: ErrorNotificationCallback | null = null;

/**
 * Register a callback for displaying error notifications to users
 */
export function setErrorNotificationCallback(callback: ErrorNotificationCallback): void {
  notificationCallback = callback;
}

/**
 * Clear the error notification callback
 */
export function clearErrorNotificationCallback(): void {
  notificationCallback = null;
}

/**
 * Handle an error: log it and optionally notify user
 */
export function handleError(error: unknown, additionalContext?: Record<string, unknown>): AppError {
  const classified = classifyError(error, additionalContext);

  // Log the error
  logError(classified, additionalContext);

  // Notify user if callback is registered
  if (notificationCallback && classified.severity >= ErrorSeverity.MEDIUM) {
    try {
      notificationCallback(classified);
    } catch (callbackError) {
      // Classify and log the callback error separately
      const callbackClassified = classifyError(callbackError, {
        context: 'ErrorNotificationCallback',
        originalError: classified.message
      });

      // Log to console as fallback
      console.error('[Error Handler] Notification callback failed:', {
        callbackError: callbackClassified.message,
        originalError: classified.message,
        category: callbackClassified.category
      });

      // If callback fails, clear it to prevent infinite error loops
      // This provides error recovery by breaking the failure cycle
      if (callbackClassified.severity >= ErrorSeverity.HIGH) {
        clearErrorNotificationCallback();
        console.warn('[Error Handler] Notification callback cleared due to repeated failures');
      }
    }
  }

  return classified;
}

// ============================================================================
// REACT ERROR BOUNDARY INTEGRATION
// ============================================================================

/**
 * Enhance React Error Boundary with centralized error handling
 * Call this from your ErrorBoundary's componentDidCatch or useErrorHandling hook
 */
export function handleReactError(
  error: Error,
  errorInfo: { componentStack?: string }
): AppError {
  return handleError(error, {
    component: 'ReactErrorBoundary',
    componentStack: errorInfo.componentStack
  });
}
