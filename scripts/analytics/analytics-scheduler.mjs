#!/usr/bin/env node

/**
 * Analytics Scheduler
 * Runs community analytics on a schedule and manages historical data
 */

import { CommunityAnalytics } from "./community-analytics.mjs";
import fs from "fs/promises";
import path from "path";

export class AnalyticsScheduler {
  constructor(options = {}) {
    this.config = {
      token: options.token || process.env.GITHUB_TOKEN,
      owner: options.owner || "yourusername",
      repo: options.repo || "ast-copilot-helper",
      outputDir: options.outputDir || "./analytics-data",
      schedule: options.schedule || "daily", // daily, weekly, monthly
      retentionDays: options.retentionDays || 365,
      timeframes: options.timeframes || [7, 30, 90], // days
      ...options,
    };

    this.analytics = new CommunityAnalytics(this.config);
  }

  /**
   * Run analytics for all configured timeframes
   */
  async runScheduledAnalytics() {
    console.log("📊 Running scheduled community analytics...");

    const timestamp = new Date().toISOString().split("T")[0];
    const results = {};

    for (const timeframe of this.config.timeframes) {
      console.log(`\n🔍 Analyzing ${timeframe}-day period...`);

      try {
        const analytics = new CommunityAnalytics({
          ...this.config,
          timeframe,
          outputDir: path.join(
            this.config.outputDir,
            `${timeframe}d`,
            timestamp,
          ),
        });

        const report = await analytics.generateReport();
        results[`${timeframe}d`] = {
          timeframe,
          timestamp,
          summary: report.summary,
          insights: report.insights,
          recommendations: report.recommendations,
          filePaths: {
            json: path.join(
              this.config.outputDir,
              `${timeframe}d`,
              timestamp,
              "community-analytics.json",
            ),
            html: path.join(
              this.config.outputDir,
              `${timeframe}d`,
              timestamp,
              "community-analytics.html",
            ),
            csv: path.join(
              this.config.outputDir,
              `${timeframe}d`,
              timestamp,
              "community-summary.csv",
            ),
          },
        };

        console.log(`✅ ${timeframe}-day analysis completed`);
      } catch (error) {
        console.error(`❌ Error analyzing ${timeframe}-day period:`, error);
        results[`${timeframe}d`] = { error: error.message };
      }
    }

    // Save combined summary
    await this.saveCombinedSummary(results, timestamp);

    // Update trending data
    await this.updateTrendingData(results, timestamp);

    // Cleanup old data
    await this.cleanupOldData();

    // Generate dashboard
    await this.generateDashboard(timestamp);

    console.log("\n✅ Scheduled analytics completed!");
    return results;
  }

  /**
   * Save combined summary of all timeframes
   */
  async saveCombinedSummary(results, timestamp) {
    const summaryDir = path.join(this.config.outputDir, "summaries");
    await fs.mkdir(summaryDir, { recursive: true });

    const summary = {
      timestamp,
      generatedAt: new Date().toISOString(),
      repository: `${this.config.owner}/${this.config.repo}`,
      timeframes: this.config.timeframes,
      results,
      overview: this.generateOverview(results),
    };

    const summaryPath = path.join(summaryDir, `${timestamp}.json`);
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    // Update latest summary link
    const latestPath = path.join(summaryDir, "latest.json");
    await fs.writeFile(latestPath, JSON.stringify(summary, null, 2));

    console.log(`📄 Combined summary saved: ${summaryPath}`);
  }

