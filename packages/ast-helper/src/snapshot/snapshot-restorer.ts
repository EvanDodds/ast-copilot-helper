/**
 * Snapshot Restorer
 * Part of Issue #161 - Repository Snapshot Distribution System
 *
 * Handles restoration of snapshot files to .astdb directories.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createReadStream, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createLogger } from "../logging/index.js";
import type {
  SnapshotRestoreOptions,
  SnapshotRestoreResult,
  SnapshotMetadata,
  SnapshotProgress,
} from "./types.js";
import { SnapshotPhase } from "./types.js";

const logger = createLogger({ operation: "snapshot-restorer" });

/**
 * Restores compressed snapshots to .astdb directories
 *
 * @remarks
 * The SnapshotRestorer handles decompression and restoration of snapshot files
 * to target .astdb directories. It includes checksum validation, backup creation,
 * and progress reporting for safe and transparent restoration.
 *
 * @example
 * ```typescript
 * const restorer = new SnapshotRestorer();
 *
 * const result = await restorer.restore({
 *   snapshotPath: './snapshot-1.0.0.tar.gz',
 *   targetPath: './.astdb',
 *   createBackup: true,
 *   validateChecksum: true,
 *   onProgress: (progress) => {
 *     console.log(`${progress.phase}: ${progress.percentage}%`);
 *   }
 * });
 *
 * if (result.success) {
 *   console.log(`Restored to: ${result.targetPath}`);
 *   console.log(`Files restored: ${result.filesRestored}`);
 *   if (result.backupPath) {
 *     console.log(`Backup created: ${result.backupPath}`);
 *   }
 * }
 * ```
 */
