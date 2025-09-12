import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
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
        maxThreads: 4,         // Limit for CI environments
        minThreads: 1,         // Minimum threads
      },
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