/**
 * Tests for task-to-provider routing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getProviderForTask,
  getFallbackProviderForTask,
  getTTSProvider,
  getSTTProvider,
} from './providerRouter';
import { TaskType } from '../../types/capabilities';
import type { ProviderStatus } from './providerStatus';

const { statusMock, configMock } = vi.hoisted(() => {
  const status: ProviderStatus = {
    google: false,
    openai: false,
    anthropic: false,
    openrouter: false,
    elevenlabs: false,
    local_llm: false,
  };
  return {
    statusMock: { current: status },
    configMock: {
      getTaskMapping: vi.fn(),
      getEnabledProviders: vi.fn(),
      getSelectedResource: vi.fn(),
    },
  };
});

vi.mock('./providerStatus', () => ({
  fetchProviderStatus: () => Promise.resolve(statusMock.current),
}));

vi.mock('../../config/configManager', () => ({
  getConfigManager: () => configMock,
}));

function setStatus(overrides: Partial<ProviderStatus>): void {
  statusMock.current = {
    google: false,
    openai: false,
    anthropic: false,
    openrouter: false,
    elevenlabs: false,
    local_llm: false,
    ...overrides,
  };
}

describe('providerRouter', () => {
  beforeEach(() => {
    setStatus({});
    configMock.getTaskMapping.mockReset().mockReturnValue(undefined);
    configMock.getEnabledProviders.mockReset().mockReturnValue([]);
    configMock.getSelectedResource.mockReset().mockReturnValue(null);
  });

  describe('getProviderForTask', () => {
    it('uses the mapped primary provider when its server key is available', async () => {
      setStatus({ anthropic: true });
      configMock.getTaskMapping.mockReturnValue({
        primaryProviderId: 'anthropic',
        primaryModelId: 'claude-test-model',
      });

      const resolved = await getProviderForTask(TaskType.TEXT_GENERATION);
      expect(resolved).toEqual({ providerId: 'anthropic', modelId: 'claude-test-model' });
    });

    it('skips the mapped primary when the server has no key and auto-selects a capable provider', async () => {
      setStatus({ openai: true });
      configMock.getTaskMapping.mockReturnValue({
        primaryProviderId: 'anthropic',
        primaryModelId: 'claude-test-model',
      });
      configMock.getEnabledProviders.mockReturnValue([
        { providerId: 'anthropic' },
        { providerId: 'openai' },
      ]);

      const resolved = await getProviderForTask(TaskType.TEXT_GENERATION);
      expect(resolved?.providerId).toBe('openai');
      expect(resolved?.modelId).toBeTruthy();
    });

    it('routes openrouter to the user-selected model', async () => {
      setStatus({ openrouter: true });
      configMock.getTaskMapping.mockReturnValue({
        primaryProviderId: 'openrouter',
        primaryModelId: 'ignored-default',
      });
      configMock.getSelectedResource.mockReturnValue('vendor/custom-model');

      const resolved = await getProviderForTask(TaskType.TEXT_GENERATION);
      expect(resolved).toEqual({ providerId: 'openrouter', modelId: 'vendor/custom-model' });
      expect(configMock.getSelectedResource).toHaveBeenCalledWith('openrouter');
    });

    it('returns null when no provider has a server-side key', async () => {
      configMock.getEnabledProviders.mockReturnValue([{ providerId: 'openai' }]);

      const resolved = await getProviderForTask(TaskType.TEXT_GENERATION);
      expect(resolved).toBeNull();
    });
  });

  describe('getFallbackProviderForTask', () => {
    it('uses the mapped fallback when available and not excluded', async () => {
      setStatus({ google: true });
      configMock.getTaskMapping.mockReturnValue({
        primaryProviderId: 'openai',
        primaryModelId: 'gpt-test',
        fallbackProviderId: 'google',
        fallbackModelId: 'gemini-test',
      });

      const resolved = await getFallbackProviderForTask(TaskType.TEXT_GENERATION, 'openai');
      expect(resolved).toEqual({ providerId: 'google', modelId: 'gemini-test' });
    });

    it('never returns the excluded provider', async () => {
      setStatus({ openai: true });
      configMock.getTaskMapping.mockReturnValue({
        primaryProviderId: 'openai',
        primaryModelId: 'gpt-test',
        fallbackProviderId: 'openai',
        fallbackModelId: 'gpt-test',
      });
      configMock.getEnabledProviders.mockReturnValue([{ providerId: 'openai' }]);

      const resolved = await getFallbackProviderForTask(TaskType.TEXT_GENERATION, 'openai');
      expect(resolved).toBeNull();
    });
  });

  describe('voice providers', () => {
    it('prefers the elevenlabs selected voice for TTS when mapped', async () => {
      setStatus({ elevenlabs: true });
      configMock.getTaskMapping.mockReturnValue({
        primaryProviderId: 'elevenlabs',
        primaryModelId: 'default-model',
      });
      configMock.getSelectedResource.mockReturnValue('voice-abc');

      const resolved = await getTTSProvider();
      expect(resolved).toEqual({ providerId: 'elevenlabs', modelId: 'voice-abc' });
    });

    it('returns null for STT when no provider key exists', async () => {
      const resolved = await getSTTProvider();
      expect(resolved).toBeNull();
    });

    it('picks an available STT provider with a capable model', async () => {
      setStatus({ openai: true });

      const resolved = await getSTTProvider();
      expect(resolved?.providerId).toBe('openai');
      expect(resolved?.modelId).toBeTruthy();
    });
  });
});
