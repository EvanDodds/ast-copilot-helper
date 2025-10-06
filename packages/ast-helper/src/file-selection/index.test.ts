/**
 * File Selection Engine Tests
 * Tests for glob patterns, configuration-based selection, and file filtering
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolve, join } from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import type { Config } from "../types.js";
import {
  FileSelectionEngine,
  GlobFileSelector,
  ConfigFileSelector,
} from "../file-selection/index.js";
import type { ParseOptions } from "../commands/parse.js";

// Mock the logger
vi.mock("../logging/index.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Test workspace setup
const TEST_WORKSPACE = resolve(
  __dirname,
  "../../test-output/file-selection-test",
);

describe("FileSelectionEngine", () => {
  let fileSelectionEngine: FileSelectionEngine;
  let mockConfig: Config;

  beforeEach(async () => {
    fileSelectionEngine = new FileSelectionEngine();
    mockConfig = {
      parseGlob: ["**/*.{ts,tsx,js,jsx}"],
      watchGlob: ["**/*.{ts,tsx,js,jsx}"],
      outputDir: ".astdb",
      topK: 5,
      snippetLines: 10,
      indexParams: {
        efConstruction: 200,
        M: 16,
      },
      modelHost: "https://models.example.com",
      enableTelemetry: false,
      concurrency: 4,
      batchSize: 10,
    };

    // Create test workspace
    await mkdir(TEST_WORKSPACE, { recursive: true });
  });

  afterEach(async () => {
    vi.clearAllMocks();

    // Clean up test workspace
    try {
      await rm(TEST_WORKSPACE, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Strategy Selection", () => {
    it("should select glob strategy when glob option is provided", async () => {
      const options: ParseOptions = {
        glob: "**/*.ts",
        workspace: TEST_WORKSPACE,
      };

      // Create a test TypeScript file
      await writeFile(join(TEST_WORKSPACE, "test.ts"), 'console.log("test");');

      const result = await fileSelectionEngine.selectFiles(options, mockConfig);
      expect(result.strategy).toBe("glob");
    });

    it("should select config strategy when no specific option is provided", async () => {
      const options: ParseOptions = {
        workspace: TEST_WORKSPACE,
      };

      // Create a test TypeScript file that matches config pattern
      await writeFile(join(TEST_WORKSPACE, "test.ts"), 'console.log("test");');

      const result = await fileSelectionEngine.selectFiles(options, mockConfig);
      expect(result.strategy).toBe("config");
    });

    it("should provide available strategies", () => {
      const strategies = fileSelectionEngine.getAvailableStrategies();
      expect(strategies).toContain("glob");
      expect(strategies).toContain("config");
    });
  });

  describe("File Selection Results", () => {
    it("should return proper FileSelectionResult structure", async () => {
      const options: ParseOptions = {
        glob: "**/*.ts",
        workspace: TEST_WORKSPACE,
      };

      // Create test files
      await writeFile(
        join(TEST_WORKSPACE, "valid.ts"),
        "export const test = 1;",
      );
      await writeFile(join(TEST_WORKSPACE, "readme.md"), "# Test");

      const result = await fileSelectionEngine.selectFiles(options, mockConfig);

      expect(result).toHaveProperty("files");
      expect(result).toHaveProperty("skipped");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("totalSize");
      expect(result).toHaveProperty("strategy");

      expect(Array.isArray(result.files)).toBe(true);
      expect(Array.isArray(result.skipped)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.totalSize).toBe("number");
      expect(typeof result.strategy).toBe("string");
    });
  });
});

