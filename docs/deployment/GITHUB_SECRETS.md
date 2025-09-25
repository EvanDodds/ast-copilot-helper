# GitHub Secrets Configuration

This document provides complete setup instructions for all GitHub secrets required for AST Copilot Helper CI/CD deployment.

## Overview

The AST Copilot Helper project uses GitHub Actions for continuous integration, deployment, and distribution. Various workflows require specific secrets to be configured in your repository settings for successful deployment.

## Required Secrets by Category

### 🔧 Core Development Secrets

#### `GITHUB_TOKEN`

- **Description**: GitHub personal access token for repository operations
- **Used by**: Most workflows for GitHub API access, releases, and repository management
- **Required permissions**:
  - `repo` (full control of private repositories)
  - `write:packages` (upload packages to GitHub Package Registry)
  - `read:org` (read organization membership)
- **Setup**: Automatically provided by GitHub Actions (usually no manual setup needed)
- **Workflows**: `ci-cd.yml`, `release.yml`, `distribution.yml`, `community-analytics.yml`, `maintenance.yml`

### 📦 Package Distribution Secrets

#### `NPM_TOKEN`

- **Description**: NPM authentication token for publishing packages
- **Used by**: Publishing AST Helper CLI and core packages to npm registry
- **Setup Instructions**:
  1. Log in to your npm account at https://www.npmjs.com/
  2. Go to Profile → Access Tokens → Generate New Token
  3. Select "Automation" type for CI/CD usage
  4. Copy the token (format: `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
- **Workflows**: `ci-cd.yml`, `release.yml`, `distribution.yml`

#### `VSCE_PAT` / `VSCE_TOKEN`

- **Description**: Visual Studio Code Extension (VSCE) Personal Access Token
- **Used by**: Publishing VSCode extensions to the marketplace
- **Setup Instructions**:
  1. Go to https://dev.azure.com/
  2. Create a new Personal Access Token
  3. Set Organization to "All accessible organizations"
  4. Set Scopes to "Marketplace (manage)"
  5. Copy the token
- **Workflows**: `ci-cd.yml`, `distribution.yml`

### 🔒 Code Signing Secrets

#### `WIN_CERT_PASSWORD`

- **Description**: Password for Windows code signing certificate
- **Used by**: Signing Windows binaries and installers
- **Setup Instructions**:
  1. Obtain a Windows code signing certificate from a trusted CA
  2. Export the certificate with private key (PFX format)
  3. Set this secret to the password used when creating the PFX file
- **Workflows**: `distribution.yml`

#### `MACOS_CERT_PASSWORD`

- **Description**: Password for macOS code signing certificate
- **Used by**: Signing macOS applications and packages
- **Setup Instructions**:
  1. Obtain a macOS Developer ID certificate from Apple
  2. Export the certificate from Keychain Access
  3. Set this secret to the export password
- **Workflows**: `distribution.yml`

#### `LINUX_GPG_PASSPHRASE`

- **Description**: Passphrase for GPG key used for Linux package signing
- **Used by**: Signing Linux packages and repositories
- **Setup Instructions**:
  1. Generate a GPG key: `gpg --gen-key`
  2. Export the key: `gpg --export-secret-keys YOUR_KEY_ID > private.key`
  3. Set this secret to the passphrase you used when creating the key
- **Workflows**: `distribution.yml`

### 🚀 Deployment Secrets

#### `STAGING_HEALTH_CHECK_URL`

- **Description**: URL endpoint for staging environment health checks
- **Used by**: Verifying staging deployment health
- **Setup Instructions**:
  1. Deploy your staging environment
  2. Create a health check endpoint (e.g., `/health` or `/api/health`)
  3. Set this secret to the full URL (e.g., `https://staging.example.com/health`)
- **Workflows**: `ci-cd.yml`

#### `PRODUCTION_HEALTH_CHECK_URLS`

- **Description**: Comma-separated URLs for production environment health checks
- **Used by**: Verifying production deployment health across multiple instances
- **Setup Instructions**:
  1. Deploy your production environment(s)
  2. Create health check endpoints for each instance
  3. Set this secret to comma-separated URLs (e.g., `https://api1.example.com/health,https://api2.example.com/health`)
- **Workflows**: `ci-cd.yml`

#### `DEPLOYMENT_APPROVAL_TOKEN`

- **Description**: Token for automated deployment approvals
- **Used by**: Production deployment approval workflows
- **Setup Instructions**:
  1. Create a service account or bot token with deployment permissions
  2. Generate a secure token for this account
  3. Set this secret to the token value
- **Workflows**: `ci-cd.yml`

#### `BLUE_GREEN_DEPLOYMENT`

- **Description**: Configuration for blue-green deployment strategy
- **Used by**: Managing zero-downtime deployments
- **Setup Instructions**:
  1. Set up blue-green deployment infrastructure
  2. Create a JSON configuration with environment endpoints
  3. Example value: `{"blue": "https://blue.example.com", "green": "https://green.example.com"}`
- **Workflows**: `ci-cd.yml`

### 📢 Notification Secrets

#### `SLACK_WEBHOOK_URL`

- **Description**: Slack webhook URL for deployment notifications
- **Used by**: Sending deployment status updates to Slack channels
- **Setup Instructions**:
  1. Go to your Slack workspace
  2. Navigate to Apps → Incoming Webhooks
  3. Create a new webhook for your desired channel
  4. Copy the webhook URL (format: `https://hooks.slack.com/services/...`)
- **Workflows**: `distribution.yml`

#### `TEAMS_WEBHOOK_URL`

- **Description**: Microsoft Teams webhook URL for deployment notifications
- **Used by**: Sending deployment status updates to Teams channels
- **Setup Instructions**:
  1. Go to your Teams channel
  2. Click "..." → Connectors → Incoming Webhook
  3. Configure the webhook and copy the URL
- **Workflows**: `distribution.yml`

## Setting Up Secrets in GitHub

### Method 1: Repository Settings (Recommended)

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name (exactly as shown above)
5. Paste the secret value
6. Click **Add secret**

### Method 2: GitHub CLI

```bash
# Install GitHub CLI if not already installed
gh auth login

# Add secrets using CLI
gh secret set NPM_TOKEN --body "your_npm_token_here"
gh secret set VSCE_PAT --body "your_vsce_token_here"
gh secret set SLACK_WEBHOOK_URL --body "your_slack_webhook_url"
# ... continue for all secrets
```

### Method 3: Using GitHub API

```bash
# Using curl (replace values accordingly)
curl -X PUT \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"encrypted_value": "ENCRYPTED_SECRET_VALUE", "key_id": "KEY_ID"}' \
  https://api.github.com/repos/YOUR_USERNAME/ast-copilot-helper/actions/secrets/NPM_TOKEN
```

## Validation and Testing

### Testing Secret Configuration

1. **Trigger Test Workflow**: Create a small test workflow to validate secrets
2. **Check Workflow Logs**: Ensure secrets are properly masked in logs
3. **Verify Operations**: Test actual operations (npm publish, extension marketplace, etc.)

### Security Best Practices

- ✅ **Use specific permissions**: Grant minimal required permissions for each token
- ✅ **Regular rotation**: Rotate secrets periodically (every 3-6 months)
- ✅ **Monitor usage**: Check GitHub Actions logs for any unauthorized access attempts
- ✅ **Environment separation**: Use different tokens for staging vs production
- ❌ **Never expose secrets**: Ensure secrets don't appear in logs or code
- ❌ **No hardcoding**: Never commit secrets to repository

### Secret Priority Matrix

| Secret                         | Priority | Impact if Missing               | Setup Complexity |
| ------------------------------ | -------- | ------------------------------- | ---------------- |
| `GITHUB_TOKEN`                 | Critical | CI/CD fails completely          | Auto-generated   |
| `NPM_TOKEN`                    | High     | Can't publish packages          | Medium           |
| `VSCE_PAT`                     | High     | Can't publish VS Code extension | Medium           |
| `SLACK_WEBHOOK_URL`            | Medium   | No notifications                | Low              |
| `TEAMS_WEBHOOK_URL`            | Medium   | No notifications                | Low              |
| `WIN_CERT_PASSWORD`            | High     | Unsigned Windows binaries       | High             |
| `MACOS_CERT_PASSWORD`          | High     | Unsigned macOS binaries         | High             |
| `LINUX_GPG_PASSPHRASE`         | Medium   | Unsigned Linux packages         | Medium           |
| `STAGING_HEALTH_CHECK_URL`     | Medium   | Can't verify staging            | Low              |
| `PRODUCTION_HEALTH_CHECK_URLS` | High     | Can't verify production         | Low              |
| `DEPLOYMENT_APPROVAL_TOKEN`    | Medium   | Manual approval required        | Medium           |
| `BLUE_GREEN_DEPLOYMENT`        | Low      | Standard deployment only        | High             |

## Quick Setup Checklist

- [ ] `GITHUB_TOKEN` - Usually auto-configured ✓
- [ ] `NPM_TOKEN` - Get from npmjs.com
- [ ] `VSCE_PAT` - Get from dev.azure.com
- [ ] `SLACK_WEBHOOK_URL` - Configure Slack webhook
- [ ] `TEAMS_WEBHOOK_URL` - Configure Teams webhook
- [ ] `WIN_CERT_PASSWORD` - Windows signing certificate
- [ ] `MACOS_CERT_PASSWORD` - macOS signing certificate
- [ ] `LINUX_GPG_PASSPHRASE` - Linux GPG signing key
- [ ] `STAGING_HEALTH_CHECK_URL` - Staging health endpoint
- [ ] `PRODUCTION_HEALTH_CHECK_URLS` - Production health endpoints
- [ ] `DEPLOYMENT_APPROVAL_TOKEN` - Deployment automation token
- [ ] `BLUE_GREEN_DEPLOYMENT` - Blue-green config (optional)

## Troubleshooting

### Common Issues

**"Secret not found" errors**:

- Verify secret name matches exactly (case-sensitive)
- Check that secret is set at repository level, not organization level
- Ensure the workflow has permission to access secrets

**Authentication failures**:

- Verify token hasn't expired
- Check token permissions/scopes
- Regenerate token if necessary

**Deployment failures**:

- Validate health check URLs are accessible
- Verify deployment configuration format
- Check environment-specific settings

### Support

For additional help:

- Check GitHub Actions documentation
- Review workflow logs for specific error messages
- Contact project maintainers via GitHub Issues
- Reference the [TROUBLESHOOTING.md](../troubleshooting.md) guide

---

**⚠️ Security Warning**: Never share or commit these secret values. Always use GitHub's secret management system and follow security best practices.
