/**
 * @file Storage Types and Interfaces
 * @description Type definitions for telemetry data storage and queuing
 */

import type { TelemetryEvent, CollectionStats } from "../collection/types.js";
import type { PrivacyLevel } from "../types.js";

// ============================================================================
// Storage Interfaces
// ============================================================================

/**
 * Main interface for telemetry data storage
 */
export interface TelemetryStorage {
  /**
   * Initialize storage system
   */
  initialize(): Promise<void>;

  /**
   * Store a single telemetry event
   */
  store(event: TelemetryEvent): Promise<void>;

  /**
   * Store multiple events in a batch
   */
  storeBatch(events: TelemetryEvent[]): Promise<void>;

  /**
   * Retrieve events based on criteria
   */
  query(criteria: QueryCriteria): Promise<TelemetryEvent[]>;

  /**
   * Get events ready for transmission
   */
  getPendingEvents(batchSize?: number): Promise<StoredEvent[]>;

  /**
   * Mark events as successfully transmitted
   */
  markTransmitted(eventIds: string[]): Promise<void>;

  /**
   * Mark events as failed transmission
   */
  markFailed(eventIds: string[], error: string): Promise<void>;

  /**
   * Clean up old data based on retention policy
   */
  cleanup(retentionDays: number): Promise<CleanupResult>;

  /**
   * Get storage statistics
   */
  getStats(): Promise<StorageStats>;

  /**
   * Close storage connection
   */
  close(): Promise<void>;
}

/**
 * Event queue interface for managing transmission queue
 */
export interface EventQueue {
  /**
   * Add event to transmission queue
   */
  enqueue(event: TelemetryEvent): Promise<void>;

  /**
   * Add multiple events to queue
   */
  enqueueBatch(events: TelemetryEvent[]): Promise<void>;

  /**
   * Get next batch of events for processing
   */
  dequeue(batchSize: number): Promise<QueuedEvent[]>;

  /**
   * Mark events as successfully processed
   */
  acknowledge(eventIds: string[]): Promise<void>;

  /**
   * Return events to queue (failed processing)
   */
  requeue(eventIds: string[], retryAfter?: Date): Promise<void>;

  /**
   * Get queue statistics
   */
  getQueueStats(): Promise<QueueStats>;

  /**
   * Clear all queued events
   */
  clear(): Promise<void>;
}

// ============================================================================
// Storage Data Types
// ============================================================================

/**
 * Stored event with metadata
 */
export interface StoredEvent extends TelemetryEvent {
  /**
   * Storage-specific ID
   */
  storageId: number;

  /**
   * When event was stored
   */
  storedAt: Date;

  /**
   * Transmission status
   */
  transmissionStatus: TransmissionStatus;

  /**
   * Number of transmission attempts
   */
  transmissionAttempts: number;

  /**
   * Last transmission attempt
   */
  lastTransmissionAttempt?: Date;

  /**
   * Next retry time for failed transmissions
   */
  nextRetryAt?: Date;

  /**
   * Transmission error message
   */
  transmissionError?: string;

  /**
   * Event size in bytes
   */
  eventSize: number;

  /**
   * Compression status
   */
  compressed: boolean;
}

/**
 * Queued event for transmission
 */
export interface QueuedEvent extends StoredEvent {
  /**
   * Queue priority (higher = more important)
   */
  priority: number;

  /**
   * Queue position
   */
  position: number;

  /**
   * Scheduled processing time
   */
  scheduledAt: Date;
}

/**
 * Query criteria for retrieving events
 */
export interface QueryCriteria {
  /**
   * Event ID filter
   */
  eventIds?: string[];

  /**
   * Session ID filter
   */
  sessionIds?: string[];

  /**
   * Event type filter
   */
  eventTypes?: string[];

  /**
   * Category filter
   */
  categories?: string[];

  /**
   * Privacy level filter
   */
  privacyLevels?: PrivacyLevel[];

  /**
   * Date range filter
   */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /**
   * Transmission status filter
   */
  transmissionStatus?: TransmissionStatus[];

  /**
   * Maximum number of results
   */
  limit?: number;

  /**
   * Results offset for pagination
   */
  offset?: number;

  /**
   * Sort criteria
   */
  sortBy?: "timestamp" | "storedAt" | "eventType" | "transmissionAttempts";

  /**
   * Sort direction
   */
  sortOrder?: "asc" | "desc";
}

// ============================================================================
// Status and Statistics Types
// ============================================================================

/**
 * Transmission status for events
 */
