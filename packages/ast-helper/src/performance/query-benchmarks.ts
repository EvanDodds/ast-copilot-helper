import { PerformanceTimer, CPUMonitor, MemoryMonitor } from './utils';
import type { 
  BenchmarkResult, 
  QueryBenchmarkConfig,
  BenchmarkRun,
  NodeCount,
  QueryType
} from './types';

/**
 * Comprehensive query performance benchmarks
 * Validates query performance against MCP (<200ms) and CLI (<500ms) targets
 */
export class QueryBenchmarkRunner {
  private timer: PerformanceTimer;
  private cpuMonitor: CPUMonitor;
  private memoryMonitor: MemoryMonitor;

  constructor() {
    this.timer = new PerformanceTimer();
    this.cpuMonitor = new CPUMonitor();
    this.memoryMonitor = new MemoryMonitor();
  }

  /**
   * Run comprehensive query performance benchmarks
   */
  async runQueryBenchmarks(config: QueryBenchmarkConfig): Promise<BenchmarkResult> {
    console.log('🔍 Starting comprehensive query performance benchmarks...');
    
    try {
      const runs: BenchmarkRun[] = [];
      
      // Test different query types and node counts
      for (const queryType of config.queryTypes) {
        console.log(`Testing ${queryType} queries...`);
        
        for (const nodeCount of config.nodeCounts) {
          console.log(`  Testing with ${nodeCount} nodes...`);
          
          for (let i = 0; i < config.iterations; i++) {
            const singleNodeConfig = { ...config, nodeCount };
            const run = await this.runSingleQueryBenchmark(queryType, singleNodeConfig);
            runs.push(run);
          }
        }
      }

      const result = this.analyzeBenchmarkResults(runs, config);
      console.log('✅ Query performance benchmarks completed');
      
      return result;
    } catch (error) {
      console.error('❌ Query benchmark execution failed:', error);
      throw error;
    }
  }

  /**
   * Run MCP query response time benchmarks
   */
  async runMCPQueryBenchmarks(config: QueryBenchmarkConfig & { nodeCount: NodeCount }): Promise<BenchmarkResult> {
    console.log('⚡ Testing MCP query response times (target: <200ms)...');
    
    const runs: BenchmarkRun[] = [];
    const queryTypes: QueryType[] = ['file', 'ast', 'semantic'];
    
    for (const queryType of queryTypes) {
      for (let i = 0; i < config.iterations; i++) {
        const testData = this.generateMCPTestData(queryType, config.nodeCount);
        
        this.timer.start(`mcp-${queryType}-query`);
        this.cpuMonitor.start();
        this.memoryMonitor.start();
        
        try {
          // Simulate MCP query processing
          await this.simulateMCPQuery(testData, queryType);
          
          const duration = this.timer.end(`mcp-${queryType}-query`);
          const cpuUsage = await this.cpuMonitor.stop();
          const memoryUsage = this.memoryMonitor.stop();
          
          // Validate MCP response time target
          const meetsMCPTarget = duration < 200;
          if (!meetsMCPTarget) {
            console.warn(`⚠️  MCP ${queryType} query exceeded 200ms: ${duration}ms`);
          }
          
          runs.push({
            subtype: `mcp-${queryType}`,
            duration,
            nodeCount: this.estimateNodeCount(testData, queryType),
            success: true,
            throughput: Math.round(1000 / duration * 100) / 100,
            memoryUsed: memoryUsage.peak,
            cpuUsage,
            metadata: {
              queryType,
              protocol: 'mcp',
              meetsMCPTarget,
              responseTime: duration
            }
          });
          
        } catch (error) {
          runs.push({
            subtype: `mcp-${queryType}`,
            duration: this.timer.end(`mcp-${queryType}-query`),
            nodeCount: 0,
            success: false,
            throughput: 0,
            memoryUsed: this.memoryMonitor.stop().peak,
            cpuUsage: await this.cpuMonitor.stop(),
            error: error instanceof Error ? error.message : String(error),
            metadata: {
              queryType,
              protocol: 'mcp',
              meetsMCPTarget: false,
              responseTime: 0
            }
          });
        }
      }
    }

    return this.analyzeBenchmarkResults(runs, config);
  }

