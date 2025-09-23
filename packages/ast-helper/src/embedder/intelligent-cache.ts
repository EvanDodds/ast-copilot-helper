/**
 * Intelligent caching system for embedding results with LRU eviction,
 * content-based invalidation, and performance monitoring
 */

import crypto from 'crypto';
import type { EmbeddingResult, Annotation } from './types.js';
import { createLogger } from '../logging/index.js';

export interface CacheEntry {
  /** Cached embedding result */
  result: EmbeddingResult;
  /** Content hash for invalidation */
  contentHash: string;
  /** Timestamp of cache entry creation */
  timestamp: number;
  /** Number of times this entry has been accessed */
  accessCount: number;
  /** Last access timestamp */
  lastAccess: number;
  /** Size of the cached data in bytes */
  size: number;
}

export interface CacheConfig {
  /** Maximum number of entries in cache */
  maxEntries: number;
  /** Maximum cache size in bytes */
  maxSizeBytes: number;
  /** Time-to-live for cache entries in ms */
  ttlMs: number;
  /** Enable content-based invalidation */
  enableContentValidation: boolean;
  /** Cache hit ratio threshold for performance warnings */
  hitRatioThreshold: number;
}

export interface CacheStats {
  /** Total number of cache requests */
  totalRequests: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Cache hit ratio (0-1) */
  hitRatio: number;
  /** Current number of entries */
  currentEntries: number;
  /** Current cache size in bytes */
  currentSizeBytes: number;
  /** Cache utilization percentage */
  utilization: number;
  /** Average access time in ms */
  avgAccessTimeMs: number;
  /** Number of evictions */
  evictions: number;
}

export interface CachePerformanceMetrics {
  /** Cache statistics */
  stats: CacheStats;
  /** Recent performance samples */
  recentSamples: Array<{
    timestamp: number;
    hitRatio: number;
    accessTimeMs: number;
    sizeBytes: number;
  }>;
  /** Memory efficiency score (0-1) */
  memoryEfficiency: number;
  /** Performance score (0-1) */
  performanceScore: number;
}

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 10000,
  maxSizeBytes: 512 * 1024 * 1024, // 512MB
  ttlMs: 30 * 60 * 1000, // 30 minutes
  enableContentValidation: true,
  hitRatioThreshold: 0.7, // Warn if hit ratio falls below 70%
};

/**
 * Intelligent cache for embedding results with advanced features
 */
export class IntelligentEmbeddingCache {
  private cache = new Map<string, CacheEntry>();
  private accessTimes = new Map<string, number[]>();
  private config: CacheConfig;
  private stats: CacheStats;
  private performanceSamples: Array<{
    timestamp: number;
    hitRatio: number;
    accessTimeMs: number;
    sizeBytes: number;
  }> = [];
  private logger = createLogger({ operation: 'IntelligentEmbeddingCache' });

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.stats = {
      totalRequests: 0,
      hits: 0,
      misses: 0,
      hitRatio: 0,
      currentEntries: 0,
      currentSizeBytes: 0,
      utilization: 0,
      avgAccessTimeMs: 0,
      evictions: 0,
    };

