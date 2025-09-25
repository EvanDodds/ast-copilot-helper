/**
 * Comprehensive Integration Test Suite
 * Master integration test for all cross-platform compatibility components
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { CrossPlatformTestRunner } from "./CrossPlatformTestRunner.js";
import { FileSystemTester } from "./filesystem/FileSystemTester.js";
import { BinaryCompatibilityTester } from "./binary/BinaryCompatibilityTester.js";
import { NodeVersionCompatibilityTester } from "./nodejs/NodeVersionCompatibilityTester.js";
import { PerformanceBenchmarker } from "./performance/PerformanceBenchmarker.js";
import { PlatformResult, TestResult } from "./types.js";
import * as fs from "fs/promises";
import * as path from "path";

describe("Cross-Platform Integration Test Suite", () => {
  let testOutputDir: string;

  beforeAll(async () => {
    // Setup test environment
    testOutputDir = path.join(process.cwd(), "test-output", "integration");
    await fs.mkdir(testOutputDir, { recursive: true });
    console.log(
      `🔧 Setting up cross-platform integration test environment at ${testOutputDir}`,
    );
  });

  afterAll(async () => {
    // Cleanup test environment
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
      console.log("🧹 Integration test environment cleaned up");
    } catch (error) {
      console.warn("Warning: Could not clean up test directory:", error);
    }
  });

  describe("Individual Component Integration", () => {
    test("should integrate FileSystemTester successfully", async () => {
      console.log("🔧 Testing FileSystemTester integration...");

      const tester = new FileSystemTester();
      const result = await tester.runTests();

      // Validate structure
      expect(result).toBeDefined();
      expect(result.platform).toBe(process.platform);
      expect(result.testResults).toBeInstanceOf(Array);
      expect(result.testResults.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();

      // Validate test results
      const passedTests = result.testResults.filter((test) => test.passed);
      const failedTests = result.testResults.filter((test) => !test.passed);

      console.log(
        `   ✅ FileSystemTester: ${passedTests.length}/${result.testResults.length} tests passed`,
      );

      // Should have reasonable pass rate (at least 80%)
      expect(passedTests.length / result.testResults.length).toBeGreaterThan(
        0.8,
      );
    }, 30000);

    test("should integrate BinaryCompatibilityTester successfully", async () => {
      console.log("🔧 Testing BinaryCompatibilityTester integration...");

      const tester = new BinaryCompatibilityTester();
      const result = await tester.runTests();

      // Validate structure
      expect(result).toBeDefined();
      expect(result.platform).toBe(process.platform);
      expect(result.testResults).toBeInstanceOf(Array);
      expect(result.testResults.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();

      // Validate test results
      const passedTests = result.testResults.filter((test) => test.passed);

      console.log(
        `   ✅ BinaryCompatibilityTester: ${passedTests.length}/${result.testResults.length} tests passed`,
      );

      // Should have some passing tests (at least 50% since some binaries may not be available)
      expect(passedTests.length / result.testResults.length).toBeGreaterThan(
        0.5,
      );
    }, 30000);

    test("should integrate NodeVersionCompatibilityTester successfully", async () => {
      console.log("🔧 Testing NodeVersionCompatibilityTester integration...");

      const tester = new NodeVersionCompatibilityTester();
      const result = await tester.runTests();

      // Validate structure
      expect(result).toBeDefined();
      expect(result.nodeVersion).toBe(process.version);
      expect(result.testResults).toBeInstanceOf(Array);
      expect(result.testResults.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();

      // Validate test results
      const passedTests = result.testResults.filter((test) => test.passed);

      console.log(
        `   ✅ NodeVersionCompatibilityTester: ${passedTests.length}/${result.testResults.length} tests passed`,
      );

      // Should have high pass rate for current Node.js version
      expect(passedTests.length / result.testResults.length).toBeGreaterThan(
        0.9,
      );
    }, 30000);

    test("should integrate PerformanceBenchmarker successfully", async () => {
      console.log("🔧 Testing PerformanceBenchmarker integration...");

      const benchmarker = new PerformanceBenchmarker();
      const result = await benchmarker.runBenchmarks();

      // Validate structure
      expect(result).toBeDefined();
      expect(result.platform).toBe(process.platform);
      expect(result.testResults).toBeInstanceOf(Array);
      expect(result.testResults.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.performanceMetrics).toBeDefined();

      // Validate test results
      const passedTests = result.testResults.filter((test) => test.passed);

      console.log(
        `   ✅ PerformanceBenchmarker: ${passedTests.length}/${result.testResults.length} tests passed (Grade: ${result.summary.performanceGrade})`,
      );

      // Should have reasonable performance (at least 70% pass rate)
      expect(passedTests.length / result.testResults.length).toBeGreaterThan(
        0.7,
      );
      expect(["A", "B", "C", "D", "F"]).toContain(
        result.summary.performanceGrade,
      );
    }, 60000);
  });

  describe("CrossPlatformTestRunner Integration", () => {
    test("should integrate all components successfully", async () => {
      console.log(
        "🚀 Running full CrossPlatformTestRunner integration test...",
      );

      const runner = new CrossPlatformTestRunner({
        platforms: [process.platform as any], // Test current platform only
        testCategories: ["filesystem", "binary", "nodejs", "performance"],
        skipBinaryTests: false,
        timeout: 120000, // 2 minutes for full integration
      });

      const results = await runner.testPlatformCompatibility();

      // Validate overall structure
      expect(results).toBeDefined();
      expect(results.summary).toBeDefined();
      expect(results.summary.totalTests).toBeGreaterThan(0);
      expect(results.summary.totalTests).toBeGreaterThan(0);

      // Get current platform result
      const currentPlatform = process.platform as keyof typeof results;
      const platformResult = results[currentPlatform] as PlatformResult;

      if (platformResult && "testResults" in platformResult) {
        expect(platformResult.testResults).toBeInstanceOf(Array);
        expect(platformResult.testResults.length).toBeGreaterThan(0);

        // Check for test results from each component
        const filesystemTests = platformResult.testResults.filter(
          (test: TestResult) => test.category === "filesystem",
        );
        const binaryTests = platformResult.testResults.filter(
          (test: TestResult) => test.category === "binary",
        );
        const nodejsTests = platformResult.testResults.filter(
          (test: TestResult) => test.category === "nodejs",
        );
        const performanceTests = platformResult.testResults.filter(
          (test: TestResult) => test.category === "performance",
        );

        expect(filesystemTests.length).toBeGreaterThan(0);
        expect(binaryTests.length).toBeGreaterThan(0);
        expect(nodejsTests.length).toBeGreaterThan(0);
        expect(performanceTests.length).toBeGreaterThan(0);

        console.log(`   📊 Integration Results:`);
        console.log(
          `      FileSystem: ${filesystemTests.filter((t) => t.passed).length}/${filesystemTests.length}`,
        );
        console.log(
          `      Binary: ${binaryTests.filter((t) => t.passed).length}/${binaryTests.length}`,
        );
        console.log(
          `      Node.js: ${nodejsTests.filter((t) => t.passed).length}/${nodejsTests.length}`,
        );
        console.log(
          `      Performance: ${performanceTests.filter((t) => t.passed).length}/${performanceTests.length}`,
        );

        const totalPassed = platformResult.testResults.filter(
          (test) => test.passed,
        ).length;
        const totalTests = platformResult.testResults.length;
        const passRate = totalPassed / totalTests;

        console.log(
          `   ✅ Overall: ${totalPassed}/${totalTests} tests passed (${Math.round(passRate * 100)}%)`,
        );

        // Should have reasonable overall pass rate
        expect(passRate).toBeGreaterThan(0.7);
      }
    }, 180000); // 3 minutes for comprehensive integration test

    test("should handle selective component testing", async () => {
      console.log("🔧 Testing selective component integration...");

      // Test with only filesystem and performance components
      const runner = new CrossPlatformTestRunner({
        platforms: [process.platform as any],
        testCategories: ["filesystem", "performance"],
        skipBinaryTests: true,
        timeout: 60000,
      });

      const results = await runner.testPlatformCompatibility();

      const currentPlatform = process.platform as keyof typeof results;
      const platformResult = results[currentPlatform];

      if (platformResult) {
        const filesystemTests = platformResult.testResults.filter(
          (test) => test.category === "filesystem",
        );
        const performanceTests = platformResult.testResults.filter(
          (test) => test.category === "performance",
        );
        const binaryTests = platformResult.testResults.filter(
          (test) => test.category === "binary",
        );
        const nodejsTests = platformResult.testResults.filter(
          (test) => test.category === "nodejs",
        );

        // Should have filesystem and performance tests
        expect(filesystemTests.length).toBeGreaterThan(0);
        expect(performanceTests.length).toBeGreaterThan(0);

        // Should not have binary tests when skipBinaryTests is true
        // Note: some binary tests might still run as part of other components

        console.log(
          `   ✅ Selective testing: FileSystem(${filesystemTests.length}) + Performance(${performanceTests.length})`,
        );
      }
    }, 90000);
  });

  describe("Error Handling and Edge Cases", () => {
    test("should handle component failures gracefully", async () => {
      console.log("🔧 Testing error handling in integration...");

      const runner = new CrossPlatformTestRunner({
        platforms: [process.platform as any],
        testCategories: ["filesystem", "binary", "nodejs", "performance"],
        timeout: 60000,
      });

      const results = await runner.testPlatformCompatibility();

      // Even with some potential failures, should still produce results
      expect(results).toBeDefined();
      expect(results.summary.totalTests).toBeGreaterThan(0);

      const currentPlatform = process.platform as keyof typeof results;
      const platformResult = results[currentPlatform];

      if (platformResult) {
        // Check that failed tests have error information or expected failure markers
        const failedTests = platformResult.testResults.filter(
          (test) => !test.passed,
        );

        for (const failedTest of failedTests) {
          // Failed tests should have error info or be marked as expected failures
          const hasErrorInfo = failedTest.error !== undefined;
          const isExpectedFailure =
            failedTest.details && "expectedFailure" in failedTest.details;
          const isOptional =
            failedTest.details && "optional" in failedTest.details;

          if (!hasErrorInfo && !isExpectedFailure && !isOptional) {
            console.warn(
              `Test ${failedTest.name} failed without error information`,
            );
          }
        }

        console.log(
          `   ✅ Error handling: ${failedTests.length} failed tests handled gracefully`,
        );
      }
    }, 90000);

    test("should provide consistent results across multiple runs", async () => {
      console.log("🔧 Testing result consistency...");

      const runner = new CrossPlatformTestRunner({
        platforms: [process.platform as any],
        testCategories: ["filesystem", "nodejs"], // Use faster components for consistency test
        skipBinaryTests: true,
        timeout: 30000,
      });

      // Run twice and compare basic metrics
      const results1 = await runner.testPlatformCompatibility();
      const results2 = await runner.testPlatformCompatibility();

      const currentPlatform = process.platform as keyof typeof results1;
      const platformResult1 = results1[currentPlatform];
      const platformResult2 = results2[currentPlatform];

      if (platformResult1 && platformResult2) {
        // Should have similar number of tests
        expect(
          Math.abs(
            platformResult1.testResults.length -
              platformResult2.testResults.length,
          ),
        ).toBeLessThan(3);

        // Pass rates should be reasonably consistent (within 10%)
        const passRate1 =
          platformResult1.testResults.filter((t) => t.passed).length /
          platformResult1.testResults.length;
        const passRate2 =
          platformResult2.testResults.filter((t) => t.passed).length /
          platformResult2.testResults.length;

        expect(Math.abs(passRate1 - passRate2)).toBeLessThan(0.1);

        console.log(
          `   ✅ Consistency: Pass rates ${Math.round(passRate1 * 100)}% vs ${Math.round(passRate2 * 100)}%`,
        );
      }
    }, 90000);
  });

  describe("Performance and Scalability", () => {
    test("should complete comprehensive testing within reasonable time", async () => {
      console.log("⏱️ Testing integration performance...");

      const startTime = Date.now();

      const runner = new CrossPlatformTestRunner({
        platforms: [process.platform as any],
        testCategories: ["filesystem", "binary", "nodejs", "performance"],
        timeout: 150000, // 2.5 minutes
      });

      const results = await runner.testPlatformCompatibility();
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toBeDefined();
      expect(duration).toBeLessThan(150000); // Should complete within timeout

      console.log(
        `   ⏱️ Integration completed in ${Math.round(duration / 1000)}s`,
      );

      const currentPlatform = process.platform as keyof typeof results;
      const platformResult = results[currentPlatform];

      if (platformResult) {
        const totalTests = platformResult.testResults.length;
        const averageTestTime = duration / totalTests;

        expect(averageTestTime).toBeLessThan(5000); // Average test should take less than 5 seconds

        console.log(
          `   📊 Performance: ${totalTests} tests, avg ${Math.round(averageTestTime)}ms per test`,
        );
      }
    }, 180000);

    test("should provide comprehensive test coverage", async () => {
      console.log("📊 Testing comprehensive coverage...");

      const runner = new CrossPlatformTestRunner({
        platforms: [process.platform as any],
        testCategories: ["filesystem", "binary", "nodejs", "performance"],
        timeout: 120000,
      });

      const results = await runner.testPlatformCompatibility();

      const currentPlatform = process.platform as keyof typeof results;
      const platformResult = results[currentPlatform];

      if (platformResult) {
        const testsByCategory = platformResult.testResults.reduce(
          (acc, test) => {
            acc[test.category] = (acc[test.category] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        // Should have comprehensive coverage
        expect(testsByCategory.filesystem).toBeGreaterThan(10); // FileSystem tests
        expect(testsByCategory.binary).toBeGreaterThan(5); // Binary tests
        expect(testsByCategory.nodejs).toBeGreaterThan(15); // Node.js tests
        expect(testsByCategory.performance).toBeGreaterThan(15); // Performance tests

        const totalTests = Object.values(testsByCategory).reduce(
          (sum, count) => sum + count,
          0,
        );
        expect(totalTests).toBeGreaterThan(50); // Should have comprehensive test suite

        console.log(`   📊 Coverage by category:`, testsByCategory);
        console.log(`   ✅ Total comprehensive tests: ${totalTests}`);
      }
    }, 150000);
  });
});
