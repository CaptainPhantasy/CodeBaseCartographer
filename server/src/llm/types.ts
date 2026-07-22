/**
 * Server-side LLM proxy types
 * Mirrors the client adapter types for the proxy API
 */

// Provider identifiers accepted by the proxy
export type ProxyProviderId = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'elevenlabs' | 'local_llm';

// ---------- Request types ----------

export interface GenerateTextRequest {
  providerId: ProxyProviderId;
  modelId?: string;
  prompt: string;
  options?: {
    systemPrompt?: string;
    history?: Array<{ role: string; text: string }>;
    temperature?: number;
    maxTokens?: number;
    useThinking?: boolean;
    useSearch?: boolean;
    imagePart?: string;
    mimeType?: string;
  };
}

export interface GenerateStructuredRequest {
  providerId: ProxyProviderId;
  modelId?: string;
  prompt: string;
  schema: object;
  options?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface TTSRequest {
  providerId: ProxyProviderId;
  modelId?: string;
  text: string;
  options?: {
    voice?: string;
    speed?: number;
    format?: string;
  };
}

export interface STTRequest {
  providerId: ProxyProviderId;
  modelId?: string;
  audioData: string; // base64
  options?: {
    language?: string;
  };
}

// ---------- Response types ----------

export interface TextGenerationResult {
  text: string;
  thinkingContent?: string;
  groundingUrls?: string[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface TTSResult {
  audioData: string; // base64
  format: string;
}

export interface STTResult {
  text: string;
  language?: string;
  confidence?: number;
  word_count?: number;
}

export interface ProviderStatus {
  google: boolean;
  openai: boolean;
  anthropic: boolean;
  openrouter: boolean;
  elevenlabs: boolean;
  local_llm: boolean;
}

// ---------- Error types ----------

export class ProxyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly providerId?: string
  ) {
    super(message);
    this.name = 'ProxyError';
  }
}
