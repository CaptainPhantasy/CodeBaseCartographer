/**
 * Local LLM Adapter
 * Supports: Text, Code, Structured Output
 * Compatible with: Ollama, LM Studio, and other OpenAI-compatible local servers
 */

import { TaskType } from '../../types/capabilities';
import {
  BaseLLMAdapter,
  TextGenerationOptions,
  TextGenerationResult,
  StructuredOutputOptions,
  AdapterError,
  parseAPIError
} from './base';

// Default model IDs for local servers
const DEFAULT_MODELS = {
  TEXT: 'llama3.3',           // Default for general text
  CODE: 'deepseek-coder-v2',  // Default for code tasks
  STRUCTURED: 'qwen2.5-coder'  // Default for structured output
} as const;

// Default endpoints for popular local LLM servers
const DEFAULT_ENDPOINTS = {
  OLLAMA: 'http://localhost:11434/v1',
  LM_STUDIO: 'http://localhost:1234/v1',
  TEXT_GENERATION_WEBUI: 'http://localhost:5000/v1'
} as const;

interface LocalLLMConfig {
  endpoint?: string;
  defaultModel?: string;
}

export class LocalLLMAdapter extends BaseLLMAdapter {
  readonly providerId = 'local_llm' as const;
  readonly name = 'Local LLM';

  private readonly endpoint: string;
  private readonly defaultModel: string;

  constructor(apiKey: string, private config?: LocalLLMConfig) {
    super(apiKey);
    // For local LLM, apiKey is used as the endpoint URL or default model
    // If config is provided, use those values
    this.endpoint = config?.endpoint || apiKey || DEFAULT_ENDPOINTS.OLLAMA;
    this.defaultModel = config?.defaultModel || DEFAULT_MODELS.TEXT;
  }

  supportsCapability(capability: string): boolean {
    // Local LLMs typically support text, code, and sometimes structured output
    // Vision, TTS, STT, video, and realtime are not supported by most local servers
    const supported = ['text', 'code', 'structured_output', 'thinking'];
    return supported.includes(capability);
  }

  getModelForTask(taskType: TaskType): string | null {
    // For local LLM, the user configures which model to use
    // We return the default model since models are managed locally
    switch (taskType) {
      case TaskType.TEXT_GENERATION:
      case TaskType.IMAGE_ANALYSIS:
        return this.defaultModel;
      case TaskType.GRAPH_GENERATION:
      case TaskType.CODE_ANALYSIS:
      case TaskType.TASK_GENERATION:
        return this.defaultModel;
      case TaskType.TTS:
      case TaskType.VIDEO:
      case TaskType.REALTIME_VOICE:
        return null; // Not supported
      default:
        return this.defaultModel;
    }
  }

  async generateText(
    prompt: string,
    options: TextGenerationOptions = {}
  ): Promise<TextGenerationResult> {
    const modelId = options.useThinking ? this.defaultModel : this.defaultModel;

    // Build messages array
    const messages: any[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    // Add history
    if (options.history) {
      for (const msg of options.history.slice(0, -1)) {
        messages.push({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.text
        });
      }
    }

    // Add current message
    if (options.imagePart && options.mimeType) {
      // Some local servers support vision, but we'll try
      messages.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${options.mimeType};base64,${options.imagePart}` } },
          { type: 'text', text: prompt }
        ]
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    try {
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // Note: Local LLMs typically don't require auth headers
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens || 4096,
          stream: false
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw parseAPIError(this.providerId, response.status, body);
      }

      const data = await response.json();
      return {
        text: data.choices[0]?.message?.content || '',
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0
        }
      };
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      throw new AdapterError(
        `Local LLM request failed: ${error instanceof Error ? error.message : String(error)}`,
        'REQUEST_FAILED',
        this.providerId,
        true
      );
    }
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: object,
    options: StructuredOutputOptions = {}
  ): Promise<T> {
    const messages: any[] = [
      {
        role: 'system',
        content: `You must respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\nRespond ONLY with valid JSON, no explanations.`
      },
      { role: 'user', content: prompt }
    ];

    try {
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens || 4096,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw parseAPIError(this.providerId, response.status, body);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content || content.trim() === '') {
        throw new AdapterError('Empty response from local LLM', 'EMPTY_RESPONSE', this.providerId, false);
      }

      try {
        const parsed = JSON.parse(content);
        // Validate that required fields exist for graph data
        if (parsed && typeof parsed === 'object') {
          if ('nodes' in parsed && (!parsed.nodes || !Array.isArray(parsed.nodes))) {
            throw new AdapterError('Response missing valid nodes array', 'INVALID_RESPONSE', this.providerId, false);
          }
          if ('links' in parsed && (!parsed.links || !Array.isArray(parsed.links))) {
            throw new AdapterError('Response missing valid links array', 'INVALID_RESPONSE', this.providerId, false);
          }
        }
        return parsed as T;
      } catch (e) {
        if (e instanceof AdapterError) throw e;
        throw new AdapterError(`Failed to parse local LLM response: ${e}`, 'PARSE_ERROR', this.providerId, false);
      }
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      throw new AdapterError(
        `Local LLM structured output failed: ${error instanceof Error ? error.message : String(error)}`,
        'REQUEST_FAILED',
        this.providerId,
        true
      );
    }
  }

  /**
   * Fetch available models from the local LLM server
   * Works with Ollama and other OpenAI-compatible servers
   */
  async fetchAvailableModels(): Promise<string[]> {
    try {
      // Try OpenAI-compatible /v1/models endpoint first
      const response = await fetch(`${this.endpoint}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // If that fails, try Ollama's native API
        return await this.fetchOllamaModels();
      }

      const data = await response.json();
      return data.data?.map((model: any) => model.id) || [];
    } catch {
      // Fallback to Ollama API
      return await this.fetchOllamaModels();
    }
  }

  /**
   * Fetch models from Ollama's native API
   */
  private async fetchOllamaModels(): Promise<string[]> {
    try {
      const ollamaEndpoint = this.endpoint.replace('/v1', '');
      const response = await fetch(`${ollamaEndpoint}/api/tags`, {
        method: 'GET'
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch {
      return [];
    }
  }

  /**
   * Check if the local LLM server is accessible
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export default LocalLLMAdapter;
