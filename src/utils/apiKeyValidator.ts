/**
 * API Key Validation Utilities
 * Makes minimal API calls to verify keys work for each provider
 */

import { ProviderId, ValidationResult } from '../types/capabilities';
import { PROVIDERS } from '../config/providers';

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate an OpenRouter API key
 */
async function validateOpenRouterKey(apiKey: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Codebase Cartographer'
      }
    });

    if (response.status === 401) {
      return {
        isValid: false,
        providerId: 'openrouter',
        errorMessage: 'Invalid API key',
        errorCode: 'INVALID_KEY'
      };
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      return {
        isValid: false,
        providerId: 'openrouter',
        errorMessage: 'Rate limited. Please try again later.',
        errorCode: 'RATE_LIMITED',
        rateLimited: true,
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : 60
      };
    }

    if (!response.ok) {
      return {
        isValid: false,
        providerId: 'openrouter',
        errorMessage: `Validation failed: ${response.statusText}`,
        errorCode: `HTTP_${response.status}`
      };
    }

    return { isValid: true, providerId: 'openrouter' };
  } catch (error) {
    return {
      isValid: false,
      providerId: 'openrouter',
      errorMessage: error instanceof Error ? error.message : 'Network error',
      errorCode: 'NETWORK_ERROR'
    };
  }
}

/**
 * Validate an OpenAI API key
 */
async function validateOpenAIKey(apiKey: string): Promise<ValidationResult> {
  try {
    // Use the models endpoint as a minimal check
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (response.status === 401) {
      const data = await response.json().catch(() => ({}));
      return {
        isValid: false,
        providerId: 'openai',
        errorMessage: data.error?.message || 'Invalid API key',
        errorCode: 'INVALID_KEY'
      };
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      return {
        isValid: false,
        providerId: 'openai',
        errorMessage: 'Rate limited. Please try again later.',
        errorCode: 'RATE_LIMITED',
        rateLimited: true,
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : 60
      };
    }

    if (!response.ok) {
      return {
        isValid: false,
        providerId: 'openai',
        errorMessage: `Validation failed: ${response.statusText}`,
        errorCode: `HTTP_${response.status}`
      };
    }

    return { isValid: true, providerId: 'openai' };
  } catch (error) {
    return {
      isValid: false,
      providerId: 'openai',
      errorMessage: error instanceof Error ? error.message : 'Network error',
      errorCode: 'NETWORK_ERROR'
    };
  }
}

/**
 * Validate an Anthropic API key
 */
async function validateAnthropicKey(apiKey: string): Promise<ValidationResult> {
  try {
    // Anthropic doesn't have a simple auth check endpoint
    // We'll make a minimal messages call with max_tokens=1
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true' // Required for browser
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }]
      })
    });

    if (response.status === 401) {
      const data = await response.json().catch(() => ({}));
      return {
        isValid: false,
        providerId: 'anthropic',
        errorMessage: data.error?.message || 'Invalid API key',
        errorCode: 'INVALID_KEY'
      };
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      return {
        isValid: false,
        providerId: 'anthropic',
        errorMessage: 'Rate limited. Please try again later.',
        errorCode: 'RATE_LIMITED',
        rateLimited: true,
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : 60
      };
    }

    // 200 or 400 (bad request due to minimal content) both mean key is valid
    if (response.status === 200 || response.status === 400) {
      return { isValid: true, providerId: 'anthropic' };
    }

    return {
      isValid: false,
      providerId: 'anthropic',
      errorMessage: `Validation failed: ${response.statusText}`,
      errorCode: `HTTP_${response.status}`
    };
  } catch (error) {
    return {
      isValid: false,
      providerId: 'anthropic',
      errorMessage: error instanceof Error ? error.message : 'Network error',
      errorCode: 'NETWORK_ERROR'
    };
  }
}

/**
 * Validate a Google AI (Gemini) API key
 */
async function validateGoogleKey(apiKey: string): Promise<ValidationResult> {
  try {
    // List models endpoint is a good minimal check
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET' }
    );

    if (response.status === 400 || response.status === 403) {
      const data = await response.json().catch(() => ({}));
      return {
        isValid: false,
        providerId: 'google',
        errorMessage: data.error?.message || 'Invalid API key',
        errorCode: 'INVALID_KEY'
      };
    }

    if (response.status === 429) {
      return {
        isValid: false,
        providerId: 'google',
        errorMessage: 'Rate limited. Please try again later.',
        errorCode: 'RATE_LIMITED',
        rateLimited: true,
        retryAfter: 60
      };
    }

    if (!response.ok) {
      return {
        isValid: false,
        providerId: 'google',
        errorMessage: `Validation failed: ${response.statusText}`,
        errorCode: `HTTP_${response.status}`
      };
    }

    return { isValid: true, providerId: 'google' };
  } catch (error) {
    return {
      isValid: false,
      providerId: 'google',
      errorMessage: error instanceof Error ? error.message : 'Network error',
      errorCode: 'NETWORK_ERROR'
    };
  }
}

/**
 * Validate an ElevenLabs API key
 */
