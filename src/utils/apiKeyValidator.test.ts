import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateApiKey,
  validateAllProviders,
  quickValidateKeyFormat,
  ValidationResult
} from './apiKeyValidator';

// Mock fetch
global.fetch = vi.fn();

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OpenRouter validation', () => {
    it('should validate valid OpenRouter key', async () => {
      const mockResponse = {
        ok: true,
        status: 200
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('openrouter', 'sk-or-test123');

      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/auth/key',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer sk-or-test123',
            'HTTP-Referer': expect.any(String),
            'X-Title': 'Codebase Cartographer'
          }
        })
      );
      expect(result).toEqual({ isValid: true, providerId: 'openrouter' });
    });

    it('should detect invalid OpenRouter key', async () => {
      const mockResponse = {
        ok: false,
        status: 401
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('openrouter', 'sk-or-invalid');

      expect(result).toEqual({
        isValid: false,
        providerId: 'openrouter',
        errorMessage: 'Invalid API key',
        errorCode: 'INVALID_KEY'
      });
    });

    it('should detect rate limiting', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        headers: {
          get: vi.fn().mockReturnValue('30')
        }
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('openrouter', 'sk-or-test123');

      expect(result).toEqual({
        isValid: false,
        providerId: 'openrouter',
        errorMessage: 'Rate limited. Please try again later.',
        errorCode: 'RATE_LIMITED',
        rateLimited: true,
        retryAfter: 30
      });
    });

    it('should reject invalid format', async () => {
      const result = await validateApiKey('openrouter', 'invalid-key');

      expect(result).toEqual({
        isValid: false,
        providerId: 'openrouter',
        errorMessage: 'OpenRouter keys should start with "sk-or-"',
        errorCode: 'INVALID_FORMAT'
      });
    });
  });

  describe('OpenAI validation', () => {
    it('should validate valid OpenAI key', async () => {
      const mockResponse = {
        ok: true,
        status: 200
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('openai', 'sk-test123');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer sk-test123'
          }
        })
      );
      expect(result).toEqual({ isValid: true, providerId: 'openai' });
    });

    it('should detect invalid OpenAI key', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ error: { message: 'Invalid API key' } })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('openai', 'sk-invalid');

      expect(result).toEqual({
        isValid: false,
        providerId: 'openai',
        errorMessage: 'Invalid API key',
        errorCode: 'INVALID_KEY'
      });
    });

    it('should reject invalid format', async () => {
      const result = await validateApiKey('openai', 'invalid-key');

      expect(result).toEqual({
        isValid: false,
        providerId: 'openai',
        errorMessage: 'OpenAI keys should start with "sk-"',
        errorCode: 'INVALID_FORMAT'
      });
    });
  });

  describe('Anthropic validation', () => {
    it('should validate valid Anthropic key', async () => {
      const mockResponse = {
        ok: true,
        status: 200
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('anthropic', 'sk-ant-test123');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'sk-ant-test123',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }]
          })
        })
      );
      expect(result).toEqual({ isValid: true, providerId: 'anthropic' });
    });

    it('should accept 400 status as valid (minimal content error)', async () => {
      const mockResponse = {
        ok: false,
        status: 400
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('anthropic', 'sk-ant-test123');

      expect(result).toEqual({ isValid: true, providerId: 'anthropic' });
    });

    it('should reject invalid format', async () => {
      const result = await validateApiKey('anthropic', 'invalid-key');

      expect(result).toEqual({
        isValid: false,
        providerId: 'anthropic',
        errorMessage: 'Anthropic keys should start with "sk-ant-"',
        errorCode: 'INVALID_FORMAT'
      });
    });
  });

  describe('Google validation', () => {
    it('should validate valid Google key', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ models: [] })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('google', 'test123456789012345678901234567890');

      expect(fetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models?key=test123456789012345678901234567890',
        { method: 'GET' }
      );
      expect(result).toEqual({ isValid: true, providerId: 'google' });
    });

    it('should reject invalid Google key', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ error: { message: 'Invalid API key' } })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('google', 'invalid');

      expect(result).toEqual({
        isValid: false,
        providerId: 'google',
        errorMessage: 'Invalid API key',
        errorCode: 'INVALID_KEY'
      });
    });

    it('should reject invalid format (too short)', async () => {
      const result = await validateApiKey('google', 'short');

      expect(result).toEqual({
        isValid: false,
        providerId: 'google',
        errorMessage: 'Google AI key appears too short',
        errorCode: 'INVALID_FORMAT'
      });
    });
  });

  describe('ElevenLabs validation', () => {
    it('should validate valid ElevenLabs key', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ subscription: { type: 'starter' } })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('elevenlabs', 'test1234567890');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/user',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'xi-api-key': 'test1234567890'
          }
        })
      );
      expect(result).toEqual({ isValid: true, providerId: 'elevenlabs' });
    });

    it('should detect invalid ElevenLabs key', async () => {
      const mockResponse = {
        ok: false,
        status: 401
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('elevenlabs', 'invalid');

      expect(result).toEqual({
        isValid: false,
        providerId: 'elevenlabs',
        errorMessage: 'Invalid API key',
        errorCode: 'INVALID_KEY'
      });
    });

    it('should reject invalid format (too short)', async () => {
      const result = await validateApiKey('elevenlabs', 'short');

      expect(result).toEqual({
        isValid: false,
        providerId: 'elevenlabs',
        errorMessage: 'ElevenLabs API key appears too short',
        errorCode: 'INVALID_FORMAT'
      });
    });
  });

  describe('Local LLM validation', () => {
    it('should validate local LLM connection', async () => {
      const mockResponse = {
        ok: true,
        status: 200
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('local_llm', 'http://localhost:11434');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        { method: 'GET' }
      );
      expect(result).toEqual({ isValid: true, providerId: 'local_llm' });
    });

    it('should detect local LLM not responding', async () => {
      const mockResponse = {
        ok: false,
        status: 404
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await validateApiKey('local_llm', 'http://localhost:11434');

      expect(result).toEqual({
        isValid: false,
        providerId: 'local_llm',
        errorMessage: 'Local LLM server not responding',
        errorCode: 'SERVER_NOT_FOUND'
      });
    });

    it('should detect connection failure', async () => {
      (fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await validateApiKey('local_llm', 'http://localhost:11434');

      expect(result).toEqual({
        isValid: false,
        providerId: 'local_llm',
        errorMessage: 'Cannot connect to local LLM server. Make sure Ollama is running.',
        errorCode: 'CONNECTION_FAILED'
      });
    });
  });

  describe('Unknown provider', () => {
    it('should reject unknown provider', async () => {
      const result = await validateApiKey('unknown' as any, 'test');

      expect(result).toEqual({
        isValid: false,
        providerId: 'unknown',
        errorMessage: 'Unknown provider: unknown',
        errorCode: 'UNKNOWN_PROVIDER'
      });
    });
  });

  describe('Empty key', () => {
    it('should reject empty key', async () => {
      const result = await validateApiKey('openai', '');

      expect(result).toEqual({
        isValid: false,
        providerId: 'openai',
        errorMessage: 'API key cannot be empty',
        errorCode: 'EMPTY_KEY'
      });
    });

    it('should reject whitespace-only key', async () => {
      const result = await validateApiKey('openai', '   ');

      expect(result).toEqual({
        isValid: false,
        providerId: 'openai',
        errorMessage: 'API key cannot be empty',
        errorCode: 'EMPTY_KEY'
      });
    });
  });
});

