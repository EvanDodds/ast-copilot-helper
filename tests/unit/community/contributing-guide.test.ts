import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";

const CONTRIBUTING_PATH = path.join(__dirname, "../../../CONTRIBUTING.md");

describe("CONTRIBUTING.md", () => {
  let content: string;

  beforeAll(async () => {
    try {
      content = await fs.readFile(CONTRIBUTING_PATH, "utf-8");
    } catch (error) {
      console.warn("CONTRIBUTING.md not found:", (error as Error).message);
      content = "";
    }
  });

  it("should exist", async () => {
    expect(content.length).toBeGreaterThan(0);
  });

  it("should have proper title and introduction", () => {
    expect(content).toContain("# Contributing to ast-copilot-helper");
    expect(content).toContain("Thank you for your interest in contributing");
  });

  it("should have table of contents", () => {
    expect(content).toContain("## Table of Contents");
    expect(content).toContain("- [Getting Started]");
    expect(content).toContain("- [Development Setup]");
    expect(content).toContain("- [Contributing Guidelines]");
    expect(content).toContain("- [Pull Request Process]");
  });

  it("should include prerequisites and setup instructions", () => {
    expect(content).toContain("### Prerequisites");
    expect(content).toContain("Node.js 18.0.0 or higher");
    expect(content).toContain("yarn install");
    expect(content).toContain("yarn run build");
    expect(content).toContain("yarn test");
  });

  it("should have project structure documentation", () => {
    expect(content).toContain("### Project Structure");
    expect(content).toContain("ast-helper/");
    expect(content).toContain("ast-mcp-server/");
    expect(content).toContain("vscode-extension/");
  });

  it("should include code standards and style guidelines", () => {
    expect(content).toContain("## Code Standards");
    expect(content).toContain("TypeScript Guidelines");
    expect(content).toContain("Use strict mode");
    expect(content).toContain("yarn run lint");
    expect(content).toContain("yarn run format");
  });

  it("should have commit message format guidelines", () => {
    expect(content).toContain("Commit Message Format");
    expect(content).toContain("Conventional Commits");
    expect(content).toContain("type(scope): description");
    expect(content).toContain("`feat`: New feature");
    expect(content).toContain("`fix`: Bug fix");
    expect(content).toContain("`docs`: Documentation changes");
  });

  it("should include testing guidelines", () => {
    expect(content).toContain("## Testing");
    expect(content).toContain("Unit tests");
    expect(content).toContain("Integration tests");
    expect(content).toContain("yarn test");
    expect(content).toContain("yarn run test:coverage");
  });

  it("should have pull request process documentation", () => {
    expect(content).toContain("## Pull Request Process");
    expect(content).toContain("Before Submitting");
    expect(content).toContain("Creating a Pull Request");
    expect(content).toContain("Code Review Process");
  });

  it("should include community guidelines", () => {
    expect(content).toContain("## Community Guidelines");
    expect(content).toContain("Code of Conduct");
    expect(content).toContain("Communication Channels");
    expect(content).toContain("Getting Help");
  });

  it("should have debugging and troubleshooting sections", () => {
    expect(content).toContain("### Debugging");
    expect(content).toContain("yarn run debug:cli");
    expect(content).toContain("## Troubleshooting");
    expect(content).toContain("Common Issues");
  });

  it("should include all required script references", () => {
    const requiredScripts = [
      "yarn install",
      "yarn run build",
      "yarn test",
      "yarn run lint",
      "yarn run format",
      "yarn run test:coverage",
      "yarn run docs:generate",
    ];

    for (const script of requiredScripts) {
      expect(content).toContain(script);
    }
  });

  it("should have proper markdown formatting", () => {
    // Check for proper header hierarchy
    const headers = content.match(/^#+\s/gm);
    expect(headers).toBeTruthy();
    expect(headers!.length).toBeGreaterThan(10);

    // Check for code blocks
    expect(content).toMatch(/```[\s\S]*?```/);

    // Check for links
    expect(content).toMatch(/\[.*?\]\(.*?\)/);

    // Check for lists
    expect(content).toMatch(/^[\s]*[-*]\s/m);
  });

  it("should reference all important project files", () => {
    const importantFiles = ["README.md", "CODE_OF_CONDUCT.md", "tsconfig.json"];

    for (const file of importantFiles) {
      expect(content).toContain(file);
    }
  });

  it("should have development workflow guidance", () => {
    expect(content).toContain("git checkout -b");
    expect(content).toContain("git commit -m");
    expect(content).toContain("git push origin");
    expect(content).toContain("feature branch");
  });
});
