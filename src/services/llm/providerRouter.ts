/**
 * providerRouter.ts - Task-to-provider resolution
 *
 * Decides which provider/model serves a task, combining:
 * - the user's task mapping (configManager)
 * - server-side key availability (providerStatus)
 * - model capability requirements (capabilities.ts)
 *
 * Pure routing logic: no HTTP calls besides the cached status fetch.
 */

import { getConfigManager } from '../../config/configManager';
import { PROVIDERS } from '../../config/providers';
import { TaskType, TASK_REQUIRED_CAPABILITIES } from '../../types/capabilities';
import type { ProviderId, Capability } from '../../types/capabilities';
import { fetchProviderStatus, type ProviderStatus } from './providerStatus';
import type { ProxyProviderId } from './proxyClient';

export interface ResolvedProvider {
  providerId: ProviderId;
  modelId: string;
}

export interface ResolvedVoiceProvider {
  providerId: ProxyProviderId;
  modelId: string;
}

function hasServerKey(status: ProviderStatus, providerId: string): boolean {
  return Boolean(status[providerId as keyof ProviderStatus]);
}

/** OpenRouter routes to the user-selected model; other providers use the mapped model. */
function resolveOpenRouterModel(providerId: string): string | null {
  if (providerId !== 'openrouter') return null;
  return getConfigManager().getSelectedResource('openrouter') ?? null;
}

/**
 * Find the first usable provider whose model covers the capabilities.
 * Explicitly enabled providers keep priority; server-configured providers are
 * also eligible so a fresh browser profile works without storing any secret or
 * duplicating server configuration in localStorage.
 */
async function findCapableProvider(
  taskType: TaskType,
  excludeProvider?: ProviderId
): Promise<ResolvedProvider | null> {
  const configManager = getConfigManager();
  const status = await fetchProviderStatus();
  const requiredCapabilities = TASK_REQUIRED_CAPABILITIES[taskType];
  const explicitlyEnabled = configManager.getEnabledProviders().map(p => p.providerId);
  const candidateIds = [
    ...explicitlyEnabled,
    ...(Object.keys(PROVIDERS) as ProviderId[]).filter(id => !explicitlyEnabled.includes(id)),
  ].filter((id, index, ids) => id !== excludeProvider && ids.indexOf(id) === index);

  for (const providerId of candidateIds) {
    if (!hasServerKey(status, providerId)) continue;
    const providerDef = PROVIDERS[providerId];
    if (!providerDef) continue;

    const openRouterModel = resolveOpenRouterModel(providerId);
    if (openRouterModel) {
      return { providerId, modelId: openRouterModel };
    }

    for (const model of providerDef.models) {
      const hasAllCapabilities = requiredCapabilities.every(
        cap => model.capabilities.includes(cap as Capability)
      );
      if (hasAllCapabilities) {
        return { providerId, modelId: model.id };
      }
    }
  }

  return null;
}

/**
 * Get the best provider for a task based on user configuration + server key status.
 */
export async function getProviderForTask(taskType: TaskType): Promise<ResolvedProvider | null> {
  const configManager = getConfigManager();
  const status = await fetchProviderStatus();
  const mapping = configManager.getTaskMapping(taskType);

  if (mapping && hasServerKey(status, mapping.primaryProviderId)) {
    const openRouterModel = resolveOpenRouterModel(mapping.primaryProviderId);
    if (openRouterModel) {
      return { providerId: mapping.primaryProviderId, modelId: openRouterModel };
    }
    return { providerId: mapping.primaryProviderId, modelId: mapping.primaryModelId };
  }

  // Auto-select from enabled providers that have server-side keys
  return findCapableProvider(taskType);
}

/**
 * Get fallback provider for a task, excluding the provider that just failed.
 */
export async function getFallbackProviderForTask(
  taskType: TaskType,
  excludeProvider: ProviderId
): Promise<ResolvedProvider | null> {
  const configManager = getConfigManager();
  const status = await fetchProviderStatus();
  const mapping = configManager.getTaskMapping(taskType);

  if (
    mapping?.fallbackProviderId &&
    mapping.fallbackProviderId !== excludeProvider &&
    hasServerKey(status, mapping.fallbackProviderId) &&
    mapping.fallbackModelId
  ) {
    const openRouterModel = resolveOpenRouterModel(mapping.fallbackProviderId);
    if (openRouterModel) {
      return { providerId: mapping.fallbackProviderId, modelId: openRouterModel };
    }
    return { providerId: mapping.fallbackProviderId, modelId: mapping.fallbackModelId };
  }

  return findCapableProvider(taskType, excludeProvider);
}

/**
 * Get the best TTS provider based on configuration.
 * ElevenLabs routes to the user-selected voice instead of a model id.
 */
export async function getTTSProvider(): Promise<ResolvedVoiceProvider | null> {
  const configManager = getConfigManager();
  const status = await fetchProviderStatus();
  const mapping = configManager.getTaskMapping(TaskType.TTS);

  if (mapping && hasServerKey(status, mapping.primaryProviderId)) {
    if (mapping.primaryProviderId === 'elevenlabs') {
      const selectedVoiceId = configManager.getSelectedResource('elevenlabs');
      if (selectedVoiceId) {
        return { providerId: mapping.primaryProviderId, modelId: selectedVoiceId };
      }
    }
    return { providerId: mapping.primaryProviderId, modelId: mapping.primaryModelId };
  }

  const ttsProviderOrder: ProxyProviderId[] = ['google', 'openai', 'elevenlabs'];

  for (const providerId of ttsProviderOrder) {
    if (!hasServerKey(status, providerId)) continue;
    const providerDef = PROVIDERS[providerId as ProviderId];
    if (providerDef) {
      if (providerId === 'elevenlabs') {
        const selectedVoiceId = configManager.getSelectedResource('elevenlabs');
        if (selectedVoiceId) {
          return { providerId, modelId: selectedVoiceId };
        }
      }
      const ttsModel = providerDef.models.find(m => m.capabilities.includes('tts' as Capability));
      if (ttsModel) {
        return { providerId, modelId: ttsModel.id };
      }
    }
  }

  return null;
}

/**
 * Get the best STT provider based on configuration.
 */
export async function getSTTProvider(): Promise<ResolvedVoiceProvider | null> {
  const status = await fetchProviderStatus();
  const sttProviderOrder: ProxyProviderId[] = ['elevenlabs', 'openai', 'google'];

  for (const providerId of sttProviderOrder) {
    if (!hasServerKey(status, providerId)) continue;
    const providerDef = PROVIDERS[providerId as ProviderId];
    if (providerDef) {
      const sttModel = providerDef.models.find(m => m.capabilities.includes('stt' as Capability));
      if (sttModel) {
        return { providerId, modelId: sttModel.id };
      }
    }
  }

  return null;
}
