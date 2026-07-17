/**
 * API key store — reads provider keys from environment variables
 * Server-side only. Keys never leave this module.
 */

import type { ProxyProviderId, ProviderStatus } from './types.js';

const KEY_MAP: Record<ProxyProviderId, string> = {
  google: 'GOOGLE_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
  local_llm: 'LOCAL_LLM_ENDPOINT',
};

/** Get the API key (or endpoint URL for local_llm) for a provider. */
export function getApiKey(providerId: ProxyProviderId): string | undefined {
  const envVar = KEY_MAP[providerId];
  return process.env[envVar]?.trim() || undefined;
}

/** Check if a specific provider has a key configured. */
export function hasKey(providerId: ProxyProviderId): boolean {
  return getApiKey(providerId) !== undefined;
}

/** Return which providers have keys configured. */
export function getProviderStatus(): ProviderStatus {
  return {
    google: hasKey('google'),
    openai: hasKey('openai'),
    anthropic: hasKey('anthropic'),
    openrouter: hasKey('openrouter'),
    elevenlabs: hasKey('elevenlabs'),
    local_llm: hasKey('local_llm'),
  };
}
