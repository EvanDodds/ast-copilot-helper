import { promises as fs } from "fs";
import { join } from "path";
import {
  TestReport,
  TestSummary,
  TestFailure,
  PerformanceMetrics,
} from "./integration-test-suite";

/**
 * Test report generation and analysis utilities
 */
export class TestReportGenerator {
  constructor(private outputDirectory: string = "./test-reports") {}

  /**
   * Generate a comprehensive test report
   */
  generateReport(results: any): TestReport {
    const summary = this.calculateSummary(results);
    const performance = this.aggregatePerformanceMetrics(results);
    const failures = this.extractFailures(results);
    const recommendations = this.generateRecommendations(
      results,
      summary,
      performance,
    );

    return {
      summary,
      performance,
      failures,
      recommendations,
    };
  }

  /**
   * Save report to file system
   */
  async saveReport(
    report: TestReport,
    format: "json" | "html" | "junit" = "json",
  ): Promise<string> {
    await fs.mkdir(this.outputDirectory, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `integration-test-report-${timestamp}`;
    const filepath = join(this.outputDirectory, `${filename}.${format}`);

    let content: string;

    switch (format) {
      case "json":
        content = JSON.stringify(report, null, 2);
        break;
      case "html":
        content = this.generateHtmlReport(report);
        break;
      case "junit":
        content = this.generateJunitReport(report);
        break;
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }

    await fs.writeFile(filepath, content);
    console.log(`Test report saved: ${filepath}`);

    return filepath;
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: TestReport): string {
    const passRate =
      report.summary.totalTests > 0
        ? ((report.summary.passed / report.summary.totalTests) * 100).toFixed(1)
        : "0";

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Integration Test Report</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .summary { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            padding: 30px; 
            background: #f8f9fa;
        }
        .metric { 
            text-align: center; 
            padding: 20px; 
            background: white; 
            border-radius: 8px; 
            border-left: 4px solid #007bff;
        }
        .metric.passed { border-left-color: #28a745; }
        .metric.failed { border-left-color: #dc3545; }
        .metric h3 { margin: 0 0 10px 0; color: #333; font-size: 0.9em; text-transform: uppercase; }
        .metric .value { font-size: 2em; font-weight: bold; margin: 0; }
        .metric .unit { font-size: 0.8em; color: #666; }
        .section { padding: 30px; border-top: 1px solid #e9ecef; }
        .section h2 { margin: 0 0 20px 0; color: #333; }
        .performance-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 15px; 
        }
        .perf-item { 
            background: #f8f9fa; 
            padding: 15px; 
            border-radius: 6px; 
            text-align: center;
        }
        .failures { background: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 20px; }
        .failure-item { 
            background: white; 
            margin: 10px 0; 
            padding: 15px; 
            border-radius: 6px; 
            border-left: 4px solid #dc3545;
        }
        .failure-title { font-weight: bold; color: #dc3545; margin-bottom: 8px; }
        .failure-error { color: #721c24; font-family: monospace; font-size: 0.9em; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; }
        .recommendation { 
            background: white; 
            margin: 10px 0; 
            padding: 12px; 
            border-radius: 6px; 
            border-left: 4px solid #ffc107;
        }
        .pass-rate { 
            font-size: 1.2em; 
            font-weight: bold; 
            color: ${parseFloat(passRate) >= 80 ? "#28a745" : parseFloat(passRate) >= 60 ? "#ffc107" : "#dc3545"};
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Integration Test Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p class="pass-rate">Pass Rate: ${passRate}%</p>
        </div>

        <div class="summary">
            <div class="metric">
                <h3>Total Tests</h3>
                <p class="value">${report.summary.totalTests}</p>
            </div>
            <div class="metric passed">
                <h3>Passed</h3>
                <p class="value">${report.summary.passed}</p>
            </div>
            <div class="metric failed">
                <h3>Failed</h3>
                <p class="value">${report.summary.failed}</p>
            </div>
            <div class="metric">
                <h3>Duration</h3>
                <p class="value">${(report.summary.duration / 1000).toFixed(1)}</p>
                <p class="unit">seconds</p>
            </div>
        </div>

        <div class="section">
            <h2>Performance Metrics</h2>
            <div class="performance-grid">
                <div class="perf-item">
                    <h4>Parse Time</h4>
                    <p>${report.performance.parseTime}ms</p>
                </div>
                <div class="perf-item">
                    <h4>Index Time</h4>
                    <p>${report.performance.indexTime}ms</p>
                </div>
                <div class="perf-item">
                    <h4>Query Time</h4>
                    <p>${report.performance.queryTime}ms</p>
                </div>
                <div class="perf-item">
                    <h4>Memory Usage</h4>
                    <p>${(report.performance.memoryUsage / 1024 / 1024).toFixed(1)}MB</p>
                </div>
            </div>
        </div>

        ${
          report.failures.length > 0
            ? `
        <div class="section">
            <h2>Test Failures (${report.failures.length})</h2>
            <div class="failures">
                ${report.failures
                  .map(
                    (failure: TestFailure) => `
                <div class="failure-item">
                    <div class="failure-title">${failure.testName}</div>
                    <div class="failure-error">${failure.error}</div>
                </div>
                `,
                  )
                  .join("")}
            </div>
        </div>
        `
            : ""
        }

        ${
          report.recommendations.length > 0
            ? `
        <div class="section">
            <h2>Recommendations (${report.recommendations.length})</h2>
            <div class="recommendations">
                ${report.recommendations
                  .map(
                    (rec: string) => `
                <div class="recommendation">${rec}</div>
                `,
                  )
                  .join("")}
            </div>
        </div>
        `
            : ""
        }
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate JUnit XML report
   */
  private generateJunitReport(report: TestReport): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${report.summary.totalTests}" 
            failures="${report.summary.failed}"
            time="${report.summary.duration / 1000}">
  <testsuite name="IntegrationTests" 
             tests="${report.summary.totalTests}"
             failures="${report.summary.failed}"
             time="${report.summary.duration / 1000}">
    ${report.failures
      .map(
        (failure: TestFailure) => `
    <testcase name="${failure.testName}" time="0">
      <failure message="${failure.error}">${failure.stackTrace}</failure>
    </testcase>
    `,
      )
      .join("")}
  </testsuite>
</testsuites>`;
  }

  private calculateSummary(results: any): TestSummary {
    // This would be implemented based on the actual results structure
    return {
      totalTests: 0,
      passed: 0,
      failed: 0,
      duration: 0,
      coverage: { statements: 0, branches: 0, functions: 0, lines: 0 },
    };
  }

  private aggregatePerformanceMetrics(results: any): PerformanceMetrics {
    // This would aggregate performance metrics from all test suites
    return {
      parseTime: 0,
      indexTime: 0,
      queryTime: 0,
      memoryUsage: 0,
      diskUsage: 0,
    };
  }

  private extractFailures(results: any): TestFailure[] {
    // This would extract failure information from results
    return [];
  }

  private generateRecommendations(
    results: any,
    summary: TestSummary,
    performance: PerformanceMetrics,
  ): string[] {
    const recommendations: string[] = [];

    // Performance-based recommendations
    if (performance.queryTime > 200) {
      recommendations.push(
        "Query response time exceeds 200ms threshold. Consider optimizing query operations.",
      );
    }

    if (performance.memoryUsage > 1000000000) {
      // 1GB
      recommendations.push(
        "Memory usage is high (>1GB). Review memory-intensive operations and add cleanup.",
      );
    }

    if (performance.parseTime > 10000) {
      // 10 seconds
      recommendations.push(
        "Parse time is high (>10s). Consider optimizing parser or reducing file count.",
      );
    }

    // Test result-based recommendations
    if (summary.failed > 0) {
      const failureRate = (summary.failed / summary.totalTests) * 100;
      if (failureRate > 20) {
        recommendations.push(
          `High failure rate (${failureRate.toFixed(1)}%). Review failing tests and system stability.`,
        );
      }
    }

    if (summary.totalTests === 0) {
      recommendations.push(
        "No tests were executed. Verify test configuration and execution.",
      );
    }

    // Coverage-based recommendations
    if (summary.coverage.statements < 80) {
      recommendations.push(
        `Statement coverage is low (${summary.coverage.statements}%). Increase test coverage.`,
      );
    }

    return recommendations;
  }
}

/**
 * Performance benchmarking utilities
 */
export class PerformanceBenchmarks {
  private static readonly BENCHMARKS = {
    parseTime: { excellent: 1000, good: 5000, poor: 10000 }, // ms
    queryTime: { excellent: 50, good: 150, poor: 300 }, // ms
    memoryUsage: { excellent: 100, good: 500, poor: 1000 }, // MB
    indexTime: { excellent: 2000, good: 10000, poor: 30000 }, // ms
  };

  static evaluatePerformance(metrics: PerformanceMetrics): {
    overall: "excellent" | "good" | "poor";
    details: Record<string, "excellent" | "good" | "poor">;
  } {
    const memoryMB = metrics.memoryUsage / 1024 / 1024;

    const evaluations = {
      parseTime: this.evaluateMetric(
        metrics.parseTime,
        this.BENCHMARKS.parseTime,
      ),
      queryTime: this.evaluateMetric(
        metrics.queryTime,
        this.BENCHMARKS.queryTime,
      ),
      memoryUsage: this.evaluateMetric(memoryMB, this.BENCHMARKS.memoryUsage),
      indexTime: this.evaluateMetric(
        metrics.indexTime,
        this.BENCHMARKS.indexTime,
      ),
    };

    // Calculate overall score
    const scores = Object.values(evaluations).map((score) => {
      switch (score) {
        case "excellent":
          return 3;
        case "good":
          return 2;
        case "poor":
          return 1;
        default:
          return 1;
      }
    });

    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const overall =
      averageScore >= 2.5 ? "excellent" : averageScore >= 1.5 ? "good" : "poor";

    return { overall, details: evaluations };
  }

  private static evaluateMetric(
    value: number,
    thresholds: { excellent: number; good: number; poor: number },
  ): "excellent" | "good" | "poor" {
    if (value <= thresholds.excellent) {
      return "excellent";
    }
    if (value <= thresholds.good) {
      return "good";
    }
    return "poor";
  }

  static generatePerformanceReport(metrics: PerformanceMetrics): string {
    const evaluation = this.evaluatePerformance(metrics);
    const memoryMB = (metrics.memoryUsage / 1024 / 1024).toFixed(1);

    return `
Performance Evaluation: ${evaluation.overall.toUpperCase()}

Metrics:
- Parse Time: ${metrics.parseTime}ms (${evaluation.details.parseTime})
- Index Time: ${metrics.indexTime}ms (${evaluation.details.indexTime})
- Query Time: ${metrics.queryTime}ms (${evaluation.details.queryTime})  
- Memory Usage: ${memoryMB}MB (${evaluation.details.memoryUsage})

Recommendations:
${evaluation.overall === "poor" ? "⚠️  Performance needs improvement. Review system resources and optimization opportunities." : ""}
${evaluation.details.parseTime === "poor" ? "- Optimize parsing operations or reduce file count" : ""}
${evaluation.details.queryTime === "poor" ? "- Optimize query execution and indexing" : ""}
${evaluation.details.memoryUsage === "poor" ? "- Review memory usage and add cleanup operations" : ""}
${evaluation.details.indexTime === "poor" ? "- Optimize indexing operations" : ""}
    `.trim();
  }
}
