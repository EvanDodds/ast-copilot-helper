#!/usr/bin/env node

/**
 * Community Analytics Dashboard
 * Tracks community health, engagement metrics, and contribution patterns
 */

import { Octokit } from "@octokit/rest";
import fs from "fs/promises";
import path from "path";

export class CommunityAnalytics {
  constructor(options = {}) {
    this.octokit = new Octokit({
      auth: options.token || process.env.GITHUB_TOKEN,
    });

    this.owner = options.owner || "yourusername";
    this.repo = options.repo || "ast-copilot-helper";
    this.outputDir = options.outputDir || "./analytics-output";
    this.timeframe = options.timeframe || 90; // days
  }

  /**
   * Generate comprehensive community analytics report
   */
  async generateReport() {
    console.log("🔍 Gathering community analytics...");

    const startTime = new Date();
    const endDate = new Date();
    const startDate = new Date(
      endDate.getTime() - this.timeframe * 24 * 60 * 60 * 1000,
    );

    try {
      // Gather all data in parallel for efficiency
      const [
        contributorMetrics,
        issueMetrics,
        prMetrics,
        discussionMetrics,
        releaseMetrics,
        engagementMetrics,
        healthMetrics,
      ] = await Promise.all([
        this.getContributorMetrics(startDate, endDate),
        this.getIssueMetrics(startDate, endDate),
        this.getPullRequestMetrics(startDate, endDate),
        this.getDiscussionMetrics(startDate, endDate),
        this.getReleaseMetrics(startDate, endDate),
        this.getEngagementMetrics(startDate, endDate),
        this.getCommunityHealthMetrics(),
      ]);

      const report = {
        metadata: {
          generatedAt: new Date().toISOString(),
          timeframe: `${this.timeframe} days`,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          repository: `${this.owner}/${this.repo}`,
        },
        summary: this.generateSummary({
          contributorMetrics,
          issueMetrics,
          prMetrics,
          discussionMetrics,
          releaseMetrics,
          engagementMetrics,
          healthMetrics,
        }),
        metrics: {
          contributors: contributorMetrics,
          issues: issueMetrics,
          pullRequests: prMetrics,
          discussions: discussionMetrics,
          releases: releaseMetrics,
          engagement: engagementMetrics,
          health: healthMetrics,
        },
        insights: this.generateInsights({
          contributorMetrics,
          issueMetrics,
          prMetrics,
          discussionMetrics,
          engagementMetrics,
        }),
        recommendations: this.generateRecommendations({
          contributorMetrics,
          issueMetrics,
          prMetrics,
          discussionMetrics,
          healthMetrics,
        }),
      };

      await this.saveReport(report);
      console.log(
        `✅ Community analytics report generated in ${Date.now() - startTime.getTime()}ms`,
      );

      return report;
    } catch (error) {
      console.error("❌ Error generating analytics report:", error);
      throw error;
    }
  }

