/**
 * @fileoverview Multi-Level Cache Manager
 *
 * Orchestrates L1 (memory), L2 (disk), and L3 (database) caches with intelligent
 * promotion and invalidation strategies for query result caching.
 */

import { createHash } from "node:crypto";
import { join } from "node:path";

import { createLogger } from "../../../../ast-helper/src/logging/index.js";

import { MemoryCache } from "./memory-cache.js";
import { DiskCache } from "./disk-cache.js";
import { DatabaseCache } from "./database-cache.js";

import type {
  MultiLevelCacheConfig,
  CacheStats,
  CacheOperationResult,
  CacheQueryLog,
  CacheInvalidationEvent,
} from "./types.js";

/**
 * Multi-level cache manager with L1/L2/L3 architecture
 *
 * Cache hierarchy:
 * - L1 (Memory): Hot queries, <100ms access
 * - L2 (Disk): Recent queries, <500ms access
 * - L3 (Database): Historical queries, <2s access
 *
 * Features:
 * - Automatic cache promotion (L3->L2->L1 on hits)
 * - Intelligent invalidation on file/index changes
 * - Query logging and analytics
 * - Cache warming strategies
 */
export class MultiLevelCacheManager<T = unknown> {
  private l1Cache: MemoryCache<T>;
  private l2Cache: DiskCache<T>;
  private l3Cache: DatabaseCache<T>;

  private config: MultiLevelCacheConfig;
  private logger = createLogger({ operation: "multi-level-cache" });

  // Statistics
  private promotions = 0;
  private invalidations = 0;
  private startTime = Date.now();

  constructor(config: MultiLevelCacheConfig, cacheBasePath: string) {
    this.config = config;

    // Initialize cache levels
    this.l1Cache = new MemoryCache<T>(config.memory);

    this.l2Cache = new DiskCache<T>({
      ...config.disk,
      path: config.disk.path || join(cacheBasePath, "l2-disk"),
    });

    this.l3Cache = new DatabaseCache<T>(
      config.database,
      join(cacheBasePath, "l3-cache.db"),
    );

    this.logger.info("Multi-level cache manager initialized", {
      l1Enabled: config.memory.enabled,
      l2Enabled: config.disk.enabled,
      l3Enabled: config.database.enabled,
      enablePromotion: config.enablePromotion,
    });
  }

