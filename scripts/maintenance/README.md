# Maintenance Automation and Scheduling Guide

This guide explains how to set up and use the automated maintenance tools for the ast-copilot-helper project.

## Available Scripts

### 1. Dependency Update Script (`update-dependencies.mjs`)

Automatically updates project dependencies with safety checks and validation.

#### Features

- **Monorepo Support**: Handles multiple packages in the repository
- **Safety Checks**: Validates updates before applying
- **Rollback Capability**: Automatically reverts on test failures
- **PR Integration**: Creates pull requests for dependency updates
- **Smart Filtering**: Excludes breaking changes and pre-release versions

#### Usage

```bash
# Basic update (dry run)
node scripts/maintenance/update-dependencies.mjs

# Apply updates
node scripts/maintenance/update-dependencies.mjs --apply

# Update only specific packages
node scripts/maintenance/update-dependencies.mjs --packages ast-copilot-helper,ast-mcp-server

# Include pre-release versions
node scripts/maintenance/update-dependencies.mjs --include-prerelease

# Create PR automatically
node scripts/maintenance/update-dependencies.mjs --apply --create-pr
```

#### Configuration

Create `.maintenance-config.json` in the project root:

```json
{
  "dependencies": {
    "excludePatterns": ["@types/*", "eslint*"],
    "maxMajorUpdates": 3,
    "testTimeout": 300000,
    "rollbackOnFailure": true
  }
}
```

### 2. Health Check Script (`health-check.mjs`)

Performs comprehensive repository health checks across multiple dimensions.

#### Health Check Categories

- **Git Health**: Repository status, recent activity, branch protection
- **Dependencies**: Outdated packages, security vulnerabilities
- **Security**: Sensitive files, security configurations
- **Code Quality**: Linting, TypeScript, pre-commit hooks
- **Testing**: Test configuration, coverage, test execution
- **Documentation**: Essential files, README quality
- **Performance**: Build times, repository size
- **Maintenance**: CI/CD, automation, recent activity

#### Usage

```bash
# Full health check
node scripts/maintenance/health-check.mjs

# Specific checks only
node scripts/maintenance/health-check.mjs --checks security,dependencies

# JSON output for automation
node scripts/maintenance/health-check.mjs --format json > health-report.json

# Markdown report
node scripts/maintenance/health-check.mjs --format markdown > HEALTH_REPORT.md

# Verbose output with metrics
node scripts/maintenance/health-check.mjs --verbose
```

#### Exit Codes

- `0`: Health check passed or no critical issues
- `1`: Critical issues found or health check failed

### 3. Cleanup Script (`cleanup.mjs`)

Automated cleanup of build artifacts, caches, and temporary files.

#### Cleanup Categories

- **Build Artifacts**: dist/, build/, coverage/, .tsbuildinfo files
- **Dependencies**: npm cache, stale node_modules
- **Caches**: .cache, .tmp, .eslintcache, tool-specific caches
- **Logs**: Old log files (>7 days)
- **Git**: Garbage collection, merged branch cleanup
- **Temporary Files**: Editor backups, OS cache files
- **Optimization**: Duplicate files, empty directories

#### Usage

```bash
# Preview cleanup (recommended first)
node scripts/maintenance/cleanup.mjs --dry-run

# Interactive cleanup
node scripts/maintenance/cleanup.mjs --interactive

# Specific cleanup tasks
node scripts/maintenance/cleanup.mjs --tasks build,cache

# Full cleanup with verbose output
node scripts/maintenance/cleanup.mjs --verbose

# Force cleanup (use with caution)
node scripts/maintenance/cleanup.mjs --force
```

## Scheduling with GitHub Actions

### Weekly Dependency Updates

Create `.github/workflows/maintenance-dependencies.yml`:

```yaml
name: Weekly Dependency Updates

on:
  schedule:
    - cron: "0 9 * * 1" # Monday 9 AM UTC
  workflow_dispatch:

jobs:
  update-dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Update dependencies
        run: |
          node scripts/maintenance/update-dependencies.mjs --apply --create-pr
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Daily Health Checks

Create `.github/workflows/maintenance-health.yml`:

```yaml
name: Daily Health Check

on:
  schedule:
    - cron: "0 6 * * *" # Daily at 6 AM UTC
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run health check
        run: |
          node scripts/maintenance/health-check.mjs --format markdown > health-report.md

      - name: Upload health report
        uses: actions/upload-artifact@v3
        with:
          name: health-report
          path: health-report.md
          retention-days: 30

      - name: Comment on issues if critical
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            if (fs.existsSync('health-report.md')) {
              const report = fs.readFileSync('health-report.md', 'utf8');
              github.rest.issues.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title: 'Critical Health Check Issues Detected',
                body: report,
                labels: ['maintenance', 'critical']
              });
            }
```

### Monthly Cleanup

Create `.github/workflows/maintenance-cleanup.yml`:

```yaml
name: Monthly Cleanup

on:
  schedule:
    - cron: "0 3 1 * *" # First day of month at 3 AM UTC
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - name: Run cleanup
        run: |
          node scripts/maintenance/cleanup.mjs --tasks cache,logs,temp --verbose
```

## Local Development Scheduling

### Using cron (Linux/macOS)

```bash
# Edit crontab
crontab -e

