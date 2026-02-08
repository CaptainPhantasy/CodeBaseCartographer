/**
 * Unified LLM Service Layer
 * Routes requests to appropriate provider adapters based on task mappings
 * Handles fallback logic and graceful degradation
 */

import { getConfigManager } from '../config/configManager';
import { PROVIDERS } from '../config/providers';
import {
  createAdapter,
  BaseLLMAdapter,
  TextGenerationOptions,
  TextGenerationResult,
  StructuredOutputOptions,
  TTSOptions,
  TTSResult,
  VideoGenerationOptions,
  VideoResult,
  RealtimeConfig,
  RealtimeConnection,
  AdapterError,
  UnsupportedCapabilityError
} from './adapters';
import { TaskType, ProviderId, Capability, TASK_REQUIRED_CAPABILITIES } from '../types/capabilities';
import type { GraphData } from '../types';

// Re-export TaskType for convenience
export { TaskType } from '../types/capabilities';

// Extended result type with metadata
export interface ChatResult extends TextGenerationResult {
  metadata?: {
    groundingUrls?: string[];
    thinking?: string;
    provider?: string;
    model?: string;
  };
}

// ============================================================================
// SERVICE CONFIGURATION
// ============================================================================

interface ServiceConfig {
  enableFallback: boolean;
  maxRetries: number;
  retryDelay: number;
}

const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
  enableFallback: true,
  maxRetries: 2,
  retryDelay: 1000
};

// ============================================================================
// LLM SERVICE CLASS
// ============================================================================

export class LLMService {
  private config: ServiceConfig;
  private adapterCache: Map<string, BaseLLMAdapter> = new Map();

  constructor(config: Partial<ServiceConfig> = {}) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // ADAPTER MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Get or create an adapter for a provider
   */
  private getAdapter(providerId: ProviderId | 'elevenlabs', modelId?: string): BaseLLMAdapter {
    const configManager = getConfigManager();
    const apiKey = configManager.getApiKey(providerId as ProviderId);

    if (!apiKey) {
      throw new AdapterError(
        `No API key configured for ${providerId}`,
        'NO_API_KEY',
        providerId as ProviderId,
        false
      );
    }

    const cacheKey = `${providerId}:${modelId || 'default'}`;

    if (!this.adapterCache.has(cacheKey)) {
      const adapter = createAdapter(providerId, apiKey, modelId);
      this.adapterCache.set(cacheKey, adapter);
    }

    return this.adapterCache.get(cacheKey)!;
  }

  /**
   * Clear adapter cache (call when API keys change)
   */
  clearCache(): void {
    this.adapterCache.clear();
  }

  // --------------------------------------------------------------------------
  // PROVIDER RESOLUTION
  // --------------------------------------------------------------------------

  /**
   * Get the best provider for a task based on user configuration
   * For OpenRouter, uses the user's selectedModelId if available
   */
  private getProviderForTask(taskType: TaskType): { providerId: ProviderId; modelId: string } | null {
    const configManager = getConfigManager();
    const mapping = configManager.getTaskMapping(taskType);

    if (mapping) {
      // Check if primary provider has API key
      const apiKey = configManager.getApiKey(mapping.primaryProviderId);
      if (apiKey) {
        // For OpenRouter, check if user has a selected model
        if (mapping.primaryProviderId === 'openrouter') {
          const selectedModelId = configManager.getSelectedResource('openrouter');
          if (selectedModelId) {
            return {
              providerId: mapping.primaryProviderId,
              modelId: selectedModelId
            };
          }
        }
        return {
          providerId: mapping.primaryProviderId,
          modelId: mapping.primaryModelId
        };
      }
    }

    // Auto-select from enabled providers
    const requiredCapabilities = TASK_REQUIRED_CAPABILITIES[taskType];
    const enabledProviders = configManager.getEnabledProviders();

    for (const providerConfig of enabledProviders) {
      const providerDef = PROVIDERS[providerConfig.providerId];
      if (!providerDef) continue;

      // For OpenRouter, use selected model if available
      if (providerConfig.providerId === 'openrouter') {
        const selectedModelId = configManager.getSelectedResource('openrouter');
        if (selectedModelId) {
          return {
            providerId: providerConfig.providerId,
            modelId: selectedModelId
          };
        }
      }

      // Find a model that supports all required capabilities
      for (const model of providerDef.models) {
        const hasAllCapabilities = requiredCapabilities.every(
          cap => model.capabilities.includes(cap as Capability)
        );
        if (hasAllCapabilities) {
          return {
            providerId: providerConfig.providerId,
            modelId: model.id
          };
        }
      }
    }

    return null;
  }

