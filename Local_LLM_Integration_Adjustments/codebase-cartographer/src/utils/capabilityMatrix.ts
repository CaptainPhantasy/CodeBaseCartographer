/**
 * Capability Matrix Logic
 * Determines which providers can handle each task and selects optimal providers
 */

import {
  TaskType,
  ProviderId,
  Capability,
  CapabilityCheckResult,
  ModelTier,
  UserPreferences,
  ModelDefinition,
  ProviderDefinition,
  TASK_REQUIRED_CAPABILITIES
} from '../types/capabilities';
import { PROVIDERS, getProvider } from '../config/providers';
import { getConfigManager } from '../config/configManager';

// ============================================================================
// CAPABILITY CHECKING
// ============================================================================

/**
 * Check if a model has all required capabilities for a task
 */
export function modelCanHandleTask(
  model: ModelDefinition,
  taskType: TaskType
): boolean {
  const requiredCapabilities = TASK_REQUIRED_CAPABILITIES[taskType];
  return requiredCapabilities.every(cap => model.capabilities.includes(cap));
}

/**
 * Get all models from a provider that can handle a specific task
 */
export function getProviderModelsForTask(
  providerId: ProviderId,
  taskType: TaskType
): ModelDefinition[] {
  const provider = getProvider(providerId);
  if (!provider || !provider.isAvailable) return [];
  
  return provider.models.filter(model => modelCanHandleTask(model, taskType));
}

/**
 * Get all configured providers that can handle a specific task
 */
export function getCapableProvidersForTask(taskType: TaskType): Array<{
  providerId: ProviderId;
  providerName: string;
  models: ModelDefinition[];
}> {
  const configManager = getConfigManager();
  const enabledProviders = configManager.getEnabledProviders();
  const results: Array<{
    providerId: ProviderId;
    providerName: string;
    models: ModelDefinition[];
  }> = [];

  for (const providerConfig of enabledProviders) {
    const provider = getProvider(providerConfig.providerId);
    if (!provider || !provider.isAvailable) continue;

    const capableModels = getProviderModelsForTask(providerConfig.providerId, taskType);
    if (capableModels.length > 0) {
      results.push({
        providerId: providerConfig.providerId,
        providerName: provider.name,
        models: capableModels
      });
    }
  }

  return results;
}

/**
 * Check if a task is available (has at least one capable provider configured)
 */
export function isTaskAvailable(taskType: TaskType): boolean {
  const capableProviders = getCapableProvidersForTask(taskType);
  return capableProviders.length > 0;
}

/**
 * Get detailed capability check result for a task
 */
export function checkTaskCapability(taskType: TaskType): CapabilityCheckResult {
  const capableProviders = getCapableProvidersForTask(taskType);
  const configManager = getConfigManager();
  const preferences = configManager.getPreferences();

  const availableProviders = capableProviders.flatMap(provider =>
    provider.models.map(model => ({
      providerId: provider.providerId,
      modelId: model.id,
      modelName: model.name
    }))
  );

  let recommendedProvider: CapabilityCheckResult['recommendedProvider'];

  if (availableProviders.length > 0) {
    // Get the best provider based on preferences
    const best = getBestProviderForTask(taskType, preferences);
    if (best) {
      recommendedProvider = {
        providerId: best.providerId,
        modelId: best.modelId,
        reason: best.reason
      };
    }
  }

  return {
    taskType,
    isAvailable: availableProviders.length > 0,
    availableProviders,
    recommendedProvider
  };
}

// ============================================================================
// PROVIDER SELECTION
// ============================================================================

/**
 * Get the best provider/model for a task based on user preferences
 */
export function getBestProviderForTask(
  taskType: TaskType,
  preferences?: UserPreferences
): {
  providerId: ProviderId;
  modelId: string;
  model: ModelDefinition;
  provider: ProviderDefinition;
  reason: string;
} | null {
  const configManager = getConfigManager();
  const prefs = preferences || configManager.getPreferences();
  
  // First check if there's a user-defined mapping
  const taskMapping = configManager.getTaskMapping(taskType);
  if (taskMapping) {
    const provider = getProvider(taskMapping.primaryProviderId);
    const providerConfig = configManager.getProvider(taskMapping.primaryProviderId);
    if (provider && providerConfig?.isEnabled) {
      const model = provider.models.find(m => m.id === taskMapping.primaryModelId);
      if (model) {
        return {
          providerId: taskMapping.primaryProviderId,
          modelId: taskMapping.primaryModelId,
          model,
          provider,
          reason: 'User configured preference'
        };
      }
    }
  }

  // Otherwise, find the best based on preferences
  const capableProviders = getCapableProvidersForTask(taskType);
  if (capableProviders.length === 0) return null;

  // Flatten all capable models with their provider info
  const allOptions: Array<{
    providerId: ProviderId;
    provider: ProviderDefinition;
    model: ModelDefinition;
    score: number;
  }> = [];

  for (const capableProvider of capableProviders) {
    const provider = getProvider(capableProvider.providerId)!;
    for (const model of capableProvider.models) {
      const score = calculateModelScore(model, prefs);
      allOptions.push({
        providerId: capableProvider.providerId,
        provider,
        model,
        score
      });
    }
  }

  // Sort by score (highest first)
  allOptions.sort((a, b) => b.score - a.score);

  const best = allOptions[0];
  return {
    providerId: best.providerId,
    modelId: best.model.id,
    model: best.model,
    provider: best.provider,
    reason: generateSelectionReason(best.model, prefs)
  };
}