  /**
   * Get value from cache, checking L1 -> L2 -> L3 in order
   */
  async get(key: string): Promise<CacheOperationResult<T>> {
    const startTime = Date.now();

    // Try L1 (Memory)
    const l1Result = await this.l1Cache.get(key);
    if (l1Result.success) {
      this.logger.debug("Cache hit at L1", {
        key,
        latencyMs: l1Result.latencyMs,
      });
      return l1Result;
    }

    // Try L2 (Disk)
    const l2Result = await this.l2Cache.get(key);
    if (l2Result.success && l2Result.value !== undefined) {
      this.logger.debug("Cache hit at L2", {
        key,
        latencyMs: l2Result.latencyMs,
      });

      // Promote to L1
      if (this.config.enablePromotion) {
        await this.l1Cache.set(key, l2Result.value);
        this.promotions++;
        this.logger.debug("Promoted L2 hit to L1", { key });
      }

      return {
        ...l2Result,
        latencyMs: Date.now() - startTime,
      };
    }

    // Try L3 (Database)
    const l3Result = await this.l3Cache.get(key);
    if (l3Result.success && l3Result.value !== undefined) {
      this.logger.debug("Cache hit at L3", {
        key,
        latencyMs: l3Result.latencyMs,
      });

      // Promote to L2 and L1
      if (this.config.enablePromotion) {
        await this.l2Cache.set(key, l3Result.value);
        await this.l1Cache.set(key, l3Result.value);
        this.promotions++;
        this.logger.debug("Promoted L3 hit to L2 and L1", { key });
      }

      return {
        ...l3Result,
        latencyMs: Date.now() - startTime,
      };
    }

    // Cache miss
    this.logger.debug("Cache miss at all levels", {
      key,
      latencyMs: Date.now() - startTime,
    });

    return {
      success: false,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Set value in cache at all levels
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    const promises: Array<Promise<CacheOperationResult<T>>> = [];

    if (this.config.memory.enabled) {
      promises.push(this.l1Cache.set(key, value, ttl));
    }

    if (this.config.disk.enabled) {
      promises.push(this.l2Cache.set(key, value, ttl));
    }

    if (this.config.database.enabled) {
      promises.push(this.l3Cache.set(key, value, ttl));
    }

    await Promise.all(promises);

    this.logger.debug("Value cached at all levels", { key });
  }

  /**
   * Delete entry from all cache levels
   */
  async delete(key: string): Promise<void> {
    await Promise.all([
      this.l1Cache.delete(key),
      this.l2Cache.delete(key),
      this.l3Cache.delete(key),
    ]);

    this.logger.debug("Deleted from all cache levels", { key });
  }

  /**
   * Invalidate cache entries matching pattern
   */
  async invalidate(pattern: string | RegExp): Promise<CacheInvalidationEvent> {
    const startTime = Date.now();
    const affectedKeys: string[] = [];

    // Get all keys from all levels
    const l1Keys = await this.l1Cache.keys();
    const l2Keys = await this.l2Cache.keys();
    const l3Keys = await this.l3Cache.keys();

    const allKeys = new Set([...l1Keys, ...l2Keys, ...l3Keys]);

    // Find keys matching pattern
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

    for (const key of allKeys) {
      if (regex.test(key)) {
        affectedKeys.push(key);
        await this.delete(key);
      }
    }

    this.invalidations++;

    const event: CacheInvalidationEvent = {
      reason: "manual",
      keys: affectedKeys,
      levels: ["L1", "L2", "L3"],
      timestamp: Date.now(),
      context: {
        pattern: pattern.toString(),
        duration: Date.now() - startTime,
      },
    };

    this.logger.info("Cache invalidation completed", {
      affectedKeys: affectedKeys.length,
      pattern: pattern.toString(),
    });

    return event;
  }

  /**
   * Clear all cache levels
   */
  async clear(): Promise<void> {
    await Promise.all([
      this.l1Cache.clear(),
      this.l2Cache.clear(),
      this.l3Cache.clear(),
    ]);

    this.logger.info("All cache levels cleared");
  }

  /**
   * Generate consistent cache key
   */
  generateKey(components: {
    queryText: string;
    queryType: string;
    options?: Record<string, unknown>;
    indexVersion?: string;
  }): string {
    const keyData = [
      components.queryType,
      components.queryText,
      JSON.stringify(components.options || {}),
      components.indexVersion || "",
    ].join("|");

    const hash = createHash("sha256").update(keyData).digest("hex");

    return `query:${components.queryType}:${hash.substring(0, 16)}`;
  }

  /**
   * Log query execution for analytics
   */
  async logQuery(log: Omit<CacheQueryLog, "id">): Promise<void> {
    await this.l3Cache.logQuery(log);
  }

  /**
   * Get top queries for cache warming
   */
  async getTopQueries(
    limit: number,
  ): Promise<Array<{ queryHash: string; count: number }>> {
    return this.l3Cache.getTopQueries(limit);
  }

  /**
   * Warm cache with top queries
   */
  async warmCache(queries: Array<{ key: string; value: T }>): Promise<void> {
    if (!this.config.enableWarming) {
      return;
    }

    this.logger.info("Starting cache warming", { queryCount: queries.length });

    for (const query of queries) {
      await this.set(query.key, query.value);
    }

    this.logger.info("Cache warming completed", { queryCount: queries.length });
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const l1Stats = this.l1Cache.getStats();
    const l2Stats = this.l2Cache.getStats();
    const l3Stats = this.l3Cache.getStats();

    const totalHits = l1Stats.hits + l2Stats.hits + l3Stats.hits;
    const totalMisses = l1Stats.misses + l2Stats.misses + l3Stats.misses;
    const overallHitRate =
      totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

    return {
      levels: {
        L1: l1Stats,
        L2: l2Stats,
        L3: l3Stats,
      },
      overallHitRate,
      totalEntries:
        l1Stats.entryCount + l2Stats.entryCount + l3Stats.entryCount,
      totalSizeBytes: l1Stats.sizeBytes + l2Stats.sizeBytes + l3Stats.sizeBytes,
      promotions: this.promotions,
      invalidations: this.invalidations,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  /**
   * Shutdown all cache levels
   */
  async shutdown(): Promise<void> {
    await Promise.all([
      this.l1Cache.shutdown(),
      this.l2Cache.shutdown(),
      this.l3Cache.shutdown(),
    ]);

    this.logger.info("Multi-level cache manager shut down");
  }
}
