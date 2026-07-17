import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchElevenLabsVoices, fetchOpenRouterModels } from './resourceFetchers';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('./apiClient', () => ({ apiFetch }));

describe('server-proxied resource fetchers', () => {
  beforeEach(() => apiFetch.mockReset());

  it('loads ElevenLabs voices without a client key', async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ voices: [{ voice_id: 'voice-1', name: 'Voice' }] }), { status: 200 }));
    await expect(fetchElevenLabsVoices()).resolves.toEqual({ voices: [{ voice_id: 'voice-1', name: 'Voice' }] });
    expect(apiFetch).toHaveBeenCalledWith('/api/llm/elevenlabs/voices');
  });

  it('loads OpenRouter models without a client key', async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ models: [{ id: 'vendor/model', name: 'Model' }] }), { status: 200 }));
    await expect(fetchOpenRouterModels()).resolves.toEqual({ models: [{ id: 'vendor/model', name: 'Model' }] });
    expect(apiFetch).toHaveBeenCalledWith('/api/llm/openrouter/models');
  });

  it('returns a server error instead of leaking credentials into the request', async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'OpenRouter API key not configured on server' }), { status: 400 }));
    await expect(fetchOpenRouterModels('must-not-be-used')).resolves.toEqual({
      models: [], error: 'OpenRouter API key not configured on server',
    });
    expect(apiFetch).toHaveBeenCalledWith('/api/llm/openrouter/models');
  });
});