  /**
   * Get contributor metrics and patterns
   */
  async getContributorMetrics(startDate, endDate) {
    const contributors = new Map();
    const newContributors = new Set();

    // Get commits
    const commits = await this.getAllPaginatedData(
      this.octokit.rest.repos.listCommits,
      {
        owner: this.owner,
        repo: this.repo,
        since: startDate.toISOString(),
        until: endDate.toISOString(),
      },
    );

    // Get issues
    const issues = await this.getAllPaginatedData(
      this.octokit.rest.issues.listForRepo,
      {
        owner: this.owner,
        repo: this.repo,
        state: "all",
        since: startDate.toISOString(),
      },
    );

    // Get pull requests
    const prs = await this.getAllPaginatedData(this.octokit.rest.pulls.list, {
      owner: this.owner,
      repo: this.repo,
      state: "all",
    });

    // Process commits
    for (const commit of commits) {
      if (!commit.author) continue;

      const login = commit.author.login;
      if (!contributors.has(login)) {
        contributors.set(login, {
          login,
          name: commit.author.name || commit.commit.author.name,
          avatar: commit.author.avatar_url,
          commits: 0,
          issues: 0,
          pullRequests: 0,
          firstActivity: new Date(commit.commit.author.date),
          lastActivity: new Date(commit.commit.author.date),
          type: "contributor",
        });
      }

      const contributor = contributors.get(login);
      contributor.commits++;

      const commitDate = new Date(commit.commit.author.date);
      if (commitDate < contributor.firstActivity) {
        contributor.firstActivity = commitDate;
      }
      if (commitDate > contributor.lastActivity) {
        contributor.lastActivity = commitDate;
      }
    }

    // Process issues
    for (const issue of issues) {
      if (!issue.user || issue.pull_request) continue;

      const login = issue.user.login;
      if (contributors.has(login)) {
        contributors.get(login).issues++;
      }
    }

    // Process pull requests
    for (const pr of prs) {
      if (!pr.user) continue;

      const login = pr.user.login;
      if (contributors.has(login)) {
        contributors.get(login).pullRequests++;
      }
    }

    // Identify new contributors (first activity in timeframe)
    for (const contributor of contributors.values()) {
      if (contributor.firstActivity >= startDate) {
        newContributors.add(contributor.login);
        contributor.type = "new";
      }
    }

    return {
      total: contributors.size,
      new: newContributors.size,
      active: contributors.size, // All in timeframe are active
      contributors: Array.from(contributors.values()),
      topContributors: Array.from(contributors.values())
        .sort(
          (a, b) =>
            b.commits +
            b.issues +
            b.pullRequests -
            (a.commits + a.issues + a.pullRequests),
        )
        .slice(0, 10),
      newContributors: Array.from(contributors.values()).filter((c) =>
        newContributors.has(c.login),
      ),
    };
  }

  /**
   * Get issue metrics and trends
   */
  async getIssueMetrics(startDate, endDate) {
    const issues = await this.getAllPaginatedData(
      this.octokit.rest.issues.listForRepo,
      {
        owner: this.owner,
        repo: this.repo,
        state: "all",
        since: startDate.toISOString(),
      },
    );

    const metrics = {
      total: 0,
      opened: 0,
      closed: 0,
      openRate: 0,
      closeRate: 0,
      averageCloseTime: 0,
      labels: new Map(),
      types: new Map(),
      timeline: new Map(),
      responseTime: {
        total: 0,
        count: 0,
        average: 0,
        median: 0,
        times: [],
      },
    };

    const closeTimes = [];

    for (const issue of issues) {
      // Skip pull requests
      if (issue.pull_request) continue;

      metrics.total++;

      const createdAt = new Date(issue.created_at);
      const closedAt = issue.closed_at ? new Date(issue.closed_at) : null;

      // Count opened in timeframe
      if (createdAt >= startDate && createdAt <= endDate) {
        metrics.opened++;

        // Track timeline
        const day = createdAt.toISOString().split("T")[0];
        metrics.timeline.set(day, (metrics.timeline.get(day) || 0) + 1);
      }

      // Count closed in timeframe
      if (closedAt && closedAt >= startDate && closedAt <= endDate) {
        metrics.closed++;

        // Calculate close time
        const closeTime = closedAt.getTime() - createdAt.getTime();
        closeTimes.push(closeTime);
      }

      // Track labels
      for (const label of issue.labels) {
        const labelName = typeof label === "string" ? label : label.name;
        metrics.labels.set(labelName, (metrics.labels.get(labelName) || 0) + 1);
      }

      // Get first response time
      try {
        const comments = await this.octokit.rest.issues.listComments({
          owner: this.owner,
          repo: this.repo,
          issue_number: issue.number,
        });

        if (comments.data.length > 0) {
          const firstComment = comments.data[0];
          const responseTime =
            new Date(firstComment.created_at).getTime() - createdAt.getTime();
          metrics.responseTime.times.push(responseTime);
          metrics.responseTime.total += responseTime;
          metrics.responseTime.count++;
        }
      } catch {
        // Skip if unable to get comments
      }
    }

    // Calculate rates and averages
    if (metrics.opened > 0) {
      metrics.closeRate = (metrics.closed / metrics.opened) * 100;
    }

    if (closeTimes.length > 0) {
      metrics.averageCloseTime =
        closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length;
    }

    if (metrics.responseTime.count > 0) {
      metrics.responseTime.average =
        metrics.responseTime.total / metrics.responseTime.count;
      metrics.responseTime.times.sort((a, b) => a - b);
      const mid = Math.floor(metrics.responseTime.times.length / 2);
      metrics.responseTime.median = metrics.responseTime.times[mid];
    }

    // Convert maps to objects for JSON serialization
    metrics.labels = Object.fromEntries(metrics.labels);
    metrics.timeline = Object.fromEntries(metrics.timeline);

    return metrics;
  }

