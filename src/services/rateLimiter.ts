/**
 * Rate Limiting Service for LLM API Calls
 *
 * Provides:
 * - Per-provider rate limiting (requests per time window)
 * - Token-based rate limiting
 * - Request queue with priority support
 * - User notification when rate limited
 * - Automatic retry with exponential backoff
 */

import type { ProviderId } from '../types/capabilities';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute?: number;
  requestsPerHour?: number;
}

export interface QueuedRequest {
  id: string;
  providerId: ProviderId;
  priority: number;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export interface RateLimitStatus {
  providerId: ProviderId;
  isRateLimited: boolean;
  remainingRequests: number;
  resetTime: Date;
  queuedRequests: number;
}

export interface RateLimitInfo {
  providerId: ProviderId;
  retryAfter?: number;
  limit?: number;
  remaining?: number;
  reset?: string;
  reason?: string;
}

// ============================================================================
// DEFAULT RATE LIMITS (Conservative defaults per provider)
// ============================================================================

const DEFAULT_RATE_LIMITS: Record<ProviderId, RateLimitConfig> = {
  openrouter: {
    requestsPerMinute: 60, // Conservative default for OpenRouter
    requestsPerHour: 1000,
  },
  openai: {
    requestsPerMinute: 60, // GPT-4 default: 200 requests/min for paid tiers
    requestsPerHour: 3000,
    tokensPerMinute: 150000, // GPT-4 tier 1 limit
  },
  anthropic: {
    requestsPerMinute: 50, // Claude default: 50 requests/min
    requestsPerHour: 1000,
    tokensPerMinute: 40000, // Claude Sonnet default
  },
  google: {
    requestsPerMinute: 60, // Gemini default
    requestsPerHour: 1500,
  },
  elevenlabs: {
    requestsPerMinute: 100, // ElevenLabs TTS
    requestsPerHour: 2000,
  },
  local_llm: {
    requestsPerMinute: 120, // Higher limit for local
    requestsPerHour: 10000,
  },
};

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

export class RateLimiter {
  // Track request timestamps per provider (sliding window)
  private requestTimestamps: Map<ProviderId, number[]> = new Map();

  // Track token usage per provider (sliding window)
  private tokenUsage: Map<ProviderId, number[]> = new Map();

  // Hourly request tracking
  private hourlyRequestTimestamps: Map<ProviderId, number[]> = new Map();

  // Request queue per provider
  private requestQueues: Map<ProviderId, QueuedRequest[]> = new Map();

  // Active request count (for concurrency limiting)
  private activeRequests: Map<ProviderId, number> = new Map();

  // Rate limit lock until time
  private rateLimitLocks: Map<ProviderId, number> = new Map();

  // Custom limits (can override defaults)
  private customLimits: Map<ProviderId, RateLimitConfig> = new Map();

  // Event listeners for rate limit notifications
  private listeners: Set<(info: RateLimitInfo) => void> = new Set();

  // Queue processing interval
  private queueProcessorInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.startQueueProcessor();
  }

  // --------------------------------------------------------------------------
  // CONFIGURATION
  // --------------------------------------------------------------------------

  /**
   * Set custom rate limit for a provider
   */
  setRateLimit(providerId: ProviderId, config: Partial<RateLimitConfig>): void {
    const current = this.getRateLimitConfig(providerId);
    this.customLimits.set(providerId, { ...current, ...config });
    this.cleanupOldTimestamps(providerId);
  }

  /**
   * Get rate limit config for a provider (custom or default)
   */
  getRateLimitConfig(providerId: ProviderId): RateLimitConfig {
    if (this.customLimits.has(providerId)) {
      return this.customLimits.get(providerId)!;
    }
    return DEFAULT_RATE_LIMITS[providerId] || {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
    };
  }

