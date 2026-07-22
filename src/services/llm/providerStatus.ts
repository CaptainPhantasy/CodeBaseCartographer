/**
 * providerStatus.ts - Server-side provider key status cache
 *
 * The server exposes which providers have API keys configured
 * (GET /api/llm/providers). The client caches the answer and routes
 * tasks only to providers that can actually serve them.
 */

import { apiFetch } from '../apiClient';

export interface ProviderStatus {
  google: boolean;
  openai: boolean;
  anthropic: boolean;
  openrouter: boolean;
  elevenlabs: boolean;
  local_llm: boolean;
}

const ALL_UNAVAILABLE: ProviderStatus = {
  google: false,
  openai: false,
  anthropic: false,
  openrouter: false,
  elevenlabs: false,
  local_llm: false,
};

let cachedStatus: ProviderStatus | null = null;
let statusFetchPromise: Promise<ProviderStatus> | null = null;

/** Fetch (and cache) which providers have keys on the server. Deduplicates concurrent fetches. */
export async function fetchProviderStatus(): Promise<ProviderStatus> {
  if (cachedStatus) return cachedStatus;
  if (statusFetchPromise) return statusFetchPromise;

  statusFetchPromise = (async () => {
    try {
      const response = await apiFetch('/api/llm/providers');
      if (!response.ok) {
        // If server unreachable, return all-false (providers unavailable)
        return { ...ALL_UNAVAILABLE };
      }
      const data = await response.json() as { providers: ProviderStatus };
      cachedStatus = data.providers;
      return cachedStatus;
    } catch {
      return { ...ALL_UNAVAILABLE };
    } finally {
      statusFetchPromise = null;
    }
  })();

  return statusFetchPromise;
}

/** Invalidate cached provider status (e.g., when server config changes). */
export function invalidateProviderStatus(): void {
  cachedStatus = null;
}
