/**
 * Node.js Version Compatibility Tester Tests
 * Comprehensive test suite for Node.js version compatibility testing
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NodeVersionCompatibilityTester } from "./NodeVersionCompatibilityTester";

describe("NodeVersionCompatibilityTester", () => {
  let tester: NodeVersionCompatibilityTester;

  beforeEach(() => {
    tester = new NodeVersionCompatibilityTester();
  });

  describe("initialization", () => {
    it("should initialize with current Node.js version", () => {
      expect(tester).toBeDefined();
      expect(typeof tester.runTests).toBe("function");
    });

    it("should detect valid Node.js version information", () => {
      expect(process.version).toMatch(/^v\d+\.\d+\.\d+/);
      expect(typeof process.platform).toBe("string");
      expect(typeof process.arch).toBe("string");
    });
  });

  describe("Node.js version compatibility tests", () => {
    it("should run comprehensive Node.js compatibility tests", async () => {
      const result = await tester.runTests();

      expect(result).toBeDefined();
      expect(result.platform).toBe(process.platform);
      expect(result.architecture).toBe(process.arch);
      expect(result.nodeVersion).toBe(process.version);
      expect(Array.isArray(result.testResults)).toBe(true);
      expect(result.testResults.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.summary.duration).toBeGreaterThan(0);
    }, 30000);

    it("should test Node.js version parsing correctly", async () => {
      const result = await tester.runTests();
      const versionTest = result.testResults.find(
        (test) => test.name === "node_version_parsing",
      );

      expect(versionTest).toBeDefined();
      expect(versionTest!.category).toBe("nodejs");
      expect(versionTest!.passed).toBe(true);
      expect(versionTest!.details).toBeDefined();
      expect(versionTest!.details!.fullVersion).toBe(process.version);
      expect(typeof versionTest!.details!.majorVersion).toBe("number");
      expect(versionTest!.details!.majorVersion).toBeGreaterThan(0);
      expect(versionTest!.details!.isSupported).toBe(true); // Assuming Node 18+
    });

    it("should test ES Module support", async () => {
      const result = await tester.runTests();
      const esModuleTest = result.testResults.find(
        (test) => test.name === "es_module_support",
      );

      expect(esModuleTest).toBeDefined();
      expect(esModuleTest!.category).toBe("nodejs");
      expect(esModuleTest!.passed).toBe(true);
      expect(esModuleTest!.details!.dynamicImport).toBe(true);
      expect(esModuleTest!.details!.importMeta).toBe(true);
    });

    it("should test modern JavaScript features", async () => {
      const result = await tester.runTests();
      const jsFeatureTests = [
        "optional_chaining",
        "nullish_coalescing",
        "private_fields",
        "static_blocks",
      ];

      jsFeatureTests.forEach((testName) => {
        const test = result.testResults.find((t) => t.name === testName);
        expect(test).toBeDefined();
        expect(test!.category).toBe("nodejs");
        // Most modern features should be supported in Node.js 18+
        if (
          test!.name === "optional_chaining" ||
          test!.name === "nullish_coalescing"
        ) {
          expect(test!.passed).toBe(true);
        }
      });
    });

    it("should test core API compatibility", async () => {
      const result = await tester.runTests();
      const coreApis = [
        "core_api_crypto",
        "core_api_fs",
        "core_api_os",
        "core_api_path",
        "core_api_worker_threads",
        "core_api_perf_hooks",
        "core_api_stream",
      ];

      coreApis.forEach((apiTest) => {
        const test = result.testResults.find((t) => t.name === apiTest);
        expect(test).toBeDefined();
        expect(test!.category).toBe("nodejs");
        expect(test!.passed).toBe(true); // Core APIs should be available
      });
    });

    it("should test performance characteristics", async () => {
      const result = await tester.runTests();
      const perfTest = result.testResults.find(
        (test) => test.name === "performance_characteristics",
      );

      expect(perfTest).toBeDefined();
      expect(perfTest!.category).toBe("nodejs");
      expect(perfTest!.details).toBeDefined();
      expect(typeof perfTest!.details!.cpuTime).toBe("number");
      expect(perfTest!.details!.cpuTime).toBeGreaterThan(0);
      expect(typeof perfTest!.details!.memoryDiff).toBe("number");
      expect(typeof perfTest!.details!.v8HeapSize).toBe("number");
    });

    it("should test native module compatibility", async () => {
      const result = await tester.runTests();
      const nativeTest = result.testResults.find(
        (test) => test.name === "native_module_compatibility",
      );

      expect(nativeTest).toBeDefined();
      expect(nativeTest!.category).toBe("nodejs");
      expect(nativeTest!.details).toBeDefined();
      expect(typeof nativeTest!.details!.hasV8Version).toBe("boolean");
      expect(nativeTest!.details!.hasV8Version).toBe(true);
      expect(typeof nativeTest!.details!.v8Version).toBe("string");
    });

    it("should test worker threads support", async () => {
      const result = await tester.runTests();
      const workerTest = result.testResults.find(
        (test) => test.name === "worker_threads_support",
      );

      expect(workerTest).toBeDefined();
      expect(workerTest!.category).toBe("nodejs");
      expect(workerTest!.passed).toBe(true); // Worker threads should be supported
      expect(workerTest!.details).toBeDefined();
      if (workerTest!.details!.hasWorkerClass !== undefined) {
        expect(workerTest!.details!.hasWorkerClass).toBe(true);
      }
      if (workerTest!.details!.isMainThread !== undefined) {
        expect(workerTest!.details!.isMainThread).toBe(true);
      }
    });

    it("should test stream API compatibility", async () => {
      const result = await tester.runTests();
      const streamTest = result.testResults.find(
        (test) => test.name === "stream_api_compatibility",
      );

      expect(streamTest).toBeDefined();
      expect(streamTest!.category).toBe("nodejs");
      expect(streamTest!.passed).toBe(true);
      expect(streamTest!.details!.hasStreamClasses).toBe(true);
      expect(streamTest!.details!.hasPipeline).toBe(true);
      expect(streamTest!.details!.hasAsyncPipeline).toBe(true);
    });

    it("should test async features", async () => {
      const result = await tester.runTests();
      const asyncTest = result.testResults.find(
        (test) => test.name === "async_features",
      );

      expect(asyncTest).toBeDefined();
      expect(asyncTest!.category).toBe("nodejs");
      expect(asyncTest!.passed).toBe(true);
      expect(asyncTest!.details!.asyncAwait).toBe(true);
      expect(asyncTest!.details!.promiseAllSettled).toBe(true);
    });

    it("should test error handling", async () => {
      const result = await tester.runTests();
      const errorTest = result.testResults.find(
        (test) => test.name === "error_handling",
      );

      expect(errorTest).toBeDefined();
      expect(errorTest!.category).toBe("nodejs");
      expect(errorTest!.passed).toBe(true);
      expect(errorTest!.details!.hasStackTrace).toBe(true);
    });

    it("should complete tests within reasonable time", async () => {
      const startTime = Date.now();
      const result = await tester.runTests();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.summary.duration).toBeLessThanOrEqual(duration);
    }, 30000);

    it("should provide comprehensive test coverage", async () => {
      const result = await tester.runTests();

      // Should test all major categories
      const expectedTests = [
        "node_version_parsing",
        "es_module_support",
        "optional_chaining",
        "nullish_coalescing",
        "core_api_crypto",
        "core_api_fs",
        "performance_characteristics",
        "native_module_compatibility",
        "worker_threads_support",
        "stream_api_compatibility",
        "async_features",
        "error_handling",
      ];

      expectedTests.forEach((expectedTest) => {
        const test = result.testResults.find((t) => t.name === expectedTest);
        expect(test).toBeDefined();
      });
    });
  });

  describe("summary generation", () => {
    it("should generate accurate compatibility summary", async () => {
      const result = await tester.runTests();

      expect(result.summary.total).toBe(result.testResults.length);
      expect(result.summary.passed + result.summary.failed).toBe(
        result.summary.total,
      );
      expect(result.summary.versionSupported).toBe(true); // Assuming Node 18+

      // Feature compatibility checks
      expect(typeof result.summary.featureCompatibility.esModules).toBe(
        "boolean",
      );
      expect(typeof result.summary.featureCompatibility.asyncAwait).toBe(
        "boolean",
      );
      expect(typeof result.summary.featureCompatibility.optionalChaining).toBe(
        "boolean",
      );

      // API compatibility checks
      expect(typeof result.summary.apiCompatibility.crypto).toBe("boolean");
      expect(typeof result.summary.apiCompatibility.fs).toBe("boolean");
      expect(typeof result.summary.apiCompatibility.worker_threads).toBe(
        "boolean",
      );

      // Performance metrics
      expect(typeof result.summary.performanceMetrics.memoryUsage).toBe(
        "number",
      );
      expect(typeof result.summary.performanceMetrics.v8HeapSize).toBe(
        "number",
      );
    });

    it("should identify version support correctly", async () => {
      const result = await tester.runTests();

      const versionMatch = process.version.match(/^v(\d+)\.(\d+)\.(\d+)/);
      const majorVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;

      expect(result.summary.versionSupported).toBe(majorVersion >= 18);
    });
  });

  describe("error handling and edge cases", () => {
    it("should handle test failures gracefully", async () => {
      const result = await tester.runTests();
      const failedTests = result.testResults.filter((test) => !test.passed);

      // If there are failed tests, they should have error information
      if (failedTests.length > 0) {
        failedTests.forEach((test) => {
          // Failed tests should have error information
          expect(test.error).toBeDefined();
        });
      } else {
        // If no tests failed, that's also acceptable
        expect(result.summary.failed).toBe(0);
      }
    });

    it("should provide meaningful error information", async () => {
      const result = await tester.runTests();

      result.testResults.forEach((test) => {
        if (!test.passed && test.error) {
          expect(test.error.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe("platform-specific behavior", () => {
    it("should adapt tests for current platform", async () => {
      const result = await tester.runTests();

      result.testResults.forEach((test) => {
        expect(test.platform).toBe(process.platform);
        expect(test.duration).toBeGreaterThanOrEqual(0);
        expect(test.category).toBe("nodejs");
      });
    });

    it("should detect Node.js version features correctly", async () => {
      const result = await tester.runTests();
      const versionMatch = process.version.match(/^v(\d+)\.(\d+)\.(\d+)/);
      const majorVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;

      // Features that should be available based on Node.js version
      if (majorVersion >= 18) {
        expect(result.summary.featureCompatibility.esModules).toBe(true);
        expect(result.summary.featureCompatibility.asyncAwait).toBe(true);
        expect(result.summary.apiCompatibility.crypto).toBe(true);
        expect(result.summary.apiCompatibility.worker_threads).toBe(true);
      }
    });
  });

  describe("performance and reliability", () => {
    it("should provide consistent results across multiple runs", async () => {
      const result1 = await tester.runTests();
      const result2 = await tester.runTests();

      expect(result1.platform).toBe(result2.platform);
      expect(result1.architecture).toBe(result2.architecture);
      expect(result1.nodeVersion).toBe(result2.nodeVersion);
      expect(result1.testResults.length).toBe(result2.testResults.length);

      // Core compatibility results should be consistent
      const deterministicTests = [
        "node_version_parsing",
        "es_module_support",
        "optional_chaining",
        "nullish_coalescing",
      ];

      deterministicTests.forEach((testName) => {
        const test1 = result1.testResults.find((t) => t.name === testName);
        const test2 = result2.testResults.find((t) => t.name === testName);

        if (test1 && test2) {
          expect(test1.passed).toBe(test2.passed);
        }
      });
    }, 60000);
  });
});
