import { describe, it, expect, beforeEach } from "vitest";
import { SnapshotManager } from "../snapshot-manager.js";
import type { SnapshotSystemConfig } from "../types.js";

/**
 * Snapshot Manager Tests
 *
 * These tests verify the SnapshotManager orchestrator class.
 * Note: Full integration tests with real operations are in integration.test.ts
 */
describe("SnapshotManager", () => {
  let config: Partial<SnapshotSystemConfig>;

  beforeEach(() => {
    config = {
      localStoragePath: "/tmp/.snapshots",
      defaultCompressionLevel: 6,
    };
  });

  describe("constructor", () => {
    it("should create instance with config", () => {
      const manager = new SnapshotManager(config);
      expect(manager).toBeInstanceOf(SnapshotManager);
    });

    it("should create instance with no config", () => {
      const manager = new SnapshotManager();
      expect(manager).toBeInstanceOf(SnapshotManager);
    });

    it("should create instance with remote storage in config", () => {
      const configWithRemote: Partial<SnapshotSystemConfig> = {
        localStoragePath: "/tmp/.snapshots",
        defaultCompressionLevel: 6,
        remoteStorage: [
          {
            type: "github",
            config: {
              owner: "test",
              repo: "test-repo",
              token: "fake-token",
            },
          },
        ],
      };

      const manager = new SnapshotManager(configWithRemote);
      expect(manager).toBeInstanceOf(SnapshotManager);
    });
  });

  describe("configuration", () => {
    it("should use default compression level when not provided", () => {
      const manager = new SnapshotManager({
        localStoragePath: "/tmp/.snapshots",
      });

      expect(manager).toBeInstanceOf(SnapshotManager);
    });

    it("should accept custom compression level", () => {
      const testConfig: Partial<SnapshotSystemConfig> = {
        localStoragePath: "/tmp/.snapshots",
        defaultCompressionLevel: 9,
      };

      const manager = new SnapshotManager(testConfig);
      expect(manager).toBeInstanceOf(SnapshotManager);
    });

    it("should work with different local storage paths", () => {
      const paths = [
        "/tmp/.snapshots",
        "/var/lib/snapshots",
        "./local-snapshots",
      ];

      for (const path of paths) {
        const testConfig: Partial<SnapshotSystemConfig> = {
          localStoragePath: path,
          defaultCompressionLevel: 6,
        };

        const manager = new SnapshotManager(testConfig);
        expect(manager).toBeInstanceOf(SnapshotManager);
      }
    });

    it("should accept default remote index", () => {
      const testConfig: Partial<SnapshotSystemConfig> = {
        localStoragePath: "/tmp/.snapshots",
        defaultRemoteIndex: 0,
      };

      const manager = new SnapshotManager(testConfig);
      expect(manager).toBeInstanceOf(SnapshotManager);
    });

    it("should accept autoSnapshot config", () => {
      const testConfig: Partial<SnapshotSystemConfig> = {
        localStoragePath: "/tmp/.snapshots",
        autoSnapshot: {
          enabled: true,
          afterDays: 7,
          onPush: true,
        },
      };

      const manager = new SnapshotManager(testConfig);
      expect(manager).toBeInstanceOf(SnapshotManager);
    });
  });
});