async function validateElevenLabsKey(apiKey: string): Promise<ValidationResult> {
  try {
    // Use the user info endpoint as a minimal check
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey
      }
    });

    if (response.status === 401) {
      return {
        isValid: false,
        providerId: 'elevenlabs',
        errorMessage: 'Invalid API key',
        errorCode: 'INVALID_KEY'
      };
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      return {
        isValid: false,
        providerId: 'elevenlabs',
        errorMessage: 'Rate limited. Please try again later.',
        errorCode: 'RATE_LIMITED',
        rateLimited: true,
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : 60
      };
    }

    if (!response.ok) {
      return {
        isValid: false,
        providerId: 'elevenlabs',
        errorMessage: `Validation failed: ${response.statusText}`,
        errorCode: `HTTP_${response.status}`
      };
    }

    return { isValid: true, providerId: 'elevenlabs' };
  } catch (error) {
    return {
      isValid: false,
      providerId: 'elevenlabs',
      errorMessage: error instanceof Error ? error.message : 'Network error',
      errorCode: 'NETWORK_ERROR'
    };
  }
}

/**
 * Validate a local LLM connection
 * Checks if Ollama or another OpenAI-compatible local server is running
 */
async function validateLocalLLMConnection(endpoint: string): Promise<ValidationResult> {
  try {
    // Try Ollama's native API first (/api/tags)
    const response = await fetch(`${endpoint}/api/tags`, {
      method: 'GET'
    });

    if (!response.ok) {
      return {
        isValid: false,
        providerId: 'local_llm',
        errorMessage: 'Local LLM server not responding',
        errorCode: 'SERVER_NOT_FOUND'
      };
    }

    return { isValid: true, providerId: 'local_llm' };
  } catch {
    return {
      isValid: false,
      providerId: 'local_llm',
      errorMessage: 'Cannot connect to local LLM server. Make sure Ollama is running.',
      errorCode: 'CONNECTION_FAILED'
    };
  }
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate an API key for a specific provider
 */
export async function validateApiKey(
  providerId: ProviderId,
  apiKey: string
): Promise<ValidationResult> {
  // Basic format validation
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      isValid: false,
      providerId,
      errorMessage: 'API key cannot be empty',
      errorCode: 'EMPTY_KEY'
    };
  }

  // Provider-specific validation
  switch (providerId) {
    case 'openrouter':
      // OpenRouter keys typically start with 'sk-or-'
      if (!apiKey.startsWith('sk-or-')) {
        return {
          isValid: false,
          providerId,
          errorMessage: 'OpenRouter keys should start with "sk-or-"',
          errorCode: 'INVALID_FORMAT'
        };
      }
      return validateOpenRouterKey(apiKey);

    case 'openai':
      // OpenAI keys start with 'sk-'
      if (!apiKey.startsWith('sk-')) {
        return {
          isValid: false,
          providerId,
          errorMessage: 'OpenAI keys should start with "sk-"',
          errorCode: 'INVALID_FORMAT'
        };
      }
      return validateOpenAIKey(apiKey);

    case 'anthropic':
      // Anthropic keys start with 'sk-ant-'
      if (!apiKey.startsWith('sk-ant-')) {
        return {
          isValid: false,
          providerId,
          errorMessage: 'Anthropic keys should start with "sk-ant-"',
          errorCode: 'INVALID_FORMAT'
        };
      }
      return validateAnthropicKey(apiKey);

    case 'google':
      // Google AI keys are typically 39 characters
      if (apiKey.length < 30) {
        return {
          isValid: false,
          providerId,
          errorMessage: 'Google AI key appears too short',
          errorCode: 'INVALID_FORMAT'
        };
      }
      return validateGoogleKey(apiKey);

    case 'elevenlabs':
      // ElevenLabs keys are typically 32 character hex strings
      if (apiKey.length < 20) {
        return {
          isValid: false,
          providerId,
          errorMessage: 'ElevenLabs API key appears too short',
          errorCode: 'INVALID_FORMAT'
        };
      }
      return validateElevenLabsKey(apiKey);

    case 'local_llm':
      // For local LLM, the "key" is actually the endpoint URL
      const endpoint = apiKey || PROVIDERS.local_llm.apiEndpoint;
      return validateLocalLLMConnection(endpoint);

    default:
      return {
        isValid: false,
        providerId,
        errorMessage: `Unknown provider: ${providerId}`,
        errorCode: 'UNKNOWN_PROVIDER'
      };
  }
}

/**
 * Validate all configured providers
 */
export async function validateAllProviders(
  providers: Array<{ providerId: ProviderId; apiKey: string }>
): Promise<ValidationResult[]> {
  const results = await Promise.all(
    providers.map(({ providerId, apiKey }) => validateApiKey(providerId, apiKey))
  );
  return results;
}

/**
 * Check if a key format looks valid without making an API call
 */
export function quickValidateKeyFormat(providerId: ProviderId, apiKey: string): boolean {
  if (!apiKey || apiKey.trim().length === 0) return false;

  switch (providerId) {
    case 'openrouter':
      return apiKey.startsWith('sk-or-');
    case 'openai':
      return apiKey.startsWith('sk-');
    case 'anthropic':
      return apiKey.startsWith('sk-ant-');
    case 'google':
      return apiKey.length >= 30;
    case 'elevenlabs':
      return apiKey.length >= 20;
    case 'local_llm':
      return true; // No format check for local
    default:
      return false;
  }
}

export default validateApiKey;