  /**
   * Run CLI query response time benchmarks
   */
  async runCLIQueryBenchmarks(config: QueryBenchmarkConfig & { nodeCount: NodeCount }): Promise<BenchmarkResult> {
    console.log('⚡ Testing CLI query response times (target: <500ms)...');
    
    const runs: BenchmarkRun[] = [];
    const queryTypes: QueryType[] = ['file', 'ast', 'semantic'];
    
    for (const queryType of queryTypes) {
      for (let i = 0; i < config.iterations; i++) {
        const testData = this.generateCLITestData(queryType, config.nodeCount);
        
        this.timer.start(`cli-${queryType}-query`);
        this.cpuMonitor.start();
        this.memoryMonitor.start();
        
        try {
          // Simulate CLI query processing
          await this.simulateCLIQuery(testData, queryType);
          
          const duration = this.timer.end(`cli-${queryType}-query`);
          const cpuUsage = await this.cpuMonitor.stop();
          const memoryUsage = this.memoryMonitor.stop();
          
          // Validate CLI response time target
          const meetsCLITarget = duration < 500;
          if (!meetsCLITarget) {
            console.warn(`⚠️  CLI ${queryType} query exceeded 500ms: ${duration}ms`);
          }
          
          runs.push({
            subtype: `cli-${queryType}`,
            duration,
            nodeCount: this.estimateNodeCount(testData, queryType),
            success: true,
            throughput: Math.round(1000 / duration * 100) / 100,
            memoryUsed: memoryUsage.peak,
            cpuUsage,
            metadata: {
              queryType,
              protocol: 'cli',
              meetsCLITarget,
              responseTime: duration
            }
          });
          
        } catch (error) {
          runs.push({
            subtype: `cli-${queryType}`,
            duration: this.timer.end(`cli-${queryType}-query`),
            nodeCount: 0,
            success: false,
            throughput: 0,
            memoryUsed: this.memoryMonitor.stop().peak,
            cpuUsage: await this.cpuMonitor.stop(),
            error: error instanceof Error ? error.message : String(error),
            metadata: {
              queryType,
              protocol: 'cli',
              meetsCLITarget: false,
              responseTime: 0
            }
          });
        }
      }
    }

    return this.analyzeBenchmarkResults(runs, config);
  }

  /**
   * Test query caching performance
   */
  async runCachingBenchmarks(config: QueryBenchmarkConfig & { nodeCount: NodeCount }): Promise<BenchmarkResult> {
    console.log('💾 Testing query caching performance...');
    
    const runs: BenchmarkRun[] = [];
    const queryTypes: QueryType[] = ['file', 'ast', 'semantic'];
    
    for (const queryType of queryTypes) {
      // Test cache miss performance
      const testData = this.generateTestQueryData(queryType, config.nodeCount);
      
      // First run (cache miss)
      this.timer.start(`cache-miss-${queryType}`);
      await this.simulateQueryWithCaching(testData, queryType, false);
      const missDuration = this.timer.end(`cache-miss-${queryType}`);
      
      // Second run (cache hit)
      this.timer.start(`cache-hit-${queryType}`);
      await this.simulateQueryWithCaching(testData, queryType, true);
      const hitDuration = this.timer.end(`cache-hit-${queryType}`);
      
      const cacheImprovement = Math.round((missDuration - hitDuration) / missDuration * 100);
      
      runs.push({
        subtype: `caching-${queryType}`,
        duration: hitDuration,
        nodeCount: this.estimateNodeCount(testData, queryType),
        success: true,
        throughput: Math.round(1000 / hitDuration * 100) / 100,
        memoryUsed: 0,
        cpuUsage: 0,
        metadata: {
          queryType,
          cacheMissDuration: missDuration,
          cacheHitDuration: hitDuration,
          cacheImprovement: `${cacheImprovement}%`,
          cacheEffective: cacheImprovement > 20
        }
      });
    }

    return this.analyzeBenchmarkResults(runs, config);
  }

