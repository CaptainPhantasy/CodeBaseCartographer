/**
 * Anthropic Adapter
 * Supports: Text, Structured Output, Vision, Extended Thinking
 */

import { TaskType } from '../../types/capabilities';
import {
  BaseLLMAdapter,
  TextGenerationOptions,
  TextGenerationResult,
  StructuredOutputOptions,
  parseAPIError
} from './base';

// Model IDs
const MODELS = {
  SONNET: 'claude-sonnet-4-20250514',
  HAIKU: 'claude-3-5-haiku-20241022',
  OPUS: 'claude-3-opus-20240229'
};

const API_BASE = 'https://api.anthropic.com/v1';

export class AnthropicAdapter extends BaseLLMAdapter {
  readonly providerId = 'anthropic' as const;
  readonly name = 'Anthropic';

  constructor(apiKey: string) {
    super(apiKey);
  }

  supportsCapability(capability: string): boolean {
    const supported = ['text', 'code', 'structured_output', 'vision', 'thinking'];
    return supported.includes(capability);
  }

  getModelForTask(taskType: TaskType): string | null {
    switch (taskType) {
      case TaskType.TEXT_GENERATION:
      case TaskType.CODE_ANALYSIS:
        return MODELS.HAIKU;
      case TaskType.GRAPH_GENERATION:
        return MODELS.HAIKU;
      case TaskType.IMAGE_ANALYSIS:
        return MODELS.SONNET;
      case TaskType.TTS:
      case TaskType.VIDEO:
      case TaskType.REALTIME_VOICE:
        return null; // Anthropic doesn't support these
      default:
        return MODELS.HAIKU;
    }
  }

  async generateText(
    prompt: string,
    options: TextGenerationOptions = {}
  ): Promise<TextGenerationResult> {
    const modelId = options.useThinking ? MODELS.SONNET : MODELS.HAIKU;
    
    // Build messages array
    const messages: any[] = [];

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
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: options.mimeType,
              data: options.imagePart
            }
          },
          { type: 'text', text: prompt }
        ]
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const requestBody: any = {
      model: modelId,
      messages,
      max_tokens: options.maxTokens || 4096
    };

    if (options.systemPrompt) {
      requestBody.system = options.systemPrompt;
    }

    // Extended thinking for Sonnet
    if (options.useThinking && modelId === MODELS.SONNET) {
      requestBody.thinking = {
        type: 'enabled',
        budget_tokens: 16000
      };
    }

    const response = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const body = await response.json();
      throw parseAPIError(this.providerId, response.status, body);
    }

    const data = await response.json();
    
    // Extract text and thinking content
    let text = '';
    let thinkingContent = '';
    
    for (const block of data.content || []) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'thinking') {
        thinkingContent += block.thinking;
      }
    }

    return {
      text,
      thinkingContent: thinkingContent || undefined,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0
      }
    };
  }

  async generateStructuredOutput<T>(
    prompt: string,
    schema: object,
    options: StructuredOutputOptions = {}
  ): Promise<T> {
    const systemPrompt = `You must respond with valid JSON matching this schema:
${JSON.stringify(schema, null, 2)}
Respond ONLY with valid JSON, no explanations or markdown code blocks.`;

    const response = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODELS.HAIKU,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || 4096
      })
    });

    if (!response.ok) {
      const body = await response.json();
      throw parseAPIError(this.providerId, response.status, body);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    
    // Clean up potential markdown code blocks
    const cleanJson = text.replace(/```json\n?|```\n?/g, '').trim();
    return JSON.parse(cleanJson);
  }
}

export default AnthropicAdapter;
