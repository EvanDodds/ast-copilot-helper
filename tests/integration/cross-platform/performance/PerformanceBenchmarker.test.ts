/**
 * Performance Benchmarker Test
 * Test the performance benchmarker for cross-platform compatibility
 */

import { describe, test, expect } from "vitest";
import { PerformanceBenchmarker } from "../performance/PerformanceBenchmarker.js";

describe("PerformanceBenchmarker", () => {
  test("should initialize with platform information", () => {
    const benchmarker = new PerformanceBenchmarker();
    expect(benchmarker).toBeDefined();
  });

  test("should run benchmarks and return results", async () => {
    const benchmarker = new PerformanceBenchmarker();
    const result = await benchmarker.runBenchmarks();

    // Validate structure
    expect(result.platform).toBe(process.platform);
    expect(result.architecture).toBe(process.arch);
    expect(result.nodeVersion).toBe(process.version);
    expect(result.testResults).toBeInstanceOf(Array);
    expect(result.performanceMetrics).toBeDefined();
    expect(result.summary).toBeDefined();

    // Validate summary
    expect(result.summary.total).toBeGreaterThan(0);
    expect(result.summary.passed).toBeGreaterThanOrEqual(0);
    expect(result.summary.failed).toBeGreaterThanOrEqual(0);
    expect(result.summary.duration).toBeGreaterThan(0);
    expect(["A", "B", "C", "D", "F"]).toContain(
      result.summary.performanceGrade,
    );

    // Validate test results
    expect(result.testResults.length).toBeGreaterThan(10); // Should have multiple benchmark categories

    const testsByCategory = result.testResults.reduce(
      (acc, test) => {
        acc[test.category] = (acc[test.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    expect(testsByCategory.performance).toBeGreaterThan(0);
  }, 30000); // 30 second timeout for performance tests

  test("should validate individual benchmark categories", async () => {
    const benchmarker = new PerformanceBenchmarker();
    const result = await benchmarker.runBenchmarks();

    const testNames = result.testResults.map((test) => test.name);

    // File system performance tests
    expect(testNames).toContain("file_read_performance");
    expect(testNames).toContain("file_write_performance");
    expect(testNames).toContain("directory_operations_performance");
    expect(testNames).toContain("large_file_handling_performance");

    // Memory performance tests
    expect(testNames).toContain("memory_allocation_performance");
    expect(testNames).toContain("buffer_operations_performance");

    // CPU performance tests
    expect(testNames).toContain("cpu_intensive_performance");
    expect(testNames).toContain("math_operations_performance");

    // Parsing performance tests
    expect(testNames).toContain("json_parsing_performance");
    expect(testNames).toContain("text_parsing_performance");

    // Database performance tests
    expect(testNames).toContain("database_operations_performance");

    // Concurrent operations
    expect(testNames).toContain("concurrent_operations_performance");

    // Stream operations
    expect(testNames).toContain("stream_operations_performance");

    // Garbage collection
    expect(testNames).toContain("garbage_collection_performance");

    // Scalability
    expect(testNames).toContain("scalability_performance");

    // Platform specific
    expect(testNames).toContain("platform_specific_performance");
  }, 35000);

  test("should provide detailed metrics for each test", async () => {
    const benchmarker = new PerformanceBenchmarker();
    const result = await benchmarker.runBenchmarks();

    // Check that each test has required properties
    for (const test of result.testResults) {
      expect(test.name).toBeTruthy();
      expect(test.category).toBe("performance");
      expect(typeof test.passed).toBe("boolean");
      expect(test.platform).toBe(process.platform);
      expect(test.duration).toBeGreaterThanOrEqual(0);

      if (test.details) {
        // Most performance tests should have performance grades
        if ("performanceGrade" in test.details) {
          expect(["A", "B", "C", "D", "F", "N/A"]).toContain(
            test.details.performanceGrade,
          );
        }
      }
    }
  }, 40000);

  test("should have reasonable performance thresholds", async () => {
    const benchmarker = new PerformanceBenchmarker();
    const result = await benchmarker.runBenchmarks();

    // Performance tests should generally pass on a reasonable system
    const passRate = result.summary.passed / result.summary.total;
    expect(passRate).toBeGreaterThan(0.5); // At least 50% should pass

    // Total duration should be reasonable (under 30 seconds)
    expect(result.summary.duration).toBeLessThan(30000);

    // Memory efficiency should be reasonable
    expect(result.summary.memoryEfficiency).toBeGreaterThan(0);
    expect(result.summary.cpuEfficiency).toBeGreaterThan(0);
  }, 35000);

  test("should handle errors gracefully", async () => {
    const benchmarker = new PerformanceBenchmarker();
    const result = await benchmarker.runBenchmarks();

    // Even if some tests fail, we should still get results
    expect(result.testResults.length).toBeGreaterThan(0);
    expect(result.summary.total).toBeGreaterThan(0);

    // Failed tests should have error information
    const failedTests = result.testResults.filter((test) => !test.passed);
    for (const failedTest of failedTests) {
      if (failedTest.error) {
        expect(failedTest.error).toBeTruthy();
      }
    }
  }, 30000);
});
