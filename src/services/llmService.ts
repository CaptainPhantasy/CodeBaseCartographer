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
  STTOptions,
  STTResult,
  VideoGenerationOptions,
  VideoResult,
  RealtimeConfig,
  RealtimeConnection,
  AdapterError,
  RateLimitError,
  UnsupportedCapabilityError
} from './adapters';
import { TaskType, ProviderId, Capability, TASK_REQUIRED_CAPABILITIES } from '../types/capabilities';
import type { GraphData } from '../types';
import {
  ApiKeyMissingError,
  ProviderError,
  UnsupportedCapabilityError as AppUnsupportedCapabilityError,
  handleError,
  withErrorHandling,
  ErrorCategory
} from '../utils/errorHandler';
import { getRateLimiter, type RateLimitInfo } from './rateLimiter';

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
  private rateLimiter = getRateLimiter();
  private rateLimitListeners: Set<(info: RateLimitInfo) => void> = new Set();

  constructor(config: Partial<ServiceConfig> = {}) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
    this.setupRateLimitListener();
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
      // Use centralized error handler
      const error = new ApiKeyMissingError(providerId);
      handleError(error, { providerId, modelId });
      throw error;
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
  // RATE LIMITING
  // --------------------------------------------------------------------------

  /**
   * Set up rate limit event listener
   */
  private setupRateLimitListener(): void {
    this.rateLimiter.onRateLimit((info: RateLimitInfo) => {
      // Notify all registered listeners
      this.rateLimitListeners.forEach(listener => listener(info));

      // Log to console
      console.warn(
        `[LLMService] Rate limit hit for ${info.providerId}. ` +
        `Retry after: ${info.retryAfter}s. Reason: ${info.reason || 'Unknown'}`
      );
    });
  }

  /**
   * Subscribe to rate limit events
   * Returns unsubscribe function
   */
  onRateLimit(callback: (info: RateLimitInfo) => void): () => void {
    this.rateLimitListeners.add(callback);
    return () => this.rateLimitListeners.delete(callback);
  }

  /**
   * Get rate limit status for all providers
   */
  getRateLimitStatus() {
    return this.rateLimiter.getAllStatus();
  }

  /**
   * Set custom rate limit for a provider
   */
  setRateLimit(providerId: ProviderId, config: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
    requestsPerHour?: number;
  }): void {
    this.rateLimiter.setRateLimit(providerId, config);
  }

  /**
   * Reset rate limit state for a provider
   */
  resetRateLimit(providerId: ProviderId): void {
    this.rateLimiter.resetProvider(providerId);
  }

  /**
   * Execute an adapter method with rate limiting
   */
  private async executeWithRateLimit<T>(
    providerId: ProviderId,
    requestFn: () => Promise<T>,
    estimatedTokens: number = 1000
  ): Promise<T> {
    return this.rateLimiter.executeRequest(providerId, requestFn, {
      priority: 5,
      estimatedTokens,
    });
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
      const error = new ProviderError(
        'system',
        'No provider configured for text generation. Please configure at least one provider.',
        { taskType: TaskType.TEXT_GENERATION }
      );
      handleError(error, { operation: 'generateText', prompt: prompt.substring(0, 50) + '...' });
      throw error;
    }

    const executeRequest = async (): Promise<TextGenerationResult> => {
      const adapter = this.getAdapter(provider.providerId, provider.modelId);
      return await adapter.generateText(prompt, options);
    };

    try {
      // Estimate tokens: ~4 characters per token
      const estimatedTokens = Math.ceil((prompt.length + (options.maxTokens || 500)) / 4);
      return await this.executeWithRateLimit(provider.providerId, executeRequest, estimatedTokens);
    } catch (error) {
      // Handle with centralized error handler
      handleError(error, {
        operation: 'generateText',
        providerId: provider.providerId,
        modelId: provider.modelId
      });

      // Check if this is a rate limit error
      if (error instanceof RateLimitError) {
        this.rateLimiter.handleRateLimitResponse(provider.providerId, error.retryAfter);
      }

      if (this.config.enableFallback && error instanceof AdapterError && error.isRetryable) {
        const fallback = this.getFallbackProviderForTask(TaskType.TEXT_GENERATION, provider.providerId);
        if (fallback) {
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

    const executeRequest = async (): Promise<T> => {
      const adapter = this.getAdapter(provider.providerId, provider.modelId);
      return await adapter.generateStructuredOutput<T>(prompt, schema, options);
    };

    try {
      // Estimate tokens: structured outputs typically require more
      const estimatedTokens = Math.ceil((prompt.length + 2000) / 4);
      return await this.executeWithRateLimit(provider.providerId, executeRequest, estimatedTokens);
    } catch (error) {
      // Check if this is a rate limit error
      if (error instanceof RateLimitError) {
        this.rateLimiter.handleRateLimitResponse(provider.providerId, error.retryAfter);
      }

      if (this.config.enableFallback && error instanceof AdapterError && error.isRetryable) {
        const fallback = this.getFallbackProviderForTask(TaskType.GRAPH_GENERATION, provider.providerId);
        if (fallback) {
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
              },
              filePath: { type: 'string' },
              functionName: { type: 'string' },
              line: { type: 'integer' }
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
5. For nodes representing actual code components, INCLUDE the "filePath" property with the path to the source file
6. Include "functionName" when the node represents a specific function or method
7. Include "line" number when referencing a specific line in code

The JSON must adhere to this schema:
{
  "nodes": [
    {"id": "string", "group": number, "label": "string", "type": "entry|logic|storage|exit|external|decision|process", "filePath": "string (optional)", "functionName": "string (optional)", "line": number (optional)}
  ],
  "links": [{"source": "string", "target": "string", "value": number, "label": "string (optional)"}]
}

EXAMPLE of a valid response:
{
  "nodes": [
    {"id": "user", "group": 1, "label": "User", "type": "entry"},
    {"id": "api", "group": 2, "label": "API Gateway", "type": "logic", "filePath": "src/api/gateway.ts", "functionName": "handleRequest"},
    {"id": "db", "group": 3, "label": "Database", "type": "storage", "filePath": "src/db/connection.ts", "line": 45}
  ],
  "links": [
    {"source": "user", "target": "api", "value": 1, "label": "HTTP"},
    {"source": "api", "target": "db", "value": 1, "label": "query"}
  ]
}

Return ONLY valid JSON.`;

    return this.generateStructuredOutput<GraphData>(prompt, schema);
  }

  /**
   * Generate graph data with actual codebase context
   * This produces much more accurate graphs by analyzing real files
   */
  async generateGraphDataWithContext(
    description: string,
    context: {
      files?: Array<{ path: string; content: string }>;
      codebasePath?: string;
    },
    options: {
      maxAttempts?: number;
      validateOutput?: boolean;
    } = {}
  ): Promise<GraphData> {
    const { maxAttempts = 3, validateOutput = true } = options;

    // Import validators dynamically to avoid circular deps
    const { validateGraph, formatValidationFeedback } = await import('./graphValidator');
    const { buildGraphContext, formatContextForLLM } = await import('./graphContextExtractor');

    // Build context from files if provided
    let contextPrompt = '';
    if (context.files && context.files.length > 0) {
      const graphContext = buildGraphContext(context.files, context.codebasePath || '/');
      contextPrompt = formatContextForLLM(graphContext, 30);
    }

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
              },
              filePath: { type: 'string' },
              functionName: { type: 'string' },
              line: { type: 'integer' },
              // Extended properties for data transformation tracking
              inputType: { type: 'string', description: 'Type of data this node receives' },
              outputType: { type: 'string', description: 'Type of data this node produces' },
              transforms: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of transformations applied to data'
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
              label: { type: 'string' },
              // Extended properties for bidirectional flow
              flowType: {
                type: 'string',
                enum: ['request', 'response', 'bidirectional'],
                description: 'Direction of data flow'
              }
            }
          }
        }
      }
    };

    let attempt = 0;
    let lastFeedback: string | null = null;

    while (attempt < maxAttempts) {
      // Build prompt with context and feedback from previous attempts
      let prompt = '';

      if (contextPrompt) {
        prompt += contextPrompt + '\n\n';
      }

      prompt += `Generate a JSON object representing a node-link graph for a system described as: "${description}".

CRITICAL REQUIREMENTS:
1. You MUST include BOTH "nodes" AND "links" arrays in your response
2. Each link's "source" and "target" MUST reference an existing node's "id" value
3. Create edges that show data flow, control flow, or dependencies between components
4. Include at least 1 link for every 2 nodes (show connections!)
5. For nodes representing actual code components, INCLUDE the "filePath" property with the path to the source file
6. Include "functionName" when the node represents a specific function or method
7. Include "line" number when referencing a specific line in code
8. Set "group" based on architectural layer: 1=entry/user, 2=API/orchestration, 3=services/logic, 4=storage/external
9. Include "inputType" and "outputType" to show data transformation at each node
10. Include "transforms" array listing how data changes at this node
11. Set "flowType" on links: "request" for downstream (user→system), "response" for upstream (system→user)

${lastFeedback ? `\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${lastFeedback}\n\nPlease fix these issues.\n` : ''}

The JSON must adhere to this schema:
{
  "nodes": [
    {
      "id": "string",
      "group": number (1-4 based on layer),
      "label": "string",
      "type": "entry|logic|storage|exit|external|decision|process",
      "filePath": "string (optional)",
      "functionName": "string (optional)",
      "line": number (optional),
      "inputType": "string (optional)",
      "outputType": "string (optional)",
      "transforms": ["string"] (optional)
    }
  ],
  "links": [
    {
      "source": "string",
      "target": "string",
      "value": number,
      "label": "string (optional)",
      "flowType": "request|response|bidirectional" (optional)
    }
  ]
}

EXAMPLE of a valid response with data transformations:
{
  "nodes": [
    {"id": "user", "group": 1, "label": "User", "type": "entry", "inputType": "natural language", "outputType": "query object"},
    {"id": "api", "group": 2, "label": "API Gateway", "type": "logic", "filePath": "src/api/gateway.ts", "functionName": "handleRequest", "inputType": "HTTP request", "outputType": "validated request", "transforms": ["parse JSON", "validate schema", "add auth context"]},
    {"id": "service", "group": 3, "label": "User Service", "type": "logic", "filePath": "src/services/user.ts", "functionName": "getUser", "transforms": ["query database", "map to DTO"]},
    {"id": "db", "group": 4, "label": "Database", "type": "storage", "filePath": "src/db/connection.ts"}
  ],
  "links": [
    {"source": "user", "target": "api", "value": 1, "label": "HTTP POST", "flowType": "request"},
    {"source": "api", "target": "service", "value": 1, "flowType": "request"},
    {"source": "service", "target": "db", "value": 1, "label": "query", "flowType": "request"},
    {"source": "db", "target": "service", "value": 1, "label": "result", "flowType": "response"},
    {"source": "service", "target": "api", "value": 1, "flowType": "response"},
    {"source": "api", "target": "user", "value": 1, "label": "JSON", "flowType": "response"}
  ]
}

Return ONLY valid JSON.`;

      try {
        const graphData = await this.generateStructuredOutput<GraphData>(prompt, schema);

        // Validate the result
        if (validateOutput) {
          const validation = validateGraph(graphData, { autoRepair: true });

          if (validation.isValid && validation.repaired) {
            return validation.repaired;
          } else if (validation.repaired) {
            // Return repaired version even if there were warnings
            console.warn('Graph had validation issues but was auto-repaired:', validation.warnings);
            return validation.repaired;
          }

          // Not valid, prepare feedback for retry
          lastFeedback = formatValidationFeedback(validation);
          attempt++;
          console.warn(`Graph validation failed (attempt ${attempt}/${maxAttempts}):`, validation.errors);
        } else {
          return graphData;
        }
      } catch (error) {
        console.error(`Graph generation failed (attempt ${attempt + 1}/${maxAttempts}):`, error);
        attempt++;

        if (attempt >= maxAttempts) {
          throw error;
        }
      }
    }

    throw new Error(`Failed to generate valid graph after ${maxAttempts} attempts`);
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
   * Get the best STT provider based on configuration
   */
  private getSTTProvider(): { providerId: ProviderId | 'elevenlabs'; modelId: string } | null {
    const configManager = getConfigManager();
    const enabledProviders = configManager.getEnabledProviders();

    // Auto-select STT provider (prefer ElevenLabs, then OpenAI, then Google)
    const sttProviderOrder: (ProviderId | 'elevenlabs')[] = ['elevenlabs', 'openai', 'google'];

    for (const providerId of sttProviderOrder) {
      const apiKey = configManager.getApiKey(providerId as ProviderId);
      if (apiKey) {
        const providerDef = PROVIDERS[providerId as ProviderId];
        if (providerDef) {
          const sttModel = providerDef.models.find(m => m.capabilities.includes('stt' as Capability));
          if (sttModel) {
            return { providerId, modelId: sttModel.id };
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

    const executeRequest = async (): Promise<TTSResult> => {
      const adapter = this.getAdapter(provider.providerId, provider.modelId);
      return adapter.generateSpeech(text, options);
    };

    // TTS requests: estimate based on text length
    const estimatedTokens = Math.ceil(text.length / 4);
    return await this.executeWithRateLimit(provider.providerId, executeRequest, estimatedTokens);
  }

  /**
   * Transcribe audio to text
   */
  async transcribeAudio(
    audioData: ArrayBuffer | string,
    options: STTOptions = {}
  ): Promise<STTResult> {
    const provider = this.getSTTProvider();

    if (!provider) {
      throw new UnsupportedCapabilityError('openai' as ProviderId, 'stt');
    }

    const executeRequest = async (): Promise<STTResult> => {
      const adapter = this.getAdapter(provider.providerId, provider.modelId);
      return adapter.transcribeAudio(audioData, options);
    };

    // STT requests: estimate based on audio data size
    const estimatedTokens = Math.ceil((typeof audioData === 'string' ? audioData.length : audioData.byteLength) / 4);
    return await this.executeWithRateLimit(provider.providerId, executeRequest, estimatedTokens);
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

    const executeRequest = async (): Promise<VideoResult> => {
      const adapter = this.getAdapter(provider.providerId, provider.modelId);
      return adapter.generateVideo(prompt, options);
    };

    // Video generation: high token estimate
    const estimatedTokens = Math.ceil((prompt.length + 5000) / 4);
    return await this.executeWithRateLimit(provider.providerId, executeRequest, estimatedTokens);
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

    const executeRequest = async (): Promise<RealtimeConnection> => {
      const adapter = this.getAdapter(provider.providerId, provider.modelId);
      return adapter.connectRealtime(config);
    };

    // Realtime connections: moderate token estimate
    const estimatedTokens = 1000;
    return await this.executeWithRateLimit(provider.providerId, executeRequest, estimatedTokens);
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
    isSTTAvailable: boolean;
    isVideoAvailable: boolean;
    isRealtimeAvailable: boolean;
    isGraphAvailable: boolean;
    isVisionAvailable: boolean;
  } {
    return {
      isTextAvailable: this.isTaskAvailable(TaskType.TEXT_GENERATION),
      isTTSAvailable: this.getTTSProvider() !== null,
      isSTTAvailable: this.getSTTProvider() !== null,
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
