/**
 * @file HTTP Retry Manager
 * @description Retry logic implementation for HTTP transmission
 */

import type {
  RetryManager,
  RetryContext,
  RetryStats,
  RetryConfig,
} from "./types.js";

/**
 * HTTP-specific retry manager with various backoff strategies
 */
export class HttpRetryManager implements RetryManager {
  private config: RetryConfig;
  private stats: RetryStats;

  constructor(config: RetryConfig) {
    this.config = config;
    this.stats = {
      totalAttempts: 0,
      successfulRetries: 0,
      exhaustedRetries: 0,
      averageAttempts: 0,
      retryReasons: {},
      successRateByAttempt: {},
    };
  }

  /**
   * Execute operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: RetryContext,
  ): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < context.maxAttempts) {
      attempt++;
      this.stats.totalAttempts++;

      try {
        const result = await operation();

        if (attempt > 1) {
          this.stats.successfulRetries++;
          this.updateSuccessRateByAttempt(attempt, true);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");

        // Track retry reason
        const reason = this.categorizeError(lastError);
        this.stats.retryReasons[reason] =
          (this.stats.retryReasons[reason] || 0) + 1;

        // Check if we should retry
        if (
          attempt >= context.maxAttempts ||
          !this.shouldRetry(lastError, attempt)
        ) {
          if (attempt > 1) {
            this.stats.exhaustedRetries++;
            this.updateSuccessRateByAttempt(attempt, false);
          }
          break;
        }

        // Calculate and wait for retry delay
        const delay = this.calculateDelay(attempt, context.baseDelay);
        const clampedDelay = Math.min(delay, context.maxDelay);

        if (clampedDelay > 0) {
          await this.sleep(clampedDelay);
        }
      }
    }

    // Update average attempts
    this.updateAverageAttempts();

    throw lastError || new Error("Operation failed after retries");
  }

  /**
   * Calculate next retry delay
   */
  calculateDelay(attempt: number, baseDelay: number): number {
    switch (this.config.strategy) {
      case "exponential":
        return baseDelay * Math.pow(2, attempt - 1);

      case "linear":
        return baseDelay * attempt;

      case "fixed":
        return baseDelay;

      case "jittered": {
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = exponentialDelay * this.config.jitter * Math.random();
        return exponentialDelay + jitter;
      }

      default:
        return baseDelay;
    }
  }

  /**
   * Check if operation should be retried
   */
  shouldRetry(error: Error, attempt: number): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (attempt >= this.config.maxAttempts) {
      return false;
    }

    // Check for retryable error conditions
    const message = error.message.toLowerCase();

    // Check retryable error types
    for (const retryableError of this.config.retryableErrors) {
      if (message.includes(retryableError.toLowerCase())) {
        return true;
      }
    }

    // Check HTTP status codes
    const httpMatch = message.match(/http (\d{3})/);
    if (httpMatch && httpMatch[1]) {
      const statusCode = parseInt(httpMatch[1], 10);
      return this.config.retryableStatusCodes.includes(statusCode);
    }

    // Default to not retry for unknown errors
    return false;
  }

  /**
   * Get retry statistics
   */
  async getRetryStats(): Promise<RetryStats> {
    return { ...this.stats };
  }

  /**
   * Update retry configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Categorize error for statistics
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes("timeout")) {
      return "timeout";
    }
    if (message.includes("network") || message.includes("connection")) {
      return "network";
    }
    if (message.includes("429") || message.includes("rate limit")) {
      return "rate_limit";
    }
    if (message.includes("500")) {
      return "server_error";
    }
    if (
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504")
    ) {
      return "service_unavailable";
    }

    return "unknown";
  }

  /**
   * Update success rate by attempt number
   */
  private updateSuccessRateByAttempt(attempt: number, success: boolean): void {
    const currentRate = this.stats.successRateByAttempt[attempt] || 0;
    const currentCount = Math.round(
      currentRate * this.getAttemptCount(attempt),
    );

    if (success) {
      this.stats.successRateByAttempt[attempt] =
        (currentCount + 1) / (this.getAttemptCount(attempt) + 1);
    } else {
      this.stats.successRateByAttempt[attempt] =
        currentCount / (this.getAttemptCount(attempt) + 1);
    }
  }

  /**
   * Get total count for specific attempt number
   */
  private getAttemptCount(attempt: number): number {
    // Simplified calculation - in practice, you'd track this more precisely
    return Math.max(1, Math.round(this.stats.totalAttempts / attempt));
  }

  /**
   * Update average attempts statistic
   */
  private updateAverageAttempts(): void {
    const totalOperations =
      this.stats.successfulRetries +
      this.stats.exhaustedRetries +
      (this.stats.totalAttempts > 0 ? 1 : 0);

    if (totalOperations > 0) {
      this.stats.averageAttempts = this.stats.totalAttempts / totalOperations;
    }
  }
}
