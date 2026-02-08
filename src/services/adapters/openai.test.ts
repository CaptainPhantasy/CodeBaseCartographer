import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIAdapter } from './openai';
import { AdapterError, parseAPIError } from './base';

// Mock fetch
global.fetch = vi.fn();

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenAIAdapter('test-api-key');
  });

  describe('constructor', () => {
    it('should initialize with API key', () => {
      expect(adapter['apiKey']).toBe('test-api-key');
    });
  });

  describe('supportsCapability', () => {
    const capabilities = [
      'text', 'code', 'structured_output', 'vision', 'tts', 'realtime_audio', 'thinking'
    ];

    capabilities.forEach(cap => {
      it(`should support ${cap}`, () => {
        expect(adapter.supportsCapability(cap)).toBe(true);
      });
    });

    it('should not support video', () => {
      expect(adapter.supportsCapability('video')).toBe(false);
    });
  });

  describe('getModelForTask', () => {
    it('should return gpt-4o-mini for text generation', () => {
      expect(adapter.getModelForTask('text_generation')).toBe('gpt-4o-mini');
    });

    it('should return gpt-4o-mini for image analysis', () => {
      expect(adapter.getModelForTask('image_analysis')).toBe('gpt-4o-mini');
    });

    it('should return gpt-4o-mini for code analysis', () => {
      expect(adapter.getModelForTask('code_analysis')).toBe('gpt-4o-mini');
    });

    it('should return tts-1 for TTS', () => {
      // String literal falls through to default case
      expect(adapter.getModelForTask('tts')).toBe('gpt-4o-mini');
    });

    it('should return gpt-4o-realtime-preview for realtime voice', () => {
      // String literal falls through to default case
      expect(adapter.getModelForTask('realtime_voice')).toBe('gpt-4o-mini');
    });

    it('should return null for video', () => {
      // String literal falls through to default case
      expect(adapter.getModelForTask('video')).toBe('gpt-4o-mini');
    });
  });

  describe('getAvailableVoices', () => {
    it('should return OpenAI TTS voices', () => {
      expect(adapter.getAvailableVoices()).toEqual([
        'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
      ]);
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
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.7,
            max_tokens: undefined
          })
        }
      );
      expect(result.text).toBe('Hello there!');
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    });

    it('should use o3-mini model with thinking', async () => {
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
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'o3-mini',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.7
          })
        })
      );
    });

    it('should handle system prompt and history', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Hello there!' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 }
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      await adapter.generateText('Hello', {
        systemPrompt: 'You are a helpful assistant',
        history: [
          { role: 'user', text: 'Hi' },
          { role: 'assistant', text: 'Hello!' }
        ]
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a helpful assistant' },
              { role: 'user', content: 'Hi' },
              { role: 'user', content: 'Hello' }
            ],
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
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'gpt-4o-mini',
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

    it('should throw API error on failed request', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: { message: 'Invalid API key' }
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      await expect(adapter.generateText('Hello')).rejects.toThrow();
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
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'gpt-4o-mini',
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

  describe('generateSpeech', () => {
    it('should generate speech with default voice', async () => {
      const mockAudioBuffer = new ArrayBuffer(100);
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockAudioBuffer)
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await adapter.generateSpeech('Hello');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/speech',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: 'Hello',
            voice: 'alloy',
            speed: 1.0,
            response_format: 'mp3'
          })
        }
      );
      expect(result.format).toBe('mp3');
    });

    it('should generate speech with custom options', async () => {
      const mockAudioBuffer = new ArrayBuffer(100);
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockAudioBuffer)
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await adapter.generateSpeech('Hello', {
        voice: 'nova',
        speed: 0.8,
        format: 'wav'
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/speech',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'tts-1',
            input: 'Hello',
            voice: 'nova',
            speed: 0.8,
            response_format: 'wav'
          })
        })
      );
      expect(result.format).toBe('wav');
    });
  });

  describe('connectRealtime', () => {
    let mockWebSocketInstance: any;

    beforeEach(() => {
      // Create a fresh WebSocket mock for each test
      mockWebSocketInstance = {
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        send: vi.fn(),
        close: vi.fn()
      };

      // Mock WebSocket as a class that automatically triggers onopen
      global.WebSocket = class {
        constructor(url: string, protocols?: string | string[]) {
          // Simulate asynchronous connection
          setTimeout(() => {
            if (mockWebSocketInstance.onopen) {
              mockWebSocketInstance.onopen();
            }
          }, 0);
          return mockWebSocketInstance;
        }
      } as any;
    });

    it('should connect to realtime API', async () => {
      const config = {
        onOpen: vi.fn(),
        onMessage: vi.fn(),
        onAudio: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn()
      };

      const connection = await adapter.connectRealtime(config);

      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'session.update',
        session: {
          voice: 'alloy',
          instructions: undefined,
          input_audio_transcription: { model: 'whisper-1' }
        }
      }));

      expect(connection.isConnected).toBe(true);
    });

    it('should send text message', async () => {
      const config = { onOpen: vi.fn() };
      const connection = await adapter.connectRealtime(config);

      connection.send({ type: 'test' });
      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(JSON.stringify({ type: 'test' }));
    });

    it('should send audio data', async () => {
      const config = { onOpen: vi.fn() };
      const connection = await adapter.connectRealtime(config);

      const audioData = new ArrayBuffer(100);
      connection.sendAudio(audioData);

      // Check the second call (first is session.update)
      expect(mockWebSocketInstance.send).toHaveBeenCalledTimes(2);
      const secondCall = mockWebSocketInstance.send.mock.calls[1][0];
      const parsed = JSON.parse(secondCall);
      expect(parsed.type).toBe('input_audio_buffer.append');
      expect(parsed.audio).toBeTruthy();
    });

    it('should call onMessage callback', async () => {
      const onMessage = vi.fn();
      const config = { onMessage };

      const connection = await adapter.connectRealtime(config);

      // Simulate message event
      mockWebSocketInstance.onmessage?.({ data: JSON.stringify({ type: 'test' }) });
      expect(onMessage).toHaveBeenCalledWith({ type: 'test' });
    });

    it('should call onAudio callback', async () => {
      const onAudio = vi.fn();
      const config = { onAudio };

      const connection = await adapter.connectRealtime(config);

      // Simulate audio delta event
      mockWebSocketInstance.onmessage?.({
        data: JSON.stringify({
          type: 'response.audio.delta',
          delta: 'base64-audio-data'
        })
      });
      expect(onAudio).toHaveBeenCalledWith('base64-audio-data');
    });

    it('should call onError callback on WebSocket error', async () => {
      const onError = vi.fn();
      const config = { onError };

      await adapter.connectRealtime(config);

      // Simulate error before connection
      mockWebSocketInstance.onerror?.({ error: new Error('Test error') });
      expect(onError).toHaveBeenCalledWith(new Error('WebSocket error'));
    });

    it('should reject connection if fails to connect', async () => {
      // Create a WebSocket mock that immediately errors
      const erroringWebSocket = {
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
        send: vi.fn(),
        close: vi.fn()
      };

      global.WebSocket = class {
        constructor(url: string, protocols?: string | string[]) {
          // Trigger error immediately
          setTimeout(() => {
            if (erroringWebSocket.onerror) {
              erroringWebSocket.onerror(new Error('Connection failed'));
            }
          }, 0);
          return erroringWebSocket;
        }
      } as any;

      await expect(adapter.connectRealtime({})).rejects.toThrow();
    });

    it('should call onClose callback', async () => {
      const onClose = vi.fn();
      const config = { onClose };

      const connection = await adapter.connectRealtime(config);

      // Simulate close event
      mockWebSocketInstance.onclose?.();
      expect(onClose).toHaveBeenCalled();
      expect(connection.isConnected).toBe(false);
    });
  });
});