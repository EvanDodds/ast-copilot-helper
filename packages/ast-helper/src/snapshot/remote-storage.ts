/**
 * Remote Storage Interface
 * Part of Issue #161 - Repository Snapshot Distribution System
 *
 * Abstract interface for remote snapshot storage backends.
 */

import type { SnapshotMetadata, RemoteSnapshotInfo } from "./types.js";

/**
 * Remote storage backend interface
 */
export interface RemoteStorage {
  /**
   * Upload a snapshot to remote storage
   * @param snapshotPath - Local path to snapshot file
   * @param metadata - Snapshot metadata
   * @returns Remote snapshot information
   */
  upload(
    snapshotPath: string,
    metadata: SnapshotMetadata,
  ): Promise<RemoteSnapshotInfo>;

  /**
   * Download a snapshot from remote storage
   * @param remoteId - Remote snapshot identifier
   * @param localPath - Local path to save downloaded snapshot
   * @returns Downloaded snapshot metadata
   */
  download(remoteId: string, localPath: string): Promise<SnapshotMetadata>;

  /**
   * List available snapshots in remote storage
   * @param options - Filtering options
   * @returns Array of remote snapshot information
   */
  list(options?: {
    tags?: string[];
    minVersion?: string;
    maxResults?: number;
  }): Promise<RemoteSnapshotInfo[]>;

  /**
   * Delete a snapshot from remote storage
   * @param remoteId - Remote snapshot identifier
   */
  delete(remoteId: string): Promise<void>;

  /**
   * Check if a snapshot exists in remote storage
   * @param remoteId - Remote snapshot identifier
   */
  exists(remoteId: string): Promise<boolean>;

  /**
   * Get metadata for a remote snapshot
   * @param remoteId - Remote snapshot identifier
   */
  getMetadata(remoteId: string): Promise<SnapshotMetadata>;
}

/**
 * Upload progress callback
 */
export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
}

/**
 * Download progress callback
 */
export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
}
