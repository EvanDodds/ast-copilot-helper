/**
 * NPM Publisher
 * Handles publishing packages to NPM registry with validation and verification
 */

import { promises as fs } from "fs";
import * as path from "path";
import { execSync } from "child_process";
import type {
  BasePublisher,
  DistributionConfig,
  NPMPublishResult,
  PackagePublishResult,
  PublicationVerification,
  ValidationResult,
  VerificationResult,
  PackageConfig,
  RegistryConfig,
} from "./types";

export class NPMPublisher
  implements BasePublisher<DistributionConfig, NPMPublishResult> {
  private config!: DistributionConfig;
  private npmRegistry!: RegistryConfig;
  private logger: Console = console;

  /**
   * Initialize NPM publisher with configuration
   */
  async initialize(config: DistributionConfig): Promise<void> {
    this.logger.log("Initializing NPM Publisher...");

    this.config = config;

    // Find NPM registry configuration
    this.npmRegistry = this.config.registries.find((r) => r.type === "npm") || {
      type: "npm",
      url: "https://registry.npmjs.org",
    };

    // Validate NPM environment
    await this.validateNPMEnvironment();

    this.logger.log("NPM Publisher initialized successfully");
  }

  /**
   * Validate NPM publishing setup
   */
  async validate(): Promise<ValidationResult> {
    const warnings: any[] = [];
    const errors: any[] = [];

    try {
      // 1. Check npm command availability
      try {
        execSync("npm --version", { stdio: "ignore" });
      } catch (error) {
        errors.push({
          code: "NPM_NOT_AVAILABLE",
          message: "npm command not available",
          severity: "error",
        });
      }

      // 2. Check authentication
      if (this.npmRegistry.token) {
        try {
          const whoami = execSync("npm whoami", {
            encoding: "utf8",
            env: { ...process.env, NPM_TOKEN: this.npmRegistry.token },
          }).trim();
          this.logger.log(`Authenticated as NPM user: ${whoami}`);
        } catch (error) {
          errors.push({
            code: "NPM_AUTH_FAILED",
            message: "NPM authentication failed",
            severity: "error",
          });
        }
      } else {
        warnings.push({
          code: "NO_NPM_TOKEN",
          message: "No NPM token provided - will use existing authentication",
          severity: "warning",
        });
      }

      // 3. Validate packages for NPM publishing
      const npmPackages = this.config.packages.filter(
        (pkg) => pkg.type === "npm",
      );
      if (npmPackages.length === 0) {
        warnings.push({
          code: "NO_NPM_PACKAGES",
          message: "No NPM packages configured for publishing",
          severity: "warning",
        });
      }

      // 4. Check package configurations
      for (const pkg of npmPackages) {
        await this.validatePackageForNPM(pkg, errors, warnings);
      }

      return {
        success: errors.length === 0,
        warnings,
        errors,
      };
    } catch (error) {
      errors.push({
        code: "VALIDATION_ERROR",
        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: "error",
      });

      return {
        success: false,
        warnings,
        errors,
      };
    }
  }

  /**
   * Publish packages to NPM
   */
  async publish(): Promise<NPMPublishResult> {
    this.logger.log("Starting NPM package publication...");
    const startTime = Date.now();

    try {
      // 1. Validate before publishing
      const validationResult = await this.validate();
      if (!validationResult.success) {
        throw new Error(
          `Validation failed: ${validationResult.errors.map((e) => e.message).join(", ")}`,
        );
      }

      const results: PackagePublishResult[] = [];
      const npmPackages = this.config.packages.filter(
        (pkg) => pkg.type === "npm",
      );

      for (const packageConfig of npmPackages) {
        this.logger.log(`Publishing package: ${packageConfig.name}`);

        try {
          // 2. Prepare package for publishing
          await this.preparePackageForPublishing(packageConfig);

          // 3. Publish package
          const publishResult = await this.publishSinglePackage(packageConfig);
          results.push(publishResult);

          if (publishResult.success) {
            this.logger.log(
              `✅ Successfully published ${packageConfig.name}@${this.config.version}`,
            );
          } else {
            this.logger.error(
              `❌ Failed to publish ${packageConfig.name}: ${publishResult.error}`,
            );
          }
        } catch (error) {
          const failedResult: PackagePublishResult = {
            success: false,
            packageName: packageConfig.name,
            version: this.config.version,
            registry: this.npmRegistry.url,
            duration: 0,
            error: error instanceof Error ? error.message : String(error),
          };
          results.push(failedResult);
          this.logger.error(
            `❌ Failed to publish ${packageConfig.name}:`,
            error,
          );
        }
      }

      const overallResult: NPMPublishResult = {
        success: results.every((r) => r.success),
        packages: results,
        duration: Date.now() - startTime,
        registry: this.npmRegistry.url,
        version: this.config.version,
      };

      if (overallResult.success) {
        this.logger.log(
          `🎉 All packages published successfully in ${overallResult.duration}ms`,
        );
        await this.sendPublishNotification(overallResult);
      } else {
        const failedPackages = results
          .filter((r) => !r.success)
          .map((r) => r.packageName);
        this.logger.error(
          `💥 Failed to publish packages: ${failedPackages.join(", ")}`,
        );

        overallResult.error = `Failed to publish: ${failedPackages.join(", ")}`;
      }

      return overallResult;
    } catch (error) {
      this.logger.error("NPM publication failed:", error);

      return {
        success: false,
        packages: [],
        duration: Date.now() - startTime,
        registry: this.npmRegistry.url,
        version: this.config.version,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Verify NPM publication results
   */
  async verify(result: NPMPublishResult): Promise<VerificationResult> {
    this.logger.log("Verifying NPM publication results...");
    const startTime = Date.now();
    const checks: any[] = [];

    try {
      for (const packageResult of result.packages) {
        if (packageResult.success) {
          // Verify package exists in registry
          const packageCheck = await this.verifyPackageInRegistry(
            packageResult.packageName,
            packageResult.version,
          );

          checks.push({
            name: `Package ${packageResult.packageName} availability`,
            success: packageCheck.packageExists,
            message: packageCheck.packageExists
              ? `Package available at ${packageCheck.downloadUrl}`
              : `Package not found in registry`,
            duration: 0,
          });

          // Verify installation works
          const installCheck = await this.verifyPackageInstallation(
            packageResult.packageName,
            packageResult.version,
          );

          checks.push({
            name: `Package ${packageResult.packageName} installation`,
            success: installCheck,
            message: installCheck
              ? "Package installs correctly"
              : "Package installation failed",
            duration: 0,
          });
        }
      }

      return {
        success: checks.every((check) => check.success),
        checks,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      checks.push({
        name: "Verification process",
        success: false,
        message: `Verification failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime,
      });

      return {
        success: false,
        checks,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Cleanup after publishing
   */
  async cleanup(): Promise<void> {
    this.logger.log("Cleaning up NPM publisher...");

    // Clean up any temporary files or configurations
    // For now, this is a no-op, but could include:
    // - Removing temporary package tarballs
    // - Clearing authentication tokens
    // - Resetting npm configuration

    this.logger.log("NPM publisher cleanup completed");
  }

  // Private helper methods

  /**
   * Validate NPM environment
   */
  private async validateNPMEnvironment(): Promise<void> {
    try {
      // Check npm version
      const npmVersion = execSync("npm --version", { encoding: "utf8" }).trim();
      this.logger.log(`NPM version: ${npmVersion}`);

      // Check npm configuration
      execSync("npm config list", { encoding: "utf8" });
      this.logger.log("NPM configuration validated");
    } catch (error) {
      throw new Error(
        `NPM environment validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate a package for NPM publishing
   */
  private async validatePackageForNPM(
    pkg: PackageConfig,
    errors: any[],
    warnings: any[],
  ): Promise<void> {
    const packageJsonPath = path.join(pkg.path, "package.json");

    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf8");
      const packageJson = JSON.parse(packageJsonContent);

      // Check required NPM fields
      const requiredFields = ["name", "version", "main", "license"];
      for (const field of requiredFields) {
        if (!packageJson[field]) {
          errors.push({
            code: "MISSING_NPM_FIELD",
            message: `Package ${pkg.name} missing required field: ${field}`,
            field,
            severity: "error",
          });
        }
      }

      // Check recommended fields
      const recommendedFields = [
        "description",
        "keywords",
        "repository",
        "author",
      ];
      for (const field of recommendedFields) {
        if (!packageJson[field]) {
          warnings.push({
            code: "MISSING_RECOMMENDED_FIELD",
            message: `Package ${pkg.name} missing recommended field: ${field}`,
            field,
            severity: "warning",
          });
        }
      }

      // Validate package name format
      if (
        packageJson.name &&
        !/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
          packageJson.name,
        )
      ) {
        errors.push({
          code: "INVALID_PACKAGE_NAME",
          message: `Package name ${packageJson.name} is not valid for NPM`,
          severity: "error",
        });
      }

      // Check if main file exists
      if (packageJson.main) {
        const mainFilePath = path.join(pkg.path, packageJson.main);
        try {
          await fs.access(mainFilePath);
        } catch (error) {
          errors.push({
            code: "MAIN_FILE_MISSING",
            message: `Main file not found: ${mainFilePath}`,
            severity: "error",
          });
        }
      }
    } catch (error) {
      errors.push({
        code: "PACKAGE_JSON_INVALID",
        message: `Invalid package.json for ${pkg.name}: ${error instanceof Error ? error.message : String(error)}`,
        severity: "error",
      });
    }
  }

  /**
   * Prepare package for publishing
   */
  private async preparePackageForPublishing(
    packageConfig: PackageConfig,
  ): Promise<void> {
    this.logger.log(`Preparing ${packageConfig.name} for NPM publishing...`);

    // 1. Update package version
    const packageJsonPath = path.join(packageConfig.path, "package.json");
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);

    packageJson.version = this.config.version;

    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    this.logger.log(
      `Updated ${packageConfig.name} version to ${this.config.version}`,
    );

    // 2. Run build script if it exists
    if (packageConfig.publishConfig.scripts.build) {
      this.logger.log(`Running build script for ${packageConfig.name}...`);
      execSync("npm run build", { stdio: "inherit", cwd: packageConfig.path });
    }

    // 3. Run tests if they exist
    if (packageConfig.publishConfig.scripts.test) {
      this.logger.log(`Running tests for ${packageConfig.name}...`);
      execSync("npm test", { stdio: "inherit", cwd: packageConfig.path });
    }
  }

  /**
   * Publish a single package
   */
  private async publishSinglePackage(
    packageConfig: PackageConfig,
  ): Promise<PackagePublishResult> {
    const startTime = Date.now();
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds base delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Configure NPM registry and auth
        await this.configureNPMAuth();

        // Build npm publish command
        const publishArgs = ["publish"];

        if (packageConfig.publishConfig.access) {
          publishArgs.push("--access", packageConfig.publishConfig.access);
        }

        if (packageConfig.publishConfig.tag) {
          publishArgs.push("--tag", packageConfig.publishConfig.tag);
        }

        if (packageConfig.publishConfig.registry) {
          publishArgs.push("--registry", packageConfig.publishConfig.registry);
        }

        // Execute npm publish
        this.logger.log(
          `Executing: npm ${publishArgs.join(" ")} (attempt ${attempt}/${maxRetries})`,
        );
        const publishOutput = execSync(`npm ${publishArgs.join(" ")}`, {
          encoding: "utf8",
          stdio: "pipe",
          cwd: packageConfig.path,
        });

        // Verify publication
        const verification = await this.verifyPackagePublication(packageConfig);

        this.logger.log(
          `✅ Successfully published ${packageConfig.name} (attempt ${attempt})`,
        );

        return {
          success: true,
          packageName: packageConfig.name,
          version: this.config.version,
          registry:
            packageConfig.publishConfig.registry || this.npmRegistry.url,
          duration: Date.now() - startTime,
          publishOutput,
          verification,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(errorMessage);

        if (attempt === maxRetries || !isRetryable) {
          this.logger.error(
            `❌ Failed to publish ${packageConfig.name} after ${attempt} attempts: ${error}`,
          );

          return {
            success: false,
            packageName: packageConfig.name,
            version: this.config.version,
            registry:
              packageConfig.publishConfig.registry || this.npmRegistry.url,
            duration: Date.now() - startTime,
            error: `NPM publish failed after ${attempt} attempts: ${errorMessage}`,
          };
        }

        // Calculate exponential backoff delay
        const delay =
          baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000; // Add jitter

        this.logger.warn(
          `⚠️ NPM publish attempt ${attempt} failed for ${packageConfig.name}: ${error}`,
        );
        this.logger.log(`⏳ Retrying in ${Math.round(delay)}ms...`);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    return {
      success: false,
      packageName: packageConfig.name,
      version: this.config.version,
      registry: packageConfig.publishConfig.registry || this.npmRegistry.url,
      duration: Date.now() - startTime,
      error: "Unexpected error in retry logic",
    };
  }

  /**
   * Configure NPM authentication
   */
  private async configureNPMAuth(): Promise<void> {
    if (this.npmRegistry.token) {
      // Set authentication token
      const registry = this.npmRegistry.url.replace(/^https?:/, "");
      execSync(
        `npm config set ${registry}:_authToken ${this.npmRegistry.token}`,
      );
    }

    if (this.npmRegistry.scope) {
      // Set scope registry
      execSync(
        `npm config set @${this.npmRegistry.scope}:registry ${this.npmRegistry.url}`,
      );
    }
  }

  /**
   * Verify package publication
   */
  private async verifyPackagePublication(
    packageConfig: PackageConfig,
  ): Promise<PublicationVerification> {
    this.logger.log(`Verifying publication of ${packageConfig.name}...`);

    try {
      // Wait for registry propagation
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Check if package exists in registry
      const verification = await this.verifyPackageInRegistry(
        packageConfig.name,
        this.config.version,
      );

      return verification;
    } catch (error) {
      return {
        packageExists: false,
        versionExists: false,
        metadataCorrect: false,
        installationWorks: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Verify package exists in NPM registry
   */
  private async verifyPackageInRegistry(
    packageName: string,
    version: string,
  ): Promise<PublicationVerification> {
    try {
      // Use npm view to get package information
      const packageInfo = execSync(`npm view ${packageName} --json`, {
        encoding: "utf8",
        stdio: "pipe",
      });

      const packageData = JSON.parse(packageInfo);

      const packageExists = !!packageData.name;
      const versionExists =
        packageData.versions && packageData.versions.includes(version);
      const metadataCorrect = packageData.name === packageName;

      // Test installation
      const installationWorks = await this.verifyPackageInstallation(
        packageName,
        version,
      );

      return {
        packageExists,
        versionExists,
        metadataCorrect,
        installationWorks,
        downloadUrl: packageData.dist?.tarball,
        publishTime: packageData.time?.[version]
          ? new Date(packageData.time[version])
          : undefined,
      };
    } catch (error) {
      this.logger.warn(`Could not verify ${packageName} in registry:`, error);
      return {
        packageExists: false,
        versionExists: false,
        metadataCorrect: false,
        installationWorks: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Test package installation
   */
  private async verifyPackageInstallation(
    packageName: string,
    version: string,
  ): Promise<boolean> {
    try {
      // Create temporary directory for testing installation
      const tempDir = path.join("/tmp", `npm-verify-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Initialize empty package.json
        await fs.writeFile(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "test", version: "1.0.0" }, null, 2),
        );

        // Try to install the package
        execSync(`npm install ${packageName}@${version}`, {
          stdio: "ignore",
          cwd: tempDir,
        });

        return true;
      } finally {
        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      this.logger.warn(
        `Installation test failed for ${packageName}@${version}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Send notification about publish results
   */
  private async sendPublishNotification(
    result: NPMPublishResult,
  ): Promise<void> {
    // For now, just log the notification
    // In a real implementation, this could send emails, Slack messages, etc.

    this.logger.log("📧 Publishing notification:");
    this.logger.log(`  Registry: ${result.registry}`);
    this.logger.log(`  Version: ${result.version}`);
    this.logger.log(
      `  Packages: ${result.packages.map((p) => p.packageName).join(", ")}`,
    );
    this.logger.log(`  Duration: ${result.duration}ms`);
    this.logger.log(`  Success: ${result.success ? "✅" : "❌"}`);
  }

  /**
   * Determines if an error is retryable based on error message patterns
   */
  private isRetryableError(errorMessage: string): boolean {
    const retryablePatterns = [
      /network error/i,
      /timeout/i,
      /connection refused/i,
      /connection reset/i,
      /temporary failure/i,
      /service unavailable/i,
      /internal server error/i,
      /502 bad gateway/i,
      /503 service unavailable/i,
      /504 gateway timeout/i,
      /rate limit/i,
      /throttled/i,
      /temporary/i,
      /try again/i,
      /econnreset/i,
      /enotfound/i,
      /registry error/i,
    ];

    return retryablePatterns.some((pattern) => pattern.test(errorMessage));
  }
}