  /**
   * Get pull request metrics and trends
   */
  async getPullRequestMetrics(startDate, endDate) {
    const prs = await this.getAllPaginatedData(this.octokit.rest.pulls.list, {
      owner: this.owner,
      repo: this.repo,
      state: "all",
    });

    const metrics = {
      total: 0,
      opened: 0,
      merged: 0,
      closed: 0,
      mergeRate: 0,
      averageMergeTime: 0,
      timeline: new Map(),
      sizes: { small: 0, medium: 0, large: 0 },
      reviewTime: {
        total: 0,
        count: 0,
        average: 0,
        times: [],
      },
    };

    const mergeTimes = [];

    for (const pr of prs) {
      metrics.total++;

      const createdAt = new Date(pr.created_at);
      const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;
      const closedAt = pr.closed_at ? new Date(pr.closed_at) : null;

      // Count opened in timeframe
      if (createdAt >= startDate && createdAt <= endDate) {
        metrics.opened++;

        // Track timeline
        const day = createdAt.toISOString().split("T")[0];
        metrics.timeline.set(day, (metrics.timeline.get(day) || 0) + 1);
      }

      // Count merged in timeframe
      if (mergedAt && mergedAt >= startDate && mergedAt <= endDate) {
        metrics.merged++;

        // Calculate merge time
        const mergeTime = mergedAt.getTime() - createdAt.getTime();
        mergeTimes.push(mergeTime);
      }

      // Count closed (not merged) in timeframe
      if (
        closedAt &&
        !mergedAt &&
        closedAt >= startDate &&
        closedAt <= endDate
      ) {
        metrics.closed++;
      }

      // Categorize by size (rough estimate based on changes)
      const additions = pr.additions || 0;
      const deletions = pr.deletions || 0;
      const changes = additions + deletions;

      if (changes < 50) {
        metrics.sizes.small++;
      } else if (changes < 200) {
        metrics.sizes.medium++;
      } else {
        metrics.sizes.large++;
      }

      // Get review time (time to first review)
      try {
        const reviews = await this.octokit.rest.pulls.listReviews({
          owner: this.owner,
          repo: this.repo,
          pull_number: pr.number,
        });

        if (reviews.data.length > 0) {
          const firstReview = reviews.data[0];
          const reviewTime =
            new Date(firstReview.submitted_at).getTime() - createdAt.getTime();
          metrics.reviewTime.times.push(reviewTime);
          metrics.reviewTime.total += reviewTime;
          metrics.reviewTime.count++;
        }
      } catch {
        // Skip if unable to get reviews
      }
    }

    // Calculate rates and averages
    if (metrics.opened > 0) {
      metrics.mergeRate = (metrics.merged / metrics.opened) * 100;
    }

    if (mergeTimes.length > 0) {
      metrics.averageMergeTime =
        mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length;
    }

    if (metrics.reviewTime.count > 0) {
      metrics.reviewTime.average =
        metrics.reviewTime.total / metrics.reviewTime.count;
    }

    // Convert maps to objects for JSON serialization
    metrics.timeline = Object.fromEntries(metrics.timeline);

    return metrics;
  }

  /**
   * Get discussion metrics (mock implementation - would need GitHub GraphQL API)
   */
  async getDiscussionMetrics(_startDate, _endDate) {
    // Note: GitHub Discussions require GraphQL API
    // This is a mock implementation showing the structure
    return {
      total: 0,
      new: 0,
      answered: 0,
      answerRate: 0,
      categories: {
        "Q&A": 0,
        Ideas: 0,
        General: 0,
        "Show and tell": 0,
        Announcements: 0,
      },
      engagement: {
        views: 0,
        reactions: 0,
        comments: 0,
      },
    };
  }

