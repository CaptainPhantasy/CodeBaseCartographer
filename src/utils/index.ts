/**
 * Utils exports
 */

export { validateApiKey, validateAllProviders, quickValidateKeyFormat } from './apiKeyValidator';
export { 
  isTaskAvailable, 
  checkTaskCapability, 
  getBestProviderForTask, 
  getAllTasksAvailability, 
  getFullCapabilityMatrix,
  getProvidersWithCapability,
  getMissingCapabilities,
  modelCanHandleTask,
  getProviderModelsForTask,
  getCapableProvidersForTask
} from './capabilityMatrix';
