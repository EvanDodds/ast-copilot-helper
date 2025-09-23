/**
 * File system utilities types and interfaces
 * Provides type definitions for cross-platform file system operations
 */

import type { Stats } from 'node:fs';

/**
 * Options for listing files in a directory
 */
export interface ListOptions {
  /** Include files from subdirectories recursively */
  recursive?: boolean;
  
  /** Include directories in the result */
  includeDirectories?: boolean;
  
  /** Custom filter function to determine which paths to include */
  filter?: (path: string, stats: Stats) => boolean;
  
  /** Follow symbolic links */
  followSymlinks?: boolean;
  
  /** Maximum depth for recursive listing (0 = current directory only) */
  maxDepth?: number;
}

/**
 * File statistics information
 */
export interface FileStats {
  /** File size in bytes */
  size: number;
  
  /** Whether this is a file */
  isFile: boolean;
  
  /** Whether this is a directory */
  isDirectory: boolean;
  
  /** Whether this is a symbolic link */
  isSymbolicLink: boolean;
  
  /** Last modified time */
  modifiedTime: Date;
  
  /** Creation time */
  createdTime: Date;
  
  /** File permissions mode */
  mode: number;
  
  /** User ID of owner */
  uid?: number;
  
  /** Group ID of owner */
  gid?: number;
}

/**
 * Options for atomic file operations
 */
export interface AtomicWriteOptions {
  /** File encoding for string content */
  encoding?: BufferEncoding;
  
  /** File permissions mode */
  mode?: number;
  
  /** Whether to create parent directories */
  ensureDir?: boolean;
  
  /** Custom temporary file suffix */
  tmpSuffix?: string;
}

/**
 * Copy operation options
 */
export interface CopyOptions {
  /** Whether to overwrite destination if it exists */
  overwrite?: boolean;
  
  /** Whether to preserve file timestamps */
  preserveTimestamps?: boolean;
  
  /** Whether to follow symbolic links */
  dereference?: boolean;
  
  /** Custom filter function */
  filter?: (src: string, dest: string) => boolean;
}

/**
 * File system utilities interface
 * Provides cross-platform file system operations with atomic safety
 */
export interface FileSystemUtils {
  // Path operations
  /**
   * Normalize path separators for current platform
   * @param path - Path to normalize
   * @returns Normalized path
   */
  normalizePath(path: string): string;
  
  /**
   * Resolve path relative to base directory
   * @param path - Path to resolve
   * @param base - Base directory (defaults to cwd)
   * @returns Absolute resolved path
   */
  resolvePath(path: string, base?: string): string;
  
  /**
   * Check if path is absolute
   * @param path - Path to check
   * @returns True if path is absolute
   */
  isAbsolutePath(path: string): boolean;
  
  // File operations
  /**
   * Write file content atomically using temporary file
   * @param filePath - Target file path
   * @param content - File content
   * @param options - Write options
   */
  atomicWriteFile(filePath: string, content: string | Buffer, options?: AtomicWriteOptions): Promise<void>;
  
  /**
   * Ensure directory exists, creating parent directories as needed
   * @param dirPath - Directory path to create
   * @param mode - Directory permissions mode
   */
  ensureDirectory(dirPath: string, mode?: number): Promise<void>;
  
  /**
   * Copy file from source to destination
   * @param source - Source file path
   * @param destination - Destination file path
   * @param options - Copy options
   */
  copyFile(source: string, destination: string, options?: CopyOptions): Promise<void>;
  
  // Directory operations
  /**
   * List files in directory with optional filtering
   * @param dirPath - Directory path to list
   * @param options - Listing options
   * @returns Array of file paths
   */
  listFiles(dirPath: string, options?: ListOptions): Promise<string[]>;
  
  /**
   * Remove directory and optionally its contents
   * @param dirPath - Directory path to remove
   * @param recursive - Whether to remove contents recursively
   */
  removeDirectory(dirPath: string, recursive?: boolean): Promise<void>;
  
  // Permissions and metadata
  /**
   * Set file permissions
   * @param filePath - File path
   * @param mode - Permission mode (e.g., 0o755)
   */
  setFilePermissions(filePath: string, mode: number): Promise<void>;
  
  /**
   * Get file statistics
   * @param filePath - File path
   * @returns File statistics information
   */
  getFileStats(filePath: string): Promise<FileStats>;
  
  // Utility methods
  /**
   * Check if file or directory exists
   * @param path - Path to check
   * @returns True if path exists
   */
  exists(path: string): Promise<boolean>;
  
