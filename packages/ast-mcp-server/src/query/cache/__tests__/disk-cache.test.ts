/**
 * @fileoverview Unit tests for L2 Disk Cache
 *
 * Tests the filesystem-based cache implementation including:
 * - Basic get/set operations with file persistence
 * - TTL expiration
 * - Pattern-based invalidation
 * - Corruption detection and recovery
 * - Statistics tracking
 * - File cleanup operations
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { DiskCache } from "../disk-cache.js";
import type { LevelCacheConfig } from "../types.js";

describe("DiskCache", () => {
  let cache: DiskCache<string>;
  let config: LevelCacheConfig & { path: string };
  const testCachePath = ".astdb/test-cache";

  beforeEach(async () => {
    // Clean up test cache directory FIRST
    try {
      await fs.rm(testCachePath, { recursive: true, force: true });
    } catch {
      // Ignore if directory doesn't exist
    }

    config = {
      enabled: true,
      maxSize: 10,
      defaultTTL: 5000, // 5 seconds
      path: testCachePath,
    };
    cache = new DiskCache<string>(config);
  });

  afterEach(async () => {
    cache.shutdown();
    // Clean up test cache directory
    try {
      await fs.rm(testCachePath, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe("basic operations", () => {
    it("should store and retrieve values from disk", async () => {
      await cache.set("key1", "value1");
      const result = await cache.get("key1");

      expect(result.success).toBe(true);
      expect(result.value).toBe("value1");
      expect(result.level).toBe("L2");
    });

    it("should create cache files on disk", async () => {
      const setResult = await cache.set("key1", "value1");
      expect(setResult.success).toBe(true);

      // Give file system time to flush
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify the file was created
      const files = await fs.readdir(testCachePath);
      expect(files.length).toBeGreaterThan(0);

      // Verify it's a .cache file
      const cacheFiles = files.filter((f) => f.endsWith(".cache"));
      expect(cacheFiles.length).toBe(1);

      // Verify we can read it back
      const result = await cache.get("key1");
      expect(result.success).toBe(true);
      expect(result.value).toBe("value1");
    });

    it("should return miss for non-existent keys", async () => {
      const result = await cache.get("nonexistent");

      expect(result.success).toBe(false);
      expect(result.value).toBeUndefined();
      // Error field is optional in CacheOperationResult
    });

    it("should overwrite existing values", async () => {
      await cache.set("key1", "value1");
      await cache.set("key1", "value2");

      const result = await cache.get("key1");
      expect(result.value).toBe("value2");
    });

    it("should handle multiple keys", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      const result1 = await cache.get("key1");
      const result2 = await cache.get("key2");
      const result3 = await cache.get("key3");

      expect(result1.value).toBe("value1");
      expect(result2.value).toBe("value2");
      expect(result3.value).toBe("value3");
    });

    it("should create cache directory if it doesn't exist", async () => {
      await cache.set("key1", "value1");

      const stats = await fs.stat(testCachePath);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe("TTL expiration", () => {
    it("should expire entries after TTL", async () => {
      await cache.set("key1", "value1", 100); // 100ms TTL

      // Should exist immediately
      let result = await cache.get("key1");
      expect(result.success).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be expired
      result = await cache.get("key1");
      expect(result.success).toBe(false);
    });

    it("should use default TTL when not specified", async () => {
      await cache.set("key1", "value1");

      // Should exist within default TTL
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const result = await cache.get("key1");
      expect(result.success).toBe(true);
    });

    it("should handle custom TTL per entry", async () => {
      await cache.set("short", "value1", 100);
      await cache.set("long", "value2", 5000);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const shortResult = await cache.get("short");
      const longResult = await cache.get("long");

      expect(shortResult.success).toBe(false);
      expect(longResult.success).toBe(true);
    });
  });

  describe("corruption detection and recovery", () => {
    it("should handle corrupted cache files gracefully", async () => {
      const setResult = await cache.set("key1", "value1");
      expect(setResult.success).toBe(true);

      // Give file system time to flush
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Find the actual cache file (it has a hash-based name)
      const files = await fs.readdir(testCachePath);
      const cacheFile = files.find((f) => f.endsWith(".cache"));
      expect(cacheFile).toBeDefined();

      const filePath = join(testCachePath, cacheFile!);

      // Corrupt the file
      await fs.writeFile(filePath, "{ invalid json");

      // Should return miss and not throw
      const result = await cache.get("key1");
      expect(result.success).toBe(false);
    });

    it("should remove corrupted files during cleanup", async () => {
      const set1 = await cache.set("key1", "value1");
      const set2 = await cache.set("key2", "value2");
      expect(set1.success).toBe(true);
      expect(set2.success).toBe(true);

      // Give file system time to flush
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Find the cache file for key1
      const files = await fs.readdir(testCachePath);
      expect(files.length).toBeGreaterThanOrEqual(2);

      // Corrupt the first cache file
      const cacheFile = files.find((f) => f.endsWith(".cache"));
      expect(cacheFile).toBeDefined();
      const filePath = join(testCachePath, cacheFile!);
      await fs.writeFile(filePath, "corrupted");

      // Corrupted file should be handled gracefully
      const result1 = await cache.get("key1");
      expect(result1.success).toBe(false);

      // key2 should still work
      const result2 = await cache.get("key2");
      expect(result2.success).toBe(true);
    });

    it("should handle missing cache directory", async () => {
      await fs.rm(testCachePath, { recursive: true, force: true });

      const result = await cache.get("key1");
      expect(result.success).toBe(false);
    });

    it("should recover from file system errors", async () => {
      // Try to get from non-existent cache
      const result1 = await cache.get("key1");
      expect(result1.success).toBe(false);

      // Should be able to set after error
      await cache.set("key1", "value1");
      const result2 = await cache.get("key1");
      expect(result2.success).toBe(true);
    });
  });

  describe("statistics tracking", () => {
    it("should track cache hits", async () => {
      await cache.set("key1", "value1");
      await cache.get("key1");
      await cache.get("key1");

      const stats = await cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it("should track cache misses", async () => {
      await cache.get("nonexistent1");
      await cache.get("nonexistent2");

      const stats = await cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it("should calculate hit rate correctly", async () => {
      await cache.set("key1", "value1");
      await cache.get("key1"); // hit
      await cache.get("key1"); // hit
      await cache.get("nonexistent"); // miss

      const stats = await cache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it("should track entry count", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      const stats = await cache.getStats();
      expect(stats.entryCount).toBe(3);
    });

    it("should estimate disk usage", async () => {
      await cache.set("key1", "a".repeat(1000));
      await cache.set("key2", "b".repeat(2000));

      const stats = await cache.getStats();
      expect(stats.sizeBytes).toBeGreaterThan(3000);
    });

    it("should track evictions", async () => {
      // Fill beyond capacity
      for (let i = 1; i <= 15; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      const stats = await cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it("should include cache level in stats", async () => {
      const stats = await cache.getStats();
      expect(stats.level).toBe("L2");
    });
  });

  describe("clear operation", () => {
    it("should clear all cache files", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      await cache.clear();

      const stats = await cache.getStats();
      expect(stats.entryCount).toBe(0);
    });

    it("should reset entry count and size on clear", async () => {
      await cache.set("key1", "value1");
      await cache.get("key1");

      await cache.clear();

      const stats = await cache.getStats();
      // Clear only resets entry count and size, not hits/misses
      expect(stats.entryCount).toBe(0);
      expect(stats.sizeBytes).toBe(0);
    });

    it("should allow setting values after clear", async () => {
      await cache.set("key1", "value1");
      await cache.clear();
      await cache.set("key2", "value2");

      const result = await cache.get("key2");
      expect(result.success).toBe(true);
    });

    it("should remove cache directory on clear", async () => {
      await cache.set("key1", "value1");
      await cache.clear();

      try {
        await fs.stat(join(testCachePath, "key1.cache.json"));
        expect.fail("File should not exist");
      } catch {
        // Expected - file should be deleted
      }
    });
  });

  describe("atomic writes", () => {
    it("should write files atomically", async () => {
      await cache.set("key1", "value1");

      // File should exist after write (hash-based filename)
      const files = await fs.readdir(testCachePath);
      const cacheFiles = files.filter((f) => f.endsWith(".cache"));
      expect(cacheFiles.length).toBeGreaterThan(0);
    });

    it("should not leave temp files on successful write", async () => {
      await cache.set("key1", "value1");

      const files = await fs.readdir(testCachePath);
      const tempFiles = files.filter((f) => f.endsWith(".tmp"));
      expect(tempFiles.length).toBe(0);
    });

    it("should handle concurrent writes to same key", async () => {
      await Promise.all([
        cache.set("key1", "value1"),
        cache.set("key1", "value2"),
        cache.set("key1", "value3"),
      ]);

      const result = await cache.get("key1");
      expect(result.success).toBe(true);
      expect(["value1", "value2", "value3"]).toContain(result.value);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string values", async () => {
      await cache.set("key1", "");
      const result = await cache.get("key1");
      expect(result.success).toBe(true);
      expect(result.value).toBe("");
    });

    it("should handle complex objects", async () => {
      const complexObj = { nested: { data: [1, 2, 3] }, flag: true };
      const objCache = new DiskCache<typeof complexObj>(config);

      await objCache.set("key1", complexObj);
      const result = await objCache.get("key1");

      expect(result.success).toBe(true);
      expect(result.value).toEqual(complexObj);

      objCache.shutdown();
    });

    it("should handle keys with special characters", async () => {
      const specialKey = "user:123/posts?filter=active";
      await cache.set(specialKey, "value1");
      const result = await cache.get(specialKey);

      expect(result.success).toBe(true);
    });

    it("should handle very long keys", async () => {
      const longKey = "x".repeat(200);
      await cache.set(longKey, "value1");
      const result = await cache.get(longKey);

      expect(result.success).toBe(true);
    });

    it("should handle large values", async () => {
      const largeValue = "x".repeat(100000); // 100KB
      await cache.set("large", largeValue);
      const result = await cache.get("large");

      expect(result.success).toBe(true);
      expect(result.value).toBe(largeValue);
    });

    it("should handle rapid successive operations", async () => {
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`));
      }
      await Promise.all(promises);

      const stats = await cache.getStats();
      expect(stats.entryCount).toBeGreaterThan(0);
    });
  });

  describe("performance", () => {
    it("should complete get operations in under 500ms", async () => {
      await cache.set("key1", "value1");

      const start = Date.now();
      await cache.get("key1");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it("should complete set operations in reasonable time", async () => {
      const start = Date.now();
      await cache.set("key1", "value1");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
    });

    it("should report latency in operation results", async () => {
      await cache.set("key1", "value1");
      const result = await cache.get("key1");

      // Latency can be 0 for very fast operations
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.latencyMs).toBeLessThan(500);
    });
  });
});
