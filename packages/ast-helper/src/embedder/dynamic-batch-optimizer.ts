/**
 * Dynamic batch size optimization based on system resources and performance metrics
 */

import os from "os";
import { createLogger } from "../logging/index.js";

export interface SystemResourceMetrics {
  /** CPU usage percentage (0-100) */
  cpuUsage: number;
  /** Available memory in bytes */
  availableMemory: number;
  /** Total memory in bytes */
  totalMemory: number;
  /** Memory usage percentage (0-100) */
  memoryUsage: number;
  /** System load average */
  loadAverage: number[];
  /** Number of CPU cores */
  cpuCores: number;
}

export interface PerformanceHistory {
  /** Batch size used */
  batchSize: number;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Throughput (items per second) */
  throughput: number;
  /** Memory usage during processing */
  memoryUsage: number;
  /** CPU usage during processing */
  cpuUsage: number;
  /** Timestamp of measurement */
  timestamp: number;
  /** Success/failure indicator */
  success: boolean;
}

export interface OptimizationConfig {
  /** Minimum batch size */
  minBatchSize: number;
  /** Maximum batch size */
  maxBatchSize: number;
  /** Target CPU usage percentage */
  targetCpuUsage: number;
  /** Target memory usage percentage */
  targetMemoryUsage: number;
  /** Minimum samples needed before optimization */
  minSamples: number;
  /** Performance history retention count */
  historyRetention: number;
  /** Optimization aggressiveness (0-1) */
  aggressiveness: number;
}

export interface OptimizationRecommendation {
  /** Recommended batch size */
  recommendedBatchSize: number;
  /** Confidence in recommendation (0-1) */
  confidence: number;
  /** Reason for recommendation */
  reason: string;
  /** Expected performance improvement */
  expectedImprovement: number;
  /** Resource utilization prediction */
  resourcePrediction: {
    cpuUsage: number;
    memoryUsage: number;
    throughput: number;
  };
}

/**
 * Default optimization configuration
 */
const DEFAULT_CONFIG: OptimizationConfig = {
  minBatchSize: 1,
  maxBatchSize: 256,
  targetCpuUsage: 70,
  targetMemoryUsage: 80,
  minSamples: 10,
  historyRetention: 100,
  aggressiveness: 0.3,
};

/**
 * Dynamic batch size optimizer using machine learning-inspired algorithms
 */
export class DynamicBatchOptimizer {
  private config: OptimizationConfig;
  private performanceHistory: PerformanceHistory[] = [];
  private currentBatchSize: number;
  private lastOptimization = 0;
  private cpuMonitoring: Map<string, number[]> = new Map();
  private logger = createLogger({ operation: "DynamicBatchOptimizer" });

  constructor(initialBatchSize = 32, config: Partial<OptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentBatchSize = Math.max(
      this.config.minBatchSize,
      Math.min(initialBatchSize, this.config.maxBatchSize),
    );

    this.logger.info("Dynamic batch optimizer initialized", {
      initialBatchSize: this.currentBatchSize,
      config: this.config,
    });
  }

  /**
   * Get current optimal batch size
   */
  getCurrentBatchSize(): number {
    return this.currentBatchSize;
  }

  /**
   * Record performance metrics for a completed batch
   */
  recordPerformance(
    batchSize: number,
    processingTime: number,
    itemCount: number,
    success = true,
  ): void {
    const throughput = itemCount / (processingTime / 1000); // items per second
    const systemMetrics = this.getCurrentSystemMetrics();

    const record: PerformanceHistory = {
      batchSize,
      processingTime,
      throughput,
      memoryUsage: systemMetrics.memoryUsage,
      cpuUsage: systemMetrics.cpuUsage,
      timestamp: Date.now(),
      success,
    };

    this.performanceHistory.push(record);

    // Trim history to configured retention
    if (this.performanceHistory.length > this.config.historyRetention) {
      this.performanceHistory.shift();
    }

    this.logger.debug("Performance recorded", {
      batchSize,
      processingTime: `${processingTime}ms`,
      throughput: `${throughput.toFixed(2)} items/sec`,
      memoryUsage: `${systemMetrics.memoryUsage.toFixed(1)}%`,
      success,
    });

    // Trigger optimization if enough samples collected
    if (this.shouldOptimize()) {
      this.optimize();
    }
  }

  /**
   * Get optimization recommendation based on current metrics
   */
  getOptimizationRecommendation(): OptimizationRecommendation {
    if (this.performanceHistory.length < this.config.minSamples) {
      return {
        recommendedBatchSize: this.currentBatchSize,
        confidence: 0.1,
        reason: "Insufficient performance data for optimization",
        expectedImprovement: 0,
        resourcePrediction: {
          cpuUsage: 0,
          memoryUsage: 0,
          throughput: 0,
        },
      };
    }

    const systemMetrics = this.getCurrentSystemMetrics();
    const recentHistory = this.performanceHistory.slice(
      -this.config.minSamples,
    );
    const successfulBatches = recentHistory.filter((h) => h.success);

    if (successfulBatches.length === 0) {
      return {
        recommendedBatchSize: Math.max(
          1,
          Math.floor(this.currentBatchSize * 0.5),
        ),
        confidence: 0.8,
        reason: "Recent batches failed, reducing batch size for stability",
        expectedImprovement: 0.2,
        resourcePrediction: {
          cpuUsage: systemMetrics.cpuUsage * 0.7,
          memoryUsage: systemMetrics.memoryUsage * 0.7,
          throughput: 0,
        },
      };
    }

    // Analyze optimal batch size based on throughput and resource usage
    const analysis = this.analyzeOptimalBatchSize(
      successfulBatches,
      systemMetrics,
    );
    return analysis;
  }