  /**
   * Get temporary directory path
   * @returns Temporary directory path
   */
  getTempDir(): string;
  
  /**
   * Create unique temporary file path
   * @param prefix - File name prefix
   * @param suffix - File name suffix
   * @param dir - Directory for temporary file
   * @returns Unique temporary file path
   */
  createTempFilePath(prefix?: string, suffix?: string, dir?: string): Promise<string>;
}

/**
 * File watching types and interfaces
 * Provides comprehensive file system monitoring capabilities
 */

/**
 * Configuration options for file watching
 */
export interface FileWatchConfig {
  /** Directories to watch for changes */
  watchPaths: string[];
  
  /** File patterns to include (e.g., '*.ts', '*.js') */
  includePatterns: string[];
  
  /** Patterns to exclude (e.g., 'node_modules/**') */
  excludePatterns: string[];
  
  /** Debounce delay for file changes in milliseconds */
  debounceMs: number;
  
  /** Maximum files to process in one batch */
  batchSize: number;
  
  /** Watch subdirectories recursively */
  enableRecursive: boolean;
  
  /** Follow symbolic links */
  followSymlinks: boolean;
}

/**
 * File change event details
 */
export interface FileChangeEvent {
  /** Type of file system event */
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  
  /** Full path to the file or directory */
  filePath: string;
  
  /** File statistics (for add/change events) */
  stats?: Stats;
  
  /** Timestamp when event was detected */
  timestamp: Date;
}

/**
 * File watcher statistics
 */
export interface WatchStats {
  /** Number of files currently being watched */
  watchedFiles: number;
  
  /** Total events detected since start */
  totalEvents: number;
  
  /** Number of changes successfully processed */
  processedChanges: number;
  
  /** Last time changes were processed */
  lastProcessedAt: Date;
  
  /** Average processing time per change in milliseconds */
  averageProcessingTime: number;
}

/**
 * Main file watcher interface
 */
export interface FileWatcher {
  /**
   * Initialize the file watcher with configuration
   * @param config - File watching configuration
   */
  initialize(config: FileWatchConfig): Promise<void>;
  
  /**
   * Start watching for file changes
   */
  start(): Promise<void>;
  
  /**
   * Stop watching and cleanup resources
   */
  stop(): Promise<void>;
  
  /**
   * Add a new path to watch
   * @param path - Directory or file path to watch
   */
  addWatchPath(path: string): Promise<void>;
  
  /**
   * Remove a path from watching
   * @param path - Path to stop watching
   */
  removeWatchPath(path: string): Promise<void>;
  
  /**
   * Get list of currently watched paths
   * @returns Array of watched paths
   */
  getWatchedPaths(): string[];
  
  /**
   * Get current watcher statistics
   * @returns Statistics object
   */
  getWatchStats(): WatchStats;
}

/**
 * File watcher event emitter interface
 */
export interface FileWatcherEvents {
  /** Emitted when file watcher is ready */
  ready: () => void;
  
  /** Emitted when a file change is detected */
  fileChange: (event: FileChangeEvent) => void;
  
  /** Emitted when an error occurs */
  error: (error: Error) => void;
  
  /** Emitted when file processing encounters an error */
  processingError: (details: { change: FileChangeEvent; error: Error }) => void;
}

/**
 * Incremental update manager interface
 */
export interface IncrementalUpdateManager {
  /**
   * Determine if a file should be fully reparsed
   * @param filePath - Path to the file
   * @param change - Change event details
   * @returns True if full reparse is needed
   */
  shouldFullReparse(filePath: string, change: FileChangeEvent): Promise<boolean>;
  
  /**
   * Optimize a batch of changes for processing
   * @param changes - Array of file change events
   * @returns Optimized array of changes
   */
  optimizeUpdateBatch(changes: FileChangeEvent[]): FileChangeEvent[];
  
  /**
   * Validate consistency between file system and indexes
   * @returns Consistency report
   */
  validateIndexConsistency(): Promise<ConsistencyReport>;
}

/**
 * Index consistency report
 */
export interface ConsistencyReport {
  /** Files with inconsistent index data */
  inconsistentFiles: string[];
  
  /** Vector entries without corresponding files */
  orphanedVectors: string[];
  
  /** Files missing vector entries */
  missingVectors: string[];
  
  /** Total files checked */
  totalChecked: number;
  
  /** Number of issues found */
  issuesFound: number;
}