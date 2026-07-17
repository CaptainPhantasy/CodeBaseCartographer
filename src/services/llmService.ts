/**
 * Unified LLM Service Layer (thin orchestrator)
 *
 * Routes requests through the backend /api/llm/* proxy. Provider resolution
 * stays client-side; API keys live server-side.
 *
 * Decomposed modules (src/services/llm/):
 * - providerStatus.ts        - server key status cache
 * - providerRouter.ts        - task -> provider/model resolution
 * - proxyClient.ts           - HTTP calls to /api/llm/*
 * - textOrchestrator.ts      - text generation + chat with fallback
 * - graphOrchestrator.ts     - structured output + graph validation/retry loop
 * - voiceOrchestrator.ts     - TTS / STT / voice listing
 * - prompts/graphPrompts.ts  - graph schemas + prompt templates
 */

import { TaskType } from '../types/capabilities';
import type { GraphData } from '../types';
import type {
  TextGenerationOptions,
  TextGenerationResult,
  TTSOptions,
  TTSResult,
  STTOptions,
  STTResult,
} from './adapters/base';
import { getProviderForTask, getTTSProvider, getSTTProvider } from './llm/providerRouter';
import { invalidateProviderStatus } from './llm/providerStatus';
import { DEFAULT_SERVICE_CONFIG, type ServiceConfig } from './llm/serviceConfig';
import * as text from './llm/textOrchestrator';
import * as graph from './llm/graphOrchestrator';
import * as voice from './llm/voiceOrchestrator';
import type { StructuredOutputOptions } from './llm/proxyClient';
import type { ChatOptions, ChatResult } from './llm/textOrchestrator';

// Re-exports for backward compatibility
export { TaskType } from '../types/capabilities';
export { invalidateProviderStatus } from './llm/providerStatus';
export type { ProviderStatus } from './llm/providerStatus';
export type { StructuredOutputOptions } from './llm/proxyClient';
export type { ChatResult } from './llm/textOrchestrator';
export type {
  TextGenerationOptions,
  TextGenerationResult,
  TTSOptions,
  TTSResult,
  STTOptions,
  STTResult,
} from './adapters/base';

/** Options for video generation (not yet proxied) */
export interface VideoGenerationOptions {
  [key: string]: unknown;
}

/** Result of video generation (not yet proxied) */
export interface VideoResult {
  videoUrl?: string;
  [key: string]: unknown;
}

export class LLMService {
  private config: ServiceConfig;

  constructor(config: Partial<ServiceConfig> = {}) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
  }

  /** Check if a task is available with current configuration */
  async isTaskAvailable(taskType: TaskType): Promise<boolean> {
    return (await getProviderForTask(taskType)) !== null;
  }

  /** Generate text response */
  generateText(prompt: string, options: TextGenerationOptions = {}): Promise<TextGenerationResult> {
    return text.generateText(this.config, prompt, options);
  }

  /** Chat with history */
  chat(history: Array<{ role: string; text: string }>, options: ChatOptions = {}): Promise<ChatResult> {
    return text.chat(this.config, history, options);
  }

  /** Generate structured JSON output */
  generateStructuredOutput<T>(prompt: string, schema: object, options: StructuredOutputOptions = {}): Promise<T> {
    return graph.generateStructuredOutput<T>(this.config, prompt, schema, options);
  }

  /** Generate graph data for visualization */
  generateGraphData(description: string): Promise<GraphData> {
    return graph.generateGraphData(this.config, description);
  }

  /** Generate graph data with actual codebase context (validated, with retry feedback) */
  generateGraphDataWithContext(
    description: string,
    context: graph.GraphContextInput,
    options: graph.GraphGenerationOptions = {}
  ): Promise<GraphData> {
    return graph.generateGraphDataWithContext(this.config, description, context, options);
  }

  /** Generate speech from text */
  generateSpeech(textInput: string, options: TTSOptions = {}): Promise<TTSResult> {
    return voice.generateSpeech(textInput, options);
  }

  /** Transcribe audio to text */
  transcribeAudio(audioData: ArrayBuffer | string, options: STTOptions = {}): Promise<STTResult> {
    return voice.transcribeAudio(audioData, options);
  }

  /** Get available TTS voices */
  getAvailableTTSVoices(): Promise<string[]> {
    return voice.getAvailableTTSVoices();
  }

  /** Generate video from prompt or image (server does not proxy this yet) */
  async generateVideo(_prompt: string, _options: VideoGenerationOptions = {}): Promise<VideoResult> {
    throw new Error('Video generation is not yet supported through the server proxy.');
  }

  /** Connect to real-time audio API (requires WebSocket - not proxied) */
  async connectRealtime(_config: unknown): Promise<{ send: (data: unknown) => void; sendAudio: (data: ArrayBuffer | string) => void; close: () => void; isConnected: boolean }> {
    throw new Error('Realtime audio is not yet supported through the server proxy.');
  }

  /** Check availability of all features */
  async getFeatureAvailability(): Promise<{
    isTextAvailable: boolean;
    isTTSAvailable: boolean;
    isSTTAvailable: boolean;
    isVideoAvailable: boolean;
    isRealtimeAvailable: boolean;
    isGraphAvailable: boolean;
    isVisionAvailable: boolean;
  }> {
    const [textProvider, ttsProvider, sttProvider] = await Promise.all([
      getProviderForTask(TaskType.TEXT_GENERATION),
      getTTSProvider(),
      getSTTProvider(),
    ]);

    return {
      isTextAvailable: textProvider !== null,
      isTTSAvailable: ttsProvider !== null,
      isSTTAvailable: sttProvider !== null,
      isVideoAvailable: false,
      isRealtimeAvailable: false,
      isGraphAvailable: textProvider !== null,
      isVisionAvailable: textProvider !== null,
    };
  }
}

// Singleton instance
let llmServiceInstance: LLMService | null = null;

/** Get the singleton LLMService instance */
export function getLLMService(): LLMService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
}

/** Reset the LLM service (useful for testing or config changes) */
export function resetLLMService(): void {
  llmServiceInstance = null;
  invalidateProviderStatus();
}

export default getLLMService;
