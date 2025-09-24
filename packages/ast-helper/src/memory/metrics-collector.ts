import { EventEmitter } from 'events';
import { loadavg, freemem } from 'os';
import type {
  MemorySnapshot,
  GCStats,
  PoolStats,
  AllocationStats
} from './types.js';

export interface MetricsConfig {
  /** Enable metrics collection */
  enabled: boolean;
  /** Metrics collection interval in milliseconds */
  collectionInterval: number;
  /** Maximum number of data points to retain */
  maxRetentionSize: number;
  /** Enable detailed performance profiling */
  detailedProfiling: boolean;
  /** Enable statistical analysis */
  statisticalAnalysis: boolean;
  /** Aggregation window size in milliseconds */
  aggregationWindow: number;
  /** Enable memory leak correlation */
  leakCorrelation: boolean;
}

export interface SystemMetrics {
  timestamp: number;
  memory: MemorySnapshot;
  gc: GCStats;
  pools: Map<string, PoolStats>;
  allocations: AllocationStats;
  performance: PerformanceMetadata;
  system: SystemResourceMetrics;
}

export interface PerformanceMetadata {
  cpuUsage: number;
  uptime: number;
  loadAverage: number[];
  eventLoopLag: number;
  networkConnections: number;
}

export interface SystemResourceMetrics {
  processCpuPercent: number;
  systemCpuPercent: number;
  availableMemoryGB: number;
  diskSpaceGB: {
    total: number;
    available: number;
    used: number;
  };
  networkIO: {
    bytesRead: number;
    bytesWritten: number;
  };
}

export interface MetricsAggregation {
  timeWindow: {
    start: number;
    end: number;
    duration: number;
  };
  memory: MemoryStatistics;
  gc: GCStatistics;
  performance: PerformanceStatistics;
  correlations: CorrelationAnalysis;
}

export interface MemoryStatistics {
  heapUsed: StatisticalSummary;
  heapTotal: StatisticalSummary;
  rss: StatisticalSummary;
  external: StatisticalSummary;
  heapUtilization: StatisticalSummary;
  growthRate: StatisticalSummary;
  peakUsage: number;
  memoryEfficiency: number;
}

export interface GCStatistics {
  totalCollections: number;
  averageInterval: number;
  averageDuration: StatisticalSummary;
  memoryReclaimed: StatisticalSummary;
  efficiency: StatisticalSummary;
  pressureEvents: number;
}

export interface PerformanceStatistics {
  eventLoopLag: StatisticalSummary;
  cpuUsage: StatisticalSummary;
  throughput: StatisticalSummary;
  latency: StatisticalSummary;
  errorRate: StatisticalSummary;
}

export interface StatisticalSummary {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export interface CorrelationAnalysis {
  memoryVsCpu: number;
  gcVsLatency: number;
  poolUtilizationVsPerformance: number;
  leakProbabilityScore: number;
  performanceScore: number;
  recommendations: string[];
}

export interface MetricsSnapshot {
  timestamp: number;
  summary: MetricsSummary;
  trends: TrendAnalysis;
  alerts: MetricsAlert[];
  recommendations: PerformanceRecommendation[];
}

export interface MetricsSummary {
  memoryUtilization: number;
  gcEfficiency: number;
  performanceScore: number;
  systemHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  keyMetrics: {
    memoryUsageMB: number;
    gcFrequency: number;
    avgLatencyMs: number;
    errorRate: number;
  };
}

export interface TrendAnalysis {
  memoryTrend: 'improving' | 'stable' | 'degrading';
  performanceTrend: 'improving' | 'stable' | 'degrading';
  projectedMemoryUsage24h: number;
  projectedGCImpact: number;
}

export interface MetricsAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'memory' | 'performance' | 'gc' | 'system';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export interface PerformanceRecommendation {
  id: string;
  category: 'memory' | 'gc' | 'pools' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: string;
  implementationComplexity: 'low' | 'medium' | 'high';
}

/**
 * Comprehensive performance metrics collection and analysis system
 * Provides real-time monitoring, statistical analysis, and performance insights
 */
export class PerformanceMetricsCollector extends EventEmitter {
  private config: MetricsConfig;
  private isRunning = false;
  private collectionTimer: NodeJS.Timeout | null = null;
  private metricsHistory: SystemMetrics[] = [];
  private aggregatedMetrics: MetricsAggregation[] = [];
  private lastEventLoopTimestamp = 0;
  private eventLoopSamples: number[] = [];

