/**
 * ElevenLabs Adapter
 * Premium TTS, STT, and STS provider with natural voices
 * Supports: TTS, STT, Realtime Audio (STS)
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { TaskType } from '../../types/capabilities';
import {
  BaseLLMAdapter,
  TextGenerationOptions,
  TextGenerationResult,
  StructuredOutputOptions,
  TTSOptions,
  TTSResult,
  STTOptions,
  STTResult,
  STSConfig,
  RealtimeConnection,
  UnsupportedCapabilityError,
  AdapterError,
  parseAPIError,
  arrayBufferToBase64
} from './base';

const API_BASE = 'https://api.elevenlabs.io/v1';

// Popular ElevenLabs voices
const ELEVENLABS_VOICES = {
  'rachel': '21m00Tcm4TlvDq8ikWAM',
  'drew': '29vD33N1CtxCmqQRPOHJ',
  'clyde': '2EiwWnXFnvU5JabPnv8n',
  'paul': '5Q0t7uMcjvnagumLfvZi',
  'domi': 'AZnzlk1XvdvUeBnXmlld',
  'bella': 'EXAVITQu4vr4xnSDxMaL',
  'antoni': 'ErXwobaYiN019PkySvjV',
  'thomas': 'GBv7mTt0atIp3Br8iCZE',
  'charlie': 'IKne3meq5aSn9XLyUdCD',
  'emily': 'LcfcDJNUP1GQjkzn1xUU',
  'elli': 'MF3mGyEYCl7XYWbV9V6O',
  'callum': 'N2lVS1w4EtoT3dr4eOWO',
  'patrick': 'ODq5zmih8GrVes37Dizd',
  'harry': 'SOYHLrjzK2X1ezoPC6cr',
  'liam': 'TX3LPaxmHKxFdv7VOQHJ',
  'dorothy': 'ThT5KcBeYPX3keUQqHPh',
  'josh': 'TxGEqnHWrfWFTfGW9XjX',
  'arnold': 'VR6AewLTigWG4xSOukaG',
  'charlotte': 'XB0fDUnXU5powFXDhCwa',
  'matilda': 'XrExE9yKIg1WjnnlVkGX',
  'james': 'ZQe5CZNOzWyzPSCn5a3c',
  'joseph': 'Zlb1dXrM653N07WRdFW3',
  'jeremy': 'bVMeCyTHy58xNoL34h3p',
  'michael': 'flq6f7yk4E4fJM5XTYuZ',
  'ethan': 'g5CIjZEefAph4nQFvHAz',
  'gigi': 'jBpfuIE2acCO8z3wKNLl',
  'freya': 'jsCqWAovK2LkecY7zXl4',
  'grace': 'oWAxZDx7w5VEj9dCyTzz',
  'daniel': 'onwK4e9ZLuTAKqWW03F9',
  'serena': 'pFZP5JQG7iQjIQuC4Bku',
  'adam': 'pNInz6obpgDQGcFmaJgB',
  'nicole': 'piTKgcLEGmPE4e6mEKli',
  'jessie': 't0jbNlBVZ17f02VDIeMI',
  'ryan': 'wViXBPUzp2ZZixB1xQuM',
  'sam': 'yoZ06aMxZJJ28mfd3POQ',
  'glinda': 'z9fAnlkpzviPz146aGWa'
};

export class ElevenLabsAdapter extends BaseLLMAdapter {
  readonly providerId = 'elevenlabs' as const;
  readonly name = 'ElevenLabs';
  private client: ElevenLabsClient;

  constructor(apiKey: string) {
    super(apiKey);
    this.client = new ElevenLabsClient({ apiKey });
  }

  supportsCapability(capability: string): boolean {
    return ['tts', 'stt', 'realtime_audio'].includes(capability);
  }

  getModelForTask(taskType: TaskType): string | null {
    if (taskType === TaskType.TTS) {
      return 'eleven_multilingual_v2';
    }
    return null;
  }

  getAvailableVoices(): string[] {
    return Object.keys(ELEVENLABS_VOICES);
  }

  async generateText(
    _prompt: string,
    _options?: TextGenerationOptions
  ): Promise<TextGenerationResult> {
    throw new UnsupportedCapabilityError(this.providerId as any, 'text');
  }

  async generateStructuredOutput<T>(
    _prompt: string,
    _schema: object,
    _options?: StructuredOutputOptions
  ): Promise<T> {
    throw new UnsupportedCapabilityError(this.providerId as any, 'structured_output');
  }

  /**
   * Generate speech from text using the ElevenLabs SDK
   */
  async generateSpeech(
    text: string,
    options: TTSOptions = {}
  ): Promise<TTSResult> {
    // Use voice ID directly if provided (new behavior)
    // Fall back to name mapping for backward compatibility
    let voiceId = options.voice;

    if (!voiceId) {
      voiceId = '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel
    } else if (voiceId in ELEVENLABS_VOICES) {
      // Legacy voice name - map to ID
      voiceId = ELEVENLABS_VOICES[voiceId as keyof typeof ELEVENLABS_VOICES];
    }
    // Otherwise assume voiceId is already a valid voice ID

    try {
      // Use SDK for TTS
      const audioBuffer = await this.client.textToSpeech.convert(voiceId, {
        text,
        modelId: 'eleven_multilingual_v2',
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.0,
          useSpeakerBoost: true
        }
      });

      // Handle different response types from SDK
      let arrayBuffer: ArrayBuffer;
      if (audioBuffer instanceof ArrayBuffer) {
        arrayBuffer = audioBuffer;
      } else if (audioBuffer instanceof Uint8Array) {
        arrayBuffer = audioBuffer.buffer as ArrayBuffer;
      } else {
        // Fallback: try to use as ArrayBuffer
        arrayBuffer = audioBuffer as unknown as ArrayBuffer;
      }

      return {
        audioData: arrayBufferToBase64(arrayBuffer),
        format: 'mp3'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AdapterError(
        `TTS failed: ${errorMessage}`,
        'TTS_ERROR',
        this.providerId,
        false
      );
    }
  }

  /**
   * Transcribe audio to text using ElevenLabs Scribe V2
   * Note: Using raw fetch as SDK may not expose this endpoint directly
   */
  async transcribeAudio(
    audioData: ArrayBuffer | string,
    options: STTOptions = {}
  ): Promise<STTResult> {
    try {
      // Convert base64 to ArrayBuffer if needed
      let audioBuffer: ArrayBuffer;
      if (typeof audioData === 'string') {
        audioBuffer = this.base64ToArrayBuffer(audioData);
      } else {
        audioBuffer = audioData;
      }

      const formData = new FormData();
      const blob = new Blob([audioBuffer]);
      formData.append('audio', blob, 'audio.wav');
      formData.append('model', options.model || 'scribe-v2');

      if (options.language) {
        formData.append('language_code', options.language);
      }

      const response = await fetch(`${API_BASE}/scribe`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey
        },
        body: formData
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw parseAPIError(this.providerId, response.status, body);
      }

      const result = await response.json();

      return {
        text: result.text,
        language: result.language,
        confidence: result.confidence,
        word_count: result.word_count
      };
    } catch (error) {
      throw new AdapterError(
        `STT failed: ${error instanceof Error ? error.message : String(error)}`,
        'STT_ERROR',
        this.providerId,
        false
      );
    }
  }

  /**
   * Connect to ElevenLabs STS WebSocket for real-time voice conversation
   * Note: Using raw WebSocket as SDK's stream() returns a different interface
   */
  async connectSTS(config: STSConfig): Promise<RealtimeConnection> {
    const voiceId = config.voice || '21m00Tcm4TlvDq8ikWAM'; // Default Rachel

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input`);

      let isConnected = false;

      ws.onopen = () => {
        isConnected = true;
        if (config.onOpen) config.onOpen();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'audio' && config.onAudio) {
            // Audio data is base64 encoded
            config.onAudio(message.audio);
          } else if (message.type === 'text' && config.onMessage) {
            config.onMessage(message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        const err = new Error(`WebSocket error: ${error}`);
        if (config.onError) {
          config.onError(err);
        } else {
          reject(err);
        }
      };

      ws.onclose = () => {
        isConnected = false;
        if (config.onClose) config.onClose();
      };

      // Wait briefly for connection to establish
      setTimeout(() => {
        if (!isConnected) {
          reject(new Error('Failed to connect to ElevenLabs STS WebSocket'));
        } else {
          resolve({
            send: (data: any) => {
              ws.send(JSON.stringify({
                text: data.text,
                voice_settings: {
                  stability: config.stability || 0.5,
                  similarity_boost: config.similarity_boost || 0.75
                }
              }));
            },
            sendAudio: (audioData: ArrayBuffer) => {
              const base64 = arrayBufferToBase64(audioData);
              ws.send(JSON.stringify({
                audio: base64
              }));
            },
            close: () => ws.close(),
            isConnected: isConnected
          });
        }
      }, 3000);
    });
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export default ElevenLabsAdapter;