# Add maintenance schedules
0 9 * * 1 cd /path/to/ast-copilot-helper && node scripts/maintenance/update-dependencies.mjs --apply
0 6 * * * cd /path/to/ast-copilot-helper && node scripts/maintenance/health-check.mjs --format json > logs/health-$(date +\%Y\%m\%d).json
0 3 1 * * cd /path/to/ast-copilot-helper && node scripts/maintenance/cleanup.mjs --tasks cache,logs
```

### Using npm scripts

Add to `package.json`:

```json
{
  "scripts": {
    "maintenance:deps": "node scripts/maintenance/update-dependencies.mjs",
    "maintenance:health": "node scripts/maintenance/health-check.mjs",
    "maintenance:cleanup": "node scripts/maintenance/cleanup.mjs",
    "maintenance:all": "npm run maintenance:health && npm run maintenance:cleanup"
  }
}
```

### Pre-commit Integration

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run health check on commit
node scripts/maintenance/health-check.mjs --checks git,security --no-fail
```

## Configuration

### Global Configuration File

Create `.maintenance-config.json`:

```json
{
  "dependencies": {
    "excludePatterns": ["@types/*", "eslint*"],
    "maxMajorUpdates": 3,
    "testTimeout": 300000,
    "rollbackOnFailure": true,
    "createPR": true,
    "prLabels": ["dependencies", "automated"]
  },
  "health": {
    "failOnCritical": true,
    "checksToRun": ["all"],
    "thresholds": {
      "minHealthScore": 70,
      "maxOutdatedPercentage": 25
    }
  },
  "cleanup": {
    "preservePatterns": ["*.env.example", "important.log"],
    "maxLogAge": 7,
    "confirmBeforeDelete": false
  },
  "notifications": {
    "slack": {
      "webhook": "${SLACK_WEBHOOK_URL}",
      "channels": ["#maintenance", "#alerts"]
    },
    "email": {
      "smtp": "${SMTP_CONFIG}",
      "recipients": ["maintainer@example.com"]
    }
  }
}
```

### Package-specific Configuration

Add to individual `package.json` files:

```json
{
  "maintenance": {
    "dependencies": {
      "exclude": ["specific-package"],
      "testCommand": "npm run test:package"
    },
    "health": {
      "skipChecks": ["performance"]
    }
  }
}
```

## Monitoring and Alerts

### Health Score Tracking

The health check script provides scores (0-100) for each category:

- **90-100**: Excellent
- **75-89**: Good
- **60-74**: Fair
- **40-59**: Poor
- **0-39**: Critical

### Alert Conditions

Alerts are triggered for:

- Health score below threshold (default: 70)
- Security vulnerabilities detected
- Build or test failures
- Dependencies >30 days outdated
- Repository size >500MB

### Integration with Monitoring Tools

#### Slack Notifications

```bash
# Add to maintenance scripts
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Health check failed: Score 45/100"}' \
  $SLACK_WEBHOOK_URL
```

#### GitHub Issues

```bash
# Create issue for critical health problems
gh issue create \
  --title "Critical Health Issues Detected" \
  --body-file health-report.md \
  --label maintenance,critical
```

## Best Practices

### 1. Gradual Rollout

- Start with dry-run mode
- Test on development branches first
- Monitor results before full automation

### 2. Safety Measures

- Always run tests after updates
- Implement rollback mechanisms
- Use branch protection rules
- Require review for critical changes

### 3. Monitoring

- Track health scores over time
- Monitor automation success rates
- Set up alerts for failures
- Regular review of maintenance logs

### 4. Customization

- Adjust schedules for team workflow
- Configure exclusions for stability
- Set appropriate thresholds
- Integrate with existing tools

## Troubleshooting

### Common Issues

**Permission Errors**

```bash
# Ensure scripts are executable
chmod +x scripts/maintenance/*.mjs

# Check file permissions
ls -la scripts/maintenance/
```

**Network Timeouts**

```bash
# Increase timeout for slow networks
export NODE_OPTIONS="--max-old-space-size=4096"
node scripts/maintenance/update-dependencies.mjs --timeout 600000
```

**Git Authentication**

```bash
# For GitHub Actions
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

# For local development
gh auth login
```

**Test Failures**

```bash
# Debug test issues
node scripts/maintenance/health-check.mjs --checks testing --verbose

# Skip specific tests
node scripts/maintenance/update-dependencies.mjs --skip-tests
```

### Log Analysis

Check maintenance logs:

```bash
# View recent maintenance activity
grep "maintenance" ~/.npm/_logs/*.log

# Check git commits from automation
git log --author="github-actions" --oneline

# Analyze health trends
ls -la health-*.json | tail -10
```

## Security Considerations

### Token Security

- Use repository secrets for tokens
- Rotate tokens regularly
- Limit token permissions
- Monitor token usage

### Safe Operations

- Never automate destructive operations without approval
- Use branch protection for critical branches
- Require status checks before merging
- Implement audit logging

### Dependency Security

- Scan for vulnerabilities before updates
- Use lock files for reproducible builds
- Monitor security advisories
- Implement security policies

---

This maintenance system provides comprehensive automation while maintaining safety and flexibility for the ast-copilot-helper project.
