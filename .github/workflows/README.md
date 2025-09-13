# GitHub Workflows

This directory contains GitHub Actions workflows for automated CI/CD, testing, and maintenance.

## Workflows Overview

### 🚀 [CI/CD Pipeline](./ci.yml)
**Triggers:** Push, Pull Request, Scheduled (nightly benchmarks)

**Jobs:**
- **Code Validation:** Linting, type checking, basic validation
- **Multi-Platform Testing:** Unit and integration tests across Windows, macOS, Linux with Node.js 18, 20, 21
- **Performance Benchmarks:** Validates acceptance criteria (15k+ nodes <10min, MCP <200ms, CLI <500ms)
- **Integration Testing:** End-to-end workflows, MCP server functionality
- **Quality Gates:** Coverage thresholds, security audit, bundle size checks

**Features:**
- ✅ Cross-platform compatibility testing
- ✅ Automated coverage reporting to Codecov
- ✅ Performance validation against acceptance criteria
- ✅ PR comments with benchmark results
- ✅ Quality gates for deployment readiness

### 📦 [Release and Deployment](./release.yml)
**Triggers:** Release published, version tags, manual dispatch

**Jobs:**
- **Pre-Release Validation:** Version format, test suite, security audit
- **Multi-Platform Builds:** Binary packaging for Windows, macOS, Linux
- **Performance Validation:** Stricter benchmarks for production releases
- **NPM Publishing:** Automated package publishing to npm registry
- **GitHub Releases:** Automated release creation with assets
- **Deployment Notifications:** Status updates and summaries

**Features:**
- ✅ Automated semantic versioning
- ✅ Cross-platform binary distribution
- ✅ Stricter performance validation for releases
- ✅ Multi-package publishing support
- ✅ Release asset automation

### 🔧 [Maintenance and Security](./maintenance.yml)
**Triggers:** Weekly (dependencies), Monthly (security), Manual dispatch

**Jobs:**
- **Dependency Updates:** Automated dependency updates with PR creation
- **Security Audits:** Vulnerability scanning and issue creation
- **Performance Monitoring:** Continuous performance trend analysis
- **Health Summaries:** Repository health status reporting

**Features:**
- ✅ Automated dependency update PRs
- ✅ Security vulnerability alerts and auto-fixes
- ✅ Performance regression detection
- ✅ Health status dashboards

## Performance Acceptance Criteria

The CI/CD pipeline validates these critical performance requirements:

### 📊 Parsing Performance
- **Requirement:** Parse 15,000+ AST nodes in under 10 minutes
- **CI Validation:** Tests with synthetic repositories containing 16k+ nodes
- **Current Performance:** ~109k nodes/second (well under requirement)

### ⚡ Query Latency
- **MCP Requirement:** Average query latency under 200ms
- **CLI Requirement:** Average query latency under 500ms
- **CI Validation:** Automated latency testing with realistic workloads
- **Current Performance:** MCP ~122ms avg, CLI ~239ms avg

### 🔄 Load Testing
- **Concurrent Users:** Multi-user simulation testing
- **Memory Efficiency:** Stable memory usage under load
- **Throughput Validation:** Sustained query processing rates

## Workflow Configuration

### Environment Variables
```yaml
NODE_VERSION: '20'                    # Primary Node.js version
PERFORMANCE_THRESHOLD_ENABLED: true   # Enable strict performance validation
REGISTRY_URL: 'https://registry.npmjs.org'
```

### Required Secrets
- `GITHUB_TOKEN`: Automatic (provided by GitHub)
- `NPM_TOKEN`: For publishing to npm registry
- `CODECOV_TOKEN`: For coverage reporting (optional)

### Matrix Testing
```yaml
os: [ubuntu-latest, windows-latest, macos-latest]
node: [18, 20, 21]
```

## Quality Gates

### Code Quality
- ✅ TypeScript compilation with strict mode
- ✅ Linting with consistent style rules
- ✅ Unit test coverage >90% threshold
- ✅ Integration test validation

### Performance Gates
- ✅ Parsing performance within acceptance criteria
- ✅ Query latency requirements met
- ✅ Memory usage stability validation
- ✅ No performance regressions detected

### Security Gates
- ✅ Dependency vulnerability scanning
- ✅ Security audit passing
- ✅ No critical/high severity issues
- ✅ Automated security fixes where possible

## Usage Examples

### Trigger Performance Benchmarks
```bash
git commit -m "feat: optimize query processing [benchmark]"
git push
```

### Manual Release
```bash
gh workflow run release.yml -f version=v1.2.3 -f environment=production
```

### Security Audit
```bash
gh workflow run maintenance.yml -f check-type=security
```

## Monitoring and Alerts

### Status Badges
Add these to your README.md:
```markdown
[![CI/CD Pipeline](../../workflows/CI/CD%20Pipeline/badge.svg)](../../actions/workflows/ci.yml)
[![Security Audit](../../workflows/Maintenance%20and%20Security/badge.svg)](../../actions/workflows/maintenance.yml)
```

### Performance Tracking
- Benchmark results archived for 30 days
- Performance trends tracked over time
- Regression alerts via PR comments
- Release performance validation

## Troubleshooting

### Common Issues
1. **Performance Tests Timeout:** Increase timeout in workflow or optimize test data size
2. **Cross-Platform Failures:** Check path separators and platform-specific dependencies
3. **Coverage Threshold:** Verify test coverage meets 90% minimum requirement
4. **Security Audit Failures:** Review and fix dependency vulnerabilities

### Debugging Tips
- Use workflow dispatch for manual testing
- Check artifact uploads for detailed logs
- Monitor job dependencies and failure cascades
- Review environment variable configurations