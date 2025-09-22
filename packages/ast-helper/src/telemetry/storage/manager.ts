/**
 * @file Storage Manager
 * @description High-level manager for coordinating storage and queue operations
 */

import { 
  TelemetryStorage,
  EventQueue,
  StorageConfig,
  QueueConfig,
  StorageStats,
  QueueStats,
  CleanupResult
} from './types.js';
import { TelemetryEvent } from '../collection/types.js';
import { SqliteTelemetryStorage, StorageFactory } from './database.js';
import { SqliteEventQueue, QueueFactory } from './queue.js';

/**
 * Options for storage manager initialization
 */
export interface StorageManagerOptions {
  storage?: Partial<StorageConfig>;
  queue?: Partial<QueueConfig>;
  dataDirectory?: string;
  environment?: 'development' | 'production' | 'test';
}

/**
 * High-level storage manager that coordinates storage and queue operations
 */
export class StorageManager {
  private storage: TelemetryStorage;
  private queue: EventQueue;
  private initialized = false;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: StorageManagerOptions = {}) {
    // Create storage instance based on environment
    this.storage = this.createStorage(options);
    
    // Create queue instance
    this.queue = this.createQueue(options);
  }

  /**
   * Create storage instance based on configuration
   */
  private createStorage(options: StorageManagerOptions): SqliteTelemetryStorage {
    if (options.environment === 'development') {
      return StorageFactory.createDevelopmentStorage();
    } else if (options.environment === 'production' && options.dataDirectory) {
      return StorageFactory.createProductionStorage(options.dataDirectory);
    } else {
      return StorageFactory.createSqliteStorage(options.storage);
    }
  }

  /**
   * Create queue instance based on configuration
   */
  private createQueue(options: StorageManagerOptions): SqliteEventQueue {
    if (options.environment === 'development') {
      return QueueFactory.createDevelopmentQueue(this.storage as SqliteTelemetryStorage);
    } else if (options.environment === 'production') {
      return QueueFactory.createProductionQueue(this.storage as SqliteTelemetryStorage);
    } else {
      return QueueFactory.createEventQueue(this.storage as SqliteTelemetryStorage, options.queue);
    }
  }

  /**
   * Initialize storage and queue systems
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.storage.initialize();
    this.initialized = true;
  }

  /**
   * Store a single event
   */
  async storeEvent(event: TelemetryEvent): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    await this.storage.store(event);
  }

  /**
   * Store multiple events
   */
  async storeEvents(events: TelemetryEvent[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    await this.storage.storeBatch(events);
  }

  /**
   * Queue event for transmission
   */
  async queueEvent(event: TelemetryEvent): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    await this.queue.enqueue(event);
  }

  /**
   * Queue multiple events for transmission
   */
  async queueEvents(events: TelemetryEvent[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    await this.queue.enqueueBatch(events);
  }

  /**
   * Get events ready for transmission
   */
  async getPendingEvents(batchSize?: number): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    return await this.queue.dequeue(batchSize || 50);
  }

  /**
   * Mark events as successfully transmitted
   */
  async markTransmitted(eventIds: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    await this.queue.acknowledge(eventIds);
  }

  /**
   * Mark events as failed and requeue
   */
  async markFailed(eventIds: string[], _error: string, retryAfter?: Date): Promise<void> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    await this.queue.requeue(eventIds, retryAfter);
  }

  /**
   * Clean up old data
   */
  async cleanup(retentionDays?: number): Promise<CleanupResult> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    return await this.storage.cleanup(retentionDays || 30);
  }

  /**
   * Get comprehensive statistics
   */
  async getStats(): Promise<{
    storage: StorageStats;
    queue: QueueStats;
    combined: {
      totalEvents: number;
      pendingTransmission: number;
      successfulTransmissions: number;
      failedTransmissions: number;
      storageEfficiency: number;
      queueHealth: string;
    };
  }> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    const storageStats = await this.storage.getStats();
    const queueStats = await this.queue.getQueueStats();

    const totalEvents = storageStats.totalEvents;
    const pendingTransmission = (storageStats.eventsByStatus.pending || 0) + 
                               (storageStats.eventsByStatus.queued || 0) +
                               (storageStats.eventsByStatus.failed || 0);
    const successfulTransmissions = storageStats.eventsByStatus.transmitted || 0;
    const failedTransmissions = storageStats.eventsByStatus.rejected || 0;

    const storageEfficiency = totalEvents > 0 ? 
      (totalEvents - failedTransmissions) / totalEvents * 100 : 100;

    const queueHealth = queueStats.health.errorRate < 0.1 ? 'healthy' :
                       queueStats.health.errorRate < 0.3 ? 'warning' : 'critical';

    return {
      storage: storageStats,
      queue: queueStats,
      combined: {
        totalEvents,
        pendingTransmission,
        successfulTransmissions,
        failedTransmissions,
        storageEfficiency,
        queueHealth
      }
    };
  }

  /**
   * Start automatic cleanup process
   */
  startAutoCleanup(intervalHours = 24, retentionDays = 30): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanup(retentionDays);
      } catch (error) {
        console.error('Automatic cleanup failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop automatic cleanup process
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Export data for backup or migration
   */
  async exportData(options: {
    format: 'json' | 'csv';
    includeTransmitted?: boolean;
    dateRange?: { start: Date; end: Date };
  }): Promise<string> {
    if (!this.initialized) {
      throw new Error('StorageManager not initialized');
    }

    const criteria = {
      transmissionStatus: options.includeTransmitted ? 
        undefined : ['pending', 'queued', 'failed', 'processing'],
      dateRange: options.dateRange
    };

    const events = await this.storage.query(criteria as any);

    if (options.format === 'json') {
      return JSON.stringify(events, null, 2);
    } else {
      // CSV export implementation
      const headers = 'id,sessionId,timestamp,eventType,category,privacyLevel,transmissionStatus\n';
      const rows = events.map(event => 
        `${event.id},${event.sessionId},${event.timestamp.toISOString()},${event.eventType},${event.category},${event.privacyLevel},pending`
      ).join('\n');
      return headers + rows;
    }
  }

  /**
   * Close storage and queue connections
   */
  async close(): Promise<void> {
    this.stopAutoCleanup();
    
    if (this.queue) {
      await this.queue.clear();
    }
    
    if (this.storage) {
      await this.storage.close();
    }

    this.initialized = false;
  }

  /**
   * Health check for storage system
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    checks: {
      storage: boolean;
      queue: boolean;
      diskSpace: boolean;
      performance: boolean;
    };
    details: Record<string, any>;
  }> {
    const checks = {
      storage: false,
      queue: false,
      diskSpace: false,
      performance: false
    };

    const details: Record<string, any> = {};

    try {
      // Check storage
      const stats = await this.storage.getStats();
      checks.storage = true;
      details.storage = { totalEvents: stats.totalEvents };

      // Check queue
      const queueStats = await this.queue.getQueueStats();
      checks.queue = queueStats.health.errorRate < 0.5;
      details.queue = { 
        backlogSize: queueStats.health.backlogSize,
        errorRate: queueStats.health.errorRate
      };

      // Basic performance check
      const startTime = Date.now();
      await this.storage.query({ limit: 1 });
      const queryTime = Date.now() - startTime;
      checks.performance = queryTime < 1000; // Under 1 second
      details.performance = { queryTime };

      // Disk space check (simplified)
      checks.diskSpace = stats.databaseSize < (100 * 1024 * 1024); // Under 100MB
      details.diskSpace = { 
        databaseSize: stats.databaseSize,
        maxSize: 100 * 1024 * 1024
      };

    } catch (error) {
      details.error = error instanceof Error ? error.message : 'Unknown error';
    }

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const status = healthyChecks === 4 ? 'healthy' : 
                  healthyChecks >= 3 ? 'warning' : 'critical';

    return {
      status,
      checks,
      details
    };
  }
}

/**
 * Factory for creating storage managers
 */
export class StorageManagerFactory {
  /**
   * Create development storage manager
   */
  static createDevelopment(): StorageManager {
    return new StorageManager({
      environment: 'development'
    });
  }

  /**
   * Create production storage manager
   */
  static createProduction(dataDirectory: string): StorageManager {
    return new StorageManager({
      environment: 'production',
      dataDirectory
    });
  }

  /**
   * Create test storage manager
   */
  static createTest(): StorageManager {
    return new StorageManager({
      environment: 'test',
      storage: {
        databasePath: ':memory:',
        retentionDays: 1
      }
    });
  }

  /**
   * Create custom storage manager
   */
  static createCustom(options: StorageManagerOptions): StorageManager {
    return new StorageManager(options);
  }
}