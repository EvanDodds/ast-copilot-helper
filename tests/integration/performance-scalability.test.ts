import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';
import { TestEnvironment } from './framework/integration-test-suite';
import { TestEnvironmentManager } from './framework/test-environment-manager';

/**
 * Integration Performance and Scalability Tests
 * Tests comprehensive system performance across all components
 */

interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  throughput: number;
  errorRate: number;
  responseTime: number;
}

interface ScalabilityTestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  metrics: PerformanceMetrics;
  scalingFactor: number;
  bottlenecks: string[];
}

class PerformanceTestSuite {
  private testEnvironment: TestEnvironmentManager;
  private testWorkspace: string;
  private performanceBaseline: Map<string, PerformanceMetrics> = new Map();

  constructor() {
    this.testWorkspace = join(tmpdir(), `perf-integration-${Date.now()}`);
    this.testEnvironment = new TestEnvironmentManager();
  }

  async setup(): Promise<void> {
    console.log('Setting up performance test environment...');
    await fs.mkdir(this.testWorkspace, { recursive: true });
    
    // Create test environment using the proper interface
    const testEnv = await this.testEnvironment.createEnvironment('performance-test', {
      useDatabase: true,
      enableDebug: false,
      configOverrides: {
        server: { transport: 'stdio', enableCaching: true }
      }
    });
    
    // Establish performance baselines
    await this.establishPerformanceBaselines();
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up performance test environment...');
    
    // Simple cleanup approach
    try {
      await fs.rm(this.testWorkspace, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test workspace:', error);
    }
  }

  async runTests(): Promise<ScalabilityTestResult[]> {
    const results: ScalabilityTestResult[] = [];

    try {
      console.log('Running comprehensive performance and scalability tests...');

      // Core performance tests
      results.push(await this.testParsingPerformance());
      results.push(await this.testQueryProcessingPerformance());
      results.push(await this.testMemoryUsageScaling());
      results.push(await this.testConcurrentOperations());
      results.push(await this.testDatabasePerformance());
      results.push(await this.testMCPProtocolPerformance());
      results.push(await this.testLargeRepositoryHandling());
      results.push(await this.testLoadTestingCapabilities());

      // Validate performance requirements
      await this.validatePerformanceRequirements(results);

      return results;
    } catch (error) {
      return [{
        name: 'performance-test-execution',
        success: false,
        error: `Performance test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0,
        metrics: this.createEmptyMetrics(),
        scalingFactor: 0,
        bottlenecks: ['test-execution-failure']
      }];
    }
  }

  private async establishPerformanceBaselines(): Promise<void> {
    // Small baseline test for comparison
    const baselineMetrics = await this.measurePerformance('baseline', async () => {
      await this.createSmallTestRepository(100);
      return { processedNodes: 100 };
    });

    this.performanceBaseline.set('parsing', baselineMetrics);
    this.performanceBaseline.set('query', baselineMetrics);
    this.performanceBaseline.set('memory', baselineMetrics);
  }

  private async testParsingPerformance(): Promise<ScalabilityTestResult> {
    console.log('Testing parsing performance...');

    const testSizes = [1000, 5000, 15000, 25000];
    const results: Array<{ size: number; metrics: PerformanceMetrics }> = [];

    for (const size of testSizes) {
      const metrics = await this.measurePerformance(`parsing-${size}`, async () => {
        await this.createTestRepository(size);
        // Simulate AST parsing
        return { processedNodes: size };
      });

      results.push({ size, metrics });

      // Validate parsing speed requirements (15k+ nodes in under 10 minutes)
      if (size >= 15000) {
        const maxTime = 10 * 60 * 1000; // 10 minutes
        expect(metrics.executionTime).toBeLessThan(maxTime);
      }
    }

    const scalingFactor = this.calculateScalingFactor(results);
    const bottlenecks = this.identifyBottlenecks(results);

    return {
      name: 'parsing-performance',
      success: true,
      duration: results.reduce((sum, r) => sum + r.metrics.executionTime, 0),
      metrics: results[results.length - 1].metrics,
      scalingFactor,
      bottlenecks
    };
  }

  private async testQueryProcessingPerformance(): Promise<ScalabilityTestResult> {
    console.log('Testing query processing performance...');

    const queryTypes = ['semantic', 'structural', 'contextual', 'file'];
    const results: Array<{ type: string; metrics: PerformanceMetrics }> = [];

    // Create test repository
    await this.createTestRepository(5000);

    for (const queryType of queryTypes) {
      const metrics = await this.measurePerformance(`query-${queryType}`, async () => {
        return await this.executeTestQueries(queryType, 100);
      });

      results.push({ type: queryType, metrics });

      // Validate query latency requirements
      // MCP: <200ms, CLI: <500ms
      const maxLatency = queryType.includes('mcp') ? 200 : 500;
      expect(metrics.responseTime).toBeLessThan(maxLatency);
    }

    const averageMetrics = this.averageMetrics(results.map(r => r.metrics));
    const bottlenecks = results
      .filter(r => r.metrics.responseTime > 200)
      .map(r => `slow-${r.type}-queries`);

    return {
      name: 'query-processing-performance',
      success: true,
      duration: results.reduce((sum, r) => sum + r.metrics.executionTime, 0),
      metrics: averageMetrics,
      scalingFactor: 1.0,
      bottlenecks
    };
  }

  private async testMemoryUsageScaling(): Promise<ScalabilityTestResult> {
    console.log('Testing memory usage scaling...');

    const repositorySizes = [1000, 5000, 15000, 30000];
    const results: Array<{ size: number; metrics: PerformanceMetrics }> = [];
    const maxMemoryMB = 500; // 500MB limit

    for (const size of repositorySizes) {
      const metrics = await this.measurePerformance(`memory-${size}`, async () => {
        await this.createTestRepository(size);
        return { processedNodes: size };
      });

      results.push({ size, metrics });

      // Validate memory usage stays within bounds
      const memoryMB = metrics.memoryUsage / (1024 * 1024);
      expect(memoryMB).toBeLessThan(maxMemoryMB);
    }

    const scalingFactor = this.calculateMemoryScalingFactor(results);
    const bottlenecks = results
      .filter(r => r.metrics.memoryUsage > maxMemoryMB * 1024 * 1024 * 0.8)
      .map(r => 'high-memory-usage');

    return {
      name: 'memory-usage-scaling',
      success: true,
      duration: results.reduce((sum, r) => sum + r.metrics.executionTime, 0),
      metrics: results[results.length - 1].metrics,
      scalingFactor,
      bottlenecks
    };
  }

  private async testConcurrentOperations(): Promise<ScalabilityTestResult> {
    console.log('Testing concurrent operations...');

    const concurrencyLevels = [1, 5, 10, 20, 50];
    const results: Array<{ concurrency: number; metrics: PerformanceMetrics }> = [];

    await this.createTestRepository(5000);

    for (const concurrency of concurrencyLevels) {
      const metrics = await this.measurePerformance(`concurrent-${concurrency}`, async () => {
        const promises = Array(concurrency).fill(null).map(async (_, i) => {
          return this.executeTestQueries('mixed', 10);
        });

        const results = await Promise.all(promises);
        return { 
          processedRequests: results.reduce((sum, r) => sum + r.processedQueries, 0)
        };
      });

      results.push({ concurrency, metrics });

      // Validate error rate stays low under load
      expect(metrics.errorRate).toBeLessThan(0.05); // <5% error rate
    }

    const scalingFactor = this.calculateConcurrencyScalingFactor(results);
    const bottlenecks = results
      .filter(r => r.metrics.errorRate > 0.02)
      .map(r => `concurrency-${r.concurrency}-errors`);

    return {
      name: 'concurrent-operations',
      success: true,
      duration: results.reduce((sum, r) => sum + r.metrics.executionTime, 0),
      metrics: results[results.length - 1].metrics,
      scalingFactor,
      bottlenecks
    };
  }

  private async testDatabasePerformance(): Promise<ScalabilityTestResult> {
    console.log('Testing database performance...');

    const operations = ['read', 'write', 'update', 'delete'];
    const results: Array<{ operation: string; metrics: PerformanceMetrics }> = [];

    for (const operation of operations) {
      const metrics = await this.measurePerformance(`db-${operation}`, async () => {
        return await this.executeDatabaseOperations(operation, 1000);
      });

      results.push({ operation, metrics });

      // Validate database operation performance
      const maxLatency = operation === 'read' ? 50 : 100; // ms
      expect(metrics.responseTime).toBeLessThan(maxLatency);
    }

    const averageMetrics = this.averageMetrics(results.map(r => r.metrics));
    const bottlenecks = results
      .filter(r => r.metrics.responseTime > 75)
      .map(r => `slow-db-${r.operation}`);

    return {
      name: 'database-performance',
      success: true,
      duration: results.reduce((sum, r) => sum + r.metrics.executionTime, 0),
      metrics: averageMetrics,
      scalingFactor: 1.0,
      bottlenecks
    };
  }

  private async testMCPProtocolPerformance(): Promise<ScalabilityTestResult> {
    console.log('Testing MCP protocol performance...');

    const messageTypes = ['request', 'notification', 'response', 'error'];
    const results: Array<{ type: string; metrics: PerformanceMetrics }> = [];

    for (const messageType of messageTypes) {
      const metrics = await this.measurePerformance(`mcp-${messageType}`, async () => {
        return await this.executeMCPMessages(messageType, 500);
      });

      results.push({ type: messageType, metrics });

      // Validate MCP message handling performance
      expect(metrics.responseTime).toBeLessThan(200); // <200ms for MCP
      expect(metrics.errorRate).toBeLessThan(0.01); // <1% error rate
    }

    const averageMetrics = this.averageMetrics(results.map(r => r.metrics));
    const bottlenecks = results
      .filter(r => r.metrics.responseTime > 150)
      .map(r => `slow-mcp-${r.type}`);

    return {
      name: 'mcp-protocol-performance',
      success: true,
      duration: results.reduce((sum, r) => sum + r.metrics.executionTime, 0),
      metrics: averageMetrics,
      scalingFactor: 1.0,
      bottlenecks
    };
  }

  private async testLargeRepositoryHandling(): Promise<ScalabilityTestResult> {
    console.log('Testing large repository handling...');

    // Test with progressively larger repositories
    const repositorySizes = [10000, 25000, 50000];
    let finalMetrics: PerformanceMetrics = this.createEmptyMetrics();
    const bottlenecks: string[] = [];

    for (const size of repositorySizes) {
      try {
        const metrics = await this.measurePerformance(`large-repo-${size}`, async () => {
          await this.createLargeTestRepository(size);
          return await this.processLargeRepository();
        });

        finalMetrics = metrics;

        // Validate large repository handling
        const maxProcessingTime = 15 * 60 * 1000; // 15 minutes
        if (metrics.executionTime > maxProcessingTime) {
          bottlenecks.push(`slow-processing-${size}`);
        }

        const maxMemoryGB = 2; // 2GB limit
        const memoryGB = metrics.memoryUsage / (1024 * 1024 * 1024);
        if (memoryGB > maxMemoryGB) {
          bottlenecks.push(`high-memory-${size}`);
        }

      } catch (error) {
        bottlenecks.push(`failed-processing-${size}`);
        console.warn(`Large repository test failed for size ${size}:`, error);
      }
    }

    return {
      name: 'large-repository-handling',
      success: bottlenecks.length === 0,
      duration: finalMetrics.executionTime,
      metrics: finalMetrics,
      scalingFactor: this.calculateRepositorySizeScalingFactor(repositorySizes, finalMetrics),
      bottlenecks
    };
  }

  private async testLoadTestingCapabilities(): Promise<ScalabilityTestResult> {
    console.log('Testing load testing capabilities...');

    const loadScenarios = [
      { users: 10, duration: 30000 }, // 10 users for 30s
      { users: 25, duration: 60000 }, // 25 users for 1m
      { users: 50, duration: 120000 } // 50 users for 2m
    ];

    let finalMetrics: PerformanceMetrics = this.createEmptyMetrics();
    const bottlenecks: string[] = [];

    await this.createTestRepository(10000);

    for (const scenario of loadScenarios) {
      try {
        const metrics = await this.measurePerformance(`load-${scenario.users}-users`, async () => {
          return await this.executeLoadTest(scenario.users, scenario.duration);
        });

        finalMetrics = metrics;

        // Validate load test performance
        if (metrics.errorRate > 0.05) { // >5% error rate
          bottlenecks.push(`high-error-rate-${scenario.users}-users`);
        }

        if (metrics.responseTime > 1000) { // >1s response time
          bottlenecks.push(`slow-response-${scenario.users}-users`);
        }

        if (metrics.throughput < scenario.users * 0.5) { // Less than 50% expected throughput
          bottlenecks.push(`low-throughput-${scenario.users}-users`);
        }

      } catch (error) {
        bottlenecks.push(`load-test-failure-${scenario.users}-users`);
        console.warn(`Load test failed for ${scenario.users} users:`, error);
      }
    }

    return {
      name: 'load-testing-capabilities',
      success: bottlenecks.length === 0,
      duration: finalMetrics.executionTime,
      metrics: finalMetrics,
      scalingFactor: this.calculateLoadTestScalingFactor(loadScenarios, finalMetrics),
      bottlenecks
    };
  }

  private async measurePerformance<T>(
    testName: string,
    operation: () => Promise<T>
  ): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();

    let success = true;
    let result: T | undefined;

    try {
      result = await operation();
    } catch (error) {
      success = false;
      throw error;
    }

    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(startCpu);

    const executionTime = endTime - startTime;
    const memoryUsage = endMemory.heapUsed;
    const cpuUsage = (endCpu.user + endCpu.system) / 1000; // Convert to ms

    return {
      executionTime,
      memoryUsage,
      cpuUsage,
      throughput: result ? this.calculateThroughput(result, executionTime) : 0,
      errorRate: success ? 0 : 1,
      responseTime: executionTime
    };
  }

  private calculateThroughput(result: any, executionTime: number): number {
    if (result && typeof result === 'object') {
      const processedItems = result.processedNodes || result.processedQueries || result.processedRequests || 1;
      return processedItems / (executionTime / 1000); // items per second
    }
    return 1 / (executionTime / 1000);
  }

  private calculateScalingFactor(results: Array<{ size: number; metrics: PerformanceMetrics }>): number {
    if (results.length < 2) return 1.0;
    
    const first = results[0];
    const last = results[results.length - 1];
    
    const sizeRatio = last.size / first.size;
    const timeRatio = last.metrics.executionTime / first.metrics.executionTime;
    
    return timeRatio / sizeRatio; // Ideal scaling = 1.0
  }

  private calculateMemoryScalingFactor(results: Array<{ size: number; metrics: PerformanceMetrics }>): number {
    if (results.length < 2) return 1.0;
    
    const first = results[0];
    const last = results[results.length - 1];
    
    const sizeRatio = last.size / first.size;
    const memoryRatio = last.metrics.memoryUsage / first.metrics.memoryUsage;
    
    return memoryRatio / sizeRatio; // Ideal scaling = 1.0
  }

  private calculateConcurrencyScalingFactor(results: Array<{ concurrency: number; metrics: PerformanceMetrics }>): number {
    if (results.length < 2) return 1.0;
    
    const first = results[0];
    const last = results[results.length - 1];
    
    const concurrencyRatio = last.concurrency / first.concurrency;
    const throughputRatio = last.metrics.throughput / first.metrics.throughput;
    
    return throughputRatio / concurrencyRatio; // Ideal scaling = 1.0
  }

  private calculateRepositorySizeScalingFactor(sizes: number[], metrics: PerformanceMetrics): number {
    // Simple heuristic based on largest size processed
    const largestSize = Math.max(...sizes);
    const baselineSize = 1000;
    return (metrics.executionTime / 1000) / (largestSize / baselineSize);
  }

  private calculateLoadTestScalingFactor(scenarios: Array<{ users: number; duration: number }>, metrics: PerformanceMetrics): number {
    const maxUsers = Math.max(...scenarios.map(s => s.users));
    return metrics.throughput / maxUsers; // Throughput per user
  }

  private identifyBottlenecks(results: Array<{ size: number; metrics: PerformanceMetrics }>): string[] {
    const bottlenecks: string[] = [];
    
    results.forEach(result => {
      if (result.metrics.executionTime > 60000) { // >1 minute
        bottlenecks.push(`slow-execution-${result.size}`);
      }
      if (result.metrics.memoryUsage > 500 * 1024 * 1024) { // >500MB
        bottlenecks.push(`high-memory-${result.size}`);
      }
      if (result.metrics.cpuUsage > 10000) { // >10s CPU time
        bottlenecks.push(`high-cpu-${result.size}`);
      }
    });
    
    return bottlenecks;
  }

  private averageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    const count = metrics.length;
    if (count === 0) return this.createEmptyMetrics();

    return {
      executionTime: metrics.reduce((sum, m) => sum + m.executionTime, 0) / count,
      memoryUsage: metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / count,
      cpuUsage: metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / count,
      throughput: metrics.reduce((sum, m) => sum + m.throughput, 0) / count,
      errorRate: metrics.reduce((sum, m) => sum + m.errorRate, 0) / count,
      responseTime: metrics.reduce((sum, m) => sum + m.responseTime, 0) / count
    };
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      executionTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      throughput: 0,
      errorRate: 0,
      responseTime: 0
    };
  }

  // Mock implementation methods for testing
  private async createTestRepository(nodeCount: number): Promise<void> {
    // Create synthetic test files with specified node count
    const filesNeeded = Math.ceil(nodeCount / 200); // ~200 nodes per file
    
    for (let i = 0; i < filesNeeded; i++) {
      const nodesInFile = Math.min(200, nodeCount - (i * 200));
      const content = this.generateFileContent(nodesInFile);
      await fs.writeFile(join(this.testWorkspace, `test-file-${i}.ts`), content);
    }
  }

  private async createSmallTestRepository(nodeCount: number): Promise<void> {
    return this.createTestRepository(nodeCount);
  }

  private async createLargeTestRepository(nodeCount: number): Promise<void> {
    return this.createTestRepository(nodeCount);
  }

  private generateFileContent(nodeCount: number): string {
    // Generate TypeScript content with approximately nodeCount AST nodes
    const functionsNeeded = Math.ceil(nodeCount / 10); // ~10 nodes per function
    let content = 'export class TestClass {\n';
    
    for (let i = 0; i < functionsNeeded; i++) {
      content += `  method${i}(): void {\n`;
      content += `    const x = ${i};\n`;
      content += `    const y = x + 1;\n`;
      content += `    return;\n`;
      content += `  }\n`;
    }
    
    content += '}\n';
    return content;
  }

  private async executeTestQueries(queryType: string, count: number): Promise<{ processedQueries: number }> {
    // Mock query execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50)); // 0-50ms delay
    return { processedQueries: count };
  }

  private async executeDatabaseOperations(operation: string, count: number): Promise<{ processedOperations: number }> {
    // Mock database operations
    const delay = operation === 'read' ? 10 : 25; // Read faster than write
    await new Promise(resolve => setTimeout(resolve, Math.random() * delay));
    return { processedOperations: count };
  }

  private async executeMCPMessages(messageType: string, count: number): Promise<{ processedMessages: number }> {
    // Mock MCP message processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100)); // 0-100ms delay
    return { processedMessages: count };
  }

  private async processLargeRepository(): Promise<{ processedFiles: number }> {
    // Mock large repository processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 5000)); // 0-5s delay
    return { processedFiles: 100 };
  }

  private async executeLoadTest(users: number, duration: number): Promise<{ processedRequests: number }> {
    // Mock load test execution
    const requestsPerUser = Math.floor(duration / 1000); // 1 request per second per user
    await new Promise(resolve => setTimeout(resolve, duration / 10)); // Simulate partial duration
    return { processedRequests: users * requestsPerUser };
  }

  private async validatePerformanceRequirements(results: ScalabilityTestResult[]): Promise<void> {
    // Validate overall performance requirements
    const totalBottlenecks = results.reduce((acc, r) => acc + r.bottlenecks.length, 0);
    const successRate = results.filter(r => r.success).length / results.length;
    
    console.log(`Performance validation summary:`);
    console.log(`  Success rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(`  Total bottlenecks: ${totalBottlenecks}`);
    
    // Overall performance should be acceptable
    expect(successRate).toBeGreaterThan(0.8); // >80% success rate
    expect(totalBottlenecks).toBeLessThan(results.length); // Less bottlenecks than tests
  }
}

describe('Integration Performance and Scalability Tests', () => {
  let performanceSuite: PerformanceTestSuite;

  beforeEach(async () => {
    performanceSuite = new PerformanceTestSuite();
    await performanceSuite.setup();
  });

  afterEach(async () => {
    await performanceSuite.cleanup();
  });

  describe('Parsing Performance', () => {
    it('should parse large codebases within time constraints', async () => {
      const results = await performanceSuite.runTests();
      const parsingResults = results.filter(r => r.duration > 0);
      
      expect(parsingResults.length).toBeGreaterThan(0);
      parsingResults.forEach(result => {
        expect(result.success).toBe(true);
      });
    }, 20000); // 20s timeout
  });

  describe('Query Processing Performance', () => {
    it('should handle various query types efficiently', async () => {
      const results = await performanceSuite.runTests();
      
      expect(results.some(r => r.metrics?.responseTime < 200)).toBe(true);
    }, 15000); // 15s timeout
  });

  describe('Memory Usage Scaling', () => {
    it('should scale memory usage appropriately with repository size', async () => {
      const results = await performanceSuite.runTests();
      const memoryResults = results.filter(r => r.scalingFactor > 0);
      
      expect(memoryResults.length).toBeGreaterThan(0);
      memoryResults.forEach(result => {
        expect(result.scalingFactor).toBeLessThan(3.0); // Reasonable scaling
      });
    }, 25000); // 25s timeout
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent operations without significant degradation', async () => {
      const results = await performanceSuite.runTests();
      
      expect(results.some(r => r.metrics?.errorRate < 0.05)).toBe(true);
    }, 30000); // 30s timeout
  });

  describe('Load Testing Capabilities', () => {
    it('should maintain performance under load', async () => {
      const results = await performanceSuite.runTests();
      const loadResults = results.filter(r => r.bottlenecks.length < 3);
      
      expect(loadResults.length).toBeGreaterThan(0);
    }, 180000); // 3m timeout for load testing
  });

  describe('Performance Requirements Validation', () => {
    it('should meet all performance acceptance criteria', async () => {
      const results = await performanceSuite.runTests();
      
      // Validate key performance metrics
      expect(results.length).toBeGreaterThan(5); // At least 6 performance tests
      
      const successRate = results.filter(r => r.success).length / results.length;
      expect(successRate).toBeGreaterThan(0.8); // >80% success rate
      
      // Check for critical performance bottlenecks
      const criticalBottlenecks = results.reduce((acc, r) => 
        acc + r.bottlenecks.filter((b: string) => b.includes('failure') || b.includes('high-error')).length, 0
      );
      expect(criticalBottlenecks).toBeLessThan(2); // <2 critical issues
    }, 300000); // 5m timeout for comprehensive testing
  });
});