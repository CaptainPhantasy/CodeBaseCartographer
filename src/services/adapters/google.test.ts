import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleAdapter } from './google';
import { GoogleGenAI, Modality } from '@google/genai';
import { AdapterError } from './base';
import { TaskType } from '../../types/capabilities';

// Create mock functions outside so they can be referenced in tests
const mockChatsCreate = vi.fn();
const mockGenerateContent = vi.fn();
const mockGenerateVideos = vi.fn();
const mockGetVideosOperation = vi.fn();
const mockLiveConnect = vi.fn();

// Mock @google/genai
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor() {
      return {
        chats: {
          create: mockChatsCreate
        },
        models: {
          generateContent: mockGenerateContent,
          generateVideos: mockGenerateVideos
        },
        operations: {
          getVideosOperation: mockGetVideosOperation
        },
        live: {
          connect: mockLiveConnect
        }
      };
    }
  },
  Modality: {
    AUDIO: 'AUDIO'
  },
  Type: {
    TEXT: 'TEXT'
  }
}));

describe('GoogleAdapter', () => {
  let adapter: GoogleAdapter;
  let mockAI: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAI = new GoogleGenAI();
    adapter = new GoogleAdapter('test-api-key');
  });

  describe('constructor', () => {
    it('should initialize with API key', () => {
      expect(adapter['apiKey']).toBe('test-api-key');
    });
  });

  describe('supportsCapability', () => {
    const capabilities = [
      'text', 'code', 'structured_output', 'vision',
      'tts', 'video', 'realtime_audio', 'thinking', 'search_grounding'
    ];

    capabilities.forEach(cap => {
      it(`should support ${cap}`, () => {
        expect(adapter.supportsCapability(cap)).toBe(true);
      });
    });

    it('should not support unsupported capability', () => {
      expect(adapter.supportsCapability('unsupported')).toBe(false);
    });
  });

  describe('getModelForTask', () => {
    it('should return flash model for text generation', () => {
      expect(adapter.getModelForTask(TaskType.TEXT_GENERATION)).toBe('gemini-3-flash-preview');
    });

    it('should return flash model for image analysis', () => {
      expect(adapter.getModelForTask(TaskType.IMAGE_ANALYSIS)).toBe('gemini-3-flash-preview');
    });

    it('should return flash model for code analysis', () => {
      expect(adapter.getModelForTask(TaskType.CODE_ANALYSIS)).toBe('gemini-3-flash-preview');
    });

    it('should return tts model for TTS', () => {
      expect(adapter.getModelForTask(TaskType.TTS)).toBe('gemini-2.5-flash-preview-tts');
    });

    it('should return video model for video', () => {
      expect(adapter.getModelForTask(TaskType.VIDEO)).toBe('veo-3.1-fast-generate-preview');
    });

    it('should return live audio model for realtime voice', () => {
      expect(adapter.getModelForTask(TaskType.REALTIME_VOICE)).toBe('gemini-2.5-flash-native-audio-preview-12-2025');
    });
  });

  describe('getAvailableVoices', () => {
    it('should return Google TTS voices', () => {
      expect(adapter.getAvailableVoices()).toEqual([
        'Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck', 'Leda'
      ]);
    });
  });

  describe('generateText', () => {
    it('should generate text with basic prompt', async () => {
      const mockChat = {
        sendMessage: vi.fn().mockResolvedValue({
          text: 'Hello there!'
        })
      };
      mockAI.chats.create.mockReturnValue(mockChat);

      const result = await adapter.generateText('Hello');

      expect(mockAI.chats.create).toHaveBeenCalledWith({
        model: 'gemini-3-flash-preview',
        history: [],
        config: {}
      });
      expect(mockChat.sendMessage).toHaveBeenCalledWith({
        message: 'Hello'
      });
      expect(result.text).toBe('Hello there!');
    });

    it('should use pro model with thinking', async () => {
      const mockChat = {
        sendMessage: vi.fn().mockResolvedValue({
          text: 'Hello there!'
        })
      };
      mockAI.chats.create.mockReturnValue(mockChat);

      await adapter.generateText('Hello', { useThinking: true });

      expect(mockAI.chats.create).toHaveBeenCalledWith({
        model: 'gemini-3-pro-preview',
        history: [],
        config: {
          thinkingConfig: { thinkingBudget: 16000 }
        }
      });
    });

    it('should use google search with flash model', async () => {
      const mockChat = {
        sendMessage: vi.fn().mockResolvedValue({
          text: 'Hello there!',
          candidates: [{
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: 'https://example.com' } }
              ]
            }
          }]
        })
      };
      mockAI.chats.create.mockReturnValue(mockChat);

      const result = await adapter.generateText('Hello', { useSearch: true });

      expect(result.groundingUrls).toEqual(['https://example.com']);
    });

    it('should handle image input', async () => {
      const mockChat = {
        sendMessage: vi.fn().mockResolvedValue({
          text: 'I see a cat'
        })
      };
      mockAI.chats.create.mockReturnValue(mockChat);

      await adapter.generateText('Describe this', {
        imagePart: 'base64-image-data',
        mimeType: 'image/png'
      });

      expect(mockAI.chats.create).toHaveBeenCalledWith({
        model: 'gemini-3-flash-preview',
        history: [],
        config: {}
      });
      expect(mockChat.sendMessage).toHaveBeenCalledWith({
        message: [
          { inlineData: { data: 'base64-image-data', mimeType: 'image/png' } },
          { text: 'Describe this' }
        ]
      });
    });

    it('should handle conversation history', async () => {
      const mockChat = {
        sendMessage: vi.fn().mockResolvedValue({
          text: 'Hello there!'
        })
      };
      mockAI.chats.create.mockReturnValue(mockChat);

      await adapter.generateText('Hello', {
        history: [
          { role: 'user', text: 'Hi' },
          { role: 'assistant', text: 'Hello!' }
        ]
      });

      expect(mockAI.chats.create).toHaveBeenCalledWith({
        model: 'gemini-3-flash-preview',
        history: [{ role: 'user', parts: [{ text: 'Hi' }] }],
        config: {}
      });
    });
  });

  describe('generateStructuredOutput', () => {
    it('should generate structured output', async () => {
      const mockResponse = {
        text: '{"name": "John", "age": 30}'
      };
      mockAI.models.generateContent.mockResolvedValue(mockResponse);

      const schema = { type: 'object', properties: { name: { type: 'string' } } };
      const result = await adapter.generateStructuredOutput('Generate a name', schema);

      expect(mockAI.models.generateContent).toHaveBeenCalledWith({
        model: 'gemini-3-flash-preview',
        contents: 'Generate a name',
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });
      expect(result).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('generateSpeech', () => {
    it('should generate speech with default voice', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              inlineData: {
                data: 'base64-audio-data'
              }
            }]
          }
        }]
      };
      mockAI.models.generateContent.mockResolvedValue(mockResponse);

      const result = await adapter.generateSpeech('Hello');

      expect(mockAI.models.generateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash-preview-tts',
        contents: { parts: [{ text: 'Hello' }] },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }
            }
          }
        }
      });
      expect(result.audioData).toBe('base64-audio-data');
      expect(result.format).toBe('wav');
    });

    it('should generate speech with custom voice', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              inlineData: {
                data: 'base64-audio-data'
              }
            }]
          }
        }]
      };
      mockAI.models.generateContent.mockResolvedValue(mockResponse);

      const result = await adapter.generateSpeech('Hello', { voice: 'Charon' });

      expect(mockAI.models.generateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash-preview-tts',
        contents: { parts: [{ text: 'Hello' }] },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' }
            }
          }
        }
      });
      expect(result.audioData).toBe('base64-audio-data');
    });

    it('should throw error if no audio data returned', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: []
          }
        }]
      };
      mockAI.models.generateContent.mockResolvedValue(mockResponse);

      await expect(adapter.generateSpeech('Hello')).rejects.toThrow(
        AdapterError
      );
    });
  });

  describe('generateVideo', () => {
    beforeEach(() => {
      // Mock window.aistudio
      if (typeof window !== 'undefined') {
        (window as any).aistudio = {
          hasSelectedApiKey: vi.fn(),
          openSelectKey: vi.fn()
        };
      }
    });

    it('should generate video from text prompt', async () => {
      const mockOperation = {
        done: true,
        response: {
          generatedVideos: [{
            video: { uri: 'video-uri' }
          }]
        }
      };

      const mockFetch = vi.fn().mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['video-data']))
      });
      global.fetch = mockFetch as any;

      mockAI.models.generateVideos.mockResolvedValue(mockOperation);

      const result = await adapter.generateVideo('Create a video');

      expect(mockAI.models.generateVideos).toHaveBeenCalledWith({
        model: 'veo-3.1-fast-generate-preview',
        prompt: 'Create a video',
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });
      expect(result.videoUrl).toBeTruthy();
    });

    it('should generate video from image', async () => {
      const mockOperation = {
        done: true,
        response: {
          generatedVideos: [{
            video: { uri: 'video-uri' }
          }]
        }
      };

      const mockFetch = vi.fn().mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['video-data']))
      });
      global.fetch = mockFetch as any;

      mockAI.models.generateVideos.mockResolvedValue(mockOperation);

      await adapter.generateVideo('Animate this', {
        imageBase64: 'base64-image',
        imageMimeType: 'image/png',
        resolution: '1080p',
        aspectRatio: '9:16'
      });

      expect(mockAI.models.generateVideos).toHaveBeenCalledWith({
        model: 'veo-3.1-fast-generate-preview',
        prompt: 'Animate this',
        image: {
          imageBytes: 'base64-image',
          mimeType: 'image/png'
        },
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '9:16'
        }
      });
    });

    it('should check API key if window.aistudio exists', async () => {
      const mockOperation = {
        done: true,
        response: {
          generatedVideos: [{
            video: { uri: 'video-uri' }
          }]
        }
      };

      (window as any).aistudio.hasSelectedApiKey.mockResolvedValue(true);
      mockAI.models.generateVideos.mockResolvedValue(mockOperation);

      await adapter.generateVideo('Create a video');

      expect((window as any).aistudio.hasSelectedApiKey).toHaveBeenCalled();
    });

    it('should open key selection if no key selected', async () => {
      const mockOperation = {
        done: true,
        response: {
          generatedVideos: [{
            video: { uri: 'video-uri' }
          }]
        }
      };

      (window as any).aistudio.hasSelectedApiKey.mockResolvedValue(false);
      mockAI.models.generateVideos.mockResolvedValue(mockOperation);

      await adapter.generateVideo('Create a video');

      expect((window as any).aistudio.openSelectKey).toHaveBeenCalled();
    });
  });

  describe('connectRealtime', () => {
    it('should connect to realtime audio', async () => {
      const mockSession = {
        sendClientContent: vi.fn(),
        sendRealtimeInput: vi.fn(),
        close: vi.fn()
      };

      mockAI.live.connect.mockResolvedValue(mockSession);

      const config = {
        onOpen: vi.fn(),
        onMessage: vi.fn(),
        onAudio: vi.fn(),
        onError: vi.fn(),
        onClose: vi.fn()
      };

      const connection = await adapter.connectRealtime(config);

      expect(mockAI.live.connect).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }
            }
          }
        },
        callbacks: {
          onopen: expect.any(Function),
          onmessage: expect.any(Function),
          onerror: expect.any(Function),
          onclose: expect.any(Function)
        }
      });
      expect(connection.isConnected).toBe(true);
      expect(connection.close).toBe(mockSession.close);
    });

    it('should send text message', async () => {
      const mockSession = {
        sendClientContent: vi.fn(),
        sendRealtimeInput: vi.fn(),
        close: vi.fn()
      };

      mockAI.live.connect.mockResolvedValue(mockSession);

      const config = { onOpen: vi.fn() };
      const connection = await adapter.connectRealtime(config);

      connection.send('Hello');
      expect(mockSession.sendClientContent).toHaveBeenCalledWith({
        turns: [{ role: 'user', parts: [{ text: 'Hello' }] }]
      });
    });

    it('should send audio data', async () => {
      const mockSession = {
        sendClientContent: vi.fn(),
        sendRealtimeInput: vi.fn(),
        close: vi.fn()
      };

      mockAI.live.connect.mockResolvedValue(mockSession);

      const config = { onOpen: vi.fn() };
      const connection = await adapter.connectRealtime(config);

      const audioData = new ArrayBuffer(100);
      connection.sendAudio(audioData);
      expect(mockSession.sendRealtimeInput).toHaveBeenCalledWith({
        media: {
          mimeType: 'audio/pcm;rate=16000',
          data: expect.any(String)
        }
      });
    });

    it('should call onOpen callback', async () => {
      const mockSession = {
        sendClientContent: vi.fn(),
        sendRealtimeInput: vi.fn(),
        close: vi.fn()
      };

      mockAI.live.connect.mockResolvedValue(mockSession);

      const onOpen = vi.fn();
      const config = { onOpen };

      const connection = await adapter.connectRealtime(config);

      // Simulate onopen callback
      const callbacks = mockAI.live.connect.mock.calls[0][0].callbacks;
      callbacks.onopen();
      expect(onOpen).toHaveBeenCalled();
    });

    it('should call onMessage callback', async () => {
      const mockSession = {
        sendClientContent: vi.fn(),
        sendRealtimeInput: vi.fn(),
        close: vi.fn()
      };

      mockAI.live.connect.mockResolvedValue(mockSession);

      const onMessage = vi.fn();
      const config = { onMessage };

      const connection = await adapter.connectRealtime(config);

      // Simulate onmessage callback
      const callbacks = mockAI.live.connect.mock.calls[0][0].callbacks;
      callbacks.onmessage({ serverContent: { modelTurn: { parts: [] } } });
      expect(onMessage).toHaveBeenCalled();
    });

    it('should call onAudio callback with base64 data', async () => {
      const mockSession = {
        sendClientContent: vi.fn(),
        sendRealtimeInput: vi.fn(),
        close: vi.fn()
      };

      mockAI.live.connect.mockResolvedValue(mockSession);

      const onAudio = vi.fn();
      const config = { onAudio };

      const connection = await adapter.connectRealtime(config);

      // Simulate onmessage callback with audio data
      const callbacks = mockAI.live.connect.mock.calls[0][0].callbacks;
      callbacks.onmessage({
        serverContent: {
          modelTurn: {
            parts: [{ inlineData: { data: 'base64-audio' } }]
          }
        }
      });
      expect(onAudio).toHaveBeenCalledWith('base64-audio');
    });

    it('should call onError callback', async () => {
      const mockSession = {
        sendClientContent: vi.fn(),
        sendRealtimeInput: vi.fn(),
        close: vi.fn()
      };

      mockAI.live.connect.mockResolvedValue(mockSession);

      const onError = vi.fn();
      const config = { onError };

      const connection = await adapter.connectRealtime(config);

      // Simulate onerror callback
      const callbacks = mockAI.live.connect.mock.calls[0][0].callbacks;
      callbacks.onerror(new Error('Test error'));
      expect(onError).toHaveBeenCalledWith(new Error('Test error'));
    });

    it('should call onClose callback', async () => {
      const mockSession = {
        sendClientContent: vi.fn(),
        sendRealtimeInput: vi.fn(),
        close: vi.fn()
      };

      mockAI.live.connect.mockResolvedValue(mockSession);

      const onClose = vi.fn();
      const config = { onClose };

      const connection = await adapter.connectRealtime(config);

      // Simulate onclose callback
      const callbacks = mockAI.live.connect.mock.calls[0][0].callbacks;
      callbacks.onclose();
      expect(onClose).toHaveBeenCalled();
    });
  });
});