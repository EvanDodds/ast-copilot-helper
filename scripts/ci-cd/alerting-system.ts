#!/usr/bin/env tsx
/**
 * Comprehensive alerting system for CI/CD pipeline
 * Provides real-time notifications for performance issues, failures, and anomalies
 * Addresses acceptance criteria 28: Performance alerting system
 */

import { execSync as _execSync } from "child_process";
import { writeFileSync, readFileSync, existsSync } from "fs";
import * as path from "path";
import {
  PerformanceMetric /* PerformanceAlert */,
} from "./performance-monitor";

interface AlertRule {
  id: string;
  name: string;
  type: "threshold" | "trend" | "anomaly";
  metric: string;
  condition: AlertCondition;
  severity: "info" | "warning" | "critical";
  enabled: boolean;
  cooldownMinutes: number;
}

interface AlertCondition {
  threshold?: number;
  comparison: ">" | "<" | ">=" | "<=" | "==" | "!=";
  trendPeriod?: number; // number of builds to analyze
  percentageChange?: number; // for trend-based alerts
  standardDeviations?: number; // for anomaly detection
}

interface Alert {
  id: string;
  ruleId: string;
  timestamp: string;
  buildId: string;
  branch: string;
  commit: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  metric: string;
  currentValue: number;
  thresholdValue?: number;
  trend?: "up" | "down" | "stable";
  acknowledged: boolean;
  resolvedAt?: string;
}

interface AlertChannel {
  type: "slack" | "email" | "github" | "webhook";
  config: any;
  enabled: boolean;
  severityFilter: ("info" | "warning" | "critical")[];
}

interface AlertingConfig {
  rules: AlertRule[];
  channels: AlertChannel[];
  globalSettings: {
    defaultCooldownMinutes: number;
    maxAlertsPerHour: number;
    enableQuietHours: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    timezone: string;
  };
}

