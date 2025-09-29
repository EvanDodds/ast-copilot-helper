# Test Configuration and Setup Guide

This document provides detailed configuration options and setup procedures for the Phase 5 testing framework.

## Configuration Files

### Vitest Configurations

#### Base Configuration (`vitest.config.ts`)

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test-setup/global-setup.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "coverage/",
        "test-setup/",
        "**/*.test.ts",
        "**/*.spec.ts",
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 85,
          statements: 85,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./packages"),
    },
  },
});
```

#### Performance Testing Configuration (`vitest.performance.config.ts`)

```typescript
import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["packages/ast-helper/src/database/vector/performance-*.test.ts"],
    exclude: ["packages/ast-helper/src/database/vector/integration.test.ts"],
    testTimeout: 300000, // 5 minutes per test
    hookTimeout: 60000, // 1 minute for setup/teardown
    setupFiles: ["./test-setup/performance-setup.ts"],
    pool: "forks", // Use separate processes for isolation
    poolOptions: {
      forks: {
        singleFork: true, // Prevent test interference
        isolate: true,
      },
    },
    env: {
      PERFORMANCE_MODE: "development",
      MEASUREMENT_RUNS: "5",
      WARMUP_RUNS: "3",
      DATASET_SIZE: "small",
    },
  },
});
```

#### CI Performance Configuration (`vitest.performance.ci.config.ts`)

```typescript
import { defineConfig } from "vitest/config";
import performanceConfig from "./vitest.performance.config";

export default defineConfig({
  ...performanceConfig,
  test: {
    ...performanceConfig.test,
    testTimeout: 1800000, // 30 minutes per test
    reporter: ["json", "junit"],
    outputFile: {
      json: "./test-results/performance-results.json",
      junit: "./test-results/performance-junit.xml",
    },
    env: {
      PERFORMANCE_MODE: "ci",
      MEASUREMENT_RUNS: "10",
      WARMUP_RUNS: "5",
      DATASET_SIZE: "full",
      CI: "true",
    },
  },
});
```

#### Regression Testing Configuration (`vitest.regression.config.ts`)

```typescript
import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["packages/ast-helper/src/database/vector/regression.test.ts"],
    testTimeout: 600000, // 10 minutes
    setupFiles: ["./test-setup/regression-setup.ts"],
    env: {
      REGRESSION_MODE: "true",
      BASELINE_PATH: process.env.BASELINE_PATH || "./performance-baselines/",
      PERFORMANCE_THRESHOLD: "2.0",
      MEMORY_THRESHOLD: "1.5",
      THROUGHPUT_THRESHOLD: "0.5",
    },
  },
});
```

### Test Setup Files

#### Global Setup (`test-setup/global-setup.ts`)

```typescript
import { beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { performance } from "perf_hooks";

// Global test state
const testState = {
  startTime: 0,
  testMetrics: new Map<string, any>(),
};

beforeAll(async () => {
  console.log("🚀 Initializing Phase 5 test environment...");

  // Verify environment requirements
  await verifyEnvironment();

  // Initialize test databases
  await initializeTestDatabases();

  // Setup test data
  await setupTestData();

  console.log("✅ Test environment ready");
});

afterAll(async () => {
  console.log("🧹 Cleaning up test environment...");

  // Cleanup test databases
  await cleanupTestDatabases();

  // Generate test summary
  await generateTestSummary();

  console.log("✅ Test cleanup completed");
});

beforeEach((context) => {
  testState.startTime = performance.now();
  console.log(`🧪 Starting test: ${context.task.name}`);
});

afterEach((context) => {
  const duration = performance.now() - testState.startTime;
  testState.testMetrics.set(context.task.name, { duration });
  console.log(
    `✅ Completed test: ${context.task.name} (${duration.toFixed(2)}ms)`,
  );
});

async function verifyEnvironment() {
  // Check Node.js version
  const nodeVersion = process.version;
  if (!nodeVersion.startsWith("v18") && !nodeVersion.startsWith("v20")) {
    throw new Error(
      `Unsupported Node.js version: ${nodeVersion}. Required: v18.x or v20.x`,
    );
  }

  // Check available memory
  const totalMemory = process.memoryUsage();
  if (totalMemory.rss > 1024 * 1024 * 1024) {
    // 1GB
    console.warn("⚠️ High memory usage detected before tests");
  }

  // Check required environment variables
  const requiredEnvVars = ["NODE_ENV"];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`⚠️ Missing environment variable: ${envVar}`);
    }
  }
}