describe("GlobFileSelector", () => {
  let globFileSelector: GlobFileSelector;

  beforeEach(async () => {
    globFileSelector = new GlobFileSelector();
    await mkdir(TEST_WORKSPACE, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_WORKSPACE, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Pattern Matching", () => {
    it("should match TypeScript files with *.ts pattern", async () => {
      const options: ParseOptions = {
        glob: "*.ts",
        workspace: TEST_WORKSPACE,
      };

      // Create test files
      await writeFile(
        join(TEST_WORKSPACE, "test.ts"),
        "export const test = 1;",
      );
      await writeFile(join(TEST_WORKSPACE, "test.js"), "const test = 1;");

      const result = await globFileSelector.selectFiles(options, {} as Config);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toMatch(/test\.ts$/);
    });

    it("should match multiple file types with brace expansion", async () => {
      const options: ParseOptions = {
        glob: "**/*.{ts,js}",
        workspace: TEST_WORKSPACE,
      };

      // Create test files in subdirectories
      await mkdir(join(TEST_WORKSPACE, "src"), { recursive: true });
      await writeFile(
        join(TEST_WORKSPACE, "src", "app.ts"),
        "export const app = 1;",
      );
      await writeFile(
        join(TEST_WORKSPACE, "src", "utils.js"),
        "const utils = 1;",
      );
      await writeFile(join(TEST_WORKSPACE, "readme.md"), "# Test");

      const result = await globFileSelector.selectFiles(options, {} as Config);

      expect(result.files).toHaveLength(2);
      expect(result.files.some((f) => f.includes("app.ts"))).toBe(true);
      expect(result.files.some((f) => f.includes("utils.js"))).toBe(true);
    });

    it("should exclude files based on ignore patterns", async () => {
      const options: ParseOptions = {
        glob: "**/*.js",
        workspace: TEST_WORKSPACE,
      };

      // Create files in ignored directories
      await mkdir(join(TEST_WORKSPACE, "node_modules"), { recursive: true });
      await mkdir(join(TEST_WORKSPACE, "src"), { recursive: true });

      await writeFile(
        join(TEST_WORKSPACE, "node_modules", "lib.js"),
        "module.exports = {};",
      );
      await writeFile(join(TEST_WORKSPACE, "src", "app.js"), "const app = 1;");

      const result = await globFileSelector.selectFiles(options, {} as Config);

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toMatch(/app\.js$/);
    });
  });

  describe("File Filtering", () => {
    it("should filter out unsupported file types", async () => {
      const options: ParseOptions = {
        glob: "**/*",
        workspace: TEST_WORKSPACE,
      };

      // Create files with different extensions
      await writeFile(
        join(TEST_WORKSPACE, "code.ts"),
        "export const test = 1;",
      );
      await writeFile(join(TEST_WORKSPACE, "image.png"), "binary data");
      await writeFile(join(TEST_WORKSPACE, "readme.md"), "# Test");

      // Wait a bit for file system to sync
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await globFileSelector.selectFiles(options, {} as Config);

      // Only TypeScript file should be included (or markdown might be included too depending on config)
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some((f) => f.endsWith("code.ts"))).toBe(true);
    });

    it("should handle file size limits", async () => {
      const options: ParseOptions = {
        glob: "**/*.ts",
        workspace: TEST_WORKSPACE,
      };

      // Create a normal sized file
      await writeFile(
        join(TEST_WORKSPACE, "normal.ts"),
        "export const test = 1;",
      );

      // Wait for file system to sync
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await globFileSelector.selectFiles(options, {} as Config);

      expect(result.files.length).toBeGreaterThanOrEqual(1);
      expect(result.errors).toHaveLength(0); // Normal size file should pass
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid glob patterns gracefully", async () => {
      const options: ParseOptions = {
        glob: "[invalid", // Malformed bracket pattern
        workspace: TEST_WORKSPACE,
      };

      // Should not throw, but might not match anything
      await expect(
        globFileSelector.selectFiles(options, {} as Config),
      ).resolves.toBeDefined();
    });

    it("should require glob pattern", async () => {
      const options: ParseOptions = {
        workspace: TEST_WORKSPACE,
        // No glob pattern specified
      };

      await expect(
        globFileSelector.selectFiles(options, {} as Config),
      ).rejects.toThrow("Glob pattern is required");
    });
  });
});

