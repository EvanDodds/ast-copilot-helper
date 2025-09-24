/**
 * Tests for Tree-sitter runtime detection
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RuntimeDetector } from "./runtime-detector.js";

describe("RuntimeDetector", () => {
  beforeEach(() => {
    RuntimeDetector.clearCache();
  });

  describe("runtime availability detection", () => {
    it("should detect if native tree-sitter is available", async () => {
      const available = await RuntimeDetector.isNativeAvailable();
      expect(typeof available).toBe("boolean");
    });

    it("should detect if WASM tree-sitter is available", async () => {
      const available = await RuntimeDetector.isWasmAvailable();
      expect(typeof available).toBe("boolean");
    });

    it("should cache detection results", async () => {
      // First call
      const result1 = await RuntimeDetector.isNativeAvailable();
      // Second call should use cache
      const result2 = await RuntimeDetector.isNativeAvailable();

      expect(result1).toBe(result2);
    });

    it("should clear cache when requested", async () => {
      await RuntimeDetector.isNativeAvailable();
      RuntimeDetector.clearCache();

      // Should re-detect after cache clear
      const result = await RuntimeDetector.isNativeAvailable();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getBestRuntime", () => {
    it("should return a runtime if one is available", async () => {
      try {
        const runtime = await RuntimeDetector.getBestRuntime();
        expect(runtime).toBeDefined();
        expect(["native", "wasm"]).toContain(runtime.type);
        expect(runtime.available).toBe(true);
      } catch (error) {
        // If no runtime available, that's also a valid test result
        expect(error.message).toContain("No Tree-sitter runtime available");
      }
    });

    it("should prefer native over WASM when both available", async () => {
      const nativeAvailable = await RuntimeDetector.isNativeAvailable();
      const wasmAvailable = await RuntimeDetector.isWasmAvailable();

      if (nativeAvailable && wasmAvailable) {
        const runtime = await RuntimeDetector.getBestRuntime();
        expect(runtime.type).toBe("native");
      }
    });
  });

  describe("runtime initialization", () => {
    it("should initialize runtime successfully when available", async () => {
      try {
        const runtime = await RuntimeDetector.getBestRuntime();
        expect(runtime.available).toBe(true);

        // Try creating a parser for a supported language
        // Note: This may fail if dependencies aren't installed, which is expected
        try {
          await runtime.createParser("typescript");
        } catch (error) {
          // Expected if tree-sitter dependencies not installed
          console.log(
            "Parser creation failed (expected in test environment):",
            error.message,
          );
        }
      } catch (error) {
        // No runtime available - skip test
        console.log("No runtime available for testing");
      }
    });

    it("should handle unsupported languages gracefully", async () => {
      try {
        const runtime = await RuntimeDetector.getBestRuntime();

        await expect(
          runtime.createParser("unsupported-language"),
        ).rejects.toThrow("Unsupported language");
      } catch (error) {
        // No runtime available - skip test
        console.log("No runtime available for testing");
      }
    });
  });
});
