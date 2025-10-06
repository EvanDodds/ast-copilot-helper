/**
 * Tests for Distribution Manager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { promises as fs } from "fs";
import * as path from "path";
import { DistributionManager } from "../manager";
import { DistributionConfig, PackageConfig } from "../types";

describe("DistributionManager", () => {
  let manager: DistributionManager;
  let testConfig: DistributionConfig;
  let tempDir: string;

  beforeEach(async () => {
    manager = new DistributionManager();

    // Create temporary directory for testing
    tempDir = path.join(__dirname, `test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create test package.json
    const testPackageJson = {
      name: "test-package",
      version: "1.0.0",
      description: "Test package",
      main: "index.js",
    };

    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify(testPackageJson, null, 2),
    );

    // Create test configuration
    testConfig = {
      version: "1.0.0",
      packages: [
        {
          name: "test-package",
          type: "npm",
          path: tempDir,
          publishConfig: {
            registry: "https://registry.npmjs.org",
            access: "public",
            tag: "latest",
            prerelease: false,
            files: ["dist/**/*"],
            scripts: {},
          },
          metadata: {
            displayName: "Test Package",
            description: "Test package description",
            keywords: ["test"],
            license: "MIT",
            author: "Test Author",
            repository: "https://github.com/test/test",
          },
        },
      ],
      registries: [
        {
          type: "npm",
          url: "https://registry.npmjs.org",
        },
      ],
      platforms: ["win32", "darwin", "linux"],
      releaseNotes: "Test release notes",
      marketplaces: [],
      binaryDistribution: {
        enabled: false,
        platforms: ["win32"],
        signing: { enabled: false },
        packaging: {
          formats: ["zip"],
          compression: "zip",
          includeAssets: false,
        },
        distribution: {
          channels: ["stable"],
          defaultChannel: "stable",
          promotion: { automatic: false, rules: [] },
        },
      },
      autoUpdate: {
        enabled: false,
        server: {
          url: "https://api.github.com",
          channels: ["stable"],
          checkInterval: 86400000,
        },
        client: {
          checkInterval: 86400000,
          downloadTimeout: 300000,
          retryAttempts: 3,
          backgroundDownload: true,
          userPrompt: true,
        },
        rollback: {
          enabled: false,
          maxVersions: 5,
          autoRollback: false,
          rollbackTriggers: [],
        },
      },
      github: {
        owner: "test-owner",
        repo: "test-repo",
        token: "test-token",
        releaseNotes: {
          generate: true,
          sections: [],
          commitTypes: [],
        },
      },
      security: {
        signing: false,
        verification: {
          checksums: true,
          signatures: false,
          certificates: false,
        },
        vulnerability: {
          scanning: false,
          reporting: false,
          blocking: false,
        },
      },
    };
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("initialization", () => {
    it("should initialize successfully with valid config", async () => {
      // Mock npm command
      vi.mock("child_process", () => ({
        execSync: vi.fn().mockReturnValue("8.19.0"),
      }));

      await expect(manager.initialize(testConfig)).resolves.not.toThrow();
    });

    it("should throw error with invalid config", async () => {
      const invalidConfig = { ...testConfig, version: "" };

      await expect(manager.initialize(invalidConfig)).rejects.toThrow(
        "Configuration validation failed",
      );
    });

    it("should throw error if package path does not exist", async () => {
      const invalidConfig = {
        ...testConfig,
        packages: [
          {
            ...testConfig.packages[0],
            path: "/nonexistent/path",
          },
        ],
      };

      await expect(manager.initialize(invalidConfig)).rejects.toThrow(
        "Package path not found",
      );
    });

    it("should throw error if package.json is missing", async () => {
      // Remove package.json
      await fs.unlink(path.join(tempDir, "package.json"));

      await expect(manager.initialize(testConfig)).rejects.toThrow(
        "package.json not found",
      );
    });
  });

  describe("package preparation", () => {
    beforeEach(async () => {
      // Mock npm command
      vi.mock("child_process", () => ({
        execSync: vi.fn().mockReturnValue("8.19.0"),
      }));

      await manager.initialize(testConfig);
    });

    it("should prepare packages successfully", async () => {
      const result = await manager.preparePackages();

      expect(result.success).toBe(true);
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].name).toBe("test-package");
      expect(result.packages[0].version).toBe("1.0.0");
      expect(result.packages[0].validated).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should update package version during preparation", async () => {
      // Change config version
      testConfig.version = "2.0.0";
      await manager.initialize(testConfig);

      await manager.preparePackages();

      // Check that package.json was updated
      const packageJsonContent = await fs.readFile(
        path.join(tempDir, "package.json"),
        "utf8",
      );
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.version).toBe("2.0.0");
    });

    it("should calculate package size and checksum", async () => {
      const result = await manager.preparePackages();

      expect(result.packages[0].size).toBeGreaterThan(0);
      expect(result.packages[0].checksum).toBeTruthy();
      expect(typeof result.packages[0].checksum).toBe("string");
    });
  });

  describe("publisher methods", () => {
    beforeEach(async () => {
      // Mock npm command
      vi.mock("child_process", () => ({
        execSync: vi.fn().mockReturnValue("8.19.0"),
      }));

      await manager.initialize(testConfig);
    });

    it("should handle validation failures for unimplemented methods", async () => {
      const result = await manager.publishToNPM();
      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation failed");

      const vsCodeResult = await manager.publishToVSCodeMarketplace();
      expect(vsCodeResult.success).toBe(false);
      expect(vsCodeResult.error).toContain(
        "VS Code Marketplace publishing failed",
      );

      await expect(manager.createGitHubRelease()).rejects.toThrow(
        "GitHub release creation not yet implemented",
      );

      await expect(manager.distributeBinaries()).rejects.toThrow(
        "Binary distribution not yet implemented",
      );

      await expect(manager.setupAutoUpdates()).rejects.toThrow(
        "Auto-update setup not yet implemented",
      );

      await expect(manager.generateDocumentation()).rejects.toThrow(
        "Documentation generation not yet implemented",
      );
    });
  });

  describe("error handling", () => {
    it("should throw error if methods called before initialization", async () => {
      expect(() => manager.preparePackages()).rejects.toThrow(
        "DistributionManager not initialized",
      );
    });

    it("should handle package preparation errors gracefully", async () => {
      // Create a package config with invalid path after initialization
      const configWithInvalidPackage = {
        ...testConfig,
        packages: [
          testConfig.packages[0],
          {
            ...testConfig.packages[0],
            name: "invalid-package",
            path: "/invalid/path",
          },
        ],
      };

      // Mock npm command
      vi.mock("child_process", () => ({
        execSync: vi.fn().mockReturnValue("8.19.0"),
      }));

      await manager.initialize(testConfig);

      // Manually set config to include invalid package
      (manager as any).config = configWithInvalidPackage;

      const result = await manager.preparePackages();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("invalid-package");
    });
  });
});