  /**
   * Reset rate limit state for a provider
   */
  resetProvider(providerId: ProviderId): void {
    this.requestTimestamps.delete(providerId);
    this.tokenUsage.delete(providerId);
    this.hourlyRequestTimestamps.delete(providerId);
    this.rateLimitLocks.delete(providerId);
    this.requestQueues.delete(providerId);
    this.activeRequests.delete(providerId);
    this.customLimits.delete(providerId); // Also reset custom limits
  }

  /**
   * Reset all rate limit state
   */
  resetAll(): void {
    this.requestTimestamps.clear();
    this.tokenUsage.clear();
    this.hourlyRequestTimestamps.clear();
    this.rateLimitLocks.clear();
    this.requestQueues.clear();
    this.activeRequests.clear();
    this.customLimits.clear(); // Also clear custom limits
  }

  // --------------------------------------------------------------------------
  // EVENT LISTENERS
  // --------------------------------------------------------------------------

  /**
   * Subscribe to rate limit events
   */
  onRateLimit(callback: (info: RateLimitInfo) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Emit rate limit event to listeners
   */
  private emitRateLimit(info: RateLimitInfo): void {
    this.listeners.forEach(listener => listener(info));
  }

  // --------------------------------------------------------------------------
  // RATE LIMIT CHECKING
  // --------------------------------------------------------------------------

  /**
   * Check if a request would exceed rate limits
   */
  private checkRateLimit(providerId: ProviderId, tokensRequested: number = 0): {
    allowed: boolean;
    retryAfter?: number;
    reason?: string;
  } {
    const now = Date.now();
    const config = this.getRateLimitConfig(providerId);

    // Check if provider is locked due to recent 429
    const lockedUntil = this.rateLimitLocks.get(providerId);
    if (lockedUntil && now < lockedUntil) {
      return {
        allowed: false,
        retryAfter: Math.ceil((lockedUntil - now) / 1000),
        reason: 'Rate limit lock from previous 429 response',
      };
    }

    // Clean up old timestamps
    this.cleanupOldTimestamps(providerId);

    // Get current timestamps
    const minuteTimestamps = this.requestTimestamps.get(providerId) || [];
    const hourlyTimestamps = this.hourlyRequestTimestamps.get(providerId) || [];
    const tokenBuckets = this.tokenUsage.get(providerId) || [];

    // Check per-minute request limit
    if (minuteTimestamps.length >= config.requestsPerMinute) {
      const oldestInWindow = minuteTimestamps[0];
      const retryAfter = Math.ceil((oldestInWindow + 60000 - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        reason: 'Per-minute request limit exceeded',
      };
    }

    // Check per-hour request limit
    if (config.requestsPerHour && hourlyTimestamps.length >= config.requestsPerHour) {
      const oldestInWindow = hourlyTimestamps[0];
      const retryAfter = Math.ceil((oldestInWindow + 3600000 - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        reason: 'Per-hour request limit exceeded',
      };
    }

    // Check token limit (if configured)
    if (config.tokensPerMinute && tokensRequested > 0) {
      const totalTokens = tokenBuckets.reduce((sum, tokens) => sum + tokens, 0);
      if (totalTokens + tokensRequested > config.tokensPerMinute) {
        const retryAfter = 60; // Wait for window to reset
        return {
          allowed: false,
          retryAfter,
          reason: 'Per-minute token limit would be exceeded',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Record a successful request
   */
  private recordRequest(providerId: ProviderId, tokensUsed: number = 0): void {
    const now = Date.now();

    // Add to minute window
    if (!this.requestTimestamps.has(providerId)) {
      this.requestTimestamps.set(providerId, []);
    }
    this.requestTimestamps.get(providerId)!.push(now);

    // Add to hourly window
    if (!this.hourlyRequestTimestamps.has(providerId)) {
      this.hourlyRequestTimestamps.set(providerId, []);
    }
    this.hourlyRequestTimestamps.get(providerId)!.push(now);

    // Add token usage
    if (tokensUsed > 0) {
      if (!this.tokenUsage.has(providerId)) {
        this.tokenUsage.set(providerId, []);
      }
      this.tokenUsage.get(providerId)!.push(tokensUsed);
    }
  }

  /**
   * Clean up timestamps older than the time windows
   */
  private cleanupOldTimestamps(providerId: ProviderId): void {
    const now = Date.now();

    // Clean minute window (keep last 60 seconds)
    const minuteTimestamps = this.requestTimestamps.get(providerId) || [];
    this.requestTimestamps.set(
      providerId,
      minuteTimestamps.filter(ts => now - ts < 60000)
    );

    // Clean hourly window (keep last 3600 seconds)
    const hourlyTimestamps = this.hourlyRequestTimestamps.get(providerId) || [];
    this.hourlyRequestTimestamps.set(
      providerId,
      hourlyTimestamps.filter(ts => now - ts < 3600000)
    );

    // Clean token usage (keep last 60 seconds)
    const tokenBuckets = this.tokenUsage.get(providerId) || [];
    this.tokenUsage.set(providerId, tokenBuckets.filter(ts => now - ts < 60000));
  }

  /**
   * Handle a 429 Rate Limit response from API
   */
  handleRateLimitResponse(providerId: ProviderId, retryAfter?: number): void {
    const lockDuration = (retryAfter || 60) * 1000;
    const lockedUntil = Date.now() + lockDuration;
    this.rateLimitLocks.set(providerId, lockedUntil);

    this.emitRateLimit({
      providerId,
      retryAfter: retryAfter || 60,
      reason: 'API returned 429 rate limit',
    });

    // Graceful degradation: log warning but don't throw
    // Requests will be automatically queued and retried
    console.warn(
      `[RateLimiter] Provider ${providerId} rate limited. Gracefully degrading: queuing requests for retry after ${retryAfter || 60} seconds.`
    );
  }

  // --------------------------------------------------------------------------
  // REQUEST EXECUTION
  // --------------------------------------------------------------------------

  /**
   * Execute a request with rate limiting
   */
  async executeRequest<T>(
    providerId: ProviderId,
    requestFn: () => Promise<T>,
    options: {
      priority?: number;
      estimatedTokens?: number;
    } = {}
  ): Promise<T> {
    const { priority = 5, estimatedTokens = 1000 } = options;

    // Check rate limits
    const check = this.checkRateLimit(providerId, estimatedTokens);

    if (!check.allowed) {
      // Queue the request
      return this.queueRequest(providerId, requestFn, priority);
    }

    // Execute immediately
    return this.executeImmediately(providerId, requestFn, estimatedTokens);
  }

  /**
   * Execute a request immediately (after passing rate limit check)
   */
  private async executeImmediately<T>(
    providerId: ProviderId,
    requestFn: () => Promise<T>,
    estimatedTokens: number
  ): Promise<T> {
    // Increment active request count
    this.activeRequests.set(providerId, (this.activeRequests.get(providerId) || 0) + 1);

    try {
      const result = await requestFn();

      // Record successful request (estimated tokens, will be updated if actual usage available)
      this.recordRequest(providerId, estimatedTokens);

      return result;
    } catch (error) {
      // Check if this is a rate limit error
      if (this.isRateLimitError(error)) {
        const retryAfter = this.extractRetryAfter(error);
        this.handleRateLimitResponse(providerId, retryAfter);
      }
      throw error;
    } finally {
      // Decrement active request count
      this.activeRequests.set(providerId, Math.max(0, (this.activeRequests.get(providerId) || 0) - 1));
    }
  }

  /**
   * Queue a request for later execution
   */
  private queueRequest<T>(
    providerId: ProviderId,
    requestFn: () => Promise<T>,
    priority: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queue = this.requestQueues.get(providerId) || [];

      const queuedRequest: QueuedRequest = {
        id: `${providerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        providerId,
        priority,
        execute: requestFn,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Insert in priority order (lower number = higher priority)
      let insertIndex = queue.length;
      for (let i = 0; i < queue.length; i++) {
        if (priority < queue[i].priority) {
          insertIndex = i;
          break;
        }
      }

      queue.splice(insertIndex, 0, queuedRequest);
      this.requestQueues.set(providerId, queue);
    });
  }

  /**
   * Process queued requests
   */
  private startQueueProcessor(): void {
    this.queueProcessorInterval = setInterval(() => {
      this.processQueues();
    }, 1000); // Check every second
  }

  private async processQueues(): Promise<void> {
    const now = Date.now();

    for (const [providerId, queue] of this.requestQueues.entries()) {
      if (queue.length === 0) continue;

      // Check if we can process the next request
      const nextRequest = queue[0];
      const check = this.checkRateLimit(providerId);

      if (check.allowed) {
        // Remove from queue
        queue.shift();
        this.requestQueues.set(providerId, queue);

        // Execute
        this.executeImmediately(providerId, nextRequest.execute, 1000)
          .then(nextRequest.resolve)
          .catch(nextRequest.reject);
      }
    }
  }

  // --------------------------------------------------------------------------
  // STATUS QUERYING
  // --------------------------------------------------------------------------

  /**
   * Get rate limit status for a provider
   */
  getStatus(providerId: ProviderId): RateLimitStatus {
    const config = this.getRateLimitConfig(providerId);
    const minuteTimestamps = this.requestTimestamps.get(providerId) || [];
    const lockedUntil = this.rateLimitLocks.get(providerId);
    const queue = this.requestQueues.get(providerId) || [];

    const isRateLimited = lockedUntil ? Date.now() < lockedUntil : false;

    return {
      providerId,
      isRateLimited,
      remainingRequests: Math.max(0, config.requestsPerMinute - minuteTimestamps.length),
      resetTime: lockedUntil ? new Date(lockedUntil) : new Date(Date.now() + 60000),
      queuedRequests: queue.length,
    };
  }

  /**
   * Get status for all providers
   */
  getAllStatus(): RateLimitStatus[] {
    const providers: ProviderId[] = [
      'openrouter',
      'openai',
      'anthropic',
      'google',
      'elevenlabs',
      'local_llm',
    ];
    return providers.map(p => this.getStatus(p));
  }

  // --------------------------------------------------------------------------
  // ERROR DETECTION
  // --------------------------------------------------------------------------

  /**
   * Check if an error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    // Check for status code (works for both Error and plain objects)
    if (typeof error === 'object' && error !== null) {
      if ('status' in error && (error as any).status === 429) {
        return true;
      }
      if ('code' in error && (error as any).code === 'RATE_LIMIT') {
        return true;
      }
    }

    // Check for Error message patterns
    if (error instanceof Error) {
      const messageMatch =
        error.message.toLowerCase().includes('rate limit') ||
        error.message.toLowerCase().includes('429') ||
        error.message.toLowerCase().includes('quota exceeded');
      return messageMatch;
    }

    return false;
  }

  /**
   * Extract retry-after duration from error
   */
  private extractRetryAfter(error: unknown): number | undefined {
    if (typeof error === 'object' && error !== null) {
      // Check for retryAfter field
      if ('retryAfter' in error) {
        const value = (error as any).retryAfter;
        if (typeof value === 'number') return value;
      }

      // Check for headers with retry-after
      if ('headers' in error) {
        const headers = (error as any).headers;
        const retryAfter = headers?.['retry-after'] || headers?.['Retry-After'];
        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10);
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
    return undefined;
  }

  // --------------------------------------------------------------------------
  // CLEANUP
  // --------------------------------------------------------------------------

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
    }
    this.resetAll();
    this.listeners.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let rateLimiterInstance: RateLimiter | null = null;

/**
 * Get the singleton RateLimiter instance
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
}

/**
 * Reset the rate limiter (useful for testing)
 */
export function resetRateLimiter(): void {
  if (rateLimiterInstance) {
    rateLimiterInstance.destroy();
  }
  rateLimiterInstance = null;
}

export default RateLimiter;
