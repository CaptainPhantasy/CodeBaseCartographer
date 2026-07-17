/**
 * serviceConfig.ts - LLMService behavior knobs
 */

export interface ServiceConfig {
  enableFallback: boolean;
  maxRetries: number;
  retryDelay: number;
}

export const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
  enableFallback: true,
  maxRetries: 2,
  retryDelay: 1000
};
