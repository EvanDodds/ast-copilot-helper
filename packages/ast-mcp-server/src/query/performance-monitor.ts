/**
 * @fileoverview Performance Monitoring and Caching System
 * 
 * Implements comprehensive performance tracking, caching mechanisms, and optimization
 * features to meet the <200ms query processing requirement for the MCP Server Query System.
 */

import { createLogger } from '../../../ast-helper/src/logging/index.js';

import type {
  MCPQuery,
  QueryResponse,
  PerformanceMetrics,
} from './types.js';

/**
 * Cache entry structure
 */
interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Cache configuration
 */
interface CacheConfig {
  /** Maximum number of entries in cache */
  maxEntries: number;
  
  /** Default TTL in milliseconds */
  defaultTtl: number;
  
  /** Cache cleanup interval in milliseconds */
  cleanupInterval: number;
  
  /** Enable cache compression */
  enableCompression: boolean;
  
  /** Cache hit ratio threshold for performance alerts */
  hitRatioThreshold: number;
}

/**
 * Performance monitoring configuration
 */
interface PerformanceConfig {
  /** Enable detailed performance tracking */
  enableDetailedTracking: boolean;
  
  /** Metric collection interval in milliseconds */
  metricCollectionInterval: number;
  
  /** Alert threshold for query time (ms) */
  queryTimeAlert: number;
  
  /** Alert threshold for memory usage (bytes) */
  memoryUsageAlert: number;
  
  /** Enable performance alerts */
  enableAlerts: boolean;
}

/**
 * Cache statistics
 */
interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRatio: number;
  totalEntries: number;
  memoryUsage: number;
  evictionCount: number;
  compressionRatio?: number;
}

/**
 * Performance alert structure
 */
interface PerformanceAlert {
  type: 'query_time' | 'memory_usage' | 'cache_hit_ratio' | 'error_rate';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  metrics: Record<string, number>;
}

/**
 * LRU Cache implementation optimized for query responses
 */
class LRUCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;
  private logger = createLogger({ operation: 'query-cache' });
  
  // Statistics
  private stats: CacheStats = {
    hitCount: 0,
    missCount: 0,
    hitRatio: 0,
    totalEntries: 0,
    memoryUsage: 0,
    evictionCount: 0,
  };
  
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    this.config = config;
    
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, config.cleanupInterval);
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.missCount++;
      this.updateHitRatio();
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.missCount++;
      this.updateHitRatio();
      return null;
    }
    
    // Update access information
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.stats.hitCount++;
    this.updateHitRatio();
    
    this.logger.debug('Cache hit', { key, accessCount: entry.accessCount });
    
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    
    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Evict least recently used entries if at capacity
    while (this.cache.size >= this.config.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictionCount++;
      } else {
        break; // Safety check
      }
    }
    
    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      ttl: ttl || this.config.defaultTtl,
      accessCount: 0,
      lastAccessed: now,
    };
    
    this.cache.set(key, entry);
    this.stats.totalEntries = this.cache.size;
    
    this.logger.debug('Cache set', { key, ttl: entry.ttl });
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
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
    
    this.stats.totalEntries = this.cache.size;
    
    if (keysToDelete.length > 0) {
      this.logger.debug('Cache cleanup', { expiredEntries: keysToDelete.length });
    }
  }

  /**
   * Update hit ratio calculation
   */
  private updateHitRatio(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRatio = total > 0 ? this.stats.hitCount / total : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.stats.totalEntries = this.cache.size;
    this.stats.memoryUsage = this.estimateMemoryUsage();
    return { ...this.stats };
  }

  /**
   * Estimate memory usage of cache
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2; // UTF-16 encoding
      totalSize += JSON.stringify(entry.value).length * 2;
      totalSize += 48; // Overhead for entry object
    }
    
    return totalSize;
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hitCount: 0,
      missCount: 0,
      hitRatio: 0,
      totalEntries: 0,
      memoryUsage: 0,
      evictionCount: 0,
    };
    
    this.logger.info('Cache cleared');
  }

  /**
   * Shutdown cache
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

/**
 * Performance Monitoring and Caching System
 * 
 * Central component for tracking query performance, managing caches, and ensuring
 * the <200ms performance requirement is met consistently.
 */
export class PerformanceMonitor {
  private logger = createLogger({ operation: 'performance-monitor' });
  
