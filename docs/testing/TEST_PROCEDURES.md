# Test Procedures and CI/CD Integration Guide

This document provides detailed procedures for running tests, interpreting results, and integrating the Phase 5 testing framework into CI/CD pipelines.

## Test Execution Procedures

### Pre-test Setup

**Environment Preparation**:

```bash
# 1. Clean environment setup
npm run clean
npm install

# 2. Build required dependencies
npm run build

# 3. Ensure Rust engine is available (for NAPI tests)
cd packages/ast-core-engine
cargo build --release
cd ../..

# 4. Verify test environment
npm run test:env-check
```

**System Requirements**:

- Node.js 18.17.0 or higher
- Rust toolchain (for NAPI implementation)
- 8GB+ available RAM for comprehensive tests
- SSD storage recommended for performance testing

### Test Suite Execution

#### 1. Development Testing

**Quick Validation** (2-3 minutes):

```bash
# Run unit tests with basic validation
npm run test:quick

# Run specific test suite
npm test -- packages/ast-helper/src/database/vector/wasm-vector-database.test.ts
```

**Feature Development** (5-10 minutes):

```bash
# Run all vector database tests
npm test -- packages/ast-helper/src/database/vector/

# Run with coverage reporting
npm run test:coverage -- packages/ast-helper/src/database/vector/
```

#### 2. Performance Testing

**Basic Performance Validation** (10-15 minutes):

```bash
# Run performance benchmarks with reduced dataset
npm run test:performance:dev

# Run memory leak detection
npm run test:memory-leaks
```

**Comprehensive Performance Testing** (30-60 minutes):

```bash
# Full performance benchmark suite
npm run test:performance:full

# Generate performance report
npm run report:performance
```

#### 3. Regression Testing

**Regression Detection** (15-30 minutes):

```bash
# Run regression tests against current baselines
npm run test:regression

# Update baselines (after performance improvements)
npm run baseline:update
```

**Regression Analysis** (5-10 minutes):

```bash
# Analyze specific implementation
npm run test:regression -- --implementation=WASM

# Generate detailed regression report
npm run report:regression -- --detailed
```

### Test Result Interpretation

#### Success Criteria

**Unit Tests**:

- ✅ All tests passing
- ✅ No unhandled errors or warnings
- ✅ Expected test coverage maintained

**Performance Tests**:

- ✅ Performance within acceptable thresholds
- ✅ No memory leaks detected
- ✅ Resource consumption within limits

**Regression Tests**:

- ✅ No performance regressions detected
- ✅ All baseline comparisons within tolerance
- ✅ Historical trends maintained

#### Failure Analysis

**Test Failures**:

```bash
# Detailed failure analysis
npm run test:analyze-failures

# Generate failure report
npm run report:failures -- --format=html
```

**Performance Regressions**:

```bash
# Compare against baseline
npm run baseline:compare -- --current=latest

# Identify regression root cause
npm run debug:regression -- --operation=vectorSearch
```

## CI/CD Pipeline Integration

### GitHub Actions Configuration

#### Basic Workflow Structure

```yaml
# .github/workflows/phase5-testing.yml
name: Phase 5 Testing & Performance Validation

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Run unit tests
        run: npm run test:unit

      - name: Upload test results
        uses: actions/upload-artifact@v4
        with:
          name: unit-test-results
          path: test-results/

  performance-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable

      - name: Install dependencies
        run: npm ci

      - name: Build Rust engine
        run: |
          cd packages/ast-core-engine
          cargo build --release

      - name: Run performance tests
        run: npm run test:performance:ci
        env:
          CI: true
          PERFORMANCE_BASELINE_PATH: ${{ secrets.BASELINE_PATH }}

      - name: Upload performance results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: performance-results/

  regression-tests:
    runs-on: ubuntu-latest
    needs: performance-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"

      - name: Download baselines
        uses: actions/download-artifact@v4
        with:
          name: performance-baselines
          path: ./baselines/

      - name: Run regression tests
        run: npm run test:regression:ci
        env:
          BASELINE_PATH: ./baselines/

      - name: Generate regression report
        run: npm run report:regression

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('regression-report.json'));

            let comment = '## Performance Regression Report\n\n';
            if (report.regressions.length === 0) {
              comment += '✅ No performance regressions detected\n\n';
            } else {
              comment += `⚠️ ${report.regressions.length} performance regressions detected:\n\n`;
              report.regressions.forEach(r => {
                comment += `- **${r.test}**: ${r.current}ms vs ${r.baseline}ms (${r.ratio}x slower)\n`;
              });
            }

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

#### Advanced Pipeline Features

**Parallel Test Execution**:

```yaml
strategy:
  matrix:
    test-suite: [unit, integration, performance, regression]
    node-version: [18, 20]
    os: [ubuntu-latest, windows-latest, macos-latest]
