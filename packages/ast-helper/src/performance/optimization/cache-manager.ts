/**
 * Cache Manager - Advanced Caching System
 * Part of Issue #150 - Performance Optimization Component
 */

import type {
  CacheMetrics,
  CacheOptimizationConfig,
  PerformanceAlert,
} from "./types.js";
import { EvictionPolicy, AlertType, AlertSeverity } from "./types.js";
import { createLogger } from "../../logging/index.js";

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  ttl?: number;
}

/**
 * Advanced Cache Manager with multiple eviction policies and monitoring
 */
export class CacheManager<K = string, V = unknown> {
  private logger = createLogger({ operation: "cache-manager" });
  private config: CacheOptimizationConfig;
  private cache = new Map<K, CacheEntry<V>>();
  private accessOrder: K[] = []; // For LRU
  private accessFrequency = new Map<K, number>(); // For LFU
  private metrics: CacheMetrics;
  private monitoringTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private alerts: PerformanceAlert[] = [];

  constructor(config: CacheOptimizationConfig) {
    this.config = config;
    this.metrics = this.initializeMetrics();
    this.startMonitoring();
    this.logger.info("Cache Manager initialized", {
      maxSize: config.maxSize,
      evictionPolicy: config.evictionPolicy,
      ttl: config.ttl,
    });
  }

  /**
   * Initialize cache metrics
   */
  private initializeMetrics(): CacheMetrics {
    return {
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      evictions: 0,
      size: 0,
      maxSize: this.config.maxSize,
      memoryUsage: 0,
    };
  }

  /**
   * Get value from cache
   */
  public get(key: K): V | undefined {
    this.metrics.totalRequests++;

    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.totalMisses++;
      this.updateHitRate();
      return undefined;
    }

