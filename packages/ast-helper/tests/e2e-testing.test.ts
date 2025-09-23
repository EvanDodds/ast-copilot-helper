/**
 * @fileoverview E2E Testing Framework Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { E2ETestRunner } from '../src/e2e-testing/runner.js';
import { E2EConfig } from '../src/e2e-testing/config.js';
import type { E2ETestingConfig } from '../src/e2e-testing/types.js';

describe('E2E Testing Framework', () => {
  let runner: E2ETestRunner;

  beforeEach(() => {
    const config: Partial<E2ETestingConfig> = {
      scenarios: [
        {
          name: 'test-scenario',
          description: 'Test scenario for unit testing',
          enabled: true,
          category: 'codebase-analysis',
          timeout: 10000,
          retries: 1,
          prerequisites: [],
          cleanup: true,
          parallel: false,
          environment: ['cli']
        }
      ]
    };

    runner = new E2ETestRunner(config);
  });

  afterEach(() => {
    runner.removeAllListeners();
  });

  describe('E2ETestRunner', () => {
    it('should initialize with default config', () => {
      const defaultRunner = new E2ETestRunner();
      expect(defaultRunner).toBeDefined();
    });

    it('should initialize with custom config', () => {
      expect(runner).toBeDefined();
    });

    it('should run test suite', async () => {
      const result = await runner.runTestSuite();
      
      expect(result).toBeDefined();
      expect(result.testSuiteId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.environment).toBeDefined();
      expect(result.scenarios).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.resources).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should emit events during test execution', async () => {
      const events: string[] = [];
      
      runner.on('suite:start', () => events.push('suite:start'));
      runner.on('scenario:start', () => events.push('scenario:start'));
      runner.on('step:start', () => events.push('step:start'));
      runner.on('step:complete', () => events.push('step:complete'));
      runner.on('scenario:complete', () => events.push('scenario:complete'));
      runner.on('suite:complete', () => events.push('suite:complete'));
      
      await runner.runTestSuite();
      
      expect(events).toContain('suite:start');
      expect(events).toContain('suite:complete');
    });

    it('should handle scenarios with different categories', async () => {
      const config: Partial<E2ETestingConfig> = {
        scenarios: [
          {
            name: 'codebase-scenario',
            description: 'Codebase analysis scenario',
            enabled: true,
            category: 'codebase-analysis',
            timeout: 5000,
            retries: 1,
            prerequisites: [],
            cleanup: true,
            parallel: false,
            environment: ['cli']
          },
          {
            name: 'collaboration-scenario',
            description: 'Collaboration testing scenario',
            enabled: true,
            category: 'collaboration',
            timeout: 5000,
            retries: 1,
            prerequisites: [],
            cleanup: true,
            parallel: false,
            environment: ['mcp-server']
          }
        ]
      };

      const testRunner = new E2ETestRunner(config);
      const result = await testRunner.runTestSuite();
      
      expect(result.scenarios).toHaveLength(2);
      expect(result.scenarios.some(s => s.category === 'codebase-analysis')).toBe(true);
      expect(result.scenarios.some(s => s.category === 'collaboration')).toBe(true);
    });

    it('should calculate correct summary metrics', async () => {
      const result = await runner.runTestSuite();
      
      expect(result.summary.totalScenarios).toBeGreaterThanOrEqual(0);
      expect(result.summary.passedScenarios).toBeGreaterThanOrEqual(0);
      expect(result.summary.failedScenarios).toBeGreaterThanOrEqual(0);
      expect(result.summary.totalSteps).toBeGreaterThanOrEqual(0);
      expect(result.summary.passedSteps).toBeGreaterThanOrEqual(0);
      expect(result.summary.averageDuration).toBeGreaterThanOrEqual(0);
      expect(result.summary.resourceEfficiency).toBeGreaterThanOrEqual(0);
      expect(result.summary.reliabilityScore).toBeGreaterThanOrEqual(0);
    });

    it('should capture performance metrics', async () => {
      const result = await runner.runTestSuite();
      
      expect(result.performance.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.peakResponseTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.throughput).toBeGreaterThanOrEqual(0);
      expect(result.performance.errorRate).toBeGreaterThanOrEqual(0);
      expect(result.performance.availability).toBeGreaterThanOrEqual(0);
      expect(result.performance.scalabilityScore).toBeGreaterThanOrEqual(0);
    });

    it('should track resource usage', async () => {
      const result = await runner.runTestSuite();
      
      expect(result.resources.peakMemoryMB).toBeGreaterThanOrEqual(0);
      expect(result.resources.averageMemoryMB).toBeGreaterThanOrEqual(0);
      expect(result.resources.peakCpuPercent).toBeGreaterThanOrEqual(0);
      expect(result.resources.averageCpuPercent).toBeGreaterThanOrEqual(0);
      expect(result.resources.diskUsageMB).toBeGreaterThanOrEqual(0);
      expect(result.resources.networkUsageMB).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.resources.resourceLeaks)).toBe(true);
    });

    it('should provide environment information', async () => {
      const result = await runner.runTestSuite();
      
      expect(result.environment.platform).toBeDefined();
      expect(result.environment.nodeVersion).toBeDefined();
      expect(Array.isArray(result.environment.components)).toBe(true);
      expect(result.environment.resources).toBeDefined();
      expect(result.environment.network).toBeDefined();
      expect(result.environment.system).toBeDefined();
    });

    it('should generate recommendations for failed tests', async () => {
      // Create a config that will likely fail some tests
      const failingConfig: Partial<E2ETestingConfig> = {
        scenarios: [
          {
            name: 'failing-scenario',
            description: 'Scenario designed to fail',
            enabled: true,
            category: 'codebase-analysis',
            timeout: 1, // Very short timeout to force failure
            retries: 0,
            prerequisites: [],
            cleanup: true,
            parallel: false,
            environment: ['cli']
          }
        ]
      };

      const failingRunner = new E2ETestRunner(failingConfig);
      const result = await failingRunner.runTestSuite();
      
      // Should have recommendations due to failures
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('E2EConfig', () => {
    it('should initialize with default configuration', () => {
      const config = new E2EConfig();
      expect(config).toBeDefined();
    });

    it('should merge custom configuration', () => {
      const customConfig: Partial<E2ETestingConfig> = {
        scenarios: {
          'custom-scenario': {
            enabled: true,
            priority: 'high',
            timeout: 15000,
            retries: 2,
            tags: ['custom']
          }
        }
      };

      const config = new E2EConfig(customConfig);
      const scenarios = config.getEnabledScenarios();
      
      expect(scenarios.some(s => s.name === 'custom-scenario')).toBe(true);
    });

    it('should return only enabled scenarios', () => {
      const config = new E2EConfig({
        scenarios: {
          'enabled-scenario': {
            enabled: true,
            priority: 'high',
            timeout: 10000,
            retries: 1,
            tags: ['enabled']
          },
          'disabled-scenario': {
            enabled: false,
            priority: 'low',
            timeout: 5000,
            retries: 0,
            tags: ['disabled']
          }
        }
      });

      const scenarios = config.getEnabledScenarios();
      expect(scenarios.every(s => s.name !== 'disabled-scenario')).toBe(true);
    });

    it('should update scenario configuration', () => {
      const config = new E2EConfig();
      
      config.updateScenario('test-scenario', {
        enabled: true,
        priority: 'critical',
        timeout: 20000,
        retries: 3,
        tags: ['updated']
      });

      const scenarios = config.getEnabledScenarios();
      const updatedScenario = scenarios.find(s => s.name === 'test-scenario');
      
      expect(updatedScenario?.priority).toBe('critical');
      expect(updatedScenario?.timeout).toBe(20000);
      expect(updatedScenario?.retries).toBe(3);
    });

    it('should get monitoring configuration', () => {
      const config = new E2EConfig({
        monitoring: {
          enabled: true,
          interval: 2000,
          thresholds: {
            memory: 1024,
            cpu: 90,
            disk: 2048,
            network: 200
          }
        }
      });

      const monitoring = config.getMonitoringConfig();
      expect(monitoring.enabled).toBe(true);
      expect(monitoring.interval).toBe(2000);
      expect(monitoring.thresholds.memory).toBe(1024);
    });
  });
});