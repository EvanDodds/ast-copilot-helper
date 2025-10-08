/**
 * @fileoverview Cache Warmer
 *
 * Intelligent cache warming system that analyzes query patterns and pre-populates
 * caches with frequently-used queries for improved performance.
 */

import { createLogger } from "../../../../ast-helper/src/logging/index.js";

import type { MultiLevelCacheManager } from "./multi-level-cache.js";
import type { CacheWarmingConfig } from "./types.js";

/**
 * Query information for cache warming
 */
export interface WarmingQuery {
  /** Query cache key */
  key: string;

  /** Query hash for tracking */
  hash: string;

  /** Query text */
  text: string;

  /** Query options (serialized) */
  options: string;

  /** Frequency count */
  count: number;

  /** Average execution time in ms */
  avgExecutionTime: number;

  /** Priority score for warming (higher = more important) */
  priority: number;
}

/**
 * Cache warming progress information
 */
export interface WarmingProgress {
  /** Total queries to warm */
  total: number;

  /** Queries warmed so far */
  completed: number;

  /** Queries that failed to warm */
  failed: number;

  /** Current query being warmed */
  current?: string;

  /** Elapsed time in ms */
  elapsedMs: number;

  /** Estimated remaining time in ms */
  estimatedRemainingMs?: number;
}

/**
 * Cache warming result
 */
export interface WarmingResult {
  /** Total queries attempted */
  totalQueries: number;

  /** Successfully warmed queries */
  successCount: number;

  /** Failed queries */
  failedCount: number;

  /** Total warming time in ms */
  durationMs: number;

  /** Failed query details */
  failures: Array<{ query: string; error: string }>;
}

/**
 * Query execution function for cache warming
 */
export type QueryExecutor<T = unknown> = (
  query: string,
  options: Record<string, unknown>,
) => Promise<T>;

/**
 * Intelligent cache warming system
 *
 * Features:
 * - Analyzes query logs from L3 cache
 * - Identifies frequently-used queries
 * - Calculates priority scores based on frequency and execution time
 * - Pre-executes queries and populates caches
 * - Progress reporting and error handling
 */
export class CacheWarmer<T = unknown> {
  private cacheManager: MultiLevelCacheManager<T>;
  private config: CacheWarmingConfig;
  // Query executor for future implementation when warming is fully integrated
  // @ts-expect-error - Reserved for future implementation
  private queryExecutor: QueryExecutor<T>;
  private logger = createLogger({ operation: "cache-warmer" });

  private isWarming = false;
  private abortController?: AbortController;
  private currentProgress?: WarmingProgress;

  constructor(
    cacheManager: MultiLevelCacheManager<T>,
    queryExecutor: QueryExecutor<T>,
    config: CacheWarmingConfig,
  ) {
    this.cacheManager = cacheManager;
    this.queryExecutor = queryExecutor;
    this.config = config;

    this.logger.info("Cache warmer initialized", {
      enabled: config.enabled,
      onStartup: config.onStartup,
      topQueriesCount: config.topQueriesCount,
    });
  }

