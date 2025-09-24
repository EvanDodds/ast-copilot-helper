/**
 * @file Transmission Types and Interfaces
 * @description Type definitions for secure telemetry data transmission
 */

import type { StoredEvent } from "../storage/types.js";

// ============================================================================
// Transmission Interfaces
// ============================================================================

/**
 * Main interface for telemetry data transmission
 */
export interface TelemetryTransmitter {
  /**
   * Initialize the transmitter
   */
  initialize(): Promise<void>;

  /**
   * Transmit a batch of telemetry events
   */
  transmit(events: StoredEvent[]): Promise<TransmissionResult>;

  /**
   * Check connection status to transmission endpoint
   */
  checkConnection(): Promise<ConnectionStatus>;

  /**
   * Get transmission statistics
   */
  getStats(): Promise<TransmissionStats>;

  /**
   * Update transmission configuration
   */
  updateConfig(config: Partial<TransmissionConfig>): Promise<void>;

  /**
   * Close transmitter and cleanup resources
   */
  close(): Promise<void>;
}

/**
 * Interface for retry logic management
 */
export interface RetryManager {
  /**
   * Execute operation with retry logic
   */
  execute<T>(operation: () => Promise<T>, context: RetryContext): Promise<T>;

  /**
   * Calculate next retry delay
   */
  calculateDelay(attempt: number, baseDelay: number): number;

  /**
   * Check if operation should be retried
   */
  shouldRetry(error: Error, attempt: number): boolean;

  /**
   * Get retry statistics
   */
  getRetryStats(): Promise<RetryStats>;
}

/**
 * Interface for offline queue management
 */
export interface OfflineQueue {
  /**
   * Add events to offline queue
   */
  enqueue(events: StoredEvent[]): Promise<void>;

  /**
   * Get events from offline queue
   */
  dequeue(batchSize: number): Promise<StoredEvent[]>;

  /**
   * Check if offline queue is enabled
   */
  isEnabled(): boolean;

  /**
   * Get queue size and status
   */
  getQueueInfo(): Promise<QueueInfo>;

  /**
   * Clear offline queue
   */
  clear(): Promise<void>;
}

// ============================================================================
// Transmission Data Types
// ============================================================================

/**
 * Result of a transmission operation
 */
export interface TransmissionResult {
  /**
   * Whether transmission was successful
   */
  success: boolean;

  /**
   * Number of events successfully transmitted
   */
  transmitted: number;

  /**
   * Number of events that failed
   */
  failed: number;

  /**
   * Events that were successfully transmitted
   */
  successfulEvents: string[];

  /**
   * Events that failed transmission
   */
  failedEvents: TransmissionFailure[];

  /**
   * Transmission duration in milliseconds
   */
  duration: number;

  /**
   * Total payload size in bytes
   */
  payloadSize: number;

  /**
   * Response metadata from server
   */
  metadata?: TransmissionMetadata;
}

/**
 * Individual transmission failure details
 */
export interface TransmissionFailure {
  /**
   * Event ID that failed
   */
  eventId: string;

  /**
   * Error message
   */
  error: string;

  /**
   * Error code if available
   */
  errorCode?: string | number;

  /**
   * Whether failure is retryable
   */
  retryable: boolean;

  /**
   * Recommended retry delay
   */
  retryAfter?: number;
}

/**
 * Connection status information
 */
export interface ConnectionStatus {
  /**
   * Whether connection is available
   */
  connected: boolean;

  /**
   * Connection latency in milliseconds
   */
  latency?: number;

  /**
   * Last successful connection time
   */
  lastConnected?: Date;

  /**
   * Connection error if applicable
   */
  error?: string;

  /**
   * Server information
   */
  serverInfo?: {
    version: string;
    capabilities: string[];
    limits: {
      maxBatchSize: number;
      maxPayloadSize: number;
      rateLimitPerMinute: number;
    };
  };
}

/**
 * Transmission metadata from server response
 */
