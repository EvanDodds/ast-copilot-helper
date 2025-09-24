import { describe, it, expect, beforeEach, vi } from "vitest";
import { DependencyLicenseAnalyzer } from "../DependencyLicenseAnalyzer";
import { LicenseDatabase } from "../LicenseDatabase";

// Mock filesystem operations
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  access: vi.fn(),
  constants: { F_OK: 0 },
}));

vi.mock("path", () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
}));

describe("DependencyLicenseAnalyzer", () => {
  let analyzer: DependencyLicenseAnalyzer;
  let licenseDatabase: LicenseDatabase;
  let mockReadFile: any;
  let mockAccess: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mock functions
    const fs = await import("fs/promises");
    mockReadFile = vi.mocked(fs.readFile);
    mockAccess = vi.mocked(fs.access);

    // Initialize license database
    licenseDatabase = new LicenseDatabase();
    await licenseDatabase.initialize();

    analyzer = new DependencyLicenseAnalyzer(licenseDatabase);
  });

  describe("initialization", () => {
    it("should initialize successfully", () => {
      expect(analyzer).toBeInstanceOf(DependencyLicenseAnalyzer);
    });

    it("should initialize compatibility matrix", async () => {
      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          depth: 0,
        },
      );

      expect(result).toBeDefined();
      expect(result.dependencies).toBeDefined();
      expect(result.conflicts).toBeDefined();
      expect(result.compatibility).toBeDefined();
      expect(result.statistics).toBeDefined();
    });
  });

  describe("dependency scanning", () => {
    it("should scan basic dependencies", async () => {
      const packageJson = {
        name: "test-project",
        version: "1.0.0",
        license: "MIT",
        dependencies: {
          lodash: "^4.17.21",
          express: "^4.18.0",
        },
      };

      const lodashPackage = {
        name: "lodash",
        version: "4.17.21",
        license: "MIT",
        description: "A utility library",
      };

      const expressPackage = {
        name: "express",
        version: "4.18.0",
        license: "MIT",
        description: "Fast, unopinionated web framework",
      };

      mockAccess.mockImplementation(async (path: string) => {
        if (path.includes("package.json")) {
          return Promise.resolve();
        }
        throw new Error("File not found");
      });

      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify(packageJson);
        } else if (path.includes("lodash/package.json")) {
          return JSON.stringify(lodashPackage);
        } else if (path.includes("express/package.json")) {
          return JSON.stringify(expressPackage);
        } else if (path.includes("LICENSE")) {
          return "MIT License\n\nCopyright (c) 2023 Test Author\n";
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          depth: 1,
        },
      );

      expect(result.dependencies).toHaveLength(2);
      expect(result.dependencies[0].name).toBe("lodash");
      expect(result.dependencies[0].license).toBe("MIT");
      expect(result.dependencies[1].name).toBe("express");
      expect(result.dependencies[1].license).toBe("MIT");
    });

    it("should include dev dependencies when requested", async () => {
      const packageJson = {
        name: "test-project",
        version: "1.0.0",
        license: "MIT",
        dependencies: {
          lodash: "^4.17.21",
        },
        devDependencies: {
          jest: "^29.0.0",
        },
      };

      const lodashPackage = {
        name: "lodash",
        version: "4.17.21",
        license: "MIT",
      };

      const jestPackage = {
        name: "jest",
        version: "29.0.0",
        license: "MIT",
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify(packageJson);
        } else if (path.includes("lodash/package.json")) {
          return JSON.stringify(lodashPackage);
        } else if (path.includes("jest/package.json")) {
          return JSON.stringify(jestPackage);
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          includeDevDependencies: true,
          skipNpmRegistry: true,
          depth: 1,
        },
      );

      expect(result.dependencies).toHaveLength(2);
      expect(result.dependencies.some((d) => d.name === "lodash")).toBe(true);
      expect(result.dependencies.some((d) => d.name === "jest")).toBe(true);
    });

    it("should handle missing package.json gracefully", async () => {
      mockAccess.mockRejectedValue(new Error("File not found"));

      const result = await analyzer.analyzeDependencies(
        "/nonexistent/project",
        "MIT",
        {
          skipNpmRegistry: true,
        },
      );

      expect(result.dependencies).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it("should handle malformed package.json", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue("invalid json");

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
        },
      );

      expect(result.dependencies).toHaveLength(0);
    });
  });

  describe("license extraction", () => {
    it("should extract license from package.json string", async () => {
      const packageJson = {
        name: "test-package",
        version: "1.0.0",
        license: "Apache-2.0",
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify({
            dependencies: { "test-package": "1.0.0" },
          });
        } else if (path.includes("test-package/package.json")) {
          return JSON.stringify(packageJson);
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          depth: 1,
        },
      );

      expect(result.dependencies[0].license).toBe("Apache-2.0");
    });

    it("should extract license from package.json object", async () => {
      const packageJson = {
        name: "test-package",
        version: "1.0.0",
        license: {
          type: "BSD-3-Clause",
          url: "https://example.com/license",
        },
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify({
            dependencies: { "test-package": "1.0.0" },
          });
        } else if (path.includes("test-package/package.json")) {
          return JSON.stringify(packageJson);
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          depth: 1,
        },
      );

      expect(result.dependencies[0].license).toBe("BSD-3-Clause");
    });

    it("should extract license from legacy licenses array", async () => {
      const packageJson = {
        name: "test-package",
        version: "1.0.0",
        licenses: [{ type: "MIT" }, { type: "Apache-2.0" }],
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify({
            dependencies: { "test-package": "1.0.0" },
          });
        } else if (path.includes("test-package/package.json")) {
          return JSON.stringify(packageJson);
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          depth: 1,
        },
      );

      expect(result.dependencies[0].license).toBe("MIT OR Apache-2.0");
    });

    it("should default to Unknown for missing license", async () => {
      const packageJson = {
        name: "test-package",
        version: "1.0.0",
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify({
            dependencies: { "test-package": "1.0.0" },
          });
        } else if (path.includes("test-package/package.json")) {
          return JSON.stringify(packageJson);
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          depth: 1,
        },
      );

      expect(result.dependencies[0].license).toBe("Unknown");
    });
  });

  describe("license text extraction", () => {
    it("should find and read LICENSE file", async () => {
      const packageJson = {
        name: "test-package",
        version: "1.0.0",
        license: "MIT",
      };

      const licenseText =
        "MIT License\n\nCopyright (c) 2023 Test Author\n\nPermission is hereby granted...";

      mockAccess.mockImplementation(async (path: string) => {
        if (path.includes("package.json") || path.includes("LICENSE")) {
          return Promise.resolve();
        }
        throw new Error("File not found");
      });

      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify({
            dependencies: { "test-package": "1.0.0" },
          });
        } else if (path.includes("test-package/package.json")) {
          return JSON.stringify(packageJson);
        } else if (path.includes("LICENSE")) {
          return licenseText;
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          depth: 1,
        },
      );

      expect(result.dependencies[0].licenseText).toBe(licenseText);
      expect(result.dependencies[0].copyrightHolders).toContain("Test Author");
    });

    it("should try multiple license file names", async () => {
      const packageJson = {
        name: "test-package",
        version: "1.0.0",
        license: "MIT",
      };

      mockAccess.mockImplementation(async (path: string) => {
        if (path.includes("package.json")) {
          return Promise.resolve();
        } else if (path.includes("LICENCE.txt")) {
          return Promise.resolve();
        }
        throw new Error("File not found");
      });

      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify({
            dependencies: { "test-package": "1.0.0" },
          });
        } else if (path.includes("test-package/package.json")) {
          return JSON.stringify(packageJson);
        } else if (path.includes("LICENCE.txt")) {
          return "MIT License text";
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          depth: 1,
        },
      );

      expect(result.dependencies[0].licenseText).toBe("MIT License text");
    });
  });

  describe("copyright extraction", () => {
    it("should extract copyright holders from license text", async () => {
      const licenseText = `MIT License

Copyright (c) 2023 John Doe
Copyright 2022-2023 Jane Smith <jane@example.com>
Copyright (c) 2021 ACME Corp

Permission is hereby granted...`;

      const packageJson = {
        name: "test-package",
        version: "1.0.0",
        license: "MIT",
      };

      mockAccess.mockImplementation(async (path: string) => {
        if (path.includes("package.json") || path.includes("LICENSE")) {
          return Promise.resolve();
        }
        throw new Error("File not found");
      });

      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify({
            dependencies: { "test-package": "1.0.0" },
          });
        } else if (path.includes("test-package/package.json")) {
          return JSON.stringify(packageJson);
        } else if (path.includes("LICENSE")) {
          return licenseText;
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          depth: 1,
        },
      );

      const copyrightHolders = result.dependencies[0].copyrightHolders || [];
      expect(copyrightHolders).toContain("John Doe");
      expect(copyrightHolders).toContain("Jane Smith jane@example.com");
      expect(copyrightHolders).toContain("ACME Corp");
    });

    it("should handle license text without copyright information", async () => {
      const licenseText = "This is public domain code.";

      const packageJson = {
        name: "test-package",
        version: "1.0.0",
        license: "Unlicense",
      };

      mockAccess.mockImplementation(async (path: string) => {
        if (path.includes("package.json") || path.includes("LICENSE")) {
          return Promise.resolve();
        }
        throw new Error("File not found");
      });

      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify({
            dependencies: { "test-package": "1.0.0" },
          });
        } else if (path.includes("test-package/package.json")) {
          return JSON.stringify(packageJson);
        } else if (path.includes("LICENSE")) {
          return licenseText;
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          depth: 1,
        },
      );

      expect(result.dependencies[0].copyrightHolders).toHaveLength(0);
    });
  });

  describe("license conflict detection", () => {
    it("should detect GPL conflicts with MIT project", async () => {
      const packageJson = {
        dependencies: {
          "gpl-package": "1.0.0",
        },
      };

      const gplPackage = {
        name: "gpl-package",
        version: "1.0.0",
        license: "GPL-3.0",
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify(packageJson);
        } else if (path.includes("gpl-package/package.json")) {
          return JSON.stringify(gplPackage);
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          conflictResolutionMode: "strict",
        },
      );

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].dependency).toBe("gpl-package");
      expect(result.conflicts[0].license).toBe("GPL-3.0");
      expect(result.conflicts[0].severity).toBe("error");
      expect(result.compatibility.isCompatible).toBe(false);
      expect(result.compatibility.overallRisk).toBe("critical");
    });

    it("should allow compatible licenses", async () => {
      const packageJson = {
        dependencies: {
          "mit-package": "1.0.0",
          "apache-package": "2.0.0",
        },
      };

      const mitPackage = {
        name: "mit-package",
        version: "1.0.0",
        license: "MIT",
      };

      const apachePackage = {
        name: "apache-package",
        version: "2.0.0",
        license: "Apache-2.0",
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify(packageJson);
        } else if (path.includes("mit-package/package.json")) {
          return JSON.stringify(mitPackage);
        } else if (path.includes("apache-package/package.json")) {
          return JSON.stringify(apachePackage);
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
        },
      );

      expect(result.conflicts).toHaveLength(0);
      expect(result.compatibility.isCompatible).toBe(true);
      expect(result.compatibility.overallRisk).toBe("low");
    });

    it("should handle unknown licenses based on conflict resolution mode", async () => {
      const packageJson = {
        dependencies: {
          "unknown-package": "1.0.0",
        },
      };

      const unknownPackage = {
        name: "unknown-package",
        version: "1.0.0",
        // No license field
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify(packageJson);
        } else if (path.includes("unknown-package/package.json")) {
          return JSON.stringify(unknownPackage);
        }
        throw new Error("File not found");
      });

      // Strict mode should flag unknown licenses as errors
      const strictResult = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          conflictResolutionMode: "strict",
        },
      );

      expect(strictResult.conflicts).toHaveLength(1);
      expect(strictResult.conflicts[0].severity).toBe("error");

      // Permissive mode should allow unknown licenses
      const permissiveResult = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          conflictResolutionMode: "permissive",
        },
      );

      expect(permissiveResult.conflicts).toHaveLength(0);
    });
  });

  describe("statistics generation", () => {
    it("should generate comprehensive statistics", async () => {
      const packageJson = {
        dependencies: {
          "mit-package": "1.0.0",
          "apache-package": "2.0.0",
          "another-mit": "1.0.0",
        },
      };

      const mitPackage1 = {
        name: "mit-package",
        version: "1.0.0",
        license: "MIT",
      };

      const apachePackage = {
        name: "apache-package",
        version: "2.0.0",
        license: "Apache-2.0",
      };

      const mitPackage2 = {
        name: "another-mit",
        version: "1.0.0",
        license: "MIT",
      };

      mockAccess.mockImplementation(async (path: string) => {
        if (path.includes("package.json")) {
          return Promise.resolve();
        } else if (path.includes("LICENSE")) {
          return Promise.resolve();
        }
        throw new Error("File not found");
      });

      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify(packageJson);
        } else if (path.includes("mit-package/package.json")) {
          return JSON.stringify(mitPackage1);
        } else if (path.includes("apache-package/package.json")) {
          return JSON.stringify(apachePackage);
        } else if (path.includes("another-mit/package.json")) {
          return JSON.stringify(mitPackage2);
        } else if (path.includes("LICENSE")) {
          return "Copyright (c) 2023 Test Author\n";
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
        },
      );

      expect(result.statistics.totalDependencies).toBe(3);
      expect(result.statistics.uniqueLicenses).toContain("MIT");
      expect(result.statistics.uniqueLicenses).toContain("Apache-2.0");
      expect(result.statistics.licenseDistribution["MIT"]).toBe(2);
      expect(result.statistics.licenseDistribution["Apache-2.0"]).toBe(1);
      expect(result.statistics.copyrightHolders).toContain("Test Author");
      expect(result.statistics.riskAnalysis.low).toBeGreaterThan(0);
    });
  });

  describe("analysis report generation", () => {
    it("should generate formatted analysis report", async () => {
      const packageJson = {
        dependencies: {
          "test-package": "1.0.0",
        },
      };

      const testPackage = {
        name: "test-package",
        version: "1.0.0",
        license: "MIT",
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify(packageJson);
        } else if (path.includes("test-package/package.json")) {
          return JSON.stringify(testPackage);
        } else if (path === "/test/report.md") {
          throw new Error("File not found");
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
        },
      );

      await expect(
        analyzer.generateAnalysisReport(result, "/test/report.md"),
      ).resolves.not.toThrow();
    });
  });

  describe("error handling", () => {
    it("should handle dependency analysis failures gracefully", async () => {
      const packageJson = {
        dependencies: {
          "failing-package": "1.0.0",
          "working-package": "1.0.0",
        },
      };

      const workingPackage = {
        name: "working-package",
        version: "1.0.0",
        license: "MIT",
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify(packageJson);
        } else if (path.includes("working-package/package.json")) {
          return JSON.stringify(workingPackage);
        } else if (path.includes("failing-package/package.json")) {
          throw new Error("Package not found");
        }
        throw new Error("File not found");
      });

      const result = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
        },
      );

      // Should include both the working package and a failed entry for the failing package
      expect(result.dependencies).toHaveLength(2);
      expect(
        result.dependencies.some((d) => d.name === "working-package"),
      ).toBe(true);
      expect(
        result.dependencies.some((d) => d.name === "failing-package"),
      ).toBe(true);

      const failedDep = result.dependencies.find(
        (d) => d.name === "failing-package",
      );
      expect(failedDep?.license).toBe("Unknown");
    });

    it("should handle npm registry failures gracefully", async () => {
      const result = await analyzer.analyzeDependencies("/nonexistent", "MIT", {
        skipNpmRegistry: false, // Enable NPM registry (which should fail gracefully)
      });

      expect(result).toBeDefined();
      expect(result.npmAnalysis).toBeDefined();
      expect(result.npmAnalysis?.registryData).toBeDefined();
    });
  });

  describe("options handling", () => {
    it("should respect depth option", async () => {
      const parentPackage = {
        dependencies: {
          "child-package": "1.0.0",
        },
      };

      const childPackage = {
        name: "child-package",
        version: "1.0.0",
        license: "MIT",
        dependencies: {
          "grandchild-package": "1.0.0",
        },
      };

      const grandchildPackage = {
        name: "grandchild-package",
        version: "1.0.0",
        license: "MIT",
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockImplementation(async (path: string) => {
        if (path === "/test/project/package.json") {
          return JSON.stringify(parentPackage);
        } else if (path.includes("child-package/package.json")) {
          return JSON.stringify(childPackage);
        } else if (path.includes("grandchild-package/package.json")) {
          return JSON.stringify(grandchildPackage);
        }
        throw new Error("File not found");
      });

      // Depth 0 should only scan direct dependencies
      const shallowResult = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          depth: 0,
        },
      );

      expect(shallowResult.dependencies).toHaveLength(1);
      expect(shallowResult.dependencies[0].name).toBe("child-package");

      // Depth 1 should include child dependencies
      const deepResult = await analyzer.analyzeDependencies(
        "/test/project",
        "MIT",
        {
          skipNpmRegistry: true,
          depth: 1,
        },
      );

      expect(deepResult.dependencies).toHaveLength(2);
      expect(
        deepResult.dependencies.some((d) => d.name === "child-package"),
      ).toBe(true);
      expect(
        deepResult.dependencies.some((d) => d.name === "grandchild-package"),
      ).toBe(true);
    });
  });
});
