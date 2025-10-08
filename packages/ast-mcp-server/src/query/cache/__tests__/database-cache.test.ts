/**
 * @fileoverview Unit tests for L3 Database Cache
 *
 * Tests the SQLite-based cache implementation including:
 * - Basic SQL operations (get/set/delete)
 * - TTL expiration
 * - Query logging
 * - Statistics tracking and aggregation
 * - Database persistence
 * - LRU eviction
 * - Performance benchmarks
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { unlinkSync } from "node:fs";
import { DatabaseCache } from "../database-cache.js";
import type { LevelCacheConfig, CacheQueryLog } from "../types.js";

describe("DatabaseCache", () => {
  let cache: DatabaseCache<string>;
  let config: LevelCacheConfig;
  const testDbPath = ".astdb/test-cache.db";

  beforeEach(() => {
    // Clean up test database
    try {
      unlinkSync(testDbPath);
      unlinkSync(`${testDbPath}-wal`);
      unlinkSync(`${testDbPath}-shm`);
    } catch {
      // Ignore if files don't exist
    }

    config = {
      enabled: true,
      maxSize: 10,
      defaultTTL: 5000, // 5 seconds
    };
    cache = new DatabaseCache<string>(config, testDbPath);
  });

  afterEach(async () => {
    await cache.shutdown();
    // Clean up test database
    try {
      unlinkSync(testDbPath);
      unlinkSync(`${testDbPath}-wal`);
      unlinkSync(`${testDbPath}-shm`);
    } catch {
      // Ignore errors
    }
  });

  describe("basic operations", () => {
    it("should store and retrieve values", async () => {
      await cache.set("key1", "value1");
      const result = await cache.get("key1");

      expect(result.success).toBe(true);
      expect(result.value).toBe("value1");
      expect(result.level).toBe("L3");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should return miss for non-existent keys", async () => {
      const result = await cache.get("nonexistent");

      expect(result.success).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it("should handle overwrites", async () => {
      await cache.set("key1", "value1");
      await cache.set("key1", "value2");

      const result = await cache.get("key1");
      expect(result.success).toBe(true);
      expect(result.value).toBe("value2");
    });

    it("should store multiple keys", async () => {
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

    it("should delete entries", async () => {
      await cache.set("key1", "value1");
      const deleted = await cache.delete("key1");
      expect(deleted).toBe(true);

      const result = await cache.get("key1");
      expect(result.success).toBe(false);
    });

    it("should check if key exists", async () => {
      await cache.set("key1", "value1");

      const exists = await cache.has("key1");
      const notExists = await cache.has("key2");

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    it("should list all keys", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      const keys = await cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
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

      // Should exist with default TTL
      const result = await cache.get("key1");
      expect(result.success).toBe(true);
    });

    it("should handle custom TTL per entry", async () => {
      await cache.set("key1", "value1", 1000); // 1s
      await cache.set("key2", "value2", 5000); // 5s

      // Both should exist initially
      expect((await cache.get("key1")).success).toBe(true);
      expect((await cache.get("key2")).success).toBe(true);
    });
  });

  describe("query logging", () => {
    it("should log query execution", async () => {
      const log: Omit<CacheQueryLog, "id"> = {
        queryText: "test query",
        queryHash: "hash123",
        options: JSON.stringify({ lang: "typescript" }),
        resultCount: 5,
        executionTimeMs: 100,
        cacheHit: false,
        cacheLevel: "L3" as const,
        timestamp: Date.now(),
        indexVersion: "1.0.0",
      };

      await cache.logQuery(log);

      // Verify log was stored (indirectly through top queries)
      const topQueries = await cache.getTopQueries(10);
      expect(topQueries).toHaveLength(1);
      expect(topQueries[0].queryHash).toBe("hash123");
      expect(topQueries[0].count).toBe(1);
    });

    it("should track query frequency", async () => {
      const log = {
        queryText: "test query",
        queryHash: "hash123",
        options: "{}",
        resultCount: 5,
        executionTimeMs: 100,
        cacheHit: false,
        timestamp: Date.now(),
        indexVersion: "1.0.0",
      };

      // Log same query multiple times
      await cache.logQuery(log);
      await cache.logQuery(log);
      await cache.logQuery({ ...log, cacheHit: true });

      const topQueries = await cache.getTopQueries(10);
      expect(topQueries[0].count).toBe(3);
    });

    it("should return top queries by frequency", async () => {
      const queries = [
        { queryHash: "hash1", queryText: "query1" },
        { queryHash: "hash2", queryText: "query2" },
        { queryHash: "hash3", queryText: "query3" },
      ];

      // Log queries with different frequencies
      for (let i = 0; i < 5; i++) {
        await cache.logQuery({
          ...queries[0],
          options: "{}",
          resultCount: 1,
          executionTimeMs: 10,
          cacheHit: false,
          timestamp: Date.now(),
          indexVersion: "1.0.0",
        });
      }

      for (let i = 0; i < 3; i++) {
        await cache.logQuery({
          ...queries[1],
          options: "{}",
          resultCount: 1,
          executionTimeMs: 10,
          cacheHit: false,
          timestamp: Date.now(),
          indexVersion: "1.0.0",
        });
      }

      await cache.logQuery({
        ...queries[2],
        options: "{}",
        resultCount: 1,
        executionTimeMs: 10,
        cacheHit: false,
        timestamp: Date.now(),
        indexVersion: "1.0.0",
      });

      const topQueries = await cache.getTopQueries(2);
      expect(topQueries).toHaveLength(2);
      expect(topQueries[0].queryHash).toBe("hash1");
      expect(topQueries[0].count).toBe(5);
      expect(topQueries[1].queryHash).toBe("hash2");
      expect(topQueries[1].count).toBe(3);
    });

    it("should handle cache hit logging", async () => {
      const log: Omit<CacheQueryLog, "id"> = {
        queryText: "cached query",
        queryHash: "hash456",
        options: "{}",
        resultCount: 10,
        executionTimeMs: 5,
        cacheHit: true,
        cacheLevel: "L1" as const,
        timestamp: Date.now(),
        indexVersion: "1.0.0",
      };

      await cache.logQuery(log);

      const topQueries = await cache.getTopQueries(1);
      expect(topQueries[0].queryHash).toBe("hash456");
    });
  });

  describe("statistics tracking", () => {
    it("should track cache hits", async () => {
      await cache.set("key1", "value1");
      await cache.get("key1");
      await cache.get("key1");

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.level).toBe("L3");
    });

    it("should track cache misses", async () => {
      await cache.get("nonexistent1");
      await cache.get("nonexistent2");

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it("should calculate hit rate", async () => {
      await cache.set("key1", "value1");
      await cache.get("key1"); // hit
      await cache.get("nonexistent"); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.5);
    });

    it("should track entry count", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");

      const stats = cache.getStats();
      expect(stats.entryCount).toBe(2);
    });

    it("should track size in bytes", async () => {
      await cache.set("key1", "a".repeat(100));

      const stats = cache.getStats();
      expect(stats.sizeBytes).toBeGreaterThan(0);
    });

    it("should track evictions", async () => {
      // Fill cache to capacity
      for (let i = 0; i < 11; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it("should track average access time", async () => {
      await cache.set("key1", "value1");
      await cache.get("key1");
      await cache.get("key1");
      await cache.get("key1");

      const stats = cache.getStats();
      expect(stats.avgAccessTime).toBeGreaterThanOrEqual(0);
    });

    it("should have correct cache level identifier", async () => {
      const stats = cache.getStats();
      expect(stats.level).toBe("L3");
      expect(cache.getLevel()).toBe("L3");
    });
  });

  describe("clear operation", () => {
    it("should clear all entries", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");

      await cache.clear();

      const result1 = await cache.get("key1");
      const result2 = await cache.get("key2");

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
    });

    it("should reset entry count and size on clear", async () => {
      await cache.set("key1", "value1");
      await cache.get("key1");

      await cache.clear();

      const stats = cache.getStats();
      expect(stats.entryCount).toBe(0);
      expect(stats.sizeBytes).toBe(0);
    });

    it("should allow setting values after clear", async () => {
      await cache.set("key1", "value1");
      await cache.clear();
      await cache.set("key2", "value2");

      const result = await cache.get("key2");
      expect(result.success).toBe(true);
      expect(result.value).toBe("value2");
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used entries when at capacity", async () => {
      // Fill cache to capacity
      for (let i = 0; i < 10; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      // Access some entries to make them recently used
      await cache.get("key5");
      await cache.get("key6");

      // Add one more entry to trigger eviction
      await cache.set("key10", "value10");

      const stats = cache.getStats();
      expect(stats.entryCount).toBe(10);
      expect(stats.evictions).toBe(1);

      // Recently accessed entries should still exist
      expect((await cache.get("key5")).success).toBe(true);
      expect((await cache.get("key6")).success).toBe(true);
      expect((await cache.get("key10")).success).toBe(true);
    });

    it("should track eviction count", async () => {
      for (let i = 0; i < 12; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThanOrEqual(2);
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
      const obj = {
        nested: { data: [1, 2, 3] },
        string: "test",
        number: 42,
      };

      await cache.set("key1", JSON.stringify(obj));
      const result = await cache.get("key1");

      expect(result.success).toBe(true);
      expect(JSON.parse(result.value as string)).toEqual(obj);
    });

    it("should handle special characters in keys", async () => {
      const specialKeys = [
        "key:with:colons",
        "key-with-dashes",
        "key_with_underscores",
      ];

      for (const key of specialKeys) {
        await cache.set(key, "value");
        const result = await cache.get(key);
        expect(result.success).toBe(true);
      }
    });

    it("should handle long keys", async () => {
      const longKey = "k".repeat(1000);
      await cache.set(longKey, "value");

      const result = await cache.get(longKey);
      expect(result.success).toBe(true);
    });

    it("should handle large values", async () => {
      const largeValue = "x".repeat(100000);
      await cache.set("key1", largeValue);

      const result = await cache.get("key1");
      expect(result.success).toBe(true);
      expect(result.value?.length).toBe(100000);
    });

    it("should handle rapid sequential operations", async () => {
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(cache.set(`key${i}`, `value${i}`));
      }

      await Promise.all(operations);

      const stats = cache.getStats();
      expect(stats.entryCount).toBeGreaterThan(0);
    });

    it("should handle database persistence across operations", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");

      // Verify data persists
      const result1 = await cache.get("key1");
      const result2 = await cache.get("key2");

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe("performance", () => {
    it("should have reasonable get latency", async () => {
      await cache.set("key1", "value1");
      const result = await cache.get("key1");

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.latencyMs).toBeLessThan(2000); // <2s target
    });

    it("should have reasonable set latency", async () => {
      const result = await cache.set("key1", "value1");

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.latencyMs).toBeLessThan(1000);
    });

    it("should report latency in operation results", async () => {
      await cache.set("key1", "value1");
      const result = await cache.get("key1");

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.latencyMs).toBeLessThan(2000);
    });
  });

  describe("disabled cache", () => {
    it("should return error when cache is disabled", async () => {
      const disabledConfig = { ...config, enabled: false };
      const disabledCache = new DatabaseCache<string>(
        disabledConfig,
        ".astdb/test-disabled.db",
      );

      const getResult = await disabledCache.get("key1");
      const setResult = await disabledCache.set("key1", "value1");

      expect(getResult.success).toBe(false);
      expect(getResult.error).toContain("disabled");
      expect(setResult.success).toBe(false);
      expect(setResult.error).toContain("disabled");

      await disabledCache.shutdown();
    });
  });
});
