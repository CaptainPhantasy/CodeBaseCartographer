/**
 * Resource fetchers — routed through the backend /api/llm/* proxy
 * API keys live server-side; these functions no longer need client keys.
 */

import { ElevenLabsVoice, OpenRouterModel } from '../types/capabilities';
import { apiFetch } from './apiClient';

/**
 * Fetch all available ElevenLabs voices via the server proxy
 * No client-side API key needed — the server uses its env var.
 */
export async function fetchElevenLabsVoices(
  _apiKey?: string
): Promise<{ voices: ElevenLabsVoice[]; error?: string }> {
  try {
    const response = await apiFetch('/api/llm/elevenlabs/voices');

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Fetch failed' })) as { error?: string };
      return { voices: [], error: data.error || `HTTP ${response.status}` };
    }

    const data = await response.json() as { voices: ElevenLabsVoice[] };
    return { voices: data.voices || [] };
  } catch (error) {
    return {
      voices: [],
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

/**
 * Fetch all available OpenRouter models via the server proxy
 * No client-side API key needed — the server uses its env var.
 */
export async function fetchOpenRouterModels(
  _apiKey?: string
): Promise<{ models: OpenRouterModel[]; error?: string }> {
  try {
    const response = await apiFetch('/api/llm/openrouter/models');

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Fetch failed' })) as { error?: string };
      return { models: [], error: data.error || `HTTP ${response.status}` };
    }

    const data = await response.json() as { models: OpenRouterModel[] };
    return { models: data.models || [] };
  } catch (error) {
    return {
      models: [],
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}