  // Configuration
  private cacheConfig: CacheConfig;
  private performanceConfig: PerformanceConfig;
  
  // Caches
  private queryCache: LRUCache<QueryResponse>;
  private embeddingCache: LRUCache<number[]>;
  private metadataCache: LRUCache<any>;
  
  // Performance tracking
  private metrics: PerformanceMetrics = {
    p50QueryTime: 0,
    p95QueryTime: 0,
    p99QueryTime: 0,
    memoryUsage: 0,
    peakMemoryUsage: 0,
    concurrentQueries: 0,
  };
  
  private queryTimes: number[] = [];
  private alerts: PerformanceAlert[] = [];
  private metricsTimer?: NodeJS.Timeout;
  
  // Statistics
  private totalQueries = 0;
  private cacheableQueries = 0;
  private optimizedQueries = 0;

  constructor(
    cacheConfig: Partial<CacheConfig> = {},
    performanceConfig: Partial<PerformanceConfig> = {}
  ) {
    // Initialize cache configuration with defaults
    this.cacheConfig = {
      maxEntries: 1000,
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      enableCompression: false,
      hitRatioThreshold: 0.7,
      ...cacheConfig,
    };
    
    // Initialize performance configuration with defaults
    this.performanceConfig = {
      enableDetailedTracking: true,
      metricCollectionInterval: 30 * 1000, // 30 seconds
      queryTimeAlert: 150, // Alert at 150ms (before 200ms limit)
      memoryUsageAlert: 512 * 1024 * 1024, // 512MB
      enableAlerts: true,
      ...performanceConfig,
    };
    
    // Initialize caches
    this.queryCache = new LRUCache<QueryResponse>(this.cacheConfig);
    this.embeddingCache = new LRUCache<number[]>(this.cacheConfig);
    this.metadataCache = new LRUCache<any>(this.cacheConfig);
    
    // Start metrics collection
    if (this.performanceConfig.enableDetailedTracking) {
      this.startMetricsCollection();
    }
    
    this.logger.info('Performance monitor initialized', {
      cacheConfig: this.cacheConfig,
      performanceConfig: this.performanceConfig,
    });
  }

  /**
   * Generate cache key for query
   */
  generateQueryCacheKey(query: MCPQuery): string {
    const keyComponents = [
      query.type,
      query.text,
      JSON.stringify(query.options || {}),
      query.maxResults?.toString() || '',
      query.minScore?.toString() || '',
    ];
    
    return `query:${Buffer.from(keyComponents.join('|')).toString('base64')}`;
  }

  /**
   * Get cached query response
   */
  getCachedQueryResponse(query: MCPQuery): QueryResponse | null {
    const cacheKey = this.generateQueryCacheKey(query);
    return this.queryCache.get(cacheKey);
  }

  /**
   * Cache query response
   */
  cacheQueryResponse(query: MCPQuery, response: QueryResponse): void {
    const cacheKey = this.generateQueryCacheKey(query);
    
    // Cache all responses, including empty ones, but limit very large result sets
    if (response.results.length < 100) {
      this.queryCache.set(cacheKey, response);
      this.cacheableQueries++;
    }
  }

  /**
   * Get cached embedding
   */
  getCachedEmbedding(text: string): number[] | null {
    const cacheKey = `embedding:${Buffer.from(text).toString('base64')}`;
    return this.embeddingCache.get(cacheKey);
  }

  /**
   * Cache embedding
   */
  cacheEmbedding(text: string, embedding: number[]): void {
    const cacheKey = `embedding:${Buffer.from(text).toString('base64')}`;
    this.embeddingCache.set(cacheKey, embedding, this.cacheConfig.defaultTtl * 2); // Longer TTL for embeddings
  }

  /**
   * Track query performance
   */
  trackQueryPerformance(queryTime: number, query: MCPQuery): void {
    this.totalQueries++;
    this.queryTimes.push(queryTime);
    
    // Keep only recent query times for percentile calculations
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }
    
    // Check for performance alerts
    if (this.performanceConfig.enableAlerts && queryTime > this.performanceConfig.queryTimeAlert) {
      this.addAlert({
        type: 'query_time',
        severity: queryTime > 200 ? 'critical' : 'warning',
        message: `Query processing time ${queryTime}ms exceeds threshold ${this.performanceConfig.queryTimeAlert}ms`,
        timestamp: new Date(),
        metrics: {
          queryTime,
          threshold: this.performanceConfig.queryTimeAlert,
          queryType: query.type === 'semantic' ? 1 : 0,
        },
      });
    }
    
