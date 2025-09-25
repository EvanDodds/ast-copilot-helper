import { resolve } from "path";
import { defineConfig } from "vitest/config";

// Fast configuration for pre-commit hooks
// Only runs critical syntax/logic tests, skips performance benchmarks
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    watch: false,

    // Ultra-fast test execution settings for memory stability
    testTimeout: 5000, // 5s timeout (very fast)
    hookTimeout: 3000, // 3s for setup/teardown
    pool: "forks", // Use forks with strict memory limits
    poolOptions: {
      forks: {
        maxForks: 1, // Single fork to prevent memory issues
        minForks: 1,
        isolate: true,
        execArgv: ["--max-old-space-size=512"], // Very strict memory limit
      },
    },

    // Only essential tests - exclude memory-intensive ones
    include: [
      "tests/unit/config/**/*.test.ts",
      "packages/*/src/config/**/*.test.ts",
      "tests/unit/mcp/**/server.test.ts",
      "tests/unit/mcp/**/transport.test.ts",
      "tests/unit/mcp/**/protocol.test.ts",
      "packages/ast-mcp-server/src/config/**/*.test.ts",
      "packages/vscode-extension/src/test/package.test.ts",
    ],
    exclude: [
      // Exclude ALL potentially memory-intensive tests
      "**/integration/**",
      "**/performance/**",
      "**/benchmarks/**",
      "**/memory/**",
      "**/file-watcher.test.ts", // Known memory leaks
      "**/extension.test.ts", // VS Code extension tests (slow)
      "**/UIManager.test.ts", // UI tests
      "**/git/**", // Git tests
      "**/parser/**", // Parser tests
      "**/filesystem/**", // File system tests
      "**/logging/**", // Logging tests
      "**/embedder/**", // Embedding tests
      "**/commands/**", // Command tests
      "**/locking.test.ts", // Locking tests
      "**/cli.test.ts", // CLI tests
      "**/manager.test.ts", // Manager tests
      "**/runtime-detector.test.ts", // Runtime detector
      "**/resource-manager.test.ts", // Resource manager
      "**/event-coordinator.test.ts", // Event coordinator
      "**/message-broker.test.ts", // Message broker
      // All processor tests
      "**/*processor*.test.ts",
      // All integration patterns
      "**/*integration*.test.ts",
      // All server core tests (memory-intensive)
      "**/server-core.test.ts",
      // Error handling tests
      "**/errors*.test.ts",
      "**/git-simple.test.ts",
      // Full system tests
      "**/full-system.test.ts",
      // Any remaining heavy tests
      "**/types.test.ts",
      "**/defaults.test.ts",
      "**/tools.test.ts",
      "**/resources.test.ts",
      "**/protocol-handler.test.ts",
    ],

    // No setup files for maximum speed and minimal memory
    // setupFiles: ['./tests/setup.ts'],

    // Ultra-minimal settings for memory stability
    teardownTimeout: 2000,
    maxConcurrency: 1, // Run tests strictly one at a time
    sequence: {
      shuffle: false, // Deterministic order
    },
    fileParallelism: false, // No parallel file processing

    // Disable coverage for speed
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      "@ast-helper": resolve(__dirname, "packages/ast-helper/src"),
      "@ast-mcp-server": resolve(__dirname, "packages/ast-mcp-server/src"),
      "@vscode-ext": resolve(__dirname, "packages/vscode-extension/src"),
      "@tests": resolve(__dirname, "tests"),
    },
  },
});
