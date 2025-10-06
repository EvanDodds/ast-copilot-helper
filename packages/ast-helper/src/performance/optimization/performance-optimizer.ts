/**
 * Performance Optimizer - Main Coordinator for Performance Optimization
 * Part of Issue #150 - Performance Optimization Component
 */

import type {
  PerformanceMetrics,
  PerformanceOptimizationConfig,
  OptimizationResults,
  PerformanceAlert,
  PerformanceImprovements,
  AppliedOptimization,
} from "./types.js";
import {
  DEFAULT_PERFORMANCE_OPTIMIZATION_CONFIG,
  OptimizationType,
  AlertSeverity,
} from "./types.js";
import { MemoryManager } from "./memory-manager.js";
import { CacheManager } from "./cache-manager.js";
import { BatchProcessor } from "./batch-processor.js";
import { createLogger } from "../../logging/index.js";

/**
 * Main Performance Optimizer - coordinates all optimization components
 */
export class PerformanceOptimizer {
  private logger = createLogger({ operation: "performance-optimizer" });
  private config: PerformanceOptimizationConfig;
  private memoryManager: MemoryManager;
  private cacheManager: CacheManager;
  private batchProcessors = new Map<string, BatchProcessor<unknown, unknown>>();
  private isEnabled = true;
  private optimizationHistory: OptimizationResults[] = [];
  private monitoringTimer?: NodeJS.Timeout;

  constructor(config: Partial<PerformanceOptimizationConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_OPTIMIZATION_CONFIG, ...config };

    // Initialize optimization components
    this.memoryManager = new MemoryManager(this.config.memory);
    this.cacheManager = new CacheManager(this.config.cache);

    this.startGlobalMonitoring();

