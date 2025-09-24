/**
 * File system utilities module
 * Exports file system utilities and types for cross-platform operations
 */

export { FileSystemManager } from "./manager.js";
export { createFileWatcher, ChokidarFileWatcher } from "./file-watcher.js";
export {
  createIncrementalUpdateManager,
  IncementalUpdateManagerImpl,
} from "./incremental-update-manager.js";
export type {
  FileSystemUtils,
  ListOptions,
  FileStats,
  AtomicWriteOptions,
  CopyOptions,
  FileWatchConfig,
  FileChangeEvent,
  WatchStats,
  FileWatcher,
  FileWatcherEvents,
  IncrementalUpdateManager,
  ConsistencyReport,
} from "./types.js";
