/**
 * Cross-Platform Test Runner Integration Test
 * Test the integration of performance benchmarker with the main test runner
 */

import { describe, test, expect } from 'vitest';
import { CrossPlatformTestRunner } from './CrossPlatformTestRunner.js';

describe('CrossPlatformTestRunner Integration', () => {
  test('should include performance tests when enabled', async () => {
    const runner = new CrossPlatformTestRunner({
      platforms: [process.platform as any], // Test only current platform
      testCategories: ['performance'],
      skipBinaryTests: true, // Skip to speed up test
      timeout: 60000
    });
    
    const results = await runner.testPlatformCompatibility();
    
    // Should have results for current platform
    expect(results.summary.totalTests).toBeGreaterThan(0);
    
    // Get current platform result
    const currentPlatform = process.platform as 'win32' | 'darwin' | 'linux';
    const platformResult = results[currentPlatform];
    
    expect(platformResult).toBeDefined();
    expect(platformResult.testResults.length).toBeGreaterThan(0);
    
    // Check for performance test results
    const performanceTests = platformResult.testResults.filter(test => test.category === 'performance');
    expect(performanceTests.length).toBeGreaterThan(10); // Should have multiple performance tests
    
    // Check for specific performance benchmark categories
    const testNames = performanceTests.map(test => test.name);
    expect(testNames).toContain('file_read_performance');
    expect(testNames).toContain('memory_allocation_performance');
    expect(testNames).toContain('cpu_intensive_performance');
    
  }, 90000); // 90 second timeout for integration test

  test('should exclude performance tests when not in testCategories', async () => {
    const runner = new CrossPlatformTestRunner({
      platforms: [process.platform as any],
      testCategories: ['filesystem'], // Only filesystem, not performance
      skipBinaryTests: true,
      timeout: 30000
    });
    
    const results = await runner.testPlatformCompatibility();
    
    const currentPlatform = process.platform as 'win32' | 'darwin' | 'linux';
    const platformResult = results[currentPlatform];
    
    expect(platformResult).toBeDefined();
    
    // Should not have performance tests
    const performanceTests = platformResult.testResults.filter(test => test.category === 'performance');
    expect(performanceTests.length).toBe(0);
    
    // Should have filesystem tests
    const filesystemTests = platformResult.testResults.filter(test => test.category === 'filesystem');
    expect(filesystemTests.length).toBeGreaterThan(0);
    
  }, 60000);

  test('should provide performance metrics in platform result', async () => {
    const runner = new CrossPlatformTestRunner({
      platforms: [process.platform as any],
      testCategories: ['performance'],
      skipBinaryTests: true,
      timeout: 60000
    });
    
    const results = await runner.testPlatformCompatibility();
    
    const currentPlatform = process.platform as 'win32' | 'darwin' | 'linux';
    const platformResult = results[currentPlatform];
    
    expect(platformResult).toBeDefined();
    expect(platformResult.performanceMetrics).toBeDefined();
    
    // Performance metrics should include benchmark data
    const metrics = platformResult.performanceMetrics as any;
    if (metrics.benchmarks) {
      expect(metrics.benchmarks.total).toBeGreaterThan(0);
      expect(metrics.benchmarks.passed).toBeGreaterThanOrEqual(0);
      expect(metrics.benchmarks.performanceGrade).toMatch(/^[ABCDF]$/);
    }
    
  }, 90000);
});