/**
 * Provider Definitions for Multi-Provider LLM System
 * Defines all supported providers with their models and capabilities
 */

import type { ProviderDefinition, ProviderId, Capability } from '../types/capabilities';

// ============================================================================
// OPENROUTER PROVIDER (PRIORITY)
// ============================================================================

const openRouterProvider: ProviderDefinition = {
  id: 'openrouter',
  name: 'OpenRouter',
  description: 'Unified API for multiple LLM providers with competitive pricing',
  apiEndpoint: 'https://openrouter.ai/api/v1',
  authHeaderFormat: 'Authorization: Bearer {apiKey}',
  docsUrl: 'https://openrouter.ai/docs',
  keyInstructions: 'Get your API key at https://openrouter.ai/keys',
  isAvailable: true,
  models: [
    // Claude models via OpenRouter
    {
      id: 'anthropic/claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      capabilities: ['text', 'code', 'structured_output', 'vision', 'thinking'] as Capability[],
      tier: 'smart',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      supportsStreaming: true,
      costPerMillionTokens: { input: 3, output: 15 }
    },
    {
      id: 'anthropic/claude-3.5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      capabilities: ['text', 'code', 'structured_output', 'vision'] as Capability[],
      tier: 'fast',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      costPerMillionTokens: { input: 0.8, output: 4 }
    },
    // GPT models via OpenRouter
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      capabilities: ['text', 'code', 'structured_output', 'vision'] as Capability[],
      tier: 'smart',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsStreaming: true,
      costPerMillionTokens: { input: 2.5, output: 10 }
    },
    {
      id: 'openai/gpt-4o-mini',
      name: 'GPT-4o Mini',
      capabilities: ['text', 'code', 'structured_output', 'vision'] as Capability[],
      tier: 'fast',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsStreaming: true,
      costPerMillionTokens: { input: 0.15, output: 0.6 }
    },
    // Google models via OpenRouter
    {
      id: 'google/gemini-2.5-pro-preview',
      name: 'Gemini 2.5 Pro',
      capabilities: ['text', 'code', 'structured_output', 'vision', 'thinking'] as Capability[],
      tier: 'smart',
      contextWindow: 1000000,
      supportsStreaming: true,
      costPerMillionTokens: { input: 1.25, output: 10 }
    },
    {
      id: 'google/gemini-2.5-flash-preview',
      name: 'Gemini 2.5 Flash',
      capabilities: ['text', 'code', 'structured_output', 'vision', 'thinking'] as Capability[],
      tier: 'fast',
      contextWindow: 1000000,
      supportsStreaming: true,
      costPerMillionTokens: { input: 0.15, output: 0.6 }
    },
    // DeepSeek via OpenRouter
    {
      id: 'deepseek/deepseek-chat-v3-0324',
      name: 'DeepSeek V3',
      capabilities: ['text', 'code', 'structured_output'] as Capability[],
      tier: 'balanced',
      contextWindow: 163840,
      supportsStreaming: true,
      costPerMillionTokens: { input: 0.14, output: 0.28 }
    },
    // Llama models via OpenRouter
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B',
      capabilities: ['text', 'code', 'structured_output'] as Capability[],
      tier: 'balanced',
      contextWindow: 131072,
      supportsStreaming: true,
      costPerMillionTokens: { input: 0.4, output: 0.4 }
    }
  ]
};

// ============================================================================
// OPENAI PROVIDER
// ============================================================================

