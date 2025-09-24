/**
 * Error handling utilities and recovery mechanisms
 * Provides helper functions for error handling, recovery, and retry logic
 */

import type { ErrorRecoveryInfo } from "./types.js";
import { ErrorRecoveryStrategy } from "./types.js";

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay between retries in milliseconds */
  initialDelay: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Maximum delay between retries */
  maxDelay: number;
  /** Function to determine if an error should be retried */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 100,
  backoffMultiplier: 2,
  maxDelay: 5000,
  shouldRetry: (error: Error, _attempt: number) => {
    // Don't retry validation errors or permission errors
    if (
      error.message.includes("validation") ||
      error.message.includes("permission")
    ) {
      return false;
    }
    // Retry network and timeout errors
    return (
      error.message.includes("timeout") || error.message.includes("network")
    );
  },
};

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const { maxRetries, initialDelay, backoffMultiplier, maxDelay, shouldRetry } =
    {
      ...DEFAULT_RETRY_CONFIG,
      ...config,
    };

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on the last attempt
      if (attempt > maxRetries) {
        break;
      }

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(lastError, attempt)) {
        break;
      }

      // Wait before retrying
      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Execute operation with fallback value on error
 */
export async function withFallback<T>(
  operation: () => Promise<T>,
  fallbackValue: T | (() => T | Promise<T>),
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (typeof fallbackValue === "function") {
      const fallbackFn = fallbackValue as () => T | Promise<T>;
      return await fallbackFn();
    }
    return fallbackValue;
  }
}

/**
 * Execute operation with timeout
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutError?: Error,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        timeoutError || new Error(`Operation timed out after ${timeoutMs}ms`),
      );
    }, timeoutMs);
  });

  return Promise.race([operation(), timeoutPromise]);
}

/**
 * Wrap an async function with comprehensive error handling
 */
export function withErrorHandling<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  recovery?: ErrorRecoveryInfo,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await operation(...args);
    } catch (error) {
      if (!recovery) {
        throw error;
      }

      return await handleErrorWithRecovery(error as Error, recovery, () =>
        operation(...args),
      );
    }
  };
}

/**
 * Handle error with recovery strategy
 */
export async function handleErrorWithRecovery<T>(
  error: Error,
  recovery: ErrorRecoveryInfo,
  retryOperation?: () => Promise<T>,
): Promise<T> {
  switch (recovery.strategy) {
    case ErrorRecoveryStrategy.RETRY:
      if (!retryOperation) {
        throw new Error("Retry strategy requires a retry operation function");
      }
      return await withRetry(retryOperation, {
        maxRetries: recovery.maxRetries || DEFAULT_RETRY_CONFIG.maxRetries,
        initialDelay: recovery.retryDelay || DEFAULT_RETRY_CONFIG.initialDelay,
        backoffMultiplier: DEFAULT_RETRY_CONFIG.backoffMultiplier,
        maxDelay: DEFAULT_RETRY_CONFIG.maxDelay,
      });

    case ErrorRecoveryStrategy.FALLBACK:
      if (recovery.fallbackValue === undefined) {
        throw new Error("Fallback strategy requires a fallback value");
      }
      if (typeof recovery.fallbackValue === "function") {
        return await recovery.fallbackValue();
      }
      return recovery.fallbackValue;

    case ErrorRecoveryStrategy.IGNORE:
      return undefined as any;

    case ErrorRecoveryStrategy.PROMPT_USER:
      // In a real implementation, this would prompt the user
      console.warn("User prompt required for error recovery:", error.message);
      throw error;

    case ErrorRecoveryStrategy.FAIL_FAST:
    default:
      throw error;
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a circuit breaker for error-prone operations
 */
export class CircuitBreaker<T extends any[], R> {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private operation: (...args: T) => Promise<R>,
    private options: {
      failureThreshold: number;
      timeoutMs: number;
      resetTimeoutMs: number;
    } = {
      failureThreshold: 5,
      timeoutMs: 10000,
      resetTimeoutMs: 60000,
    },
  ) {}

  async execute(...args: T): Promise<R> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit breaker is open - operation not allowed");
      }
    }

    try {
      const result = await withTimeout(
        () => this.operation(...args),
        this.options.timeoutMs,
      );

      // Success - reset failure count and close circuit
      this.failureCount = 0;
      this.state = "closed";
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.options.failureThreshold) {
        this.state = "open";
      }

      throw error;
    }
  }

  getState(): "closed" | "open" | "half-open" {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = "closed";
  }
}

/**
 * Aggregate multiple errors into a single error
 */
export class AggregateError extends Error {
  readonly errors: Error[];

  constructor(errors: Error[], message = `${errors.length} errors occurred`) {
    super(message);
    this.name = "AggregateError";
    this.errors = errors;
  }

  override toString(): string {
    return `${this.message}\n${this.errors.map((e, i) => `  ${i + 1}. ${e.message}`).join("\n")}`;
  }
}

/**
 * Execute multiple operations and collect errors
 */
export async function executeWithErrorCollection<T>(
  operations: (() => Promise<T>)[],
  options: {
    continueOnError?: boolean;
    maxConcurrency?: number;
  } = {},
): Promise<{ results: (T | undefined)[]; errors: Error[] }> {
  const { continueOnError = false, maxConcurrency = 5 } = options;
  const results: (T | undefined)[] = new Array(operations.length);
  const errors: Error[] = [];

  // Execute operations in batches if maxConcurrency is specified
  for (let i = 0; i < operations.length; i += maxConcurrency) {
    const batch = operations.slice(i, i + maxConcurrency);
    const batchPromises = batch.map(async (operation, index) => {
      try {
        const result = await operation();
        return { success: true, result, index: i + index };
      } catch (error) {
        return { success: false, error: error as Error, index: i + index };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      if (result.success) {
        results[result.index] = result.result as T;
      } else {
        if (result.error) {
          errors.push(result.error);
          if (!continueOnError) {
            throw result.error;
          }
        }
      }
    }
  }

  return { results, errors };
}

/**
 * Create a safe wrapper that catches and logs errors
 */
export function createSafeWrapper<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  logger?: (error: Error, args: T) => void,
): (...args: T) => Promise<R | undefined> {
  return async (...args: T): Promise<R | undefined> => {
    try {
      return await operation(...args);
    } catch (error) {
      if (logger) {
        logger(error as Error, args);
      } else {
        console.error("Operation failed:", error);
      }
      return undefined;
    }
  };
}
