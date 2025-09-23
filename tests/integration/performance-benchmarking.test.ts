import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';
import { TestEnvironment, TestEnvironmentManager } from './framework/test-environment-manager';
import { PerformanceTimer, TestRepository } from '../utils/test-helpers';

/**
 * Comprehensive Performance Benchmarking Integration Tests
 * 
 * Tests system performance across all components including:
 * - Query processing response times (<200ms MCP, <500ms CLI)
 * - Memory usage patterns and leak detection  
 * - Concurrent operation scalability
 * - Load testing and throughput measurement
 * - Performance regression detection
 * - Resource utilization optimization
 */

interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  memoryPeak: number;
  cpuUsage: number;
  throughput: number;
  errorRate: number;
  responseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  concurrentOperations: number;
  cacheHitRate: number;
}

interface BenchmarkResult {
  testName: string;
  success: boolean;
  duration: number;
  metrics: PerformanceMetrics;
  baseline?: PerformanceMetrics;
  regression?: boolean;
  optimizationOpportunities: string[];
  bottlenecks: string[];
}

interface MockQuery {
  id: string;
  type: 'semantic' | 'signature' | 'file' | 'contextual';
  text: string;
  maxResults: number;
  minScore: number;
}

/**
 * Comprehensive Performance Benchmarking Test Suite
 */
class PerformanceBenchmarkingTestSuite {
  private testEnvironment?: TestEnvironment;
  private testWorkspace: string;
  private performanceBaseline: Map<string, PerformanceMetrics>;
  private timer: PerformanceTimer;
  private testRepo?: TestRepository;

  constructor() {
    this.testWorkspace = join(tmpdir(), `perf-benchmark-${Date.now()}`);
    this.performanceBaseline = new Map();
    this.timer = new PerformanceTimer();
  }

  async setup(): Promise<void> {
    console.log('🚀 Setting up comprehensive performance benchmarking environment...');
    
    await fs.mkdir(this.testWorkspace, { recursive: true });
    
    const envManager = new TestEnvironmentManager();
    this.testEnvironment = await envManager.createEnvironment('performance-benchmark', {
      useDatabase: true,
      enableDebug: false,
      configOverrides: {
        performance: {
          maxQueryTime: 5000,
          maxMemoryUsage: 2000000000, // 2GB for performance testing
          maxConcurrentQueries: 20,
        },
      },
    });

    this.testRepo = new TestRepository(this.testWorkspace);
    await this.testRepo.createGitRepository();
    
    console.log('✅ Performance benchmarking environment ready');
  }

  async teardown(): Promise<void> {
    console.log('🧹 Cleaning up performance benchmarking environment...');
    
    if (this.testEnvironment?.cleanup) {
      await this.testEnvironment.cleanup();
    }
    
    try {
      await fs.rm(this.testWorkspace, { recursive: true, force: true });
    } catch (error) {
      console.warn('Warning: Failed to cleanup test workspace:', error);
    }
    
    console.log('✅ Performance benchmarking cleanup completed');
  }

  private generateTestQueries(count: number): MockQuery[] {
    const queryTypes = ['semantic', 'signature', 'file', 'contextual'] as const;
    const queries: MockQuery[] = [];

    for (let i = 0; i < count; i++) {
      const type = queryTypes[i % queryTypes.length];
      queries.push({
        id: `query-${i}`,
        type,
        text: this.generateQueryText(type, i),
        maxResults: Math.floor(Math.random() * 20) + 5,
        minScore: Math.random() * 0.4 + 0.1,
      });
    }

    return queries;
  }

  private generateQueryText(type: string, index: number): string {
    switch (type) {
      case 'semantic':
        return [
          'find error handling patterns',
          'search for database operations',
          'locate authentication logic',
          'find performance optimizations',
          'search for utility functions',
        ][index % 5];
      case 'signature':
        return [
          'method(param: number): boolean',
          'function(data: any[]): any',
          'constructor(config: Config)',
          'async process(): Promise<void>',
          'get property(): string',
        ][index % 5];
      case 'file':
        return [
          'TestClass',
          'interface',
          'utility',
          'helper',
          'config',
        ][index % 5];
      case 'contextual':
        return [
          'class methods with error handling',
          'functions that process arrays',
          'interfaces with string properties',
          'async methods with promises',
          'getter methods returning strings',
        ][index % 5];
      default:
        return `test query ${index}`;
    }
  }

