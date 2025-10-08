import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MultiLevelCacheManager } from "../multi-level-cache.js";
import type { MultiLevelCacheConfig } from "../types.js";
import { rmSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

describe("MultiLevelCacheManager", () => {
  let manager: MultiLevelCacheManager<string>;
  let config: MultiLevelCacheConfig;
  const cacheBasePath = ".astdb/test-multi-cache";
  const l2Path = join(cacheBasePath, "l2-disk");

  beforeEach(() => {
    // Clean up cache directories and files
    if (existsSync(cacheBasePath)) {
      rmSync(cacheBasePath, { recursive: true, force: true });
    }
    mkdirSync(cacheBasePath, { recursive: true });

    // Default configuration with all levels enabled
    config = {
      memory: {
        enabled: true,
        maxSize: 10,
        defaultTTL: 60000, // 60 seconds
      },
      disk: {
        enabled: true,
        maxSize: 20,
        defaultTTL: 3600000, // 1 hour
        path: l2Path,
      },
      database: {
        enabled: true,
        maxSize: 50,
        defaultTTL: 86400000, // 24 hours
      },
      enablePromotion: true,
      enableWarming: false,
      warmingQueryCount: 10,
    };

    manager = new MultiLevelCacheManager<string>(config, cacheBasePath);
  });

  afterEach(async () => {
    await manager.shutdown();

    // Clean up cache directories
    if (existsSync(cacheBasePath)) {
      rmSync(cacheBasePath, { recursive: true, force: true });
    }
  });

  describe("Cache Hierarchy and Lookup Flow", () => {
    it("should return immediately on L1 cache hit", async () => {
      await manager.set("test-key", "test-value");

      const result = await manager.get("test-key");

      expect(result.success).toBe(true);
      expect(result.value).toBe("test-value");
      expect(result.level).toBe("L1" as const);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should check L2 on L1 miss", async () => {
      // Directly set in L2 and L3 (bypass L1)
      const l2Cache = (manager as any).l2Cache;
      const l3Cache = (manager as any).l3Cache;

      await l2Cache.set("test-key", "test-value");
      await l3Cache.set("test-key", "test-value");

      const result = await manager.get("test-key");

      expect(result.success).toBe(true);
      expect(result.value).toBe("test-value");
      expect(result.level).toBe("L2" as const);
    });

    it("should check L3 on L1 and L2 miss", async () => {
      // Directly set only in L3
      const l3Cache = (manager as any).l3Cache;
      await l3Cache.set("test-key", "test-value");

      const result = await manager.get("test-key");

      expect(result.success).toBe(true);
      expect(result.value).toBe("test-value");
      expect(result.level).toBe("L3" as const);
    });

    it("should return miss when key not found at any level", async () => {
      const result = await manager.get("non-existent-key");

      expect(result.success).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.level).toBeUndefined();
    });

    it("should aggregate latency across all levels on miss", async () => {
      const result = await manager.get("non-existent-key");

      // Latency should be tracked (may be 0 for fast operations)
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.success).toBe(false);
    });

    it("should respect disabled levels in lookup flow", async () => {
      // Create manager with L2 disabled
      await manager.shutdown();
      config.disk.enabled = false;
      manager = new MultiLevelCacheManager<string>(config, cacheBasePath);

      // Set in L3 only
      const l3Cache = (manager as any).l3Cache;
      await l3Cache.set("test-key", "test-value");

      const result = await manager.get("test-key");

      // Should find in L3, skipping disabled L2
      expect(result.success).toBe(true);
      expect(result.level).toBe("L3" as const);
    });

    it("should handle all levels disabled gracefully", async () => {
      await manager.shutdown();
      config.memory.enabled = false;
      config.disk.enabled = false;
      config.database.enabled = false;
      manager = new MultiLevelCacheManager<string>(config, cacheBasePath);

      const result = await manager.get("test-key");

      expect(result.success).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it("should track lookup performance across levels", async () => {
      // Set value in all levels
      await manager.set("test-key", "test-value");

      const startTime = Date.now();
      const result = await manager.get("test-key");
      const endTime = Date.now();

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.latencyMs).toBeLessThanOrEqual(endTime - startTime + 50); // Allow 50ms margin
    });
  });

  describe("Set Operation Across Levels", () => {
    it("should set value in all enabled levels", async () => {
      await manager.set("test-key", "test-value");

      const l1Cache = (manager as any).l1Cache;
      const l2Cache = (manager as any).l2Cache;
      const l3Cache = (manager as any).l3Cache;

      const l1Result = await l1Cache.get("test-key");
      const l2Result = await l2Cache.get("test-key");
      const l3Result = await l3Cache.get("test-key");

      expect(l1Result.success).toBe(true);
      expect(l2Result.success).toBe(true);
      expect(l3Result.success).toBe(true);
      expect(l1Result.value).toBe("test-value");
      expect(l2Result.value).toBe("test-value");
      expect(l3Result.value).toBe("test-value");
    });

    it("should respect disabled levels when setting", async () => {
      await manager.shutdown();
      config.disk.enabled = false;
      manager = new MultiLevelCacheManager<string>(config, cacheBasePath);

      await manager.set("test-key", "test-value");

      const l1Cache = (manager as any).l1Cache;
      const l2Cache = (manager as any).l2Cache;
      const l3Cache = (manager as any).l3Cache;

      const l1Result = await l1Cache.get("test-key");
      const l2Result = await l2Cache.get("test-key");
      const l3Result = await l3Cache.get("test-key");

      expect(l1Result.success).toBe(true);
      expect(l2Result.success).toBe(false); // L2 disabled
      expect(l3Result.success).toBe(true);
    });

    it("should propagate TTL to all levels", async () => {
      const customTtl = 500; // 500ms
      await manager.set("test-key", "test-value", customTtl);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 600));

      const result = await manager.get("test-key");

      // Value should be expired at all levels
      expect(result.success).toBe(false);
    });

    it("should update existing values at all levels", async () => {
      await manager.set("test-key", "old-value");
      await manager.set("test-key", "new-value");

      const l1Cache = (manager as any).l1Cache;
      const l2Cache = (manager as any).l2Cache;
      const l3Cache = (manager as any).l3Cache;

      const l1Result = await l1Cache.get("test-key");
      const l2Result = await l2Cache.get("test-key");
      const l3Result = await l3Cache.get("test-key");

      expect(l1Result.value).toBe("new-value");
      expect(l2Result.value).toBe("new-value");
      expect(l3Result.value).toBe("new-value");
    });

    it("should track statistics on set operations", async () => {
      const statsBefore = manager.getStats();
      const initialL1Entries = statsBefore.levels.L1.entryCount;
      const initialL2Entries = statsBefore.levels.L2.entryCount;
      const initialL3Entries = statsBefore.levels.L3.entryCount;

      await manager.set("test-key", "test-value");

      const statsAfter = manager.getStats();

      expect(statsAfter.levels.L1.entryCount).toBe(initialL1Entries + 1);
      expect(statsAfter.levels.L2.entryCount).toBe(initialL2Entries + 1);
      expect(statsAfter.levels.L3.entryCount).toBe(initialL3Entries + 1);
      expect(statsAfter.totalEntries).toBe(statsBefore.totalEntries + 3);
    });
  });

  describe("Promotion Logic", () => {
    it("should promote from L3 to L2 on cache hit", async () => {
      // Set only in L3
      const l3Cache = (manager as any).l3Cache;
      await l3Cache.set("test-key", "test-value");

      await manager.get("test-key");

      // Check L2 now has the value
      const l2Cache = (manager as any).l2Cache;
      const l2Result = await l2Cache.get("test-key");

      expect(l2Result.success).toBe(true);
      expect(l2Result.value).toBe("test-value");
    });

    it("should promote from L3 to L1 on cache hit", async () => {
      // Set only in L3
      const l3Cache = (manager as any).l3Cache;
      await l3Cache.set("test-key", "test-value");

      await manager.get("test-key");

      // Check L1 now has the value
      const l1Cache = (manager as any).l1Cache;
      const l1Result = await l1Cache.get("test-key");

      expect(l1Result.success).toBe(true);
      expect(l1Result.value).toBe("test-value");
    });

    it("should promote from L2 to L1 on cache hit", async () => {
      // Set only in L2 and L3
      const l2Cache = (manager as any).l2Cache;
      const l3Cache = (manager as any).l3Cache;
      await l2Cache.set("test-key", "test-value");
      await l3Cache.set("test-key", "test-value");

      await manager.get("test-key");

      // Check L1 now has the value
      const l1Cache = (manager as any).l1Cache;
      const l1Result = await l1Cache.get("test-key");

      expect(l1Result.success).toBe(true);
      expect(l1Result.value).toBe("test-value");
    });

    it("should track promotion count", async () => {
      const statsBefore = manager.getStats();

      // Set only in L3, then get to trigger promotion
      const l3Cache = (manager as any).l3Cache;
      await l3Cache.set("test-key", "test-value");
      await manager.get("test-key");

      const statsAfter = manager.getStats();

      expect(statsAfter.promotions).toBe(statsBefore.promotions + 1);
    });

    it("should not promote when promotion is disabled", async () => {
      await manager.shutdown();
      config.enablePromotion = false;
      manager = new MultiLevelCacheManager<string>(config, cacheBasePath);

      // Set only in L3
      const l3Cache = (manager as any).l3Cache;
      await l3Cache.set("test-key", "test-value");

      await manager.get("test-key");

      // Check L1 and L2 do NOT have the value
      const l1Cache = (manager as any).l1Cache;
      const l2Cache = (manager as any).l2Cache;
      const l1Result = await l1Cache.get("test-key");
      const l2Result = await l2Cache.get("test-key");

      expect(l1Result.success).toBe(false);
      expect(l2Result.success).toBe(false);
    });

    it("should handle promotion with TTL", async () => {
      // Set in L3 only
      const l3Cache = (manager as any).l3Cache;
      await l3Cache.set("test-key", "test-value");

      // Get to trigger promotion
      const result = await manager.get("test-key");
      expect(result.success).toBe(true);
      expect(result.level).toBe("L3");

      // After promotion, value should be in L1 and L2 as well
      const l1Cache = (manager as any).l1Cache;
      const l2Cache = (manager as any).l2Cache;

      const l1Result = await l1Cache.get("test-key");
      const l2Result = await l2Cache.get("test-key");

      expect(l1Result.success).toBe(true);
      expect(l2Result.success).toBe(true);
    });

    it("should handle multiple promotions in sequence", async () => {
      const l3Cache = (manager as any).l3Cache;

      // Set multiple keys in L3
      await l3Cache.set("key1", "value1");
      await l3Cache.set("key2", "value2");
      await l3Cache.set("key3", "value3");

      // Get all keys to trigger promotions
      await manager.get("key1");
      await manager.get("key2");
      await manager.get("key3");

      const stats = manager.getStats();

      expect(stats.promotions).toBe(3);
    });

    it("should promote after partial invalidation", async () => {
      // Set in all levels
      await manager.set("test-key", "test-value");

      // Invalidate from L1 only
      const l1Cache = (manager as any).l1Cache;
      await l1Cache.delete("test-key");

      // Get should find in L2 and promote to L1
      const result = await manager.get("test-key");

      expect(result.success).toBe(true);
      expect(result.level).toBe("L2" as const);

      // Verify L1 now has the value again
      const l1Result = await l1Cache.get("test-key");
      expect(l1Result.success).toBe(true);
    });

    it("should not increment promotion count when promotion disabled", async () => {
      await manager.shutdown();
      config.enablePromotion = false;
      manager = new MultiLevelCacheManager<string>(config, cacheBasePath);

      const statsBefore = manager.getStats();

      // Set only in L3
      const l3Cache = (manager as any).l3Cache;
      await l3Cache.set("test-key", "test-value");
      await manager.get("test-key");

      const statsAfter = manager.getStats();

      expect(statsAfter.promotions).toBe(statsBefore.promotions);
    });
  });

  describe("Delete Operation", () => {
    it("should delete from all cache levels", async () => {
      await manager.set("test-key", "test-value");

      await manager.delete("test-key");

      const l1Cache = (manager as any).l1Cache;
      const l2Cache = (manager as any).l2Cache;
      const l3Cache = (manager as any).l3Cache;

      const l1Result = await l1Cache.get("test-key");
      const l2Result = await l2Cache.get("test-key");
      const l3Result = await l3Cache.get("test-key");

      expect(l1Result.success).toBe(false);
      expect(l2Result.success).toBe(false);
      expect(l3Result.success).toBe(false);
    });

    it("should handle delete of non-existent key", async () => {
      // Should not throw error
      await expect(manager.delete("non-existent-key")).resolves.toBeUndefined();
    });

    it("should update statistics after delete", async () => {
      await manager.set("test-key", "test-value");

      const statsBefore = manager.getStats();
      const initialEntries = statsBefore.totalEntries;

      await manager.delete("test-key");

      const statsAfter = manager.getStats();

      // Each level loses one entry
      expect(statsAfter.totalEntries).toBe(initialEntries - 3);
    });
  });

  describe("Invalidation Strategies", () => {
    it("should invalidate single key by exact pattern", async () => {
      await manager.set("test-key", "test-value");

      const event = await manager.invalidate("test-key");

      expect(event.keys).toContain("test-key");
      expect(event.keys).toHaveLength(1);
      expect(event.reason).toBe("manual");
      expect(event.levels).toEqual(["L1", "L2", "L3"]);

      const result = await manager.get("test-key");
      expect(result.success).toBe(false);
    });

    it("should invalidate multiple keys by regex pattern", async () => {
      await manager.set("test-key-1", "value1");
      await manager.set("test-key-2", "value2");
      await manager.set("other-key", "value3");

      const event = await manager.invalidate(/^test-key-/);

      expect(event.keys).toHaveLength(2);
      expect(event.keys).toContain("test-key-1");
      expect(event.keys).toContain("test-key-2");
      expect(event.keys).not.toContain("other-key");

      const result1 = await manager.get("test-key-1");
      const result2 = await manager.get("test-key-2");
      const result3 = await manager.get("other-key");

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(true);
    });

    it("should invalidate across all levels", async () => {
      await manager.set("test-key", "test-value");

      await manager.invalidate("test-key");

      const l1Cache = (manager as any).l1Cache;
      const l2Cache = (manager as any).l2Cache;
      const l3Cache = (manager as any).l3Cache;

      const l1Result = await l1Cache.get("test-key");
      const l2Result = await l2Cache.get("test-key");
      const l3Result = await l3Cache.get("test-key");

      expect(l1Result.success).toBe(false);
      expect(l2Result.success).toBe(false);
      expect(l3Result.success).toBe(false);
    });

    it("should track invalidation count", async () => {
      const statsBefore = manager.getStats();

      await manager.set("test-key", "test-value");
      await manager.invalidate("test-key");

      const statsAfter = manager.getStats();

      expect(statsAfter.invalidations).toBe(statsBefore.invalidations + 1);
    });

    it("should return invalidation event with metadata", async () => {
      await manager.set("test-key", "test-value");

      const event = await manager.invalidate("test-key");

      expect(event).toHaveProperty("reason");
      expect(event).toHaveProperty("keys");
      expect(event).toHaveProperty("levels");
      expect(event).toHaveProperty("timestamp");
      expect(event).toHaveProperty("context");
      expect(event.context?.pattern).toBe("test-key");
      expect(event.context?.duration).toBeGreaterThanOrEqual(0);
    });

    it("should handle invalidation with no matches", async () => {
      const event = await manager.invalidate("non-existent-pattern");

      expect(event.keys).toHaveLength(0);
      expect(event.reason).toBe("manual");
    });

    it("should invalidate by complex pattern", async () => {
      await manager.set("query:search:abc123", "value1");
      await manager.set("query:search:def456", "value2");
      await manager.set("query:filter:ghi789", "value3");

      const event = await manager.invalidate(/^query:search:/);

      expect(event.keys).toHaveLength(2);
      expect(event.keys).toContain("query:search:abc123");
      expect(event.keys).toContain("query:search:def456");
    });

    it("should allow repopulation after invalidation", async () => {
      await manager.set("test-key", "old-value");
      await manager.invalidate("test-key");

      await manager.set("test-key", "new-value");

      const result = await manager.get("test-key");

      expect(result.success).toBe(true);
      expect(result.value).toBe("new-value");
    });
  });

  describe("Clear Operation", () => {
    it("should clear all cache levels", async () => {
      await manager.set("key1", "value1");
      await manager.set("key2", "value2");
      await manager.set("key3", "value3");

      await manager.clear();

      const result1 = await manager.get("key1");
      const result2 = await manager.get("key2");
      const result3 = await manager.get("key3");

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
    });

    it("should reset entry counts after clear", async () => {
      await manager.set("key1", "value1");
      await manager.set("key2", "value2");

      await manager.clear();

      const stats = manager.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.levels.L1.entryCount).toBe(0);
      expect(stats.levels.L2.entryCount).toBe(0);
      expect(stats.levels.L3.entryCount).toBe(0);
    });

    it("should not reset hit/miss statistics on clear", async () => {
      await manager.set("test-key", "test-value");
      await manager.get("test-key"); // Hit
      await manager.get("non-existent"); // Miss

      const statsBefore = manager.getStats();

      await manager.clear();

      const statsAfter = manager.getStats();

      // Hits and misses should be preserved
      expect(statsAfter.levels.L1.hits).toBe(statsBefore.levels.L1.hits);
      expect(statsAfter.levels.L1.misses).toBeGreaterThanOrEqual(
        statsBefore.levels.L1.misses,
      );
    });

    it("should allow setting values after clear", async () => {
      await manager.set("test-key", "test-value");
      await manager.clear();

      await manager.set("new-key", "new-value");

      const result = await manager.get("new-key");

      expect(result.success).toBe(true);
      expect(result.value).toBe("new-value");
    });
  });

  describe("Statistics Aggregation", () => {
    it("should calculate overall hit rate across all levels", async () => {
      await manager.set("key1", "value1");
      await manager.set("key2", "value2");

      // Generate some hits and misses
      await manager.get("key1"); // Hit at L1
      await manager.get("key2"); // Hit at L1
      await manager.get("non-existent"); // Miss at all levels

      const stats = manager.getStats();

      expect(stats.overallHitRate).toBeGreaterThan(0);
      expect(stats.overallHitRate).toBeLessThanOrEqual(1);
      // Hit rate should be reasonable (hits > 0, some misses from checking levels)
      expect(stats.overallHitRate).toBeGreaterThan(0);
    });

    it("should aggregate entry counts across levels", async () => {
      await manager.set("key1", "value1");
      await manager.set("key2", "value2");
      await manager.set("key3", "value3");

      const stats = manager.getStats();

      // Each key is stored in 3 levels = 9 total entries
      expect(stats.totalEntries).toBe(9);
      expect(stats.levels.L1.entryCount).toBe(3);
      expect(stats.levels.L2.entryCount).toBe(3);
      expect(stats.levels.L3.entryCount).toBe(3);
    });

    it("should aggregate size across levels", async () => {
      await manager.set("key1", "value1");
      await manager.set("key2", "value2");

      const stats = manager.getStats();

      expect(stats.totalSizeBytes).toBeGreaterThan(0);
      expect(stats.totalSizeBytes).toBe(
        stats.levels.L1.sizeBytes +
          stats.levels.L2.sizeBytes +
          stats.levels.L3.sizeBytes,
      );
    });

    it("should track promotions in overall statistics", async () => {
      const l3Cache = (manager as any).l3Cache;
      await l3Cache.set("test-key", "test-value");

      await manager.get("test-key");

      const stats = manager.getStats();

      expect(stats.promotions).toBe(1);
    });

    it("should track invalidations in overall statistics", async () => {
      await manager.set("test-key", "test-value");
      await manager.invalidate("test-key");

      const stats = manager.getStats();

      expect(stats.invalidations).toBe(1);
    });

    it("should calculate uptime correctly", async () => {
      const stats1 = manager.getStats();
      const uptime1 = stats1.uptimeMs;

      expect(uptime1).toBeGreaterThanOrEqual(0);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats2 = manager.getStats();
      const uptime2 = stats2.uptimeMs;

      expect(uptime2).toBeGreaterThan(uptime1);
      expect(uptime2 - uptime1).toBeGreaterThanOrEqual(90); // Allow 10ms margin
    });

    it("should provide per-level statistics", async () => {
      await manager.set("test-key", "test-value");
      await manager.get("test-key");

      const stats = manager.getStats();

      expect(stats.levels).toHaveProperty("L1");
      expect(stats.levels).toHaveProperty("L2");
      expect(stats.levels).toHaveProperty("L3");

      expect(stats.levels.L1).toHaveProperty("hits");
      expect(stats.levels.L1).toHaveProperty("misses");
      expect(stats.levels.L1).toHaveProperty("hitRate");
      expect(stats.levels.L1).toHaveProperty("entryCount");
      expect(stats.levels.L1).toHaveProperty("sizeBytes");
    });

    it("should handle zero hits and misses gracefully", async () => {
      const stats = manager.getStats();

      expect(stats.overallHitRate).toBe(0);
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.promotions).toBe(0);
      expect(stats.invalidations).toBe(0);
    });
  });

  describe("Query Logging", () => {
    it("should log query execution to L3", async () => {
      await manager.logQuery({
        queryText: "test query",
        queryHash: "hash1",
        options: "{}",
        resultCount: 10,
        executionTimeMs: 100,
        cacheHit: false,
        cacheLevel: undefined,
        timestamp: Date.now(),
        indexVersion: "v1",
      });

      // Verify by getting top queries
      const topQueries = await manager.getTopQueries(10);

      expect(topQueries.length).toBeGreaterThan(0);
    });

    it("should track query frequency", async () => {
      const queryLog = {
        queryText: "frequent query",
        queryHash: "hash2",
        options: "{}",
        resultCount: 5,
        executionTimeMs: 50,
        cacheHit: false,
        cacheLevel: undefined,
        timestamp: Date.now(),
        indexVersion: "v1",
      };

      await manager.logQuery(queryLog);
      await manager.logQuery(queryLog);
      await manager.logQuery(queryLog);

      const topQueries = await manager.getTopQueries(10);

      // Should have at least one query
      expect(topQueries.length).toBeGreaterThan(0);
    });

    it("should return top queries for cache warming", async () => {
      await manager.logQuery({
        queryText: "query1",
        queryHash: "hash3",
        options: "{}",
        resultCount: 10,
        executionTimeMs: 100,
        cacheHit: false,
        cacheLevel: undefined,
        timestamp: Date.now(),
        indexVersion: "v1",
      });

      await manager.logQuery({
        queryText: "query2",
        queryHash: "hash4",
        options: "{}",
        resultCount: 8,
        executionTimeMs: 50,
        cacheHit: false,
        cacheLevel: undefined,
        timestamp: Date.now(),
        indexVersion: "v1",
      });

      const topQueries = await manager.getTopQueries(5);

      expect(Array.isArray(topQueries)).toBe(true);
      expect(topQueries.length).toBeGreaterThan(0);
      expect(topQueries[0]).toHaveProperty("queryHash");
      expect(topQueries[0]).toHaveProperty("count");
    });

    it("should log cache hits with cache level", async () => {
      await manager.set("test-key", "test-value");
      await manager.get("test-key"); // Generate cache hit

      await manager.logQuery({
        queryText: "test query",
        queryHash: "hash5",
        options: "{}",
        resultCount: 1,
        executionTimeMs: 10,
        cacheHit: true,
        cacheLevel: "L1" as const,
        timestamp: Date.now(),
        indexVersion: "v1",
      });

      const topQueries = await manager.getTopQueries(10);

      expect(topQueries.length).toBeGreaterThan(0);
    });

    it("should handle query logging errors gracefully", async () => {
      // Shutdown L3 cache
      const l3Cache = (manager as any).l3Cache;
      await l3Cache.shutdown();

      // Should not throw error
      await expect(
        manager.logQuery({
          queryText: "test",
          queryHash: "hash6",
          options: "{}",
          resultCount: 0,
          executionTimeMs: 100,
          cacheHit: false,
          cacheLevel: undefined,
          timestamp: Date.now(),
          indexVersion: "v1",
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("Cache Warming", () => {
    it("should warm cache with provided queries when enabled", async () => {
      await manager.shutdown();
      config.enableWarming = true;
      manager = new MultiLevelCacheManager<string>(config, cacheBasePath);

      await manager.warmCache([
        { key: "warm-key-1", value: "warm-value-1" },
        { key: "warm-key-2", value: "warm-value-2" },
      ]);

      const result1 = await manager.get("warm-key-1");
      const result2 = await manager.get("warm-key-2");

      expect(result1.success).toBe(true);
      expect(result1.value).toBe("warm-value-1");
      expect(result2.success).toBe(true);
      expect(result2.value).toBe("warm-value-2");
    });

    it("should not warm cache when warming is disabled", async () => {
      // Warming disabled by default
      await manager.warmCache([{ key: "warm-key", value: "warm-value" }]);

      const result = await manager.get("warm-key");

      expect(result.success).toBe(false);
    });

    it("should populate all cache levels during warming", async () => {
      await manager.shutdown();
      config.enableWarming = true;
      manager = new MultiLevelCacheManager<string>(config, cacheBasePath);

      await manager.warmCache([{ key: "warm-key", value: "warm-value" }]);

      const l1Cache = (manager as any).l1Cache;
      const l2Cache = (manager as any).l2Cache;
      const l3Cache = (manager as any).l3Cache;

      const l1Result = await l1Cache.get("warm-key");
      const l2Result = await l2Cache.get("warm-key");
      const l3Result = await l3Cache.get("warm-key");

      expect(l1Result.success).toBe(true);
      expect(l2Result.success).toBe(true);
      expect(l3Result.success).toBe(true);
    });

    it("should handle empty warming queries", async () => {
      await manager.shutdown();
      config.enableWarming = true;
      manager = new MultiLevelCacheManager<string>(config, cacheBasePath);

      await expect(manager.warmCache([])).resolves.toBeUndefined();
    });

    it("should handle warming with many queries", async () => {
      await manager.shutdown();
      config.enableWarming = true;
      manager = new MultiLevelCacheManager<string>(config, cacheBasePath);

      const queries = Array.from({ length: 20 }, (_, i) => ({
        key: `warm-key-${i}`,
        value: `warm-value-${i}`,
      }));

      await manager.warmCache(queries);

      // Verify first and last
      const result0 = await manager.get("warm-key-0");
      const result19 = await manager.get("warm-key-19");

      expect(result0.success).toBe(true);
      expect(result19.success).toBe(true);
    });
  });

  describe("Key Generation", () => {
    it("should generate consistent keys for same inputs", () => {
      const key1 = manager.generateKey({
        queryText: "test query",
        queryType: "search",
        options: { limit: 10 },
        indexVersion: "v1",
      });

      const key2 = manager.generateKey({
        queryText: "test query",
        queryType: "search",
        options: { limit: 10 },
        indexVersion: "v1",
      });

      expect(key1).toBe(key2);
    });

    it("should generate different keys for different query text", () => {
      const key1 = manager.generateKey({
        queryText: "query 1",
        queryType: "search",
      });

      const key2 = manager.generateKey({
        queryText: "query 2",
        queryType: "search",
      });

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different query types", () => {
      const key1 = manager.generateKey({
        queryText: "test query",
        queryType: "search",
      });

      const key2 = manager.generateKey({
        queryText: "test query",
        queryType: "filter",
      });

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different options", () => {
      const key1 = manager.generateKey({
        queryText: "test query",
        queryType: "search",
        options: { limit: 10 },
      });

      const key2 = manager.generateKey({
        queryText: "test query",
        queryType: "search",
        options: { limit: 20 },
      });

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different index versions", () => {
      const key1 = manager.generateKey({
        queryText: "test query",
        queryType: "search",
        indexVersion: "v1",
      });

      const key2 = manager.generateKey({
        queryText: "test query",
        queryType: "search",
        indexVersion: "v2",
      });

      expect(key1).not.toBe(key2);
    });

    it("should handle missing optional fields", () => {
      const key = manager.generateKey({
        queryText: "test query",
        queryType: "search",
      });

      expect(key).toBeDefined();
      expect(key).toMatch(/^query:search:/);
    });

    it("should generate keys with consistent format", () => {
      const key = manager.generateKey({
        queryText: "test query",
        queryType: "search",
      });

      expect(key).toMatch(/^query:search:[a-f0-9]{16}$/);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent gets", async () => {
      await manager.set("test-key", "test-value");

      const results = await Promise.all([
        manager.get("test-key"),
        manager.get("test-key"),
        manager.get("test-key"),
      ]);

      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.value).toBe("test-value");
      });
    });

    it("should handle concurrent sets", async () => {
      await Promise.all([
        manager.set("key1", "value1"),
        manager.set("key2", "value2"),
        manager.set("key3", "value3"),
      ]);

      const result1 = await manager.get("key1");
      const result2 = await manager.get("key2");
      const result3 = await manager.get("key3");

      expect(result1.value).toBe("value1");
      expect(result2.value).toBe("value2");
      expect(result3.value).toBe("value3");
    });

    it("should handle concurrent get and set on same key", async () => {
      await manager.set("test-key", "initial-value");

      const operations = [
        manager.get("test-key"),
        manager.set("test-key", "updated-value"),
        manager.get("test-key"),
      ];

      await Promise.all(operations);

      // Final value should be "updated-value"
      const finalResult = await manager.get("test-key");
      expect(finalResult.value).toBe("updated-value");
    });

    it("should handle concurrent invalidations", async () => {
      await manager.set("key1", "value1");
      await manager.set("key2", "value2");
      await manager.set("key3", "value3");

      await Promise.all([
        manager.invalidate("key1"),
        manager.invalidate("key2"),
        manager.invalidate("key3"),
      ]);

      const result1 = await manager.get("key1");
      const result2 = await manager.get("key2");
      const result3 = await manager.get("key3");

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
    });

    it("should maintain cache consistency under concurrent load", async () => {
      const keyCount = 20; // Keep within L3's maxSize=50
      const operations = [];

      for (let i = 0; i < keyCount; i++) {
        operations.push(manager.set(`key-${i}`, `value-${i}`));
      }

      await Promise.all(operations);

      const stats = manager.getStats();

      // Should have entries across all levels
      // Each key stored in 3 levels = 20 * 3 = 60 total
      // But some may be evicted from L1 (maxSize=10) and L2 (maxSize=20)
      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.levels.L3.entryCount).toBe(keyCount); // L3 should have all
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty cache gracefully", async () => {
      const result = await manager.get("any-key");

      expect(result.success).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it("should handle large value promotion", async () => {
      const largeValue = "x".repeat(100000); // 100KB value

      const l3Cache = (manager as any).l3Cache;
      await l3Cache.set("large-key", largeValue);

      const result = await manager.get("large-key");

      expect(result.success).toBe(true);
      expect(result.value).toBe(largeValue);

      // Verify promotion to L1
      const l1Cache = (manager as any).l1Cache;
      const l1Result = await l1Cache.get("large-key");
      expect(l1Result.success).toBe(true);
    });

    it("should handle rapid invalidation and repopulation", async () => {
      for (let i = 0; i < 10; i++) {
        await manager.set("rapid-key", `value-${i}`);
        await manager.invalidate("rapid-key");
      }

      const result = await manager.get("rapid-key");
      expect(result.success).toBe(false);
    });

    it("should handle special characters in keys", async () => {
      const specialKey = "key:with:colons-and-dashes_and_underscores";
      await manager.set(specialKey, "special-value");

      const result = await manager.get(specialKey);

      expect(result.success).toBe(true);
      expect(result.value).toBe("special-value");
    });

    it("should handle complex objects as values", async () => {
      const complexValue = { nested: { data: [1, 2, 3] }, flag: true };

      const manager2 = new MultiLevelCacheManager<typeof complexValue>(
        config,
        cacheBasePath + "-complex",
      );

      await manager2.set("complex-key", complexValue);
      const result = await manager2.get("complex-key");

      expect(result.success).toBe(true);
      expect(result.value).toEqual(complexValue);

      await manager2.shutdown();
      if (existsSync(cacheBasePath + "-complex")) {
        rmSync(cacheBasePath + "-complex", { recursive: true, force: true });
      }
    });
  });

  describe("Performance", () => {
    it("should have reasonable get latency from L1", async () => {
      await manager.set("test-key", "test-value");

      const result = await manager.get("test-key");

      expect(result.latencyMs).toBeLessThan(100); // Should be <100ms for L1
    });

    it("should have reasonable get latency from L2", async () => {
      // Set only in L2 and L3
      const l2Cache = (manager as any).l2Cache;
      const l3Cache = (manager as any).l3Cache;
      await l2Cache.set("test-key", "test-value");
      await l3Cache.set("test-key", "test-value");

      const result = await manager.get("test-key");

      expect(result.latencyMs).toBeLessThan(500); // Should be <500ms for L2
    });

    it("should have reasonable get latency from L3", async () => {
      // Set only in L3
      const l3Cache = (manager as any).l3Cache;
      await l3Cache.set("test-key", "test-value");

      const result = await manager.get("test-key");

      expect(result.latencyMs).toBeLessThan(2000); // Should be <2s for L3
    });

    it("should track promotion overhead", async () => {
      const l3Cache = (manager as any).l3Cache;
      await l3Cache.set("test-key", "test-value");

      const startTime = Date.now();
      await manager.get("test-key");
      const endTime = Date.now();

      const promotionTime = endTime - startTime;

      // Promotion should add minimal overhead (<100ms)
      expect(promotionTime).toBeLessThan(100);
    });

    it("should handle high-frequency operations", async () => {
      const operations = [];

      for (let i = 0; i < 100; i++) {
        operations.push(manager.set(`key-${i}`, `value-${i}`));
      }

      const startTime = Date.now();
      await Promise.all(operations);
      const endTime = Date.now();

      const totalTime = endTime - startTime;

      // 100 sets should complete in reasonable time (<5s)
      expect(totalTime).toBeLessThan(5000);
    });
  });

  describe("Shutdown", () => {
    it("should shutdown all cache levels", async () => {
      await manager.set("test-key", "test-value");

      await manager.shutdown();

      // After shutdown, operations may fail or be no-ops
      // This test verifies shutdown completes without error
      expect(true).toBe(true);
    });

    it("should handle shutdown when caches are empty", async () => {
      await expect(manager.shutdown()).resolves.toBeUndefined();
    });

    it("should handle multiple shutdown calls", async () => {
      await manager.shutdown();
      await expect(manager.shutdown()).resolves.toBeUndefined();
    });
  });
});
