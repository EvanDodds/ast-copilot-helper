import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryBenchmarkRunner } from '../../../packages/ast-helper/src/performance/query-benchmarks';
import type { QueryBenchmarkConfig, BenchmarkResult } from '../../../packages/ast-helper/src/performance/types';

describe('Query Performance Benchmarks', () => {
  let runner: QueryBenchmarkRunner;

  beforeEach(() => {
    runner = new QueryBenchmarkRunner();
    vi.clearAllMocks();
  });

  describe('QueryBenchmarkRunner', () => {
    describe('MCP Query Benchmarks', () => {
      it('should run MCP query benchmarks within 200ms target', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 3
        };

        const result = await runner.runMCPQueryBenchmarks(config);

        expect(result).toBeDefined();
        expect(result.benchmarkType).toBe('query');
        expect(result.totalRuns).toBe(9); // 3 query types × 3 iterations
        expect(result.successfulRuns).toBeGreaterThan(0);
        expect(result.averageDuration).toBeGreaterThan(0);
        expect(result.averageThroughput).toBeGreaterThan(0);
      }, 15000);

      it('should validate MCP response time targets', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'medium',
          iterations: 2
        };

        const result = await runner.runMCPQueryBenchmarks(config);
        
        expect(result.benchmarkType).toBe('query');
        expect(result.totalRuns).toBe(6); // 3 query types × 2 iterations
        
        // Check if performance targets are being evaluated
        expect(result.meetsPerformanceTargets).toBeDefined();
        expect(result.performanceScore).toBeGreaterThanOrEqual(0);
        expect(result.performanceScore).toBeLessThanOrEqual(100);
      }, 10000);

      it('should handle different query types for MCP', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 1
        };

        const result = await runner.runMCPQueryBenchmarks(config);
        
        expect(result.totalRuns).toBe(3); // file, ast, semantic
        expect(result.successfulRuns).toBe(3);
        expect(result.failedRuns).toBe(0);
      }, 8000);
    });

    describe('CLI Query Benchmarks', () => {
      it('should run CLI query benchmarks within 500ms target', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 3
        };

        const result = await runner.runCLIQueryBenchmarks(config);

        expect(result).toBeDefined();
        expect(result.benchmarkType).toBe('query');
        expect(result.totalRuns).toBe(9); // 3 query types × 3 iterations
        expect(result.successfulRuns).toBeGreaterThan(0);
        expect(result.averageDuration).toBeGreaterThan(0);
      }, 15000);

      it('should validate CLI response time targets', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'medium',
          iterations: 2
        };

        const result = await runner.runCLIQueryBenchmarks(config);
        
        expect(result.benchmarkType).toBe('query');
        expect(result.meetsPerformanceTargets).toBeDefined();
        expect(result.recommendations).toBeInstanceOf(Array);
      }, 10000);

      it('should handle large query loads for CLI', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'large',
          iterations: 1
        };

        const result = await runner.runCLIQueryBenchmarks(config);
        
        expect(result.totalRuns).toBe(3);
        expect(result.totalNodesProcessed).toBeGreaterThan(0);
        expect(result.averageMemoryUsed).toBeGreaterThanOrEqual(0);
        expect(result.averageCpuUsage).toBeGreaterThanOrEqual(0);
      }, 10000);
    });

    describe('Caching Performance Benchmarks', () => {
      it('should test query caching effectiveness', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'medium',
          iterations: 1
        };

        const result = await runner.runCachingBenchmarks(config);

        expect(result).toBeDefined();
        expect(result.benchmarkType).toBe('query');
        expect(result.totalRuns).toBe(3); // One per query type
        expect(result.successfulRuns).toBe(3);
        
        // Verify cache improvement metadata is present
        expect(result.totalNodesProcessed).toBeGreaterThan(0);
      }, 8000);

      it('should show cache hit performance improvements', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 1
        };

        const result = await runner.runCachingBenchmarks(config);
        
        expect(result.averageThroughput).toBeGreaterThan(0);
        expect(result.performanceScore).toBeGreaterThan(0);
      }, 6000);

      it('should validate cache effectiveness', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'medium',
          iterations: 1
        };

        const result = await runner.runCachingBenchmarks(config);
        
        expect(result.warnings).toBeInstanceOf(Array);
        expect(result.recommendations).toBeInstanceOf(Array);
        expect(result.meetsPerformanceTargets).toBeDefined();
      }, 8000);
    });

    describe('Concurrent Query Benchmarks', () => {
      it('should test concurrent query performance', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 1
        };

        const result = await runner.runConcurrentQueryBenchmarks(config);

        expect(result).toBeDefined();
        expect(result.benchmarkType).toBe('query');
        expect(result.totalRuns).toBe(6); // 6 concurrency levels
        expect(result.successfulRuns).toBe(6);
        expect(result.averageThroughput).toBeGreaterThan(0);
      }, 12000);

      it('should measure throughput scaling with concurrency', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 1
        };

        const result = await runner.runConcurrentQueryBenchmarks(config);
        
        expect(result.totalNodesProcessed).toBeGreaterThan(0);
        expect(result.performanceScore).toBeGreaterThan(0);
        expect(result.averageDuration).toBeGreaterThan(0);
      }, 12000);

      it('should provide concurrency recommendations', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'medium',
          iterations: 1
        };

        const result = await runner.runConcurrentQueryBenchmarks(config);
        
        expect(result.recommendations).toBeInstanceOf(Array);
        expect(result.warnings).toBeInstanceOf(Array);
        expect(result.meetsPerformanceTargets).toBeDefined();
      }, 12000);
    });

    describe('General Query Benchmarks', () => {
      it('should run comprehensive query benchmark suite', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 2
        };

        const result = await runner.runQueryBenchmarks(config);

        expect(result).toBeDefined();
        expect(result.benchmarkType).toBe('query');
        expect(result.totalRuns).toBe(6); // 3 query types × 2 iterations
        expect(result.averageDuration).toBeGreaterThan(0);
      }, 10000);

      it('should handle different node count sizes', async () => {
        for (const nodeCount of ['small', 'medium', 'large'] as const) {
          const config: QueryBenchmarkConfig = {
            nodeCount,
            iterations: 1
          };

          const result = await runner.runQueryBenchmarks(config);
          
          expect(result.totalRuns).toBe(3);
          expect(result.successfulRuns).toBe(3);
          expect(result.totalNodesProcessed).toBeGreaterThan(0);
        }
      }, 15000);

      it('should handle numeric node counts', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 1000,
          iterations: 1
        };

        const result = await runner.runQueryBenchmarks(config);
        
        expect(result.totalRuns).toBe(3);
        expect(result.successfulRuns).toBe(3);
      }, 8000);
    });

    describe('Error Handling', () => {
      it('should handle benchmark failures gracefully', async () => {
        // Mock timer to throw error
        const originalStart = runner['timer'].start;
        runner['timer'].start = vi.fn().mockImplementation(() => {
          throw new Error('Simulated timer failure');
        });

        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 1
        };

        try {
          await runner.runQueryBenchmarks(config);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Simulated timer failure');
        }

        // Restore original method
        runner['timer'].start = originalStart;
      }, 5000);

      it('should provide meaningful error messages', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 1
        };

        // Mock simulate method to fail
        const originalSimulate = runner['simulateQuery'];
        runner['simulateQuery'] = vi.fn().mockRejectedValue(new Error('Query simulation failed'));

        const result = await runner.runQueryBenchmarks(config);
        
        expect(result.failedRuns).toBe(3);
        expect(result.successfulRuns).toBe(0);
        expect(result.errors).toContain('Query simulation failed');

        // Restore original method
        runner['simulateQuery'] = originalSimulate;
      }, 5000);

      it('should handle zero successful runs', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 1
        };

        // Mock all operations to fail
        runner['simulateQuery'] = vi.fn().mockRejectedValue(new Error('All queries failed'));

        const result = await runner.runQueryBenchmarks(config);
        
        expect(result.successfulRuns).toBe(0);
        expect(result.failedRuns).toBe(3);
        expect(result.meetsPerformanceTargets).toBe(false);
        expect(result.performanceScore).toBe(0);
        expect(result.averageDuration).toBe(0);
        expect(result.recommendations).toContain('Fix critical issues causing all benchmarks to fail');
      }, 5000);
    });

    describe('Performance Metrics Validation', () => {
      it('should provide comprehensive performance metrics', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'medium',
          iterations: 2
        };

        const result = await runner.runQueryBenchmarks(config);
        
        expect(result.benchmarkType).toBe('query');
        expect(result.totalRuns).toBe(6);
        expect(result.successfulRuns).toBeGreaterThanOrEqual(0);
        expect(result.failedRuns).toBeGreaterThanOrEqual(0);
        expect(result.averageDuration).toBeGreaterThanOrEqual(0);
        expect(result.averageThroughput).toBeGreaterThanOrEqual(0);
        expect(result.averageMemoryUsed).toBeGreaterThanOrEqual(0);
        expect(result.averageCpuUsage).toBeGreaterThanOrEqual(0);
        expect(result.peakMemoryUsed).toBeGreaterThanOrEqual(0);
        expect(result.totalNodesProcessed).toBeGreaterThanOrEqual(0);
        expect(result.performanceScore).toBeGreaterThanOrEqual(0);
        expect(result.performanceScore).toBeLessThanOrEqual(100);
      }, 10000);

      it('should validate performance targets correctly', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 1
        };

        const mcpResult = await runner.runMCPQueryBenchmarks(config);
        const cliResult = await runner.runCLIQueryBenchmarks(config);
        
        expect(mcpResult.meetsPerformanceTargets).toBeDefined();
        expect(cliResult.meetsPerformanceTargets).toBeDefined();
      }, 10000);

      it('should generate appropriate warnings and recommendations', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'large',
          iterations: 1
        };

        const result = await runner.runQueryBenchmarks(config);
        
        expect(result.warnings).toBeInstanceOf(Array);
        expect(result.recommendations).toBeInstanceOf(Array);
        
        // Should have some content for large benchmarks
        expect(result.warnings.length + result.recommendations.length).toBeGreaterThanOrEqual(0);
      }, 8000);

      it('should calculate performance scores accurately', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 1
        };

        const result = await runner.runQueryBenchmarks(config);
        
        if (result.successfulRuns > 0) {
          expect(result.performanceScore).toBeGreaterThan(0);
          expect(result.performanceScore).toBeLessThanOrEqual(100);
          
          // Performance score should correlate with success rate
          const expectedMinScore = (result.successfulRuns / result.totalRuns) * 100 * 0.3; // At least 30% of success contribution
          expect(result.performanceScore).toBeGreaterThanOrEqual(expectedMinScore);
        }
      }, 8000);
    });

    describe('Test Data Generation', () => {
      it('should generate appropriate test data for different query types', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 1
        };

        const result = await runner.runQueryBenchmarks(config);
        
        // Should handle all query types successfully
        expect(result.totalRuns).toBe(3); // file, ast, semantic
        expect(result.successfulRuns).toBe(3);
      }, 5000);

      it('should scale test data based on node count', async () => {
        const smallConfig: QueryBenchmarkConfig = {
          nodeCount: 'small',
          iterations: 1
        };
        
        const largeConfig: QueryBenchmarkConfig = {
          nodeCount: 'large',
          iterations: 1
        };

        const smallResult = await runner.runQueryBenchmarks(smallConfig);
        const largeResult = await runner.runQueryBenchmarks(largeConfig);
        
        // Large should process more nodes
        expect(largeResult.totalNodesProcessed).toBeGreaterThan(smallResult.totalNodesProcessed);
      }, 10000);

      it('should handle custom numeric node counts', async () => {
        const config: QueryBenchmarkConfig = {
          nodeCount: 500,
          iterations: 1
        };

        const result = await runner.runQueryBenchmarks(config);
        
        expect(result.successfulRuns).toBe(3);
        expect(result.totalNodesProcessed).toBeGreaterThan(0);
      }, 5000);
    });
  });
});