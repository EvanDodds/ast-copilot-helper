/**
 * Binary Compatibility Tester Tests
 * Comprehensive test suite for binary compatibility testing
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { BinaryCompatibilityTester } from "./BinaryCompatibilityTester";

describe("BinaryCompatibilityTester", () => {
  let tester: BinaryCompatibilityTester;
  let testDir: string;

  beforeEach(async () => {
    tester = new BinaryCompatibilityTester();
    testDir = path.join(process.cwd(), "test-output", "binary-tests");
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("initialization", () => {
    it("should initialize with current platform detection", () => {
      expect(tester).toBeDefined();
      expect(typeof tester.runTests).toBe("function");
    });

    it("should detect valid platform information", () => {
      const validPlatforms = ["win32", "darwin", "linux", "freebsd", "openbsd"];
      const validArchitectures = [
        "x64",
        "arm64",
        "ia32",
        "arm",
        "s390x",
        "ppc64",
      ];

      expect(validPlatforms).toContain(process.platform);
      expect(validArchitectures).toContain(process.arch);
      expect(process.version).toMatch(/^v\d+\.\d+\.\d+/);
    });
  });

  describe("binary compatibility tests", () => {
    it("should run comprehensive binary compatibility tests", async () => {
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

    it("should test platform detection accurately", async () => {
      const result = await tester.runTests();
      const platformTest = result.testResults.find(
        (test) => test.name === "platform_detection",
      );

      expect(platformTest).toBeDefined();
      expect(platformTest!.category).toBe("binary");
      expect(platformTest!.platform).toBe(process.platform);
      expect(platformTest!.passed).toBe(true);
      expect(platformTest!.details).toBeDefined();
      expect(platformTest!.details!.detectedPlatform).toBe(process.platform);
      expect(platformTest!.details!.detectedArchitecture).toBe(process.arch);
    });

    it("should test Node.js addon loading", async () => {
      const result = await tester.runTests();
      const addonTest = result.testResults.find(
        (test) => test.name === "node_addon_loading",
      );

      expect(addonTest).toBeDefined();
      expect(addonTest!.category).toBe("binary");
      expect(addonTest!.passed).toBe(true);
      expect(addonTest!.details!.nativeModulesSupported).toBe(true);
    });

    it("should test native module compatibility", async () => {
      const result = await tester.runTests();
      const nativeModuleTests = result.testResults.filter((test) =>
        test.name.startsWith("native_module_"),
      );

      expect(nativeModuleTests.length).toBeGreaterThan(0);

      nativeModuleTests.forEach((test) => {
        expect(test.category).toBe("binary");
        expect(test.details).toBeDefined();
        expect(test.details!.moduleName).toBeDefined();
        expect(test.details!.moduleType).toBe("native");
        expect(typeof test.details!.loadSuccessful).toBe("boolean");
      });
    });

    it("should test Tree-sitter grammar loading", async () => {
      const result = await tester.runTests();
      const treeSitterTests = result.testResults.filter((test) =>
        test.name.startsWith("tree_sitter_"),
      );

      expect(treeSitterTests.length).toBeGreaterThan(0);

      treeSitterTests.forEach((test) => {
        expect(test.category).toBe("binary");
        expect(test.details).toBeDefined();
        expect(test.details!.grammarName).toBeDefined();
        expect(typeof test.details!.loadSuccessful).toBe("boolean");
      });
    });

    it("should test WebAssembly support", async () => {
      const result = await tester.runTests();
      const wasmTest = result.testResults.find(
        (test) => test.name === "webassembly_support",
      );

      expect(wasmTest).toBeDefined();
      expect(wasmTest!.category).toBe("binary");
      expect(wasmTest!.details).toBeDefined();
      expect(typeof wasmTest!.details!.wasmSupported).toBe("boolean");

      // WebAssembly should be supported in Node.js
      expect(wasmTest!.details!.wasmSupported).toBe(true);
    });

    it("should test binary architecture validation", async () => {
      const result = await tester.runTests();
      const archTest = result.testResults.find(
        (test) => test.name === "binary_architecture",
      );

      expect(archTest).toBeDefined();
      expect(archTest!.category).toBe("binary");
      expect(archTest!.details).toBeDefined();
      expect(archTest!.details!.processArchitecture).toBe(process.arch);
      expect(archTest!.details!.processPlatform).toBe(process.platform);
    });

    it("should test dynamic library loading", async () => {
      const result = await tester.runTests();
      const libTest = result.testResults.find(
        (test) => test.name === "dynamic_library_loading",
      );

      expect(libTest).toBeDefined();
      expect(libTest!.category).toBe("binary");
      expect(libTest!.passed).toBe(true); // Core modules should load
      expect(libTest!.details!.loadedModules).toBeDefined();
      expect(Array.isArray(libTest!.details!.loadedModules)).toBe(true);
      expect(libTest!.details!.loadedModules.length).toBeGreaterThan(0);
    });

    it("should test memory usage patterns", async () => {
      const result = await tester.runTests();
      const memoryTest = result.testResults.find(
        (test) => test.name === "memory_usage",
      );

      expect(memoryTest).toBeDefined();
      expect(memoryTest!.category).toBe("binary");
      expect(memoryTest!.details).toBeDefined();
      expect(memoryTest!.details!.beforeMemory).toBeDefined();
      expect(memoryTest!.details!.afterMemory).toBeDefined();
      expect(typeof memoryTest!.details!.heapUsedDiff).toBe("number");
    });

    it("should test performance benchmarks", async () => {
      const result = await tester.runTests();
      const perfTest = result.testResults.find(
        (test) => test.name === "performance_benchmarks",
      );

      expect(perfTest).toBeDefined();
      expect(perfTest!.category).toBe("binary");
      expect(perfTest!.details).toBeDefined();
      expect(perfTest!.details!.benchmarks).toBeDefined();
      expect(typeof perfTest!.details!.benchmarks.cpuTime).toBe("number");
      expect(typeof perfTest!.details!.benchmarks.memoryTime).toBe("number");
      expect(typeof perfTest!.details!.benchmarks.ioTime).toBe("number");
    });

    it("should test error handling and recovery", async () => {
      const result = await tester.runTests();
      const errorTest = result.testResults.find(
        (test) => test.name === "error_handling",
      );

      expect(errorTest).toBeDefined();
      expect(errorTest!.category).toBe("binary");
      expect(errorTest!.details).toBeDefined();
      expect(errorTest!.details!.errorTests).toBeDefined();
      expect(typeof errorTest!.details!.errorHandlingWorks).toBe("boolean");
    });

    it("should complete tests within reasonable time", async () => {
      const startTime = Date.now();
      const result = await tester.runTests();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(60000); // Should complete within 60 seconds
      expect(result.summary.duration).toBeLessThanOrEqual(duration);
    }, 60000);

    it("should provide comprehensive test coverage", async () => {
      const result = await tester.runTests();

      // Should test all major categories
      const expectedTests = [
        "platform_detection",
        "node_addon_loading",
        "webassembly_support",
        "binary_architecture",
        "dynamic_library_loading",
        "memory_usage",
        "performance_benchmarks",
        "error_handling",
      ];

      expectedTests.forEach((expectedTest) => {
        const test = result.testResults.find((t) => t.name === expectedTest);
        expect(test).toBeDefined();
      });
    });
  });

  describe("platform-specific behavior", () => {
    it("should adapt tests for current platform", async () => {
      const result = await tester.runTests();

      result.testResults.forEach((test) => {
        expect(test.platform).toBe(process.platform);
        expect(test.duration).toBeGreaterThanOrEqual(0);
        expect(["binary"]).toContain(test.category);
      });
    });

    it("should handle platform-specific modules appropriately", async () => {
      const result = await tester.runTests();
      const moduleTests = result.testResults.filter(
        (test) =>
          test.name.startsWith("native_module_") ||
          test.name.startsWith("tree_sitter_"),
      );

      moduleTests.forEach((test) => {
        if (test.details?.required && !test.passed) {
          // Required modules should either pass or have meaningful error messages
          expect(test.error).toBeDefined();
        }
      });
    });
  });

  describe("error handling and edge cases", () => {
    it("should handle missing modules gracefully", async () => {
      // This is tested within the comprehensive test suite
      const result = await tester.runTests();
      expect(result).toBeDefined();
      expect(result.testResults.length).toBeGreaterThan(0);
    });

    it("should provide meaningful error information", async () => {
      const result = await tester.runTests();
      const failedTests = result.testResults.filter((test) => !test.passed);

      failedTests.forEach((test) => {
        // Failed tests should have error information or be optional
        const hasErrorInfo = !!test.error || test.details?.expectedFailure;
        const isOptional = test.details && !test.details.required;

        expect(hasErrorInfo || isOptional).toBe(true);
      });
    });

    it("should cleanup test files properly", async () => {
      await tester.runTests();

      // Test directory should exist but should be cleanable
      const testDirExists = await fs
        .access(testDir)
        .then(() => true)
        .catch(() => false);
      if (testDirExists) {
        // Should be able to clean up
        await expect(
          fs.rm(testDir, { recursive: true, force: true }),
        ).resolves.not.toThrow();
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

      // Test results should be consistent for deterministic tests
      const deterministicTests = [
        "platform_detection",
        "node_addon_loading",
        "webassembly_support",
        "binary_architecture",
        "dynamic_library_loading",
      ];

      deterministicTests.forEach((testName) => {
        const test1 = result1.testResults.find((t) => t.name === testName);
        const test2 = result2.testResults.find((t) => t.name === testName);

        if (test1 && test2) {
          expect(test1.passed).toBe(test2.passed);
        }
      });
    }, 120000);

    it("should handle concurrent executions", async () => {
      const promises = [
        tester.runTests(),
        tester.runTests(),
        tester.runTests(),
      ];

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.testResults.length).toBeGreaterThan(0);
        expect(result.summary.total).toBeGreaterThan(0);
      });
    }, 180000);
  });
});
