import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchOpenRouterModels } from './resourceFetchers';
import { OpenRouterModel } from '../types/capabilities';

// Mock the ElevenLabs SDK before importing the module under test
const mockSearch = vi.fn();

vi.mock('@elevenlabs/elevenlabs-js', () => {
  // Use a real class to satisfy constructor requirements
  class MockElevenLabsClient {
    constructor(_config: { apiKey: string }) {}
    voices = {
      search: mockSearch
    };
  }
  return {
    ElevenLabsClient: MockElevenLabsClient
  };
});

// Import after mock is set up
import { fetchElevenLabsVoices } from './resourceFetchers';

describe('resourceFetchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchElevenLabsVoices', () => {
    it('should fetch voices successfully', async () => {
      const mockVoices = [
        {
          voiceId: 'voice-1',
          name: 'Test Voice 1',
          category: 'premade',
          labels: { accent: 'american' },
          description: 'A test voice',
          previewUrl: 'https://example.com/preview.mp3'
        },
        {
          voiceId: 'voice-2',
          name: 'Test Voice 2',
          category: 'cloned',
          labels: undefined,
          description: undefined,
          previewUrl: undefined
        }
      ];

      mockSearch.mockResolvedValueOnce({ voices: mockVoices });

      const result = await fetchElevenLabsVoices('test-api-key');

      expect(result.voices).toHaveLength(2);
      expect(result.voices[0].voice_id).toBe('voice-1');
      expect(result.voices[0].name).toBe('Test Voice 1');
      expect(result.voices[0].preview_url).toBe('https://example.com/preview.mp3');
      expect(result.error).toBeUndefined();
    });

    it('should handle 401 unauthorized error', async () => {
      const error = new Error('Unauthorized: 401');
      mockSearch.mockRejectedValueOnce(error);

      const result = await fetchElevenLabsVoices('invalid-key');

      expect(result.voices).toEqual([]);
      expect(result.error).toBe('Invalid API key');
    });

    it('should handle 429 rate limit error', async () => {
      const error = new Error('Rate limit exceeded: 429');
      mockSearch.mockRejectedValueOnce(error);

      const result = await fetchElevenLabsVoices('test-api-key');

      expect(result.voices).toEqual([]);
      expect(result.error).toBe('Rate limited. Please try again later.');
    });

    it('should handle other errors', async () => {
      const error = new Error('Internal server error');
      mockSearch.mockRejectedValueOnce(error);

      const result = await fetchElevenLabsVoices('test-api-key');

      expect(result.voices).toEqual([]);
      expect(result.error).toBe('Internal server error');
    });

    it('should handle empty voices array', async () => {
      mockSearch.mockResolvedValueOnce({ voices: [] });

      const result = await fetchElevenLabsVoices('test-api-key');

      expect(result.voices).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it('should handle missing voices field', async () => {
      mockSearch.mockResolvedValueOnce({});

      const result = await fetchElevenLabsVoices('test-api-key');

      expect(result.voices).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it('should handle voices with null values', async () => {
      const mockVoices = [
        {
          voiceId: 'voice-1',
          name: null,
          category: null,
          labels: null,
          description: null,
          previewUrl: null
        }
      ];

      mockSearch.mockResolvedValueOnce({ voices: mockVoices });

      const result = await fetchElevenLabsVoices('test-api-key');

      expect(result.voices).toHaveLength(1);
      expect(result.voices[0].voice_id).toBe('voice-1');
      expect(result.voices[0].name).toBeUndefined();
      expect(result.voices[0].category).toBeUndefined();
      expect(result.voices[0].preview_url).toBeUndefined();
    });
  });

  describe('fetchOpenRouterModels', () => {
    it('should fetch models successfully', async () => {
      const mockModels: OpenRouterModel[] = [
        {
          id: 'openai/gpt-4',
          name: 'GPT-4',
          context_length: 8192,
          pricing: {
            prompt: '0.00003',
            completion: '0.00006'
          },
          architecture: {
            modality: 'text',
            input_modalities: ['text'],
            output_modalities: ['text']
          }
        },
        {
          id: 'anthropic/claude-3-opus',
          name: 'Claude 3 Opus',
          context_length: 200000,
          pricing: {
            prompt: '0.000015',
            completion: '0.000075'
          },
          architecture: {
            modality: 'text',
            input_modalities: ['text', 'image'],
            output_modalities: ['text']
          }
        }
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockModels })
      } as Response);

      const result = await fetchOpenRouterModels('test-api-key');

      expect(result.models).toEqual(mockModels);
      expect(result.error).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        {
          method: 'GET',
          headers: { 'Authorization': 'Bearer test-api-key' }
        }
      );
    });

    it('should handle 401 unauthorized error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response);

      const result = await fetchOpenRouterModels('invalid-key');

      expect(result.models).toEqual([]);
      expect(result.error).toBe('Invalid API key');
    });

    it('should handle other HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      const result = await fetchOpenRouterModels('test-api-key');

      expect(result.models).toEqual([]);
      expect(result.error).toBe('HTTP 500: Internal Server Error');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchOpenRouterModels('test-api-key');

      expect(result.models).toEqual([]);
      expect(result.error).toBe('Network error');
    });

    it('should handle empty models array', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      } as Response);

      const result = await fetchOpenRouterModels('test-api-key');

      expect(result.models).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it('should handle missing data field', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      } as Response);

      const result = await fetchOpenRouterModels('test-api-key');

      expect(result.models).toEqual([]);
      expect(result.error).toBeUndefined();
    });
  });
});