  /**
   * Optimize batch size based on performance history
   */
  optimize(): void {
    const recommendation = this.getOptimizationRecommendation();

    if (recommendation.confidence < 0.5) {
      this.logger.debug("Skipping optimization due to low confidence", {
        confidence: recommendation.confidence,
        reason: recommendation.reason,
      });
      return;
    }

    const oldBatchSize = this.currentBatchSize;
    this.currentBatchSize = recommendation.recommendedBatchSize;
    this.lastOptimization = Date.now();

    this.logger.info("Batch size optimized", {
      oldBatchSize,
      newBatchSize: this.currentBatchSize,
      confidence: recommendation.confidence,
      reason: recommendation.reason,
      expectedImprovement: `${(recommendation.expectedImprovement * 100).toFixed(1)}%`,
    });
  }

  /**
   * Get current system resource metrics
   */
  getCurrentSystemMetrics(): SystemResourceMetrics {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const availableMemory = freeMemory;
    const memoryUsage = ((totalMemory - availableMemory) / totalMemory) * 100;
    const loadAverage = os.loadavg();
    const cpuCores = os.cpus().length;

    // Estimate CPU usage (simplified)
    const cpuUsage = this.estimateCpuUsage();

    return {
      cpuUsage,
      availableMemory,
      totalMemory,
      memoryUsage,
      loadAverage,
      cpuCores,
    };
  }

  /**
   * Get comprehensive performance analytics
   */
  getPerformanceAnalytics(): {
    currentMetrics: SystemResourceMetrics;
    recentHistory: PerformanceHistory[];
    trends: {
      throughputTrend: number;
      memoryTrend: number;
      cpuTrend: number;
    };
    recommendations: OptimizationRecommendation;
  } {
    const currentMetrics = this.getCurrentSystemMetrics();
    const recentHistory = this.performanceHistory.slice(-20);
    const recommendations = this.getOptimizationRecommendation();

    const trends = this.calculateTrends(recentHistory);

    return {
      currentMetrics,
      recentHistory,
      trends,
      recommendations,
    };
  }

  /**
   * Check if optimization should be performed
   */
  private shouldOptimize(): boolean {
    // Need minimum samples
    if (this.performanceHistory.length < this.config.minSamples) {
      return false;
    }

    // Don't optimize too frequently (wait at least 30 seconds)
    if (Date.now() - this.lastOptimization < 30000) {
      return false;
    }

    // Check if recent performance suggests optimization is needed
    const recentBatches = this.performanceHistory.slice(-5);
    const failureRate =
      recentBatches.filter((b) => !b.success).length / recentBatches.length;

    if (failureRate > 0.2) {
      return true; // High failure rate, optimize immediately
    }

    // Check resource utilization
    const systemMetrics = this.getCurrentSystemMetrics();
    if (
      systemMetrics.memoryUsage > this.config.targetMemoryUsage ||
      systemMetrics.cpuUsage > this.config.targetCpuUsage
    ) {
      return true;
    }

    return false;
  }

  /**
   * Analyze optimal batch size based on performance history
   */
  private analyzeOptimalBatchSize(
    history: PerformanceHistory[],
    systemMetrics: SystemResourceMetrics,
  ): OptimizationRecommendation {
    // Group by batch size and calculate average performance
    const batchSizeGroups = new Map<number, PerformanceHistory[]>();

    for (const record of history) {
      if (!batchSizeGroups.has(record.batchSize)) {
        batchSizeGroups.set(record.batchSize, []);
      }
      batchSizeGroups.get(record.batchSize)!.push(record);
    }

    let bestBatchSize = this.currentBatchSize;
    let bestScore = 0;
    let confidence = 0.5;
    let reason = "Maintaining current batch size";

    for (const [batchSize, records] of batchSizeGroups) {
      const avgThroughput =
        records.reduce((sum, r) => sum + r.throughput, 0) / records.length;
      const avgMemoryUsage =
        records.reduce((sum, r) => sum + r.memoryUsage, 0) / records.length;
      const avgCpuUsage =
        records.reduce((sum, r) => sum + r.cpuUsage, 0) / records.length;
      const successRate =
        records.filter((r) => r.success).length / records.length;

      // Calculate composite score considering throughput, resource usage, and success rate
      const throughputScore = avgThroughput / 100; // Normalize
      const resourceScore = Math.max(
        0,
        2 - (avgMemoryUsage + avgCpuUsage) / 100,
      );
      const stabilityScore = successRate;

      const compositeScore =
        (throughputScore + resourceScore + stabilityScore) / 3;

      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestBatchSize = batchSize;
        confidence = Math.min(
          0.9,
          0.5 + (records.length / this.config.minSamples) * 0.4,
        );
      }
    }

