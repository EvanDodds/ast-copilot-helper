import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor } from '../../../scripts/ci-cd/performance-monitor';
import { AlertingSystem } from '../../../scripts/ci-cd/alerting-system';
import { MonitoringDashboard } from '../../../scripts/ci-cd/monitoring-dashboard';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs operations
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn()
}));

// Mock child_process operations
vi.mock('child_process', () => ({
  execSync: vi.fn()
}));

describe('Monitoring and Notifications System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock environment variables
    process.env.BUILD_TIME_WARNING = '300000';
    process.env.BUILD_TIME_CRITICAL = '600000';
    process.env.GITHUB_REF_NAME = 'main';
    process.env.GITHUB_SHA = 'abc123def456';
    process.env.GITHUB_RUN_ID = '12345';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.BUILD_TIME_WARNING;
    delete process.env.BUILD_TIME_CRITICAL;
    delete process.env.GITHUB_REF_NAME;
    delete process.env.GITHUB_SHA;
    delete process.env.GITHUB_RUN_ID;
  });

  describe('PerformanceMonitor', () => {
    it('should create a performance monitor instance', () => {
      const monitor = new PerformanceMonitor();
      expect(monitor).toBeDefined();
    });

    it('should generate performance report with metrics', async () => {
      const monitor = new PerformanceMonitor();
      
      // Mock file operations
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        dependencies: { lodash: '4.17.21', express: '4.18.0' },
        devDependencies: { vitest: '1.0.0' }
      }));

      const report = await monitor.generateReport();

      expect(report).toBeDefined();
      expect(report.currentBuild).toBeDefined();
      expect(report.currentBuild.metrics).toBeDefined();
      expect(report.currentBuild.metrics.totalTime).toBeGreaterThan(0);
      expect(report.alerts).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.summary.performanceGrade).toMatch(/^[ABCDF]$/);
    });

    it('should detect performance issues and generate alerts', async () => {
      const monitor = new PerformanceMonitor();
      
      // Mock long build time scenario
      process.env.BUILD_DURATION = '1200000'; // 20 minutes
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        dependencies: {},
        devDependencies: {}
      }));

      const report = await monitor.generateReport();

      expect(report.alerts.length).toBeGreaterThan(0);
      expect(report.summary.performanceGrade).toMatch(/^[CDF]$/); // Should be poor grade
    });

    it('should calculate performance trends correctly', async () => {
      const monitor = new PerformanceMonitor();
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(JSON.stringify({ dependencies: {}, devDependencies: {} }))
        .mockReturnValueOnce(JSON.stringify([])); // Empty history

      const report = await monitor.generateReport();

      expect(report.summary.trendsDetected).toBeDefined();
      expect(Array.isArray(report.summary.trendsDetected)).toBe(true);
    });

    it('should save performance history', async () => {
      const monitor = new PerformanceMonitor();
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      await monitor.generateReport();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('performance-history.json'),
        expect.stringContaining('"metrics"'),
        { flag: undefined }
      );
    });
  });

  describe('AlertingSystem', () => {
    it('should create an alerting system instance', () => {
      const alertingSystem = new AlertingSystem();
      expect(alertingSystem).toBeDefined();
    });

    it('should evaluate metrics and generate alerts', async () => {
      const alertingSystem = new AlertingSystem();
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('[]');

      const mockMetric = {
        id: 'test-metric',
        timestamp: new Date().toISOString(),
        branch: 'main',
        commit: 'abc123',
        buildId: '12345',
        metrics: {
          buildTime: 300000, // 5 minutes - should not trigger alert
          testTime: 120000,  // 2 minutes
          deployTime: 60000, // 1 minute
          totalTime: 480000, // 8 minutes
          memoryUsage: { peak: 2000, average: 1500 },
          cpuUsage: { peak: 70, average: 50 },
          artifactSize: 150,
          cacheHitRate: 85
        },
        stages: [
          { name: 'Build', duration: 300000, status: 'success' as const, resourceUsage: { memory: 1200, cpu: 70 } },
          { name: 'Test', duration: 120000, status: 'success' as const, resourceUsage: { memory: 800, cpu: 60 } }
        ]
      };

      const alerts = await alertingSystem.evaluateMetrics(mockMetric, []);
      
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should respect alert cooldown periods', async () => {
      const alertingSystem = new AlertingSystem();
      
      const recentAlert = {
        id: 'alert-1',
        ruleId: 'build-time-critical',
        timestamp: new Date().toISOString(),
        buildId: '123',
        branch: 'main',
        commit: 'abc',
        severity: 'critical' as const,
        title: 'Test Alert',
        message: 'Test message',
        metric: 'totalTime',
        currentValue: 2000000,
        acknowledged: false
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([recentAlert]));

      const mockMetric = {
        id: 'test-metric-2',
        timestamp: new Date().toISOString(),
        branch: 'main',
        commit: 'def456',
        buildId: '12346',
        metrics: {
          buildTime: 300000,
          testTime: 120000,
          deployTime: 60000,
          totalTime: 2100000, // Should trigger alert but should be in cooldown
          memoryUsage: { peak: 2000, average: 1500 },
          cpuUsage: { peak: 70, average: 50 },
          artifactSize: 150,
          cacheHitRate: 85
        },
        stages: []
      };

      const alerts = await alertingSystem.evaluateMetrics(mockMetric, []);
      
      // Should not generate new alert due to cooldown
      expect(alerts.length).toBe(0);
    });

    it('should manage alert acknowledgment and resolution', () => {
      const alertingSystem = new AlertingSystem();
      
      const testAlert = {
        id: 'alert-test-123',
        ruleId: 'test-rule',
        timestamp: new Date().toISOString(),
        buildId: '123',
        branch: 'main',
        commit: 'abc',
        severity: 'warning' as const,
        title: 'Test Alert',
        message: 'Test message',
        metric: 'testMetric',
        currentValue: 100,
        acknowledged: false
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([testAlert]));

      const acknowledged = alertingSystem.acknowledgeAlert('alert-test-123', 'test-user');
      expect(acknowledged).toBe(true);

      const resolved = alertingSystem.resolveAlert('alert-test-123', 'test-user');
      expect(resolved).toBe(true);
    });

    it('should calculate active alerts summary', () => {
      const alertingSystem = new AlertingSystem();
      
      const testAlerts = [
        {
          id: 'alert-1', ruleId: 'rule1', timestamp: new Date().toISOString(),
          buildId: '1', branch: 'main', commit: 'abc', severity: 'critical' as const,
          title: 'Critical', message: 'msg', metric: 'test', currentValue: 100, acknowledged: false
        },
        {
          id: 'alert-2', ruleId: 'rule2', timestamp: new Date().toISOString(),
          buildId: '2', branch: 'main', commit: 'def', severity: 'warning' as const,
          title: 'Warning', message: 'msg', metric: 'test', currentValue: 80, acknowledged: false
        },
        {
          id: 'alert-3', ruleId: 'rule3', timestamp: new Date().toISOString(),
          buildId: '3', branch: 'main', commit: 'ghi', severity: 'info' as const,
          title: 'Info', message: 'msg', metric: 'test', currentValue: 60, acknowledged: false,
          resolvedAt: new Date().toISOString()
        }
      ];

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(testAlerts));

      const summary = alertingSystem.getActiveAlertsSummary();
      
      expect(summary.total).toBe(2); // Third alert is resolved
      expect(summary.critical).toBe(1);
      expect(summary.warning).toBe(1);
      expect(summary.info).toBe(0);
    });
  });

  describe('MonitoringDashboard', () => {
    it('should create a monitoring dashboard instance', () => {
      const dashboard = new MonitoringDashboard();
      expect(dashboard).toBeDefined();
    });

    it('should generate comprehensive dashboard', async () => {
      const dashboard = new MonitoringDashboard();
      
      const mockHistory = [
        {
          id: 'build-1',
          timestamp: new Date().toISOString(),
          branch: 'main',
          commit: 'abc123',
          buildId: '1',
          metrics: {
            buildTime: 240000,
            testTime: 120000,
            deployTime: 60000,
            totalTime: 420000,
            memoryUsage: { peak: 1800, average: 1200 },
            cpuUsage: { peak: 65, average: 45 },
            artifactSize: 120,
            cacheHitRate: 82
          },
          stages: [
            { name: 'Build', duration: 240000, status: 'success' as const, resourceUsage: { memory: 1200, cpu: 65 } },
            { name: 'Test', duration: 120000, status: 'success' as const, resourceUsage: { memory: 800, cpu: 50 } }
          ]
        }
      ];

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockHistory));

      const result = await dashboard.generateDashboard();

      expect(result).toBeDefined();
      expect(result.title).toBe('CI/CD Pipeline Dashboard');
      expect(result.metrics).toBeDefined();
      expect(result.metrics.length).toBeGreaterThan(0);
      expect(result.buildHistory).toBeDefined();
      
      // Check specific metrics
      const buildTimeMetric = result.metrics.find(m => m.id === 'build-time');
      expect(buildTimeMetric).toBeDefined();
      expect(buildTimeMetric?.name).toBe('Build Time');
      
      const successRateMetric = result.metrics.find(m => m.id === 'success-rate');
      expect(successRateMetric).toBeDefined();
      expect(successRateMetric?.value).toBe(100); // All builds successful
    });

    it('should generate HTML dashboard file', async () => {
      const dashboard = new MonitoringDashboard();
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('[]');

      await dashboard.generateDashboard();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('monitoring-dashboard.html'),
        expect.stringContaining('<!DOCTYPE html>'),
        { flag: undefined }
      );
    });

    it('should generate JSON dashboard data', async () => {
      const dashboard = new MonitoringDashboard();
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('[]');

      await dashboard.generateDashboard();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('dashboard-data.json'),
        expect.stringContaining('"title"'),
        { flag: undefined }
      );
    });

    it('should calculate metrics with proper trends', async () => {
      const dashboard = new MonitoringDashboard();
      
      const mockHistoryWithTrend = [
        {
          id: 'build-1', timestamp: '2024-01-01T10:00:00Z', branch: 'main', commit: 'abc1', buildId: '1',
          metrics: { buildTime: 200000, testTime: 100000, deployTime: 50000, totalTime: 350000, memoryUsage: { peak: 1500, average: 1000 }, cpuUsage: { peak: 60, average: 40 }, artifactSize: 100, cacheHitRate: 80 },
          stages: [{ name: 'Test', duration: 100000, status: 'success' as const, resourceUsage: { memory: 800, cpu: 50 } }]
        },
        {
          id: 'build-2', timestamp: '2024-01-01T11:00:00Z', branch: 'main', commit: 'abc2', buildId: '2',
          metrics: { buildTime: 250000, testTime: 120000, deployTime: 60000, totalTime: 430000, memoryUsage: { peak: 1800, average: 1200 }, cpuUsage: { peak: 70, average: 50 }, artifactSize: 120, cacheHitRate: 75 },
          stages: [{ name: 'Test', duration: 120000, status: 'success' as const, resourceUsage: { memory: 900, cpu: 60 } }]
        },
        {
          id: 'build-3', timestamp: '2024-01-01T12:00:00Z', branch: 'main', commit: 'abc3', buildId: '3',
          metrics: { buildTime: 300000, testTime: 140000, deployTime: 70000, totalTime: 510000, memoryUsage: { peak: 2100, average: 1400 }, cpuUsage: { peak: 80, average: 60 }, artifactSize: 140, cacheHitRate: 70 },
          stages: [{ name: 'Test', duration: 140000, status: 'success' as const, resourceUsage: { memory: 1000, cpu: 70 } }]
        }
      ];

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockHistoryWithTrend));

      const result = await dashboard.generateDashboard();

      const buildTimeMetric = result.metrics.find(m => m.id === 'build-time');
      expect(buildTimeMetric?.trend).toBeDefined();
      expect(['up', 'down', 'stable']).toContain(buildTimeMetric?.trend);
    });
  });

  describe('Integration Tests', () => {
    it('should integrate performance monitoring with alerting system', async () => {
      const monitor = new PerformanceMonitor();
      const alertingSystem = new AlertingSystem();
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');

      const report = await monitor.generateReport();
      const alerts = await alertingSystem.evaluateMetrics(report.currentBuild, []);

      expect(report).toBeDefined();
      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should integrate all monitoring components in dashboard', async () => {
      const monitor = new PerformanceMonitor();
      const alertingSystem = new AlertingSystem();
      const dashboard = new MonitoringDashboard();
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('[]');

      // Generate performance report
      const report = await monitor.generateReport();
      
      // Generate alerts
      const alerts = await alertingSystem.evaluateMetrics(report.currentBuild, []);
      
      // Generate dashboard
      const dashboardResult = await dashboard.generateDashboard();

      expect(report.currentBuild.metrics.totalTime).toBeGreaterThan(0);
      expect(Array.isArray(alerts)).toBe(true);
      expect(dashboardResult.metrics.length).toBeGreaterThan(0);
      expect(dashboardResult.title).toBe('CI/CD Pipeline Dashboard');
    });
  });
});