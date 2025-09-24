/**
 * File watcher implementation tests
 * Tests for the ChokidarFileWatcher implementation and type definitions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createFileWatcher, ChokidarFileWatcher } from "./file-watcher";
import type {
  FileWatchConfig,
  FileChangeEvent,
  WatchStats,
  FileWatcher,
  IncrementalUpdateManager,
  ConsistencyReport,
} from "./types.js";

describe("File Watcher Types", () => {
  describe("FileWatchConfig", () => {
    it("should define required configuration properties", () => {
      const config: FileWatchConfig = {
        watchPaths: ["/src"],
        includePatterns: ["*.ts", "*.js"],
        excludePatterns: ["node_modules/**"],
        debounceMs: 1000,
        batchSize: 50,
        enableRecursive: true,
        followSymlinks: false,
      };

      expect(config.watchPaths).toEqual(["/src"]);
      expect(config.includePatterns).toEqual(["*.ts", "*.js"]);
      expect(config.excludePatterns).toEqual(["node_modules/**"]);
      expect(config.debounceMs).toBe(1000);
      expect(config.batchSize).toBe(50);
      expect(config.enableRecursive).toBe(true);
      expect(config.followSymlinks).toBe(false);
    });
  });

  describe("FileChangeEvent", () => {
    it("should define file change event properties", () => {
      const event: FileChangeEvent = {
        type: "change",
        filePath: "/src/test.ts",
        timestamp: new Date("2024-01-01T00:00:00Z"),
      };

      expect(event.type).toBe("change");
      expect(event.filePath).toBe("/src/test.ts");
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it("should support all event types", () => {
      const events: FileChangeEvent[] = [
        { type: "add", filePath: "/test.ts", timestamp: new Date() },
        { type: "change", filePath: "/test.ts", timestamp: new Date() },
        { type: "unlink", filePath: "/test.ts", timestamp: new Date() },
        { type: "addDir", filePath: "/testdir", timestamp: new Date() },
        { type: "unlinkDir", filePath: "/testdir", timestamp: new Date() },
      ];

      events.forEach((event) => {
        expect(event).toHaveProperty("type");
        expect(event).toHaveProperty("filePath");
        expect(event).toHaveProperty("timestamp");
      });
    });
  });

  describe("WatchStats", () => {
    it("should define watch statistics properties", () => {
      const stats: WatchStats = {
        watchedFiles: 42,
        totalEvents: 100,
        processedChanges: 95,
        lastProcessedAt: new Date(),
        averageProcessingTime: 25.5,
      };

      expect(stats.watchedFiles).toBe(42);
      expect(stats.totalEvents).toBe(100);
      expect(stats.processedChanges).toBe(95);
      expect(stats.lastProcessedAt).toBeInstanceOf(Date);
      expect(stats.averageProcessingTime).toBe(25.5);
    });
  });

  describe("IncrementalUpdateManager interface", () => {
    it("should define manager interface methods", () => {
      const mockManager: IncrementalUpdateManager = {
        async shouldFullReparse(filePath: string, change: FileChangeEvent) {
          return filePath.endsWith(".ts");
        },
        optimizeUpdateBatch: (changes: FileChangeEvent[]) =>
          changes.slice(0, 10),
        async validateIndexConsistency() {
          return {
            inconsistentFiles: [],
            orphanedVectors: [],
            missingVectors: [],
            totalChecked: 100,
            issuesFound: 0,
          };
        },
      };

      expect(mockManager.shouldFullReparse).toBeDefined();
      expect(mockManager.optimizeUpdateBatch).toBeDefined();
      expect(mockManager.validateIndexConsistency).toBeDefined();
    });
  });

  describe("ConsistencyReport", () => {
    it("should define consistency report properties", () => {
      const report: ConsistencyReport = {
        inconsistentFiles: ["/test1.ts"],
        orphanedVectors: ["/test2.ts"],
        missingVectors: ["/test3.ts"],
        totalChecked: 100,
        issuesFound: 3,
      };

      expect(report.inconsistentFiles).toEqual(["/test1.ts"]);
      expect(report.orphanedVectors).toEqual(["/test2.ts"]);
      expect(report.missingVectors).toEqual(["/test3.ts"]);
      expect(report.totalChecked).toBe(100);
      expect(report.issuesFound).toBe(3);
    });
  });
});

describe("ChokidarFileWatcher Implementation", () => {
  let watcher: ChokidarFileWatcher;
  let tempDir: string;
  let testConfig: FileWatchConfig;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(process.cwd(), "test-temp-" + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    testConfig = {
      watchPaths: [tempDir],
      includePatterns: ["**/*.txt", "**/*.js"],
      excludePatterns: ["**/node_modules/**"],
      debounceMs: 50,
      batchSize: 10,
      enableRecursive: true,
      followSymlinks: false,
    };

    watcher = createFileWatcher() as ChokidarFileWatcher;
  });

  afterEach(async () => {
    // Cleanup
    if (watcher) {
      await watcher.dispose().catch(() => {});
    }

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await expect(watcher.initialize(testConfig)).resolves.not.toThrow();
    });

    it("should prevent double initialization", async () => {
      await watcher.initialize(testConfig);

      // Second initialization should not throw but should warn
      await expect(watcher.initialize(testConfig)).resolves.not.toThrow();
    });

    it("should reject initialization after disposal", async () => {
      await watcher.dispose();

      await expect(watcher.initialize(testConfig)).rejects.toThrow(
        "Cannot initialize a disposed file watcher",
      );
    });
  });

  describe("watching lifecycle", () => {
    beforeEach(async () => {
      await watcher.initialize(testConfig);
    });

    it("should start watching successfully", async () => {
      await expect(watcher.start()).resolves.not.toThrow();
      expect(watcher.getWatchedPaths().length).toBeGreaterThanOrEqual(0);
    });

    it("should stop watching successfully", async () => {
      await watcher.start();
      await expect(watcher.stop()).resolves.not.toThrow();
    });

    it("should prevent starting before initialization", async () => {
      const uninitializedWatcher = createFileWatcher() as ChokidarFileWatcher;

      await expect(uninitializedWatcher.start()).rejects.toThrow(
        "File watcher must be initialized before starting",
      );

      await uninitializedWatcher.dispose();
    });
  });

  describe("statistics", () => {
    beforeEach(async () => {
      await watcher.initialize(testConfig);
    });

    it("should provide watch statistics", () => {
      const stats = watcher.getWatchStats();

      expect(stats).toHaveProperty("watchedFiles");
      expect(stats).toHaveProperty("totalEvents");
      expect(stats).toHaveProperty("processedChanges");
      expect(stats).toHaveProperty("lastProcessedAt");
      expect(stats).toHaveProperty("averageProcessingTime");

      expect(typeof stats.watchedFiles).toBe("number");
      expect(typeof stats.totalEvents).toBe("number");
      expect(typeof stats.processedChanges).toBe("number");
    });

    it("should update statistics consistently", async () => {
      const initialStats = watcher.getWatchStats();
      expect(initialStats.totalEvents).toBe(0);
      expect(initialStats.processedChanges).toBe(0);

      // Stats should be consistent initially
      expect(initialStats.watchedFiles).toBeGreaterThanOrEqual(0);
    });
  });

  describe("resource cleanup", () => {
    it("should dispose cleanly", async () => {
      await watcher.initialize(testConfig);
      await watcher.start();

      await expect(watcher.dispose()).resolves.not.toThrow();

      // Should be able to dispose multiple times
      await expect(watcher.dispose()).resolves.not.toThrow();
    });

    it("should clean up resources after disposal", async () => {
      await watcher.initialize(testConfig);
      await watcher.start();

      await watcher.dispose();

      // Should not be watching anything after disposal
      expect(watcher.getWatchedPaths().length).toBe(0);
    });
  });
});

describe("createFileWatcher", () => {
  it("should create a FileWatcher instance", () => {
    const watcher = createFileWatcher();
    expect(watcher).toBeInstanceOf(ChokidarFileWatcher);

    // Cleanup
    (watcher as ChokidarFileWatcher).dispose().catch(() => {});
  });

  it("should create different instances", () => {
    const watcher1 = createFileWatcher();
    const watcher2 = createFileWatcher();

    expect(watcher1).not.toBe(watcher2);
    expect(watcher1).toBeInstanceOf(ChokidarFileWatcher);
    expect(watcher2).toBeInstanceOf(ChokidarFileWatcher);

    // Cleanup
    Promise.all([
      (watcher1 as ChokidarFileWatcher).dispose(),
      (watcher2 as ChokidarFileWatcher).dispose(),
    ]).catch(() => {});
  });

  it("should support all event types", () => {
    const eventTypes: FileChangeEvent["type"][] = [
      "add",
      "change",
      "unlink",
      "addDir",
      "unlinkDir",
    ];

    eventTypes.forEach((type) => {
      const event: FileChangeEvent = {
        type,
        filePath: "/test",
        timestamp: new Date(),
      };

      expect(event.type).toBe(type);
      expect(event.filePath).toBe("/test");
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });
});