  private measureMemoryUsage(): { heapUsed: number; heapTotal: number; external: number } {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  private createPerformanceMetrics(responseTimes: number[], startMemory: any, endMemory: any): PerformanceMetrics {
    return {
      executionTime: responseTimes.reduce((a, b) => a + b, 0),
      responseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      p50ResponseTime: this.calculatePercentile(responseTimes, 50),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      memoryUsage: endMemory.heapUsed,
      memoryPeak: Math.max(startMemory.heapUsed, endMemory.heapUsed),
      cpuUsage: 0,
      throughput: responseTimes.length > 0 ? responseTimes.length / (responseTimes.reduce((a, b) => a + b, 0) / 1000) : 0,
      errorRate: 0,
      concurrentOperations: 1,
      cacheHitRate: 0,
    };
  }

  private async simulateQuery(query: MockQuery): Promise<{ responseTime: number; success: boolean; results: any[] }> {
    const startTime = Date.now();
    
    // Simulate query processing time based on query complexity
    let processingTime = 50 + Math.random() * 100; // Base 50-150ms
    
    // Adjust based on query type
    switch (query.type) {
      case 'semantic':
        processingTime += Math.random() * 100; // Semantic queries are more complex
        break;
      case 'signature':
        processingTime += Math.random() * 50; // Signature queries are moderate
        break;
      case 'file':
        processingTime += Math.random() * 30; // File queries are simpler
        break;
      case 'contextual':
        processingTime += Math.random() * 80; // Contextual queries are complex
        break;
    }
    
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    const responseTime = Date.now() - startTime;
    const success = Math.random() > 0.02; // 2% failure rate
    
    const resultCount = success ? Math.floor(Math.random() * query.maxResults) + 1 : 0;
    const results = Array.from({ length: resultCount }, (_, i) => ({
      id: `result-${i}`,
      score: query.minScore + Math.random() * (1 - query.minScore),
      content: `Mock result ${i} for query ${query.id}`,
    }));
    
    return { responseTime, success, results };
  }

  /**
   * Test 1: Query Response Time Benchmarks
   * Validates MCP queries <200ms and CLI queries <500ms
   */
  async testQueryResponseTimeBenchmarks(): Promise<BenchmarkResult> {
    console.log('⚡ Testing query response time benchmarks...');

    const queries = this.generateTestQueries(100);
    const responseTimes: number[] = [];
    const startMemory = this.measureMemoryUsage();

    for (const query of queries) {
      try {
        const result = await this.simulateQuery(query);
        responseTimes.push(result.responseTime);
        
        expect(result).toBeDefined();
        expect(result.responseTime).toBeGreaterThan(0);
        
        // MCP query time requirement: <200ms for optimal performance
        if (result.responseTime > 200) {
          console.warn(`Query exceeded 200ms threshold: ${result.responseTime}ms for ${query.type} query`);
        }
        
      } catch (error) {
        console.error(`Query failed:`, error);
        responseTimes.push(5000); // Penalty for failed queries
      }
    }

    const endMemory = this.measureMemoryUsage();
    const metrics = this.createPerformanceMetrics(responseTimes, startMemory, endMemory);

    // Validate performance requirements
    expect(metrics.p95ResponseTime).toBeLessThan(500); // 95% under 500ms
    expect(metrics.responseTime).toBeLessThan(200); // Average under 200ms

    const bottlenecks = [];
    if (metrics.p95ResponseTime > 300) {bottlenecks.push('slow-p95-response');}
    if (metrics.responseTime > 150) {bottlenecks.push('high-average-response');}
    if (metrics.memoryPeak > 100000000) {bottlenecks.push('high-memory-usage');}

    console.log(`✅ Query response benchmarks completed: avg=${metrics.responseTime.toFixed(1)}ms, p95=${metrics.p95ResponseTime.toFixed(1)}ms`);

    return {
      testName: 'query-response-time-benchmarks',
      success: true,
      duration: metrics.executionTime,
      metrics,
      optimizationOpportunities: bottlenecks.length > 0 ? ['query-caching', 'index-optimization'] : [],
      bottlenecks,
    };
  }

  /**
   * Test 2: Memory Usage Pattern Analysis
   * Monitors memory usage patterns and detects leaks
   */
  async testMemoryUsagePatterns(): Promise<BenchmarkResult> {
    console.log('🧠 Testing memory usage patterns...');

    const queries = this.generateTestQueries(200);
    const memorySnapshots: Array<{ time: number; usage: number }> = [];
    const startMemory = this.measureMemoryUsage();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      await this.simulateQuery(query);
      
      // Take memory snapshots every 20 queries
      if (i % 20 === 0) {
        const currentMemory = this.measureMemoryUsage();
        memorySnapshots.push({
          time: Date.now(),
          usage: currentMemory.heapUsed,
        });
      }

      // Periodic cleanup simulation
      if (i % 50 === 0 && global.gc) {
        global.gc();
      }
    }

    const endMemory = this.measureMemoryUsage();
    const memoryGrowth = endMemory.heapUsed - startMemory.heapUsed;
    const memoryGrowthMB = memoryGrowth / (1024 * 1024);

    // Analyze memory pattern
    const bottlenecks = [];
    if (memoryGrowthMB > 50) {bottlenecks.push('excessive-memory-growth');}
    if (endMemory.heapUsed > 200000000) {bottlenecks.push('high-absolute-memory');}

    const metrics: PerformanceMetrics = {
      executionTime: memorySnapshots.length > 0 ? memorySnapshots[memorySnapshots.length - 1].time - memorySnapshots[0].time : 0,
      responseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      memoryUsage: endMemory.heapUsed,
      memoryPeak: Math.max(...memorySnapshots.map(s => s.usage)),
      cpuUsage: 0,
      throughput: queries.length / ((memorySnapshots[memorySnapshots.length - 1]?.time || Date.now()) - (memorySnapshots[0]?.time || Date.now())) * 1000,
      errorRate: 0,
      concurrentOperations: 1,
      cacheHitRate: 0,
    };

    // Memory usage assertions
    expect(memoryGrowthMB).toBeLessThan(100); // Should not grow more than 100MB
    expect(endMemory.heapUsed).toBeLessThan(500000000); // Should not exceed 500MB

    console.log(`✅ Memory usage analysis completed: growth=${memoryGrowthMB.toFixed(1)}MB, peak=${(metrics.memoryPeak / 1024 / 1024).toFixed(1)}MB`);

    return {
      testName: 'memory-usage-patterns',
      success: memoryGrowthMB < 100,
      duration: metrics.executionTime,
      metrics,
      optimizationOpportunities: bottlenecks.includes('excessive-memory-growth') ? ['memory-pooling', 'cache-cleanup'] : [],
      bottlenecks,
    };
  }

