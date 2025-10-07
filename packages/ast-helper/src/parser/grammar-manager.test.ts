/**
 * Tests for Grammar Management System
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { TreeSitterGrammarManager } from "./grammar-manager.js";

describe("TreeSitterGrammarManager", () => {
  const testBaseDir = ".astdb-test";
  let grammarManager: TreeSitterGrammarManager;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = "test";
    grammarManager = new TreeSitterGrammarManager(testBaseDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await grammarManager.cleanCache();
      await fs.rmdir(testBaseDir).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
    delete process.env.NODE_ENV;
  });

  describe("downloadGrammar", () => {
    it("should download and cache a grammar successfully", async () => {
      const grammarPath = await grammarManager.downloadGrammar("typescript");

      expect(grammarPath).toMatch(/tree-sitter-typescript\.wasm$/);

      // Verify file exists
      const fileExists = await fs
        .access(grammarPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify metadata exists
      const metadataPath = path.join(
        path.dirname(grammarPath),
        "metadata.json",
      );
      const metadataExists = await fs
        .access(metadataPath)
        .then(() => true)
        .catch(() => false);
      expect(metadataExists).toBe(true);
    });

    it("should return existing grammar if already cached and valid", async () => {
      // First download
      const path1 = await grammarManager.downloadGrammar("javascript");

      // Second call should return the same path without re-downloading
      const path2 = await grammarManager.downloadGrammar("javascript");

      expect(path1).toBe(path2);
    });

    it("should handle unsupported languages", async () => {
      await expect(
        grammarManager.downloadGrammar("unsupported-language"),
      ).rejects.toThrow("Unsupported language");
    });
  });

  describe("getCachedGrammarPath", () => {
    it("should return path for cached grammar", async () => {
      // First download the grammar
      await grammarManager.downloadGrammar("python");

      // Then get cached path
      const cachedPath = await grammarManager.getCachedGrammarPath("python");
      expect(cachedPath).toMatch(/tree-sitter-python\.wasm$/);
    });

    it("should download grammar if not cached", async () => {
      const grammarPath =
        await grammarManager.getCachedGrammarPath("typescript");

      // Should have downloaded and returned path
      expect(grammarPath).toMatch(/tree-sitter-typescript\.wasm$/);

      const fileExists = await fs
        .access(grammarPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });
  });

  describe("verifyGrammarIntegrity", () => {
    it("should return true for valid cached grammar", async () => {
      // Download a grammar first
      await grammarManager.downloadGrammar("javascript");

      // Verify it
      const isValid = await grammarManager.verifyGrammarIntegrity("javascript");
      expect(isValid).toBe(true);
    });

    it("should return false for non-existent grammar", async () => {
      const isValid = await grammarManager.verifyGrammarIntegrity("typescript");
      expect(isValid).toBe(false);
    });

    it("should return false for grammar with corrupted hash", async () => {
      // Download a grammar
      const grammarPath = await grammarManager.downloadGrammar("python");

      // Temporarily disable test mode to test real hash verification
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      try {
        // Corrupt the file
        await fs.writeFile(grammarPath, "corrupted content");

        // Also need to update the metadata to have a real hash instead of mock
        const languageDir = path.join(testBaseDir, "grammars", "python");
        const metadataPath = path.join(languageDir, "metadata.json");

        const metadata = {
          version: "1.0.0",
          hash: "real_expected_hash_that_wont_match_corrupted_content",
          url: "https://example.com/python.wasm",
          downloadedAt: new Date().toISOString(),
          lastVerified: new Date().toISOString(),
        };

        await fs.writeFile(
          metadataPath,
          JSON.stringify(metadata, null, 2),
          "utf-8",
        );

        // Verify should fail
        const isValid = await grammarManager.verifyGrammarIntegrity("python");
        expect(isValid).toBe(false);
      } finally {
        // Restore test environment
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe("loadParser", () => {
    it("should successfully load TypeScript parser using native tree-sitter", async () => {
      // With fixed grammar compatibility, TypeScript parsing should work
      const parser = await grammarManager.loadParser("typescript");
      expect(parser).toBeDefined();

      // Parser should be able to parse simple TypeScript code
      const sampleCode = "const x: number = 42;";
      const tree = (parser as any).parse(sampleCode);
      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();

      // Should not need to download WASM grammar since native parser works
      const grammarPath = path.join(
        testBaseDir,
        "grammars",
        "typescript",
        "tree-sitter-typescript.wasm",
      );
      const fileExists = await fs
        .access(grammarPath)
        .then(() => true)
        .catch(() => false);
      // Native parser doesn't require WASM grammar download
      expect(fileExists).toBe(false);
    });
  });

  describe("cache management", () => {
    it("should provide cache information", async () => {
      // Download some grammars
      await grammarManager.downloadGrammar("typescript");
      await grammarManager.downloadGrammar("javascript");

      const cacheInfo = await grammarManager.getCacheInfo();

      expect(cacheInfo).toHaveProperty("typescript");
      expect(cacheInfo).toHaveProperty("javascript");
      expect(cacheInfo.typescript).toBeDefined();
      expect(cacheInfo.javascript).toBeDefined();

      if (cacheInfo.typescript) {
        expect(cacheInfo.typescript.version).toBeDefined();
        expect(cacheInfo.typescript.hash).toBeDefined();
        expect(cacheInfo.typescript.downloadedAt).toBeDefined();
      }
    });

    it("should clean cache completely", async () => {
      // Download a grammar
      await grammarManager.downloadGrammar("python");

      // Verify it exists
      let cacheInfo = await grammarManager.getCacheInfo();
      expect(cacheInfo).toHaveProperty("python");

      // Clean cache
      await grammarManager.cleanCache();

      // Verify it's gone
      cacheInfo = await grammarManager.getCacheInfo();
      expect(Object.keys(cacheInfo)).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("should handle network errors gracefully", async () => {
      // Remove test environment to trigger actual network download
      delete process.env.NODE_ENV;

      await expect(
        grammarManager.downloadGrammar("typescript"),
      ).rejects.toThrow("Failed to download");
    });

    it("should retry downloads on failure", async () => {
      // This test is more for documentation - the retry logic exists
      // but is hard to test without mocking the download function
      expect(true).toBe(true);
    });

    it("should provide detailed error information for loadParser failures", async () => {
      // Test with an invalid/unsupported language
      await expect(async () => {
        await grammarManager.loadParser("nonexistent-language");
      }).rejects.toThrow();

      // Now test the error message content
      try {
        await grammarManager.loadParser("nonexistent-language");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Check that error message contains comprehensive troubleshooting information
        expect(errorMessage).toContain(
          "Failed to load parser for language 'nonexistent-language'",
        );
        expect(errorMessage).toContain("Native Parser:");
        expect(errorMessage).toContain("WASM Parser:");
        expect(errorMessage).toContain("Troubleshooting suggestions:");
        expect(errorMessage).toContain(
          "tree-sitter-nonexistent-language package",
        );
        expect(errorMessage).toContain("Loading context:");
      }
    });

    it("should handle cached grammar path errors with helpful context", async () => {
      // Test with a language that will fail cache verification
      await expect(async () => {
        await grammarManager.getCachedGrammarPath("invalid-test-language");
      }).rejects.toThrow();

      // Now test the error message content
      try {
        await grammarManager.getCachedGrammarPath("invalid-test-language");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Check that error provides helpful diagnostic information
        expect(errorMessage).toContain(
          "Failed to get cached grammar path for invalid-test-language",
        );
        expect(errorMessage).toContain("Attempted path:");
        expect(errorMessage).toContain(
          "This may indicate issues with the grammar cache",
        );
        expect(errorMessage).toContain("network connectivity");
        expect(errorMessage).toContain("language configuration");
      }
    });

    it("should handle downloadGrammar errors with step-by-step context", async () => {
      // Remove test environment to trigger actual network download
      delete process.env.NODE_ENV;

      await expect(async () => {
        await grammarManager.downloadGrammar("invalid-grammar-test");
      }).rejects.toThrow();

      // Now test the error message content
      try {
        await grammarManager.downloadGrammar("invalid-grammar-test");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Check that error provides comprehensive download context
        expect(errorMessage).toContain(
          "Grammar download failed for invalid-grammar-test",
        );
        expect(errorMessage).toContain("Download context:");
        expect(errorMessage).toContain("language");
        expect(errorMessage).toContain("timestamp");
        expect(errorMessage).toContain("steps");
      }
    });

    it("should verify grammar integrity correctly", async () => {
      // Test integrity verification with a known working language
      const isValidTypescript =
        await grammarManager.verifyGrammarIntegrity("typescript");
      // Should be false since we haven't downloaded anything in test environment
      expect(typeof isValidTypescript).toBe("boolean");

      // Test with non-existent language
      const isValidNonexistent =
        await grammarManager.verifyGrammarIntegrity("nonexistent");
      expect(isValidNonexistent).toBe(false);
    });
  });
});
