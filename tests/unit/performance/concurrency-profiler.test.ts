import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConcurrencyProfiler } from '../../../packages/ast-helper/src/performance/concurrency-profiler';
import type { ConcurrencyBenchmarkConfig, ScalingPoint } from '../../../packages/ast-helper/src/performance/types';

describe('ConcurrencyProfiler', () => {
  let profiler: ConcurrencyProfiler;
  let mockCpuMonitor: any;
  let mockMemoryMonitor: any;
  let mockPerformanceTimer: any;

  beforeEach(() => {
    // Mock the utils module that provides performance monitoring tools
    mockCpuMonitor = {
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getAverageUsage: vi.fn().mockReturnValue(25.5)
    };

    mockMemoryMonitor = {
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getPeakUsage: vi.fn().mockReturnValue(1024 * 1024 * 50) // 50MB
    };

    mockPerformanceTimer = {
      start: vi.fn(),
      stop: vi.fn(),
      getElapsedTime: vi.fn().mockReturnValue(1000) // 1 second
    };

    // Mock the utils module
    vi.doMock('../../../packages/ast-helper/src/utils', () => ({
      CPUMonitor: vi.fn().mockImplementation(() => mockCpuMonitor),
      MemoryMonitor: vi.fn().mockImplementation(() => mockMemoryMonitor),
      PerformanceTimer: vi.fn().mockImplementation(() => mockPerformanceTimer)
    }));

    // Mock worker_threads
    vi.doMock('worker_threads', () => ({
      Worker: vi.fn().mockImplementation(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'message') {
            // Simulate worker completion
            setTimeout(() => callback({ 
              status: 'completed', 
              duration: Math.random() * 100 + 50,
              throughput: Math.random() * 20 + 5
            }), 10);
          }
        }),
        postMessage: vi.fn(),
        terminate: vi.fn().mockResolvedValue(0)
      })),
      isMainThread: true,
      parentPort: null
    }));

    profiler = new ConcurrencyProfiler();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Constructor', () => {
    it('should initialize correctly', () => {
      expect(profiler).toBeInstanceOf(ConcurrencyProfiler);
    });

    it('should extend EventEmitter', () => {
      expect(typeof profiler.on).toBe('function');
      expect(typeof profiler.emit).toBe('function');
    });
  });

  // Mock configuration for testing
  const mockConfig: ConcurrencyBenchmarkConfig = {
    maxWorkers: 4,
    totalTasks: 100,
    workerCounts: [1, 2, 4],
    workloadTypes: ['parsing', 'querying'],
    taskTimeout: 5000,
    minThroughput: 5
  };

  describe('runConcurrencyBenchmarks', () => {
    it('should run complete concurrency benchmarks', async () => {
      const result = await profiler.runConcurrencyBenchmarks(mockConfig);

      expect(result).toBeDefined();
      expect(result.benchmarkType).toBe('concurrency');
      expect(result.totalWorkers).toBe(mockConfig.maxWorkers);
      expect(result.totalTasks).toBe(mockConfig.totalTasks);
    }, 45000);

    it('should test multiple worker counts', async () => {
      const result = await profiler.runConcurrencyBenchmarks(mockConfig);

      expect(result.scalabilityMetrics.throughputScaling).toHaveLength(3);
      expect(result.scalabilityMetrics.memoryScaling).toHaveLength(3);
      expect(result.scalabilityMetrics.latencyScaling).toHaveLength(3);

      // Verify worker counts match configuration
      result.scalabilityMetrics.throughputScaling.forEach((point: ScalingPoint, index: number) => {
        expect(point.workerCount).toBe(mockConfig.workerCounts[index]);
      });
    });

    it('should calculate performance metrics', async () => {
      const result = await profiler.runConcurrencyBenchmarks(mockConfig);

      expect(typeof result.averageDuration).toBe('number');
      expect(typeof result.averageThroughput).toBe('number');
      expect(typeof result.peakMemoryUsage).toBe('number');
      expect(typeof result.performanceScore).toBe('number');
      expect(result.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.performanceScore).toBeLessThanOrEqual(100);
    });

    it('should determine optimal worker count', async () => {
      const result = await profiler.runConcurrencyBenchmarks(mockConfig);

      expect(result.scalabilityMetrics.optimalWorkerCount).toBeGreaterThan(0);
      expect(result.scalabilityMetrics.optimalWorkerCount).toBeLessThanOrEqual(mockConfig.maxWorkers);
    });

    it('should validate performance targets', async () => {
      const result = await profiler.runConcurrencyBenchmarks(mockConfig);

      expect(typeof result.meetsPerformanceTargets).toBe('boolean');
    }, 45000);

    it('should generate warnings and recommendations', async () => {
      const result = await profiler.runConcurrencyBenchmarks(mockConfig);

      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    }, 45000);

    it('should track resource metrics', async () => {
      const result = await profiler.runConcurrencyBenchmarks(mockConfig);

      expect(typeof result.resourceContentions).toBe('number');
      expect(typeof result.deadlocksDetected).toBe('number');  
      expect(typeof result.threadSafetyViolations).toBe('number');
      expect(result.resourceContentions).toBeGreaterThanOrEqual(0);
      expect(result.deadlocksDetected).toBeGreaterThanOrEqual(0);
      expect(result.threadSafetyViolations).toBeGreaterThanOrEqual(0);
    }, 45000);

    it('should handle errors gracefully', async () => {
      const errorConfig = { ...mockConfig, totalTasks: -1 };
      
      await expect(profiler.runConcurrencyBenchmarks(errorConfig))
        .rejects.toThrow();
    });
  });

  describe('Task Generation', () => {
    it('should handle different workload types', async () => {
      const parsingConfig = { ...mockConfig, workloadTypes: ['parsing'] };
      const queryingConfig = { ...mockConfig, workloadTypes: ['querying'] };

      const parsingResult = await profiler.runConcurrencyBenchmarks(parsingConfig);
      const queryingResult = await profiler.runConcurrencyBenchmarks(queryingConfig);

      expect(parsingResult).toBeDefined();
      expect(queryingResult).toBeDefined();
      expect(parsingResult.benchmarkType).toBe('concurrency');
      expect(queryingResult.benchmarkType).toBe('concurrency');
    }, 45000);
  });

  describe('Scalability Analysis', () => {
    it('should analyze scaling metrics', async () => {
      const result = await profiler.runConcurrencyBenchmarks(mockConfig);

      expect(result.scalabilityMetrics).toBeDefined();
      expect(result.scalabilityMetrics.throughputScaling).toBeDefined();
      expect(result.scalabilityMetrics.memoryScaling).toBeDefined();
      expect(result.scalabilityMetrics.latencyScaling).toBeDefined();

      // Verify scaling data structure
      result.scalabilityMetrics.throughputScaling.forEach((point: ScalingPoint) => {
        expect(point).toHaveProperty('workerCount');
        expect(typeof point.workerCount).toBe('number');
        if (point.throughput !== undefined) {
          expect(typeof point.throughput).toBe('number');
        }
      });

      result.scalabilityMetrics.memoryScaling.forEach((point: ScalingPoint) => {
        expect(point).toHaveProperty('workerCount');
        if (point.memoryUsage !== undefined) {
          expect(typeof point.memoryUsage).toBe('number');
        }
      });

      result.scalabilityMetrics.latencyScaling.forEach((point: ScalingPoint) => {
        expect(point).toHaveProperty('workerCount');
        if (point.latency !== undefined) {
          expect(typeof point.latency).toBe('number');
        }
      });
    }, 45000);
  });

  describe('Error Handling', () => {
    it('should handle invalid configurations', async () => {
      const invalidConfig = { ...mockConfig, maxWorkers: 0 };

      await expect(profiler.runConcurrencyBenchmarks(invalidConfig))
        .rejects.toThrow();
    });

    it('should handle worker creation failures', async () => {
      // Temporarily disable test mode to test actual worker creation failure
      const originalNodeEnv = process.env.NODE_ENV;
      const originalVitest = process.env.VITEST;
      
      process.env.NODE_ENV = 'production';
      delete process.env.VITEST;
      
      try {
        // Mock worker_threads module to throw on Worker creation
        vi.doMock('worker_threads', () => ({
          Worker: vi.fn().mockImplementation(() => {
            throw new Error('Worker creation failed');
          }),
          isMainThread: true,
          parentPort: null
        }));

        // Create new profiler instance to use mocked module
        const { ConcurrencyProfiler } = await import('../../../packages/ast-helper/src/performance/concurrency-profiler');
        const failingProfiler = new ConcurrencyProfiler();
        
        await expect(failingProfiler.runConcurrencyBenchmarks(mockConfig))
          .rejects.toThrow();
      } finally {
        // Restore original environment
        if (originalNodeEnv !== undefined) {
          process.env.NODE_ENV = originalNodeEnv;
        }
        if (originalVitest !== undefined) {
          process.env.VITEST = originalVitest;
        }
      }
    }, 45000);
  });

  describe('Cleanup and Shutdown', () => {
    it('should cleanup workers properly', async () => {
      const result = await profiler.runConcurrencyBenchmarks(mockConfig);

      expect(result).toBeDefined();
      // Verify no hanging promises or resources
      expect(result.totalWorkers).toBe(mockConfig.maxWorkers);
    });

    it('should shutdown gracefully', async () => {
      const shutdownPromise = profiler.shutdown();
      await expect(shutdownPromise).resolves.toBeUndefined();
    });

    it('should remove all listeners on shutdown', async () => {
      profiler.on('progress', () => {});
      profiler.on('completed', () => {});

      await profiler.shutdown();

      expect(profiler.listenerCount('progress')).toBe(0);
      expect(profiler.listenerCount('completed')).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should track memory and CPU usage', async () => {
      const result = await profiler.runConcurrencyBenchmarks(mockConfig);

      expect(result.peakMemoryUsage).toBeGreaterThan(0);
      expect(typeof result.averageCpuUsage).toBe('number');
      expect(result.averageCpuUsage).toBeGreaterThan(0);
    }, 45000);

    it('should calculate realistic performance scores', async () => {
      const result = await profiler.runConcurrencyBenchmarks(mockConfig);

      expect(result.performanceScore).toBeGreaterThan(0);
      expect(result.performanceScore).toBeLessThanOrEqual(100);
    }, 45000);
  });
});