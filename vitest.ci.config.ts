import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // CI-specific test configuration
    watch: false, // Never watch in CI environments
    testTimeout: 30000, // 30 seconds max per test (vs default 60s)
    hookTimeout: 10000, // 10 seconds for setup/teardown
    teardownTimeout: 5000, // 5 seconds for cleanup

    // More aggressive resource management
    maxConcurrency: 4, // Limit concurrent tests
    minWorkers: 1,
    maxWorkers: 4,

    // Faster reporting
    reporters: process.env.VERBOSE_CI ? ["verbose"] : ["basic"],

    // Skip expensive tests by default in CI
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.d.ts",
      // Skip tests that require external dependencies not available in CI
      "**/semantic-processor.test.ts",
      // Skip these expensive tests unless explicitly enabled
      ...(process.env.RUN_EXPENSIVE_TESTS
        ? []
        : [
            "**/scaling.test.ts",
            "**/performance.test.ts",
            "**/resource-usage.test.ts",
          ]),
    ],

    // Environment variables for test optimization
    env: {
      CI: "true",
      TEST_ENV: "ci",
      NODE_ENV: "test",
    },
  },
});
