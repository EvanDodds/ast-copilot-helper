/**
 * Snapshot System Types
 * Part of Issue #161 - Repository Snapshot Distribution System
 *
 * This module defines all types for the snapshot distribution system,
 * enabling teams to share .astdb directories for faster onboarding.
 */

/**
 * Snapshot metadata describing snapshot contents and versioning
 */
export interface SnapshotMetadata {
  /** Unique identifier for this snapshot */
  id: string;

  /** Semantic version of this snapshot (e.g., "1.0.0") */
  version: string;

  /** ISO timestamp when snapshot was created */
  createdAt: string;

  /** Repository information */
  repository: {
    /** Repository URL (e.g., GitHub HTTPS or SSH URL) */
    url?: string;
    /** Git commit SHA that this snapshot was created from */
    commitSha?: string;
    /** Git branch name */
    branch?: string;
    /** Number of files in the repository */
    fileCount: number;
  };

  /** Snapshot size information */
  size: {
    /** Uncompressed size in bytes */
    uncompressed: number;
    /** Compressed size in bytes */
    compressed: number;
    /** Compression ratio (compressed / uncompressed) */
    ratio: number;
  };

  /** ast-copilot-helper version used to create snapshot */
  toolVersion: string;

  /** Database schema version */
  schemaVersion: string;

  /** Contents manifest */
  contents: {
    /** Database files included */
    databases: string[];
    /** Annotation files count */
    annotationCount: number;
    /** AST files count */
    astCount: number;
    /** Grammar files included */
    grammars: string[];
    /** Model files included */
    models: string[];
  };

  /** Optional description */
  description?: string;

  /** Optional tags for categorization */
  tags?: string[];

  /** Creator information */
  creator?: {
    name?: string;
    email?: string;
  };

  /** Checksum for integrity verification (SHA256) */
  checksum: string;
}

/**
 * Snapshot creation options
 */
export interface SnapshotCreateOptions {
  /** Path to .astdb directory to snapshot */
  astdbPath: string;

  /** Output path for snapshot file */
  outputPath: string;

  /** Compression level (0-9, default 6) */
  compressionLevel?: number;

  /** Include model files (can be large) */
  includeModels?: boolean;

  /** Include cache files (usually excluded) */
  includeCache?: boolean;

  /** Include logs (usually excluded) */
  includeLogs?: boolean;

  /** Semantic version for this snapshot */
  version?: string;

  /** Description of this snapshot */
  description?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Creator information */
  creator?: {
    name?: string;
    email?: string;
  };

  /** Repository information (auto-detected if not provided) */
  repository?: {
    url?: string;
    commitSha?: string;
    branch?: string;
  };

  /** Progress callback */
  onProgress?: (progress: SnapshotProgress) => void;
}

/**
 * Snapshot restoration options
 */
export interface SnapshotRestoreOptions {
  /** Path to snapshot file to restore */
  snapshotPath: string;

  /** Target .astdb directory path */
  targetPath: string;

  /** Backup existing .astdb before restoring */
  createBackup?: boolean;

  /** Backup path (default: {targetPath}.backup.{timestamp}) */
  backupPath?: string;

  /** Validate checksum before restoring */
  validateChecksum?: boolean;

  /** Overwrite existing files */
  overwrite?: boolean;

  /** Skip model files during restoration */
  skipModels?: boolean;

  /** Progress callback */
  onProgress?: (progress: SnapshotProgress) => void;
}

/**
 * Progress information during snapshot operations
 */
export interface SnapshotProgress {
  /** Current operation phase */
  phase: SnapshotPhase;

  /** Current step description */
  step: string;

  /** Percentage complete (0-100) */
  percentage: number;

  /** Files processed so far */
  filesProcessed: number;

  /** Total files to process */
  totalFiles: number;

  /** Bytes processed so far */
  bytesProcessed: number;

  /** Total bytes to process */
  totalBytes: number;

  /** Estimated time remaining in milliseconds */
  estimatedTimeMs?: number;
}

/**
 * Snapshot operation phases
 */
export enum SnapshotPhase {
  INITIALIZING = "initializing",
  SCANNING = "scanning",
  COMPRESSING = "compressing",
  WRITING = "writing",
  VALIDATING = "validating",
  EXTRACTING = "extracting",
  RESTORING = "restoring",
  FINALIZING = "finalizing",
  COMPLETE = "complete",
}