```

**Performance Monitoring**:

```yaml
- name: Performance trend analysis
  run: |
    npm run analyze:trends
    npm run generate:dashboard

- name: Update performance dashboard
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./dashboard
```

**Baseline Management**:

```yaml
- name: Update baselines
  if: github.ref == 'refs/heads/main'
  run: |
    npm run baseline:update
    npm run baseline:upload
  env:
    BASELINE_STORAGE: ${{ secrets.BASELINE_STORAGE }}
```

### Continuous Integration Scripts

#### Package.json Scripts

```json
{
  "scripts": {
    "test:unit": "vitest run tests/unit/",
    "test:integration": "vitest run tests/integration/",
    "test:performance:dev": "vitest run --config vitest.performance.config.ts",
    "test:performance:ci": "vitest run --config vitest.performance.ci.config.ts",
    "test:regression": "vitest run packages/ast-helper/src/database/vector/regression.test.ts",
    "test:regression:ci": "CI=true npm run test:regression",
    "test:memory-leaks": "vitest run --grep='memory leaks'",
    "test:quick": "vitest run --config vitest.precommit.config.ts",
    "test:coverage": "vitest run --coverage",
    "baseline:create": "node scripts/create-baseline.js",
    "baseline:update": "node scripts/update-baseline.js",
    "baseline:compare": "node scripts/compare-baseline.js",
    "baseline:upload": "node scripts/upload-baseline.js",
    "report:performance": "node scripts/generate-performance-report.js",
    "report:regression": "node scripts/generate-regression-report.js",
    "analyze:trends": "node scripts/analyze-trends.js",
    "generate:dashboard": "node scripts/generate-dashboard.js"
  }
}
```

#### Environment-Specific Configurations

**Development Configuration** (`vitest.performance.config.ts`):

```typescript
export default defineConfig({
  test: {
    include: ["packages/ast-helper/src/database/vector/performance-*.test.ts"],
    timeout: 300000, // 5 minutes
    setupFiles: ["./test-setup/performance-dev.ts"],
    env: {
      PERFORMANCE_MODE: "development",
      DATASET_SIZE: "small",
      MEASUREMENT_RUNS: "5",
    },
  },
});
```

**CI Configuration** (`vitest.performance.ci.config.ts`):

```typescript
export default defineConfig({
  test: {
    include: ["packages/ast-helper/src/database/vector/performance-*.test.ts"],
    timeout: 1800000, // 30 minutes
    setupFiles: ["./test-setup/performance-ci.ts"],
    env: {
      PERFORMANCE_MODE: "ci",
      DATASET_SIZE: "full",
      MEASUREMENT_RUNS: "10",
    },
  },
});
```

### Deployment Integration

#### Pre-deployment Validation

```bash
#!/bin/bash
# scripts/pre-deployment-validation.sh

set -e

echo "🚀 Starting pre-deployment validation..."

# 1. Run comprehensive test suite
echo "📋 Running test suite..."
npm run test:full

# 2. Performance validation
echo "⚡ Validating performance..."
npm run test:performance:full

# 3. Regression detection
echo "🔍 Checking for regressions..."
npm run test:regression