  /**
   * Get release metrics and patterns
   */
  async getReleaseMetrics(startDate, endDate) {
    const releases = await this.getAllPaginatedData(
      this.octokit.rest.repos.listReleases,
      {
        owner: this.owner,
        repo: this.repo,
      },
    );

    const metrics = {
      total: 0,
      inTimeframe: 0,
      preReleases: 0,
      drafts: 0,
      averageTimeBetween: 0,
      downloadStats: {
        total: 0,
        average: 0,
      },
    };

    const releaseDates = [];
    let totalDownloads = 0;

    for (const release of releases) {
      metrics.total++;

      const publishedAt = new Date(release.published_at);
      releaseDates.push(publishedAt);

      if (publishedAt >= startDate && publishedAt <= endDate) {
        metrics.inTimeframe++;
      }

      if (release.prerelease) metrics.preReleases++;
      if (release.draft) metrics.drafts++;

      // Sum up download counts
      for (const asset of release.assets) {
        totalDownloads += asset.download_count;
      }
    }

    metrics.downloadStats.total = totalDownloads;
    metrics.downloadStats.average =
      metrics.total > 0 ? totalDownloads / metrics.total : 0;

    // Calculate average time between releases
    if (releaseDates.length > 1) {
      releaseDates.sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < releaseDates.length; i++) {
        intervals.push(releaseDates[i] - releaseDates[i - 1]);
      }
      metrics.averageTimeBetween =
        intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }

