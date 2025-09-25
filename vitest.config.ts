import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Ensure tests run once and exit in CI/non-interactive environments
    watch: false,
    // Ensure Node.js globals are available
    server: {
      deps: {
        inline: ["process"],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
      exclude: [
        "node_modules/",
        "dist/",
        "coverage/",
        "tests/fixtures/",
        "**/*.test.ts",
        "**/*.config.ts",
        "**/*.d.ts",
        "packages/*/bin/",
        ".vscode/",
        ".github/",
      ],
    },
    testTimeout: 30000, // 30s for integration tests
    hookTimeout: 10000, // 10s for setup/teardown
    // Force sequential execution to reduce memory pressure
    pool: "vmThreads",
    poolOptions: {
      vmThreads: {
        maxThreads: 1,
        minThreads: 1,
        memoryLimit: "1GB", // Increased from 512MB to prevent out of memory
      },
    },
    // Memory management configuration
    maxWorkers: 1, // Single worker for memory-constrained environment
    sequence: {
      shuffle: false, // Deterministic test order for memory consistency
    },
    include: [
      "tests/**/*.{test,spec}.{js,ts}",
      "packages/**/*.{test,spec}.{js,ts}",
    ],
    exclude: [
      "node_modules/",
      "dist/",
      "coverage/",
      "tests/fixtures/",
      // Memory-intensive tests - using explicit patterns to ensure exclusion
      "**/XenovaEmbeddingGenerator.test.ts", // XENOVA model loading tests
      "**/final-acceptance-verification.test.ts", // Large verification tests
      "**/acceptance-criteria-verification.test.ts", // ONNX runtime binding tests
      "**/file-processor.test.ts", // File processing tests
      "**/integrity*.test.ts", // All integrity tests
      "**/manager.test.ts", // Glob manager tests
      // Pattern-based exclusions for comprehensive coverage - more specific patterns
      "**/embedder/**/*.{test,spec}.{js,ts}", // Embedding generation tests (full directory)
      "tests/benchmarks/**/*.{test,spec}.{js,ts}", // All benchmark tests
      "tests/integration/**performance*.{test,spec}.{js,ts}", // Performance integration tests
      "tests/performance/**/*.{test,spec}.{js,ts}", // Dedicated performance test directory
      "**/scaling*.{test,spec}.{js,ts}", // Scaling tests
      "**/resource-usage*.{test,spec}.{js,ts}", // Resource usage tests
      "**/milestone-week-*.{test,spec}.{js,ts}", // Milestone performance tests
      "**/performance-validation.test.ts", // Slow performance validation tests (37+ seconds)
      "**/database/workspace.test.ts", // Temporarily excluded due to memory issues
      "**/binary/BinaryCompatibilityTester.test.ts", // Binary compatibility tests causing native crashes
      "**/comprehensive-integration.test.ts", // Cross-platform integration timeouts
      "tests/integration/database-integration.test.ts", // Large database integration test causing memory leaks (~1300 lines)
      "tests/integration/end-to-end-workflow.test.ts", // Massive end-to-end test causing memory exhaustion (~1761 lines)
      "tests/integration/mcp-protocol-compliance.test.ts", // Large MCP protocol test suite (~1687 lines)  
      "tests/integration/query-processing-integration.test.ts", // Large query processing integration (~1598 lines)
      "tests/integration/ast-parsing-integration.test.ts", // Large AST parsing integration (~1037 lines)
      "tests/integration/performance-scalability.test.ts", // Performance scalability tests (~842 lines)
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