  /**
   * Generate overview from multiple timeframe results
   */
  generateOverview(results) {
    const overview = {
      status: "success",
      timeframes: {},
      trends: {},
      alerts: [],
    };

    // Process each timeframe
    for (const [timeframe, data] of Object.entries(results)) {
      if (data.error) {
        overview.alerts.push({
          type: "error",
          message: `Failed to analyze ${timeframe}: ${data.error}`,
        });
        continue;
      }

      overview.timeframes[timeframe] = {
        contributors: data.summary.communityGrowth.totalContributors,
        newContributors: data.summary.communityGrowth.newContributors,
        growthRate: data.summary.communityGrowth.growthRate,
        issueCloseRate: data.summary.engagement.issueCloseRate,
        prMergeRate: data.summary.engagement.prMergeRate,
        stars: data.summary.engagement.stars,
        forks: data.summary.engagement.forks,
      };

      // Check for alerts based on insights
      data.insights.forEach((insight) => {
        if (insight.type === "warning" && insight.impact === "high") {
          overview.alerts.push({
            type: "warning",
            timeframe,
            message: insight.message,
            category: insight.category,
          });
        }
      });
    }

    return overview;
  }

  /**
   * Update trending data with new analytics
   */
  async updateTrendingData(results, timestamp) {
    const trendingDir = path.join(this.config.outputDir, "trending");
    await fs.mkdir(trendingDir, { recursive: true });

    for (const [timeframe, data] of Object.entries(results)) {
      if (data.error) continue;

      const trendingPath = path.join(trendingDir, `${timeframe}.json`);
      let trendingData = { dataPoints: [] };

      // Load existing trending data
      try {
        const existingData = await fs.readFile(trendingPath, "utf8");
        trendingData = JSON.parse(existingData);
      } catch {
        // File doesn't exist yet, start fresh
      }

      // Add new data point
      trendingData.dataPoints.push({
        timestamp,
        date: new Date(timestamp).toISOString(),
        contributors: data.summary.communityGrowth.totalContributors,
        newContributors: data.summary.communityGrowth.newContributors,
        issues: data.summary.activity.issuesOpened,
        pullRequests: data.summary.activity.pullRequestsOpened,
        stars: data.summary.engagement.stars,
        forks: data.summary.engagement.forks,
        issueCloseRate: parseFloat(data.summary.engagement.issueCloseRate),
        prMergeRate: parseFloat(data.summary.engagement.prMergeRate),
      });

      // Keep only last 100 data points to prevent file from growing too large
      if (trendingData.dataPoints.length > 100) {
        trendingData.dataPoints = trendingData.dataPoints.slice(-100);
      }

      // Calculate trends
      trendingData.trends = this.calculateTrends(trendingData.dataPoints);

      await fs.writeFile(trendingPath, JSON.stringify(trendingData, null, 2));
    }

    console.log("📈 Trending data updated");
  }

  /**
   * Calculate trends from data points
   */
  calculateTrends(dataPoints) {
    if (dataPoints.length < 2) return {};

    const latest = dataPoints[dataPoints.length - 1];
    const previous = dataPoints[dataPoints.length - 2];

    return {
      contributors: this.calculateTrend(
        previous.contributors,
        latest.contributors,
      ),
      newContributors: this.calculateTrend(
        previous.newContributors,
        latest.newContributors,
      ),
      issues: this.calculateTrend(previous.issues, latest.issues),
      pullRequests: this.calculateTrend(
        previous.pullRequests,
        latest.pullRequests,
      ),
      stars: this.calculateTrend(previous.stars, latest.stars),
      forks: this.calculateTrend(previous.forks, latest.forks),
      issueCloseRate: this.calculateTrend(
        previous.issueCloseRate,
        latest.issueCloseRate,
      ),
      prMergeRate: this.calculateTrend(
        previous.prMergeRate,
        latest.prMergeRate,
      ),
    };
  }

  /**
   * Calculate trend between two values
   */
  calculateTrend(previous, current) {
    if (previous === 0) return current > 0 ? "up" : "stable";

    const change = ((current - previous) / previous) * 100;
    if (Math.abs(change) < 1) return "stable";
    return change > 0 ? "up" : "down";
  }

