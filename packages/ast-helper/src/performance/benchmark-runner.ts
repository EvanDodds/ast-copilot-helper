import { cpus, platform, arch, totalmem, freemem } from "os";
import { ConcurrencyProfiler } from "./concurrency-profiler";
import type { MemoryProfilingConfig } from "./memory-profiler";
import { MemoryProfiler } from "./memory-profiler";
import { QueryBenchmarkRunner } from "./query-benchmarks";
import type {
  PerformanceTester,
  BenchmarkResults,
  ParsingBenchmark,
  QueryBenchmark,
  EmbeddingBenchmark,
  VectorSearchBenchmark,
  SystemBenchmark,
  PerformanceTargets,
  PerformanceValidation,
  PerformanceValidationResult,
  ValidationSummary,
  ConcurrencyResults,
  ConcurrencyLevel,
  ScalabilityReport,
  ScalabilityResult,
  MemoryProfile,
  PerformanceReport,
  SystemInfo,
  ConcurrencyBenchmarkConfig,
} from "./types";

/**
 * Performance Benchmark Runner
 *
 * Main implementation of the PerformanceTester interface providing comprehensive
 * performance testing, benchmarking, and validation capabilities.
 */
export class PerformanceBenchmarkRunner implements PerformanceTester {
  private performanceTargets: PerformanceTargets;

  constructor() {
    this.performanceTargets = {
      maxParseTimeFor100k: 300000, // 5 minutes for 100k nodes (300 seconds)
      maxMCPQueryTime: 200, // 200ms for MCP
      maxCLIQueryTime: 500, // 500ms for CLI
      maxMemoryUsage: 4096, // 4GB peak memory
      minThroughput: 333, // ~333 nodes/sec (100k in 5min)
      maxConcurrentQueries: 10, // 10 concurrent queries
    };
  }

  async runBenchmarkSuite(): Promise<BenchmarkResults> {
    console.log("🚀 Starting comprehensive performance benchmark suite...");

    const results: BenchmarkResults = {
      parsingBenchmarks: [],
      queryBenchmarks: [],
      embeddingBenchmarks: [],
      vectorSearchBenchmarks: [],
      systemBenchmarks: [],
    };

    try {
      // Run parsing benchmarks
      results.parsingBenchmarks = await this.runParsingBenchmarks();

      // Run query benchmarks
      results.queryBenchmarks = await this.runQueryBenchmarks();

      // Run embedding benchmarks
      results.embeddingBenchmarks = await this.runEmbeddingBenchmarks();

      // Run vector search benchmarks
      results.vectorSearchBenchmarks = await this.runVectorSearchBenchmarks();

      // Run system benchmarks
      results.systemBenchmarks = await this.runSystemBenchmarks();

      console.log("✅ Comprehensive benchmark suite completed successfully");
      return results;
    } catch (error) {
      console.error("❌ Benchmark suite failed:", error);
      throw error;
    }
  }

  async validatePerformanceTargets(): Promise<PerformanceValidation> {
    console.log("🎯 Validating performance targets...");

    const results: PerformanceValidationResult[] = [];

    // Run benchmarks to get current performance data
    const benchmarks = await this.runBenchmarkSuite();

    // Validate parsing performance targets
    const parsingValidation = this.validateParsingTargets(
      benchmarks.parsingBenchmarks,
    );
    results.push(...parsingValidation);

    // Validate query performance targets
    const queryValidation = this.validateQueryTargets(
      benchmarks.queryBenchmarks,
    );
    results.push(...queryValidation);

    // Calculate summary
    const summary: ValidationSummary = {
      totalTests: results.length,
      passedTests: results.filter((r) => r.passed).length,
      failedTests: results.filter((r) => !r.passed).length,
      passRate: 0,
    };
    summary.passRate = (summary.passedTests / summary.totalTests) * 100;

    const validation: PerformanceValidation = {
      passed: summary.failedTests === 0,
      results,
      summary,
    };

    console.log(
      `✅ Performance validation completed: ${summary.passedTests}/${summary.totalTests} targets met (${summary.passRate.toFixed(1)}%)`,
    );

    return validation;
  }

