import { describe, it, expect } from "vitest";
import { SnapshotRestorer } from "../snapshot-restorer.js";
import type { SnapshotRestoreOptions } from "../types.js";

/**
 * Snapshot Restorer Tests
 *
 * These tests verify the SnapshotRestorer class behavior.
 * Note: Full integration tests with real files are in integration.test.ts
 */
describe("SnapshotRestorer", () => {
  describe("constructor", () => {
    it("should create instance", () => {
      const restorer = new SnapshotRestorer();
      expect(restorer).toBeInstanceOf(SnapshotRestorer);
    });

    it("should create multiple instances", () => {
      const restorer1 = new SnapshotRestorer();
      const restorer2 = new SnapshotRestorer();

      expect(restorer1).toBeInstanceOf(SnapshotRestorer);
      expect(restorer2).toBeInstanceOf(SnapshotRestorer);
    });
  });

  describe("validation", () => {
    it("should require snapshotPath", async () => {
      const restorer = new SnapshotRestorer();

      const options = {
        targetPath: "/tmp/.astdb",
      } as SnapshotRestoreOptions;

      const result = await restorer.restore(options);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should require targetPath", async () => {
      const restorer = new SnapshotRestorer();

      const options = {
        snapshotPath: "/tmp/snapshot.tar.gz",
      } as SnapshotRestoreOptions;

      const result = await restorer.restore(options);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject non-existent snapshot file", async () => {
      const restorer = new SnapshotRestorer();

      const options: SnapshotRestoreOptions = {
        snapshotPath: "/nonexistent/snapshot.tar.gz",
        targetPath: "/tmp/.astdb",
      };

      const result = await restorer.restore(options);
      expect(result.success).toBe(false);
    });
  });

  describe("options", () => {
    it("should accept minimal required options", () => {
      const options: SnapshotRestoreOptions = {
        snapshotPath: "/tmp/snapshot.tar.gz",
        targetPath: "/tmp/.astdb",
      };

      expect(options.snapshotPath).toBe("/tmp/snapshot.tar.gz");
      expect(options.targetPath).toBe("/tmp/.astdb");
    });

    it("should accept all optional fields", () => {
      const options: SnapshotRestoreOptions = {
        snapshotPath: "/tmp/snapshot.tar.gz",
        targetPath: "/tmp/.astdb",
        createBackup: true,
        backupPath: "/tmp/.astdb.backup",
        validateChecksum: true,
        overwrite: false,
        skipModels: true,
      };

      expect(options).toBeDefined();
      expect(options.createBackup).toBe(true);
      expect(options.validateChecksum).toBe(true);
      expect(options.overwrite).toBe(false);
      expect(options.skipModels).toBe(true);
    });

    it("should accept progress callback", () => {
      const progressFn = (): void => {
        // Progress callback function
      };

      const options: SnapshotRestoreOptions = {
        snapshotPath: "/tmp/snapshot.tar.gz",
        targetPath: "/tmp/.astdb",
        onProgress: progressFn,
      };

      expect(options.onProgress).toBe(progressFn);
    });
  });
});
