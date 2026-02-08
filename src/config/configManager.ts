/**
 * Configuration Manager for Multi-Provider LLM System
 * Handles storage and retrieval of API keys and user preferences
 */

import {
  AppConfig,
  ProviderConfig,
  TaskProviderMapping,
  UserPreferences,
  ProviderId,
  TaskType,
  DEFAULT_USER_PREFERENCES,
  CONFIG_VERSION,
  ElevenLabsVoice,
  OpenRouterModel
} from '../types/capabilities';

// ============================================================================
// CONSTANTS
// ============================================================================

const CONFIG_STORAGE_KEY = 'codebase_cartographer_config';
const CONFIG_FILE_PATH = './config.json'; // For Node.js environment

// ============================================================================
// ENCRYPTION UTILITIES
// Uses AES-GCM encryption with PBKDF2 key derivation
// ============================================================================

import {
  encryptData,
  decryptData,
  isEncryptedFormat,
  getPinFromSession,
  isValidPin,
  isPinSetUp
} from '../utils/cryptoUtils';

// ============================================================================
// LEGACY OBFUSCATION (for backward compatibility)
// ============================================================================

/**
 * Legacy obfuscation for backward compatibility
 * DEPRECATED: Used only for migrating old keys and testing
 */
export function obfuscateKeyLegacy(key: string): string {
  if (!key) return '';
  const prefixed = `OBF:${key}`;
  const rotated = prefixed.split('').map(c =>
    String.fromCharCode(c.charCodeAt(0) + 3)
  ).join('');
  return btoa(rotated);
}

/**
 * Legacy deobfuscation for backward compatibility
 * DEPRECATED: Used only for migrating old keys and testing
 */
export function deobfuscateKeyLegacy(obfuscatedKey: string): string {
  if (!obfuscatedKey) return '';
  try {
    const rotated = atob(obfuscatedKey);
    const unrotated = rotated.split('').map(c =>
      String.fromCharCode(c.charCodeAt(0) - 3)
    ).join('');
    if (unrotated.startsWith('OBF:')) {
      return unrotated.slice(4);
    }
    return unrotated;
  } catch {
    return obfuscatedKey;
  }
}

// ============================================================================
// ENCRYPTION WRAPPERS
// ============================================================================

/**
 * Get the current PIN from session
 * Returns null if PIN not set or not in session
 */
function getSessionPin(): string | null {
  return getPinFromSession();
}

/**
 * Encrypt an API key for storage
 * Uses AES-GCM encryption if PIN is available, falls back to legacy obfuscation
 *
 * @param key - API key to encrypt
 * @returns Encrypted or obfuscated string for storage
 */
export async function obfuscateKey(key: string): Promise<string> {
  if (!key) return '';

  const pin = getSessionPin();

  // If PIN is available, use proper encryption
  if (pin) {
    try {
      const result = await encryptData(key, pin);
      return result.storageString;
    } catch (error) {
      console.warn('Encryption failed, falling back to obfuscation:', error);
      // Fall through to legacy obfuscation
    }
  }

  // Fallback to legacy obfuscation
  return obfuscateKeyLegacy(key);
}

/**
 * Deobfuscate/Decrypt an API key from storage
 * Handles both new encrypted format and legacy obfuscated format
 *
 * @param obfuscatedKey - Encrypted or obfuscated key from storage
 * @returns Decrypted API key
 * @throws Error if decryption fails (wrong PIN)
 */
export async function deobfuscateKey(obfuscatedKey: string): Promise<string> {
  if (!obfuscatedKey) return '';

  const pin = getSessionPin();

  // Check if it's in the new encrypted format
  if (isEncryptedFormat(obfuscatedKey)) {
    if (!pin) {
      throw new Error('PIN required to decrypt API keys');
    }

    try {
      return await decryptData(obfuscatedKey, pin);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt API key. Incorrect PIN?');
    }
  }

  // Legacy obfuscated format
  return deobfuscateKeyLegacy(obfuscatedKey);
}

/**
 * Check if a key is encrypted (requires PIN to decrypt)
 */
export function isKeyEncrypted(obfuscatedKey: string): boolean {
  return isEncryptedFormat(obfuscatedKey);
}

