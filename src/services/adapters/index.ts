/**
 * Adapter Exports
 * Central export point for all LLM provider adapters
 */

export * from './base';
export { GoogleAdapter } from './google';
export { OpenAIAdapter } from './openai';
export { AnthropicAdapter } from './anthropic';
export { OpenRouterAdapter } from './openrouter';
export { ElevenLabsAdapter } from './elevenlabs';
export { LocalLLMAdapter } from './local_llm';

import { GoogleAdapter } from './google';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { OpenRouterAdapter } from './openrouter';
import { ElevenLabsAdapter } from './elevenlabs';
import { LocalLLMAdapter } from './local_llm';
import type { BaseLLMAdapter } from './base';
import type { ProviderId } from '../../types/capabilities';

/**
 * Factory function to create an adapter instance for a provider
 */
export function createAdapter(
  providerId: ProviderId | 'elevenlabs',
  apiKey: string,
  modelId?: string
): BaseLLMAdapter {
  switch (providerId) {
    case 'google':
      return new GoogleAdapter(apiKey);
    case 'openai':
      return new OpenAIAdapter(apiKey);
    case 'anthropic':
      return new AnthropicAdapter(apiKey);
    case 'openrouter':
      return new OpenRouterAdapter(apiKey, modelId);
    case 'elevenlabs':
      return new ElevenLabsAdapter(apiKey);
    case 'local_llm':
      // For local LLM, apiKey can be the endpoint URL or default model
      return new LocalLLMAdapter(apiKey, modelId ? { defaultModel: modelId } : undefined);
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}
