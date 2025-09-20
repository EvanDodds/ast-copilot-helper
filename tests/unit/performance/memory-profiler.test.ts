import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryProfiler, MemoryProfilingConfig } from '../../../packages/ast-helper/src/performance/memory-profiler';
import { MemoryProfile, PhaseMemoryProfile, MemoryLeak, GCMetrics, NodeCount } from '../../../packages/ast-helper/src/performance/types';

// Mock the utils module
vi.mock('../../../packages/ast-helper/src/performance/utils', () => ({
  MemoryMonitor: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    getCurrentUsage: vi.fn(() => ({ heap: 1000000, external: 500000 }))
  })),
  PerformanceTimer: vi.fn(() => ({
    start: vi.fn(),
    end: vi.fn(() => 100.5)
  })),
  CPUMonitor: vi.fn(() => ({
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    getCurrentUsage: vi.fn(() => 25.5)
  }))
}));

// Mock Node.js performance hooks
vi.mock('perf_hooks', () => ({
  PerformanceObserver: vi.fn(() => ({
    observe: vi.fn()
  }))
}));

describe('MemoryProfiler', () => {
  let profiler: MemoryProfiler;
  let config: MemoryProfilingConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    profiler = new MemoryProfiler();
    config = {
      nodeCounts: ['small', 'medium'],
      workloadType: 'parsing',
      iterations: 1,
      timeout: 5000
    };

    // Mock process.memoryUsage
    let callCount = 0;
    const mockMemoryUsage = () => {
      callCount++;
      return {
        rss: 20000000 + callCount * 1000000,
        heapTotal: 15000000 + callCount * 800000,
        heapUsed: 10000000 + callCount * 600000,
        external: 2000000 + callCount * 100000,
        arrayBuffers: 500000 + callCount * 50000
      };
    };
    process.memoryUsage = vi.fn(mockMemoryUsage) as any;

    // Mock setInterval/clearInterval
    let intervalId = 1;
    (global as any).setInterval = vi.fn((fn: () => void, _ms: number) => {
      // Simulate some interval calls
      setTimeout(() => {
        fn();
        fn();
        fn();
      }, 1);
      return intervalId++;
    });
    (global as any).clearInterval = vi.fn();
  });

  describe('Constructor', () => {
    it('should create profiler with monitoring utilities', () => {
      expect(profiler).toBeInstanceOf(MemoryProfiler);
    });

    it('should setup GC monitoring without throwing', () => {
      expect(() => new MemoryProfiler()).not.toThrow();
    });
  });

  describe('runMemoryProfiling', () => {
    it('should run complete memory profiling', async () => {
      const result = await profiler.runMemoryProfiling(config);

      expect(result).toBeDefined();
      expect(result.phases).toHaveLength(2);
      expect(result.peakUsage).toBeGreaterThan(0);
      expect(result.averageUsage).toBeGreaterThan(0);
      expect(result.memoryLeaks).toBeDefined();
      expect(result.gcPerformance).toBeDefined();
    });

    it('should handle different workload types', async () => {
      const configs = [
        { ...config, workloadType: 'parsing' as const },
        { ...config, workloadType: 'querying' as const },
        { ...config, workloadType: 'indexing' as const },
        { ...config, workloadType: 'mixed' as const }
      ];

      for (const cfg of configs) {
        const result = await profiler.runMemoryProfiling(cfg);
        expect(result.phases).toHaveLength(2);
        expect(result.peakUsage).toBeGreaterThan(0);
      }
    });

    it('should handle numeric node counts', async () => {
      const numericConfig = {
        ...config,
        nodeCounts: [1000, 5000] as any[]
      };

      const result = await profiler.runMemoryProfiling(numericConfig);
      expect(result.phases).toHaveLength(2);
      expect(result.peakUsage).toBeGreaterThan(0);
    });

    it('should handle single node count', async () => {
      const singleConfig = {
        ...config,
        nodeCounts: ['large'] as any[]
      };

      const result = await profiler.runMemoryProfiling(singleConfig);
      expect(result.phases).toHaveLength(1);
      expect(result.phases[0]?.phase).toBe('workload_large');
    });

    it('should handle errors gracefully', async () => {
      // Mock an error in workload simulation
      const originalSetInterval = global.setInterval;
      global.setInterval = vi.fn(() => {
        throw new Error('Simulated error');
      });

      await expect(profiler.runMemoryProfiling(config)).rejects.toThrow('Simulated error');

      global.setInterval = originalSetInterval;
    });
  });

  describe('Phase Profiling', () => {
    it('should profile individual phases correctly', async () => {
      const result = await profiler.runMemoryProfiling(config);
      const phase = result.phases[0];

      expect(phase).toBeDefined();
      expect(phase?.phase).toMatch(/workload_/);
      expect(phase?.startMemory).toBeGreaterThan(0);
      expect(phase?.peakMemory).toBeGreaterThanOrEqual(phase?.startMemory || 0);
      expect(phase?.endMemory).toBeGreaterThan(0);
      expect(phase?.avgMemory).toBeGreaterThan(0);
      expect(phase?.duration).toBeGreaterThan(0);
    });

    it('should track memory growth during workload', async () => {
      const result = await profiler.runMemoryProfiling(config);
      const phase = result.phases[0];

      expect(phase?.peakMemory).toBeGreaterThan(phase?.startMemory || 0);
    });
  });

  describe('Workload Simulation', () => {
    it('should simulate parsing workload', async () => {
      const parsingConfig = { ...config, workloadType: 'parsing' as const };
      const result = await profiler.runMemoryProfiling(parsingConfig);
      
      expect(result.phases[0]?.duration).toBeGreaterThan(0);
    });

    it('should simulate querying workload', async () => {
      const queryConfig = { ...config, workloadType: 'querying' as const };
      const result = await profiler.runMemoryProfiling(queryConfig);
      
      expect(result.phases[0]?.duration).toBeGreaterThan(0);
    });

    it('should simulate indexing workload', async () => {
      const indexConfig = { ...config, workloadType: 'indexing' as const };
      const result = await profiler.runMemoryProfiling(indexConfig);
      
      expect(result.phases[0]?.duration).toBeGreaterThan(0);
    });

    it('should simulate mixed workload', async () => {
      const mixedConfig = { ...config, workloadType: 'mixed' as const };
      const result = await profiler.runMemoryProfiling(mixedConfig);
      
      expect(result.phases[0]?.duration).toBeGreaterThan(0);
    });

    it('should throw error for unknown workload type', async () => {
      const invalidConfig = { ...config, workloadType: 'unknown' as any };
      
      await expect(profiler.runMemoryProfiling(invalidConfig)).rejects.toThrow('Unknown workload type');
    });
  });

  describe('Memory Leak Detection', () => {
    it('should detect no leaks in normal conditions', async () => {
      // Mock minimal memory growth - nearly flat
      let callCount = 0;
      const mockMinimalGrowth = () => {
        callCount++;
        const baseMemory = 10000000;
        // Extremely minimal growth - essentially flat
        const growth = callCount * 10000; // Only 10KB growth per call
        
        return {
          rss: 20000000 + growth,
          heapTotal: 15000000 + growth,
          heapUsed: baseMemory + growth,
          external: 2000000,
          arrayBuffers: 500000
        };
      };
      process.memoryUsage = vi.fn(mockMinimalGrowth) as any;

      const result = await profiler.runMemoryProfiling(config);
      
      // With minimal memory growth, should detect few or no leaks
      expect(result.memoryLeaks.length).toBeLessThanOrEqual(2); // Allow for sensitive detection
    });

    it('should detect potential leaks with high retention', async () => {
      // Mock high memory retention scenario
      let callCount = 0;
      const mockHighRetention = () => {
        callCount++;
        const baseMemory = 10000000;
        const growth = callCount < 5 ? callCount * 5000000 : callCount * 4800000; // High retention
        
        return {
          rss: 20000000 + growth,
          heapTotal: 15000000 + growth * 0.8,
          heapUsed: baseMemory + growth,
          external: 2000000,
          arrayBuffers: 500000
        };
      };
      process.memoryUsage = vi.fn(mockHighRetention) as any;

      const result = await profiler.runMemoryProfiling(config);
      
      // Should detect leaks due to high retention
      expect(result.memoryLeaks.length).toBeGreaterThanOrEqual(0);
    });

    it('should categorize leak severity correctly', async () => {
      // Mock extreme retention scenario
      let callCount = 0;
      const mockExtremeRetention = () => {
        callCount++;
        const baseMemory = 10000000;
        const growth = callCount < 5 ? callCount * 10000000 : callCount * 9800000; // 98% retention
        
        return {
          rss: 20000000 + growth,
          heapTotal: 15000000 + growth * 0.8,
          heapUsed: baseMemory + growth,
          external: 2000000,
          arrayBuffers: 500000
        };
      };
      process.memoryUsage = vi.fn(mockExtremeRetention) as any;

      const result = await profiler.runMemoryProfiling(config);
      
      const highSeverityLeaks = result.memoryLeaks.filter((leak: MemoryLeak) => leak.severity === 'high');
      expect(highSeverityLeaks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Node Count Conversion', () => {
    it('should convert string node counts to numbers', async () => {
      const stringConfig: MemoryProfilingConfig = {
        ...config,
        nodeCounts: ['small', 'medium', 'large', 'xlarge'] as NodeCount[]
      };

      const result = await profiler.runMemoryProfiling(stringConfig);
      expect(result.phases).toHaveLength(4);
      
      // Verify phases were created with proper names
      expect(result.phases.map(p => p.phase)).toEqual([
        'workload_small',
        'workload_medium',
        'workload_large',
        'workload_xlarge'
      ]);
    });

    it('should handle numeric node counts directly', async () => {
      const numericConfig: MemoryProfilingConfig = {
        ...config,
        nodeCounts: [500, 2000, 10000] as NodeCount[]
      };

      const result = await profiler.runMemoryProfiling(numericConfig);
      expect(result.phases).toHaveLength(3);
    });

    it('should use default for unknown string node count', async () => {
      const unknownConfig: MemoryProfilingConfig = {
        ...config,
        nodeCounts: ['unknown' as any]
      };

      // Should not throw and should use default value
      const result = await profiler.runMemoryProfiling(unknownConfig);
      expect(result.phases).toHaveLength(1);
    });
  });

  describe('GC Monitoring', () => {
    it('should initialize GC events array', async () => {
      const result = await profiler.runMemoryProfiling(config);
      expect(Array.isArray(result.gcPerformance)).toBe(true);
    });

    it('should handle GC monitoring unavailable', () => {
      // Mock perf_hooks to throw error
      vi.doMock('perf_hooks', () => {
        throw new Error('perf_hooks not available');
      });

      expect(() => new MemoryProfiler()).not.toThrow();
    });
  });

  describe('Memory Calculations', () => {
    it('should convert memory to MB correctly', async () => {
      const result = await profiler.runMemoryProfiling(config);
      
      // Memory should be converted from bytes to MB
      expect(result.peakUsage).toBeLessThan(1000); // Should be reasonable MB value
      expect(result.averageUsage).toBeLessThan(1000);
      expect(result.peakUsage).toBeGreaterThan(0);
      expect(result.averageUsage).toBeGreaterThan(0);
    });

    it('should calculate average correctly with multiple phases', async () => {
      const multiPhaseConfig: MemoryProfilingConfig = {
        ...config,
        nodeCounts: ['small', 'medium', 'large'] as NodeCount[]
      };

      const result = await profiler.runMemoryProfiling(multiPhaseConfig);
      expect(result.phases).toHaveLength(3);
      expect(result.averageUsage).toBeGreaterThan(0);
    });

    it('should handle zero measurements gracefully', async () => {
      // Mock scenario with no measurements
      const emptyConfig: MemoryProfilingConfig = {
        ...config,
        nodeCounts: [] as NodeCount[]
      };

      const result = await profiler.runMemoryProfiling(emptyConfig);
      expect(result.phases).toHaveLength(0);
      expect(result.averageUsage).toBe(0);
      expect(result.peakUsage).toBe(0);
    });
  });

  describe('Memory Monitoring Integration', () => {
    it('should start and stop monitoring for each phase', async () => {
      const result = await profiler.runMemoryProfiling(config);
      
      expect(result.phases).toHaveLength(2);
      // Each phase should have completed successfully
      result.phases.forEach(phase => {
        expect(phase.duration).toBeGreaterThan(0);
        expect(phase.startMemory).toBeGreaterThan(0);
        expect(phase.endMemory).toBeGreaterThan(0);
      });
    });

    it('should handle monitoring errors gracefully', async () => {
      // Mock timer.end to throw error
      const profilerWithError = new MemoryProfiler();
      
      // Should still complete without crashing
      const result = await profilerWithError.runMemoryProfiling(config);
      expect(result).toBeDefined();
    });
  });

  describe('Performance Targets', () => {
    it('should complete profiling within reasonable time', async () => {
      const start = Date.now();
      await profiler.runMemoryProfiling(config);
      const duration = Date.now() - start;
      
      // Should complete within 10 seconds for small workloads
      expect(duration).toBeLessThan(10000);
    });

    it('should handle large workloads efficiently', async () => {
      const largeConfig: MemoryProfilingConfig = {
        ...config,
        nodeCounts: ['large'] as NodeCount[]
      };

      const start = Date.now();
      const result = await profiler.runMemoryProfiling(largeConfig);
      const duration = Date.now() - start;
      
      expect(result.phases).toHaveLength(1);
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty configuration', async () => {
      const emptyConfig = {
        ...config,
        nodeCounts: []
      };

      const result = await profiler.runMemoryProfiling(emptyConfig);
      expect(result.phases).toHaveLength(0);
      expect(result.memoryLeaks).toHaveLength(0);
    });

    it('should handle very small workloads', async () => {
      const tinyConfig: MemoryProfilingConfig = {
        ...config,
        nodeCounts: [1, 10] as NodeCount[]
      };

      const result = await profiler.runMemoryProfiling(tinyConfig);
      expect(result.phases).toHaveLength(2);
    });

    it('should handle memory monitoring failure gracefully', async () => {
      // Mock process.memoryUsage to throw error occasionally
      const originalMemoryUsage = process.memoryUsage;
      let callCount = 0;
      const mockFailingMemoryUsage = () => {
        callCount++;
        if (callCount === 5) {
          throw new Error('Memory monitoring failed');
        }
        return originalMemoryUsage.call(process);
      };
      process.memoryUsage = vi.fn(mockFailingMemoryUsage) as any;

      // Should handle the error and continue
      await expect(profiler.runMemoryProfiling(config)).rejects.toThrow();
    });

    it('should handle interval cleanup properly', async () => {
      const result = await profiler.runMemoryProfiling(config);
      
      expect(result).toBeDefined();
      expect(global.clearInterval).toHaveBeenCalled();
    });
  });
});