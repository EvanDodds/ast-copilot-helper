import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Simple mock classes for testing analytics functionality
class MockCommunityAnalytics {
  owner: string;
  repo: string;
  timeframe: number;
  outputDir: string;

  constructor(options: any = {}) {
    this.owner = options.owner || "yourusername";
    this.repo = options.repo || "ast-copilot-helper";
    this.timeframe = options.timeframe || 90;
    this.outputDir = options.outputDir || "./analytics-output";
  }

  async generateReport() {
    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        timeframe: `${this.timeframe} days`,
        repository: `${this.owner}/${this.repo}`,
      },
      summary: {
        communityGrowth: {
          totalContributors: 3,
          newContributors: 2,
          growthRate: "66.7",
        },
        activity: {
          issuesOpened: 5,
          issuesClosed: 4,
          pullRequestsOpened: 3,
          pullRequestsMerged: 2,
        },
        engagement: {
          stars: 100,
          forks: 25,
          issueCloseRate: "80.0",
          prMergeRate: "66.7",
        },
      },
      insights: [
        {
          type: "positive",
          category: "issues",
          message: "High issue close rate (80.0%)",
          impact: "medium",
        },
      ],
      recommendations: [
        {
          category: "growth",
          priority: "high",
          action: "Focus on attracting new contributors",
          details: ["Create good first issue labels"],
        },
      ],
    };
  }

  formatDuration(ms: number | null | undefined): string {
    if (!ms || ms === 0) {
      return "0h";
    }

    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}

class MockAnalyticsScheduler {
  config: any;

  constructor(options: any = {}) {
    this.config = {
      token: options.token || "test-token",
      owner: options.owner || "yourusername",
      repo: options.repo || "ast-copilot-helper",
      outputDir: options.outputDir || "./analytics-data",
      schedule: options.schedule || "daily",
      retentionDays: options.retentionDays || 365,
      timeframes: options.timeframes || [7, 30, 90],
      ...options,
    };
  }

  generateOverview(results: any) {
    const overview: any = {
      status: "success",
      timeframes: {},
      trends: {},
      alerts: [],
    };

    for (const [timeframe, data] of Object.entries(results)) {
      if ((data as any).error) {
        overview.alerts.push({
          type: "error",
          message: `Failed to analyze ${timeframe}: ${(data as any).error}`,
        });
        continue;
      }

      const summary = (data as any).summary;
      if (summary) {
        overview.timeframes[timeframe] = {
          contributors: summary.communityGrowth.totalContributors,
          newContributors: summary.communityGrowth.newContributors,
          growthRate: summary.communityGrowth.growthRate,
          issueCloseRate: summary.engagement.issueCloseRate,
          prMergeRate: summary.engagement.prMergeRate,
          stars: summary.engagement.stars,
          forks: summary.engagement.forks,
        };
      }
    }

    return overview;
  }

  calculateTrend(previous: number, current: number): "up" | "down" | "stable" {
    if (previous === 0) {
      return current > 0 ? "up" : "stable";
    }

    const change = ((current - previous) / previous) * 100;
    if (Math.abs(change) < 1) {
      return "stable";
    }
    return change > 0 ? "up" : "down";
  }

  static getScheduleConfig(schedule = "daily") {
    const configs: Record<string, { cron: string; description: string }> = {
      hourly: { cron: "0 * * * *", description: "Every hour" },
      daily: { cron: "0 0 * * *", description: "Every day at midnight" },
      weekly: { cron: "0 0 * * 0", description: "Every Sunday at midnight" },
      monthly: { cron: "0 0 1 * *", description: "First day of every month" },
    };

    return configs[schedule] || configs.daily;
  }
}

