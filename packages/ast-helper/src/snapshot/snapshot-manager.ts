/**
 * Snapshot Manager
 * Part of Issue #161 - Repository Snapshot Distribution System
 *
 * Orchestrates snapshot operations including creation, restoration,
 * and remote synchronization.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { existsSync } from "node:fs";
import { createLogger } from "../logging/index.js";
import { SnapshotCreator } from "./snapshot-creator.js";
import { SnapshotRestorer } from "./snapshot-restorer.js";
import type { RemoteStorage } from "./remote-storage.js";
import { GitHubStorage } from "./github-storage.js";
import type {
  SnapshotCreateOptions,
  SnapshotRestoreOptions,
  SnapshotCreateResult,
  SnapshotRestoreResult,
  SnapshotSystemConfig,
  SnapshotStatistics,
  SnapshotListOptions,
  RemoteSnapshotInfo,
  SnapshotMetadata,
  GitHubStorageConfig,
} from "./types.js";

const logger = createLogger({ operation: "snapshot-manager" });

/**
 * Manages all snapshot operations
 */
export class SnapshotManager {
  private config: SnapshotSystemConfig;
  private creator: SnapshotCreator;
  private restorer: SnapshotRestorer;
  private remoteStorages: RemoteStorage[];

  constructor(config?: Partial<SnapshotSystemConfig>) {
    this.config = {
      localStoragePath: config?.localStoragePath || "./.snapshots",
      defaultCompressionLevel: config?.defaultCompressionLevel || 6,
      remoteStorage: config?.remoteStorage || [],
      defaultRemoteIndex: config?.defaultRemoteIndex,
      autoSnapshot: config?.autoSnapshot,
    };

    this.creator = new SnapshotCreator();
    this.restorer = new SnapshotRestorer();
    this.remoteStorages = this.initializeRemoteStorages();

    // Ensure local storage directory exists
    this.ensureLocalStorage().catch((error) => {
      logger.error(`Failed to create local storage directory: ${error}`);
    });
  }

  /**
   * Create a new snapshot
   */
  async createSnapshot(
    options: Partial<SnapshotCreateOptions>,
  ): Promise<SnapshotCreateResult> {
    logger.info("Creating snapshot...");

    // Build full options with defaults
    const fullOptions: SnapshotCreateOptions = {
      astdbPath: options.astdbPath || "./.astdb",
      outputPath: options.outputPath || this.getDefaultSnapshotPath(),
      compressionLevel:
        options.compressionLevel || this.config.defaultCompressionLevel,
      includeModels: options.includeModels !== false,
      includeCache: options.includeCache || false,
      includeLogs: options.includeLogs || false,
      version: options.version,
      description: options.description,
      tags: options.tags,
      creator: options.creator,
      repository: options.repository,
      onProgress: options.onProgress,
    };

    const result = await this.creator.create(fullOptions);

    if (result.success) {
      logger.info(`Snapshot created: ${result.snapshotPath}`);
    }

    return result;
  }

  /**
   * Restore a snapshot
   */
  async restoreSnapshot(
    options: Partial<SnapshotRestoreOptions>,
  ): Promise<SnapshotRestoreResult> {
    logger.info("Restoring snapshot...");

    if (!options.snapshotPath) {
      throw new Error("snapshotPath is required");
    }

    // Build full options with defaults
    const fullOptions: SnapshotRestoreOptions = {
      snapshotPath: options.snapshotPath,
      targetPath: options.targetPath || "./.astdb",
      createBackup: options.createBackup !== false,
      backupPath: options.backupPath,
      validateChecksum: options.validateChecksum !== false,
      overwrite: options.overwrite !== false,
      skipModels: options.skipModels || false,
      onProgress: options.onProgress,
    };

    const result = await this.restorer.restore(fullOptions);

    if (result.success) {
      logger.info(`Snapshot restored: ${result.targetPath}`);
    }

    return result;
  }

  /**
   * Publish snapshot to remote storage
   */
  async publishSnapshot(
    snapshotPath: string,
    remoteIndex?: number,
  ): Promise<RemoteSnapshotInfo> {
    logger.info(`Publishing snapshot: ${snapshotPath}`);

    const storage = this.getRemoteStorage(remoteIndex);

    // Load metadata
    const metadataPath = snapshotPath.replace(
      /\.(tar\.gz|tgz)$/,
      ".metadata.json",
    );
    if (!existsSync(metadataPath)) {
      throw new Error(`Metadata file not found: ${metadataPath}`);
    }

    const metadataContent = await fs.readFile(metadataPath, "utf-8");
    const metadata = JSON.parse(metadataContent) as SnapshotMetadata;

    // Upload to remote storage
    const remoteInfo = await storage.upload(snapshotPath, metadata);

    logger.info(`Snapshot published: ${remoteInfo.url}`);

    return remoteInfo;
  }

