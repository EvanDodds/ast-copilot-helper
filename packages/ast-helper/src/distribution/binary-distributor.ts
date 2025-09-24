import { readFile, writeFile, stat } from "fs/promises";
import { join, dirname, basename, extname } from "path";
import { execSync } from "child_process";
import { createHash } from "crypto";
import type {
  DistributionConfig,
  ValidationResult,
  ValidationMessage,
  VerificationResult,
  VerificationCheck,
  Platform,
  BinaryConfig,
  BinaryBuildResult,
  BinaryDistributionResult,
  BinaryAsset,
} from "./types.js";

export interface Publisher {
  initialize(config: DistributionConfig): Promise<void>;
  validate(): Promise<ValidationResult>;
  publish(): Promise<BinaryDistributionResult>;
  verify(result: BinaryDistributionResult): Promise<VerificationResult>;
  cleanup(): Promise<void>;
}

/**
 * Binary distributor for creating and managing cross-platform binary packages
 */
export class BinaryDistributor implements Publisher {
  private config!: DistributionConfig;
  private binaryConfig!: BinaryConfig;
  private binaries: Map<Platform, BinaryBuildResult> = new Map();
  private outputDir!: string;

  async initialize(config: DistributionConfig): Promise<void> {
    this.config = config;
    this.binaryConfig = this.getBinaryConfig();
    this.outputDir = "./dist/binaries"; // Default output directory

    console.log("Initializing Binary Distributor...");
    console.log(`Output directory: ${this.outputDir}`);
    console.log(`Target platforms: ${this.config.platforms.join(", ")}`);

    // Ensure output directory exists
    await this.ensureDirectory(this.outputDir);
  }

  async validate(): Promise<ValidationResult> {
    console.log("Validating binary distribution configuration...");

    const errors: ValidationMessage[] = [];

    // Validate configuration
    if (!this.config.version) {
      errors.push({
        code: "VERSION_MISSING",
        message: "Version is required",
        field: "version",
        severity: "error",
      });
    }

    if (!this.config.platforms?.length) {
      errors.push({
        code: "PLATFORMS_MISSING",
        message: "At least one target platform is required",
        field: "platforms",
        severity: "error",
      });
    }

    // Validate binary configuration
    if (!this.binaryConfig.enabled) {
      errors.push({
        code: "BINARY_DISABLED",
        message: "Binary distribution is disabled",
        field: "binaryConfig.enabled",
        severity: "error",
      });
    }

    if (!this.outputDir) {
      errors.push({
        code: "OUTPUT_DIR_MISSING",
        message: "Output directory is required",
        field: "outputDir",
        severity: "error",
      });
    }

    // Validate tools availability
    const toolChecks = await this.validateTools();
    errors.push(...toolChecks);

    const success = errors.length === 0;
    const message = success
      ? "Binary distribution validation passed"
      : `Validation failed: ${errors.length} errors`;

    console.log(message);
    if (!success) {
      errors.forEach((error) =>
        console.error(`  - ${error.field}: ${error.message}`),
      );
    }

    return { success, warnings: [], errors };
  }

