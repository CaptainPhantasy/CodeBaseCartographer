import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ElevenLabsAdapter } from './elevenlabs';
import { UnsupportedCapabilityError } from './base';
import { TaskType } from '../../types/capabilities';

// Mock fetch
global.fetch = vi.fn();

describe('ElevenLabsAdapter', () => {
  let adapter: ElevenLabsAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ElevenLabsAdapter('test-api-key');
  });

  describe('supportsCapability', () => {
    it('should support tts', () => {
      expect(adapter.supportsCapability('tts')).toBe(true);
    });

    it('should not support text', () => {
      expect(adapter.supportsCapability('text')).toBe(false);
    });

    it('should not support structured_output', () => {
      expect(adapter.supportsCapability('structured_output')).toBe(false);
    });
  });

  describe('getModelForTask', () => {
    it('should return eleven_multilingual_v2 for TTS', () => {
      expect(adapter.getModelForTask(TaskType.TTS)).toBe('eleven_multilingual_v2');
    });

    it('should return null for other tasks', () => {
      expect(adapter.getModelForTask(TaskType.TEXT_GENERATION)).toBe(null);
      expect(adapter.getModelForTask(TaskType.IMAGE_ANALYSIS)).toBe(null);
    });
  });

  describe('getAvailableVoices', () => {
    it('should return all available voices', () => {
      const voices = adapter.getAvailableVoices();
      expect(voices).toContain('rachel');
      expect(voices).toContain('drew');
      expect(voices).toContain('clyde');
      expect(voices).toContain('paul');
      expect(voices).toContain('domi');
      expect(voices).toContain('bella');
      // Test some more
      expect(voices).toContain('matilda');
      expect(voices).toContain('adam');
      expect(voices).toContain('glinda');
      expect(voices.length).toBeGreaterThan(30);
    });
  });

  describe('generateText', () => {
    it('should throw UnsupportedCapabilityError', async () => {
      await expect(adapter.generateText('Hello')).rejects.toThrow(
        UnsupportedCapabilityError
      );
    });
  });

  describe('generateStructuredOutput', () => {
    it('should throw UnsupportedCapabilityError', async () => {
      await expect(adapter.generateStructuredOutput('Hello', {})).rejects.toThrow(
        UnsupportedCapabilityError
      );
    });
  });

  describe('generateSpeech', () => {
    it('should generate speech with default voice', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100))
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await adapter.generateSpeech('Hello');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'xi-api-key': 'test-api-key',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: 'Hello',
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true
            }
          })
        })
      );
      expect(result.format).toBe('mp3');
    });

    it('should generate speech with custom voice', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100))
      };
      (fetch as any).mockResolvedValue(mockResponse);

      await adapter.generateSpeech('Hello', { voice: 'rachel' });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
        expect.objectContaining({
          body: JSON.stringify({
            text: 'Hello',
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true
            }
          })
        })
      );
    });

    it('should handle custom voice ID', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100))
      };
      (fetch as any).mockResolvedValue(mockResponse);

      await adapter.generateSpeech('Hello', { voice: 'custom-voice-id' });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/text-to-speech/custom-voice-id',
        expect.objectContaining({
          body: JSON.stringify({
            text: 'Hello',
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true
            }
          })
        })
      );
    });

    it('should handle custom voice with default settings', async () => {
      const mockResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100))
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await adapter.generateSpeech('Hello', {
        voice: 'paul'
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/text-to-speech/5Q0t7uMcjvnagumLfvZi',
        expect.objectContaining({
          body: JSON.stringify({
            text: 'Hello',
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true
            }
          })
        })
      );
      expect(result.format).toBe('mp3');
    });

    it('should handle API error', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: 'Invalid API key'
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      await expect(adapter.generateSpeech('Hello')).rejects.toThrow();
    });
  });
});