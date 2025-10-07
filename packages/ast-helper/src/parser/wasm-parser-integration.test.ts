/**
 * Test WASM parser functionality
 * This test validates that WASM fallback works for languages that don't support native parsing
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TreeSitterGrammarManager } from "./grammar-manager.js";
import * as path from "path";
import * as fs from "fs/promises";

describe("WASM Parser Integration", () => {
  let grammarManager: TreeSitterGrammarManager;
  const testCacheDir = path.join(process.cwd(), "test-tmp", "wasm-parser-test");

  beforeEach(async () => {
    grammarManager = new TreeSitterGrammarManager(testCacheDir);

    // Clean up cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Native-Only Language Support", () => {
    it("should fail cleanly for Java (native parser unavailable)", async () => {
      // Java should fail in native-only architecture since no compatible native parser exists
      await expect(grammarManager.loadParser("java")).rejects.toThrow(
        "Failed to load parser for language 'java'. Native parser failed.",
      );
    });

    it("should fail cleanly for C# parser (native parser unavailable)", async () => {
      // C# should fail in native-only architecture since no compatible native parser exists
      await expect(grammarManager.loadParser("csharp")).rejects.toThrow(
        "Failed to load parser for language 'csharp'. Native parser failed.",
      );
    });

    it("should fail cleanly for Go parser (native parser unavailable)", async () => {
      // Go should fail in native-only architecture since no compatible native parser exists
      await expect(grammarManager.loadParser("go")).rejects.toThrow(
        "Failed to load parser for language 'go'. Native parser failed.",
      );
    });

    it("should provide clear error messages for native parser failures", async () => {
      // Test that unsupported languages provide clear error messages
      await expect(grammarManager.loadParser("rust")).rejects.toThrow(
        "Failed to load parser for language 'rust'. Native parser failed.",
      );
    });
  });

  describe("Native-Only Loading Strategy Validation", () => {
    it("should correctly handle supported and unsupported languages in native-only mode", async () => {
      const supportedLanguages = ["typescript", "javascript", "python", "c"];
      const unsupportedLanguages = ["java", "csharp", "go", "rust", "cpp"];

      // Test supported languages - should work
      for (const language of supportedLanguages) {
        try {
          const parser = await grammarManager.loadParser(language);
          expect(parser).toBeDefined();
          expect(typeof (parser as any).parse).toBe("function");
        } catch (error) {
          // If supported languages fail, it should not be due to WASM fallback
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          expect(errorMessage).not.toContain("WASM");
          // Re-throw to fail the test since these should work
          throw error;
        }
      }

      // Test unsupported languages - should fail with native error
      for (const language of unsupportedLanguages) {
        await expect(grammarManager.loadParser(language)).rejects.toThrow(
          `Failed to load parser for language '${language}'. Native parser failed.`,
        );
      }
    });
  });
});
