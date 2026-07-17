/**
 * proxyClient.ts - Thin HTTP client for the backend /api/llm/* proxy
 *
 * Every provider call goes through the authenticated server proxy;
 * the browser never sees provider API keys.
 */

import { apiFetch } from '../apiClient';
import type { ProviderId } from '../../types/capabilities';
import type {
  TextGenerationOptions,
  TextGenerationResult,
  TTSOptions,
  TTSResult,
  STTOptions,
  STTResult,
} from '../adapters/base';

/** Options for structured JSON output generation */
export interface StructuredOutputOptions {
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export type ProxyProviderId = ProviderId | 'elevenlabs';

export class ProxyRequestError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly providerId?: ProxyProviderId,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'ProxyRequestError';
  }
}

export function isProviderFailure(error: unknown): error is ProxyRequestError {
  return error instanceof ProxyRequestError && error.code === 'PROVIDER_ERROR';
}

async function throwProxyError(response: Response, label: string): Promise<never> {
  const err = await response.json().catch(() => ({ error: 'Proxy request failed' })) as {
    error?: string;
    code?: string;
    providerId?: ProxyProviderId;
  };
  throw new ProxyRequestError(
    err.error || `${label} proxy error: ${response.status}`,
    err.code,
    err.providerId,
    response.status
  );
}

export async function proxyGenerateText(
  providerId: ProxyProviderId,
  modelId: string,
  prompt: string,
  options: TextGenerationOptions = {}
): Promise<TextGenerationResult> {
  const response = await apiFetch('/api/llm/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, modelId, prompt, options }),
  });

  if (!response.ok) await throwProxyError(response, 'LLM');
  return response.json() as Promise<TextGenerationResult>;
}

export async function proxyGenerateStructured<T>(
  providerId: ProxyProviderId,
  modelId: string,
  prompt: string,
  schema: object,
  options: StructuredOutputOptions = {}
): Promise<T> {
  const response = await apiFetch('/api/llm/structured', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, modelId, prompt, schema, options }),
  });

  if (!response.ok) await throwProxyError(response, 'LLM');
  const data = await response.json() as { data: T };
  return data.data;
}

export async function proxyTTS(
  providerId: ProxyProviderId,
  modelId: string,
  text: string,
  options: TTSOptions = {}
): Promise<TTSResult> {
  const response = await apiFetch('/api/llm/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, modelId, text, options }),
  });

  if (!response.ok) await throwProxyError(response, 'TTS');
  return response.json() as Promise<TTSResult>;
}

export async function proxySTT(
  providerId: ProxyProviderId,
  modelId: string,
  audioData: ArrayBuffer | string,
  options: STTOptions = {}
): Promise<STTResult> {
  // Convert ArrayBuffer to base64 if needed
  let base64Audio: string;
  if (typeof audioData === 'string') {
    base64Audio = audioData;
  } else {
    const bytes = new Uint8Array(audioData);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64Audio = btoa(binary);
  }

  const response = await apiFetch('/api/llm/stt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, modelId, audioData: base64Audio, options }),
  });

  if (!response.ok) await throwProxyError(response, 'STT');
  return response.json() as Promise<STTResult>;
}

export async function proxyFetchVoices(providerId: ProxyProviderId): Promise<string[]> {
  const response = await apiFetch(`/api/llm/voices/${providerId}`);
  if (!response.ok) return [];
  const data = await response.json() as { voices: string[] };
  return data.voices;
}
