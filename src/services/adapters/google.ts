/**
 * Google/Gemini Adapter
 * Supports: Text, Structured Output, TTS, Video, Realtime Audio
 */

import { GoogleGenAI, Modality, Type } from '@google/genai';
import { TaskType } from '../../types/capabilities';
import {
  BaseLLMAdapter,
  TextGenerationOptions,
  TextGenerationResult,
  StructuredOutputOptions,
  TTSOptions,
  TTSResult,
  VideoGenerationOptions,
  VideoResult,
  RealtimeConfig,
  RealtimeConnection,
  AdapterError,
  UnsupportedCapabilityError,
  base64ToUint8Array,
  arrayBufferToBase64
} from './base';

// Model IDs
const MODELS = {
  PRO: 'gemini-3-pro-preview',
  FLASH: 'gemini-3-flash-preview',
  TTS: 'gemini-2.5-flash-preview-tts',
  VIDEO: 'veo-3.1-fast-generate-preview',
  LIVE_AUDIO: 'gemini-2.5-flash-native-audio-preview-12-2025'
};

// TTS Voices available
const GOOGLE_TTS_VOICES = [
  'Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck', 'Leda'
];

export class GoogleAdapter extends BaseLLMAdapter {
  readonly providerId = 'google' as const;
  readonly name = 'Google AI (Gemini)';

  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    super(apiKey);
    this.ai = new GoogleGenAI({ apiKey });
  }

  supportsCapability(capability: string): boolean {
    const supported = [
      'text', 'code', 'structured_output', 'vision',
      'tts', 'video', 'realtime_audio', 'thinking', 'search_grounding'
    ];
    return supported.includes(capability);
  }

  getModelForTask(taskType: TaskType): string | null {
    switch (taskType) {
      case TaskType.TEXT_GENERATION:
      case TaskType.IMAGE_ANALYSIS:
      case TaskType.CODE_ANALYSIS:
        return MODELS.FLASH;
      case TaskType.GRAPH_GENERATION:
        return MODELS.FLASH;
      case TaskType.TTS:
        return MODELS.TTS;
      case TaskType.VIDEO:
        return MODELS.VIDEO;
      case TaskType.REALTIME_VOICE:
        return MODELS.LIVE_AUDIO;
      default:
        return MODELS.FLASH;
    }
  }

  getAvailableVoices(): string[] {
    return GOOGLE_TTS_VOICES;
  }

  async generateText(
    prompt: string,
    options: TextGenerationOptions = {}
  ): Promise<TextGenerationResult> {
    const modelId = options.useThinking ? MODELS.PRO : MODELS.FLASH;
    
    const tools: any[] = [];
    if (options.useSearch && modelId === MODELS.FLASH) {
      tools.push({ googleSearch: {} });
    }

    // Transform history to API format
    const previousHistory = (options.history || []).slice(0, -1).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    const chat = this.ai.chats.create({
      model: modelId,
      history: previousHistory,
      config: {
        systemInstruction: options.systemPrompt,
        tools,
        ...(options.useThinking ? { thinkingConfig: { thinkingBudget: 16000 } } : {}),
      }
    });

    // Prepare message content
    let messageContent: any = prompt;
    if (options.imagePart && options.mimeType) {
      messageContent = [
        { inlineData: { data: options.imagePart, mimeType: options.mimeType } },
        { text: prompt }
      ];
    }

    const result = await chat.sendMessage({ message: messageContent });

    // Extract search grounding if present
    const groundingUrls: string[] = [];
    if (result.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      result.candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) groundingUrls.push(chunk.web.uri);
      });
    }

    return {
      text: result.text || '',
      groundingUrls
    };
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: object,
    _options: StructuredOutputOptions = {}
  ): Promise<T> {
    const response = await this.ai.models.generateContent({
      model: MODELS.FLASH,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema as any
      }
    });
    return JSON.parse(response.text || '{}');
  }

  async generateSpeech(
    text: string,
    options: TTSOptions = {}
  ): Promise<TTSResult> {
    const response = await this.ai.models.generateContent({
      model: MODELS.TTS,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: options.voice || 'Kore'
            },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new AdapterError('No audio data returned', 'NO_AUDIO', this.providerId, false);
    }

    return {
      audioData,
      format: 'wav'
    };
  }

  async generateVideo(
    prompt: string,
    options: VideoGenerationOptions = {}
  ): Promise<VideoResult> {
    // Check/Request API Key for Veo (AI Studio specific)
    if (typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
      }
    }

    let operation;

    if (options.imageBase64) {
      operation = await this.ai.models.generateVideos({
        model: MODELS.VIDEO,
        prompt: prompt || 'Animate this architecture diagram showing data flow.',
        image: {
          imageBytes: options.imageBase64,
          mimeType: options.imageMimeType || 'image/png'
        },
        config: {
          numberOfVideos: 1,
          resolution: options.resolution || '720p',
          aspectRatio: options.aspectRatio || '16:9'
        }
      });
    } else {
      operation = await this.ai.models.generateVideos({
        model: MODELS.VIDEO,
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: options.resolution || '720p',
          aspectRatio: options.aspectRatio || '16:9'
        }
      });
    }

    // Polling for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await this.ai.operations.getVideosOperation({ operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
      throw new AdapterError('No video generated', 'NO_VIDEO', this.providerId, false);
    }

    const response = await fetch(`${videoUri}&key=${this.apiKey}`);
    const blob = await response.blob();
    return {
      videoUrl: URL.createObjectURL(blob)
    };
  }

  async connectRealtime(config: RealtimeConfig): Promise<RealtimeConnection> {
    const session = await this.ai.live.connect({
      model: MODELS.LIVE_AUDIO,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: config.voice || 'Kore'
            }
          }
        },
        systemInstruction: config.systemPrompt ? { parts: [{ text: config.systemPrompt }] } : undefined
      },
      callbacks: {
        onopen: () => {
          console.log('[GoogleAdapter] Live connection opened');
          if (config.onOpen) config.onOpen();
        },
        onmessage: (msg: any) => {
          if (config.onMessage) config.onMessage(msg);
          if (config.onAudio && msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                // Pass base64 string directly
                config.onAudio(part.inlineData.data);
              }
            }
          }
        },
        onerror: (e: any) => {
          console.error('[GoogleAdapter] Live error:', e);
          if (config.onError) config.onError(e instanceof Error ? e : new Error(String(e)));
        },
        onclose: () => {
          console.log('[GoogleAdapter] Live connection closed');
          if (config.onClose) config.onClose();
        }
      }
    });

    return {
      send: (data: any) => {
        // For Google, send is a pass-through to sendRealtimeInput for text
        if (typeof data === 'string') {
          session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: data }] }] });
        } else {
          session.sendRealtimeInput(data);
        }
      },
      sendAudio: (audioData: ArrayBuffer | string) => {
        const data = typeof audioData === 'string' ? audioData : arrayBufferToBase64(audioData);
        session.sendRealtimeInput({
          media: {
            mimeType: 'audio/pcm;rate=16000',
            data: data
          }
        });
      },
      close: () => session.close(),
      isConnected: true
    };
  }
}

export default GoogleAdapter;
