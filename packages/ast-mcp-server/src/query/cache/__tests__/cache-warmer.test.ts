/**
 * @fileoverview Unit Tests for CacheWarmer
 *
 * Tests the cache warming system including query analysis, priority calculation,
 * and warming execution.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CacheWarmer } from "../cache-warmer.js";

import type {
  MultiLevelCacheManager,
  WarmingProgress,
  QueryExecutor,
  CacheWarmingConfig,
  CacheOperationResult,
} from "../index.js";

describe("CacheWarmer", () => {
  let mockCacheManager: MultiLevelCacheManager;
  let mockQueryExecutor: QueryExecutor;
  let config: CacheWarmingConfig;

  beforeEach(() => {
    // Mock cache manager
    mockCacheManager = {
      get: vi.fn(),
      set: vi.fn(),
      getTopQueries: vi.fn(),
    } as unknown as MultiLevelCacheManager;

    // Mock query executor
    mockQueryExecutor = vi.fn();

    // Default config
    config = {
      enabled: true,
      onStartup: false,
      topQueriesCount: 50,
      minFrequency: 2,
    };
  });

  describe("Constructor", () => {
    it("should initialize with provided configuration", () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      expect(warmer).toBeDefined();
      expect(warmer.isInProgress()).toBe(false);
    });

    it("should accept custom configuration", () => {
      const customConfig: CacheWarmingConfig = {
        enabled: true,
        onStartup: true,
        topQueriesCount: 100,
        minFrequency: 5,
      };

      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        customConfig,
      );

      expect(warmer).toBeDefined();
    });
  });

  describe("warm()", () => {
    it("should return empty result when warming is disabled", async () => {
      config.enabled = false;
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      const result = await warmer.warm();

      expect(result.totalQueries).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it("should throw error when warming is already in progress", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([]);

      // Start first warming
      const firstWarm = warmer.warm();

      // Try to start second warming
      await expect(warmer.warm()).rejects.toThrow(
        "Cache warming is already in progress",
      );

      await firstWarm;
    });

    it("should return empty result when no top queries available", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([]);

      const result = await warmer.warm();

      expect(result.totalQueries).toBe(0);
      expect(result.successCount).toBe(0);
    });

    it("should warm queries with default configuration", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
        { queryHash: "def456", count: 5 },
      ]);

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        success: false,
        latencyMs: 10,
      } as CacheOperationResult);

      const result = await warmer.warm();

      expect(result.totalQueries).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.failures).toHaveLength(0);
    });

    it("should respect custom count parameter", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
        { queryHash: "def456", count: 5 },
        { queryHash: "ghi789", count: 3 },
      ]);

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        success: false,
        latencyMs: 10,
      } as CacheOperationResult);

      const result = await warmer.warm({ count: 2 });

      expect(result.totalQueries).toBe(2);
    });

    it("should filter queries below minimum frequency", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
        { queryHash: "def456", count: 1 }, // Below minFrequency
      ]);

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        success: false,
        latencyMs: 10,
      } as CacheOperationResult);

      const result = await warmer.warm({ minFrequency: 2 });

      expect(result.totalQueries).toBe(1);
      expect(result.successCount).toBe(1);
    });

    it("should skip queries that are already cached", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
        { queryHash: "def456", count: 5 },
      ]);

      // First query already cached, second not cached
      vi.mocked(mockCacheManager.get)
        .mockResolvedValueOnce({
          success: true,
          value: { test: "data" },
          latencyMs: 10,
        } as CacheOperationResult)
        .mockResolvedValueOnce({
          success: false,
          latencyMs: 10,
        } as CacheOperationResult);

      const result = await warmer.warm();

      expect(result.totalQueries).toBe(2);
      expect(result.successCount).toBe(2);
    });

    it("should call progress callback during warming", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
        { queryHash: "def456", count: 5 },
      ]);

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        success: false,
        latencyMs: 10,
      } as CacheOperationResult);

      const progressUpdates: WarmingProgress[] = [];
      const onProgress = vi.fn((progress: WarmingProgress) => {
        progressUpdates.push({ ...progress });
      });

      await warmer.warm({ onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(progressUpdates.length).toBeGreaterThan(0);

      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress?.completed).toBe(2);
      expect(lastProgress?.total).toBe(2);
    });

    it("should handle errors during warming", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
        { queryHash: "def456", count: 5 },
      ]);

      // First query succeeds, second throws error
      vi.mocked(mockCacheManager.get)
        .mockResolvedValueOnce({
          success: false,
          latencyMs: 10,
        } as CacheOperationResult)
        .mockRejectedValueOnce(new Error("Cache error"));

      const result = await warmer.warm();

      expect(result.totalQueries).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]?.error).toBe("Cache error");
    });

    it("should include duration in result", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
      ]);

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        success: false,
        latencyMs: 10,
      } as CacheOperationResult);

      const result = await warmer.warm();

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("abort()", () => {
    it("should do nothing when warming is not in progress", () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      expect(() => warmer.abort()).not.toThrow();
    });

    it("should abort warming in progress", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
        { queryHash: "def456", count: 5 },
        { queryHash: "ghi789", count: 3 },
      ]);

      // Mock slow cache get
      vi.mocked(mockCacheManager.get).mockImplementation(
        async () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: false,
                  latencyMs: 10,
                }),
              100,
            ),
          ),
      );

      const warmPromise = warmer.warm();

      // Wait a bit then abort
      await new Promise((resolve) => setTimeout(resolve, 50));
      warmer.abort();

      const result = await warmPromise;

      // Should have aborted before completing all queries
      expect(result.successCount).toBeLessThan(3);
    });
  });

  describe("isInProgress()", () => {
    it("should return false initially", () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      expect(warmer.isInProgress()).toBe(false);
    });

    it("should return true during warming", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
      ]);

      vi.mocked(mockCacheManager.get).mockImplementation(
        async () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: false,
                  latencyMs: 10,
                }),
              50,
            ),
          ),
      );

      const warmPromise = warmer.warm();

      // Check during warming
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(warmer.isInProgress()).toBe(true);

      await warmPromise;

      // Check after warming
      expect(warmer.isInProgress()).toBe(false);
    });
  });

  describe("getProgress()", () => {
    it("should return undefined when not warming", () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      expect(warmer.getProgress()).toBeUndefined();
    });

    it("should return progress during warming", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
        { queryHash: "def456", count: 5 },
      ]);

      vi.mocked(mockCacheManager.get).mockImplementation(
        async () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: false,
                  latencyMs: 10,
                }),
              50,
            ),
          ),
      );

      const warmPromise = warmer.warm();

      // Check progress during warming
      await new Promise((resolve) => setTimeout(resolve, 10));
      const progress = warmer.getProgress();

      expect(progress).toBeDefined();
      expect(progress?.total).toBe(2);
      expect(progress?.completed).toBeGreaterThanOrEqual(0);

      await warmPromise;

      // Check after warming
      expect(warmer.getProgress()).toBeUndefined();
    });
  });

  describe("warmOnStartup()", () => {
    it("should return undefined when onStartup is disabled", async () => {
      config.onStartup = false;
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      const result = await warmer.warmOnStartup();

      expect(result).toBeUndefined();
    });

    it("should warm cache when onStartup is enabled", async () => {
      config.onStartup = true;
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
      ]);

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        success: false,
        latencyMs: 10,
      } as CacheOperationResult);

      const result = await warmer.warmOnStartup();

      expect(result).toBeDefined();
      expect(result?.totalQueries).toBe(1);
      expect(result?.successCount).toBe(1);
    });
  });

  describe("Query Priority", () => {
    it("should prioritize frequent queries", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "low-freq", count: 2 },
        { queryHash: "high-freq", count: 100 },
        { queryHash: "mid-freq", count: 10 },
      ]);

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        success: false,
        latencyMs: 10,
      } as CacheOperationResult);

      const progressUpdates: WarmingProgress[] = [];

      await warmer.warm({
        onProgress: (progress) => {
          progressUpdates.push({ ...progress });
        },
      });

      // Verify warming completed (priority affects order, not execution)
      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress?.completed).toBe(3);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty query hash", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "", count: 10 },
      ]);

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        success: false,
        latencyMs: 10,
      } as CacheOperationResult);

      const result = await warmer.warm();

      expect(result.totalQueries).toBe(1);
    });

    it("should handle queries with minFrequency = 0", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 0 },
      ]);

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        success: false,
        latencyMs: 10,
      } as CacheOperationResult);

      const result = await warmer.warm({ minFrequency: 0 });

      expect(result.totalQueries).toBe(1);
    });

    it("should handle very large query counts", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      const largeQueryList = Array.from({ length: 1000 }, (_, i) => ({
        queryHash: `query-${i}`,
        count: 1000 - i,
      }));

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue(
        largeQueryList,
      );

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        success: false,
        latencyMs: 10,
      } as CacheOperationResult);

      const result = await warmer.warm({ count: 100 });

      expect(result.totalQueries).toBe(100);
      expect(result.successCount).toBe(100);
    });
  });

  describe("Progress Tracking", () => {
    it("should update progress with current query", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
        { queryHash: "def456", count: 5 },
      ]);

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        success: false,
        latencyMs: 10,
      } as CacheOperationResult);

      const progressUpdates: WarmingProgress[] = [];

      await warmer.warm({
        onProgress: (progress) => {
          progressUpdates.push({ ...progress });
        },
      });

      // Check that progress includes current query hash
      const progressWithCurrent = progressUpdates.find((p) => p.current);
      expect(progressWithCurrent).toBeDefined();
      expect(progressWithCurrent?.current).toBeTruthy();
    });

    it("should estimate remaining time", async () => {
      const warmer = new CacheWarmer(
        mockCacheManager,
        mockQueryExecutor,
        config,
      );

      vi.mocked(mockCacheManager.getTopQueries).mockResolvedValue([
        { queryHash: "abc123", count: 10 },
        { queryHash: "def456", count: 5 },
      ]);

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        success: false,
        latencyMs: 10,
      } as CacheOperationResult);

      const progressUpdates: WarmingProgress[] = [];

      await warmer.warm({
        onProgress: (progress) => {
          progressUpdates.push({ ...progress });
        },
      });

      // Check that some progress updates include estimated remaining time
      const progressWithEstimate = progressUpdates.find(
        (p) => p.estimatedRemainingMs !== undefined,
      );
      expect(progressWithEstimate).toBeDefined();
    });
  });
});
