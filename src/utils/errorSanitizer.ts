/**
 * Error Message Sanitizer
 *
 * Removes sensitive API keys and tokens from error messages before logging or displaying them.
 * This prevents API keys from leaking into console logs, error tracking systems, or user-facing messages.
 */

/**
 * Sanitizes an error message by removing sensitive API keys and tokens.
 *
 * This function removes:
 * - OpenAI/OpenRouter API keys (sk-xxxxxxxx)
 * - Anthropic API keys (sk-ant-xxxxxxxx)
 * - Long alphanumeric strings that might be API keys (35+ characters)
 *
 * @param message - The error message to sanitize (may contain API keys)
 * @returns The sanitized error message with sensitive patterns replaced by placeholders
 *
 * @example
 * ```ts
 * const rawError = "API request failed with key: sk-abc123def456...";
 * const safeError = sanitizeErrorMessage(rawError);
 * // Returns: "API request failed with key: sk-***"
 * ```
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) {
    return '';
  }

  return message
    // Remove OpenAI/OpenRouter API keys (sk- followed by 20+ alphanumeric/hyphen/underscore chars)
    .replace(/sk-[a-zA-Z0-9_-]{20,}/gi, 'sk-***')
    // Remove Anthropic API keys (sk-ant- followed by 20+ alphanumeric/hyphen/underscore chars)
    .replace(/sk-ant-[a-zA-Z0-9_-]{20,}/gi, 'sk-ant-***')
    // Remove other potential API keys (35+ consecutive alphanumeric/hyphen/underscore chars)
    // This catches other common key formats without being too aggressive
    .replace(/[A-Za-z0-9_-]{35,}/g, '***');
}

/**
 * Safely extracts and sanitizes an error message from an unknown error object.
 *
 * @param err - The error object (can be Error, string, or unknown type)
 * @returns Sanitized error message string
 *
 * @example
 * ```ts
 * try {
 *   await someApiCall();
 * } catch (err) {
 *   console.error(sanitizeError(err));
 * }
 * ```
 */
export function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    return sanitizeErrorMessage(err.message);
  }

  if (typeof err === 'string') {
    return sanitizeErrorMessage(err);
  }

  // For other types, convert to string and sanitize
  return sanitizeErrorMessage(String(err));
}
