/**
 * Base Adapter Interface for LLM Providers
 * All provider-specific adapters must implement this interface
 */

import type { ProviderId, TaskType } from '../../types/capabilities';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface TextGenerationOptions {
  systemPrompt?: string;
  history?: Array<{ role: string; text: string }>;
  temperature?: number;
  maxTokens?: number;
  useThinking?: boolean;
  useSearch?: boolean;
  imagePart?: string; // base64
  mimeType?: string;
}

export interface TextGenerationResult {
  text: string;
  groundingUrls?: string[];
  thinkingContent?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface StructuredOutputOptions {
  schema?: object;
  temperature?: number;
  maxTokens?: number;
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
  format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
}

export interface TTSResult {
  audioData: string; // base64 encoded audio
  format: string;
}

export interface STTOptions {
  model?: string;
  language?: string;
  detect_language?: boolean;
}

export interface STTResult {
  text: string;
  language?: string;
  confidence?: number;
  word_count?: number;
}

export interface VideoGenerationOptions {
  imageBase64?: string;
  imageMimeType?: string;
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p';
  duration?: number;
}

export interface VideoResult {
  videoUrl: string;
  duration?: number;
}

export interface STSConfig extends RealtimeConfig {
  model?: string;
  temperature?: number;
  prompt_prefix?: string;
  stability?: number;
  similarity_boost?: number;
}

export interface RealtimeConfig {
  voice?: string;
  systemPrompt?: string;
  onOpen?: () => void;
  onMessage?: (message: any) => void;
  onAudio?: (audioData: string) => void; // base64 encoded audio
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export interface RealtimeConnection {
  send: (data: any) => void;
  sendAudio: (audioData: ArrayBuffer | string) => void; // ArrayBuffer or base64 string
  close: () => void;
  isConnected: boolean;
}

// ============================================================================
// ADAPTER ERROR TYPES
// ============================================================================

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly providerId: ProviderId,
    public readonly isRetryable: boolean = false,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class RateLimitError extends AdapterError {
  constructor(providerId: ProviderId, retryAfter?: number) {
    super(
      `Rate limit exceeded for ${providerId}`,
      'RATE_LIMIT',
      providerId,
      true,
      retryAfter
    );
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends AdapterError {
  constructor(providerId: ProviderId, message?: string) {
    super(
      message || `Authentication failed for ${providerId}`,
      'AUTH_ERROR',
      providerId,
      false
    );
    this.name = 'AuthenticationError';
  }
}

export class UnsupportedCapabilityError extends AdapterError {
  constructor(providerId: ProviderId, capability: string) {
    super(
      `${providerId} does not support ${capability}`,
      'UNSUPPORTED',
      providerId,
      false
    );
    this.name = 'UnsupportedCapabilityError';
  }
}

// ============================================================================
// BASE ADAPTER INTERFACE
// ============================================================================

/**
 * Abstract base class for all LLM provider adapters
 */
export abstract class BaseLLMAdapter {
  abstract readonly providerId: ProviderId;
  abstract readonly name: string;

  protected apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Check if this adapter supports a specific capability
   */
  abstract supportsCapability(capability: string): boolean;

  /**
   * Generate text response from prompt
   */
  abstract generateText(
    prompt: string,
    options?: TextGenerationOptions
  ): Promise<TextGenerationResult>;

  /**
   * Generate structured output (JSON) from prompt with schema
   */
  abstract generateStructuredOutput<T>(
    prompt: string,
    schema: object,
    options?: StructuredOutputOptions
  ): Promise<T>;

  /**
   * Generate speech from text (if supported)
   * @throws UnsupportedCapabilityError if TTS not supported
   */
  async generateSpeech(
    _text: string,
    _options?: TTSOptions
  ): Promise<TTSResult> {
    throw new UnsupportedCapabilityError(this.providerId, 'tts');
  }

  /**
   * Generate video from prompt (if supported)
   * @throws UnsupportedCapabilityError if video not supported
   */
  async generateVideo(
    _prompt: string,
    _options?: VideoGenerationOptions
  ): Promise<VideoResult> {
    throw new UnsupportedCapabilityError(this.providerId, 'video');
  }

  /**
   * Connect to real-time audio API (if supported)
   * @throws UnsupportedCapabilityError if realtime not supported
   */
  async connectRealtime(
    _config: RealtimeConfig
  ): Promise<RealtimeConnection> {
    throw new UnsupportedCapabilityError(this.providerId, 'realtime_audio');
  }

  /**
   * Transcribe audio to text (if supported)
   * @throws UnsupportedCapabilityError if STT not supported
   */
  async transcribeAudio(
    _audioData: ArrayBuffer | string,
    _options?: STTOptions
  ): Promise<STTResult> {
    throw new UnsupportedCapabilityError(this.providerId, 'stt');
  }

  /**
   * Connect to STS WebSocket for bidirectional audio (if supported)
   * @throws UnsupportedCapabilityError if STS not supported
   */
  async connectSTS(
    _config: STSConfig
  ): Promise<RealtimeConnection> {
    throw new UnsupportedCapabilityError(this.providerId, 'stt');
  }

  /**
   * Get the best model for a specific task
   */
  abstract getModelForTask(taskType: TaskType): string | null;

  /**
   * Get available voices for TTS (if supported)
   */
  getAvailableVoices(): string[] {
    return [];
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Base64 to Uint8Array conversion
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * ArrayBuffer to base64 conversion
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Parse error response from API
 */
export function parseAPIError(
  providerId: ProviderId,
  status: number,
  body: any
): AdapterError {
  if (status === 401 || status === 403) {
    return new AuthenticationError(providerId, body?.error?.message);
  }
  if (status === 429) {
    const retryAfter = parseInt(body?.error?.retry_after || '60', 10);
    return new RateLimitError(providerId, retryAfter);
  }
  return new AdapterError(
    body?.error?.message || `API error: ${status}`,
    body?.error?.code || 'API_ERROR',
    providerId,
    status >= 500
  );
}
