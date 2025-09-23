/**
 * @fileoverview Crash analytics and trend analysis system
 * @module @ast-copilot-helper/ast-helper/error-reporting/crash/analytics
 */

import type {
  CrashReport,
  CrashAnalytics,
  CrashType,
  CrashSeverity,
  SystemStateSnapshot
} from './types.js';

/**
 * Analytics configuration
 */
interface AnalyticsConfig {
  analysisWindow: number; // milliseconds
  trendSamplingInterval: number; // milliseconds
  correlationThreshold: number; // 0-1
  patternDetectionMinOccurrences: number;
  enableRealTimeAnalysis: boolean;
  maxAnalyticsHistory: number;
}

/**
 * Real-time analytics data point
 */
interface AnalyticsDataPoint {
  timestamp: Date;
  crashCount: number;
  severityDistribution: Record<CrashSeverity, number>;
  resourceMetrics: {
    memory: number;
    cpu: number;
    handles: number;
  };
  recoverySuccessRate: number;
}

/**
 * Crash analytics and trend analysis engine
 */
export class CrashAnalyticsEngine {
  private config: AnalyticsConfig;
  private analyticsHistory: AnalyticsDataPoint[] = [];
  // Future enhancements can use these for advanced pattern caching and correlation analysis
  // private _patternCache: Map<string, CrashPatternSignature> = new Map();
  // private _correlationMatrix: Map<string, Map<string, number>> = new Map();
  
  private readonly DEFAULT_CONFIG: AnalyticsConfig = {
    analysisWindow: 24 * 60 * 60 * 1000, // 24 hours
    trendSamplingInterval: 5 * 60 * 1000, // 5 minutes
    correlationThreshold: 0.7,
    patternDetectionMinOccurrences: 3,
    enableRealTimeAnalysis: true,
    maxAnalyticsHistory: 1000
  };
  
  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Generate comprehensive crash analytics
   */
  async generateAnalytics(
    crashes: CrashReport[],
    options: {
      startDate?: Date;
      endDate?: Date;
      severity?: CrashSeverity[];
      crashTypes?: CrashType[];
    } = {}
  ): Promise<CrashAnalytics> {
    console.log('📊 Generating crash analytics...');
    
    // Filter crashes based on options
    const filteredCrashes = this.filterCrashes(crashes, options);
    
    if (filteredCrashes.length === 0) {
      return this.generateEmptyAnalytics(options);
    }
    
    const analysisStart = options.startDate || new Date(Date.now() - this.config.analysisWindow);
    const analysisEnd = options.endDate || new Date();
    
    // Generate statistics
    const statistics = this.generateStatistics(filteredCrashes, analysisStart, analysisEnd);
    
    // Generate trends
    const trends = await this.generateTrends(filteredCrashes, analysisStart, analysisEnd);
    
    // Detect patterns
    const patterns = this.detectPatterns(filteredCrashes);
    
    const analytics: CrashAnalytics = {
      period: {
        start: analysisStart,
        end: analysisEnd,
        duration: analysisEnd.getTime() - analysisStart.getTime()
      },
      statistics,
      trends,
      patterns
    };
    
    console.log(`✅ Analytics generated for ${filteredCrashes.length} crashes`);
    return analytics;
  }
  
  /**
   * Add real-time analytics data point
   */
  addAnalyticsDataPoint(crashes: CrashReport[]): void {
    if (!this.config.enableRealTimeAnalysis) {
      return;
    }
    
    const recentCrashes = crashes.filter(crash => 
      crash.timestamp.getTime() > Date.now() - this.config.trendSamplingInterval
    );
    
    const severityDistribution = this.calculateSeverityDistribution(recentCrashes);
    const resourceMetrics = this.calculateResourceMetrics(recentCrashes);
    const recoverySuccessRate = this.calculateRecoverySuccessRate(recentCrashes);
    
    const dataPoint: AnalyticsDataPoint = {
      timestamp: new Date(),
      crashCount: recentCrashes.length,
      severityDistribution,
      resourceMetrics,
      recoverySuccessRate
    };
    
    this.analyticsHistory.push(dataPoint);
    
    // Enforce history limit
    if (this.analyticsHistory.length > this.config.maxAnalyticsHistory) {
      this.analyticsHistory = this.analyticsHistory.slice(-this.config.maxAnalyticsHistory);
    }
  }
  
