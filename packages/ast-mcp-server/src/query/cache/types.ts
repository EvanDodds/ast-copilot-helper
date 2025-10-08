/**
 * @fileoverview Query Cache Type Definitions
 *
 * Defines types and interfaces for the multi-level query caching system
 * implementing L1 (memory), L2 (disk), and L3 (database) cache architecture.
 */

/**
 * Cache level identifier
 */
export type CacheLevel = "L1" | "L2" | "L3";

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = unknown> {
  /** Cached value */
  value: T;

  /** Cache key */
  key: string;

  /** Timestamp when entry was created (ms) */
  timestamp: number;

  /** Time-to-live in milliseconds */
  ttl: number;

  /** Number of times entry has been accessed */
  accessCount: number;

  /** Timestamp of last access (ms) */
  lastAccessed: number;

  /** Size of entry in bytes (estimated) */
  size: number;

  /** Cache level where entry resides */
  level: CacheLevel;

  /** Version identifier for cache invalidation */
  version?: string;
}

/**
 * Cache configuration for a specific level
 */
export interface LevelCacheConfig {
  /** Enable this cache level */
  enabled: boolean;

  /** Maximum number of entries */
  maxSize: number;

  /** Default TTL in milliseconds */
  defaultTTL: number;

  /** Maximum size in bytes (for disk/database caches) */
  maxSizeBytes?: number;
}

/**
 * Multi-level cache configuration
 */
export interface MultiLevelCacheConfig {
  /** L1 (Memory) cache configuration */
  memory: LevelCacheConfig;

  /** L2 (Disk) cache configuration */
  disk: LevelCacheConfig & {
    /** Base path for cache files */
    path: string;
  };

  /** L3 (Database) cache configuration */
  database: LevelCacheConfig;

  /** Enable cache promotion (move hits to higher levels) */
  enablePromotion: boolean;

  /** Enable cache warming on startup */
  enableWarming: boolean;

  /** Number of top queries to warm on startup */
  warmingQueryCount: number;
}

/**
 * Cache statistics for a single level
 */
export interface LevelCacheStats {
  /** Cache level identifier */
  level: CacheLevel;

  /** Number of cache hits */
  hits: number;

  /** Number of cache misses */
  misses: number;

  /** Hit rate (hits / (hits + misses)) */
  hitRate: number;

  /** Current number of entries */
  entryCount: number;

  /** Total size in bytes */
  sizeBytes: number;

  /** Number of evictions */
  evictions: number;

  /** Average access time in ms */
  avgAccessTime: number;
}

/**
 * Comprehensive cache statistics
 */
export interface CacheStats {
  /** Statistics for each cache level */
  levels: {
    L1: LevelCacheStats;
    L2: LevelCacheStats;
    L3: LevelCacheStats;
  };

  /** Overall hit rate */
  overallHitRate: number;

  /** Total entries across all levels */
  totalEntries: number;

  /** Total size in bytes across all levels */
  totalSizeBytes: number;

  /** Number of promotions (L2->L1, L3->L2) */
  promotions: number;

  /** Number of cache invalidations */
  invalidations: number;

  /** Uptime in milliseconds */
  uptimeMs: number;
}

/**
 * Cache key components for consistent hashing
 */
export interface CacheKeyComponents {
  /** Query text (normalized) */
  queryText: string;

  /** Query type */
  queryType: string;

  /** Query options serialized */
  options: string;

  /** Index version identifier */
  indexVersion: string;

  /** Additional metadata */
  metadata?: Record<string, string>;
}

/**
 * Cache invalidation event
 */
export interface CacheInvalidationEvent {
  /** Reason for invalidation */
  reason: "file_change" | "index_update" | "manual" | "expired" | "eviction";

  /** Affected cache keys */
  keys: string[];

  /** Affected cache levels */
  levels: CacheLevel[];

  /** Timestamp of invalidation */
  timestamp: number;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Query-to-file mapping for invalidation tracking
 */
export interface QueryFileMapping {
  /** Query cache key */
  queryKey: string;

  /** File paths referenced in query results */
  filePaths: string[];

  /** Timestamp when mapping was created */
  timestamp: number;
}

/**
 * Cache warming configuration
 */
export interface CacheWarmingConfig {
  /** Enable cache warming */
  enabled: boolean;

  /** Warm cache on startup */
  onStartup: boolean;

  /** Number of top queries to warm */
  topQueriesCount: number;

  /** Minimum query frequency to include in warming */
  minFrequency: number;
}

/**
 * Cache query log entry
 */
export interface CacheQueryLog {
  /** Unique log ID */
  id: number;

  /** Query text */
  queryText: string;

  /** Query hash for deduplication */
  queryHash: string;

  /** Serialized query options */
  options: string;

  /** Number of results returned */
  resultCount: number;

  /** Execution time in milliseconds */
  executionTimeMs: number;

  /** Whether query was served from cache */
  cacheHit: boolean;

  /** Cache level that served the query (if cache hit) */
  cacheLevel?: CacheLevel;

  /** Timestamp (Unix time in ms) */
  timestamp: number;

  /** Index version at time of query */
  indexVersion: string;
}

/**
 * Cache operation result
 */
export interface CacheOperationResult<T = unknown> {
  /** Whether operation was successful */
  success: boolean;

  /** Result value (for get operations) */
  value?: T;

  /** Cache level where value was found/stored */
  level?: CacheLevel;

  /** Operation latency in milliseconds */
  latencyMs: number;

  /** Error message if operation failed */
  error?: string;
}

/**
 * Cache invalidation strategy
 */
export type InvalidationStrategy =
  | "aggressive" // Invalidate all potentially affected queries
  | "conservative" // Only invalidate queries with direct file references
  | "disabled"; // No automatic invalidation

/**
 * Cache invalidation configuration
 */
export interface CacheInvalidationConfig {
  /** Invalidation strategy */
  strategy: InvalidationStrategy;

  /** Invalidate on file changes */
  onFileChange: boolean;

  /** Invalidate on index updates */
  onIndexUpdate: boolean;

  /** Track query-to-file mappings for precise invalidation */
  trackQueryFileMappings: boolean;
}
