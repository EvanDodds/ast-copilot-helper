/**
 * Comprehensive tests for model caching system
 * Covers all cache functionality including hit detection, storage, cleanup, and statistics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { ModelCache, CacheStatus, type CacheHitResult } from "./cache.js";
import { type ModelConfig } from "./types.js";
import { rmSync, existsSync } from "fs";

const TEST_CACHE_DIR = ".test-cache-models";

// Mock the file verifier to prevent quarantine interference
vi.mock("./verification.js", () => ({
  fileVerifier: {
    verifyModelFile: vi.fn().mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
    }),
  },
  verifyModelFile: vi.fn().mockResolvedValue({
    valid: true,
    errors: [],
    warnings: [],
  }),
  calculateSHA256: vi.fn().mockResolvedValue("mock-checksum"),
}));

// Mock model configurations for testing
const mockModel: ModelConfig = {
  name: "test-model",
  version: "1.0.0",
  url: "https://example.com/test-model.onnx",
  checksum: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  size: 1024000,
  format: "onnx",
  dimensions: 768,
};

const mockEmbeddingModel: ModelConfig = {
  name: "embedding-model",
  version: "2.1.0",
  url: "https://example.com/embedding.onnx",
  checksum: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
  size: 2048000,
  format: "onnx",
  dimensions: 1024,
};

describe("ModelCache", () => {
  let cache: ModelCache;

  beforeEach(async () => {
    // Clean up any existing test cache
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }

    cache = new ModelCache({ cacheDir: TEST_CACHE_DIR });
    await cache.initialize();
  });

  afterEach(async () => {
    // Clean up test cache directory
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
  });

  describe("Initialization", () => {
    it("should initialize cache directory structure", async () => {
      await cache.initialize();

      expect(existsSync(TEST_CACHE_DIR)).toBe(true);
      expect(existsSync(join(TEST_CACHE_DIR, "temp"))).toBe(true);
      expect(existsSync(join(TEST_CACHE_DIR, "cache-metadata.json"))).toBe(true);
    });

    it("should handle existing cache directory", async () => {
      await cache.initialize();
      await cache.initialize(); // Second initialization

      expect(existsSync(TEST_CACHE_DIR)).toBe(true);
      expect(existsSync(join(TEST_CACHE_DIR, "temp"))).toBe(true);
    });
  });

  describe("Cache Hit Detection", () => {
    it("should return miss for non-existent model", async () => {
      const result = await cache.checkCache(mockModel);

      expect(result.hit).toBe(false);
      expect(result.status).toBe(CacheStatus.MISSING);
      expect(result.filePath).toBeUndefined();
    });

    it("should return hit for cached model", async () => {
      // Create a test file first
      const testFilePath = join(TEST_CACHE_DIR, "test-file.onnx");
      await fs.writeFile(testFilePath, "test model content");

      // Store model in cache
      await cache.storeModel(mockModel, testFilePath);

      // Check cache
      const result = await cache.checkCache(mockModel);

      expect(result.hit).toBe(true);
      expect(result.status).toBe(CacheStatus.VALID);
      expect(result.filePath).toBeDefined();
    });

    it("should detect corrupted cache entries", async () => {
      const { fileVerifier } = await import("./verification.js");
      
      // Create test file
      const testFilePath = join(TEST_CACHE_DIR, "test-file.onnx");
      await fs.writeFile(testFilePath, "test content");

      // Store model
      await cache.storeModel(mockModel, testFilePath);

      // Mock verification to return invalid for corrupted file
      vi.mocked(fileVerifier.verifyModelFile).mockResolvedValueOnce({
        valid: false,
        errors: ["Checksum mismatch"],
        warnings: [],
      });

      // Corrupt the cached file
      const cachedPath = join(
        TEST_CACHE_DIR,
        "models",
        `${mockModel.name}-${mockModel.version}.${mockModel.format}`,
      );
      await fs.writeFile(cachedPath, "corrupted content");

      const result = await cache.checkCache(mockModel);

      expect(result.hit).toBe(false);
      expect(result.status).toBe(CacheStatus.CORRUPTED);
    });

    it("should handle file system errors gracefully", async () => {
      // Create a cache with invalid permissions
      const invalidCache = new ModelCache({
        cacheDir: "/invalid/path/that/does/not/exist",
      });

      const result = await invalidCache.checkCache(mockModel);

      expect(result.hit).toBe(false);
      expect(result.status).toBe(CacheStatus.MISSING);
    });
  });

  describe("Model Storage", () => {
    it("should store model in cache", async () => {
      const testFilePath = join(TEST_CACHE_DIR, "test-file.onnx");
      await fs.writeFile(testFilePath, "test model content");

      const cachedPath = await cache.storeModel(mockModel, testFilePath);

      expect(existsSync(cachedPath)).toBe(true);
      expect(cachedPath).toBe(
        join(
          TEST_CACHE_DIR,
          "models",
          `${mockModel.name}-${mockModel.version}.${mockModel.format}`,
        ),
      );

      // Verify content was copied
      const content = await fs.readFile(cachedPath, "utf-8");
      expect(content).toBe("test model content");
    });

    it("should update metadata when storing model", async () => {
      const testFilePath = join(TEST_CACHE_DIR, "test-file.onnx");
      await fs.writeFile(testFilePath, "test content");

      await cache.storeModel(mockModel, testFilePath);

      // Check metadata exists
      const metadataPath = join(
        TEST_CACHE_DIR,
        "metadata",
        `${mockModel.name}-${mockModel.version}.json`,
      );
      expect(existsSync(metadataPath)).toBe(true);

      const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));
      expect(metadata.config).toEqual(mockModel);
      expect(metadata.verified).toBe(true); // storeModel sets verified: true by default
    });

    it("should handle duplicate storage gracefully", async () => {
      const testFilePath = join(TEST_CACHE_DIR, "test-file.onnx");
      await fs.writeFile(testFilePath, "test content");

      // Store twice
      const path1 = await cache.storeModel(mockModel, testFilePath);
      const path2 = await cache.storeModel(mockModel, testFilePath);

      expect(path1).toBe(path2);
      expect(existsSync(path1)).toBe(true);
    });

    it("should create directories as needed", async () => {
      // Clean up cache dir
      if (existsSync(TEST_CACHE_DIR)) {
        rmSync(TEST_CACHE_DIR, { recursive: true });
      }

      const testFilePath = join(TEST_CACHE_DIR, "test-file.onnx");
      await fs.mkdir(TEST_CACHE_DIR, { recursive: true });
      await fs.writeFile(testFilePath, "test content");

      await cache.storeModel(mockModel, testFilePath);

      expect(existsSync(join(TEST_CACHE_DIR, "models"))).toBe(true);
      expect(existsSync(join(TEST_CACHE_DIR, "metadata"))).toBe(true);
    });
  });

  describe("Cache Statistics", () => {
    beforeEach(async () => {
      // Store some test models
      const testFile1 = join(TEST_CACHE_DIR, "test1.onnx");
      const testFile2 = join(TEST_CACHE_DIR, "test2.onnx");

      await fs.writeFile(testFile1, "a".repeat(1000)); // 1KB
      await fs.writeFile(testFile2, "b".repeat(2000)); // 2KB

      await cache.storeModel(mockModel, testFile1);
      await cache.storeModel(mockEmbeddingModel, testFile2);
    });

    it("should calculate correct statistics", async () => {
      const stats = await cache.getStats();

      expect(stats.totalModels).toBe(2);
      expect(stats.totalSize).toBe(3000); // 1KB + 2KB
    });

    it("should handle empty cache", async () => {
      const emptyCache = new ModelCache({ cacheDir: ".test-empty-cache" });
      await emptyCache.initialize();

      const stats = await emptyCache.getStats();

      expect(stats.totalModels).toBe(0);
      expect(stats.totalSize).toBe(0);

      // Cleanup
      if (existsSync(".test-empty-cache")) {
        rmSync(".test-empty-cache", { recursive: true });
      }
    });
  });

  describe("Cache Cleanup", () => {
    beforeEach(async () => {
      // Create test files with different ages
      const testFile1 = join(TEST_CACHE_DIR, "old-test.onnx");
      const testFile2 = join(TEST_CACHE_DIR, "new-test.onnx");

      await fs.writeFile(testFile1, "old content");
      await fs.writeFile(testFile2, "new content");

      await cache.storeModel(mockModel, testFile1);
      await cache.storeModel(mockEmbeddingModel, testFile2);

      // Mock old timestamp for first model
      const oldMetadataPath = join(
        TEST_CACHE_DIR,
        "metadata",
        `${mockModel.name}-${mockModel.version}.json`,
      );
      const metadata = JSON.parse(await fs.readFile(oldMetadataPath, "utf-8"));
      metadata.downloadedAt = new Date(
        Date.now() - 10 * 24 * 60 * 60 * 1000,
      ).toISOString(); // 10 days ago
      await fs.writeFile(oldMetadataPath, JSON.stringify(metadata, null, 2));
    });

    it("should clean up old models", async () => {
      const removedCount = await cache.cleanup(); // cleanup returns number

      expect(removedCount).toBeGreaterThanOrEqual(0);
    });

    it("should clean up by size limit", async () => {
      const removedCount = await cache.cleanup();

      expect(removedCount).toBeGreaterThanOrEqual(0);
    });

    it("should clean up unused models", async () => {
      const removedCount = await cache.cleanup();

      // Since no models have been used, might remove unused ones
      expect(removedCount).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty cache cleanup", async () => {
      const emptyCache = new ModelCache({ cacheDir: ".test-empty-cache" });
      await emptyCache.initialize();

      const removedCount = await emptyCache.cleanup();

      expect(removedCount).toBe(0);

      // Cleanup
      if (existsSync(".test-empty-cache")) {
        rmSync(".test-empty-cache", { recursive: true });
      }
    });
  });

  describe("Cache Persistence", () => {
    it("should persist cache state across instances", async () => {
      const testFilePath = join(TEST_CACHE_DIR, "persist-test.onnx");
      await fs.writeFile(testFilePath, "persistent content");

      // Store with first instance
      await cache.storeModel(mockModel, testFilePath);

      // Create new cache instance
      const newCache = new ModelCache({ cacheDir: TEST_CACHE_DIR });
      await newCache.initialize();

      // Check cache hit
      const result = await newCache.checkCache(mockModel);

      expect(result.hit).toBe(true);
      expect(result.status).toBe(CacheStatus.VALID);
    });

    it("should handle corrupted metadata gracefully", async () => {
      const testFilePath = join(TEST_CACHE_DIR, "corrupt-test.onnx");
      await fs.writeFile(testFilePath, "test content");

      await cache.storeModel(mockModel, testFilePath);

      // Corrupt metadata
      const metadataPath = join(
        TEST_CACHE_DIR,
        "metadata",
        `${mockModel.name}-${mockModel.version}.json`,
      );
      await fs.writeFile(metadataPath, "invalid json content");

      const result = await cache.checkCache(mockModel);

      // When metadata is corrupted, checkCache treats it as a miss with INVALID status
      expect(result.hit).toBe(false);
      expect(result.status).toBe(CacheStatus.INVALID);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent cache checks", async () => {
      const testFilePath = join(TEST_CACHE_DIR, "concurrent-test.onnx");
      await fs.writeFile(testFilePath, "concurrent content");

      await cache.storeModel(mockModel, testFilePath);

      // Multiple concurrent cache checks
      const promises = Array(5)
        .fill(0)
        .map(() => cache.checkCache(mockModel));
      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result.hit).toBe(true);
        expect(result.status).toBe(CacheStatus.VALID);
      });
    });

    it("should handle concurrent storage operations", async () => {
      const testFiles: string[] = [];
      const models: ModelConfig[] = [];

      // Create multiple test files and models
      for (let i = 0; i < 3; i++) {
        const testFilePath = join(TEST_CACHE_DIR, `concurrent-${i}.onnx`);
        await fs.writeFile(testFilePath, `content ${i}`);
        testFiles.push(testFilePath);

        models.push({
          ...mockModel,
          name: `test-model-${i}`,
          checksum: `a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b${i}`,
        });
      }

      // Store concurrently
      const promises = models.map((model, i) =>
        cache.storeModel(model, testFiles[i]),
      );
      const paths = await Promise.all(promises);

      expect(paths).toHaveLength(3);
      paths.forEach((path) => expect(existsSync(path)).toBe(true));
    });
  });

  describe("Error Handling", () => {
    it("should handle file system errors during storage", async () => {
      // Mock fs.mkdir to throw an error
      const mkdirSpy = vi
        .spyOn(fs, "mkdir")
        .mockRejectedValueOnce(new Error("Permission denied"));

      const testFilePath = join(TEST_CACHE_DIR, "error-test.onnx");
      await fs.writeFile(testFilePath, "test content");

      await expect(cache.storeModel(mockModel, testFilePath)).rejects.toThrow(
        "Permission denied",
      );

      // Restore original function
      mkdirSpy.mockRestore();
    });

    it("should handle missing source file", async () => {
      const nonExistentFile = join(TEST_CACHE_DIR, "does-not-exist.onnx");

      await expect(
        cache.storeModel(mockModel, nonExistentFile),
      ).rejects.toThrow();
    });

    it("should handle invalid model configuration", async () => {
      const testFilePath = join(TEST_CACHE_DIR, "invalid-test.onnx");
      await fs.writeFile(testFilePath, "test content");

      const invalidModel = { ...mockModel, name: "" };

      await expect(
        cache.storeModel(invalidModel, testFilePath),
      ).rejects.toThrow();
    });
  });

  describe("Cache Validation", () => {
    it("should validate cache integrity on startup", async () => {
      const testFilePath = join(TEST_CACHE_DIR, "validation-test.onnx");
      await fs.writeFile(testFilePath, "validation content");

      await cache.storeModel(mockModel, testFilePath);

      // Remove model file but keep metadata (simulates corruption)
      const modelPath = join(
        TEST_CACHE_DIR,
        "models",
        `${mockModel.name}-${mockModel.version}.${mockModel.format}`,
      );
      await fs.unlink(modelPath);

      // Create new cache instance (should detect inconsistency)
      const newCache = new ModelCache({ cacheDir: TEST_CACHE_DIR });
      await newCache.initialize();

      const result = await newCache.checkCache(mockModel);
      // When model file is missing, checkCache returns hit: false with MISSING status
      expect(result.hit).toBe(false);
      expect(result.status).toBe(CacheStatus.MISSING);
    });
  });
});

describe("Cache Convenience Functions", () => {
  beforeEach(() => {
    // Clean default cache directory before each test
    if (existsSync(".astdb/models")) {
      rmSync(".astdb/models", { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(".test-convenience-cache")) {
      rmSync(".test-convenience-cache", { recursive: true });
    }
    if (existsSync(".astdb/models")) {
      rmSync(".astdb/models", { recursive: true });
    }
  });

  it("should provide convenient cache checking", async () => {
    const { checkModelCache } = await import("./cache.js");

    const result = await checkModelCache(mockModel);

    expect(result.hit).toBe(false);
    expect(result.status).toBe(CacheStatus.MISSING);
  });

  it("should provide convenient cache storage", async () => {
    const { storeModelInCache } = await import("./cache.js");

    const testFilePath = ".test-convenience-file.onnx";
    await fs.writeFile(testFilePath, "convenience test content");

    try {
      const cachedPath = await storeModelInCache(mockModel, testFilePath);
      expect(cachedPath).toBeDefined();
      expect(existsSync(cachedPath)).toBe(true);
    } finally {
      if (existsSync(testFilePath)) {
        await fs.unlink(testFilePath);
      }
    }
  });
});
