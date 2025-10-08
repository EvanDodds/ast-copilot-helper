/**
 * GitHub Releases Storage Backend
 * Part of Issue #161 - Repository Snapshot Distribution System
 *
 * Implements remote storage using GitHub Releases.
 */

import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { createLogger } from "../logging/index.js";
import type { RemoteStorage } from "./remote-storage.js";
import type {
  SnapshotMetadata,
  RemoteSnapshotInfo,
  GitHubStorageConfig,
} from "./types.js";

const logger = createLogger({ operation: "github-storage" });

/**
 * GitHub Releases storage backend
 */
export class GitHubStorage implements RemoteStorage {
  private config: GitHubStorageConfig;
  private apiBaseUrl = "https://api.github.com";

  constructor(config: GitHubStorageConfig) {
    this.config = {
      ...config,
      releaseTag: config.releaseTag || "snapshots",
      createRelease: config.createRelease !== false,
    };
  }

  /**
   * Upload snapshot to GitHub Release
   */
  async upload(
    snapshotPath: string,
    metadata: SnapshotMetadata,
  ): Promise<RemoteSnapshotInfo> {
    logger.info(`Uploading snapshot ${metadata.id} to GitHub Releases...`);

    try {
      // Ensure release exists
      const release = await this.ensureRelease();

      // Read snapshot file
      if (!existsSync(snapshotPath)) {
        throw new Error(`Snapshot file not found: ${snapshotPath}`);
      }

      const stats = await fs.stat(snapshotPath);
      const fileName = `${metadata.id}.tar.gz`;

      // Upload asset
      const uploadUrl = release.upload_url.replace(
        /\{[^}]+\}/g,
        `?name=${fileName}`,
      );
      const fileBuffer = await fs.readFile(snapshotPath);

      const uploadResponse = (await this.makeRequest(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/gzip",
          "Content-Length": String(stats.size),
        },
        body: fileBuffer,
      })) as GitHubAsset;

      // Upload metadata as separate asset
      const metadataPath = snapshotPath.replace(
        /\.(tar\.gz|tgz)$/,
        ".metadata.json",
      );
      if (existsSync(metadataPath)) {
        const metadataFileName = `${metadata.id}.metadata.json`;
        const metadataUploadUrl = release.upload_url.replace(
          /\{[^}]+\}/g,
          `?name=${metadataFileName}`,
        );
        const metadataContent = await fs.readFile(metadataPath);

        await this.makeRequest(metadataUploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(metadataContent.length),
          },
          body: metadataContent,
        });
      }

      logger.info(
        `Snapshot uploaded successfully: ${uploadResponse.browser_download_url}`,
      );

      return {
        id: metadata.id,
        url: uploadResponse.browser_download_url,
        metadata,
        uploadedAt: new Date().toISOString(),
        storageType: "github",
      };
    } catch (error) {
      throw new Error(
        `Failed to upload snapshot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Download snapshot from GitHub Release
   */
  async download(
    remoteId: string,
    localPath: string,
  ): Promise<SnapshotMetadata> {
    logger.info(`Downloading snapshot ${remoteId} from GitHub Releases...`);

    try {
      // Get release
      const release = await this.getRelease();

      // Find snapshot asset
      const snapshotAsset = release.assets.find(
        (asset: { name: string }) => asset.name === `${remoteId}.tar.gz`,
      );

      if (!snapshotAsset) {
        throw new Error(
          `Snapshot ${remoteId} not found in release ${this.config.releaseTag}`,
        );
      }

      // Download snapshot file
      await this.downloadFile(snapshotAsset.browser_download_url, localPath);

      // Download metadata
      const metadataAsset = release.assets.find(
        (asset: { name: string }) => asset.name === `${remoteId}.metadata.json`,
      );

      if (!metadataAsset) {
        throw new Error(`Snapshot metadata ${remoteId} not found`);
      }

      const metadataPath = localPath.replace(
        /\.(tar\.gz|tgz)$/,
        ".metadata.json",
      );
      await this.downloadFile(metadataAsset.browser_download_url, metadataPath);

      // Read and return metadata
      const metadataContent = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(metadataContent) as SnapshotMetadata;

      logger.info(`Snapshot downloaded successfully: ${localPath}`);

      return metadata;
    } catch (error) {
      throw new Error(
        `Failed to download snapshot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List available snapshots
   */
  async list(options?: {
    tags?: string[];
    minVersion?: string;
    maxResults?: number;
  }): Promise<RemoteSnapshotInfo[]> {
    logger.info("Listing snapshots from GitHub Releases...");

    try {
      const release = await this.getRelease();
      const snapshots: RemoteSnapshotInfo[] = [];

      // Find all metadata files
      const metadataAssets = release.assets.filter((asset: { name: string }) =>
        asset.name.endsWith(".metadata.json"),
      );

      for (const metadataAsset of metadataAssets) {
        try {
          // Download metadata
          const metadataResponse = await this.makeRequest(
            metadataAsset.browser_download_url,
            { method: "GET" },
          );
          const metadata = JSON.parse(
            String(metadataResponse),
          ) as SnapshotMetadata;

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

          if (options?.minVersion) {
            if (
              this.compareVersions(metadata.version, options.minVersion) < 0
            ) {
              continue;
            }
          }

          // Find corresponding snapshot asset
          const snapshotAsset = release.assets.find(
            (asset: { name: string }) => asset.name === `${metadata.id}.tar.gz`,
          );

          if (snapshotAsset) {
            snapshots.push({
              id: metadata.id,
              url: snapshotAsset.browser_download_url,
              metadata,
              uploadedAt: metadataAsset.updated_at,
              storageType: "github",
            });
          }
        } catch (error) {
          logger.warn(
            `Failed to process metadata asset ${metadataAsset.name}: ${error}`,
          );
        }
      }

      // Apply max results
      if (options?.maxResults && options.maxResults > 0) {
        return snapshots.slice(0, options.maxResults);
      }

      logger.info(`Found ${snapshots.length} snapshots`);

      return snapshots;
    } catch (error) {
      throw new Error(
        `Failed to list snapshots: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete snapshot from GitHub Release
   */
  async delete(remoteId: string): Promise<void> {
    logger.info(`Deleting snapshot ${remoteId} from GitHub Releases...`);

    try {
      const release = await this.getRelease();

      // Find and delete snapshot asset
      const snapshotAsset = release.assets.find(
        (asset: { name: string }) => asset.name === `${remoteId}.tar.gz`,
      );

      if (snapshotAsset) {
        await this.deleteAsset(snapshotAsset.id);
      }

      // Find and delete metadata asset
      const metadataAsset = release.assets.find(
        (asset: { name: string }) => asset.name === `${remoteId}.metadata.json`,
      );

      if (metadataAsset) {
        await this.deleteAsset(metadataAsset.id);
      }

      logger.info(`Snapshot deleted successfully`);
    } catch (error) {
      throw new Error(
        `Failed to delete snapshot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if snapshot exists
   */
  async exists(remoteId: string): Promise<boolean> {
    try {
      const release = await this.getRelease();
      const snapshotAsset = release.assets.find(
        (asset: { name: string }) => asset.name === `${remoteId}.tar.gz`,
      );
      return !!snapshotAsset;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get metadata for remote snapshot
   */
  async getMetadata(remoteId: string): Promise<SnapshotMetadata> {
    try {
      const release = await this.getRelease();
      const metadataAsset = release.assets.find(
        (asset: { name: string }) => asset.name === `${remoteId}.metadata.json`,
      );

      if (!metadataAsset) {
        throw new Error(`Metadata for snapshot ${remoteId} not found`);
      }

      const metadataResponse = await this.makeRequest(
        metadataAsset.browser_download_url,
        { method: "GET" },
      );
      return JSON.parse(String(metadataResponse)) as SnapshotMetadata;
    } catch (error) {
      throw new Error(
        `Failed to get metadata: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Ensure release exists, create if necessary
   */
  private async ensureRelease(): Promise<GitHubRelease> {
    try {
      return await this.getRelease();
    } catch (error) {
      if (this.config.createRelease) {
        logger.info(`Release ${this.config.releaseTag} not found, creating...`);
        return await this.createRelease();
      }
      throw error;
    }
  }

  /**
   * Get release by tag
   */
  private async getRelease(): Promise<GitHubRelease> {
    const url = `${this.apiBaseUrl}/repos/${this.config.owner}/${this.config.repo}/releases/tags/${this.config.releaseTag}`;

    const response = await this.makeRequest(url, { method: "GET" });
    return response as GitHubRelease;
  }

  /**
   * Create a new release
   */
  private async createRelease(): Promise<GitHubRelease> {
    const url = `${this.apiBaseUrl}/repos/${this.config.owner}/${this.config.repo}/releases`;

    const response = await this.makeRequest(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tag_name: this.config.releaseTag,
        name: `AST Database Snapshots`,
        body: "Automated snapshots of .astdb directories for team collaboration",
        draft: false,
        prerelease: false,
      }),
    });

    return response as GitHubRelease;
  }

  /**
   * Delete an asset
   */
  private async deleteAsset(assetId: number): Promise<void> {
    const url = `${this.apiBaseUrl}/repos/${this.config.owner}/${this.config.repo}/releases/assets/${assetId}`;

    await this.makeRequest(url, { method: "DELETE" });
  }

  /**
   * Download file from URL
   */
  private async downloadFile(url: string, localPath: string): Promise<void> {
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${this.config.token}`,
        Accept: "application/octet-stream",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(localPath, Buffer.from(buffer));
  }

  /**
   * Make HTTP request to GitHub API
   */
  private async makeRequest(
    url: string,
    options: {
      method: string;
      headers?: Record<string, string>;
      body?: Buffer | string;
    },
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      Authorization: `token ${this.config.token}`,
      Accept: "application/vnd.github.v3+json",
      ...options.headers,
    };

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // Return parsed JSON for GET requests, raw response for others
    if (
      options.method === "GET" &&
      response.headers.get("content-type")?.includes("application/json")
    ) {
      return await response.json();
    }

    if (
      options.method === "POST" &&
      response.headers.get("content-type")?.includes("application/json")
    ) {
      return await response.json();
    }

    return await response.text();
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) {
        return 1;
      }
      if (p1 < p2) {
        return -1;
      }
    }

    return 0;
  }
}

/**
 * GitHub Release type
 */
interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  upload_url: string;
  assets: GitHubAsset[];
  updated_at: string;
}

/**
 * GitHub Asset type
 */
interface GitHubAsset {
  id: number;
  name: string;
  browser_download_url: string;
  updated_at: string;
}
