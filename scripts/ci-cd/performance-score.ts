#!/usr/bin/env node

/**
 * Performance Benchmark Scorer
 * Analyzes performance test results and provides scoring
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

interface PerformanceMetrics {
  parsing: {
    avgTime: number;
    maxTime: number;
    throughput: number; // files per second
  };
  querying: {
    avgTime: number;
    maxTime: number;
    throughput: number; // queries per second
  };
  indexing: {
    avgTime: number;
    maxTime: number;
    throughput: number; // items per second
  };
  memory: {
    peakUsage: number; // MB
    avgUsage: number; // MB
  };
}

interface PerformanceThresholds {
  parsing: {
    maxAvgTime: number; // ms
    minThroughput: number; // files/sec
  };
  querying: {
    maxAvgTime: number; // ms
    minThroughput: number; // queries/sec
  };
  indexing: {
    maxAvgTime: number; // ms
    minThroughput: number; // items/sec
  };
  memory: {
    maxPeakUsage: number; // MB
    maxAvgUsage: number; // MB
  };
}

class PerformanceScorer {
  private thresholds: PerformanceThresholds;

  constructor() {
    this.thresholds = {
      parsing: {
        maxAvgTime: 100, // 100ms average parsing time
        minThroughput: 10, // 10 files per second
      },
      querying: {
        maxAvgTime: 50, // 50ms average query time
        minThroughput: 20, // 20 queries per second
      },
      indexing: {
        maxAvgTime: 200, // 200ms average indexing time
        minThroughput: 5, // 5 items per second
      },
      memory: {
        maxPeakUsage: 512, // 512MB peak memory
        maxAvgUsage: 256, // 256MB average memory
      },
    };
  }

  analyzePerformance(): number {
    const performanceFile = join(
      process.cwd(),
      "test-output",
      "performance",
      "benchmark-results.json",
    );

    if (!existsSync(performanceFile)) {
      console.error(
        "❌ Performance results not found. Run performance tests first.",
      );
      return 0;
    }

    try {
      const results = JSON.parse(
        readFileSync(performanceFile, "utf8"),
      ) as PerformanceMetrics;

      console.log("⚡ Performance Analysis:");
      this.displayMetrics(results);

      const score = this.calculateScore(results);
      this.generateReport(results, score);

      return score;
    } catch (error) {
      console.error("❌ Error reading performance results:", error);
      return 0;
    }
  }

  private displayMetrics(metrics: PerformanceMetrics): void {
    console.log("\n📊 Performance Metrics:");
    console.log(`  Parsing:`);
    console.log(`    Average Time: ${metrics.parsing.avgTime.toFixed(2)}ms`);
    console.log(
      `    Throughput: ${metrics.parsing.throughput.toFixed(2)} files/sec`,
    );

    console.log(`  Querying:`);
    console.log(`    Average Time: ${metrics.querying.avgTime.toFixed(2)}ms`);
    console.log(
      `    Throughput: ${metrics.querying.throughput.toFixed(2)} queries/sec`,
    );

    console.log(`  Indexing:`);
    console.log(`    Average Time: ${metrics.indexing.avgTime.toFixed(2)}ms`);
    console.log(
      `    Throughput: ${metrics.indexing.throughput.toFixed(2)} items/sec`,
    );

    console.log(`  Memory:`);
    console.log(`    Peak Usage: ${metrics.memory.peakUsage.toFixed(2)}MB`);
    console.log(`    Average Usage: ${metrics.memory.avgUsage.toFixed(2)}MB`);
  }

  private calculateScore(metrics: PerformanceMetrics): number {
    let score = 100; // Start with perfect score

    // Parsing performance
    if (metrics.parsing.avgTime > this.thresholds.parsing.maxAvgTime) {
      const penalty = Math.min(
        30,
        (metrics.parsing.avgTime - this.thresholds.parsing.maxAvgTime) / 10,
      );
      score -= penalty;
    }

    if (metrics.parsing.throughput < this.thresholds.parsing.minThroughput) {
      const penalty = Math.min(
        20,
        (this.thresholds.parsing.minThroughput - metrics.parsing.throughput) *
          2,
      );
      score -= penalty;
    }

    // Querying performance
    if (metrics.querying.avgTime > this.thresholds.querying.maxAvgTime) {
      const penalty = Math.min(
        25,
        (metrics.querying.avgTime - this.thresholds.querying.maxAvgTime) / 5,
      );
      score -= penalty;
    }

    if (metrics.querying.throughput < this.thresholds.querying.minThroughput) {
      const penalty = Math.min(
        15,
        this.thresholds.querying.minThroughput - metrics.querying.throughput,
      );
      score -= penalty;
    }

    // Indexing performance
    if (metrics.indexing.avgTime > this.thresholds.indexing.maxAvgTime) {
      const penalty = Math.min(
        20,
        (metrics.indexing.avgTime - this.thresholds.indexing.maxAvgTime) / 20,
      );
      score -= penalty;
    }

    // Memory usage
    if (metrics.memory.peakUsage > this.thresholds.memory.maxPeakUsage) {
      const penalty = Math.min(
        15,
        (metrics.memory.peakUsage - this.thresholds.memory.maxPeakUsage) / 50,
      );
      score -= penalty;
    }

    if (metrics.memory.avgUsage > this.thresholds.memory.maxAvgUsage) {
      const penalty = Math.min(
        10,
        (metrics.memory.avgUsage - this.thresholds.memory.maxAvgUsage) / 25,
      );
      score -= penalty;
    }

    return Math.max(0, Math.round(score));
  }

  private generateReport(metrics: PerformanceMetrics, score: number): void {
    console.log("\n🎯 Performance Analysis:");

    const checks = [
      {
        name: "Parsing Speed",
        actual: metrics.parsing.avgTime,
        threshold: this.thresholds.parsing.maxAvgTime,
        passed: metrics.parsing.avgTime <= this.thresholds.parsing.maxAvgTime,
        unit: "ms (lower is better)",
      },
      {
        name: "Parsing Throughput",
        actual: metrics.parsing.throughput,
        threshold: this.thresholds.parsing.minThroughput,
        passed:
          metrics.parsing.throughput >= this.thresholds.parsing.minThroughput,
        unit: "files/sec (higher is better)",
      },
      {
        name: "Query Speed",
        actual: metrics.querying.avgTime,
        threshold: this.thresholds.querying.maxAvgTime,
        passed: metrics.querying.avgTime <= this.thresholds.querying.maxAvgTime,
        unit: "ms (lower is better)",
      },
      {
        name: "Query Throughput",
        actual: metrics.querying.throughput,
        threshold: this.thresholds.querying.minThroughput,
        passed:
          metrics.querying.throughput >= this.thresholds.querying.minThroughput,
        unit: "queries/sec (higher is better)",
      },
      {
        name: "Memory Usage",
        actual: metrics.memory.peakUsage,
        threshold: this.thresholds.memory.maxPeakUsage,
        passed: metrics.memory.peakUsage <= this.thresholds.memory.maxPeakUsage,
        unit: "MB (lower is better)",
      },
    ];

    checks.forEach((check) => {
      const status = check.passed ? "✅" : "❌";
      console.log(
        `  ${status} ${check.name}: ${check.actual.toFixed(2)} ${check.unit}`,
      );
      console.log(`      Threshold: ${check.threshold} ${check.unit}`);
    });

    console.log(`\n📈 Overall Performance Score: ${score}/100`);

    const threshold = 80;
    const passed = score >= threshold;

    console.log(
      `${passed ? "✅" : "❌"} Performance check ${passed ? "passed" : "failed"} (threshold: ${threshold}/100)`,
    );

    // Generate HTML report
    this.generateHtmlReport(metrics, score, checks);

    if (!passed) {
      console.log("\n💡 Performance Optimization Suggestions:");
      if (metrics.parsing.avgTime > this.thresholds.parsing.maxAvgTime) {
        console.log("  - Optimize parsing algorithms");
        console.log("  - Consider parallel parsing for large files");
      }
      if (metrics.querying.avgTime > this.thresholds.querying.maxAvgTime) {
        console.log("  - Optimize database queries");
        console.log("  - Add query result caching");
      }
      if (metrics.memory.peakUsage > this.thresholds.memory.maxPeakUsage) {
        console.log("  - Implement memory pooling");
        console.log("  - Optimize data structures");
      }
    }
  }

  private generateHtmlReport(
    metrics: PerformanceMetrics,
    score: number,
    checks: any[],
  ): void {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .score { font-size: 2em; font-weight: bold; color: ${score >= 80 ? "green" : score >= 60 ? "orange" : "red"}; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .passed { color: green; }
        .failed { color: red; }
    </style>
</head>
<body>
    <h1>AST Copilot Helper - Performance Report</h1>
    <div class="score">Performance Score: ${score}/100</div>
    
    <h2>Detailed Metrics</h2>
    <div class="metrics">
        ${checks
          .map(
            (check) => `
            <div class="metric">
                <h3 class="${check.passed ? "passed" : "failed"}">${check.name}</h3>
                <p>Actual: ${check.actual.toFixed(2)} ${check.unit}</p>
                <p>Threshold: ${check.threshold} ${check.unit}</p>
                <p>Status: ${check.passed ? "✅ PASSED" : "❌ FAILED"}</p>
            </div>
        `,
          )
          .join("")}
    </div>
    
    <h2>Raw Metrics</h2>
    <pre>${JSON.stringify(metrics, null, 2)}</pre>
</body>
</html>`;

    writeFileSync(join(process.cwd(), "performance-report.html"), html);
    console.log(
      "📄 HTML performance report generated: performance-report.html",
    );
  }
}

// CLI Interface
const scorer = new PerformanceScorer();
const score = scorer.analyzePerformance();

// Output score for GitHub Actions
console.log(`::set-output name=performance-score::${score}`);

process.exit(score >= 80 ? 0 : 1);
