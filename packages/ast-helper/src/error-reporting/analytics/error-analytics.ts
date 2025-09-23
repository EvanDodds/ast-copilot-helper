/**
 * @fileoverview Error history and analytics system
 * @module @ast-copilot-helper/ast-helper/error-reporting/analytics
 */

import type {
  ErrorReport,
  ErrorHistoryEntry,
  ErrorAnalytics,
  ErrorPattern,
  ErrorTrend
} from '../types.js';

/**
 * Configuration for error analytics
 */
export interface ErrorAnalyticsConfig {
  maxHistorySize: number;
  analyticsPeriodDays: number;
  trendAnalysisWindow: number; // hours
  patternDetectionThreshold: number; // minimum occurrences
  enableRealTimeAnalytics: boolean;
  storageBackend: 'memory' | 'file' | 'database';
  enableMLAnalysis: boolean;
  retentionPolicyDays: number;
}

/**
 * Error frequency data point
 */
export interface ErrorFrequencyPoint {
  timestamp: Date;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  errorTypes: string[];
  categories: string[];
}

/**
 * Error correlation analysis
 */
export interface ErrorCorrelation {
  errorType1: string;
  errorType2: string;
  correlationStrength: number; // 0-1
  occurrences: number;
  timeWindow: string;
  confidence: number;
}

/**
 * System health metrics
 */
export interface SystemHealthMetrics {
  overallHealthScore: number; // 0-100
  errorRate: number; // errors per hour
  criticalErrorRate: number;
  averageResolutionTime: number; // minutes
  mostFrequentErrors: Array<{
    type: string;
    count: number;
    lastOccurrence: Date;
  }>;
  improvementSuggestions: string[];
}

/**
 * Error analytics and history management system
 */
export class ErrorAnalyticsManager {
  private config: ErrorAnalyticsConfig;
  private errorHistory: ErrorHistoryEntry[] = [];
  private analyticsCache: Map<string, any> = new Map();
  
  private readonly DEFAULT_CONFIG: ErrorAnalyticsConfig = {
    maxHistorySize: 10000,
    analyticsPeriodDays: 30,
    trendAnalysisWindow: 24, // 24 hours
    patternDetectionThreshold: 3,
    enableRealTimeAnalytics: true,
    storageBackend: 'memory',
    enableMLAnalysis: false, // Disabled for now
    retentionPolicyDays: 90
  };

  constructor(config: Partial<ErrorAnalyticsConfig> = {}) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Add error to history and update analytics
   */
  async addError(error: ErrorReport): Promise<void> {
    console.log(`📈 Adding error to analytics: ${error.type} - ${error.category}`);

    // Create history entry matching existing interface
    const historyEntry: ErrorHistoryEntry = {
      id: error.id,
      timestamp: error.timestamp,
      error: error,
      resolved: false,
      resolvedAt: undefined,
      resolution: undefined,
      userFeedback: undefined
    };

    // Check for similar errors
    const similarError = this.findSimilarError(error);
    if (similarError) {
      // Update existing error timestamp
      similarError.timestamp = error.timestamp;
    } else {
      // Add new error to history
      this.errorHistory.unshift(historyEntry);
    }

    // Enforce history size limit
    if (this.errorHistory.length > this.config.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.config.maxHistorySize);
    }

    // Update analytics if enabled
    if (this.config.enableRealTimeAnalytics) {
      await this.updateAnalytics();
    }

