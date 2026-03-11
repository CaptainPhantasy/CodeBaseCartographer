import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { ElevenLabsVoice, OpenRouterModel } from '../types/capabilities';

const OPENROUTER_API = 'https://openrouter.ai/api/v1';

/**
 * Fetch all available voices for an ElevenLabs API key using the official SDK
 */
export async function fetchElevenLabsVoices(
  apiKey: string
): Promise<{ voices: ElevenLabsVoice[]; error?: string }> {
  try {
    const elevenlabs = new ElevenLabsClient({ apiKey });
    const response = await elevenlabs.voices.search();

    // Map SDK response to our ElevenLabsVoice interface
    const voices: ElevenLabsVoice[] = (response.voices ?? []).map((voice) => ({
      voice_id: voice.voiceId,
      name: voice.name ?? undefined,
      category: voice.category ?? undefined,
      labels: voice.labels as Record<string, string> | undefined,
      description: voice.description ?? undefined,
      preview_url: voice.previewUrl ?? undefined
    }));

    return { voices };
  } catch (error) {
    // Handle specific error types from SDK
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for common error patterns
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('invalid')) {
      return { voices: [], error: 'Invalid API key' };
    }
    if (errorMessage.includes('429') || errorMessage.includes('rate') || errorMessage.includes('limit')) {
      return { voices: [], error: 'Rate limited. Please try again later.' };
    }

    return {
      voices: [],
      error: errorMessage
    };
  }
}

/**
 * Fetch all available models from OpenRouter
 */
export async function fetchOpenRouterModels(
  apiKey: string
): Promise<{ models: OpenRouterModel[]; error?: string }> {
  try {
    const response = await fetch(`${OPENROUTER_API}/models`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { models: [], error: 'Invalid API key' };
      }
      return { models: [], error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    return { models: data.data || [] };
  } catch (error) {
    return {
      models: [],
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}
