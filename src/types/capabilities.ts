/**
 * Capability Types for Multi-Provider LLM Configuration
 * Defines capabilities, providers, and task mappings
 */

// ============================================================================
// CAPABILITY DEFINITIONS
// ============================================================================

/**
 * All possible capabilities that an LLM model can have
 */
export type Capability = 
  | 'text'              // Basic text generation/chat
  | 'code'              // Code generation/analysis
  | 'structured_output' // JSON schema-based structured output
  | 'vision'            // Image understanding
  | 'tts'               // Text-to-speech
  | 'video'             // Video generation
  | 'realtime_audio'    // Real-time bidirectional audio
  | 'thinking'          // Extended reasoning/thinking mode
  | 'search_grounding'; // Web search grounding

/**
 * Task types that the application needs to perform
 */
export enum TaskType {
  TEXT_GENERATION = 'TEXT_GENERATION',
  GRAPH_GENERATION = 'GRAPH_GENERATION',
  TTS = 'TTS',
  VIDEO = 'VIDEO',
  REALTIME_VOICE = 'REALTIME_VOICE',
  IMAGE_ANALYSIS = 'IMAGE_ANALYSIS',
  CODE_ANALYSIS = 'CODE_ANALYSIS',
  TASK_GENERATION = 'TASK_GENERATION'
}

/**
 * Maps each task to the capabilities it requires
 */
export const TASK_REQUIRED_CAPABILITIES: Record<TaskType, Capability[]> = {
  [TaskType.TEXT_GENERATION]: ['text'],
  [TaskType.GRAPH_GENERATION]: ['text', 'structured_output'],
  [TaskType.TTS]: ['tts'],
  [TaskType.VIDEO]: ['video'],
  [TaskType.REALTIME_VOICE]: ['realtime_audio'],
  [TaskType.IMAGE_ANALYSIS]: ['vision', 'text'],
  [TaskType.CODE_ANALYSIS]: ['code', 'text'],
  [TaskType.TASK_GENERATION]: ['code', 'text', 'structured_output']
};

// ============================================================================
// PROVIDER DEFINITIONS
// ============================================================================

/**
 * Supported provider identifiers
 */
export type ProviderId = 
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'elevenlabs'
  | 'local_llm';

/**
 * Model tier for quality/speed tradeoffs
 */
export type ModelTier = 'fast' | 'balanced' | 'smart';

/**
 * Model definition with capabilities
 */
export interface ModelDefinition {
  id: string;
  name: string;
  capabilities: Capability[];
  tier: ModelTier;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsStreaming?: boolean;
  costPerMillionTokens?: {
    input: number;
    output: number;
  };
}

/**
 * Provider configuration schema
 */
export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  description: string;
  apiEndpoint: string;
  authHeaderFormat: string; // e.g., "Authorization: Bearer {apiKey}"
  models: ModelDefinition[];
  isAvailable: boolean; // For stubbed providers like LocalLLM
  docsUrl?: string;
  keyInstructions?: string;
}

// ============================================================================
// USER CONFIGURATION TYPES
// ============================================================================

/**
 * User's provider configuration (stored)
 */
export interface ProviderConfig {
  providerId: ProviderId;
  apiKey: string; // Will be obfuscated in storage
  isEnabled: boolean;
  validatedAt?: string; // ISO date string
  isValid?: boolean;
}

/**
 * User's task-to-provider mapping preferences
 */
export interface TaskProviderMapping {
  taskType: TaskType;
  primaryProviderId: ProviderId;
  primaryModelId: string;
  fallbackProviderId?: ProviderId;
  fallbackModelId?: string;
}

/**
 * User preferences for provider selection
 */
export interface UserPreferences {
  preferredTier: ModelTier;
  preferCost: boolean; // If true, prefer cheaper models
  preferSpeed: boolean; // If true, prefer faster models
}

/**
 * Complete user configuration stored locally
 */
export interface AppConfig {
  version: string;
  providers: ProviderConfig[];
  taskMappings: TaskProviderMapping[];
  preferences: UserPreferences;
  lastUpdated: string;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Result of API key validation
 */
export interface ValidationResult {
  isValid: boolean;
  providerId: ProviderId;
  errorMessage?: string;
  errorCode?: string;
  rateLimited?: boolean;
  retryAfter?: number; // seconds
}

/**
 * Result of capability check
 */
export interface CapabilityCheckResult {
  taskType: TaskType;
  isAvailable: boolean;
  availableProviders: Array<{
    providerId: ProviderId;
    modelId: string;
    modelName: string;
  }>;
  recommendedProvider?: {
    providerId: ProviderId;
    modelId: string;
    reason: string;
  };
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  preferredTier: 'balanced',
  preferCost: false,
  preferSpeed: false
};

export const CONFIG_VERSION = '1.0.0';
