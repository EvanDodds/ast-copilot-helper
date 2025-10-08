/**
 * @fileoverview Snapshot management CLI commands
 *
 * Provides commands for creating, restoring, and managing .astdb snapshots:
 * - snapshot:create - Create compressed snapshot from .astdb directory
 * - snapshot:restore - Restore snapshot to .astdb directory
 * - snapshot:list - List available local and/or remote snapshots
 * - snapshot:publish - Publish snapshot to remote storage (e.g., GitHub Releases)
 * - snapshot:download - Download snapshot from remote storage
 * - snapshot:delete - Delete snapshot from local or remote storage
 */

import { createLogger } from "../logging/index.js";
import type { Config } from "../types.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SnapshotManager } from "../snapshot/snapshot-manager.js";
import type {
  SnapshotCreateOptions,
  SnapshotRestoreOptions,
  SnapshotListOptions,
  GitHubStorageConfig,
} from "../snapshot/types.js";

const logger = createLogger();

/**
 * Options for snapshot create command
 */
export interface CreateSnapshotCommandOptions {
  version?: string;
  description?: string;
  tags?: string;
  compression?: number;
  includeModels?: boolean;
  includeCache?: boolean;
  includeLogs?: boolean;
  output?: string;
  verbose?: boolean;
}

/**
 * Options for snapshot restore command
 */
export interface RestoreSnapshotCommandOptions {
  snapshotPath: string;
  target?: string;
  skipBackup?: boolean;
  skipChecksum?: boolean;
  skipModels?: boolean;
  force?: boolean;
  verbose?: boolean;
}

/**
 * Options for snapshot list command
 */
export interface ListSnapshotCommandOptions {
  location?: "local" | "remote" | "all";
  tags?: string;
  sortBy?: "created" | "version" | "size";
  order?: "asc" | "desc";
  json?: boolean;
  verbose?: boolean;
}

/**
 * Options for snapshot publish command
 */
export interface PublishSnapshotCommandOptions {
  snapshotPath: string;
  remote?: string;
  verbose?: boolean;
}

/**
 * Options for snapshot download command
 */
export interface DownloadSnapshotCommandOptions {
  remoteId: string;
  remote?: string;
  output?: string;
  verbose?: boolean;
}

/**
 * Options for snapshot delete command
 */
export interface DeleteSnapshotCommandOptions {
  identifier: string;
  location?: "local" | "remote";
  confirm?: boolean;
  verbose?: boolean;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format date to human-readable string
 */
function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleString();
}

/**
 * Create snapshot manager with GitHub storage if configured
 */
function createSnapshotManager(config: Config): SnapshotManager {
  const manager = new SnapshotManager({
    localStoragePath: join(config.outputDir, ".snapshots"),
    defaultCompressionLevel: 6,
  });

  // Check for GitHub storage configuration in environment
  const githubToken = process.env.GITHUB_TOKEN;
  const githubOwner = process.env.GITHUB_OWNER;
  const githubRepo = process.env.GITHUB_REPO;

  if (githubToken && githubOwner && githubRepo) {
    const githubConfig: GitHubStorageConfig = {
      owner: githubOwner,
      repo: githubRepo,
      token: githubToken,
      releaseTag: process.env.GITHUB_RELEASE_TAG || "snapshots",
    };
    manager.configureGitHubStorage(githubConfig);
    logger.info("Configured GitHub storage", {
      owner: githubOwner,
      repo: githubRepo,
    });
  } else {
    logger.debug(
      "GitHub storage not configured (missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO)",
    );
  }

  return manager;
}

/**
 * Create compressed snapshot from .astdb directory
 */