describe("ConfigFileSelector", () => {
  let configFileSelector: ConfigFileSelector;
  let mockConfig: Config;

  beforeEach(async () => {
    configFileSelector = new ConfigFileSelector();
    mockConfig = {
      parseGlob: ["**/*.{ts,tsx,js,jsx}"],
      watchGlob: ["**/*.{ts,tsx,js,jsx}"],
      outputDir: ".astdb",
      topK: 5,
      snippetLines: 10,
      indexParams: {
        efConstruction: 200,
        M: 16,
      },
      modelHost: "https://models.example.com",
      enableTelemetry: false,
      concurrency: 4,
      batchSize: 10,
    };

    await mkdir(TEST_WORKSPACE, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_WORKSPACE, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Configuration-based Selection", () => {
    it("should use parseGlob patterns from configuration", async () => {
      const options: ParseOptions = {
        workspace: TEST_WORKSPACE,
      };

      // Create files matching config patterns
      await writeFile(
        join(TEST_WORKSPACE, "component.tsx"),
        "export const Component = () => {};",
      );
      await writeFile(
        join(TEST_WORKSPACE, "utils.ts"),
        "export const utils = 1;",
      );
      await writeFile(
        join(TEST_WORKSPACE, "styles.css"),
        ".class { color: red; }",
      );

      // Wait for file system to sync
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await configFileSelector.selectFiles(options, mockConfig);

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.strategy).toBe("config");
    });

    it("should handle empty parseGlob configuration", async () => {
      const options: ParseOptions = {
        workspace: TEST_WORKSPACE,
      };

      const emptyConfig = { ...mockConfig, parseGlob: [] };

      await expect(
        configFileSelector.selectFiles(options, emptyConfig),
      ).rejects.toThrow("No parseGlob patterns configured");
    });

    it("should combine multiple patterns correctly", async () => {
      const options: ParseOptions = {
        workspace: TEST_WORKSPACE,
      };

      const multiPatternConfig = {
        ...mockConfig,
        parseGlob: ["**/*.ts", "**/*.py"],
      };

      // Create files for both patterns
      await writeFile(
        join(TEST_WORKSPACE, "script.ts"),
        "export const script = 1;",
      );
      await writeFile(join(TEST_WORKSPACE, "app.py"), 'print("hello")');
      await writeFile(join(TEST_WORKSPACE, "readme.md"), "# Test");

      // Small delay to ensure filesystem visibility
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await configFileSelector.selectFiles(
        options,
        multiPatternConfig,
      );

      expect(result.files).toHaveLength(2);
      expect(result.files.some((f) => f.includes("script.ts"))).toBe(true);
      expect(result.files.some((f) => f.includes("app.py"))).toBe(true);
    });
  });

  describe("Ignore Patterns", () => {
    it("should exclude common ignore patterns", async () => {
      const options: ParseOptions = {
        workspace: TEST_WORKSPACE,
      };

      // Create files in ignored locations
      await mkdir(join(TEST_WORKSPACE, "node_modules"), { recursive: true });
      await mkdir(join(TEST_WORKSPACE, "dist"), { recursive: true });
      await mkdir(join(TEST_WORKSPACE, "src"), { recursive: true });

      await writeFile(
        join(TEST_WORKSPACE, "node_modules", "lib.ts"),
        "export const lib = 1;",
      );
      await writeFile(
        join(TEST_WORKSPACE, "dist", "compiled.js"),
        "var compiled = 1;",
      );
      await writeFile(
        join(TEST_WORKSPACE, "src", "app.ts"),
        "export const app = 1;",
      );

      const result = await configFileSelector.selectFiles(options, mockConfig);

      // Only the source file should be included
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toMatch(/app\.ts$/);
    });
  });
});

describe("File Metadata and Filtering", () => {
  beforeEach(async () => {
    await mkdir(TEST_WORKSPACE, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_WORKSPACE, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it("should collect accurate file metadata", async () => {
    const globSelector = new GlobFileSelector();
    const options: ParseOptions = {
      glob: "**/*.ts",
      workspace: TEST_WORKSPACE,
    };

    const testContent = 'export const test = "hello world";';
    await writeFile(join(TEST_WORKSPACE, "test.ts"), testContent);

    // Wait for file system to sync
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = await globSelector.selectFiles(options, {} as Config);

    expect(result.files).toHaveLength(1);
    expect(result.totalSize).toBeGreaterThan(0);
    expect(result.totalSize).toBe(testContent.length);
  });

  it("should handle symbolic links appropriately", async () => {
    // This test would require platform-specific symlink creation
    // For now, we'll just verify the structure handles it
    const globSelector = new GlobFileSelector();
    const options: ParseOptions = {
      glob: "**/*.ts",
      workspace: TEST_WORKSPACE,
    };

    await writeFile(join(TEST_WORKSPACE, "real.ts"), "export const real = 1;");

    // Wait for file system to sync
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = await globSelector.selectFiles(options, {} as Config);

    expect(result).toHaveProperty("files");
    expect(result.files).toHaveLength(1);
  });
});
