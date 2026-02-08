import { describe, it, expect, beforeEach } from 'vitest';
import {
  BaseLLMAdapter,
  TextGenerationOptions,
  TextGenerationResult,
  StructuredOutputOptions,
  TTSOptions,
  TTSResult,
  VideoGenerationOptions,
  VideoResult,
  RealtimeConfig,
  RealtimeConnection,
  AdapterError,
  RateLimitError,
  AuthenticationError,
  UnsupportedCapabilityError,
  parseAPIError,
  base64ToUint8Array,
  arrayBufferToBase64
} from './base';

// Mock abstract base class for testing
class MockAdapter extends BaseLLMAdapter {
  readonly providerId: string = 'mock';
  readonly name: string = 'Mock Provider';

  supportsCapability(capability: string): boolean {
    return capability === 'text_generation';
  }

  async generateText(
    prompt: string,
    options?: TextGenerationOptions
  ): Promise<TextGenerationResult> {
    return {
      text: `Response to: ${prompt}`,
      usage: {
        inputTokens: 10,
        outputTokens: 20
      }
    };
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: object,
    options?: StructuredOutputOptions
  ): Promise<T> {
    return { result: `structured response for ${prompt}` } as T;
  }

  getModelForTask(taskType: string): string | null {
    return 'mock-model';
  }
}

describe('BaseAdapter', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter('test-api-key');
  });

  describe('constructor', () => {
    it('should store API key', () => {
      expect(adapter['apiKey']).toBe('test-api-key');
    });
  });

  describe('supportsCapability', () => {
    it('should return true for supported capability', () => {
      expect(adapter.supportsCapability('text_generation')).toBe(true);
    });

    it('should return false for unsupported capability', () => {
      expect(adapter.supportsCapability('tts')).toBe(false);
    });
  });

  describe('generateText', () => {
    it('should generate text response', async () => {
      const result = await adapter.generateText('Hello');
      expect(result.text).toBe('Response to: Hello');
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 20
      });
    });

    it('should handle options', async () => {
      const options: TextGenerationOptions = {
        temperature: 0.7,
        maxTokens: 100,
        systemPrompt: 'You are a helpful assistant'
      };
      const result = await adapter.generateText('Hello', options);
      expect(result.text).toBe('Response to: Hello');
    });
  });

  describe('generateStructuredOutput', () => {
    it('should generate structured output', async () => {
      const schema = { type: 'object', properties: { name: { type: 'string' } } };
      const result = await adapter.generateStructuredOutput(
        'Generate a name',
        schema
      );
      expect(result).toEqual({ result: 'structured response for Generate a name' });
    });
  });

  describe('generateSpeech', () => {
    it('should throw UnsupportedCapabilityError for TTS', async () => {
      await expect(adapter.generateSpeech('Hello')).rejects.toThrow(
        UnsupportedCapabilityError
      );
    });
  });

  describe('generateVideo', () => {
    it('should throw UnsupportedCapabilityError for video', async () => {
      await expect(adapter.generateVideo('Hello')).rejects.toThrow(
        UnsupportedCapabilityError
      );
    });
  });

  describe('connectRealtime', () => {
    it('should throw UnsupportedCapabilityError for realtime', async () => {
      const config: RealtimeConfig = { onOpen: () => {} };
      await expect(adapter.connectRealtime(config)).rejects.toThrow(
        UnsupportedCapabilityError
      );
    });
  });

  describe('getModelForTask', () => {
    it('should return model for task', () => {
      expect(adapter.getModelForTask('text_generation')).toBe('mock-model');
    });
  });

  describe('getAvailableVoices', () => {
    it('should return empty array by default', () => {
      expect(adapter.getAvailableVoices()).toEqual([]);
    });
  });
});

describe('AdapterError', () => {
  it('should create error with message and code', () => {
    const error = new AdapterError('Test error', 'TEST_CODE', 'mock');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.providerId).toBe('mock');
    expect(error.isRetryable).toBe(false);
    expect(error.retryAfter).toBeUndefined();
  });

  it('should be retryable when specified', () => {
    const error = new AdapterError(
      'Test error',
      'TEST_CODE',
      'mock',
      true,
      60
    );
    expect(error.isRetryable).toBe(true);
    expect(error.retryAfter).toBe(60);
  });
});

describe('RateLimitError', () => {
  it('should create rate limit error', () => {
    const error = new RateLimitError('mock', 30);
    expect(error.message).toBe('Rate limit exceeded for mock');
    expect(error.code).toBe('RATE_LIMIT');
    expect(error.isRetryable).toBe(true);
    expect(error.retryAfter).toBe(30);
  });

  it('should use default retry after if not specified', () => {
    const error = new RateLimitError('mock');
    expect(error.retryAfter).toBe(60);
  });
});

describe('AuthenticationError', () => {
  it('should create authentication error with default message', () => {
    const error = new AuthenticationError('mock');
    expect(error.message).toBe('Authentication failed for mock');
    expect(error.code).toBe('AUTH_ERROR');
    expect(error.isRetryable).toBe(false);
  });

  it('should create authentication error with custom message', () => {
    const error = new AuthenticationError('mock', 'Custom auth error');
    expect(error.message).toBe('Custom auth error');
  });
});

describe('UnsupportedCapabilityError', () => {
  it('should create unsupported capability error', () => {
    const error = new UnsupportedCapabilityError('mock', 'tts');
    expect(error.message).toBe('mock does not support tts');
    expect(error.code).toBe('UNSUPPORTED');
    expect(error.isRetryable).toBe(false);
  });
});

describe('parseAPIError', () => {
  it('should parse authentication error (401)', () => {
    const error = parseAPIError('mock', 401, { error: { message: 'Invalid API key' } });
    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toBe('Invalid API key');
  });

  it('should parse authentication error (403)', () => {
    const error = parseAPIError('mock', 403, { error: { message: 'Access denied' } });
    expect(error).toBeInstanceOf(AuthenticationError);
  });

  it('should parse rate limit error (429)', () => {
    const error = parseAPIError('mock', 429, { error: { retry_after: '30' } });
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfter).toBe(30);
  });

  it('should parse generic adapter error', () => {
    const error = parseAPIError('mock', 500, { error: { message: 'Server error', code: 'SERVER_ERROR' } });
    expect(error).toBeInstanceOf(AdapterError);
    expect(error.code).toBe('SERVER_ERROR');
    expect(error.isRetryable).toBe(true);
  });

  it('should use default message if no error in body', () => {
    const error = parseAPIError('mock', 400, {});
    expect(error.message).toBe('API error: 400');
  });
});

describe('base64ToUint8Array', () => {
  it('should convert base64 to Uint8Array', () => {
    const base64 = 'SGVsbG8gdGhlcmU=';
    const result = base64ToUint8Array(base64);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(12);
  });

  it('should handle empty string', () => {
    const result = base64ToUint8Array('');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });
});

describe('arrayBufferToBase64', () => {
  it('should convert ArrayBuffer to base64', () => {
    const buffer = new TextEncoder().encode('Hello there');
    const result = arrayBufferToBase64(buffer);
    expect(result).toBe('SGVsbG8gdGhlcmU=');
  });

  it('should handle empty buffer', () => {
    const buffer = new ArrayBuffer(0);
    const result = arrayBufferToBase64(buffer);
    expect(result).toBe('');
  });
});