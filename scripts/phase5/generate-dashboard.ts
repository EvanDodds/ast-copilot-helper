#!/usr/bin/env tsx
/**
 * Phase 5 Performance Dashboard Generator
 *
 * This script generates an interactive HTML dashboard displaying performance trends,
 * benchmark comparisons, and regression analysis for Phase 5 testing.
 *
 * Usage:
 *   yarn phase5:dashboard
 *   tsx scripts/phase5/generate-dashboard.ts
 *   tsx scripts/phase5/generate-dashboard.ts --open  # Open in browser after generation
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

interface BaselineData {
  timestamp: string;
  nodeVersion: string;
  commitHash: string;
  systemInfo: {
    platform: string;
    arch: string;
    cpus: number;
    totalMemory: number;
  };
  benchmarks: {
    [testName: string]: {
      averageTime: number;
      standardDeviation: number;
      memoryUsage: number;
      iterations: number;
      confidence: number;
    };
  };
}

interface DashboardData {
  generatedAt: string;
  currentCommit: string;
  baselineHistory: BaselineData[];
  latestComparison: any;
  trends: {
    [benchmarkName: string]: {
      timeValues: number[];
      memoryValues: number[];
      timestamps: string[];
      commits: string[];
    };
  };
  summary: {
    totalBenchmarks: number;
    averagePerformance: number;
    memoryUsage: number;
    lastRegressions: number;
    performanceTrend: "improving" | "stable" | "degrading";
  };
}

async function loadBaselineHistory(): Promise<BaselineData[]> {
  const baselinesDir = join(process.cwd(), "ci-artifacts", "baselines");

  if (!existsSync(baselinesDir)) {
    console.log("⚠️  No baselines directory found");
    return [];
  }

  const baselineFiles = readdirSync(baselinesDir)
    .filter((file) => file.startsWith("baseline-") && file.endsWith(".json"))
    .sort()
    .reverse() // Most recent first
    .slice(0, 20); // Last 20 baselines

  const history: BaselineData[] = [];

  for (const file of baselineFiles) {
    try {
      const content = readFileSync(join(baselinesDir, file), "utf8");
      const baseline: BaselineData = JSON.parse(content);
      history.push(baseline);
    } catch (error) {
      console.warn(`⚠️  Failed to load baseline file ${file}:`, error);
    }
  }

  // Also include current baseline if it exists
  const currentBaselinePath = join(baselinesDir, "current-baseline.json");
  if (existsSync(currentBaselinePath)) {
    try {
      const content = readFileSync(currentBaselinePath, "utf8");
      const baseline: BaselineData = JSON.parse(content);

      // Only add if not already in history
      if (!history.some((h) => h.timestamp === baseline.timestamp)) {
        history.unshift(baseline);
      }
    } catch (error) {
      console.warn("⚠️  Failed to load current baseline:", error);
    }
  }

  return history.slice(0, 20); // Limit to 20 most recent
}

async function loadLatestComparison(): Promise<any> {
  const comparisonPath = join(
    process.cwd(),
    "ci-artifacts",
    "baseline-comparison-report.json",
  );

  if (!existsSync(comparisonPath)) {
    return null;
  }

  try {
    const content = readFileSync(comparisonPath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.warn("⚠️  Failed to load comparison report:", error);
    return null;
  }
}

function generateTrends(history: BaselineData[]): DashboardData["trends"] {
  const trends: DashboardData["trends"] = {};

  if (history.length === 0) return trends;

  // Get all benchmark names from the most recent baseline
  const benchmarkNames = Object.keys(history[0].benchmarks);

  for (const benchmarkName of benchmarkNames) {
    trends[benchmarkName] = {
      timeValues: [],
      memoryValues: [],
      timestamps: [],
      commits: [],
    };

    // Collect data points from history (reverse to get chronological order)
    for (const baseline of history.reverse()) {
      if (baseline.benchmarks[benchmarkName]) {
        const benchmark = baseline.benchmarks[benchmarkName];
        trends[benchmarkName].timeValues.push(benchmark.averageTime);
        trends[benchmarkName].memoryValues.push(benchmark.memoryUsage);
        trends[benchmarkName].timestamps.push(baseline.timestamp);
        trends[benchmarkName].commits.push(baseline.commitHash.substring(0, 8));
      }
    }
  }

  return trends;
}

function calculateSummary(
  history: BaselineData[],
  latestComparison: any,
): DashboardData["summary"] {
  if (history.length === 0) {
    return {
      totalBenchmarks: 0,
      averagePerformance: 0,
      memoryUsage: 0,
      lastRegressions: 0,
      performanceTrend: "stable",
    };
  }

  const latest = history[0];
  const benchmarkNames = Object.keys(latest.benchmarks);

  const averagePerformance =
    benchmarkNames.reduce(
      (sum, name) => sum + latest.benchmarks[name].averageTime,
      0,
    ) / benchmarkNames.length;

  const memoryUsage = benchmarkNames.reduce(
    (sum, name) => sum + latest.benchmarks[name].memoryUsage,
    0,
  );

  // Determine trend by comparing first and last baselines
  let performanceTrend: "improving" | "stable" | "degrading" = "stable";
  if (history.length >= 3) {
    const oldest = history[history.length - 1];
    const oldAvg =
      benchmarkNames.reduce(
        (sum, name) =>
          sum + (oldest.benchmarks[name]?.averageTime || averagePerformance),
        0,
      ) / benchmarkNames.length;

    const change = (averagePerformance - oldAvg) / oldAvg;
    if (change > 0.05) performanceTrend = "degrading";
    else if (change < -0.05) performanceTrend = "improving";
  }

  return {
    totalBenchmarks: benchmarkNames.length,
    averagePerformance,
    memoryUsage,
    lastRegressions: latestComparison?.summary?.regressions || 0,
    performanceTrend,
  };
}

function generateDashboardHTML(data: DashboardData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phase 5 Performance Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            color: #2d3748;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 2rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header p { opacity: 0.9; font-size: 1.1rem; }
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 1.5rem; 
            margin-bottom: 2rem; 
        }
        .stat-card { 
            background: white; 
            padding: 1.5rem; 
            border-radius: 12px; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            border-left: 4px solid;
        }
        .stat-card.performance { border-left-color: #3182ce; }
        .stat-card.memory { border-left-color: #38a169; }
        .stat-card.regressions { border-left-color: #e53e3e; }
        .stat-card.trend { border-left-color: #805ad5; }
        .stat-value { font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem; }
        .stat-label { color: #718096; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .chart-container { 
            background: white; 
            padding: 2rem; 
            border-radius: 12px; 
            margin-bottom: 2rem;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .chart-title { font-size: 1.5rem; margin-bottom: 1rem; color: #2d3748; }
        .chart-wrapper { position: relative; height: 400px; }
        .trend-improving { color: #38a169; }
        .trend-stable { color: #3182ce; }
        .trend-degrading { color: #e53e3e; }
        .footer { 
            text-align: center; 
            color: #718096; 
            margin-top: 2rem; 
            padding: 1rem;
        }
        .commit-info { 
            background: #edf2f7; 
            padding: 1rem; 
            border-radius: 8px; 
            margin-bottom: 1rem;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Phase 5 Performance Dashboard</h1>
            <p>Comprehensive performance monitoring and regression analysis</p>
            <div class="commit-info">
                <strong>Generated:</strong> ${new Date(data.generatedAt).toLocaleString()}<br>
                <strong>Commit:</strong> ${data.currentCommit}<br>
                <strong>Baselines:</strong> ${data.baselineHistory.length} historical data points
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card performance">
                <div class="stat-value">${data.summary.totalBenchmarks}</div>
                <div class="stat-label">Total Benchmarks</div>
            </div>
            <div class="stat-card memory">
                <div class="stat-value">${data.summary.averagePerformance.toFixed(1)}ms</div>
                <div class="stat-label">Average Performance</div>
            </div>
            <div class="stat-card regressions">
                <div class="stat-value">${data.summary.lastRegressions}</div>
                <div class="stat-label">Recent Regressions</div>
            </div>
            <div class="stat-card trend">
                <div class="stat-value trend-${data.summary.performanceTrend}">
                    ${data.summary.performanceTrend.toUpperCase()}
                </div>
                <div class="stat-label">Performance Trend</div>
            </div>
        </div>

        <div class="chart-container">
            <h2 class="chart-title">📈 Performance Trends Over Time</h2>
            <div class="chart-wrapper">
                <canvas id="performanceChart" width="400" height="200"></canvas>
            </div>
        </div>

        <div class="chart-container">
            <h2 class="chart-title">💾 Memory Usage Trends</h2>
            <div class="chart-wrapper">
                <canvas id="memoryChart" width="400" height="200"></canvas>
            </div>
        </div>

        <div class="footer">
            <p>Generated by Phase 5 Testing Framework | Last updated: ${new Date(data.generatedAt).toLocaleString()}</p>
        </div>
    </div>

    <script>
        const dashboardData = ${JSON.stringify(data, null, 2)};
        
        // Performance Chart
        const performanceCtx = document.getElementById('performanceChart').getContext('2d');
        const performanceChart = new Chart(performanceCtx, {
            type: 'line',
            data: {
                labels: Object.values(dashboardData.trends)[0]?.timestamps.map(t => 
                    new Date(t).toLocaleDateString()) || [],
                datasets: Object.entries(dashboardData.trends).map(([name, trend], index) => ({
                    label: name,
                    data: trend.timeValues,
                    borderColor: [
                        '#3182ce', '#38a169', '#e53e3e', '#805ad5', 
                        '#d69e2e', '#00a3c4', '#dd6b20'
                    ][index % 7],
                    backgroundColor: [
                        '#3182ce20', '#38a16920', '#e53e3e20', '#805ad520',
                        '#d69e2e20', '#00a3c420', '#dd6b2020'
                    ][index % 7],
                    tension: 0.3,
                    fill: false
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Execution Time (ms)' }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Memory Chart
        const memoryCtx = document.getElementById('memoryChart').getContext('2d');
        const memoryChart = new Chart(memoryCtx, {
            type: 'line',
            data: {
                labels: Object.values(dashboardData.trends)[0]?.timestamps.map(t => 
                    new Date(t).toLocaleDateString()) || [],
                datasets: Object.entries(dashboardData.trends).map(([name, trend], index) => ({
                    label: name,
                    data: trend.memoryValues,
                    borderColor: [
                        '#38a169', '#3182ce', '#e53e3e', '#805ad5',
                        '#d69e2e', '#00a3c4', '#dd6b20'
                    ][index % 7],
                    backgroundColor: [
                        '#38a16920', '#3182ce20', '#e53e3e20', '#805ad520',
                        '#d69e2e20', '#00a3c420', '#dd6b2020'
                    ][index % 7],
                    tension: 0.3,
                    fill: false
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Memory Usage (MB)' }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    </script>
</body>
</html>`;
}

async function main(): Promise<void> {
  console.log("📊 Generating Phase 5 performance dashboard...");

  try {
    // Get current commit hash
    let currentCommit: string;
    try {
      currentCommit = execSync("git rev-parse HEAD", {
        encoding: "utf8",
      }).trim();
    } catch {
      currentCommit = "unknown";
    }

    // Load data
    console.log("📚 Loading baseline history...");
    const baselineHistory = await loadBaselineHistory();

    console.log("📈 Loading latest comparison...");
    const latestComparison = await loadLatestComparison();

    // Generate trends
    console.log("📊 Generating performance trends...");
    const trends = generateTrends(baselineHistory);

    // Calculate summary
    const summary = calculateSummary(baselineHistory, latestComparison);

    // Compile dashboard data
    const dashboardData: DashboardData = {
      generatedAt: new Date().toISOString(),
      currentCommit,
      baselineHistory,
      latestComparison,
      trends,
      summary,
    };

    // Generate HTML dashboard
    console.log("🎨 Generating HTML dashboard...");
    const dashboardHTML = generateDashboardHTML(dashboardData);

    // Save dashboard
    const dashboardPath = join(
      process.cwd(),
      "monitoring",
      "performance-dashboard.html",
    );
    writeFileSync(dashboardPath, dashboardHTML);

    // Save dashboard data
    const dataPath = join(process.cwd(), "monitoring", "dashboard-data.json");
    writeFileSync(dataPath, JSON.stringify(dashboardData, null, 2));

    console.log("✅ Dashboard generated successfully!");
    console.log(`📊 Dashboard: ${dashboardPath}`);
    console.log(`📁 Data: ${dataPath}`);
    console.log(`📈 ${summary.totalBenchmarks} benchmarks tracked`);
    console.log(`📚 ${baselineHistory.length} historical baselines loaded`);
    console.log(`🎯 Performance trend: ${summary.performanceTrend}`);

    // Open in browser if requested
    if (process.argv.includes("--open")) {
      try {
        const open = await import("open");
        await open.default(dashboardPath);
        console.log("🌐 Opened dashboard in browser");
      } catch {
        console.log("💡 To view dashboard, open: " + dashboardPath);
      }
    }
  } catch (error) {
    console.error("❌ Dashboard generation failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as generateDashboard };