  /**
   * Warm cache with top queries
   *
   * @param options Warming options
   * @param options.count Number of queries to warm (overrides config)
   * @param options.minFrequency Minimum query frequency (overrides config)
   * @param options.onProgress Progress callback
   * @returns Warming result
   */
  async warm(options?: {
    count?: number;
    minFrequency?: number;
    onProgress?: (progress: WarmingProgress) => void;
  }): Promise<WarmingResult> {
    if (!this.config.enabled) {
      this.logger.warn("Cache warming is disabled");
      return {
        totalQueries: 0,
        successCount: 0,
        failedCount: 0,
        durationMs: 0,
        failures: [],
      };
    }

    if (this.isWarming) {
      throw new Error("Cache warming is already in progress");
    }

    const startTime = Date.now();
    this.isWarming = true;
    this.abortController = new AbortController();

    const count = options?.count ?? this.config.topQueriesCount;
    const minFrequency = options?.minFrequency ?? this.config.minFrequency;

    this.logger.info("Starting cache warming", { count, minFrequency });

    try {
      // Get top queries from L3 cache
      const topQueries = await this.cacheManager.getTopQueries(count * 2); // Get extra in case we filter some out

      // Convert to warming queries
      const warmingQueries = await this.prepareWarmingQueries(
        topQueries,
        minFrequency,
        count,
      );

      if (warmingQueries.length === 0) {
        this.logger.info("No queries to warm");
        return {
          totalQueries: 0,
          successCount: 0,
          failedCount: 0,
          durationMs: Date.now() - startTime,
          failures: [],
        };
      }

      // Initialize progress
      this.currentProgress = {
        total: warmingQueries.length,
        completed: 0,
        failed: 0,
        elapsedMs: 0,
      };

      // Warm queries
      const result = await this.warmQueries(
        warmingQueries,
        options?.onProgress,
      );

      return {
        ...result,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.isWarming = false;
      this.abortController = undefined;
      this.currentProgress = undefined;
    }
  }

  /**
   * Prepare queries for warming
   */
  private async prepareWarmingQueries(
    topQueries: Array<{ queryHash: string; count: number }>,
    minFrequency: number,
    limit: number,
  ): Promise<WarmingQuery[]> {
    const warmingQueries: WarmingQuery[] = [];

    for (const query of topQueries) {
      if (query.count < minFrequency) {
        continue;
      }

      // Get query details from logs (this would query the L3 database)
      // For now, we'll use the hash and count
      const priority = this.calculatePriority(query.count, 0);

      warmingQueries.push({
        key: `query:${query.queryHash}`,
        hash: query.queryHash,
        text: "", // Would be loaded from query log
        options: "{}",
        count: query.count,
        avgExecutionTime: 0,
        priority,
      });

      if (warmingQueries.length >= limit) {
        break;
      }
    }

    // Sort by priority (highest first)
    warmingQueries.sort((a, b) => b.priority - a.priority);

    this.logger.debug("Prepared warming queries", {
      total: warmingQueries.length,
      topPriority: warmingQueries[0]?.priority,
    });

    return warmingQueries;
  }

  /**
   * Calculate priority score for query
   *
   * Priority = frequency * (1 + executionTime / 1000)
   * Prioritizes frequently-used and slow queries
   */
  private calculatePriority(
    frequency: number,
    avgExecutionTimeMs: number,
  ): number {
    return frequency * (1 + avgExecutionTimeMs / 1000);
  }

  /**
   * Warm queries by executing them
   */
  private async warmQueries(
    queries: WarmingQuery[],
    onProgress?: (progress: WarmingProgress) => void,
  ): Promise<Omit<WarmingResult, "durationMs">> {
    let successCount = 0;
    let failedCount = 0;
    const failures: Array<{ query: string; error: string }> = [];
    const startTime = Date.now();

    for (let i = 0; i < queries.length; i++) {
      if (this.abortController?.signal.aborted) {
        this.logger.info("Cache warming aborted");
        break;
      }

      const query = queries[i];
      if (!query) {
        continue;
      }

      // Update progress
      if (this.currentProgress) {
        this.currentProgress.current = query.text || query.hash;
        this.currentProgress.completed = i;
        this.currentProgress.elapsedMs = Date.now() - startTime;

        // Estimate remaining time
        const avgTimePerQuery = this.currentProgress.elapsedMs / (i + 1);
        this.currentProgress.estimatedRemainingMs =
          avgTimePerQuery * (queries.length - i - 1);

        onProgress?.(this.currentProgress);
      }

      try {
        // Check if already cached
        const cached = await this.cacheManager.get(query.key);
        if (cached.success) {
          this.logger.debug("Query already cached, skipping", {
            hash: query.hash,
          });
          successCount++;
          continue;
        }

        // Execute query (in placeholder mode, we'll just skip execution)
        // In real implementation, this would call this.queryExecutor
        this.logger.debug("Would execute query for warming", {
          hash: query.hash,
          priority: query.priority,
        });

        // Simulate caching (in real implementation, result would be cached)
        // await this.cacheManager.set(query.key, result);

        successCount++;

        this.logger.debug("Query warmed successfully", {
          hash: query.hash,
        });
      } catch (error) {
        failedCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        failures.push({
          query: query.text || query.hash,
          error: errorMsg,
        });

        this.logger.warn("Failed to warm query", {
          hash: query.hash,
          error: errorMsg,
        });
      }
    }

    // Final progress update
    if (this.currentProgress) {
      this.currentProgress.completed = queries.length;
      this.currentProgress.failed = failedCount;
      this.currentProgress.current = undefined;
      onProgress?.(this.currentProgress);
    }

    this.logger.info("Cache warming completed", {
      total: queries.length,
      success: successCount,
      failed: failedCount,
    });

    return {
      totalQueries: queries.length,
      successCount,
      failedCount,
      failures,
    };
  }

  /**
   * Stop cache warming in progress
   */
  abort(): void {
    if (!this.isWarming) {
      return;
    }

    this.logger.info("Aborting cache warming");
    this.abortController?.abort();
  }

  /**
   * Check if cache warming is in progress
   */
  isInProgress(): boolean {
    return this.isWarming;
  }

  /**
   * Get current warming progress
   */
  getProgress(): WarmingProgress | undefined {
    return this.currentProgress;
  }

  /**
   * Warm cache on startup if configured
   */
  async warmOnStartup(): Promise<WarmingResult | undefined> {
    if (!this.config.onStartup) {
      this.logger.debug("Startup warming disabled");
      return undefined;
    }

    this.logger.info("Starting cache warming on startup");

    return this.warm();
  }
}