    // Update metrics
    this.updatePerformanceMetrics();
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    if (this.queryTimes.length === 0) return;
    
    const sortedTimes = [...this.queryTimes].sort((a, b) => a - b);
    const count = sortedTimes.length;
    
    this.metrics.p50QueryTime = sortedTimes[Math.floor(count * 0.5)] ?? 0;
    this.metrics.p95QueryTime = sortedTimes[Math.floor(count * 0.95)] ?? 0;
    this.metrics.p99QueryTime = sortedTimes[Math.floor(count * 0.99)] ?? 0;
    
    // Update memory usage
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryUsage = memoryUsage.heapUsed;
    this.metrics.peakMemoryUsage = Math.max(this.metrics.peakMemoryUsage, memoryUsage.heapUsed);
    
    // Check memory alerts
    if (this.performanceConfig.enableAlerts && memoryUsage.heapUsed > this.performanceConfig.memoryUsageAlert) {
      this.addAlert({
        type: 'memory_usage',
        severity: memoryUsage.heapUsed > this.performanceConfig.memoryUsageAlert * 1.5 ? 'critical' : 'warning',
        message: `Memory usage ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB exceeds threshold`,
        timestamp: new Date(),
        metrics: {
          memoryUsage: memoryUsage.heapUsed,
          threshold: this.performanceConfig.memoryUsageAlert,
        },
      });
    }
  }

  /**
   * Add performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    
    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
    
    this.logger.warn('Performance alert', {
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      metrics: alert.metrics,
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, this.performanceConfig.metricCollectionInterval);
  }

  /**
   * Collect and log metrics
   */
  private collectMetrics(): void {
    const queryCacheStats = this.queryCache.getStats();
    const embeddingCacheStats = this.embeddingCache.getStats();
    
    // Check cache hit ratio alerts
    if (queryCacheStats.hitRatio < this.cacheConfig.hitRatioThreshold) {
      this.addAlert({
        type: 'cache_hit_ratio',
        severity: 'warning',
        message: `Query cache hit ratio ${queryCacheStats.hitRatio.toFixed(2)} below threshold ${this.cacheConfig.hitRatioThreshold}`,
        timestamp: new Date(),
        metrics: {
          hitRatio: queryCacheStats.hitRatio,
          threshold: this.cacheConfig.hitRatioThreshold,
        },
      });
    }
    
    this.logger.debug('Performance metrics collected', {
      performance: this.metrics,
      queryCache: queryCacheStats,
      embeddingCache: embeddingCacheStats,
      totalQueries: this.totalQueries,
      optimizedQueries: this.optimizedQueries,
    });
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats() {
    return {
      metrics: this.metrics,
      queryCache: this.queryCache.getStats(),
      embeddingCache: this.embeddingCache.getStats(),
      metadataCache: this.metadataCache.getStats(),
      totalQueries: this.totalQueries,
      cacheableQueries: this.cacheableQueries,
      optimizedQueries: this.optimizedQueries,
      cacheHitImprovement: this.cacheableQueries > 0 ? this.optimizedQueries / this.cacheableQueries : 0,
      alerts: this.alerts.slice(-10), // Recent alerts
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.queryCache.clear();
    this.embeddingCache.clear();
    this.metadataCache.clear();
    
    this.logger.info('All caches cleared');
  }

  /**
   * Shutdown performance monitor
   */
  shutdown(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    this.queryCache.shutdown();
    this.embeddingCache.shutdown();
    this.metadataCache.shutdown();
    
    this.logger.info('Performance monitor shut down');
  }

  /**
   * Get recent performance alerts
   */
  getAlerts(limit = 20): PerformanceAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Update configuration
   */
  updateConfiguration(
    cacheConfig?: Partial<CacheConfig>,
    performanceConfig?: Partial<PerformanceConfig>
  ): void {
    if (cacheConfig) {
      this.cacheConfig = { ...this.cacheConfig, ...cacheConfig };
    }
    
    if (performanceConfig) {
      this.performanceConfig = { ...this.performanceConfig, ...performanceConfig };
    }
    
    this.logger.info('Performance monitor configuration updated', {
      cacheConfig: this.cacheConfig,
      performanceConfig: this.performanceConfig,
    });
  }
}