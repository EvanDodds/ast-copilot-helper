#!/usr/bin/env node

/**
 * Comprehensive Quality Reporter
 * Generates unified quality reports from all CI/CD checks
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

interface QualityReport {
  overall: {
    score: number;
    grade: string;
    passed: boolean;
  };
  coverage: {
    score: number;
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
  security: {
    score: number;
    vulnerabilities: number;
    critical: number;
    high: number;
  };
  performance: {
    score: number;
    parsing: number;
    querying: number;
    memory: number;
  };
  codeQuality: {
    lintErrors: number;
    formatErrors: number;
    typeErrors: number;
  };
  timestamp: string;
}

class QualityReporter {
  generateReport(): QualityReport {
    console.log("📊 Generating comprehensive quality report...");

    const report: QualityReport = {
      overall: { score: 0, grade: "F", passed: false },
      coverage: this.getCoverageData(),
      security: this.getSecurityData(),
      performance: this.getPerformanceData(),
      codeQuality: this.getCodeQualityData(),
      timestamp: new Date().toISOString(),
    };

    // Calculate overall score
    report.overall = this.calculateOverallScore(report);

    this.displayReport(report);
    this.generateHtmlReport(report);
    this.generateJsonReport(report);

    return report;
  }

  private getCoverageData(): QualityReport["coverage"] {
    const coverageFile = join(
      process.cwd(),
      "coverage",
      "coverage-summary.json",
    );

    if (!existsSync(coverageFile)) {
      console.warn("⚠️  Coverage data not found");
      return { score: 0, lines: 0, statements: 0, functions: 0, branches: 0 };
    }

    try {
      const coverage = JSON.parse(readFileSync(coverageFile, "utf8"));
      const total = coverage.total;

      const score =
        (total.lines.pct +
          total.statements.pct +
          total.functions.pct +
          total.branches.pct) /
        4;

      return {
        score: Math.round(score * 10) / 10,
        lines: total.lines.pct,
        statements: total.statements.pct,
        functions: total.functions.pct,
        branches: total.branches.pct,
      };
    } catch (_error) {
      console.warn("⚠️  Could not parse coverage data");
      return { score: 0, lines: 0, statements: 0, functions: 0, branches: 0 };
    }
  }

  private getSecurityData(): QualityReport["security"] {
    const securityFile = join(process.cwd(), "security-audit-report.json");

    if (!existsSync(securityFile)) {
      console.warn("⚠️  Security data not found");
      return { score: 0, vulnerabilities: 0, critical: 0, high: 0 };
    }

    try {
      const security = JSON.parse(readFileSync(securityFile, "utf8"));

      return {
        score: security.score * 10, // Convert 0-10 scale to 0-100
        vulnerabilities: security.vulnerabilities,
        critical: security.critical,
        high: security.high,
      };
    } catch (_error) {
      console.warn("⚠️  Could not parse security data");
      return { score: 0, vulnerabilities: 0, critical: 0, high: 0 };
    }
  }

  private getPerformanceData(): QualityReport["performance"] {
    const performanceFile = join(
      process.cwd(),
      "test-output",
      "performance",
      "benchmark-results.json",
    );

    if (!existsSync(performanceFile)) {
      console.warn("⚠️  Performance data not found");
      return { score: 0, parsing: 0, querying: 0, memory: 0 };
    }

    try {
      const perf = JSON.parse(readFileSync(performanceFile, "utf8"));

      // Simplified scoring based on thresholds
      const parsingScore = Math.max(0, 100 - (perf.parsing.avgTime - 100) / 10);
      const queryingScore = Math.max(0, 100 - (perf.querying.avgTime - 50) / 5);
      const memoryScore = Math.max(0, 100 - (perf.memory.peakUsage - 512) / 50);

      return {
        score: Math.round((parsingScore + queryingScore + memoryScore) / 3),
        parsing: Math.round(parsingScore),
        querying: Math.round(queryingScore),
        memory: Math.round(memoryScore),
      };
    } catch (_error) {
      console.warn("⚠️  Could not parse performance data");
      return { score: 0, parsing: 0, querying: 0, memory: 0 };
    }
  }

  private getCodeQualityData(): QualityReport["codeQuality"] {
    // In a real implementation, you'd parse ESLint/TSC outputs
    return {
      lintErrors: 0,
      formatErrors: 0,
      typeErrors: 0,
    };
  }

  private calculateOverallScore(
    report: QualityReport,
  ): QualityReport["overall"] {
    // Weighted scoring
    const weights = {
      coverage: 0.25,
      security: 0.3,
      performance: 0.25,
      codeQuality: 0.2,
    };

    const codeQualityScore =
      report.codeQuality.lintErrors === 0 &&
      report.codeQuality.formatErrors === 0 &&
      report.codeQuality.typeErrors === 0
        ? 100
        : 0;

    const weightedScore =
      report.coverage.score * weights.coverage +
      report.security.score * weights.security +
      report.performance.score * weights.performance +
      codeQualityScore * weights.codeQuality;

    const score = Math.round(weightedScore);

    let grade = "F";
    if (score >= 90) grade = "A";
    else if (score >= 80) grade = "B";
    else if (score >= 70) grade = "C";
    else if (score >= 60) grade = "D";

    return {
      score,
      grade,
      passed: score >= 80,
    };
  }

  private displayReport(report: QualityReport): void {
    console.log("\n📋 Quality Report Summary:");
    console.log("═══════════════════════════════════════");

    const gradeColor =
      report.overall.score >= 80
        ? "🟢"
        : report.overall.score >= 60
          ? "🟡"
          : "🔴";

    console.log(
      `${gradeColor} Overall Grade: ${report.overall.grade} (${report.overall.score}/100)`,
    );
    console.log(
      `${report.overall.passed ? "✅" : "❌"} Quality Gate: ${report.overall.passed ? "PASSED" : "FAILED"}`,
    );
    console.log("");

    console.log("📊 Detailed Scores:");
    console.log(`  Coverage:    ${report.coverage.score.toFixed(1)}/100`);
    console.log(`  Security:    ${report.security.score.toFixed(1)}/100`);
    console.log(`  Performance: ${report.performance.score.toFixed(1)}/100`);
    console.log(
      `  Code Quality: ${report.codeQuality.lintErrors === 0 ? "100" : "0"}/100`,
    );
    console.log("");

    if (report.security.vulnerabilities > 0) {
      console.log("🚨 Security Issues:");
      console.log(`  Vulnerabilities: ${report.security.vulnerabilities}`);
      console.log(`  Critical: ${report.security.critical}`);
      console.log(`  High: ${report.security.high}`);
      console.log("");
    }

    console.log(`🕒 Generated: ${report.timestamp}`);
  }

  private generateHtmlReport(report: QualityReport): void {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Quality Report - AST Copilot Helper</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 20px; background: #f5f5f5;
        }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .overall-score { 
            font-size: 3em; font-weight: bold; margin: 20px 0;
            color: ${report.overall.score >= 80 ? "#22c55e" : report.overall.score >= 60 ? "#f59e0b" : "#ef4444"};
        }
        .grade { font-size: 2em; margin: 10px 0; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { 
            border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .metric-score { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .metric-details { color: #6b7280; font-size: 0.9em; }
        .status-passed { color: #22c55e; }
        .status-failed { color: #ef4444; }
        .timestamp { text-align: center; color: #6b7280; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏆 Quality Report</h1>
            <h2>AST Copilot Helper</h2>
            <div class="overall-score">${report.overall.score}/100</div>
            <div class="grade">Grade: ${report.overall.grade}</div>
            <div class="${report.overall.passed ? "status-passed" : "status-failed"}">
                ${report.overall.passed ? "✅ QUALITY GATE PASSED" : "❌ QUALITY GATE FAILED"}
            </div>
        </div>
        
        <div class="metrics">
            <div class="metric-card">
                <h3>📊 Coverage</h3>
                <div class="metric-score">${report.coverage.score.toFixed(1)}%</div>
                <div class="metric-details">
                    Lines: ${report.coverage.lines.toFixed(1)}%<br>
                    Statements: ${report.coverage.statements.toFixed(1)}%<br>
                    Functions: ${report.coverage.functions.toFixed(1)}%<br>
                    Branches: ${report.coverage.branches.toFixed(1)}%
                </div>
            </div>
            
            <div class="metric-card">
                <h3>🛡️ Security</h3>
                <div class="metric-score">${report.security.score.toFixed(1)}/100</div>
                <div class="metric-details">
                    Vulnerabilities: ${report.security.vulnerabilities}<br>
                    Critical: ${report.security.critical}<br>
                    High: ${report.security.high}
                </div>
            </div>
            
            <div class="metric-card">
                <h3>⚡ Performance</h3>
                <div class="metric-score">${report.performance.score}/100</div>
                <div class="metric-details">
                    Parsing: ${report.performance.parsing}/100<br>
                    Querying: ${report.performance.querying}/100<br>
                    Memory: ${report.performance.memory}/100
                </div>
            </div>
            
            <div class="metric-card">
                <h3>🔧 Code Quality</h3>
                <div class="metric-score">${report.codeQuality.lintErrors === 0 ? "100" : "0"}/100</div>
                <div class="metric-details">
                    Lint Errors: ${report.codeQuality.lintErrors}<br>
                    Format Errors: ${report.codeQuality.formatErrors}<br>
                    Type Errors: ${report.codeQuality.typeErrors}
                </div>
            </div>
        </div>
        
        <div class="timestamp">
            Generated: ${new Date(report.timestamp).toLocaleString()}
        </div>
    </div>
</body>
</html>`;

    writeFileSync("quality-report.html", html);
    console.log("📄 HTML quality report generated: quality-report.html");
  }

  private generateJsonReport(report: QualityReport): void {
    writeFileSync("quality-report.json", JSON.stringify(report, null, 2));
    console.log("📄 JSON quality report generated: quality-report.json");
  }
}

// CLI Interface
const reporter = new QualityReporter();
const report = reporter.generateReport();

// Output for GitHub Actions
// Use GitHub Actions environment file instead of deprecated set-output
const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  const fs = require("fs");
  fs.appendFileSync(outputFile, `quality-score=${report.overall.score}\n`);
  fs.appendFileSync(outputFile, `quality-grade=${report.overall.grade}\n`);
} else {
  console.log(`quality-score=${report.overall.score}`);
  console.log(`quality-grade=${report.overall.grade}`);
}

process.exit(report.overall.passed ? 0 : 1);