  /**
   * Clean up old analytics data
   */
  async cleanupOldData() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    for (const timeframe of this.config.timeframes) {
      const timeframeDir = path.join(this.config.outputDir, `${timeframe}d`);

      try {
        const entries = await fs.readdir(timeframeDir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const folderDate = new Date(entry.name);
            if (folderDate < cutoffDate) {
              const folderPath = path.join(timeframeDir, entry.name);
              await fs.rm(folderPath, { recursive: true });
              console.log(`🗑️  Cleaned up old data: ${folderPath}`);
            }
          }
        }
      } catch {
        // Directory might not exist yet
      }
    }
  }

  /**
   * Generate analytics dashboard
   */
  async generateDashboard(_timestamp) {
    const dashboardDir = path.join(this.config.outputDir, "dashboard");
    await fs.mkdir(dashboardDir, { recursive: true });

    // Load latest summary
    const summaryPath = path.join(
      this.config.outputDir,
      "summaries",
      "latest.json",
    );
    let summary;

    try {
      const summaryData = await fs.readFile(summaryPath, "utf8");
      summary = JSON.parse(summaryData);
    } catch (error) {
      console.error("❌ Could not load summary for dashboard:", error);
      return;
    }

    // Load trending data
    const trendingData = {};
    for (const timeframe of this.config.timeframes) {
      try {
        const trendingPath = path.join(
          this.config.outputDir,
          "trending",
          `${timeframe}d.json`,
        );
        const data = await fs.readFile(trendingPath, "utf8");
        trendingData[`${timeframe}d`] = JSON.parse(data);
      } catch {
        trendingData[`${timeframe}d`] = { dataPoints: [], trends: {} };
      }
    }

    // Generate HTML dashboard
    const dashboardHTML = this.generateDashboardHTML(summary, trendingData);
    const dashboardPath = path.join(dashboardDir, "index.html");
    await fs.writeFile(dashboardPath, dashboardHTML);

    // Copy assets if they exist
    await this.copyDashboardAssets(dashboardDir);

    console.log(`📊 Dashboard generated: ${dashboardPath}`);
  }

  /**
   * Generate HTML dashboard
   */
  generateDashboardHTML(summary, trendingData) {
    const { overview, results } = summary;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Community Analytics Dashboard - ${summary.repository}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; background: #f8f9fa; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; text-align: center; }
        .header h1 { margin-bottom: 10px; }
        .header p { opacity: 0.9; }
        .alerts { margin-bottom: 20px; }
        .alert { padding: 15px; border-radius: 8px; margin-bottom: 10px; }
        .alert.warning { background: #fff3cd; border-left: 4px solid #ffc107; color: #856404; }
        .alert.error { background: #f8d7da; border-left: 4px solid #dc3545; color: #721c24; }
        .timeframe-tabs { display: flex; background: white; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
        .timeframe-tab { flex: 1; padding: 15px; text-align: center; cursor: pointer; border: none; background: none; transition: all 0.3s; }
        .timeframe-tab:hover { background: #f8f9fa; }
        .timeframe-tab.active { background: #007bff; color: white; }
        .timeframe-content { display: none; }
        .timeframe-content.active { display: block; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: white; border-radius: 12px; padding: 25px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); position: relative; overflow: hidden; }
        .metric-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #667eea, #764ba2); }
        .metric-value { font-size: 2.5em; font-weight: 700; margin-bottom: 5px; }
        .metric-label { color: #6c757d; font-size: 0.9em; margin-bottom: 10px; }
        .metric-change { font-size: 0.85em; padding: 4px 8px; border-radius: 4px; }
        .metric-change.up { background: #d4edda; color: #155724; }
        .metric-change.down { background: #f8d7da; color: #721c24; }
        .metric-change.stable { background: #d1ecf1; color: #0c5460; }
        .chart-container { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .chart-placeholder { height: 300px; background: #f8f9fa; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #6c757d; border: 2px dashed #dee2e6; }
        .insights-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .insights-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .insight-item { padding: 12px; margin: 8px 0; border-radius: 6px; border-left: 4px solid; }
        .insight-item.positive { background: #d4edda; border-color: #28a745; }
        .insight-item.warning { background: #fff3cd; border-color: #ffc107; }
        .insight-item.negative { background: #f8d7da; border-color: #dc3545; }
        .recommendation { background: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 15px; margin: 10px 0; }
        .recommendation h4 { margin-bottom: 10px; color: #0056b3; }
        .footer { text-align: center; color: #6c757d; margin-top: 50px; padding: 20px; }
        @media (max-width: 768px) {
            .insights-grid { grid-template-columns: 1fr; }
            .timeframe-tabs { flex-direction: column; }
            .metric-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏘️ Community Analytics Dashboard</h1>
            <p><strong>${summary.repository}</strong></p>
            <p>Last updated: ${new Date(summary.generatedAt).toLocaleString()}</p>
        </div>

        ${
          overview.alerts.length > 0
            ? `
        <div class="alerts">
            ${overview.alerts
              .map(
                (alert) => `
                <div class="alert ${alert.type}">
                    <strong>${alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}:</strong> ${alert.message}
                </div>
            `,
              )
              .join("")}
        </div>
        `
            : ""
        }

        <div class="timeframe-tabs">
            ${this.config.timeframes
              .map(
                (timeframe, index) => `
                <button class="timeframe-tab ${index === 0 ? "active" : ""}" onclick="showTimeframe('${timeframe}d')">
                    ${timeframe} Day${timeframe > 1 ? "s" : ""}
                </button>
            `,
              )
              .join("")}
        </div>

        ${this.config.timeframes
          .map((timeframe, index) => {
            const data = results[`${timeframe}d`];
            if (!data || data.error) return "";

            const trending = trendingData[`${timeframe}d`]?.trends || {};

            return `
          <div class="timeframe-content ${index === 0 ? "active" : ""}" id="content-${timeframe}d">
              <div class="metric-grid">
                  <div class="metric-card">
                      <div class="metric-value" style="color: #667eea;">${data.summary.communityGrowth.totalContributors}</div>
                      <div class="metric-label">Total Contributors</div>
                      <div class="metric-change ${trending.contributors || "stable"}">${trending.contributors || "stable"}</div>
                  </div>
                  <div class="metric-card">
                      <div class="metric-value" style="color: #28a745;">${data.summary.communityGrowth.newContributors}</div>
                      <div class="metric-label">New Contributors</div>
                      <div class="metric-change ${trending.newContributors || "stable"}">${trending.newContributors || "stable"}</div>
                  </div>
                  <div class="metric-card">
                      <div class="metric-value" style="color: #ffc107;">${data.summary.activity.issuesOpened}</div>
                      <div class="metric-label">Issues Opened</div>
                      <div class="metric-change ${trending.issues || "stable"}">${trending.issues || "stable"}</div>
                  </div>
                  <div class="metric-card">
                      <div class="metric-value" style="color: #17a2b8;">${data.summary.activity.pullRequestsOpened}</div>
                      <div class="metric-label">Pull Requests</div>
                      <div class="metric-change ${trending.pullRequests || "stable"}">${trending.pullRequests || "stable"}</div>
                  </div>
                  <div class="metric-card">
                      <div class="metric-value" style="color: #dc3545;">${data.summary.engagement.issueCloseRate}%</div>
                      <div class="metric-label">Issue Close Rate</div>
                      <div class="metric-change ${trending.issueCloseRate || "stable"}">${trending.issueCloseRate || "stable"}</div>
                  </div>
                  <div class="metric-card">
                      <div class="metric-value" style="color: #6f42c1;">${data.summary.engagement.prMergeRate}%</div>
                      <div class="metric-label">PR Merge Rate</div>
                      <div class="metric-change ${trending.prMergeRate || "stable"}">${trending.prMergeRate || "stable"}</div>
                  </div>
                  <div class="metric-card">
                      <div class="metric-value" style="color: #fd7e14;">⭐ ${data.summary.engagement.stars}</div>
                      <div class="metric-label">GitHub Stars</div>
                      <div class="metric-change ${trending.stars || "stable"}">${trending.stars || "stable"}</div>
                  </div>
                  <div class="metric-card">
                      <div class="metric-value" style="color: #20c997;">🍴 ${data.summary.engagement.forks}</div>
                      <div class="metric-label">GitHub Forks</div>
                      <div class="metric-change ${trending.forks || "stable"}">${trending.forks || "stable"}</div>
                  </div>
              </div>

              <div class="chart-container">
                  <h3>Trending Data</h3>
                  <div class="chart-placeholder">
                      📈 Chart visualization would go here<br>
                      <small>Integration with charting library needed</small>
                  </div>
              </div>

              <div class="insights-grid">
                  <div class="insights-card">
                      <h3>💡 Key Insights</h3>
                      ${data.insights
                        .map(
                          (insight) => `
                          <div class="insight-item ${insight.type}">
                              <strong>${insight.category}:</strong> ${insight.message}
                              <small style="float: right;">${insight.impact} impact</small>
                          </div>
                      `,
                        )
                        .join("")}
                  </div>
                  
                  <div class="insights-card">
                      <h3>🎯 Recommendations</h3>
                      ${data.recommendations
                        .map(
                          (rec) => `
                          <div class="recommendation">
                              <h4>${rec.action} <small>(${rec.priority} priority)</small></h4>
                              <ul style="margin-top: 8px;">
                                  ${rec.details.map((detail) => `<li style="margin: 4px 0;">${detail}</li>`).join("")}
                              </ul>
                          </div>
                      `,
                        )
                        .join("")}
                  </div>
              </div>
          </div>
          `;
          })
          .join("")}

        <div class="footer">
            <p>🏘️ Generated by ast-copilot-helper Community Analytics • ${new Date().toLocaleString()}</p>
            <p><a href="https://github.com/${summary.repository}" target="_blank" style="color: #007bff; text-decoration: none;">View Repository</a></p>
        </div>
    </div>

    <script>
        function showTimeframe(timeframe) {
            // Hide all content
            document.querySelectorAll('.timeframe-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.timeframe-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected content
            document.getElementById('content-' + timeframe).classList.add('active');
            
            // Add active class to selected tab
            event.target.classList.add('active');
        }
        
        // Auto-refresh every 5 minutes
        setTimeout(() => {
            window.location.reload();
        }, 5 * 60 * 1000);
    </script>
</body>
</html>`;
  }

  /**
   * Copy dashboard assets (CSS, JS, images)
   */
  async copyDashboardAssets(_dashboardDir) {
    // This would copy any static assets needed for the dashboard
    // For now, we're using inline styles and scripts
  }

  /**
   * Get configuration for scheduling
   */
  static getScheduleConfig(schedule = "daily") {
    const configs = {
      hourly: { cron: "0 * * * *", description: "Every hour" },
      daily: { cron: "0 0 * * *", description: "Every day at midnight" },
      weekly: { cron: "0 0 * * 0", description: "Every Sunday at midnight" },
      monthly: { cron: "0 0 1 * *", description: "First day of every month" },
    };

    return configs[schedule] || configs.daily;
  }
}

// CLI interface
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const options = {
    token: process.env.GITHUB_TOKEN,
    owner: process.argv[2] || "yourusername",
    repo: process.argv[3] || "ast-copilot-helper",
    schedule: process.argv[4] || "daily",
    outputDir: process.argv[5] || "./analytics-data",
  };

  if (!options.token) {
    console.error(
      "❌ GitHub token required. Set GITHUB_TOKEN environment variable.",
    );
    process.exit(1);
  }

  const scheduler = new AnalyticsScheduler(options);

  scheduler
    .runScheduledAnalytics()
    .then((results) => {
      console.log("\n✅ Analytics scheduler completed successfully");

      // Print summary
      Object.entries(results).forEach(([timeframe, data]) => {
        if (data.error) {
          console.log(`❌ ${timeframe}: ${data.error}`);
        } else {
          console.log(
            `📊 ${timeframe}: ${data.summary.communityGrowth.totalContributors} contributors, ${data.summary.activity.issuesOpened} issues opened`,
          );
        }
      });

      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Analytics scheduling failed:", error);
      process.exit(1);
    });
}
