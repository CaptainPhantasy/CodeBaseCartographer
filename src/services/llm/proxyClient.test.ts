import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isProviderFailure, proxyGenerateText, ProxyRequestError } from './proxyClient';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('../apiClient', () => ({ apiFetch }));

describe('proxyClient', () => {
  beforeEach(() => apiFetch.mockReset());

  it('returns generation results from the authenticated backend', async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ text: 'mapped' }), { status: 200 }));
    await expect(proxyGenerateText('openai', 'gpt-test', 'map this')).resolves.toEqual({ text: 'mapped' });
    const request = apiFetch.mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual({ providerId: 'openai', modelId: 'gpt-test', prompt: 'map this', options: {} });
  });

  it('preserves the backend error code so orchestrators can fall back', async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({
      error: 'upstream unavailable', code: 'PROVIDER_ERROR', providerId: 'openai',
    }), { status: 502 }));

    const error = await proxyGenerateText('openai', 'gpt-test', 'map this').catch(value => value);
    expect(error).toBeInstanceOf(ProxyRequestError);
    expect(isProviderFailure(error)).toBe(true);
    expect(error).toMatchObject({ code: 'PROVIDER_ERROR', providerId: 'openai', status: 502 });
  });
});
