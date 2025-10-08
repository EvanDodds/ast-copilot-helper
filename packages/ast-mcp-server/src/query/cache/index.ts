/**
 * @fileoverview Query Cache Module Exports
 *
 * Exports all cache-related types and classes for the multi-level caching system.
 */

export { MemoryCache } from "./memory-cache.js";
export { DiskCache } from "./disk-cache.js";
export { DatabaseCache } from "./database-cache.js";
export { MultiLevelCacheManager } from "./multi-level-cache.js";
export {
  CacheWarmer,
  type WarmingQuery,
  type WarmingProgress,
  type WarmingResult,
  type QueryExecutor,
} from "./cache-warmer.js";

export type {
  CacheLevel,
  CacheEntry,
  LevelCacheConfig,
  MultiLevelCacheConfig,
  LevelCacheStats,
  CacheStats,
  CacheKeyComponents,
  CacheInvalidationEvent,
  QueryFileMapping,
  CacheWarmingConfig,
  CacheQueryLog,
  CacheOperationResult,
  InvalidationStrategy,
  CacheInvalidationConfig,
} from "./types.js";
