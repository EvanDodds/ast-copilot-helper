# Deployment Guide

This guide covers deploying AST Copilot Helper in various environments and platforms.

## Quick Start

For immediate deployment, ensure you have the required secrets configured first:

🔑 **[GitHub Secrets Configuration](../deployment/GITHUB_SECRETS.md)** - **Start here!**

Required for any CI/CD deployment. This is the most critical step.

## Deployment Options

### 1. GitHub Actions CI/CD (Recommended)

Our automated CI/CD pipeline handles everything once secrets are configured:

- ✅ **Automatic**: Builds, tests, and deploys on every push
- ✅ **Multi-platform**: Supports npm, VS Code Marketplace, and GitHub Releases
- ✅ **Quality Gates**: Includes linting, testing, and security scans
- ✅ **Notifications**: Slack/Teams integration for deployment status

**Prerequisites**:

- Configure [GitHub Secrets](../deployment/GITHUB_SECRETS.md)
- Fork/clone the repository
- Push changes to trigger deployment

**Workflows**:

- `ci-cd.yml` - Main deployment pipeline
- `release.yml` - Release management
- `distribution.yml` - Package distribution

### 2. Manual Deployment

For development or testing purposes:

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Package for distribution
npm run package:cli
npm run package:vscode
```

### 3. Local Development Setup

```bash
# Clone and setup
git clone <repository-url>
cd ast-copilot-helper
npm install

# Start development
npm run dev
```

## Environment-Specific Setup

### Staging Environment

- Health check endpoint: Configure `STAGING_HEALTH_CHECK_URL` secret
- Automated deployment on feature branch pushes
- Full CI/CD pipeline testing

### Production Environment

- Multi-instance health checks: Configure `PRODUCTION_HEALTH_CHECK_URLS`
- Blue-green deployment support: Configure `BLUE_GREEN_DEPLOYMENT`
- Manual approval gates: Configure `DEPLOYMENT_APPROVAL_TOKEN`

## Deployment Verification

### Health Checks

The system includes comprehensive health checks:

- API endpoint health
- Database connectivity
- External service availability
- Performance benchmarks

### Monitoring

Post-deployment monitoring includes:

- Application performance metrics
- Error tracking and alerting
- Resource utilization monitoring
- User analytics (privacy-compliant)

## Troubleshooting

### Common Issues

**"Secrets not found" errors**:

- Review the [GitHub Secrets guide](../deployment/GITHUB_SECRETS.md)
- Verify all required secrets are configured
- Check secret names match exactly (case-sensitive)

**Build failures**:

- Check Node.js version compatibility (>=18.0.0)
- Verify all dependencies are installed
- Review build logs for specific errors

**Deployment failures**:

- Validate health check endpoints are accessible
- Check network connectivity and firewall rules
- Verify deployment target permissions

### Getting Help

- 📚 [Troubleshooting Guide](../troubleshooting.md)
- 🔧 [CI/CD Pipeline Documentation](../CI-CD-PIPELINE.md)
- 🐛 [GitHub Issues](https://github.com/EvanDodds/ast-copilot-helper/issues)
- 💬 [Discussion Forum](https://github.com/EvanDodds/ast-copilot-helper/discussions)

## Security Considerations

### Best Practices

- ✅ Use environment-specific secrets
- ✅ Rotate secrets regularly (every 3-6 months)
- ✅ Monitor access logs and usage
- ✅ Use minimal required permissions
- ❌ Never commit secrets to code
- ❌ Don't share secrets between environments

### Compliance

The deployment system supports:

- SOC 2 compliance requirements
- GDPR privacy regulations
- Industry-standard security practices
- Audit logging and reporting

---

**Next Steps**:

1. 🔑 [Configure GitHub Secrets](../deployment/GITHUB_SECRETS.md) (Required)
2. 🚀 Push code changes to trigger deployment
3. 📊 Monitor deployment status and health checks
4. 🔄 Set up regular secret rotation schedule
