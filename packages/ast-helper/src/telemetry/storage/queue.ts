/**
 * @file Event Queue Implementation
 * @description SQLite-based event queue for telemetry transmission management
 */

import { EventQueue, QueuedEvent, QueueStats, QueueConfig } from './types.js';
import { TelemetryEvent } from '../collection/types.js';
import { SqliteTelemetryStorage } from './database.js';

/**
 * SQLite-based event queue implementation
 */
export class SqliteEventQueue implements EventQueue {
  private storage: SqliteTelemetryStorage;
  private config: QueueConfig;

  constructor(storage: SqliteTelemetryStorage, config: QueueConfig) {
    this.storage = storage;
    this.config = config;
  }

  /**
   * Add event to transmission queue
   */
  async enqueue(event: TelemetryEvent): Promise<void> {
    await this.enqueueBatch([event]);
  }

  /**
   * Add multiple events to queue
   */
  async enqueueBatch(events: TelemetryEvent[]): Promise<void> {
    // Store events first
    await this.storage.storeBatch(events);

    // Queue entries would be created with priority calculation
    // Implementation would use the database instance from storage
    // For now, this is a placeholder that would integrate with the storage database
  }

  /**
   * Calculate event priority for queue ordering
   */
  private calculatePriority(event: TelemetryEvent): number {
    let priority = 0;

    // Error events get higher priority
    if (event.eventType === 'error') {
      priority += 100;
    }

    // Performance events get medium priority
    if (event.eventType === 'performance') {
      priority += 50;
    }

    // Recent events get slight priority boost
    const age = Date.now() - event.timestamp.getTime();
    if (age < 60000) { // Less than 1 minute old
      priority += 10;
    }

    return priority;
  }

  /**
   * Get next batch of events for processing
   */
  async dequeue(batchSize: number): Promise<QueuedEvent[]> {
    // Get pending events from storage
    const pendingEvents = await this.storage.getPendingEvents(batchSize);
    
    // Convert to queued events with additional queue metadata
    return pendingEvents.map((event, index) => ({
      ...event,
      priority: this.calculatePriority(event),
      position: index + 1,
      scheduledAt: new Date()
    })) as QueuedEvent[];
  }

  /**
   * Mark events as successfully processed
   */
  async acknowledge(eventIds: string[]): Promise<void> {
    await this.storage.markTransmitted(eventIds);
  }

  /**
   * Return events to queue (failed processing)
   */
  async requeue(eventIds: string[], retryAfter?: Date): Promise<void> {
    // Calculate retry delay based on config
    const retryDelay = retryAfter || this.calculateRetryDelay(1);
    await this.storage.markFailed(eventIds, `Requeued for retry at ${retryDelay}`);
  }

  /**
   * Calculate retry delay based on backoff strategy
   */
  private calculateRetryDelay(attemptNumber: number): Date {
    let delayMs = this.config.baseRetryDelay;

    switch (this.config.retryBackoff) {
      case 'exponential':
        delayMs = this.config.baseRetryDelay * Math.pow(2, attemptNumber - 1);
        break;
      case 'linear':
        delayMs = this.config.baseRetryDelay * attemptNumber;
        break;
      case 'fixed':
        delayMs = this.config.baseRetryDelay;
        break;
    }

    // Cap at maximum delay
    delayMs = Math.min(delayMs, this.config.maxRetryDelay);

    const retryDate = new Date();
    retryDate.setTime(retryDate.getTime() + delayMs);
    return retryDate;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    const storageStats = await this.storage.getStats();
    
    const totalQueued = storageStats.eventsByStatus.pending || 0 + 
                       storageStats.eventsByStatus.queued || 0 +
                       storageStats.eventsByStatus.failed || 0;

    return {
      totalQueued,
      eventsByPriority: {}, // Would be calculated from actual queue data
      processing: {
        inProgress: storageStats.eventsByStatus.processing || 0,
        failedLastHour: 0, // Would need time-based query
        successfulLastHour: 0, // Would need time-based query
        averageProcessingTime: 0 // Would be tracked over time
      },
      health: {
        backlogSize: totalQueued,
        oldestQueuedEvent: storageStats.oldestEvent,
        estimatedProcessingTime: this.estimateProcessingTime(totalQueued),
        errorRate: this.calculateErrorRate(storageStats)
      }
    };
  }

  /**
   * Estimate processing time for current queue
   */
  private estimateProcessingTime(queueSize: number): number {
    const batchSize = this.config.defaultBatchSize;
    const estimatedBatches = Math.ceil(queueSize / batchSize);
    const avgProcessingTimePerBatch = 5000; // 5 seconds per batch
    return estimatedBatches * avgProcessingTimePerBatch;
  }

  /**
   * Calculate error rate from storage statistics
   */
  private calculateErrorRate(stats: any): number {
    const totalEvents = stats.totalEvents;
    const failedEvents = stats.eventsByStatus.failed || 0;
    const rejectedEvents = stats.eventsByStatus.rejected || 0;
    
    if (totalEvents === 0) return 0;
    
    return (failedEvents + rejectedEvents) / totalEvents;
  }

  /**
   * Clear all queued events
   */
  async clear(): Promise<void> {
    // This would clear the transmission queue table
    // Implementation depends on access to the database instance
    console.warn('Queue clear operation not fully implemented');
  }
}

/**
 * Queue factory for creating configured instances
 */
export class QueueFactory {
  /**
   * Create event queue with custom configuration
   */
  static createEventQueue(
    storage: SqliteTelemetryStorage,
    config?: Partial<QueueConfig>
  ): SqliteEventQueue {
    const defaultConfig: QueueConfig = {
      maxQueueSize: 10000,
      defaultBatchSize: 50,
      maxRetryAttempts: 3,
      retryBackoff: 'exponential',
      baseRetryDelay: 1000,
      maxRetryDelay: 300000,
      priorityStrategy: 'mixed',
      processingTimeout: 30000
    };

    const finalConfig = { ...defaultConfig, ...config };
    return new SqliteEventQueue(storage, finalConfig);
  }

  /**
   * Create high-throughput queue for production
   */
  static createProductionQueue(storage: SqliteTelemetryStorage): SqliteEventQueue {
    return QueueFactory.createEventQueue(storage, {
      maxQueueSize: 50000,
      defaultBatchSize: 100,
      maxRetryAttempts: 5,
      retryBackoff: 'exponential',
      priorityStrategy: 'priority'
    });
  }

  /**
   * Create simple queue for development
   */
  static createDevelopmentQueue(storage: SqliteTelemetryStorage): SqliteEventQueue {
    return QueueFactory.createEventQueue(storage, {
      maxQueueSize: 1000,
      defaultBatchSize: 10,
      maxRetryAttempts: 1,
      retryBackoff: 'fixed'
    });
  }
}