  /**
   * Get fallback provider for a task
   * For OpenRouter, uses the user's selectedModelId if available
   */
  private getFallbackProviderForTask(taskType: TaskType, excludeProvider: ProviderId): { providerId: ProviderId; modelId: string } | null {
    const configManager = getConfigManager();
    const mapping = configManager.getTaskMapping(taskType);

    // Check explicit fallback first
    if (mapping?.fallbackProviderId && mapping.fallbackProviderId !== excludeProvider) {
      const apiKey = configManager.getApiKey(mapping.fallbackProviderId);
      if (apiKey && mapping.fallbackModelId) {
        // For OpenRouter fallback, check if user has a selected model
        if (mapping.fallbackProviderId === 'openrouter') {
          const selectedModelId = configManager.getSelectedResource('openrouter');
          if (selectedModelId) {
            return {
              providerId: mapping.fallbackProviderId,
              modelId: selectedModelId
            };
          }
        }
        return {
          providerId: mapping.fallbackProviderId,
          modelId: mapping.fallbackModelId
        };
      }
    }

    // Auto-find fallback
    const requiredCapabilities = TASK_REQUIRED_CAPABILITIES[taskType];
    const enabledProviders = configManager.getEnabledProviders()
      .filter(p => p.providerId !== excludeProvider);

    for (const providerConfig of enabledProviders) {
      const providerDef = PROVIDERS[providerConfig.providerId];
      if (!providerDef) continue;

      // For OpenRouter fallback, use selected model if available
      if (providerConfig.providerId === 'openrouter') {
        const selectedModelId = configManager.getSelectedResource('openrouter');
        if (selectedModelId) {
          return {
            providerId: providerConfig.providerId,
            modelId: selectedModelId
          };
        }
      }

      for (const model of providerDef.models) {
        const hasAllCapabilities = requiredCapabilities.every(
          cap => model.capabilities.includes(cap as Capability)
        );
        if (hasAllCapabilities) {
          return {
            providerId: providerConfig.providerId,
            modelId: model.id
          };
        }
      }
    }

    return null;
  }

  /**
   * Check if a task is available with current configuration
   */
  isTaskAvailable(taskType: TaskType): boolean {
    return this.getProviderForTask(taskType) !== null;
  }

  // --------------------------------------------------------------------------
  // TEXT GENERATION
  // --------------------------------------------------------------------------

  /**
   * Generate text response
   */
  async generateText(
    prompt: string,
    options: TextGenerationOptions = {}
  ): Promise<TextGenerationResult> {
    const provider = this.getProviderForTask(TaskType.TEXT_GENERATION);
    
    if (!provider) {
      throw new AdapterError(
        'No provider configured for text generation. Please configure at least one provider.',
        'NO_PROVIDER',
        'openai' as ProviderId,
        false
      );
    }

    try {
      const adapter = this.getAdapter(provider.providerId, provider.modelId);
      return await adapter.generateText(prompt, options);
    } catch (error) {
      if (this.config.enableFallback && error instanceof AdapterError && error.isRetryable) {
        const fallback = this.getFallbackProviderForTask(TaskType.TEXT_GENERATION, provider.providerId);
        if (fallback) {
          console.log(`[LLMService] Falling back from ${provider.providerId} to ${fallback.providerId}`);
          const fallbackAdapter = this.getAdapter(fallback.providerId, fallback.modelId);
          return await fallbackAdapter.generateText(prompt, options);
        }
      }
      throw error;
    }
  }

  /**
   * Chat options interface
   */
  async chat(
    history: Array<{ role: string; text: string }>,
    options: {
      systemPrompt?: string;
      useThinking?: boolean;
      useSearchGrounding?: boolean;
      imagePart?: string;
      mimeType?: string;
    } = {}
  ): Promise<ChatResult> {
    const lastMessage = history[history.length - 1];
    const provider = this.getProviderForTask(TaskType.TEXT_GENERATION);
    
    const result = await this.generateText(lastMessage?.text || '', { 
      ...options, 
      history,
      useSearch: options.useSearchGrounding
    });

    return {
      ...result,
      metadata: {
        groundingUrls: result.groundingUrls,
        thinking: result.thinkingContent,
        provider: provider?.providerId,
        model: provider?.modelId
      }
    };
  }

