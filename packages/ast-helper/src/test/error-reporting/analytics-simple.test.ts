/**
 * @fileoverview Error Analytics System Tests (Simplified)
 * @module @ast-copilot-helper/ast-helper/test/error-reporting/analytics-simple
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ErrorAnalyticsManager } from '../../error-reporting/analytics/error-analytics.js';
import type { ErrorReport } from '../../error-reporting/types.js';

describe('ErrorAnalyticsManager', () => {
  let analyticsManager: ErrorAnalyticsManager;

  beforeEach(() => {
    analyticsManager = new ErrorAnalyticsManager({
      maxHistorySize: 100,
      analyticsPeriodDays: 30,
      trendAnalysisWindow: 24,
      patternDetectionThreshold: 2,
      enableRealTimeAnalytics: true,
      storageBackend: 'memory',
      enableMLAnalysis: false,
      retentionPolicyDays: 90
    });
  });

  afterEach(async () => {
    await analyticsManager.clearHistory();
  });

  describe('Basic Analytics Functionality', () => {
    it('should be properly initialized', () => {
      expect(analyticsManager).toBeDefined();
      expect(analyticsManager.getErrorHistory()).toHaveLength(0);
    });

    it('should add simple mock error for testing', async () => {
      // Create a minimal error report for analytics testing
      const mockError = {
        id: 'test-error-1',
        timestamp: new Date(),
        type: 'error',
        severity: 'medium',
        category: 'test',
        message: 'Test error message',
        operation: 'test-operation'
      } as ErrorReport;

      await analyticsManager.addError(mockError);
      
      const history = analyticsManager.getErrorHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('test-error-1');
      expect(history[0].resolved).toBe(false);
    });

    it('should generate analytics for errors', async () => {
      // Add test errors
      const errors = [
        {
          id: 'analytics-1',
          timestamp: new Date(Date.now() - 60000),
          type: 'error',
          severity: 'medium',
          category: 'parsing',
          message: 'Parsing error',
          operation: 'parse'
        },
        {
          id: 'analytics-2', 
          timestamp: new Date(),
          type: 'error',
          severity: 'critical',
          category: 'runtime',
          message: 'Runtime error',
          operation: 'execute'
        }
      ] as ErrorReport[];

      for (const error of errors) {
        await analyticsManager.addError(error);
      }

      const analytics = await analyticsManager.generateAnalytics();
      
      expect(analytics.summary.totalErrors).toBe(2);
      expect(analytics.summary.criticalErrors).toBe(1);
      expect(analytics.distribution.category.parsing).toBe(1);
      expect(analytics.distribution.category.runtime).toBe(1);
      expect(analytics.recommendations).toBeInstanceOf(Array);
    });

    it('should resolve errors correctly', async () => {
      const mockError = {
        id: 'resolve-test',
        timestamp: new Date(),
        type: 'error',
        severity: 'low',
        category: 'test',
        message: 'Test error',
        operation: 'test'
      } as ErrorReport;

      await analyticsManager.addError(mockError);
      await analyticsManager.resolveError('resolve-test');

      const history = analyticsManager.getErrorHistory();
      expect(history[0].resolved).toBe(true);
      expect(history[0].resolvedAt).toBeInstanceOf(Date);
    });

    it('should filter error history', async () => {
      const errors = [
        {
          id: 'filter-1',
          timestamp: new Date(),
          type: 'error', 
          severity: 'critical',
          category: 'system',
          message: 'Critical error',
          operation: 'system'
        },
        {
          id: 'filter-2',
          timestamp: new Date(),
          type: 'warning',
          severity: 'low',
          category: 'user',
          message: 'Warning message', 
          operation: 'user-action'
        }
      ] as ErrorReport[];

      for (const error of errors) {
        await analyticsManager.addError(error);
      }

      const criticalErrors = analyticsManager.getErrorHistory(undefined, {
        severities: ['critical']
      });

      expect(criticalErrors).toHaveLength(1);
      expect(criticalErrors[0].error.severity).toBe('critical');
    });

    it('should generate system health metrics', async () => {
      // Add some test data
      const testError = {
        id: 'health-test',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        type: 'error',
        severity: 'medium',
        category: 'test',
        message: 'Health test error',
        operation: 'test'
      } as ErrorReport;

      await analyticsManager.addError(testError);
      await analyticsManager.resolveError('health-test');

      const health = await analyticsManager.generateSystemHealth();
      
      expect(health.overallHealthScore).toBeGreaterThanOrEqual(0);
      expect(health.overallHealthScore).toBeLessThanOrEqual(100);
      expect(health.errorRate).toBeGreaterThanOrEqual(0);
      expect(health.mostFrequentErrors).toBeInstanceOf(Array);
      expect(health.improvementSuggestions).toBeInstanceOf(Array);
    });

    it('should generate error frequency trends', async () => {
      // Add errors across time
      for (let i = 0; i < 3; i++) {
        const error = {
          id: `trend-${i}`,
          timestamp: new Date(Date.now() - i * 60000), // Minutes apart
          type: 'error',
          severity: 'medium',
          category: 'test',
          message: `Trend error ${i}`,
          operation: 'test'
        } as ErrorReport;

        await analyticsManager.addError(error);
      }

      const trends = await analyticsManager.getErrorFrequencyTrends('hour', 2);
      
      expect(trends).toHaveLength(2);
      expect(trends[0].timestamp).toBeInstanceOf(Date);
      expect(trends[0].count).toBeGreaterThanOrEqual(0);
    });

    it('should export analytics data as JSON', async () => {
      const testError = {
        id: 'export-test',
        timestamp: new Date(),
        type: 'error',
        severity: 'low',
        category: 'export',
        message: 'Export test',
        operation: 'export'
      } as ErrorReport;

      await analyticsManager.addError(testError);
      
      const jsonData = await analyticsManager.exportAnalytics('json');
      expect(jsonData).toBeTypeOf('string');
      expect(() => JSON.parse(jsonData)).not.toThrow();
    });

    it('should export analytics data as CSV', async () => {
      const testError = {
        id: 'csv-test', 
        timestamp: new Date(),
        type: 'warning',
        severity: 'low',
        category: 'test',
        message: 'CSV test',
        operation: 'test'
      } as ErrorReport;

      await analyticsManager.addError(testError);
      
      const csvData = await analyticsManager.exportAnalytics('csv');
      expect(csvData).toBeTypeOf('string');
      expect(csvData).toContain('Type,Severity,Category,Timestamp,Resolved');
      expect(csvData).toContain('warning,low,test');
    });

    it('should clear history correctly', async () => {
      const testError = {
        id: 'clear-test',
        timestamp: new Date(),
        type: 'error',
        severity: 'medium',
        category: 'test',
        message: 'Clear test',
        operation: 'test'
      } as ErrorReport;

      await analyticsManager.addError(testError);
      expect(analyticsManager.getErrorHistory()).toHaveLength(1);

      await analyticsManager.clearHistory();
      expect(analyticsManager.getErrorHistory()).toHaveLength(0);
    });

    it('should respect configuration limits', async () => {
      const smallManager = new ErrorAnalyticsManager({
        maxHistorySize: 2,
        analyticsPeriodDays: 30,
        trendAnalysisWindow: 24,
        patternDetectionThreshold: 2,
        enableRealTimeAnalytics: true,
        storageBackend: 'memory',
        enableMLAnalysis: false,
        retentionPolicyDays: 90
      });

      // Add more errors than the limit
      for (let i = 0; i < 5; i++) {
        const error = {
          id: `limit-${i}`,
          timestamp: new Date(),
          type: 'error',
          severity: 'low',
          category: 'test',
          message: `Limit test ${i}`,
          operation: 'test'
        } as ErrorReport;
        
        await smallManager.addError(error);
      }

      const history = smallManager.getErrorHistory();
      expect(history.length).toBeLessThanOrEqual(2);
    });

    it('should find error correlations', async () => {
      // Add correlated errors 
      const correlatedErrors = [
        {
          id: 'corr-1',
          timestamp: new Date(Date.now() - 10 * 60 * 1000),
          type: 'error',
          severity: 'medium', 
          category: 'parsing',
          message: 'Parse error',
          operation: 'parse'
        },
        {
          id: 'corr-2',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          type: 'warning',
          severity: 'low',
          category: 'runtime', 
          message: 'Runtime warning',
          operation: 'execute'
        }
      ] as ErrorReport[];

      for (const error of correlatedErrors) {
        await analyticsManager.addError(error);
      }

      const correlations = await analyticsManager.findErrorCorrelations();
      expect(correlations).toBeInstanceOf(Array);
    });
  });
});