# 4. Generate deployment report
echo "📊 Generating deployment report..."
npm run report:deployment

echo "✅ Pre-deployment validation completed successfully!"
```

#### Post-deployment Monitoring

```bash
#!/bin/bash
# scripts/post-deployment-monitoring.sh

set -e

echo "📊 Starting post-deployment monitoring..."

# 1. Health check
echo "🏥 Running health checks..."
npm run health:check

# 2. Performance validation
echo "⚡ Validating production performance..."
npm run test:performance:production

# 3. Update baselines if needed
if [ "$UPDATE_BASELINES" = "true" ]; then
  echo "📈 Updating performance baselines..."
  npm run baseline:update:production
fi

# 4. Generate monitoring report
echo "📋 Generating monitoring report..."
npm run report:monitoring

echo "✅ Post-deployment monitoring completed!"
```

## Quality Gates and Metrics

### Quality Gate Configuration

```yaml
# quality-gates.yml
quality_gates:
  unit_tests:
    coverage_threshold: 85
    passing_threshold: 100

  performance_tests:
    regression_threshold: 1.5 # 50% slowdown limit
    memory_threshold: 1.3 # 30% memory increase limit

  integration_tests:
    success_rate: 95
    timeout_threshold: 300000 # 5 minutes

  overall:
    blocking_failures: 0
    critical_issues: 0
```

### Success Metrics

**Development Velocity**:

- Test execution time < 15 minutes (development)
- Test execution time < 60 minutes (CI)
- Feedback time < 5 minutes (quick validation)

**Quality Metrics**:

- Unit test coverage > 85%
- Integration test success rate > 95%
- Performance regression rate < 5%
- Critical issues = 0

**Reliability Metrics**:

- Test flakiness rate < 2%
- False positive rate < 1%
- Baseline stability > 98%

## Troubleshooting Guide

### Common Issues

**1. Test Environment Issues**

```bash
# Problem: Node.js version mismatch
Error: Unsupported Node.js version

# Solution:
nvm use 18
npm install
```

**2. Performance Test Failures**

```bash
# Problem: High system load affecting results
Warning: High performance variance detected

# Solution:
# Close unnecessary applications
# Run tests during low-activity periods
# Increase measurement samples
npm run test:performance -- --samples=20
```

**3. Baseline Mismatches**

```bash
# Problem: Baseline environment mismatch
Error: Environment mismatch detected

# Solution:
# Update environment configuration
npm run baseline:recalibrate
# Or create environment-specific baselines
npm run baseline:create -- --env=ci
```

### Debug Commands

**Performance Debugging**:

```bash
# Enable detailed performance logging
DEBUG=performance npm run test:performance

# Profile memory usage
NODE_OPTIONS="--max-old-space-size=8192" npm run test:memory

# Generate flame graphs
npm run profile:flame-graph
```

**Test Debugging**:

```bash
# Run specific test with debug info
npm test -- --grep="vector insertion" --reporter=verbose

# Run with browser dev tools
npm test -- --inspect-brk

# Generate test coverage report
npm run test:coverage:html
```

## Best Practices

### Test Development

1. **Test Isolation**: Ensure tests don't interfere with each other
2. **Resource Cleanup**: Always clean up resources in teardown
3. **Deterministic Tests**: Avoid flaky tests with proper mocking
4. **Performance Consistency**: Use consistent test environments

### CI/CD Integration

1. **Fail Fast**: Run quick tests first to provide fast feedback
2. **Parallel Execution**: Utilize parallel test execution for speed
3. **Artifact Management**: Store and version test results and baselines
4. **Monitoring Integration**: Connect tests to monitoring systems

### Performance Testing

1. **Baseline Management**: Keep baselines up-to-date and relevant
2. **Environment Control**: Use consistent, controlled test environments
3. **Statistical Significance**: Ensure adequate sample sizes
4. **Trend Analysis**: Monitor performance trends over time

This comprehensive testing framework ensures reliable, high-performance WASM migration with continuous quality validation.