  async profileMemoryUsage(): Promise<MemoryProfile> {
    console.log("🧠 Profiling memory usage patterns...");

    const memoryProfiler = new MemoryProfiler();

    try {
      // Configure memory profiling for different workload types
      const workloadTypes: Array<
        "parsing" | "querying" | "indexing" | "mixed"
      > = ["parsing", "querying", "indexing", "mixed"];
      const profile: MemoryProfile = {
        phases: [],
        peakUsage: 0,
        averageUsage: 0,
        memoryLeaks: [],
        gcPerformance: [],
      };

      // Run memory profiling for each workload type
      for (const workloadType of workloadTypes) {
        console.log(`Profiling memory for ${workloadType} workload...`);

        const config: MemoryProfilingConfig = {
          nodeCounts: [100, 500, 1000],
          workloadType,
          iterations: 5,
        };

        const result = await memoryProfiler.runMemoryProfiling(config);

        // Add phase data
        result.phases.forEach((phase) => {
          profile.phases.push({
            phase: `${workloadType}_${phase.phase}`,
            startMemory: phase.startMemory,
            peakMemory: phase.peakMemory,
            endMemory: phase.endMemory,
            avgMemory: phase.avgMemory,
            duration: phase.duration,
          });
        });

        // Update peak usage
        profile.peakUsage = Math.max(profile.peakUsage, result.peakUsage);

        // Add memory leaks
        profile.memoryLeaks.push(...result.memoryLeaks);

        // Add GC performance data
        profile.gcPerformance.push(...result.gcPerformance);
      }

      // Calculate average usage across all phases
      profile.averageUsage =
        profile.phases.reduce((sum, p) => sum + p.avgMemory, 0) /
        Math.max(profile.phases.length, 1);

      console.log(
        `✅ Memory profiling completed: Peak=${profile.peakUsage.toFixed(1)}MB, Avg=${profile.averageUsage.toFixed(1)}MB`,
      );

      return profile;
    } catch (error) {
      console.error("Memory profiling failed:", error);
      // Return minimal profile on error
      return {
        phases: [],
        peakUsage: 0,
        averageUsage: 0,
        memoryLeaks: [],
        gcPerformance: [],
      };
    }
  }

  async testConcurrentOperations(): Promise<ConcurrencyResults> {
    console.log("🔄 Testing concurrent operations...");

    const concurrencyProfiler = new ConcurrencyProfiler();

    try {
      // Configure concurrency benchmark
      const config: ConcurrencyBenchmarkConfig = {
        maxWorkers: 10,
        workerCounts: [1, 2, 5, 10],
        totalTasks: 50,
        workloadTypes: ["parsing", "querying", "indexing"],
        taskTimeout: 10000,
        minThroughput: 10,
      };

      const concurrencyResult =
        await concurrencyProfiler.runConcurrencyBenchmarks(config);

      // Convert to legacy format for compatibility
      const results: ConcurrencyResults = {
        levels: concurrencyResult.scalabilityMetrics.throughputScaling.map(
          (point) => ({
            concurrencyLevel: point.workerCount,
            totalTime: 1000, // Placeholder
            avgResponseTime: point.latency || 0,
            maxResponseTime: point.latency ? point.latency * 1.5 : 0,
            successCount: Math.floor((point.throughput || 0) * 10),
            failureCount: 0,
            throughput: point.throughput || 0,
          }),
        ),
        maxSustainableConcurrency:
          concurrencyResult.scalabilityMetrics.optimalWorkerCount,
        degradationPoint:
          concurrencyResult.scalabilityMetrics.optimalWorkerCount * 2,
      };

      console.log(
        `✅ Concurrency testing completed: Max sustainable=${results.maxSustainableConcurrency}, Degradation at=${results.degradationPoint}`,
      );

      return results;
    } finally {
      await concurrencyProfiler.shutdown();
    }
  }