/**
 * Snapshot creation result
 */
export interface SnapshotCreateResult {
  /** Success status */
  success: boolean;

  /** Path to created snapshot file */
  snapshotPath: string;

  /** Snapshot metadata */
  metadata: SnapshotMetadata;

  /** Time taken in milliseconds */
  durationMs: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Snapshot restoration result
 */
export interface SnapshotRestoreResult {
  /** Success status */
  success: boolean;

  /** Path to restored .astdb directory */
  targetPath: string;

  /** Backup path if backup was created */
  backupPath?: string;

  /** Snapshot metadata */
  metadata: SnapshotMetadata;

  /** Time taken in milliseconds */
  durationMs: number;

  /** Files restored */
  filesRestored: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Remote storage configuration
 */
export interface RemoteStorageConfig {
  /** Storage backend type */
  type: "github" | "s3" | "azure" | "gcs" | "custom";

  /** Backend-specific configuration */
  config: Record<string, unknown>;

  /** Optional authentication credentials */
  auth?: {
    token?: string;
    username?: string;
    password?: string;
    accessKey?: string;
    secretKey?: string;
  };
}

/**
 * GitHub Releases storage configuration
 */
export interface GitHubStorageConfig {
  /** GitHub repository owner */
  owner: string;

  /** GitHub repository name */
  repo: string;

  /** GitHub personal access token */
  token: string;

  /** Release tag to use (default: "snapshots") */
  releaseTag?: string;

  /** Create release if it doesn't exist */
  createRelease?: boolean;
}

/**
 * Remote snapshot information
 */
export interface RemoteSnapshotInfo {
  /** Remote identifier */
  id: string;

  /** Remote URL for download */
  url: string;

  /** Snapshot metadata */
  metadata: SnapshotMetadata;

  /** Upload timestamp */
  uploadedAt: string;

  /** Remote storage type */
  storageType: string;
}

/**
 * Snapshot list options
 */
export interface SnapshotListOptions {
  /** Include local snapshots */
  includeLocal?: boolean;

  /** Include remote snapshots */
  includeRemote?: boolean;

  /** Filter by tags */
  tags?: string[];

  /** Filter by minimum version */
  minVersion?: string;

  /** Sort by (default: "createdAt") */
  sortBy?: "createdAt" | "version" | "size";

  /** Sort order (default: "desc") */
  sortOrder?: "asc" | "desc";
}

/**
 * Snapshot validation result
 */
export interface SnapshotValidationResult {
  /** Validation success */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];

  /** Metadata validation */
  metadataValid: boolean;

  /** Checksum validation */
  checksumValid: boolean;

  /** Schema version compatibility */
  schemaCompatible: boolean;

  /** Tool version compatibility */
  toolCompatible: boolean;
}

/**
 * Snapshot manager statistics
 */
export interface SnapshotStatistics {
  /** Total snapshots managed */
  totalSnapshots: number;

  /** Local snapshots count */
  localSnapshots: number;

  /** Remote snapshots count */
  remoteSnapshots: number;

  /** Total storage used (bytes) */
  totalStorageBytes: number;

  /** Average snapshot size (bytes) */
  averageSizeBytes: number;

  /** Average compression ratio */
  averageCompressionRatio: number;

  /** Last snapshot created */
  lastCreatedAt?: string;

  /** Last snapshot uploaded */
  lastUploadedAt?: string;
}

/**
 * Snapshot system configuration
 */
export interface SnapshotSystemConfig {
  /** Local snapshot storage directory */
  localStoragePath: string;

  /** Default compression level */
  defaultCompressionLevel: number;

  /** Remote storage configurations */
  remoteStorage?: RemoteStorageConfig[];

  /** Default remote storage index */
  defaultRemoteIndex?: number;

  /** Automatic snapshot creation settings */
  autoSnapshot?: {
    /** Enable automatic snapshots */
    enabled: boolean;
    /** Snapshot after N commits */
    afterCommits?: number;
    /** Snapshot after N days */
    afterDays?: number;
    /** Snapshot on branch push */
    onPush?: boolean;
  };
}