    // Check TTL expiration
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.metrics.totalMisses++;
      this.updateHitRate();
      return undefined;
    }

    // Update access metadata
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.updateAccessOrder(key);
    this.updateAccessFrequency(key);

    this.metrics.totalHits++;
    this.updateHitRate();

    return entry.value;
  }

  /**
   * Set value in cache
   */
  public set(key: K, value: V, ttl?: number): void {
    const size = this.estimateSize(value);
    const now = Date.now();

    const entry: CacheEntry<V> = {
      value,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      size,
      ttl,
    };

    // Check if we need to evict entries
    if (
      this.cache.size >= this.config.maxSize ||
      this.getMemoryUsage() + size > this.config.maxMemory
    ) {
      this.evictEntries(size);
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.updateAccessFrequency(key);

    this.metrics.size = this.cache.size;
    this.updateMemoryUsage();

    this.logger.debug("Cache entry set", {
      key,
      size,
      cacheSize: this.cache.size,
    });
  }

  /**
   * Check if cache has key
   */
  public has(key: K): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Delete entry from cache
   */
  public delete(key: K): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.removeFromAccessOrder(key);
      this.accessFrequency.delete(key);
      this.metrics.size = this.cache.size;
      this.updateMemoryUsage();
    }
    return existed;
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.accessFrequency.clear();
    this.metrics.size = 0;
    this.metrics.memoryUsage = 0;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<V>): boolean {
    const ttl = entry.ttl ?? this.config.ttl;
    return ttl > 0 && Date.now() - entry.timestamp > ttl;
  }

  /**
   * Evict entries based on configured policy
   */
  private evictEntries(requiredSpace: number): void {
    let freedSpace = 0;
    const targetSpace = requiredSpace * 1.5; // Free 50% more than needed

    while (freedSpace < targetSpace && this.cache.size > 0) {
      const keyToEvict = this.selectEvictionCandidate();
      if (!keyToEvict) {
        break;
      }

      const entry = this.cache.get(keyToEvict);
      if (entry) {
        freedSpace += entry.size;
        this.cache.delete(keyToEvict);
        this.removeFromAccessOrder(keyToEvict);
        this.accessFrequency.delete(keyToEvict);
        this.metrics.evictions++;
      }
    }

    this.metrics.size = this.cache.size;
    this.updateMemoryUsage();

    this.logger.debug("Cache eviction completed", {
      evictedEntries: this.metrics.evictions,
      freedSpace,
      currentSize: this.cache.size,
    });
  }

  /**
   * Select eviction candidate based on policy
   */
  private selectEvictionCandidate(): K | undefined {
    switch (this.config.evictionPolicy) {
      case EvictionPolicy.LRU:
        return this.accessOrder[0];

      case EvictionPolicy.LFU:
        return this.getLeastFrequentlyUsed();

      case EvictionPolicy.FIFO:
        return this.getOldestEntry();

      case EvictionPolicy.TTL:
        return this.getExpiredEntry();

      case EvictionPolicy.RANDOM:
        return this.getRandomEntry();

      default:
        return this.accessOrder[0]; // Default to LRU
    }
  }

  /**
   * Get least frequently used key
   */
  private getLeastFrequentlyUsed(): K | undefined {
    let minFrequency = Infinity;
    let leastUsedKey: K | undefined;

    for (const [key, frequency] of this.accessFrequency.entries()) {
      if (frequency < minFrequency) {
        minFrequency = frequency;
        leastUsedKey = key;
      }
    }

    return leastUsedKey;
  }

  /**
   * Get oldest entry (FIFO)
   */
  private getOldestEntry(): K | undefined {
    let oldestTime = Infinity;
    let oldestKey: K | undefined;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Get expired entry
   */
  private getExpiredEntry(): K | undefined {
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        return key;
      }
    }
    return undefined;
  }

  /**
   * Get random entry
   */
  private getRandomEntry(): K | undefined {
    const keys = Array.from(this.cache.keys());
    if (keys.length === 0) {
      return undefined;
    }
    const randomIndex = Math.floor(Math.random() * keys.length);
    return keys[randomIndex];
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: K): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Update access frequency for LFU
   */
  private updateAccessFrequency(key: K): void {
    const current = this.accessFrequency.get(key) ?? 0;
    this.accessFrequency.set(key, current + 1);
  }

  /**
   * Update hit rate metrics
   */
  private updateHitRate(): void {
    this.metrics.hitRate =
      this.metrics.totalRequests > 0
        ? this.metrics.totalHits / this.metrics.totalRequests
        : 0;
    this.metrics.missRate = 1 - this.metrics.hitRate;
  }

  /**
   * Estimate memory size of value
   */
  private estimateSize(value: V): number {
    try {
      if (typeof value === "string") {
        return value.length * 2; // UTF-16 encoding
      }
      if (typeof value === "number") {
        return 8; // 64-bit number
      }
      if (typeof value === "boolean") {
        return 4;
      }
      if (value === null || value === undefined) {
        return 0;
      }
      // For objects, use JSON string length as approximation
      return JSON.stringify(value).length * 2;
    } catch {
      return 1024; // Default size if estimation fails
    }
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Update memory usage metrics
   */
  private updateMemoryUsage(): void {
    this.metrics.memoryUsage = this.getMemoryUsage();
  }

  /**
   * Start monitoring cache performance
   */
  private startMonitoring(): void {
    if (!this.config.enabled) {
      return;
    }

    // Performance monitoring
    this.monitoringTimer = setInterval(() => {
      this.checkCacheHealth();
    }, 10000); // Check every 10 seconds

    // Cleanup expired entries
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Cleanup every minute
  }

  /**
   * Check cache health and generate alerts
   */
  private checkCacheHealth(): void {
    // Low hit rate alert
    if (this.metrics.totalRequests > 100 && this.metrics.hitRate < 0.5) {
      this.generateAlert({
        type: AlertType.CACHE_LOW_HIT_RATE,
        severity: AlertSeverity.WARNING,
        metric: "hit_rate",
        currentValue: this.metrics.hitRate,
        threshold: 0.5,
        message: `Low cache hit rate: ${(this.metrics.hitRate * 100).toFixed(1)}%`,
        recommendations: [
          "Review cache TTL settings",
          "Increase cache size",
          "Optimize cache keys",
          "Enable cache warming",
        ],
      });
    }

    // High memory usage alert
    const memoryUsageRatio = this.metrics.memoryUsage / this.config.maxMemory;
    if (memoryUsageRatio > 0.9) {
      this.generateAlert({
        type: AlertType.MEMORY_HIGH,
        severity: AlertSeverity.WARNING,
        metric: "cache_memory",
        currentValue: memoryUsageRatio,
        threshold: 0.9,
        message: `High cache memory usage: ${(memoryUsageRatio * 100).toFixed(1)}%`,
        recommendations: [
          "Increase max memory limit",
          "Reduce cache TTL",
          "Optimize data structures",
          "Enable compression",
        ],
      });
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpiredEntries(): void {
    const keysToDelete: K[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.logger.debug("Expired entries cleaned up", {
        expiredCount: keysToDelete.length,
        currentSize: this.cache.size,
      });
    }
  }

  /**
   * Generate performance alert
   */
  private generateAlert(
    alertData: Omit<PerformanceAlert, "id" | "timestamp" | "resolved">,
  ): void {
    const alert: PerformanceAlert = {
      id: `cache-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false,
      ...alertData,
    };

    this.alerts.push(alert);
    this.logger.warn("Cache performance alert generated", alert);
  }

  /**
   * Warm cache with preloaded keys
   */
  public async warmCache(dataLoader: (key: K) => Promise<V>): Promise<void> {
    if (!this.config.warmupEnabled || this.config.preloadKeys.length === 0) {
      return;
    }

    this.logger.info("Starting cache warmup", {
      keysToPreload: this.config.preloadKeys.length,
    });

    const warmupPromises = this.config.preloadKeys.map(async (key) => {
      try {
        const value = await dataLoader(key as K);
        this.set(key as K, value);
      } catch (error) {
        this.logger.warn("Cache warmup failed for key", {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(warmupPromises);
    this.logger.info("Cache warmup completed", { cacheSize: this.cache.size });
  }

  /**
   * Get cache metrics
   */
  public getMetrics(): CacheMetrics {
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  public getStats(): {
    metrics: CacheMetrics;
    alerts: PerformanceAlert[];
    entries: number;
    memoryUsage: string;
    topKeys: Array<{ key: K; accessCount: number; size: number }>;
  } {
    const topKeys = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount,
        size: entry.size,
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    return {
      metrics: this.getMetrics(),
      alerts: [...this.alerts],
      entries: this.cache.size,
      memoryUsage: `${(this.metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
      topKeys,
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<CacheOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info("Cache manager configuration updated", config);
  }

  /**
   * Shutdown cache manager
   */
  public shutdown(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
    this.logger.info("Cache manager shutdown");
  }
}