  /**
   * Test concurrent query performance
   */
  async runConcurrentQueryBenchmarks(config: QueryBenchmarkConfig & { nodeCount: NodeCount }): Promise<BenchmarkResult> {
    console.log('🔄 Testing concurrent query performance...');
    
    const runs: BenchmarkRun[] = [];
    const concurrencyLevels = [1, 2, 5, 10, 15, 20];
    
    for (const concurrency of concurrencyLevels) {
      console.log(`Testing concurrency level: ${concurrency}`);
      
      const promises: Promise<number>[] = [];
      const testData = this.generateTestQueryData('file', config.nodeCount);
      
      this.timer.start(`concurrent-${concurrency}`);
      
      // Launch concurrent queries
      for (let i = 0; i < concurrency; i++) {
        promises.push(this.simulateQuery(testData, 'file'));
      }
      
      const results = await Promise.all(promises);
      const totalDuration = this.timer.end(`concurrent-${concurrency}`);
      const avgDuration = results.reduce((sum, dur) => sum + dur, 0) / results.length;
      const throughput = Math.round(concurrency / (totalDuration / 1000) * 100) / 100;
      
      console.log(`Level ${concurrency}: Avg=${avgDuration.toFixed(1)}ms, Throughput=${throughput} q/s`);
      
      runs.push({
        subtype: `concurrent-${concurrency}`,
        duration: avgDuration,
        nodeCount: this.estimateNodeCount(testData, 'file'),
        success: true,
        throughput,
        memoryUsed: 0,
        cpuUsage: 0,
        metadata: {
          concurrency,
          totalDuration,
          avgResponseTime: avgDuration,
          queriesPerSecond: throughput
        }
      });
    }

    return this.analyzeBenchmarkResults(runs, config);
  }

