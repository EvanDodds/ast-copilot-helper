/**
 * Performance Monitoring Utilities
 * Part of Issue #150 - Performance Optimization Component
 */

import type { PerformanceMetrics, PerformanceAlert } from "./types.js";
import { AlertType, AlertSeverity } from "./types.js";
import { createLogger } from "../../logging/index.js";

/**
 * System resource monitor for cross-platform monitoring
 */
export class SystemResourceMonitor {
  private logger = createLogger({ operation: "system-resource-monitor" });

  /**
   * Get current CPU metrics
   */
  public async getCpuMetrics(): Promise<{
    usage: number;
    loadAverage: [number, number, number];
    userTime: number;
    systemTime: number;
    idleTime: number;
  }> {
    try {
      // In a real implementation, this would use system APIs or libraries like:
      // - Node.js os module for load average
      // - process.cpuUsage() for CPU usage
      // - OS-specific system calls for detailed metrics

      const usage = await this.calculateCpuUsage();
      const loadAverage = this.getLoadAverage();
      const cpuTimes = this.getCpuTimes();

      return {
        usage,
        loadAverage,
        userTime: cpuTimes.user,
        systemTime: cpuTimes.system,
        idleTime: cpuTimes.idle,
      };
    } catch (error) {
      this.logger.error("Failed to get CPU metrics", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return fallback values
      return {
        usage: 0,
        loadAverage: [0, 0, 0],
        userTime: 0,
        systemTime: 0,
        idleTime: 0,
      };
    }
  }

  /**
   * Get current I/O metrics
   */
  public async getIoMetrics(): Promise<{
    readOperations: number;
    writeOperations: number;
    readBytes: number;
    writtenBytes: number;
    readLatency: number;
    writeLatency: number;
    diskUsage: number;
  }> {
    try {
      // In a real implementation, this would monitor:
      // - File system operations
      // - Network I/O
      // - Disk usage and latency
      // - Buffer states

      return {
        readOperations: 0,
        writeOperations: 0,
        readBytes: 0,
        writtenBytes: 0,
        readLatency: 0,
        writeLatency: 0,
        diskUsage: 0,
      };
    } catch (error) {
      this.logger.error("Failed to get I/O metrics", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        readOperations: 0,
        writeOperations: 0,
        readBytes: 0,
        writtenBytes: 0,
        readLatency: 0,
        writeLatency: 0,
        diskUsage: 0,
      };
    }
  }

  /**
   * Calculate current CPU usage percentage
   */
  private async calculateCpuUsage(): Promise<number> {
    // This is a simplified implementation
    // Real implementation would sample CPU times over an interval
    return new Promise((resolve) => {
      const start = process.cpuUsage();

      setTimeout(() => {
        const current = process.cpuUsage(start);
        const total = current.user + current.system;
        // Convert microseconds to percentage (rough approximation)
        const usage = Math.min(100, (total / 1000000) * 100);
        resolve(usage);
      }, 100);
    });
  }

  /**
   * Get system load average
   */
  private getLoadAverage(): [number, number, number] {
    try {
      // In a real implementation, this would use os.loadavg()
      // For now, return mock values to avoid require() issues
      return [0.1, 0.2, 0.3];
    } catch {
      return [0, 0, 0];
    }
  }

  /**
   * Get CPU time breakdown
   */
  private getCpuTimes(): { user: number; system: number; idle: number } {
    try {
      const cpuUsage = process.cpuUsage();
      return {
        user: cpuUsage.user,
        system: cpuUsage.system,
        idle: 0, // Not directly available in Node.js
      };
    } catch {
      return { user: 0, system: 0, idle: 0 };
    }
  }
}

/**
 * Performance alert manager
 */
export class PerformanceAlertManager {
  private logger = createLogger({ operation: "performance-alert-manager" });
  private alerts = new Map<string, PerformanceAlert>();
  private alertHandlers = new Set<(alert: PerformanceAlert) => void>();

  /**
   * Register alert handler
   */
  public onAlert(handler: (alert: PerformanceAlert) => void): () => void {
    this.alertHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.alertHandlers.delete(handler);
    };
  }

