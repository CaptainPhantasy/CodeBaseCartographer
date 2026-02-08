import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenRouterAdapter } from './openrouter';

// Mock fetch
global.fetch = vi.fn();

describe('OpenRouterAdapter', () => {
  let adapter: OpenRouterAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenRouterAdapter('test-api-key');
  });

  describe('constructor', () => {
    it('should initialize with API key', () => {
      expect(adapter['apiKey']).toBe('test-api-key');
    });

    it('should support custom model', () => {
      const customAdapter = new OpenRouterAdapter('test-api-key', 'custom-model');
      expect(customAdapter['customModel']).toBe('custom-model');
    });
  });

  describe('supportsCapability', () => {
    const capabilities = ['text', 'code', 'structured_output', 'vision', 'thinking'];

    capabilities.forEach(cap => {
      it(`should support ${cap}`, () => {
        expect(adapter.supportsCapability(cap)).toBe(true);
      });
    });

    it('should not support tts', () => {
      expect(adapter.supportsCapability('tts')).toBe(false);
    });

    it('should not support video', () => {
      expect(adapter.supportsCapability('video')).toBe(false);
    });

    it('should not support realtime_audio', () => {
      expect(adapter.supportsCapability('realtime_audio')).toBe(false);
    });
  });

  describe('getModelForTask', () => {
    it('should return fast model for text generation', () => {
      expect(adapter.getModelForTask('text_generation')).toBe('openai/gpt-4o-mini');
    });

    it('should return fast model for code analysis', () => {
      expect(adapter.getModelForTask('code_analysis')).toBe('openai/gpt-4o-mini');
    });

    it('should return balanced model for image analysis', () => {
      expect(adapter.getModelForTask('image_analysis')).toBe('anthropic/claude-3.5-haiku-20241022');
    });

    it('should return null for unsupported tasks', () => {
      expect(adapter.getModelForTask('tts')).toBe(null);
      expect(adapter.getModelForTask('video')).toBe(null);
      expect(adapter.getModelForTask('realtime_voice')).toBe(null);
    });

    it('should use custom model if set', () => {
      adapter.setModel('custom-model');
      expect(adapter.getModelForTask('text_generation')).toBe('custom-model');
    });
  });

  describe('setModel', () => {
    it('should set custom model', () => {
      adapter.setModel('new-custom-model');
      expect(adapter['customModel']).toBe('new-custom-model');
    });
  });

  describe('generateText', () => {
    it('should generate text with basic prompt', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Hello there!' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 }
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await adapter.generateText('Hello');

      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Codebase Cartographer'
          },
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.7,
            max_tokens: undefined
          })
        })
      );
      expect(result.text).toBe('Hello there!');
    });

    it('should use thinking model when specified', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Thinking response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 }
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      await adapter.generateText('Hello', { useThinking: true });

      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'anthropic/claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.7
          })
        })
      );
    });

    it('should use custom model if set', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Custom model response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 }
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      adapter.setModel('custom-model');
      await adapter.generateText('Hello');

      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'custom-model',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.7
          })
        })
      );
    });

    it('should handle image input', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'I see a cat' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 }
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      await adapter.generateText('Describe this', {
        imagePart: 'base64-image-data',
        mimeType: 'image/png'
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: 'data:image/png;base64,base64-image-data' } },
                { type: 'text', text: 'Describe this' }
              ]
            }],
            temperature: 0.7
          })
        })
      );
    });
  });

  describe('generateStructuredOutput', () => {
    it('should generate structured output', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{"name": "John", "age": 30}' } }]
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const schema = { type: 'object', properties: { name: { type: 'string' } } };
      const result = await adapter.generateStructuredOutput('Generate a name', schema);

      expect(fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You must respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\nRespond ONLY with valid JSON, no explanations.`
              },
              { role: 'user', content: 'Generate a name' }
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' }
          })
        })
      );
      expect(result).toEqual({ name: 'John', age: 30 });
    });
  });
});