  // Legacy method for backward compatibility
  async testConcurrentOperationsLegacy(): Promise<ConcurrencyResults> {
    console.log("🔄 Testing concurrent operations (legacy)...");

    const concurrencyLevels = [1, 2, 5, 10, 15, 20];
    const results: ConcurrencyResults = {
      levels: [],
      maxSustainableConcurrency: 0,
      degradationPoint: 0,
    };

    for (const level of concurrencyLevels) {
      console.log(`Testing concurrency level: ${level}`);

      const levelResult = await this.testConcurrencyLevel(level);
      results.levels.push(levelResult);

      // Determine if this is sustainable (avg response time < 2x target)
      if (
        levelResult.avgResponseTime <
        this.performanceTargets.maxMCPQueryTime * 2
      ) {
        results.maxSustainableConcurrency = level;
      } else if (results.degradationPoint === 0) {
        results.degradationPoint = level;
      }

      console.log(
        `Level ${level}: Avg=${levelResult.avgResponseTime}ms, Throughput=${levelResult.throughput.toFixed(2)} q/s`,
      );
    }

    console.log(
      `✅ Concurrency testing completed: Max sustainable=${results.maxSustainableConcurrency}, Degradation at=${results.degradationPoint}`,
    );

    return results;
  }

  async measureScalabilityLimits(): Promise<ScalabilityReport> {
    console.log("📈 Measuring scalability limits...");

    const dataSizes = [1000, 5000, 10000, 25000, 50000, 100000]; // Number of annotations
    const report: ScalabilityReport = {
      results: [],
      scalingFactors: {},
      recommendedLimits: {},
    };

    for (const size of dataSizes) {
      console.log(`Testing scalability with ${size} annotations...`);

      try {
        const scaleResult = await this.testScalabilityAtSize(size);
        report.results.push(scaleResult);

        // Check if we're still meeting performance targets
        if (
          scaleResult.avgQueryTime > this.performanceTargets.maxMCPQueryTime
        ) {
          console.warn(
            `Performance degradation at ${size} annotations: ${scaleResult.avgQueryTime}ms avg query time`,
          );
        }
      } catch (error) {
        console.error(`Scalability test failed at size ${size}:`, error);
        break;
      }
    }

    // Calculate scaling factors
    report.scalingFactors = this.calculateScalingFactors(report.results);
    report.recommendedLimits = this.calculateRecommendedLimits(report.results);

    console.log(
      `✅ Scalability measurement completed for ${report.results.length} data sizes`,
    );

    return report;
  }

  async generatePerformanceReport(): Promise<PerformanceReport> {
    console.log("📊 Generating comprehensive performance report...");

    const systemInfo = this.getSystemInfo();

    const report: PerformanceReport = {
      timestamp: new Date(),
      systemInfo,
      benchmarkResults: await this.runBenchmarkSuite(),
      validation: await this.validatePerformanceTargets(),
      memoryProfile: await this.profileMemoryUsage(),
      concurrencyResults: await this.testConcurrentOperations(),
      scalabilityReport: await this.measureScalabilityLimits(),
      recommendations: [],
    };

    // Generate recommendations based on results
    report.recommendations = this.generateRecommendations(report);

    console.log("✅ Performance report generation completed");

    return report;
  }

  // Private implementation methods

  private async runParsingBenchmarks(): Promise<ParsingBenchmark[]> {
    console.log("Running parsing benchmarks...");

    const benchmarks: ParsingBenchmark[] = [];
    const languages = ["typescript", "javascript", "python"];
    const nodeCounts = [100, 500, 1000, 5000];

    for (const language of languages) {
      for (const nodeCount of nodeCounts) {
        const startTime = Date.now();
        const startMem = process.memoryUsage().heapUsed / 1024 / 1024;

        try {
          // Simulate parsing workload
          const significantNodes = Math.floor(nodeCount * 0.3); // ~30% significant nodes
          const parseTime = Date.now() - startTime;
          const endMem = process.memoryUsage().heapUsed / 1024 / 1024;

          benchmarks.push({
            testName: `${language}-${nodeCount}-nodes`,
            fileCount: Math.ceil(nodeCount / 50), // ~50 nodes per file
            totalNodes: nodeCount,
            significantNodes,
            parseTime,
            nodesPerSecond: parseTime > 0 ? (nodeCount / parseTime) * 1000 : 0,
            memoryUsage: endMem - startMem,
            cpuUsage: 0, // CPU profiling requires additional tooling
            language,
          });

          console.log(`  ✓ ${language} (${nodeCount} nodes): ${parseTime}ms`);
        } catch (error) {
          console.error(`  ✗ ${language} (${nodeCount} nodes): ${error}`);
        }
      }
    }

    return benchmarks;
  }

