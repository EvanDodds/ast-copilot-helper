/**
 * Tests for NPM Publisher
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { promises as fs } from "fs";
import * as path from "path";
import { NPMPublisher } from "../npm-publisher";
import { DistributionConfig } from "../types";

// Mock child_process
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

describe("NPMPublisher", () => {
  let publisher: NPMPublisher;
  let testConfig: DistributionConfig;
  let tempDir: string;

  beforeEach(async () => {
    publisher = new NPMPublisher();

    // Create temporary directory for testing
    tempDir = path.join(__dirname, `npm-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create test package.json
    const testPackageJson = {
      name: "@test/npm-package",
      version: "1.0.0",
      description: "Test NPM package",
      main: "index.js",
      license: "MIT",
      author: "Test Author",
      repository: "https://github.com/test/test",
      keywords: ["test"],
    };

    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify(testPackageJson, null, 2),
    );

    // Create main file
    await fs.writeFile(
      path.join(tempDir, "index.js"),
      'module.exports = { hello: "world" };',
    );

    // Create test configuration
    testConfig = {
      version: "2.0.0",
      packages: [
        {
          name: "@test/npm-package",
          type: "npm",
          path: tempDir,
          publishConfig: {
            registry: "https://registry.npmjs.org",
            access: "public",
            tag: "latest",
            prerelease: false,
            files: ["dist/**/*", "index.js"],
            scripts: {
              build: 'echo "build completed"',
              test: 'echo "tests passed"',
            },
          },
          metadata: {
            displayName: "Test NPM Package",
            description: "Test package description",
            keywords: ["test", "npm"],
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
          token: "test-token",
        },
      ],
      platforms: ["linux"],
      releaseNotes: "",
      marketplaces: [],
      binaryDistribution: {
        enabled: false,
        platforms: [],
        signing: { enabled: false },
        packaging: { formats: [], compression: "none", includeAssets: false },
        distribution: {
          channels: [],
          defaultChannel: "stable",
          promotion: { automatic: false, rules: [] },
        },
      },
      autoUpdate: {
        enabled: false,
        server: { url: "", channels: [], checkInterval: 0 },
        client: {
          checkInterval: 0,
          downloadTimeout: 0,
          retryAttempts: 0,
          backgroundDownload: false,
          userPrompt: false,
        },
        rollback: {
          enabled: false,
          maxVersions: 0,
          autoRollback: false,
          rollbackTriggers: [],
        },
      },
      github: {
        owner: "test",
        repo: "test",
        token: "test-token",
        releaseNotes: { generate: false, sections: [], commitTypes: [] },
      },
      security: {
        signing: false,
        verification: {
          checksums: false,
          signatures: false,
          certificates: false,
        },
        vulnerability: { scanning: false, reporting: false, blocking: false },
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

    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize successfully with valid config", async () => {
      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      mockExecSync.mockReturnValue("8.19.0\n");

      await expect(publisher.initialize(testConfig)).resolves.not.toThrow();
    });

    it("should use default registry if none provided", async () => {
      const configWithoutRegistry = {
        ...testConfig,
        registries: [],
      };

      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      mockExecSync.mockReturnValue("8.19.0\n");

      await publisher.initialize(configWithoutRegistry);

      // Check that default registry is used
      expect((publisher as any).npmRegistry.url).toBe(
        "https://registry.npmjs.org",
      );
    });
  });

  describe("validation", () => {
    beforeEach(async () => {
      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      mockExecSync.mockReturnValue("8.19.0\n");

      await publisher.initialize(testConfig);
    });

    it("should validate successfully with proper setup", async () => {
      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      mockExecSync
        .mockReturnValueOnce("8.19.0") // npm --version
        .mockReturnValueOnce("testuser") // npm whoami
        .mockReturnValue("config output"); // npm config list

      const result = await publisher.validate();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should report errors for missing npm", async () => {
      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === "npm --version") {
          throw new Error("npm not found");
        }
        return "output";
      });

      const result = await publisher.validate();

      expect(result.success).toBe(false);
      expect(
        result.errors.some((e: any) => e.code === "NPM_NOT_AVAILABLE"),
      ).toBe(true);
    });

    it("should report warnings for missing recommended fields", async () => {
      // Create package without recommended fields
      const packageWithoutDescription = {
        name: "@test/minimal-package",
        version: "1.0.0",
        main: "index.js",
        license: "MIT",
      };

      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify(packageWithoutDescription, null, 2),
      );

      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      mockExecSync.mockReturnValue("output");

      const result = await publisher.validate();

      expect(
        result.warnings.some(
          (w: any) => w.code === "MISSING_RECOMMENDED_FIELD",
        ),
      ).toBe(true);
    });

    it("should report errors for invalid package names", async () => {
      // Create package with invalid name
      const packageWithInvalidName = {
        name: "Invalid Package Name!",
        version: "1.0.0",
        main: "index.js",
        license: "MIT",
      };

      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify(packageWithInvalidName, null, 2),
      );

      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      mockExecSync.mockReturnValue("output");

      const result = await publisher.validate();

      expect(result.success).toBe(false);
      expect(
        result.errors.some((e: any) => e.code === "INVALID_PACKAGE_NAME"),
      ).toBe(true);
    });

    it("should report errors for missing main file", async () => {
      // Remove main file
      await fs.unlink(path.join(tempDir, "index.js"));

      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      mockExecSync.mockReturnValue("output");

      const result = await publisher.validate();

      expect(result.success).toBe(false);
      expect(
        result.errors.some((e: any) => e.code === "MAIN_FILE_MISSING"),
      ).toBe(true);
    });
  });

  describe("publishing", () => {
    beforeEach(async () => {
      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      mockExecSync.mockReturnValue("8.19.0\n");

      await publisher.initialize(testConfig);
    });

    it("should publish successfully with valid packages", async () => {
      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      // Mock all the commands that will be called during publishing
      mockExecSync
        .mockReturnValueOnce("8.19.0") // npm --version (validation)
        .mockReturnValueOnce("testuser") // npm whoami (validation)
        .mockReturnValueOnce("config output") // npm config list (validation)
        .mockReturnValueOnce("build completed") // npm run build
        .mockReturnValueOnce("tests passed") // npm test
        .mockReturnValueOnce("+ @test/npm-package@2.0.0") // npm publish
        .mockReturnValueOnce(
          '{"name":"@test/npm-package","versions":["2.0.0"],"dist":{"tarball":"https://registry.npmjs.org/@test/npm-package/-/npm-package-2.0.0.tgz"}}',
        ); // npm view (verification)

      const result = await publisher.publish();

      expect(result.success).toBe(true);
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].success).toBe(true);
      expect(result.packages[0].packageName).toBe("@test/npm-package");
      expect(result.packages[0].version).toBe("2.0.0");
    });

    it("should handle publish failures gracefully", async () => {
      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      // Mock validation to pass, then publish to fail
      mockExecSync
        .mockReturnValueOnce("8.19.0") // npm --version (validation)
        .mockReturnValueOnce("testuser") // npm whoami (validation)
        .mockReturnValueOnce("config output") // npm config list (validation)
        .mockReturnValueOnce("build completed") // npm run build
        .mockReturnValueOnce("tests passed") // npm test
        .mockImplementationOnce(() => {
          // npm publish
          throw new Error("Publish failed: package already exists");
        });

      const result = await publisher.publish();

      expect(result.success).toBe(false);
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].success).toBe(false);
      expect(result.packages[0].error).toContain("Publish failed");
      expect(result.error).toContain("Failed to publish");
    });

    it("should handle validation failures", async () => {
      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      // Mock npm not available
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === "npm --version") {
          throw new Error("npm not found");
        }
        return "output";
      });

      const result = await publisher.publish();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("verification", () => {
    beforeEach(async () => {
      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      mockExecSync.mockReturnValue("8.19.0\n");

      await publisher.initialize(testConfig);
    });

    it("should verify successful publications", async () => {
      const mockResult = {
        success: true,
        packages: [
          {
            success: true,
            packageName: "@test/npm-package",
            version: "2.0.0",
            registry: "https://registry.npmjs.org",
            duration: 1000,
          },
        ],
        duration: 2000,
        registry: "https://registry.npmjs.org",
        version: "2.0.0",
      };

      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      // Mock npm view to return package info
      mockExecSync.mockReturnValue(
        JSON.stringify({
          name: "@test/npm-package",
          versions: ["2.0.0"],
          dist: {
            tarball:
              "https://registry.npmjs.org/@test/npm-package/-/npm-package-2.0.0.tgz",
          },
        }),
      );

      const result = await publisher.verify(mockResult);

      expect(result.success).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it("should handle verification failures", async () => {
      const mockResult = {
        success: true,
        packages: [
          {
            success: true,
            packageName: "@test/nonexistent-package",
            version: "2.0.0",
            registry: "https://registry.npmjs.org",
            duration: 1000,
          },
        ],
        duration: 2000,
        registry: "https://registry.npmjs.org",
        version: "2.0.0",
      };

      const { execSync } = await import("child_process");
      const mockExecSync = execSync as any;

      // Mock npm view to fail (package not found)
      mockExecSync.mockImplementation(() => {
        throw new Error("Package not found");
      });

      const result = await publisher.verify(mockResult);

      expect(result.success).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("should cleanup successfully", async () => {
      await expect(publisher.cleanup()).resolves.not.toThrow();
    });
  });
});