    // Clean up old entries based on retention policy
    await this.cleanupOldEntries();
  }

  /**
   * Mark error as resolved
   */
  async resolveError(errorId: string, resolutionTime?: Date): Promise<void> {
    const historyEntry = this.errorHistory.find(e => e.id === errorId);
    if (historyEntry && !historyEntry.resolved) {
      historyEntry.resolved = true;
      historyEntry.resolvedAt = resolutionTime || new Date();
      
      console.log(`✅ Error ${errorId} marked as resolved`);
      
      // Update analytics
      if (this.config.enableRealTimeAnalytics) {
        await this.updateAnalytics();
      }
    }
  }

  /**
   * Generate comprehensive error analytics
   */
  async generateAnalytics(options?: {
    startDate?: Date;
    endDate?: Date;
    categories?: string[];
    severities?: string[];
  }): Promise<ErrorAnalytics> {
    console.log('📊 Generating error analytics...');

    const startDate = options?.startDate || new Date(Date.now() - this.config.analyticsPeriodDays * 24 * 60 * 60 * 1000);
    const endDate = options?.endDate || new Date();

    // Filter errors based on criteria
    const filteredErrors = this.filterErrors(startDate, endDate, options);

    // Generate basic statistics
    const totalErrors = filteredErrors.length;
    const resolvedErrors = filteredErrors.filter(e => e.resolved).length;
    const criticalErrors = filteredErrors.filter(e => e.error.severity === 'critical').length;

    // Calculate error rate (errors per hour)
    const timeSpanHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const errorRate = totalErrors / timeSpanHours;

    // Generate severity distribution
    const severityDistribution = this.calculateSeverityDistribution(filteredErrors);

    // Generate category distribution
    const categoryDistribution = this.calculateCategoryDistribution(filteredErrors);

    // Generate trends
    const trends = await this.generateTrends(filteredErrors, startDate, endDate);

    // Detect patterns
    const patterns = await this.detectPatterns(filteredErrors);

    // Generate correlations
    const correlations = await this.generateCorrelations(filteredErrors);

    const analytics: ErrorAnalytics = {
      period: {
        start: startDate,
        end: endDate,
        duration: endDate.getTime() - startDate.getTime()
      },
      summary: {
        totalErrors,
        resolvedErrors,
        unresolvedErrors: totalErrors - resolvedErrors,
        criticalErrors,
        errorRate,
        resolutionRate: totalErrors > 0 ? resolvedErrors / totalErrors : 0,
        averageResolutionTime: this.calculateAverageResolutionTime(filteredErrors)
      },
      distribution: {
        severity: severityDistribution,
        category: categoryDistribution,
        byTime: this.generateTimeDistribution(filteredErrors, startDate, endDate)
      },
      trends,
      patterns,
      correlations,
      recommendations: await this.generateRecommendations(filteredErrors)
    };

    console.log(`✅ Analytics generated for ${totalErrors} errors`);
    return analytics;
  }

  /**
   * Get error frequency trends
   */
  async getErrorFrequencyTrends(
    timeWindow: 'hour' | 'day' | 'week' | 'month' = 'day',
    limit = 30
  ): Promise<ErrorFrequencyPoint[]> {
    console.log(`📈 Generating error frequency trends (${timeWindow})`);

    const now = new Date();
    const points: ErrorFrequencyPoint[] = [];

    let timeInterval: number;
    switch (timeWindow) {
      case 'hour':
        timeInterval = 60 * 60 * 1000; // 1 hour
        break;
      case 'day':
        timeInterval = 24 * 60 * 60 * 1000; // 1 day
        break;
      case 'week':
        timeInterval = 7 * 24 * 60 * 60 * 1000; // 1 week
        break;
      case 'month':
        timeInterval = 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
    }

    for (let i = limit - 1; i >= 0; i--) {
      const endTime = new Date(now.getTime() - i * timeInterval);
      const startTime = new Date(endTime.getTime() - timeInterval);

      const errors = this.errorHistory.filter(error => 
        error.timestamp >= startTime && error.timestamp < endTime
      );

      const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
      const errorTypes = new Set<string>();
      const categories = new Set<string>();

      errors.forEach(error => {
        const severity = error.error.severity as keyof typeof severityCounts;
        severityCounts[severity]++;
        errorTypes.add(error.error.type);
        categories.add(error.error.category);
      });

      // Determine predominant severity
      let predominantSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let maxSeverityCount = 0;
      
      Object.entries(severityCounts).forEach(([severity, count]) => {
        if (count > maxSeverityCount) {
          maxSeverityCount = count;
          predominantSeverity = severity as 'low' | 'medium' | 'high' | 'critical';
        }
      });

      points.push({
        timestamp: endTime,
        count: errors.length,
        severity: predominantSeverity,
        errorTypes: Array.from(errorTypes),
        categories: Array.from(categories)
      });
    }

    return points;
  }

  /**
   * Generate system health metrics
   */
  async generateSystemHealth(): Promise<SystemHealthMetrics> {
    console.log('🏥 Generating system health metrics...');

    const recentErrors = this.errorHistory.filter(error => 
      error.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
    );

    const totalErrors = recentErrors.length;
    const criticalErrors = recentErrors.filter(e => e.error.severity === 'critical').length;

    // Calculate error rates
    const errorRate = totalErrors / 24; // errors per hour
    const criticalErrorRate = criticalErrors / 24;

    // Calculate health score (0-100)
    let healthScore = 100;
    healthScore -= Math.min(errorRate * 5, 50); // Reduce by error rate
    healthScore -= Math.min(criticalErrorRate * 20, 40); // Heavily penalize critical errors
    healthScore = Math.max(0, healthScore);

    // Calculate average resolution time
    const resolvedWithTime = recentErrors.filter(e => e.resolved && e.resolvedAt);
    const averageResolutionTime = resolvedWithTime.length > 0 
      ? resolvedWithTime.reduce((sum, e) => {
          const resolutionTime = (e.resolvedAt!.getTime() - e.timestamp.getTime()) / (1000 * 60);
          return sum + resolutionTime;
        }, 0) / resolvedWithTime.length 
      : 0;

    // Find most frequent errors
    const errorTypeCount = new Map<string, number>();
    const errorTypeLastSeen = new Map<string, Date>();
    
    recentErrors.forEach(historyEntry => {
      const count = errorTypeCount.get(historyEntry.error.type) || 0;
      errorTypeCount.set(historyEntry.error.type, count + 1);
      
      const lastSeen = errorTypeLastSeen.get(historyEntry.error.type);
      if (!lastSeen || historyEntry.timestamp > lastSeen) {
        errorTypeLastSeen.set(historyEntry.error.type, historyEntry.timestamp);
      }
    });

    const mostFrequentErrors = Array.from(errorTypeCount.entries())
      .map(([type, count]) => ({
        type,
        count,
        lastOccurrence: errorTypeLastSeen.get(type)!
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Generate improvement suggestions
    const improvementSuggestions = await this.generateHealthImprovements(recentErrors);

    return {
      overallHealthScore: Math.round(healthScore),
      errorRate: Math.round(errorRate * 100) / 100,
      criticalErrorRate: Math.round(criticalErrorRate * 100) / 100,
      averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
      mostFrequentErrors,
      improvementSuggestions
    };
  }

  /**
   * Find correlations between different error types
   */
  async findErrorCorrelations(): Promise<ErrorCorrelation[]> {
    console.log('🔗 Finding error correlations...');

    const correlations: ErrorCorrelation[] = [];
    const errorTypes = [...new Set(this.errorHistory.map(e => e.error.type).filter(type => type !== undefined))];

    // Analyze pairs of error types
    for (let i = 0; i < errorTypes.length; i++) {
      for (let j = i + 1; j < errorTypes.length; j++) {
        const type1 = errorTypes[i];
        const type2 = errorTypes[j];

        if (type1 && type2) {
          const correlation = await this.calculateErrorCorrelation(type1, type2);
          if (correlation.correlationStrength > 0.3) { // Only significant correlations
            correlations.push(correlation);
          }
        }
      }
    }

    return correlations.sort((a, b) => b.correlationStrength - a.correlationStrength);
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(format: 'json' | 'csv' = 'json'): Promise<string> {
    console.log(`📤 Exporting analytics data as ${format}`);

    const analytics = await this.generateAnalytics();

    if (format === 'json') {
      return JSON.stringify(analytics, null, 2);
    } else {
      // CSV export (simplified)
      const csvRows = ['Type,Severity,Category,Timestamp,Resolved'];
      
      this.errorHistory.forEach(historyEntry => {
        csvRows.push([
          historyEntry.error.type,
          historyEntry.error.severity,
          historyEntry.error.category,
          historyEntry.timestamp.toISOString(),
          historyEntry.resolved ? 'Yes' : 'No'
        ].join(','));
      });

      return csvRows.join('\n');
    }
  }

  /**
   * Get error history
   */
  getErrorHistory(limit?: number, filters?: {
    types?: string[];
    severities?: string[];
    categories?: string[];
    resolved?: boolean;
  }): ErrorHistoryEntry[] {
    let filtered = this.errorHistory;

    if (filters) {
      filtered = filtered.filter(historyEntry => {
        if (filters.types && !filters.types.includes(historyEntry.error.type)) {
return false;
}
        if (filters.severities && !filters.severities.includes(historyEntry.error.severity)) {
return false;
}
        if (filters.categories && !filters.categories.includes(historyEntry.error.category)) {
return false;
}
        if (filters.resolved !== undefined && historyEntry.resolved !== filters.resolved) {
return false;
}
        return true;
      });
    }

    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Clear error history
   */
  async clearHistory(): Promise<void> {
    console.log('🧹 Clearing error history...');
    this.errorHistory = [];
    this.analyticsCache.clear();
  }

  // Private helper methods

  private findSimilarError(error: ErrorReport): ErrorHistoryEntry | undefined {
    return this.errorHistory.find(existing => 
      existing.error.type === error.type &&
      existing.error.category === error.category &&
      existing.error.message === error.message &&
      existing.error.operation === error.operation &&
      !existing.resolved
    );
  }

  private filterErrors(
    startDate: Date, 
    endDate: Date, 
    options?: { categories?: string[]; severities?: string[]; }
  ): ErrorHistoryEntry[] {
    return this.errorHistory.filter(historyEntry => {
      if (historyEntry.timestamp < startDate || historyEntry.timestamp > endDate) {
return false;
}
      if (options?.categories && !options.categories.includes(historyEntry.error.category)) {
return false;
}
      if (options?.severities && !options.severities.includes(historyEntry.error.severity)) {
return false;
}
      return true;
    });
  }

  private calculateSeverityDistribution(errors: ErrorHistoryEntry[]): Record<string, number> {
    const distribution: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    
    errors.forEach(historyEntry => {
      distribution[historyEntry.error.severity] = (distribution[historyEntry.error.severity] || 0) + 1;
    });
    
    return distribution;
  }

  private calculateCategoryDistribution(errors: ErrorHistoryEntry[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    errors.forEach(historyEntry => {
      distribution[historyEntry.error.category] = (distribution[historyEntry.error.category] || 0) + 1;
    });
    
    return distribution;
  }

  private calculateAverageResolutionTime(errors: ErrorHistoryEntry[]): number {
    const resolvedErrors = errors.filter(e => e.resolved && e.resolvedAt);
    
    if (resolvedErrors.length === 0) {
return 0;
}
    
    const totalResolutionTime = resolvedErrors.reduce((sum, historyEntry) => {
      const resolutionTime = (historyEntry.resolvedAt!.getTime() - historyEntry.timestamp.getTime()) / (1000 * 60);
      return sum + resolutionTime;
    }, 0);
    
    return totalResolutionTime / resolvedErrors.length;
  }

  private generateTimeDistribution(
    errors: ErrorHistoryEntry[], 
    startDate: Date, 
    endDate: Date
  ): Array<{ timestamp: Date; count: number }> {
    const distribution: Array<{ timestamp: Date; count: number }> = [];
    const timeSlots = 24; // 24 hours
    const slotDuration = (endDate.getTime() - startDate.getTime()) / timeSlots;

    for (let i = 0; i < timeSlots; i++) {
      const slotStart = new Date(startDate.getTime() + i * slotDuration);
      const slotEnd = new Date(slotStart.getTime() + slotDuration);
      
      const count = errors.filter(historyEntry => 
        historyEntry.timestamp >= slotStart && historyEntry.timestamp < slotEnd
      ).length;

      distribution.push({ timestamp: slotStart, count });
    }

    return distribution;
  }

  private async generateTrends(
    errors: ErrorHistoryEntry[], 
    _startDate: Date, 
    _endDate: Date
  ): Promise<ErrorTrend[]> {
    // Simplified trend analysis - would be more sophisticated in production
    const trends: ErrorTrend[] = [];
    
    const typeCount = new Map<string, number>();
    errors.forEach(historyEntry => {
      typeCount.set(historyEntry.error.type, (typeCount.get(historyEntry.error.type) || 0) + 1);
    });

    Array.from(typeCount.entries()).forEach(([type, count]) => {
      if (count >= this.config.patternDetectionThreshold) {
        trends.push({
          type: 'frequency',
          description: `Increased frequency of ${type} errors`,
          severity: count > 10 ? 'high' : 'medium',
          trend: 'increasing',
          confidence: Math.min(count / 20, 1.0)
        });
      }
    });

    return trends;
  }

  private async detectPatterns(errors: ErrorHistoryEntry[]): Promise<ErrorPattern[]> {
    // Simplified pattern detection - would be more sophisticated in production
    const patterns: ErrorPattern[] = [];
    
    // Detect recurring error patterns
    const patternMap = new Map<string, ErrorHistoryEntry[]>();
    
    errors.forEach(historyEntry => {
      const key = `${historyEntry.error.type}:${historyEntry.error.category}`;
      if (!patternMap.has(key)) {
        patternMap.set(key, []);
      }
      patternMap.get(key)!.push(historyEntry);
    });

    Array.from(patternMap.entries()).forEach(([key, patternErrors]) => {
      if (patternErrors.length >= this.config.patternDetectionThreshold) {
        patterns.push({
          signature: key,
          frequency: patternErrors.length,
          firstSeen: patternErrors[0]?.timestamp || new Date(),
          lastSeen: patternErrors[patternErrors.length - 1]?.timestamp || new Date(),
          avgTimeBetweenOccurrences: this.calculateAvgTimeBetween(patternErrors),
          associatedOperations: [...new Set(patternErrors.map(e => e.error.operation))],
          severity: this.calculatePatternSeverity(patternErrors)
        });
      }
    });

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  private async generateCorrelations(_errors: ErrorHistoryEntry[]): Promise<any[]> {
    // Placeholder for correlation analysis
    return [];
  }

  private async generateRecommendations(errors: ErrorHistoryEntry[]): Promise<string[]> {
    const recommendations: string[] = [];
    
    const criticalErrors = errors.filter(e => e.error.severity === 'critical');
    const unresolvedErrors = errors.filter(e => !e.resolved);
    
    if (criticalErrors.length > 5) {
      recommendations.push('High number of critical errors detected. Consider implementing additional monitoring and alerting.');
    }
    
    if (unresolvedErrors.length > errors.length * 0.3) {
      recommendations.push('Many errors remain unresolved. Review error resolution processes and documentation.');
    }
    
    const frequentErrors = new Map<string, number>();
    errors.forEach(historyEntry => {
      frequentErrors.set(historyEntry.error.type, (frequentErrors.get(historyEntry.error.type) || 0) + 1);
    });
    
    const mostFrequent = Array.from(frequentErrors.entries())
      .sort((a, b) => b[1] - a[1])[0];
      
    if (mostFrequent && mostFrequent[1] > 10) {
      recommendations.push(`Consider investigating root cause of frequent ${mostFrequent[0]} errors (${mostFrequent[1]} occurrences).`);
    }
    
    return recommendations;
  }

  private async updateAnalytics(): Promise<void> {
    // Update analytics cache
    // Could update persistent storage here
  }

  private async cleanupOldEntries(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.config.retentionPolicyDays * 24 * 60 * 60 * 1000);
    const originalLength = this.errorHistory.length;
    
    this.errorHistory = this.errorHistory.filter(error => error.timestamp >= cutoffDate);
    
    if (originalLength > this.errorHistory.length) {
      console.log(`🧹 Cleaned up ${originalLength - this.errorHistory.length} old error entries`);
    }
  }

  private async calculateErrorCorrelation(type1: string, type2: string): Promise<ErrorCorrelation> {
    const type1Errors = this.errorHistory.filter(e => e.error.type === type1);
    const type2Errors = this.errorHistory.filter(e => e.error.type === type2);
    
    // Simple correlation calculation - would be more sophisticated in production
    let coOccurrences = 0;
    const timeWindow = 60 * 60 * 1000; // 1 hour
    
    type1Errors.forEach(error1 => {
      const hasType2Nearby = type2Errors.some(error2 => 
        Math.abs(error1.timestamp.getTime() - error2.timestamp.getTime()) < timeWindow
      );
      if (hasType2Nearby) {
coOccurrences++;
}
    });
    
    const correlationStrength = Math.min(coOccurrences / Math.max(type1Errors.length, 1), 1.0);
    
    return {
      errorType1: type1,
      errorType2: type2,
      correlationStrength,
      occurrences: coOccurrences,
      timeWindow: '1 hour',
      confidence: correlationStrength
    };
  }

  private async generateHealthImprovements(errors: ErrorHistoryEntry[]): Promise<string[]> {
    const suggestions: string[] = [];
    
    const errorRate = errors.length / 24; // per hour
    if (errorRate > 5) {
      suggestions.push('High error rate detected. Consider implementing better error prevention mechanisms.');
    }
    
    const unresolvedCount = errors.filter(e => !e.resolved).length;
    if (unresolvedCount > errors.length * 0.5) {
      suggestions.push('Many unresolved errors. Improve error resolution workflows and documentation.');
    }
    
    const criticalCount = errors.filter(e => e.error.severity === 'critical').length;
    if (criticalCount > 2) {
      suggestions.push('Multiple critical errors. Implement proactive monitoring and alerting systems.');
    }
    
    return suggestions;
  }

  private calculateAvgTimeBetween(errors: ErrorHistoryEntry[]): number {
    if (errors.length < 2) {
return 0;
}
    
    const sortedErrors = errors.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const intervals: number[] = [];
    
    for (let i = 1; i < sortedErrors.length; i++) {
      const current = sortedErrors[i];
      const previous = sortedErrors[i - 1];
      if (current && previous) {
        const interval = current.timestamp.getTime() - previous.timestamp.getTime();
        intervals.push(interval);
      }
    }
    
    return intervals.length > 0 ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length : 0;
  }

  private calculatePatternSeverity(errors: ErrorHistoryEntry[]): 'low' | 'medium' | 'high' | 'critical' {
    const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    
    errors.forEach(historyEntry => {
      severityCounts[historyEntry.error.severity]++;
    });
    
    if (severityCounts.critical > 0) {
return 'critical';
}
    if (severityCounts.high > severityCounts.medium + severityCounts.low) {
return 'high';
}
    if (severityCounts.medium > severityCounts.low) {
return 'medium';
}
    return 'low';
  }
}