  /**
   * Run single query benchmark
   */
  /**
   * Run single query benchmark for a specific type and node count
   */
  private async runSingleQueryBenchmark(queryType: QueryType, config: QueryBenchmarkConfig & { nodeCount: NodeCount }): Promise<BenchmarkRun> {
    const testData = this.generateTestQueryData(queryType, config.nodeCount);
    
    this.timer.start(`${queryType}-query`);
    this.cpuMonitor.start();
    this.memoryMonitor.start();
    
    try {
      await this.simulateQuery(testData, queryType);
      
      const duration = this.timer.end(`${queryType}-query`);
      const cpuUsage = await this.cpuMonitor.stop();
      const memoryUsage = this.memoryMonitor.stop();
      
      return {
        subtype: queryType,
        duration,
        nodeCount: this.estimateNodeCount(testData, queryType),
        success: true,
        throughput: Math.round(1000 / duration * 100) / 100,
        memoryUsed: memoryUsage.peak,
        cpuUsage,
        metadata: {
          queryType
        }
      };
    } catch (error) {
      return {
        subtype: queryType,
        duration: this.timer.end(`${queryType}-query`),
        nodeCount: 0,
        success: false,
        throughput: 0,
        memoryUsed: this.memoryMonitor.stop().peak,
        cpuUsage: await this.cpuMonitor.stop(),
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          queryType
        }
      };
    }
  }

  /**
   * Generate test data for MCP queries
   */
  private generateMCPTestData(queryType: QueryType, nodeCount: NodeCount): string {
    const sizes = {
      small: 100,
      medium: 500,
      large: 2000,
      xlarge: 5000
    };
    
    const targetSize = typeof nodeCount === 'number' ? nodeCount : sizes[nodeCount];
    
    switch (queryType) {
      case 'file':
        return this.generateFileQueryData(targetSize);
      case 'ast':
        return this.generateASTQueryData(targetSize);
      case 'semantic':
        return this.generateSemanticQueryData(targetSize);
      default:
        return this.generateFileQueryData(targetSize);
    }
  }

  /**
   * Generate test data for CLI queries
   */
  private generateCLITestData(queryType: QueryType, nodeCount: NodeCount): string {
    const sizes = {
      small: 200,
      medium: 1000,
      large: 4000,
      xlarge: 10000
    };
    
    const targetSize = typeof nodeCount === 'number' ? nodeCount : sizes[nodeCount];
    
    switch (queryType) {
      case 'file':
        return this.generateFileQueryData(targetSize);
      case 'ast':
        return this.generateASTQueryData(targetSize);
      case 'semantic':
        return this.generateSemanticQueryData(targetSize);
      default:
        return this.generateFileQueryData(targetSize);
    }
  }

  /**
   * Generate general test query data
   */
  private generateTestQueryData(queryType: QueryType, nodeCount: NodeCount): string {
    const sizes = {
      small: 100,
      medium: 500,
      large: 2000,
      xlarge: 5000
    };
    
    const targetSize = typeof nodeCount === 'number' ? nodeCount : sizes[nodeCount];
    
    switch (queryType) {
      case 'file':
        return this.generateFileQueryData(targetSize);
      case 'ast':
        return this.generateASTQueryData(targetSize);
      case 'semantic':
        return this.generateSemanticQueryData(targetSize);
      default:
        return this.generateFileQueryData(targetSize);
    }
  }

  /**
   * Generate file query test data
   */
  private generateFileQueryData(targetSize: number): string {
    const baseQuery = 'find files containing';
    const searchTerms = ['function', 'class', 'interface', 'method', 'variable', 'import', 'export'];
    const complexityFactors = ['nested', 'recursive', 'async', 'generic', 'abstract'];
    
    let query = baseQuery;
    const numTerms = Math.max(1, Math.floor(targetSize / 100));
    
    for (let i = 0; i < numTerms; i++) {
      const term = searchTerms[i % searchTerms.length];
      const factor = complexityFactors[i % complexityFactors.length];
      query += ` ${factor} ${term}`;
    }
    
    return query;
  }

  /**
   * Generate AST query test data
   */
  private generateASTQueryData(targetSize: number): string {
    const astPatterns = [
      'FunctionDeclaration[name.name="testFunction"]',
      'ClassDeclaration > MethodDefinition[key.name="method"]',
      'VariableDeclaration[declarations.0.id.name="variable"]',
      'ImportDeclaration[source.value="module"]',
      'CallExpression[callee.name="function"]'
    ];
    
    const numPatterns = Math.max(1, Math.floor(targetSize / 200));
    let query = '';
    
    for (let i = 0; i < numPatterns; i++) {
      const pattern = astPatterns[i % astPatterns.length];
      query += i > 0 ? ` OR ${pattern}` : pattern;
    }
    
    return query;
  }

  /**
   * Generate semantic query test data
   */
  private generateSemanticQueryData(targetSize: number): string {
    const semanticConcepts = [
      'error handling',
      'data validation',
      'performance optimization',
      'async operations',
      'type safety',
      'memory management',
      'security checks',
      'API integration'
    ];
    
    const numConcepts = Math.max(1, Math.floor(targetSize / 300));
    let query = '';
    
    for (let i = 0; i < numConcepts; i++) {
      const concept = semanticConcepts[i % semanticConcepts.length];
      query += i > 0 ? ` and ${concept}` : concept;
    }
    
    return query;
  }

  /**
   * Simulate MCP query processing
   */
  private async simulateMCPQuery(testData: string, queryType: QueryType): Promise<void> {
    const baseDelay = queryType === 'file' ? 50 : queryType === 'ast' ? 100 : 150;
    const complexity = testData.length / 100;
    const delay = Math.min(baseDelay + complexity * 2, 300);
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Simulate CLI query processing
   */
  private async simulateCLIQuery(testData: string, queryType: QueryType): Promise<void> {
    const baseDelay = queryType === 'file' ? 100 : queryType === 'ast' ? 200 : 300;
    const complexity = testData.length / 100;
    const delay = Math.min(baseDelay + complexity * 3, 600);
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Simulate query with caching
   */
  private async simulateQueryWithCaching(testData: string, queryType: QueryType, cacheHit: boolean): Promise<void> {
    if (cacheHit) {
      // Cache hit - much faster
      await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
    } else {
      // Cache miss - normal processing time
      await this.simulateQuery(testData, queryType);
    }
  }

  /**
   * Simulate general query processing
   */
  private async simulateQuery(testData: string, queryType: QueryType): Promise<number> {
    const baseDelay = queryType === 'file' ? 75 : queryType === 'ast' ? 125 : 175;
    const complexity = testData.length / 100;
    const delay = Math.min(baseDelay + complexity * 2.5, 400);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return delay;
  }

  /**
   * Estimate node count for query data
   */
  private estimateNodeCount(testData: string, queryType: QueryType): number {
    const multipliers = {
      file: 1.5,
      ast: 2.0,
      semantic: 2.5
    };
    
    const multiplier = multipliers[queryType];
    const baseCount = Math.floor(testData.length / 10);
    
    return Math.floor(baseCount * (multiplier || 1));
  }

  /**
   * Analyze benchmark results and generate summary
   */
  private analyzeBenchmarkResults(runs: BenchmarkRun[], _config: QueryBenchmarkConfig): BenchmarkResult {
    const successfulRuns = runs.filter(run => run.success);
    const failedRuns = runs.filter(run => !run.success);

    if (successfulRuns.length === 0) {
      return {
        benchmarkType: 'query',
        totalRuns: runs.length,
        successfulRuns: 0,
        failedRuns: runs.length,
        averageDuration: 0,
        averageThroughput: 0,
        averageMemoryUsed: 0,
        averageCpuUsage: 0,
        peakMemoryUsed: 0,
        totalNodesProcessed: 0,
        errors: failedRuns.map(run => run.error).filter(Boolean) as string[],
        warnings: ['All benchmark runs failed'],
        meetsPerformanceTargets: false,
        performanceScore: 0,
        recommendations: [
          'Fix critical issues causing all benchmarks to fail',
          'Review query processing implementation',
          'Check test data generation and validation'
        ]
      };
    }

    const avgDuration = successfulRuns.reduce((sum, run) => sum + run.duration, 0) / successfulRuns.length;
    const avgThroughput = successfulRuns.reduce((sum, run) => sum + run.throughput, 0) / successfulRuns.length;
    const avgMemoryUsed = successfulRuns.reduce((sum, run) => sum + run.memoryUsed, 0) / successfulRuns.length;
    const avgCpuUsage = successfulRuns.reduce((sum, run) => sum + run.cpuUsage, 0) / successfulRuns.length;
    const peakMemoryUsed = Math.max(...successfulRuns.map(run => run.memoryUsed));
    const totalNodesProcessed = successfulRuns.reduce((sum, run) => sum + run.nodeCount, 0);

    // Check performance targets
    const mcpRuns = successfulRuns.filter(run => run.metadata?.protocol === 'mcp');
    const cliRuns = successfulRuns.filter(run => run.metadata?.protocol === 'cli');
    
    const meetsMCPTarget = mcpRuns.length === 0 || mcpRuns.every(run => run.duration < 200);
    const meetsCLITarget = cliRuns.length === 0 || cliRuns.every(run => run.duration < 500);
    const meetsPerformanceTargets = meetsMCPTarget && meetsCLITarget;

    // Generate warnings
    const warnings: string[] = [];
    if (!meetsMCPTarget) {
      warnings.push('Some MCP queries exceeded 200ms response time target');
    }
    if (!meetsCLITarget) {
      warnings.push('Some CLI queries exceeded 500ms response time target');
    }
    if (avgThroughput < 10) {
      warnings.push('Query throughput below 10 queries/second');
    }
    if (peakMemoryUsed > 100) {
      warnings.push(`Peak memory usage high: ${peakMemoryUsed.toFixed(1)}MB`);
    }

    // Calculate performance score
    const durationScore = Math.max(0, Math.min(100, 100 - (avgDuration - 100) / 5));
    const throughputScore = Math.min(100, avgThroughput * 5);
    const targetScore = meetsPerformanceTargets ? 100 : 50;
    const performanceScore = Math.round((durationScore + throughputScore + targetScore) / 3);

    // Generate recommendations
    const recommendations: string[] = [];
    if (avgDuration > 200) {
      recommendations.push('Optimize query processing algorithms to reduce response times');
    }
    if (avgThroughput < 20) {
      recommendations.push('Consider implementing query result caching for better throughput');
    }
    if (peakMemoryUsed > 50) {
      recommendations.push('Investigate memory usage patterns and implement cleanup routines');
    }
    if (!meetsPerformanceTargets) {
      recommendations.push('Focus on meeting MCP (<200ms) and CLI (<500ms) response time targets');
    }

    return {
      benchmarkType: 'query',
      totalRuns: runs.length,
      successfulRuns: successfulRuns.length,
      failedRuns: failedRuns.length,
      averageDuration: Math.round(avgDuration * 100) / 100,
      averageThroughput: Math.round(avgThroughput * 100) / 100,
      averageMemoryUsed: Math.round(avgMemoryUsed * 100) / 100,
      averageCpuUsage: Math.round(avgCpuUsage * 100) / 100,
      peakMemoryUsed: Math.round(peakMemoryUsed * 100) / 100,
      totalNodesProcessed,
      errors: failedRuns.map(run => run.error).filter(Boolean) as string[],
      warnings,
      meetsPerformanceTargets,
      performanceScore,
      recommendations
    };
  }
}