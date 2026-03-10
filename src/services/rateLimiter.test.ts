/**
 * Tests for Rate Limiter Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter, getRateLimiter, resetRateLimiter } from './rateLimiter';
import type { ProviderId } from '../types/capabilities';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    resetRateLimiter();
    rateLimiter = new RateLimiter();
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('Configuration', () => {
    it('should have default rate limits for all providers', () => {
      const providers: ProviderId[] = ['openrouter', 'openai', 'anthropic', 'google', 'elevenlabs', 'local_llm'];

      providers.forEach(provider => {
        const config = rateLimiter.getRateLimitConfig(provider);
        expect(config.requestsPerMinute).toBeGreaterThan(0);
        expect(config.requestsPerHour).toBeGreaterThan(0);
      });
    });

    it('should allow setting custom rate limits', () => {
      rateLimiter.setRateLimit('openai', {
        requestsPerMinute: 100,
        tokensPerMinute: 200000,
      });

      const config = rateLimiter.getRateLimitConfig('openai');
      expect(config.requestsPerMinute).toBe(100);
      expect(config.tokensPerMinute).toBe(200000);
      expect(config.requestsPerHour).toBeGreaterThan(0); // Should keep default
    });

    it('should reset provider state', () => {
      rateLimiter.setRateLimit('openai', { requestsPerMinute: 50 });
      rateLimiter.resetProvider('openai');

      // After reset, should get default limits (custom limits should be cleared)
      const config = rateLimiter.getRateLimitConfig('openai');
      expect(config.requestsPerMinute).toBe(60); // Default for OpenAI
    });
  });

  describe('Request Execution', () => {
    it('should execute request immediately when under limit', async () => {
      const requestFn = vi.fn().mockResolvedValue('success');

      const result = await rateLimiter.executeRequest('openai', requestFn, {
        estimatedTokens: 1000,
      });

      expect(result).toBe('success');
      expect(requestFn).toHaveBeenCalledTimes(1);
    });

    it('should queue request when rate limit is reached', async () => {
      // Set a very low limit
      rateLimiter.setRateLimit('openai', {
        requestsPerMinute: 1,
      });

      const requestFn1 = vi.fn().mockResolvedValue('first');
      const requestFn2 = vi.fn().mockResolvedValue('second');

      // Execute first request
      const promise1 = rateLimiter.executeRequest('openai', requestFn1, {
        estimatedTokens: 1000,
      });

      // Second request should be queued
      const promise2 = rateLimiter.executeRequest('openai', requestFn2, {
        estimatedTokens: 1000,
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe('first');
      expect(result2).toBe('second');
      expect(requestFn1).toHaveBeenCalledTimes(1);
      expect(requestFn2).toHaveBeenCalledTimes(1);
    });

    it('should handle request failures', async () => {
      const error = new Error('API Error');
      const requestFn = vi.fn().mockRejectedValue(error);

      await expect(
        rateLimiter.executeRequest('openai', requestFn)
      ).rejects.toThrow('API Error');

      expect(requestFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rate Limit Events', () => {
    it('should emit rate limit events', () => {
      const listener = vi.fn();
      const unsubscribe = rateLimiter.onRateLimit(listener);

      rateLimiter.handleRateLimitResponse('openai', 60);

      expect(listener).toHaveBeenCalledWith({
        providerId: 'openai',
        retryAfter: 60,
        reason: expect.any(String),
      });

      unsubscribe();
    });

    it('should allow unsubscribing from events', () => {
      const listener = vi.fn();
      const unsubscribe = rateLimiter.onRateLimit(listener);

      unsubscribe();
      rateLimiter.handleRateLimitResponse('openai', 60);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should lock provider after rate limit', () => {
      rateLimiter.handleRateLimitResponse('openai', 10);

      const status = rateLimiter.getStatus('openai');
      expect(status.isRateLimited).toBe(true);
      // When rate limited, remaining stays at default but requests are blocked
      expect(status.remainingRequests).toBe(60);
    });
  });

  describe('Status Querying', () => {
    it('should return status for a single provider', () => {
      const status = rateLimiter.getStatus('openai');

      expect(status.providerId).toBe('openai');
      expect(status.isRateLimited).toBe(false);
      expect(typeof status.remainingRequests).toBe('number');
      expect(status.queuedRequests).toBe(0);
      expect(status.resetTime).toBeInstanceOf(Date);
    });

    it('should return status for all providers', () => {
      const allStatus = rateLimiter.getAllStatus();

      expect(allStatus).toHaveLength(6); // All providers
      expect(allStatus.every(s => typeof s.providerId === 'string')).toBe(true);
    });

    it('should track queued requests in status', async () => {
      // Set a very low limit
      rateLimiter.setRateLimit('openai', {
        requestsPerMinute: 1,
      });

      // Execute first request
      const requestFn1 = vi.fn().mockResolvedValue('first');
      rateLimiter.executeRequest('openai', requestFn1);

      // Wait a bit then add more
      await new Promise(resolve => setTimeout(resolve, 10));

      const requestFn2 = vi.fn().mockResolvedValue('second');
      rateLimiter.executeRequest('openai', requestFn2);

      const requestFn3 = vi.fn().mockResolvedValue('third');
      rateLimiter.executeRequest('openai', requestFn3);

      // Check status (should have queued requests)
      const status = rateLimiter.getStatus('openai');
      expect(status.queuedRequests).toBeGreaterThan(0);
    });
  });

  describe('Error Detection', () => {
    it('should detect rate limit errors from status codes', () => {
      // Access private method through type assertion for testing
      const limiter = rateLimiter as any;

      const error1 = { status: 429, name: 'Error' };
      expect(limiter.isRateLimitError(error1)).toBe(true);

      const error2 = { status: 500, name: 'Error' };
      expect(limiter.isRateLimitError(error2)).toBe(false);
    });

    it('should detect rate limit errors from error codes', () => {
      const limiter = rateLimiter as any;

      const error1 = { code: 'RATE_LIMIT', name: 'Error' };
      expect(limiter.isRateLimitError(error1)).toBe(true);

      const error2 = { code: 'OTHER_ERROR', name: 'Error' };
      expect(limiter.isRateLimitError(error2)).toBe(false);
    });

    it('should detect rate limit errors from messages', () => {
      const limiter = rateLimiter as any;

      const error1 = new Error('Rate limit exceeded');
      expect(limiter.isRateLimitError(error1)).toBe(true);

      const error2 = new Error('429 Too Many Requests');
      expect(limiter.isRateLimitError(error2)).toBe(true);

      const error3 = new Error('Quota exceeded');
      expect(limiter.isRateLimitError(error3)).toBe(true);

      const error4 = new Error('Other error');
      expect(limiter.isRateLimitError(error4)).toBe(false);
    });

    it('should extract retry-after from error', () => {
      const limiter = rateLimiter as any;

      const error1 = { retryAfter: 120 };
      expect(limiter.extractRetryAfter(error1)).toBe(120);

      const error2 = { headers: { 'retry-after': '60' } };
      expect(limiter.extractRetryAfter(error2)).toBe(60);

      const error3 = { headers: { 'Retry-After': '30' } };
      expect(limiter.extractRetryAfter(error3)).toBe(30);
    });
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const instance1 = getRateLimiter();
      const instance2 = getRateLimiter();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getRateLimiter();
      resetRateLimiter();
      const instance2 = getRateLimiter();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      rateLimiter.setRateLimit('openai', { requestsPerMinute: 100 });
      rateLimiter.destroy();

      const status = rateLimiter.getStatus('openai');
      // After destroy, remaining should equal default limit (state is reset)
      expect(status.remainingRequests).toBe(60); // Default OpenAI limit
    });
  });
});
