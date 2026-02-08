/**
 * taskGenerationService.ts - AI-powered task generation from codebase analysis
 *
 * Analyzes codebase and generates structured task proposals
 */

import { getLLMService } from './llmService';
import type { CreateTaskInput } from '../types/task';

export interface CodebaseContext {
  filePaths: string[];
  selectedFiles?: string[];
  architectureSummary?: string;
  userGoal?: string;
}

export interface GeneratedTask extends CreateTaskInput {
  rationale?: string;
  estimatedEffort?: 'low' | 'medium' | 'high';
}

export interface TaskGenerationResult {
  tasks: GeneratedTask[];
  summary: string;
  assumptions: string[];
}

/**
 * Generate tasks from codebase analysis
 */
export async function generateTasks(
  context: CodebaseContext
): Promise<TaskGenerationResult> {
  const llmService = getLLMService();

  // Check if task generation is available
  if (!llmService.isTaskAvailable('TASK_GENERATION' as any)) {
    throw new Error(
      'Task generation requires a provider with code analysis and structured output capabilities. Please configure a supported provider in Settings.'
    );
  }

  // Build the analysis prompt
  const prompt = buildAnalysisPrompt(context);

  // Define the schema for structured output
  const schema = {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
            },
            files: {
              type: 'array',
              items: { type: 'string' },
            },
            rationale: { type: 'string' },
            estimatedEffort: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
            },
          },
          required: ['title', 'description', 'priority'],
        },
      },
      summary: { type: 'string' },
      assumptions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['tasks', 'summary', 'assumptions'],
  };

  try {
    const result = await llmService.generateStructuredOutput<TaskGenerationResult>(
      prompt,
      schema,
      {
        temperature: 0.7,
        maxTokens: 4000,
      }
    );

    return result;
  } catch (error) {
    console.error('Task generation failed:', error);
    throw new Error(
      `Failed to generate tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Build the analysis prompt based on context
 */
function buildAnalysisPrompt(context: CodebaseContext): string {
  const { filePaths, selectedFiles, architectureSummary, userGoal } = context;

  let prompt = `You are an expert software architect and project manager. Analyze the following codebase and generate a structured task list.\n\n`;

  // Add user goal if provided
  if (userGoal) {
    prompt += `**User Goal:** ${userGoal}\n\n`;
  }

  // Add architecture summary if available
  if (architectureSummary) {
    prompt += `**Architecture Summary:**\n${architectureSummary}\n\n`;
  }

  // Add file context
  prompt += `**Codebase Structure:**\n`;
  if (selectedFiles && selectedFiles.length > 0) {
    prompt += `Focusing on ${selectedFiles.length} selected files:\n`;
    selectedFiles.slice(0, 50).forEach((file) => {
      prompt += `  - ${file}\n`;
    });
    if (selectedFiles.length > 50) {
      prompt += `  ... and ${selectedFiles.length - 50} more files\n`;
    }
  } else {
    prompt += `Total files: ${filePaths.length}\n`;
    filePaths.slice(0, 100).forEach((file) => {
      prompt += `  - ${file}\n`;
    });
    if (filePaths.length > 100) {
      prompt += `  ... and ${filePaths.length - 100} more files\n`;
    }
  }

  prompt += `\n**Instructions:**\n`;
  prompt += `1. Generate 5-15 specific, actionable tasks based on the codebase analysis\n`;
  prompt += `2. Each task should have a clear title and detailed description\n`;
  prompt += `3. Assign appropriate priority (critical, high, medium, low) based on impact and dependencies\n`;
  prompt += `4. Link relevant files to each task when applicable\n`;
  prompt += `5. Provide rationale for each task explaining why it's needed\n`;
  prompt += `6. Estimate effort level (low, medium, high)\n`;
  prompt += `7. Include a summary of the overall proposal\n`;
  prompt += `8. List any assumptions made during analysis\n\n`;

  prompt += `**Task Categories to Consider:**\n`;
  prompt += `- Code quality improvements (refactoring, technical debt)\n`;
  prompt += `- Feature additions or enhancements\n`;
  prompt += `- Bug fixes or potential issues\n`;
  prompt += `- Testing improvements\n`;
  prompt += `- Documentation needs\n`;
  prompt += `- Performance optimizations\n`;
  prompt += `- Security considerations\n\n`;

  prompt += `Return ONLY valid JSON matching the provided schema.`;

  return prompt;
}

/**
 * Generate tasks for a specific file or component
 */
export async function generateTasksForFile(
  filePath: string,
  fileContent: string,
  context?: string
): Promise<GeneratedTask[]> {
  const llmService = getLLMService();

  if (!llmService.isTaskAvailable('TASK_GENERATION' as any)) {
    throw new Error('Task generation not available');
  }

  const prompt = `Analyze the following file and generate specific tasks to improve it.

**File:** ${filePath}
${context ? `**Context:** ${context}\n` : ''}
**Content:**
\`\`\`
${fileContent.slice(0, 10000)}${fileContent.length > 10000 ? '\n... (truncated)' : ''}
\`\`\`

Generate 3-8 tasks focusing on:
- Code quality and maintainability
- Potential bugs or edge cases
- Performance improvements
- Testing needs
- Documentation

Return ONLY valid JSON.`;

  const schema = {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
            },
            files: {
              type: 'array',
              items: { type: 'string' },
            },
            rationale: { type: 'string' },
            estimatedEffort: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
            },
          },
          required: ['title', 'description', 'priority'],
        },
      },
    },
    required: ['tasks'],
  };

  const result = await llmService.generateStructuredOutput<{ tasks: GeneratedTask[] }>(
    prompt,
    schema
  );

  return result.tasks;
}

/**
 * Generate tasks from a node/graph selection
 */
export async function generateTasksForNode(
  nodeId: string,
  nodeLabel: string,
  connectedFiles: string[],
  graphContext?: string
): Promise<GeneratedTask[]> {
  const llmService = getLLMService();

  if (!llmService.isTaskAvailable('TASK_GENERATION' as any)) {
    throw new Error('Task generation not available');
  }

  const prompt = `Generate tasks for the following system component.

**Component:** ${nodeLabel} (ID: ${nodeId})
**Connected Files:**
${connectedFiles.map((f) => `  - ${f}`).join('\n')}
${graphContext ? `**Graph Context:**\n${graphContext}\n` : ''}

Generate 3-6 tasks to improve this component, considering:
- Component functionality and completeness
- Integration with connected files
- Error handling and edge cases
- Testing and documentation needs
- Performance optimizations

Return ONLY valid JSON.`;

  const schema = {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
            },
            files: {
              type: 'array',
              items: { type: 'string' },
            },
            rationale: { type: 'string' },
            estimatedEffort: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
            },
          },
          required: ['title', 'description', 'priority'],
        },
      },
    },
    required: ['tasks'],
  };

  const result = await llmService.generateStructuredOutput<{ tasks: GeneratedTask[] }>(
    prompt,
    schema
  );

  return result.tasks;
}