    // Start periodic cleanup and metrics collection
    this.startPeriodicMaintenance();
  }

  /**
   * Get cached embedding result
   */
  async get(annotation: Annotation): Promise<EmbeddingResult | null> {
    const startTime = performance.now();
    this.stats.totalRequests++;

    try {
      const cacheKey = this.generateCacheKey(annotation);
      const entry = this.cache.get(cacheKey);

      if (!entry) {
        this.stats.misses++;
        this.recordAccess(cacheKey, performance.now() - startTime);
        return null;
      }

      // Check TTL
      if (Date.now() - entry.timestamp > this.config.ttlMs) {
        this.cache.delete(cacheKey);
        this.stats.misses++;
        this.recordAccess(cacheKey, performance.now() - startTime);
        return null;
      }

      // Content validation if enabled
      if (this.config.enableContentValidation) {
        const currentHash = this.calculateContentHash(annotation);
        if (currentHash !== entry.contentHash) {
          this.cache.delete(cacheKey);
          this.stats.misses++;
          this.recordAccess(cacheKey, performance.now() - startTime);
          return null;
        }
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccess = Date.now();
      this.stats.hits++;
      
      const accessTime = performance.now() - startTime;
      this.recordAccess(cacheKey, accessTime);

      this.logger.debug('Cache hit', {
        cacheKey: cacheKey.substring(0, 16) + '...',
        accessCount: entry.accessCount,
        accessTime: `${accessTime.toFixed(2)}ms`
      });

      return { ...entry.result }; // Return a copy to prevent mutations
    } catch (error: any) {
      this.logger.error('Cache access error', { error: error.message });
      this.stats.misses++;
      return null;
    } finally {
      this.updateStats();
    }
  }

  /**
   * Store embedding result in cache
   */
  async set(annotation: Annotation, result: EmbeddingResult): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(annotation);
      const contentHash = this.calculateContentHash(annotation);
      const resultSize = this.calculateResultSize(result);

      // Check if we need to evict entries
      await this.ensureCapacity(resultSize);

      const entry: CacheEntry = {
        result: { ...result }, // Store a copy to prevent mutations
        contentHash,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccess: Date.now(),
        size: resultSize,
      };

      this.cache.set(cacheKey, entry);
      this.stats.currentEntries = this.cache.size;
      this.stats.currentSizeBytes += resultSize;

      this.logger.debug('Cache entry stored', {
        cacheKey: cacheKey.substring(0, 16) + '...',
        size: `${(resultSize / 1024).toFixed(2)}KB`,
        totalEntries: this.cache.size
      });
    } catch (error: any) {
      this.logger.error('Cache storage error', { error: error.message });
    }
  }

  /**
   * Clear cache and reset statistics
   */
  clear(): void {
    this.cache.clear();
    this.accessTimes.clear();
    this.stats.currentEntries = 0;
    this.stats.currentSizeBytes = 0;
    this.logger.info('Cache cleared');
  }

  /**
   * Get current cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): CachePerformanceMetrics {
    const recentSamples = this.performanceSamples.slice(-100); // Last 100 samples
    
    const memoryEfficiency = this.config.maxSizeBytes > 0 
      ? Math.max(0, 1 - (this.stats.currentSizeBytes / this.config.maxSizeBytes))
      : 1;

    const performanceScore = (this.stats.hitRatio + memoryEfficiency) / 2;

    return {
      stats: this.getStats(),
      recentSamples,
      memoryEfficiency,
      performanceScore,
    };
  }

  /**
   * Optimize cache by removing least valuable entries
   */
  async optimize(): Promise<void> {
    this.logger.info('Starting cache optimization');

    // Remove expired entries
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttlMs) {
        this.cache.delete(key);
        this.stats.currentSizeBytes -= entry.size;
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.debug('Expired entries removed', { count: expiredCount });
    }

    // Update statistics
    this.stats.currentEntries = this.cache.size;
    this.updateStats();

    this.logger.info('Cache optimization completed', {
      entriesRemoved: expiredCount,
      currentEntries: this.stats.currentEntries,
      currentSize: `${(this.stats.currentSizeBytes / 1024 / 1024).toFixed(2)}MB`
    });
  }

  /**
   * Generate cache key for annotation
   */
  private generateCacheKey(annotation: Annotation): string {
    const keyData = {
      nodeId: annotation.nodeId,
      signature: annotation.signature,
      summary: annotation.summary,
      sourceSnippet: annotation.sourceSnippet || '',
      metadata: JSON.stringify(annotation.metadata || {}),
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * Calculate content hash for invalidation
   */
  private calculateContentHash(annotation: Annotation): string {
    const contentData = {
      signature: annotation.signature,
      summary: annotation.summary,
      sourceSnippet: annotation.sourceSnippet || '',
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(contentData))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Calculate size of embedding result in bytes
   */
  private calculateResultSize(result: EmbeddingResult): number {
    const jsonString = JSON.stringify(result);
    return Buffer.byteLength(jsonString, 'utf8');
  }

  /**
   * Ensure cache has capacity for new entry
   */
  private async ensureCapacity(newEntrySize: number): Promise<void> {
    // Check size limits
    while (this.stats.currentSizeBytes + newEntrySize > this.config.maxSizeBytes) {
      const evicted = this.evictLeastValuable();
      if (!evicted) {
break;
} // No more entries to evict
    }

    // Check entry count limits
    while (this.cache.size >= this.config.maxEntries) {
      const evicted = this.evictLeastValuable();
      if (!evicted) {
break;
} // No more entries to evict
    }
  }

  /**
   * Evict least valuable cache entry using LRU + access frequency
   */
  private evictLeastValuable(): boolean {
    if (this.cache.size === 0) {
return false;
}

    let leastValuableKey: string | null = null;
    let lowestScore = Infinity;

    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      // Calculate value score based on recency, frequency, and age
      const recencyScore = (now - entry.lastAccess) / this.config.ttlMs;
      const frequencyScore = 1 / Math.max(1, entry.accessCount);
      const ageScore = (now - entry.timestamp) / this.config.ttlMs;
      
      const totalScore = recencyScore + frequencyScore + ageScore;

      if (totalScore < lowestScore) {
        lowestScore = totalScore;
        leastValuableKey = key;
      }
    }

    if (leastValuableKey) {
      const entry = this.cache.get(leastValuableKey)!;
      this.cache.delete(leastValuableKey);
      this.accessTimes.delete(leastValuableKey);
      this.stats.currentSizeBytes -= entry.size;
      this.stats.evictions++;
      return true;
    }

    return false;
  }

  /**
   * Record access time for performance metrics
   */
  private recordAccess(key: string, timeMs: number): void {
    if (!this.accessTimes.has(key)) {
      this.accessTimes.set(key, []);
    }
    
    const times = this.accessTimes.get(key)!;
    times.push(timeMs);
    
    // Keep only recent access times
    if (times.length > 10) {
      times.shift();
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.hitRatio = this.stats.totalRequests > 0 
      ? this.stats.hits / this.stats.totalRequests 
      : 0;
    
    this.stats.currentEntries = this.cache.size;
    this.stats.utilization = this.config.maxEntries > 0 
      ? this.stats.currentEntries / this.config.maxEntries 
      : 0;

    // Calculate average access time
    const allTimes = Array.from(this.accessTimes.values()).flat();
    this.stats.avgAccessTimeMs = allTimes.length > 0 
      ? allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length 
      : 0;

    // Record performance sample
    this.performanceSamples.push({
      timestamp: Date.now(),
      hitRatio: this.stats.hitRatio,
      accessTimeMs: this.stats.avgAccessTimeMs,
      sizeBytes: this.stats.currentSizeBytes,
    });

    // Keep only recent samples
    if (this.performanceSamples.length > 1000) {
      this.performanceSamples.shift();
    }

    // Warn if hit ratio is below threshold
    if (this.stats.totalRequests > 100 && this.stats.hitRatio < this.config.hitRatioThreshold) {
      this.logger.warn('Cache hit ratio below threshold', {
        hitRatio: (this.stats.hitRatio * 100).toFixed(1) + '%',
        threshold: (this.config.hitRatioThreshold * 100).toFixed(1) + '%'
      });
    }
  }

  /**
   * Start periodic maintenance tasks
   */
  private startPeriodicMaintenance(): void {
    setInterval(async () => {
      await this.optimize();
    }, 5 * 60 * 1000); // Every 5 minutes

    setInterval(() => {
      this.updateStats();
    }, 30 * 1000); // Every 30 seconds
  }
}

/**
 * Singleton cache instance for embedding results
 */
let globalCache: IntelligentEmbeddingCache | null = null;

/**
 * Get or create global embedding cache instance
 */
export function getEmbeddingCache(config?: Partial<CacheConfig>): IntelligentEmbeddingCache {
  if (!globalCache) {
    globalCache = new IntelligentEmbeddingCache(config);
  }
  return globalCache;
}

/**
 * Reset global cache instance (primarily for testing)
 */
export function resetEmbeddingCache(): void {
  if (globalCache) {
    globalCache.clear();
  }
  globalCache = null;
}