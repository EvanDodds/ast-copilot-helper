#!/usr/bin/env node
/**
 * NAPI vs WASM Performance Benchmark Script
 *
 * Standalone script for running comprehensive performance benchmarks
 * comparing NAPI and WASM vector database implementations.
 *
 * Usage:
 *   yarn benchmark:napi-vs-wasm
 *   node scripts/benchmark-wasm-vs-napi.ts
 */

import { PerformanceBenchmark } from "../packages/ast-helper/src/database/vector/performance-benchmark.test.js";

/**
 * Configuration for production-like benchmarks
 */
const PRODUCTION_BENCHMARK_CONFIG = {
  warmupRuns: 5,
  measurementRuns: 20,
  vectorCount: 2000,
  vectorDimensions: 768,
  searchQueries: 200,
  batchSizes: [1, 10, 50, 100, 200, 500],
};

/**
 * Format timing results for console output
 */
function formatTime(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(1)}μs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

/**
 * Format memory usage for console output
 */
function formatMemory(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)}${units[unitIndex]}`;
}

/**
 * Format throughput for console output
 */
function formatThroughput(opsPerSec: number): string {
  if (opsPerSec >= 1000) {
    return `${(opsPerSec / 1000).toFixed(2)}K ops/sec`;
  } else {
    return `${opsPerSec.toFixed(1)} ops/sec`;
  }
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(results: {
  napiResults: any[];
  wasmResults: any[];
  comparison: any[];
}): string {
  const { napiResults, wasmResults, comparison } = results;

  let report = `# NAPI vs WASM Performance Benchmark Report\n\n`;
  report += `Generated on: ${new Date().toISOString()}\n\n`;

  // Summary table
  report += `## Performance Summary\n\n`;
  report += `| Operation | NAPI Time | WASM Time | WASM vs NAPI | Status |\n`;
  report += `|-----------|-----------|-----------|--------------|--------|\n`;

  comparison.forEach((comp) => {
    const status = comp.meetsThreshold ? "✅ PASS" : "❌ FAIL";
    report += `| ${comp.operation} | ${formatTime(comp.napiTime)} | ${formatTime(comp.wasmTime)} | ${comp.wasmVsNapiRatio.toFixed(1)}% | ${status} |\n`;
  });

  // Detailed results
  report += `\n## Detailed Results\n\n`;

  report += `### NAPI Implementation Results\n\n`;
  napiResults.forEach((result) => {
    report += `#### ${result.operation}\n`;
    report += `- Average Time: ${formatTime(result.avgTime)}\n`;
    report += `- Min Time: ${formatTime(result.minTime)}\n`;
    report += `- Max Time: ${formatTime(result.maxTime)}\n`;
    if (result.throughput) {
      report += `- Throughput: ${formatThroughput(result.throughput)}\n`;
    }
    if (result.memoryUsage) {
      report += `- Memory Usage: ${formatMemory(result.memoryUsage)}\n`;
    }
    report += `- Samples: ${result.samples}\n\n`;
  });

  report += `### WASM Implementation Results\n\n`;
  wasmResults.forEach((result) => {
    report += `#### ${result.operation}\n`;
    report += `- Average Time: ${formatTime(result.avgTime)}\n`;
    report += `- Min Time: ${formatTime(result.minTime)}\n`;
    report += `- Max Time: ${formatTime(result.maxTime)}\n`;
    if (result.throughput) {
      report += `- Throughput: ${formatThroughput(result.throughput)}\n`;
    }
    if (result.memoryUsage) {
      report += `- Memory Usage: ${formatMemory(result.memoryUsage)}\n`;
    }
    report += `- Samples: ${result.samples}\n\n`;
  });

  return report;
}

/**
 * Main benchmark execution
 */