    this.logger.info("Performance Optimizer initialized", {
      enabled: this.isEnabled,
      components: this.getEnabledComponents(),
    });
  }

  /**
   * Create a batch processor for specific operations
   */
  public createBatchProcessor<T, R = unknown>(
    name: string,
    processor: (item: T) => Promise<R>,
    config?: Partial<typeof this.config.processing>,
  ): BatchProcessor<T, R> {
    const processingConfig = { ...this.config.processing, ...config };
    const batchProcessor = new BatchProcessor(processingConfig, processor);

    this.batchProcessors.set(
      name,
      batchProcessor as BatchProcessor<unknown, unknown>,
    );

    this.logger.info("Batch processor created", {
      name,
      config: processingConfig,
    });
    return batchProcessor;
  }

  /**
   * Get batch processor by name
   */
  public getBatchProcessor<T, R = unknown>(
    name: string,
  ): BatchProcessor<T, R> | undefined {
    return this.batchProcessors.get(name) as BatchProcessor<T, R> | undefined;
  }

  /**
   * Perform comprehensive performance optimization
   */
  public async optimize(): Promise<OptimizationResults> {
    const startTime = Date.now();
    const performanceBefore = await this.collectMetrics();

    this.logger.info("Starting performance optimization", {
      memoryUsage: performanceBefore.memory.heapUsed,
      cacheHitRate: performanceBefore.cache.hitRate,
      processingThroughput: performanceBefore.processing.throughput,
    });

    const optimizations: AppliedOptimization[] = [];
    const recommendations: string[] = [];

    try {
      // Memory optimization
      if (this.config.memory.enabled) {
        const memoryOpt = await this.optimizeMemory();
        optimizations.push(...memoryOpt.optimizations);
        recommendations.push(...memoryOpt.recommendations);
      }

      // Cache optimization
      if (this.config.cache.enabled) {
        const cacheOpt = await this.optimizeCache();
        optimizations.push(...cacheOpt.optimizations);
        recommendations.push(...cacheOpt.recommendations);
      }

      // Processing optimization
      if (this.config.processing.enabled) {
        const processingOpt = await this.optimizeProcessing();
        optimizations.push(...processingOpt.optimizations);
        recommendations.push(...processingOpt.recommendations);
      }

      const performanceAfter = await this.collectMetrics();
      const improvements = this.calculateImprovements(
        performanceBefore,
        performanceAfter,
      );

      const results: OptimizationResults = {
        optimizations,
        performanceBefore,
        performanceAfter,
        improvements,
        recommendations,
      };

      this.optimizationHistory.push(results);

      // Keep only last 10 optimization results
      if (this.optimizationHistory.length > 10) {
        this.optimizationHistory = this.optimizationHistory.slice(-10);
      }

      this.logger.info("Performance optimization completed", {
        processingTime: Date.now() - startTime,
        optimizationsApplied: optimizations.length,
        overallScore: improvements.overallScore,
        memoryReduction: improvements.memoryUsageReduction,
        latencyImprovement: improvements.latencyImprovement,
      });

      return results;
    } catch (error) {
      this.logger.error("Performance optimization failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Optimize memory usage
   */
  private async optimizeMemory(): Promise<{
    optimizations: AppliedOptimization[];
    recommendations: string[];
  }> {
    const optimizations: AppliedOptimization[] = [];
    const recommendations: string[] = [];

    // Force garbage collection if memory usage is high
    const metrics = this.memoryManager.getCurrentMetrics();
    const memoryUsageRatio = metrics.heapUsed / metrics.heapTotal;

    if (memoryUsageRatio > this.config.memory.gcThreshold) {
      const { memoryFreed, gcTime } =
        await this.memoryManager.forceGarbageCollection();

      optimizations.push({
        type: OptimizationType.GARBAGE_COLLECTION,
        description: "Forced garbage collection to free memory",
        impact: {
          memoryReduction: memoryFreed,
          latencyImprovement: 0,
          throughputIncrease: 0,
          cacheHitRateImprovement: 0,
        },
        timestamp: Date.now(),
      });

      if (memoryFreed > 1024 * 1024) {
        // 1MB
        recommendations.push(
          `Garbage collection freed ${(memoryFreed / 1024 / 1024).toFixed(2)}MB in ${gcTime.toFixed(2)}ms`,
        );
      }
    }

    // Memory cleanup
    this.memoryManager.performCleanup();

    optimizations.push({
      type: OptimizationType.MEMORY_CLEANUP,
      description: "Performed memory cleanup operations",
      impact: {
        memoryReduction: 0,
        latencyImprovement: 0,
        throughputIncrease: 0,
        cacheHitRateImprovement: 0,
      },
      timestamp: Date.now(),
    });

    // Analyze memory patterns and add recommendations
    const analysis = this.memoryManager.analyzeMemoryPatterns();
    recommendations.push(...analysis.recommendations);

    return { optimizations, recommendations };
  }

  /**
   * Optimize cache performance
   */
  private async optimizeCache(): Promise<{
    optimizations: AppliedOptimization[];
    recommendations: string[];
  }> {
    const optimizations: AppliedOptimization[] = [];
    const recommendations: string[] = [];

    const cacheStats = this.cacheManager.getStats();

    // Cache hit rate optimization
    if (
      cacheStats.metrics.hitRate < 0.7 &&
      cacheStats.metrics.totalRequests > 100
    ) {
      recommendations.push(
        "Low cache hit rate detected - consider adjusting TTL or cache size",
        "Review cache key patterns for optimization",
        "Consider implementing cache warming strategies",
      );
    }

    // Memory usage optimization
    const memoryUsageMB = cacheStats.metrics.memoryUsage / 1024 / 1024;
    if (memoryUsageMB > (this.config.cache.maxMemory / 1024 / 1024) * 0.8) {
      recommendations.push(
        "High cache memory usage - consider reducing TTL or cache size",
        "Enable compression if not already active",
        "Review cache eviction policy effectiveness",
      );
    }

    optimizations.push({
      type: OptimizationType.CACHE_OPTIMIZATION,
      description: "Analyzed and optimized cache performance",
      impact: {
        memoryReduction: 0,
        latencyImprovement: 0,
        throughputIncrease: 0,
        cacheHitRateImprovement: 0,
      },
      timestamp: Date.now(),
    });

    return { optimizations, recommendations };
  }

  /**
   * Optimize batch processing
   */
  private async optimizeProcessing(): Promise<{
    optimizations: AppliedOptimization[];
    recommendations: string[];
  }> {
    const optimizations: AppliedOptimization[] = [];
    const recommendations: string[] = [];

    for (const [name, processor] of this.batchProcessors.entries()) {
      const stats = processor.getStats();

      // Queue size optimization
      if (stats.queueSize > this.config.processing.queueMaxSize * 0.8) {
        recommendations.push(
          `High queue size for processor '${name}' - consider increasing concurrency`,
          "Optimize processing logic to reduce latency",
          "Consider splitting large jobs into smaller batches",
        );
      }

      // Latency optimization
      if (stats.metrics.averageLatency > 5000) {
        // 5 seconds
        recommendations.push(
          `High processing latency for '${name}' - review processing logic`,
          "Consider reducing batch sizes",
          "Check for I/O bottlenecks",
        );
      }

      // Worker utilization optimization
      if (stats.workerUtilization > 0.9) {
        recommendations.push(
          `High worker utilization for '${name}' - consider increasing concurrency`,
          "Monitor for potential bottlenecks",
        );
      } else if (stats.workerUtilization < 0.3) {
        recommendations.push(
          `Low worker utilization for '${name}' - consider reducing concurrency to save resources`,
        );
      }
    }

    optimizations.push({
      type: OptimizationType.BATCH_PROCESSING,
      description: "Analyzed and optimized batch processing performance",
      impact: {
        memoryReduction: 0,
        latencyImprovement: 0,
        throughputIncrease: 0,
        cacheHitRateImprovement: 0,
      },
      timestamp: Date.now(),
    });

    return { optimizations, recommendations };
  }

  /**
   * Collect comprehensive performance metrics
   */
  public async collectMetrics(): Promise<PerformanceMetrics> {
    const memoryMetrics = this.memoryManager.getCurrentMetrics();
    const cacheMetrics = this.cacheManager.getMetrics();

    // Aggregate processing metrics from all batch processors
    let totalThroughput = 0;
    let totalLatency = 0;
    let totalQueueSize = 0;
    let totalActiveWorkers = 0;
    let totalCompletedTasks = 0;
    let totalFailedTasks = 0;
    let processorCount = 0;

    for (const processor of this.batchProcessors.values()) {
      const stats = processor.getStats();
      totalThroughput += stats.metrics.throughput;
      totalLatency += stats.metrics.averageLatency;
      totalQueueSize += stats.queueSize;
      totalActiveWorkers += stats.metrics.activeWorkers;
      totalCompletedTasks += stats.metrics.completedTasks;
      totalFailedTasks += stats.metrics.failedTasks;
      processorCount++;
    }

    const processingMetrics = {
      throughput: totalThroughput,
      averageLatency: processorCount > 0 ? totalLatency / processorCount : 0,
      p95Latency: 0, // Would need to aggregate from individual processors
      p99Latency: 0, // Would need to aggregate from individual processors
      queueSize: totalQueueSize,
      activeWorkers: totalActiveWorkers,
      completedTasks: totalCompletedTasks,
      failedTasks: totalFailedTasks,
    };

    // Mock CPU and I/O metrics (would be implemented with actual system monitoring)
    const cpuMetrics = {
      usage: 0,
      loadAverage: [0, 0, 0],
      userTime: 0,
      systemTime: 0,
      idleTime: 0,
    };

    const ioMetrics = {
      readOperations: 0,
      writeOperations: 0,
      readBytes: 0,
      writtenBytes: 0,
      readLatency: 0,
      writeLatency: 0,
      diskUsage: 0,
    };

    return {
      memory: memoryMetrics,
      cpu: cpuMetrics,
      cache: cacheMetrics,
      processing: processingMetrics,
      io: ioMetrics,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate performance improvements
   */
  private calculateImprovements(
    before: PerformanceMetrics,
    after: PerformanceMetrics,
  ): PerformanceImprovements {
    const memoryReduction =
      before.memory.heapUsed > 0
        ? ((before.memory.heapUsed - after.memory.heapUsed) /
            before.memory.heapUsed) *
          100
        : 0;

    const latencyImprovement =
      before.processing.averageLatency > 0
        ? ((before.processing.averageLatency -
            after.processing.averageLatency) /
            before.processing.averageLatency) *
          100
        : 0;

    const throughputIncrease =
      before.processing.throughput > 0
        ? ((after.processing.throughput - before.processing.throughput) /
            before.processing.throughput) *
          100
        : 0;

    const cacheEfficiencyGain =
      before.cache.hitRate > 0
        ? ((after.cache.hitRate - before.cache.hitRate) /
            before.cache.hitRate) *
          100
        : 0;

    const cpuUsageReduction = 0; // Would be calculated from actual CPU metrics

    // Calculate overall score (0-100)
    const overallScore = Math.max(
      0,
      Math.min(
        100,
        Math.max(0, memoryReduction) * 0.3 +
          Math.max(0, latencyImprovement) * 0.3 +
          Math.max(0, throughputIncrease) * 0.2 +
          Math.max(0, cacheEfficiencyGain) * 0.2,
      ),
    );

    return {
      memoryUsageReduction: Math.max(0, memoryReduction),
      latencyImprovement: Math.max(0, latencyImprovement),
      throughputIncrease: Math.max(0, throughputIncrease),
      cacheEfficiencyGain: Math.max(0, cacheEfficiencyGain),
      cpuUsageReduction,
      overallScore,
    };
  }

  /**
   * Start global performance monitoring
   */
  private startGlobalMonitoring(): void {
    if (!this.config.monitoring.enabled) {
      return;
    }

    this.monitoringTimer = setInterval(async () => {
      try {
        await this.checkGlobalPerformance();
      } catch (error) {
        this.logger.error("Global performance monitoring failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * Check global performance and trigger optimizations if needed
   */
  private async checkGlobalPerformance(): Promise<void> {
    await this.collectMetrics(); // Collect metrics for monitoring
    const alerts = this.getAllAlerts();

    // Auto-optimization triggers
    const criticalAlerts = alerts.filter(
      (alert) => alert.severity === AlertSeverity.CRITICAL && !alert.resolved,
    );

    if (criticalAlerts.length > 0) {
      this.logger.warn(
        "Critical performance alerts detected, triggering auto-optimization",
        {
          alertCount: criticalAlerts.length,
        },
      );

      try {
        await this.optimize();
      } catch (error) {
        this.logger.error("Auto-optimization failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Get all alerts from all components
   */
  public getAllAlerts(): PerformanceAlert[] {
    const allAlerts: PerformanceAlert[] = [];

    // Memory alerts
    allAlerts.push(...this.memoryManager.getAlerts());

    // Cache alerts
    const cacheStats = this.cacheManager.getStats();
    allAlerts.push(...cacheStats.alerts);

    // Batch processor alerts
    for (const processor of this.batchProcessors.values()) {
      const stats = processor.getStats();
      allAlerts.push(...stats.alerts);
    }

    return allAlerts;
  }

  /**
   * Get enabled components
   */
  private getEnabledComponents(): string[] {
    const components: string[] = [];

    if (this.config.memory.enabled) {
      components.push("memory");
    }
    if (this.config.cache.enabled) {
      components.push("cache");
    }
    if (this.config.processing.enabled) {
      components.push("processing");
    }
    if (this.config.monitoring.enabled) {
      components.push("monitoring");
    }
    if (this.config.io.enabled) {
      components.push("io");
    }

    return components;
  }

  /**
   * Get comprehensive performance statistics
   */
  public async getPerformanceStats(): Promise<{
    metrics: PerformanceMetrics;
    alerts: PerformanceAlert[];
    optimizationHistory: OptimizationResults[];
    componentStats: {
      memory: ReturnType<MemoryManager["getMemoryStats"]>;
      cache: ReturnType<CacheManager["getStats"]>;
      batchProcessors: Record<
        string,
        ReturnType<BatchProcessor<unknown, unknown>["getStats"]>
      >;
    };
  }> {
    const metrics = await this.collectMetrics();
    const alerts = this.getAllAlerts();

    const batchProcessorStats: Record<
      string,
      ReturnType<BatchProcessor<unknown, unknown>["getStats"]>
    > = {};
    for (const [name, processor] of this.batchProcessors.entries()) {
      batchProcessorStats[name] = processor.getStats();
    }

    return {
      metrics,
      alerts,
      optimizationHistory: [...this.optimizationHistory],
      componentStats: {
        memory: this.memoryManager.getMemoryStats(),
        cache: this.cacheManager.getStats(),
        batchProcessors: batchProcessorStats,
      },
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<PerformanceOptimizationConfig>): void {
    this.config = { ...this.config, ...config };

    // Update component configurations
    if (config.memory) {
      this.memoryManager.updateConfig(config.memory);
    }
    if (config.cache) {
      this.cacheManager.updateConfig(config.cache);
    }
    if (config.processing) {
      for (const processor of this.batchProcessors.values()) {
        processor.updateConfig(config.processing);
      }
    }

    this.logger.info("Performance optimizer configuration updated", config);
  }

  /**
   * Shutdown performance optimizer
   */
  public async shutdown(): Promise<void> {
    this.isEnabled = false;

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    // Shutdown all components
    this.memoryManager.shutdown();
    this.cacheManager.shutdown();

    const shutdownPromises = Array.from(this.batchProcessors.values()).map(
      (processor) => processor.shutdown(),
    );

    await Promise.all(shutdownPromises);

    this.logger.info("Performance optimizer shutdown completed");
  }
}
