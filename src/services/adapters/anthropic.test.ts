import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnthropicAdapter } from './anthropic';

// Mock fetch
global.fetch = vi.fn();

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new AnthropicAdapter('test-api-key');
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
    it('should return haiku for text generation', () => {
      expect(adapter.getModelForTask('text_generation')).toBe('claude-3-5-haiku-20241022');
    });

    it('should return haiku for code analysis', () => {
      expect(adapter.getModelForTask('code_analysis')).toBe('claude-3-5-haiku-20241022');
    });

    it('should return sonnet for image analysis', () => {
      expect(adapter.getModelForTask('image_analysis')).toBe('claude-sonnet-4-20250514');
    });

    it('should return null for unsupported tasks', () => {
      expect(adapter.getModelForTask('tts')).toBe(null);
      expect(adapter.getModelForTask('video')).toBe(null);
      expect(adapter.getModelForTask('realtime_voice')).toBe(null);
    });
  });

  describe('generateText', () => {
    it('should generate text with basic prompt', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Hello there!' }],
          usage: { input_tokens: 10, output_tokens: 20 }
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await adapter.generateText('Hello');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'x-api-key': 'test-api-key',
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 4096
          })
        })
      );
      expect(result.text).toBe('Hello there!');
    });

    it('should use sonnet model with thinking', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Thinking response' }],
          usage: { input_tokens: 10, output_tokens: 20 }
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      await adapter.generateText('Hello', { useThinking: true });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 4096,
            stop_sequences: ['\n\nHuman:']
          })
        })
      );
    });

    it('should handle image input', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'I see a cat' }],
          usage: { input_tokens: 10, output_tokens: 20 }
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      await adapter.generateText('Describe this', {
        imagePart: 'base64-image-data',
        mimeType: 'image/png'
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'base64-image-data'
                  }
                },
                { type: 'text', text: 'Describe this' }
              ]
            }],
            max_tokens: 4096
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
          content: [{ type: 'text', text: '{"name": "John", "age": 30}' }]
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const schema = { type: 'object', properties: { name: { type: 'string' } } };
      const result = await adapter.generateStructuredOutput('Generate a name', schema);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 4096,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `You must respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\nRespond ONLY with valid JSON, no explanations.`
                  }
                ]
              },
              { role: 'assistant', content: [{ type: 'text', text: '' }] },
              { role: 'user', content: [{ type: 'text', text: 'Generate a name' }] }
            ]
          })
        })
      );
      expect(result).toEqual({ name: 'John', age: 30 });
    });
  });
});