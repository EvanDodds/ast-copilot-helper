/**
 * Binary Compatibility Integration Test
 * Validates BinaryCompatibilityTester integration with CrossPlatformTestRunner
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CrossPlatformTestRunner } from '../CrossPlatformTestRunner';

describe('BinaryCompatibilityTester Integration', () => {
  let runner: CrossPlatformTestRunner;

  beforeEach(() => {
    runner = new CrossPlatformTestRunner({
      testCategories: ['binary'],
      skipPerformanceTests: true,
      timeout: 30000
    });
  });

  it('should integrate binary compatibility tests with main test runner', async () => {
    const results = await runner.testPlatformCompatibility();
    
    expect(results).toBeDefined();
    expect(results.windows || results.macos || results.linux).toBeDefined();
    
    // Check that binary tests were executed for current platform
    const currentPlatformKey = process.platform === 'win32' ? 'windows' :
                              process.platform === 'darwin' ? 'macos' : 'linux';
    const currentPlatformResults = results[currentPlatformKey as keyof typeof results] as any;
    expect(currentPlatformResults).toBeDefined();
    
    const binaryTests = currentPlatformResults.testResults.filter(
      (test: any) => test.category === 'binary'
    );
    
    expect(binaryTests.length).toBeGreaterThan(0);
    
    // Verify expected binary test types are present
    const binaryTestNames = binaryTests.map((test: any) => test.name);
    expect(binaryTestNames).toContain('platform_detection');
    expect(binaryTestNames).toContain('node_addon_loading');
    expect(binaryTestNames).toContain('webassembly_support');
  }, 60000);

  it('should handle binary test failures gracefully', async () => {
    const results = await runner.testPlatformCompatibility();
    
    const currentPlatformKey = process.platform === 'win32' ? 'windows' :
                              process.platform === 'darwin' ? 'macos' : 'linux';
    const currentPlatformResults = results[currentPlatformKey as keyof typeof results] as any;
    const binaryTests = currentPlatformResults.testResults.filter(
      (test: any) => test.category === 'binary'
    );
    
    // Even if some tests fail, there should be results
    expect(binaryTests.length).toBeGreaterThan(0);
    
    // Failed tests should have proper error information
    const failedBinaryTests = binaryTests.filter((test: any) => !test.passed);
    if (failedBinaryTests.length > 0) {
      failedBinaryTests.forEach((test: any) => {
        expect(test.error || test.details?.expectedFailure).toBeTruthy();
      });
    }
  }, 60000);

  it('should provide comprehensive binary compatibility summary', async () => {
    const results = await runner.testPlatformCompatibility();
    
    expect(results.summary).toBeDefined();
    expect(results.summary.totalTests).toBeGreaterThan(0);
    
    // Should include binary-specific metrics
    const currentPlatformKey = process.platform === 'win32' ? 'windows' :
                              process.platform === 'darwin' ? 'macos' : 'linux';
    const currentPlatformResults = results[currentPlatformKey as keyof typeof results] as any;
    const binaryTests = currentPlatformResults.testResults.filter(
      (test: any) => test.category === 'binary'
    );
    
    const passedBinaryTests = binaryTests.filter((test: any) => test.passed);
    expect(passedBinaryTests.length).toBeGreaterThan(0);
  }, 60000);

  it('should handle platform-specific binary requirements', async () => {
    const results = await runner.testPlatformCompatibility();
    
    const currentPlatformKey = process.platform === 'win32' ? 'windows' :
                              process.platform === 'darwin' ? 'macos' : 'linux';
    const currentPlatformResults = results[currentPlatformKey as keyof typeof results] as any;
    const binaryTests = currentPlatformResults.testResults.filter(
      (test: any) => test.category === 'binary'
    );
    
    // All tests should be marked for the current platform
    binaryTests.forEach((test: any) => {
      expect(test.platform).toBe(process.platform);
    });
    
    // Platform detection test should always pass
    const platformTest = binaryTests.find((test: any) =>
      test.name === 'platform_detection'
    );
    
    expect(platformTest).toBeDefined();
    expect(platformTest!.passed).toBe(true);
  }, 60000);
});