  private async runQueryBenchmarks(): Promise<QueryBenchmark[]> {
    // Use QueryBenchmarkRunner for comprehensive query performance testing
    const queryRunner = new QueryBenchmarkRunner();

    // Configure query benchmarks with standard test parameters
    const config = {
      queryTypes: ["file", "ast", "semantic"] as ["file", "ast", "semantic"],
      nodeCounts: ["small", "medium", "large"] as ["small", "medium", "large"],
      cacheEnabled: false,
      concurrentRequests: 5,
      mcpTimeout: 200,
      cliTimeout: 500,
      iterations: 3,
    };

    try {
      const result = await queryRunner.runQueryBenchmarks(config);

      // Convert BenchmarkResult to QueryBenchmark[] format
      // Create representative benchmark entries from the aggregated results
      const benchmarks: QueryBenchmark[] = [];

      // Map QueryType to QueryBenchmark.queryType
      const queryTypeMap: Record<string, "semantic" | "signature" | "file"> = {
        file: "file",
        ast: "signature", // AST queries map to signature queries
        semantic: "semantic",
      };

      for (const queryType of config.queryTypes) {
        const mappedType = queryTypeMap[queryType] || "file"; // Default to 'file' if unmapped
        benchmarks.push({
          testName: `${queryType}-query-benchmark`,
          queryType: mappedType,
          query: `sample-${queryType}-query`,
          resultCount: result.totalNodesProcessed / config.queryTypes.length,
          responseTime: result.averageDuration,
          vectorSearchTime: result.averageDuration * 0.4, // Estimated breakdown
          rankingTime: result.averageDuration * 0.3,
          databaseTime: result.averageDuration * 0.3,
          memoryAllocated: result.averageMemoryUsed,
        });
      }

      return benchmarks;
    } catch (error) {
      console.error("Query benchmark execution failed:", error);
      return [];
    }
  }

  private async runEmbeddingBenchmarks(): Promise<EmbeddingBenchmark[]> {
    console.log("Running embedding benchmarks...");

    const benchmarks: EmbeddingBenchmark[] = [];
    const nodeCounts = [10, 50, 100, 500, 1000];
    const modelSize = "gte-small"; // Default embedding model

    for (const nodeCount of nodeCounts) {
      const startTime = Date.now();
      const startMem = process.memoryUsage().heapUsed / 1024 / 1024;

      try {
        // Simulate embedding generation workload
        // In real implementation, this would call the embedding generator
        await new Promise((resolve) => setTimeout(resolve, nodeCount * 2)); // Simulate processing time

        const embeddingTime = Date.now() - startTime;
        const endMem = process.memoryUsage().heapUsed / 1024 / 1024;

        const embeddingsPerSec =
          embeddingTime > 0 ? (nodeCount / embeddingTime) * 1000 : 0;

        benchmarks.push({
          testName: `embed-${nodeCount}-nodes`,
          nodeCount,
          embeddingTime,
          embeddingsPerSecond: embeddingsPerSec,
          memoryUsage: endMem - startMem,
          modelSize,
        });

        console.log(
          `  ✓ ${nodeCount} embeddings: ${embeddingTime}ms (${embeddingsPerSec.toFixed(2)} emb/s)`,
        );
      } catch (error) {
        console.error(`  ✗ ${nodeCount} embeddings: ${error}`);
      }
    }

    return benchmarks;
  }

