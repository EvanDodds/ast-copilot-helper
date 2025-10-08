/**
 * @fileoverview L3 Database Cache Implementation
 *
 * SQLite-based cache for historical queries with <2s access time target.
 * Third level in the multi-level cache architecture.
 */

import Database from "better-sqlite3";

import { createLogger } from "../../../../ast-helper/src/logging/index.js";

import type {
  CacheLevel,
  LevelCacheConfig,
  LevelCacheStats,
  CacheOperationResult,
  CacheQueryLog,
} from "./types.js";

/**
 * L3 Database Cache - SQL

ite-based persistent cache
 *
 * Target performance: <2s access time
 * Typical usage: Historical queries, long-term persistence, analytics
 */
export class DatabaseCache<T = unknown> {
  private db?: Database.Database;
  private config: LevelCacheConfig;
  private logger = createLogger({ operation: "database-cache-l3" });

  // Statistics
  private stats: LevelCacheStats = {
    level: "L3",
    hits: 0,
    misses: 0,
    hitRate: 0,
    entryCount: 0,
    sizeBytes: 0,
    evictions: 0,
    avgAccessTime: 0,
  };

  private accessTimes: number[] = [];
  private dbPath: string;

  constructor(config: LevelCacheConfig, dbPath: string) {
    this.config = config;
    this.dbPath = dbPath;

    if (this.config.enabled) {
      this.initialize();
    }
  }

