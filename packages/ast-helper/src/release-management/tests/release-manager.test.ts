import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { ComprehensiveReleaseManager } from "../manager.js";
import {
  ReleaseConfig,
  ReleaseType,
  ReleaseChannel,
  ReleaseFilter,
} from "../types.js";

// Mock child_process for git commands
vi.mock("child_process", () => ({
  execSync: vi.fn().mockImplementation((command: string) => {
    if (command.includes("git describe --tags --abbrev=0")) {
      return "v0.1.0\n";
    }
    if (command.includes("git log")) {
      return `abc123|Test Author|2024-01-15T10:00:00Z|feat: add new feature|Initial feature implementation
def456|Test Author|2024-01-14T09:00:00Z|fix: resolve bug|Bug fix description
`;
    }
    if (command.includes("git status --porcelain")) {
      return "";
    }
    if (command.includes("git symbolic-ref --short HEAD")) {
      return "main\n";
    }
    return "";
  }),
}));

// Mock fs operations for package.json reading
vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockImplementation((path: string) => {
    if (path.includes("package.json")) {
      return Promise.resolve(JSON.stringify({ version: "0.1.0" }));
    }
    return Promise.resolve("");
  }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
}));

describe("ComprehensiveReleaseManager", () => {
  let manager: ComprehensiveReleaseManager;
  let mockConfig: ReleaseConfig;

  beforeEach(async () => {
    mockConfig = {
      repository: {
        owner: "testorg",
        name: "test-repo",
        defaultBranch: "main",
        releaseBranches: ["main", "release/*"],
        protectedBranches: ["main"],
        monorepo: true,
        workspaces: ["packages/*"],
      },
      versioning: {
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
      },
      changelog: {
        format: "conventional",
        sections: [
          { title: "Features", types: ["feat"] },
          { title: "Bug Fixes", types: ["fix"] },
        ],
        includeCommitLinks: true,
        includeAuthor: true,
        excludeTypes: ["chore", "docs"],
      },
      platforms: [
        {
          name: "npm",
          enabled: true,
          config: { registry: "https://registry.npmjs.org/" },
          requirements: ["build", "test"],
          artifacts: ["dist/**"],
        },
        {
          name: "github-releases",
          enabled: true,
          config: { owner: "testorg", repo: "test-repo" },
          requirements: ["changelog"],
          artifacts: ["dist.zip"],
        },
      ],
      compatibility: {
        checkApi: true,
        checkConfig: true,
        checkCli: true,
        checkData: false,
        breakingChangeThreshold: 0.5,
        generateMigrationGuides: true,
        baseVersions: ["1.0.0", "2.0.0"],
      },
      automation: {
        autoRollbackOnFailure: true,
        allowWarnings: false,
        requireApproval: false,
        parallelBuilds: true,
        timeoutMinutes: 30,
        retryAttempts: 3,
      },
      notifications: {
        channels: [
          {
            type: "email",
            config: { recipients: ["admin@test.com"] },
            events: ["release-start", "release-complete", "release-failed"],
          },
        ],
        templates: [
          {
            event: "release-complete",
            title: "Release {version} Complete",
            body: "Release {version} has been successfully published",
            variables: ["version", "changelog"],
          },
        ],
        includeMetrics: true,
      },
      rollback: {
        enabled: true,
        automaticTriggers: ["validation-failure", "deployment-failure"],
        manualApprovalRequired: true,
        backupRetention: 30,
        validationSteps: [
          "version-check",
          "dependency-check",
          "platform-check",
        ],
      },
    };

    manager = new ComprehensiveReleaseManager();
    await manager.initialize(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    test("should initialize with valid config", async () => {
      const newManager = new ComprehensiveReleaseManager();
      await expect(newManager.initialize(mockConfig)).resolves.toBeUndefined();
    });

    test("should handle initialization failure", async () => {
      const newManager = new ComprehensiveReleaseManager();
      const invalidConfig = { ...mockConfig, versioning: undefined as any };

      await expect(newManager.initialize(invalidConfig)).rejects.toThrow();
    });
  });

  describe("release planning", () => {
    test("should create release plan for patch release", async () => {
      const plan = await manager.planRelease("0.1.1", ReleaseType.PATCH);

      expect(plan).toBeDefined();
      expect(plan.version).toBe("0.1.1");
      expect(plan.type).toBe(ReleaseType.PATCH);
      expect(Array.isArray(plan.packages)).toBe(true);
      expect(Array.isArray(plan.platforms)).toBe(true);
      expect(Array.isArray(plan.dependencies)).toBe(true);
      expect(Array.isArray(plan.validations)).toBe(true);
      expect(plan.validations.length).toBeGreaterThan(0);
    });

    test("should create release plan for major release", async () => {
      const plan = await manager.planRelease("2.0.0", ReleaseType.MAJOR);

      expect(plan).toBeDefined();
      expect(plan.type).toBe(ReleaseType.MAJOR);
      expect(Array.isArray(plan.breakingChanges)).toBe(true);
    });

    test("should create prerelease plan", async () => {
      const plan = await manager.planRelease(
        "0.2.0-beta.1",
        ReleaseType.PRERELEASE,
      );

      expect(plan).toBeDefined();
      expect(plan.version).toBe("0.2.0-beta.1");
      expect(plan.type).toBe(ReleaseType.PRERELEASE);
    });
  });

  describe("release execution", () => {
    test("should execute patch release successfully", async () => {
      const mockPlan = await manager.planRelease("0.1.1", ReleaseType.PATCH);
      const result = await manager.executeRelease(mockPlan);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.version).toBe(mockPlan.version);
      expect(result.artifacts).toBeDefined();
      expect(result.publishResults).toBeDefined();
    });

    test("should handle release execution failure", async () => {
      const mockPlan = await manager.planRelease("0.1.1", ReleaseType.PATCH);

      // Mock a test failure during release execution
      vi.spyOn(manager, "runFinalTests").mockRejectedValue(
        new Error("Tests failed"),
      );

      const result = await manager.executeRelease(mockPlan);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("rollback functionality", () => {
    test("should execute rollback successfully", async () => {
      const result = await manager.rollbackRelease(
        "1.2.3",
        "Critical bug detected",
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.rolledBackVersion).toBe("1.2.3");
    });

    test("should handle rollback failure", async () => {
      vi.spyOn(manager["rollbackManager"], "executeRollback").mockRejectedValue(
        new Error("Rollback failed"),
      );

      const result = await manager.rollbackRelease("1.2.3", "Test rollback");

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("version querying", () => {
    test("should get latest version for stable channel", async () => {
      const version = await manager.getLatestVersion(ReleaseChannel.STABLE);
      expect(typeof version).toBe("string");
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });

    test("should get latest version for beta channel", async () => {
      const version = await manager.getLatestVersion(ReleaseChannel.BETA);
      expect(typeof version).toBe("string");
    });

    test("should list releases with filter", async () => {
      const filter: ReleaseFilter = {
        type: ReleaseType.PATCH,
        channel: ReleaseChannel.STABLE,
        includePrerelease: false,
      };

      const releases = await manager.listReleases(filter);
      expect(Array.isArray(releases)).toBe(true);
    });

    test("should list all releases without filter", async () => {
      const releases = await manager.listReleases();
      expect(Array.isArray(releases)).toBe(true);
    });
  });

  describe("changelog generation", () => {
    test("should generate changelog between versions", async () => {
      const changelog = await manager.generateChangelog("1.0.0", "1.1.0");

      expect(changelog).toBeDefined();
      expect(typeof changelog.rawContent).toBe("string");
      expect(Array.isArray(changelog.entries)).toBe(true);
    });
  });

  describe("compatibility checking", () => {
    test("should check backward compatibility", async () => {
      const report = await manager.checkBackwardCompatibility("2.0.0", "1.0.0");

      expect(report).toBeDefined();
      expect(typeof report.compatible).toBe("boolean");
      expect(Array.isArray(report.breakingChanges)).toBe(true);
    });
  });

  describe("release notes creation", () => {
    test("should create release notes for version", async () => {
      const changes = [
        {
          type: "feat",
          description: "Add new feature",
          breaking: false,
          timestamp: new Date(),
          affectedPackages: ["core"],
        },
      ];

      const notes = await manager.createReleaseNotes("1.1.0", changes);

      expect(notes).toBeDefined();
      expect(typeof notes.title).toBe("string");
      expect(typeof notes.description).toBe("string");
    });
  });

  describe("error handling", () => {
    test("should handle version validation errors", async () => {
      await expect(
        manager.planRelease("invalid-version", ReleaseType.PATCH),
      ).rejects.toThrow();
    });

    test("should handle missing configuration components", async () => {
      const invalidConfig = {
        ...mockConfig,
        versioning: undefined as any, // Missing required config
      };

      const newManager = new ComprehensiveReleaseManager();
      await expect(newManager.initialize(invalidConfig)).rejects.toThrow();
    });
  });
});
