import { readFile, writeFile, stat, mkdir, rename } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";
import { createHash } from "crypto";
import type {
  DistributionConfig,
  ValidationResult,
  ValidationMessage,
  VerificationResult,
  VerificationCheck,
  AutoUpdateConfig,
  UpdateServerConfig,
  UpdateClientConfig,
  UpdateCheckResult,
  UpdateInfo,
  UpdateDownloadResult,
  UpdateInstallResult,
  RollbackConfig,
} from "./types.js";

export interface Publisher {
  initialize(config: DistributionConfig): Promise<void>;
  validate(): Promise<ValidationResult>;
  publish(): Promise<UpdateCheckResult>;
  verify(result: UpdateCheckResult): Promise<VerificationResult>;
  cleanup(): Promise<void>;
}

/**
 * Auto-update manager for handling application updates
 */
export class AutoUpdateManager implements Publisher {
  private config!: DistributionConfig;
  private updateConfig!: AutoUpdateConfig;
  private updateDir!: string;
  private currentVersion!: string;
  private updateServer!: UpdateServerConfig;
  private clientConfig!: UpdateClientConfig;
  private rollbackConfig!: RollbackConfig;

  async initialize(config: DistributionConfig): Promise<void> {
    this.config = config;
    this.updateConfig = this.getUpdateConfig();
    this.currentVersion = this.config.version;
    this.updateServer = this.updateConfig.server;
    this.clientConfig = this.updateConfig.client;
    this.rollbackConfig = this.updateConfig.rollback;
    this.updateDir = "./updates";

    console.log("Initializing Auto-Update Manager...");
    console.log(`Current version: ${this.currentVersion}`);
    console.log(`Update server: ${this.updateServer.url}`);
    console.log(`Auto-updates enabled: ${this.updateConfig.enabled}`);

    // Ensure update directory exists
    await this.ensureDirectory(this.updateDir);
  }

  async validate(): Promise<ValidationResult> {
    console.log("Validating auto-update configuration...");

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

    // Validate update server configuration
    if (this.updateConfig.enabled) {
      if (!this.updateServer.url) {
        errors.push({
          code: "UPDATE_SERVER_URL_MISSING",
          message:
            "Update server URL is required when auto-updates are enabled",
          field: "autoUpdate.server.url",
          severity: "error",
        });
      }

      if (this.updateServer.url && !this.isValidUrl(this.updateServer.url)) {
        errors.push({
          code: "UPDATE_SERVER_URL_INVALID",
          message: "Update server URL is not valid",
          field: "autoUpdate.server.url",
          severity: "error",
        });
      }

      // Validate client configuration
      if (
        !this.clientConfig.updateInterval ||
        this.clientConfig.updateInterval < 1
      ) {
        errors.push({
          code: "UPDATE_INTERVAL_INVALID",
          message: "Update check interval must be at least 1 hour",
          field: "autoUpdate.client.updateInterval",
          severity: "error",
        });
      }
    }

    // Validate rollback configuration
    if (this.rollbackConfig.enabled && !this.rollbackConfig.maxVersionsToKeep) {
      errors.push({
        code: "ROLLBACK_VERSIONS_MISSING",
        message:
          "Maximum rollback versions must be specified when rollback is enabled",
        field: "autoUpdate.rollback.maxVersionsToKeep",
        severity: "error",
      });
    }

    // Test server connectivity if enabled
    if (this.updateConfig.enabled && this.updateServer.url) {
      const connectivityCheck = await this.testServerConnectivity();
      if (!connectivityCheck.success) {
        errors.push({
          code: "UPDATE_SERVER_UNREACHABLE",
          message: `Cannot reach update server: ${connectivityCheck.error}`,
          field: "autoUpdate.server.url",
          severity: "warning",
        });
      }
    }

    const success = errors.filter((e) => e.severity === "error").length === 0;
    const message = success
      ? "Auto-update validation passed"
      : `Validation failed: ${errors.filter((e) => e.severity === "error").length} errors`;

    console.log(message);
    if (!success) {
      errors.forEach((error) =>
        console.error(`  - ${error.field}: ${error.message}`),
      );
    }

    return {
      success,
      warnings: errors.filter((e) => e.severity === "warning"),
      errors: errors.filter((e) => e.severity === "error"),
    };
  }