  /**
   * Download snapshot from remote storage
   */
  async downloadSnapshot(
    remoteId: string,
    localPath?: string,
    remoteIndex?: number,
  ): Promise<string> {
    logger.info(`Downloading snapshot: ${remoteId}`);

    const storage = this.getRemoteStorage(remoteIndex);

    // Use provided path or generate default
    const downloadPath =
      localPath ||
      path.join(this.config.localStoragePath, `${remoteId}.tar.gz`);

    // Ensure directory exists
    const downloadDir = path.dirname(downloadPath);
    if (!existsSync(downloadDir)) {
      await fs.mkdir(downloadDir, { recursive: true });
    }

    // Download from remote storage
    await storage.download(remoteId, downloadPath);

    logger.info(`Snapshot downloaded: ${downloadPath}`);

    return downloadPath;
  }

  /**
   * List snapshots (local and/or remote)
   */
  async listSnapshots(options?: SnapshotListOptions): Promise<{
    local: SnapshotMetadata[];
    remote: RemoteSnapshotInfo[];
  }> {
    const includeLocal = options?.includeLocal !== false;
    const includeRemote = options?.includeRemote !== false;

    const local: SnapshotMetadata[] = includeLocal
      ? await this.listLocalSnapshots(options)
      : [];
    const remote: RemoteSnapshotInfo[] = includeRemote
      ? await this.listRemoteSnapshots(options)
      : [];

    return { local, remote };
  }

  /**
   * Delete a local snapshot
   */
  async deleteLocalSnapshot(snapshotPath: string): Promise<void> {
    logger.info(`Deleting local snapshot: ${snapshotPath}`);

    if (!existsSync(snapshotPath)) {
      throw new Error(`Snapshot not found: ${snapshotPath}`);
    }

    // Delete snapshot file
    await fs.unlink(snapshotPath);

    // Delete metadata file if exists
    const metadataPath = snapshotPath.replace(
      /\.(tar\.gz|tgz)$/,
      ".metadata.json",
    );
    if (existsSync(metadataPath)) {
      await fs.unlink(metadataPath);
    }

    logger.info("Local snapshot deleted");
  }

  /**
   * Delete a remote snapshot
   */
  async deleteRemoteSnapshot(
    remoteId: string,
    remoteIndex?: number,
  ): Promise<void> {
    logger.info(`Deleting remote snapshot: ${remoteId}`);

    const storage = this.getRemoteStorage(remoteIndex);
    await storage.delete(remoteId);

    logger.info("Remote snapshot deleted");
  }

  /**
   * Get snapshot statistics
   */
  async getStatistics(): Promise<SnapshotStatistics> {
    const local = await this.listLocalSnapshots();
    const remote = await this.listRemoteSnapshots();

    const totalSnapshots = local.length + remote.length;
    let totalStorage = 0;
    let totalCompressed = 0;

    for (const metadata of local) {
      totalStorage += metadata.size.uncompressed;
      totalCompressed += metadata.size.compressed;
    }

    for (const remoteInfo of remote) {
      totalStorage += remoteInfo.metadata.size.uncompressed;
      totalCompressed += remoteInfo.metadata.size.compressed;
    }

    const averageCompression =
      totalCompressed > 0 ? totalCompressed / totalStorage : 0;

    // Find latest snapshots
    let lastCreated: string | undefined;
    let lastUploaded: string | undefined;

    if (local.length > 0) {
      const sortedLocal = [...local].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      const latest = sortedLocal[0];
      if (latest) {
        lastCreated = latest.createdAt;
      }
    }

    if (remote.length > 0) {
      const sortedRemote = [...remote].sort((a, b) =>
        b.uploadedAt.localeCompare(a.uploadedAt),
      );
      const latest = sortedRemote[0];
      if (latest) {
        lastUploaded = latest.uploadedAt;
      }
    }

    return {
      totalSnapshots,
      localSnapshots: local.length,
      remoteSnapshots: remote.length,
      totalStorageBytes: totalStorage,
      averageSizeBytes: totalSnapshots > 0 ? totalStorage / totalSnapshots : 0,
      averageCompressionRatio: averageCompression,
      lastCreatedAt: lastCreated,
      lastUploadedAt: lastUploaded,
    };
  }

