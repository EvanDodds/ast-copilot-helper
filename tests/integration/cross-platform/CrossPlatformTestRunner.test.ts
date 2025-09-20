/**
 * Cross-Platform Test Framework Tests
 * Tests for the cross-platform compatibility testing framework
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CrossPlatformTestRunner } from './CrossPlatformTestRunner.js';
import { CrossPlatformTestConfig, BinaryTestResult, FeatureTest, TestResult } from './types.js';

describe('CrossPlatformTestRunner', () => {
  let testRunner: CrossPlatformTestRunner;

  beforeEach(() => {
    testRunner = new CrossPlatformTestRunner();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(testRunner).toBeDefined();
      expect(testRunner).toBeInstanceOf(CrossPlatformTestRunner);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<CrossPlatformTestConfig> = {
        platforms: ['linux'],
        nodeVersions: ['20.x'],
        testCategories: ['filesystem'],
        timeout: 60000
      };

      const customRunner = new CrossPlatformTestRunner(customConfig);
      expect(customRunner).toBeDefined();
      expect(customRunner).toBeInstanceOf(CrossPlatformTestRunner);
    });
  });

  describe('platform detection', () => {
    it('should detect current platform and architecture', async () => {
      const results = await testRunner.testPlatformCompatibility();
      
      expect(results).toBeDefined();
      expect(results.summary).toBeDefined();
      expect(results.summary.totalTests).toBeGreaterThanOrEqual(0);
      
      // Should have results for current platform
      const currentPlatform = process.platform;
      let platformResult;
      
      if (currentPlatform === 'win32') {
        platformResult = results.windows;
      } else if (currentPlatform === 'darwin') {
        platformResult = results.macos;
      } else if (currentPlatform === 'linux') {
        platformResult = results.linux;
      }

      expect(platformResult).toBeDefined();
      expect(platformResult?.platform).toBe(currentPlatform);
      expect(platformResult?.architecture).toBe(process.arch);
      expect(platformResult?.nodeVersion).toBe(process.version);
    });
  });

  describe('file system compatibility tests', () => {
    it('should test file system compatibility', async () => {
      const fsTests = await testRunner.testFileSystemCompatibility();
      
      expect(fsTests).toBeDefined();
      expect(fsTests.pathSeparators).toBeDefined();
      expect(fsTests.pathSeparators.testName).toBe('path_separators');
      expect(fsTests.pathSeparators.category).toBe('file_operations');
      
      expect(fsTests.caseSensitivity).toBeDefined();
      expect(fsTests.caseSensitivity.testName).toBe('case_sensitivity');
      expect(fsTests.caseSensitivity.category).toBe('file_operations');
      
      expect(fsTests.specialCharacters).toBeDefined();
      expect(fsTests.longPaths).toBeDefined();
      expect(fsTests.permissions).toBeDefined();
      expect(fsTests.symbolicLinks).toBeDefined();
      expect(fsTests.unicode).toBeDefined();
    });

    it('should handle path separator normalization', async () => {
      const pathResults = await testRunner.validatePathHandling();
      
      expect(pathResults).toBeDefined();
      expect(pathResults.pathNormalization).toBeDefined();
      expect(Array.isArray(pathResults.pathNormalization)).toBe(true);
      
      expect(pathResults.pathResolution).toBeDefined();
      expect(pathResults.pathValidation).toBeDefined();
      expect(pathResults.crossPlatformPaths).toBeDefined();
    });
  });

  describe('binary distribution tests', () => {
    it('should test binary compatibility', async () => {
      const binaryTests = await testRunner.validateBinaryDistribution();
      
      expect(binaryTests).toBeDefined();
      expect(binaryTests.platform).toBe(process.platform);
      expect(binaryTests.architecture).toBe(process.arch);
      expect(binaryTests.nodeVersion).toBe(process.version);
      
      expect(Array.isArray(binaryTests.binaryTests)).toBe(true);
      expect(Array.isArray(binaryTests.dependencyTests)).toBe(true);
      expect(Array.isArray(binaryTests.nativeModuleTests)).toBe(true);
    });

    it('should test Tree-sitter binary loading', async () => {
      const binaryTests = await testRunner.validateBinaryDistribution();
      
      const treeSitterTest = binaryTests.binaryTests.find(
        (test: BinaryTestResult) => test.component === 'tree-sitter'
      );
      
      expect(treeSitterTest).toBeDefined();
      expect(treeSitterTest?.platform).toBe(process.platform);
      expect(treeSitterTest?.architecture).toBe(process.arch);
      expect(typeof treeSitterTest?.success).toBe('boolean');
      expect(typeof treeSitterTest?.loadTime).toBe('number');
    });

    it('should test SQLite binary loading', async () => {
      const binaryTests = await testRunner.validateBinaryDistribution();
      
      const sqliteTest = binaryTests.nativeModuleTests.find(
        (test: BinaryTestResult) => test.component === 'better-sqlite3'
      );
      
      expect(sqliteTest).toBeDefined();
      expect(sqliteTest?.platform).toBe(process.platform);
      expect(sqliteTest?.architecture).toBe(process.arch);
      expect(typeof sqliteTest?.success).toBe('boolean');
      expect(typeof sqliteTest?.loadTime).toBe('number');
    });
  });

  describe('Node.js version compatibility tests', () => {
    it('should test Node.js version compatibility', async () => {
      const nodeTests = await testRunner.testNodeVersionCompatibility();
      
      expect(nodeTests).toBeDefined();
      expect(nodeTests.currentVersion).toBe(process.version);
      expect(Array.isArray(nodeTests.supportedFeatures)).toBe(true);
      expect(Array.isArray(nodeTests.unsupportedFeatures)).toBe(true);
      expect(typeof nodeTests.performanceMetrics).toBe('object');
    });

    it('should detect ES module support', async () => {
      const nodeTests = await testRunner.testNodeVersionCompatibility();
      
      const esModuleFeature = nodeTests.supportedFeatures.find(
        (feature: FeatureTest) => feature.feature === 'es_modules'
      );
      
      expect(esModuleFeature).toBeDefined();
      expect(esModuleFeature?.supported).toBe(true);
      expect(esModuleFeature?.version).toBe(process.version);
    });

    it('should detect BigInt support', async () => {
      const nodeTests = await testRunner.testNodeVersionCompatibility();
      
      const bigintFeature = nodeTests.supportedFeatures.find(
        (feature: FeatureTest) => feature.feature === 'bigint'
      );
      
      expect(bigintFeature).toBeDefined();
      expect(bigintFeature?.supported).toBe(true);
      expect(bigintFeature?.version).toBe(process.version);
    });
  });

  describe('platform-specific tests', () => {
    it('should run platform-specific tests for current platform', async () => {
      const platformTests = await testRunner.runPlatformSpecificTests();
      
      expect(platformTests).toBeDefined();
      
      const currentPlatform = process.platform;
      
      if (currentPlatform === 'win32') {
        expect(platformTests.windows).toBeDefined();
        expect(platformTests.windows?.powerShellCompatibility).toBeDefined();
        expect(platformTests.windows?.cmdCompatibility).toBeDefined();
        expect(platformTests.windows?.pathLengthLimits).toBeDefined();
        expect(platformTests.windows?.filePermissions).toBeDefined();
        expect(platformTests.windows?.driveLetters).toBeDefined();
      } else if (currentPlatform === 'darwin') {
        expect(platformTests.macos).toBeDefined();
        expect(platformTests.macos?.appleSymbolicLinks).toBeDefined();
        expect(platformTests.macos?.bundleCompatibility).toBeDefined();
        expect(platformTests.macos?.securityPolicies).toBeDefined();
        expect(platformTests.macos?.packageManagement).toBeDefined();
        expect(platformTests.macos?.fileAttributes).toBeDefined();
      } else if (currentPlatform === 'linux') {
        expect(platformTests.linux).toBeDefined();
        expect(Array.isArray(platformTests.linux?.distributionCompatibility)).toBe(true);
        expect(Array.isArray(platformTests.linux?.packageManagement)).toBe(true);
        expect(platformTests.linux?.containerCompatibility).toBeDefined();
        expect(platformTests.linux?.filePermissions).toBeDefined();
        expect(platformTests.linux?.symbolicLinks).toBeDefined();
      }
    });
  });

  describe('test configuration', () => {
    it('should respect skip binary tests configuration', async () => {
      const config: Partial<CrossPlatformTestConfig> = {
        skipBinaryTests: true,
        testCategories: ['filesystem']
      };
      
      const configuredRunner = new CrossPlatformTestRunner(config);
      const results = await configuredRunner.testPlatformCompatibility();
      
      // Should have fewer tests when binary tests are skipped
      expect(results.summary.totalTests).toBeGreaterThanOrEqual(0);
      
      // Current platform results should exist but with limited tests
      const currentPlatform = process.platform;
      let platformResult;
      
      if (currentPlatform === 'win32') {
        platformResult = results.windows;
      } else if (currentPlatform === 'darwin') {
        platformResult = results.macos;
      } else if (currentPlatform === 'linux') {
        platformResult = results.linux;
      }

      expect(platformResult?.binaryTests.length).toBe(0);
    });

    it('should respect test category filtering', async () => {
      const config: Partial<CrossPlatformTestConfig> = {
        testCategories: ['filesystem'],
        skipBinaryTests: true,
        skipPerformanceTests: true
      };
      
      const configuredRunner = new CrossPlatformTestRunner(config);
      const results = await configuredRunner.testPlatformCompatibility();
      
      expect(results.summary.totalTests).toBeGreaterThanOrEqual(0);
      
      // Should only have filesystem tests
      const currentPlatform = process.platform;
      let platformResult;
      
      if (currentPlatform === 'win32') {
        platformResult = results.windows;
      } else if (currentPlatform === 'darwin') {
        platformResult = results.macos;
      } else if (currentPlatform === 'linux') {
        platformResult = results.linux;
      }

      const filesystemTests = platformResult?.testResults.filter(
        (test: TestResult) => test.category === 'file_operations'
      );
      
      expect(filesystemTests?.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle test failures gracefully', async () => {
      // This test ensures the framework doesn't crash on individual test failures
      const results = await testRunner.testPlatformCompatibility();
      
      expect(results).toBeDefined();
      expect(results.summary).toBeDefined();
      expect(typeof results.summary.totalTests).toBe('number');
      expect(typeof results.summary.passedTests).toBe('number');
      expect(typeof results.summary.failedTests).toBe('number');
      
      // Summary should add up
      expect(results.summary.totalTests).toBe(
        results.summary.passedTests + results.summary.failedTests
      );
    });

    it('should provide meaningful error messages', async () => {
      const results = await testRunner.testPlatformCompatibility();
      
      const failedTests = [
        ...results.windows.testResults.filter((t: TestResult) => !t.success),
        ...results.macos.testResults.filter((t: TestResult) => !t.success),
        ...results.linux.testResults.filter((t: TestResult) => !t.success)
      ];

      // Any failed tests should have error messages
      failedTests.forEach(test => {
        if (!test.success) {
          expect(test.error).toBeDefined();
          expect(typeof test.error).toBe('string');
          expect(test.error!.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('performance and reliability', () => {
    it('should complete tests within reasonable time', async () => {
      const startTime = Date.now();
      
      const results = await testRunner.testPlatformCompatibility();
      
      const duration = Date.now() - startTime;
      
      expect(results).toBeDefined();
      
      // Tests should complete within 30 seconds by default
      expect(duration).toBeLessThan(30000);
    }, 35000);

    it('should provide consistent results', async () => {
      // Run tests twice and ensure consistent results for basic platform info
      const results1 = await testRunner.testPlatformCompatibility();
      const results2 = await testRunner.testPlatformCompatibility();
      
      expect(results1.summary.totalTests).toBe(results2.summary.totalTests);
      
      // Platform information should be identical
      expect(results1.windows.platform).toBe(results2.windows.platform);
      expect(results1.macos.platform).toBe(results2.macos.platform);
      expect(results1.linux.platform).toBe(results2.linux.platform);
    });
  });
});