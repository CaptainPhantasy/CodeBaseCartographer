/**
 * graphOrchestrator.ts - Structured output + graph generation with
 * validation/retry feedback loop.
 */

import { TaskType } from '../../types/capabilities';
import type { GraphData } from '../../types';
import { getProviderForTask, getFallbackProviderForTask } from './providerRouter';
import { isProviderFailure, proxyGenerateStructured, type StructuredOutputOptions } from './proxyClient';
import {
  GRAPH_SCHEMA,
  GRAPH_SCHEMA_WITH_CONTEXT,
  buildGraphPrompt,
  buildGraphPromptWithContext,
} from './prompts/graphPrompts';
import type { ServiceConfig } from './serviceConfig';

export interface GraphContextInput {
  files?: Array<{ path: string; content: string }>;
  codebasePath?: string;
}

export interface GraphGenerationOptions {
  maxAttempts?: number;
  validateOutput?: boolean;
}

/** Generate structured JSON output, falling back to the secondary provider on provider errors. */
export async function generateStructuredOutput<T>(
  config: ServiceConfig,
  prompt: string,
  schema: object,
  options: StructuredOutputOptions = {}
): Promise<T> {
  const provider = await getProviderForTask(TaskType.GRAPH_GENERATION);

  if (!provider) {
    throw new Error(
      'No provider configured for structured output. Please configure a provider with structured_output capability.'
    );
  }

  try {
    return await proxyGenerateStructured<T>(provider.providerId, provider.modelId, prompt, schema, options);
  } catch (error) {
    if (config.enableFallback && isProviderFailure(error)) {
      const fallback = await getFallbackProviderForTask(TaskType.GRAPH_GENERATION, provider.providerId);
      if (fallback) {
        return await proxyGenerateStructured<T>(fallback.providerId, fallback.modelId, prompt, schema, options);
      }
    }
    throw error;
  }
}

/** Generate graph data for visualization (no codebase context). */
export async function generateGraphData(config: ServiceConfig, description: string): Promise<GraphData> {
  return generateStructuredOutput<GraphData>(config, buildGraphPrompt(description), GRAPH_SCHEMA);
}

/** Generate graph data with codebase context, validating and feeding errors back into retries. */
export async function generateGraphDataWithContext(
  config: ServiceConfig,
  description: string,
  context: GraphContextInput,
  options: GraphGenerationOptions = {}
): Promise<GraphData> {
  const { maxAttempts = 3, validateOutput = true } = options;

  const { validateGraph, formatValidationFeedback } = await import('../graphValidator');
  const { buildGraphContext, formatContextForLLM } = await import('../graphContextExtractor');

  let contextPrompt = '';
  if (context.files && context.files.length > 0) {
    const graphContext = buildGraphContext(context.files, context.codebasePath || '/');
    contextPrompt = formatContextForLLM(graphContext, 30);
  }

  let attempt = 0;
  let lastFeedback: string | null = null;

  while (attempt < maxAttempts) {
    const prompt = buildGraphPromptWithContext(description, contextPrompt, lastFeedback);

    try {
      const graphData = await generateStructuredOutput<GraphData>(config, prompt, GRAPH_SCHEMA_WITH_CONTEXT);

      if (validateOutput) {
        const validation = validateGraph(graphData, { autoRepair: true });

        if (validation.isValid && validation.repaired) {
          return validation.repaired;
        } else if (validation.repaired) {
          console.warn('Graph had validation issues but was auto-repaired:', validation.warnings);
          return validation.repaired;
        }

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