  /**
   * Check metric against thresholds and create alerts
   */
  public checkMetricThreshold(
    metric: string,
    currentValue: number,
    threshold: number,
    type: AlertType,
    severity: AlertSeverity = AlertSeverity.WARNING,
    recommendations: string[] = [],
  ): PerformanceAlert | null {
    const alertId = `${type}_${metric}`;
    const existingAlert = this.alerts.get(alertId);

    // Check if threshold is exceeded
    const isThresholdExceeded = this.isThresholdExceeded(
      type,
      currentValue,
      threshold,
    );

    if (isThresholdExceeded) {
      if (!existingAlert || existingAlert.resolved) {
        // Create new alert
        const alert: PerformanceAlert = {
          id: alertId,
          type,
          severity,
          metric,
          currentValue,
          threshold,
          message: this.generateAlertMessage(
            type,
            metric,
            currentValue,
            threshold,
          ),
          timestamp: Date.now(),
          resolved: false,
          recommendations,
        };

        this.alerts.set(alertId, alert);
        this.notifyHandlers(alert);

        this.logger.warn("Performance alert triggered", {
          id: alertId,
          type,
          metric,
          currentValue,
          threshold,
          severity,
        });

        return alert;
      }
    } else if (existingAlert && !existingAlert.resolved) {
      // Resolve existing alert
      existingAlert.resolved = true;
      existingAlert.timestamp = Date.now();

      this.logger.info("Performance alert resolved", {
        id: alertId,
        type,
        metric,
      });

      this.notifyHandlers(existingAlert);
      return existingAlert;
    }

    return null;
  }

  /**
   * Check if threshold is exceeded based on alert type
   */
  private isThresholdExceeded(
    type: AlertType,
    currentValue: number,
    threshold: number,
  ): boolean {
    switch (type) {
      case AlertType.MEMORY_HIGH:
      case AlertType.CPU_HIGH:
      case AlertType.LATENCY_HIGH:
      case AlertType.QUEUE_FULL:
      case AlertType.ERROR_RATE_HIGH:
      case AlertType.DISK_FULL:
        return currentValue > threshold;

      case AlertType.CACHE_LOW_HIT_RATE:
        return currentValue < threshold;

      case AlertType.MEMORY_LEAK:
        // Memory leak detection would require trend analysis
        return currentValue > threshold;

      default:
        return currentValue > threshold;
    }
  }

  /**
   * Generate human-readable alert message
   */
  private generateAlertMessage(
    type: AlertType,
    metric: string,
    currentValue: number,
    threshold: number,
  ): string {
    const formatValue = (value: number): string => {
      if (type === AlertType.MEMORY_HIGH || type === AlertType.MEMORY_LEAK) {
        return `${(value / 1024 / 1024).toFixed(2)}MB`;
      }
      if (type === AlertType.LATENCY_HIGH) {
        return `${value.toFixed(2)}ms`;
      }
      if (type === AlertType.CACHE_LOW_HIT_RATE) {
        return `${(value * 100).toFixed(1)}%`;
      }
      if (type === AlertType.CPU_HIGH) {
        return `${value.toFixed(1)}%`;
      }
      return value.toString();
    };

    const currentFormatted = formatValue(currentValue);
    const thresholdFormatted = formatValue(threshold);

    switch (type) {
      case AlertType.MEMORY_HIGH:
        return `High memory usage: ${currentFormatted} exceeds threshold of ${thresholdFormatted}`;

      case AlertType.CPU_HIGH:
        return `High CPU usage: ${currentFormatted} exceeds threshold of ${thresholdFormatted}`;

      case AlertType.CACHE_LOW_HIT_RATE:
        return `Low cache hit rate: ${currentFormatted} below threshold of ${thresholdFormatted}`;

      case AlertType.LATENCY_HIGH:
        return `High latency detected: ${currentFormatted} exceeds threshold of ${thresholdFormatted}`;

      case AlertType.QUEUE_FULL:
        return `Queue size critical: ${currentValue} items exceeds threshold of ${threshold}`;

      case AlertType.ERROR_RATE_HIGH:
        return `High error rate: ${currentFormatted} exceeds threshold of ${thresholdFormatted}`;

      case AlertType.DISK_FULL:
        return `Disk usage critical: ${currentFormatted} exceeds threshold of ${thresholdFormatted}`;

      case AlertType.MEMORY_LEAK:
        return `Potential memory leak: ${currentFormatted} indicates sustained growth`;

      default:
        return `Performance threshold exceeded for ${metric}: ${currentFormatted} > ${thresholdFormatted}`;
    }
  }