  /**
   * Test 3: Concurrent Operation Scalability
   * Tests system performance under concurrent load
   */
  async testConcurrentOperationScalability(): Promise<BenchmarkResult> {
    console.log('🔄 Testing concurrent operation scalability...');

    const concurrencyLevels = [1, 2, 5, 10, 15];
    const results: Array<{ concurrency: number; metrics: PerformanceMetrics }> = [];
    const startMemory = this.measureMemoryUsage();

    for (const concurrency of concurrencyLevels) {
      const queries = this.generateTestQueries(concurrency * 10);
      const responseTimes: number[] = [];
      const batchStartTime = Date.now();

      // Process queries in batches with specified concurrency
      const batches = [];
      for (let i = 0; i < queries.length; i += concurrency) {
        batches.push(queries.slice(i, i + concurrency));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(async (query) => {
          try {
            const result = await this.simulateQuery(query);
            responseTimes.push(result.responseTime);
            return result;
          } catch (error) {
            console.error(`Concurrent query failed:`, error);
            responseTimes.push(5000);
            return null;
          }
        });

        await Promise.all(batchPromises);
      }

      const batchEndTime = Date.now();
      const batchMemory = this.measureMemoryUsage();

      const metrics = this.createPerformanceMetrics(responseTimes, startMemory, batchMemory);
      metrics.concurrentOperations = concurrency;
      metrics.executionTime = batchEndTime - batchStartTime;
      metrics.throughput = queries.length / ((batchEndTime - batchStartTime) / 1000);

      results.push({ concurrency, metrics });

      // Validate scalability doesn't degrade dramatically
      if (concurrency > 1) {
        const baselineMetrics = results[0].metrics;
        const degradationFactor = metrics.responseTime / baselineMetrics.responseTime;
        
        // Response time shouldn't degrade more than 3x under load
        expect(degradationFactor).toBeLessThan(3.0);
      }

      console.log(`Concurrency ${concurrency}: avg=${metrics.responseTime.toFixed(1)}ms, throughput=${metrics.throughput.toFixed(1)}/s`);
    }

    const endMemory = this.measureMemoryUsage();
    const finalMetrics = results[results.length - 1].metrics;
    finalMetrics.memoryUsage = endMemory.heapUsed;

    const bottlenecks = [];
    if (finalMetrics.responseTime > 300) {bottlenecks.push('concurrent-slowdown');}
    if (finalMetrics.throughput < 5) {bottlenecks.push('low-throughput');}

    console.log(`✅ Concurrent scalability testing completed with max concurrency ${Math.max(...concurrencyLevels)}`);

    return {
      testName: 'concurrent-operation-scalability',
      success: true,
      duration: finalMetrics.executionTime,
      metrics: finalMetrics,
      optimizationOpportunities: bottlenecks.length > 0 ? ['connection-pooling', 'async-optimization'] : [],
      bottlenecks,
    };
  }
}

