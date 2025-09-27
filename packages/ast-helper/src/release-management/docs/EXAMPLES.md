# Release Management Usage Examples

This document provides comprehensive examples for using the release management system in various scenarios.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Advanced Workflows](#advanced-workflows)
3. [Configuration Examples](#configuration-examples)
4. [Integration Examples](#integration-examples)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)

## Basic Usage

### Simple Release

The most basic release workflow:

```typescript
import { ComprehensiveReleaseManager, ReleaseType } from "../index";

async function simpleRelease() {
  const manager = new ComprehensiveReleaseManager();

  // Basic configuration
  const config = {
    repository: {
      owner: "mycompany",
      name: "myproject",
      defaultBranch: "main",
      releaseBranches: ["main"],
      protectedBranches: ["main"],
      monorepo: false,
    },
    versioning: {
      scheme: "semver" as const,
      initialVersion: "1.0.0",
      channels: [],
      allowPrereleasePromotion: true,
      strictMode: true,
    },
  };

  await manager.initialize(config);

  // Create a patch release
  const plan = await manager.planRelease("1.0.1", ReleaseType.PATCH);
  const validation = await manager.validateRelease(plan);

  if (validation.success) {
    const result = await manager.executeRelease(plan);
    console.log(
      `Release ${result.version} ${result.success ? "succeeded" : "failed"}`,
    );
  } else {
    console.log("Release validation failed:", validation.errors);
  }
}
```

### Prerelease Workflow

Creating and managing prerelease versions:

```typescript
async function prereleaseWorkflow() {
  const manager = new ComprehensiveReleaseManager();
  await manager.initialize(config);

  // Create an alpha prerelease
  const alphaPlan = await manager.planRelease(
    "1.1.0-alpha.1",
    ReleaseType.PRERELEASE,
  );
  const alphaResult = await manager.executeRelease(alphaPlan);

  if (alphaResult.success) {
    console.log("Alpha released successfully");

    // Create a beta after testing alpha
    const betaPlan = await manager.planRelease(
      "1.1.0-beta.1",
      ReleaseType.PRERELEASE,
    );
    const betaResult = await manager.executeRelease(betaPlan);

    if (betaResult.success) {
      console.log("Beta released successfully");

      // Promote to stable release
      const stablePlan = await manager.planRelease("1.1.0", ReleaseType.MINOR);
      const stableResult = await manager.executeRelease(stablePlan);

      console.log(
        `Stable release ${stableResult.success ? "succeeded" : "failed"}`,
      );
    }
  }
}
```

## Advanced Workflows

### Automated Release with CI/CD

Complete automation example for CI/CD pipelines:

```typescript
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

async function automatedRelease() {
  const manager = new ComprehensiveReleaseManager();

  // Load configuration from file
  const configPath = join(process.cwd(), ".releaserc.json");
  const config = JSON.parse(readFileSync(configPath, "utf-8"));

  await manager.initialize(config);

  try {
    // Detect version increment based on conventional commits
    const currentVersion = await manager.getLatestVersion("stable");
    const changes = await manager.generateChangelog(currentVersion, "HEAD");

    // Determine release type from changes
    let releaseType: ReleaseType = ReleaseType.PATCH;
    if (changes.breakingChanges.length > 0) {
      releaseType = ReleaseType.MAJOR;
    } else if (changes.newFeatures.length > 0) {
      releaseType = ReleaseType.MINOR;
    }

    // Calculate next version
    const versionManager = manager["versionManager"];
    const nextVersion = await versionManager.calculateNextVersion(
      currentVersion,
      releaseType,
      changes.entries,
    );

    console.log(
      `Planning ${releaseType} release: ${currentVersion} → ${nextVersion}`,
    );

    // Create and validate release plan
    const plan = await manager.planRelease(nextVersion, releaseType);
    const validation = await manager.validateRelease(plan);

    if (!validation.success) {
      console.error("❌ Release validation failed:");
      validation.errors.forEach((error) => console.error(`  - ${error}`));
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      console.warn("⚠️ Release warnings:");
      validation.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    }

    // Execute release
    const result = await manager.executeRelease(plan);

    if (result.success) {
      console.log(`✅ Release ${result.version} completed successfully!`);

      // Update version files
      const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
      packageJson.version = result.version;
      writeFileSync("package.json", JSON.stringify(packageJson, null, 2));

      // Generate release notes
      const notes = await manager.createReleaseNotes(
        result.version,
        changes.entries,
      );
      writeFileSync(`releases/v${result.version}.md`, notes.content);

      console.log(`📝 Release notes generated: releases/v${result.version}.md`);
    } else {
      console.error(`❌ Release failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("💥 Release process failed:", error);

    // Attempt emergency rollback if we're in a partial state
    try {
      const latestVersion = await manager.getLatestVersion("stable");
      await manager.rollbackRelease(
        latestVersion,
        "Emergency rollback due to release failure",
      );
      console.log("🔄 Emergency rollback completed");
    } catch (rollbackError) {
      console.error("🚨 Emergency rollback also failed:", rollbackError);
    }

    process.exit(1);
  }
}
```

### Monorepo Release Management

Managing releases in a monorepo environment:

```typescript
interface MonorepoPackage {
  name: string;
  path: string;
  dependencies: string[];
  hasChanges: boolean;
}

async function monorepoRelease() {
  const manager = new ComprehensiveReleaseManager();

  const config = {
    repository: {
      owner: "myorg",
      name: "monorepo-project",
      defaultBranch: "main",
      releaseBranches: ["main"],
      protectedBranches: ["main"],
      monorepo: true,
      workspaces: ["packages/*"],
    },
    // ... other config
  };

  await manager.initialize(config);

  // Detect changed packages
  const packages: MonorepoPackage[] = [
    {
      name: "@myorg/core",
      path: "packages/core",
      dependencies: [],
      hasChanges: true,
    },
    {
      name: "@myorg/utils",
      path: "packages/utils",
      dependencies: ["@myorg/core"],
      hasChanges: true,
    },
    {
      name: "@myorg/ui",
      path: "packages/ui",
      dependencies: ["@myorg/core", "@myorg/utils"],
      hasChanges: false,
    },
  ];

  // Determine packages that need to be released
  const packagesToRelease = packages.filter((pkg) => pkg.hasChanges);

  // Sort packages by dependency order
  const sortedPackages = topologicalSort(packagesToRelease);

  console.log(
    "Packages to release:",
    sortedPackages.map((p) => p.name),
  );

  // Release packages in dependency order
  for (const pkg of sortedPackages) {
    console.log(`\n📦 Releasing ${pkg.name}...`);

    const currentVersion = getCurrentVersion(pkg.path);
    const nextVersion = calculateNextVersion(currentVersion, pkg);

    const plan = await manager.planRelease(nextVersion, ReleaseType.MINOR, {
      scope: pkg.name,
      path: pkg.path,
    });

    const validation = await manager.validateRelease(plan);
    if (validation.success) {
      const result = await manager.executeRelease(plan);
      console.log(`✅ ${pkg.name} v${result.version} released`);
    } else {
      console.error(`❌ ${pkg.name} release validation failed`);
      break; // Stop releasing dependent packages
    }
  }
}

function topologicalSort(packages: MonorepoPackage[]): MonorepoPackage[] {
  // Implementation of topological sorting based on dependencies
  const visited = new Set<string>();
  const sorted: MonorepoPackage[] = [];

  function visit(pkg: MonorepoPackage) {
    if (visited.has(pkg.name)) return;
    visited.add(pkg.name);

    // Visit dependencies first
    pkg.dependencies.forEach((depName) => {
      const dep = packages.find((p) => p.name === depName);
      if (dep) visit(dep);
    });

    sorted.push(pkg);
  }

  packages.forEach(visit);
  return sorted;
}
```

### Hotfix Release

Creating emergency hotfix releases:

```typescript
async function hotfixRelease() {
  const manager = new ComprehensiveReleaseManager();
  await manager.initialize(config);

  const criticalIssue = {
    id: "CVE-2023-12345",
    description: "Critical security vulnerability in authentication",
    severity: "CRITICAL",
    affectedVersions: ["1.2.0", "1.2.1", "1.2.2"],
  };

  console.log(
    `🚨 Creating hotfix for ${criticalIssue.id}: ${criticalIssue.description}`,
  );

  // Get the latest stable version
  const latestVersion = await manager.getLatestVersion("stable");
  console.log(`Current stable version: ${latestVersion}`);

  // Calculate hotfix version (patch increment)
  const versionManager = manager["versionManager"];
  const hotfixVersion = await versionManager.calculateNextVersion(
    latestVersion,
    ReleaseType.HOTFIX,
  );

  // Create hotfix plan with special configuration
  const plan = await manager.planRelease(hotfixVersion, ReleaseType.HOTFIX, {
    emergency: true,
    skipNonCriticalValidations: true,
    hotfixMetadata: {
      issueId: criticalIssue.id,
      severity: criticalIssue.severity,
      affectedVersions: criticalIssue.affectedVersions,
    },
  });

  // Fast-track validation (skip some time-consuming checks)
  const validation = await manager.validateRelease(plan);

  if (validation.success || validation.canProceedWithWarnings) {
    console.log("🚀 Executing emergency hotfix release...");

    const result = await manager.executeRelease(plan);

    if (result.success) {
      console.log(`✅ Hotfix ${result.version} released successfully!`);

      // Send emergency notifications
      await sendEmergencyNotification({
        version: result.version,
        issue: criticalIssue,
        releaseNotes: result.releaseNotes,
      });

      // Update security advisories
      await updateSecurityAdvisory(criticalIssue.id, {
        status: "RESOLVED",
        fixedInVersion: result.version,
        releaseDate: new Date(),
      });
    } else {
      console.error(`❌ Hotfix release failed: ${result.error}`);

      // Alert on-call team
      await alertOnCallTeam({
        severity: "CRITICAL",
        message: `Hotfix release for ${criticalIssue.id} failed`,
        error: result.error,
      });
    }
  } else {
    console.error("❌ Hotfix validation failed - manual intervention required");
    validation.errors.forEach((error) => console.error(`  - ${error}`));
  }
}
```

## Configuration Examples

### Complete Production Configuration

```typescript
const productionConfig = {
  repository: {
    owner: "mycompany",
    name: "flagship-product",
    defaultBranch: "main",
    releaseBranches: ["main", "release/*"],
    protectedBranches: ["main", "develop"],
    monorepo: false,
  },

  versioning: {
    scheme: "semver" as const,
    initialVersion: "1.0.0",
    prereleasePattern: "{version}-{channel}.{increment}",
    channels: [
      {
        name: "stable",
        pattern: "^\\d+\\.\\d+\\.\\d+$",
        autoPublish: true,
        requiresApproval: false,
      },
      {
        name: "beta",
        pattern: "^\\d+\\.\\d+\\.\\d+-beta\\.\\d+$",
        autoPublish: true,
        requiresApproval: false,
      },
      {
        name: "alpha",
        pattern: "^\\d+\\.\\d+\\.\\d+-alpha\\.\\d+$",
        autoPublish: false,
        requiresApproval: true,
      },
    ],
    allowPrereleasePromotion: true,
    strictMode: true,
  },

  changelog: {
    enabled: true,
    format: "conventional",
    includeAll: false,
    groupBy: "type",
    template: "keepachangelog",
    breakingChangeTitle: "⚠️ BREAKING CHANGES",
    typeMap: {
      feat: { title: "🚀 Features", semver: "minor" },
      fix: { title: "🐛 Bug Fixes", semver: "patch" },
      docs: { title: "📚 Documentation", semver: null },
      style: { title: "💎 Styles", semver: null },
      refactor: { title: "📦 Code Refactoring", semver: "patch" },
      perf: { title: "🚀 Performance Improvements", semver: "patch" },
      test: { title: "🚨 Tests", semver: null },
      build: { title: "🛠 Build System", semver: null },
      ci: { title: "⚙️ Continuous Integration", semver: null },
      chore: { title: "♻️ Chores", semver: null },
    },
  },

  platforms: [
    {
      name: "npm",
      enabled: true,
      config: {
        registry: "https://registry.npmjs.org/",
        access: "public",
        tag: "latest",
      },
      requirements: ["build", "test", "lint"],
      artifacts: ["dist/**", "package.json", "README.md"],
      postPublish: ["update-cdn-cache", "notify-users"],
    },
    {
      name: "github-releases",
      enabled: true,
      config: {
        owner: "mycompany",
        repo: "flagship-product",
        generateNotes: true,
        draft: false,
        prerelease: false,
      },
      requirements: ["changelog", "artifacts"],
      artifacts: ["dist.zip", "checksums.txt"],
    },
    {
      name: "docker",
      enabled: true,
      config: {
        registry: "docker.io",
        namespace: "mycompany",
        repository: "flagship-product",
        tags: ["latest", "{version}", "v{major}.{minor}"],
      },
      requirements: ["docker-build"],
      artifacts: ["Dockerfile", "dist/**"],
    },
  ],

  compatibility: {
    enabled: true,
    strictMode: false,
    apiCompatibility: {
      enabled: true,
      breakingChangeThreshold: "major",
      checkTypes: true,
      checkExports: true,
    },
    configCompatibility: {
      enabled: true,
      configFiles: ["package.json", "tsconfig.json", ".releaserc.json"],
    },
    migrationGuides: {
      enabled: true,
      template: "detailed",
      includeCodeExamples: true,
    },
  },

  automation: {
    enabled: true,
    triggers: ["schedule", "manual", "webhook"],
    schedule: {
      patch: "0 10 * * WED", // Every Wednesday at 10 AM
      minor: "0 10 1 * *", // First day of every month at 10 AM
      major: null, // Manual only
    },
    autoMerge: {
      enabled: true,
      requiresApproval: true,
      minApprovals: 2,
    },
    rollback: {
      enabled: true,
      autoTriggers: ["health-check-failure", "error-rate-spike"],
      healthChecks: [
        {
          name: "api-health",
          url: "https://api.mycompany.com/health",
          timeout: 30000,
          retries: 3,
        },
      ],
    },
  },

  notifications: {
    enabled: true,
    channels: [
      {
        name: "slack",
        enabled: true,
        config: {
          webhook: process.env.SLACK_WEBHOOK_URL,
          channel: "#releases",
        },
        events: ["release-started", "release-completed", "release-failed"],
      },
      {
        name: "email",
        enabled: true,
        config: {
          smtp: process.env.SMTP_URL,
          from: "releases@mycompany.com",
          to: ["team@mycompany.com"],
        },
        events: ["major-release", "hotfix-release", "release-failed"],
      },
    ],
  },

  rollback: {
    enabled: true,
    strategy: "blue-green",
    maxRollbackHistory: 5,
    autoRollback: {
      enabled: true,
      triggers: [
        {
          type: "error-rate",
          threshold: 0.05, // 5% error rate
          window: "5m",
        },
        {
          type: "response-time",
          threshold: 5000, // 5 second response time
          window: "2m",
        },
      ],
    },
  },
};
```

### Development Configuration

Simplified configuration for development environments:

```typescript
const devConfig = {
  repository: {
    owner: "developer",
    name: "test-project",
    defaultBranch: "main",
    releaseBranches: ["main", "develop"],
    protectedBranches: [],
    monorepo: false,
  },

  versioning: {
    scheme: "semver" as const,
    initialVersion: "0.1.0",
    channels: [
      {
        name: "dev",
        pattern: "^\\d+\\.\\d+\\.\\d+(-\\w+\\.\\d+)?$",
        autoPublish: true,
        requiresApproval: false,
      },
    ],
    allowPrereleasePromotion: true,
    strictMode: false,
  },

  changelog: {
    enabled: true,
    format: "conventional",
    includeAll: true,
    groupBy: "type",
  },

  platforms: [
    {
      name: "npm",
      enabled: true,
      config: {
        registry: "http://localhost:4873/", // Local Verdaccio registry
        access: "public",
      },
      requirements: [],
      artifacts: ["dist/**"],
    },
  ],

  compatibility: {
    enabled: false, // Disabled for development
  },

  automation: {
    enabled: false, // Manual releases only in dev
  },

  notifications: {
    enabled: false, // No notifications in dev
  },

  rollback: {
    enabled: true,
    strategy: "simple",
    maxRollbackHistory: 3,
    autoRollback: {
      enabled: false,
    },
  },
};
```

## Integration Examples

### GitHub Actions Integration

Complete GitHub Actions workflow for automated releases:

```yaml
# .github/workflows/release.yml
name: Release Management

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      release_type:
        description: "Release type"
        required: true
        default: "patch"
        type: choice
        options:
          - patch
          - minor
          - major
          - prerelease
      version:
        description: "Specific version (optional)"
        required: false
        type: string

jobs:
  release:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Run tests
        run: npm test

      - name: Run release management
        run: node scripts/automated-release.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          RELEASE_TYPE: ${{ github.event.inputs.release_type || 'auto' }}
          RELEASE_VERSION: ${{ github.event.inputs.version || '' }}
```

Corresponding automation script:

```javascript
// scripts/automated-release.js
const {
  ComprehensiveReleaseManager,
  ReleaseType,
} = require("../packages/ast-copilot-helper/src/release-management");

async function main() {
  const manager = new ComprehensiveReleaseManager();

  // Load config from environment and files
  const config = await loadReleaseConfig();
  await manager.initialize(config);

  const releaseType = process.env.RELEASE_TYPE || "auto";
  const specifiedVersion = process.env.RELEASE_VERSION;

  let targetVersion;
  let targetType;

  if (specifiedVersion) {
    targetVersion = specifiedVersion;
    targetType = determineReleaseType(specifiedVersion);
  } else if (releaseType === "auto") {
    // Auto-detect from conventional commits
    const result = await autoDetectRelease(manager);
    targetVersion = result.version;
    targetType = result.type;
  } else {
    const currentVersion = await manager.getLatestVersion("stable");
    const versionManager = manager.versionManager;
    targetVersion = await versionManager.calculateNextVersion(
      currentVersion,
      ReleaseType[releaseType.toUpperCase()],
    );
    targetType = ReleaseType[releaseType.toUpperCase()];
  }

  if (!targetVersion) {
    console.log("No release needed");
    process.exit(0);
  }

  console.log(`🚀 Starting release: ${targetVersion} (${targetType})`);

  const plan = await manager.planRelease(targetVersion, targetType);
  const validation = await manager.validateRelease(plan);

  if (!validation.success) {
    console.error("❌ Release validation failed");
    validation.errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  const result = await manager.executeRelease(plan);

  if (result.success) {
    console.log(`✅ Release ${result.version} completed successfully!`);

    // Set output for subsequent workflow steps
    console.log(`::set-output name=version::${result.version}`);
    console.log(`::set-output name=success::true`);

    process.exit(0);
  } else {
    console.error(`❌ Release failed: ${result.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("💥 Release automation failed:", error);
  process.exit(1);
});
```

### VS Code Extension Integration

Integration for VS Code extension development:

```typescript
// src/commands/release-commands.ts
import * as vscode from "vscode";
import {
  ComprehensiveReleaseManager,
  ReleaseType,
} from "../release-management";

export function registerReleaseCommands(context: vscode.ExtensionContext) {
  // Command: Plan Release
  const planReleaseCommand = vscode.commands.registerCommand(
    "ast-copilot-helper.planRelease",
    async () => {
      const manager = new ComprehensiveReleaseManager();
      const config = vscode.workspace.getConfiguration(
        "astCopilotHelper.release",
      );

      await manager.initialize(config);

      // Show version selection quick pick
      const versionOptions = [
        {
          label: "Patch (0.0.1)",
          detail: "Bug fixes and small changes",
          value: ReleaseType.PATCH,
        },
        {
          label: "Minor (0.1.0)",
          detail: "New features, backward compatible",
          value: ReleaseType.MINOR,
        },
        {
          label: "Major (1.0.0)",
          detail: "Breaking changes",
          value: ReleaseType.MAJOR,
        },
        {
          label: "Prerelease",
          detail: "Alpha/beta release",
          value: ReleaseType.PRERELEASE,
        },
      ];

      const selection = await vscode.window.showQuickPick(versionOptions, {
        placeHolder: "Select release type",
      });

      if (selection) {
        const currentVersion = await manager.getLatestVersion("stable");
        const versionManager = manager.versionManager;
        const nextVersion = await versionManager.calculateNextVersion(
          currentVersion,
          selection.value,
        );

        const plan = await manager.planRelease(nextVersion, selection.value);

        // Show plan details in a webview
        showReleasePlan(context, plan);
      }
    },
  );

  // Command: Execute Release
  const executeReleaseCommand = vscode.commands.registerCommand(
    "ast-copilot-helper.executeRelease",
    async (plan?: any) => {
      if (!plan) {
        vscode.window.showErrorMessage("No release plan provided");
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to execute release ${plan.version}?`,
        { modal: true },
        "Yes, Execute Release",
      );

      if (confirm) {
        const manager = new ComprehensiveReleaseManager();
        // ... initialize and execute
      }
    },
  );

  context.subscriptions.push(planReleaseCommand, executeReleaseCommand);
}

function showReleasePlan(context: vscode.ExtensionContext, plan: any) {
  const panel = vscode.window.createWebviewPanel(
    "releasePlan",
    `Release Plan: ${plan.version}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
    },
  );

  panel.webview.html = generateReleasePlanHtml(plan);
}
```

## Error Handling

### Comprehensive Error Handling

```typescript
import { ReleaseError, ValidationError, PublishError } from "../types";

async function robustReleaseWithErrorHandling() {
  const manager = new ComprehensiveReleaseManager();

  try {
    await manager.initialize(config);

    const plan = await manager.planRelease("1.2.0", ReleaseType.MINOR);

    try {
      const validation = await manager.validateRelease(plan);

      if (!validation.success) {
        // Handle validation errors
        const criticalErrors = validation.errors.filter(
          (e) => e.severity === "error",
        );
        const warnings = validation.errors.filter(
          (e) => e.severity === "warning",
        );

        if (criticalErrors.length > 0) {
          console.error("❌ Critical validation errors:");
          criticalErrors.forEach((error) =>
            console.error(`  - ${error.message}`),
          );
          throw new ValidationError(
            "Critical validation failures",
            criticalErrors,
          );
        }

        if (warnings.length > 0) {
          console.warn("⚠️ Validation warnings:");
          warnings.forEach((warning) => console.warn(`  - ${warning.message}`));

          const proceed = await promptUser("Continue with warnings?");
          if (!proceed) {
            throw new ValidationError(
              "User cancelled due to warnings",
              warnings,
            );
          }
        }
      }

      const result = await manager.executeRelease(plan);

      if (!result.success) {
        throw new ReleaseError(`Release execution failed: ${result.error}`, {
          version: plan.version,
          phase: result.failedPhase,
          details: result.details,
        });
      }

      console.log(`✅ Release ${result.version} completed successfully!`);
      return result;
    } catch (error) {
      if (error instanceof ValidationError) {
        console.error("Validation failed:", error.message);
        await logValidationFailure(error);
        throw error;
      }

      if (error instanceof PublishError) {
        console.error(
          `Publishing failed for platform ${error.platform}: ${error.message}`,
        );

        // Attempt partial rollback for failed platforms
        await handlePublishFailure(error, plan);
        throw error;
      }

      throw error; // Re-throw unknown errors
    }
  } catch (error) {
    if (error instanceof ReleaseError) {
      console.error(
        `Release failed at ${error.context?.phase}: ${error.message}`,
      );

      // Attempt rollback
      try {
        await attemptRollback(manager, error.context?.version);
      } catch (rollbackError) {
        console.error("Rollback also failed:", rollbackError);
      }
    }

    // Log error for monitoring
    await logError(error);

    // Notify team of failure
    await notifyTeam({
      type: "release-failure",
      error: error.message,
      version: plan?.version,
      timestamp: new Date(),
    });

    throw error;
  }
}

async function handlePublishFailure(error: PublishError, plan: any) {
  console.log(`Handling publish failure for ${error.platform}`);

  // Get list of successful platforms
  const successfulPlatforms = plan.platforms.filter(
    (p) => p.name !== error.platform && p.publishStatus === "success",
  );

  if (successfulPlatforms.length > 0) {
    console.log(
      "Some platforms published successfully. Attempting partial rollback...",
    );

    for (const platform of successfulPlatforms) {
      try {
        await rollbackPlatform(platform, plan.version);
        console.log(`✅ Rolled back ${platform.name}`);
      } catch (rollbackError) {
        console.error(`❌ Failed to rollback ${platform.name}:`, rollbackError);
      }
    }
  }
}
```

### Retry Logic with Exponential Backoff

```typescript
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${operationName} (attempt ${attempt}/${maxRetries})`);
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `${operationName} failed on attempt ${attempt}: ${error.message}`,
      );

      if (attempt === maxRetries) {
        console.error(`${operationName} failed after ${maxRetries} attempts`);
        break;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`Retrying in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(
    `${operationName} failed after ${maxRetries} attempts: ${lastError.message}`,
  );
}

// Usage example
async function resilientRelease() {
  const manager = new ComprehensiveReleaseManager();

  await executeWithRetry(
    () => manager.initialize(config),
    "Release manager initialization",
  );

  const plan = await executeWithRetry(
    () => manager.planRelease("1.2.0", ReleaseType.MINOR),
    "Release planning",
  );

  const validation = await executeWithRetry(
    () => manager.validateRelease(plan),
    "Release validation",
  );

  if (validation.success) {
    const result = await executeWithRetry(
      () => manager.executeRelease(plan),
      "Release execution",
      2, // Fewer retries for execution to avoid duplicate releases
      2000,
    );

    console.log(`Release ${result.version} completed with retries`);
  }
}
```

## Best Practices

### 1. Configuration Management

```typescript
// Use environment-specific configurations
const getConfig = () => {
  const env = process.env.NODE_ENV || "development";
  const baseConfig = require(`./config/release.${env}.json`);

  // Override with environment variables
  return {
    ...baseConfig,
    repository: {
      ...baseConfig.repository,
      owner: process.env.GITHUB_OWNER || baseConfig.repository.owner,
    },
    platforms: baseConfig.platforms.map((platform) => ({
      ...platform,
      config: {
        ...platform.config,
        // Inject secrets from environment
        ...(platform.name === "npm" && {
          token: process.env.NPM_TOKEN,
        }),
        ...(platform.name === "github-releases" && {
          token: process.env.GITHUB_TOKEN,
        }),
      },
    })),
  };
};
```

### 2. Testing Release Plans

```typescript
// Always test release plans in dry-run mode first
async function testReleasePlan() {
  const manager = new ComprehensiveReleaseManager();

  const testConfig = {
    ...config,
    dryRun: true, // Enable dry-run mode
    platforms: config.platforms.map((p) => ({
      ...p,
      enabled: false, // Disable actual publishing
    })),
  };

  await manager.initialize(testConfig);

  const plan = await manager.planRelease("1.2.0", ReleaseType.MINOR);
  const validation = await manager.validateRelease(plan);

  console.log("Dry-run validation result:", validation);

  if (validation.success) {
    // Simulate execution without actual publishing
    const result = await manager.executeRelease(plan);
    console.log("Dry-run execution would have resulted in:", result);
  }
}
```

### 3. Monitoring and Alerting

```typescript
// Implement comprehensive monitoring
async function monitoredRelease() {
  const manager = new ComprehensiveReleaseManager();

  // Add performance monitoring
  const startTime = Date.now();

  const result = await manager.executeRelease(plan);

  const duration = Date.now() - startTime;
  const metrics = {
    version: result.version,
    duration,
    success: result.success,
    platforms: result.publishResults?.length || 0,
    timestamp: new Date(),
  };

  // Send metrics to monitoring system
  await sendMetrics("release.completed", metrics);

  // Set up post-release monitoring
  if (result.success) {
    await setupHealthChecks(result.version);
    await schedulePostReleaseValidation(result.version);
  }
}
```

This comprehensive example guide provides practical, real-world scenarios for using the release management system effectively across different environments and use cases.