export interface TransmissionMetadata {
  /**
   * Server-assigned transmission ID
   */
  transmissionId: string;

  /**
   * Server timestamp
   */
  serverTimestamp: Date;

  /**
   * Processing duration on server
   */
  serverDuration?: number;

  /**
   * Server warnings or notices
   */
  warnings?: string[];

  /**
   * Rate limit information
   */
  rateLimit?: {
    remaining: number;
    resetAt: Date;
    limit: number;
  };
}

// ============================================================================
// Retry and Queue Types
// ============================================================================

/**
 * Context for retry operations
 */
export interface RetryContext {
  /**
   * Operation identifier
   */
  operationId: string;

  /**
   * Maximum retry attempts
   */
  maxAttempts: number;

  /**
   * Base retry delay in milliseconds
   */
  baseDelay: number;

  /**
   * Maximum retry delay in milliseconds
   */
  maxDelay: number;

  /**
   * Retry strategy
   */
  strategy: RetryStrategy;

  /**
   * Custom retry conditions
   */
  retryConditions?: (error: Error) => boolean;
}

/**
 * Retry strategy types
 */
export type RetryStrategy =
  | "exponential" // Exponential backoff
  | "linear" // Linear backoff
  | "fixed" // Fixed delay
  | "jittered"; // Jittered exponential backoff

/**
 * Retry statistics
 */
export interface RetryStats {
  /**
   * Total retry attempts across all operations
   */
  totalAttempts: number;

  /**
   * Total successful retries
   */
  successfulRetries: number;

  /**
   * Total failed retries (exhausted)
   */
  exhaustedRetries: number;

  /**
   * Average retry attempts per operation
   */
  averageAttempts: number;

  /**
   * Most common retry reasons
   */
  retryReasons: Record<string, number>;

  /**
   * Retry success rate by attempt number
   */
  successRateByAttempt: Record<number, number>;
}

/**
 * Offline queue information
 */
export interface QueueInfo {
  /**
   * Number of events in queue
   */
  size: number;

  /**
   * Oldest event timestamp in queue
   */
  oldestEvent?: Date;

  /**
   * Total queue size in bytes
   */
  totalSize: number;

  /**
   * Queue capacity utilization
   */
  utilization: number;

  /**
   * Whether queue is at capacity
   */
  atCapacity: boolean;
}

// ============================================================================
// Statistics and Monitoring
// ============================================================================

/**
 * Comprehensive transmission statistics
 */
export interface TransmissionStats {
  /**
   * Total transmission attempts
   */
  totalAttempts: number;

  /**
   * Total successful transmissions
   */
  totalSuccessful: number;

  /**
   * Total failed transmissions
   */
  totalFailed: number;

  /**
   * Success rate percentage
   */
  successRate: number;

  /**
   * Events transmitted
   */
  eventsTransmitted: number;

  /**
   * Events pending transmission
   */
  eventsPending: number;

  /**
   * Total payload bytes sent
   */
  totalPayloadBytes: number;

  /**
   * Average transmission duration
   */
  averageDuration: number;

  /**
   * Average batch size
   */
  averageBatchSize: number;

  /**
   * Last successful transmission
   */
  lastSuccessfulTransmission?: Date;

  /**
   * Last transmission attempt
   */
  lastAttempt?: Date;

  /**
   * Current connection status
   */
  connectionStatus: ConnectionStatus;

  /**
   * Retry statistics
   */
  retryStats: RetryStats;

  /**
   * Error breakdown
   */
  errorBreakdown: Record<string, number>;

  /**
   * Hourly transmission rates
   */
  hourlyRates: Record<string, number>;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Transmission configuration
 */
export interface TransmissionConfig {
  /**
   * Transmission endpoint URL
   */
  endpoint: string;

  /**
   * API key or authentication token
   */
  apiKey?: string;

  /**
   * Custom headers for requests
   */
  headers?: Record<string, string>;

  /**
   * Request timeout in milliseconds
   */
  timeout: number;

