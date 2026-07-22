/**
 * useConfig Hook - React hook for config state management
 * Provides config state throughout the app with reactive updates
 */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { 
  getConfigManager, 
  ConfigManager 
} from '../config/configManager';
import {
  AppConfig,
  ProviderConfig,
  TaskProviderMapping,
  UserPreferences,
  ProviderId,
  TaskType,
  ElevenLabsVoice,
  OpenRouterModel
} from '../types/capabilities';
import { fetchProviderStatus } from '../services/llm/providerStatus';

// ============================================================================
// TYPES
// ============================================================================

interface ConfigContextValue {
  config: AppConfig;
  isFirstRun: boolean;
  isLoading: boolean;

  // Provider management
  getApiKey: (providerId: ProviderId) => string | undefined;
  setProviderKey: (providerId: ProviderId, apiKey: string, isEnabled?: boolean) => Promise<void>;
  removeProvider: (providerId: ProviderId) => void;
  setProviderValidation: (providerId: ProviderId, isValid: boolean) => void;
  getEnabledProviders: () => ProviderConfig[];

  // Encryption helpers
  hasLegacyKeys: () => boolean;
  hasEncryptedKeys: () => boolean;
  migrateAllKeys: () => Promise<number>;

  // Task mapping management
  getTaskMapping: (taskType: TaskType) => TaskProviderMapping | undefined;
  setTaskMapping: (mapping: TaskProviderMapping) => void;

  // Preferences
  setPreferences: (preferences: Partial<UserPreferences>) => void;

  // Resource caching and selection
  setCachedVoices: (providerId: 'elevenlabs', voices: ElevenLabsVoice[]) => void;
  getCachedVoices: (providerId: 'elevenlabs') => ElevenLabsVoice[];
  setCachedModels: (providerId: 'openrouter', models: OpenRouterModel[]) => void;
  getCachedModels: (providerId: 'openrouter') => OpenRouterModel[];
  setSelectedVoice: (providerId: 'elevenlabs', voiceId: string) => void;
  setSelectedModel: (providerId: 'openrouter', modelId: string) => void;
  getSelectedResource: (providerId: ProviderId) => string | undefined;

  // Config operations
  setConfig: (config: AppConfig) => void;
  exportConfig: () => string;
  importConfig: (jsonString: string) => boolean;
  clearConfig: () => void;
  markSetupComplete: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ConfigContext = createContext<ConfigContextValue | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface ConfigProviderProps {
  children: ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [configManager] = useState<ConfigManager>(() => getConfigManager());
  const [config, setConfig] = useState<AppConfig>(() => configManager.getFullConfig());
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to config changes
  useEffect(() => {
    const unsubscribe = configManager.subscribe((newConfig) => {
      setConfig({ ...newConfig });
    });
    return unsubscribe;
  }, [configManager]);

  // Hydrate non-secret provider enablement from the authenticated backend.
  // This lets a fresh browser profile use server-configured providers without
  // ever copying their keys into localStorage.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const status = await fetchProviderStatus();
        for (const [providerId, available] of Object.entries(status)) {
          if (available && !configManager.getProvider(providerId as ProviderId)) {
            await configManager.setProviderKey(providerId as ProviderId, '', true);
          }
        }
        if (!cancelled) setConfig({ ...configManager.getFullConfig() });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [configManager]);

  // Do not flash the setup wizard while server provider status is loading.
  const isFirstRun = !isLoading && !configManager.hasAnyProvider();

  // Memoized callbacks
  const getApiKey = useCallback((providerId: ProviderId) => {
    return configManager.getApiKey(providerId);
  }, [configManager]);

  const setProviderKey = useCallback(async (providerId: ProviderId, apiKey: string, isEnabled = true) => {
    await configManager.setProviderKey(providerId, apiKey, isEnabled);
  }, [configManager]);

  const removeProvider = useCallback((providerId: ProviderId) => {
    configManager.removeProvider(providerId);
  }, [configManager]);

