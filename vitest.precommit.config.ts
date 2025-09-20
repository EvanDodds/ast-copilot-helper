import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

// Fast configuration for pre-commit hooks
// Only runs critical syntax/logic tests, skips performance benchmarks
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    watch: false,
    
    // Faster test execution settings
    testTimeout: 10000,        // 10s timeout (faster than main config)
    hookTimeout: 5000,         // 5s for setup/teardown
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 2,         // Less parallelism for faster startup
        minThreads: 1,
      },
    },
    
    // Only include unit tests, exclude slow benchmarks and integration tests
    include: [
      'tests/unit/**/*.{test,spec}.{js,ts}',
      'packages/*/src/**/*.{test,spec}.{js,ts}',
    ],
    exclude: [
      'node_modules/',
      'dist/',
      'coverage/',
      'tests/fixtures/',
      'tests/benchmarks/**',      // Skip performance benchmarks
      'tests/integration/**',     // Skip integration tests for speed
      '**/*performance*.{test,spec}.{js,ts}',  // Skip any performance tests
      '**/*benchmark*.{test,spec}.{js,ts}',    // Skip any benchmark tests
      'tests/unit/performance/**', // Skip performance unit tests specifically
      '**/concurrency-profiler*.{test,spec}.{js,ts}', // Skip concurrency profiler tests
      '**/memory-profiler*.{test,spec}.{js,ts}',       // Skip memory profiler tests
      '**/benchmark-runner*.{test,spec}.{js,ts}',      // Skip benchmark runner tests
      '**/embed*.{test,spec}.{js,ts}',                 // Skip embedding tests (ONNX heavy)
      '**/acceptance-criteria-verification*.{test,spec}.{js,ts}', // Skip ONNX acceptance tests
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