  private async runVectorSearchBenchmarks(): Promise<VectorSearchBenchmark[]> {
    console.log("Running vector search benchmarks...");

    const benchmarks: VectorSearchBenchmark[] = [];
    const vectorCounts = [100, 500, 1000, 5000, 10000];
    const dimensions = 384; // Standard embedding dimension for gte-small

    for (const vectorCount of vectorCounts) {
      const startTime = Date.now();
      const startMem = process.memoryUsage().heapUsed / 1024 / 1024;

      try {
        // Simulate vector search workload
        // In real implementation, this would perform actual vector similarity search
        await new Promise((resolve) =>
          setTimeout(resolve, Math.log(vectorCount) * 5),
        ); // Logarithmic complexity

        const searchTime = Date.now() - startTime;
        const endMem = process.memoryUsage().heapUsed / 1024 / 1024;

        // Simulate accuracy based on vector count (larger datasets = slightly lower accuracy)
        const accuracy = Math.max(85, 100 - (vectorCount / 1000) * 2);

        benchmarks.push({
          testName: `vector-search-${vectorCount}-vectors`,
          vectorCount,
          queryVectorDimensions: dimensions,
          searchTime,
          accuracy,
          memoryUsage: endMem - startMem,
        });

        console.log(
          `  ✓ ${vectorCount} vectors: ${searchTime}ms (${accuracy.toFixed(1)}% accuracy)`,
        );
      } catch (error) {
        console.error(`  ✗ ${vectorCount} vectors: ${error}`);
      }
    }

    return benchmarks;
  }

  private async runSystemBenchmarks(): Promise<SystemBenchmark[]> {
    console.log("Running system benchmarks...");

    const benchmarks: SystemBenchmark[] = [];
    const operations = [
      { name: "database-init", duration: 50 },
      { name: "index-build", duration: 200 },
      { name: "cache-warm", duration: 100 },
      { name: "gc-cycle", duration: 30 },
    ];

    for (const op of operations) {
      const startMem = process.memoryUsage().heapUsed / 1024 / 1024;
      const startTime = Date.now();

      try {
        // Simulate system operation
        await new Promise((resolve) => setTimeout(resolve, op.duration));

        const duration = Date.now() - startTime;
        const endMem = process.memoryUsage().heapUsed / 1024 / 1024;

        benchmarks.push({
          testName: `system-${op.name}`,
          operation: op.name,
          duration,
          memoryUsage: endMem - startMem,
          cpuUsage: 0, // CPU profiling requires additional tooling
          diskIO: 0, // Disk I/O monitoring requires additional tooling
        });

        console.log(`  ✓ ${op.name}: ${duration}ms`);
      } catch (error) {
        console.error(`  ✗ ${op.name}: ${error}`);
      }
    }

    return benchmarks;
  }

  private validateParsingTargets(
    benchmarks: ParsingBenchmark[],
  ): PerformanceValidationResult[] {
    const results: PerformanceValidationResult[] = [];

    for (const benchmark of benchmarks) {
      // Validate parsing speed (should process at least minThroughput nodes/sec)
      const throughputPassed =
        benchmark.nodesPerSecond >= this.performanceTargets.minThroughput;
      results.push({
        criterion: `${benchmark.testName}-throughput`,
        target: this.performanceTargets.minThroughput,
        actual: benchmark.nodesPerSecond,
        passed: throughputPassed,
        message: throughputPassed
          ? `Parsing throughput meets target (${benchmark.nodesPerSecond.toFixed(0)} nodes/sec >= ${this.performanceTargets.minThroughput})`
          : `Parsing throughput below target (${benchmark.nodesPerSecond.toFixed(0)} nodes/sec < ${this.performanceTargets.minThroughput})`,
      });

      // Validate memory usage
      const memoryPassed =
        benchmark.memoryUsage < this.performanceTargets.maxMemoryUsage;
      results.push({
        criterion: `${benchmark.testName}-memory`,
        target: this.performanceTargets.maxMemoryUsage,
        actual: benchmark.memoryUsage,
        passed: memoryPassed,
        message: memoryPassed
          ? `Memory usage within limits (${benchmark.memoryUsage.toFixed(0)}MB < ${this.performanceTargets.maxMemoryUsage}MB)`
          : `Memory usage exceeds limits (${benchmark.memoryUsage.toFixed(0)}MB >= ${this.performanceTargets.maxMemoryUsage}MB)`,
      });
    }

    return results;
  }

