/**
 * @fileoverview Comprehensive unit tests for QueryLogStorage
 *
 * Tests all query log functionality including:
 * - Query logging
 * - Recent queries retrieval
 * - Top queries by frequency
 * - Statistics calculation
 * - Old entry cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { QueryLogStorage, type QueryLogEntry } from "../query-log-storage.js";

describe("QueryLogStorage", () => {
  const testDir = join(process.cwd(), ".test-query-log");
  let storage: QueryLogStorage;

  const createMockEntry = (
    overrides: Partial<QueryLogEntry> = {},
  ): QueryLogEntry => ({
    queryText: "test query",
    queryHash: "hash123",
    options: JSON.stringify({ limit: 10 }),
    resultCount: 5,
    executionTimeMs: 100,
    cacheHit: false,
    timestamp: Date.now(),
    indexVersion: "1.0.0",
    ...overrides,
  });

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
    await mkdir(testDir, { recursive: true });

    // Create storage instance
    storage = new QueryLogStorage(testDir);
    await storage.initialize();
  });

  afterEach(async () => {
    // Clean up
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe("logQuery", () => {
    it("should log a query successfully", async () => {
      const entry = createMockEntry();

      await storage.logQuery(entry);

      const recent = await storage.getRecentQueries(1);
      expect(recent).toHaveLength(1);
      expect(recent[0].queryText).toBe(entry.queryText);
      expect(recent[0].queryHash).toBe(entry.queryHash);
      expect(recent[0].resultCount).toBe(entry.resultCount);
    });

    it("should log multiple queries", async () => {
      await storage.logQuery(createMockEntry({ queryText: "query1" }));
      await storage.logQuery(createMockEntry({ queryText: "query2" }));
      await storage.logQuery(createMockEntry({ queryText: "query3" }));

      const recent = await storage.getRecentQueries(10);
      expect(recent).toHaveLength(3);
    });

    it("should store cache hit information", async () => {
      await storage.logQuery(
        createMockEntry({ queryHash: "hash1", cacheHit: true }),
      );
      await storage.logQuery(
        createMockEntry({ queryHash: "hash2", cacheHit: false }),
      );

      const recent = await storage.getRecentQueries(10);
      expect(recent.find((r) => r.queryHash === "hash1")?.cacheHit).toBe(true);
      expect(recent.find((r) => r.queryHash === "hash2")?.cacheHit).toBe(false);
    });

    it("should store execution time", async () => {
      const entry = createMockEntry({ executionTimeMs: 250.5 });

      await storage.logQuery(entry);

      const recent = await storage.getRecentQueries(1);
      expect(recent[0].executionTimeMs).toBeCloseTo(250.5, 1);
    });

    it("should store query options as JSON", async () => {
      const options = { limit: 20, offset: 10, filter: "active" };
      const entry = createMockEntry({ options: JSON.stringify(options) });

      await storage.logQuery(entry);

      const recent = await storage.getRecentQueries(1);
      expect(JSON.parse(recent[0].options)).toEqual(options);
    });
  });

  describe("getRecentQueries", () => {
    it("should return empty array when no queries logged", async () => {
      const recent = await storage.getRecentQueries(10);
      expect(recent).toEqual([]);
    });

    it("should return queries in descending timestamp order", async () => {
      const now = Date.now();
      await storage.logQuery(
        createMockEntry({ queryHash: "old", timestamp: now - 3000 }),
      );
      await storage.logQuery(
        createMockEntry({ queryHash: "mid", timestamp: now - 2000 }),
      );
      await storage.logQuery(
        createMockEntry({ queryHash: "new", timestamp: now - 1000 }),
      );

      const recent = await storage.getRecentQueries(10);
      expect(recent[0].queryHash).toBe("new");
      expect(recent[1].queryHash).toBe("mid");
      expect(recent[2].queryHash).toBe("old");
    });

    it("should respect limit parameter", async () => {
      // Log 10 queries
      for (let i = 0; i < 10; i++) {
        await storage.logQuery(
          createMockEntry({ queryHash: `hash${i}`, timestamp: Date.now() + i }),
        );
      }

      const recent = await storage.getRecentQueries(5);
      expect(recent).toHaveLength(5);
    });

    it("should use default limit of 100", async () => {
      // Log 150 queries
      for (let i = 0; i < 150; i++) {
        await storage.logQuery(
          createMockEntry({ queryHash: `hash${i}`, timestamp: Date.now() + i }),
        );
      }

      const recent = await storage.getRecentQueries();
      expect(recent).toHaveLength(100);
    });
  });

  describe("getTopQueries", () => {
    it("should return empty array when no queries logged", async () => {
      const top = await storage.getTopQueries(10);
      expect(top).toEqual([]);
    });

    it("should return queries ordered by frequency", async () => {
      // Log queries with different frequencies
      await storage.logQuery(createMockEntry({ queryHash: "frequent" }));
      await storage.logQuery(createMockEntry({ queryHash: "frequent" }));
      await storage.logQuery(createMockEntry({ queryHash: "frequent" }));
      await storage.logQuery(createMockEntry({ queryHash: "occasional" }));
      await storage.logQuery(createMockEntry({ queryHash: "occasional" }));
      await storage.logQuery(createMockEntry({ queryHash: "rare" }));

      const top = await storage.getTopQueries(10);
      expect(top[0].queryHash).toBe("frequent");
      expect(top[0].count).toBe(3);
      expect(top[1].queryHash).toBe("occasional");
      expect(top[1].count).toBe(2);
      expect(top[2].queryHash).toBe("rare");
      expect(top[2].count).toBe(1);
    });

    it("should calculate average execution time per query", async () => {
      await storage.logQuery(
        createMockEntry({ queryHash: "query1", executionTimeMs: 100 }),
      );
      await storage.logQuery(
        createMockEntry({ queryHash: "query1", executionTimeMs: 200 }),
      );
      await storage.logQuery(
        createMockEntry({ queryHash: "query1", executionTimeMs: 300 }),
      );

      const top = await storage.getTopQueries(10);
      expect(top[0].avgExecutionTime).toBeCloseTo(200, 0);
    });

    it("should respect limit parameter", async () => {
      // Log 10 different queries
      for (let i = 0; i < 10; i++) {
        await storage.logQuery(createMockEntry({ queryHash: `hash${i}` }));
      }

      const top = await storage.getTopQueries(5);
      expect(top).toHaveLength(5);
    });

    it("should filter by time range (sinceDays)", async () => {
      const now = Date.now();
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
      const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;

      await storage.logQuery(
        createMockEntry({ queryHash: "recent", timestamp: twoDaysAgo }),
      );
      await storage.logQuery(
        createMockEntry({ queryHash: "old", timestamp: tenDaysAgo }),
      );

      // Get only last 5 days
      const top = await storage.getTopQueries(10, 5);
      expect(top).toHaveLength(1);
      expect(top[0].queryHash).toBe("recent");
    });

    it("should include query text in results", async () => {
      await storage.logQuery(
        createMockEntry({
          queryHash: "hash1",
          queryText: "SELECT * FROM table",
        }),
      );

      const top = await storage.getTopQueries(10);
      expect(top[0].queryText).toBe("SELECT * FROM table");
    });
  });

  describe("getStatistics", () => {
    it("should return zero statistics when no queries logged", async () => {
      const stats = await storage.getStatistics();

      expect(stats.totalQueries).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
      expect(stats.topQueries).toEqual([]);
    });

    it("should calculate total queries correctly", async () => {
      await storage.logQuery(createMockEntry());
      await storage.logQuery(createMockEntry());
      await storage.logQuery(createMockEntry());

      const stats = await storage.getStatistics();
      expect(stats.totalQueries).toBe(3);
    });

    it("should calculate cache hit rate correctly", async () => {
      await storage.logQuery(createMockEntry({ cacheHit: true }));
      await storage.logQuery(createMockEntry({ cacheHit: true }));
      await storage.logQuery(createMockEntry({ cacheHit: true }));
      await storage.logQuery(createMockEntry({ cacheHit: false }));
      await storage.logQuery(createMockEntry({ cacheHit: false }));

      const stats = await storage.getStatistics();
      expect(stats.totalQueries).toBe(5);
      expect(stats.cacheHitRate).toBeCloseTo(0.6, 2); // 3/5 = 0.6
    });

    it("should calculate average execution time correctly", async () => {
      await storage.logQuery(createMockEntry({ executionTimeMs: 100 }));
      await storage.logQuery(createMockEntry({ executionTimeMs: 200 }));
      await storage.logQuery(createMockEntry({ executionTimeMs: 300 }));

      const stats = await storage.getStatistics();
      expect(stats.averageExecutionTime).toBeCloseTo(200, 0);
    });

    it("should include top queries in statistics", async () => {
      await storage.logQuery(createMockEntry({ queryHash: "popular" }));
      await storage.logQuery(createMockEntry({ queryHash: "popular" }));
      await storage.logQuery(createMockEntry({ queryHash: "rare" }));

      const stats = await storage.getStatistics();
      expect(stats.topQueries).toHaveLength(2);
      expect(stats.topQueries[0].queryHash).toBe("popular");
    });

    it("should filter statistics by date range", async () => {
      const now = Date.now();
      const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

      await storage.logQuery(
        createMockEntry({ queryHash: "recent", timestamp: now }),
      );
      await storage.logQuery(
        createMockEntry({ queryHash: "old", timestamp: sixtyDaysAgo }),
      );

      const statsLast30Days = await storage.getStatistics(30);
      expect(statsLast30Days.totalQueries).toBe(1);

      const statsLast90Days = await storage.getStatistics(90);
      expect(statsLast90Days.totalQueries).toBe(2);
    });
  });

  describe("cleanOldEntries", () => {
    it("should return 0 when no old entries to clean", async () => {
      const deleted = await storage.cleanOldEntries(90);
      expect(deleted).toBe(0);
    });

    it("should delete entries older than specified days", async () => {
      const now = Date.now();
      const ninetyOneDaysAgo = now - 91 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      await storage.logQuery(
        createMockEntry({ queryHash: "old", timestamp: ninetyOneDaysAgo }),
      );
      await storage.logQuery(
        createMockEntry({ queryHash: "recent", timestamp: thirtyDaysAgo }),
      );

      const deleted = await storage.cleanOldEntries(90);
      expect(deleted).toBe(1);

      const remaining = await storage.getRecentQueries(10);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].queryHash).toBe("recent");
    });

    it("should return count of deleted entries", async () => {
      const old = Date.now() - 100 * 24 * 60 * 60 * 1000;

      await storage.logQuery(createMockEntry({ timestamp: old }));
      await storage.logQuery(createMockEntry({ timestamp: old }));
      await storage.logQuery(createMockEntry({ timestamp: old }));

      const deleted = await storage.cleanOldEntries(90);
      expect(deleted).toBe(3);
    });

    it("should use default of 90 days", async () => {
      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;

      await storage.logQuery(
        createMockEntry({ queryHash: "old", timestamp: ninetyOneDaysAgo }),
      );

      const deleted = await storage.cleanOldEntries();
      expect(deleted).toBe(1);
    });

    it("should preserve recent entries", async () => {
      const old = Date.now() - 100 * 24 * 60 * 60 * 1000;
      const recent = Date.now();

      await storage.logQuery(
        createMockEntry({ queryHash: "old", timestamp: old }),
      );
      await storage.logQuery(
        createMockEntry({ queryHash: "recent1", timestamp: recent }),
      );
      await storage.logQuery(
        createMockEntry({ queryHash: "recent2", timestamp: recent }),
      );

      await storage.cleanOldEntries(90);

      const remaining = await storage.getRecentQueries(10);
      expect(remaining).toHaveLength(2);
      expect(remaining.every((r) => r.queryHash.startsWith("recent"))).toBe(
        true,
      );
    });
  });

  describe("getQueriesForWarming", () => {
    it("should return queries suitable for cache warming", async () => {
      // Log frequent queries (at least 3 times for default minFrequency)
      await storage.logQuery(createMockEntry({ queryHash: "frequent" }));
      await storage.logQuery(createMockEntry({ queryHash: "frequent" }));
      await storage.logQuery(createMockEntry({ queryHash: "frequent" }));

      const warmingQueries = await storage.getQueriesForWarming(3, 7);
      expect(Array.isArray(warmingQueries)).toBe(true);
      expect(warmingQueries.length).toBeGreaterThan(0);
      expect(warmingQueries[0].queryHash).toBe("frequent");
      expect(warmingQueries[0].frequency).toBe(3);
    });

    it("should prioritize frequent queries for warming", async () => {
      // Log queries with different frequencies
      await storage.logQuery(createMockEntry({ queryHash: "frequent" }));
      await storage.logQuery(createMockEntry({ queryHash: "frequent" }));
      await storage.logQuery(createMockEntry({ queryHash: "frequent" }));
      await storage.logQuery(createMockEntry({ queryHash: "frequent" }));
      await storage.logQuery(createMockEntry({ queryHash: "occasional" }));
      await storage.logQuery(createMockEntry({ queryHash: "occasional" }));
      await storage.logQuery(createMockEntry({ queryHash: "occasional" }));

      // Get queries with minFrequency of 3
      const warmingQueries = await storage.getQueriesForWarming(3, 7);
      expect(warmingQueries.length).toBe(2);
      expect(warmingQueries[0].queryHash).toBe("frequent");
      expect(warmingQueries[0].frequency).toBe(4);
      expect(warmingQueries[1].queryHash).toBe("occasional");
      expect(warmingQueries[1].frequency).toBe(3);
    });
  });

  describe("integration scenarios", () => {
    it("should handle mixed cache hit/miss logging", async () => {
      await storage.logQuery(
        createMockEntry({ queryHash: "q1", cacheHit: true }),
      );
      await storage.logQuery(
        createMockEntry({ queryHash: "q2", cacheHit: false }),
      );
      await storage.logQuery(
        createMockEntry({ queryHash: "q1", cacheHit: true }),
      );

      const stats = await storage.getStatistics();
      expect(stats.totalQueries).toBe(3);
      expect(stats.cacheHitRate).toBeCloseTo(0.667, 2);
    });

    it("should track performance improvements over time", async () => {
      const now = Date.now();

      // Simulate slow queries initially
      await storage.logQuery(
        createMockEntry({
          queryHash: "q1",
          executionTimeMs: 500,
          timestamp: now - 60000,
        }),
      );

      // Then faster queries with cache hits
      await storage.logQuery(
        createMockEntry({
          queryHash: "q1",
          executionTimeMs: 50,
          cacheHit: true,
          timestamp: now,
        }),
      );

      const top = await storage.getTopQueries(1);
      expect(top[0].avgExecutionTime).toBeCloseTo(275, 0);
    });

    it("should handle concurrent logging", async () => {
      await Promise.all([
        storage.logQuery(createMockEntry({ queryHash: "q1" })),
        storage.logQuery(createMockEntry({ queryHash: "q2" })),
        storage.logQuery(createMockEntry({ queryHash: "q3" })),
      ]);

      const recent = await storage.getRecentQueries(10);
      expect(recent).toHaveLength(3);
    });
  });
});
