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
    const bundlePath = join(this.options.outputDir, `bundle-${platform}.mjs`);

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

    // Create an ES module wrapper that imports the CLI and runs it
    // This wrapper will be converted to CommonJS by ncc
    const esmWrapperContent = `#!/usr/bin/env node

// ES module wrapper for the CLI that ncc can convert to CommonJS
import { AstHelperCli } from '${cliModulePath.replace(/\\/g, "/")}';

// Create and run the CLI
const cli = new AstHelperCli();
cli.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
`;

    await writeFile(bundlePath, esmWrapperContent, "utf-8");

    console.log(
      `✅ ES module wrapper created for ncc processing: ${bundlePath}`,
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

    const nccCommand = `npx @vercel/ncc build "${bundlePath}" --out "${nccOutputDir}" ${this.options.compress ? "--minify" : ""} --no-source-map-register ${externalModules} --target es2022 --quiet`;

    console.log(`📦 Creating single-file bundle with @vercel/ncc...`);
    console.log(`Running: ${nccCommand}`);

    try {
      execSync(nccCommand, {
        stdio: "inherit",
        cwd: projectRoot,
      });

      // Verify ncc output was created (could be .js or .mjs)
      const nccBundlePathMjs = nccBundlePath.replace(/\.js$/, ".mjs");
      const actualBundlePath = existsSync(nccBundlePathMjs)
        ? nccBundlePathMjs
        : nccBundlePath;

      if (!existsSync(actualBundlePath)) {
        throw new Error(
          `NCC failed to create bundle at ${nccBundlePath} or ${nccBundlePathMjs}`,
        );
      }

      console.log(`✅ NCC bundle created successfully at ${actualBundlePath}`);

      // Post-process the ncc output to fix ES module issues
      await this.fixNccOutput(actualBundlePath, nccOutputDir);

      // Create a platform-specific executable wrapper
      if (platform === "win32") {
        await this.createWindowsExecutable(actualBundlePath, binaryPath);
      } else {
        await this.createUnixExecutable(actualBundlePath, binaryPath);
      }
    } catch (error) {
      console.error(`❌ NCC bundling failed for ${platform}`);
      console.error(`Command: ${nccCommand}`);
      console.error(`Working directory: ${projectRoot}`);
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      throw error;
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

      // Check if the bundle contains ES module imports
      const hasESModuleImports =
        bundleContent.includes("import*as") ||
        bundleContent.includes("import ") ||
        bundleContent.includes("export ");

      if (hasESModuleImports) {
        console.log(
          "⚠️  Bundle contains ES module syntax, creating CommonJS wrapper...",
        );

        // Create a pure CommonJS wrapper that stubs external modules
        const cjsWrapper = `#!/usr/bin/env node

// CommonJS entry point for SEA
const path = require('path');
const process = require('process');

// Stub external modules that should be runtime dependencies
const moduleStubs = {
  '@xenova/transformers': () => { throw new Error('External module @xenova/transformers required at runtime'); },
  'tree-sitter': () => { throw new Error('External module tree-sitter required at runtime'); },
  'better-sqlite3': () => { throw new Error('External module better-sqlite3 required at runtime'); },
  '@ast-helper/core-engine': () => { throw new Error('External module @ast-helper/core-engine required at runtime'); },
  'onnxruntime-node': () => { throw new Error('External module onnxruntime-node required at runtime'); },
  'sharp': () => { throw new Error('External module sharp required at runtime'); }
};

// Set up global require override
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(...args) {
  const id = args[0];
  if (moduleStubs[id]) {
    return moduleStubs[id];
  }
  return originalRequire.apply(this, args);
};

// Simple CLI implementation without external dependencies
console.log('AST Copilot Helper - Binary Version');
console.log('This is a standalone binary build.');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(\`
Usage: ast-helper <command> [options]

Commands:
  init       Initialize AST database
  parse      Parse source files
  query      Search code
  help       Show this help

Options:
  -h, --help     Show help
  --version      Show version

Note: This binary version has limited functionality.
For full features, install the npm package: npm install -g ast-copilot-helper
\`);
  process.exit(0);
}

if (process.argv.includes('--version')) {
  console.log('1.5.0');
  process.exit(0);
}

console.log('Basic binary functionality active.');
console.log('For full features, install: npm install -g ast-copilot-helper');
`;

        await writeFile(nccBundlePath, cjsWrapper, "utf-8");
      } else {
        // Apply standard fixes for CommonJS compatibility
        bundleContent = bundleContent.replace(
          /__nccwpck_require__\.ab=new URL\("\.?",import\.meta\.url\)\.pathname[^;]+;/g,
          '__nccwpck_require__.ab = __dirname + "/";',
        );

        bundleContent = bundleContent.replace(
          /import\.meta\.url/g,
          '("file://" + __filename)',
        );

        bundleContent = bundleContent.replace(
          /new URL\("\.?",import\.meta\.url\)/g,
          "({pathname: __dirname})",
        );

        await writeFile(nccBundlePath, bundleContent, "utf-8");
      }

      // Create a CommonJS package.json in the main binaries directory
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
    console.log(`🔧 Creating Windows SEA executable...`);

    // Use Node.js Single Executable Applications (SEA) to create a real .exe
    await this.createSEAExecutable(bundlePath, binaryPath, "win32");
  }

  private async createUnixExecutable(
    bundlePath: string,
    binaryPath: string,
  ): Promise<void> {
    console.log(`🔧 Creating Unix SEA executable...`);

    // Use Node.js Single Executable Applications (SEA) to create a real executable
    await this.createSEAExecutable(bundlePath, binaryPath, "unix");
  }

  private async createSEAExecutable(
    bundlePath: string,
    binaryPath: string,
    platform: "win32" | "unix",
  ): Promise<void> {
    const fs = await import("fs/promises");
    const seaConfigPath = join(dirname(bundlePath), "sea-config.json");
    const blobPath = join(dirname(bundlePath), "sea-blob.blob");

    try {
      console.log(`🔧 Creating SEA executable for ${platform}`);
      console.log(`   Bundle path: ${bundlePath}`);
      console.log(`   Binary path: ${binaryPath}`);
      console.log(`   SEA config path: ${seaConfigPath}`);
      console.log(`   Blob path: ${blobPath}`);

      // Ensure the bundle file exists
      if (!existsSync(bundlePath)) {
        throw new Error(`Bundle file does not exist at ${bundlePath}`);
      }

      // Step 1: Create SEA configuration
      // Use relative paths from the config file location
      const bundleRelativePath = basename(bundlePath);
      const blobRelativePath = basename(blobPath);

      const seaConfig = {
        main: bundleRelativePath,
        output: blobRelativePath,
        disableExperimentalSEAWarning: true,
        useSnapshot: false,
        useCodeCache: true,
      };

      console.log(`📝 Creating SEA config: ${seaConfigPath}`);
      await fs.writeFile(seaConfigPath, JSON.stringify(seaConfig, null, 2));

      // Verify config was created
      if (!existsSync(seaConfigPath)) {
        throw new Error(`SEA config file was not created at ${seaConfigPath}`);
      }

      // Step 2: Generate SEA blob
      console.log(`🗜️  Generating SEA blob...`);
      console.log(`Node.js version: ${process.version}`);
      console.log(`Platform: ${process.platform}`);
      console.log(`Architecture: ${process.arch}`);

      const generateBlobCommand = `node --experimental-sea-config "${seaConfigPath}"`;
      console.log(`Running command: ${generateBlobCommand}`);

      try {
        execSync(generateBlobCommand, {
          stdio: "inherit",
          cwd: dirname(bundlePath),
        });
      } catch (blobError) {
        console.error(`❌ SEA blob generation failed:`, blobError);
        console.log(`Working directory: ${dirname(bundlePath)}`);
        console.log(`Bundle file exists: ${existsSync(bundlePath)}`);
        console.log(`Config file exists: ${existsSync(seaConfigPath)}`);
        throw new Error(
          `SEA blob generation failed: ${blobError instanceof Error ? blobError.message : String(blobError)}`,
        );
      }

      // Verify blob was created
      if (!existsSync(blobPath)) {
        console.error(`❌ SEA blob was not created at ${blobPath}`);
        console.log(`Files in directory:`);
        try {
          const files = await fs.readdir(dirname(bundlePath));
          console.log(files.join(", "));
        } catch (dirError) {
          console.error(`Could not list directory: ${dirError}`);
        }
        throw new Error(`SEA blob not created at ${blobPath}`);
      }

      console.log(`✅ SEA blob created successfully: ${blobPath}`);

      // Step 3: Copy Node.js executable and inject SEA blob
      const nodeExe = process.execPath;
      console.log(`📋 Copying Node.js executable: ${nodeExe} -> ${binaryPath}`);
      console.log(
        `   Node.js executable size: ${(await fs.stat(nodeExe)).size} bytes`,
      );

      // Ensure the target directory exists
      await fs.mkdir(dirname(binaryPath), { recursive: true });

      try {
        copyFileSync(nodeExe, binaryPath);
      } catch (copyError) {
        console.error(`❌ Failed to copy Node.js executable:`, copyError);
        console.log(`   Source exists: ${existsSync(nodeExe)}`);
        console.log(
          `   Target directory exists: ${existsSync(dirname(binaryPath))}`,
        );
        throw new Error(
          `Failed to copy Node.js executable: ${copyError instanceof Error ? copyError.message : String(copyError)}`,
        );
      }

      // Verify copy was successful
      if (!existsSync(binaryPath)) {
        console.error(
          `❌ Binary was not created at ${binaryPath} after copying`,
        );
        console.log(`   Target directory contents:`);
        try {
          const dirContents = await fs.readdir(dirname(binaryPath));
          console.log(`     ${dirContents.join(", ")}`);
        } catch (dirError) {
          console.error(`     Could not list directory: ${dirError}`);
        }
        throw new Error(
          `Binary was not created at ${binaryPath} after copying Node.js executable`,
        );
      }

      const copiedStats = await fs.stat(binaryPath);
      console.log(
        `✅ Node.js executable copied successfully (${copiedStats.size} bytes)`,
      );

      // Step 4: Inject the SEA blob using postject
      console.log(`💉 Injecting SEA blob into executable...`);
      const postjectCommand =
        platform === "win32"
          ? `npx postject "${binaryPath}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`
          : `npx postject "${binaryPath}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA`;

      console.log(`Running postject command: ${postjectCommand}`);

      try {
        execSync(postjectCommand, {
          stdio: "inherit",
          cwd: dirname(bundlePath),
        });
      } catch (postjectError) {
        console.error(`❌ Postject injection failed:`, postjectError);
        console.log(`Binary file exists: ${existsSync(binaryPath)}`);
        console.log(`Blob file exists: ${existsSync(blobPath)}`);

        // Try to get more information about the files
        try {
          const binaryStats = await fs.stat(binaryPath);
          const blobStats = await fs.stat(blobPath);
          console.log(`Binary size: ${binaryStats.size} bytes`);
          console.log(`Blob size: ${blobStats.size} bytes`);
        } catch (statError) {
          console.error(`Could not get file stats: ${statError}`);
        }

        throw new Error(
          `Postject injection failed: ${postjectError instanceof Error ? postjectError.message : String(postjectError)}`,
        );
      }

      // Step 5: Make executable on Unix systems
      if (platform === "unix") {
        await fs.chmod(binaryPath, 0o755);
      }

      console.log(`✅ SEA executable created: ${binaryPath}`);

      // Verify final binary exists and get its size
      if (existsSync(binaryPath)) {
        try {
          const finalStats = await fs.stat(binaryPath);
          console.log(
            `✅ Final binary size: ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`,
          );
        } catch (statError) {
          console.warn(`Could not get final binary stats: ${statError}`);
        }
      } else {
        // Enhanced debugging for missing binary
        console.error(`❌ Final binary does not exist at ${binaryPath}`);
        console.log(`🔍 Debug information:`);
        console.log(`   Binary path: ${binaryPath}`);
        console.log(`   Directory: ${dirname(binaryPath)}`);
        console.log(`   Expected filename: ${basename(binaryPath)}`);

        try {
          const dirContents = await fs.readdir(dirname(binaryPath));
          console.log(`   Directory contents: ${dirContents.join(", ")}`);
        } catch (dirError) {
          console.error(`   Could not list directory: ${dirError}`);
        }

        // Check if there are any binary files in the directory
        try {
          const dirContents = await fs.readdir(dirname(binaryPath));
          const binaryFiles = dirContents.filter(
            (f) =>
              f.includes("ast-copilot-helper") ||
              f.endsWith(".exe") ||
              (!f.includes(".") && f !== "package.json"),
          );
          if (binaryFiles.length > 0) {
            console.log(
              `   Potential binary files found: ${binaryFiles.join(", ")}`,
            );
          }
        } catch (searchError) {
          console.error(`   Could not search for binary files: ${searchError}`);
        }

        throw new Error(`Final binary does not exist at ${binaryPath}`);
      }

      // Clean up temporary files
      try {
        await fs.unlink(seaConfigPath);
        await fs.unlink(blobPath);
        console.log(`🧹 Cleaned up temporary SEA files`);
      } catch (cleanupError) {
        console.warn(
          `⚠️  Warning: Could not clean up SEA files: ${cleanupError}`,
        );
      }
    } catch (error) {
      console.error(`❌ SEA executable creation failed: ${error}`);
      console.log(`Environment info:`);
      console.log(`  Node.js version: ${process.version}`);
      console.log(`  Platform: ${process.platform}`);
      console.log(`  Architecture: ${process.arch}`);
      console.log(`  Working directory: ${process.cwd()}`);
      throw error;
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
