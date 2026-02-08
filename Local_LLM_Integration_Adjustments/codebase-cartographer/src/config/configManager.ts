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
  CONFIG_VERSION
} from '../types/capabilities';

// ============================================================================
// CONSTANTS
// ============================================================================

const CONFIG_STORAGE_KEY = 'codebase_cartographer_config';
const CONFIG_FILE_PATH = './config.json'; // For Node.js environment

// ============================================================================
// OBFUSCATION UTILITIES
// Note: This is basic obfuscation, NOT encryption.
// For production, use proper encryption (e.g., Web Crypto API)
// ============================================================================

/**
 * Obfuscate an API key for storage
 * Uses base64 + simple character rotation
 * WARNING: This is NOT secure encryption - just obfuscation to prevent casual viewing
 */
export function obfuscateKey(key: string): string {
  if (!key) return '';
  // Add a prefix to identify obfuscated keys
  const prefixed = `OBF:${key}`;
  // Simple rotation + base64
  const rotated = prefixed.split('').map(c => 
    String.fromCharCode(c.charCodeAt(0) + 3)
  ).join('');
  return btoa(rotated);
}

/**
 * Deobfuscate an API key from storage
 */
export function deobfuscateKey(obfuscatedKey: string): string {
  if (!obfuscatedKey) return '';
  try {
    const rotated = atob(obfuscatedKey);
    const unrotated = rotated.split('').map(c => 
      String.fromCharCode(c.charCodeAt(0) - 3)
    ).join('');
    // Check and remove prefix
    if (unrotated.startsWith('OBF:')) {
      return unrotated.slice(4);
    }
    return unrotated;
  } catch {
    // If deobfuscation fails, return as-is (might be plain key)
    return obfuscatedKey;
  }
}

// TODO: Production encryption using Web Crypto API
// async function encryptKey(key: string, password: string): Promise<string> {
//   const encoder = new TextEncoder();
//   const data = encoder.encode(key);
//   const keyMaterial = await crypto.subtle.importKey(
//     'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']
//   );
//   // ... implement AES-GCM encryption
// }

// ============================================================================
// CONFIG MANAGER CLASS
// ============================================================================

export class ConfigManager {
  private config: AppConfig;
  private listeners: Set<(config: AppConfig) => void> = new Set();

  constructor() {
    this.config = this.loadConfig();
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

    // Try Vite environment variables
    const envConfig = this.loadFromEnvVars();
    if (envConfig) {
      return envConfig;
    }

    // Return default config
    return this.getDefaultConfig();
  }

  /**
   * Load configuration from Vite environment variables
   */
  private loadFromEnvVars(): AppConfig | null {
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
          if (existingProvider) {
            existingProvider.apiKey = obfuscateKey(apiKey);
            existingProvider.isEnabled = true;
          } else {
            config.providers.push({
              providerId: providerId as ProviderId,
              apiKey: obfuscateKey(apiKey),
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
   */
  getApiKey(providerId: ProviderId): string | undefined {
    const provider = this.getProvider(providerId);
    if (!provider?.apiKey) return undefined;
    return deobfuscateKey(provider.apiKey);
  }

  /**
   * Set or update a provider's API key
   */
  setProviderKey(providerId: ProviderId, apiKey: string, isEnabled = true): void {
    const existingIndex = this.config.providers.findIndex(p => p.providerId === providerId);
    const providerConfig: ProviderConfig = {
      providerId,
      apiKey: obfuscateKey(apiKey),
      isEnabled,
      validatedAt: undefined,
      isValid: undefined
    };

    if (existingIndex >= 0) {
      this.config.providers[existingIndex] = providerConfig;
    } else {
      this.config.providers.push(providerConfig);
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