    // Adjust based on current system resources
    if (systemMetrics.memoryUsage > this.config.targetMemoryUsage) {
      bestBatchSize = Math.max(
        this.config.minBatchSize,
        Math.floor(bestBatchSize * 0.8),
      );
      reason = "Reduced batch size due to high memory usage";
    } else if (systemMetrics.cpuUsage > this.config.targetCpuUsage) {
      bestBatchSize = Math.max(
        this.config.minBatchSize,
        Math.floor(bestBatchSize * 0.9),
      );
      reason = "Reduced batch size due to high CPU usage";
    } else if (
      systemMetrics.memoryUsage < this.config.targetMemoryUsage * 0.5 &&
      systemMetrics.cpuUsage < this.config.targetCpuUsage * 0.5
    ) {
      bestBatchSize = Math.min(
        this.config.maxBatchSize,
        Math.floor(bestBatchSize * 1.2),
      );
      reason = "Increased batch size due to low resource usage";
    }

    // Calculate expected improvement
    const currentAvg = history.filter(
      (h) => h.batchSize === this.currentBatchSize,
    );
    const currentThroughput =
      currentAvg.length > 0
        ? currentAvg.reduce((sum, r) => sum + r.throughput, 0) /
          currentAvg.length
        : 0;

    const expectedAvg = history.filter((h) => h.batchSize === bestBatchSize);
    const expectedThroughput =
      expectedAvg.length > 0
        ? expectedAvg.reduce((sum, r) => sum + r.throughput, 0) /
          expectedAvg.length
        : currentThroughput;

    const expectedImprovement =
      currentThroughput > 0
        ? Math.max(
            0,
            (expectedThroughput - currentThroughput) / currentThroughput,
          )
        : 0;

    return {
      recommendedBatchSize: bestBatchSize,
      confidence,
      reason,
      expectedImprovement,
      resourcePrediction: {
        cpuUsage: systemMetrics.cpuUsage,
        memoryUsage: systemMetrics.memoryUsage,
        throughput: expectedThroughput,
      },
    };
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(history: PerformanceHistory[]): {
    throughputTrend: number;
    memoryTrend: number;
    cpuTrend: number;
  } {
    if (history.length < 3) {
      return { throughputTrend: 0, memoryTrend: 0, cpuTrend: 0 };
    }

    const recent = history.slice(-5);
    const earlier = history.slice(-10, -5);

    const recentAvgs = {
      throughput:
        recent.reduce((sum, r) => sum + r.throughput, 0) / recent.length,
      memory: recent.reduce((sum, r) => sum + r.memoryUsage, 0) / recent.length,
      cpu: recent.reduce((sum, r) => sum + r.cpuUsage, 0) / recent.length,
    };

    const earlierAvgs =
      earlier.length > 0
        ? {
            throughput:
              earlier.reduce((sum, r) => sum + r.throughput, 0) /
              earlier.length,
            memory:
              earlier.reduce((sum, r) => sum + r.memoryUsage, 0) /
              earlier.length,
            cpu:
              earlier.reduce((sum, r) => sum + r.cpuUsage, 0) / earlier.length,
          }
        : recentAvgs;

    return {
      throughputTrend:
        earlierAvgs.throughput > 0
          ? (recentAvgs.throughput - earlierAvgs.throughput) /
            earlierAvgs.throughput
          : 0,
      memoryTrend:
        earlierAvgs.memory > 0
          ? (recentAvgs.memory - earlierAvgs.memory) / earlierAvgs.memory
          : 0,
      cpuTrend:
        earlierAvgs.cpu > 0
          ? (recentAvgs.cpu - earlierAvgs.cpu) / earlierAvgs.cpu
          : 0,
    };
  }

  /**
   * Estimate CPU usage (simplified implementation)
   */
  private estimateCpuUsage(): number {
    const usage = process.cpuUsage();
    const total = usage.user + usage.system;

    // Store recent measurements
    const key = "cpu-usage";

    if (!this.cpuMonitoring.has(key)) {
      this.cpuMonitoring.set(key, []);
    }

    const measurements = this.cpuMonitoring.get(key)!;
    measurements.push(total);

    // Keep only recent measurements
    if (measurements.length > 10) {
      measurements.shift();
    }

    // Calculate percentage (simplified)
    if (measurements.length < 2) {
      return 0;
    }

    const recent = measurements.slice(-2);
    const prev = recent[0];
    const current = recent[1];

    if (prev === undefined || current === undefined) {
      return 0;
    }

    const diff = current - prev;

    // Convert to percentage (rough approximation)
    return Math.min(100, Math.max(0, (diff / 1000000) * 100)); // microseconds to percentage
  }
}
