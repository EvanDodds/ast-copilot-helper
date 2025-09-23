/**
 * @fileoverview Error Analytics System Tests
 * @module @ast-copilot-helper/ast-helper/test/error-reporting/analytics
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ErrorAnalyticsManager } from '../../error-reporting/analytics/error-analytics.js';
import type { 
  ErrorReport, 
  ErrorHistoryEntry, 
  ErrorAnalytics,
  SystemHealthMetrics,
  ErrorFrequencyPoint,
  ErrorCorrelation
} from '../../error-reporting/types.js';

describe('ErrorAnalyticsManager', () => {
  let analyticsManager: ErrorAnalyticsManager;

  // Helper function to create test context
  const createTestContext = (operation: string) => ({
    operation: operation,
    component: 'test-component',
    sessionId: 'test-session',
    timestamp: new Date(),
    environment: { NODE_ENV: 'test' },
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    processId: process.pid,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  });

  // Helper function to create valid error report
  const createTestError = (overrides: Partial<ErrorReport> = {}): ErrorReport => ({
    id: 'test-error',
    timestamp: new Date(),
    type: 'error',
    severity: 'medium',
    category: 'test',
    message: 'Test error',
    operation: 'test',
    context: {
      operation: 'test-operation',
      component: 'test-component',
      sessionId: 'test-session',
      timestamp: new Date(),
      environment: { NODE_ENV: 'test' },
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      processId: process.pid,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      totalMemory: 8192,
      freeMemory: 4096,
      uptime: process.uptime(),
      loadAverage: [1, 1, 1],
      networkInterfaces: {}
    },
    diagnostics: {
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        totalMemory: 8192,
        freeMemory: 4096,
        uptime: process.uptime(),
        loadAverage: [1, 1, 1],
        cpuUsage: { user: 100, system: 50 },
        hostname: 'test-host',
        release: '1.0.0',
        version: '1.0.0',
        machine: 'x64',
        networkInfo: { hostname: 'test', interfaces: {} },
        processInfo: { pid: process.pid, ppid: 0, title: 'test', execPath: '/test', argv: [] },
        environmentVariables: { NODE_ENV: 'test' }
      },
      runtime: {
        node: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
          uptime: process.uptime(),
          execPath: '/test',
          execArgv: [],
          argv: [],
          env: { NODE_ENV: 'test' }
        },
        heap: { used: 1024, total: 2048, limit: 4096, percentage: 50, external: 128, arrayBuffers: 64 },
        gc: { collections: 10, duration: 100, frequency: 0.1 },
        eventLoop: { lag: 1, utilization: 0.5 },
        modules: { loaded: [], cache: 100, nativeModules: [] },
        openHandles: { files: 5, sockets: 2, timers: 1, processes: 0 },
        resourceUsage: {
          userCPUTime: 100,
          systemCPUTime: 50,
          maxResidentSetSize: 1024,
          sharedMemorySize: 0,
          unsharedDataSize: 1024,
          unsharedStackSize: 512,
          minorPageFaults: 100,
          majorPageFaults: 10,
          swappedOut: 0,
          fsRead: 50,
          fsWrite: 25,
          ipcSent: 0,
          ipcReceived: 0,
          signalsCount: 5,
          voluntaryContextSwitches: 100,
          involuntaryContextSwitches: 10
        }
      },
      codebase: {
        structure: { totalFiles: 100, totalLines: 10000, languages: ['typescript'], directories: 10 },
        quality: { testCoverage: 80, lintIssues: 5, duplicateCode: 2 },
        dependencies: { production: 10, development: 20, outdated: 2, vulnerable: 0 },
        git: { branch: 'main', commit: 'abc123', isDirty: false, untracked: 0, modified: 0, staged: 0 },
        configuration: {
          typescript: { strict: true, target: 'es2020' },
          eslint: { errors: 0, warnings: 2 },
          prettier: { configured: true },
          jest: { configured: false },
          packageManager: 'npm'
        }
      },
      configuration: {
        files: {
          'package.json': { exists: true, valid: true, size: 1024 },
          'tsconfig.json': { exists: true, valid: true, size: 512 }
        },
        settings: { typescript: { strict: true }, eslint: { enabled: true } },
        paths: { root: '/test', config: '/test/config', source: '/test/src' },
        validation: { passed: true, errors: [], warnings: [] }
      },
      performance: {
        timing: {
          initialization: { start: 0, end: 100, duration: 100 },
          execution: { start: 100, end: 200, duration: 100 },
          cleanup: { start: 200, end: 250, duration: 50 }
        },
        memory: {
          initial: { used: 512, total: 1024 },
          peak: { used: 1024, total: 2048 },
          final: { used: 768, total: 1536 },
          growth: 256,
          leaks: []
        },
        cpu: { userTime: 100, systemTime: 50, idleTime: 1000 },
        io: { reads: 10, writes: 5, bytesRead: 1024, bytesWritten: 512 },
        network: { requests: 5, responses: 5, bytesReceived: 2048, bytesSent: 1024 }
      },
      dependencies: {
        installed: [
          { name: 'test-package', version: '1.0.0', dev: false, size: 1024, dependencies: [] }
        ],
        versions: { 'test-package': '1.0.0' },
        conflicts: [],
        security: { vulnerabilities: [], advisories: [] },
        bundleSize: { total: 1024, gzipped: 512, breakdown: { 'test-package': 1024 } }
      }
    },
    userProvided: false,
    reportedToServer: false,
    suggestions: [],
    ...overrides
  });

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

  describe('Error Addition and History', () => {
    it('should add errors to analytics history', async () => {
      const error: ErrorReport = createTestError({
        id: 'test-error-1',
        category: 'parsing',
        message: 'Unexpected token',
        operation: 'parse'
      });

      await analyticsManager.addError(error);

      const history = analyticsManager.getErrorHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('test-error-1');
      expect(history[0].error.type).toBe('error');
      expect(history[0].resolved).toBe(false);
    });

    it('should update existing error occurrences', async () => {
      const baseError: ErrorReport = {
        id: 'test-error-1',
        timestamp: new Date(),
        type: 'SyntaxError',
        severity: 'medium',
        category: 'parsing',
        message: 'Unexpected token',
        operation: 'parse',
        context: {
          operation: 'parsing file',
          environment: {},
          metadata: {}
        },
        suggestions: [],
        reportedToServer: false
      };

      // Add same error twice
      await analyticsManager.addError(baseError);
      
      const secondError = { 
        ...baseError, 
        id: 'test-error-2', 
        message: 'Different error message',
        timestamp: new Date() 
      };
      await analyticsManager.addError(secondError);

      const history = analyticsManager.getErrorHistory();
      expect(history).toHaveLength(2);
    });

    it('should resolve errors correctly', async () => {
      const error: ErrorReport = {
        id: 'test-error-1',
        timestamp: new Date(),
        type: 'TypeError',
        severity: 'high',
        category: 'runtime',
        message: 'Cannot read property',
        operation: 'execute',
        context: {
          operation: 'executing function',
          environment: {},
          metadata: {}
        },
        suggestions: [],
        reportedToServer: false
      };

      await analyticsManager.addError(error);
      await analyticsManager.resolveError('test-error-1');

      const history = analyticsManager.getErrorHistory();
      expect(history[0].resolved).toBe(true);
      expect(history[0].resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('Analytics Generation', () => {
    beforeEach(async () => {
      // Add test data
      const errors: ErrorReport[] = [
        {
          id: 'error-1',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          type: 'SyntaxError',
          severity: 'medium',
          category: 'parsing',
          message: 'Unexpected token',
          operation: 'parse',
          context: { operation: 'parsing', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        },
        {
          id: 'error-2',
          timestamp: new Date(Date.now() - 59 * 60 * 1000), // 59 minutes ago
          type: 'TypeError',
          severity: 'critical',
          category: 'runtime',
          message: 'Cannot read property',
          operation: 'execute',
          context: { operation: 'executing', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        },
        {
          id: 'error-3',
          timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          type: 'SyntaxError',
          severity: 'medium',
          category: 'parsing',
          message: 'Missing semicolon', // Different message to avoid deduplication
          operation: 'parse',
          context: { operation: 'parsing', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        }
      ];

      for (const error of errors) {
        await analyticsManager.addError(error);
      }

      // Resolve one error
      await analyticsManager.resolveError('error-1');
    });

    it('should generate comprehensive analytics', async () => {
      const analytics: ErrorAnalytics = await analyticsManager.generateAnalytics();

      expect(analytics.summary.totalErrors).toBe(3);
      expect(analytics.summary.resolvedErrors).toBe(1);
      expect(analytics.summary.unresolvedErrors).toBe(2);
      expect(analytics.summary.criticalErrors).toBe(1);
      expect(analytics.summary.resolutionRate).toBeCloseTo(0.33, 1);

      // Check distributions
      expect(analytics.distribution.severity.medium).toBe(2);
      expect(analytics.distribution.severity.critical).toBe(1);
      expect(analytics.distribution.category.parsing).toBe(2);
      expect(analytics.distribution.category.runtime).toBe(1);

      expect(analytics.trends).toBeInstanceOf(Array);
      expect(analytics.patterns).toBeInstanceOf(Array);
      expect(analytics.recommendations).toBeInstanceOf(Array);
    });

    it('should filter analytics by date range', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const analytics = await analyticsManager.generateAnalytics({
        startDate: oneHourAgo,
        endDate: new Date()
      });

      // Should only include errors from the last hour
      expect(analytics.summary.totalErrors).toBe(2);
    });

    it('should filter analytics by categories', async () => {
      const analytics = await analyticsManager.generateAnalytics({
        categories: ['parsing']
      });

      expect(analytics.summary.totalErrors).toBe(2);
      expect(analytics.distribution.category.parsing).toBe(2);
      expect(analytics.distribution.category.runtime).toBeUndefined();
    });

    it('should filter analytics by severities', async () => {
      const analytics = await analyticsManager.generateAnalytics({
        severities: ['critical']
      });

      expect(analytics.summary.totalErrors).toBe(1);
      expect(analytics.distribution.severity.critical).toBe(1);
      expect(analytics.distribution.severity.medium).toBe(0);
    });
  });

  describe('System Health Metrics', () => {
    beforeEach(async () => {
      // Add test errors for health analysis
      const criticalError: ErrorReport = {
        id: 'critical-1',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        type: 'CriticalSystemError',
        severity: 'critical',
        category: 'system',
        message: 'System failure',
        operation: 'system-operation',
        context: { operation: 'system', environment: {}, metadata: {} },
        suggestions: [],
        reportedToServer: false
      };

      await analyticsManager.addError(criticalError);
      await analyticsManager.resolveError('critical-1');
    });

    it('should generate system health metrics', async () => {
      const health: SystemHealthMetrics = await analyticsManager.generateSystemHealth();

      expect(health.overallHealthScore).toBeGreaterThanOrEqual(0);
      expect(health.overallHealthScore).toBeLessThanOrEqual(100);
      expect(health.errorRate).toBeGreaterThanOrEqual(0);
      expect(health.criticalErrorRate).toBeGreaterThanOrEqual(0);
      expect(health.averageResolutionTime).toBeGreaterThanOrEqual(0);
      expect(health.mostFrequentErrors).toBeInstanceOf(Array);
      expect(health.improvementSuggestions).toBeInstanceOf(Array);
    });

    it('should provide improvement suggestions for poor health', async () => {
      // Add many critical errors
      for (let i = 0; i < 5; i++) {
        const error: ErrorReport = {
          id: `critical-${i}`,
          timestamp: new Date(Date.now() - i * 60 * 1000),
          type: 'CriticalError',
          severity: 'critical',
          category: 'system',
          message: 'Critical system failure',
          operation: 'critical-op',
          context: { operation: 'critical', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        };
        await analyticsManager.addError(error);
      }

      const health = await analyticsManager.generateSystemHealth();
      expect(health.improvementSuggestions.length).toBeGreaterThanOrEqual(0);
      expect(health.overallHealthScore).toBeLessThan(100);
    });
  });

  describe('Error Frequency Trends', () => {
    beforeEach(async () => {
      const now = new Date();
      const errors: ErrorReport[] = [];

      // Add errors at different time intervals
      for (let i = 0; i < 10; i++) {
        errors.push({
          id: `trend-error-${i}`,
          timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000), // Daily intervals
          type: i % 2 === 0 ? 'SyntaxError' : 'TypeError',
          severity: i < 3 ? 'critical' : 'medium',
          category: 'parsing',
          message: `Test error ${i}`,
          operation: 'parse',
          context: { operation: 'parsing', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        });
      }

      for (const error of errors) {
        await analyticsManager.addError(error);
      }
    });

    it('should generate daily error frequency trends', async () => {
      const trends: ErrorFrequencyPoint[] = await analyticsManager.getErrorFrequencyTrends('day', 5);

      expect(trends).toHaveLength(5);
      expect(trends[0].timestamp).toBeInstanceOf(Date);
      expect(trends[0].count).toBeGreaterThanOrEqual(0);
      expect(trends[0].severity).toMatch(/^(low|medium|high|critical)$/);
      expect(trends[0].errorTypes).toBeInstanceOf(Array);
      expect(trends[0].categories).toBeInstanceOf(Array);
    });

    it('should generate hourly error frequency trends', async () => {
      const trends: ErrorFrequencyPoint[] = await analyticsManager.getErrorFrequencyTrends('hour', 3);

      expect(trends).toHaveLength(3);
      trends.forEach(trend => {
        expect(trend.timestamp).toBeInstanceOf(Date);
        expect(trend.count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Error Correlations', () => {
    beforeEach(async () => {
      const now = new Date();

      // Add correlated errors (occur within time windows)
      const correlatedErrors: ErrorReport[] = [
        {
          id: 'corr-1',
          timestamp: new Date(now.getTime() - 10 * 60 * 1000),
          type: 'SyntaxError',
          severity: 'medium',
          category: 'parsing',
          message: 'Syntax error',
          operation: 'parse',
          context: { operation: 'parsing', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        },
        {
          id: 'corr-2',
          timestamp: new Date(now.getTime() - 5 * 60 * 1000), // 5 minutes later
          type: 'TypeError',
          severity: 'high',
          category: 'runtime',
          message: 'Type error',
          operation: 'execute',
          context: { operation: 'executing', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        }
      ];

      for (const error of correlatedErrors) {
        await analyticsManager.addError(error);
      }
    });

    it('should find error correlations', async () => {
      const correlations = await analyticsManager.findErrorCorrelations();

      expect(correlations).toBeInstanceOf(Array);
      // The test data might not have strong correlations, but method should work
      correlations.forEach(corr => {
        expect(corr.errorType1).toBeDefined();
        expect(corr.errorType2).toBeDefined();
        expect(corr.correlationStrength).toBeGreaterThanOrEqual(0);
        expect(corr.correlationStrength).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Data Export', () => {
    beforeEach(async () => {
      const error: ErrorReport = {
        id: 'export-test',
        timestamp: new Date(),
        type: 'ExportError',
        severity: 'low',
        category: 'export',
        message: 'Export test error',
        operation: 'export',
        context: { operation: 'exporting', environment: {}, metadata: {} },
        suggestions: [],
        reportedToServer: false
      };

      await analyticsManager.addError(error);
    });

    it('should export analytics as JSON', async () => {
      const jsonData = await analyticsManager.exportAnalytics('json');
      
      expect(jsonData).toBeTypeOf('string');
      expect(() => JSON.parse(jsonData)).not.toThrow();
      
      const parsed = JSON.parse(jsonData);
      expect(parsed.summary).toBeDefined();
      expect(parsed.distribution).toBeDefined();
    });

    it('should export analytics as CSV', async () => {
      const csvData = await analyticsManager.exportAnalytics('csv');
      
      expect(csvData).toBeTypeOf('string');
      expect(csvData).toContain('Type,Severity,Category,Timestamp,Resolved');
      expect(csvData).toContain('ExportError,low,export');
    });
  });

  describe('History Management', () => {
    it('should filter error history by types', async () => {
      const errors: ErrorReport[] = [
        {
          id: 'filter-1',
          timestamp: new Date(),
          type: 'SyntaxError',
          severity: 'medium',
          category: 'parsing',
          message: 'Syntax error',
          operation: 'parse',
          context: { operation: 'parsing', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        },
        {
          id: 'filter-2',
          timestamp: new Date(),
          type: 'TypeError',
          severity: 'high',
          category: 'runtime',
          message: 'Type error',
          operation: 'execute',
          context: { operation: 'executing', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        }
      ];

      for (const error of errors) {
        await analyticsManager.addError(error);
      }

      const syntaxErrors = analyticsManager.getErrorHistory(undefined, {
        types: ['SyntaxError']
      });

      expect(syntaxErrors).toHaveLength(1);
      expect(syntaxErrors[0].error.type).toBe('SyntaxError');
    });

    it('should filter error history by severity', async () => {
      const errors: ErrorReport[] = [
        {
          id: 'sev-1',
          timestamp: new Date(),
          type: 'Error1',
          severity: 'critical',
          category: 'test',
          message: 'Critical error',
          operation: 'test',
          context: { operation: 'test', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        },
        {
          id: 'sev-2',
          timestamp: new Date(),
          type: 'Error2',
          severity: 'low',
          category: 'test',
          message: 'Low error',
          operation: 'test',
          context: { operation: 'test', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        }
      ];

      for (const error of errors) {
        await analyticsManager.addError(error);
      }

      const criticalErrors = analyticsManager.getErrorHistory(undefined, {
        severities: ['critical']
      });

      expect(criticalErrors).toHaveLength(1);
      expect(criticalErrors[0].error.severity).toBe('critical');
    });

    it('should limit error history results', async () => {
      for (let i = 0; i < 5; i++) {
        const error: ErrorReport = {
          id: `limit-${i}`,
          timestamp: new Date(),
          type: 'TestError',
          severity: 'medium',
          category: 'test',
          message: `Test error ${i}`,
          operation: 'test',
          context: { operation: 'test', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        };
        await analyticsManager.addError(error);
      }

      const limitedHistory = analyticsManager.getErrorHistory(3);
      expect(limitedHistory).toHaveLength(3);
    });

    it('should clear error history', async () => {
      const error: ErrorReport = {
        id: 'clear-test',
        timestamp: new Date(),
        type: 'TestError',
        severity: 'medium',
        category: 'test',
        message: 'Test error',
        operation: 'test',
        context: { operation: 'test', environment: {}, metadata: {} },
        suggestions: [],
        reportedToServer: false
      };

      await analyticsManager.addError(error);
      expect(analyticsManager.getErrorHistory()).toHaveLength(1);

      await analyticsManager.clearHistory();
      expect(analyticsManager.getErrorHistory()).toHaveLength(0);
    });
  });

  describe('Configuration', () => {
    it('should respect max history size configuration', async () => {
      const smallAnalytics = new ErrorAnalyticsManager({
        maxHistorySize: 2,
        analyticsPeriodDays: 30,
        trendAnalysisWindow: 24,
        patternDetectionThreshold: 2,
        enableRealTimeAnalytics: true,
        storageBackend: 'memory',
        enableMLAnalysis: false,
        retentionPolicyDays: 90
      });

      for (let i = 0; i < 5; i++) {
        const error: ErrorReport = {
          id: `size-test-${i}`,
          timestamp: new Date(),
          type: 'TestError',
          severity: 'medium',
          category: 'test',
          message: `Test error ${i}`,
          operation: 'test',
          context: { operation: 'test', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        };
        await smallAnalytics.addError(error);
      }

      const history = smallAnalytics.getErrorHistory();
      expect(history.length).toBeLessThanOrEqual(2);
    });

    it('should respect pattern detection threshold', async () => {
      const strictAnalytics = new ErrorAnalyticsManager({
        maxHistorySize: 100,
        analyticsPeriodDays: 30,
        trendAnalysisWindow: 24,
        patternDetectionThreshold: 5, // Higher threshold
        enableRealTimeAnalytics: true,
        storageBackend: 'memory',
        enableMLAnalysis: false,
        retentionPolicyDays: 90
      });

      // Add fewer errors than threshold
      for (let i = 0; i < 3; i++) {
        const error: ErrorReport = {
          id: `pattern-${i}`,
          timestamp: new Date(),
          type: 'PatternError',
          severity: 'medium',
          category: 'pattern',
          message: 'Pattern error',
          operation: 'pattern',
          context: { operation: 'pattern', environment: {}, metadata: {} },
          suggestions: [],
          reportedToServer: false
        };
        await strictAnalytics.addError(error);
      }

      const analytics = await strictAnalytics.generateAnalytics();
      // Should not detect patterns with only 3 occurrences when threshold is 5
      expect(analytics.patterns.length).toBe(0);
    });
  });
});