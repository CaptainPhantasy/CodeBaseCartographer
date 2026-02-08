/**
 * OpenRouter Adapter
 * Unified API supporting multiple providers (Claude, GPT, Gemini, etc.)
 * Supports: Text, Structured Output, Vision
 */

import { TaskType } from '../../types/capabilities';
import {
  BaseLLMAdapter,
  TextGenerationOptions,
  TextGenerationResult,
  StructuredOutputOptions,
  parseAPIError
} from './base';

// Default model mappings
const MODELS = {
  FAST: 'openai/gpt-4o-mini',
  BALANCED: 'anthropic/claude-3.5-haiku-20241022',
  SMART: 'anthropic/claude-sonnet-4-20250514',
  THINKING: 'anthropic/claude-sonnet-4-20250514'
};

const API_BASE = 'https://openrouter.ai/api/v1';

export class OpenRouterAdapter extends BaseLLMAdapter {
  readonly providerId = 'openrouter' as const;
  readonly name = 'OpenRouter';
  
  private customModel?: string;

  constructor(apiKey: string, customModel?: string) {
    super(apiKey);
    this.customModel = customModel;
  }

  supportsCapability(capability: string): boolean {
    // OpenRouter proxies to multiple providers, so most text capabilities are supported
    const supported = ['text', 'code', 'structured_output', 'vision', 'thinking'];
    return supported.includes(capability);
  }

  getModelForTask(taskType: TaskType): string | null {
    if (this.customModel) return this.customModel;
    
    switch (taskType) {
      case TaskType.TEXT_GENERATION:
      case TaskType.CODE_ANALYSIS:
        return MODELS.FAST;
      case TaskType.GRAPH_GENERATION:
        return MODELS.FAST;
      case TaskType.IMAGE_ANALYSIS:
        return MODELS.BALANCED;
      case TaskType.TTS:
      case TaskType.VIDEO:
      case TaskType.REALTIME_VOICE:
        return null; // Not supported via OpenRouter
      default:
        return MODELS.FAST;
    }
  }

  /**
   * Set a specific model to use for all requests
   */
  setModel(modelId: string): void {
    this.customModel = modelId;
  }

  async generateText(
    prompt: string,
    options: TextGenerationOptions = {}
  ): Promise<TextGenerationResult> {
    const modelId = this.customModel || (options.useThinking ? MODELS.THINKING : MODELS.FAST);
    
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

    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window?.location?.origin || 'https://codebase-cartographer.app',
        'X-Title': 'Codebase Cartographer'
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens
      })
    });

    if (!response.ok) {
      const body = await response.json();
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
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: object,
    options: StructuredOutputOptions = {}
  ): Promise<T> {
    const modelId = this.customModel || MODELS.FAST;
    
    const messages: any[] = [
      {
        role: 'system',
        content: `You must respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\nRespond ONLY with valid JSON, no explanations.`
      },
      { role: 'user', content: prompt }
    ];

    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window?.location?.origin || 'https://codebase-cartographer.app',
        'X-Title': 'Codebase Cartographer'
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const body = await response.json();
      throw parseAPIError(this.providerId, response.status, body);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '{}';
    return JSON.parse(text);
  }
}

export default OpenRouterAdapter;
