import { promises as fs } from "fs";
import { afterEach, describe, expect, it } from "vitest";
import { ASTTestHelpers, TestRepository } from "../utils/test-helpers";

describe("Test Fixtures and Synthetic Data", () => {
  let tempDirs: string[] = [];

  afterEach(async () => {
    // Cleanup temporary directories
    for (const dir of tempDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    tempDirs = [];
  });

  it("should generate synthetic repository with specified node count", async () => {
    const nodeCount = 500;
    const repoPath =
      await ASTTestHelpers.generateSyntheticRepository(nodeCount);
    tempDirs.push(repoPath);

    // Verify repository structure
    const srcExists = await fs
      .access(repoPath + "/src")
      .then(() => true)
      .catch(() => false);
    expect(srcExists).toBe(true);

    // Verify package.json exists
    const packageExists = await fs
      .access(repoPath + "/package.json")
      .then(() => true)
      .catch(() => false);
    expect(packageExists).toBe(true);

    // Verify tsconfig.json exists
    const tsconfigExists = await fs
      .access(repoPath + "/tsconfig.json")
      .then(() => true)
      .catch(() => false);
    expect(tsconfigExists).toBe(true);

    // Count generated files
    const files = await fs.readdir(repoPath + "/src", { recursive: true });
    const codeFiles = files.filter(
      (file) =>
        typeof file === "string" &&
        (file.endsWith(".ts") || file.endsWith(".js")),
    );

    // Should generate appropriate number of files for the node count
    expect(codeFiles.length).toBeGreaterThan(0);
    expect(codeFiles.length).toBeLessThanOrEqual(
      Math.ceil(nodeCount / 100) * 2,
    ); // Account for different file types
  });

  it("should generate small synthetic repository for quick tests", async () => {
    const nodeCount = 50;
    const repoPath =
      await ASTTestHelpers.generateSyntheticRepository(nodeCount);
    tempDirs.push(repoPath);

    // Small repository should have minimal files
    const files = await fs.readdir(repoPath + "/src", { recursive: true });
    const codeFiles = files.filter(
      (file) =>
        typeof file === "string" &&
        (file.endsWith(".ts") || file.endsWith(".js")),
    );

    expect(codeFiles.length).toBeGreaterThan(0);
    expect(codeFiles.length).toBeLessThanOrEqual(5); // Should be small number for 50 nodes
  });

  it("should create mock AST nodes with proper structure", () => {
    const mockNode = ASTTestHelpers.createMockASTNode({
      type: "ClassDeclaration",
      name: "TestClass",
      significance: "medium",
    });

    expect(mockNode).toHaveProperty("id");
    expect(mockNode).toHaveProperty("type", "ClassDeclaration");
    expect(mockNode).toHaveProperty("name", "TestClass");
    expect(mockNode).toHaveProperty("location");
    expect(mockNode).toHaveProperty("significance", "medium");
    expect(mockNode).toHaveProperty("children");
  });

  it("should create test annotations with metadata", () => {
    const nodeId = "test-node-123";
    const annotation = ASTTestHelpers.createTestAnnotation(nodeId);

    expect(annotation).toHaveProperty("nodeId", nodeId);
    expect(annotation).toHaveProperty("content");
    expect(annotation).toHaveProperty("metadata");
    expect(annotation.metadata).toHaveProperty("generated");
    expect(annotation.metadata).toHaveProperty("type", "test-annotation");
  });

  it("should handle TestRepository operations", async () => {
    const tmpDir = process.cwd() + "/temp_test_" + Date.now();
    await fs.mkdir(tmpDir, { recursive: true });
    tempDirs.push(tmpDir);

    const repo = new TestRepository(tmpDir);

    // Test file creation
    await repo.createFile("test/sample.ts", 'export const test = "hello";');

    const fileExists = await fs
      .access(tmpDir + "/test/sample.ts")
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);

    const content = await fs.readFile(tmpDir + "/test/sample.ts", "utf8");
    expect(content).toBe('export const test = "hello";');
  });
});
