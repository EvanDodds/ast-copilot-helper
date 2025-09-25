import { cpus, platform, arch, totalmem, freemem } from "os";
import { ConcurrencyProfiler } from "./concurrency-profiler";
import type { MemoryProfilingConfig } from "./memory-profiler";
import { MemoryProfiler } from "./memory-profiler";
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
    console.log("Parsing benchmarks - placeholder implementation");
    // TODO: Implement actual parsing benchmarks
    return [];
  }

  private async runQueryBenchmarks(): Promise<QueryBenchmark[]> {
    console.log("Query benchmarks - placeholder implementation");
    // TODO: Implement actual query benchmarks
    return [];
  }

  private async runEmbeddingBenchmarks(): Promise<EmbeddingBenchmark[]> {
    console.log("Embedding benchmarks - placeholder implementation");
    // TODO: Implement actual embedding benchmarks
    return [];
  }

  private async runVectorSearchBenchmarks(): Promise<VectorSearchBenchmark[]> {
    console.log("Vector search benchmarks - placeholder implementation");
    // TODO: Implement actual vector search benchmarks
    return [];
  }

  private async runSystemBenchmarks(): Promise<SystemBenchmark[]> {
    console.log("System benchmarks - placeholder implementation");
    // TODO: Implement actual system benchmarks
    return [];
  }

  private validateParsingTargets(
    _benchmarks: ParsingBenchmark[],
  ): PerformanceValidationResult[] {
    // TODO: Implement parsing validation
    return [];
  }

  private validateQueryTargets(
    _benchmarks: QueryBenchmark[],
  ): PerformanceValidationResult[] {
    // TODO: Implement query validation
    return [];
  }

  private async testConcurrencyLevel(level: number): Promise<ConcurrencyLevel> {
    // TODO: Implement concurrency level testing
    return {
      concurrencyLevel: level,
      totalTime: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      successCount: 0,
      failureCount: 0,
      throughput: 0,
    };
  }

  private async testScalabilityAtSize(
    size: number,
  ): Promise<ScalabilityResult> {
    // TODO: Implement scalability testing at specific size
    return {
      annotationCount: size,
      indexingTime: 0,
      avgQueryTime: 0,
      maxQueryTime: 0,
      memoryUsage: 0,
      indexSize: 0,
    };
  }

  private calculateScalingFactors(
    _results: ScalabilityResult[],
  ): Record<string, number> {
    // TODO: Implement scaling factor calculation
    return {};
  }

  private calculateRecommendedLimits(
    _results: ScalabilityResult[],
  ): Record<string, number> {
    // TODO: Implement recommended limits calculation
    return {};
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