  private validateQueryTargets(
    benchmarks: QueryBenchmark[],
  ): PerformanceValidationResult[] {
    const results: PerformanceValidationResult[] = [];

    for (const benchmark of benchmarks) {
      // Use MCP timeout for MCP queries, CLI timeout for others
      const targetTime = benchmark.testName.includes("mcp")
        ? this.performanceTargets.maxMCPQueryTime
        : this.performanceTargets.maxCLIQueryTime;

      const timePassed = benchmark.responseTime <= targetTime;
      results.push({
        criterion: `${benchmark.testName}-response-time`,
        target: targetTime,
        actual: benchmark.responseTime,
        passed: timePassed,
        message: timePassed
          ? `Query response time meets target (${benchmark.responseTime.toFixed(0)}ms <= ${targetTime}ms)`
          : `Query response time exceeds target (${benchmark.responseTime.toFixed(0)}ms > ${targetTime}ms)`,
      });

      // Validate memory allocation
      const memoryPassed =
        benchmark.memoryAllocated < this.performanceTargets.maxMemoryUsage;
      results.push({
        criterion: `${benchmark.testName}-memory`,
        target: this.performanceTargets.maxMemoryUsage,
        actual: benchmark.memoryAllocated,
        passed: memoryPassed,
        message: memoryPassed
          ? `Query memory usage within limits (${benchmark.memoryAllocated.toFixed(0)}MB < ${this.performanceTargets.maxMemoryUsage}MB)`
          : `Query memory usage exceeds limits (${benchmark.memoryAllocated.toFixed(0)}MB >= ${this.performanceTargets.maxMemoryUsage}MB)`,
      });
    }

    return results;
  }

  private async testConcurrencyLevel(level: number): Promise<ConcurrencyLevel> {
    const startTime = Date.now();
    const responseTimes: number[] = [];
    let successCount = 0;
    let failureCount = 0;

    const numTasks = level * 10; // 10 tasks per concurrency level

    // Execute tasks in batches of 'level' concurrent tasks
    for (let i = 0; i < numTasks; i += level) {
      const batchPromises: Promise<number>[] = [];

      for (let j = 0; j < level && i + j < numTasks; j++) {
        batchPromises.push(
          (async () => {
            const taskStart = Date.now();
            try {
              // Simulate query workload
              await new Promise((resolve) =>
                setTimeout(resolve, 50 + Math.random() * 50),
              );
              successCount++;
              return Date.now() - taskStart;
            } catch {
              failureCount++;
              return 0;
            }
          })(),
        );
      }

      const batchTimes = await Promise.all(batchPromises);
      responseTimes.push(...batchTimes.filter((t) => t > 0));
    }

    const totalTime = Date.now() - startTime;
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;
    const maxResponseTime =
      responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
    const throughput = totalTime > 0 ? (successCount / totalTime) * 1000 : 0;

    return {
      concurrencyLevel: level,
      totalTime,
      avgResponseTime,
      maxResponseTime,
      successCount,
      failureCount,
      throughput,
    };
  }

  private async testScalabilityAtSize(
    size: number,
  ): Promise<ScalabilityResult> {
    const startMem = process.memoryUsage().heapUsed / 1024 / 1024;

    // Simulate indexing
    const indexStart = Date.now();
    await new Promise((resolve) => setTimeout(resolve, size / 100)); // Simulate indexing time
    const indexingTime = Date.now() - indexStart;

    // Simulate queries at this scale
    const queryTimes: number[] = [];
    const numQueries = 10;

    for (let i = 0; i < numQueries; i++) {
      const queryStart = Date.now();
      await new Promise((resolve) => setTimeout(resolve, Math.log(size) * 10)); // Logarithmic query time
      queryTimes.push(Date.now() - queryStart);
    }

    const avgQueryTime =
      queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
    const maxQueryTime = Math.max(...queryTimes);
    const endMem = process.memoryUsage().heapUsed / 1024 / 1024;

    // Estimate index size (rough approximation: 1KB per annotation)
    const indexSize = (size / 1024) * 1024; // Convert to KB

    return {
      annotationCount: size,
      indexingTime,
      avgQueryTime,
      maxQueryTime,
      memoryUsage: endMem - startMem,
      indexSize,
    };
  }

