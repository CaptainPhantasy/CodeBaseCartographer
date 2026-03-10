# Centralized Error Handler - Implementation Summary

## Overview

Implemented centralized error handling for both frontend and backend of Codebase Cartographer. The system provides consistent error classification, logging, and user notification across the entire application.

## Files Created

### Frontend

1. **`/Volumes/Storage/CodeBaseCartographer/src/utils/errorHandler.ts`**
   - Main centralized error handler for frontend
   - Error classification system with categories and severity levels
   - Custom error classes for different error types
   - Structured error logging with in-memory circular buffer
   - Error context tracking for global metadata
   - Safe execution wrappers (safeAsync, safeSync, withErrorHandling)
   - User notification callback integration
   - React Error Boundary integration helpers

2. **`/Volumes/Storage/CodeBaseCartographer/src/utils/errorHandler.test.ts`**
   - Comprehensive test suite for error handler
   - 100+ lines of tests covering all major functionality
   - Tests for error classification, logging, context, and safe execution

### Backend

3. **`/Volumes/Storage/CodeBaseCartographer/server/src/errorHandler.ts`**
   - Centralized error handler for Express backend
   - HTTP status code mapping by error category
   - Custom error classes matching frontend structure
   - Express middleware for request ID generation and error handling
   - Async error wrapper for route handlers
   - WebSocket error handling utilities
   - Safe execution wrappers
   - Response helpers (sendSuccess, sendError, sendValidationError, sendNotFound)

## Files Modified

### Frontend

1. **`/Volumes/Storage/CodeBaseCartographer/src/services/llmService.ts`**
   - Integrated with centralized error handler
   - Added import of error types and functions
   - Updated `getAdapter()` to use `ApiKeyMissingError` and `handleError()`
   - Updated `generateText()` to use `ProviderError` and `handleError()`
   - Enhanced error logging with operation context

### Backend

2. **`/Volumes/Storage/CodeBaseCartographer/server/src/server.ts`**
   - Integrated centralized error handler middleware
   - Added imports for error types and middleware functions
   - Updated `setupMiddleware()` to include `requestIdMiddleware`
   - Updated `setupErrorHandling()` to use centralized `errorHandler` and `notFoundHandler`
   - Converted route handlers to use `asyncHandler` wrapper
   - Updated file operations to use new error classes
   - Replaced manual error responses with `sendSuccess()` and error throws

## Error Categories

### Frontend Error Categories
- `NETWORK` - Network connectivity issues
- `TIMEOUT` - Request timeouts
- `RATE_LIMIT` - API rate limiting
- `AUTH` - Authentication failures
- `API_KEY_MISSING` - Missing API key configuration
- `API_KEY_INVALID` - Invalid API key
- `VALIDATION` - Input validation errors
- `INVALID_INPUT` - Invalid user input
- `PROVIDER` - LLM provider errors
- `UNSUPPORTED_CAPABILITY` - Feature not supported by provider
- `CONFIGURATION` - Application configuration errors
- `FILE_OPERATION` - File operation failures
- `ENCRYPTION` - Security/encryption errors
- `UNKNOWN` - Unexpected errors

### Backend Error Categories
- `NETWORK` - Network connectivity issues (503)
- `TIMEOUT` - Request timeouts (504)
- `RATE_LIMIT` - Rate limiting (429)
- `AUTH` - Authentication failures (401)
- `PERMISSION` - Authorization failures (403)
- `VALIDATION` - Input validation errors (400)
- `INVALID_INPUT` - Invalid input (400)
- `FILE_NOT_FOUND` - File not found (404)
- `FILE_OPERATION` - File operation errors (500)
- `FILE_ACCESS` - File access denied (403)
- `DATABASE` - Database errors (500)
- `DATABASE_CONNECTION` - DB connection issues (503)
- `CONFIGURATION` - Configuration errors (500)
- `INTERNAL` - Internal server errors (500)

## Error Severity Levels

- `LOW` - User input validation, minor issues
- `MEDIUM` - Provider errors, network issues
- `HIGH` - Authentication, API key issues
- `CRITICAL` - System failures, data loss

