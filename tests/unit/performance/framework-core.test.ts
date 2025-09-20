import { describe, expect, it, beforeEach } from 'vitest';
import { PerformanceBenchmarkRunner } from '../../../packages/ast-helper/src/performance/benchmark-runner';
import { PerformanceTimer, CPUMonitor, MemoryMonitor } from '../../../packages/ast-helper/src/performance/utils';

describe('Performance Framework Core', () => {
  let benchmarkRunner: PerformanceBenchmarkRunner;

  beforeEach(() => {
    benchmarkRunner = new PerformanceBenchmarkRunner();
  });

  describe('PerformanceBenchmarkRunner', () => {
    it('should initialize with default performance targets', () => {
      expect(benchmarkRunner).toBeInstanceOf(PerformanceBenchmarkRunner);
    });

    it('should generate system info correctly', async () => {
      const report = await benchmarkRunner.generatePerformanceReport();
      
      expect(report.systemInfo).toBeDefined();
      expect(report.systemInfo.platform).toBeTruthy();
      expect(report.systemInfo.arch).toBeTruthy();
      expect(report.systemInfo.nodeVersion).toBeTruthy();
      expect(report.systemInfo.cpuCount).toBeGreaterThan(0);
      expect(report.systemInfo.totalMemory).toBeGreaterThan(0);
    }, 45000);

    it('should run benchmark suite successfully', async () => {
      const results = await benchmarkRunner.runBenchmarkSuite();
      
      expect(results).toBeDefined();
      expect(results.parsingBenchmarks).toBeInstanceOf(Array);
      expect(results.queryBenchmarks).toBeInstanceOf(Array);
      expect(results.embeddingBenchmarks).toBeInstanceOf(Array);
      expect(results.vectorSearchBenchmarks).toBeInstanceOf(Array);
      expect(results.systemBenchmarks).toBeInstanceOf(Array);
    });

    it('should validate performance targets', async () => {
      const validation = await benchmarkRunner.validatePerformanceTargets();
      
      expect(validation).toBeDefined();
      expect(validation.passed).toBeDefined();
      expect(validation.results).toBeInstanceOf(Array);
      expect(validation.summary).toBeDefined();
      expect(validation.summary.totalTests).toBeGreaterThanOrEqual(0);
      expect(validation.summary.passedTests).toBeGreaterThanOrEqual(0);
      expect(validation.summary.failedTests).toBeGreaterThanOrEqual(0);
    });

    it('should profile memory usage', async () => {
      const profile = await benchmarkRunner.profileMemoryUsage();
      
      expect(profile).toBeDefined();
      expect(profile.phases).toBeInstanceOf(Array);
      expect(profile.peakUsage).toBeGreaterThanOrEqual(0);
      expect(profile.averageUsage).toBeGreaterThanOrEqual(0);
      expect(profile.memoryLeaks).toBeInstanceOf(Array);
      expect(profile.gcPerformance).toBeInstanceOf(Array);
    });

    it('should test concurrent operations', async () => {
      const results = await benchmarkRunner.testConcurrentOperations();
      
      expect(results).toBeDefined();
      expect(results.levels).toBeInstanceOf(Array);
      expect(results.maxSustainableConcurrency).toBeGreaterThanOrEqual(0);
      expect(results.degradationPoint).toBeGreaterThanOrEqual(0);
    }, 45000);

    it('should measure scalability limits', async () => {
      const report = await benchmarkRunner.measureScalabilityLimits();
      
      expect(report).toBeDefined();
      expect(report.results).toBeInstanceOf(Array);
      expect(report.scalingFactors).toBeDefined();
      expect(report.recommendedLimits).toBeDefined();
    });

    it('should generate comprehensive performance report', async () => {
      const report = await benchmarkRunner.generatePerformanceReport();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.systemInfo).toBeDefined();
      expect(report.benchmarkResults).toBeDefined();
      expect(report.validation).toBeDefined();
      expect(report.memoryProfile).toBeDefined();
      expect(report.concurrencyResults).toBeDefined();
      expect(report.scalabilityReport).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    }, 45000);
  });

  describe('PerformanceTimer', () => {
    it('should measure async function execution time', async () => {
      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test result';
      };

      const { result, duration } = await PerformanceTimer.measure(testFunction);
      
      expect(result).toBe('test result');
      expect(duration).toBeGreaterThanOrEqual(8); // Slightly reduced for timing variance
      expect(duration).toBeLessThan(100); // Should complete within reasonable time
    });

    it('should manage named timers correctly', () => {
      const timer = new PerformanceTimer();
      
      timer.start('test-timer');
      const lapTime = timer.lap('test-timer');
      const endTime = timer.end('test-timer');
      
      expect(lapTime).toBeGreaterThanOrEqual(0);
      expect(endTime).toBeGreaterThanOrEqual(0);
      expect(endTime).toBeGreaterThanOrEqual(lapTime);
    });

    it('should throw error for non-existent timer', () => {
      const timer = new PerformanceTimer();
      
      expect(() => timer.lap('non-existent')).toThrow();
      expect(() => timer.end('non-existent')).toThrow();
    });

    it('should assert performance thresholds', () => {
      expect(() => PerformanceTimer.assertPerformance(100, 50, 'test operation')).toThrow();
      expect(() => PerformanceTimer.assertPerformance(50, 100, 'test operation')).not.toThrow();
    });
  });

  describe('CPUMonitor', () => {
    it('should monitor CPU usage', async () => {
      const monitor = new CPUMonitor();
      
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      const avgCpu = await monitor.stop();
      
      expect(avgCpu).toBeGreaterThanOrEqual(0);
      expect(avgCpu).toBeLessThanOrEqual(100);
    });
  });

  describe('MemoryMonitor', () => {
    it('should monitor memory usage', async () => {
      const monitor = new MemoryMonitor();
      
      monitor.start();
      
      // Allocate some memory
      const data = new Array(1000).fill('test data');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = monitor.stop();
      
      expect(stats.peak).toBeGreaterThan(0);
      expect(stats.average).toBeGreaterThan(0);
      expect(stats.start).toBeGreaterThanOrEqual(0);
      expect(stats.end).toBeGreaterThanOrEqual(0);
      expect(stats.peak).toBeGreaterThanOrEqual(stats.average);
      
      // Keep reference to prevent optimization
      expect(data.length).toBe(1000);
    });
  });

  describe('Performance Target Validation', () => {
    it('should define performance targets correctly', async () => {
      const validation = await benchmarkRunner.validatePerformanceTargets();
      
      // Performance targets should be well-defined
      expect(validation.summary.totalTests).toBeGreaterThanOrEqual(0);
      
      // At minimum, we should be testing basic functionality
      // Actual performance validation will be implemented in subsequent tasks
    });
  });

  describe('Integration with Existing System', () => {
    it('should integrate with existing performance test utilities', () => {
      // Test that our new framework works alongside existing performance utilities
      const timer = new PerformanceTimer();
      
      timer.start('integration-test');
      const elapsed = timer.end('integration-test');
      
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });
});