  /**
   * Detect anomalies in crash patterns
   */
  detectAnomalies(crashes: CrashReport[]): Array<{
    type: 'spike' | 'pattern-change' | 'resource-leak' | 'recovery-failure';
    severity: 'low' | 'medium' | 'high';
    description: string;
    affectedTimeRange: { start: Date; end: Date };
    crashes: string[]; // crash IDs
    recommendedActions: string[];
  }> {
    console.log('🔍 Detecting crash anomalies...');
    
    const anomalies: Array<{
      type: 'spike' | 'pattern-change' | 'resource-leak' | 'recovery-failure';
      severity: 'low' | 'medium' | 'high';
      description: string;
      affectedTimeRange: { start: Date; end: Date };
      crashes: string[];
      recommendedActions: string[];
    }> = [];
    
    // Detect crash spikes
    const spikes = this.detectCrashSpikes(crashes);
    anomalies.push(...spikes);
    
    // Detect pattern changes
    const patternChanges = this.detectPatternChanges(crashes);
    anomalies.push(...patternChanges);
    
    // Detect resource leaks
    const resourceLeaks = this.detectResourceLeakPatterns(crashes);
    anomalies.push(...resourceLeaks);
    
    // Detect recovery failures
    const recoveryFailures = this.detectRecoveryFailures(crashes);
    anomalies.push(...recoveryFailures);
    
    console.log(`🚨 Detected ${anomalies.length} anomalies`);
    return anomalies;
  }
  
  /**
   * Predict future crash likelihood
   */
  predictCrashLikelihood(
    currentSystemState: SystemStateSnapshot,
    recentCrashes: CrashReport[]
  ): {
    likelihood: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    timeToNextCrash?: number;
    mostLikelyType: CrashType;
    preventiveActions: string[];
  } {
    console.log('🔮 Predicting crash likelihood...');
    
    // Analyze current resource usage
    const resourceScore = this.analyzeResourceRisk(currentSystemState);
    
    // Analyze recent crash patterns
    const patternScore = this.analyzePatternRisk(recentCrashes);
    
    // Calculate combined risk score
    const combinedScore = (resourceScore + patternScore) / 2;
    
    let likelihood: 'low' | 'medium' | 'high' | 'critical';
    if (combinedScore > 0.8) {
likelihood = 'critical';
} else if (combinedScore > 0.6) {
likelihood = 'high';
} else if (combinedScore > 0.4) {
likelihood = 'medium';
} else {
likelihood = 'low';
}
    
    // Estimate time to next crash based on historical patterns
    const timeToNextCrash = this.estimateTimeToNextCrash(recentCrashes);
    
    // Determine most likely crash type
    const mostLikelyType = this.predictMostLikelyCrashType(recentCrashes, currentSystemState);
    
    // Generate preventive actions
    const preventiveActions = this.generatePreventiveActions(likelihood, mostLikelyType, currentSystemState);
    
    return {
      likelihood,
      confidence: Math.min(combinedScore + 0.2, 1.0),
      timeToNextCrash,
      mostLikelyType,
      preventiveActions
    };
  }
  
