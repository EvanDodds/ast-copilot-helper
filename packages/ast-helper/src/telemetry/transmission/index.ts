/**
 * Telemetry Transmission System
 * 
 * This module provides the complete telemetry transmission system for the 
 * AST Copilot Helper project. It handles sending telemetry data to remote
 * endpoints with retry logic, offline queuing, and rate limiting.
 * 
 * @author AST Copilot Helper Team
 * @since 1.0.0
 */

// Core transmission types and interfaces
export * from './types';

// Main HTTP transmitter implementation
export { HttpTelemetryTransmitter } from './transmitter';

// Supporting components
export { HttpRetryManager } from './retry';
export { DiskOfflineQueue } from './offline-queue';
export { RateLimiter } from './rate-limiter';

// Import types for internal use
import { HttpTelemetryTransmitter } from './transmitter';
import type { TransmissionConfig } from './types';

/**
 * Create a basic HTTP transmitter for development use
 * 
 * @returns Configured HttpTelemetryTransmitter for development
 */
export function createDevelopmentTransmitter(): HttpTelemetryTransmitter {
  return new HttpTelemetryTransmitter({
    endpoint: 'http://localhost:8080/telemetry',
    timeout: 5000,
    retry: {
      enabled: true,
      maxAttempts: 1,
      baseDelay: 100,
      maxDelay: 1000,
      strategy: 'fixed',
      jitter: 0,
      retryableStatusCodes: [429, 500, 502, 503, 504],
      retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
    },
    offlineQueue: {
      enabled: false,
      maxSize: 100,
      maxSizeBytes: 1024 * 1024,
      storageType: 'memory',
      persistent: false,
      cleanupOnStartup: true
    }
  });
}

/**
 * Create a production HTTP transmitter
 * 
 * @param endpoint - The telemetry endpoint URL
 * @param apiKey - API key for authentication
 * @returns Configured HttpTelemetryTransmitter for production
 */
export function createProductionTransmitter(endpoint: string, apiKey: string): HttpTelemetryTransmitter {
  return new HttpTelemetryTransmitter({
    endpoint,
    apiKey,
    timeout: 30000,
    retry: {
      enabled: true,
      maxAttempts: 5,
      baseDelay: 2000,
      maxDelay: 120000,
      strategy: 'jittered',
      jitter: 0.2,
      retryableStatusCodes: [429, 500, 502, 503, 504],
      retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
    },
    offlineQueue: {
      enabled: true,
      maxSize: 50000,
      maxSizeBytes: 100 * 1024 * 1024, // 100MB
      storageType: 'disk',
      persistent: true,
      cleanupOnStartup: true
    },
    rateLimit: {
      enabled: true,
      requestsPerMinute: 120,
      bytesPerMinute: 50 * 1024 * 1024, // 50MB
      strategy: 'delay',
      burstLimit: 10
    }
  });
}

/**
 * Create a custom HTTP transmitter with specific configuration
 * 
 * @param config - Partial transmission configuration
 * @returns Configured HttpTelemetryTransmitter
 */
export function createCustomTransmitter(config?: Partial<TransmissionConfig>): HttpTelemetryTransmitter {
  const defaultConfig: TransmissionConfig = {
    endpoint: 'https://api.example.com/telemetry',
    timeout: 15000,
    maxBatchSize: 100,
    maxPayloadSize: 1024 * 1024,
    transmissionInterval: 30000,
    enableCompression: true,
    compressionThreshold: 1024,
    retry: {
      enabled: true,
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      strategy: 'exponential',
      jitter: 0.1,
      retryableStatusCodes: [429, 500, 502, 503, 504],
      retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
    },
    offlineQueue: {
      enabled: true,
      maxSize: 1000,
      maxSizeBytes: 10 * 1024 * 1024,
      storageType: 'disk',
      persistent: true,
      cleanupOnStartup: true
    },
    rateLimit: {
      enabled: true,
      requestsPerMinute: 60,
      bytesPerMinute: 10 * 1024 * 1024,
      strategy: 'delay',
      burstLimit: 5
    },
    security: {
      validateSSL: true
    }
  };

  return new HttpTelemetryTransmitter({ ...defaultConfig, ...config });
}

/**
 * Default transmission configuration for quick setup
 */
export const DEFAULT_TRANSMISSION_CONFIG: Partial<TransmissionConfig> = {
  timeout: 15000,
  maxBatchSize: 100,
  maxPayloadSize: 1024 * 1024, // 1MB
  retry: {
    enabled: true,
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    strategy: 'exponential',
    jitter: 0.1,
    retryableStatusCodes: [429, 500, 502, 503, 504],
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH']
  },
  offlineQueue: {
    enabled: true,
    maxSize: 1000,
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    storageType: 'disk',
    persistent: true,
    cleanupOnStartup: true
  },
  rateLimit: {
    enabled: true,
    requestsPerMinute: 60,
    bytesPerMinute: 10 * 1024 * 1024, // 10MB
    strategy: 'delay',
    burstLimit: 5
  }
};

/**
 * Validate transmission configuration
 * 
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateTransmissionConfig(config: Partial<TransmissionConfig>): void {
  if (config.endpoint && !config.endpoint.startsWith('http')) {
    throw new Error('Endpoint must be a valid HTTP(S) URL');
  }

  if (config.timeout && config.timeout < 1000) {
    throw new Error('Timeout must be at least 1000ms');
  }

  if (config.maxBatchSize && config.maxBatchSize < 1) {
    throw new Error('Max batch size must be at least 1');
  }

  if (config.maxPayloadSize && config.maxPayloadSize < 1024) {
    throw new Error('Max payload size must be at least 1024 bytes');
  }

  if (config.retry?.maxAttempts && config.retry.maxAttempts < 0) {
    throw new Error('Max retry attempts cannot be negative');
  }

  if (config.offlineQueue?.maxSize && config.offlineQueue.maxSize < 0) {
    throw new Error('Offline queue max size cannot be negative');
  }

  if (config.rateLimit?.requestsPerMinute && config.rateLimit.requestsPerMinute < 1) {
    throw new Error('Rate limit must allow at least 1 request per minute');
  }
}