/**
 * Memory Manager - Advanced Memory Optimization
 * Part of Issue #150 - Performance Optimization Component
 */

import type {
  MemoryMetrics,
  MemoryOptimizationConfig,
  PerformanceAlert,
} from "./types.js";
import { AlertType, AlertSeverity } from "./types.js";
import { createLogger } from "../../logging/index.js";

/**
 * Advanced Memory Manager for performance optimization
 */
export class MemoryManager {
  private logger = createLogger({ operation: "memory-manager" });
  private config: MemoryOptimizationConfig;
  private metrics: MemoryMetrics[] = [];
  private cleanupTimer?: NodeJS.Timeout;
  private monitoringTimer?: NodeJS.Timeout;
  private gcCount = 0;
  private lastGcTime = 0;

  private alerts: PerformanceAlert[] = [];

  constructor(config: MemoryOptimizationConfig) {
    this.config = config;
    this.startMonitoring();
    this.logger.info("Memory Manager initialized", {
      enabled: config.enabled,
      maxHeapSize: config.maxHeapSize,
      autoCleanup: config.autoCleanup,
    });
  }

  /**
   * Get current memory metrics
   */
  public getCurrentMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
      peakUsage: Math.max(
        ...this.metrics.map((m) => m.heapUsed),
        memUsage.heapUsed,
      ),
      gcCount: this.gcCount,
      gcTime: this.lastGcTime,
    };
  }

  /**
   * Monitor memory usage and trigger optimizations
   */
  private startMonitoring(): void {
    if (!this.config.enabled) {
      return;
    }

    this.monitoringTimer = setInterval(() => {
      const metrics = this.getCurrentMetrics();
      this.metrics.push(metrics);

      // Keep only recent metrics (last 100 entries for performance)
      this.metrics = this.metrics.filter(
        (_m, index) => index >= this.metrics.length - 100,
      );

      this.checkMemoryThresholds(metrics);
      this.detectMemoryLeaks(metrics);

      if (this.config.profiling) {
        this.logger.debug("Memory metrics", metrics);
      }
    }, 5000); // Check every 5 seconds

    // Setup cleanup interval
    if (this.config.autoCleanup) {
      this.cleanupTimer = setInterval(() => {
        this.performCleanup();
      }, this.config.cleanupInterval);
    }

    // Setup GC monitoring
    if (this.config.leakDetection && global.gc) {
      this.setupGcMonitoring();
    }
  }

  /**
   * Check memory thresholds and generate alerts
   */
  private checkMemoryThresholds(metrics: MemoryMetrics): void {
    const heapUsageRatio = metrics.heapUsed / metrics.heapTotal;

    // Critical threshold
    if (heapUsageRatio >= this.config.memoryCriticalThreshold) {
      this.generateAlert({
        type: AlertType.MEMORY_HIGH,
        severity: AlertSeverity.CRITICAL,
        metric: "heap_usage",
        currentValue: heapUsageRatio,
        threshold: this.config.memoryCriticalThreshold,
        message: `Critical memory usage: ${(heapUsageRatio * 100).toFixed(1)}%`,
        recommendations: [
          "Force garbage collection",
          "Clear unnecessary caches",
          "Reduce batch sizes",
          "Implement memory cleanup",
        ],
      });
    }
    // Warning threshold
    else if (heapUsageRatio >= this.config.memoryWarningThreshold) {
      this.generateAlert({
        type: AlertType.MEMORY_HIGH,
        severity: AlertSeverity.WARNING,
        metric: "heap_usage",
        currentValue: heapUsageRatio,
        threshold: this.config.memoryWarningThreshold,
        message: `High memory usage: ${(heapUsageRatio * 100).toFixed(1)}%`,
        recommendations: [
          "Monitor memory growth",
          "Consider garbage collection",
          "Review cache sizes",
        ],
      });
    }
  }

  /**
   * Detect potential memory leaks
   */
  private detectMemoryLeaks(_metrics: MemoryMetrics): void {
    if (!this.config.leakDetection || this.metrics.length < 10) {
      return;
    }

    // Analyze memory growth trend
    const recent = this.metrics.slice(-10);
    const growthTrend = this.calculateGrowthTrend(
      recent.map((m) => m.heapUsed),
    );

    // If memory consistently grows over time
    if (growthTrend > 1024 * 1024) {
      // 1MB growth trend
      this.generateAlert({
        type: AlertType.MEMORY_LEAK,
        severity: AlertSeverity.ERROR,
        metric: "memory_growth",
        currentValue: growthTrend,
        threshold: 1024 * 1024,
        message: `Potential memory leak detected: ${(growthTrend / 1024 / 1024).toFixed(2)}MB growth trend`,
        recommendations: [
          "Review object retention",
          "Check for circular references",
          "Audit event listeners",
          "Review cache policies",
        ],
      });
    }
  }

  /**
   * Calculate growth trend from data points
   */
  private calculateGrowthTrend(data: number[]): number {
    if (data.length < 2) {
      return 0;
    }

    const first = data[0] ?? 0;
    const last = data[data.length - 1] ?? 0;
    return last - first;
  }

  /**
   * Setup garbage collection monitoring
   */
  private setupGcMonitoring(): void {
    // This would require a native addon or use of performance hooks
    // For now, we'll simulate GC monitoring
    setInterval(() => {
      if (global.gc) {
        const before = process.memoryUsage().heapUsed;
        const startTime = performance.now();

        global.gc();

        const after = process.memoryUsage().heapUsed;
        const gcTime = performance.now() - startTime;

        this.gcCount++;
        this.lastGcTime = gcTime;

        const memoryFreed = before - after;
        this.logger.debug("Garbage collection completed", {
          memoryFreed: memoryFreed,
          gcTime: gcTime,
          heapUsedAfter: after,
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform memory cleanup optimizations
   */
  public performCleanup(): void {
    const beforeMetrics = this.getCurrentMetrics();
    let optimizationsApplied = 0;

    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        optimizationsApplied++;
      }

      // Clear old metrics (keep last 100 for performance)
      this.metrics = this.metrics.filter(
        (_m, index) => index >= this.metrics.length - 100,
      );

      // Clear resolved alerts older than 1 hour
      this.alerts = this.alerts.filter(
        (alert) => !alert.resolved || Date.now() - alert.timestamp < 3600000,
      );

      const afterMetrics = this.getCurrentMetrics();
      const memoryFreed = beforeMetrics.heapUsed - afterMetrics.heapUsed;

      this.logger.info("Memory cleanup completed", {
        optimizationsApplied,
        memoryFreed,
        heapUsedBefore: beforeMetrics.heapUsed,
        heapUsedAfter: afterMetrics.heapUsed,
      });
    } catch (error) {
      this.logger.error("Memory cleanup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Force garbage collection with memory analysis
   */
  public async forceGarbageCollection(): Promise<{
    memoryFreed: number;
    gcTime: number;
  }> {
    if (!global.gc) {
      this.logger.warn(
        "Garbage collection not available (run with --expose-gc)",
      );
      return { memoryFreed: 0, gcTime: 0 };
    }

    const before = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    global.gc();

    const after = process.memoryUsage().heapUsed;
    const gcTime = performance.now() - startTime;
    const memoryFreed = before - after;

    this.gcCount++;
    this.lastGcTime = gcTime;

    this.logger.info("Forced garbage collection", {
      memoryFreed,
      gcTime,
      heapUsedBefore: before,
      heapUsedAfter: after,
    });

    return { memoryFreed, gcTime };
  }

  /**
   * Analyze memory usage patterns
   */
  public analyzeMemoryPatterns(): {
    averageUsage: number;
    peakUsage: number;
    growthRate: number;
    gcEfficiency: number;
    recommendations: string[];
  } {
    if (this.metrics.length === 0) {
      return {
        averageUsage: 0,
        peakUsage: 0,
        growthRate: 0,
        gcEfficiency: 0,
        recommendations: ["Insufficient data for analysis"],
      };
    }

    const heapUsages = this.metrics.map((m) => m.heapUsed);
    const averageUsage =
      heapUsages.reduce((sum, usage) => sum + usage, 0) / heapUsages.length;
    const peakUsage = Math.max(...heapUsages);
    const growthRate = this.calculateGrowthTrend(heapUsages);
    const gcEfficiency = this.gcCount > 0 ? averageUsage / this.gcCount : 0;

    const recommendations: string[] = [];

    if (growthRate > 1024 * 1024) {
      // 1MB growth
      recommendations.push(
        "Memory usage is growing consistently - investigate memory leaks",
      );
    }

    if (peakUsage > this.config.maxHeapSize * 0.9) {
      recommendations.push(
        "Peak memory usage is near limit - consider increasing heap size",
      );
    }

    if (this.gcCount < this.metrics.length / 10) {
      recommendations.push("Low GC frequency - consider manual GC triggering");
    }

    return {
      averageUsage,
      peakUsage,
      growthRate,
      gcEfficiency,
      recommendations,
    };
  }

  /**
   * Generate performance alert
   */
  private generateAlert(
    alertData: Omit<PerformanceAlert, "id" | "timestamp" | "resolved">,
  ): void {
    const alert: PerformanceAlert = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false,
      ...alertData,
    };

    this.alerts.push(alert);
    this.logger.warn("Performance alert generated", alert);

    // Auto-resolve alerts when threshold is no longer exceeded
    if (alertData.type === AlertType.MEMORY_HIGH) {
      setTimeout(() => {
        const current = this.getCurrentMetrics();
        const currentRatio = current.heapUsed / current.heapTotal;
        if (currentRatio < alertData.threshold) {
          alert.resolved = true;
          this.logger.info("Performance alert resolved", { alertId: alert.id });
        }
      }, 30000); // Check after 30 seconds
    }
  }

  /**
   * Get current alerts
   */
  public getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Get memory statistics
   */
  public getMemoryStats(): {
    current: MemoryMetrics;
    history: MemoryMetrics[];
    alerts: PerformanceAlert[];
    analysis: {
      averageUsage: number;
      peakUsage: number;
      growthRate: number;
      gcEfficiency: number;
      recommendations: string[];
    };
  } {
    return {
      current: this.getCurrentMetrics(),
      history: [...this.metrics],
      alerts: this.getAlerts(),
      analysis: this.analyzeMemoryPatterns(),
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<MemoryOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info("Memory manager configuration updated", config);
  }

  /**
   * Shutdown memory manager
   */
  public shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    this.logger.info("Memory manager shutdown");
  }
}
