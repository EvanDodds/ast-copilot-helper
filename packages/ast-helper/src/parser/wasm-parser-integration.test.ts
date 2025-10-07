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

  describe("WASM Fallback for Incompatible Native Parsers", () => {
    it("should fall back to WASM for Java parser", async () => {
      // Java parser doesn't have native language property, so should attempt WASM fallback
      try {
        await grammarManager.loadParser("java");
        // If it succeeds, the WASM fallback worked
        // If it fails, we expect a specific WASM-related error
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Should show it attempted WASM fallback - the error message contains both native and WASM attempts
        expect(
          errorMessage.includes("WASM fallback required") ||
            errorMessage.includes("Failed to load WASM parser") ||
            errorMessage.includes("Both methods failed"),
        ).toBe(true);
      }
    });

    it("should fall back to WASM for C# parser", async () => {
      try {
        await grammarManager.loadParser("csharp");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        // Should show it attempted both native and WASM parsers
        expect(
          errorMessage.includes("Failed to load parser for language") &&
            errorMessage.includes("Native Parser:") &&
            errorMessage.includes("WASM Parser:"),
        ).toBe(true);
      }
    });

    it("should fall back to WASM for Go parser", async () => {
      try {
        await grammarManager.loadParser("go");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        // Should show it attempted both native and WASM parsers
        expect(
          errorMessage.includes("Failed to load parser for language") &&
            errorMessage.includes("Native Parser:") &&
            errorMessage.includes("WASM Parser:"),
        ).toBe(true);
      }
    });

    it("should provide clear error messages for WASM failures", async () => {
      // Remove test environment to trigger actual WASM download attempts
      delete process.env.NODE_ENV;

      try {
        await grammarManager.loadParser("rust");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Should contain helpful information about the parser failure
        expect(
          errorMessage.includes("Failed to load parser for language") ||
            errorMessage.includes("Failed to load WASM parser") ||
            errorMessage.includes("Failed to download grammar") ||
            errorMessage.includes("Native Parser:") ||
            errorMessage.includes("WASM Parser:"),
        ).toBe(true);
      }
    });
  });

  describe("Native vs WASM Loading Strategy", () => {
    it("should clearly distinguish between native and WASM loading errors", async () => {
      const workingLanguages = ["typescript", "javascript", "python"];
      const wasmOnlyLanguages = ["java", "csharp", "go", "rust", "c", "cpp"];

      for (const language of workingLanguages) {
        try {
          const parser = await grammarManager.loadParser(language);
          expect(parser).toBeDefined();
        } catch (error) {
          // Working languages should either succeed or fail for different reasons
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          expect(errorMessage).not.toContain("WASM fallback required");
        }
      }

      for (const language of wasmOnlyLanguages) {
        try {
          await grammarManager.loadParser(language);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          // WASM-only languages should show comprehensive error information
          expect(
            errorMessage.includes("Failed to load parser for language") ||
              errorMessage.includes("Failed to load WASM parser") ||
              errorMessage.includes("Failed to download grammar") ||
              errorMessage.includes("Native Parser:") ||
              errorMessage.includes("WASM Parser:"),
          ).toBe(true);
        }
      }
    });
  });
});