  /**
   * Initialize database cache
   */
  private initialize(): void {
    try {
      this.db = new Database(this.dbPath);

      // Create cache table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS query_cache (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          ttl INTEGER NOT NULL,
          access_count INTEGER DEFAULT 0,
          last_accessed INTEGER NOT NULL,
          size INTEGER NOT NULL,
          version TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_cache_timestamp ON query_cache(timestamp);
        CREATE INDEX IF NOT EXISTS idx_cache_ttl ON query_cache(ttl);

        CREATE TABLE IF NOT EXISTS query_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query_text TEXT NOT NULL,
          query_hash TEXT NOT NULL,
          options TEXT NOT NULL,
          result_count INTEGER,
          execution_time_ms INTEGER,
          cache_hit BOOLEAN,
          cache_level TEXT,
          timestamp INTEGER NOT NULL,
          index_version TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_query_hash ON query_log(query_hash);
        CREATE INDEX IF NOT EXISTS idx_query_timestamp ON query_log(timestamp);
      `);

      // Update statistics
      this.updateStats();

      this.logger.debug("L3 database cache initialized", {
        dbPath: this.dbPath,
        entryCount: this.stats.entryCount,
      });
    } catch (error) {
      this.logger.error("Failed to initialize L3 database cache", { error });
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<CacheOperationResult<T>> {
    const startTime = Date.now();

    if (!this.config.enabled || !this.db) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: "L3 cache is disabled",
      };
    }

    try {
      const row = this.db
        .prepare(
          `
        SELECT value, timestamp, ttl, access_count, last_accessed, size
        FROM query_cache
        WHERE key = ?
      `,
        )
        .get(key) as
        | {
            value: string;
            timestamp: number;
            ttl: number;
            access_count: number;
            last_accessed: number;
            size: number;
          }
        | undefined;

      if (!row) {
        this.stats.misses++;
        this.updateHitRate();
        this.recordAccessTime(Date.now() - startTime);

        return {
          success: false,
          latencyMs: Date.now() - startTime,
        };
      }

      // Check if entry has expired
      if (Date.now() - row.timestamp > row.ttl) {
        await this.delete(key);
        this.stats.misses++;
        this.updateHitRate();
        this.recordAccessTime(Date.now() - startTime);

        this.logger.debug("L3 cache expired entry", { key });

        return {
          success: false,
          latencyMs: Date.now() - startTime,
        };
      }

      // Update access information
      this.db
        .prepare(
          `
        UPDATE query_cache
        SET access_count = access_count + 1, last_accessed = ?
        WHERE key = ?
      `,
        )
        .run(Date.now(), key);

      const value: T = JSON.parse(row.value);

      this.stats.hits++;
      this.updateHitRate();
      this.recordAccessTime(Date.now() - startTime);

      this.logger.debug("L3 cache hit", {
        key,
        accessCount: row.access_count + 1,
        latencyMs: Date.now() - startTime,
      });

      return {
        success: true,
        value,
        level: "L3",
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Failed to read L3 cache entry", { key, error });
      this.stats.misses++;
      this.updateHitRate();
      this.recordAccessTime(Date.now() - startTime);

      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: T,
    ttl?: number,
  ): Promise<CacheOperationResult<T>> {
    const startTime = Date.now();

    if (!this.config.enabled || !this.db) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: "L3 cache is disabled",
      };
    }

    try {
      const now = Date.now();
      const valueStr = JSON.stringify(value);
      const size = valueStr.length * 2;
      const ttlMs = ttl || this.config.defaultTTL;

      // Evict entries if at capacity
      const count = this.db
        .prepare("SELECT COUNT(*) as count FROM query_cache")
        .get() as { count: number };

      if (count.count >= this.config.maxSize) {
        this.evictLRU();
      }

      // Insert or replace entry
      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO query_cache
        (key, value, timestamp, ttl, access_count, last_accessed, size)
        VALUES (?, ?, ?, ?, 0, ?, ?)
      `,
        )
        .run(key, valueStr, now, ttlMs, now, size);

      this.updateStats();

      this.logger.debug("L3 cache set", {
        key,
        size,
        ttl: ttlMs,
        latencyMs: Date.now() - startTime,
      });

      return {
        success: true,
        level: "L3",
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Failed to write L3 cache entry", { key, error });

      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.config.enabled || !this.db) {
      return false;
    }

    try {
      const result = this.db
        .prepare("DELETE FROM query_cache WHERE key = ?")
        .run(key);

      if (result.changes > 0) {
        this.updateStats();
        this.logger.debug("L3 cache delete", { key });
        return true;
      }

      return false;
    } catch (error) {
      this.logger.warn("Failed to delete L3 cache entry", { key, error });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    if (!this.config.enabled || !this.db) {
      return false;
    }

    try {
      const row = this.db
        .prepare("SELECT 1 FROM query_cache WHERE key = ?")
        .get(key);

      return !!row;
    } catch {
      return false;
    }
  }

  /**
   * Get all keys in cache
   */
  async keys(): Promise<string[]> {
    if (!this.config.enabled || !this.db) {
      return [];
    }

    try {
      const rows = this.db.prepare("SELECT key FROM query_cache").all() as {
        key: string;
      }[];

      return rows.map((row) => row.key);
    } catch {
      return [];
    }
  }

  /**
   * Clear cache
   */
  async clear(): Promise<void> {
    if (!this.config.enabled || !this.db) {
      return;
    }

    try {
      this.db.exec("DELETE FROM query_cache");
      this.updateStats();
      this.logger.info("L3 cache cleared");
    } catch (error) {
      this.logger.error("Failed to clear L3 cache", { error });
    }
  }

  /**
   * Log query execution
   */
  async logQuery(log: Omit<CacheQueryLog, "id">): Promise<void> {
    if (!this.config.enabled || !this.db) {
      return;
    }

    try {
      this.db
        .prepare(
          `
        INSERT INTO query_log
        (query_text, query_hash, options, result_count, execution_time_ms,
         cache_hit, cache_level, timestamp, index_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          log.queryText,
          log.queryHash,
          log.options,
          log.resultCount,
          log.executionTimeMs,
          log.cacheHit ? 1 : 0,
          log.cacheLevel || null,
          log.timestamp,
          log.indexVersion,
        );
    } catch (error) {
      this.logger.warn("Failed to log query", { error });
    }
  }

  /**
   * Get top queries by frequency
   */
  async getTopQueries(
    limit: number,
  ): Promise<Array<{ queryHash: string; count: number }>> {
    if (!this.config.enabled || !this.db) {
      return [];
    }

    try {
      const rows = this.db
        .prepare(
          `
        SELECT query_hash, COUNT(*) as count
        FROM query_log
        GROUP BY query_hash
        ORDER BY count DESC
        LIMIT ?
      `,
        )
        .all(limit) as Array<{ query_hash: string; count: number }>;

      return rows.map((row) => ({
        queryHash: row.query_hash,
        count: row.count,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (!this.db) {
      return;
    }

    try {
      this.db
        .prepare(
          `
        DELETE FROM query_cache
        WHERE key = (
          SELECT key FROM query_cache
          ORDER BY last_accessed ASC
          LIMIT 1
        )
      `,
        )
        .run();

      this.stats.evictions++;
      this.logger.debug("L3 cache eviction");
    } catch (error) {
      this.logger.warn("Failed to evict L3 cache entry", { error });
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    if (!this.db) {
      return;
    }

    try {
      const row = this.db
        .prepare(
          `
        SELECT COUNT(*) as count, SUM(size) as total_size
        FROM query_cache
      `,
        )
        .get() as { count: number; total_size: number | null };

      this.stats.entryCount = row.count;
      this.stats.sizeBytes = row.total_size || 0;
    } catch {
      // Ignore errors
    }
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Record access time for averaging
   */
  private recordAccessTime(timeMs: number): void {
    this.accessTimes.push(timeMs);

    if (this.accessTimes.length > 1000) {
      this.accessTimes = this.accessTimes.slice(-1000);
    }

    const sum = this.accessTimes.reduce((a, b) => a + b, 0);
    this.stats.avgAccessTime = sum / this.accessTimes.length;
  }

  /**
   * Get cache statistics
   */
  getStats(): LevelCacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get cache level identifier
   */
  getLevel(): CacheLevel {
    return "L3";
  }

  /**
   * Shutdown cache
   */
  async shutdown(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.logger.debug("L3 cache shutdown");
    }
  }
}
