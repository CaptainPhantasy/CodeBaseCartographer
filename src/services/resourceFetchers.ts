import { ElevenLabsVoice, OpenRouterModel } from '../types/capabilities';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const OPENROUTER_API = 'https://openrouter.ai/api/v1';

/**
 * Fetch all available voices for an ElevenLabs API key
 */
export async function fetchElevenLabsVoices(
  apiKey: string
): Promise<{ voices: ElevenLabsVoice[]; error?: string }> {
  try {
    const response = await fetch(`${ELEVENLABS_API}/voices`, {
      method: 'GET',
      headers: { 'xi-api-key': apiKey }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { voices: [], error: 'Invalid API key' };
      }
      if (response.status === 429) {
        return { voices: [], error: 'Rate limited. Please try again later.' };
      }
      return { voices: [], error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    return { voices: data.voices || [] };
  } catch (error) {
    return {
      voices: [],
      error: error instanceof Error ? error.message : 'Network error'
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
