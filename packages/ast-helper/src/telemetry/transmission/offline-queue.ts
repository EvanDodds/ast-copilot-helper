/**
 * @file Disk Offline Queue
 * @description Disk-based offline queue for telemetry events
 */

import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import type {
  OfflineQueue,
  QueueInfo,
  OfflineQueueConfig
} from './types.js';
import type { StoredEvent } from '../storage/types.js';

/**
 * Disk-based offline queue implementation
 */
export class DiskOfflineQueue implements OfflineQueue {
  private config: OfflineQueueConfig;
  private queuePath: string;
  private initialized = false;
  private queue: StoredEvent[] = [];

  constructor(config: OfflineQueueConfig) {
    this.config = config;
    this.queuePath = config.storagePath || './telemetry-queue.json';
  }

  /**
   * Initialize the offline queue
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Ensure queue directory exists
      const queueDir = dirname(resolve(this.queuePath));
      await fs.mkdir(queueDir, { recursive: true });

      // Load existing queue if persistent
      if (this.config.persistent && this.config.storageType === 'disk') {
        await this.loadQueue();
      }

      // Cleanup if configured
      if (this.config.cleanupOnStartup) {
        await this.clear();
      }

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize offline queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add events to offline queue
   */
  async enqueue(events: StoredEvent[]): Promise<void> {
    if (!this.config.enabled || events.length === 0) {
      return;
    }

    // Check queue capacity
    const currentInfo = await this.getQueueInfo();
    const newEventsSize = this.calculateEventsSize(events);
    
    if (currentInfo.size + events.length > this.config.maxSize ||
        currentInfo.totalSize + newEventsSize > this.config.maxSizeBytes) {
      // Remove oldest events to make room
      await this.evictOldEvents(events.length, newEventsSize);
    }

    // Add events to queue
    this.queue.push(...events);

    // Persist to disk if configured
    if (this.config.storageType === 'disk' && this.config.persistent) {
      await this.saveQueue();
    }
  }

  /**
   * Get events from offline queue
   */
  async dequeue(batchSize: number): Promise<StoredEvent[]> {
    if (!this.config.enabled || this.queue.length === 0) {
      return [];
    }

    const actualBatchSize = Math.min(batchSize, this.queue.length);
    const events = this.queue.splice(0, actualBatchSize);

    // Persist changes if configured
    if (this.config.storageType === 'disk' && this.config.persistent) {
      await this.saveQueue();
    }

    return events;
  }

  /**
   * Check if offline queue is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.initialized;
  }

  /**
   * Get queue size and status
   */
  async getQueueInfo(): Promise<QueueInfo> {
    const size = this.queue.length;
    const totalSize = this.calculateEventsSize(this.queue);
    const oldestEvent = this.queue.length > 0 && this.queue[0] ? this.queue[0].timestamp : undefined;
    
    return {
      size,
      totalSize,
      oldestEvent,
      utilization: size / this.config.maxSize,
      atCapacity: size >= this.config.maxSize || totalSize >= this.config.maxSizeBytes
    };
  }

  /**
   * Clear offline queue
   */
  async clear(): Promise<void> {
    this.queue = [];
    
    if (this.config.storageType === 'disk' && this.config.persistent) {
      try {
        await fs.unlink(resolve(this.queuePath));
      } catch (error) {
        // File might not exist, that's okay
      }
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Load queue from disk
   */
  private async loadQueue(): Promise<void> {
    try {
      const queueFile = resolve(this.queuePath);
      const data = await fs.readFile(queueFile, 'utf8');
      const parsed = JSON.parse(data);
      
      // Validate and restore queue
      if (Array.isArray(parsed.events)) {
        this.queue = parsed.events.map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp),
          storedAt: new Date(event.storedAt),
          lastTransmissionAttempt: event.lastTransmissionAttempt ? 
            new Date(event.lastTransmissionAttempt) : undefined,
          nextRetryAt: event.nextRetryAt ? new Date(event.nextRetryAt) : undefined
        }));
      }
    } catch (error) {
      // Queue file might not exist or be corrupted, start fresh
      this.queue = [];
    }
  }

  /**
   * Save queue to disk
   */
  private async saveQueue(): Promise<void> {
    try {
      const queueData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        events: this.queue,
        metadata: {
          size: this.queue.length,
          totalSize: this.calculateEventsSize(this.queue)
        }
      };

      const queueFile = resolve(this.queuePath);
      await fs.writeFile(queueFile, JSON.stringify(queueData, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Calculate total size of events in bytes
   */
  private calculateEventsSize(events: StoredEvent[]): number {
    return events.reduce((total, event) => total + event.eventSize, 0);
  }

  /**
   * Evict oldest events to make room for new ones
   */
  private async evictOldEvents(newEventsCount: number, newEventsSize: number): Promise<void> {
    const currentInfo = await this.getQueueInfo();
    
    // Calculate how many events to remove
    let eventsToRemove = 0;
    let sizeToRemove = 0;
    
    // Remove events until we have enough space
    while (eventsToRemove < this.queue.length &&
           (currentInfo.size - eventsToRemove + newEventsCount > this.config.maxSize ||
            currentInfo.totalSize - sizeToRemove + newEventsSize > this.config.maxSizeBytes)) {
      
      const eventToRemove = this.queue[eventsToRemove];
      if (eventToRemove) {
        sizeToRemove += eventToRemove.eventSize;
      }
      eventsToRemove++;
    }

    if (eventsToRemove > 0) {
      this.queue.splice(0, eventsToRemove);
      
      // Persist changes if configured
      if (this.config.storageType === 'disk' && this.config.persistent) {
        await this.saveQueue();
      }
    }
  }
}