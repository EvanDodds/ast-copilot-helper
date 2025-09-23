/**
 * @file SQLite Storage Implementation
 * @description SQLite-based implementation of telemetry data storage
 */

import { Database } from 'better-sqlite3';
import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import {
  TelemetryStorage,
  StoredEvent,
  QueryCriteria,
  StorageStats,
  CleanupResult,
  StorageConfig,
  TransmissionStatus,
  DEFAULT_STORAGE_CONFIG
} from './types.js';
import { TelemetryEvent } from '../collection/types.js';
import { PrivacyLevel } from '../types.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * SQLite-based telemetry storage implementation
 */
export class SqliteTelemetryStorage implements TelemetryStorage {
  private db?: Database;
  private config: StorageConfig;
  private initialized = false;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config?: Partial<StorageConfig>) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };
  }

  /**
   * Initialize the SQLite database
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Ensure database directory exists
      const dbPath = resolve(this.config.databasePath);
      const dbDir = dirname(dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // Import better-sqlite3 dynamically
      const Database = (await import('better-sqlite3')).default;
      
      // Create database connection
      this.db = new Database(dbPath);
      
      // Configure database
      this.setupDatabase();
      
      // Create tables
      this.createTables();
      
      // Setup automatic cleanup
      this.setupAutoCleanup();
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize SQLite storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup database configuration
   */
  private setupDatabase(): void {
    if (!this.db) return;

    // Enable WAL mode for better concurrency
    if (this.config.enableWalMode) {
      this.db.pragma('journal_mode = WAL');
    }

    // Optimize for our use case
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = memory');
    this.db.pragma('mmap_size = 268435456'); // 256MB
  }

  /**
   * Create database tables
   */
  private createTables(): void {
    if (!this.db) return;

    // Main events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS telemetry_events (
        storage_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        session_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        stored_at TEXT NOT NULL DEFAULT (datetime('now')),
        user_id TEXT,
        event_type TEXT NOT NULL,
        category TEXT NOT NULL,
        privacy_level TEXT NOT NULL,
        transmission_status TEXT NOT NULL DEFAULT 'pending',
        transmission_attempts INTEGER NOT NULL DEFAULT 0,
        last_transmission_attempt TEXT,
        next_retry_at TEXT,
        transmission_error TEXT,
        event_size INTEGER NOT NULL,
        compressed BOOLEAN NOT NULL DEFAULT FALSE,
        event_data TEXT NOT NULL,
        metadata TEXT
      )
    `);

    // Indexes for common queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_session_id ON telemetry_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON telemetry_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_type ON telemetry_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_category ON telemetry_events(category);
      CREATE INDEX IF NOT EXISTS idx_events_status ON telemetry_events(transmission_status);
      CREATE INDEX IF NOT EXISTS idx_events_privacy ON telemetry_events(privacy_level);
      CREATE INDEX IF NOT EXISTS idx_events_stored_at ON telemetry_events(stored_at);
    `);

    // Queue table for transmission management
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transmission_queue (
        queue_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        scheduled_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        processing_started_at TEXT,
        FOREIGN KEY (event_id) REFERENCES telemetry_events(event_id)
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_queue_priority ON transmission_queue(priority DESC, scheduled_at ASC);
      CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON transmission_queue(scheduled_at);
    `);

    // Statistics table for tracking metadata
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS storage_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  /**
   * Setup automatic cleanup
   */
  private setupAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    const intervalMs = this.config.cleanupInterval * 60 * 60 * 1000; // Convert hours to ms
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanup(this.config.retentionDays);
      } catch (error) {
        console.error('Automatic cleanup failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Store a single telemetry event
   */
  async store(event: TelemetryEvent): Promise<void> {
    if (!this.initialized || !this.db) {
      throw new Error('Storage not initialized');
    }

    const storedEvent = await this.prepareEventForStorage(event);
    
    const stmt = this.db.prepare(`
      INSERT INTO telemetry_events (
        event_id, session_id, timestamp, user_id, event_type, category,
        privacy_level, event_size, compressed, event_data, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      storedEvent.id,
      storedEvent.sessionId,
      storedEvent.timestamp.toISOString(),
      storedEvent.userId || null,
      storedEvent.eventType,
      storedEvent.category,
      storedEvent.privacyLevel,
      storedEvent.eventSize,
      storedEvent.compressed,
      storedEvent.event_data,
      storedEvent.serialized_metadata
    );
  }

  /**
   * Store multiple events in a batch
   */
  async storeBatch(events: TelemetryEvent[]): Promise<void> {
    if (!this.initialized || !this.db) {
      throw new Error('Storage not initialized');
    }

    if (events.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO telemetry_events (
        event_id, session_id, timestamp, user_id, event_type, category,
        privacy_level, event_size, compressed, event_data, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((events: any[]) => {
      for (const event of events) {
        stmt.run(...event);
      }
    });

    const preparedEvents = await Promise.all(
      events.map(async (event) => {
        const stored = await this.prepareEventForStorage(event);
        return [
          stored.id,
          stored.sessionId,
          stored.timestamp.toISOString(),
          stored.userId || null,
          stored.eventType,
          stored.category,
          stored.privacyLevel,
          stored.eventSize,
          stored.compressed,
          stored.event_data,
          stored.serialized_metadata
        ];
      })
    );

    transaction(preparedEvents);
  }

  /**
   * Prepare event for storage (compression, serialization)
   */
  private async prepareEventForStorage(event: TelemetryEvent): Promise<any> {
    const eventData = JSON.stringify({
      data: (event as any).data || {},
      context: (event as any).context || {}
    });

    const metadata = JSON.stringify(event.metadata);
    let finalEventData = eventData;
    let compressed = false;
    let eventSize = Buffer.byteLength(eventData, 'utf8');

    // Compress large events if enabled
    if (this.config.enableCompression && eventSize > this.config.compressionThreshold) {
      try {
        const compressedData = await gzipAsync(Buffer.from(eventData, 'utf8'));
        finalEventData = compressedData.toString('base64');
        compressed = true;
        eventSize = compressedData.length;
      } catch (error) {
        // Fall back to uncompressed if compression fails
        console.warn('Event compression failed, storing uncompressed:', error);
      }
    }

    return {
      ...event,
      event_data: finalEventData,
      serialized_metadata: metadata,
      eventSize,
      compressed
    };
  }

  /**
   * Retrieve events based on criteria
   */
  async query(criteria: QueryCriteria): Promise<TelemetryEvent[]> {
    if (!this.initialized || !this.db) {
      throw new Error('Storage not initialized');
    }

    const { query, params } = this.buildQuery(criteria);
    const rows = this.db.prepare(query).all(...params);

    return Promise.all(
      rows.map(row => this.deserializeEvent(row))
    );
  }

  /**
   * Build SQL query from criteria
   */
  private buildQuery(criteria: QueryCriteria): { query: string; params: any[] } {
    let query = 'SELECT * FROM telemetry_events';
    const conditions: string[] = [];
    const params: any[] = [];

    if (criteria.eventIds?.length) {
      conditions.push(`event_id IN (${criteria.eventIds.map(() => '?').join(', ')})`);
      params.push(...criteria.eventIds);
    }

    if (criteria.sessionIds?.length) {
      conditions.push(`session_id IN (${criteria.sessionIds.map(() => '?').join(', ')})`);
      params.push(...criteria.sessionIds);
    }

    if (criteria.eventTypes?.length) {
      conditions.push(`event_type IN (${criteria.eventTypes.map(() => '?').join(', ')})`);
      params.push(...criteria.eventTypes);
    }

    if (criteria.categories?.length) {
      conditions.push(`category IN (${criteria.categories.map(() => '?').join(', ')})`);
      params.push(...criteria.categories);
    }

    if (criteria.privacyLevels?.length) {
      conditions.push(`privacy_level IN (${criteria.privacyLevels.map(() => '?').join(', ')})`);
      params.push(...criteria.privacyLevels);
    }

    if (criteria.transmissionStatus?.length) {
      conditions.push(`transmission_status IN (${criteria.transmissionStatus.map(() => '?').join(', ')})`);
      params.push(...criteria.transmissionStatus);
    }

    if (criteria.dateRange) {
      conditions.push('timestamp BETWEEN ? AND ?');
      params.push(criteria.dateRange.start.toISOString(), criteria.dateRange.end.toISOString());
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Add sorting
    if (criteria.sortBy) {
      const column = criteria.sortBy === 'storedAt' ? 'stored_at' : criteria.sortBy;
      query += ` ORDER BY ${column} ${criteria.sortOrder || 'desc'}`;
    }

    // Add pagination
    if (criteria.limit) {
      query += ` LIMIT ?`;
      params.push(criteria.limit);
    }

    if (criteria.offset) {
      query += ` OFFSET ?`;
      params.push(criteria.offset);
    }

    return { query, params };
  }

  /**
   * Deserialize stored event
   */
  private async deserializeEvent(row: any): Promise<TelemetryEvent> {
    let eventData = row.event_data;
    
    // Decompress if needed
    if (row.compressed) {
      try {
        const compressedBuffer = Buffer.from(eventData, 'base64');
        const decompressed = await gunzipAsync(compressedBuffer);
        eventData = decompressed.toString('utf8');
      } catch (error) {
        throw new Error(`Failed to decompress event ${row.event_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const parsedEventData = JSON.parse(eventData);
    const metadata = JSON.parse(row.metadata || '{}');

    return {
      id: row.event_id,
      sessionId: row.session_id,
      timestamp: new Date(row.timestamp),
      userId: row.user_id || undefined,
      eventType: row.event_type,
      category: row.category,
      privacyLevel: row.privacy_level as PrivacyLevel,
      metadata,
      ...parsedEventData
    };
  }

  /**
   * Get events ready for transmission
   */
  async getPendingEvents(batchSize = this.config.batchSize): Promise<StoredEvent[]> {
    if (!this.initialized || !this.db) {
      throw new Error('Storage not initialized');
    }

    const query = `
      SELECT * FROM telemetry_events 
      WHERE transmission_status IN ('pending', 'failed') 
        AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
        AND transmission_attempts < 3
      ORDER BY timestamp ASC
      LIMIT ?
    `;

    const rows = this.db.prepare(query).all(batchSize);
    
    return Promise.all(
      rows.map(async (row: any) => {
        const event = await this.deserializeEvent(row);
        return {
          ...event,
          storageId: row.storage_id,
          storedAt: new Date(row.stored_at),
          transmissionStatus: row.transmission_status as TransmissionStatus,
          transmissionAttempts: row.transmission_attempts,
          lastTransmissionAttempt: row.last_transmission_attempt ? new Date(row.last_transmission_attempt) : undefined,
          nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : undefined,
          transmissionError: row.transmission_error || undefined,
          eventSize: row.event_size,
          compressed: Boolean(row.compressed)
        } as StoredEvent;
      })
    );
  }

  /**
   * Mark events as successfully transmitted
   */
  async markTransmitted(eventIds: string[]): Promise<void> {
    if (!this.initialized || !this.db || eventIds.length === 0) {
      return;
    }

    const stmt = this.db.prepare(`
      UPDATE telemetry_events 
      SET transmission_status = 'transmitted',
          last_transmission_attempt = datetime('now')
      WHERE event_id = ?
    `);

    const transaction = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        stmt.run(id);
      }
    });

    transaction(eventIds);
  }

  /**
   * Mark events as failed transmission
   */
  async markFailed(eventIds: string[], error: string): Promise<void> {
    if (!this.initialized || !this.db || eventIds.length === 0) {
      return;
    }

    const stmt = this.db.prepare(`
      UPDATE telemetry_events 
      SET transmission_status = 'failed',
          transmission_attempts = transmission_attempts + 1,
          last_transmission_attempt = datetime('now'),
          next_retry_at = datetime('now', '+' || (transmission_attempts * 5) || ' minutes'),
          transmission_error = ?
      WHERE event_id = ?
    `);

    const transaction = this.db.transaction((ids: string[], errorMsg: string) => {
      for (const id of ids) {
        stmt.run(errorMsg, id);
      }
    });

    transaction(eventIds, error);
  }

  /**
   * Clean up old data based on retention policy
   */
  async cleanup(retentionDays: number): Promise<CleanupResult> {
    if (!this.initialized || !this.db) {
      throw new Error('Storage not initialized');
    }

    const startTime = Date.now();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Get stats before cleanup
    const beforeStats = await this.getCleanupStats(cutoffDate);

    // Delete old events
    const deleteStmt = this.db.prepare(`
      DELETE FROM telemetry_events 
      WHERE timestamp < ? 
        OR (transmission_status = 'transmitted' AND stored_at < ?)
    `);

    const result = deleteStmt.run(
      cutoffDate.toISOString(),
      cutoffDate.toISOString()
    );

    // Clean up orphaned queue entries
    this.db.prepare(`
      DELETE FROM transmission_queue 
      WHERE event_id NOT IN (SELECT event_id FROM telemetry_events)
    `).run();

    // Update metadata
    this.db.prepare(`
      INSERT OR REPLACE INTO storage_metadata (key, value) 
      VALUES ('last_cleanup', ?)
    `).run(new Date().toISOString());

    // Get stats after cleanup
    const afterStats = await this.getStats();

    const cleanupDuration = Date.now() - startTime;

    return {
      eventsRemoved: result.changes,
      spaceFreed: beforeStats.totalSize - afterStats.totalSize,
      cleanupDuration,
      cleanupTimestamp: new Date(),
      removedByStatus: beforeStats.removedByStatus,
      removedByAge: beforeStats.removedByAge
    };
  }

  /**
   * Get cleanup statistics
   */
  private async getCleanupStats(cutoffDate: Date): Promise<any> {
    if (!this.db) return { removedByStatus: {}, removedByAge: {} };

    const statusQuery = this.db.prepare(`
      SELECT transmission_status, COUNT(*) as count 
      FROM telemetry_events 
      WHERE timestamp < ? OR (transmission_status = 'transmitted' AND stored_at < ?)
      GROUP BY transmission_status
    `);

    const statusResults = statusQuery.all(cutoffDate.toISOString(), cutoffDate.toISOString()) as any[];

    const removedByStatus: Partial<Record<TransmissionStatus, number>> = {};
    for (const row of statusResults) {
      removedByStatus[row.transmission_status as TransmissionStatus] = row.count;
    }

    return {
      removedByStatus: removedByStatus as Record<TransmissionStatus, number>,
      removedByAge: {} // Could implement age-based tracking
    };
  }

  /**
   * Clear the transmission queue
   */
  async clearQueue(): Promise<void> {
    if (!this.initialized || !this.db) {
      throw new Error('Storage not initialized');
    }

    try {
      // Clear all queued events
      const clearStmt = this.db.prepare('DELETE FROM transmission_queue');
      const result = clearStmt.run();
      
      console.log(`✅ Cleared ${result.changes} queued events from transmission queue`);

      // Update metadata
      const updateMetaStmt = this.db.prepare(
        'INSERT OR REPLACE INTO storage_metadata (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))'
      );
      updateMetaStmt.run('last_queue_clear', new Date().toISOString());
    } catch (error) {
      throw new Error(`Failed to clear queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    if (!this.initialized || !this.db) {
      throw new Error('Storage not initialized');
    }

    // Total events
    const totalEventsResult = this.db.prepare('SELECT COUNT(*) as count FROM telemetry_events').get() as any;
    const totalEvents = totalEventsResult?.count || 0;

    // Events by status
    const statusResults = this.db.prepare(`
      SELECT transmission_status, COUNT(*) as count 
      FROM telemetry_events 
      GROUP BY transmission_status
    `).all() as any[];
    
    const eventsByStatus: Partial<Record<TransmissionStatus, number>> = {};
    for (const row of statusResults) {
      eventsByStatus[row.transmission_status as TransmissionStatus] = row.count;
    }

    // Events by type
    const typeResults = this.db.prepare(`
      SELECT event_type, COUNT(*) as count 
      FROM telemetry_events 
      GROUP BY event_type
    `).all() as any[];
    
    const eventsByType: Record<string, number> = {};
    for (const row of typeResults) {
      eventsByType[row.event_type] = row.count;
    }

    // Events by privacy level
    const privacyResults = this.db.prepare(`
      SELECT privacy_level, COUNT(*) as count 
      FROM telemetry_events 
      GROUP BY privacy_level
    `).all() as any[];
    
    const eventsByPrivacyLevel: Partial<Record<PrivacyLevel, number>> = {};
    for (const row of privacyResults) {
      eventsByPrivacyLevel[row.privacy_level as PrivacyLevel] = row.count;
    }

    // Size statistics
    const sizeResults = this.db.prepare(`
      SELECT 
        COALESCE(SUM(event_size), 0) as totalSize,
        COALESCE(AVG(event_size), 0) as averageSize,
        MIN(timestamp) as oldestEvent,
        MAX(timestamp) as newestEvent
      FROM telemetry_events
    `).get() as any;

    // Database file size
    const dbPath = resolve(this.config.databasePath);
    let databaseSize = 0;
    try {
      const stats = await fs.stat(dbPath);
      databaseSize = stats.size;
    } catch (error) {
      // File might not exist yet
    }

    // Last cleanup
    const lastCleanupResult = this.db.prepare(`
      SELECT value FROM storage_metadata WHERE key = 'last_cleanup'
    `).get() as any;

    return {
      totalEvents,
      eventsByStatus: eventsByStatus as Record<TransmissionStatus, number>,
      eventsByType,
      eventsByPrivacyLevel: eventsByPrivacyLevel as Record<PrivacyLevel, number>,
      totalSize: sizeResults?.totalSize || 0,
      averageEventSize: sizeResults?.averageSize || 0,
      oldestEvent: sizeResults?.oldestEvent ? new Date(sizeResults.oldestEvent) : undefined,
      newestEvent: sizeResults?.newestEvent ? new Date(sizeResults.newestEvent) : undefined,
      databaseSize,
      lastCleanup: lastCleanupResult ? new Date(lastCleanupResult.value) : undefined,
      collectionStats: {
        eventsCollected: totalEvents,
        eventsDropped: 0, // Would need to track this
        eventsSent: eventsByStatus.transmitted || 0,
        eventsRetried: 0, // Would need to track retry counts
        lastCollectionTime: sizeResults?.newestEvent ? new Date(sizeResults.newestEvent) : new Date(),
        lastTransmissionTime: sizeResults?.newestEvent ? new Date(sizeResults.newestEvent) : new Date(),
        bufferSize: 0, // Not applicable for storage stats
        bufferUtilization: 0 // Not applicable for storage stats
      }
    };
  }

  /**
   * Close storage connection
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    if (this.db) {
      this.db.close();
      this.db = undefined;
    }

    this.initialized = false;
  }
}

/**
 * Storage factory for creating configured instances
 */
export class StorageFactory {
  /**
   * Create SQLite storage with custom configuration
   */
  static createSqliteStorage(config?: Partial<StorageConfig>): SqliteTelemetryStorage {
    return new SqliteTelemetryStorage(config);
  }

  /**
   * Create storage for development (in-memory)
   */
  static createDevelopmentStorage(): SqliteTelemetryStorage {
    return new SqliteTelemetryStorage({
      databasePath: ':memory:',
      retentionDays: 1,
      enableCompression: false
    });
  }

  /**
   * Create storage for production
   */
  static createProductionStorage(dataDir: string): SqliteTelemetryStorage {
    return new SqliteTelemetryStorage({
      databasePath: resolve(dataDir, 'telemetry.db'),
      maxDatabaseSize: 100 * 1024 * 1024, // 100MB
      retentionDays: 90,
      enableCompression: true,
      enableWalMode: true
    });
  }
}