/**
 * Migrate a legacy obfuscated key to encrypted format
 *
 * @param legacyKey - Legacy obfuscated key
 * @returns New encrypted key
 * @throws Error if PIN not available
 */
export async function migrateKeyToEncryption(legacyKey: string): Promise<string> {
  if (!legacyKey) return '';

  // Already encrypted
  if (isEncryptedFormat(legacyKey)) {
    return legacyKey;
  }

  const pin = getSessionPin();
  if (!pin) {
    throw new Error('PIN required to migrate keys to encrypted storage');
  }

  // Decrypt legacy key first
  const decryptedKey = deobfuscateKeyLegacy(legacyKey);

  // Encrypt with new method
  const result = await encryptData(decryptedKey, pin);
  return result.storageString;
}

// ============================================================================
// CONFIG MANAGER CLASS
// ============================================================================

export class ConfigManager {
  private config: AppConfig;
  private listeners: Set<(config: AppConfig) => void> = new Set();
  private isUnlocked: boolean = false;
  private decryptedKeysCache: Map<ProviderId, string> = new Map();

  constructor() {
    this.config = this.loadConfig();
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION & UNLOCK
  // --------------------------------------------------------------------------

  /**
   * Unlock the config manager by decrypting all API keys
   * Should be called after PIN is entered
   */
  async unlock(): Promise<void> {
    const pin = getSessionPin();
    if (!pin) {
      throw new Error('PIN required to unlock config');
    }

    // Decrypt all encrypted keys and cache them
    for (const provider of this.config.providers) {
      if (provider.apiKey && isEncryptedFormat(provider.apiKey)) {
        try {
          const decryptedKey = await decryptData(provider.apiKey, pin);
          this.decryptedKeysCache.set(provider.providerId, decryptedKey);
        } catch (error) {
          console.error(`Failed to decrypt key for ${provider.providerId}:`, error);
          throw error;
        }
      }
    }

    this.isUnlocked = true;
  }

  /**
   * Lock the config manager and clear decrypted keys from memory
   */
  lock(): void {
    this.decryptedKeysCache.clear();
    this.isUnlocked = false;
  }

  /**
   * Check if the config is unlocked
   */
  getIsUnlocked(): boolean {
    return this.isUnlocked;
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION & LOADING
  // --------------------------------------------------------------------------

  /**
   * Load configuration from storage
   */
  private loadConfig(): AppConfig {
    // Try localStorage first (browser environment)
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as AppConfig;
          // Validate version and migrate if needed
          if (parsed.version !== CONFIG_VERSION) {
            return this.migrateConfig(parsed);
          }
          return parsed;
        } catch (e) {
          console.warn('Failed to parse stored config, using defaults:', e);
        }
      }
    }

    // Try Vite environment variables (use legacy obfuscation for initial load)
    const envConfig = this.loadFromEnvVarsSync();
    if (envConfig) {
      return envConfig;
    }