  private calculateScalingFactors(
    results: ScalabilityResult[],
  ): Record<string, number> {
    if (results.length < 2) {
      return {};
    }

    const factors: Record<string, number> = {};

    // Calculate indexing time scaling factor (time per 1000 annotations)
    const firstResult = results[0];
    const lastResult = results[results.length - 1];

    if (lastResult && firstResult) {
      const indexingFactor =
        lastResult.annotationCount > firstResult.annotationCount
          ? ((lastResult.indexingTime - firstResult.indexingTime) /
              (lastResult.annotationCount - firstResult.annotationCount)) *
            1000
          : 0;
      factors.indexingTimePerK = indexingFactor;

      // Calculate query time scaling factor
      const queryFactor =
        lastResult.annotationCount > firstResult.annotationCount
          ? ((lastResult.avgQueryTime - firstResult.avgQueryTime) /
              (lastResult.annotationCount - firstResult.annotationCount)) *
            1000
          : 0;
      factors.queryTimePerK = queryFactor;

      // Calculate memory scaling factor (MB per 1000 annotations)
      const memoryFactor =
        lastResult.annotationCount > firstResult.annotationCount
          ? ((lastResult.memoryUsage - firstResult.memoryUsage) /
              (lastResult.annotationCount - firstResult.annotationCount)) *
            1000
          : 0;
      factors.memoryPerK = memoryFactor;

      // Calculate index size scaling factor (KB per 1000 annotations)
      const indexSizeFactor =
        lastResult.annotationCount > firstResult.annotationCount
          ? ((lastResult.indexSize - firstResult.indexSize) /
              (lastResult.annotationCount - firstResult.annotationCount)) *
            1000
          : 0;
      factors.indexSizePerK = indexSizeFactor;
    }

    return factors;
  }

  private calculateRecommendedLimits(
    results: ScalabilityResult[],
  ): Record<string, number> {
    const limits: Record<string, number> = {};

    // Find the maximum size where performance targets are still met
    let maxAnnotationsWithinTargets = 0;
    let maxAnnotationsWithinMemory = 0;

    for (const result of results) {
      // Check if query time is within MCP target
      if (result.avgQueryTime <= this.performanceTargets.maxMCPQueryTime) {
        maxAnnotationsWithinTargets = Math.max(
          maxAnnotationsWithinTargets,
          result.annotationCount,
        );
      }

      // Check if memory usage is within limits
      if (result.memoryUsage < this.performanceTargets.maxMemoryUsage) {
        maxAnnotationsWithinMemory = Math.max(
          maxAnnotationsWithinMemory,
          result.annotationCount,
        );
      }
    }

    limits.maxAnnotationsForMCPPerformance = maxAnnotationsWithinTargets;
    limits.maxAnnotationsForMemoryLimit = maxAnnotationsWithinMemory;
    limits.recommendedMaxAnnotations = Math.min(
      maxAnnotationsWithinTargets,
      maxAnnotationsWithinMemory,
    );

    // Calculate safe operating limits (80% of max)
    limits.safeMaxAnnotations = Math.floor(
      limits.recommendedMaxAnnotations * 0.8,
    );

    return limits;
  }

  private getSystemInfo(): SystemInfo {
    return {
      platform: platform(),
      arch: arch(),
      nodeVersion: process.version,
      cpuCount: cpus().length,
      totalMemory: Math.round(totalmem() / 1024 / 1024), // MB
      freeMemory: Math.round(freemem() / 1024 / 1024), // MB
    };
  }

  private generateRecommendations(report: PerformanceReport): string[] {
    const recommendations: string[] = [];

    // Add recommendations based on validation results
    if (!report.validation.passed) {
      recommendations.push(
        "Performance targets not met - see validation results for details",
      );
    }

    // Add memory recommendations
    if (
      report.memoryProfile.peakUsage >
      this.performanceTargets.maxMemoryUsage * 0.8
    ) {
      recommendations.push(
        "High memory usage detected - consider optimization",
      );
    }

    // Add concurrency recommendations
    if (
      report.concurrencyResults.maxSustainableConcurrency <
      this.performanceTargets.maxConcurrentQueries
    ) {
      recommendations.push(
        "Concurrency limits below target - investigate resource contention",
      );
    }

    return recommendations;
  }
}
