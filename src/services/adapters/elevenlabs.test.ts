import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnsupportedCapabilityError } from './base';
import { TaskType } from '../../types/capabilities';

// Mock the ElevenLabs SDK
const mockConvert = vi.fn();

vi.mock('@elevenlabs/elevenlabs-js', () => {
  class MockElevenLabsClient {
    constructor(_config: { apiKey: string }) {}
    textToSpeech = {
      convert: mockConvert
    };
  }
  return {
    ElevenLabsClient: MockElevenLabsClient
  };
});

// Import after mock is set up
import { ElevenLabsAdapter } from './elevenlabs';

// Mock fetch for STT tests (STT still uses raw fetch)
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
    it('should generate speech with default voice using SDK', async () => {
      // Create a mock audio buffer
      const mockAudioBuffer = new ArrayBuffer(100);
      mockConvert.mockResolvedValueOnce(mockAudioBuffer);

      const result = await adapter.generateSpeech('Hello');

      expect(mockConvert).toHaveBeenCalledWith(
        '21m00Tcm4TlvDq8ikWAM', // Default Rachel voice ID
        expect.objectContaining({
          text: 'Hello',
          modelId: 'eleven_multilingual_v2',
          voiceSettings: {
            stability: 0.5,
            similarityBoost: 0.75,
            style: 0.0,
            useSpeakerBoost: true
          }
        })
      );
      expect(result.format).toBe('mp3');
      expect(result.audioData).toBeDefined();
    });

    it('should generate speech with legacy voice name (rachel)', async () => {
      const mockAudioBuffer = new ArrayBuffer(100);
      mockConvert.mockResolvedValueOnce(mockAudioBuffer);

      await adapter.generateSpeech('Hello', { voice: 'rachel' });

      expect(mockConvert).toHaveBeenCalledWith(
        '21m00Tcm4TlvDq8ikWAM', // Rachel's voice ID
        expect.objectContaining({
          text: 'Hello'
        })
      );
    });

    it('should handle custom voice ID', async () => {
      const mockAudioBuffer = new ArrayBuffer(100);
      mockConvert.mockResolvedValueOnce(mockAudioBuffer);

      await adapter.generateSpeech('Hello', { voice: 'custom-voice-id' });

      expect(mockConvert).toHaveBeenCalledWith(
        'custom-voice-id',
        expect.objectContaining({
          text: 'Hello'
        })
      );
    });

    it('should map paul voice name to ID', async () => {
      const mockAudioBuffer = new ArrayBuffer(100);
      mockConvert.mockResolvedValueOnce(mockAudioBuffer);

      const result = await adapter.generateSpeech('Hello', { voice: 'paul' });

      expect(mockConvert).toHaveBeenCalledWith(
        '5Q0t7uMcjvnagumLfvZi', // Paul's voice ID
        expect.objectContaining({
          text: 'Hello'
        })
      );
      expect(result.format).toBe('mp3');
    });

    it('should handle SDK error', async () => {
      mockConvert.mockRejectedValueOnce(new Error('API error'));

      await expect(adapter.generateSpeech('Hello')).rejects.toThrow('TTS failed');
    });

    it('should handle Uint8Array response from SDK', async () => {
      const mockUint8Array = new Uint8Array([1, 2, 3, 4, 5]);
      mockConvert.mockResolvedValueOnce(mockUint8Array);

      const result = await adapter.generateSpeech('Hello');

      expect(result.format).toBe('mp3');
      expect(result.audioData).toBeDefined();
    });
  });

  describe('transcribeAudio', () => {
    it('should transcribe audio successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          text: 'Hello world',
          language: 'en',
          confidence: 0.95,
          word_count: 2
        })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const audioBuffer = new ArrayBuffer(100);
      const result = await adapter.transcribeAudio(audioBuffer);

      expect(result.text).toBe('Hello world');
      expect(result.language).toBe('en');
      expect(result.confidence).toBe(0.95);
    });

    it('should handle transcribe error', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ error: 'Unauthorized' })
      };
      (fetch as any).mockResolvedValue(mockResponse);

      const audioBuffer = new ArrayBuffer(100);
      await expect(adapter.transcribeAudio(audioBuffer)).rejects.toThrow();
    });
  });
});
