/**
 * @file Rate Limiter
 * @description Rate limiting implementation for transmission requests
 */

import type { RateLimitConfig } from './types.js';

/**
 * Token bucket rate limiter implementation
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private requestTokens: number;
  private byteTokens: number;
  private lastRefill: number;
  private requestWindow: number[] = [];
  private byteWindow: number[] = [];

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.requestTokens = config.requestsPerMinute;
    this.byteTokens = config.bytesPerMinute;
    this.lastRefill = Date.now();
  }

  /**
   * Check if request is within rate limits
   */
  async checkLimit(eventCount: number, payloadSize = 0): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    await this.refillTokens();

    // Check request rate limit
    if (eventCount > this.requestTokens) {
      await this.handleRateLimit('requests', eventCount);
    }

    // Check byte rate limit
    if (payloadSize > this.byteTokens) {
      await this.handleRateLimit('bytes', payloadSize);
    }

    // Consume tokens
    this.requestTokens = Math.max(0, this.requestTokens - eventCount);
    this.byteTokens = Math.max(0, this.byteTokens - payloadSize);

    // Track usage in sliding window
    const now = Date.now();
    this.requestWindow.push({ timestamp: now, count: eventCount } as any);
    this.byteWindow.push({ timestamp: now, bytes: payloadSize } as any);

    // Clean old entries (older than 1 minute)
    const oneMinuteAgo = now - 60000;
    this.requestWindow = this.requestWindow.filter(entry => (entry as any).timestamp > oneMinuteAgo);
    this.byteWindow = this.byteWindow.filter(entry => (entry as any).timestamp > oneMinuteAgo);
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Reset tokens if limits changed
    if (config.requestsPerMinute !== undefined) {
      this.requestTokens = Math.min(this.requestTokens, config.requestsPerMinute);
    }
    
    if (config.bytesPerMinute !== undefined) {
      this.byteTokens = Math.min(this.byteTokens, config.bytesPerMinute);
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    requestsRemaining: number;
    bytesRemaining: number;
    requestsUsedThisMinute: number;
    bytesUsedThisMinute: number;
    resetAt: Date;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Calculate usage in current minute
    const requestsUsed = this.requestWindow
      .filter(entry => (entry as any).timestamp > oneMinuteAgo)
      .reduce((sum, entry) => sum + (entry as any).count, 0);
    
    const bytesUsed = this.byteWindow
      .filter(entry => (entry as any).timestamp > oneMinuteAgo)
      .reduce((sum, entry) => sum + (entry as any).bytes, 0);

    // Next reset is start of next minute
    const nextMinute = Math.ceil(now / 60000) * 60000;

    return {
      requestsRemaining: this.requestTokens,
      bytesRemaining: this.byteTokens,
      requestsUsedThisMinute: requestsUsed,
      bytesUsedThisMinute: bytesUsed,
      resetAt: new Date(nextMinute)
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Refill token buckets based on elapsed time
   */
  private async refillTokens(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    
    if (elapsed >= 60000) { // Refill every minute
      this.requestTokens = this.config.requestsPerMinute;
      this.byteTokens = this.config.bytesPerMinute;
      this.lastRefill = now;
    }
  }

  /**
   * Handle rate limit exceeded scenario
   */
  private async handleRateLimit(type: 'requests' | 'bytes', required: number): Promise<void> {
    switch (this.config.strategy) {
      case 'reject':
        throw new Error(`Rate limit exceeded: ${type} (required: ${required})`);

      case 'delay': {
        // Calculate delay until tokens are available
        const delayMs = this.calculateDelay();
        if (delayMs > 0) {
          await this.sleep(delayMs);
          await this.refillTokens();
        }
        break;
      }

      case 'queue': {
        // In a full implementation, this would queue the request
        // For now, we'll just delay
        const queueDelay = this.calculateDelay();
        if (queueDelay > 0) {
          await this.sleep(queueDelay);
          await this.refillTokens();
        }
        break;
      }
    }
  }

  /**
   * Calculate delay until rate limit resets
   */
  private calculateDelay(): number {
    const now = Date.now();
    const nextMinute = Math.ceil(now / 60000) * 60000;
    return nextMinute - now;
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}