  async publish(): Promise<BinaryDistributionResult> {
    console.log("Starting binary distribution...");
    const startTime = Date.now();

    try {
      // Validate before distributing
      const validation = await this.validate();
      if (!validation.success) {
        const error = `Validation failed: ${validation.errors.map((e) => e.message).join(", ")}`;
        return {
          success: false,
          error,
          binaries: [],
          assets: [],
          checksums: new Map(),
          duration: Date.now() - startTime,
        };
      }

      // Clear output directory
      await this.clearOutputDirectory();

      // Build binaries for each platform
      const binaries: BinaryBuildResult[] = [];
      const assets: BinaryAsset[] = [];
      const checksums = new Map<string, string>();

      for (const platform of this.config.platforms) {
        console.log(`Building binary for ${platform}...`);

        try {
          const binary = await this.buildBinary(platform);
          const asset = await this.packageBinary(binary, platform);

          // Calculate checksums
          const checksum = await this.calculateChecksum(asset.path);
          checksums.set(asset.filename, checksum);

          binaries.push(binary);
          assets.push(asset);

          console.log(
            `✓ Successfully built ${platform} binary: ${asset.filename}`,
          );
        } catch (error) {
          console.error(`✗ Failed to build ${platform} binary:`, error);
          throw error;
        }
      }

      // Generate manifest
      const manifest = await this.generateManifest(binaries, assets, checksums);
      await this.writeManifest(manifest);

      // Sign binaries if configured
      if (this.binaryConfig.signing?.enabled) {
        await this.signBinaries(assets);
      }

      const duration = Date.now() - startTime;

      console.log(`Binary distribution completed in ${duration}ms`);
      console.log(
        `Generated ${binaries.length} binaries and ${assets.length} assets`,
      );

      return {
        success: true,
        binaries,
        assets,
        checksums,
        manifest,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error("Binary distribution failed:", error);

      return {
        success: false,
        error: error.message,
        binaries: [],
        assets: [],
        checksums: new Map(),
        duration,
      };
    }
  }

  async verify(result: BinaryDistributionResult): Promise<VerificationResult> {
    console.log("Verifying binary distribution...");
    const startTime = Date.now();

    const checks: VerificationCheck[] = [];

    try {
      // Verify binaries were created
      for (const binary of result.binaries) {
        const check = await this.verifyBinaryExists(binary);
        checks.push(check);
      }

      // Verify assets were created
      for (const asset of result.assets) {
        const check = await this.verifyAssetExists(asset);
        checks.push(check);
      }

      // Verify checksums
      if (result.checksums && result.checksums.size > 0) {
        const checksumCheck = await this.verifyChecksums(
          result.assets,
          result.checksums,
        );
        checks.push(checksumCheck);
      }

      // Verify manifest
      if (result.manifest) {
        const manifestCheck = await this.verifyManifest(result.manifest);
        checks.push(manifestCheck);
      }

      // Verify signatures if enabled
      if (this.binaryConfig.signing?.enabled) {
        const signatureCheck = await this.verifySignatures(result.assets);
        checks.push(signatureCheck);
      }
    } catch (error: any) {
      console.error("Binary verification failed:", error);
      checks.push({
        name: "verification-error",
        success: false,
        message: `Verification failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
    }

    const allChecksSucceeded = checks.every((c) => c.success);
    const duration = Date.now() - startTime;

    console.log(
      allChecksSucceeded
        ? `Binary verification passed (${checks.length} checks)`
        : `Binary verification failed (${checks.filter((c) => !c.success).length}/${checks.length} checks failed)`,
    );

    if (!allChecksSucceeded) {
      checks
        .filter((c) => !c.success)
        .forEach((check) => {
          console.error(`  ✗ ${check.name}: ${check.message}`);
        });
    }

    return {
      success: allChecksSucceeded,
      checks,
      duration,
    };
  }

  async cleanup(): Promise<void> {
    console.log("Cleaning up binary distribution...");

    // Clean up temporary files
    await this.cleanupTempFiles();

    // Clean up build artifacts
    await this.cleanupBuildArtifacts();

    console.log("Binary distribution cleanup completed");
  }

  private async buildBinary(platform: Platform): Promise<BinaryBuildResult> {
    const buildConfig = this.getBuildConfig(platform);
    const outputName = this.getBinaryName(platform);
    const outputPath = join(this.outputDir, outputName);

    // Execute build command
    const buildCommand = this.getBuildCommand(platform, outputPath);
    console.log(`Executing: ${buildCommand}`);

    try {
      execSync(buildCommand, {
        stdio: "inherit",
        env: { ...process.env, ...buildConfig.env },
      });
    } catch (error: any) {
      throw new Error(`Build failed for ${platform}: ${error.message}`);
    }

    // Verify binary was created
    const stats = await stat(outputPath);

    const binary: BinaryBuildResult = {
      success: true,
      platform,
      architecture: this.getArchitecture(platform),
      binaryPath: outputPath,
      signed: false,
      verified: true,
      size: stats.size,
      checksum: await this.calculateChecksum(outputPath),
    };

    this.binaries.set(platform, binary);
    return binary;
  }

  private async packageBinary(
    binary: BinaryBuildResult,
    platform: Platform,
  ): Promise<BinaryAsset> {
    const packageFormat = this.getPackageFormat(platform);
    const filename = this.getPackageFilename(binary, packageFormat);
    const outputPath = join(this.outputDir, filename);

    switch (packageFormat) {
      case "zip":
        await this.createZipPackage(binary, outputPath);
        break;
      case "tar.gz":
        await this.createTarGzPackage(binary, outputPath);
        break;
      case "deb":
        await this.createDebPackage(binary, outputPath);
        break;
      case "rpm":
        await this.createRpmPackage(binary, outputPath);
        break;
      case "dmg":
        await this.createDmgPackage(binary, outputPath);
        break;
      default:
        throw new Error(`Unsupported package format: ${packageFormat}`);
    }

    const stats = await stat(outputPath);

    return {
      filename,
      path: outputPath,
      size: stats.size,
      platform,
      format: packageFormat,
      checksum: "", // Will be calculated separately
      downloadUrl: "", // Will be set when uploaded
      createdAt: new Date().toISOString(),
    };
  }

  private async createZipPackage(
    binary: BinaryBuildResult,
    outputPath: string,
  ): Promise<void> {
    const command = `cd "${dirname(binary.binaryPath)}" && zip -r "${outputPath}" "${basename(binary.binaryPath)}"`;
    execSync(command);
  }

  private async createTarGzPackage(
    binary: BinaryBuildResult,
    outputPath: string,
  ): Promise<void> {
    const command = `cd "${dirname(binary.binaryPath)}" && tar -czf "${outputPath}" "${basename(binary.binaryPath)}"`;
    execSync(command);
  }

  private async createDebPackage(
    binary: BinaryBuildResult,
    outputPath: string,
  ): Promise<void> {
    // Create .deb package structure and build
    const tempDir = join(this.outputDir, "deb-temp");
    await this.ensureDirectory(join(tempDir, "DEBIAN"));
    await this.ensureDirectory(join(tempDir, "usr", "local", "bin"));

    // Copy binary
    const command = `cp "${binary.binaryPath}" "${join(tempDir, "usr", "local", "bin")}"`;
    execSync(command);

    // Create control file
    const controlContent = this.generateDebControlFile(binary);
    await writeFile(join(tempDir, "DEBIAN", "control"), controlContent);

    // Build package
    execSync(`dpkg-deb --build "${tempDir}" "${outputPath}"`);

    // Cleanup
    execSync(`rm -rf "${tempDir}"`);
  }

  private async createRpmPackage(
    binary: BinaryBuildResult,
    _outputPath: string,
  ): Promise<void> {
    // Create RPM spec and build
    const specContent = this.generateRpmSpecFile(binary);
    const specPath = join(this.outputDir, "package.spec");
    await writeFile(specPath, specContent);

    const command = `rpmbuild -bb --define "_topdir ${this.outputDir}" "${specPath}"`;
    execSync(command);
  }

  private async createDmgPackage(
    binary: BinaryBuildResult,
    outputPath: string,
  ): Promise<void> {
    // Create macOS DMG
    const tempDir = join(this.outputDir, "dmg-temp");
    await this.ensureDirectory(tempDir);

    // Copy binary to temp directory
    const command = `cp "${binary.binaryPath}" "${tempDir}/"`;
    execSync(command);

    // Create DMG
    const dmgCommand = `hdiutil create -volname "${this.config.name}" -srcfolder "${tempDir}" -ov -format UDZO "${outputPath}"`;
    execSync(dmgCommand);

    // Cleanup
    execSync(`rm -rf "${tempDir}"`);
  }

  private async signBinaries(assets: BinaryAsset[]): Promise<void> {
    console.log("Signing binaries...");

    if (!this.binaryConfig.signing) {
      return;
    }

    for (const asset of assets) {
      try {
        await this.signAsset(asset);
        console.log(`✓ Signed ${asset.filename}`);
      } catch (error) {
        console.error(`✗ Failed to sign ${asset.filename}:`, error);
        throw error;
      }
    }
  }

  private async signAsset(asset: BinaryAsset): Promise<void> {
    const signingConfig = this.binaryConfig.signing!;

    switch (asset.platform) {
      case "win32":
        await this.signWindowsAsset(asset, signingConfig);
        break;
      case "darwin":
        await this.signMacAsset(asset, signingConfig);
        break;
      case "linux":
        await this.signLinuxAsset(asset, signingConfig);
        break;
    }
  }

  private async signWindowsAsset(
    asset: BinaryAsset,
    signingConfig: any,
  ): Promise<void> {
    const command = `signtool sign /f "${signingConfig.certificate}" /p "${signingConfig.password}" /t "${signingConfig.timestampUrl}" "${asset.path}"`;
    execSync(command);
  }

  private async signMacAsset(
    asset: BinaryAsset,
    signingConfig: any,
  ): Promise<void> {
    const command = `codesign --force --verify --verbose --sign "${signingConfig.identity}" "${asset.path}"`;
    execSync(command);
  }

  private async signLinuxAsset(
    asset: BinaryAsset,
    _signingConfig: any,
  ): Promise<void> {
    const command = `gpg --armor --detach-sig --sign "${asset.path}"`;
    execSync(command);
  }

  private async generateManifest(
    binaries: BinaryBuildResult[],
    assets: BinaryAsset[],
    checksums: Map<string, string>,
  ): Promise<any> {
    return {
      version: this.config.version,
      name: this.config.name,
      generatedAt: new Date().toISOString(),
      platforms: this.config.platforms,
      binaries: binaries.map((binary) => ({
        platform: binary.platform,
        architecture: binary.architecture,
        size: binary.size,
        signed: binary.signed,
        verified: binary.verified,
      })),
      assets: assets.map((asset) => ({
        filename: asset.filename,
        platform: asset.platform,
        format: asset.format,
        size: asset.size,
        checksum: checksums.get(asset.filename),
        createdAt: asset.createdAt,
      })),
      checksums: Object.fromEntries(checksums),
    };
  }

  private async writeManifest(manifest: any): Promise<void> {
    const manifestPath = join(this.outputDir, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✓ Generated manifest: ${manifestPath}`);
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const content = await readFile(filePath);
    return createHash("sha256").update(content).digest("hex");
  }

  private async validateTools(): Promise<ValidationMessage[]> {
    const errors: ValidationMessage[] = [];

    // Check for required build tools based on target platforms
    for (const platform of this.config.platforms) {
      const requiredTools = this.getRequiredTools(platform);

      for (const tool of requiredTools) {
        try {
          execSync(`which ${tool}`, { stdio: "ignore" });
        } catch {
          errors.push({
            code: "TOOL_MISSING",
            message: `Required tool '${tool}' not found for ${platform} builds`,
            field: `tools.${tool}`,
            severity: "error",
          });
        }
      }
    }

    return errors;
  }

  private getRequiredTools(platform: Platform): string[] {
    const tools: { [key in Platform]: string[] } = {
      win32: ["zip"],
      darwin: ["zip", "hdiutil"],
      linux: ["tar", "gzip"],
    };

    const baseDependencies = ["node"];
    const platformTools = tools[platform] || [];

    return [...baseDependencies, ...platformTools];
  }

  private getBuildConfig(platform: Platform): any {
    return {
      env: {
        GOOS: this.getGOOS(platform),
        GOARCH: this.getGOARCH(platform),
        CGO_ENABLED: "0",
      },
    };
  }

  private getBuildCommand(_platform: Platform, outputPath: string): string {
    // For now, assuming we're building a Go binary
    return `go build -o "${outputPath}" ./cmd/main.go`;
  }

  private getBinaryName(platform: Platform): string {
    const baseName = this.config.name;
    const version = this.config.version;
    const extension = platform === "win32" ? ".exe" : "";
    return `${baseName}-v${version}-${platform}${extension}`;
  }

  private getPackageFormat(platform: Platform): string {
    const formats: { [key in Platform]: string } = {
      win32: "zip",
      darwin: "zip",
      linux: "tar.gz",
    };
    return formats[platform];
  }

  private getPackageFilename(
    binary: BinaryBuildResult,
    format: string,
  ): string {
    const baseName = basename(binary.binaryPath, extname(binary.binaryPath));
    return `${baseName}.${format}`;
  }

  private getArchitecture(_platform: Platform): string {
    // Default to amd64, can be made configurable
    return "amd64";
  }

  private getGOOS(platform: Platform): string {
    const osMap: { [key in Platform]: string } = {
      win32: "windows",
      darwin: "darwin",
      linux: "linux",
    };
    return osMap[platform];
  }

  private getGOARCH(_platform: Platform): string {
    return "amd64"; // Default architecture
  }

  private generateDebControlFile(_binary: BinaryBuildResult): string {
    return `Package: ${this.config.name}
Version: ${this.config.version}
Section: utils
Priority: optional
Architecture: amd64
Maintainer: ${this.config.name} Team
Description: ${this.config.name} binary package
`;
  }

  private generateRpmSpecFile(binary: BinaryBuildResult): string {
    return `Name: ${this.config.name}
Version: ${this.config.version}
Release: 1
Summary: ${this.config.name} binary package
License: MIT
Group: Applications/System

%description
${this.config.name} binary package

%files
/usr/local/bin/${basename(binary.binaryPath)}
`;
  }

  private async verifyBinaryExists(
    binary: BinaryBuildResult,
  ): Promise<VerificationCheck> {
    try {
      await stat(binary.binaryPath);
      return {
        name: `binary-exists-${binary.platform}`,
        success: true,
        message: `Binary exists for ${binary.platform}`,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        name: `binary-exists-${binary.platform}`,
        success: false,
        message: `Binary missing for ${binary.platform}: ${binary.binaryPath}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async verifyAssetExists(
    asset: BinaryAsset,
  ): Promise<VerificationCheck> {
    try {
      await stat(asset.path);
      return {
        name: `asset-exists-${asset.platform}`,
        success: true,
        message: `Asset exists for ${asset.platform}: ${asset.filename}`,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        name: `asset-exists-${asset.platform}`,
        success: false,
        message: `Asset missing for ${asset.platform}: ${asset.path}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async verifyChecksums(
    assets: BinaryAsset[],
    checksums: Map<string, string>,
  ): Promise<VerificationCheck> {
    try {
      for (const asset of assets) {
        const expectedChecksum = checksums.get(asset.filename);
        if (!expectedChecksum) {
          throw new Error(`Missing checksum for ${asset.filename}`);
        }

        const actualChecksum = await this.calculateChecksum(asset.path);
        if (actualChecksum !== expectedChecksum) {
          throw new Error(`Checksum mismatch for ${asset.filename}`);
        }
      }

      return {
        name: "checksums-valid",
        success: true,
        message: `All ${assets.length} checksums are valid`,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        name: "checksums-valid",
        success: false,
        message: `Checksum validation failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async verifyManifest(manifest: any): Promise<VerificationCheck> {
    try {
      const manifestPath = join(this.outputDir, "manifest.json");
      await stat(manifestPath);

      // Validate manifest structure
      if (
        !manifest.version ||
        !manifest.name ||
        !manifest.binaries ||
        !manifest.assets
      ) {
        throw new Error("Invalid manifest structure");
      }

      return {
        name: "manifest-valid",
        success: true,
        message: "Manifest is valid and accessible",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        name: "manifest-valid",
        success: false,
        message: `Manifest validation failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async verifySignatures(
    assets: BinaryAsset[],
  ): Promise<VerificationCheck> {
    try {
      for (const asset of assets) {
        await this.verifyAssetSignature(asset);
      }

      return {
        name: "signatures-valid",
        success: true,
        message: `All ${assets.length} signatures are valid`,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        name: "signatures-valid",
        success: false,
        message: `Signature validation failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async verifyAssetSignature(asset: BinaryAsset): Promise<void> {
    // Platform-specific signature verification
    switch (asset.platform) {
      case "win32":
        execSync(`signtool verify /pa "${asset.path}"`);
        break;
      case "darwin":
        execSync(`codesign --verify --deep --strict "${asset.path}"`);
        break;
      case "linux":
        execSync(`gpg --verify "${asset.path}.sig" "${asset.path}"`);
        break;
    }
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await stat(dirPath);
    } catch {
      execSync(`mkdir -p "${dirPath}"`);
    }
  }

  private async clearOutputDirectory(): Promise<void> {
    try {
      execSync(`rm -rf "${this.outputDir}"/*`);
      console.log(`Cleared output directory: ${this.outputDir}`);
    } catch (error) {
      console.warn(`Failed to clear output directory: ${error}`);
    }
  }

  private async cleanupTempFiles(): Promise<void> {
    const tempPattern = join(this.outputDir, "*-temp");
    try {
      execSync(`rm -rf ${tempPattern}`);
    } catch {
      // Ignore cleanup errors
    }
  }

  private async cleanupBuildArtifacts(): Promise<void> {
    const artifactPatterns = ["*.spec", "DEBIAN/", "rpmbuild/"];

    for (const pattern of artifactPatterns) {
      try {
        execSync(`rm -rf "${join(this.outputDir, pattern)}"`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private getBinaryConfig(): BinaryConfig {
    return (
      this.config?.binaryDistribution || {
        enabled: true,
        platforms: ["win32", "darwin", "linux"],
        signing: {
          enabled: false,
        },
        packaging: {
          formats: ["zip", "tar.gz"],
        },
        distribution: {
          channels: ["stable"],
          defaultChannel: "stable",
          promotion: {
            automatic: false,
            rules: [],
          },
        },
      }
    );
  }
}