    return metrics;
  }

  /**
   * Get engagement metrics across the repository
   */
  async getEngagementMetrics(_startDate, _endDate) {
    const repo = await this.octokit.rest.repos.get({
      owner: this.owner,
      repo: this.repo,
    });

    const metrics = {
      stars: repo.data.stargazers_count,
      forks: repo.data.forks_count,
      watchers: repo.data.subscribers_count,
      traffic: {
        views: { total: 0, unique: 0 },
        clones: { total: 0, unique: 0 },
      },
      activity: {
        commits: 0,
        issues: 0,
        pullRequests: 0,
        releases: 0,
      },
    };

    // Get traffic data (requires push access)
    try {
      const views = await this.octokit.rest.repos.getViews({
        owner: this.owner,
        repo: this.repo,
      });
      metrics.traffic.views = views.data;

      const clones = await this.octokit.rest.repos.getClones({
        owner: this.owner,
        repo: this.repo,
      });
      metrics.traffic.clones = clones.data;
    } catch {
      // Traffic data requires push access, skip if not available
    }

    return metrics;
  }

  /**
   * Get community health metrics
   */
  async getCommunityHealthMetrics() {
    const communityProfile =
      await this.octokit.rest.repos.getCommunityProfileMetrics({
        owner: this.owner,
        repo: this.repo,
      });

    return {
      healthPercentage: communityProfile.data.health_percentage,
      files: communityProfile.data.files,
      updatedAt: communityProfile.data.updated_at,
    };
  }

  /**
   * Generate executive summary
   */
  generateSummary(data) {
    const { contributorMetrics, issueMetrics, prMetrics, engagementMetrics } =
      data;

    return {
      communityGrowth: {
        totalContributors: contributorMetrics.total,
        newContributors: contributorMetrics.new,
        growthRate:
          contributorMetrics.total > 0
            ? (
                (contributorMetrics.new / contributorMetrics.total) *
                100
              ).toFixed(1)
            : 0,
      },
      activity: {
        issuesOpened: issueMetrics.opened,
        issuesClosed: issueMetrics.closed,
        pullRequestsOpened: prMetrics.opened,
        pullRequestsMerged: prMetrics.merged,
      },
      engagement: {
        stars: engagementMetrics.stars,
        forks: engagementMetrics.forks,
        issueCloseRate: issueMetrics.closeRate.toFixed(1),
        prMergeRate: prMetrics.mergeRate.toFixed(1),
      },
      responseTime: {
        averageIssueResponse: this.formatDuration(
          issueMetrics.responseTime.average,
        ),
        averagePrReview: this.formatDuration(prMetrics.reviewTime.average),
      },
    };
  }

  /**
   * Generate insights and trends
   */
  generateInsights(data) {
    const { contributorMetrics, issueMetrics, prMetrics } = data;
    const insights = [];

    // Contributor insights
    if (contributorMetrics.new > 0) {
      insights.push({
        type: "positive",
        category: "contributors",
        message: `${contributorMetrics.new} new contributors joined the project`,
        impact: "high",
      });
    }

    // Issue insights
    if (issueMetrics.closeRate > 80) {
      insights.push({
        type: "positive",
        category: "issues",
        message: `High issue close rate (${issueMetrics.closeRate.toFixed(1)}%)`,
        impact: "medium",
      });
    } else if (issueMetrics.closeRate < 50) {
      insights.push({
        type: "warning",
        category: "issues",
        message: `Low issue close rate (${issueMetrics.closeRate.toFixed(1)}%)`,
        impact: "high",
      });
    }

    // PR insights
    if (prMetrics.mergeRate > 80) {
      insights.push({
        type: "positive",
        category: "pullRequests",
        message: `High PR merge rate (${prMetrics.mergeRate.toFixed(1)}%)`,
        impact: "medium",
      });
    }

    // Response time insights
    if (issueMetrics.responseTime.average < 24 * 60 * 60 * 1000) {
      // 24 hours
      insights.push({
        type: "positive",
        category: "responsiveness",
        message: "Fast average response time to issues",
        impact: "medium",
      });
    }

    return insights;
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(data) {
    const { contributorMetrics, issueMetrics, prMetrics } = data;
    const recommendations = [];

    // Contributor recommendations
    if (contributorMetrics.new < 3) {
      recommendations.push({
        category: "growth",
        priority: "high",
        action: "Focus on attracting new contributors",
        details: [
          'Create "good first issue" labels',
          "Improve onboarding documentation",
          "Host community events or hackathons",
          "Engage on social media and forums",
        ],
      });
    }

    // Issue management recommendations
    if (issueMetrics.closeRate < 70) {
      recommendations.push({
        category: "maintenance",
        priority: "high",
        action: "Improve issue resolution process",
        details: [
          "Review and close stale issues",
          "Improve issue triage process",
          "Add more issue labels for better categorization",
          "Create issue templates if not already present",
        ],
      });
    }

    // Response time recommendations
    if (issueMetrics.responseTime.average > 7 * 24 * 60 * 60 * 1000) {
      // 7 days
      recommendations.push({
        category: "engagement",
        priority: "medium",
        action: "Improve response times",
        details: [
          "Set up issue notification workflows",
          "Recruit community moderators",
          "Create auto-responses for common questions",
          "Establish response time goals",
        ],
      });
    }

    // PR recommendations
    if (prMetrics.opened > 0 && prMetrics.merged / prMetrics.opened < 0.5) {
      recommendations.push({
        category: "development",
        priority: "medium",
        action: "Improve PR acceptance rate",
        details: [
          "Provide clearer contribution guidelines",
          "Offer feedback on rejected PRs",
          "Create PR templates with requirements",
          "Improve code review process",
        ],
      });
    }

    return recommendations;
  }

  /**
   * Save report to files
   */
  async saveReport(report) {
    await fs.mkdir(this.outputDir, { recursive: true });

    // Save JSON report
    const jsonPath = path.join(this.outputDir, "community-analytics.json");
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

    // Save HTML report
    const htmlPath = path.join(this.outputDir, "community-analytics.html");
    const htmlContent = this.generateHTMLReport(report);
    await fs.writeFile(htmlPath, htmlContent);

    // Save CSV summary
    const csvPath = path.join(this.outputDir, "community-summary.csv");
    const csvContent = this.generateCSVSummary(report);
    await fs.writeFile(csvPath, csvContent);

    console.log(`📊 Reports saved:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   HTML: ${htmlPath}`);
    console.log(`   CSV: ${csvPath}`);
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(report) {
    const { metadata, summary, metrics, insights, recommendations } = report;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Community Analytics - ${metadata.repository}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: white; border: 1px solid #e1e8ed; border-radius: 8px; padding: 20px; }
        .metric-value { font-size: 2em; font-weight: bold; color: #1da1f2; }
        .metric-label { color: #657786; font-size: 0.9em; }
        .insight { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .insight.positive { background: #d4edda; border-left: 4px solid #28a745; }
        .insight.warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .insight.negative { background: #f8d7da; border-left: 4px solid #dc3545; }
        .recommendation { background: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 4px; padding: 15px; margin: 10px 0; }
        .chart-placeholder { background: #f8f9fa; height: 300px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #657786; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e1e8ed; }
        th { background: #f8f9fa; font-weight: 600; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏘️ Community Analytics Dashboard</h1>
        <p><strong>Repository:</strong> ${metadata.repository}</p>
        <p><strong>Period:</strong> ${new Date(metadata.startDate).toLocaleDateString()} - ${new Date(metadata.endDate).toLocaleDateString()} (${metadata.timeframe})</p>
        <p><strong>Generated:</strong> ${new Date(metadata.generatedAt).toLocaleString()}</p>
    </div>

    <section>
        <h2>📊 Executive Summary</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${summary.communityGrowth.totalContributors}</div>
                <div class="metric-label">Total Contributors</div>
                <small>+${summary.communityGrowth.newContributors} new (${summary.communityGrowth.growthRate}% growth)</small>
            </div>
            <div class="metric-card">
                <div class="metric-value">${summary.activity.issuesOpened}</div>
                <div class="metric-label">Issues Opened</div>
                <small>${summary.activity.issuesClosed} closed (${summary.engagement.issueCloseRate}% rate)</small>
            </div>
            <div class="metric-card">
                <div class="metric-value">${summary.activity.pullRequestsOpened}</div>
                <div class="metric-label">Pull Requests</div>
                <small>${summary.activity.pullRequestsMerged} merged (${summary.engagement.prMergeRate}% rate)</small>
            </div>
            <div class="metric-card">
                <div class="metric-value">${summary.engagement.stars}</div>
                <div class="metric-label">GitHub Stars</div>
                <small>${summary.engagement.forks} forks</small>
            </div>
        </div>
    </section>

    <section>
        <h2>🔍 Key Insights</h2>
        ${insights
          .map(
            (insight) => `
            <div class="insight ${insight.type}">
                <strong>${insight.category.charAt(0).toUpperCase() + insight.category.slice(1)}:</strong> ${insight.message}
                <small style="float: right;">${insight.impact} impact</small>
            </div>
        `,
          )
          .join("")}
    </section>

    <section>
        <h2>👥 Contributor Metrics</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${metrics.contributors.total}</div>
                <div class="metric-label">Active Contributors</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.contributors.new}</div>
                <div class="metric-label">New Contributors</div>
            </div>
        </div>
        
        <h3>Top Contributors</h3>
        <table>
            <thead>
                <tr><th>Contributor</th><th>Commits</th><th>Issues</th><th>PRs</th><th>Total Activity</th></tr>
            </thead>
            <tbody>
                ${metrics.contributors.topContributors
                  .map(
                    (c) => `
                    <tr>
                        <td>${c.name || c.login}</td>
                        <td>${c.commits}</td>
                        <td>${c.issues}</td>
                        <td>${c.pullRequests}</td>
                        <td>${c.commits + c.issues + c.pullRequests}</td>
                    </tr>
                `,
                  )
                  .join("")}
            </tbody>
        </table>
    </section>

    <section>
        <h2>🎯 Recommendations</h2>
        ${recommendations
          .map(
            (rec) => `
            <div class="recommendation">
                <h4>${rec.action} <small style="color: #657786;">(${rec.priority} priority)</small></h4>
                <ul>
                    ${rec.details.map((detail) => `<li>${detail}</li>`).join("")}
                </ul>
            </div>
        `,
          )
          .join("")}
    </section>

    <section>
        <h2>📈 Detailed Metrics</h2>
        
        <h3>Issues</h3>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${metrics.issues.opened}</div>
                <div class="metric-label">Issues Opened</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.issues.closed}</div>
                <div class="metric-label">Issues Closed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.issues.closeRate.toFixed(1)}%</div>
                <div class="metric-label">Close Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${this.formatDuration(metrics.issues.averageCloseTime)}</div>
                <div class="metric-label">Avg Close Time</div>
            </div>
        </div>

        <h3>Pull Requests</h3>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${metrics.pullRequests.opened}</div>
                <div class="metric-label">PRs Opened</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.pullRequests.merged}</div>
                <div class="metric-label">PRs Merged</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.pullRequests.mergeRate.toFixed(1)}%</div>
                <div class="metric-label">Merge Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${this.formatDuration(metrics.pullRequests.averageMergeTime)}</div>
                <div class="metric-label">Avg Merge Time</div>
            </div>
        </div>
    </section>

    <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e1e8ed; color: #657786; text-align: center;">
        <p>Generated by ast-copilot-helper Community Analytics • ${new Date(metadata.generatedAt).toLocaleString()}</p>
    </footer>
</body>
</html>`;
  }

  /**
   * Generate CSV summary
   */
  generateCSVSummary(report) {
    const { summary } = report;

    let csv = "Metric,Value,Note\n";
    csv += `Total Contributors,${summary.communityGrowth.totalContributors},Active in timeframe\n`;
    csv += `New Contributors,${summary.communityGrowth.newContributors},First activity in timeframe\n`;
    csv += `Growth Rate,${summary.communityGrowth.growthRate}%,New/Total contributors\n`;
    csv += `Issues Opened,${summary.activity.issuesOpened},In timeframe\n`;
    csv += `Issues Closed,${summary.activity.issuesClosed},In timeframe\n`;
    csv += `Issue Close Rate,${summary.engagement.issueCloseRate}%,Closed/Opened ratio\n`;
    csv += `PRs Opened,${summary.activity.pullRequestsOpened},In timeframe\n`;
    csv += `PRs Merged,${summary.activity.pullRequestsMerged},In timeframe\n`;
    csv += `PR Merge Rate,${summary.engagement.prMergeRate}%,Merged/Opened ratio\n`;
    csv += `GitHub Stars,${summary.engagement.stars},Current total\n`;
    csv += `GitHub Forks,${summary.engagement.forks},Current total\n`;

    return csv;
  }

  /**
   * Get all paginated data from GitHub API
   */
  async getAllPaginatedData(apiMethod, params) {
    const allData = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      try {
        const response = await apiMethod({
          ...params,
          page,
          per_page: 100,
        });

        allData.push(...response.data);
        hasNextPage = response.data.length === 100;
        page++;

        // Add delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        if (
          error.status === 403 &&
          error.headers &&
          error.headers["x-ratelimit-remaining"] === "0"
        ) {
          // Rate limit hit, wait and retry
          const resetTime = parseInt(error.headers["x-ratelimit-reset"]) * 1000;
          const waitTime = resetTime - Date.now() + 1000; // Add 1 second buffer
          console.log(`Rate limit hit, waiting ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
        console.warn(`Error fetching page ${page}:`, error.message);
        break;
      }
    }

    return allData;
  }

  /**
   * Format duration in milliseconds to human readable format
   */
  formatDuration(ms) {
    if (!ms || ms === 0) return "0h";

    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}

// CLI interface
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const options = {
    token: process.env.GITHUB_TOKEN,
    owner: process.argv[2] || "yourusername",
    repo: process.argv[3] || "ast-copilot-helper",
    timeframe: parseInt(process.argv[4]) || 90,
    outputDir: process.argv[5] || "./analytics-output",
  };

  const analytics = new CommunityAnalytics(options);

  analytics
    .generateReport()
    .then((report) => {
      console.log("\n📊 Analytics Summary:");
      console.log(
        `   Contributors: ${report.summary.communityGrowth.totalContributors} (+${report.summary.communityGrowth.newContributors} new)`,
      );
      console.log(
        `   Issues: ${report.summary.activity.issuesOpened} opened, ${report.summary.activity.issuesClosed} closed`,
      );
      console.log(
        `   PRs: ${report.summary.activity.pullRequestsOpened} opened, ${report.summary.activity.pullRequestsMerged} merged`,
      );
      console.log(
        `   Engagement: ${report.summary.engagement.stars} stars, ${report.summary.engagement.forks} forks`,
      );

      if (report.insights.length > 0) {
        console.log("\n💡 Key Insights:");
        report.insights.forEach((insight) => {
          console.log(
            `   ${insight.type === "positive" ? "✅" : insight.type === "warning" ? "⚠️" : "❌"} ${insight.message}`,
          );
        });
      }

      if (report.recommendations.length > 0) {
        console.log("\n🎯 Recommendations:");
        report.recommendations.forEach((rec) => {
          console.log(
            `   ${rec.priority === "high" ? "🔴" : rec.priority === "medium" ? "🟡" : "🟢"} ${rec.action}`,
          );
        });
      }

      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Analytics generation failed:", error);
      process.exit(1);
    });
}
