/**
 * OpenAI Adapter
 * Supports: Text, Structured Output, TTS, STT, Realtime Audio
 */

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
  RealtimeConfig,
  RealtimeConnection,
  AdapterError,
  parseAPIError,
  arrayBufferToBase64
} from './base';

// Model IDs
const MODELS = {
  GPT4O: 'gpt-4o',
  GPT4O_MINI: 'gpt-4o-mini',
  O1: 'o1',
  O3_MINI: 'o3-mini',
  TTS: 'tts-1',
  TTS_HD: 'tts-1-hd',
  WHISPER: 'whisper-1',
  REALTIME: 'gpt-4o-realtime-preview'
};

// TTS Voices
const OPENAI_TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

const API_BASE = 'https://api.openai.com/v1';

export class OpenAIAdapter extends BaseLLMAdapter {
  readonly providerId = 'openai' as const;
  readonly name = 'OpenAI';

  constructor(apiKey: string) {
    super(apiKey);
  }

  supportsCapability(capability: string): boolean {
    const supported = ['text', 'code', 'structured_output', 'vision', 'tts', 'stt', 'realtime_audio', 'thinking'];
    return supported.includes(capability);
  }

  getModelForTask(taskType: TaskType): string | null {
    switch (taskType) {
      case TaskType.TEXT_GENERATION:
      case TaskType.IMAGE_ANALYSIS:
      case TaskType.CODE_ANALYSIS:
        return MODELS.GPT4O_MINI;
      case TaskType.GRAPH_GENERATION:
        return MODELS.GPT4O_MINI;
      case TaskType.TTS:
        return MODELS.TTS;
      case TaskType.REALTIME_VOICE:
        return MODELS.REALTIME;
      case TaskType.VIDEO:
        return null; // OpenAI doesn't support video generation
      default:
        return MODELS.GPT4O_MINI;
    }
  }

  getAvailableVoices(): string[] {
    return OPENAI_TTS_VOICES;
  }

  async generateText(
    prompt: string,
    options: TextGenerationOptions = {}
  ): Promise<TextGenerationResult> {
    const modelId = options.useThinking ? MODELS.O3_MINI : MODELS.GPT4O_MINI;
    
    // Build messages array
    const messages: any[] = [];
    
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    // Add history
    if (options.history) {
      for (const msg of options.history.slice(0, -1)) {
        messages.push({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.text
        });
      }
    }

    // Add current message
    if (options.imagePart && options.mimeType) {
      messages.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${options.mimeType};base64,${options.imagePart}` } },
          { type: 'text', text: prompt }
        ]
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens
      })
    });

    if (!response.ok) {
      const body = await response.json();
      throw parseAPIError(this.providerId, response.status, body);
    }

    const data = await response.json();
    return {
      text: data.choices[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      }
    };
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: object,
    options: StructuredOutputOptions = {}
  ): Promise<T> {
    const messages: any[] = [
      {
        role: 'system',
        content: `You must respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\nRespond ONLY with valid JSON, no explanations.`
      },
      { role: 'user', content: prompt }
    ];

    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODELS.GPT4O_MINI,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const body = await response.json();
      throw parseAPIError(this.providerId, response.status, body);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content || content.trim() === '') {
      throw new AdapterError('Empty response from API', 'EMPTY_RESPONSE', this.providerId, false);
    }

    try {
      const parsed = JSON.parse(content);
      // Validate that required fields exist for graph data
      if (parsed && typeof parsed === 'object') {
        if ('nodes' in parsed && (!parsed.nodes || !Array.isArray(parsed.nodes))) {
          throw new AdapterError('Response missing valid nodes array', 'INVALID_RESPONSE', this.providerId, false);
        }
        if ('links' in parsed && (!parsed.links || !Array.isArray(parsed.links))) {
          throw new AdapterError('Response missing valid links array', 'INVALID_RESPONSE', this.providerId, false);
        }
      }
      return parsed as T;
    } catch (e) {
      if (e instanceof AdapterError) throw e;
      throw new AdapterError(`Failed to parse response: ${e}`, 'PARSE_ERROR', this.providerId, false);
    }
  }

  async generateSpeech(
    text: string,
    options: TTSOptions = {}
  ): Promise<TTSResult> {
    const response = await fetch(`${API_BASE}/audio/speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODELS.TTS,
        input: text,
        voice: options.voice || 'alloy',
        speed: options.speed || 1.0,
        response_format: options.format || 'mp3'
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw parseAPIError(this.providerId, response.status, body);
    }

    const audioBuffer = await response.arrayBuffer();
    return {
      audioData: arrayBufferToBase64(audioBuffer),
      format: options.format || 'mp3'
    };
  }

  /**
   * Transcribe audio to text using Whisper API
   */
  async transcribeAudio(
    audioData: ArrayBuffer | string,
    options: STTOptions = {}
  ): Promise<STTResult> {
    try {
      // Convert base64 to Blob if needed
      let audioBlob: Blob;
      if (typeof audioData === 'string') {
        // Decode base64 to binary
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioBlob = new Blob([bytes], { type: 'audio/wav' });
      } else {
        audioBlob = new Blob([audioData], { type: 'audio/wav' });
      }

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', options.model || MODELS.WHISPER);

      if (options.language) {
        formData.append('language', options.language);
      }

      if (options.detect_language) {
        // Let Whisper auto-detect the language (default behavior when language is not specified)
      }

      const response = await fetch(`${API_BASE}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
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
        // Whisper doesn't return confidence by default, but we can include it if available
        confidence: result.confidence,
        word_count: result.text ? result.text.split(/\s+/).length : undefined
      };
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      throw new AdapterError(
        `STT failed: ${error instanceof Error ? error.message : String(error)}`,
        'STT_ERROR',
        this.providerId,
        false
      );
    }
  }

  async connectRealtime(config: RealtimeConfig): Promise<RealtimeConnection> {
    // OpenAI Realtime API uses WebSocket
    const ws = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${MODELS.REALTIME}`,
      {
        // @ts-ignore - headers for WebSocket
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      } as any
    );

    let isConnected = false;

    return new Promise((resolve, reject) => {
      ws.onopen = () => {
        isConnected = true;
        
        // Send session configuration
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            voice: config.voice || 'alloy',
            instructions: config.systemPrompt,
            input_audio_transcription: { model: 'whisper-1' }
          }
        }));

        resolve({
          send: (data: any) => ws.send(JSON.stringify(data)),
          sendAudio: (audioData: ArrayBuffer) => {
            ws.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: arrayBufferToBase64(audioData)
            }));
          },
          close: () => ws.close(),
          get isConnected() { return isConnected; }
        });
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (config.onMessage) config.onMessage(data);
        
        // Handle audio response - pass base64 string directly
        if (data.type === 'response.audio.delta' && config.onAudio && data.delta) {
          config.onAudio(data.delta);
        }
      };

      ws.onerror = (error) => {
        if (config.onError) config.onError(new Error('WebSocket error'));
        if (!isConnected) reject(new AdapterError('Failed to connect', 'CONNECTION_ERROR', this.providerId, true));
      };

      ws.onclose = () => {
        isConnected = false;
        if (config.onClose) config.onClose();
      };
    });
  }
}

export default OpenAIAdapter;
