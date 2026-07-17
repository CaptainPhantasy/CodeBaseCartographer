/**
 * Tests for the provider status cache.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchProviderStatus, invalidateProviderStatus, type ProviderStatus } from './providerStatus';

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock('../apiClient', () => ({ apiFetch: apiFetchMock }));

const SERVER_STATUS: ProviderStatus = {
  google: true,
  openai: true,
  anthropic: false,
  openrouter: false,
  elevenlabs: false,
  local_llm: false,
};

function okResponse(providers: ProviderStatus) {
  return { ok: true, json: () => Promise.resolve({ providers }) };
}

describe('providerStatus', () => {
  beforeEach(() => {
    invalidateProviderStatus();
    apiFetchMock.mockReset();
  });

  it('fetches status from the server and caches it', async () => {
    apiFetchMock.mockResolvedValue(okResponse(SERVER_STATUS));

    const first = await fetchProviderStatus();
    const second = await fetchProviderStatus();

    expect(first).toEqual(SERVER_STATUS);
    expect(second).toEqual(SERVER_STATUS);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent fetches', async () => {
    apiFetchMock.mockResolvedValue(okResponse(SERVER_STATUS));

    const [a, b] = await Promise.all([fetchProviderStatus(), fetchProviderStatus()]);

    expect(a).toEqual(SERVER_STATUS);
    expect(b).toEqual(SERVER_STATUS);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports all providers unavailable when the server errors, without caching', async () => {
    apiFetchMock.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });

    const failed = await fetchProviderStatus();
    expect(Object.values(failed).every(v => v === false)).toBe(true);

    // Failure is not cached: the next call retries and succeeds
    apiFetchMock.mockResolvedValueOnce(okResponse(SERVER_STATUS));
    const recovered = await fetchProviderStatus();
    expect(recovered).toEqual(SERVER_STATUS);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports all providers unavailable when the fetch throws', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('network down'));

    const failed = await fetchProviderStatus();
    expect(Object.values(failed).every(v => v === false)).toBe(true);
  });

  it('invalidateProviderStatus forces a refetch', async () => {
    apiFetchMock.mockResolvedValue(okResponse(SERVER_STATUS));

    await fetchProviderStatus();
    invalidateProviderStatus();
    await fetchProviderStatus();

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });
});