  /**
   * Notify all registered handlers
   */
  private notifyHandlers(alert: PerformanceAlert): void {
    for (const handler of this.alertHandlers) {
      try {
        handler(alert);
      } catch (error) {
        this.logger.error("Alert handler failed", {
          alertId: alert.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Get all alerts
   */
  public getAllAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get active (unresolved) alerts
   */
  public getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter((alert) => !alert.resolved);
  }

  /**
   * Get alerts by severity
   */
  public getAlertsBySeverity(severity: AlertSeverity): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(
      (alert) => alert.severity === severity && !alert.resolved,
    );
  }

  /**
   * Resolve alert by ID
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.timestamp = Date.now();
      this.notifyHandlers(alert);
      return true;
    }
    return false;
  }

  /**
   * Clear resolved alerts older than specified time
   */
  public clearOldAlerts(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleared = 0;

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.timestamp < cutoff) {
        this.alerts.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.logger.info("Cleared old alerts", { count: cleared });
    }

    return cleared;
  }

  /**
   * Get alert statistics
   */
  public getAlertStats(): {
    total: number;
    active: number;
    resolved: number;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
  } {
    const alerts = Array.from(this.alerts.values());

    const bySeverity: Record<AlertSeverity, number> = {
      [AlertSeverity.INFO]: 0,
      [AlertSeverity.WARNING]: 0,
      [AlertSeverity.ERROR]: 0,
      [AlertSeverity.CRITICAL]: 0,
    };

    const byType: Record<AlertType, number> = {
      [AlertType.MEMORY_HIGH]: 0,
      [AlertType.CPU_HIGH]: 0,
      [AlertType.CACHE_LOW_HIT_RATE]: 0,
      [AlertType.LATENCY_HIGH]: 0,
      [AlertType.QUEUE_FULL]: 0,
      [AlertType.ERROR_RATE_HIGH]: 0,
      [AlertType.DISK_FULL]: 0,
      [AlertType.MEMORY_LEAK]: 0,
    };

    let active = 0;
    let resolved = 0;

    for (const alert of alerts) {
      if (alert.resolved) {
        resolved++;
      } else {
        active++;
      }

      bySeverity[alert.severity]++;
      byType[alert.type]++;
    }

    return {
      total: alerts.length,
      active,
      resolved,
      bySeverity,
      byType,
    };
  }
}

/**
 * Performance trend analyzer
 */
export class PerformanceTrendAnalyzer {
  private logger = createLogger({ operation: "performance-trend-analyzer" });
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 100;

  /**
   * Add metrics to history
   */
  public addMetrics(metrics: PerformanceMetrics): void {
    this.metricsHistory.push(metrics);

    // Keep only recent history
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Analyze memory usage trends
   */
  public analyzeMemoryTrend(windowSize = 10): {
    trend: "increasing" | "decreasing" | "stable";
    rate: number; // Change rate per sample
    confidence: number; // 0-1 confidence in trend
    recommendations: string[];
  } {
    if (this.metricsHistory.length < windowSize) {
      return {
        trend: "stable",
        rate: 0,
        confidence: 0,
        recommendations: ["Need more data points for trend analysis"],
      };
    }

    const recent = this.metricsHistory.slice(-windowSize);
    const memoryValues = recent.map((m) => m.memory.heapUsed);

    const trend = this.calculateTrend(memoryValues);
    const recommendations = this.generateMemoryRecommendations(
      trend,
      memoryValues,
    );

    return {
      ...trend,
      recommendations,
    };
  }

  /**
   * Analyze cache performance trends
   */
  public analyzeCacheTrend(windowSize = 10): {
    hitRateTrend: "improving" | "degrading" | "stable";
    hitRateChange: number;
    memoryTrend: "increasing" | "decreasing" | "stable";
    recommendations: string[];
  } {
    if (this.metricsHistory.length < windowSize) {
      return {
        hitRateTrend: "stable",
        hitRateChange: 0,
        memoryTrend: "stable",
        recommendations: ["Need more data points for cache trend analysis"],
      };
    }

    const recent = this.metricsHistory.slice(-windowSize);
    const hitRates = recent.map((m) => m.cache.hitRate);
    const cacheMemory = recent.map((m) => m.cache.memoryUsage);

    const hitRateTrend = this.calculateTrend(hitRates);
    const memoryTrend = this.calculateTrend(cacheMemory);

    const recommendations = this.generateCacheRecommendations(
      hitRateTrend,
      memoryTrend,
    );

    return {
      hitRateTrend:
        hitRateTrend.trend === "increasing"
          ? "improving"
          : hitRateTrend.trend === "decreasing"
            ? "degrading"
            : "stable",
      hitRateChange: hitRateTrend.rate,
      memoryTrend: memoryTrend.trend,
      recommendations,
    };
  }

  /**
   * Calculate trend from numeric series
   */
  private calculateTrend(values: number[]): {
    trend: "increasing" | "decreasing" | "stable";
    rate: number;
    confidence: number;
  } {
    if (values.length < 2) {
      return { trend: "stable", rate: 0, confidence: 0 };
    }

    // Simple linear regression to find trend
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const xMean = x.reduce((a, b) => a + b) / n;
    const yMean = values.reduce((a, b) => a + b) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      const xVal = x[i];
      const yVal = values[i];
      if (xVal !== undefined && yVal !== undefined) {
        numerator += (xVal - xMean) * (yVal - yMean);
        denominator += (xVal - xMean) ** 2;
      }
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;

    // Calculate R-squared for confidence
    let ssTotal = 0;
    let ssRes = 0;

    for (let i = 0; i < n; i++) {
      const xVal = x[i];
      const yVal = values[i];
      if (xVal !== undefined && yVal !== undefined) {
        const predicted = yMean + slope * (xVal - xMean);
        ssTotal += (yVal - yMean) ** 2;
        ssRes += (yVal - predicted) ** 2;
      }
    }

    const rSquared = ssTotal === 0 ? 1 : 1 - ssRes / ssTotal;
    const confidence = Math.max(0, Math.min(1, rSquared));

    // Determine trend direction with threshold
    const threshold = Math.abs(yMean) * 0.01; // 1% threshold

    let trend: "increasing" | "decreasing" | "stable";
    if (Math.abs(slope) < threshold) {
      trend = "stable";
    } else if (slope > 0) {
      trend = "increasing";
    } else {
      trend = "decreasing";
    }

    return { trend, rate: slope, confidence };
  }

  /**
   * Generate memory trend recommendations
   */
  private generateMemoryRecommendations(
    trend: ReturnType<typeof this.calculateTrend>,
    values: number[],
  ): string[] {
    const recommendations: string[] = [];
    const latest = values[values.length - 1];
    const average = values.reduce((a, b) => a + b) / values.length;

    if (trend.trend === "increasing" && trend.confidence > 0.7) {
      recommendations.push(
        "Memory usage is consistently increasing - investigate potential memory leaks",
      );
      recommendations.push(
        "Consider implementing more aggressive garbage collection",
      );
      recommendations.push(
        "Review object lifecycle management and cleanup routines",
      );
    }

    if (latest !== undefined && latest > average * 1.5) {
      recommendations.push(
        "Current memory usage is significantly above average - monitor closely",
      );
    }

    if (trend.confidence < 0.3) {
      recommendations.push(
        "Memory usage pattern is highly variable - consider stabilizing workload",
      );
    }

    return recommendations;
  }

  /**
   * Generate cache trend recommendations
   */
  private generateCacheRecommendations(
    hitRateTrend: ReturnType<typeof this.calculateTrend>,
    memoryTrend: ReturnType<typeof this.calculateTrend>,
  ): string[] {
    const recommendations: string[] = [];

    if (hitRateTrend.trend === "decreasing" && hitRateTrend.confidence > 0.6) {
      recommendations.push(
        "Cache hit rate is declining - review cache strategy",
      );
      recommendations.push("Consider adjusting TTL values or cache size");
      recommendations.push(
        "Analyze cache key patterns for optimization opportunities",
      );
    }

    if (memoryTrend.trend === "increasing" && memoryTrend.confidence > 0.7) {
      recommendations.push(
        "Cache memory usage is growing - consider size limits",
      );
      recommendations.push("Review eviction policy effectiveness");
    }

    if (hitRateTrend.trend === "increasing") {
      recommendations.push(
        "Cache performance is improving - current strategy is effective",
      );
    }

    return recommendations;
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    dataPoints: number;
    timespan: number;
    memoryTrend: ReturnType<PerformanceTrendAnalyzer["analyzeMemoryTrend"]>;
    cacheTrend: ReturnType<PerformanceTrendAnalyzer["analyzeCacheTrend"]>;
    averageMetrics: Partial<PerformanceMetrics>;
  } | null {
    if (this.metricsHistory.length === 0) {
      return null;
    }

    const oldest = this.metricsHistory[0];
    const newest = this.metricsHistory[this.metricsHistory.length - 1];
    if (!oldest || !newest) {
      return null;
    }
    const timespan = newest.timestamp - oldest.timestamp;

    // Calculate averages
    const averages = this.calculateAverageMetrics();

    return {
      dataPoints: this.metricsHistory.length,
      timespan,
      memoryTrend: this.analyzeMemoryTrend(),
      cacheTrend: this.analyzeCacheTrend(),
      averageMetrics: averages,
    };
  }

  /**
   * Calculate average metrics
   */
  private calculateAverageMetrics(): Partial<PerformanceMetrics> {
    if (this.metricsHistory.length === 0) {
      return {};
    }

    const totals = this.metricsHistory.reduce(
      (acc, metrics) => {
        return {
          memoryHeapUsed: acc.memoryHeapUsed + metrics.memory.heapUsed,
          memoryHeapTotal: acc.memoryHeapTotal + metrics.memory.heapTotal,
          cacheHitRate: acc.cacheHitRate + metrics.cache.hitRate,
          cacheMemoryUsage: acc.cacheMemoryUsage + metrics.cache.memoryUsage,
          processingThroughput:
            acc.processingThroughput + metrics.processing.throughput,
          processingLatency:
            acc.processingLatency + metrics.processing.averageLatency,
        };
      },
      {
        memoryHeapUsed: 0,
        memoryHeapTotal: 0,
        cacheHitRate: 0,
        cacheMemoryUsage: 0,
        processingThroughput: 0,
        processingLatency: 0,
      },
    );

    const count = this.metricsHistory.length;

    return {
      memory: {
        heapUsed: Math.round(totals.memoryHeapUsed / count),
        heapTotal: Math.round(totals.memoryHeapTotal / count),
        external: 0,
        rss: 0,
        arrayBuffers: 0,
        peakUsage: 0,
        gcCount: 0,
        gcTime: 0,
      },
      cache: {
        hitRate: totals.cacheHitRate / count,
        missRate: 1 - totals.cacheHitRate / count,
        totalRequests: 0,
        totalHits: 0,
        totalMisses: 0,
        evictions: 0,
        size: 0,
        maxSize: 0,
        memoryUsage: Math.round(totals.cacheMemoryUsage / count),
      },
      processing: {
        throughput: totals.processingThroughput / count,
        averageLatency: totals.processingLatency / count,
        p95Latency: 0,
        p99Latency: 0,
        queueSize: 0,
        activeWorkers: 0,
        completedTasks: 0,
        failedTasks: 0,
      },
    };
  }

  /**
   * Clear metrics history
   */
  public clearHistory(): void {
    this.metricsHistory = [];
    this.logger.info("Performance metrics history cleared");
  }

  /**
   * Set maximum history size
   */
  public setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(10, size);

    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }
}
