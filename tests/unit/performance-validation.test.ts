/**
 * @fileoverview Performance validation system tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PerformanceBenchmarkRunner } from "../../packages/ast-helper/src/performance-validation/runner.js";
import {
  DEFAULT_PERFORMANCE_CONFIG,
  DEFAULT_PERFORMANCE_BENCHMARKS,
} from "../../packages/ast-helper/src/performance-validation/config.js";
import {
  validatePerformance,
  quickBenchmark,
} from "../../packages/ast-helper/src/performance-validation/index.js";
import type {
  PerformanceBenchmark,
  PerformanceConfig,
} from "../../packages/ast-helper/src/performance-validation/types.js";

describe("Performance Validation System", () => {
  let runner: PerformanceBenchmarkRunner;

  beforeEach(() => {
    runner = new PerformanceBenchmarkRunner();
  });

  describe("PerformanceBenchmarkRunner", () => {
    it("should initialize with default config", () => {
      const defaultRunner = new PerformanceBenchmarkRunner();
      expect(defaultRunner).toBeInstanceOf(PerformanceBenchmarkRunner);
    });

    it("should run a single benchmark", async () => {
      const benchmark: PerformanceBenchmark = {
        name: "test-benchmark",
        description: "Test benchmark",
        category: "cli",
        target: { value: 1000, unit: "ms", constraint: "max" },
        tolerance: 20,
        critical: true,
      };

      const result = await runner.runBenchmark(benchmark);

      expect(result).toHaveProperty("benchmark", "test-benchmark");
      expect(result).toHaveProperty("passed");
      expect(result).toHaveProperty("measurement");
      expect(result).toHaveProperty("target");
      expect(result).toHaveProperty("deviation");
      expect(result).toHaveProperty("details");
      expect(result.measurement.value).toBeGreaterThan(0);
    });

    it("should run multiple benchmarks", async () => {
      const testBenchmarks: PerformanceBenchmark[] = [
        {
          name: "cli-test-1",
          description: "CLI Test 1",
          category: "cli",
          target: { value: 500, unit: "ms", constraint: "max" },
          tolerance: 30,
          critical: true,
        },
        {
          name: "memory-test-1",
          description: "Memory Test 1",
          category: "memory",
          target: { value: 256, unit: "mb", constraint: "max" },
          tolerance: 25,
          critical: false,
        },
      ];

      const results = await runner.runBenchmarks(testBenchmarks);

      expect(results).toHaveLength(2);
      expect(results[0].benchmark).toBe("cli-test-1");
      expect(results[1].benchmark).toBe("memory-test-1");

      for (const result of results) {
        expect(result).toHaveProperty("passed");
        expect(result).toHaveProperty("measurement");
        expect(result).toHaveProperty("deviation");
      }
    });

    it("should run scalability tests", async () => {
      const scalabilityTest = {
        name: "test-scaling",
        description: "Test scaling behavior",
        workload: {
          type: "file-count" as const,
          startValue: 10,
          endValue: 50,
          stepSize: 20,
          unit: "files",
        },
        expectedBehavior: "linear" as const,
        maxScale: 50,
        metrics: ["parsing-time", "memory-usage"],
      };

      const result = await runner.runScalabilityTest(scalabilityTest);

      expect(result).toHaveProperty("test", "test-scaling");
      expect(result).toHaveProperty("workloadPoints");
      expect(result).toHaveProperty("behavior");
      expect(result).toHaveProperty("maxSupportedScale");
      expect(result).toHaveProperty("recommendations");
      expect(result.workloadPoints.length).toBeGreaterThan(0);
    });

    it("should run memory profiling", async () => {
      const memoryProfile = await runner.runMemoryProfile();

      expect(memoryProfile).toHaveProperty("peak");
      expect(memoryProfile).toHaveProperty("average");
      expect(memoryProfile).toHaveProperty("growth");
      expect(memoryProfile).toHaveProperty("leakDetected");
      expect(memoryProfile).toHaveProperty("gcPressure");
      expect(memoryProfile).toHaveProperty("recommendations");

      expect(memoryProfile.peak).toBeGreaterThan(0);
      expect(memoryProfile.average).toBeGreaterThan(0);
      expect(typeof memoryProfile.leakDetected).toBe("boolean");
      expect(memoryProfile.gcPressure).toBeGreaterThanOrEqual(0);
      expect(memoryProfile.gcPressure).toBeLessThanOrEqual(1);
    });

    it("should run CPU profiling", async () => {
      const cpuProfile = await runner.runCpuProfile();

      expect(cpuProfile).toHaveProperty("averageUsage");
      expect(cpuProfile).toHaveProperty("peakUsage");
      expect(cpuProfile).toHaveProperty("hotspots");
      expect(cpuProfile).toHaveProperty("recommendations");

      expect(cpuProfile.averageUsage).toBeGreaterThanOrEqual(0);
      expect(cpuProfile.peakUsage).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(cpuProfile.hotspots)).toBe(true);
      expect(Array.isArray(cpuProfile.recommendations)).toBe(true);
    });

    it("should run full performance validation", async () => {
      const validation = await runner.validatePerformance();

      expect(validation).toHaveProperty("overall");
      expect(validation).toHaveProperty("categories");
      expect(validation).toHaveProperty("recommendations");
      expect(validation).toHaveProperty("environment");
      expect(validation).toHaveProperty("duration");
      expect(validation).toHaveProperty("timestamp");

      expect(validation.overall).toHaveProperty("passed");
      expect(validation.overall).toHaveProperty("score");
      expect(validation.overall).toHaveProperty("criticalFailures");
      expect(validation.overall).toHaveProperty("totalBenchmarks");

      expect(validation.overall.score).toBeGreaterThanOrEqual(0);
      expect(validation.overall.score).toBeLessThanOrEqual(100);
      expect(validation.overall.totalBenchmarks).toBeGreaterThan(0);
      expect(validation.overall.criticalFailures).toBeGreaterThanOrEqual(0);

      expect(typeof validation.overall.passed).toBe("boolean");
      expect(Array.isArray(validation.recommendations)).toBe(true);
    });
  });

  describe("Performance Configuration", () => {
    it("should have default benchmarks", () => {
      expect(Array.isArray(DEFAULT_PERFORMANCE_BENCHMARKS)).toBe(true);
      expect(DEFAULT_PERFORMANCE_BENCHMARKS.length).toBeGreaterThan(0);

      for (const benchmark of DEFAULT_PERFORMANCE_BENCHMARKS) {
        expect(benchmark).toHaveProperty("name");
        expect(benchmark).toHaveProperty("description");
        expect(benchmark).toHaveProperty("category");
        expect(benchmark).toHaveProperty("target");
        expect(benchmark).toHaveProperty("tolerance");
        expect(benchmark).toHaveProperty("critical");

        expect(typeof benchmark.name).toBe("string");
        expect(typeof benchmark.description).toBe("string");
        expect([
          "cli",
          "mcp-server",
          "vscode-extension",
          "memory",
          "disk-io",
          "network",
        ]).toContain(benchmark.category);
        expect(typeof benchmark.tolerance).toBe("number");
        expect(typeof benchmark.critical).toBe("boolean");
      }
    });

    it("should have default configuration", () => {
      expect(DEFAULT_PERFORMANCE_CONFIG).toHaveProperty("benchmarks");
      expect(DEFAULT_PERFORMANCE_CONFIG).toHaveProperty("scalabilityTests");
      expect(DEFAULT_PERFORMANCE_CONFIG).toHaveProperty("environments");
      expect(DEFAULT_PERFORMANCE_CONFIG).toHaveProperty("reporting");
      expect(DEFAULT_PERFORMANCE_CONFIG).toHaveProperty("thresholds");

      expect(Array.isArray(DEFAULT_PERFORMANCE_CONFIG.benchmarks)).toBe(true);
      expect(Array.isArray(DEFAULT_PERFORMANCE_CONFIG.scalabilityTests)).toBe(
        true,
      );
      expect(typeof DEFAULT_PERFORMANCE_CONFIG.environments).toBe("object");
      expect(typeof DEFAULT_PERFORMANCE_CONFIG.reporting).toBe("object");
      expect(typeof DEFAULT_PERFORMANCE_CONFIG.thresholds).toBe("object");
    });

    it("should allow custom configuration", () => {
      const customConfig: Partial<PerformanceConfig> = {
        thresholds: {
          warningPercentage: 90,
          criticalPercentage: 110,
          minSuccessRate: 85,
        },
      };

      const customRunner = new PerformanceBenchmarkRunner({
        ...DEFAULT_PERFORMANCE_CONFIG,
        ...customConfig,
      });

      expect(customRunner).toBeInstanceOf(PerformanceBenchmarkRunner);
    });
  });

  describe("Benchmark Categories", () => {
    it("should test CLI performance benchmarks", async () => {
      const cliBenchmarks = DEFAULT_PERFORMANCE_BENCHMARKS.filter(
        (b) => b.category === "cli",
      );
      expect(cliBenchmarks.length).toBeGreaterThan(0);

      const results = await runner.runBenchmarks(cliBenchmarks.slice(0, 2)); // Test first 2 to avoid long test times

      for (const result of results) {
        expect(result.measurement.value).toBeGreaterThan(0);
        expect(["ms", "mb"].includes(result.measurement.unit)).toBe(true);
      }
    });

    it("should test MCP server performance benchmarks", async () => {
      const mcpBenchmarks = DEFAULT_PERFORMANCE_BENCHMARKS.filter(
        (b) => b.category === "mcp-server",
      );
      expect(mcpBenchmarks.length).toBeGreaterThan(0);

      const results = await runner.runBenchmarks(mcpBenchmarks.slice(0, 2)); // Test first 2

      for (const result of results) {
        expect(result.measurement.value).toBeGreaterThan(0);
        expect(
          ["ms", "connections", "mb"].includes(result.measurement.unit),
        ).toBe(true);
      }
    });

    it("should test memory benchmarks", async () => {
      const memoryBenchmarks = DEFAULT_PERFORMANCE_BENCHMARKS.filter(
        (b) => b.category === "memory",
      );
      expect(memoryBenchmarks.length).toBeGreaterThan(0);

      const results = await runner.runBenchmarks(memoryBenchmarks.slice(0, 1)); // Test first one

      for (const result of results) {
        expect(result.measurement.value).toBeGreaterThan(0);
        expect(result.measurement.unit).toBe("mb");
      }
    });
  });

  describe("Benchmark Evaluation", () => {
    it("should correctly evaluate passing benchmarks", async () => {
      const passingBenchmark: PerformanceBenchmark = {
        name: "passing-test",
        description: "Should pass",
        category: "cli",
        target: { value: 10000, unit: "ms", constraint: "max" }, // Very generous target
        tolerance: 50,
        critical: true,
      };

      const result = await runner.runBenchmark(passingBenchmark);
      expect(result.passed).toBe(true);
      expect(Math.abs(result.deviation)).toBeLessThanOrEqual(
        passingBenchmark.tolerance,
      );
    });

    it("should correctly evaluate failing benchmarks", async () => {
      const failingBenchmark: PerformanceBenchmark = {
        name: "failing-test",
        description: "Should fail",
        category: "cli",
        target: { value: 1, unit: "ms", constraint: "max" }, // Impossible target
        tolerance: 5,
        critical: true,
      };

      const result = await runner.runBenchmark(failingBenchmark);
      expect(result.passed).toBe(false);
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });
  });

  describe("Integration Functions", () => {
    it("should validate performance with default config", async () => {
      const result = await validatePerformance();

      expect(result).toHaveProperty("overall");
      expect(result).toHaveProperty("categories");
      expect(result).toHaveProperty("recommendations");
      expect(result.overall.totalBenchmarks).toBeGreaterThan(0);
    });

    it("should run quick benchmark", async () => {
      const benchmarkName = DEFAULT_PERFORMANCE_BENCHMARKS[0].name;
      const result = await quickBenchmark(benchmarkName);

      expect(result.benchmark).toBe(benchmarkName);
      expect(result).toHaveProperty("measurement");
      expect(result).toHaveProperty("passed");
    });

    it("should throw error for unknown benchmark", async () => {
      await expect(quickBenchmark("non-existent-benchmark")).rejects.toThrow();
    });
  });

  describe("Event Emission", () => {
    it("should emit events during benchmark execution", async () => {
      const events: string[] = [];

      runner.on("benchmark-start", () => events.push("start"));
      runner.on("benchmark-complete", () => events.push("complete"));
      runner.on("benchmarks-start", () => events.push("benchmarks-start"));
      runner.on("benchmarks-complete", () =>
        events.push("benchmarks-complete"),
      );

      const testBenchmark: PerformanceBenchmark = {
        name: "event-test",
        description: "Event test",
        category: "cli",
        target: { value: 1000, unit: "ms", constraint: "max" },
        tolerance: 20,
        critical: true,
      };

      await runner.runBenchmarks([testBenchmark]);

      expect(events).toContain("benchmarks-start");
      expect(events).toContain("start");
      expect(events).toContain("complete");
      expect(events).toContain("benchmarks-complete");
    });
  });

  describe("Performance Targets", () => {
    it("should have reasonable production targets", () => {
      const cliBenchmarks = DEFAULT_PERFORMANCE_BENCHMARKS.filter(
        (b) => b.category === "cli",
      );
      const mcpBenchmarks = DEFAULT_PERFORMANCE_BENCHMARKS.filter(
        (b) => b.category === "mcp-server",
      );

      // CLI targets should be reasonable for production use
      const cliStartupBenchmark = cliBenchmarks.find(
        (b) => b.name === "cli-startup-time",
      );
      if (cliStartupBenchmark) {
        expect(cliStartupBenchmark.target.value).toBeLessThanOrEqual(1000); // 1 second max
        expect(cliStartupBenchmark.critical).toBe(true);
      }

      // MCP server targets should be reasonable for API responses
      const mcpQueryBenchmark = mcpBenchmarks.find(
        (b) => b.name === "mcp-query-response",
      );
      if (mcpQueryBenchmark) {
        expect(mcpQueryBenchmark.target.value).toBeLessThanOrEqual(500); // 500ms max
        expect(mcpQueryBenchmark.critical).toBe(true);
      }
    });
  });
});
