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

  const cacheBasePath = join(config.outputDir, ".cache");

  if (level === "all" || level === "L1") {
    logger.info("Clearing L1 (memory) cache");
    // L1 is in-memory only, cleared on restart
    logger.info("L1 cache cleared (memory-only, no persistent state)");
  }

  if (level === "all" || level === "L2") {
    const l2Path = join(cacheBasePath, "l2-disk");
    if (existsSync(l2Path)) {
      logger.info("Clearing L2 (disk) cache", { path: l2Path });
      await rm(l2Path, { recursive: true, force: true });
      logger.info("L2 cache cleared");
    } else {
      logger.info("L2 cache directory not found, nothing to clear");
    }
  }

  if (level === "all" || level === "L3") {
    const l3Path = join(cacheBasePath, "l3-cache.db");
    const l3ShmPath = join(cacheBasePath, "l3-cache.db-shm");
    const l3WalPath = join(cacheBasePath, "l3-cache.db-wal");

    if (existsSync(l3Path)) {
      logger.info("Clearing L3 (database) cache", { path: l3Path });
      await rm(l3Path, { force: true });
      if (existsSync(l3ShmPath)) {
        await rm(l3ShmPath, { force: true });
      }
      if (existsSync(l3WalPath)) {
        await rm(l3WalPath, { force: true });
      }
      logger.info("L3 cache cleared");
    } else {
      logger.info("L3 cache database not found, nothing to clear");
    }
  }

  logger.info("Cache clear completed", { level, success: true });
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

  const cacheBasePath = join(config.outputDir, ".cache");

  // Check cache existence
  const l2Exists = existsSync(join(cacheBasePath, "l2-disk"));
  const l3Exists = existsSync(join(cacheBasePath, "l3-cache.db"));

  const stats = {
    cacheEnabled: true,
    levels: {
      L1: {
        type: "memory",
        status: "in-memory (active when server running)",
        persistent: false,
      },
      L2: {
        type: "disk",
        status: l2Exists ? "initialized" : "not created",
        path: join(cacheBasePath, "l2-disk"),
        exists: l2Exists,
      },
      L3: {
        type: "database",
        status: l3Exists ? "initialized" : "not created",
        path: join(cacheBasePath, "l3-cache.db"),
        exists: l3Exists,
      },
    },
    note: "Detailed runtime statistics available when MCP server is running",
  };

  if (options.json) {
    process.stdout.write(JSON.stringify(stats, null, 2) + "\n");
  } else {
    process.stdout.write("\n=== Cache Statistics ===\n\n");
    process.stdout.write(
      `Cache Enabled: ${stats.cacheEnabled ? "Yes" : "No"}\n\n`,
    );

    process.stdout.write("Cache Levels:\n");
    process.stdout.write(
      `  L1 (Memory):   ${stats.levels.L1.status} - ${stats.levels.L1.type}\n`,
    );
    process.stdout.write(
      `  L2 (Disk):     ${stats.levels.L2.status} - ${stats.levels.L2.type}\n`,
    );
    if (options.detailed) {
      process.stdout.write(`                 Path: ${stats.levels.L2.path}\n`);
    }
    process.stdout.write(
      `  L3 (Database): ${stats.levels.L3.status} - ${stats.levels.L3.type}\n`,
    );
    if (options.detailed) {
      process.stdout.write(`                 Path: ${stats.levels.L3.path}\n`);
    }

    process.stdout.write(`\nℹ  ${stats.note}\n`);
    process.stdout.write(
      "\nTo get runtime statistics, query the MCP server while it's running.\n",
    );
  }

  logger.info("Cache statistics displayed");
}

/**
 * Warm cache with top queries
 */
export async function warmCache(
  _config: Config,
  options: CacheWarmOptions,
): Promise<void> {
  const count = options.count || 50; // Default to 50 if not specified
  logger.info("Cache warming", { count, dryRun: options.dryRun });

  if (options.dryRun) {
    process.stdout.write(
      `[DRY RUN] Would warm cache with top ${count} queries\n`,
    );
    return;
  }

  // Cache warming requires the MCP server to be running
  // This is a placeholder that will integrate with the actual cache manager
  logger.warn(
    "Cache warming requires MCP server to be running. This command is a placeholder for future integration.",
  );
  process.stdout.write(
    "\nℹ  Cache warming is not yet implemented in standalone CLI mode.\n",
  );
  process.stdout.write(
    "   To warm the cache, start the MCP server and use the warming API.\n",
  );
  process.stdout.write(
    `   The server will automatically warm ${count} top queries on startup if configured.\n`,
  );
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
  _config: Config,
  options: CachePruneOptions,
): Promise<void> {
  const olderThan = options.olderThan || "7d"; // Default to 7 days
  const level = options.level || "all"; // Default to all levels

  logger.info("Pruning cache", {
    olderThan,
    level,
    dryRun: options.dryRun,
  });

  const durationMs = parseDuration(olderThan);
  const cutoffTime = Date.now() - durationMs;

  if (options.dryRun) {
    process.stdout.write(
      `[DRY RUN] Would prune cache entries older than ${olderThan} (${new Date(cutoffTime).toISOString()})\n`,
    );
    return;
  }

  // Pruning requires database access to check timestamps
  logger.warn(
    "Cache pruning requires MCP server to be running. This command is a placeholder for future integration.",
  );
  process.stdout.write(
    "\nℹ  Cache pruning is not yet implemented in standalone CLI mode.\n",
  );
  process.stdout.write(
    "   To prune the cache, start the MCP server and use the pruning API.\n",
  );
  process.stdout.write(
    `   Entries older than ${olderThan} would be removed from ${level} cache.\n`,
  );
}

/**
 * Analyze cache usage and provide recommendations
 */
export async function analyzeCache(
  _config: Config,
  options: CacheAnalyzeOptions,
): Promise<void> {
  const topQueries = options.topQueries || 20; // Default to 20
  const format = options.format || "text"; // Default to text

  logger.info("Analyzing cache usage", {
    topQueries,
    format,
  });

  // Analysis requires runtime statistics
  logger.warn(
    "Cache analysis requires MCP server to be running. This command is a placeholder for future integration.",
  );
  process.stdout.write(
    "\nℹ  Cache analysis is not yet implemented in standalone CLI mode.\n",
  );
  process.stdout.write(
    "   To analyze cache usage, start the MCP server and use the analysis API.\n",
  );

  if (options.recommendations) {
    process.stdout.write("\n=== Cache Optimization Recommendations ===\n\n");
    process.stdout.write(
      "• Enable cache warming for frequently used queries\n",
    );
    process.stdout.write(
      "• Configure appropriate TTL values for different cache levels\n",
    );
    process.stdout.write(
      "• Monitor hit rates and adjust cache sizes accordingly\n",
    );
    process.stdout.write(
      "• Set up automatic cache invalidation on file changes in watch mode\n",
    );
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
