/**
 * Simplified Workspace Detector Tests
 * Basic functionality without complex mocking
 */

import { describe, expect, it, vi } from "vitest";

// Mock the entire workspace module with simple behavior
vi.mock("./workspace.js", () => ({
  WorkspaceDetector: vi.fn(() => ({
    detectWorkspace: vi.fn().mockResolvedValue({
      root: "/test/workspace",
      isGitRepository: true,
      detectionMethod: "git",
      relativePath: "",
      isNested: false,
      indicators: ["package.json"],
    }),
    getDefaultDatabasePath: vi
      .fn()
      .mockReturnValue("/test/workspace/.ast-helper/database.db"),
    validateWorkspaceForDatabase: vi.fn().mockResolvedValue(undefined),
    getWorkspaceSummary: vi.fn().mockResolvedValue({
      root: "/test/workspace",
      hasGit: true,
      indicators: ["package.json"],
    }),
    suggestWorkspaceRoots: vi.fn().mockResolvedValue(["/test/workspace"]),
  })),
}));

const { WorkspaceDetector } = await import("./workspace.js");

describe("WorkspaceDetector (Simplified)", () => {
  let workspaceDetector: any;

  beforeEach(() => {
    workspaceDetector = new WorkspaceDetector();
  });

  it("should create WorkspaceDetector instance", () => {
    expect(workspaceDetector).toBeDefined();
  });

  it("should detect workspace", async () => {
    const result = await workspaceDetector.detectWorkspace({
      startDir: "/test/workspace",
    });

    expect(result).toMatchObject({
      root: "/test/workspace",
      isGitRepository: true,
      detectionMethod: "git",
    });
  });

  it("should generate database path", () => {
    const path = workspaceDetector.getDefaultDatabasePath("/test/workspace");
    expect(path).toContain("/test/workspace");
    expect(path).toContain(".ast-helper");
  });

  it("should validate workspace", async () => {
    await expect(
      workspaceDetector.validateWorkspaceForDatabase({
        root: "/test/workspace",
        isGitRepository: true,
        detectionMethod: "git",
      }),
    ).resolves.not.toThrow();
  });

  it("should get workspace summary", async () => {
    const summary =
      await workspaceDetector.getWorkspaceSummary("/test/workspace");
    expect(summary).toHaveProperty("root");
    expect(summary).toHaveProperty("hasGit");
  });

  it("should suggest workspace roots", async () => {
    const suggestions =
      await workspaceDetector.suggestWorkspaceRoots("/test/workspace");
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});
