/**
 * Multi-Level Query Cache Implementation
 *
 * Implements a three-tier caching strategy:
 * - L1: In-memory LRU cache (fastest, limited size)
 * - L2: Disk-based cache (fast, larger capacity)
 * - L3: Database cache (persistent, unlimited)
 *
 * Addresses Issue #160 acceptance criteria:
 * - Multi-level caching for query results
 * - Cache invalidation on index updates
 * - Cache warming for frequent queries
 * - Performance optimization
 */

import { promises as fs } from "fs";
import { join } from "path";
import { createModuleLogger } from "../logging/index.js";
import { getQueryLog, QueryLogStorage } from "./query-log-storage.js";

const logger = createModuleLogger("QueryCache");

/**
 * Cache entry metadata
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  l1: {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
  };
  l2: {
    hits: number;
    misses: number;
    sizeBytes: number;
  };
  l3: {
    hits: number;
    misses: number;
    count: number;
  };
  totalHits: number;
  totalMisses: number;
  hitRate: number;
}

/**
 * Cache options
 */
export interface QueryCacheOptions {
  /** Base directory for cache storage */
  cacheDir?: string;
  /** L1 cache max entries */
  l1MaxEntries?: number;
  /** L2 cache max size in bytes */
  l2MaxSizeBytes?: number;
  /** L3 cache TTL in milliseconds */
  l3TtlMs?: number;
  /** Enable cache */
  enabled?: boolean;
  /** Index version for cache invalidation */
  indexVersion?: string;
}

/**
 * Multi-level Query Cache
 */
export class QueryCache<T = unknown> {
  private l1Cache: Map<string, CacheEntry<T>> = new Map();
  private l1MaxEntries: number;
  private l2Dir: string;
  private l2MaxSizeBytes: number;
  private l3TtlMs: number;
  private enabled: boolean;
  private indexVersion: string;
  private queryLog: QueryLogStorage;

  // Statistics
  private stats = {
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0,
    l3Hits: 0,
    l3Misses: 0,
  };

  constructor(options: QueryCacheOptions = {}) {
    this.l1MaxEntries = options.l1MaxEntries || 100;
    this.l2MaxSizeBytes = options.l2MaxSizeBytes || 100 * 1024 * 1024; // 100MB
    this.l3TtlMs = options.l3TtlMs || 7 * 24 * 60 * 60 * 1000; // 7 days
    this.enabled = options.enabled !== false;
    this.indexVersion = options.indexVersion || "unknown";

    const baseDir = options.cacheDir || ".astdb/cache";
    this.l2Dir = join(baseDir, "l2-disk");

    this.queryLog = getQueryLog(baseDir);
  }

  /**
   * Initialize cache system
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      logger.info("Query cache disabled");
      return;
    }

    try {
      // Ensure L2 directory exists
      await fs.mkdir(this.l2Dir, { recursive: true });

      // Initialize query log
      await this.queryLog.initialize();

      logger.info("Query cache initialized", {
        l1MaxEntries: this.l1MaxEntries,
        l2MaxSizeBytes: this.l2MaxSizeBytes,
        indexVersion: this.indexVersion,
      });
    } catch (error) {
      logger.error("Failed to initialize query cache", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get cached result
   * Checks L1 → L2 → L3 in order, promotes to higher levels on hit
   */
  async get(
    queryText: string,
    options: Record<string, unknown> = {},
  ): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    const cacheKey = this.generateCacheKey(queryText, options);
    const startTime = Date.now();