  /**
   * Maximum batch size for transmission
   */
  maxBatchSize: number;

  /**
   * Maximum payload size in bytes
   */
  maxPayloadSize: number;

  /**
   * Transmission interval in milliseconds
   */
  transmissionInterval: number;

  /**
   * Enable compression for payloads
   */
  enableCompression: boolean;

  /**
   * Compression threshold in bytes
   */
  compressionThreshold: number;

  /**
   * Retry configuration
   */
  retry: RetryConfig;

  /**
   * Offline queue configuration
   */
  offlineQueue: OfflineQueueConfig;

  /**
   * Rate limiting configuration
   */
  rateLimit: RateLimitConfig;

  /**
   * Security settings
   */
  security: SecurityConfig;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /**
   * Enable retry functionality
   */
  enabled: boolean;

  /**
   * Maximum retry attempts
   */
  maxAttempts: number;

  /**
   * Base retry delay in milliseconds
   */
  baseDelay: number;

  /**
   * Maximum retry delay in milliseconds
   */
  maxDelay: number;

  /**
   * Retry strategy
   */
  strategy: RetryStrategy;

  /**
   * Jitter amount for jittered strategy (0.0-1.0)
   */
  jitter: number;

  /**
   * Retryable HTTP status codes
   */
  retryableStatusCodes: number[];

  /**
   * Retryable error types
   */
  retryableErrors: string[];
}

/**
 * Offline queue configuration
 */
export interface OfflineQueueConfig {
  /**
   * Enable offline queuing
   */
  enabled: boolean;

  /**
   * Maximum queue size in number of events
   */
  maxSize: number;

  /**
   * Maximum queue size in bytes
   */
  maxSizeBytes: number;

  /**
   * Queue storage type
   */
  storageType: "memory" | "disk";

  /**
   * Disk storage path (if using disk storage)
   */
  storagePath?: string;

  /**
   * Queue persistence across restarts
   */
  persistent: boolean;

  /**
   * Queue cleanup on startup
   */
  cleanupOnStartup: boolean;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /**
   * Enable rate limiting
   */
  enabled: boolean;

  /**
   * Requests per minute limit
   */
  requestsPerMinute: number;

  /**
   * Bytes per minute limit
   */
  bytesPerMinute: number;

  /**
   * Burst allowance
   */
  burstLimit: number;

  /**
   * Rate limit enforcement strategy
   */
  strategy: "reject" | "delay" | "queue";
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  /**
   * Validate SSL certificates
   */
  validateSSL: boolean;

  /**
   * Custom CA certificates
   */
  customCACerts?: string[];

  /**
   * Client certificate for mTLS
   */
  clientCert?: {
    cert: string;
    key: string;
    passphrase?: string;
  };

  /**
   * Request signing configuration
   */
  signing?: {
    algorithm: string;
    secretKey: string;
    includeHeaders: string[];
  };

  /**
   * Payload encryption
   */
  encryption?: {
    algorithm: string;
    key: string;
    iv?: string;
  };
}

/**
 * Default transmission configuration
 */
export const DEFAULT_TRANSMISSION_CONFIG: TransmissionConfig = {
  endpoint: "",
  timeout: 30000, // 30 seconds
  maxBatchSize: 100,
  maxPayloadSize: 1024 * 1024, // 1MB
  transmissionInterval: 300000, // 5 minutes
  enableCompression: true,
  compressionThreshold: 1024, // 1KB
  retry: {
    enabled: true,
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 60000, // 1 minute
    strategy: "exponential",
    jitter: 0.1,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    retryableErrors: ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"],
  },
  offlineQueue: {
    enabled: true,
    maxSize: 10000,
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    storageType: "disk",
    persistent: true,
    cleanupOnStartup: false,
  },
  rateLimit: {
    enabled: true,
    requestsPerMinute: 60,
    bytesPerMinute: 10 * 1024 * 1024, // 10MB
    burstLimit: 10,
    strategy: "delay",
  },
  security: {
    validateSSL: true,
  },
};