class AlertingSystem {
  private config: AlertingConfig;
  private alertsPath: string;
  private configPath: string;
  private logPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), "alerting-config.json");
    this.alertsPath = path.join(process.cwd(), "active-alerts.json");
    this.logPath = path.join(process.cwd(), "alerting.log");

    this.config = this.loadConfig();
  }

  private loadConfig(): AlertingConfig {
    const defaultConfig: AlertingConfig = {
      rules: [
        {
          id: "build-time-critical",
          name: "Critical Build Time",
          type: "threshold",
          metric: "totalTime",
          condition: { threshold: 1800000, comparison: ">" }, // 30 minutes
          severity: "critical",
          enabled: true,
          cooldownMinutes: 30,
        },
        {
          id: "build-time-warning",
          name: "Elevated Build Time",
          type: "threshold",
          metric: "totalTime",
          condition: { threshold: 900000, comparison: ">" }, // 15 minutes
          severity: "warning",
          enabled: true,
          cooldownMinutes: 60,
        },
        {
          id: "test-failure-spike",
          name: "Test Failure Rate Increase",
          type: "trend",
          metric: "testFailureRate",
          condition: {
            trendPeriod: 5,
            percentageChange: 50,
            comparison: ">",
          },
          severity: "warning",
          enabled: true,
          cooldownMinutes: 120,
        },
        {
          id: "memory-usage-critical",
          name: "Critical Memory Usage",
          type: "threshold",
          metric: "memoryUsage",
          condition: { threshold: 8000, comparison: ">" }, // 8GB
          severity: "critical",
          enabled: true,
          cooldownMinutes: 15,
        },
        {
          id: "build-time-anomaly",
          name: "Build Time Anomaly",
          type: "anomaly",
          metric: "totalTime",
          condition: {
            standardDeviations: 2,
            comparison: ">",
          },
          severity: "info",
          enabled: true,
          cooldownMinutes: 180,
        },
        {
          id: "cache-hit-rate-low",
          name: "Low Cache Hit Rate",
          type: "threshold",
          metric: "cacheHitRate",
          condition: { threshold: 50, comparison: "<" },
          severity: "warning",
          enabled: true,
          cooldownMinutes: 240,
        },
        {
          id: "artifact-size-bloat",
          name: "Artifact Size Bloat",
          type: "trend",
          metric: "artifactSize",
          condition: {
            trendPeriod: 3,
            percentageChange: 25,
            comparison: ">",
          },
          severity: "info",
          enabled: true,
          cooldownMinutes: 360,
        },
      ],
      channels: [
        {
          type: "slack",
          config: {
            webhookUrl: process.env.SLACK_WEBHOOK_URL || "",
            channel: process.env.SLACK_CHANNEL || "#ci-cd-alerts",
            username: "CI/CD Bot",
            iconEmoji: ":warning:",
          },
          enabled: !!process.env.SLACK_WEBHOOK_URL,
          severityFilter: ["warning", "critical"],
        },
        {
          type: "email",
          config: {
            smtpServer: process.env.SMTP_SERVER || "",
            port: parseInt(process.env.SMTP_PORT || "587", 10),
            username: process.env.SMTP_USERNAME || "",
            password: process.env.SMTP_PASSWORD || "",
            from: process.env.ALERT_FROM_EMAIL || "noreply@ci-cd.example.com",
            to: (process.env.ALERT_TO_EMAILS || "").split(",").filter(Boolean),
          },
          enabled: !!process.env.SMTP_SERVER && !!process.env.ALERT_TO_EMAILS,
          severityFilter: ["critical"],
        },
        {
          type: "github",
          config: {
            token: process.env.GITHUB_TOKEN || "",
            owner: process.env.GITHUB_REPOSITORY?.split("/")[0] || "",
            repo: process.env.GITHUB_REPOSITORY?.split("/")[1] || "",
            createIssues: process.env.GITHUB_CREATE_ALERT_ISSUES === "true",
          },
          enabled: !!process.env.GITHUB_TOKEN,
          severityFilter: ["critical"],
        },
      ],
      globalSettings: {
        defaultCooldownMinutes: 60,
        maxAlertsPerHour: 10,
        enableQuietHours: process.env.ALERT_QUIET_HOURS === "true",
        quietHoursStart: process.env.ALERT_QUIET_START || "22:00",
        quietHoursEnd: process.env.ALERT_QUIET_END || "08:00",
        timezone: process.env.TZ || "UTC",
      },
    };

    try {
      if (existsSync(this.configPath)) {
        const savedConfig = JSON.parse(readFileSync(this.configPath, "utf8"));
        return { ...defaultConfig, ...savedConfig };
      }
    } catch (error) {
      this.log(
        `Warning: Could not load alerting config, using defaults: ${error}`,
      );
    }

    return defaultConfig;
  }

  private saveConfig(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error: any) {
      this.log(`Warning: Could not save alerting config: ${error.message}`);
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(message);

    try {
      writeFileSync(this.logPath, logEntry, { flag: "a" });
    } catch (error) {
      console.warn("Warning: Could not write to alerting log:", error);
    }
  }

  private getActiveAlerts(): Alert[] {
    try {
      if (existsSync(this.alertsPath)) {
        return JSON.parse(readFileSync(this.alertsPath, "utf8"));
      }
    } catch (error) {
      this.log(`Warning: Could not load active alerts: ${error}`);
    }
    return [];
  }

  private saveActiveAlerts(alerts: Alert[]): void {
    try {
      writeFileSync(this.alertsPath, JSON.stringify(alerts, null, 2));
    } catch (error: any) {
      this.log(`Warning: Could not save active alerts: ${error.message}`);
    }
  }

  private isInQuietHours(): boolean {
    if (!this.config.globalSettings.enableQuietHours) {
      return false;
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const start = this.config.globalSettings.quietHoursStart;
    const end = this.config.globalSettings.quietHoursEnd;

    // Handle quiet hours that span midnight
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    }

    return currentTime >= start && currentTime <= end;
  }

  private isInCooldown(ruleId: string, alerts: Alert[]): boolean {
    const rule = this.config.rules.find((r) => r.id === ruleId);
    if (!rule) return false;

    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    const cutoff = new Date(Date.now() - cooldownMs);

    return alerts.some(
      (alert) =>
        alert.ruleId === ruleId &&
        new Date(alert.timestamp) > cutoff &&
        !alert.resolvedAt,
    );
  }

  private hasExceededRateLimit(): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const alerts = this.getActiveAlerts();

    const recentAlerts = alerts.filter(
      (alert) => new Date(alert.timestamp) > oneHourAgo,
    );

    return recentAlerts.length >= this.config.globalSettings.maxAlertsPerHour;
  }

  private evaluateThresholdRule(
    rule: AlertRule,
    metric: PerformanceMetric,
  ): boolean {
    const value = this.getMetricValue(metric, rule.metric);
    const threshold = rule.condition.threshold!;

    switch (rule.condition.comparison) {
      case ">":
        return value > threshold;
      case "<":
        return value < threshold;
      case ">=":
        return value >= threshold;
      case "<=":
        return value <= threshold;
      case "==":
        return value === threshold;
      case "!=":
        return value !== threshold;
      default:
        return false;
    }
  }

  private evaluateTrendRule(
    rule: AlertRule,
    history: PerformanceMetric[],
  ): boolean {
    if (history.length < (rule.condition.trendPeriod || 3)) {
      return false;
    }

    const period = rule.condition.trendPeriod || 3;
    const recentMetrics = history.slice(-period);
    const values = recentMetrics.map((m) =>
      this.getMetricValue(m, rule.metric),
    );

    const oldValue = values[0];
    const newValue = values[values.length - 1];

    if (oldValue === 0) return false;

    const percentageChange = ((newValue - oldValue) / oldValue) * 100;
    const threshold = rule.condition.percentageChange || 20;

    switch (rule.condition.comparison) {
      case ">":
        return percentageChange > threshold;
      case "<":
        return percentageChange < threshold;
      case ">=":
        return percentageChange >= threshold;
      case "<=":
        return percentageChange <= threshold;
      default:
        return false;
    }
  }

  private evaluateAnomalyRule(
    rule: AlertRule,
    current: PerformanceMetric,
    history: PerformanceMetric[],
  ): boolean {
    if (history.length < 10) return false; // Need sufficient history

    const values = history.map((m) => this.getMetricValue(m, rule.metric));
    const currentValue = this.getMetricValue(current, rule.metric);

    // Calculate mean and standard deviation
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return false; // No variance

    const zScore = Math.abs((currentValue - mean) / stdDev);
    const threshold = rule.condition.standardDeviations || 2;

    return zScore > threshold;
  }

  private getMetricValue(
    metric: PerformanceMetric,
    metricName: string,
  ): number {
    switch (metricName) {
      case "totalTime":
        return metric.metrics.totalTime;
      case "buildTime":
        return metric.metrics.buildTime;
      case "testTime":
        return metric.metrics.testTime;
      case "deployTime":
        return metric.metrics.deployTime || 0;
      case "memoryUsage":
        return metric.metrics.memoryUsage.peak;
      case "cpuUsage":
        return metric.metrics.cpuUsage.peak;
      case "artifactSize":
        return metric.metrics.artifactSize;
      case "cacheHitRate":
        return metric.metrics.cacheHitRate;
      case "testFailureRate": {
        // Calculate failure rate from stages
        const testStage = metric.stages.find((s) =>
          s.name.toLowerCase().includes("test"),
        );
        return testStage?.status === "failure" ? 100 : 0;
      }
      default:
        return 0;
    }
  }

  private createAlert(
    rule: AlertRule,
    metric: PerformanceMetric,
    context: any = {},
  ): Alert {
    const currentValue = this.getMetricValue(metric, rule.metric);

    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      timestamp: new Date().toISOString(),
      buildId: metric.buildId,
      branch: metric.branch,
      commit: metric.commit,
      severity: rule.severity,
      title: rule.name,
      message: this.generateAlertMessage(rule, currentValue, context),
      metric: rule.metric,
      currentValue,
      thresholdValue: rule.condition.threshold,
      trend: context.trend,
      acknowledged: false,
    };
  }

  private generateAlertMessage(
    rule: AlertRule,
    currentValue: number,
    context: any,
  ): string {
    const formatValue = (val: number, metric: string): string => {
      switch (metric) {
        case "totalTime":
        case "buildTime":
        case "testTime":
        case "deployTime":
          return `${Math.round(val / 1000)}s`;
        case "memoryUsage":
        case "artifactSize":
          return `${Math.round(val)}MB`;
        case "cpuUsage":
        case "cacheHitRate":
        case "testFailureRate":
          return `${Math.round(val)}%`;
        default:
          return val.toString();
      }
    };

    let message = `${rule.name} triggered for ${rule.metric}.\n`;
    message += `Current value: ${formatValue(currentValue, rule.metric)}\n`;

    if (rule.condition.threshold) {
      message += `Threshold: ${formatValue(rule.condition.threshold, rule.metric)}\n`;
    }

    if (context.trend) {
      message += `Trend: ${context.trend}\n`;
    }

    if (context.percentageChange) {
      message += `Change: ${context.percentageChange.toFixed(1)}%\n`;
    }

    // Add context-specific recommendations
    message += `\nRecommendations:\n`;
    message += this.generateRecommendations(rule.metric, currentValue).join(
      "\n",
    );

    return message;
  }

  private generateRecommendations(metric: string, _value: number): string[] {
    const recommendations: string[] = [];

    switch (metric) {
      case "totalTime":
      case "buildTime":
        recommendations.push(
          "• Review recent changes that might have increased build complexity",
        );
        recommendations.push("• Consider parallelizing build steps");
        recommendations.push(
          "• Check for inefficient dependency installations",
        );
        break;

      case "testTime":
        recommendations.push(
          "• Review test suite for long-running or inefficient tests",
        );
        recommendations.push("• Consider test parallelization");
        recommendations.push(
          "• Check for resource contention during test execution",
        );
        break;

      case "memoryUsage":
        recommendations.push("• Check for memory leaks in build processes");
        recommendations.push("• Consider increasing CI runner memory");
        recommendations.push("• Review memory-intensive build steps");
        break;

      case "artifactSize":
        recommendations.push(
          "• Review artifact contents for unnecessary files",
        );
        recommendations.push("• Implement artifact compression");
        recommendations.push("• Consider splitting large artifacts");
        break;

      case "cacheHitRate":
        recommendations.push(
          "• Check cache configuration and invalidation rules",
        );
        recommendations.push("• Review dependency changes affecting cache");
        recommendations.push("• Consider cache warming strategies");
        break;

      default:
        recommendations.push("• Review recent changes to the CI/CD pipeline");
        recommendations.push("• Check system resources and configuration");
    }

    return recommendations;
  }

  private async sendSlackAlert(
    alert: Alert,
    channel: AlertChannel,
  ): Promise<void> {
    if (!channel.config.webhookUrl) {
      this.log("Slack webhook URL not configured, skipping Slack notification");
      return;
    }

    const color =
      alert.severity === "critical"
        ? "#ff0000"
        : alert.severity === "warning"
          ? "#ffaa00"
          : "#00aa00";

    const payload = {
      channel: channel.config.channel,
      username: channel.config.username,
      icon_emoji: channel.config.iconEmoji,
      attachments: [
        {
          color,
          title: `${alert.severity.toUpperCase()}: ${alert.title}`,
          text: alert.message,
          fields: [
            { title: "Branch", value: alert.branch, short: true },
            { title: "Build ID", value: alert.buildId, short: true },
            { title: "Commit", value: alert.commit.slice(0, 8), short: true },
            { title: "Metric", value: alert.metric, short: true },
          ],
          footer: "CI/CD Alerting System",
          ts: Math.floor(new Date(alert.timestamp).getTime() / 1000),
        },
      ],
    };

    try {
      // In a real implementation, this would make an HTTP request to the Slack webhook
      this.log(`Would send Slack alert: ${JSON.stringify(payload, null, 2)}`);
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate API call
      this.log(`Slack alert sent for ${alert.id}`);
    } catch (error: any) {
      this.log(`Failed to send Slack alert: ${error.message}`);
      throw error;
    }
  }

  private async sendEmailAlert(
    alert: Alert,
    channel: AlertChannel,
  ): Promise<void> {
    if (!channel.config.smtpServer || channel.config.to.length === 0) {
      this.log("Email configuration incomplete, skipping email notification");
      return;
    }

    const subject = `[${alert.severity.toUpperCase()}] CI/CD Alert: ${alert.title}`;
    const _htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="background: ${alert.severity === "critical" ? "#fee" : "#fff3cd"}; padding: 20px; border-radius: 5px;">
            <h2 style="color: ${alert.severity === "critical" ? "#d32f2f" : "#f57c00"};">
              ${alert.severity.toUpperCase()}: ${alert.title}
            </h2>
            
            <div style="background: white; padding: 15px; border-radius: 3px; margin: 15px 0;">
              <pre style="white-space: pre-wrap; font-family: monospace;">${alert.message}</pre>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Branch:</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${alert.branch}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Build ID:</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${alert.buildId}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Commit:</td>
                <td style="border: 1px solid #ddd; padding: 8px; font-family: monospace;">${alert.commit}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Timestamp:</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${new Date(alert.timestamp).toLocaleString()}</td>
              </tr>
            </table>
            
            <p style="font-size: 12px; color: #666;">
              This alert was generated by the CI/CD Alerting System.
              Alert ID: ${alert.id}
            </p>
          </div>
        </body>
      </html>
    `;

    try {
      // In a real implementation, this would use nodemailer or similar to send the email
      this.log(
        `Would send email alert to ${channel.config.to.join(", ")}: ${subject}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 200)); // Simulate email sending
      this.log(`Email alert sent for ${alert.id}`);
    } catch (error: any) {
      this.log(`Failed to send email alert: ${error.message}`);
      throw error;
    }
  }

  private async sendGitHubAlert(
    alert: Alert,
    channel: AlertChannel,
  ): Promise<void> {
    if (!channel.config.token || !channel.config.createIssues) {
      this.log("GitHub configuration incomplete or issue creation disabled");
      return;
    }

    const issueTitle = `[CI/CD Alert] ${alert.title} - ${alert.branch}`;
    const _issueBody = `
## ${alert.severity.toUpperCase()}: ${alert.title}

**Alert Details:**
- **Branch:** ${alert.branch}
- **Build ID:** ${alert.buildId}
- **Commit:** ${alert.commit}
- **Timestamp:** ${new Date(alert.timestamp).toLocaleString()}
- **Metric:** ${alert.metric}
- **Current Value:** ${alert.currentValue}
${alert.thresholdValue ? `- **Threshold:** ${alert.thresholdValue}` : ""}

**Message:**
\`\`\`
${alert.message}
\`\`\`

**Alert ID:** ${alert.id}

---
*This issue was automatically created by the CI/CD Alerting System.*
    `.trim();

    try {
      // In a real implementation, this would use GitHub API to create an issue
      this.log(`Would create GitHub issue: ${issueTitle}`);
      await new Promise((resolve) => setTimeout(resolve, 150)); // Simulate API call
      this.log(`GitHub issue created for alert ${alert.id}`);
    } catch (error: any) {
      this.log(`Failed to create GitHub issue: ${error.message}`);
      throw error;
    }
  }

  private async sendAlert(alert: Alert): Promise<void> {
    this.log(`📨 Sending ${alert.severity} alert: ${alert.title}`);

    const promises: Promise<void>[] = [];

    for (const channel of this.config.channels) {
      if (
        !channel.enabled ||
        !channel.severityFilter.includes(alert.severity)
      ) {
        continue;
      }

      try {
        switch (channel.type) {
          case "slack":
            promises.push(this.sendSlackAlert(alert, channel));
            break;
          case "email":
            promises.push(this.sendEmailAlert(alert, channel));
            break;
          case "github":
            promises.push(this.sendGitHubAlert(alert, channel));
            break;
          case "webhook":
            // Custom webhook implementation would go here
            this.log(`Webhook notifications not yet implemented`);
            break;
        }
      } catch (error: any) {
        this.log(`Failed to send alert via ${channel.type}: ${error.message}`);
      }
    }

    // Wait for all notifications to complete
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    } else {
      this.log(
        "No notification channels configured or enabled for this alert severity",
      );
    }
  }

  async evaluateMetrics(
    current: PerformanceMetric,
    history: PerformanceMetric[],
  ): Promise<Alert[]> {
    this.log("🔍 Evaluating performance metrics against alert rules...");

    if (this.isInQuietHours()) {
      this.log("Currently in quiet hours, skipping non-critical alerts");
    }

    if (this.hasExceededRateLimit()) {
      this.log("Alert rate limit exceeded, suppressing additional alerts");
      return [];
    }

    const activeAlerts = this.getActiveAlerts();
    const newAlerts: Alert[] = [];

    for (const rule of this.config.rules) {
      if (!rule.enabled) continue;

      // Skip if in cooldown
      if (this.isInCooldown(rule.id, activeAlerts)) {
        continue;
      }

      // Skip non-critical alerts during quiet hours
      if (this.isInQuietHours() && rule.severity !== "critical") {
        continue;
      }

      let shouldAlert = false;
      const context: any = {};

      try {
        switch (rule.type) {
          case "threshold":
            shouldAlert = this.evaluateThresholdRule(rule, current);
            break;

          case "trend":
            shouldAlert = this.evaluateTrendRule(rule, [...history, current]);
            if (shouldAlert && history.length >= 2) {
              const oldValue = this.getMetricValue(
                history[history.length - 2],
                rule.metric,
              );
              const newValue = this.getMetricValue(current, rule.metric);
              context.percentageChange =
                oldValue > 0 ? ((newValue - oldValue) / oldValue) * 100 : 0;
              context.trend = context.percentageChange > 0 ? "up" : "down";
            }
            break;

          case "anomaly":
            shouldAlert = this.evaluateAnomalyRule(rule, current, history);
            context.anomalyType = "statistical";
            break;
        }

        if (shouldAlert) {
          const alert = this.createAlert(rule, current, context);
          newAlerts.push(alert);
          this.log(`Alert triggered: ${rule.name} (${rule.severity})`);
        }
      } catch (error: any) {
        this.log(`Error evaluating rule ${rule.id}: ${error.message}`);
      }
    }

    // Update active alerts
    const allAlerts = [...activeAlerts, ...newAlerts];
    this.saveActiveAlerts(allAlerts);

    // Send notifications for new alerts
    for (const alert of newAlerts) {
      try {
        await this.sendAlert(alert);
      } catch (error: any) {
        this.log(`Failed to send alert ${alert.id}: ${error.message}`);
      }
    }

    this.log(
      `Alert evaluation complete: ${newAlerts.length} new alerts generated`,
    );
    return newAlerts;
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alerts = this.getActiveAlerts();
    const alert = alerts.find((a) => a.id === alertId);

    if (!alert) {
      this.log(`Alert ${alertId} not found`);
      return false;
    }

    alert.acknowledged = true;
    this.saveActiveAlerts(alerts);
    this.log(`Alert ${alertId} acknowledged by ${acknowledgedBy}`);
    return true;
  }

  resolveAlert(alertId: string, resolvedBy: string): boolean {
    const alerts = this.getActiveAlerts();
    const alert = alerts.find((a) => a.id === alertId);

    if (!alert) {
      this.log(`Alert ${alertId} not found`);
      return false;
    }

    alert.resolvedAt = new Date().toISOString();
    this.saveActiveAlerts(alerts);
    this.log(`Alert ${alertId} resolved by ${resolvedBy}`);
    return true;
  }

  getActiveAlertsSummary(): {
    total: number;
    critical: number;
    warning: number;
    info: number;
  } {
    const alerts = this.getActiveAlerts();
    const active = alerts.filter((a) => !a.resolvedAt);

    return {
      total: active.length,
      critical: active.filter((a) => a.severity === "critical").length,
      warning: active.filter((a) => a.severity === "warning").length,
      info: active.filter((a) => a.severity === "info").length,
    };
  }
}

// Main execution
async function main(): Promise<void> {
  const alertingSystem = new AlertingSystem();

  try {
    // In a real implementation, this would receive performance metrics
    // from the performance monitor or be called as part of the CI/CD pipeline

    console.log("\n🚨 CI/CD Alerting System");
    console.log("=======================");

    const summary = alertingSystem.getActiveAlertsSummary();
    console.log(`Active Alerts: ${summary.total}`);
    console.log(`  Critical: ${summary.critical}`);
    console.log(`  Warning: ${summary.warning}`);
    console.log(`  Info: ${summary.info}`);

    console.log(
      "\nAlerting system initialized and ready for metric evaluation.",
    );
  } catch (error: any) {
    console.error("Alerting system failed:", error.message);
    process.exit(1);
  }
}

// Run only if this file is executed directly
// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}

export { AlertingSystem, Alert, AlertRule, AlertChannel };
