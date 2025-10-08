/**
 * @fileoverview L1 Memory Cache Implementation
 *
 * Fast in-memory LRU cache for hot queries with <100ms access time target.
 * First level in the multi-level cache architecture.
 */

import { createLogger } from "../../../../ast-helper/src/logging/index.js";

import type {
  CacheEntry,
  CacheLevel,
  LevelCacheConfig,
  LevelCacheStats,
  CacheOperationResult,
} from "./types.js";

/**
 * L1 Memory Cache - Fast LRU cache in memory
 *
 * Target performance: <100ms access time
 * Typical usage: Hot queries, frequently accessed data
 */
export class MemoryCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: LevelCacheConfig;
  private logger = createLogger({ operation: "memory-cache-l1" });

  // Statistics
  private stats: LevelCacheStats = {
    level: "L1",
    hits: 0,
    misses: 0,
    hitRate: 0,
    entryCount: 0,
    sizeBytes: 0,
    evictions: 0,
    avgAccessTime: 0,
  };

  private accessTimes: number[] = [];
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: LevelCacheConfig) {
    this.config = config;

    if (this.config.enabled) {
      // Start periodic cleanup
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, 60 * 1000); // Every minute

      this.logger.debug("L1 memory cache initialized", {
        maxSize: config.maxSize,
        defaultTTL: config.defaultTTL,
      });
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<CacheOperationResult<T>> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: "L1 cache is disabled",
      };
    }

    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      this.recordAccessTime(Date.now() - startTime);

      return {
        success: false,
        latencyMs: Date.now() - startTime,
      };
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      this.recordAccessTime(Date.now() - startTime);

      this.logger.debug("L1 cache expired entry", { key });

      return {
        success: false,
        latencyMs: Date.now() - startTime,
      };
    }

    // Update access information
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    this.updateHitRate();
    this.recordAccessTime(Date.now() - startTime);

    this.logger.debug("L1 cache hit", {
      key,
      accessCount: entry.accessCount,
      latencyMs: Date.now() - startTime,
    });

    return {
      success: true,
      value: entry.value,
      level: "L1",
      latencyMs: Date.now() - startTime,
    };
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

    if (!this.config.enabled) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: "L1 cache is disabled",
      };
    }

    const now = Date.now();
    const size = this.estimateSize(value);

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict least recently used entries if at capacity
    while (this.cache.size >= this.config.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
        this.logger.debug("L1 cache eviction", { key: firstKey });
      } else {
        break;
      }
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      ttl: ttl || this.config.defaultTTL,
      accessCount: 0,
      lastAccessed: now,
      size,
      level: "L1",
    };

    this.cache.set(key, entry);
    this.stats.entryCount = this.cache.size;
    this.updateSizeBytes();

    this.logger.debug("L1 cache set", {
      key,
      size,
      ttl: entry.ttl,
      latencyMs: Date.now() - startTime,
    });

    return {
      success: true,
      level: "L1",
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.entryCount = this.cache.size;
      this.updateSizeBytes();
      this.logger.debug("L1 cache delete", { key });
    }

    return deleted;
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get all keys in cache
   */
  async keys(): Promise<string[]> {
    if (!this.config.enabled) {
      return [];
    }

    return Array.from(this.cache.keys());
  }

  /**
   * Clear cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.entryCount = 0;
    this.stats.sizeBytes = 0;
    this.logger.info("L1 cache cleared");
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    if (!this.config.enabled) {
      return;
    }

    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.stats.entryCount = this.cache.size;
      this.updateSizeBytes();
      this.logger.debug("L1 cache cleanup", {
        expiredEntries: keysToDelete.length,
      });
    }
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16 encoding
    } catch {
      return 0;
    }
  }

  /**
   * Update total size in bytes
   */
  private updateSizeBytes(): void {
    let total = 0;

    for (const [key, entry] of this.cache.entries()) {
      total += key.length * 2; // Key size
      total += entry.size; // Value size
      total += 80; // Entry overhead
    }

    this.stats.sizeBytes = total;
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

    // Keep only recent access times
    if (this.accessTimes.length > 1000) {
      this.accessTimes = this.accessTimes.slice(-1000);
    }

    // Calculate average
    const sum = this.accessTimes.reduce((a, b) => a + b, 0);
    this.stats.avgAccessTime = sum / this.accessTimes.length;
  }

  /**
   * Get cache statistics
   */
  getStats(): LevelCacheStats {
    this.stats.entryCount = this.cache.size;
    this.updateSizeBytes();
    return { ...this.stats };
  }

  /**
   * Get cache level identifier
   */
  getLevel(): CacheLevel {
    return "L1";
  }

  /**
   * Shutdown cache
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cache.clear();
    this.logger.debug("L1 cache shutdown");
  }
}
