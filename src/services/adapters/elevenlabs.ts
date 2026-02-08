/**
 * ElevenLabs Adapter
 * Premium TTS provider with natural voices
 * Supports: TTS only
 */

import { TaskType } from '../../types/capabilities';
import {
  BaseLLMAdapter,
  TextGenerationOptions,
  TextGenerationResult,
  StructuredOutputOptions,
  TTSOptions,
  TTSResult,
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

  constructor(apiKey: string) {
    super(apiKey);
  }

  supportsCapability(capability: string): boolean {
    return capability === 'tts';
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

  async generateSpeech(
    text: string,
    options: TTSOptions = {}
  ): Promise<TTSResult> {
    // Get voice ID from name or use as-is if it's already an ID
    const voiceName = options.voice || 'rachel';
    const voiceId = ELEVENLABS_VOICES[voiceName as keyof typeof ELEVENLABS_VOICES] || voiceName;

    const response = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw parseAPIError(this.providerId as any, response.status, body);
    }

    const audioBuffer = await response.arrayBuffer();
    return {
      audioData: arrayBufferToBase64(audioBuffer),
      format: 'mp3'
    };
  }
}

export default ElevenLabsAdapter;
