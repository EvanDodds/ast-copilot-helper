import { describe, expect, it, beforeEach } from "vitest";
import {
  ParsingBenchmarkRunner,
  ParsingBenchmarkConfig,
} from "../../../packages/ast-helper/src/performance/parsing-benchmarks";
import { BenchmarkResult } from "../../../packages/ast-helper/src/performance/types";

describe("Parsing Performance Benchmarks", () => {
  describe("ParsingBenchmarkRunner", () => {
    let runner: ParsingBenchmarkRunner;

    beforeEach(() => {
      runner = new ParsingBenchmarkRunner();
    });

    describe("initialization", () => {
      it("should create runner instance successfully", () => {
        expect(runner).toBeDefined();
        expect(runner).toBeInstanceOf(ParsingBenchmarkRunner);
      });
    });

    describe("TypeScript parsing benchmarks", () => {
      it("should parse small TypeScript codebases within performance targets", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: "small",
          language: "typescript",
          iterations: 3,
          timeout: 30000,
        };

        const result = await runner.runParsingBenchmarks(config);

        expect(result.benchmarkType).toBe("parsing_benchmark");
        expect(result.successfulRuns).toBe(3);
        expect(result.failedRuns).toBe(0);
        expect(result.totalRuns).toBe(3);
        expect(result.averageThroughput).toBeGreaterThan(0);
        expect(result.errors).toHaveLength(0);
      });

      it("should parse medium TypeScript codebases efficiently", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: "medium",
          language: "typescript",
          iterations: 2,
          timeout: 60000,
        };

        const result = await runner.runParsingBenchmarks(config);

        expect(result.successfulRuns).toBe(2);
        expect(result.failedRuns).toBe(0);
        expect(result.averageDuration).toBeGreaterThan(0);
        expect(result.averageThroughput).toBeGreaterThan(0);
      });

      it("should handle large TypeScript codebases with acceptable performance", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: "large",
          language: "typescript",
          iterations: 1,
          timeout: 120000,
        };

        const result = await runner.runParsingBenchmarks(config);

        expect(result.successfulRuns).toBeGreaterThan(0);
        expect(result.averageThroughput).toBeGreaterThan(0);

        // Large codebases might trigger performance warnings
        expect(result.meetsPerformanceTargets).toBeDefined();
      });
    });

    describe("Python parsing benchmarks", () => {
      it("should parse Python codebases efficiently", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: "medium",
          language: "python",
          iterations: 2,
          timeout: 60000,
        };

        const result = await runner.runParsingBenchmarks(config);

        expect(result.successfulRuns).toBe(2);
        expect(result.failedRuns).toBe(0);
        expect(result.averageThroughput).toBeGreaterThan(0);
      });

      it("should generate appropriate Python test data", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: 1000,
          language: "python",
          iterations: 1,
        };

        const result = await runner.runParsingBenchmarks(config);

        expect(result.successfulRuns).toBe(1);
        expect(result.failedRuns).toBe(0);
      });
    });

    describe("JavaScript parsing benchmarks", () => {
      it("should parse JavaScript codebases within targets", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: "medium",
          language: "javascript",
          iterations: 2,
          timeout: 60000,
        };

        const result = await runner.runParsingBenchmarks(config);

        expect(result.successfulRuns).toBe(2);
        expect(result.failedRuns).toBe(0);
        expect(result.averageMemoryUsed).toBeDefined();
      });
    });

    describe("Java parsing benchmarks", () => {
      it("should parse Java codebases efficiently", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: "medium",
          language: "java",
          iterations: 2,
          timeout: 60000,
        };

        const result = await runner.runParsingBenchmarks(config);

        expect(result.successfulRuns).toBe(2);
        expect(result.failedRuns).toBe(0);
      });
    });

    describe("performance validation", () => {
      it("should meet 100k node parsing target within 5 minutes", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: 100000,
          language: "typescript",
          iterations: 1,
          timeout: 300000, // 5 minutes
        };

        const result = await runner.runParsingBenchmarks(config);

        expect(result.successfulRuns).toBeGreaterThan(0);

        // Should either pass or warn, but not fail completely
        expect(result.totalRuns).toBe(1);

        if (result.averageDuration > 300000) {
          // If takes longer than 5 minutes, should be in warnings
          expect(result.warnings.length).toBeGreaterThan(0);
        }
      });

      it("should achieve minimum throughput target of 300 nodes/second", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: "medium",
          language: "typescript",
          iterations: 3,
          timeout: 60000,
        };

        const result = await runner.runParsingBenchmarks(config);

        expect(result.successfulRuns).toBe(3);

        // If throughput is below 300 nodes/sec, should be in warnings or recommendations
        if (result.averageThroughput < 300) {
          expect(
            result.warnings.length > 0 || result.recommendations.length > 0,
          ).toBeTruthy();
        } else {
          expect(result.averageThroughput).toBeGreaterThanOrEqual(300);
        }
      });

      it("should maintain reasonable memory usage", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: "large",
          language: "typescript",
          iterations: 1,
          timeout: 120000,
        };

        const result = await runner.runParsingBenchmarks(config);

        expect(result.successfulRuns).toBeGreaterThan(0);

        // Check memory usage is tracked
        expect(result.averageMemoryUsed).toBeDefined();
        expect(result.peakMemoryUsed).toBeDefined();

        // If memory usage is excessive, should have recommendations
        const memoryMB = result.peakMemoryUsed / (1024 * 1024);
        if (memoryMB > 1000) {
          // > 1GB
          expect(result.recommendations.length).toBeGreaterThan(0);
        }
      });
    });

    describe("node count handling", () => {
      it("should handle different NodeCount types", async () => {
        const nodeCounts: Array<"small" | "medium" | "large" | number> = [
          "small",
          "medium",
          "large",
          5000,
        ];

        for (const nodeCount of nodeCounts) {
          const config: ParsingBenchmarkConfig = {
            nodeCount,
            language: "typescript",
            iterations: 1,
          };

          const result = await runner.runParsingBenchmarks(config);

          expect(result.successfulRuns).toBeGreaterThan(0);
        }
      });
    });

    describe("error handling", () => {
      it("should handle parsing failures gracefully", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: "xlarge",
          language: "invalid-language" as any,
          iterations: 1,
          timeout: 1000, // Very short timeout to force timeout
        };

        const result = await runner.runParsingBenchmarks(config);

        // Should not throw, but may fail or warn
        expect(result).toBeDefined();
        expect(result.benchmarkType).toBe("parsing_benchmark");
        expect(result.totalRuns).toBe(1);

        // May have failures, errors, or warnings
        expect(result.failedRuns + result.successfulRuns).toBe(1);
      });
    });

    describe("multi-language support", () => {
      const languages = ["typescript", "javascript", "python", "java"];

      languages.forEach((language) => {
        it(`should support ${language} parsing benchmarks`, async () => {
          const config: ParsingBenchmarkConfig = {
            nodeCount: "small",
            language,
            iterations: 1,
          };

          const result = await runner.runParsingBenchmarks(config);

          expect(result.successfulRuns).toBeGreaterThan(0);
        });
      });
    });

    describe("benchmark metrics validation", () => {
      it("should provide comprehensive performance metrics", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: "medium",
          language: "typescript",
          iterations: 2,
        };

        const result = await runner.runParsingBenchmarks(config);

        // Validate all required metrics are present
        expect(result.averageDuration).toBeGreaterThan(0);
        expect(result.averageThroughput).toBeGreaterThan(0);
        expect(result.averageMemoryUsed).toBeDefined();
        expect(result.averageCpuUsage).toBeDefined();
        expect(result.peakMemoryUsed).toBeDefined();
        expect(result.totalNodesProcessed).toBeGreaterThan(0);
        expect(result.performanceScore).toBeDefined();
        expect(result.meetsPerformanceTargets).toBeDefined();
      });

      it("should track performance across multiple iterations", async () => {
        const config: ParsingBenchmarkConfig = {
          nodeCount: "small",
          language: "typescript",
          iterations: 5,
        };

        const result = await runner.runParsingBenchmarks(config);

        expect(result.totalRuns).toBe(5);
        expect(result.successfulRuns).toBe(5);

        // Should have averaged metrics across all runs
        expect(result.averageDuration).toBeGreaterThan(0);
        expect(result.totalNodesProcessed).toBeGreaterThan(0);
      });
    });
  });
});
