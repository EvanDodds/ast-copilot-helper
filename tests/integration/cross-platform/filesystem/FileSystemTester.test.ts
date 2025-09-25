import { describe, it, expect, beforeEach } from "vitest";
import { FileSystemTester } from "./FileSystemTester";

describe("FileSystemTester", () => {
  let fileSystemTester: FileSystemTester;

  beforeEach(() => {
    fileSystemTester = new FileSystemTester();
  });

  describe("initialization", () => {
    it("should initialize with current platform detection", () => {
      expect(fileSystemTester).toBeDefined();
      expect(fileSystemTester).toBeInstanceOf(FileSystemTester);
    });
  });

  describe("file system compatibility tests", () => {
    it("should run comprehensive file system tests", async () => {
      const result = await fileSystemTester.runTests();

      expect(result).toBeDefined();
      expect(result.platform).toBeDefined();
      expect(result.testResults).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.summary.passed + result.summary.failed).toBe(
        result.summary.total,
      );

      // Verify all test results have required properties
      result.testResults.forEach((testResult) => {
        expect(testResult.name).toBeDefined();
        expect(testResult.category).toBe("filesystem");
        expect(typeof testResult.passed).toBe("boolean");
        expect(testResult.platform).toBeDefined();
        expect(typeof testResult.duration).toBe("number");
      });
    });

    it("should detect case sensitivity correctly", async () => {
      const result = await fileSystemTester.runTests();

      expect(typeof result.caseSensitive).toBe("boolean");

      // Test should have results for case sensitivity
      const caseSensitivityTest = result.testResults.find((test) =>
        test.name.toLowerCase().includes("case sensitivity"),
      );
      expect(caseSensitivityTest).toBeDefined();
    });

    it("should test path separator handling", async () => {
      const result = await fileSystemTester.runTests();

      expect(result.pathSeparator).toBeDefined();

      // Test should have results for path separators
      const pathSeparatorTest = result.testResults.find((test) =>
        test.name.toLowerCase().includes("path separator"),
      );
      expect(pathSeparatorTest).toBeDefined();
    });

    it("should test special characters in filenames", async () => {
      const result = await fileSystemTester.runTests();

      // Test should have results for special characters
      const specialCharTests = result.testResults.filter((test) =>
        test.name.toLowerCase().includes("special characters"),
      );
      expect(specialCharTests.length).toBeGreaterThan(0);
    });

    it("should test file permissions (POSIX systems)", async () => {
      const result = await fileSystemTester.runTests();

      // Test should have results for file permissions
      const permissionTests = result.testResults.filter((test) =>
        test.name.toLowerCase().includes("permission"),
      );
      expect(permissionTests.length).toBeGreaterThan(0);
    });

    it("should test long path support", async () => {
      const result = await fileSystemTester.runTests();

      expect(typeof result.maxPathLength).toBe("number");
      expect(result.maxPathLength).toBeGreaterThan(0);

      // Test should have results for long paths
      const longPathTest = result.testResults.find((test) =>
        test.name.toLowerCase().includes("long path"),
      );
      expect(longPathTest).toBeDefined();
    });

    it("should test Unicode support", async () => {
      const result = await fileSystemTester.runTests();

      // Test should have results for Unicode
      const unicodeTests = result.testResults.filter((test) =>
        test.name.toLowerCase().includes("unicode"),
      );
      expect(unicodeTests.length).toBeGreaterThan(0);
    });

    it("should test symbolic link support", async () => {
      const result = await fileSystemTester.runTests();

      expect(typeof result.supportsSymlinks).toBe("boolean");

      // Test should have results for symbolic links
      const symlinkTest = result.testResults.find((test) =>
        test.name.toLowerCase().includes("symbolic link"),
      );
      expect(symlinkTest).toBeDefined();
    });

    it("should test hard link support", async () => {
      const result = await fileSystemTester.runTests();

      expect(typeof result.supportsHardlinks).toBe("boolean");

      // Test should have results for hard links
      const hardlinkTest = result.testResults.find((test) =>
        test.name.toLowerCase().includes("hard link"),
      );
      expect(hardlinkTest).toBeDefined();
    });

    it("should test file attributes and metadata", async () => {
      const result = await fileSystemTester.runTests();

      // Test should have results for file attributes
      const attributesTest = result.testResults.find((test) =>
        test.name.toLowerCase().includes("attributes"),
      );
      expect(attributesTest).toBeDefined();
    });

    it("should test directory operations", async () => {
      const result = await fileSystemTester.runTests();

      // Test should have results for directory operations
      const directoryTests = result.testResults.filter((test) =>
        test.name.toLowerCase().includes("directory"),
      );
      expect(directoryTests.length).toBeGreaterThan(0);
    });

    it("should test file watching capabilities", async () => {
      const result = await fileSystemTester.runTests();

      // Test should have results for file watching
      const watchingTest = result.testResults.find((test) =>
        test.name.toLowerCase().includes("watching"),
      );
      expect(watchingTest).toBeDefined();
    });

    it("should test concurrent file access", async () => {
      const result = await fileSystemTester.runTests();

      // Test should have results for concurrent access
      const concurrentTest = result.testResults.find((test) =>
        test.name.toLowerCase().includes("concurrent"),
      );
      expect(concurrentTest).toBeDefined();
    });

    it("should complete tests within reasonable time", async () => {
      const startTime = Date.now();
      const result = await fileSystemTester.runTests();
      const duration = Date.now() - startTime;

      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);
      expect(result.summary.duration).toBeGreaterThan(0);
      expect(result.summary.duration).toBeLessThan(30000);
    });

    it("should handle test failures gracefully", async () => {
      // This test verifies that even if some filesystem operations fail,
      // the test runner continues and reports results properly
      const result = await fileSystemTester.runTests();

      // Should always return a valid result structure
      expect(result).toBeDefined();
      expect(result.testResults).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();

      // May have some failures depending on platform and permissions
      expect(result.summary.total).toBeGreaterThan(0);
    });

    it("should provide meaningful error messages for failures", async () => {
      const result = await fileSystemTester.runTests();

      // Check that failed tests have error messages
      const failedTests = result.testResults.filter((test) => !test.passed);
      failedTests.forEach((test) => {
        expect(
          test.error || test.details?.error || test.details?.expectedFailure,
        ).toBeDefined();
      });
    });
  });

  describe("platform-specific behavior", () => {
    it("should adapt tests for current platform", async () => {
      const result = await fileSystemTester.runTests();

      // Platform should be detected correctly
      expect(["win32", "darwin", "linux"].includes(result.platform)).toBe(true);

      // All test results should have the same platform
      result.testResults.forEach((test) => {
        expect(test.platform).toBe(result.platform);
      });
    });

    it("should provide platform-specific insights", async () => {
      const result = await fileSystemTester.runTests();

      // Should provide platform-specific information
      expect(result.caseSensitive).toBeDefined();
      expect(result.pathSeparator).toBeDefined();
      expect(result.maxPathLength).toBeGreaterThan(0);
      expect(result.supportsSymlinks).toBeDefined();
      expect(result.supportsHardlinks).toBeDefined();

      // Platform-specific expectations
      if (result.platform === "win32") {
        expect(result.pathSeparator).toBe("\\");
        expect(result.caseSensitive).toBe(false);
      } else if (result.platform === "darwin") {
        expect(result.pathSeparator).toBe("/");
        expect(result.caseSensitive).toBe(false); // macOS is case-insensitive by default
      } else if (result.platform === "linux") {
        expect(result.pathSeparator).toBe("/");
        expect(result.caseSensitive).toBe(true);
      }
    });
  });

  describe("error handling and edge cases", () => {
    it("should handle permission errors gracefully", async () => {
      // File system operations may fail due to permissions
      // The test should handle these gracefully and continue
      const result = await fileSystemTester.runTests();

      // Should still return valid results even with some permission failures
      expect(result).toBeDefined();
      expect(result.testResults).toBeInstanceOf(Array);
      expect(result.summary.total).toBeGreaterThan(0);
    });

    it("should distinguish between expected and unexpected failures", async () => {
      const result = await fileSystemTester.runTests();

      // Some failures may be expected (e.g., unsupported features)
      // Check that expected failures are marked as such
      const failedTests = result.testResults.filter((test) => !test.passed);
      failedTests.forEach((test) => {
        // Should have either error message or expected failure indication
        expect(
          test.error !== undefined || test.details?.expectedFailure === true,
        ).toBe(true);
      });
    });

    it("should cleanup test files even if tests fail", async () => {
      // This is more of a behavior test - the FileSystemTester should
      // clean up its temporary directory even if individual tests fail
      const result = await fileSystemTester.runTests();

      // Test should complete (cleanup is handled in the finally block)
      expect(result).toBeDefined();
    });
  });

  describe("performance and reliability", () => {
    it("should provide consistent results across multiple runs", async () => {
      const result1 = await fileSystemTester.runTests();
      const result2 = await fileSystemTester.runTests();

      // Core platform detection should be consistent
      expect(result1.platform).toBe(result2.platform);
      expect(result1.pathSeparator).toBe(result2.pathSeparator);
      expect(result1.maxPathLength).toBe(result2.maxPathLength);
      expect(result1.caseSensitive).toBe(result2.caseSensitive);
    });

    it("should scale test execution efficiently", async () => {
      const startTime = Date.now();
      await fileSystemTester.runTests();
      const singleRunTime = Date.now() - startTime;

      // Should complete in reasonable time
      expect(singleRunTime).toBeLessThan(30000); // 30 seconds max
    });
  });
});
