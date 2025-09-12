import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Disable watch mode by default
    watch: false,
    
    // Run tests in a single thread to avoid conflicts with file locking tests
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    
    // Set timeout for long-running tests (file locking, etc.)
    testTimeout: 10000,
    
    // Environment configuration
    environment: 'node',
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/bin/**'
      ]
    },
    
    // Global setup and teardown
    globals: false,
    
    // Disable UI in CI environments
    ui: false,
    
    // Reporters configuration - use basic reporter for CI
    reporters: process.env.CI ? ['basic'] : ['default'],
    
    // Retry failed tests once in CI
    retry: process.env.CI ? 1 : 0,
    
    // Include and exclude patterns
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts'
    ]
  },
  
  // Build configuration for TypeScript
  esbuild: {
    target: 'node20'
  }
});
