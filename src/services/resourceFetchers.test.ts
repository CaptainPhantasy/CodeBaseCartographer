import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchElevenLabsVoices, fetchOpenRouterModels } from './resourceFetchers';
import { ElevenLabsVoice, OpenRouterModel } from '../types/capabilities';

describe('resourceFetchers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchElevenLabsVoices', () => {
    it('should fetch voices successfully', async () => {
      const mockVoices: ElevenLabsVoice[] = [
        {
          voice_id: 'voice-1',
          name: 'Test Voice 1',
          category: 'premade',
          labels: { accent: 'american' },
          description: 'A test voice',
          preview_url: 'https://example.com/preview.mp3'
        },
        {
          voice_id: 'voice-2',
          name: 'Test Voice 2',
          category: 'cloned'
        }
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ voices: mockVoices })
      } as Response);

      const result = await fetchElevenLabsVoices('test-api-key');

      expect(result.voices).toEqual(mockVoices);
      expect(result.error).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/voices',
        {
          method: 'GET',
          headers: { 'xi-api-key': 'test-api-key' }
        }
      );
    });

    it('should handle 401 unauthorized error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      } as Response);

      const result = await fetchElevenLabsVoices('invalid-key');

      expect(result.voices).toEqual([]);
      expect(result.error).toBe('Invalid API key');
    });

    it('should handle 429 rate limit error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as Response);

      const result = await fetchElevenLabsVoices('test-api-key');

      expect(result.voices).toEqual([]);
      expect(result.error).toBe('Rate limited. Please try again later.');
    });

    it('should handle other HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      const result = await fetchElevenLabsVoices('test-api-key');

      expect(result.voices).toEqual([]);
      expect(result.error).toBe('HTTP 500: Internal Server Error');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchElevenLabsVoices('test-api-key');

      expect(result.voices).toEqual([]);
      expect(result.error).toBe('Network error');
    });

    it('should handle empty voices array', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ voices: [] })
      } as Response);

      const result = await fetchElevenLabsVoices('test-api-key');

      expect(result.voices).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it('should handle missing voices field', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      } as Response);

      const result = await fetchElevenLabsVoices('test-api-key');

      expect(result.voices).toEqual([]);
      expect(result.error).toBeUndefined();
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