  const setProviderValidation = useCallback((providerId: ProviderId, isValid: boolean) => {
    configManager.setProviderValidation(providerId, isValid);
  }, [configManager]);

  const getEnabledProviders = useCallback(() => {
    return configManager.getEnabledProviders();
  }, [configManager]);

  const hasLegacyKeys = useCallback(() => {
    return configManager.hasLegacyKeys();
  }, [configManager]);

  const hasEncryptedKeys = useCallback(() => {
    return configManager.hasEncryptedKeys();
  }, [configManager]);

  const migrateAllKeys = useCallback(async () => {
    return configManager.migrateAllKeys();
  }, [configManager]);

  const getTaskMapping = useCallback((taskType: TaskType) => {
    return configManager.getTaskMapping(taskType);
  }, [configManager]);

  const setTaskMapping = useCallback((mapping: TaskProviderMapping) => {
    configManager.setTaskMapping(mapping);
  }, [configManager]);

  const setPreferences = useCallback((preferences: Partial<UserPreferences>) => {
    configManager.setPreferences(preferences);
  }, [configManager]);

  const setCachedVoices = useCallback((providerId: 'elevenlabs', voices: ElevenLabsVoice[]) => {
    configManager.setCachedVoices(providerId, voices);
  }, [configManager]);

  const getCachedVoices = useCallback((providerId: 'elevenlabs') => {
    return configManager.getCachedVoices(providerId);
  }, [configManager]);

  const setCachedModels = useCallback((providerId: 'openrouter', models: OpenRouterModel[]) => {
    configManager.setCachedModels(providerId, models);
  }, [configManager]);

  const getCachedModels = useCallback((providerId: 'openrouter') => {
    return configManager.getCachedModels(providerId);
  }, [configManager]);

  const setSelectedVoice = useCallback((providerId: 'elevenlabs', voiceId: string) => {
    configManager.setSelectedVoice(providerId, voiceId);
  }, [configManager]);

  const setSelectedModel = useCallback((providerId: 'openrouter', modelId: string) => {
    configManager.setSelectedModel(providerId, modelId);
  }, [configManager]);

  const getSelectedResource = useCallback((providerId: ProviderId) => {
    return configManager.getSelectedResource(providerId);
  }, [configManager]);

  const exportConfigFn = useCallback(() => {
    return configManager.exportConfig();
  }, [configManager]);

  const importConfigFn = useCallback((jsonString: string) => {
    return configManager.importConfig(jsonString);
  }, [configManager]);

  const clearConfig = useCallback(() => {
    configManager.clearConfig();
  }, [configManager]);

  const markSetupComplete = useCallback(() => {
    // If no providers configured, we can't mark as complete
    // This is handled by the wizard itself
    setConfig({ ...configManager.getFullConfig() });
  }, [configManager]);

  const value: ConfigContextValue = {
    config,
    isFirstRun,
    isLoading,
    getApiKey,
    setProviderKey,
    removeProvider,
    setProviderValidation,
    getEnabledProviders,
    hasLegacyKeys,
    hasEncryptedKeys,
    migrateAllKeys,
    getTaskMapping,
    setTaskMapping,
    setPreferences,
    setCachedVoices,
    getCachedVoices,
    setCachedModels,
    getCachedModels,
    setSelectedVoice,
    setSelectedModel,
    getSelectedResource,
    exportConfig: exportConfigFn,
    importConfig: importConfigFn,
    clearConfig,
    markSetupComplete,
    setConfig // Add setConfig to context for triggering re-renders
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}

// ============================================================================
// STANDALONE HOOK (without context, for simpler use cases)
// ============================================================================

export function useConfigStandalone() {
  const [configManager] = useState<ConfigManager>(() => getConfigManager());
  const [config, setConfig] = useState<AppConfig>(() => configManager.getFullConfig());

  useEffect(() => {
    const unsubscribe = configManager.subscribe((newConfig) => {
      setConfig({ ...newConfig });
    });
    return unsubscribe;
  }, [configManager]);

  return {
    config,
    configManager,
    isFirstRun: !configManager.hasAnyProvider()
  };
}

export default useConfig;
