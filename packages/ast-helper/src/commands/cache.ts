/**
 * @fileoverview Cache management CLI commands
 *
 * Provides commands for managing the multi-level query cache system:
 * - cache:clear - Clear cache entries at specified levels
 * - cache:stats - Display cache statistics and performance metrics
 * - cache:warm - Pre-populate cache with frequent queries
 * - cache:prune - Remove old or stale entries
 * - cache:analyze - Analyze cache usage and provide optimization recommendations
 */

import { createLogger } from "../logging/index.js";
import type { Config } from "../types.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { QueryCache } from "../cache/query-cache.js";
import { getQueryLog } from "../cache/query-log-storage.js";
import { ASTDatabaseManager } from "../database/manager.js";
import { AnnotationDatabaseManager } from "../database/annotation-manager.js";

const logger = createLogger();

/**
 * Cache level identifier
 */
export type CacheLevel = "L1" | "L2" | "L3" | "all";

/**
 * Options for cache clear command
 */
export interface CacheClearOptions {
  level?: CacheLevel;
  confirm?: boolean;
  verbose?: boolean;
}

/**
 * Options for cache stats command
 */
export interface CacheStatsOptions {
  json?: boolean;
  detailed?: boolean;
  level?: CacheLevel;
}

/**
 * Options for cache warm command
 */
export interface CacheWarmOptions {
  count?: number;
  verbose?: boolean;
  dryRun?: boolean;
}

/**
 * Options for cache prune command
 */
