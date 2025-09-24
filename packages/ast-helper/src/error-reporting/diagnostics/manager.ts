/**
 * Diagnostic manager for coordinating diagnostic data collection
 */

import type {
  DiagnosticCollector,
  DiagnosticCollectorConfig,
  DiagnosticCacheEntry,
  DiagnosticCollectionContext,
  DiagnosticScope,
} from "./types.js";
import type { DiagnosticData } from "../types.js";
import { SystemDiagnosticCollector } from "./system-collector.js";
import { RuntimeDiagnosticCollector } from "./runtime-collector.js";
import { CodebaseDiagnosticCollector } from "./codebase-collector.js";

/**
 * Performance metrics for diagnostic collection
 */
interface CollectionMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  collectorsRun: number;
  collectorsSkipped: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
}

/**
 * Manages diagnostic data collection across multiple collectors
 */
export class DiagnosticManager {
  private collectors: Map<string, DiagnosticCollector> = new Map();
  private cache: Map<string, DiagnosticCacheEntry> = new Map();
  private config: DiagnosticCollectorConfig;
  private isCollecting = false;

  constructor(config?: Partial<DiagnosticCollectorConfig>) {
    this.config = {
      enabled: true,
      timeout: 10000, // 10 seconds
      retryAttempts: 2,
      cacheTTL: 60000, // 1 minute
      privacyLevel: "standard",
      includeEnvironment: true,
      includeFileSystem: true,
      includeGitInfo: true,
      includeNetworkInfo: true,
      excludePatterns: [
        "node_modules/**",
        ".git/**",
        "dist/**",
        "build/**",
        "coverage/**",
        "**/*.log",
      ],
      maxFileSize: 1024 * 1024, // 1MB
      maxDirectoryDepth: 5,
      performanceThreshold: 5000, // 5 seconds
      ...config,
    };

    this.initializeCollectors();
  }

  /**
   * Initialize default collectors
   */
  private initializeCollectors() {
    this.registerCollector(new SystemDiagnosticCollector());
    this.registerCollector(new RuntimeDiagnosticCollector());
    this.registerCollector(new CodebaseDiagnosticCollector());
  }

  /**
   * Register a diagnostic collector
   */
  registerCollector(collector: DiagnosticCollector): void {
    this.collectors.set(collector.name, collector);
  }

  /**
   * Unregister a diagnostic collector
   */
  unregisterCollector(name: string): void {
    this.collectors.delete(name);
  }

  /**
   * Get list of registered collectors
   */
  getCollectors(): DiagnosticCollector[] {
    return Array.from(this.collectors.values());
  }