export class SnapshotRestorer {
  /**
   * Restore a snapshot to an .astdb directory
   *
   * @param options - Snapshot restoration configuration
   * @returns Promise resolving to restoration result with metadata and status
   *
   * @remarks
   * This method:
   * - Validates snapshot file exists and is readable
   * - Optionally creates backup of existing target directory
   * - Validates checksum if requested (recommended)
   * - Extracts compressed archive to target location
   * - Reports progress through optional callback
   * - Provides detailed restoration statistics
   *
   * Like SnapshotCreator, this method returns a result object with `success: false`
   * and detailed error information on failure rather than throwing exceptions.
   *
   * @example
   * ```typescript
   * // Minimal required options
   * const result = await restorer.restore({
   *   snapshotPath: './snapshot.tar.gz',
   *   targetPath: './.astdb'
   * });
   *
   * // Recommended: with backup and validation
   * const result = await restorer.restore({
   *   snapshotPath: './snapshot-1.0.0.tar.gz',
   *   targetPath: './.astdb',
   *   createBackup: true,           // Backup existing directory
   *   validateChecksum: true,        // Verify snapshot integrity
   *   overwrite: true,               // Overwrite existing files
   *   onProgress: (progress) => {
   *     console.log(`[${progress.phase}] ${progress.step}`);
   *     console.log(`${progress.percentage}% complete`);
   *   },
   *   onFileRestored: (filePath) => {
   *     console.log(`Restored: ${filePath}`);
   *   }
   * });
   *
   * // Check result and handle errors
   * if (result.success) {
   *   console.log(`✅ Snapshot restored successfully`);
   *   console.log(`Target: ${result.targetPath}`);
   *   console.log(`Files restored: ${result.filesRestored}`);
   *   console.log(`Duration: ${result.durationMs}ms`);
   *
   *   if (result.backupPath) {
   *     console.log(`Backup: ${result.backupPath}`);
   *     // Optional: cleanup backup after verification
   *     // await fs.rm(result.backupPath, { recursive: true });
   *   }
   *
   *   console.log(`Metadata:`, result.metadata);
   * } else {
   *   console.error(`❌ Restoration failed: ${result.error}`);
   *
   *   // Backup is preserved on failure for recovery
   *   if (result.backupPath) {
   *     console.log(`Original files preserved at: ${result.backupPath}`);
   *   }
   * }
   * ```
   */
  async restore(
    options: SnapshotRestoreOptions,
  ): Promise<SnapshotRestoreResult> {
    const startTime = Date.now();
    let backupPath: string | undefined;

    try {
      // Validate inputs
      await this.validateOptions(options);

      // Initialize progress
      this.reportProgress(options, {
        phase: SnapshotPhase.INITIALIZING,
        step: "Initializing snapshot restoration",
        percentage: 0,
        filesProcessed: 0,
        totalFiles: 0,
        bytesProcessed: 0,
        totalBytes: 0,
      });

      // Load and validate metadata
      this.reportProgress(options, {
        phase: SnapshotPhase.VALIDATING,
        step: "Loading snapshot metadata",
        percentage: 10,
        filesProcessed: 0,
        totalFiles: 0,
        bytesProcessed: 0,
        totalBytes: 0,
      });

      const metadata = await this.loadMetadata(options.snapshotPath);

      // Validate checksum if requested
      if (options.validateChecksum !== false) {
        await this.validateChecksum(options.snapshotPath, metadata);
      }

      // Create backup if requested
      if (options.createBackup !== false && existsSync(options.targetPath)) {
        this.reportProgress(options, {
          phase: SnapshotPhase.INITIALIZING,
          step: "Creating backup of existing .astdb",
          percentage: 20,
          filesProcessed: 0,
          totalFiles: 0,
          bytesProcessed: 0,
          totalBytes: 0,
        });

        backupPath = await this.createBackup(options);
        logger.info(`Backup created: ${backupPath}`);
      }

      // Extract snapshot
      this.reportProgress(options, {
        phase: SnapshotPhase.EXTRACTING,
        step: "Extracting snapshot files",
        percentage: 30,
        filesProcessed: 0,
        totalFiles: metadata.repository.fileCount,
        bytesProcessed: 0,
        totalBytes: metadata.size.uncompressed,
      });

      const filesRestored = await this.extractSnapshot(options, metadata);

      // Validate restored directory
      this.reportProgress(options, {
        phase: SnapshotPhase.VALIDATING,
        step: "Validating restored .astdb",
        percentage: 90,
        filesProcessed: filesRestored,
        totalFiles: filesRestored,
        bytesProcessed: metadata.size.uncompressed,
        totalBytes: metadata.size.uncompressed,
      });

      await this.validateRestoredDirectory(options.targetPath);

      // Complete
      const durationMs = Date.now() - startTime;
      this.reportProgress(options, {
        phase: SnapshotPhase.COMPLETE,
        step: "Snapshot restoration complete",
        percentage: 100,
        filesProcessed: filesRestored,
        totalFiles: filesRestored,
        bytesProcessed: metadata.size.uncompressed,
        totalBytes: metadata.size.uncompressed,
      });

      logger.info(
        `Snapshot restored successfully in ${durationMs}ms: ${options.targetPath}`,
      );

      return {
        success: true,
        targetPath: options.targetPath,
        backupPath,
        metadata,
        durationMs,
        filesRestored,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Snapshot restoration failed: ${errorMessage}`);

      // Attempt rollback if backup exists
      if (backupPath && existsSync(backupPath)) {
        try {
          logger.info("Attempting to restore from backup...");
          await this.rollback(options.targetPath, backupPath);
          logger.info("Rollback successful");
        } catch (rollbackError) {
          logger.error(
            `Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
          );
        }
      }

