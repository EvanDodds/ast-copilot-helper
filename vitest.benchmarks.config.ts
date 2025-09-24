import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    watch: false,
    testTimeout: 600000, // 10 minutes for benchmarks
    hookTimeout: 30000, // 30s for setup/teardown
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 1, // Single thread to prevent memory issues
        minThreads: 1,
        isolate: true,
      },
    },
    maxWorkers: 1,
    sequence: {
      shuffle: false,
    },
    include: [
      "tests/benchmarks/**/*.{test,spec}.{js,ts}",
      "tests/integration/**performance*.{test,spec}.{js,ts}",
      "**/*performance*.{test,spec}.{js,ts}",
      "**/*benchmark*.{test,spec}.{js,ts}",
    ],
    exclude: [
      "node_modules/",
      "dist/",
      "coverage/",
      "tests/fixtures/",
      // Only exclude truly problematic tests
      "**/XenovaEmbeddingGenerator.test.ts",
    ],
    setupFiles: ["./tests/setup.ts"],
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
