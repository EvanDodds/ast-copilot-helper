/**
 * Tests for cache management commands
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  clearCache,
  showCacheStats,
  warmCache,
  pruneCache,
  analyzeCache,
  CacheClearCommandHandler,
  CacheStatsCommandHandler,
  CacheWarmCommandHandler,
  CachePruneCommandHandler,
  CacheAnalyzeCommandHandler,
} from "../cache.js";
import type { Config } from "../../types.js";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

// Mock dependencies
vi.mock("node:fs");
vi.mock("node:fs/promises");
vi.mock("../../logging/index.js", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe("Cache Commands", () => {
  let mockConfig: Config;
  let mockProcessStdoutWrite: any;

  beforeEach(() => {
    // Create mock config
    mockConfig = {
      parseGlob: ["**/*.{js,ts,py}"],
      watchGlob: ["**/*.{js,ts,py}"],
      topK: 10,
      snippetLines: 5,
      modelHost: "local",
      enableTelemetry: false,
      concurrency: 4,
      batchSize: 100,
      outputDir: ".astdb",
      indexParams: {
        efConstruction: 200,
        M: 16,
      },
      model: {
        defaultModel: "codebert-base",
        modelsDir: ".astdb/models",
        downloadTimeout: 30000,
        maxConcurrentDownloads: 2,
        showProgress: true,
      },
    };

    // Mock process.stdout.write
    mockProcessStdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockProcessStdoutWrite.mockRestore();
  });

  describe("clearCache", () => {
    it("should clear all cache levels by default", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(rm).mockResolvedValue(undefined);

      await clearCache(mockConfig, { level: "all" });

      // Should attempt to remove L2 and L3
      expect(rm).toHaveBeenCalledWith(
        join(mockConfig.outputDir, ".cache", "l2-disk"),
        { recursive: true, force: true },
      );
      expect(rm).toHaveBeenCalledWith(
        join(mockConfig.outputDir, ".cache", "l3-cache.db"),
        { force: true },
      );
    });

    it("should clear only L1 cache when specified", async () => {
      await clearCache(mockConfig, { level: "L1" });

      // L1 is memory-only, no file operations
      expect(rm).not.toHaveBeenCalled();
    });

    it("should clear only L2 cache when specified", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(rm).mockResolvedValue(undefined);

      await clearCache(mockConfig, { level: "L2" });

      // Should only remove L2
      expect(rm).toHaveBeenCalledWith(
        join(mockConfig.outputDir, ".cache", "l2-disk"),
        { recursive: true, force: true },
      );
      expect(rm).toHaveBeenCalledTimes(1);
    });

    it("should clear only L3 cache when specified", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(rm).mockResolvedValue(undefined);

      await clearCache(mockConfig, { level: "L3" });

      // Should remove L3 database and WAL files
      expect(rm).toHaveBeenCalledWith(
        join(mockConfig.outputDir, ".cache", "l3-cache.db"),
        { force: true },
      );
    });

    it("should handle non-existent cache directories gracefully", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await clearCache(mockConfig, { level: "all" });

      // Should not attempt to remove non-existent files
      expect(rm).not.toHaveBeenCalled();
    });

    it("should use default level 'all' when not specified", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await clearCache(mockConfig, {});

      // Should check for all cache levels
      expect(existsSync).toHaveBeenCalledWith(
        join(mockConfig.outputDir, ".cache", "l2-disk"),
      );
      expect(existsSync).toHaveBeenCalledWith(
        join(mockConfig.outputDir, ".cache", "l3-cache.db"),
      );
    });

    it("should remove L3 WAL files when database exists", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(rm).mockResolvedValue(undefined);

      await clearCache(mockConfig, { level: "L3" });

      // Should remove .db, .db-shm, and .db-wal files
      expect(rm).toHaveBeenCalledWith(
        join(mockConfig.outputDir, ".cache", "l3-cache.db"),
        { force: true },
      );
      expect(rm).toHaveBeenCalledWith(
        join(mockConfig.outputDir, ".cache", "l3-cache.db-shm"),
        { force: true },
      );
      expect(rm).toHaveBeenCalledWith(
        join(mockConfig.outputDir, ".cache", "l3-cache.db-wal"),
        { force: true },
      );
    });
  });

  describe("showCacheStats", () => {
    it("should display cache statistics in text format by default", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await showCacheStats(mockConfig, {});

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("=== Cache Statistics ==="),
      );
      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("L1 (Memory)"),
      );
      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("L2 (Disk)"),
      );
      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("L3 (Database)"),
      );
    });

    it("should display cache statistics in JSON format when requested", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await showCacheStats(mockConfig, { json: true });

      // Should output JSON
      const output = mockProcessStdoutWrite.mock.calls
        .map((call: any) => call[0])
        .join("");
      expect(() => JSON.parse(output)).not.toThrow();

      const jsonOutput = JSON.parse(output);
      expect(jsonOutput).toHaveProperty("cacheEnabled");
      expect(jsonOutput).toHaveProperty("levels");
      expect(jsonOutput.levels).toHaveProperty("L1");
      expect(jsonOutput.levels).toHaveProperty("L2");
      expect(jsonOutput.levels).toHaveProperty("L3");
    });

    it("should show L2 cache as existing when directory exists", async () => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.includes("l2-disk");
      });

      await showCacheStats(mockConfig, { json: true });

      const output = mockProcessStdoutWrite.mock.calls
        .map((call: any) => call[0])
        .join("");
      const jsonOutput = JSON.parse(output);

      expect(jsonOutput.levels.L2.exists).toBe(true);
      expect(jsonOutput.levels.L2.status).toBe("initialized");
    });

    it("should show L3 cache as existing when database exists", async () => {
      vi.mocked(existsSync).mockImplementation((path: any) => {
        return (
          path.includes("l3-cache.db") &&
          !path.includes("-shm") &&
          !path.includes("-wal")
        );
      });

      await showCacheStats(mockConfig, { json: true });

      const output = mockProcessStdoutWrite.mock.calls
        .map((call: any) => call[0])
        .join("");
      const jsonOutput = JSON.parse(output);

      expect(jsonOutput.levels.L3.exists).toBe(true);
      expect(jsonOutput.levels.L3.status).toBe("initialized");
    });

    it("should include note about MCP server for runtime stats", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await showCacheStats(mockConfig, {});

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("MCP server"),
      );
    });

    it("should handle detailed stats option", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await showCacheStats(mockConfig, { detailed: true });

      // Should still display stats (detailed requires MCP server for runtime data)
      expect(mockProcessStdoutWrite).toHaveBeenCalled();
    });
  });

  describe("warmCache", () => {
    it("should display dry-run message when in dry-run mode", async () => {
      await warmCache(mockConfig, { count: 50, dryRun: true });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        "[DRY RUN] Would warm cache with top 50 queries\n",
      );
    });

    it("should use custom count when specified", async () => {
      await warmCache(mockConfig, { count: 100, dryRun: true });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        "[DRY RUN] Would warm cache with top 100 queries\n",
      );
    });

    it("should use default count of 50 when not specified", async () => {
      await warmCache(mockConfig, { dryRun: true });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        "[DRY RUN] Would warm cache with top 50 queries\n",
      );
    });

    it("should display placeholder message when not in dry-run mode", async () => {
      await warmCache(mockConfig, { count: 50 });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("not yet implemented"),
      );
      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("MCP server"),
      );
    });

    it("should mention configuration in output", async () => {
      await warmCache(mockConfig, { count: 75 });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("75 top queries"),
      );
    });
  });

  describe("pruneCache", () => {
    it("should parse duration string correctly for days", async () => {
      await pruneCache(mockConfig, { olderThan: "7d", dryRun: true });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("7d"),
      );
    });

    it("should parse duration string correctly for hours", async () => {
      await pruneCache(mockConfig, { olderThan: "24h", dryRun: true });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("24h"),
      );
    });

    it("should parse duration string correctly for minutes", async () => {
      await pruneCache(mockConfig, { olderThan: "30m", dryRun: true });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("30m"),
      );
    });

    it("should use default duration of 7d when not specified", async () => {
      await pruneCache(mockConfig, { dryRun: true });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("7d"),
      );
    });

    it("should use default level 'all' when not specified", async () => {
      await pruneCache(mockConfig, { olderThan: "14d", dryRun: true });

      // Should not throw and should complete
      expect(mockProcessStdoutWrite).toHaveBeenCalled();
    });

    it("should display dry-run message with timestamp", async () => {
      await pruneCache(mockConfig, {
        olderThan: "7d",
        level: "L2",
        dryRun: true,
      });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringMatching(/\[DRY RUN\].*7d.*\d{4}-\d{2}-\d{2}T/),
      );
    });

    it("should display placeholder message when not in dry-run mode", async () => {
      await pruneCache(mockConfig, { olderThan: "7d", level: "all" });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("not yet implemented"),
      );
      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("MCP server"),
      );
    });

    it("should mention specific level in output", async () => {
      await pruneCache(mockConfig, { olderThan: "14d", level: "L3" });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("L3 cache"),
      );
    });
  });

  describe("analyzeCache", () => {
    it("should display placeholder message", async () => {
      await analyzeCache(mockConfig, {});

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("not yet implemented"),
      );
      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("MCP server"),
      );
    });

    it("should display recommendations when requested", async () => {
      await analyzeCache(mockConfig, { recommendations: true });

      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("Cache Optimization Recommendations"),
      );
      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("cache warming"),
      );
      expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("TTL values"),
      );
    });

    it("should use default topQueries of 20 when not specified", async () => {
      await analyzeCache(mockConfig, {});

      // Should not throw and should complete
      expect(mockProcessStdoutWrite).toHaveBeenCalled();
    });

    it("should use custom topQueries when specified", async () => {
      await analyzeCache(mockConfig, { topQueries: 50 });

      // Should not throw and should complete
      expect(mockProcessStdoutWrite).toHaveBeenCalled();
    });

    it("should use default format 'text' when not specified", async () => {
      await analyzeCache(mockConfig, {});

      // Should not throw and should complete
      expect(mockProcessStdoutWrite).toHaveBeenCalled();
    });

    it("should accept different format options", async () => {
      await analyzeCache(mockConfig, { format: "json" });
      expect(mockProcessStdoutWrite).toHaveBeenCalled();

      vi.clearAllMocks();
      await analyzeCache(mockConfig, { format: "markdown" });
      expect(mockProcessStdoutWrite).toHaveBeenCalled();

      vi.clearAllMocks();
      await analyzeCache(mockConfig, { format: "text" });
      expect(mockProcessStdoutWrite).toHaveBeenCalled();
    });
  });

  describe("Command Handlers", () => {
    describe("CacheClearCommandHandler", () => {
      it("should execute clearCache with correct parameters", async () => {
        vi.mocked(existsSync).mockReturnValue(false);

        const handler = new CacheClearCommandHandler();
        const options = { level: "all" as const };

        await handler.execute(options, mockConfig);

        // Should complete without errors
        expect(existsSync).toHaveBeenCalled();
      });
    });

    describe("CacheStatsCommandHandler", () => {
      it("should execute showCacheStats with correct parameters", async () => {
        vi.mocked(existsSync).mockReturnValue(false);

        const handler = new CacheStatsCommandHandler();
        const options = { json: true };

        await handler.execute(options, mockConfig);

        expect(mockProcessStdoutWrite).toHaveBeenCalled();
      });
    });

    describe("CacheWarmCommandHandler", () => {
      it("should execute warmCache with correct parameters", async () => {
        const handler = new CacheWarmCommandHandler();
        const options = { count: 100, dryRun: true };

        await handler.execute(options, mockConfig);

        expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
          expect.stringContaining("100 queries"),
        );
      });
    });

    describe("CachePruneCommandHandler", () => {
      it("should execute pruneCache with correct parameters", async () => {
        const handler = new CachePruneCommandHandler();
        const options = {
          olderThan: "14d",
          level: "L2" as const,
          dryRun: true,
        };

        await handler.execute(options, mockConfig);

        expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
          expect.stringContaining("14d"),
        );
      });
    });

    describe("CacheAnalyzeCommandHandler", () => {
      it("should execute analyzeCache with correct parameters", async () => {
        const handler = new CacheAnalyzeCommandHandler();
        const options = { topQueries: 50, recommendations: true };

        await handler.execute(options, mockConfig);

        expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
          expect.stringContaining("Recommendations"),
        );
      });
    });
  });
});