async function initializeTestDatabases() {
  // Initialize test database instances
  // This would be implemented based on specific database requirements
}

async function setupTestData() {
  // Setup test vectors and data
  // This would generate consistent test datasets
}

async function cleanupTestDatabases() {
  // Cleanup test database instances
  // Ensure no test data persists between runs
}

async function generateTestSummary() {
  const summary = {
    totalTests: testState.testMetrics.size,
    averageDuration:
      Array.from(testState.testMetrics.values()).reduce(
        (sum, metric) => sum + metric.duration,
        0,
      ) / testState.testMetrics.size,
    slowestTest: Array.from(testState.testMetrics.entries()).sort(
      ([, a], [, b]) => b.duration - a.duration,
    )[0],
  };

  console.log("📊 Test Execution Summary:", summary);
}
```

#### Performance Setup (`test-setup/performance-setup.ts`)

```typescript
import { beforeAll, afterAll } from "vitest";
import * as os from "os";
import * as fs from "fs/promises";

// Performance test configuration
const performanceConfig = {
  mode: process.env.PERFORMANCE_MODE || "development",
  measurementRuns: parseInt(process.env.MEASUREMENT_RUNS || "5"),
  warmupRuns: parseInt(process.env.WARMUP_RUNS || "3"),
  datasetSize: process.env.DATASET_SIZE || "small",
};

beforeAll(async () => {
  console.log("⚡ Initializing performance test environment...");

  // System performance checks
  await performSystemChecks();

  // Optimize environment for performance testing
  await optimizeEnvironment();

  // Generate test datasets
  await generateTestDatasets();

  console.log("✅ Performance environment ready");
  console.log("📊 Configuration:", performanceConfig);
});

afterAll(async () => {
  console.log("📈 Finalizing performance test environment...");

  // Generate performance summary
  await generatePerformanceSummary();

  // Cleanup large test datasets
  await cleanupTestDatasets();

  console.log("✅ Performance cleanup completed");
});

async function performSystemChecks() {
  const system = {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    loadAverage: os.loadavg()[0], // 1-minute load average
  };

  console.log("🖥️ System Information:", system);

  // Check system load
  if (system.loadAverage > system.cpus * 0.8) {
    console.warn(
      "⚠️ High system load detected. Performance results may be affected.",
    );
  }

  // Check available memory
  const memoryUsagePercent =
    ((system.totalMemory - system.freeMemory) / system.totalMemory) * 100;
  if (memoryUsagePercent > 80) {
    console.warn(
      "⚠️ High memory usage detected. Performance results may be affected.",
    );
  }
}

async function optimizeEnvironment() {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    console.log("🗑️ Forced garbage collection");
  }

  // Set Node.js memory limits for consistent testing
  if (performanceConfig.mode === "ci") {
    // Increase memory limit for CI testing
    process.env.NODE_OPTIONS = "--max-old-space-size=8192";
  }
}

async function generateTestDatasets() {
  const datasetSizes = {
    small: { vectors: 100, dimensions: 384 },
    medium: { vectors: 1000, dimensions: 384 },
    large: { vectors: 10000, dimensions: 384 },
    full: { vectors: 50000, dimensions: 384 },
  };

  const config =
    datasetSizes[performanceConfig.datasetSize] || datasetSizes.small;

  // Generate test vectors
  const vectors = [];
  for (let i = 0; i < config.vectors; i++) {
    const vector = Array.from(
      { length: config.dimensions },
      () => Math.random() - 0.5,
    );
    vectors.push({
      id: `test-vector-${i}`,
      vector,
      metadata: { index: i, category: `category-${i % 10}` },
    });
  }

  // Store dataset for tests
  await fs.writeFile(
    `./test-data/performance-dataset-${performanceConfig.datasetSize}.json`,
    JSON.stringify(vectors),
  );

  console.log(
    `📊 Generated ${config.vectors} test vectors with ${config.dimensions} dimensions`,
  );
}

