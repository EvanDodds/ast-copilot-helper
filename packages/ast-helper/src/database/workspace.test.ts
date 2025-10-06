/**
 * Tests for Workspace Detector
 * Validates workspace root detection and Git integration
 */

import { stat } from "node:fs/promises";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from "vitest";
import { WorkspaceDetector } from "./workspace.js";

// Mock Node.js modules
vi.mock("node:fs/promises");
vi.mock("node:fs");

// Mock the GitManager and FileSystemManager classes
const mockGitManager = {
  getRepositoryRoot: vi.fn().mockRejectedValue(new Error("No git repo")),
};

const mockFileSystemManager = {
  exists: vi.fn().mockResolvedValue(true),
  getFileStats: vi.fn().mockResolvedValue({ size: 1000 }),
  ensureDirectory: vi.fn().mockResolvedValue(undefined),
  atomicWriteFile: vi.fn().mockResolvedValue(undefined),
};

// Mock internal modules
vi.mock("../filesystem/manager.js", () => ({
  FileSystemManager: vi.fn(() => mockFileSystemManager),
}));

vi.mock("../git/manager.js", () => ({
  GitManager: vi.fn(() => mockGitManager),
}));

vi.mock("../logging/index.js", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockStat = stat as MockedFunction<typeof stat>;

describe("WorkspaceDetector", () => {
  let workspaceDetector: WorkspaceDetector;
  const testDir = "/test/workspace";

  beforeEach(() => {
    workspaceDetector = new WorkspaceDetector();
    vi.clearAllMocks();

    // Reset mock implementations
    mockGitManager.getRepositoryRoot.mockRejectedValue(
      new Error("No git repo"),
    );
    mockFileSystemManager.exists.mockResolvedValue(true);

    // Mock directory stats
    mockStat.mockImplementation(
      async (_path) =>
        ({
          isDirectory: () => true,
          isFile: () => false,
          size: 0,
          mtime: new Date(),
          ctime: new Date(),
          atime: new Date(),
          mode: 0o755,
        }) as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectWorkspace", () => {
    it("should detect workspace by Git repository", async () => {
      // Mock successful Git detection for this specific test
      mockGitManager.getRepositoryRoot.mockResolvedValue("/test/workspace");

      const result = await workspaceDetector.detectWorkspace({
        startDir: testDir,
      });

      expect(result).toMatchObject({
        root: "/test/workspace",
        isGitRepository: true,
        detectionMethod: "git",
      });
    });

    it("should detect workspace by package.json", async () => {
      // Mock Git detection to fail, forcing package.json detection
      mockGitManager.getRepositoryRoot.mockRejectedValue(
        new Error("No git repo"),
      );

      // Mock package.json existence
      mockFileSystemManager.exists.mockImplementation(async (path: string) => {
        return path.endsWith("package.json");
      });

      const result = await workspaceDetector.detectWorkspace({
        startDir: testDir,
      });

      expect(result).toMatchObject({
        root: testDir,
        isGitRepository: false,
        detectionMethod: "package-json",
      });
    });

    it("should fall back to current directory when allowed", async () => {
      // Mock both Git and package.json detection to fail
      mockGitManager.getRepositoryRoot.mockRejectedValue(
        new Error("No git repo"),
      );
      mockFileSystemManager.exists.mockResolvedValue(false);

      const result = await workspaceDetector.detectWorkspace({
        startDir: testDir,
        allowExisting: true,
      });

      expect(result).toMatchObject({
        root: testDir,
        isGitRepository: false,
        detectionMethod: "fallback",
      });
    });

    it("should throw error when no workspace found and not allowing existing", async () => {
      // Mock both Git and package.json detection to fail
      mockGitManager.getRepositoryRoot.mockRejectedValue(
        new Error("No git repo"),
      );
      mockFileSystemManager.exists.mockResolvedValue(false);

      await expect(
        workspaceDetector.detectWorkspace({
          startDir: testDir,
          allowExisting: false,
        }),
      ).rejects.toThrow();
    });
  });

  describe("getDefaultDatabasePath", () => {
    it("should generate path in workspace subdirectory", () => {
      const workspaceRoot = "/test/workspace";
      const result = workspaceDetector.getDefaultDatabasePath(workspaceRoot);

      expect(result).toContain(workspaceRoot);
      expect(result).toMatch(/\.ast-helper/);
    });
  });

  describe("validateWorkspaceForDatabase", () => {
    it("should accept valid workspace", async () => {
      const workspaceInfo = {
        root: testDir,
        isGitRepository: true,
        detectionMethod: "git" as const,
        relativePath: "",
        isNested: false,
        indicators: ["package.json"],
      };

      // Mock database doesn't exist yet
      mockFileSystemManager.exists.mockResolvedValue(false);

      await expect(
        workspaceDetector.validateWorkspaceForDatabase(workspaceInfo),
      ).resolves.not.toThrow();
    });

    it("should reject existing database without force", async () => {
      const workspaceInfo = {
        root: testDir,
        isGitRepository: false,
        detectionMethod: "package-json" as const,
        relativePath: "",
        isNested: false,
        indicators: ["package.json"],
      };

      // Mock database already exists
      mockFileSystemManager.exists.mockResolvedValue(true);

      await expect(
        workspaceDetector.validateWorkspaceForDatabase(workspaceInfo),
      ).rejects.toThrow("Database already exists");
    });

    it("should accept existing database with force option", async () => {
      const workspaceInfo = {
        root: testDir,
        isGitRepository: false,
        detectionMethod: "package-json" as const,
        relativePath: "",
        isNested: false,
        indicators: ["package.json"],
      };

      // Mock database already exists
      mockFileSystemManager.exists.mockResolvedValue(true);

      await expect(
        workspaceDetector.validateWorkspaceForDatabase(workspaceInfo, {
          force: true,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe("getWorkspaceSummary", () => {
    it("should provide workspace summary", async () => {
      const workspaceInfo = {
        root: testDir,
        isGitRepository: true,
        detectionMethod: "git" as const,
        relativePath: "src",
        isNested: false,
        indicators: ["package.json", "tsconfig.json"],
      };

      const summary =
        await workspaceDetector.getWorkspaceSummary(workspaceInfo);

      expect(summary).toMatchObject({
        root: testDir,
        isGitRepository: true,
        detectionMethod: "git",
        relativePath: "src",
        isNested: false,
        indicators: expect.arrayContaining(["package.json", "tsconfig.json"]),
      });
    });
  });

  describe("suggestWorkspaceRoots", () => {
    it("should suggest parent directories", async () => {
      const suggestions =
        await workspaceDetector.suggestWorkspaceRoots(testDir);

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain("/test");
    });
  });

  describe("error handling", () => {
    it("should handle file system errors", async () => {
      // Mock file system to throw an error
      mockFileSystemManager.exists.mockRejectedValue(
        new Error("File system error"),
      );
      mockGitManager.getRepositoryRoot.mockRejectedValue(
        new Error("No git repo"),
      );

      await expect(
        workspaceDetector.detectWorkspace({
          startDir: testDir,
        }),
      ).rejects.toThrow();
    });

    it("should handle permission errors", async () => {
      // Mock stat to throw permission error
      mockStat.mockRejectedValue(new Error("EACCES: permission denied"));

      await expect(
        workspaceDetector.detectWorkspace({
          startDir: testDir,
        }),
      ).rejects.toThrow();
    });

    it("should handle invalid path scenarios", async () => {
      const invalidPath = "/nonexistent/invalid/path";

      mockFileSystemManager.exists.mockResolvedValue(false);
      mockGitManager.getRepositoryRoot.mockRejectedValue(
        new Error("No git repo"),
      );

      await expect(
        workspaceDetector.detectWorkspace({
          startDir: invalidPath,
          allowExisting: false,
        }),
      ).rejects.toThrow();
    });
  });

  describe("Git integration", () => {
    it("should handle Git repository detection", async () => {
      const gitRoot = "/test/workspace";
      mockGitManager.getRepositoryRoot.mockResolvedValue(gitRoot);

      const result = await workspaceDetector.detectWorkspace({
        startDir: testDir,
      });

      expect(result.isGitRepository).toBe(true);
      expect(result.detectionMethod).toBe("git");
      expect(result.root).toBe(gitRoot);
    });

    it("should handle nested Git repositories", async () => {
      const gitRoot = "/test";
      const subDir = "/test/workspace/nested";

      mockGitManager.getRepositoryRoot.mockResolvedValue(gitRoot);

      const result = await workspaceDetector.detectWorkspace({
        startDir: subDir,
      });

      expect(result.isGitRepository).toBe(true);
      expect(result.root).toBe(gitRoot);
      expect(result.isNested).toBe(true);
    });
  });
});