async function runBenchmarks(): Promise<void> {
  console.log("🚀 Starting NAPI vs WASM Performance Benchmarks");
  console.log("=".repeat(60));

  const benchmark = new PerformanceBenchmark(PRODUCTION_BENCHMARK_CONFIG);

  try {
    console.log("📊 Running comprehensive performance comparison...");
    console.log(`Configuration:`);
    console.log(
      `  - Measurement runs: ${PRODUCTION_BENCHMARK_CONFIG.measurementRuns}`,
    );
    console.log(`  - Vector count: ${PRODUCTION_BENCHMARK_CONFIG.vectorCount}`);
    console.log(
      `  - Vector dimensions: ${PRODUCTION_BENCHMARK_CONFIG.vectorDimensions}`,
    );
    console.log(
      `  - Search queries: ${PRODUCTION_BENCHMARK_CONFIG.searchQueries}`,
    );
    console.log(
      `  - Batch sizes: ${PRODUCTION_BENCHMARK_CONFIG.batchSizes.join(", ")}`,
    );
    console.log("");

    const startTime = Date.now();
    const results = await benchmark.compareImplementations();
    const totalTime = Date.now() - startTime;

    console.log(`✅ Benchmarks completed in ${formatTime(totalTime)}`);
    console.log("");

    // Display results summary
    console.log("📈 Performance Comparison Results:");
    console.log("-".repeat(80));
    console.log(
      `${"Operation".padEnd(30)} | ${"NAPI".padEnd(10)} | ${"WASM".padEnd(10)} | ${"Ratio".padEnd(8)} | Status`,
    );
    console.log("-".repeat(80));

    results.comparison.forEach((comp) => {
      const status = comp.meetsThreshold ? "✅ PASS" : "❌ FAIL";
      const operationName = comp.operation
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      console.log(
        `${operationName.padEnd(30)} | ${formatTime(comp.napiTime).padEnd(10)} | ${formatTime(comp.wasmTime).padEnd(10)} | ${comp.wasmVsNapiRatio.toFixed(1).padEnd(6)}% | ${status}`,
      );
    });

    console.log("-".repeat(80));

    // Performance criteria validation
    console.log("\n🎯 Performance Criteria Validation:");
    const criteria = benchmark.validatePerformanceCriteria(results.wasmResults);

    const criteriaResults = [
      {
        name: "Search Latency (MCP <200ms)",
        passed: criteria.searchLatencyMCP,
      },
      {
        name: "Search Latency (CLI <500ms)",
        passed: criteria.searchLatencyCLI,
      },
      { name: "Initialization (<1s)", passed: criteria.initialization },
      { name: "Memory Overhead (<20%)", passed: criteria.memoryOverhead },
      { name: "Overall Throughput (>90%)", passed: criteria.overallThroughput },
    ];

    criteriaResults.forEach((criterion) => {
      const status = criterion.passed ? "✅ PASS" : "❌ FAIL";
      console.log(`  ${criterion.name}: ${status}`);
    });

    const allPassed = criteriaResults.every((c) => c.passed);
    console.log(
      `\n🏆 Overall Status: ${allPassed ? "✅ ALL CRITERIA MET" : "❌ SOME CRITERIA FAILED"}`,
    );

    // Generate and save report
    const report = generateMarkdownReport(results);
    const reportPath = `benchmark-report-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.md`;

    try {
      const fs = await import("fs/promises");
      await fs.writeFile(reportPath, report);
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.warn(`⚠️ Could not save report file: ${error}`);
      console.log("\n📄 Report content:");
      console.log(report);
    }

    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("❌ Benchmark execution failed:", error);
    process.exit(1);
  }
}

/**
 * Handle command line execution
 */
if (require.main === module) {
  // Handle command line arguments
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
NAPI vs WASM Performance Benchmark Script

Usage:
  node scripts/benchmark-wasm-vs-napi.ts [options]

Options:
  --help, -h     Show this help message
  --quick        Run quick benchmarks (fewer samples)
  --production   Run production-level benchmarks (default)

Examples:
  yarn benchmark:napi-vs-wasm
  node scripts/benchmark-wasm-vs-napi.ts --quick
`);
    process.exit(0);
  }

  if (args.includes("--quick")) {
    // Override config for quick testing
    Object.assign(PRODUCTION_BENCHMARK_CONFIG, {
      measurementRuns: 3,
      vectorCount: 100,
      searchQueries: 20,
      batchSizes: [1, 10, 50],
    });
    console.log("🏃 Running quick benchmarks...");
  }

  runBenchmarks().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

// Export for programmatic use
export { runBenchmarks, PRODUCTION_BENCHMARK_CONFIG, generateMarkdownReport };