  async publish(): Promise<UpdateCheckResult> {
    console.log("Checking for updates...");
    const startTime = Date.now();

    try {
      // Validate before checking updates
      const validation = await this.validate();
      if (!validation.success) {
        const error = `Validation failed: ${validation.errors.map((e) => e.message).join(", ")}`;
        return {
          success: false,
          error,
          updateAvailable: false,
          currentVersion: this.currentVersion,
          duration: Date.now() - startTime,
        };
      }

      if (!this.updateConfig.enabled) {
        return {
          success: true,
          updateAvailable: false,
          currentVersion: this.currentVersion,
          latestVersion: this.currentVersion,
          duration: Date.now() - startTime,
        };
      }

      // Check for updates
      const updateInfo = await this.checkForUpdates();

      if (!updateInfo.updateAvailable) {
        return {
          success: true,
          updateAvailable: false,
          currentVersion: this.currentVersion,
          latestVersion: updateInfo.latestVersion || this.currentVersion,
          duration: Date.now() - startTime,
        };
      }

      const duration = Date.now() - startTime;

      console.log(`Update check completed in ${duration}ms`);
      console.log(
        `Current version: ${this.currentVersion}, Latest: ${updateInfo.latestVersion}`,
      );

      return {
        success: true,
        updateAvailable: true,
        currentVersion: this.currentVersion,
        latestVersion: updateInfo.latestVersion!,
        updateInfo,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error("Update check failed:", error);

      return {
        success: false,
        error: error.message,
        updateAvailable: false,
        currentVersion: this.currentVersion,
        duration,
      };
    }
  }

  async verify(result: UpdateCheckResult): Promise<VerificationResult> {
    console.log("Verifying update check results...");
    const startTime = Date.now();

    const checks: VerificationCheck[] = [];

    try {
      // Verify update check was successful
      if (!result.success) {
        checks.push({
          name: "update-check-success",
          success: false,
          message: `Update check failed: ${result.error || "Unknown error"}`,
        });
      } else {
        checks.push({
          name: "update-check-success",
          success: true,
          message: "Update check completed successfully",
        });
      }

      // Verify version consistency
      if (result.currentVersion !== this.currentVersion) {
        checks.push({
          name: "version-consistency",
          success: false,
          message: `Version mismatch: expected ${this.currentVersion}, got ${result.currentVersion}`,
        });
      } else {
        checks.push({
          name: "version-consistency",
          success: true,
          message: "Version consistency verified",
        });
      }

      // Verify update information if available
      if (result.updateAvailable && result.updateInfo) {
        const updateInfoCheck = await this.verifyUpdateInfo(result.updateInfo);
        checks.push(updateInfoCheck);
      }

      // Verify server connectivity if enabled
      if (this.updateConfig.enabled) {
        const serverCheck = await this.verifyServerConnectivity();
        checks.push(serverCheck);
      }
    } catch (error: any) {
      console.error("Update verification failed:", error);
      checks.push({
        name: "verification-error",
        success: false,
        message: `Verification failed: ${error.message}`,
      });
    }

    const allChecksSucceeded = checks.every((c) => c.success);
    const duration = Date.now() - startTime;

    console.log(
      allChecksSucceeded
        ? `Update verification passed (${checks.length} checks)`
        : `Update verification failed (${checks.filter((c) => !c.success).length}/${checks.length} checks failed)`,
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
    console.log("Cleaning up auto-update system...");

    // Clean up temporary update files
    await this.cleanupTempFiles();

    // Clean up old rollback versions
    if (this.rollbackConfig.enabled) {
      await this.cleanupOldVersions();
    }

    console.log("Auto-update system cleanup completed");
  }

  /**
   * Download and install an available update
   */
  async downloadAndInstallUpdate(
    updateInfo: UpdateInfo,
  ): Promise<UpdateInstallResult> {
    console.log(`Downloading update ${updateInfo.version}...`);
    const startTime = Date.now();

    try {
      // Download update
      const downloadResult = await this.downloadUpdate(updateInfo);
      if (!downloadResult.success) {
        return {
          success: false,
          error: `Download failed: ${downloadResult.error}`,
          duration: Date.now() - startTime,
        };
      }

      // Verify download integrity
      const integrityCheck = await this.verifyDownloadIntegrity(downloadResult);
      if (!integrityCheck) {
        return {
          success: false,
          error: "Download integrity check failed",
          duration: Date.now() - startTime,
        };
      }

      // Create backup of current version for rollback
      if (this.rollbackConfig.enabled) {
        await this.createVersionBackup();
      }

      // Install update
      const installResult = await this.installUpdate(downloadResult);
      if (!installResult.success) {
        // Attempt rollback if installation failed
        if (this.rollbackConfig.enabled && this.rollbackConfig.autoRollback) {
          console.log("Installation failed, attempting automatic rollback...");
          await this.rollbackToPreviousVersion();
        }

        return {
          success: false,
          error: `Installation failed: ${installResult.error}`,
          duration: Date.now() - startTime,
        };
      }

      const duration = Date.now() - startTime;
      console.log(`Update installed successfully in ${duration}ms`);

      return {
        success: true,
        version: updateInfo.version,
        previousVersion: this.currentVersion,
        backupPath: installResult.backupPath,
        duration,
      };
    } catch (error: any) {
      console.error("Update installation failed:", error);

      // Attempt rollback on error if enabled
      if (this.rollbackConfig.enabled && this.rollbackConfig.autoRollback) {
        console.log("Error occurred, attempting automatic rollback...");
        try {
          await this.rollbackToPreviousVersion();
        } catch (rollbackError) {
          console.error("Rollback failed:", rollbackError);
        }
      }

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToPreviousVersion(): Promise<UpdateInstallResult> {
    console.log("Rolling back to previous version...");
    const startTime = Date.now();

    try {
      if (!this.rollbackConfig.enabled) {
        throw new Error("Rollback is not enabled");
      }

      // Find available backup versions
      const availableVersions = await this.getAvailableBackupVersions();
      if (availableVersions.length === 0) {
        throw new Error("No backup versions available for rollback");
      }

      // Get the most recent backup version
      const rollbackVersion = availableVersions[0];
      if (!rollbackVersion) {
        throw new Error("No valid rollback version found");
      }

      console.log(
        `Rolling back from ${this.currentVersion} to ${rollbackVersion.version}`,
      );

      // Perform rollback
      await this.restoreFromBackup(rollbackVersion);

      // Verify rollback
      const verificationResult = await this.verifyRollback(rollbackVersion);
      if (!verificationResult) {
        throw new Error("Rollback verification failed");
      }

      const duration = Date.now() - startTime;
      console.log(`Rollback completed successfully in ${duration}ms`);

      return {
        success: true,
        version: rollbackVersion.version,
        previousVersion: this.currentVersion,
        rollback: true,
        duration,
      };
    } catch (error: any) {
      console.error("Rollback failed:", error);

      return {
        success: false,
        error: error.message,
        rollback: true,
        duration: Date.now() - startTime,
      };
    }
  }

  private async checkForUpdates(): Promise<UpdateInfo> {
    const updateEndpoint = `${this.updateServer.url}/check-update`;
    const requestBody = {
      currentVersion: this.currentVersion,
      platform: process.platform,
      architecture: process.arch,
      channel: this.clientConfig.channel || "stable",
    };

    console.log(`Checking updates from: ${updateEndpoint}`);

    try {
      const response = await this.makeHttpRequest(
        "POST",
        updateEndpoint,
        requestBody,
      );

      if (!response.updateAvailable) {
        return {
          updateAvailable: false,
          latestVersion: response.latestVersion || this.currentVersion,
        };
      }

      return {
        updateAvailable: true,
        version: response.version,
        latestVersion: response.version,
        downloadUrl: response.downloadUrl,
        checksum: response.checksum,
        size: response.size,
        releaseNotes: response.releaseNotes,
        critical: response.critical || false,
        publishedAt: response.publishedAt,
        signature: response.signature,
      };
    } catch (error: any) {
      console.error("Failed to check for updates:", error);
      throw new Error(`Update check failed: ${error.message}`);
    }
  }

  private async downloadUpdate(
    updateInfo: UpdateInfo,
  ): Promise<UpdateDownloadResult> {
    const downloadPath = join(
      this.updateDir,
      `update-${updateInfo.version}.tar.gz`,
    );

    console.log(`Downloading update from: ${updateInfo.downloadUrl}`);
    console.log(`Download path: ${downloadPath}`);

    try {
      // Download file using curl (in production, would use proper HTTP client)
      const curlCommand = `curl -L -o "${downloadPath}" "${updateInfo.downloadUrl}"`;
      execSync(curlCommand, { stdio: "inherit" });

      // Verify file was downloaded
      const stats = await stat(downloadPath);

      return {
        success: true,
        downloadPath,
        size: stats.size,
        checksum: await this.calculateChecksum(downloadPath),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async verifyDownloadIntegrity(
    downloadResult: UpdateDownloadResult,
  ): Promise<boolean> {
    if (!downloadResult.success || !downloadResult.downloadPath) {
      return false;
    }

    try {
      // Verify checksum if provided
      if (downloadResult.checksum) {
        const actualChecksum = await this.calculateChecksum(
          downloadResult.downloadPath,
        );
        if (actualChecksum !== downloadResult.checksum) {
          console.error(
            `Checksum mismatch: expected ${downloadResult.checksum}, got ${actualChecksum}`,
          );
          return false;
        }
      }

      // Verify file size if available
      if (downloadResult.size) {
        const stats = await stat(downloadResult.downloadPath);
        if (stats.size !== downloadResult.size) {
          console.error(
            `Size mismatch: expected ${downloadResult.size}, got ${stats.size}`,
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Integrity verification failed:", error);
      return false;
    }
  }

  private async installUpdate(
    downloadResult: UpdateDownloadResult,
  ): Promise<{ success: boolean; error?: string; backupPath?: string }> {
    if (!downloadResult.success || !downloadResult.downloadPath) {
      return {
        success: false,
        error: "Invalid download result",
      };
    }

    try {
      const extractPath = join(this.updateDir, "extracted");
      await this.ensureDirectory(extractPath);

      // Extract update package
      const extractCommand = `tar -xzf "${downloadResult.downloadPath}" -C "${extractPath}"`;
      execSync(extractCommand);

      // Find application files to update
      const applicationPath = process.cwd();
      const backupPath = join(this.updateDir, `backup-${Date.now()}`);

      // Create backup
      await this.ensureDirectory(backupPath);
      const backupCommand = `cp -r "${applicationPath}" "${backupPath}/"`;
      execSync(backupCommand);

      // Install update
      const installCommand = `cp -r "${extractPath}"/* "${applicationPath}/"`;
      execSync(installCommand);

      // Update version file
      await this.updateVersionFile();

      // Cleanup extraction directory
      execSync(`rm -rf "${extractPath}"`);

      return {
        success: true,
        backupPath,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async createVersionBackup(): Promise<void> {
    const backupDir = join(this.updateDir, "backups");
    await this.ensureDirectory(backupDir);

    const backupPath = join(
      backupDir,
      `backup-${this.currentVersion}-${Date.now()}`,
    );
    const applicationPath = process.cwd();

    console.log(`Creating backup at: ${backupPath}`);

    const backupCommand = `cp -r "${applicationPath}" "${backupPath}/"`;
    execSync(backupCommand);

    // Store backup metadata
    const metadata = {
      version: this.currentVersion,
      timestamp: new Date().toISOString(),
      path: backupPath,
    };

    await writeFile(
      join(backupPath, "backup-metadata.json"),
      JSON.stringify(metadata, null, 2),
    );
  }

  private async getAvailableBackupVersions(): Promise<
    Array<{ version: string; path: string; timestamp: string }>
  > {
    const backupDir = join(this.updateDir, "backups");
    const versions: Array<{
      version: string;
      path: string;
      timestamp: string;
    }> = [];

    try {
      const backupDirs = execSync(`ls -1 "${backupDir}"`, { encoding: "utf-8" })
        .split("\n")
        .filter((dir) => dir.trim().startsWith("backup-"));

      for (const dir of backupDirs) {
        const metadataPath = join(backupDir, dir, "backup-metadata.json");
        try {
          const metadata = JSON.parse(await readFile(metadataPath, "utf-8"));
          versions.push({
            version: metadata.version,
            path: join(backupDir, dir),
            timestamp: metadata.timestamp,
          });
        } catch {
          // Skip directories without valid metadata
        }
      }

      // Sort by timestamp (newest first)
      versions.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return versions;
    } catch (error) {
      console.error("Failed to get backup versions:", error);
      return [];
    }
  }

  private async restoreFromBackup(backupVersion: {
    version: string;
    path: string;
    timestamp: string;
  }): Promise<void> {
    const applicationPath = process.cwd();

    console.log(`Restoring from backup: ${backupVersion.path}`);

    // Remove current version
    const tempPath = join(this.updateDir, `temp-current-${Date.now()}`);
    await rename(applicationPath, tempPath);

    try {
      // Restore from backup
      const restoreCommand = `cp -r "${backupVersion.path}" "${applicationPath}/"`;
      execSync(restoreCommand);

      // Update current version
      this.currentVersion = backupVersion.version;
    } catch (error) {
      // If restore fails, try to restore original
      try {
        await rename(tempPath, applicationPath);
      } catch {
        console.error(
          "Critical error: Failed to restore backup and cannot recover original",
        );
      }
      throw error;
    }

    // Cleanup temporary directory
    try {
      execSync(`rm -rf "${tempPath}"`);
    } catch {
      // Ignore cleanup errors
    }
  }

  private async verifyRollback(rolledBackVersion: {
    version: string;
    path: string;
    timestamp: string;
  }): Promise<boolean> {
    try {
      // Verify application is running the rolled-back version
      // This would typically check a version file or application metadata
      const versionFile = join(process.cwd(), "version.json");
      const versionData = JSON.parse(await readFile(versionFile, "utf-8"));

      return versionData.version === rolledBackVersion.version;
    } catch (error) {
      console.error("Rollback verification failed:", error);
      return false;
    }
  }

  private async updateVersionFile(): Promise<void> {
    const versionFile = join(process.cwd(), "version.json");
    const versionData = {
      version: this.currentVersion,
      updatedAt: new Date().toISOString(),
    };

    await writeFile(versionFile, JSON.stringify(versionData, null, 2));
  }

  private async cleanupTempFiles(): Promise<void> {
    try {
      const tempPattern = join(this.updateDir, "temp-*");
      execSync(`rm -rf ${tempPattern}`, { stdio: "ignore" });

      const downloadPattern = join(this.updateDir, "update-*.tar.gz");
      execSync(`rm -f ${downloadPattern}`, { stdio: "ignore" });
    } catch {
      // Ignore cleanup errors
    }
  }

  private async cleanupOldVersions(): Promise<void> {
    if (!this.rollbackConfig.maxVersionsToKeep) {
      return;
    }

    try {
      const availableVersions = await this.getAvailableBackupVersions();
      const versionsToRemove = availableVersions.slice(
        this.rollbackConfig.maxVersionsToKeep,
      );

      for (const version of versionsToRemove) {
        console.log(`Removing old backup version: ${version.version}`);
        execSync(`rm -rf "${version.path}"`);
      }
    } catch (error) {
      console.error("Failed to cleanup old versions:", error);
    }
  }

  private async testServerConnectivity(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const testEndpoint = `${this.updateServer.url}/ping`;
      await this.makeHttpRequest("GET", testEndpoint);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async verifyUpdateInfo(
    updateInfo: UpdateInfo,
  ): Promise<VerificationCheck> {
    try {
      // Verify required fields
      if (!updateInfo.version) {
        throw new Error("Update version is missing");
      }

      if (!updateInfo.downloadUrl) {
        throw new Error("Download URL is missing");
      }

      // Verify version format
      if (!this.isValidSemVer(updateInfo.version)) {
        throw new Error("Update version is not a valid semantic version");
      }

      // Verify download URL is accessible
      const response = await this.makeHttpRequest(
        "HEAD",
        updateInfo.downloadUrl,
      );
      if (!response) {
        throw new Error("Download URL is not accessible");
      }

      return {
        name: "update-info-valid",
        success: true,
        message: `Update information verified for version ${updateInfo.version}`,
      };
    } catch (error: any) {
      return {
        name: "update-info-valid",
        success: false,
        message: `Update information validation failed: ${error.message}`,
      };
    }
  }

  private async verifyServerConnectivity(): Promise<VerificationCheck> {
    try {
      const connectivityTest = await this.testServerConnectivity();

      if (!connectivityTest.success) {
        throw new Error(connectivityTest.error);
      }

      return {
        name: "server-connectivity",
        success: true,
        message: "Update server is accessible",
      };
    } catch (error: any) {
      return {
        name: "server-connectivity",
        success: false,
        message: `Server connectivity failed: ${error.message}`,
      };
    }
  }

  private async makeHttpRequest(
    method: string,
    url: string,
    body?: any,
  ): Promise<any> {
    // In a real implementation, this would use a proper HTTP client
    // For now, we'll simulate with curl commands

    try {
      let curlCommand = `curl -s -X ${method}`;

      if (this.updateServer.auth) {
        curlCommand += ` -H "Authorization: Bearer ${this.updateServer.auth.key}"`;
      }

      if (body) {
        curlCommand += ` -H "Content-Type: application/json" -d '${JSON.stringify(body)}'`;
      }

      curlCommand += ` "${url}"`;

      const result = execSync(curlCommand, { encoding: "utf-8" });

      if (method === "HEAD") {
        return true; // HEAD request succeeded
      }

      return JSON.parse(result);
    } catch (error: any) {
      throw new Error(`HTTP request failed: ${error.message}`);
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const content = await readFile(filePath);
    return createHash("sha256").update(content).digest("hex");
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await stat(dirPath);
    } catch {
      await mkdir(dirPath, { recursive: true });
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidSemVer(version: string): boolean {
    const semverRegex =
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*|[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*|[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    return semverRegex.test(version);
  }

  private getUpdateConfig(): AutoUpdateConfig {
    return (
      this.config?.autoUpdate || {
        enabled: false,
        server: {
          url: "",
          channels: ["stable"],
        },
        client: {
          updateInterval: 24,
          channel: "stable",
          autoDownload: false,
          autoInstall: false,
          notifyUser: true,
        },
        rollback: {
          enabled: true,
          autoRollback: false,
          maxVersionsToKeep: 3,
        },
      }
    );
  }
}