const openAIProvider: ProviderDefinition = {
  id: 'openai',
  name: 'OpenAI',
  description: 'Direct access to OpenAI models including GPT-4, TTS, STT (Whisper), and Realtime API',
  apiEndpoint: 'https://api.openai.com/v1',
  authHeaderFormat: 'Authorization: Bearer {apiKey}',
  docsUrl: 'https://platform.openai.com/docs',
  keyInstructions: 'Get your API key at https://platform.openai.com/api-keys',
  isAvailable: true,
  models: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      capabilities: ['text', 'code', 'structured_output', 'vision'] as Capability[],
      tier: 'smart',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsStreaming: true,
      costPerMillionTokens: { input: 2.5, output: 10 }
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      capabilities: ['text', 'code', 'structured_output', 'vision'] as Capability[],
      tier: 'fast',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsStreaming: true,
      costPerMillionTokens: { input: 0.15, output: 0.6 }
    },
    {
      id: 'o1',
      name: 'o1 (Reasoning)',
      capabilities: ['text', 'code', 'thinking'] as Capability[],
      tier: 'smart',
      contextWindow: 200000,
      maxOutputTokens: 100000,
      supportsStreaming: false,
      costPerMillionTokens: { input: 15, output: 60 }
    },
    {
      id: 'o3-mini',
      name: 'o3 Mini (Reasoning)',
      capabilities: ['text', 'code', 'thinking'] as Capability[],
      tier: 'balanced',
      contextWindow: 200000,
      maxOutputTokens: 100000,
      supportsStreaming: true,
      costPerMillionTokens: { input: 1.1, output: 4.4 }
    },
    {
      id: 'tts-1',
      name: 'TTS-1',
      capabilities: ['tts'] as Capability[],
      tier: 'fast',
      costPerMillionTokens: { input: 15, output: 0 } // $15 per 1M chars
    },
    {
      id: 'tts-1-hd',
      name: 'TTS-1 HD',
      capabilities: ['tts'] as Capability[],
      tier: 'smart',
      costPerMillionTokens: { input: 30, output: 0 } // $30 per 1M chars
    },
    {
      id: 'whisper-1',
      name: 'Whisper V1',
      capabilities: ['stt'] as Capability[],
      tier: 'smart',
      costPerMillionTokens: { input: 6, output: 0 } // ~$0.006 per minute
    },
    {
      id: 'gpt-4o-realtime-preview',
      name: 'GPT-4o Realtime',
      capabilities: ['realtime_audio', 'text'] as Capability[],
      tier: 'smart',
      supportsStreaming: true,
      costPerMillionTokens: { input: 5, output: 20 }
    }
  ]
};

// ============================================================================
// ANTHROPIC PROVIDER
// ============================================================================

const anthropicProvider: ProviderDefinition = {
  id: 'anthropic',
  name: 'Anthropic',
  description: 'Direct access to Claude models with extended thinking',
  apiEndpoint: 'https://api.anthropic.com/v1',
  authHeaderFormat: 'x-api-key: {apiKey}',
  docsUrl: 'https://docs.anthropic.com',
  keyInstructions: 'Get your API key at https://console.anthropic.com/settings/keys',
  isAvailable: true,
  models: [
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      capabilities: ['text', 'code', 'structured_output', 'vision', 'thinking'] as Capability[],
      tier: 'smart',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      supportsStreaming: true,
      costPerMillionTokens: { input: 3, output: 15 }
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      capabilities: ['text', 'code', 'structured_output', 'vision'] as Capability[],
      tier: 'fast',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      costPerMillionTokens: { input: 0.8, output: 4 }
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      capabilities: ['text', 'code', 'structured_output', 'vision'] as Capability[],
      tier: 'smart',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsStreaming: true,
      costPerMillionTokens: { input: 15, output: 75 }
    }
  ]
};

// ============================================================================
// GOOGLE PROVIDER
// ============================================================================

const googleProvider: ProviderDefinition = {
  id: 'google',
  name: 'Google AI (Gemini)',
  description: 'Direct access to Google Gemini models including TTS, STT, Video, and Live API',
  apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
  authHeaderFormat: 'x-goog-api-key: {apiKey}',
  docsUrl: 'https://ai.google.dev/docs',
  keyInstructions: 'Get your API key at https://aistudio.google.com/app/apikey',
  isAvailable: true,
  models: [
    {
      id: 'gemini-3-pro-preview',
      name: 'Gemini 3 Pro',
      capabilities: ['text', 'code', 'structured_output', 'vision', 'thinking', 'search_grounding'] as Capability[],
      tier: 'smart',
      contextWindow: 1000000,
      supportsStreaming: true,
      costPerMillionTokens: { input: 1.25, output: 10 }
    },
    {
      id: 'gemini-3-flash-preview',
      name: 'Gemini 3 Flash',
      capabilities: ['text', 'code', 'structured_output', 'vision', 'search_grounding'] as Capability[],
      tier: 'fast',
      contextWindow: 1000000,
      supportsStreaming: true,
      costPerMillionTokens: { input: 0.1, output: 0.4 }
    },
    {
      id: 'gemini-2.5-flash-preview-tts',
      name: 'Gemini TTS',
      capabilities: ['tts'] as Capability[],
      tier: 'balanced',
      supportsStreaming: true
    },
    {
      id: 'gemini-3-flash-preview',
      name: 'Gemini STT',
      capabilities: ['stt'] as Capability[],
      tier: 'smart',
      costPerMillionTokens: { input: 1, output: 0 } // Included with Flash pricing
    },
    {
      id: 'veo-3.1-fast-generate-preview',
      name: 'Veo 3.1 (Video)',
      capabilities: ['video'] as Capability[],
      tier: 'smart'
    },
    {
      id: 'gemini-2.5-flash-native-audio-preview-12-2025',
      name: 'Gemini Live Audio',
      capabilities: ['realtime_audio', 'text'] as Capability[],
      tier: 'balanced',
      supportsStreaming: true
    }
  ]
};