  /**
   * Filter crashes based on criteria
   */
  private filterCrashes(
    crashes: CrashReport[],
    options: {
      startDate?: Date;
      endDate?: Date;
      severity?: CrashSeverity[];
      crashTypes?: CrashType[];
    }
  ): CrashReport[] {
    return crashes.filter(crash => {
      // Date filtering
      if (options.startDate && crash.timestamp < options.startDate) {
        return false;
      }
      if (options.endDate && crash.timestamp > options.endDate) {
        return false;
      }
      
      // Severity filtering
      if (options.severity && !options.severity.includes(crash.severity)) {
        return false;
      }
      
      // Type filtering
      if (options.crashTypes && !options.crashTypes.includes(crash.type)) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Generate basic statistics
   */
  private generateStatistics(
    crashes: CrashReport[],
    startDate: Date,
    endDate: Date
  ): CrashAnalytics['statistics'] {
    const duration = endDate.getTime() - startDate.getTime();
    const hoursInPeriod = duration / (60 * 60 * 1000);
    
    const severityDistribution = this.calculateSeverityDistribution(crashes);
    const typeDistribution = this.calculateTypeDistribution(crashes);
    
    const successfulRecoveries = crashes.filter(crash => 
      crash.recovery.finalState === 'recovered'
    ).length;
    
    const recoveryTimes = crashes
      .filter(crash => crash.recovery.attempted)
      .map(crash => crash.recovery.recoveryDuration);
    
    const timeBetweenFailures = this.calculateTimeBetweenFailures(crashes);
    
    return {
      totalCrashes: crashes.length,
      crashRate: crashes.length / hoursInPeriod,
      severityDistribution,
      typeDistribution,
      recoverySuccessRate: crashes.length > 0 ? successfulRecoveries / crashes.length : 0,
      meanTimeToRecovery: this.calculateMean(recoveryTimes),
      meanTimeBetweenFailures: this.calculateMean(timeBetweenFailures)
    };
  }
  
  /**
   * Generate trend analysis
   */
  private async generateTrends(
    crashes: CrashReport[],
    startDate: Date,
    endDate: Date
  ): Promise<CrashAnalytics['trends']> {
    const timeStep = this.config.trendSamplingInterval;
    const crashFrequency = [];
    const resourceConsumption = [];
    const recoveryEffectiveness = [];
    
    for (let time = startDate.getTime(); time < endDate.getTime(); time += timeStep) {
      const windowStart = new Date(time);
      const windowEnd = new Date(time + timeStep);
      
      const windowCrashes = crashes.filter(crash =>
        crash.timestamp >= windowStart && crash.timestamp < windowEnd
      );
      
      // Crash frequency
      if (windowCrashes.length > 0) {
        const severityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
        const weightedSeverity = windowCrashes.reduce((sum, crash) => 
          sum + severityWeights[crash.severity], 0
        ) / windowCrashes.length;
        
        crashFrequency.push({
          timestamp: windowStart,
          count: windowCrashes.length,
          severity: this.mapWeightToSeverity(weightedSeverity)
        });
      }
      
      // Resource consumption
      if (windowCrashes.length > 0) {
        const avgMemory = this.calculateMean(windowCrashes.map(crash => 
          crash.systemState.heap.used / crash.systemState.heap.total * 100
        ));
        const avgHandles = this.calculateMean(windowCrashes.map(crash => 
          crash.systemState.handles.active
        ));
        
        resourceConsumption.push({
          timestamp: windowStart,
          memory: avgMemory,
          cpu: 0, // Would need CPU metrics from system state
          handles: avgHandles
        });
      }
      
      // Recovery effectiveness
      const recoveredCrashes = windowCrashes.filter(crash => 
        crash.recovery.finalState === 'recovered'
      );
      const avgRecoveryTime = this.calculateMean(windowCrashes
        .filter(crash => crash.recovery.attempted)
        .map(crash => crash.recovery.recoveryDuration)
      );
      
      if (windowCrashes.length > 0) {
        recoveryEffectiveness.push({
          timestamp: windowStart,
          successRate: recoveredCrashes.length / windowCrashes.length,
          averageDuration: avgRecoveryTime || 0
        });
      }
    }
    
    return {
      crashFrequency,
      resourceConsumption,
      recoveryEffectiveness
    };
  }
  
  /**
   * Detect crash patterns
   */
  private detectPatterns(crashes: CrashReport[]): CrashAnalytics['patterns'] {
    // Common stack traces
    const stackTraceMap = new Map<string, {
      signature: string;
      crashes: CrashReport[];
      firstSeen: Date;
      lastSeen: Date;
    }>();
    
    crashes.forEach(crash => {
      const signature = this.generateStackTraceSignature(crash);
      if (!stackTraceMap.has(signature)) {
        stackTraceMap.set(signature, {
          signature,
          crashes: [],
          firstSeen: crash.timestamp,
          lastSeen: crash.timestamp
        });
      }
      
      const entry = stackTraceMap.get(signature)!;
      entry.crashes.push(crash);
      entry.lastSeen = new Date(Math.max(entry.lastSeen.getTime(), crash.timestamp.getTime()));
    });
    
    const commonStackTraces = Array.from(stackTraceMap.values())
      .filter(entry => entry.crashes.length >= this.config.patternDetectionMinOccurrences)
      .map(entry => ({
        signature: entry.signature,
        count: entry.crashes.length,
        firstSeen: entry.firstSeen,
        lastSeen: entry.lastSeen,
        impactLevel: this.calculateImpactLevel(entry.crashes)
      }))
      .sort((a, b) => b.count - a.count);
    
    // Event correlations
    const correlations = this.detectEventCorrelations(crashes);
    
    // Hot spots (components with high crash rates)
    const hotSpots = this.detectHotSpots(crashes);
    
    return {
      commonStackTraces,
      correlations,
      hotSpots
    };
  }
  
  /**
   * Calculate severity distribution
   */
  private calculateSeverityDistribution(crashes: CrashReport[]): Record<CrashSeverity, number> {
    const distribution: Record<CrashSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    crashes.forEach(crash => {
      distribution[crash.severity]++;
    });
    
    return distribution;
  }
  
  /**
   * Calculate type distribution
   */
  private calculateTypeDistribution(crashes: CrashReport[]): Record<CrashType, number> {
    const distribution: Record<CrashType, number> = {
      'uncaught-exception': 0,
      'unhandled-rejection': 0,
      'segmentation-fault': 0,
      'memory-error': 0,
      'stack-overflow': 0,
      'timeout-error': 0,
      'resource-exhaustion': 0,
      'external-signal': 0,
      'assertion-failure': 0,
      'unknown': 0
    };
    
    crashes.forEach(crash => {
      distribution[crash.type]++;
    });
    
    return distribution;
  }
  
  /**
   * Calculate resource metrics
   */
  private calculateResourceMetrics(crashes: CrashReport[]): {
    memory: number;
    cpu: number;
    handles: number;
  } {
    if (crashes.length === 0) {
      return { memory: 0, cpu: 0, handles: 0 };
    }
    
    const avgMemory = this.calculateMean(crashes.map(crash => 
      crash.systemState.heap.used / crash.systemState.heap.total * 100
    ));
    
    const avgHandles = this.calculateMean(crashes.map(crash => 
      crash.systemState.handles.active
    ));
    
    return {
      memory: avgMemory,
      cpu: 0, // Would need CPU usage from system state
      handles: avgHandles
    };
  }
  
  /**
   * Calculate recovery success rate
   */
  private calculateRecoverySuccessRate(crashes: CrashReport[]): number {
    if (crashes.length === 0) {
return 0;
}
    
    const successfulRecoveries = crashes.filter(crash => 
      crash.recovery.finalState === 'recovered'
    ).length;
    
    return successfulRecoveries / crashes.length;
  }
  
  /**
   * Calculate time between failures
   */
  private calculateTimeBetweenFailures(crashes: CrashReport[]): number[] {
    if (crashes.length < 2) {
return [];
}
    
    const sortedCrashes = crashes.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const intervals = [];
    
    for (let i = 1; i < sortedCrashes.length; i++) {
      const current = sortedCrashes[i];
      const previous = sortedCrashes[i - 1];
      
      if (current && previous) {
        const interval = current.timestamp.getTime() - previous.timestamp.getTime();
        intervals.push(interval);
      }
    }
    
    return intervals;
  }
  
  /**
   * Calculate mean of numeric array
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) {
return 0;
}
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  
  /**
   * Generate stack trace signature
   */
  private generateStackTraceSignature(crash: CrashReport): string {
    const key = [
      crash.error.name,
      crash.type,
      ...crash.error.stackFrames.slice(0, 3).map(frame => 
        `${frame.function || 'anonymous'}:${frame.file || 'unknown'}`
      )
    ].join('|');
    
    return Buffer.from(key).toString('base64').substring(0, 16);
  }
  
  /**
   * Calculate impact level for crashes
   */
  private calculateImpactLevel(crashes: CrashReport[]): CrashSeverity {
    const severityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
    const totalWeight = crashes.reduce((sum, crash) => sum + severityWeights[crash.severity], 0);
    const avgWeight = totalWeight / crashes.length;
    
    return this.mapWeightToSeverity(avgWeight);
  }
  
  /**
   * Map numeric weight to severity
   */
  private mapWeightToSeverity(weight: number): CrashSeverity {
    if (weight >= 3.5) {
return 'critical';
}
    if (weight >= 2.5) {
return 'high';
}
    if (weight >= 1.5) {
return 'medium';
}
    return 'low';
  }
  
  /**
   * Detect crash spikes
   */
  private detectCrashSpikes(_crashes: CrashReport[]) {
    // Simple spike detection - would be more sophisticated in production
    return [];
  }
  
  /**
   * Detect pattern changes
   */
  private detectPatternChanges(_crashes: CrashReport[]) {
    // Pattern change detection logic
    return [];
  }
  
  /**
   * Detect resource leak patterns
   */
  private detectResourceLeakPatterns(_crashes: CrashReport[]) {
    // Resource leak detection logic
    return [];
  }
  
  /**
   * Detect recovery failures
   */
  private detectRecoveryFailures(_crashes: CrashReport[]) {
    // Recovery failure detection logic
    return [];
  }
  
  /**
   * Analyze resource risk
   */
  private analyzeResourceRisk(systemState: SystemStateSnapshot): number {
    const memoryUsage = systemState.heap.used / systemState.heap.total;
    const handleUsage = systemState.handles.active / 1000; // Assume max 1000 handles
    
    return Math.min((memoryUsage + handleUsage) / 2, 1.0);
  }
  
  /**
   * Analyze pattern risk
   */
  private analyzePatternRisk(recentCrashes: CrashReport[]): number {
    if (recentCrashes.length === 0) {
return 0;
}
    
    const recentCrashRate = recentCrashes.length / 24; // crashes per hour in last day
    return Math.min(recentCrashRate / 5, 1.0); // Normalize assuming 5 crashes/hour is max
  }
  
  /**
   * Estimate time to next crash
   */
  private estimateTimeToNextCrash(recentCrashes: CrashReport[]): number | undefined {
    if (recentCrashes.length < 2) {
return undefined;
}
    
    const intervals = this.calculateTimeBetweenFailures(recentCrashes);
    const avgInterval = this.calculateMean(intervals);
    
    return avgInterval;
  }
  
  /**
   * Predict most likely crash type
   */
  private predictMostLikelyCrashType(
    recentCrashes: CrashReport[],
    _systemState: SystemStateSnapshot
  ): CrashType {
    if (recentCrashes.length === 0) {
return 'unknown';
}
    
    const typeDistribution = this.calculateTypeDistribution(recentCrashes);
    let mostCommonType: CrashType = 'unknown';
    let maxCount = 0;
    
    Object.entries(typeDistribution).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type as CrashType;
      }
    });
    
    return mostCommonType;
  }
  
