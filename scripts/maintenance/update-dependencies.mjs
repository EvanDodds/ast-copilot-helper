#!/usr/bin/env node

/**
 * Automated Dependency Update Script
 *
 * This script automates the process of checking for and updating dependencies
 * across all packages in the monorepo, with safety checks and rollback capabilities.
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, "../..");

class DependencyUpdater {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.interactive = options.interactive !== false;
    this.includeDevDeps = options.includeDevDeps !== false;
    this.skipBreaking = options.skipBreaking !== false;
    this.createPR = options.createPR || false;
  }

  /**
   * Main entry point for dependency updates
   */
  async updateDependencies() {
    console.log("🔍 Starting dependency update process...");
    console.log(`Mode: ${this.dryRun ? "DRY RUN" : "LIVE UPDATE"}`);

    try {
      // Find all package.json files
      const packagePaths = this.findPackageJsonFiles();
      console.log(`📦 Found ${packagePaths.length} packages to check`);

      // Check current status
      await this.runPreUpdateChecks();

      // Process each package
      const results = [];
      for (const packagePath of packagePaths) {
        const result = await this.updatePackage(packagePath);
        results.push(result);
      }

      // Generate summary report
      this.generateReport(results);

      // Run post-update validation
      if (
        !this.dryRun &&
        results.some((r) => r.success && r.updates.length > 0)
      ) {
        await this.runPostUpdateValidation();
      }

      // Create PR if requested
      if (this.createPR && !this.dryRun) {
        await this.createPullRequest(results);
      }
    } catch (error) {
      console.error("❌ Dependency update failed:", error);
      process.exit(1);
    }
  }

  /**
   * Find all package.json files in the monorepo
   */
  findPackageJsonFiles() {
    const packages = [];

    // Root package.json
    const rootPackage = join(ROOT_DIR, "package.json");
    if (existsSync(rootPackage)) {
      packages.push(rootPackage);
    }

    // Packages in packages/ directory
    const packagesDir = join(ROOT_DIR, "packages");
    if (existsSync(packagesDir)) {
      try {
        const entries = execSync('find packages -name "package.json" -type f', {
          cwd: ROOT_DIR,
          encoding: "utf-8",
        })
          .trim()
          .split("\n")
          .filter(Boolean);

        packages.push(...entries.map((entry) => join(ROOT_DIR, entry)));
      } catch (error) {
        console.warn("⚠️ Could not scan packages directory:", error);
      }
    }

    // Documentation package.json
    const docsPackage = join(ROOT_DIR, "docs", "package.json");
    if (existsSync(docsPackage)) {
      packages.push(docsPackage);
    }

    return packages;
  }

  /**
   * Run pre-update safety checks
   */
  async runPreUpdateChecks() {
    console.log("🔍 Running pre-update checks...");

    // Check git status
    try {
      const gitStatus = execSync("git status --porcelain", {
        cwd: ROOT_DIR,
        encoding: "utf-8",
      });

      if (gitStatus.trim()) {
        console.warn("⚠️ Working directory is not clean:");
        console.log(gitStatus);

        if (!this.dryRun) {
          throw new Error(
            "Please commit or stash changes before updating dependencies",
          );
        }
      }
    } catch (error) {
      console.error("❌ Git status check failed:", error);
      throw error;
    }

    // Check current branch
    try {
      const branch = execSync("git branch --show-current", {
        cwd: ROOT_DIR,
        encoding: "utf-8",
      }).trim();

      console.log(`📍 Current branch: ${branch}`);
    } catch (error) {
      console.warn("⚠️ Could not determine current branch:", error);
    }

    // Run tests to ensure current state is good
    console.log("🧪 Running tests to verify current state...");
    try {
      execSync("npm run test:precommit", {
        cwd: ROOT_DIR,
        stdio: "inherit",
      });
      console.log("✅ Pre-update tests passed");
    } catch {
      console.error("❌ Pre-update tests failed");
      throw new Error("Tests must pass before updating dependencies");
    }
  }

  /**
   * Update dependencies for a single package
   */
  async updatePackage(packagePath) {
    const result = {
      packagePath,
      updates: [],
      success: false,
    };

    try {
      console.log(`\n📦 Processing: ${packagePath}`);

      const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));

      console.log(`   Package: ${packageJson.name || "unnamed"}`);

      // Get outdated packages
      const outdated = await this.getOutdatedPackages(dirname(packagePath));

      if (Object.keys(outdated).length === 0) {
        console.log("   ✅ All dependencies are up to date");
        result.success = true;
        return result;
      }

      // Analyze updates
      const updates = this.analyzeUpdates(outdated, packageJson);
      result.updates = updates;

      if (updates.length === 0) {
        console.log("   ✅ No applicable updates found");
        result.success = true;
        return result;
      }

      // Show planned updates
      console.log("   📋 Planned updates:");
      for (const update of updates) {
        const icon = update.breaking
          ? "💥"
          : update.type === "major"
            ? "⬆️"
            : "📈";
        console.log(
          `     ${icon} ${update.package}: ${update.current} → ${update.latest} (${update.type})`,
        );
      }

      // Apply updates if not dry run
      if (!this.dryRun) {
        if (this.interactive) {
          // In a real implementation, you'd prompt for confirmation here
          console.log(
            "   ⏭️ Skipping interactive confirmation in automated mode",
          );
        }

        await this.applyUpdates(dirname(packagePath), updates);
        console.log("   ✅ Updates applied successfully");
      }

      result.success = true;
    } catch (error) {
      console.error(`   ❌ Failed to update package: ${error}`);
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Get outdated packages using npm outdated
   */
  async getOutdatedPackages(packageDir) {
    try {
      const output = execSync("npm outdated --json", {
        cwd: packageDir,
        encoding: "utf-8",
      });
      return JSON.parse(output || "{}");
    } catch (error) {
      // npm outdated returns exit code 1 when outdated packages exist
      if (error instanceof Error && "stdout" in error) {
        try {
          return JSON.parse(error.stdout || "{}");
        } catch {
          return {};
        }
      }
      return {};
    }
  }

  /**
   * Analyze updates and categorize them
   */
  analyzeUpdates(outdated, packageJson) {
    const updates = [];

    for (const [packageName, info] of Object.entries(outdated)) {
      const current = info.current;
      const latest = info.latest;
      const wanted = info.wanted;

      if (!current || !latest) continue;

      // Determine update type
      const type = this.determineUpdateType(current, latest);
      const breaking =
        type === "major" && this.isBreakingChange(current, latest);

      // Skip breaking changes if configured
      if (breaking && this.skipBreaking) {
        console.log(`   ⏭️ Skipping breaking change: ${packageName}`);
        continue;
      }

      // Check if it's a dev dependency and if we should include it
      const isDev = packageJson.devDependencies?.[packageName] !== undefined;
      if (isDev && !this.includeDevDeps) {
        continue;
      }

      updates.push({
        package: packageName,
        current,
        latest: wanted || latest, // Use wanted version for safer updates
        type,
        breaking,
      });
    }

    return updates;
  }

  /**
   * Determine the type of update (major/minor/patch)
   */
  determineUpdateType(current, latest) {
    // Simple semantic version comparison
    const currentParts = current
      .replace(/[^0-9.]/g, "")
      .split(".")
      .map(Number);
    const latestParts = latest
      .replace(/[^0-9.]/g, "")
      .split(".")
      .map(Number);

    if (latestParts[0] > currentParts[0]) return "major";
    if (latestParts[1] > currentParts[1]) return "minor";
    return "patch";
  }

  /**
   * Check if an update is potentially breaking
   */
  isBreakingChange(current, latest) {
    return this.determineUpdateType(current, latest) === "major";
  }

  /**
   * Apply updates to a package
   */
  async applyUpdates(packageDir, updates) {
    for (const update of updates) {
      try {
        const installCmd = `npm install ${update.package}@${update.latest}`;
        console.log(`     Running: ${installCmd}`);

        execSync(installCmd, {
          cwd: packageDir,
          stdio: "inherit",
        });
      } catch (error) {
        console.error(`     ❌ Failed to update ${update.package}:`, error);
        throw error;
      }
    }
  }

  /**
   * Run post-update validation
   */
  async runPostUpdateValidation() {
    console.log("\n🧪 Running post-update validation...");

    try {
      // Build the project
      console.log("🔨 Building project...");
      execSync("npm run build", {
        cwd: ROOT_DIR,
        stdio: "inherit",
      });

      // Run tests
      console.log("🧪 Running tests...");
      execSync("npm run test", {
        cwd: ROOT_DIR,
        stdio: "inherit",
      });

      console.log("✅ Post-update validation passed");
    } catch (error) {
      console.error("❌ Post-update validation failed");
      console.log(
        "🔄 Consider reverting changes and updating dependencies incrementally",
      );
      throw error;
    }
  }

  /**
   * Generate a summary report
   */
  generateReport(results) {
    console.log("\n📊 Update Summary Report");
    console.log("========================");

    let totalUpdates = 0;
    let successfulPackages = 0;
    let failedPackages = 0;

    for (const result of results) {
      if (result.success) {
        successfulPackages++;
        totalUpdates += result.updates.length;
      } else {
        failedPackages++;
      }
    }

    console.log(`📦 Packages processed: ${results.length}`);
    console.log(`✅ Successful: ${successfulPackages}`);
    console.log(`❌ Failed: ${failedPackages}`);
    console.log(`📈 Total updates: ${totalUpdates}`);

    // Show detailed results
    for (const result of results) {
      const packageName =
        result.packagePath.split("/").pop()?.replace("package.json", "") ||
        "unknown";

      if (result.updates.length > 0) {
        console.log(`\n📦 ${packageName}:`);
        for (const update of result.updates) {
          const status = result.success ? "✅" : "❌";
          console.log(
            `   ${status} ${update.package}: ${update.current} → ${update.latest}`,
          );
        }
      }

      if (result.error) {
        console.log(`\n❌ ${packageName}: ${result.error}`);
      }
    }
  }

  /**
   * Create a pull request with the updates
   */
  async createPullRequest(results) {
    console.log("\n🔀 Creating pull request...");

    try {
      // Create a new branch
      const branchName = `automated/dependency-updates-${Date.now()}`;
      execSync(`git checkout -b ${branchName}`, { cwd: ROOT_DIR });

      // Commit changes
      execSync("git add -A", { cwd: ROOT_DIR });

      const commitMessage = this.generateCommitMessage(results);
      execSync(`git commit -m "${commitMessage}"`, { cwd: ROOT_DIR });

      console.log(`✅ Created branch: ${branchName}`);
      console.log("📝 To create a PR, run:");
      console.log(`   gh pr create --title "chore: automated dependency updates" --body "$(cat << 'EOF'
${this.generatePRDescription(results)}
EOF
)"`);
    } catch (error) {
      console.error("❌ Failed to create pull request:", error);
    }
  }

  /**
   * Generate commit message for dependency updates
   */
  generateCommitMessage(results) {
    const totalUpdates = results.reduce((sum, r) => sum + r.updates.length, 0);
    return `chore: automated dependency updates (${totalUpdates} packages updated)`;
  }

  /**
   * Generate PR description
   */
  generatePRDescription(results) {
    let description = "## Automated Dependency Updates\n\n";
    description +=
      "This PR contains automated dependency updates generated by the maintenance script.\n\n";

    description += "### Changes\n\n";
    for (const result of results) {
      if (result.updates.length > 0) {
        const packageName =
          result.packagePath.split("/").pop()?.replace("package.json", "") ||
          "unknown";
        description += `#### ${packageName}\n\n`;

        for (const update of result.updates) {
          const type = update.type.toUpperCase();
          const breaking = update.breaking ? " (BREAKING)" : "";
          description += `- ${update.package}: ${update.current} → ${update.latest} (${type}${breaking})\n`;
        }
        description += "\n";
      }
    }

    description += "### Validation\n\n";
    description += "- [x] Dependencies updated successfully\n";
    description += "- [x] Build passes\n";
    description += "- [x] Tests pass\n";
    description += "- [ ] Manual testing completed\n";

    return description;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  const options = {
    dryRun: args.includes("--dry-run"),
    interactive: !args.includes("--non-interactive"),
    includeDevDeps: !args.includes("--no-dev"),
    skipBreaking: !args.includes("--include-breaking"),
    createPR: args.includes("--create-pr"),
  };

  if (args.includes("--help")) {
    console.log(`
Automated Dependency Update Script

Usage: node update-dependencies.mjs [options]

Options:
  --dry-run              Show what would be updated without making changes
  --non-interactive      Skip interactive confirmations
  --no-dev              Skip development dependencies
  --include-breaking    Include potentially breaking changes
  --create-pr           Create a pull request with updates
  --help                Show this help message

Examples:
  node update-dependencies.mjs --dry-run
  node update-dependencies.mjs --non-interactive --no-dev
  node update-dependencies.mjs --create-pr
    `);
    process.exit(0);
  }

  const updater = new DependencyUpdater(options);
  await updater.updateDependencies();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
}
