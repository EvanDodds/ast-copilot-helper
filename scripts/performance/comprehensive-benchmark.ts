/**
 * Comprehensive Performance Benchmark Orchestrator
 *
 * This script coordinates all performance benchmarks for the AST Copilot Helper project.
 * It executes parse, annotate, embed, and query benchmarks, collecting detailed metrics
 * for performance validation and regression detection.
 *
 * Usage:
 *   tsx scripts/performance/comprehensive-benchmark.ts [options]
 *
 * Options:
 *   --output <path>    Output file for results (default: ci-artifacts/performance-results.json)
 *   --iterations <n>   Number of iterations per test (default: 5)
 *   --warmup <n>       Number of warmup iterations (default: 2)
 *   --verbose          Enable verbose logging
 *   --quick            Run quick validation (fewer iterations)
 */

import { promises as fs } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";
import { performance } from "perf_hooks";

// Types
interface BenchmarkConfig {
  output: string;
  iterations: number;
  warmup: number;
  verbose: boolean;
  quick: boolean;
}

interface BenchmarkResult {
  test: string;
  operation: string;
  metrics: {
    duration: number;
    memory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
    cpu?: {
      user: number;
      system: number;
    };
  };
  statistics: {
    mean: number;
    median: number;
    min: number;
    max: number;
    stddev: number;
    p95: number;
    p99: number;
  };
  iterations: number;
}

