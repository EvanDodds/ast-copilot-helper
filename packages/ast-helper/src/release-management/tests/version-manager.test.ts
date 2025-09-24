import { describe, test, expect, beforeEach, vi } from "vitest";
import { VersionManagerImpl } from "../core/version-manager.js";
import { ReleaseType, ReleaseChannel, VersioningConfig } from "../types.js";

// Mock fs/promises module
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

describe("VersionManagerImpl", () => {
  let versionManager: VersionManagerImpl;
  let mockConfig: VersioningConfig;

  beforeEach(async () => {
    mockConfig = {
      scheme: "semver",
      initialVersion: "0.1.0",
      prereleasePattern: "{version}-{channel}.{increment}",
      channels: [
        {
          name: ReleaseChannel.STABLE,
          pattern: "stable",
          autoPublish: true,
          requiresApproval: false,
        },
        {
          name: ReleaseChannel.BETA,
          pattern: "beta",
          autoPublish: false,
          requiresApproval: true,
        },
      ],
      allowPrereleasePromotion: true,
      strictMode: true,
    };

    versionManager = new VersionManagerImpl();
    await versionManager.initialize(mockConfig);
  });

  describe("version calculation", () => {
    test("should calculate next patch version", async () => {
      const nextVersion = await versionManager.calculateNextVersion(
        "1.0.0",
        ReleaseType.PATCH,
      );
      expect(nextVersion).toBe("1.0.1");
    });

    test("should calculate next minor version", async () => {
      const nextVersion = await versionManager.calculateNextVersion(
        "1.0.0",
        ReleaseType.MINOR,
      );
      expect(nextVersion).toBe("1.1.0");
    });

    test("should calculate next major version", async () => {
      const nextVersion = await versionManager.calculateNextVersion(
        "1.0.0",
        ReleaseType.MAJOR,
      );
      expect(nextVersion).toBe("2.0.0");
    });

    test("should calculate prerelease version", async () => {
      const nextVersion = await versionManager.calculateNextVersion(
        "1.0.0",
        ReleaseType.PRERELEASE,
      );
      expect(nextVersion).toMatch(/^1\.0\.1-/);
    });

    test("should handle invalid current version", async () => {
      await expect(
        versionManager.calculateNextVersion("invalid", ReleaseType.PATCH),
      ).rejects.toThrow("Invalid version");
    });
  });

  describe("version validation", () => {
    test("should validate semantic version format", async () => {
      const isValid = await versionManager.validateVersion(
        "1.2.3",
        ReleaseType.PATCH,
      );
      expect(isValid).toBe(true);
    });

    test("should validate prerelease version format", async () => {
      const isValid = await versionManager.validateVersion(
        "1.2.3-beta.1",
        ReleaseType.PRERELEASE,
      );
      expect(isValid).toBe(true);
    });

    test("should reject invalid version format", async () => {
      const isValid = await versionManager.validateVersion(
        "1.2",
        ReleaseType.PATCH,
      );
      expect(isValid).toBe(false);
    });

    test("should reject version type mismatch", async () => {
      const isValid = await versionManager.validateVersion(
        "1.2.3-beta.1",
        ReleaseType.PATCH,
      );
      expect(isValid).toBe(false);
    });
  });

  describe("version comparison", () => {
    test("should compare versions correctly", () => {
      expect(versionManager.compareVersions("1.0.0", "1.0.1")).toBe(-1);
      expect(versionManager.compareVersions("1.0.1", "1.0.0")).toBe(1);
      expect(versionManager.compareVersions("1.0.0", "1.0.0")).toBe(0);
    });

    test("should handle prerelease comparison", () => {
      expect(
        versionManager.compareVersions("1.0.0-alpha.1", "1.0.0-alpha.2"),
      ).toBe(-1);
      expect(versionManager.compareVersions("1.0.0-alpha.1", "1.0.0")).toBe(-1);
      expect(versionManager.compareVersions("1.0.0", "1.0.0-alpha.1")).toBe(1);
    });
  });

  describe("prerelease detection", () => {
    test("should identify prerelease versions", () => {
      expect(versionManager.isPrerelease("1.0.0-alpha.1")).toBe(true);
      expect(versionManager.isPrerelease("1.0.0-beta.2")).toBe(true);
      expect(versionManager.isPrerelease("1.0.0-rc.1")).toBe(true);
    });

    test("should identify stable versions", () => {
      expect(versionManager.isPrerelease("1.0.0")).toBe(false);
      expect(versionManager.isPrerelease("2.1.3")).toBe(false);
    });

    test("should handle malformed versions", () => {
      expect(versionManager.isPrerelease("invalid")).toBe(false);
      expect(versionManager.isPrerelease("1.2")).toBe(false);
    });
  });

  describe("channel detection", () => {
    test("should identify stable channel", () => {
      const channel = versionManager.getVersionChannel("1.0.0");
      expect(channel).toBe(ReleaseChannel.STABLE);
    });

    test("should identify beta channel", () => {
      const channel = versionManager.getVersionChannel("1.0.0-beta.1");
      expect(channel).toBe(ReleaseChannel.BETA);
    });

    test("should identify alpha channel", () => {
      const channel = versionManager.getVersionChannel("1.0.0-alpha.1");
      expect(channel).toBe(ReleaseChannel.ALPHA);
    });

    test("should default to stable for unknown prereleases", () => {
      const channel = versionManager.getVersionChannel("1.0.0-custom.1");
      expect(channel).toBe(ReleaseChannel.STABLE);
    });
  });

  describe("current version retrieval", () => {
    test("should get current version from package.json", async () => {
      // Mock fs operations
      const fs = await import("fs/promises");
      vi.mocked(fs.readFile).mockResolvedValue('{"version": "1.2.3"}');

      const version = await versionManager.getCurrentVersion();
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe("version updates", () => {
    test("should update package versions", async () => {
      const packages = ["./package.json", "./packages/core/package.json"];

      // Mock fs operations dynamically
      const fs = await import("fs/promises");
      vi.mocked(fs.readFile).mockResolvedValue('{"version": "1.0.0"}');
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await expect(
        versionManager.updateVersion("1.0.1", packages),
      ).resolves.toBeUndefined();
    });

    test("should handle update failures gracefully", async () => {
      const packages = ["./nonexistent/package.json"];

      // Mock fs to throw error dynamically
      const fs = await import("fs/promises");
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));
      vi.mocked(fs.writeFile).mockRejectedValue(new Error("File not found"));

      await expect(
        versionManager.updateVersion("1.0.1", packages),
      ).rejects.toThrow("File not found");
    });
  });

  describe("configuration validation", () => {
    test("should handle invalid scheme", async () => {
      const invalidConfig = {
        ...mockConfig,
        scheme: "invalid" as any,
      };

      await expect(versionManager.initialize(invalidConfig)).rejects.toThrow(
        "Unsupported versioning scheme",
      );
    });

    test("should handle malformed initial version", async () => {
      const invalidConfig = {
        ...mockConfig,
        initialVersion: "invalid-version",
      };

      await expect(versionManager.initialize(invalidConfig)).rejects.toThrow(
        "Invalid initial version format",
      );
    });
  });
});
