/**
 * Integration test for CrossPlatformTestRunner with FileSystemTester
 */

import { describe, it, expect } from "vitest";
import { CrossPlatformTestRunner } from "./CrossPlatformTestRunner";
import type { TestCategory } from "./types";

describe("CrossPlatformTestRunner Integration", () => {
  it("should successfully integrate FileSystemTester", async () => {
    const config = {
      targetPlatforms: [process.platform],
      nodeVersions: ["18.x", "20.x", "22.x"],
      testCategories: ["filesystem" as TestCategory],
      skipBinaryTests: true,
      testTimeout: 120000,
    };

    const testRunner = new CrossPlatformTestRunner(config);

    // Test that FileSystemTester integration works
    const result = await testRunner.testFileSystemCompatibility();

    expect(result).toBeDefined();
    expect(result.platform).toBe(process.platform);
    expect(result.testResults).toBeDefined();
    expect(Array.isArray(result.testResults)).toBe(true);
    expect(result.testResults.length).toBeGreaterThan(0);

    // Verify TestResult structure
    result.testResults.forEach((testResult) => {
      expect(testResult).toHaveProperty("name");
      expect(testResult).toHaveProperty("category");
      expect(testResult).toHaveProperty("passed");
      expect(testResult).toHaveProperty("platform");
      expect(testResult).toHaveProperty("duration");
      expect(typeof testResult.passed).toBe("boolean");
      expect(typeof testResult.duration).toBe("number");
    });

    console.log(
      `✅ FileSystemTester integration successful: ${result.testResults.length} tests executed`,
    );
    console.log(`Platform: ${result.platform}`);
    console.log(
      `Passed tests: ${result.testResults.filter((t) => t.passed).length}`,
    );
    console.log(
      `Failed tests: ${result.testResults.filter((t) => !t.passed).length}`,
    );
  }, 60000);
});
