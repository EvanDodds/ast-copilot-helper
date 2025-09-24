import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Pre-commit: Only core configuration and validation tests
    include: [
      "tests/unit/config/**/*.test.ts",
      "packages/*/src/config/**/*.test.ts",
      "packages/*/src/__tests__/unit/**/types.test.ts",
      "packages/*/src/__tests__/unit/**/defaults.test.ts",
      "packages/*/src/__tests__/unit/**/validator.test.ts",
    ],
    exclude: [
      // Exclude ALL slow/memory-intensive tests
      "**/performance/**",
      "**/benchmarks/**",
      "**/integration/**",
      "**/file-watcher.test.ts", // Memory leaks
      "**/git/**",
      "**/filesystem/**",
      "**/database/**",
      "**/parser/**",
      "**/logging/**",
      "**/mcp/**",
      "**/query/**",
      "**/embedder/**",
      "**/models/**",
      "**/commands/**",
      "**/locking.test.ts",
      "**/extension.test.ts",
      "**/UIManager.test.ts",
      "**/cli.test.ts",
      // All integration patterns
      "**/*integration*.test.ts",
      "**/*processor*.test.ts",
      // Exclude all but core config tests
      "**/scaling/**",
      "**/indexing/**",
      "**/parsing/**",
      "**/end-to-end/**",
      "**/workflow/**",
      "**/memory/**",
      "**/resource-pools.test.ts",
      "**/glob/**",
      "**/security/**",
      "**/test-debug/**",
      "**/test-manual/**",
      "**/test-perf-workspace/**",
    ],

    // Ultra-fast configuration for pre-commit - minimal tests only
    reporters: ["basic"],
    pool: "forks",
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 1, // Single fork to minimize memory usage
        isolate: true,
        execArgv: ["--max-old-space-size=256"], // Strict memory limit
      },
    },

    // Aggressive timeouts for pre-commit
    testTimeout: 2000,
    hookTimeout: 2000,

    // No setup files for speed
    // setupFiles: ['./tests/setup.ts'],

    // Ultra minimal settings for stability
    maxConcurrency: 1, // Only one test at a time
    isolate: true,
    fileParallelism: false, // No parallel file processing

    // Coverage disabled for speed
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./packages/ast-helper/src"),
      "@ast-mcp-server": resolve(__dirname, "./packages/ast-mcp-server/src"),
      "@vscode-extension": resolve(
        __dirname,
        "./packages/vscode-extension/src",
      ),
    },
  },
});