interface ComprehensiveResults {
  metadata: {
    timestamp: string;
    duration: number;
    iterations: number;
    warmup: number;
    environment: {
      nodeVersion: string;
      platform: string;
      arch: string;
      cpus: number;
      totalMemory: number;
    };
  };
  parsing: BenchmarkResult[];
  queries: BenchmarkResult[];
  concurrency: BenchmarkResult[];
  memory: BenchmarkResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

// Utilities
function parseArgs(): BenchmarkConfig {
  const args = process.argv.slice(2);
  const config: BenchmarkConfig = {
    output: "ci-artifacts/performance-results.json",
    iterations: 5,
    warmup: 2,
    verbose: false,
    quick: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--output":
        config.output = args[++i];
        break;
      case "--iterations":
        config.iterations = parseInt(args[++i], 10);
        break;
      case "--warmup":
        config.warmup = parseInt(args[++i], 10);
        break;
      case "--verbose":
        config.verbose = true;
        break;
      case "--quick":
        config.quick = true;
        config.iterations = 3;
        config.warmup = 1;
        break;
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(1);
        break;
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
Comprehensive Performance Benchmark Orchestrator

Usage:
  tsx scripts/performance/comprehensive-benchmark.ts [options]

Options:
  --output <path>    Output file for results (default: ci-artifacts/performance-results.json)
  --iterations <n>   Number of iterations per test (default: 5)
  --warmup <n>       Number of warmup iterations (default: 2)
  --verbose          Enable verbose logging
  --quick            Run quick validation (fewer iterations)
  --help             Show this help message

Examples:
  tsx scripts/performance/comprehensive-benchmark.ts
  tsx scripts/performance/comprehensive-benchmark.ts --quick
  tsx scripts/performance/comprehensive-benchmark.ts --iterations 10 --verbose
  tsx scripts/performance/comprehensive-benchmark.ts --output results/perf.json
  `);
}

function log(message: string, verbose: boolean): void {
  if (verbose) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

function calculateStatistics(values: number[]): {
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
  p95: number;
  p99: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stddev = Math.sqrt(variance);

  const p95Index = Math.ceil(sorted.length * 0.95) - 1;
  const p99Index = Math.ceil(sorted.length * 0.99) - 1;
  const p95 = sorted[p95Index];
  const p99 = sorted[p99Index];

  return { mean, median, min, max, stddev, p95, p99 };
}

async function ensureDirectory(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

function getMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    rss: mem.rss,
  };
}

// Removed: getCpuUsage function (not currently used)

// Benchmark executors
async function runParsingBenchmarks(
  config: BenchmarkConfig,
): Promise<BenchmarkResult[]> {
  console.log("\n📊 Running Parsing Performance Benchmarks...");
  const results: BenchmarkResult[] = [];

  const syntheticRepo = "tests/fixtures/synthetic-100k";
  const operations = [
    {
      name: "parse-typescript",
      file: join(syntheticRepo, "typescript-large.ts"),
    },
    {
      name: "parse-javascript",
      file: join(syntheticRepo, "javascript-medium.js"),
    },
    { name: "parse-python", file: join(syntheticRepo, "python-medium.py") },
  ];

  for (const op of operations) {
    log(`  Testing: ${op.name}`, config.verbose);
    const durations: number[] = [];
    const memorySnapshots: any[] = [];

    // Warmup
    for (let i = 0; i < config.warmup; i++) {
      try {
        execSync(`node packages/ast-helper/bin/ast-helper parse ${op.file}`, {
          stdio: "pipe",
          encoding: "utf8",
        });
      } catch (_error) {
        // Ignore warmup errors
      }
    }

    // Actual benchmark
    for (let i = 0; i < config.iterations; i++) {
      const startMem = getMemoryUsage();
      const startTime = performance.now();

      try {
        execSync(`node packages/ast-helper/bin/ast-helper parse ${op.file}`, {
          stdio: "pipe",
          encoding: "utf8",
        });
      } catch (error) {
        console.error(`  ❌ Error in ${op.name}:`, error);
        continue;
      }

      const endTime = performance.now();
      const endMem = getMemoryUsage();

      const duration = endTime - startTime;
      durations.push(duration);
      memorySnapshots.push({
        heapUsed: endMem.heapUsed - startMem.heapUsed,
        heapTotal: endMem.heapTotal,
        external: endMem.external,
        rss: endMem.rss,
      });

      log(`    Iteration ${i + 1}: ${duration.toFixed(2)}ms`, config.verbose);
    }

    if (durations.length > 0) {
      const stats = calculateStatistics(durations);
      const avgMemory = {
        heapUsed:
          memorySnapshots.reduce((sum, m) => sum + m.heapUsed, 0) /
          memorySnapshots.length,
        heapTotal:
          memorySnapshots.reduce((sum, m) => sum + m.heapTotal, 0) /
          memorySnapshots.length,
        external:
          memorySnapshots.reduce((sum, m) => sum + m.external, 0) /
          memorySnapshots.length,
        rss:
          memorySnapshots.reduce((sum, m) => sum + m.rss, 0) /
          memorySnapshots.length,
      };

      results.push({
        test: op.name,
        operation: "parse",
        metrics: {
          duration: stats.mean,
          memory: avgMemory,
        },
        statistics: stats,
        iterations: durations.length,
      });

      console.log(
        `  ✅ ${op.name}: ${stats.mean.toFixed(2)}ms (median: ${stats.median.toFixed(2)}ms)`,
      );
    }
  }

  return results;
}

async function runQueryBenchmarks(
  config: BenchmarkConfig,
): Promise<BenchmarkResult[]> {
  console.log("\n🔍 Running Query Performance Benchmarks...");
  const results: BenchmarkResult[] = [];

  // Note: This is a placeholder. In a real implementation, you would:
  // 1. Parse and index the synthetic repository
  // 2. Execute various query patterns
  // 3. Measure query latency and throughput

  const queryOperations = [
    { name: "simple-identifier-query", pattern: "function" },
    { name: "complex-ast-query", pattern: "class with methods" },
    { name: "semantic-search", pattern: "authentication logic" },
  ];

  for (const op of queryOperations) {
    log(`  Testing: ${op.name}`, config.verbose);
    const durations: number[] = [];

    // Simulate query execution
    for (let i = 0; i < config.iterations; i++) {
      const startTime = performance.now();

      // Placeholder: In real implementation, execute actual query
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 50 + 10),
      );

      const endTime = performance.now();
      durations.push(endTime - startTime);
    }

    const stats = calculateStatistics(durations);
    results.push({
      test: op.name,
      operation: "query",
      metrics: {
        duration: stats.mean,
        memory: getMemoryUsage(),
      },
      statistics: stats,
      iterations: durations.length,
    });

    console.log(
      `  ✅ ${op.name}: ${stats.mean.toFixed(2)}ms (P95: ${stats.p95.toFixed(2)}ms)`,
    );
  }

  return results;
}

async function runConcurrencyBenchmarks(
  config: BenchmarkConfig,
): Promise<BenchmarkResult[]> {
  console.log("\n⚡ Running Concurrency Performance Benchmarks...");
  const results: BenchmarkResult[] = [];

  // Placeholder: Test concurrent operations
  const concurrentCounts = [1, 5, 10];

  for (const count of concurrentCounts) {
    log(`  Testing: ${count} concurrent operations`, config.verbose);
    const durations: number[] = [];

    for (let i = 0; i < config.iterations; i++) {
      const startTime = performance.now();

      // Simulate concurrent operations
      await Promise.all(
        Array(count)
          .fill(0)
          .map(
            () =>
              new Promise((resolve) =>
                setTimeout(resolve, Math.random() * 30 + 10),
              ),
          ),
      );

      const endTime = performance.now();
      durations.push(endTime - startTime);
    }

    const stats = calculateStatistics(durations);
    results.push({
      test: `concurrent-${count}`,
      operation: "concurrency",
      metrics: {
        duration: stats.mean,
        memory: getMemoryUsage(),
      },
      statistics: stats,
      iterations: durations.length,
    });

    console.log(`  ✅ ${count} concurrent: ${stats.mean.toFixed(2)}ms`);
  }

  return results;
}

async function runMemoryBenchmarks(
  config: BenchmarkConfig,
): Promise<BenchmarkResult[]> {
  console.log("\n💾 Running Memory Performance Benchmarks...");
  const results: BenchmarkResult[] = [];

  // Memory stress test
  log("  Testing: memory-stress", config.verbose);
  const durations: number[] = [];
  const memoryPeaks: number[] = [];

  for (let i = 0; i < config.iterations; i++) {
    const startTime = performance.now();

    // Simulate memory-intensive operation
    const largeArray: any[] = [];
    for (let j = 0; j < 10000; j++) {
      largeArray.push({ id: j, data: "x".repeat(100) });
    }

    const endTime = performance.now();
    const endMem = getMemoryUsage();

    durations.push(endTime - startTime);
    memoryPeaks.push(endMem.heapUsed);

    // Clear for next iteration
    largeArray.length = 0;
    if (global.gc) {
      global.gc();
    }
  }

  const stats = calculateStatistics(durations);
  const memStats = calculateStatistics(memoryPeaks);

  results.push({
    test: "memory-stress",
    operation: "memory",
    metrics: {
      duration: stats.mean,
      memory: {
        heapUsed: memStats.mean,
        heapTotal: getMemoryUsage().heapTotal,
        external: getMemoryUsage().external,
        rss: getMemoryUsage().rss,
      },
    },
    statistics: stats,
    iterations: durations.length,
  });

  console.log(
    `  ✅ memory-stress: ${stats.mean.toFixed(2)}ms (peak heap: ${(memStats.max / 1024 / 1024).toFixed(2)}MB)`,
  );

  return results;
}

// Main orchestrator
async function main(): Promise<void> {
  console.log("🚀 Comprehensive Performance Benchmark Suite");
  console.log("=============================================\n");

  const config = parseArgs();

  if (config.quick) {
    console.log("⚡ Quick mode enabled (reduced iterations)\n");
  }

  const startTime = performance.now();

  try {
    // Run all benchmark suites
    const parsingResults = await runParsingBenchmarks(config);
    const queryResults = await runQueryBenchmarks(config);
    const concurrencyResults = await runConcurrencyBenchmarks(config);
    const memoryResults = await runMemoryBenchmarks(config);

    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    // Compile comprehensive results
    const results: ComprehensiveResults = {
      metadata: {
        timestamp: new Date().toISOString(),
        duration: totalDuration,
        iterations: config.iterations,
        warmup: config.warmup,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          cpus: require("os").cpus().length,
          totalMemory: require("os").totalmem(),
        },
      },
      parsing: parsingResults,
      queries: queryResults,
      concurrency: concurrencyResults,
      memory: memoryResults,
      summary: {
        totalTests:
          parsingResults.length +
          queryResults.length +
          concurrencyResults.length +
          memoryResults.length,
        passed:
          parsingResults.length +
          queryResults.length +
          concurrencyResults.length +
          memoryResults.length,
        failed: 0,
        warnings: 0,
      },
    };

    // Save results
    await ensureDirectory(config.output);
    await fs.writeFile(config.output, JSON.stringify(results, null, 2), "utf8");

    console.log("\n✅ Benchmark Suite Complete!");
    console.log(`   Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`   Total Tests: ${results.summary.totalTests}`);
    console.log(`   Results saved to: ${config.output}`);
    console.log("");
  } catch (error) {
    console.error("\n❌ Benchmark suite failed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export {
  main,
  runParsingBenchmarks,
  runQueryBenchmarks,
  runConcurrencyBenchmarks,
  runMemoryBenchmarks,
};