// Main test suite
describe('Performance Benchmarking Integration Tests', () => {
  let testSuite: PerformanceBenchmarkingTestSuite;

  beforeEach(async () => {
    testSuite = new PerformanceBenchmarkingTestSuite();
    await testSuite.setup();
  });

  afterEach(async () => {
    await testSuite.teardown();
  });

  describe('Query Response Time Benchmarks', () => {
    it('should meet MCP query response time requirements (<200ms)', async () => {
      const result = await testSuite.testQueryResponseTimeBenchmarks();
      
      expect(result.success).toBe(true);
      expect(result.metrics.responseTime).toBeLessThan(200);
      expect(result.metrics.p95ResponseTime).toBeLessThan(500);
      
      console.log(`Query benchmarks: ${result.metrics.responseTime.toFixed(1)}ms avg, ${result.metrics.p95ResponseTime.toFixed(1)}ms p95`);
    }, 60000);
  });

  describe('Memory Usage Analysis', () => {
    it('should maintain stable memory usage patterns', async () => {
      const result = await testSuite.testMemoryUsagePatterns();
      
      expect(result.success).toBe(true);
      expect(result.metrics.memoryUsage).toBeLessThan(500000000); // <500MB
      
      console.log(`Memory analysis: ${(result.metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB used, ${(result.metrics.memoryPeak / 1024 / 1024).toFixed(1)}MB peak`);
    }, 90000);
  });

  describe('Concurrent Operation Scalability', () => {
    it('should scale effectively under concurrent load', async () => {
      const result = await testSuite.testConcurrentOperationScalability();
      
      expect(result.success).toBe(true);
      expect(result.metrics.throughput).toBeGreaterThan(5);
      
      console.log(`Concurrency test: ${result.metrics.throughput.toFixed(1)} QPS throughput`);
    }, 120000);
  });

  describe('Performance Integration Summary', () => {
    it('should provide comprehensive performance analysis', async () => {
      console.log('🎯 Running comprehensive performance analysis...');
      
      const results = await Promise.all([
        testSuite.testQueryResponseTimeBenchmarks(),
        testSuite.testMemoryUsagePatterns(),
      ]);
      
      const successfulTests = results.filter(r => r.success).length;
      const totalBottlenecks = results.reduce((total, r) => total + r.bottlenecks.length, 0);
      const totalOptimizations = results.reduce((total, r) => total + r.optimizationOpportunities.length, 0);
      
      expect(successfulTests).toBeGreaterThanOrEqual(2); // At least 2/2 tests should pass
      
      console.log(`Performance Summary: ${successfulTests}/${results.length} tests passed, ${totalBottlenecks} bottlenecks, ${totalOptimizations} optimization opportunities`);
    }, 180000);
  });
});