// ============================================================================
// ELEVENLABS PROVIDER (TTS, STT, STS)
// ============================================================================

const elevenLabsProvider: ProviderDefinition = {
  id: 'elevenlabs',
  name: 'ElevenLabs',
  description: 'Premium TTS, STT, and real-time voice with natural, expressive voices',
  apiEndpoint: 'https://api.elevenlabs.io/v1',
  authHeaderFormat: 'xi-api-key: {apiKey}',
  docsUrl: 'https://docs.elevenlabs.io',
  keyInstructions: 'Get your API key at https://elevenlabs.io/app/settings/api-keys',
  isAvailable: true,
  models: [
    {
      id: 'eleven_multilingual_v2',
      name: 'Multilingual V2',
      capabilities: ['tts'] as Capability[],
      tier: 'smart',
      costPerMillionTokens: { input: 30, output: 0 } // ~$0.30 per 1K chars
    },
    {
      id: 'eleven_turbo_v2_5',
      name: 'Turbo V2.5',
      capabilities: ['tts'] as Capability[],
      tier: 'fast',
      costPerMillionTokens: { input: 15, output: 0 }
    },
    {
      id: 'scribe_v2',
      name: 'Scribe V2',
      capabilities: ['stt'] as Capability[],
      tier: 'smart',
      costPerMillionTokens: { input: 10, output: 0 } // ~$0.10 per minute
    }
  ]
};

// ============================================================================
// LOCAL LLM PROVIDER (STUB)
// ============================================================================

const localLLMProvider: ProviderDefinition = {
  id: 'local_llm',
  name: 'Local LLM',
  description: 'Run models locally via Ollama, LM Studio, or other local inference servers',
  apiEndpoint: 'http://localhost:11434/v1', // Default Ollama endpoint
  authHeaderFormat: '', // Usually no auth needed for local
  docsUrl: 'https://ollama.ai/docs',
  keyInstructions: 'Install Ollama and run: ollama serve',
  isAvailable: false, // TODO: Enable when implementing local LLM support
  models: [
    // TODO: Dynamically populate from local server
    // These are placeholder models that would be detected from Ollama/LM Studio
    {
      id: 'llama3.3:70b',
      name: 'Llama 3.3 70B (Local)',
      capabilities: ['text', 'code'] as Capability[],
      tier: 'balanced',
      contextWindow: 131072,
      supportsStreaming: true
    },
    {
      id: 'qwen2.5-coder:32b',
      name: 'Qwen 2.5 Coder 32B (Local)',
      capabilities: ['text', 'code', 'structured_output'] as Capability[],
      tier: 'balanced',
      contextWindow: 32768,
      supportsStreaming: true
    },
    {
      id: 'deepseek-r1:32b',
      name: 'DeepSeek R1 32B (Local)',
      capabilities: ['text', 'code', 'thinking'] as Capability[],
      tier: 'balanced',
      contextWindow: 65536,
      supportsStreaming: true
    }
    // TODO: Implement model discovery from local server
    // - GET /api/tags for Ollama
    // - Parse available models and their capabilities
    // - Allow user to manually specify capabilities for unknown models
  ]
};

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * All provider definitions
 */
export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  openrouter: openRouterProvider,
  openai: openAIProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
  elevenlabs: elevenLabsProvider,
  local_llm: localLLMProvider
};

/**
 * Get provider by ID
 */
export function getProvider(id: ProviderId): ProviderDefinition | undefined {
  return PROVIDERS[id];
}

/**
 * Get all available (non-stubbed) providers
 */
export function getAvailableProviders(): ProviderDefinition[] {
  return Object.values(PROVIDERS).filter(p => p.isAvailable);
}

/**
 * Get all providers including stubs
 */
export function getAllProviders(): ProviderDefinition[] {
  return Object.values(PROVIDERS);
}

/**
 * Get models from a provider that have a specific capability
 */
export function getModelsWithCapability(
  providerId: ProviderId,
  capability: Capability
): ProviderDefinition['models'] {
  const provider = PROVIDERS[providerId];
  if (!provider) return [];
  return provider.models.filter(m => m.capabilities.includes(capability));
}

/**
 * Get all models across all providers with a specific capability
 */
export function getAllModelsWithCapability(capability: Capability): Array<{
  provider: ProviderDefinition;
  model: ProviderDefinition['models'][0];
}> {
  const results: Array<{ provider: ProviderDefinition; model: ProviderDefinition['models'][0] }> = [];
  
  for (const provider of Object.values(PROVIDERS)) {
    if (!provider.isAvailable) continue;
    for (const model of provider.models) {
      if (model.capabilities.includes(capability)) {
        results.push({ provider, model });
      }
    }
  }
  
  return results;
}

export default PROVIDERS;