export interface CachePruneOptions {
  olderThan?: string; // e.g., "7d", "24h", "30m"
  level?: CacheLevel;
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Options for cache analyze command
 */
export interface CacheAnalyzeOptions {
  topQueries?: number;
  format?: "text" | "json" | "markdown";
  recommendations?: boolean;
}

/**
 * Clear cache entries at specified level(s)
 */
export async function clearCache(
  config: Config,
  options: CacheClearOptions,
): Promise<void> {
  const level = options.level || "all"; // Default to all levels
  logger.info("Clearing cache", { level });

  const cacheDir = join(config.outputDir, "cache");

  try {
    // Use QueryCache class for clearing
    const queryCache = new QueryCache({
      cacheDir,
      enabled: true,
    });
    await queryCache.initialize();

    if (level === "all") {
      await queryCache.clear();
      logger.info("All cache levels cleared");
    } else if (level === "L1") {
      // L1 is in-memory, cleared on restart
      logger.info("L1 cache cleared (memory-only, no persistent state)");
    } else if (level === "L2") {
      const l2Path = join(cacheDir, "l2-disk");
      if (existsSync(l2Path)) {
        await rm(l2Path, { recursive: true, force: true });
        logger.info("L2 cache cleared");
      }
    } else if (level === "L3") {
      // L3 is query log storage
      const queryLog = getQueryLog(cacheDir);
      await queryLog.initialize();
      const deleted = await queryLog.cleanOldEntries(0); // Delete all
      logger.info(`L3 cache cleared (${deleted} entries removed)`);
    }

    logger.info("Cache clear completed", { level, success: true });
  } catch (error) {
    logger.error("Cache clear failed", { error: (error as Error).message });
    throw error;
  }
}

/**
 * Display cache statistics
 */
export async function showCacheStats(
  config: Config,
  options: CacheStatsOptions,
): Promise<void> {
  logger.info("Showing cache stats", {
    json: options.json,
    detailed: options.detailed,
  });

  const cacheDir = join(config.outputDir, "cache");

  try {
    // Initialize QueryCache and QueryLog to get stats
    const queryCache = new QueryCache({
      cacheDir,
      enabled: true,
    });
    await queryCache.initialize();

    const cacheStats = queryCache.getStats();

    const queryLog = getQueryLog(cacheDir);
    await queryLog.initialize();
    const queryStats = await queryLog.getStatistics(30); // Last 30 days

    const l2Exists = existsSync(join(cacheDir, "l2-disk"));
    const l3Exists = existsSync(join(cacheDir, "query-log.db"));

    const stats = {
      cacheEnabled: true,
      overall: {
        totalHits: cacheStats.totalHits,
        totalMisses: cacheStats.totalMisses,
        hitRate: cacheStats.hitRate,
      },
      levels: {
        L1: {
          type: "memory",
          hits: cacheStats.l1.hits,
          misses: cacheStats.l1.misses,
          size: cacheStats.l1.size,
          maxSize: cacheStats.l1.maxSize,
          hitRate:
            cacheStats.l1.hits / (cacheStats.l1.hits + cacheStats.l1.misses) ||
            0,
        },
        L2: {
          type: "disk",
          hits: cacheStats.l2.hits,
          misses: cacheStats.l2.misses,
          path: join(cacheDir, "l2-disk"),
          exists: l2Exists,
        },
        L3: {
          type: "database",
          hits: cacheStats.l3.hits,
          misses: cacheStats.l3.misses,
          path: join(cacheDir, "query-log.db"),
          exists: l3Exists,
          totalQueries: queryStats.totalQueries,
          avgExecutionTime: queryStats.averageExecutionTime,
        },
      },
    };

    if (options.json) {
      process.stdout.write(JSON.stringify(stats, null, 2) + "\n");
    } else {
      process.stdout.write("\n=== Cache Statistics ===\n\n");
      process.stdout.write(
        `Cache Enabled: ${stats.cacheEnabled ? "Yes" : "No"}\n\n`,
      );

      process.stdout.write("Overall Performance:\n");
      process.stdout.write(`  Total Hits:    ${stats.overall.totalHits}\n`);
      process.stdout.write(`  Total Misses:  ${stats.overall.totalMisses}\n`);
      process.stdout.write(
        `  Hit Rate:      ${(stats.overall.hitRate * 100).toFixed(2)}%\n\n`,
      );

      process.stdout.write("Cache Levels:\n");
      process.stdout.write(
        `  L1 (Memory):   ${stats.levels.L1.hits} hits / ${stats.levels.L1.misses} misses (${(stats.levels.L1.hitRate * 100).toFixed(1)}%)\n`,
      );
      process.stdout.write(
        `                 Size: ${stats.levels.L1.size}/${stats.levels.L1.maxSize} entries\n`,
      );

      process.stdout.write(
        `  L2 (Disk):     ${stats.levels.L2.hits} hits / ${stats.levels.L2.misses} misses\n`,
      );
      if (options.detailed) {
        process.stdout.write(
          `                 Path: ${stats.levels.L2.path}\n`,
        );
        process.stdout.write(
          `                 Exists: ${stats.levels.L2.exists ? "Yes" : "No"}\n`,
        );
      }

      process.stdout.write(
        `  L3 (Database): ${stats.levels.L3.hits} hits / ${stats.levels.L3.misses} misses\n`,
      );
      process.stdout.write(
        `                 Total Queries Logged: ${stats.levels.L3.totalQueries}\n`,
      );
      process.stdout.write(
        `                 Avg Execution Time: ${stats.levels.L3.avgExecutionTime.toFixed(2)}ms\n`,
      );
      if (options.detailed) {
        process.stdout.write(
          `                 Path: ${stats.levels.L3.path}\n`,
        );
        process.stdout.write(
          `                 Exists: ${stats.levels.L3.exists ? "Yes" : "No"}\n`,
        );
      }

      // Display annotation statistics
      try {
        const dbManager = new ASTDatabaseManager(config.outputDir);
        const annotationManager = new AnnotationDatabaseManager(dbManager);

        const annotationDbExists = existsSync(
          annotationManager.getDatabasePath(),
        );
        if (annotationDbExists) {
          await annotationManager.initialize();
          const annotationStats = await annotationManager.getStatistics();

          process.stdout.write("\n=== Annotation Database ===\n\n");
          process.stdout.write(
            `  Total Annotations:  ${annotationStats.total_annotations}\n`,
          );
          process.stdout.write(
            `  Files with Annotations: ${annotationStats.files_count}\n`,
          );

          if (annotationStats.avg_complexity !== null) {
            process.stdout.write(
              `  Average Complexity: ${annotationStats.avg_complexity.toFixed(2)}\n`,
            );
          }

          if (Object.keys(annotationStats.node_types).length > 0) {
            process.stdout.write("\n  Node Type Distribution:\n");
            for (const [nodeType, count] of Object.entries(
              annotationStats.node_types,
            ).sort((a, b) => b[1] - a[1])) {
              process.stdout.write(`    ${nodeType.padEnd(12)}: ${count}\n`);
            }
          }

          if (options.detailed && annotationStats.last_updated) {
            const lastUpdated = new Date(annotationStats.last_updated);
            process.stdout.write(
              `\n  Last Updated: ${lastUpdated.toLocaleString()}\n`,
            );
          }

          annotationManager.close();
        } else {
          process.stdout.write("\n=== Annotation Database ===\n\n");
          process.stdout.write(
            "  No annotations found. Run 'ast-copilot-helper annotate' to generate annotations.\n",
          );
        }
      } catch (annotationError) {
        logger.warn("Could not retrieve annotation statistics", {
          error:
            annotationError instanceof Error
              ? annotationError.message
              : String(annotationError),
        });
      }
    }

    logger.info("Cache statistics displayed");
  } catch (error) {
    logger.error("Failed to get cache statistics", {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Warm cache with top queries
 */
export async function warmCache(
  config: Config,
  options: CacheWarmOptions,
): Promise<void> {
  const count = options.count || 50; // Default to 50 if not specified
  logger.info("Cache warming", { count, dryRun: options.dryRun });

  const cacheDir = join(config.outputDir, "cache");

  try {
    // Get query log to find top queries
    const queryLog = getQueryLog(cacheDir);
    await queryLog.initialize();

    // Get top queries for warming
    const topQueries = await queryLog.getQueriesForWarming(count);

    if (topQueries.length === 0) {
      process.stdout.write(
        "\nℹ  No queries found in log. Cache warming skipped.\n",
      );
      return;
    }

    if (options.dryRun) {
      process.stdout.write(
        `\n[DRY RUN] Would warm cache with ${topQueries.length} queries:\n\n`,
      );
      for (let i = 0; i < Math.min(10, topQueries.length); i++) {
        const query = topQueries[i];
        if (!query) {
          continue;
        }
        process.stdout.write(
          `  ${i + 1}. ${query.queryText.substring(0, 60)}${query.queryText.length > 60 ? "..." : ""} (${query.frequency}x)\n`,
        );
      }
      if (topQueries.length > 10) {
        process.stdout.write(`  ... and ${topQueries.length - 10} more\n`);
      }
      return;
    }

    process.stdout.write(
      `\n⚠  Cache warming identified ${topQueries.length} frequent queries.\n`,
    );
    process.stdout.write(
      "   To warm the cache with these queries, re-run them using the query command.\n",
    );
    process.stdout.write(
      "   The cache system will automatically populate L1/L2/L3 on query execution.\n\n",
    );

    if (options.verbose) {
      process.stdout.write("Top queries to warm:\n");
      for (let i = 0; i < Math.min(20, topQueries.length); i++) {
        const query = topQueries[i];
        if (!query) {
          continue;
        }
        process.stdout.write(
          `  ${i + 1}. ${query.queryText.substring(0, 60)}${query.queryText.length > 60 ? "..." : ""}\n`,
        );
        process.stdout.write(`     Executed ${query.frequency}x\n`);
      }
    }

    logger.info("Cache warming analysis complete", {
      queriesFound: topQueries.length,
    });
  } catch (error) {
    logger.error("Cache warming failed", {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([dhm])$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(
      `Invalid duration format: ${duration}. Use format like: 7d, 24h, 30m`,
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "d":
      return value * 24 * 60 * 60 * 1000; // days to ms
    case "h":
      return value * 60 * 60 * 1000; // hours to ms
    case "m":
      return value * 60 * 1000; // minutes to ms
    default:
      throw new Error(`Invalid duration unit: ${unit}`);
  }
}

/**
 * Prune old cache entries
 */
export async function pruneCache(
  config: Config,
  options: CachePruneOptions,
): Promise<void> {
  const olderThan = options.olderThan || "7d"; // Default to 7 days
  const level = options.level || "all"; // Default to all levels

  logger.info("Pruning cache", {
    olderThan,
    level,
    dryRun: options.dryRun,
  });

  const cacheDir = join(config.outputDir, "cache");
  const durationMs = parseDuration(olderThan);
  const cutoffTime = Date.now() - durationMs;

  try {
    if (options.dryRun) {
      process.stdout.write(
        `\n[DRY RUN] Would prune cache entries older than ${olderThan} (before ${new Date(cutoffTime).toISOString()})\n`,
      );
      process.stdout.write(`Target level: ${level}\n`);
      return;
    }

    let totalRemoved = 0;

    if (level === "all" || level === "L3") {
      // Prune query log entries
      const queryLog = getQueryLog(cacheDir);
      await queryLog.initialize();
      const removed = await queryLog.cleanOldEntries(
        durationMs / (24 * 60 * 60 * 1000),
      ); // Convert to days
      totalRemoved += removed;

      if (options.verbose) {
        process.stdout.write(`Pruned ${removed} entries from L3 (query log)\n`);
      }
    }

    if (level === "all" || level === "L2") {
      // For L2, we would need to scan disk files and check timestamps
      // This is simplified - in practice, you'd scan the l2-disk directory
      if (options.verbose) {
        process.stdout.write(
          "L2 (disk) pruning: Use cache:clear --level L2 to clear all disk cache\n",
        );
      }
    }

    if (level === "all" || level === "L1") {
      // L1 is in-memory, no pruning needed
      if (options.verbose) {
        process.stdout.write(
          "L1 (memory) pruning: Memory cache auto-expires based on LRU policy\n",
        );
      }
    }

    process.stdout.write(
      `\n✅ Pruning complete: ${totalRemoved} entries removed\n`,
    );

    logger.info("Cache pruning complete", { totalRemoved, olderThan });
  } catch (error) {
    logger.error("Cache pruning failed", {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Analyze cache usage and provide recommendations
 */
export async function analyzeCache(
  config: Config,
  options: CacheAnalyzeOptions,
): Promise<void> {
  const topQueries = options.topQueries || 20; // Default to 20
  const format = options.format || "text"; // Default to text

  logger.info("Analyzing cache usage", {
    topQueries,
    format,
  });

  const cacheDir = join(config.outputDir, "cache");

  try {
    // Get query statistics
    const queryLog = getQueryLog(cacheDir);
    await queryLog.initialize();

    const stats = await queryLog.getStatistics(30); // Last 30 days
    const topQueriesList = await queryLog.getTopQueries(topQueries);
    const warmingCandidates = await queryLog.getQueriesForWarming(10);

    // Initialize cache to get stats
    const queryCache = new QueryCache({
      cacheDir,
      enabled: true,
    });
    await queryCache.initialize();
    const cacheStats = queryCache.getStats();

    const analysis = {
      summary: {
        totalQueries: stats.totalQueries,
        cacheHitRate: stats.cacheHitRate,
        averageExecutionTime: stats.averageExecutionTime,
        totalHits: cacheStats.totalHits,
        totalMisses: cacheStats.totalMisses,
      },
      topQueries: topQueriesList.map((q, i) => ({
        rank: i + 1,
        query: q.queryText.substring(0, 80),
        frequency: q.count,
      })),
      warmingCandidates: warmingCandidates.map((q) => ({
        query: q.queryText.substring(0, 60),
        frequency: q.frequency,
      })),
      recommendations: [] as string[],
    };

    // Generate recommendations
    if (stats.cacheHitRate < 0.5) {
      analysis.recommendations.push(
        "Cache hit rate is low (<50%). Consider warming the cache with frequent queries.",
      );
    }
    if (warmingCandidates.length > 5) {
      analysis.recommendations.push(
        `${warmingCandidates.length} queries accessed 3+ times. Run 'cache:warm' to improve performance.`,
      );
    }
    if (stats.averageExecutionTime > 500) {
      analysis.recommendations.push(
        "Average execution time is high (>500ms). Enable caching to improve response times.",
      );
    }
    // Calculate L1 hit rate
    const l1HitRate =
      cacheStats.l1.hits / (cacheStats.l1.hits + cacheStats.l1.misses) || 0;
    if (l1HitRate < 0.3 && cacheStats.totalHits > 0) {
      analysis.recommendations.push(
        "L1 hit rate is low. Consider increasing l1MaxEntries cache configuration.",
      );
    }

    // Output based on format
    if (format === "json") {
      process.stdout.write(JSON.stringify(analysis, null, 2) + "\n");
    } else if (format === "markdown") {
      process.stdout.write("# Cache Usage Analysis\n\n");
      process.stdout.write("## Summary\n\n");
      process.stdout.write(
        `- **Total Queries**: ${analysis.summary.totalQueries}\n`,
      );
      process.stdout.write(
        `- **Cache Hit Rate**: ${(analysis.summary.cacheHitRate * 100).toFixed(2)}%\n`,
      );
      process.stdout.write(
        `- **Avg Execution Time**: ${analysis.summary.averageExecutionTime.toFixed(2)}ms\n\n`,
      );

      if (analysis.topQueries.length > 0) {
        process.stdout.write("## Top Queries\n\n");
        for (const q of analysis.topQueries) {
          process.stdout.write(`${q.rank}. **${q.query}** (${q.frequency}x)\n`);
        }
        process.stdout.write("\n");
      }

      if (options.recommendations && analysis.recommendations.length > 0) {
        process.stdout.write("## Recommendations\n\n");
        for (const rec of analysis.recommendations) {
          process.stdout.write(`- ${rec}\n`);
        }
      }
    } else {
      // Text format
      process.stdout.write("\n=== Cache Usage Analysis ===\n\n");
      process.stdout.write("Summary:\n");
      process.stdout.write(
        `  Total Queries:     ${analysis.summary.totalQueries}\n`,
      );
      process.stdout.write(
        `  Cache Hit Rate:    ${(analysis.summary.cacheHitRate * 100).toFixed(2)}%\n`,
      );
      process.stdout.write(
        `  Cache Hits:        ${analysis.summary.totalHits}\n`,
      );
      process.stdout.write(
        `  Cache Misses:      ${analysis.summary.totalMisses}\n`,
      );
      process.stdout.write(
        `  Avg Execution:     ${analysis.summary.averageExecutionTime.toFixed(2)}ms\n\n`,
      );

      if (analysis.topQueries.length > 0) {
        process.stdout.write(`Top ${topQueries} Queries:\n`);
        for (const q of analysis.topQueries) {
          process.stdout.write(`  ${q.rank}. ${q.query}\n`);
          process.stdout.write(`     Frequency: ${q.frequency}x\n`);
        }
        process.stdout.write("\n");
      }

      if (warmingCandidates.length > 0) {
        process.stdout.write(
          `Warming Candidates (${warmingCandidates.length}):\n`,
        );
        for (let i = 0; i < Math.min(5, warmingCandidates.length); i++) {
          const q = warmingCandidates[i];
          if (!q) {
            continue;
          }
          process.stdout.write(
            `  • ${q.queryText.substring(0, 60)} (${q.frequency}x)\n`,
          );
        }
        if (warmingCandidates.length > 5) {
          process.stdout.write(
            `  ... and ${warmingCandidates.length - 5} more\n`,
          );
        }
        process.stdout.write("\n");
      }

      if (options.recommendations && analysis.recommendations.length > 0) {
        process.stdout.write("=== Recommendations ===\n\n");
        for (const rec of analysis.recommendations) {
          process.stdout.write(`• ${rec}\n`);
        }
        process.stdout.write("\n");
      }
    }

    logger.info("Cache analysis complete");
  } catch (error) {
    logger.error("Cache analysis failed", {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Command handler for cache:clear command
 */
export class CacheClearCommandHandler {
  async execute(options: CacheClearOptions, config: Config): Promise<void> {
    await clearCache(config, options);
  }
}

/**
 * Command handler for cache:stats command
 */
export class CacheStatsCommandHandler {
  async execute(options: CacheStatsOptions, config: Config): Promise<void> {
    await showCacheStats(config, options);
  }
}

/**
 * Command handler for cache:warm command
 */
export class CacheWarmCommandHandler {
  async execute(options: CacheWarmOptions, config: Config): Promise<void> {
    await warmCache(config, options);
  }
}

/**
 * Command handler for cache:prune command
 */
export class CachePruneCommandHandler {
  async execute(options: CachePruneOptions, config: Config): Promise<void> {
    await pruneCache(config, options);
  }
}

/**
 * Command handler for cache:analyze command
 */
export class CacheAnalyzeCommandHandler {
  async execute(options: CacheAnalyzeOptions, config: Config): Promise<void> {
    await analyzeCache(config, options);
  }
}
