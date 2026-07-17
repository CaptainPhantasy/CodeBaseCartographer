/**
 * Adapter Exports
 * Only base types and non-SDK adapters are exported here.
 * Google and ElevenLabs adapters were removed — those providers
 * are now handled server-side via /api/llm/* proxy.
 */

export * from './base';
export { OpenAIAdapter } from './openai';
export { AnthropicAdapter } from './anthropic';
export { OpenRouterAdapter } from './openrouter';
export { LocalLLMAdapter } from './local_llm';

import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { OpenRouterAdapter } from './openrouter';
import { LocalLLMAdapter } from './local_llm';
import type { BaseLLMAdapter } from './base';
import type { ProviderId } from '../../types/capabilities';

/**
 * Factory function to create an adapter instance for a provider
 * Note: 'google' and 'elevenlabs' are handled server-side only.
 */
export function createAdapter(
  providerId: ProviderId,
  apiKey: string,
  modelId?: string
): BaseLLMAdapter {
  switch (providerId) {
    case 'openai':
      return new OpenAIAdapter(apiKey);
    case 'anthropic':
      return new AnthropicAdapter(apiKey);
    case 'openrouter':
      return new OpenRouterAdapter(apiKey, modelId);
    case 'local_llm':
      return new LocalLLMAdapter(apiKey, modelId ? { defaultModel: modelId } : undefined);
    default:
      throw new Error(`Provider '${providerId}' is handled server-side or is unknown.`);
  }
}