      return {
        success: false,
        targetPath: options.targetPath,
        backupPath,
        metadata: {} as SnapshotMetadata,
        durationMs,
        filesRestored: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate restoration options
   */
  private async validateOptions(
    options: SnapshotRestoreOptions,
  ): Promise<void> {
    // Check snapshot file exists
    if (!existsSync(options.snapshotPath)) {
      throw new Error(`Snapshot file does not exist: ${options.snapshotPath}`);
    }

    // Check snapshot file is not empty
    const stats = await fs.stat(options.snapshotPath);
    if (stats.size === 0) {
      throw new Error("Snapshot file is empty");
    }

    // Check metadata file exists
    const metadataPath = options.snapshotPath.replace(
      /\.(tar\.gz|tgz)$/,
      ".metadata.json",
    );
    if (!existsSync(metadataPath)) {
      throw new Error(`Snapshot metadata file not found: ${metadataPath}`);
    }

    // Check if target exists and overwrite is allowed
    if (existsSync(options.targetPath) && options.overwrite === false) {
      throw new Error(
        `Target directory already exists and overwrite is disabled: ${options.targetPath}`,
      );
    }

    // Ensure target parent directory exists
    const targetParent = path.dirname(options.targetPath);
    if (!existsSync(targetParent)) {
      await fs.mkdir(targetParent, { recursive: true });
    }
  }

  /**
   * Load snapshot metadata
   */
  private async loadMetadata(snapshotPath: string): Promise<SnapshotMetadata> {
    const metadataPath = snapshotPath.replace(
      /\.(tar\.gz|tgz)$/,
      ".metadata.json",
    );

    try {
      const metadataContent = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(metadataContent) as SnapshotMetadata;

      // Validate metadata structure
      if (!metadata.id || !metadata.version || !metadata.checksum) {
        throw new Error("Invalid metadata structure");
      }

      return metadata;
    } catch (error) {
      throw new Error(
        `Failed to load metadata: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate snapshot checksum
   */
  private async validateChecksum(
    snapshotPath: string,
    metadata: SnapshotMetadata,
  ): Promise<void> {
    logger.info("Validating snapshot checksum...");

    const actualChecksum = await this.calculateChecksum(snapshotPath);

    if (actualChecksum !== metadata.checksum) {
      throw new Error(
        `Snapshot checksum mismatch. Expected: ${metadata.checksum}, Actual: ${actualChecksum}. The snapshot may be corrupted.`,
      );
    }

    logger.info("Checksum validation passed");
  }

  /**
   * Calculate SHA256 checksum of file
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(filePath);

      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }

  /**
   * Create backup of existing .astdb directory
   */
  private async createBackup(options: SnapshotRestoreOptions): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath =
      options.backupPath || `${options.targetPath}.backup.${timestamp}`;

    logger.info(`Creating backup: ${backupPath}`);

    // Copy entire directory
    await this.copyDirectory(options.targetPath, backupPath);

    return backupPath;
  }

  /**
   * Extract snapshot to target directory
   */
  private async extractSnapshot(
    options: SnapshotRestoreOptions,
    metadata: SnapshotMetadata,
  ): Promise<number> {
    const { snapshotPath, targetPath, skipModels = false } = options;

    // Remove target directory if it exists
    if (existsSync(targetPath)) {
      await fs.rm(targetPath, { recursive: true, force: true });
    }

    // Create target directory
    await fs.mkdir(targetPath, { recursive: true });

    // Extract using tar
    const { execSync } = await import("node:child_process");

    try {
      // Extract to target directory
      execSync(`tar -xzf "${snapshotPath}" -C "${targetPath}"`, {
        stdio: "pipe",
      });

      // Remove models if requested
      if (skipModels) {
        const modelsPath = path.join(targetPath, "models");
        if (existsSync(modelsPath)) {
          await fs.rm(modelsPath, { recursive: true, force: true });
          logger.info("Skipped model files as requested");
        }
      }

      return metadata.repository.fileCount;
    } catch (error) {
      throw new Error(
        `Failed to extract snapshot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate restored directory
   */
  private async validateRestoredDirectory(targetPath: string): Promise<void> {
    // Check version.json exists
    const versionFile = path.join(targetPath, "version.json");
    if (!existsSync(versionFile)) {
      throw new Error("Restored directory is invalid (missing version.json)");
    }

    // Check at least one database file exists
    const indexDb = path.join(targetPath, "index.db");
    if (!existsSync(indexDb)) {
      throw new Error("Restored directory is invalid (missing index.db)");
    }

    logger.info("Restored directory validation passed");
  }

  /**
   * Rollback restoration by restoring from backup
   */
  private async rollback(
    targetPath: string,
    backupPath: string,
  ): Promise<void> {
    // Remove failed restoration
    if (existsSync(targetPath)) {
      await fs.rm(targetPath, { recursive: true, force: true });
    }

    // Restore from backup
    await this.copyDirectory(backupPath, targetPath);

    // Remove backup
    await fs.rm(backupPath, { recursive: true, force: true });
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(
    source: string,
    destination: string,
  ): Promise<void> {
    await fs.mkdir(destination, { recursive: true });

    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  /**
   * Report progress
   */
  private reportProgress(
    options: SnapshotRestoreOptions,
    progress: SnapshotProgress,
  ): void {
    if (options.onProgress) {
      options.onProgress(progress);
    }
  }
}