describe('validateAllProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate all providers', async () => {
    const providers = [
      { providerId: 'openai', apiKey: 'sk-test123' },
      { providerId: 'openrouter', apiKey: 'sk-or-test123' }
    ];

    const mockResponse = {
      ok: true,
      status: 200
    };
    (fetch as any).mockResolvedValue(mockResponse);

    const results = await validateAllProviders(providers);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ isValid: true, providerId: 'openai' });
    expect(results[1]).toEqual({ isValid: true, providerId: 'openrouter' });
  });

  it('should handle partial failures', async () => {
    const providers = [
      { providerId: 'openai', apiKey: 'sk-test123' },
      { providerId: 'openrouter', apiKey: 'invalid-key' }
    ];

    // Mock fetch to return different responses
    (fetch as any)
      .mockResolvedValueOnce({ ok: true, status: 200 }) // OpenAI success
      .mockResolvedValueOnce({ ok: false, status: 401 }); // OpenRouter failure

    const results = await validateAllProviders(providers);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ isValid: true, providerId: 'openai' });
    expect(results[1]).toEqual({
      isValid: false,
      providerId: 'openrouter',
      errorMessage: 'Invalid API key',
      errorCode: 'INVALID_KEY'
    });
  });
});

describe('quickValidateKeyFormat', () => {
  it('should validate OpenRouter key format', () => {
    expect(quickValidateKeyFormat('openrouter', 'sk-or-test123')).toBe(true);
    expect(quickValidateKeyFormat('openrouter', 'sk-test123')).toBe(false);
    expect(quickValidateKeyFormat('openrouter', '')).toBe(false);
  });

  it('should validate OpenAI key format', () => {
    expect(quickValidateKeyFormat('openai', 'sk-test123')).toBe(true);
    expect(quickValidateKeyFormat('openai', 'test123')).toBe(false);
    expect(quickValidateKeyFormat('openai', '')).toBe(false);
  });

  it('should validate Anthropic key format', () => {
    expect(quickValidateKeyFormat('anthropic', 'sk-ant-test123')).toBe(true);
    expect(quickValidateKeyFormat('anthropic', 'sk-test123')).toBe(false);
    expect(quickValidateKeyFormat('anthropic', '')).toBe(false);
  });

  it('should validate Google key format', () => {
    expect(quickValidateKeyFormat('google', 'test123456789012345678901234567890')).toBe(true);
    expect(quickValidateKeyFormat('google', 'short')).toBe(false);
    expect(quickValidateKeyFormat('google', '')).toBe(false);
  });

  it('should validate ElevenLabs key format', () => {
    expect(quickValidateKeyFormat('elevenlabs', 'test1234567890')).toBe(true);
    expect(quickValidateKeyFormat('elevenlabs', 'short')).toBe(false);
    expect(quickValidateKeyFormat('elevenlabs', '')).toBe(false);
  });

  it('should validate local LLM (always true)', () => {
    expect(quickValidateKeyFormat('local_llm', 'any-string')).toBe(true);
    expect(quickValidateKeyFormat('local_llm', '')).toBe(true);
  });

  it('should reject unknown provider', () => {
    expect(quickValidateKeyFormat('unknown' as any, 'test')).toBe(false);
  });
});