## Key Features

### Error Classification
- Automatic classification of unknown errors into appropriate categories
- Pattern matching for common error messages
- Provider-specific error handling
- HTTP status code to error category mapping

### Structured Logging
- In-memory circular buffer (last 100 frontend / 500 backend errors)
- Timestamp, category, severity, message, context, and stack trace
- Request ID tracking for backend (for distributed tracing)
- Environment-aware logging (verbose in dev, minimal in production)

### Error Context Tracking
- Global error context for component/operation metadata
- Per-error context for specific details
- Automatic merging of global and local context

### User Notification
- User-friendly error messages by category
- Callback registration for UI notifications
- Severity-based notification thresholds
- API key configuration guidance

### Safe Execution Wrappers
- `safeAsync(fn, fallback, context)` - Async with fallback
- `safeSync(fn, fallback, context)` - Sync with fallback
- `withErrorHandling(fn, context)` - Logs and re-throws

### Backend Middleware
- `requestIdMiddleware` - Adds unique ID to each request
- `asyncHandler(fn)` - Wraps async route handlers
- `errorHandler` - Global error middleware
- `notFoundHandler` - 404 handler
- Response helpers for consistent API responses

## Build Status

### Frontend
```
npm run lint
> tsc --noEmit
Status: CLEAN - No TypeScript errors
```

### Backend
```
npx tsc --noEmit src/errorHandler.ts
Status: CLEAN - errorHandler.ts compiles successfully
Note: Pre-existing errors in other files (pdfProcessor.test.ts, contentProcessors/index.ts, webSocketServer.ts)
```

## Usage Examples

### Frontend

```typescript
import {
  ApiKeyMissingError,
  ProviderError,
  handleError,
  safeAsync
} from './utils/errorHandler';

// Throwing classified errors
function getAdapter(providerId: string) {
  const apiKey = getApiKey(providerId);
  if (!apiKey) {
    const error = new ApiKeyMissingError(providerId);
    handleError(error, { providerId });
    throw error;
  }
}

// Safe execution with fallback
const result = await safeAsync(
  () => apiCall(),
  { success: false },
  'apiCall'
);

// Error classification
try {
  await someOperation();
} catch (error) {
  const classified = handleError(error, { operation: 'someOperation' });
  // Error is logged and user is notified (if severity >= MEDIUM)
}
```

### Backend

```typescript
import {
  asyncHandler,
  ValidationError,
  FileNotFoundError,
  sendSuccess,
  sendError
} from './errorHandler';

// Route handler with automatic error handling
app.get('/api/files/:path', asyncHandler(async (req, res) => {
  const path = req.params[0];
  const file = fileOperator.readFile(path);
  sendSuccess(res, file);
}));

// Throwing classified errors
app.post('/api/files/:path', asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (typeof content !== 'string') {
    throw new ValidationError('Content must be a string');
  }
  // ... rest of handler
}));
```

## Integration Points

### Frontend
- Already integrated with `src/services/llmService.ts`
- Ready to integrate with:
  - `src/services/adapters/*.ts` - Adapter error handling
  - `src/hooks/useConfig.tsx` - Configuration errors
  - `src/components/ErrorBoundary.tsx` - React error boundary

### Backend
- Already integrated with `server/src/server.ts`
- Ready to integrate with:
  - `server/src/fileOperator.ts` - File operation errors
  - `server/src/taskStore.ts` - Database errors
  - `server/src/webSocketServer.ts` - WebSocket errors

## Future Enhancements

1. Add error telemetry integration (Sentry, LogRocket)
2. Implement error rate limiting per category
3. Add error replay for debugging
4. Create dashboard for error analytics
5. Add performance monitoring integration
6. Implement error aggregation and reporting

## Testing

Run the error handler tests:
```bash
npm test errorHandler.test.ts
```

Run all tests:
```bash
npm test
```

## Documentation

See inline documentation in:
- `/Volumes/Storage/CodeBaseCartographer/src/utils/errorHandler.ts`
- `/Volumes/Storage/CodeBaseCartographer/server/src/errorHandler.ts`