export type TransmissionStatus =
  | "pending" // Waiting to be transmitted
  | "queued" // In transmission queue
  | "processing" // Currently being transmitted
  | "transmitted" // Successfully transmitted
  | "failed" // Transmission failed (temporary)
  | "rejected" // Permanently rejected
  | "expired"; // Too old to transmit

/**
 * Storage statistics
 */
export interface StorageStats {
  /**
   * Total number of stored events
   */
  totalEvents: number;

  /**
   * Events by status
   */
  eventsByStatus: Record<TransmissionStatus, number>;

  /**
   * Events by type
   */
  eventsByType: Record<string, number>;

  /**
   * Events by privacy level
   */
  eventsByPrivacyLevel: Record<PrivacyLevel, number>;

  /**
   * Total storage size in bytes
   */
  totalSize: number;

  /**
   * Average event size
   */
  averageEventSize: number;

  /**
   * Oldest event timestamp
   */
  oldestEvent?: Date;

  /**
   * Newest event timestamp
   */
  newestEvent?: Date;

  /**
   * Database file size
   */
  databaseSize: number;

  /**
   * Last cleanup timestamp
   */
  lastCleanup?: Date;

  /**
   * Collection period statistics
   */
  collectionStats: CollectionStats;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /**
   * Total queued events
   */
  totalQueued: number;

  /**
   * Events by priority
   */
  eventsByPriority: Record<number, number>;

  /**
   * Processing statistics
   */
  processing: {
    inProgress: number;
    failedLastHour: number;
    successfulLastHour: number;
    averageProcessingTime: number;
  };

  /**
   * Queue health metrics
   */
  health: {
    backlogSize: number;
    oldestQueuedEvent?: Date;
    estimatedProcessingTime: number;
    errorRate: number;
  };
}

/**
 * Cleanup operation result
 */
export interface CleanupResult {
  /**
   * Number of events cleaned up
   */
  eventsRemoved: number;

  /**
   * Storage space freed (bytes)
   */
  spaceFreed: number;

  /**
   * Time taken for cleanup
   */
  cleanupDuration: number;

  /**
   * Cleanup timestamp
   */
  cleanupTimestamp: Date;

  /**
   * Events removed by status
   */
  removedByStatus: Record<TransmissionStatus, number>;

  /**
   * Events removed by age (days)
   */
  removedByAge: Record<number, number>;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Storage configuration
 */
export interface StorageConfig {
  /**
   * Database file path
   */
  databasePath: string;

  /**
   * Maximum database size (bytes)
   */
  maxDatabaseSize: number;

  /**
   * Data retention period (days)
   */
  retentionDays: number;

  /**
   * Batch size for operations
   */
  batchSize: number;

  /**
   * Connection pool size
   */
  connectionPoolSize: number;

  /**
   * Enable WAL mode for SQLite
   */
  enableWalMode: boolean;

  /**
   * Enable compression for large events
   */
  enableCompression: boolean;

  /**
   * Compression threshold (bytes)
   */
  compressionThreshold: number;

  /**
   * Automatic cleanup interval (hours)
   */
  cleanupInterval: number;

  /**
   * Queue configuration
   */
  queue: QueueConfig;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  /**
   * Maximum queue size
   */
  maxQueueSize: number;

  /**
   * Default batch size for dequeue
   */
  defaultBatchSize: number;

  /**
   * Maximum retry attempts
   */
  maxRetryAttempts: number;

  /**
   * Retry backoff strategy
   */
  retryBackoff: "exponential" | "linear" | "fixed";

  /**
   * Base retry delay (milliseconds)
   */
  baseRetryDelay: number;

  /**
   * Maximum retry delay (milliseconds)
   */
  maxRetryDelay: number;

  /**
   * Event priority strategy
   */
  priorityStrategy: "fifo" | "priority" | "mixed";

  /**
   * Processing timeout (milliseconds)
   */
  processingTimeout: number;
}

/**
 * Default storage configuration
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  databasePath: "./telemetry.db",
  maxDatabaseSize: 50 * 1024 * 1024, // 50MB
  retentionDays: 30,
  batchSize: 100,
  connectionPoolSize: 5,
  enableWalMode: true,
  enableCompression: true,
  compressionThreshold: 1024, // 1KB
  cleanupInterval: 24, // hours
  queue: {
    maxQueueSize: 10000,
    defaultBatchSize: 50,
    maxRetryAttempts: 3,
    retryBackoff: "exponential",
    baseRetryDelay: 1000, // 1 second
    maxRetryDelay: 300000, // 5 minutes
    priorityStrategy: "mixed",
    processingTimeout: 30000, // 30 seconds
  },
};
