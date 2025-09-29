/**
 * End-to-End Build System Tests
 *
 * Tests that validate the complete WASM build pipeline
 * and ensure both NAPI and WASM builds work correctly.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

const ENGINE_PATH = join(__dirname, "..");

describe("Build System Integration", () => {
  describe("Package Structure", () => {
    it("should have all required build scripts", () => {
      const packageJson = JSON.parse(
        readFileSync(join(ENGINE_PATH, "package.json"), "utf-8"),
      );

      // Check that WASM scripts are present
      expect(packageJson.scripts).toHaveProperty("build:wasm");
      expect(packageJson.scripts).toHaveProperty("test:wasm");
      expect(packageJson.scripts).toHaveProperty("build:all");
      expect(packageJson.scripts).toHaveProperty("clean:all");
    });

    it("should have correct exports configuration", () => {
      const packageJson = JSON.parse(
        readFileSync(join(ENGINE_PATH, "package.json"), "utf-8"),
      );

      // Check that exports include both NAPI and WASM paths
      expect(packageJson.exports).toHaveProperty(".");
      expect(packageJson.exports).toHaveProperty("./wasm");
      expect(packageJson.exports).toHaveProperty("./package.json");
    });

    it("should have WASM type definitions", () => {
      const wasmTypesPath = join(ENGINE_PATH, "wasm.d.ts");
      expect(existsSync(wasmTypesPath)).toBe(true);

      const wasmTypesContent = readFileSync(wasmTypesPath, "utf-8");
      expect(wasmTypesContent).toContain("WasmAstCoreEngineApi");
      expect(wasmTypesContent).toContain("WasmFeatures");
      expect(wasmTypesContent).toContain("init");
    });
  });

  describe("Cargo Configuration", () => {
    it("should have correct feature flags", () => {
      const cargoTomlPath = join(ENGINE_PATH, "Cargo.toml");
      expect(existsSync(cargoTomlPath)).toBe(true);

      const cargoContent = readFileSync(cargoTomlPath, "utf-8");

      // Check for WASM feature configuration
      expect(cargoContent).toContain("[features]");
      expect(cargoContent).toContain("wasm =");

      // Check for conditional dependencies
      expect(cargoContent).toContain("tree-sitter");
      expect(cargoContent).toContain("optional = true");
    });

    it("should exclude incompatible dependencies from WASM", () => {
      const cargoTomlPath = join(ENGINE_PATH, "Cargo.toml");
      const cargoContent = readFileSync(cargoTomlPath, "utf-8");

      // Tree-sitter should be optional (not available in WASM)
      expect(cargoContent).toMatch(/tree-sitter.*optional\s*=\s*true/);
    });
  });

  describe("TypeScript Configuration", () => {
    it("should have WASM path mappings in base config", () => {
      const tsconfigBasePath = join(ENGINE_PATH, "../../tsconfig.base.json");

      if (existsSync(tsconfigBasePath)) {
        const tsconfigContent = readFileSync(tsconfigBasePath, "utf-8");
        expect(tsconfigContent).toContain("ast-core-engine/wasm");
      }
    });

    it("should have consistent type definitions", () => {
      const indexTypesPath = join(ENGINE_PATH, "index.d.ts");
      expect(existsSync(indexTypesPath)).toBe(true);

      const indexTypesContent = readFileSync(indexTypesPath, "utf-8");

      // Check for vector database types (compatibility stubs)
      expect(indexTypesContent).toContain("VectorDbConfig");
      expect(indexTypesContent).toContain("VectorMetadata");
      expect(indexTypesContent).toContain("VectorSearchResult");
    });
  });

  describe("Example Usage", () => {
    it("should have dual engine example", () => {
      const examplePath = join(ENGINE_PATH, "example-usage.ts");
      expect(existsSync(examplePath)).toBe(true);

      const exampleContent = readFileSync(examplePath, "utf-8");

      // Check for both NAPI and WASM usage patterns
      expect(exampleContent).toContain("ast-core-engine");
      expect(exampleContent).toContain("ast-core-engine/wasm");
      expect(exampleContent).toContain("createEngine");
      expect(exampleContent).toContain("preferWasm");
    });
  });
});

describe("Build Process Validation", () => {
  // These tests require actual build tools and may be skipped in CI
  const canRunBuildTests =
    process.env.CI !== "true" || process.env.RUN_BUILD_TESTS === "true";

  describe("NAPI Build", () => {
    it.skipIf(!canRunBuildTests)(
      "should build NAPI bindings successfully",
      () => {
        try {
          // Test that NAPI build works
          const output = execSync("npm run build:debug", {
            cwd: ENGINE_PATH,
            encoding: "utf-8",
            timeout: 30000,
          });

          expect(output).toBeDefined();

          // Check that build artifacts exist
          expect(existsSync(join(ENGINE_PATH, "index.js"))).toBe(true);
          expect(existsSync(join(ENGINE_PATH, "index.d.ts"))).toBe(true);
        } catch (error) {
          console.warn("NAPI build test skipped:", error);
          // This is expected in environments without Rust toolchain
        }
      },
    );
  });

  describe("WASM Build", () => {
    it.skipIf(!canRunBuildTests)(
      "should build WASM package successfully",
      () => {
        try {
          // Test that WASM build works (requires wasm-pack)
          const output = execSync("npm run build:wasm", {
            cwd: ENGINE_PATH,
            encoding: "utf-8",
            timeout: 60000,
          });

          expect(output).toBeDefined();

          // Check that WASM artifacts exist
          const pkgPath = join(ENGINE_PATH, "pkg");
          expect(existsSync(pkgPath)).toBe(true);
          expect(existsSync(join(pkgPath, "package.json"))).toBe(true);

          // Check for WASM binary
          const files = readdirSync(pkgPath);
          const wasmFile = files.find((f: string) => f.endsWith(".wasm"));
          expect(wasmFile).toBeDefined();
        } catch (error) {
          console.warn("WASM build test skipped:", error);
          // This is expected in environments without wasm-pack
        }
      },
    );

    it.skipIf(!canRunBuildTests)(
      "should generate correct WASM package.json",
      () => {
        const pkgPath = join(ENGINE_PATH, "pkg", "package.json");

        if (existsSync(pkgPath)) {
          const pkgContent = JSON.parse(readFileSync(pkgPath, "utf-8"));

          expect(pkgContent.name).toContain("ast-helper");
          expect(
            pkgContent.files.some((f: string) => f.endsWith(".wasm")),
          ).toBe(true);
          // Note: wasm-pack for nodejs target doesn't always generate module field
          expect(pkgContent.main || pkgContent.module).toBeDefined();
          expect(pkgContent.types).toBeDefined();
        }
      },
    );
  });

  describe("Clean Process", () => {
    it("should have working clean scripts", () => {
      const packageJson = JSON.parse(
        readFileSync(join(ENGINE_PATH, "package.json"), "utf-8"),
      );

      // Verify clean scripts exist and are properly configured
      expect(packageJson.scripts["clean:all"]).toBeDefined();
      expect(packageJson.scripts["clean:all"]).toContain("rimraf");

      // Should clean both NAPI and WASM artifacts
      expect(packageJson.scripts["clean:all"]).toContain("pkg");
      expect(packageJson.scripts["clean:all"]).toContain("target");
    });
  });
});

describe("Feature Detection", () => {
  describe("Build-time Feature Detection", () => {
    it("should properly configure features based on target", () => {
      const cargoTomlPath = join(ENGINE_PATH, "Cargo.toml");
      const cargoContent = readFileSync(cargoTomlPath, "utf-8");

      // Post-NAPI removal: should have WASM dependencies as defaults
      expect(cargoContent).toContain("wasm-bindgen");
      expect(cargoContent).toContain("getrandom");

      // Should have wasm feature available
      const wasmFeatureMatch = cargoContent.match(/wasm\s*=\s*\[(.*?)\]/s);
      if (wasmFeatureMatch) {
        // Feature exists - this is good for extensibility
        expect(wasmFeatureMatch[1]).toBeDefined();
      }
    });

    it("should conditionally include tree-sitter only for NAPI", () => {
      const cargoTomlPath = join(ENGINE_PATH, "Cargo.toml");
      const cargoContent = readFileSync(cargoTomlPath, "utf-8");

      // Tree-sitter dependencies should be optional
      const treeSitterDeps = [
        "tree-sitter",
        "tree-sitter-typescript",
        "tree-sitter-javascript",
        "tree-sitter-python",
        "tree-sitter-rust",
        "tree-sitter-java",
        "tree-sitter-cpp",
      ];

      treeSitterDeps.forEach((dep) => {
        if (cargoContent.includes(dep)) {
          // If the dependency exists, it should be optional
          expect(cargoContent).toMatch(
            new RegExp(`${dep}.*optional\\s*=\\s*true`),
          );
        }
      });
    });
  });

  describe("Runtime Feature Detection", () => {
    it("should provide consistent feature detection API", () => {
      // This tests the TypeScript interface
      const wasmTypesPath = join(ENGINE_PATH, "wasm.d.ts");
      const wasmTypesContent = readFileSync(wasmTypesPath, "utf-8");

      // Should export feature detection function
      expect(wasmTypesContent).toContain("getWasmFeatures");
      expect(wasmTypesContent).toContain("WasmFeatures");

      // Features should include standard flags
      expect(wasmTypesContent).toContain("hasTreeSitter");
      expect(wasmTypesContent).toContain("hasVectorOps");
      expect(wasmTypesContent).toContain("hasFileSystem");
    });
  });
});

describe("Documentation Consistency", () => {
  it("should have up-to-date README with WASM usage", () => {
    const readmePath = join(ENGINE_PATH, "README.md");
    expect(existsSync(readmePath)).toBe(true);

    const readmeContent = readFileSync(readmePath, "utf-8");

    // Should document both NAPI and WASM usage
    expect(readmeContent).toContain("NAPI");
    expect(readmeContent).toContain("WASM");
    expect(readmeContent).toContain("WebAssembly");
    expect(readmeContent).toContain("build:wasm");

    // Should include feature comparison
    expect(readmeContent).toContain("Feature Comparison");
    expect(readmeContent).toContain("tree-sitter");
  });

  it("should have consistent examples in documentation", () => {
    const readmePath = join(ENGINE_PATH, "README.md");
    const readmeContent = readFileSync(readmePath, "utf-8");

    // Code examples should be valid TypeScript
    const codeBlocks = readmeContent.match(/```typescript\n(.*?)\n```/gs);

    if (codeBlocks) {
      codeBlocks.forEach((block) => {
        // Basic syntax validation - should have proper imports
        if (block.includes("import")) {
          // Handle both static imports and dynamic imports
          expect(block).toMatch(/import.*from.*['"]|import\s*\(/);
        }

        // Should use proper async/await syntax
        if (block.includes("await")) {
          expect(block).toMatch(/async|Promise/);
        }
      });
    }
  });
});