/**
 * Calculate a score for a model based on user preferences
 */
function calculateModelScore(model: ModelDefinition, prefs: UserPreferences): number {
  let score = 50; // Base score

  // Tier matching
  if (model.tier === prefs.preferredTier) {
    score += 30;
  } else if (
    (prefs.preferredTier === 'balanced' && model.tier === 'smart') ||
    (prefs.preferredTier === 'balanced' && model.tier === 'fast')
  ) {
    score += 15;
  }

  // Cost preference
  if (prefs.preferCost && model.costPerMillionTokens) {
    // Lower cost = higher score (max bonus 20 points)
    const avgCost = (model.costPerMillionTokens.input + model.costPerMillionTokens.output) / 2;
    score += Math.max(0, 20 - avgCost);
  }

  // Speed preference (fast tier = faster inference typically)
  if (prefs.preferSpeed) {
    if (model.tier === 'fast') score += 20;
    else if (model.tier === 'balanced') score += 10;
  }

  // Streaming support bonus
  if (model.supportsStreaming) score += 5;

  // Context window bonus (normalized)
  if (model.contextWindow) {
    score += Math.min(10, model.contextWindow / 100000);
  }

  return score;
}

/**
 * Generate a human-readable reason for model selection
 */
function generateSelectionReason(model: ModelDefinition, prefs: UserPreferences): string {
  const reasons: string[] = [];

  if (model.tier === prefs.preferredTier) {
    reasons.push(`Matches preferred tier (${prefs.preferredTier})`);
  }

  if (prefs.preferCost && model.costPerMillionTokens) {
    const avgCost = (model.costPerMillionTokens.input + model.costPerMillionTokens.output) / 2;
    if (avgCost < 1) reasons.push('Cost-effective');
  }

  if (prefs.preferSpeed && model.tier === 'fast') {
    reasons.push('Optimized for speed');
  }

  if (model.supportsStreaming) {
    reasons.push('Supports streaming');
  }

  return reasons.length > 0 ? reasons.join(', ') : 'Best available option';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all tasks and their availability status
 */
export function getAllTasksAvailability(): Record<TaskType, boolean> {
  const result = {} as Record<TaskType, boolean>;
  for (const taskType of Object.values(TaskType)) {
    result[taskType] = isTaskAvailable(taskType);
  }
  return result;
}

/**
 * Get a summary of all tasks with their capable providers
 */
export function getFullCapabilityMatrix(): CapabilityCheckResult[] {
  return Object.values(TaskType).map(taskType => checkTaskCapability(taskType));
}

/**
 * Check which providers support a specific capability
 */
export function getProvidersWithCapability(capability: Capability): Array<{
  providerId: ProviderId;
  models: ModelDefinition[];
}> {
  const configManager = getConfigManager();
  const enabledProviders = configManager.getEnabledProviders();
  const results: Array<{ providerId: ProviderId; models: ModelDefinition[] }> = [];

  for (const providerConfig of enabledProviders) {
    const provider = getProvider(providerConfig.providerId);
    if (!provider || !provider.isAvailable) continue;

    const capableModels = provider.models.filter(m => m.capabilities.includes(capability));
    if (capableModels.length > 0) {
      results.push({
        providerId: providerConfig.providerId,
        models: capableModels
      });
    }
  }

  return results;
}

/**
 * Get missing capabilities for unavailable tasks
 */
export function getMissingCapabilities(): Array<{
  taskType: TaskType;
  requiredCapabilities: Capability[];
  missingCapabilities: Capability[];
}> {
  const results: Array<{
    taskType: TaskType;
    requiredCapabilities: Capability[];
    missingCapabilities: Capability[];
  }> = [];

  const configManager = getConfigManager();
  const enabledProviders = configManager.getEnabledProviders();

  // Get all available capabilities from enabled providers
  const availableCapabilities = new Set<Capability>();
  for (const providerConfig of enabledProviders) {
    const provider = getProvider(providerConfig.providerId);
    if (!provider || !provider.isAvailable) continue;
    for (const model of provider.models) {
      model.capabilities.forEach(cap => availableCapabilities.add(cap));
    }
  }

  // Check each task
  for (const taskType of Object.values(TaskType)) {
    const required = TASK_REQUIRED_CAPABILITIES[taskType];
    const missing = required.filter(cap => !availableCapabilities.has(cap));
    if (missing.length > 0) {
      results.push({
        taskType,
        requiredCapabilities: required,
        missingCapabilities: missing
      });
    }
  }

  return results;
}

export default {
  isTaskAvailable,
  checkTaskCapability,
  getBestProviderForTask,
  getAllTasksAvailability,
  getFullCapabilityMatrix,
  getProvidersWithCapability,
  getMissingCapabilities
};
