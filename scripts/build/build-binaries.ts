#!/usr/bin/env tsx
/**
 * Binary Build Script for AST Copilot Helper
 * Creates bundled applications with shell wrappers using @vercel/ncc and esbuild
 * Modern alternative to deprecated pkg package
 */

import { execSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
} from "fs";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";
import * as esbuild from "esbuild";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "../..");
const outputDir = join(projectRoot, "dist/binaries");

interface BuildOptions {
  platforms: string[];
  outputDir: string;
  version: string;
  clean: boolean;
  compress: boolean;
  sign: boolean;
}

interface BuildResult {
  platform: string;
  arch: string;
  binaryPath: string;
  size: number;
  success: boolean;
  error?: string;
}

class BinaryBuilder {
  private options: BuildOptions;
  private packageJson: any;

  constructor(options: BuildOptions) {
    this.options = options;

    // Read package.json for metadata
    const packagePath = join(projectRoot, "package.json");
    this.packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  }

  async build(): Promise<BuildResult[]> {
    console.log("🔨 Starting binary build process...");
    console.log(
      `📦 Building for platforms: ${this.options.platforms.join(", ")}`,
    );

    // Ensure output directory exists
    this.ensureOutputDirectory();

    // Clean previous builds if requested
    if (this.options.clean) {
      await this.cleanPreviousBuilds();
    }

    const results: BuildResult[] = [];

    for (const platform of this.options.platforms) {
      console.log(`\n🏗️ Building for ${platform}...`);

      try {
        const result = await this.buildForPlatform(platform);
        results.push(result);

        if (result.success) {
          console.log(`✅ ${platform} build completed: ${result.binaryPath}`);
          console.log(
            `📊 Binary size: ${(result.size / 1024 / 1024).toFixed(2)} MB`,
          );
        } else {
          console.error(`❌ ${platform} build failed: ${result.error}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`❌ ${platform} build failed: ${errorMessage}`);
        results.push({
          platform,
          arch: "x64",
          binaryPath: "",
          size: 0,
          success: false,
          error: errorMessage,
        });
      }
    }

    // Generate build manifest
    await this.generateBuildManifest(results);

    // Sign binaries if requested
    if (this.options.sign) {
      await this.signBinaries(results.filter((r) => r.success));
    }

    return results;
  }

  private async buildForPlatform(platform: string): Promise<BuildResult> {
    const arch = "x64"; // Default to x64, can be extended later
    const extension = platform === "win32" ? ".exe" : "";
    const binaryName = `ast-copilot-helper-${platform}-${arch}${extension}`;
    const binaryPath = join(this.options.outputDir, binaryName);

    // First, create a bundled entry point using esbuild
    const bundlePath = join(this.options.outputDir, `bundle-${platform}.js`);

    try {
      // Step 1: Bundle with esbuild
      await this.createBundle(bundlePath, platform);

      // Step 2: Create bundled executable with @vercel/ncc
      await this.createExecutable(bundlePath, binaryPath, platform);

      // Step 3: Calculate total distribution size (including all chunks and dependencies)
      const totalSize = await this.calculateTotalBinarySize(
        binaryPath,
        platform,
      );

      return {
        platform,
        arch,
        binaryPath,
        size: totalSize,
        success: true,
      };
    } catch (error) {
      throw error;
    }
  }

  private async createBundle(
    bundlePath: string,
    platform: string,
  ): Promise<void> {
    console.log(`📦 Creating bundle for ${platform}...`);

    // Create a CommonJS wrapper entry point that ncc can handle properly
    const { writeFile } = await import("fs/promises");

    // Use absolute path to ensure ncc can resolve the module
    const cliModulePath = join(projectRoot, "packages/ast-helper/dist/cli.js");

    // Validate that the CLI module exists
    if (!existsSync(cliModulePath)) {
      throw new Error(
        `CLI module not found at ${cliModulePath}. Make sure to run 'yarn build' first.`,
      );
    }

    console.log(`✅ CLI module found at: ${cliModulePath}`);

    const cjsWrapperContent = `#!/usr/bin/env node

// CommonJS wrapper for the CLI
const { AstHelperCli } = require('${cliModulePath.replace(/\\/g, "/")}');

// Create and run the CLI
const cli = new AstHelperCli();
cli.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
`;

    await writeFile(bundlePath, cjsWrapperContent, "utf-8");

    console.log(
      `✅ CommonJS wrapper created for ncc processing: ${bundlePath}`,
    );
    console.log(`   CLI module path: ${cliModulePath}`);
  }

  private async createExecutable(
    bundlePath: string,
    binaryPath: string,
    platform: string,
  ): Promise<void> {
    console.log(`🔧 Creating executable for ${platform}...`);

    // Create a single-file bundle with @vercel/ncc
    const nccOutputDir = join(this.options.outputDir, `ncc-${platform}`);
    const nccBundlePath = join(nccOutputDir, "index.js");

    // Use @vercel/ncc to create a single file with all dependencies
    const externalModules = [
      "better-sqlite3",
      "tree-sitter",
      "@ast-helper/core-engine",
      "@xenova/transformers",
      "onnxruntime-node",
      "sharp",
    ]
      .map((mod) => `--external ${mod}`)
      .join(" ");

    const nccCommand = `npx @vercel/ncc build "${bundlePath}" --out "${nccOutputDir}" ${this.options.compress ? "--minify" : ""} --no-source-map-register ${externalModules} --quiet`;

    console.log(`📦 Creating single-file bundle with @vercel/ncc...`);
    console.log(`Running: ${nccCommand}`);

    try {
      execSync(nccCommand, {
        stdio: "inherit",
        cwd: projectRoot,
      });

      // Verify ncc output was created
      if (!existsSync(nccBundlePath)) {
        throw new Error(`NCC failed to create bundle at ${nccBundlePath}`);
      }

      console.log(`✅ NCC bundle created successfully at ${nccBundlePath}`);
    } catch (error) {
      console.error(`❌ NCC bundling failed for ${platform}`);
      console.error(`Command: ${nccCommand}`);
      console.error(`Working directory: ${projectRoot}`);
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      throw error;
    }

    // Post-process the ncc output to fix ES module issues
    await this.fixNccOutput(nccBundlePath, nccOutputDir);

    // Create a platform-specific executable wrapper
    if (platform === "win32") {
      await this.createWindowsExecutable(nccBundlePath, binaryPath);
    } else {
      await this.createUnixExecutable(nccBundlePath, binaryPath);
    }

    console.log(`✅ Executable created: ${binaryPath}`);
  }

  private async fixNccOutput(
    nccBundlePath: string,
    nccOutputDir: string,
  ): Promise<void> {
    console.log(`🔧 Post-processing ncc output...`);

    try {
      // Read the generated bundle
      const { readFile, writeFile } = await import("fs/promises");
      let bundleContent = await readFile(nccBundlePath, "utf-8");

      // Replace the specific problematic ncc pattern that uses import.meta.url
      bundleContent = bundleContent.replace(
        /__nccwpck_require__\.ab=new URL\("\.?",import\.meta\.url\)\.pathname[^;]+;/g,
        '__nccwpck_require__.ab = __dirname + "/";',
      );

      // Replace any remaining import.meta.url usage
      bundleContent = bundleContent.replace(
        /import\.meta\.url/g,
        '("file://" + __filename)',
      );

      // Replace new URL(".", import.meta.url) patterns
      bundleContent = bundleContent.replace(
        /new URL\("\.?",import\.meta\.url\)/g,
        "({pathname: __dirname})",
      );

      // Write the fixed content back
      await writeFile(nccBundlePath, bundleContent, "utf-8");

      // Create a CommonJS package.json in the main binaries directory (not ncc subdirectory)
      const mainPackageJsonPath = join(dirname(nccOutputDir), "package.json");
      const packageJsonContent = JSON.stringify({ type: "commonjs" }, null, 2);
      await writeFile(mainPackageJsonPath, packageJsonContent, "utf-8");

      console.log(`✅ Fixed ncc output for CommonJS compatibility`);
    } catch (error) {
      console.warn(
        `⚠️  Warning: Could not fix ncc output: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async createWindowsExecutable(
    bundlePath: string,
    binaryPath: string,
  ): Promise<void> {
    const fs = await import("fs/promises");

    // Create a .cmd wrapper for Windows
    const cmdPath = binaryPath.replace(/\.exe$/, ".cmd");
    const cmdContent = `@echo off
"${process.execPath}" "${bundlePath}" %*`;

    writeFileSync(cmdPath, cmdContent);

    // Also create a PowerShell wrapper for better compatibility
    const ps1Path = binaryPath.replace(/\.exe$/, ".ps1");
    const ps1Content = `#!/usr/bin/env pwsh
& "${process.execPath}" "${bundlePath}" $args`;

    writeFileSync(ps1Path, ps1Content);

    // Copy the bundle with .cjs extension to force CommonJS mode
    const cjsBundleName = basename(bundlePath).replace(/\.js$/, ".cjs");
    const cjsBundlePath = join(dirname(binaryPath), cjsBundleName);
    copyFileSync(bundlePath, cjsBundlePath);

    // Copy all chunk files that ncc might have created
    const nccOutputDir = dirname(bundlePath);
    const binariesDir = dirname(binaryPath);

    try {
      const files = await fs.readdir(nccOutputDir);
      for (const file of files) {
        // Copy any additional .js files (chunks) that ncc created
        if (file.endsWith(".js") && file !== basename(bundlePath)) {
          const sourcePath = join(nccOutputDir, file);
          const destPath = join(binariesDir, file);
          copyFileSync(sourcePath, destPath);
          console.log(`📋 Copied ncc chunk: ${file}`);
        }
      }
    } catch (error) {
      console.warn(
        `⚠️  Warning: Could not copy ncc chunks: ${error instanceof Error ? error.message : error}`,
      );
    }

    // Create the actual .exe file as a batch script that can be executed directly
    const exeContent = `@echo off
rem Auto-generated Windows executable for AST Copilot Helper
rem This batch file runs the bundled Node.js application

rem Find Node.js executable
set NODE_EXEC=
where node >nul 2>&1
if %errorlevel% equ 0 (
    set NODE_EXEC=node
) else (
    where nodejs >nul 2>&1
    if %errorlevel% equ 0 (
        set NODE_EXEC=nodejs
    ) else (
        echo Error: Node.js is required but not found in PATH
        echo Please install Node.js 20+ from https://nodejs.org/
        exit /b 1
    )
)

rem Get the directory of this script
set SCRIPT_DIR=%~dp0
set BUNDLE_PATH=%SCRIPT_DIR%${cjsBundleName}

rem Run the bundled application
"%NODE_EXEC%" "%BUNDLE_PATH%" %*`;

    writeFileSync(binaryPath, exeContent);
  }

  private async createUnixExecutable(
    bundlePath: string,
    binaryPath: string,
  ): Promise<void> {
    // Create a shell wrapper for Unix systems
    const bundleBasename = basename(bundlePath);
    // Use .cjs extension to force CommonJS mode
    const cjsBundleName = bundleBasename.replace(/\.js$/, ".cjs");

    const shellContent = `#!/bin/bash
# Auto-generated executable wrapper for AST Copilot Helper
# This script runs the bundled Node.js application

# Find Node.js executable
NODE_EXEC=""
if command -v node >/dev/null 2>&1; then
    NODE_EXEC="node"
elif command -v nodejs >/dev/null 2>&1; then
    NODE_EXEC="nodejs"
else
    echo "Error: Node.js is required but not found in PATH"
    echo "Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_PATH="\${SCRIPT_DIR}/${cjsBundleName}"

# Run the bundled application
exec "\${NODE_EXEC}" "\${BUNDLE_PATH}" "$@"`;

    writeFileSync(binaryPath, shellContent);

    // Make the wrapper executable
    const fs = await import("fs/promises");
    await fs.chmod(binaryPath, 0o755);

    // Copy the bundle next to the wrapper with .cjs extension
    const cjsBundlePath = join(dirname(binaryPath), cjsBundleName);
    copyFileSync(bundlePath, cjsBundlePath);

    // Copy all chunk files that ncc might have created
    const nccOutputDir = dirname(bundlePath);
    const binariesDir = dirname(binaryPath);

    try {
      const files = await fs.readdir(nccOutputDir);
      for (const file of files) {
        // Copy any additional .js files (chunks) that ncc created
        if (file.endsWith(".js") && file !== basename(bundlePath)) {
          const sourcePath = join(nccOutputDir, file);
          const destPath = join(binariesDir, file);
          copyFileSync(sourcePath, destPath);
          console.log(`📋 Copied ncc chunk: ${file}`);
        }
      }
    } catch (error) {
      console.warn(
        `⚠️  Warning: Could not copy ncc chunks: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private findMainEntry(packagePath: string): string {
    // Try different possible entry points
    const possibleEntries = [
      join(packagePath, "bin/ast-helper"), // The actual CLI entry point
      join(packagePath, "dist/cli.js"), // Compiled CLI entry point
      join(packagePath, "dist/cli/index.js"),
      join(packagePath, "dist/index.js"),
      join(packagePath, "src/cli/index.ts"),
      join(packagePath, "src/index.ts"),
      join(packagePath, "index.js"),
      join(packagePath, "index.ts"),
    ];

    for (const entry of possibleEntries) {
      if (existsSync(entry)) {
        console.log(`📁 Found entry point: ${entry}`);
        return entry;
      }
    }

    throw new Error(
      `Could not find main entry point in ${packagePath}. Tried: ${possibleEntries.join(", ")}`,
    );
  }

  private createNexeConfig(platform: string): any {
    return {
      name: this.packageJson.name,
      version: this.packageJson.version,
      description: this.packageJson.description,
      // Resources to include in the executable
      resources: [
        "packages/ast-core-engine/*.node",
        "node_modules/better-sqlite3/**/*",
        "node_modules/tree-sitter/**/*",
        "node_modules/tree-sitter-*/**/*",
      ],
    };
  }

  private ensureOutputDirectory(): void {
    if (!existsSync(this.options.outputDir)) {
      mkdirSync(this.options.outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${this.options.outputDir}`);
    }
  }

  private async calculateTotalBinarySize(
    binaryPath: string,
    platform: string,
  ): Promise<number> {
    const fs = await import("fs/promises");
    const binariesDir = dirname(binaryPath);
    let totalSize = 0;

    try {
      // Get size of the main executable wrapper
      const binaryStats = await fs.stat(binaryPath);
      totalSize += binaryStats.size;

      // Get size of the main bundle (.cjs or .js file)
      const bundleExtension = platform === "win32" ? ".js" : ".cjs";
      const bundleName =
        basename(binaryPath).replace(/\.(exe|cmd|ps1)?$/, "") + bundleExtension;
      const bundlePath = join(binariesDir, bundleName);

      try {
        const bundleStats = await fs.stat(bundlePath);
        totalSize += bundleStats.size;
      } catch (error) {
        // Try alternative bundle location
        const indexCjsPath = join(binariesDir, "index.cjs");
        try {
          const indexStats = await fs.stat(indexCjsPath);
          totalSize += indexStats.size;
        } catch (e) {
          console.warn(`⚠️  Could not find main bundle for ${platform}`);
        }
      }

      // Add all ncc chunk files
      const files = await fs.readdir(binariesDir);
      for (const file of files) {
        if (file.endsWith(".index.js")) {
          const chunkPath = join(binariesDir, file);
          const chunkStats = await fs.stat(chunkPath);
          totalSize += chunkStats.size;
        }
      }

      return totalSize;
    } catch (error) {
      console.warn(
        `⚠️  Could not calculate total size for ${platform}: ${error instanceof Error ? error.message : error}`,
      );
      // Fallback to just the binary file size
      try {
        const stats = await fs.stat(binaryPath);
        return stats.size;
      } catch (fallbackError) {
        return 0;
      }
    }
  }

  private async cleanPreviousBuilds(): Promise<void> {
    console.log("🧹 Cleaning previous builds...");

    try {
      const { rm } = await import("fs/promises");
      if (existsSync(this.options.outputDir)) {
        await rm(this.options.outputDir, { recursive: true, force: true });
        mkdirSync(this.options.outputDir, { recursive: true });
      }
      console.log("✅ Previous builds cleaned");
    } catch (error) {
      console.warn("⚠️ Could not clean previous builds:", error);
    }
  }

  private async generateBuildManifest(results: BuildResult[]): Promise<void> {
    const manifest = {
      version: this.options.version,
      buildTime: new Date().toISOString(),
      builds: results.map((result) => ({
        platform: result.platform,
        arch: result.arch,
        success: result.success,
        binaryPath: result.success ? basename(result.binaryPath) : null,
        size: result.size,
        error: result.error || null,
      })),
      summary: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    };

    const manifestPath = join(this.options.outputDir, "build-manifest.json");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log(`\n📋 Build manifest generated: ${manifestPath}`);
    console.log(
      `✅ Successful builds: ${manifest.summary.successful}/${manifest.summary.total}`,
    );
  }

  private async signBinaries(results: BuildResult[]): Promise<void> {
    console.log("\n🔐 Signing binaries...");

    for (const result of results) {
      try {
        await this.signBinary(result);
        console.log(`✅ Signed: ${basename(result.binaryPath)}`);
      } catch (error) {
        console.warn(
          `⚠️ Could not sign ${basename(result.binaryPath)}:`,
          error,
        );
      }
    }
  }

  private async signBinary(result: BuildResult): Promise<void> {
    // Platform-specific signing
    switch (result.platform) {
      case "win32":
        // Windows code signing (requires signtool and certificate)
        if (process.env.WINDOWS_CERTIFICATE_PATH) {
          execSync(
            `signtool sign /f "${process.env.WINDOWS_CERTIFICATE_PATH}" /p "${process.env.WINDOWS_CERTIFICATE_PASSWORD}" /t http://timestamp.sectigo.com "${result.binaryPath}"`,
          );
        }
        break;

      case "darwin":
        // macOS code signing (requires Developer ID)
        if (process.env.MACOS_DEVELOPER_ID) {
          execSync(
            `codesign --force --verify --verbose --sign "${process.env.MACOS_DEVELOPER_ID}" "${result.binaryPath}"`,
          );
        }
        break;

      case "linux":
        // Linux GPG signing
        if (process.env.GPG_KEY_ID) {
          execSync(
            `gpg --armor --detach-sig --local-user "${process.env.GPG_KEY_ID}" "${result.binaryPath}"`,
          );
        }
        break;
    }
  }
}

// CLI Interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse command line arguments
  let platforms: string[] = ["win32", "darwin", "linux"];
  let clean = false;
  let compress = true;
  let sign = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--platforms":
        platforms = args[++i]?.split(",") || platforms;
        break;
      case "--platform":
        platforms = [args[++i]];
        break;
      case "--clean":
        clean = true;
        break;
      case "--no-compress":
        compress = false;
        break;
      case "--sign":
        sign = true;
        break;
      case "--help":
        printHelp();
        return;
    }
  }

  // Get version from package.json
  const packagePath = join(projectRoot, "package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const version = packageJson.version;

  const options: BuildOptions = {
    platforms,
    outputDir,
    version,
    clean,
    compress,
    sign,
  };

  console.log("🚀 AST Copilot Helper Binary Builder");
  console.log(`📝 Version: ${version}`);
  console.log(`🎯 Platforms: ${platforms.join(", ")}`);
  console.log(`📁 Output: ${outputDir}`);

  const builder = new BinaryBuilder(options);

  try {
    const results = await builder.build();

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(`\n🎉 Build complete!`);
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (failed.length > 0) {
      console.log("\n❌ Failed builds:");
      failed.forEach((result) => {
        console.log(`  - ${result.platform}: ${result.error}`);
      });
      process.exit(1);
    }
  } catch (error) {
    console.error("💥 Build failed:", error);
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
🚀 AST Copilot Helper Binary Builder

Usage: tsx scripts/build/build-binaries.ts [options]

Options:
  --platforms <list>    Comma-separated list of platforms (win32,darwin,linux)
  --platform <name>     Build for single platform
  --clean               Clean previous builds
  --no-compress         Disable compression
  --sign                Sign binaries (requires certificates)
  --help                Show this help

Examples:
  tsx scripts/build/build-binaries.ts --platforms win32,linux
  tsx scripts/build/build-binaries.ts --platform darwin --clean
  tsx scripts/build/build-binaries.ts --sign

Environment Variables:
  WINDOWS_CERTIFICATE_PATH      Path to Windows code signing certificate
  WINDOWS_CERTIFICATE_PASSWORD  Password for Windows certificate
  MACOS_DEVELOPER_ID           macOS Developer ID for code signing
  GPG_KEY_ID                   GPG key ID for Linux signing
`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}

export { BinaryBuilder, BuildOptions, BuildResult };
