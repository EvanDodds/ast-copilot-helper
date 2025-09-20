import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Ensure tests run once and exit in CI/non-interactive environments
    watch: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        'tests/fixtures/',
        '**/*.test.ts',
        '**/*.config.ts',
        '**/*.d.ts',
        'packages/*/bin/',
        '.vscode/',
        '.github/',
      ],
    },
    testTimeout: 30000,        // 30s for integration tests
    hookTimeout: 10000,        // 10s for setup/teardown
    pool: 'threads',           // Parallel test execution with threads
    poolOptions: {
      threads: {
        maxThreads: 2,         // Further reduced for CI memory constraints
        minThreads: 1,         // Minimum threads
        isolate: true,         // Better memory isolation
      },
    },
    // Memory management configuration
    maxWorkers: 2,             // Further reduced workers for memory constraints
    sequence: {
      shuffle: false,          // Deterministic test order for memory consistency
    },
    include: [
      'tests/**/*.{test,spec}.{js,ts}',
      'packages/**/*.{test,spec}.{js,ts}',
    ],
    exclude: [
      'node_modules/',
      'dist/',
      'coverage/',
      'tests/fixtures/',
      // Memory-intensive tests - using explicit patterns to ensure exclusion
      '**/XenovaEmbeddingGenerator.test.ts',                            // XENOVA model loading tests  
      '**/final-acceptance-verification.test.ts',                       // Large verification tests
      '**/file-processor.test.ts',                                      // File processing tests
      '**/integrity*.test.ts',                                          // All integrity tests 
      '**/manager.test.ts',                                             // Glob manager tests
      // Pattern-based exclusions for comprehensive coverage
      '**/embed*.{test,spec}.{js,ts}',                                  // Embedding generation tests
      '**/performance*.{test,spec}.{js,ts}',                            // Performance benchmarking tests
      '**/benchmarks/**/*.{test,spec}.{js,ts}',                         // Benchmark tests
      'tests/benchmarks/**/*.{test,spec}.{js,ts}',                      // All benchmark tests
      'tests/integration/**performance*.{test,spec}.{js,ts}',           // Performance integration tests
      '**/scaling*.{test,spec}.{js,ts}',                                // Scaling tests
      '**/resource-usage*.{test,spec}.{js,ts}',                         // Resource usage tests
      '**/milestone-week-*.{test,spec}.{js,ts}',                        // Milestone performance tests
    ],
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@ast-helper': resolve(__dirname, 'packages/ast-helper/src'),
      '@ast-mcp-server': resolve(__dirname, 'packages/ast-mcp-server/src'),
      '@vscode-ext': resolve(__dirname, 'packages/vscode-extension/src'),
      '@tests': resolve(__dirname, 'tests'),
    },
  },
});