  /**
   * Collect diagnostic data from all available collectors
   */
  async collectDiagnostics(
    context?: Partial<DiagnosticCollectionContext>,
  ): Promise<{
    data: Partial<DiagnosticData>;
    metrics: CollectionMetrics;
  }> {
    if (!this.config.enabled || this.isCollecting) {
      return {
        data: {},
        metrics: this.createEmptyMetrics(),
      };
    }

    this.isCollecting = true;
    const startTime = Date.now();

    const collectionContext: DiagnosticCollectionContext = {
      triggeredBy: "error",
      timestamp: startTime,
      sessionId: this.generateSessionId(),
      timeout: this.config.timeout,
      privacyLevel: this.config.privacyLevel,
      includeCache: true,
      forceRefresh: false,
      collectors: Array.from(this.collectors.keys()),
      ...context,
    };

    const metrics: CollectionMetrics = {
      startTime,
      endTime: 0,
      duration: 0,
      collectorsRun: 0,
      collectorsSkipped: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
    };

    try {
      // Sort collectors by priority (higher priority first)
      const sortedCollectors = Array.from(this.collectors.values()).sort(
        (a, b) => (b.priority || 0) - (a.priority || 0),
      );

      const diagnosticData: Partial<DiagnosticData> = {};

      // Collect data from each collector
      for (const collector of sortedCollectors) {
        try {
          const collectorData = await this.collectFromCollector(
            collector,
            collectionContext,
            metrics,
          );

          if (collectorData) {
            Object.assign(diagnosticData, collectorData);
            metrics.collectorsRun++;
          } else {
            metrics.collectorsSkipped++;
          }
        } catch (error) {
          metrics.errors++;
          console.warn(`Diagnostic collector ${collector.name} failed:`, error);
        }
      }

      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;

      return {
        data: diagnosticData,
        metrics,
      };
    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * Collect data from a specific collector
   */
  private async collectFromCollector(
    collector: DiagnosticCollector,
    context: DiagnosticCollectionContext,
    metrics: CollectionMetrics,
  ): Promise<Partial<DiagnosticData> | null> {
    // Check cache first
    const cacheKey = this.getCacheKey(collector, context);
    const cachedEntry = this.cache.get(cacheKey);

    if (cachedEntry && this.isCacheValid(cachedEntry)) {
      metrics.cacheHits++;
      return cachedEntry.data;
    }

    metrics.cacheMisses++;

    // Check if collector can run
    if (!(await collector.canCollect())) {
      return null;
    }

    // Collect with timeout
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error("Collector timeout")), context.timeout);
    });

    try {
      const collectionPromise = collector.collect();
      const data = await Promise.race([collectionPromise, timeoutPromise]);

      if (data) {
        // Cache the result
        const cacheEntry: DiagnosticCacheEntry = {
          data,
          timestamp: Date.now(),
          ttl: collector.cacheTTL || this.config.cacheTTL,
          collector: collector.name,
          version: "1.0.0",
        };

        this.cache.set(cacheKey, cacheEntry);

        // Clean up old cache entries
        this.cleanupCache();

        return data;
      }
    } catch (error) {
      throw new Error(`Collector ${collector.name} failed: ${error}`);
    }

    return null;
  }

  /**
   * Generate cache key for collector and context
   */
  private getCacheKey(
    collector: DiagnosticCollector,
    context: DiagnosticCollectionContext,
  ): string {
    const contextHash = [
      collector.name,
      context.privacyLevel,
      context.includeCache ? "1" : "0",
    ].join("|");

    return contextHash;
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(entry: DiagnosticCacheEntry): boolean {
    const now = Date.now();
    return now - entry.timestamp < entry.ttl;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isCacheValid(entry)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached diagnostic data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{
      key: string;
      collector: string;
      timestamp: number;
      age: number;
      valid: boolean;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      collector: entry.collector,
      timestamp: entry.timestamp,
      age: now - entry.timestamp,
      valid: this.isCacheValid(entry),
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DiagnosticCollectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): DiagnosticCollectorConfig {
    return { ...this.config };
  }

  /**
   * Get estimated collection time for all collectors
   */
  getEstimatedCollectionTime(): number {
    return Array.from(this.collectors.values()).reduce(
      (total, collector) => total + collector.estimateCollectionTime(),
      0,
    );
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `diag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): CollectionMetrics {
    return {
      startTime: 0,
      endTime: 0,
      duration: 0,
      collectorsRun: 0,
      collectorsSkipped: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
    };
  }

  /**
   * Get diagnostic data for specific scopes
   */
  async collectSpecificDiagnostics(
    scopes: DiagnosticScope[],
    context?: Partial<DiagnosticCollectionContext>,
  ): Promise<{
    data: Partial<DiagnosticData>;
    metrics: CollectionMetrics;
  }> {
    if (!this.config.enabled || this.isCollecting) {
      return {
        data: {},
        metrics: this.createEmptyMetrics(),
      };
    }

    // Temporarily disable collectors not in the requested scopes
    const originalCollectors = new Map(this.collectors);

    // Keep only collectors with requested scopes
    for (const [name, collector] of this.collectors) {
      if (!scopes.includes(collector.scope)) {
        this.collectors.delete(name);
      }
    }

    try {
      const result = await this.collectDiagnostics(context);
      return result;
    } finally {
      // Restore original collectors
      this.collectors = originalCollectors;
    }
  }
}
