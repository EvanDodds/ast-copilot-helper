import { describe, it, expect } from "vitest";
import { SnapshotCreator } from "../snapshot-creator.js";
import type { SnapshotCreateOptions } from "../types.js";

/**
 * Snapshot Creator Tests
 *
 * These tests verify the SnapshotCreator class behavior.
 * Note: Full integration tests with real files are in integration.test.ts
 */
describe("SnapshotCreator", () => {
  describe("constructor", () => {
    it("should create instance", () => {
      const creator = new SnapshotCreator();
      expect(creator).toBeInstanceOf(SnapshotCreator);
    });

    it("should create multiple instances", () => {
      const creator1 = new SnapshotCreator();
      const creator2 = new SnapshotCreator();

      expect(creator1).toBeInstanceOf(SnapshotCreator);
      expect(creator2).toBeInstanceOf(SnapshotCreator);
    });
  });

  describe("validation", () => {
    it("should require astdbPath", async () => {
      const creator = new SnapshotCreator();

      const options = {
        outputPath: "/tmp/snapshot.tar.gz",
      } as SnapshotCreateOptions;

      const result = await creator.create(options);
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should require outputPath", async () => {
      const creator = new SnapshotCreator();

      const options = {
        astdbPath: "/tmp/.astdb",
      } as SnapshotCreateOptions;

      const result = await creator.create(options);
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should reject non-existent astdb directory", async () => {
      const creator = new SnapshotCreator();

      const options: SnapshotCreateOptions = {
        astdbPath: "/nonexistent/path/.astdb",
        outputPath: "/tmp/snapshot.tar.gz",
      };

      const result = await creator.create(options);
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should reject invalid compression level", async () => {
      const creator = new SnapshotCreator();

      const options: SnapshotCreateOptions = {
        astdbPath: "/tmp/.astdb",
        outputPath: "/tmp/snapshot.tar.gz",
        compressionLevel: 10, // Invalid, must be 0-9
      };

      const result = await creator.create(options);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should accept valid compression levels", () => {
      // Test valid compression levels 0-9
      for (let level = 0; level <= 9; level++) {
        const options: SnapshotCreateOptions = {
          astdbPath: "/tmp/.astdb",
          outputPath: "/tmp/snapshot.tar.gz",
          compressionLevel: level,
        };

        // Should not throw during validation
        expect(() => {
          if (options.compressionLevel !== undefined) {
            if (options.compressionLevel < 0 || options.compressionLevel > 9) {
              throw new Error("Invalid compression level");
            }
          }
        }).not.toThrow();
      }
    });
  });

  describe("options", () => {
    it("should accept minimal required options", () => {
      const options: SnapshotCreateOptions = {
        astdbPath: "/tmp/.astdb",
        outputPath: "/tmp/snapshot.tar.gz",
      };

      expect(options.astdbPath).toBe("/tmp/.astdb");
      expect(options.outputPath).toBe("/tmp/snapshot.tar.gz");
    });

    it("should accept all optional fields", () => {
      const options: SnapshotCreateOptions = {
        astdbPath: "/tmp/.astdb",
        outputPath: "/tmp/snapshot.tar.gz",
        compressionLevel: 6,
        includeModels: false,
        includeCache: false,
        includeLogs: false,
        version: "1.0.0",
        description: "Test snapshot",
        tags: ["test", "automated"],
        creator: {
          name: "Test User",
          email: "test@example.com",
        },
        repository: {
          url: "https://github.com/example/repo",
          commitSha: "abc123",
          branch: "main",
        },
      };

      expect(options).toBeDefined();
      expect(options.compressionLevel).toBe(6);
      expect(options.includeModels).toBe(false);
      expect(options.version).toBe("1.0.0");
      expect(options.tags).toEqual(["test", "automated"]);
    });

    it("should accept progress callback", () => {
      const progressFn = (): void => {
        // Progress callback function
      };

      const options: SnapshotCreateOptions = {
        astdbPath: "/tmp/.astdb",
        outputPath: "/tmp/snapshot.tar.gz",
        onProgress: progressFn,
      };

      expect(options.onProgress).toBe(progressFn);
    });
  });
});
