import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Pre-commit should be VERY fast - only essential unit tests
    include: [
      'tests/unit/**/*.test.ts',
      'packages/*/src/**/*.test.ts'
    ],
    exclude: [
      // Exclude slow tests
      '**/performance/**',
      '**/benchmarks/**', 
      '**/integration/**',
      // Exclude specific slow test files
      '**/security-hardening-framework.test.ts',
      '**/semantic-processor.test.ts',
      '**/git-integration/**',
      '**/cross-platform/**'
    ],
    
    // Fast configuration for pre-commit
    reporter: 'basic',
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 2,
        isolate: true,
      },
    },
    
    // Quick timeouts for pre-commit
    testTimeout: 5000,
    hookTimeout: 3000,
    
    // Minimal setup for speed
    setupFiles: ['./tests/setup.ts'],
    
    // Fast resolution
    resolve: {
      alias: {
        '@': resolve(__dirname, './packages/ast-helper/src'),
        '@ast-mcp-server': resolve(__dirname, './packages/ast-mcp-server/src'),
        '@vscode-extension': resolve(__dirname, './packages/vscode-extension/src'),
      },
    },
    
    // Memory settings for stability
    maxConcurrency: 4,
    isolate: true,
    
    // Coverage disabled for speed
    coverage: {
      enabled: false,
    },
  },
});