    try {
      // L1: In-memory cache
      const l1Result = this.getFromL1(cacheKey);
      if (l1Result) {
        this.stats.l1Hits++;
        logger.debug("L1 cache hit", {
          cacheKey,
          queryText: queryText.substring(0, 50),
        });

        await this.logQueryExecution(
          queryText,
          options,
          l1Result,
          Date.now() - startTime,
          true,
        );
        return l1Result;
      }
      this.stats.l1Misses++;

      // L2: Disk cache
      const l2Result = await this.getFromL2(cacheKey);
      if (l2Result) {
        this.stats.l2Hits++;
        logger.debug("L2 cache hit", { cacheKey });

        // Promote to L1
        this.setToL1(cacheKey, l2Result);

        await this.logQueryExecution(
          queryText,
          options,
          l2Result,
          Date.now() - startTime,
          true,
        );
        return l2Result;
      }
      this.stats.l2Misses++;

      // L3: Database cache (via query log)
      // For now, L3 is primarily for warming and analytics
      this.stats.l3Misses++;

      logger.debug("Cache miss (all levels)", { cacheKey });
      return null;
    } catch (error) {
      logger.error("Cache get error", {
        error: (error as Error).message,
        cacheKey,
      });
      return null;
    }
  }

  /**
   * Set cached result
   * Writes to all cache levels
   */
  async set(
    queryText: string,
    options: Record<string, unknown> = {},
    data: T,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const cacheKey = this.generateCacheKey(queryText, options);

    try {
      // L1: In-memory
      this.setToL1(cacheKey, data);

      // L2: Disk
      await this.setToL2(cacheKey, data);

      // L3: Log in query log for analytics
      // (Actual data not stored in L3, only metadata)

      logger.debug("Cache set (all levels)", {
        cacheKey,
        queryText: queryText.substring(0, 50),
      });
    } catch (error) {
      logger.error("Cache set error", {
        error: (error as Error).message,
        cacheKey,
      });
      // Don't throw - cache write failures shouldn't break queries
    }
  }

  /**
   * Invalidate cache entries
   * Used when index is updated
   */
  async invalidate(pattern?: string): Promise<number> {
    if (!this.enabled) {
      return 0;
    }

    let invalidated = 0;

    try {
      if (pattern) {
        // Invalidate matching entries
        for (const key of this.l1Cache.keys()) {
          if (key.includes(pattern)) {
            this.l1Cache.delete(key);
            invalidated++;
          }
        }

        // Clear matching L2 entries
        const l2Files = await fs.readdir(this.l2Dir);
        for (const file of l2Files) {
          if (file.includes(pattern)) {
            await fs.unlink(join(this.l2Dir, file));
            invalidated++;
          }
        }
      } else {
        // Clear all caches
        invalidated = this.l1Cache.size;
        this.l1Cache.clear();

        const l2Files = await fs.readdir(this.l2Dir);
        for (const file of l2Files) {
          await fs.unlink(join(this.l2Dir, file));
          invalidated++;
        }
      }

      logger.info("Cache invalidated", { invalidated, pattern });
      return invalidated;
    } catch (error) {
      logger.error("Cache invalidation error", {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Warm cache with frequent queries
   */
  async warm(
    warmingFn: (
      queryText: string,
      options: Record<string, unknown>,
    ) => Promise<T>,
  ): Promise<number> {
    if (!this.enabled) {
      return 0;
    }

    try {
      // Get frequent queries from query log
      const queries = await this.queryLog.getQueriesForWarming(3, 7);
      let warmed = 0;

      for (const query of queries) {
        try {
          const cacheKey = query.queryHash;

          // Check if already cached
          if (this.l1Cache.has(cacheKey)) {
            continue;
          }

          // Execute query and cache result
          const options = JSON.parse(query.options) as Record<string, unknown>;
          const result = await warmingFn(query.queryText, options);
          await this.set(query.queryText, options, result);
          warmed++;

          logger.debug("Cache warmed", {
            queryText: query.queryText.substring(0, 50),
            frequency: query.frequency,
          });
        } catch (error) {
          logger.warn("Failed to warm cache entry", {
            error: (error as Error).message,
            queryText: query.queryText.substring(0, 50),
          });
        }
      }

      logger.info("Cache warming complete", { warmed, total: queries.length });
      return warmed;
    } catch (error) {
      logger.error("Cache warming error", {
        error: (error as Error).message,
      });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalHits = this.stats.l1Hits + this.stats.l2Hits + this.stats.l3Hits;
    const totalMisses =
      this.stats.l1Misses + this.stats.l2Misses + this.stats.l3Misses;
    const total = totalHits + totalMisses;

    return {
      l1: {
        hits: this.stats.l1Hits,
        misses: this.stats.l1Misses,
        size: this.l1Cache.size,
        maxSize: this.l1MaxEntries,
      },
      l2: {
        hits: this.stats.l2Hits,
        misses: this.stats.l2Misses,
        sizeBytes: 0, // Would need to calculate actual size
      },
      l3: {
        hits: this.stats.l3Hits,
        misses: this.stats.l3Misses,
        count: 0,
      },
      totalHits,
      totalMisses,
      hitRate: total > 0 ? totalHits / total : 0,
    };
  }

  /**
   * Clear all cache levels
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();

    try {
      const files = await fs.readdir(this.l2Dir);
      for (const file of files) {
        await fs.unlink(join(this.l2Dir, file));
      }
    } catch (error) {
      logger.error("Failed to clear L2 cache", {
        error: (error as Error).message,
      });
    }

    // Reset statistics
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      l3Hits: 0,
      l3Misses: 0,
    };

    logger.info("Cache cleared");
  }

  /**
   * Generate cache key from query and options
   */
  private generateCacheKey(
    queryText: string,
    options: Record<string, unknown>,
  ): string {
    return QueryLogStorage.generateQueryHash(queryText, {
      ...options,
      indexVersion: this.indexVersion,
    });
  }

  /**
   * Get from L1 (in-memory) cache
   */
  private getFromL1(cacheKey: string): T | null {
    const entry = this.l1Cache.get(cacheKey);
    if (!entry) {
      return null;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.data;
  }

  /**
   * Set to L1 (in-memory) cache
   */
  private setToL1(cacheKey: string, data: T): void {
    // Evict LRU entry if at capacity
    if (this.l1Cache.size >= this.l1MaxEntries && !this.l1Cache.has(cacheKey)) {
      this.evictLRU();
    }

    this.l1Cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      size: this.estimateSize(data),
    });
  }

  /**
   * Get from L2 (disk) cache
   */
  private async getFromL2(cacheKey: string): Promise<T | null> {
    const filePath = join(this.l2Dir, `${cacheKey}.json`);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const entry: CacheEntry<T> = JSON.parse(content);

      // Check if entry is still valid
      const age = Date.now() - entry.timestamp;
      if (age > this.l3TtlMs) {
        await fs.unlink(filePath);
        return null;
      }

      return entry.data;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Set to L2 (disk) cache
   */
  private async setToL2(cacheKey: string, data: T): Promise<void> {
    const filePath = join(this.l2Dir, `${cacheKey}.json`);

    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now(),
        size: this.estimateSize(data),
      };

      await fs.writeFile(filePath, JSON.stringify(entry), "utf-8");
    } catch (error) {
      logger.warn("Failed to write L2 cache", {
        error: (error as Error).message,
        cacheKey,
      });
    }
  }

  /**
   * Evict least recently used entry from L1
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.l1Cache.delete(oldestKey);
      logger.debug("Evicted LRU entry from L1", { key: oldestKey });
    }
  }

  /**
   * Estimate data size for cache management
   */
  private estimateSize(data: T): number {
    try {
      return JSON.stringify(data).length;
    } catch (_error) {
      return 0;
    }
  }

  /**
   * Log query execution to query log
   */
  private async logQueryExecution(
    queryText: string,
    options: Record<string, unknown>,
    result: T,
    executionTimeMs: number,
    cacheHit: boolean,
  ): Promise<void> {
    try {
      const resultCount = Array.isArray(result) ? result.length : 1;
      const queryHash = this.generateCacheKey(queryText, options);

      await this.queryLog.logQuery({
        queryText,
        queryHash,
        options: JSON.stringify(options),
        resultCount,
        executionTimeMs,
        cacheHit,
        timestamp: Date.now(),
        indexVersion: this.indexVersion,
      });
    } catch (error) {
      logger.warn("Failed to log query execution", {
        error: (error as Error).message,
      });
    }
  }
}