async function generatePerformanceSummary() {
  // This would collect and summarize performance metrics
  console.log("📈 Performance test summary would be generated here");
}

async function cleanupTestDatasets() {
  try {
    await fs.unlink(
      `./test-data/performance-dataset-${performanceConfig.datasetSize}.json`,
    );
    console.log("🗑️ Cleaned up test datasets");
  } catch (error) {
    // File might not exist, which is fine
  }
}
```

#### Regression Setup (`test-setup/regression-setup.ts`)

```typescript
import { beforeAll, afterAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";

// Regression test configuration
const regressionConfig = {
  baselinePath: process.env.BASELINE_PATH || "./performance-baselines/",
  performanceThreshold: parseFloat(process.env.PERFORMANCE_THRESHOLD || "2.0"),
  memoryThreshold: parseFloat(process.env.MEMORY_THRESHOLD || "1.5"),
  throughputThreshold: parseFloat(process.env.THROUGHPUT_THRESHOLD || "0.5"),
};

beforeAll(async () => {
  console.log("📊 Initializing regression test environment...");

  // Ensure baseline directory exists
  await ensureBaselineDirectory();

  // Validate baseline files
  await validateBaselines();

  // Setup regression test environment
  await setupRegressionEnvironment();

  console.log("✅ Regression environment ready");
  console.log("📊 Configuration:", regressionConfig);
});

afterAll(async () => {
  console.log("📈 Finalizing regression test environment...");

  // Generate regression report
  await generateRegressionReport();

  console.log("✅ Regression cleanup completed");
});

async function ensureBaselineDirectory() {
  try {
    await fs.access(regressionConfig.baselinePath);
  } catch {
    await fs.mkdir(regressionConfig.baselinePath, { recursive: true });
    console.log(
      `📁 Created baseline directory: ${regressionConfig.baselinePath}`,
    );
  }
}

async function validateBaselines() {
  const implementations = ["NAPI", "WASM"];

  for (const impl of implementations) {
    const baselinePath = path.join(
      regressionConfig.baselinePath,
      `${impl.toLowerCase()}-baseline.json`,
    );

    try {
      await fs.access(baselinePath);
      const baseline = JSON.parse(await fs.readFile(baselinePath, "utf8"));

      // Validate baseline structure
      if (!baseline.version || !baseline.results || !baseline.environment) {
        console.warn(
          `⚠️ Invalid baseline structure for ${impl}: ${baselinePath}`,
        );
      } else {
        console.log(`✅ Valid baseline found for ${impl}`);
      }
    } catch {
      console.warn(`⚠️ No baseline found for ${impl}: ${baselinePath}`);
    }
  }
}

async function setupRegressionEnvironment() {
  // Set up environment variables for regression testing
  process.env.REGRESSION_THRESHOLDS = JSON.stringify({
    performance: regressionConfig.performanceThreshold,
    memory: regressionConfig.memoryThreshold,
    throughput: regressionConfig.throughputThreshold,
  });
}

async function generateRegressionReport() {
  // This would generate a comprehensive regression report
  console.log("📊 Regression report would be generated here");
}
```

## Environment Variables

### Core Configuration

```bash
# Test execution mode
NODE_ENV=test

# Performance testing
PERFORMANCE_MODE=development|ci
MEASUREMENT_RUNS=5|10
WARMUP_RUNS=3|5
DATASET_SIZE=small|medium|large|full

# Regression testing
REGRESSION_MODE=true
BASELINE_PATH=./performance-baselines/
PERFORMANCE_THRESHOLD=2.0
MEMORY_THRESHOLD=1.5
THROUGHPUT_THRESHOLD=0.5

# CI/CD integration
CI=true|false
BUILD_NUMBER=123
COMMIT_SHA=abc123def456

# Database configuration
TEST_DATABASE_URL=sqlite::memory:
TEST_VECTOR_DIMENSIONS=384
TEST_VECTOR_COUNT=1000

# Logging and reporting
DEBUG=performance|regression|integration
LOG_LEVEL=info|debug|warn|error
REPORT_FORMAT=json|html|junit
```

### Development Environment (.env.development)

```bash
# Development-specific settings
NODE_ENV=development
PERFORMANCE_MODE=development
MEASUREMENT_RUNS=5
WARMUP_RUNS=3
DATASET_SIZE=small
DEBUG=performance
LOG_LEVEL=info
```

### CI Environment (.env.ci)

```bash
# CI-specific settings
NODE_ENV=test
CI=true
PERFORMANCE_MODE=ci
MEASUREMENT_RUNS=10
WARMUP_RUNS=5
DATASET_SIZE=full
BASELINE_PATH=/tmp/baselines/
REPORT_FORMAT=json
LOG_LEVEL=warn
```

## Package.json Scripts Configuration

### Development Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",

    "test:unit": "vitest run tests/unit/",
    "test:integration": "vitest run packages/ast-helper/src/database/vector/integration.test.ts",
    "test:performance": "vitest run --config vitest.performance.config.ts",
    "test:regression": "vitest run --config vitest.regression.config.ts",

    "test:quick": "vitest run --config vitest.precommit.config.ts",
    "test:full": "vitest run --coverage",

    "test:performance:dev": "PERFORMANCE_MODE=development npm run test:performance",
    "test:performance:ci": "PERFORMANCE_MODE=ci npm run test:performance",

    "test:regression:local": "BASELINE_PATH=./baselines/ npm run test:regression",
    "test:regression:ci": "CI=true npm run test:regression"
  }
}
```

### Advanced Scripts

```json
{
  "scripts": {
    "test:memory": "node --expose-gc node_modules/.bin/vitest run --grep='memory'",
    "test:profile": "node --prof node_modules/.bin/vitest run",
    "test:debug": "node --inspect-brk node_modules/.bin/vitest run",

    "baseline:create": "node scripts/create-baseline.js",
    "baseline:update": "node scripts/update-baseline.js",
    "baseline:validate": "node scripts/validate-baseline.js",

    "report:performance": "node scripts/generate-performance-report.js",
    "report:regression": "node scripts/generate-regression-report.js",
    "report:coverage": "vitest run --coverage && open coverage/index.html"
  }
}
```

## Directory Structure

### Test Organization

```
tests/
├── unit/                           # Unit tests
│   ├── config/
│   ├── database/
│   └── utils/
├── integration/                    # Integration tests (excluded from vector tests)
├── fixtures/                      # Test fixtures and data
├── helpers/                       # Test helper utilities
└── __mocks__/                     # Mock implementations

packages/ast-helper/src/database/vector/
├── performance-benchmark.test.ts   # Performance benchmarking
├── wasm-vector-database.test.ts   # WASM feature parity
├── integration.test.ts            # End-to-end integration
├── regression.test.ts             # Performance regression
└── __tests__/                     # Additional test files

test-setup/
├── global-setup.ts                # Global test configuration
├── performance-setup.ts           # Performance test setup
├── regression-setup.ts            # Regression test setup
└── test-utils.ts                  # Test utility functions

test-data/
├── vectors/                       # Test vector datasets
├── baselines/                     # Performance baselines
└── fixtures/                      # Static test data

test-results/
├── performance-results.json       # Performance test results
├── regression-report.json         # Regression analysis
├── coverage/                      # Coverage reports
└── junit.xml                      # JUnit test results
```

### Configuration Files

```
vitest.config.ts                   # Base Vitest configuration
vitest.performance.config.ts       # Performance testing config
vitest.performance.ci.config.ts    # CI performance config
vitest.regression.config.ts        # Regression testing config
vitest.precommit.config.ts         # Quick validation config
vitest.ci.config.ts               # Full CI configuration

.env.development                   # Development environment
.env.test                         # Test environment
.env.ci                           # CI environment
```

This comprehensive configuration ensures consistent, reliable, and efficient test execution across all environments and use cases.