  // --------------------------------------------------------------------------
  // STRUCTURED OUTPUT
  // --------------------------------------------------------------------------

  /**
   * Generate structured JSON output
   */
  async generateStructuredOutput<T>(
    prompt: string,
    schema: object,
    options: StructuredOutputOptions = {}
  ): Promise<T> {
    const provider = this.getProviderForTask(TaskType.GRAPH_GENERATION);
    
    if (!provider) {
      throw new AdapterError(
        'No provider configured for structured output. Please configure a provider with structured_output capability.',
        'NO_PROVIDER',
        'openai' as ProviderId,
        false
      );
    }

    try {
      const adapter = this.getAdapter(provider.providerId, provider.modelId);
      return await adapter.generateStructuredOutput<T>(prompt, schema, options);
    } catch (error) {
      if (this.config.enableFallback && error instanceof AdapterError && error.isRetryable) {
        const fallback = this.getFallbackProviderForTask(TaskType.GRAPH_GENERATION, provider.providerId);
        if (fallback) {
          console.log(`[LLMService] Falling back from ${provider.providerId} to ${fallback.providerId}`);
          const fallbackAdapter = this.getAdapter(fallback.providerId, fallback.modelId);
          return await fallbackAdapter.generateStructuredOutput<T>(prompt, schema, options);
        }
      }
      throw error;
    }
  }

