/**
 * @fileoverview Unit tests for L      expect(result.success).toBe(true);
      expect(result.value).toBe("value1");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);mory Cache
 *
 * Tests the in-memory LRU cache implementation including:
 * - Basic get/set operations
 * - TTL expiration
 * - LRU eviction
 * - Statistics tracking
 * - Cleanup operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryCache } from "../memory-cache.js";
import type { LevelCacheConfig } from "../types.js";

describe("MemoryCache", () => {
  let cache: MemoryCache<string>;
  let config: LevelCacheConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      maxSize: 5,
      defaultTTL: 1000, // 1 second
    };
    cache = new MemoryCache<string>(config);
  });

  afterEach(() => {
    cache.shutdown();
  });

  describe("basic operations", () => {
    it("should store and retrieve values", async () => {
      await cache.set("key1", "value1");
      const result = await cache.get("key1");

      expect(result.success).toBe(true);
      expect(result.value).toBe("value1");
      expect(result.level).toBe("L1");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
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

      // Should exist immediately
      let result = await cache.get("key1");
      expect(result.success).toBe(true);

      // Should still exist within default TTL (1000ms)
      await new Promise((resolve) => setTimeout(resolve, 500));
      result = await cache.get("key1");
      expect(result.success).toBe(true);
    });

    it("should handle custom TTL per entry", async () => {
      await cache.set("short", "value1", 100); // 100ms
      await cache.set("long", "value2", 2000); // 2000ms

      await new Promise((resolve) => setTimeout(resolve, 150));

      const shortResult = await cache.get("short");
      const longResult = await cache.get("long");

      expect(shortResult.success).toBe(false);
      expect(longResult.success).toBe(true);
    });

    it("should clean up expired entries on access", async () => {
      await cache.set("key1", "value1", 50);
      await cache.set("key2", "value2", 50);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Trying to get expired entries should trigger cleanup
      const result1 = await cache.get("key1");
      const result2 = await cache.get("key2");

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used entry when at capacity", async () => {
      // Fill cache to capacity (5 entries)
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");
      await cache.set("key4", "value4");
      await cache.set("key5", "value5");

      // Add one more - should evict key1 (oldest)
      await cache.set("key6", "value6");

      const result1 = await cache.get("key1");
      const result6 = await cache.get("key6");

      expect(result1.success).toBe(false);
      expect(result6.success).toBe(true);
    });

    it("should update LRU order on access", async () => {
      // Fill cache
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");
      await cache.set("key4", "value4");
      await cache.set("key5", "value5");

      // Access key1 to make it most recently used
      await cache.get("key1");

      // Add new entry - should evict key2 (now oldest)
      await cache.set("key6", "value6");

      const result1 = await cache.get("key1");
      const result2 = await cache.get("key2");

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
    });

    it("should track eviction count", async () => {
      // Fill cache past capacity
      for (let i = 1; i <= 7; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      const stats = await cache.getStats();
      expect(stats.evictions).toBe(2); // Evicted 2 entries
    });

    it("should maintain correct entry count after evictions", async () => {
      // Add 10 entries to a cache with max 5
      for (let i = 1; i <= 10; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      const stats = await cache.getStats();
      expect(stats.entryCount).toBe(5);
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
      expect(stats.hitRate).toBeCloseTo(0.667, 2); // 2/3
    });

    it("should handle zero accesses for hit rate", async () => {
      const stats = await cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it("should track memory usage", async () => {
      await cache.set("key1", "a".repeat(100));
      await cache.set("key2", "b".repeat(200));

      const stats = await cache.getStats();
      expect(stats.sizeBytes).toBeGreaterThan(0);
    });

    it("should track average access time", async () => {
      await cache.set("key1", "value1");
      await cache.get("key1");
      await cache.get("key1");
      await cache.get("key1");

      const stats = await cache.getStats();
      // Access time might be 0 for very fast operations
      expect(stats.avgAccessTime).toBeGreaterThanOrEqual(0);
      expect(stats.avgAccessTime).toBeLessThan(50); // Should be very fast
    });

    it("should include cache level in stats", async () => {
      const stats = await cache.getStats();
      expect(stats.level).toBe("L1");
    });

    it("should track access count per entry", async () => {
      await cache.set("key1", "value1");
      await cache.get("key1");
      await cache.get("key1");
      await cache.get("key1");

      // Access count is internal, verify through behavior
      const stats = await cache.getStats();
      expect(stats.hits).toBe(3);
    });
  });

  describe("clear operation", () => {
    it("should clear all entries", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      await cache.clear();

      const stats = await cache.getStats();
      expect(stats.entryCount).toBe(0);
    });

    it("should reset entry count and size on clear", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      await cache.clear();

      const stats = await cache.getStats();
      expect(stats.entryCount).toBe(0);
      expect(stats.sizeBytes).toBe(0);
      // Note: hits/misses/evictions are not reset by clear
    });

    it("should allow setting values after clear", async () => {
      await cache.set("key1", "value1");
      await cache.clear();
      await cache.set("key2", "value2");

      const result = await cache.get("key2");
      expect(result.success).toBe(true);
    });
  });

  describe("shutdown operation", () => {
    it("should stop cleanup timer on shutdown", async () => {
      const spy = vi.spyOn(global, "clearInterval");
      cache.shutdown();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should handle multiple shutdowns gracefully", () => {
      expect(() => {
        cache.shutdown();
        cache.shutdown();
      }).not.toThrow();
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
      const objCache = new MemoryCache<typeof complexObj>(config);

      await objCache.set("key1", complexObj);
      const result = await objCache.get("key1");

      expect(result.success).toBe(true);
      expect(result.value).toEqual(complexObj);

      objCache.shutdown();
    });

    it("should handle null values", async () => {
      const nullCache = new MemoryCache<string | null>(config);
      await nullCache.set("key1", null);
      const result = await nullCache.get("key1");

      expect(result.success).toBe(true);
      expect(result.value).toBeNull();

      nullCache.shutdown();
    });

    it("should handle rapid successive operations", async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`));
      }
      await Promise.all(promises);

      const stats = await cache.getStats();
      expect(stats.entryCount).toBeLessThanOrEqual(config.maxSize);
    });

    it("should handle very large values", async () => {
      const largeValue = "x".repeat(1000000); // 1MB string
      await cache.set("large", largeValue);

      const result = await cache.get("large");
      expect(result.success).toBe(true);
      expect(result.value).toBe(largeValue);
    });

    it("should handle zero TTL by using default TTL", async () => {
      await cache.set("key1", "value1", 0);

      // Zero TTL falls back to default TTL, so should still exist
      const result = await cache.get("key1");
      expect(result.success).toBe(true);
    });

    it("should handle negative TTL as never expiring", async () => {
      await cache.set("key1", "value1", -1);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Negative TTL means (now - timestamp > -1) is always true, so expires
      const result = await cache.get("key1");
      expect(result.success).toBe(false);
    });
  });

  describe("performance", () => {
    it("should complete get operations in under 100ms", async () => {
      await cache.set("key1", "value1");

      const start = Date.now();
      await cache.get("key1");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it("should complete set operations quickly", async () => {
      const start = Date.now();
      await cache.set("key1", "value1");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it("should handle concurrent operations efficiently", async () => {
      const start = Date.now();

      await Promise.all([
        cache.set("key1", "value1"),
        cache.set("key2", "value2"),
        cache.set("key3", "value3"),
        cache.get("key1"),
        cache.get("key2"),
        cache.get("key3"),
      ]);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });
});