  constructor(config: Partial<MetricsConfig> = {}) {
    super();
    this.config = this.mergeConfig(config);
    this.initializeEventLoopLagDetection();
  }

  /**
   * Start metrics collection
   */
  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    this.isRunning = true;
    this.emit('started');

    // Start collection cycle
    await this.collectMetrics();
    this.scheduleNextCollection();
  }

  /**
   * Stop metrics collection
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.collectionTimer) {
      clearTimeout(this.collectionTimer);
      this.collectionTimer = null;
    }

    this.emit('stopped');
  }

  /**
   * Get current metrics snapshot
   */
  async getMetricsSnapshot(): Promise<MetricsSnapshot> {
    const currentMetrics = await this.collectCurrentMetrics();
    const summary = this.calculateSummary(currentMetrics);
    const trends = this.analyzeTrends();
    const alerts = this.generateAlerts(currentMetrics);
    const recommendations = this.generateRecommendations(currentMetrics);

    return {
      timestamp: Date.now(),
      summary,
      trends,
      alerts,
      recommendations
    };
  }

  /**
   * Get aggregated metrics for a time window
   */
  getAggregatedMetrics(startTime: number, endTime: number): MetricsAggregation | null {
    const relevantMetrics = this.metricsHistory.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );

    if (relevantMetrics.length === 0) {
      return null;
    }