export async function createSnapshot(
  config: Config,
  options: CreateSnapshotCommandOptions,
): Promise<void> {
  logger.info("Creating snapshot", {
    version: options.version,
    compression: options.compression,
  });

  const sourceDir = config.outputDir;

  // Validate .astdb directory exists
  if (!existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  const manager = createSnapshotManager(config);

  // Parse tags if provided
  const tags = options.tags
    ? options.tags.split(",").map((tag) => tag.trim())
    : undefined;

  // Build create options
  const localStoragePath = join(config.outputDir, ".snapshots");
  const createOptions: SnapshotCreateOptions = {
    astdbPath: sourceDir,
    outputPath:
      options.output || join(localStoragePath, `snapshot-${Date.now()}.tar.gz`),
    version: options.version,
    description: options.description,
    tags,
    compressionLevel:
      options.compression !== undefined ? options.compression : 6,
    includeModels: options.includeModels ?? false,
    includeCache: options.includeCache ?? false,
    includeLogs: options.includeLogs ?? false,
  };

  // Add progress callback if verbose
  if (options.verbose) {
    createOptions.onProgress = (progress) => {
      const percentage = progress.percentage.toFixed(1);
      const phase = progress.phase;
      process.stdout.write(`\r[${percentage}%] ${phase}... `);
    };
  }

  try {
    const result = await manager.createSnapshot(createOptions);

    if (options.verbose) {
      process.stdout.write("\n");
    }

    logger.info("Snapshot created successfully", {
      path: result.snapshotPath,
      uncompressedSize: result.metadata.size.uncompressed,
    });

    process.stdout.write("\n=== Snapshot Created ===\n\n");
    process.stdout.write(`Path:         ${result.snapshotPath}\n`);
    process.stdout.write(`Version:      ${result.metadata.version}\n`);
    process.stdout.write(
      `Description:  ${result.metadata.description || "(none)"}\n`,
    );
    process.stdout.write(
      `Size:         ${formatBytes(result.metadata.size.uncompressed)}\n`,
    );
    process.stdout.write(
      `Compressed:   ${formatBytes(result.metadata.size.compressed)}\n`,
    );
    process.stdout.write(
      `Ratio:        ${(result.metadata.size.ratio * 100).toFixed(1)}%\n`,
    );
    process.stdout.write(
      `Files:        ${result.metadata.repository.fileCount}\n`,
    );
    process.stdout.write(`Checksum:     ${result.metadata.checksum}\n`);
    process.stdout.write(
      `Created:      ${formatDate(result.metadata.createdAt)}\n`,
    );

    if (result.metadata.tags && result.metadata.tags.length > 0) {
      process.stdout.write(
        `Tags:         ${result.metadata.tags.join(", ")}\n`,
      );
    }

    if (result.metadata.repository.url) {
      process.stdout.write(
        `\nRepository:   ${result.metadata.repository.url}\n`,
      );
      if (result.metadata.repository.commitSha) {
        process.stdout.write(
          `Commit:       ${result.metadata.repository.commitSha}\n`,
        );
      }
      if (result.metadata.repository.branch) {
        process.stdout.write(
          `Branch:       ${result.metadata.repository.branch}\n`,
        );
      }
    }

    process.stdout.write(
      "\n✅ Snapshot created successfully. Use 'snapshot publish' to upload to remote storage.\n",
    );
  } catch (error) {
    logger.error("Failed to create snapshot", { error });
    throw error;
  }
}

/**
 * Restore snapshot to .astdb directory
 */
export async function restoreSnapshot(
  config: Config,
  options: RestoreSnapshotCommandOptions,
): Promise<void> {
  const snapshotPath = options.snapshotPath;
  logger.info("Restoring snapshot", {
    snapshot: snapshotPath,
    target: options.target,
  });

  // Validate snapshot exists
  if (!existsSync(snapshotPath)) {
    throw new Error(`Snapshot file does not exist: ${snapshotPath}`);
  }

  const targetDir = options.target || config.outputDir;
  const manager = createSnapshotManager(config);

  // Build restore options
  const restoreOptions: SnapshotRestoreOptions = {
    snapshotPath,
    targetPath: targetDir,
    createBackup: !options.skipBackup,
    validateChecksum: !options.skipChecksum,
    skipModels: options.skipModels ?? false,
    overwrite: options.force ?? false,
  };

  // Add progress callback if verbose
  if (options.verbose) {
    restoreOptions.onProgress = (progress) => {
      const percentage = progress.percentage.toFixed(1);
      const phase = progress.phase;
      process.stdout.write(`\r[${percentage}%] ${phase}... `);
    };
  }

  try {
    const result = await manager.restoreSnapshot(restoreOptions);

    if (options.verbose) {
      process.stdout.write("\n");
    }

    logger.info("Snapshot restored successfully", {
      target: result.targetPath,
      filesRestored: result.filesRestored,
    });

    process.stdout.write("\n=== Snapshot Restored ===\n\n");
    process.stdout.write(`Target:           ${result.targetPath}\n`);
    process.stdout.write(`Version:          ${result.metadata.version}\n`);
    process.stdout.write(`Files Restored:   ${result.filesRestored}\n`);
    process.stdout.write(
      `Backup Created:   ${result.backupPath || "(none)"}\n`,
    );
    process.stdout.write(
      `Duration:         ${(result.durationMs / 1000).toFixed(2)}s\n`,
    );

    process.stdout.write("\n✅ Snapshot restored successfully.\n");
  } catch (error) {
    logger.error("Failed to restore snapshot", { error });
    process.stdout.write(
      "\n❌ Snapshot restoration failed. Check logs for details.\n",
    );
    throw error;
  }
}

/**
 * List available snapshots
 */
export async function listSnapshots(
  config: Config,
  options: ListSnapshotCommandOptions,
): Promise<void> {
  const location = options.location || "all";
  logger.info("Listing snapshots", { location });

  const manager = createSnapshotManager(config);

  // Parse tags if provided
  const tags = options.tags
    ? options.tags.split(",").map((tag) => tag.trim())
    : undefined;

  // Build list options
  const listOptions: SnapshotListOptions = {
    includeLocal: location === "local" || location === "all",
    includeRemote: location === "remote" || location === "all",
    tags,
    sortBy: options.sortBy === "created" ? "createdAt" : options.sortBy,
    sortOrder: options.order || "desc",
  };

  try {
    const result = await manager.listSnapshots(listOptions);
    const localSnapshots = result.local;
    const remoteSnapshots = result.remote;
    const totalCount = localSnapshots.length + remoteSnapshots.length;

    if (options.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      return;
    }

    if (totalCount === 0) {
      process.stdout.write("\nNo snapshots found.\n");
      return;
    }

    process.stdout.write(
      `\n=== ${location === "all" ? "All" : location.charAt(0).toUpperCase() + location.slice(1)} Snapshots ===\n\n`,
    );

    // Display local snapshots
    if (localSnapshots.length > 0) {
      process.stdout.write(`Local Snapshots (${localSnapshots.length}):\n\n`);
      for (const snapshot of localSnapshots) {
        process.stdout.write(`[LOCAL] ${snapshot.version}\n`);

        if (options.verbose) {
          process.stdout.write(
            `  Description:  ${snapshot.description || "(none)"}\n`,
          );
          process.stdout.write(
            `  Size:         ${formatBytes(snapshot.size.uncompressed)}\n`,
          );
          process.stdout.write(
            `  Compressed:   ${formatBytes(snapshot.size.compressed)}\n`,
          );
          process.stdout.write(
            `  Files:        ${snapshot.repository.fileCount}\n`,
          );
          process.stdout.write(
            `  Created:      ${formatDate(snapshot.createdAt)}\n`,
          );

          if (snapshot.tags && snapshot.tags.length > 0) {
            process.stdout.write(
              `  Tags:         ${snapshot.tags.join(", ")}\n`,
            );
          }

          process.stdout.write("\n");
        } else {
          // Compact format
          const sizeInfo = `${formatBytes(snapshot.size.compressed)} (${snapshot.repository.fileCount} files)`;
          const dateInfo = formatDate(snapshot.createdAt);
          process.stdout.write(`  ${sizeInfo} - ${dateInfo}\n`);

          if (snapshot.description) {
            process.stdout.write(`  ${snapshot.description}\n`);
          }
          process.stdout.write("\n");
        }
      }
    }

    // Display remote snapshots
    if (remoteSnapshots.length > 0) {
      if (localSnapshots.length > 0) {
        process.stdout.write("\n");
      }
      process.stdout.write(`Remote Snapshots (${remoteSnapshots.length}):\n\n`);
      for (const remoteInfo of remoteSnapshots) {
        const snapshot = remoteInfo.metadata;
        process.stdout.write(`[REMOTE] ${snapshot.version}\n`);

        if (options.verbose) {
          process.stdout.write(
            `  Description:  ${snapshot.description || "(none)"}\n`,
          );
          process.stdout.write(
            `  Size:         ${formatBytes(snapshot.size.uncompressed)}\n`,
          );
          process.stdout.write(
            `  Compressed:   ${formatBytes(snapshot.size.compressed)}\n`,
          );
          process.stdout.write(
            `  Files:        ${snapshot.repository.fileCount}\n`,
          );
          process.stdout.write(
            `  Created:      ${formatDate(snapshot.createdAt)}\n`,
          );

          if (snapshot.tags && snapshot.tags.length > 0) {
            process.stdout.write(
              `  Tags:         ${snapshot.tags.join(", ")}\n`,
            );
          }

          process.stdout.write(`  Remote ID:    ${remoteInfo.id}\n`);
          process.stdout.write(`  Remote URL:   ${remoteInfo.url}\n`);

          process.stdout.write("\n");
        } else {
          // Compact format
          const sizeInfo = `${formatBytes(snapshot.size.compressed)} (${snapshot.repository.fileCount} files)`;
          const dateInfo = formatDate(snapshot.createdAt);
          process.stdout.write(`  ${sizeInfo} - ${dateInfo}\n`);

          if (snapshot.description) {
            process.stdout.write(`  ${snapshot.description}\n`);
          }
          process.stdout.write("\n");
        }
      }
    }

    process.stdout.write(`Total: ${totalCount} snapshot(s)\n`);
  } catch (error) {
    logger.error("Failed to list snapshots", { error });
    throw error;
  }
}

/**
 * Publish snapshot to remote storage
 */
export async function publishSnapshot(
  config: Config,
  options: PublishSnapshotCommandOptions,
): Promise<void> {
  const snapshotPath = options.snapshotPath;
  logger.info("Publishing snapshot", { snapshot: snapshotPath });

  // Validate snapshot exists
  if (!existsSync(snapshotPath)) {
    throw new Error(`Snapshot file does not exist: ${snapshotPath}`);
  }

  const manager = createSnapshotManager(config);

  // Parse remote index (default 0 for primary remote)
  const remoteIndex = options.remote ? parseInt(options.remote, 10) : 0;

  try {
    process.stdout.write("\nPublishing snapshot to remote storage...\n");

    const result = await manager.publishSnapshot(snapshotPath, remoteIndex);

    logger.info("Snapshot published successfully", { remoteId: result.id });

    process.stdout.write("\n=== Snapshot Published ===\n\n");
    process.stdout.write(`Remote ID:  ${result.id}\n`);
    process.stdout.write(`URL:        ${result.url}\n`);
    process.stdout.write(`Version:    ${result.metadata.version}\n`);
    process.stdout.write(
      `Size:       ${formatBytes(result.metadata.size.compressed)}\n`,
    );

    process.stdout.write("\n✅ Snapshot published successfully.\n");
  } catch (error) {
    logger.error("Failed to publish snapshot", { error });
    process.stdout.write(
      "\n❌ Snapshot publication failed. Check that GitHub credentials are configured.\n",
    );
    throw error;
  }
}

/**
 * Download snapshot from remote storage
 */
export async function downloadSnapshot(
  config: Config,
  options: DownloadSnapshotCommandOptions,
): Promise<void> {
  const remoteId = options.remoteId;
  logger.info("Downloading snapshot", { remoteId });

  const manager = createSnapshotManager(config);
  const localStoragePath = join(config.outputDir, ".snapshots");
  const localPath =
    options.output || join(localStoragePath, `${remoteId}.tar.gz`);

  // Parse remote index (default 0 for primary remote)
  const remoteIndex = options.remote ? parseInt(options.remote, 10) : 0;

  try {
    process.stdout.write("\nDownloading snapshot from remote storage...\n");

    const downloadedPath = await manager.downloadSnapshot(
      remoteId,
      localPath,
      remoteIndex,
    );

    logger.info("Snapshot downloaded successfully", {
      localPath: downloadedPath,
    });

    process.stdout.write("\n=== Snapshot Downloaded ===\n\n");
    process.stdout.write(`Local Path: ${downloadedPath}\n`);

    process.stdout.write(
      "\n✅ Snapshot downloaded successfully. Use 'snapshot restore' to extract.\n",
    );
  } catch (error) {
    logger.error("Failed to download snapshot", { error });
    process.stdout.write(
      "\n❌ Snapshot download failed. Check logs for details.\n",
    );
    throw error;
  }
}

/**
 * Delete snapshot from local or remote storage
 */
export async function deleteSnapshot(
  config: Config,
  options: DeleteSnapshotCommandOptions,
): Promise<void> {
  const identifier = options.identifier;
  const location = options.location || "local";
  logger.info("Deleting snapshot", { identifier, location });

  const manager = createSnapshotManager(config);

  try {
    if (location === "local") {
      // Delete local snapshot
      await manager.deleteLocalSnapshot(identifier);
      logger.info("Local snapshot deleted", { path: identifier });
      process.stdout.write(`\n✅ Local snapshot deleted: ${identifier}\n`);
    } else if (location === "remote") {
      // Delete remote snapshot
      const remoteIndex = 0; // Default to primary remote
      await manager.deleteRemoteSnapshot(identifier, remoteIndex);
      logger.info("Remote snapshot deleted", { remoteId: identifier });
      process.stdout.write(`\n✅ Remote snapshot deleted: ${identifier}\n`);
    }
  } catch (error) {
    logger.error("Failed to delete snapshot", { error });
    throw error;
  }
}

/**
 * Command handler for snapshot:create command
 */
export class SnapshotCreateCommandHandler {
  async execute(
    options: CreateSnapshotCommandOptions,
    config: Config,
  ): Promise<void> {
    await createSnapshot(config, options);
  }
}

/**
 * Command handler for snapshot:restore command
 */
export class SnapshotRestoreCommandHandler {
  async execute(
    options: RestoreSnapshotCommandOptions,
    config: Config,
  ): Promise<void> {
    await restoreSnapshot(config, options);
  }
}

/**
 * Command handler for snapshot:list command
 */
export class SnapshotListCommandHandler {
  async execute(
    options: ListSnapshotCommandOptions,
    config: Config,
  ): Promise<void> {
    await listSnapshots(config, options);
  }
}

/**
 * Command handler for snapshot:publish command
 */
export class SnapshotPublishCommandHandler {
  async execute(
    options: PublishSnapshotCommandOptions,
    config: Config,
  ): Promise<void> {
    await publishSnapshot(config, options);
  }
}

/**
 * Command handler for snapshot:download command
 */
export class SnapshotDownloadCommandHandler {
  async execute(
    options: DownloadSnapshotCommandOptions,
    config: Config,
  ): Promise<void> {
    await downloadSnapshot(config, options);
  }
}

/**
 * Command handler for snapshot:delete command
 */
export class SnapshotDeleteCommandHandler {
  async execute(
    options: DeleteSnapshotCommandOptions,
    config: Config,
  ): Promise<void> {
    await deleteSnapshot(config, options);
  }
}