    // Return default config
    return this.getDefaultConfig();
  }

  /**
   * Load configuration from Vite environment variables (synchronous)
   * Uses legacy obfuscation to avoid async issues in constructor
   */
  private loadFromEnvVarsSync(): AppConfig | null {
    // Check for env vars (Vite exposes them as import.meta.env)
    const envKeys: Partial<Record<ProviderId, string>> = {};

    // These would be set in .env.local
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const env = import.meta.env as Record<string, string>;

      if (env.VITE_OPENROUTER_API_KEY) envKeys.openrouter = env.VITE_OPENROUTER_API_KEY;
      if (env.VITE_OPENAI_API_KEY) envKeys.openai = env.VITE_OPENAI_API_KEY;
      if (env.VITE_ANTHROPIC_API_KEY) envKeys.anthropic = env.VITE_ANTHROPIC_API_KEY;
      if (env.VITE_GOOGLE_API_KEY || env.VITE_GEMINI_API_KEY) {
        envKeys.google = env.VITE_GOOGLE_API_KEY || env.VITE_GEMINI_API_KEY;
      }
      // Legacy support
      if (env.API_KEY && !envKeys.google) {
        envKeys.google = env.API_KEY;
      }
    }

    // If we found any keys, create a config
    if (Object.keys(envKeys).length > 0) {
      const config = this.getDefaultConfig();
      for (const [providerId, apiKey] of Object.entries(envKeys)) {
        if (apiKey) {
          const existingProvider = config.providers.find(p => p.providerId === providerId);
          // Use legacy obfuscation for sync loading
          const encryptedKey = obfuscateKeyLegacy(apiKey);
          if (existingProvider) {
            existingProvider.apiKey = encryptedKey;
            existingProvider.isEnabled = true;
          } else {
            config.providers.push({
              providerId: providerId as ProviderId,
              apiKey: encryptedKey,
              isEnabled: true
            });
          }
        }
      }
      return config;
    }

    return null;
  }

  /**
   * Re-encrypt API keys from env vars with proper encryption
   * Call this after PIN is set up
   */
  async reEncryptEnvKeys(): Promise<void> {
    const pin = getSessionPin();
    if (!pin) return;

    // Check if we have env vars that need re-encryption
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const env = import.meta.env as Record<string, string>;
      const envKeys: Partial<Record<ProviderId, string>> = {};

      if (env.VITE_OPENROUTER_API_KEY) envKeys.openrouter = env.VITE_OPENROUTER_API_KEY;
      if (env.VITE_OPENAI_API_KEY) envKeys.openai = env.VITE_OPENAI_API_KEY;
      if (env.VITE_ANTHROPIC_API_KEY) envKeys.anthropic = env.VITE_ANTHROPIC_API_KEY;
      if (env.VITE_GOOGLE_API_KEY || env.VITE_GEMINI_API_KEY) {
        envKeys.google = env.VITE_GOOGLE_API_KEY || env.VITE_GEMINI_API_KEY;
      }

      // Re-encrypt any keys that match env vars
      for (const [providerId, apiKey] of Object.entries(envKeys)) {
        const provider = this.config.providers.find(p => p.providerId === providerId);
        if (provider && apiKey === deobfuscateKeyLegacy(provider.apiKey)) {
          // This key came from env vars, re-encrypt it
          provider.apiKey = await obfuscateKey(apiKey);
        }
      }

      this.saveConfig();
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AppConfig {
    return {
      version: CONFIG_VERSION,
      providers: [],
      taskMappings: [],
      preferences: { ...DEFAULT_USER_PREFERENCES },
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Migrate config from older versions
   */
  private migrateConfig(oldConfig: AppConfig): AppConfig {
    // For now, just update version and return
    // Add migration logic as needed when schema changes
    console.log('Migrating config from version', oldConfig.version, 'to', CONFIG_VERSION);
    return {
      ...this.getDefaultConfig(),
      ...oldConfig,
      version: CONFIG_VERSION,
      lastUpdated: new Date().toISOString()
    };
  }

  // --------------------------------------------------------------------------
  // PERSISTENCE
  // --------------------------------------------------------------------------

  /**
   * Save configuration to storage
   */
  private saveConfig(): void {
    this.config.lastUpdated = new Date().toISOString();
    
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(this.config));
  }

  /**
   * Export configuration as JSON string (for backup/transfer)
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON string
   */
  importConfig(jsonString: string): boolean {
    try {
      const imported = JSON.parse(jsonString) as AppConfig;
      // Validate structure
      if (!imported.version || !Array.isArray(imported.providers)) {
        throw new Error('Invalid config format');
      }
      this.config = imported.version !== CONFIG_VERSION 
        ? this.migrateConfig(imported) 
        : imported;
      this.saveConfig();
      return true;
    } catch (e) {
      console.error('Failed to import config:', e);
      return false;
    }
  }

  /**
   * Subscribe to config changes
   */
  subscribe(listener: (config: AppConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --------------------------------------------------------------------------
  // PROVIDER MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Get all configured providers
   */
  getProviders(): ProviderConfig[] {
    return this.config.providers;
  }

  /**
   * Get a specific provider's configuration
   */
  getProvider(providerId: ProviderId): ProviderConfig | undefined {
    return this.config.providers.find(p => p.providerId === providerId);
  }

  /**
   * Get decrypted API key for a provider
   * Returns the cached decrypted key if unlocked, otherwise throws
   * @returns Decrypted API key, or undefined if not found
   * @throws Error if config is locked and key is encrypted
   */
  getApiKey(providerId: ProviderId): string | undefined {
    const provider = this.getProvider(providerId);
    if (!provider?.apiKey) return undefined;

    // If key is encrypted, check cache first
    if (isEncryptedFormat(provider.apiKey)) {
      if (!this.isUnlocked) {
        throw new Error('Config is locked. Please unlock by entering your PIN.');
      }
      return this.decryptedKeysCache.get(providerId);
    }

    // Legacy obfuscated key - decrypt synchronously
    return deobfuscateKeyLegacy(provider.apiKey);
  }

  /**
   * Set or update a provider's API key
   * Encrypts the key before storing if PIN is available
   */
  async setProviderKey(providerId: ProviderId, apiKey: string, isEnabled = true): Promise<void> {
    const existingIndex = this.config.providers.findIndex(p => p.providerId === providerId);
    const encryptedKey = await obfuscateKey(apiKey);
    const providerConfig: ProviderConfig = {
      providerId,
      apiKey: encryptedKey,
      isEnabled,
      validatedAt: undefined,
      isValid: undefined
    };

    if (existingIndex >= 0) {
      this.config.providers[existingIndex] = providerConfig;
    } else {
      this.config.providers.push(providerConfig);
    }

    // Update cache if unlocked
    if (this.isUnlocked) {
      this.decryptedKeysCache.set(providerId, apiKey);
    }

    this.saveConfig();
  }

  /**
   * Update provider validation status
   */
  setProviderValidation(providerId: ProviderId, isValid: boolean): void {
    const provider = this.config.providers.find(p => p.providerId === providerId);
    if (provider) {
      provider.isValid = isValid;
      provider.validatedAt = new Date().toISOString();
      this.saveConfig();
    }
  }

  /**
   * Enable or disable a provider
   */
  setProviderEnabled(providerId: ProviderId, isEnabled: boolean): void {
    const provider = this.config.providers.find(p => p.providerId === providerId);
    if (provider) {
      provider.isEnabled = isEnabled;
      this.saveConfig();
    }
  }

  /**
   * Remove a provider configuration
   */
  removeProvider(providerId: ProviderId): void {
    this.config.providers = this.config.providers.filter(p => p.providerId !== providerId);
    // Also remove any task mappings for this provider
    this.config.taskMappings = this.config.taskMappings.filter(
      m => m.primaryProviderId !== providerId && m.fallbackProviderId !== providerId
    );
    this.saveConfig();
  }

  /**
   * Get all enabled providers with valid API keys
   */
  getEnabledProviders(): ProviderConfig[] {
    return this.config.providers.filter(p => p.isEnabled && p.apiKey);
  }

  // --------------------------------------------------------------------------
  // TASK MAPPING MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Get task-to-provider mappings
   */
  getTaskMappings(): TaskProviderMapping[] {
    return this.config.taskMappings;
  }

  /**
   * Get mapping for a specific task
   */
  getTaskMapping(taskType: TaskType): TaskProviderMapping | undefined {
    return this.config.taskMappings.find(m => m.taskType === taskType);
  }

  /**
   * Set or update a task mapping
   */
  setTaskMapping(mapping: TaskProviderMapping): void {
    const existingIndex = this.config.taskMappings.findIndex(m => m.taskType === mapping.taskType);
    if (existingIndex >= 0) {
      this.config.taskMappings[existingIndex] = mapping;
    } else {
      this.config.taskMappings.push(mapping);
    }
    this.saveConfig();
  }

  /**
   * Remove a task mapping
   */
  removeTaskMapping(taskType: TaskType): void {
    this.config.taskMappings = this.config.taskMappings.filter(m => m.taskType !== taskType);
    this.saveConfig();
  }

  // --------------------------------------------------------------------------
  // PREFERENCES MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Get user preferences
   */
  getPreferences(): UserPreferences {
    return this.config.preferences;
  }

  /**
   * Update user preferences
   */
  setPreferences(preferences: Partial<UserPreferences>): void {
    this.config.preferences = {
      ...this.config.preferences,
      ...preferences
    };
    this.saveConfig();
  }

  // --------------------------------------------------------------------------
  // UTILITY METHODS
  // --------------------------------------------------------------------------

  /**
   * Clear all configuration
   */
  clearConfig(): void {
    this.config = this.getDefaultConfig();
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    }
    this.listeners.forEach(listener => listener(this.config));
  }

  /**
   * Check if any providers are configured
   */
  hasAnyProvider(): boolean {
    return this.config.providers.some(p => p.isEnabled && p.apiKey);
  }

  /**
   * Get the full config (for debugging/export)
   */
  getFullConfig(): AppConfig {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // ENCRYPTION HELPERS
  // --------------------------------------------------------------------------

  /**
   * Check if any providers have legacy (non-encrypted) keys
   */
  hasLegacyKeys(): boolean {
    return this.config.providers.some(p => p.apiKey && !isEncryptedFormat(p.apiKey));
  }

  /**
   * Get count of legacy keys
   */
  getLegacyKeyCount(): number {
    return this.config.providers.filter(p => p.apiKey && !isEncryptedFormat(p.apiKey)).length;
  }

  /**
   * Check if any providers have encrypted keys
   */
  hasEncryptedKeys(): boolean {
    return this.config.providers.some(p => p.apiKey && isEncryptedFormat(p.apiKey));
  }

  /**
   * Migrate all legacy keys to encrypted format
   * @returns Number of keys migrated
   */
  async migrateAllKeys(): Promise<number> {
    const pin = getSessionPin();
    if (!pin) {
      throw new Error('PIN required to migrate keys to encrypted storage');
    }

    let migratedCount = 0;

    for (const provider of this.config.providers) {
      if (provider.apiKey && !isEncryptedFormat(provider.apiKey)) {
        try {
          provider.apiKey = await migrateKeyToEncryption(provider.apiKey);
          migratedCount++;
        } catch (error) {
          console.error(`Failed to migrate key for ${provider.providerId}:`, error);
          // Continue with other keys
        }
      }
    }

    if (migratedCount > 0) {
      this.saveConfig();
    }

    return migratedCount;
  }

  // --------------------------------------------------------------------------
  // RESOURCE CACHING METHODS
  // --------------------------------------------------------------------------

  /**
   * Cache fetched voices for a provider (ElevenLabs)
   */
  setCachedVoices(providerId: 'elevenlabs', voices: ElevenLabsVoice[]): void {
    const config = this.getFullConfig();
    const provider = config.providers.find(p => p.providerId === providerId);
    if (provider) {
      provider.cachedVoices = voices;
      this.saveConfig();
    }
  }

  /**
   * Get cached voices for a provider
   */
  getCachedVoices(providerId: 'elevenlabs'): ElevenLabsVoice[] {
    const config = this.getFullConfig();
    const provider = config.providers.find(p => p.providerId === providerId);
    return provider?.cachedVoices || [];
  }

  /**
   * Cache fetched models for a provider (OpenRouter)
   */
  setCachedModels(providerId: 'openrouter', models: OpenRouterModel[]): void {
    const config = this.getFullConfig();
    const provider = config.providers.find(p => p.providerId === providerId);
    if (provider) {
      provider.cachedModels = models;
      this.saveConfig();
    }
  }

  /**
   * Get cached models for a provider
   */
  getCachedModels(providerId: 'openrouter'): OpenRouterModel[] {
    const config = this.getFullConfig();
    const provider = config.providers.find(p => p.providerId === providerId);
    return provider?.cachedModels || [];
  }

  /**
   * Set selected voice for ElevenLabs
   */
  setSelectedVoice(providerId: 'elevenlabs', voiceId: string): void {
    const config = this.getFullConfig();
    const provider = config.providers.find(p => p.providerId === providerId);
    if (provider) {
      provider.selectedVoiceId = voiceId;
      this.saveConfig();
    }
  }

  /**
   * Set selected model for OpenRouter
   */
  setSelectedModel(providerId: 'openrouter', modelId: string): void {
    const config = this.getFullConfig();
    const provider = config.providers.find(p => p.providerId === providerId);
    if (provider) {
      provider.selectedModelId = modelId;
      this.saveConfig();
    }
  }

  /**
   * Get selected resource (voice or model) for a provider
   */
  getSelectedResource(providerId: ProviderId): string | undefined {
    const config = this.getFullConfig();
    const provider = config.providers.find(p => p.providerId === providerId);
    return provider?.selectedVoiceId || provider?.selectedModelId;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let configManagerInstance: ConfigManager | null = null;

/**
 * Get the singleton ConfigManager instance
 */
export function getConfigManager(): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }
  return configManagerInstance;
}

export default getConfigManager;