    return this.aggregateMetrics(relevantMetrics, startTime, endTime);
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): SystemMetrics[] {
    const history = [...this.metricsHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get performance recommendations
   */
  async getPerformanceRecommendations(): Promise<PerformanceRecommendation[]> {
    const currentMetrics = await this.collectCurrentMetrics();
    return this.generateRecommendations(currentMetrics);
  }

  /**
   * Force immediate metrics collection
   */
  async forceCollection(): Promise<SystemMetrics> {
    const metrics = await this.collectCurrentMetrics();
    
    // Store metrics in history
    this.metricsHistory.push(metrics);
    
    // Trim history if needed
    if (this.metricsHistory.length > this.config.maxRetentionSize) {
      this.metricsHistory.shift();
    }
    
    return metrics;
  }

  private mergeConfig(config: Partial<MetricsConfig>): MetricsConfig {
    return {
      enabled: config.enabled ?? true,
      collectionInterval: config.collectionInterval ?? 30000, // 30 seconds
      maxRetentionSize: config.maxRetentionSize ?? 1000,
      detailedProfiling: config.detailedProfiling ?? false,
      statisticalAnalysis: config.statisticalAnalysis ?? true,
      aggregationWindow: config.aggregationWindow ?? 300000, // 5 minutes
      leakCorrelation: config.leakCorrelation ?? true
    };
  }

  private initializeEventLoopLagDetection(): void {
    this.lastEventLoopTimestamp = Date.now();
    
    const measureEventLoopLag = () => {
      const now = Date.now();
      const lag = Math.max(0, now - this.lastEventLoopTimestamp - 10); // Expected 10ms
      this.eventLoopSamples.push(lag);
      
      // Keep only recent samples
      if (this.eventLoopSamples.length > 100) {
        this.eventLoopSamples.shift();
      }
      
      this.lastEventLoopTimestamp = now;
      
      if (this.isRunning) {
        setTimeout(measureEventLoopLag, 10);
      }
    };

    measureEventLoopLag();
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.collectCurrentMetrics();
      
      // Store metrics
      this.metricsHistory.push(metrics);
      
      // Trim history if needed
      if (this.metricsHistory.length > this.config.maxRetentionSize) {
        this.metricsHistory.shift();
      }

      // Emit metrics event
      this.emit('metrics-collected', metrics);

      // Perform aggregation if enabled
      if (this.config.statisticalAnalysis) {
        await this.performAggregation();
      }

    } catch (error) {
      this.emit('error', error);
    }
  }

  private async collectCurrentMetrics(): Promise<SystemMetrics> {
    const timestamp = Date.now();
    
    // Collect memory metrics
    const memoryUsage = process.memoryUsage();
    const memory: MemorySnapshot = {
      timestamp,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      arrayBuffers: memoryUsage.arrayBuffers,
      heapUtilization: memoryUsage.heapUsed / memoryUsage.heapTotal
    };

    // Collect GC stats (placeholder - would integrate with actual GC scheduler)
    const gc: GCStats = {
      totalGCs: 0,
      totalTimeMS: 0,
      totalMemoryCleaned: 0,
      averageGCTime: 0,
      averageMemoryCleaned: 0,
      lastGC: null
    };

    // Collect pool stats (placeholder - would integrate with actual pool managers)
    const pools = new Map<string, PoolStats>();

    // Collect allocation stats (placeholder)
    const allocations: AllocationStats = {
      totalAllocations: 0,
      totalBytes: 0,
      allocationRate: 0,
      byteRate: 0,
      topTypes: [],
      timeline: []
    };

    // Collect performance metadata
    const performance: PerformanceMetadata = {
      cpuUsage: this.getCpuUsage(),
      uptime: process.uptime(),
      loadAverage: loadavg(),
      eventLoopLag: this.calculateEventLoopLag(),
      networkConnections: 0 // Would integrate with actual network monitoring
    };

    // Collect system resource metrics
    const system: SystemResourceMetrics = {
      processCpuPercent: this.getProcessCpuUsage(),
      systemCpuPercent: this.getSystemCpuUsage(),
      availableMemoryGB: this.getAvailableMemoryGB(),
      diskSpaceGB: this.getDiskSpaceInfo(),
      networkIO: this.getNetworkIO()
    };

    return {
      timestamp,
      memory,
      gc,
      pools,
      allocations,
      performance,
      system
    };
  }

  private scheduleNextCollection(): void {
    if (!this.isRunning) {
      return;
    }

    this.collectionTimer = setTimeout(async () => {
      await this.collectMetrics();
      this.scheduleNextCollection();
    }, this.config.collectionInterval);
  }

  private async performAggregation(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.config.aggregationWindow;
    
    const windowMetrics = this.metricsHistory.filter(
      m => m.timestamp >= windowStart
    );

    if (windowMetrics.length > 0) {
      const aggregation = this.aggregateMetrics(windowMetrics, windowStart, now);
      this.aggregatedMetrics.push(aggregation);
      
      // Keep only recent aggregations
      const maxAggregations = 100;
      if (this.aggregatedMetrics.length > maxAggregations) {
        this.aggregatedMetrics.shift();
      }

      this.emit('aggregation-completed', aggregation);
    }
  }

  private aggregateMetrics(metrics: SystemMetrics[], startTime: number, endTime: number): MetricsAggregation {
    const memoryData = metrics.map(m => m.memory);
    const gcData = metrics.map(m => m.gc);
    const performanceData = metrics.map(m => m.performance);

    return {
      timeWindow: {
        start: startTime,
        end: endTime,
        duration: endTime - startTime
      },
      memory: this.calculateMemoryStatistics(memoryData),
      gc: this.calculateGCStatistics(gcData),
      performance: this.calculatePerformanceStatistics(performanceData),
      correlations: this.calculateCorrelations(metrics)
    };
  }

  private calculateMemoryStatistics(memoryData: MemorySnapshot[]): MemoryStatistics {
    const heapUsed = memoryData.map(m => m.heapUsed);
    const heapTotal = memoryData.map(m => m.heapTotal);
    const rss = memoryData.map(m => m.rss);
    const external = memoryData.map(m => m.external);
    const heapUtilization = memoryData.map(m => m.heapUtilization);
    
    // Calculate growth rates
    const growthRates: number[] = [];
    for (let i = 1; i < memoryData.length; i++) {
      const current = memoryData[i];
      const previous = memoryData[i - 1];
      if (current && previous) {
        const timeDiff = (current.timestamp - previous.timestamp) / 1000; // seconds
        const growthRate = timeDiff > 0 ? (current.heapUsed - previous.heapUsed) / timeDiff : 0;
        growthRates.push(growthRate);
      }
    }

    return {
      heapUsed: this.calculateStatisticalSummary(heapUsed),
      heapTotal: this.calculateStatisticalSummary(heapTotal),
      rss: this.calculateStatisticalSummary(rss),
      external: this.calculateStatisticalSummary(external),
      heapUtilization: this.calculateStatisticalSummary(heapUtilization),
      growthRate: this.calculateStatisticalSummary(growthRates),
      peakUsage: Math.max(...heapUsed),
      memoryEfficiency: this.calculateMemoryEfficiency(memoryData)
    };
  }

  private calculateGCStatistics(gcData: GCStats[]): GCStatistics {
    const durations = gcData.map(gc => gc.averageGCTime).filter(d => d > 0);
    const memoryReclaimed = gcData.map(gc => gc.averageMemoryCleaned).filter(m => m > 0);
    const efficiencies = durations.map((duration, i) => {
      const reclaimed = memoryReclaimed[i];
      return duration > 0 && reclaimed !== undefined ? reclaimed / duration : 0;
    }).filter(e => e > 0);

    return {
      totalCollections: gcData[gcData.length - 1]?.totalGCs || 0,
      averageInterval: this.calculateAverageInterval(gcData),
      averageDuration: this.calculateStatisticalSummary(durations),
      memoryReclaimed: this.calculateStatisticalSummary(memoryReclaimed),
      efficiency: this.calculateStatisticalSummary(efficiencies),
      pressureEvents: 0 // Would integrate with actual pressure detection
    };
  }

  private calculatePerformanceStatistics(performanceData: PerformanceMetadata[]): PerformanceStatistics {
    const cpuUsages = performanceData.map(p => p.cpuUsage);
    const throughputs = performanceData.map(() => 0); // Placeholder
    const latencies = performanceData.map(() => 0); // Placeholder
    const errorRates = performanceData.map(() => 0); // Placeholder

    return {
      eventLoopLag: this.calculateStatisticalSummary(performanceData.map(p => p.eventLoopLag)),
      cpuUsage: this.calculateStatisticalSummary(cpuUsages),
      throughput: this.calculateStatisticalSummary(throughputs),
      latency: this.calculateStatisticalSummary(latencies),
      errorRate: this.calculateStatisticalSummary(errorRates)
    };
  }

  private calculateStatisticalSummary(data: number[]): StatisticalSummary {
    if (data.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 }
      };
    }

    const sorted = [...data].sort((a, b) => a - b);
    const count = data.length;
    const min = sorted[0] ?? 0;
    const max = sorted[count - 1] ?? 0;
    const mean = data.reduce((sum, val) => sum + val, 0) / count;
    const median = this.calculateMedian(sorted);
    const stdDev = Math.sqrt(
      data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count
    );

    const percentiles = {
      p50: this.calculatePercentile(sorted, 50),
      p90: this.calculatePercentile(sorted, 90),
      p95: this.calculatePercentile(sorted, 95),
      p99: this.calculatePercentile(sorted, 99)
    };

    return {
      count,
      min,
      max,
      mean,
      median,
      stdDev,
      percentiles
    };
  }

  private calculateCorrelations(metrics: SystemMetrics[]): CorrelationAnalysis {
    // Simplified correlation calculations
    const memoryUsages = metrics.map(m => m.memory.heapUsed);
    const cpuUsages = metrics.map(m => m.performance.cpuUsage);
    
    return {
      memoryVsCpu: this.calculateCorrelation(memoryUsages, cpuUsages),
      gcVsLatency: 0, // Placeholder
      poolUtilizationVsPerformance: 0, // Placeholder
      leakProbabilityScore: this.calculateLeakProbability(metrics),
      performanceScore: this.calculatePerformanceScore(metrics),
      recommendations: this.generateCorrelationRecommendations(metrics)
    };
  }

  private calculateSummary(metrics: SystemMetrics): MetricsSummary {
    const memoryUtilization = metrics.memory.heapUtilization;
    const performanceScore = this.calculateOverallPerformanceScore(metrics);
    
    let systemHealth: MetricsSummary['systemHealth'] = 'excellent';
    if (performanceScore < 0.6) {
systemHealth = 'critical';
} else if (performanceScore < 0.7) {
systemHealth = 'poor';
} else if (performanceScore < 0.8) {
systemHealth = 'fair';
} else if (performanceScore < 0.9) {
systemHealth = 'good';
}

    return {
      memoryUtilization,
      gcEfficiency: 0.8, // Placeholder
      performanceScore,
      systemHealth,
      keyMetrics: {
        memoryUsageMB: metrics.memory.heapUsed / (1024 * 1024),
        gcFrequency: 0, // Placeholder
        avgLatencyMs: metrics.performance.eventLoopLag,
        errorRate: 0 // Placeholder
      }
    };
  }

  private analyzeTrends(): TrendAnalysis {
    // Simplified trend analysis
    return {
      memoryTrend: 'stable', // Would analyze actual trends
      performanceTrend: 'stable',
      projectedMemoryUsage24h: 0,
      projectedGCImpact: 0
    };
  }

  private generateAlerts(metrics: SystemMetrics): MetricsAlert[] {
    const alerts: MetricsAlert[] = [];
    
    // Memory usage alert
    if (metrics.memory.heapUtilization > 0.9) {
      alerts.push({
        id: `memory-high-${Date.now()}`,
        severity: 'critical',
        category: 'memory',
        message: 'High memory utilization detected',
        value: metrics.memory.heapUtilization,
        threshold: 0.9,
        timestamp: metrics.timestamp
      });
    }

    // Event loop lag alert
    if (metrics.performance.eventLoopLag > 100) {
      alerts.push({
        id: `eventloop-lag-${Date.now()}`,
        severity: 'warning',
        category: 'system',
        message: 'High event loop lag detected',
        value: metrics.performance.eventLoopLag,
        threshold: 100,
        timestamp: metrics.timestamp
      });
    }

    return alerts;
  }

  private generateRecommendations(metrics: SystemMetrics): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    if (metrics.memory.heapUtilization > 0.8) {
      recommendations.push({
        id: 'reduce-memory-usage',
        category: 'memory',
        priority: 'high',
        title: 'Optimize Memory Usage',
        description: 'High memory utilization detected. Consider implementing memory pooling or reducing cache sizes.',
        expectedImpact: 'Reduce memory usage by 20-30%',
        implementationComplexity: 'medium'
      });
    }

    if (metrics.performance.eventLoopLag > 50) {
      recommendations.push({
        id: 'reduce-eventloop-blocking',
        category: 'system',
        priority: 'medium',
        title: 'Reduce Event Loop Blocking',
        description: 'High event loop lag indicates blocking operations. Consider using async/await or worker threads.',
        expectedImpact: 'Improve response times by 40-50%',
        implementationComplexity: 'medium'
      });
    }

    return recommendations;
  }

  // Helper methods for system metrics collection
  private getCpuUsage(): number {
    return process.cpuUsage().user / 1000000; // Convert to seconds
  }

  private calculateEventLoopLag(): number {
    return this.eventLoopSamples.length > 0 
      ? this.eventLoopSamples.reduce((sum, lag) => sum + lag, 0) / this.eventLoopSamples.length 
      : 0;
  }

  private getProcessCpuUsage(): number {
    // Placeholder - would use actual CPU monitoring
    return 0;
  }

  private getSystemCpuUsage(): number {
    // Placeholder - would use actual system CPU monitoring
    return 0;
  }

  private getAvailableMemoryGB(): number {
    return freemem() / (1024 * 1024 * 1024);
  }

  private getDiskSpaceInfo(): SystemResourceMetrics['diskSpaceGB'] {
    // Placeholder - would use actual disk space monitoring
    return { total: 0, available: 0, used: 0 };
  }

  private getNetworkIO(): SystemResourceMetrics['networkIO'] {
    // Placeholder - would use actual network I/O monitoring
    return { bytesRead: 0, bytesWritten: 0 };
  }

  private calculateMedian(sortedData: number[]): number {
    if (sortedData.length === 0) {
return 0;
}
    
    const mid = Math.floor(sortedData.length / 2);
    return sortedData.length % 2 === 0
      ? ((sortedData[mid - 1] ?? 0) + (sortedData[mid] ?? 0)) / 2
      : sortedData[mid] ?? 0;
  }

  private calculatePercentile(sortedData: number[], percentile: number): number {
    if (sortedData.length === 0) {
return 0;
}
    
    const index = Math.ceil((percentile / 100) * sortedData.length) - 1;
    return sortedData[Math.max(0, Math.min(index, sortedData.length - 1))] ?? 0;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) {
return 0;
}
    
    const n = x.length;
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;
    
    for (let i = 0; i < n; i++) {
      const deltaX = (x[i] ?? 0) - meanX;
      const deltaY = (y[i] ?? 0) - meanY;
      numerator += deltaX * deltaY;
      sumXSquared += deltaX * deltaX;
      sumYSquared += deltaY * deltaY;
    }
    
    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateMemoryEfficiency(memoryData: MemorySnapshot[]): number {
    // Simplified efficiency calculation
    if (memoryData.length === 0) {
return 1.0;
}
    
    const avgUtilization = memoryData.reduce((sum, m) => sum + m.heapUtilization, 0) / memoryData.length;
    return Math.max(0, Math.min(1, 1 - avgUtilization + 0.3)); // Prefer moderate utilization
  }

  private calculateAverageInterval(_gcData: GCStats[]): number {
    // Placeholder - would calculate actual interval between GCs
    return 0;
  }

  private calculateLeakProbability(metrics: SystemMetrics[]): number {
    // Simplified leak probability calculation
    if (metrics.length < 2) {
return 0;
}
    
    const memoryGrowth: number[] = [];
    for (let i = 1; i < metrics.length; i++) {
      const current = metrics[i];
      const previous = metrics[i - 1];
      if (current && previous) {
        memoryGrowth.push(current.memory.heapUsed - previous.memory.heapUsed);
      }
    }
    
    const positiveGrowth = memoryGrowth.filter(g => g > 0);
    return memoryGrowth.length > 0 ? positiveGrowth.length / memoryGrowth.length : 0;
  }

  private calculatePerformanceScore(metrics: SystemMetrics[]): number {
    // Simplified performance score calculation
    const avgMetrics = metrics[metrics.length - 1] || metrics[0];
    if (!avgMetrics) {
return 1.0;
}
    
    const memoryScore = Math.max(0, 1 - avgMetrics.memory.heapUtilization);
    const lagScore = Math.max(0, 1 - avgMetrics.performance.eventLoopLag / 100);
    
    return (memoryScore + lagScore) / 2;
  }

  private calculateOverallPerformanceScore(metrics: SystemMetrics): number {
    const memoryScore = Math.max(0, 1 - metrics.memory.heapUtilization);
    const lagScore = Math.max(0, 1 - metrics.performance.eventLoopLag / 100);
    const cpuScore = Math.max(0, 1 - metrics.performance.cpuUsage / 100);
    
    return (memoryScore + lagScore + cpuScore) / 3;
  }

  private generateCorrelationRecommendations(metrics: SystemMetrics[]): string[] {
    const recommendations: string[] = [];
    
    if (metrics.length > 0) {
      const latest = metrics[metrics.length - 1];
      
      if (latest && latest.memory.heapUtilization > 0.8) {
        recommendations.push('Consider implementing memory pooling to reduce allocation overhead');
      }
      
      if (latest && latest.performance.eventLoopLag > 50) {
        recommendations.push('Move CPU-intensive operations to worker threads');
      }
    }
    
    return recommendations;
  }
}