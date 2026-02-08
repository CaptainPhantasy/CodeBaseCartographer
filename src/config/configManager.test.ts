import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigManager, obfuscateKey, deobfuscateKey } from './configManager';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
};

// Mock import.meta.env
const mockEnv = {
  VITE_OPENROUTER_API_KEY: 'env-openrouter-key',
  VITE_OPENAI_API_KEY: 'env-openai-key'
};

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage = localStorageMock as any;

    // Create a mock for import.meta
    const importMetaMock = {
      env: mockEnv
    };

    // Store the original global
    const originalGlobal = global;

    // Mock global to have import.meta
    (global as any).import = { meta: importMetaMock };

    // Create fresh instance for each test
    configManager = new ConfigManager();

    // Restore original global
    Object.assign(global, originalGlobal);
  });

  describe('obfuscateKey / deobfuscateKey', () => {
    it('should obfuscate and deobfuscate key correctly', () => {
      const originalKey = 'test-api-key-123';
      const obfuscated = obfuscateKey(originalKey);
      const deobfuscated = deobfuscateKey(obfuscated);

      expect(obfuscated).not.toBe(originalKey);
      expect(obfuscated).toContain('OBF:');
      expect(deobfuscated).toBe(originalKey);
    });

    it('should handle empty string', () => {
      expect(obfuscateKey('')).toBe('');
      expect(deobfuscateKey('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(obfuscateKey(null as any)).toBe('');
      expect(deobfuscateKey(null as any)).toBe('');
      expect(deobfuscateKey(undefined as any)).toBe('');
    });

    it('should handle invalid obfuscated key', () => {
      expect(deobfuscateKey('invalid-base64')).toBe('invalid-base64');
    });
  });

  describe('constructor', () => {
    it('should initialize with default config when no storage', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const config = new ConfigManager();
      const providers = config.getProviders();

      expect(providers).toEqual([]);
      expect(config.getPreferences()).toEqual({
        defaultModel: 'gemini-3-flash-preview',
        temperature: 0.7,
        maxTokens: undefined,
        autoSave: true,
        theme: 'light'
      });
    });

    it('should load from localStorage when available', () => {
      const storedConfig = JSON.stringify({
        version: '1.0.0',
        providers: [
          {
            providerId: 'openai',
            apiKey: obfuscateKey('test-key'),
            isEnabled: true,
            validatedAt: '2024-01-01T00:00:00.000Z',
            isValid: true
          }
        ],
        taskMappings: [],
        preferences: {
          defaultModel: 'gpt-4o-mini',
          temperature: 0.5,
          maxTokens: 1000,
          autoSave: true,
          theme: 'dark'
        },
        lastUpdated: '2024-01-01T00:00:00.000Z'
      });

      localStorageMock.getItem.mockReturnValue(storedConfig);

      const config = new ConfigManager();
      const providers = config.getProviders();

      expect(providers).toHaveLength(1);
      expect(providers[0].providerId).toBe('openai');
      expect(providers[0].apiKey).toBe(obfuscateKey('test-key'));
      expect(providers[0].isValid).toBe(true);
    });

    it('should load from environment variables when available', () => {
      localStorageMock.getItem.mockReturnValue(null);

      // Mock import.meta.env
      vi.stubGlobal('import', { meta: { env: mockEnv } });

      const config = new ConfigManager();
      const providers = config.getProviders();

      // Should have providers from env vars
      expect(providers).toHaveLength(2);
      expect(providers.some((p: any) => p.providerId === 'openrouter')).toBe(true);
      expect(providers.some((p: any) => p.providerId === 'openai')).toBe(true);

      // Check API keys are obfuscated
      const openrouterProvider = providers.find((p: any) => p.providerId === 'openrouter');
      expect(openrouterProvider.apiKey).toBe(obfuscateKey('env-openrouter-key'));
    });
  });

  describe('provider management', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue(null);
    });

    it('should set and get provider key', () => {
      configManager.setProviderKey('openai', 'test-api-key');

      const provider = configManager.getProvider('openai');
      expect(provider?.apiKey).toBe(obfuscateKey('test-api-key'));
      expect(provider?.isEnabled).toBe(true);

      const apiKey = configManager.getApiKey('openai');
      expect(apiKey).toBe('test-api-key');
    });

    it('should update existing provider', () => {
      configManager.setProviderKey('openai', 'first-key');
      configManager.setProviderKey('openai', 'second-key');

      const provider = configManager.getProvider('openai');
      expect(provider?.apiKey).toBe(obfuscateKey('second-key'));
    });

    it('should enable/disable provider', () => {
      configManager.setProviderKey('openai', 'test-api-key');
      configManager.setProviderEnabled('openai', false);

      const provider = configManager.getProvider('openai');
      expect(provider?.isEnabled).toBe(false);

      configManager.setProviderEnabled('openai', true);
      const updatedProvider = configManager.getProvider('openai');
      expect(updatedProvider?.isEnabled).toBe(true);
    });

    it('should remove provider', () => {
      configManager.setProviderKey('openai', 'test-api-key');
      configManager.setProviderKey('google', 'google-key');

      expect(configManager.getProviders()).toHaveLength(2);

      configManager.removeProvider('openai');

      expect(configManager.getProviders()).toHaveLength(1);
      expect(configManager.getProvider('openai')).toBeUndefined();
      expect(configManager.getProvider('google')).toBeDefined();
    });

    it('should get enabled providers', () => {
      configManager.setProviderKey('openai', 'test-api-key', false);
      configManager.setProviderKey('google', 'google-key', true);

      const enabled = configManager.getEnabledProviders();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].providerId).toBe('google');
    });
  });

  describe('task mappings', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue(null);
    });

    it('should set and get task mapping', () => {
      const mapping = {
        taskType: 'text_generation',
        primaryProviderId: 'openai',
        fallbackProviderId: 'anthropic'
      };

      configManager.setTaskMapping(mapping);

      const retrieved = configManager.getTaskMapping('text_generation');
      expect(retrieved).toEqual(mapping);
    });

    it('should update existing task mapping', () => {
      const mapping1 = {
        taskType: 'text_generation',
        primaryProviderId: 'openai',
        fallbackProviderId: 'anthropic'
      };

      const mapping2 = {
        taskType: 'text_generation',
        primaryProviderId: 'google',
        fallbackProviderId: 'openai'
      };

      configManager.setTaskMapping(mapping1);
      configManager.setTaskMapping(mapping2);

      const retrieved = configManager.getTaskMapping('text_generation');
      expect(retrieved).toEqual(mapping2);
    });

    it('should remove task mapping', () => {
      configManager.setTaskMapping({
        taskType: 'text_generation',
        primaryProviderId: 'openai',
        fallbackProviderId: 'anthropic'
      });

      expect(configManager.getTaskMappings()).toHaveLength(1);

      configManager.removeTaskMapping('text_generation');

      expect(configManager.getTaskMappings()).toHaveLength(0);
    });
  });

  describe('preferences', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue(null);
    });

    it('should get default preferences', () => {
      const prefs = configManager.getPreferences();
      expect(prefs.defaultModel).toBe('gemini-3-flash-preview');
      expect(prefs.temperature).toBe(0.7);
      expect(prefs.autoSave).toBe(true);
    });

    it('should update preferences', () => {
      configManager.setPreferences({
        temperature: 0.5,
        theme: 'dark'
      });

      const prefs = configManager.getPreferences();
      expect(prefs.temperature).toBe(0.5);
      expect(prefs.theme).toBe('dark');
      expect(prefs.defaultModel).toBe('gemini-3-flash-preview'); // Should be unchanged
    });

    it('should merge preferences', () => {
      configManager.setPreferences({ temperature: 0.5 });
      configManager.setPreferences({ theme: 'dark' });

      const prefs = configManager.getPreferences();
      expect(prefs.temperature).toBe(0.5);
      expect(prefs.theme).toBe('dark');
    });
  });

  describe('persistence', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue(null);
    });

    it('should save to localStorage when setting provider', () => {
      configManager.setProviderKey('openai', 'test-api-key');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'codebase_cartographer_config',
        expect.stringContaining('"providers"')
      );
    });

    it('should export config as JSON', () => {
      configManager.setProviderKey('openai', 'test-api-key');
      const exported = configManager.exportConfig();

      expect(exported).toBeInstanceOf(String);
      expect(JSON.parse(exported)).toHaveProperty('providers');
    });

    it('should import config from JSON', () => {
      const configJson = JSON.stringify({
        version: '1.0.0',
        providers: [
          {
            providerId: 'openai',
            apiKey: obfuscateKey('imported-key'),
            isEnabled: true
          }
        ],
        taskMappings: [],
        preferences: { temperature: 0.8 },
        lastUpdated: '2024-01-01T00:00:00.000Z'
      });

      const success = configManager.importConfig(configJson);
      expect(success).toBe(true);

      const provider = configManager.getProvider('openai');
      expect(provider?.apiKey).toBe(obfuscateKey('imported-key'));
    });

    it('should fail to import invalid config', () => {
      const invalidJson = 'invalid json';
      const success = configManager.importConfig(invalidJson);
      expect(success).toBe(false);
    });

    it('should clear all configuration', () => {
      configManager.setProviderKey('openai', 'test-api-key');
      configManager.setPreferences({ temperature: 0.5 });

      expect(configManager.getProviders()).toHaveLength(1);

      configManager.clearConfig();

      expect(configManager.getProviders()).toHaveLength(0);
      expect(configManager.getPreferences().temperature).toBe(0.7); // default
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('codebase_cartographer_config');
    });
  });

  describe('subscription', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue(null);
    });

    it('should notify listeners on config changes', () => {
      const listener = vi.fn();
      const unsubscribe = configManager.subscribe(listener);

      configManager.setProviderKey('openai', 'test-api-key');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        providers: expect.arrayContaining([
          expect.objectContaining({ providerId: 'openai' })
        ])
      }));

      unsubscribe();
    });

    it('should not notify after unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = configManager.subscribe(listener);

      unsubscribe();
      configManager.setProviderKey('google', 'test-key');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue(null);
    });

    it('should check if any provider is configured', () => {
      expect(configManager.hasAnyProvider()).toBe(false);

      configManager.setProviderKey('openai', 'test-api-key');

      expect(configManager.hasAnyProvider()).toBe(true);
    });

    it('should get full config', () => {
      configManager.setProviderKey('openai', 'test-api-key');

      const fullConfig = configManager.getFullConfig();

      expect(fullConfig).toHaveProperty('providers');
      expect(fullConfig).toHaveProperty('taskMappings');
      expect(fullConfig).toHaveProperty('preferences');
      expect(fullConfig).toHaveProperty('version');
      expect(fullConfig).toHaveProperty('lastUpdated');
    });
  });

  describe('validation status', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue(null);
    });

    it('should set provider validation status', () => {
      configManager.setProviderKey('openai', 'test-api-key');
      configManager.setProviderValidation('openai', true);

      const provider = configManager.getProvider('openai');
      expect(provider?.isValid).toBe(true);
      expect(provider?.validatedAt).toBeDefined();
    });
  });
});