  /**
   * Configure a GitHub storage backend
   */
  configureGitHubStorage(config: GitHubStorageConfig): void {
    const storage = new GitHubStorage(config);
    this.remoteStorages.push(storage);

    logger.info(`Configured GitHub storage for ${config.owner}/${config.repo}`);
  }

  /**
   * List local snapshots
   */
  private async listLocalSnapshots(
    options?: SnapshotListOptions,
  ): Promise<SnapshotMetadata[]> {
    if (!existsSync(this.config.localStoragePath)) {
      return [];
    }

    const files = await fs.readdir(this.config.localStoragePath);
    const metadataFiles = files.filter((f) => f.endsWith(".metadata.json"));
    const snapshots: SnapshotMetadata[] = [];

    for (const file of metadataFiles) {
      try {
        const filePath = path.join(this.config.localStoragePath, file);
        const content = await fs.readFile(filePath, "utf-8");
        const metadata = JSON.parse(content) as SnapshotMetadata;

        // Apply filters
        if (options?.tags && options.tags.length > 0) {
          const filterTags = options.tags;
          if (
            !metadata.tags ||
            !metadata.tags.some((tag) => filterTags.includes(tag))
          ) {
            continue;
          }
        }

        snapshots.push(metadata);
      } catch (error) {
        logger.warn(`Failed to read metadata file ${file}: ${error}`);
      }
    }

    // Sort snapshots
    this.sortSnapshots(snapshots, options?.sortBy, options?.sortOrder);

    return snapshots;
  }

  /**
   * List remote snapshots
   */
  private async listRemoteSnapshots(
    options?: SnapshotListOptions,
  ): Promise<RemoteSnapshotInfo[]> {
    const allSnapshots: RemoteSnapshotInfo[] = [];

    for (const storage of this.remoteStorages) {
      try {
        const snapshots = await storage.list({
          tags: options?.tags,
          minVersion: options?.minVersion,
        });
        allSnapshots.push(...snapshots);
      } catch (error) {
        logger.warn(`Failed to list snapshots from remote storage: ${error}`);
      }
    }

    return allSnapshots;
  }

  /**
   * Sort snapshots
   */
  private sortSnapshots(
    snapshots: SnapshotMetadata[],
    sortBy: "createdAt" | "version" | "size" = "createdAt",
    sortOrder: "asc" | "desc" = "desc",
  ): void {
    snapshots.sort((a, b) => {
      let comparison = 0;

      if (sortBy === "createdAt") {
        comparison = a.createdAt.localeCompare(b.createdAt);
      } else if (sortBy === "version") {
        comparison = a.version.localeCompare(b.version);
      } else if (sortBy === "size") {
        comparison = a.size.uncompressed - b.size.uncompressed;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }

  /**
   * Get remote storage by index
   */
  private getRemoteStorage(index?: number): RemoteStorage {
    const storageIndex =
      index !== undefined ? index : this.config.defaultRemoteIndex || 0;

    if (this.remoteStorages.length === 0) {
      throw new Error("No remote storage configured");
    }

    if (storageIndex < 0 || storageIndex >= this.remoteStorages.length) {
      throw new Error(`Invalid remote storage index: ${storageIndex}`);
    }

    const storage = this.remoteStorages[storageIndex];
    if (!storage) {
      throw new Error(
        `Remote storage at index ${storageIndex} is not available`,
      );
    }

    return storage;
  }

  /**
   * Initialize remote storages from config
   */
  private initializeRemoteStorages(): RemoteStorage[] {
    const storages: RemoteStorage[] = [];

    for (const config of this.config.remoteStorage || []) {
      if (config.type === "github") {
        storages.push(
          new GitHubStorage(config.config as unknown as GitHubStorageConfig),
        );
      }
      // Add more storage backends here in the future
    }

    return storages;
  }

  /**
   * Ensure local storage directory exists
   */
  private async ensureLocalStorage(): Promise<void> {
    if (!existsSync(this.config.localStoragePath)) {
      await fs.mkdir(this.config.localStoragePath, { recursive: true });
    }
  }

  /**
   * Get default snapshot path
   */
  private getDefaultSnapshotPath(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return path.join(
      this.config.localStoragePath,
      `snapshot-${timestamp}.tar.gz`,
    );
  }
}
