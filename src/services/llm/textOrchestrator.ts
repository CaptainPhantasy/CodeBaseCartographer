/**
 * textOrchestrator.ts - Text generation + chat with provider fallback
 */

import { TaskType } from '../../types/capabilities';
import { ProviderError, handleError } from '../../utils/errorHandler';
import type { TextGenerationOptions, TextGenerationResult } from '../adapters/base';
import { getProviderForTask, getFallbackProviderForTask } from './providerRouter';
import { isProviderFailure, proxyGenerateText } from './proxyClient';
import type { ServiceConfig } from './serviceConfig';

/** Extended result type with metadata */
export interface ChatResult extends TextGenerationResult {
  metadata?: {
    groundingUrls?: string[];
    thinking?: string;
    provider?: string;
    model?: string;
  };
}

export interface ChatOptions {
  systemPrompt?: string;
  useThinking?: boolean;
  useSearchGrounding?: boolean;
  imagePart?: string;
  mimeType?: string;
}

/** Generate text, falling back to the configured secondary provider on provider errors. */
export async function generateText(
  config: ServiceConfig,
  prompt: string,
  options: TextGenerationOptions = {}
): Promise<TextGenerationResult> {
  const provider = await getProviderForTask(TaskType.TEXT_GENERATION);

  if (!provider) {
    const error = new ProviderError(
      'system',
      'No provider configured for text generation. Please configure at least one provider.',
      { taskType: TaskType.TEXT_GENERATION }
    );
    handleError(error, { operation: 'generateText', prompt: prompt.substring(0, 50) + '...' });
    throw error;
  }

  try {
    return await proxyGenerateText(provider.providerId, provider.modelId, prompt, options);
  } catch (error) {
    handleError(error, {
      operation: 'generateText',
      providerId: provider.providerId,
      modelId: provider.modelId
    });

    if (config.enableFallback && isProviderFailure(error)) {
      const fallback = await getFallbackProviderForTask(TaskType.TEXT_GENERATION, provider.providerId);
      if (fallback) {
        return await proxyGenerateText(fallback.providerId, fallback.modelId, prompt, options);
      }
    }
    throw error;
  }
}

/** Chat with history; the last message drives generation, history rides along as context. */
export async function chat(
  config: ServiceConfig,
  history: Array<{ role: string; text: string }>,
  options: ChatOptions = {}
): Promise<ChatResult> {
  const lastMessage = history[history.length - 1];
  const provider = await getProviderForTask(TaskType.TEXT_GENERATION);

  const result = await generateText(config, lastMessage?.text || '', {
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