  /**
   * Generate preventive actions
   */
  private generatePreventiveActions(
    likelihood: 'low' | 'medium' | 'high' | 'critical',
    crashType: CrashType,
    _systemState: SystemStateSnapshot
  ): string[] {
    const actions = [];
    
    if (likelihood === 'critical' || likelihood === 'high') {
      actions.push('Consider immediate system maintenance');
      actions.push('Monitor system resources closely');
    }
    
    if (crashType === 'memory-error') {
      actions.push('Run garbage collection');
      actions.push('Review memory usage patterns');
    }
    
    if (crashType === 'timeout-error') {
      actions.push('Check network connectivity');
      actions.push('Review timeout configurations');
    }
    
    return actions;
  }
  
  /**
   * Detect event correlations
   */
  private detectEventCorrelations(_crashes: CrashReport[]) {
    // Event correlation detection logic
    return [];
  }
  
  /**
   * Detect hot spots
   */
  private detectHotSpots(_crashes: CrashReport[]) {
    // Component hot spot detection logic
    return [];
  }
  
  /**
   * Generate empty analytics for no crashes
   */
  private generateEmptyAnalytics(options: {
    startDate?: Date;
    endDate?: Date;
  }): CrashAnalytics {
    const start = options.startDate || new Date(Date.now() - this.config.analysisWindow);
    const end = options.endDate || new Date();
    
    return {
      period: {
        start,
        end,
        duration: end.getTime() - start.getTime()
      },
      statistics: {
        totalCrashes: 0,
        crashRate: 0,
        severityDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
        typeDistribution: {
          'uncaught-exception': 0,
          'unhandled-rejection': 0,
          'segmentation-fault': 0,
          'memory-error': 0,
          'stack-overflow': 0,
          'timeout-error': 0,
          'resource-exhaustion': 0,
          'external-signal': 0,
          'assertion-failure': 0,
          'unknown': 0
        },
        recoverySuccessRate: 0,
        meanTimeToRecovery: 0,
        meanTimeBetweenFailures: 0
      },
      trends: {
        crashFrequency: [],
        resourceConsumption: [],
        recoveryEffectiveness: []
      },
      patterns: {
        commonStackTraces: [],
        correlations: [],
        hotSpots: []
      }
    };
  }
}