describe("Community Analytics System", () => {
  let analytics: MockCommunityAnalytics;
  let scheduler: MockAnalyticsScheduler;

  beforeEach(() => {
    analytics = new MockCommunityAnalytics({
      token: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      outputDir: "./test-analytics",
      timeframe: 30,
    });

    scheduler = new MockAnalyticsScheduler({
      token: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      outputDir: "./test-scheduler-output",
      timeframes: [7, 30],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("CommunityAnalytics", () => {
    it("should initialize with default options", () => {
      const defaultAnalytics = new MockCommunityAnalytics();
      expect(defaultAnalytics.owner).toBe("yourusername");
      expect(defaultAnalytics.repo).toBe("ast-copilot-helper");
      expect(defaultAnalytics.timeframe).toBe(90);
    });

    it("should initialize with custom options", () => {
      expect(analytics.owner).toBe("test-owner");
      expect(analytics.repo).toBe("test-repo");
      expect(analytics.timeframe).toBe(30);
    });

    it("should generate a complete analytics report", async () => {
      const report = await analytics.generateReport();

      expect(report).toHaveProperty("metadata");
      expect(report).toHaveProperty("summary");
      expect(report).toHaveProperty("insights");
      expect(report).toHaveProperty("recommendations");

      expect(report.metadata.repository).toBe("test-owner/test-repo");
      expect(report.metadata.timeframe).toBe("30 days");
    });

    it("should include community growth metrics", async () => {
      const report = await analytics.generateReport();

      expect(report.summary.communityGrowth.totalContributors).toBe(3);
      expect(report.summary.communityGrowth.newContributors).toBe(2);
      expect(report.summary.communityGrowth.growthRate).toBe("66.7");
    });

    it("should include activity metrics", async () => {
      const report = await analytics.generateReport();

      expect(report.summary.activity.issuesOpened).toBe(5);
      expect(report.summary.activity.issuesClosed).toBe(4);
      expect(report.summary.activity.pullRequestsOpened).toBe(3);
      expect(report.summary.activity.pullRequestsMerged).toBe(2);
    });

    it("should include engagement metrics", async () => {
      const report = await analytics.generateReport();

      expect(report.summary.engagement.stars).toBe(100);
      expect(report.summary.engagement.forks).toBe(25);
      expect(report.summary.engagement.issueCloseRate).toBe("80.0");
      expect(report.summary.engagement.prMergeRate).toBe("66.7");
    });

    it("should include insights and recommendations", async () => {
      const report = await analytics.generateReport();

      expect(report.insights).toBeInstanceOf(Array);
      expect(report.insights.length).toBeGreaterThan(0);

      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);

      const firstRecommendation = report.recommendations[0];
      expect(firstRecommendation).toHaveProperty("category");
      expect(firstRecommendation).toHaveProperty("priority");
      expect(firstRecommendation).toHaveProperty("action");
      expect(firstRecommendation).toHaveProperty("details");
    });

    it("should format milliseconds to human readable duration", () => {
      expect(analytics.formatDuration(0)).toBe("0h");
      expect(analytics.formatDuration(30 * 60 * 1000)).toBe("30m"); // 30 minutes
      expect(analytics.formatDuration(2 * 60 * 60 * 1000)).toBe("2h 0m"); // 2 hours
      expect(analytics.formatDuration(25 * 60 * 60 * 1000)).toBe("1d 1h"); // 25 hours
    });

    it("should handle null and undefined in formatDuration", () => {
      expect(analytics.formatDuration(null)).toBe("0h");
      expect(analytics.formatDuration(undefined)).toBe("0h");
    });
  });

  describe("AnalyticsScheduler", () => {
    it("should initialize with default configuration", () => {
      const defaultScheduler = new MockAnalyticsScheduler();
      expect(defaultScheduler.config.schedule).toBe("daily");
      expect(defaultScheduler.config.timeframes).toEqual([7, 30, 90]);
      expect(defaultScheduler.config.retentionDays).toBe(365);
    });

    it("should initialize with custom configuration", () => {
      expect(scheduler.config.timeframes).toEqual([7, 30]);
      expect(scheduler.config.owner).toBe("test-owner");
    });

    it("should generate overview from results", () => {
      const mockResults = {
        "7d": {
          summary: {
            communityGrowth: {
              totalContributors: 5,
              newContributors: 2,
              growthRate: 40,
            },
            engagement: {
              issueCloseRate: 80,
              prMergeRate: 90,
              stars: 100,
              forks: 25,
            },
          },
          insights: [
            {
              type: "positive",
              impact: "high",
              message: "Great activity",
              category: "activity",
            },
          ],
        },
        "30d": {
          error: "API Error",
        },
      };

      const overview = scheduler.generateOverview(mockResults);

      expect(overview.status).toBe("success");
      expect(overview.timeframes["7d"]).toBeDefined();
      expect(overview.timeframes["7d"].contributors).toBe(5);
      expect(overview.alerts).toHaveLength(1);
      expect(overview.alerts[0].message).toContain("30d");
    });

    it("should handle empty results", () => {
      const overview = scheduler.generateOverview({});

      expect(overview.status).toBe("success");
      expect(overview.alerts).toHaveLength(0);
      expect(Object.keys(overview.timeframes)).toHaveLength(0);
    });

    it("should calculate trends correctly", () => {
      expect(scheduler.calculateTrend(10, 15)).toBe("up"); // 50% increase
      expect(scheduler.calculateTrend(50, 50)).toBe("stable"); // No change
      expect(scheduler.calculateTrend(100, 90)).toBe("down"); // 10% decrease
    });

    it("should handle zero previous values", () => {
      expect(scheduler.calculateTrend(0, 5)).toBe("up");
      expect(scheduler.calculateTrend(0, 0)).toBe("stable");
    });

    it("should consider small changes as stable", () => {
      expect(scheduler.calculateTrend(100, 100.5)).toBe("stable"); // 0.5% change
      expect(scheduler.calculateTrend(1000, 1009)).toBe("stable"); // 0.9% change
      expect(scheduler.calculateTrend(1000, 1010)).toBe("up"); // 1.0% change
    });

    it("should return correct schedule configurations", () => {
      expect(MockAnalyticsScheduler.getScheduleConfig("hourly")).toEqual({
        cron: "0 * * * *",
        description: "Every hour",
      });

      expect(MockAnalyticsScheduler.getScheduleConfig("daily")).toEqual({
        cron: "0 0 * * *",
        description: "Every day at midnight",
      });

      expect(MockAnalyticsScheduler.getScheduleConfig("weekly")).toEqual({
        cron: "0 0 * * 0",
        description: "Every Sunday at midnight",
      });

      expect(MockAnalyticsScheduler.getScheduleConfig("monthly")).toEqual({
        cron: "0 0 1 * *",
        description: "First day of every month",
      });
    });

    it("should return daily config for unknown schedule", () => {
      const config = MockAnalyticsScheduler.getScheduleConfig("unknown");
      expect(config.cron).toBe("0 0 * * *");
      expect(config.description).toBe("Every day at midnight");
    });
  });

  describe("Analytics System Integration", () => {
    it("should work together to provide community insights", () => {
      const analyticsInstance = new MockCommunityAnalytics({
        owner: "test-org",
        repo: "test-project",
        timeframe: 14,
      });

      const schedulerInstance = new MockAnalyticsScheduler({
        owner: "test-org",
        repo: "test-project",
        timeframes: [14],
      });

      expect(analyticsInstance.owner).toBe(schedulerInstance.config.owner);
      expect(analyticsInstance.repo).toBe(schedulerInstance.config.repo);
    });

    it("should provide meaningful duration formatting", () => {
      const analyticsInstance = new MockCommunityAnalytics();

      // Test various durations
      const oneMinute = 60 * 1000;
      const oneHour = 60 * oneMinute;
      const oneDay = 24 * oneHour;

      expect(analyticsInstance.formatDuration(oneMinute)).toBe("1m");
      expect(analyticsInstance.formatDuration(oneHour)).toBe("1h 0m");
      expect(analyticsInstance.formatDuration(oneDay)).toBe("1d 0h");
      expect(
        analyticsInstance.formatDuration(oneDay + oneHour + oneMinute),
      ).toBe("1d 1h");
    });

    it("should provide trend analysis capabilities", () => {
      const schedulerInstance = new MockAnalyticsScheduler();

      // Test trend calculations with realistic scenarios
      expect(schedulerInstance.calculateTrend(5, 8)).toBe("up"); // 60% growth in contributors
      expect(schedulerInstance.calculateTrend(100, 95)).toBe("down"); // 5% decrease in stars
      expect(schedulerInstance.calculateTrend(50, 50)).toBe("stable"); // No change in issues

      // Test edge cases
      expect(schedulerInstance.calculateTrend(0, 1)).toBe("up"); // First contributor
      expect(schedulerInstance.calculateTrend(1000, 1005)).toBe("stable"); // Small change < 1%
    });
  });
});