  /**
   * Generate graph data for visualization
   */
  async generateGraphData(description: string): Promise<GraphData> {
    const schema = {
      type: 'object',
      required: ['nodes', 'links'],
      properties: {
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'label', 'type'],
            properties: {
              id: { type: 'string' },
              group: { type: 'integer' },
              label: { type: 'string' },
              type: {
                type: 'string',
                enum: ['entry', 'logic', 'storage', 'exit', 'external', 'decision', 'process']
              }
            }
          }
        },
        links: {
          type: 'array',
          items: {
            type: 'object',
            required: ['source', 'target'],
            properties: {
              source: { type: 'string' },
              target: { type: 'string' },
              value: { type: 'integer' },
              label: { type: 'string' }
            }
          }
        }
      }
    };

    const prompt = `Generate a JSON object representing a node-link graph for a system described as: "${description}".

CRITICAL REQUIREMENTS:
1. You MUST include BOTH "nodes" AND "links" arrays in your response
2. Each link's "source" and "target" MUST reference an existing node's "id" value
3. Create edges that show data flow, control flow, or dependencies between components
4. Include at least 1 link for every 2 nodes (show connections!)

The JSON must adhere to this schema:
{
  "nodes": [{"id": "string", "group": number, "label": "string", "type": "entry|logic|storage|exit|external|decision|process"}],
  "links": [{"source": "string", "target": "string", "value": number, "label": "string (optional)"}]
}

EXAMPLE of a valid response:
{
  "nodes": [
    {"id": "user", "group": 1, "label": "User", "type": "entry"},
    {"id": "api", "group": 2, "label": "API Gateway", "type": "logic"},
    {"id": "db", "group": 3, "label": "Database", "type": "storage"}
  ],
  "links": [
    {"source": "user", "target": "api", "value": 1, "label": "HTTP"},
    {"source": "api", "target": "db", "value": 1, "label": "query"}
  ]
}

Return ONLY valid JSON.`;

    return this.generateStructuredOutput<GraphData>(prompt, schema);
  }

  // --------------------------------------------------------------------------
  // TEXT TO SPEECH
  // --------------------------------------------------------------------------

  /**
   * Get the best TTS provider based on configuration
   * For ElevenLabs, uses the user's selectedVoiceId if available
   */
  private getTTSProvider(): { providerId: ProviderId | 'elevenlabs'; modelId: string } | null {
    const configManager = getConfigManager();
    const mapping = configManager.getTaskMapping(TaskType.TTS);

    if (mapping) {
      const apiKey = configManager.getApiKey(mapping.primaryProviderId);
      if (apiKey) {
        // For ElevenLabs, use selected voice if available
        if (mapping.primaryProviderId === 'elevenlabs') {
          const selectedVoiceId = configManager.getSelectedResource('elevenlabs');
          if (selectedVoiceId) {
            return {
              providerId: mapping.primaryProviderId,
              modelId: selectedVoiceId
            };
          }
        }
        return {
          providerId: mapping.primaryProviderId,
          modelId: mapping.primaryModelId
        };
      }
    }

    // Auto-select TTS provider (prefer Google, then OpenAI)
    const ttsProviderOrder: (ProviderId | 'elevenlabs')[] = ['google', 'openai', 'elevenlabs'];

    for (const providerId of ttsProviderOrder) {
      const apiKey = configManager.getApiKey(providerId as ProviderId);
      if (apiKey) {
        const providerDef = PROVIDERS[providerId as ProviderId];
        if (providerDef) {
          // For ElevenLabs auto-selection, use selected voice if available
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
    }

    return null;
  }

  /**
   * Generate speech from text
   */
  async generateSpeech(
    text: string,
    options: TTSOptions = {}
  ): Promise<TTSResult> {
    const provider = this.getTTSProvider();
    
    if (!provider) {
      throw new UnsupportedCapabilityError('openai' as ProviderId, 'tts');
    }

    const adapter = this.getAdapter(provider.providerId, provider.modelId);
    return adapter.generateSpeech(text, options);
  }

  /**
   * Get available TTS voices
   */
  getAvailableTTSVoices(): string[] {
    const provider = this.getTTSProvider();
    if (!provider) return [];
    
    try {
      const adapter = this.getAdapter(provider.providerId, provider.modelId);
      return adapter.getAvailableVoices();
    } catch {
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // VIDEO GENERATION
  // --------------------------------------------------------------------------

  /**
   * Generate video from prompt or image
   */
  async generateVideo(
    prompt: string,
    options: VideoGenerationOptions = {}
  ): Promise<VideoResult> {
    const provider = this.getProviderForTask(TaskType.VIDEO);
    
    if (!provider) {
      throw new UnsupportedCapabilityError('openai' as ProviderId, 'video');
    }

    const adapter = this.getAdapter(provider.providerId, provider.modelId);
    return adapter.generateVideo(prompt, options);
  }

  // --------------------------------------------------------------------------
  // REALTIME AUDIO
  // --------------------------------------------------------------------------

  /**
   * Connect to real-time audio API
   */
  async connectRealtime(config: RealtimeConfig): Promise<RealtimeConnection> {
    const provider = this.getProviderForTask(TaskType.REALTIME_VOICE);
    
    if (!provider) {
      throw new UnsupportedCapabilityError('openai' as ProviderId, 'realtime_audio');
    }

    const adapter = this.getAdapter(provider.providerId, provider.modelId);
    return adapter.connectRealtime(config);
  }

  // --------------------------------------------------------------------------
  // FEATURE AVAILABILITY
  // --------------------------------------------------------------------------

  /**
   * Check availability of all features
   */
  getFeatureAvailability(): {
    isTextAvailable: boolean;
    isTTSAvailable: boolean;
    isVideoAvailable: boolean;
    isRealtimeAvailable: boolean;
    isGraphAvailable: boolean;
    isVisionAvailable: boolean;
  } {
    return {
      isTextAvailable: this.isTaskAvailable(TaskType.TEXT_GENERATION),
      isTTSAvailable: this.getTTSProvider() !== null,
      isVideoAvailable: this.isTaskAvailable(TaskType.VIDEO),
      isRealtimeAvailable: this.isTaskAvailable(TaskType.REALTIME_VOICE),
      isGraphAvailable: this.isTaskAvailable(TaskType.GRAPH_GENERATION),
      isVisionAvailable: this.isTaskAvailable(TaskType.IMAGE_ANALYSIS)
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let llmServiceInstance: LLMService | null = null;

/**
 * Get the singleton LLMService instance
 */
export function getLLMService(): LLMService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
}

/**
 * Reset the LLM service (useful for testing or config changes)
 */
export function resetLLMService(): void {
  if (llmServiceInstance) {
    llmServiceInstance.clearCache();
  }
  llmServiceInstance = null;
}

export default getLLMService;
