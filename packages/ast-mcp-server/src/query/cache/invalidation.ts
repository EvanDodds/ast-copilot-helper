import { createLogger } from "../../../../ast-helper/src/logging/index.js";

import type { MultiLevelCacheManager } from "./multi-level-cache.js";

/**
 * Reason for cache invalidation
 */
export type InvalidationReason =
  | "file_change" // File was added or modified
  | "file_delete" // File was deleted
  | "file_rename" // File was renamed
  | "index_rebuild" // Vector database index was rebuilt
  | "manual" // Manual invalidation requested
  | "expired"; // TTL-based expiration

/**
 * File change information for cache invalidation
 */
export interface FileChangeInfo {
  /** Path to the file that changed */
  filePath: string;

  /** Type of change */
  changeType: "add" | "modify" | "delete" | "rename";

  /** Old path (for rename operations) */
  oldPath?: string;

  /** Timestamp of change */
  timestamp: number;
}

/**
 * Result of a cache invalidation operation
 */
export interface InvalidationResult {
  /** Number of cache entries invalidated */
  invalidatedCount: number;

  /** Keys of invalidated entries */
  affectedKeys: string[];

  /** Cache levels affected */
  levels: Array<"L1" | "L2" | "L3">;

  /** Duration of invalidation operation in ms */
  durationMs: number;

  /** Reason for invalidation */
  reason: InvalidationReason;
}

/**
 * Cache Invalidator
 *
 * Handles automatic cache invalidation based on:
 * - File changes detected in watch mode
 * - File deletions
 * - File renames
 * - Index rebuild operations
 * - Manual triggers
 */
export class CacheInvalidator {
  private cacheManager: MultiLevelCacheManager;
  private logger = createLogger({ operation: "cache-invalidator" });

  // Track file-to-query mappings for precise invalidation
  private fileQueryMappings = new Map<string, Set<string>>();

  // Statistics
  private stats = {
    totalInvalidations: 0,
    fileChangeInvalidations: 0,
    indexRebuildInvalidations: 0,
    manualInvalidations: 0,
  };

  constructor(cacheManager: MultiLevelCacheManager) {
    this.cacheManager = cacheManager;

    this.logger.info("Cache invalidator initialized");
  }

  /**
   * Invalidate cache entries for a file change
   *
   * @param fileChange File change information
   * @returns Invalidation result
   */
  async invalidateForFileChange(
    fileChange: FileChangeInfo,
  ): Promise<InvalidationResult> {
    const startTime = Date.now();

    this.logger.info("Invalidating cache for file change", {
      filePath: fileChange.filePath,
      changeType: fileChange.changeType,
    });

    // Build pattern to match cache keys related to this file
    const pattern = this.buildFilePattern(fileChange.filePath);

    // Invalidate matching cache entries
    const event = await this.cacheManager.invalidate(pattern);

    this.stats.totalInvalidations++;
    this.stats.fileChangeInvalidations++;

    // Handle rename - also invalidate old path
    if (fileChange.changeType === "rename" && fileChange.oldPath) {
      const oldPattern = this.buildFilePattern(fileChange.oldPath);
      const oldEvent = await this.cacheManager.invalidate(oldPattern);

      // Merge events
      event.keys.push(...oldEvent.keys);
    }

    const result: InvalidationResult = {
      invalidatedCount: event.keys.length,
      affectedKeys: event.keys,
      levels: event.levels,
      durationMs: Date.now() - startTime,
      reason: this.mapChangeTypeToReason(fileChange.changeType),
    };

    this.logger.info("Cache invalidation completed", {
      filePath: fileChange.filePath,
      invalidatedCount: result.invalidatedCount,
      durationMs: result.durationMs,
    });

    return result;
  }

  /**
   * Invalidate cache entries for multiple file changes (batch)
   *
   * @param fileChanges Array of file changes
   * @returns Invalidation result
   */
  async invalidateForFileChanges(
    fileChanges: FileChangeInfo[],
  ): Promise<InvalidationResult> {
    const startTime = Date.now();

    this.logger.info("Batch invalidating cache for file changes", {
      fileCount: fileChanges.length,
    });

    const allKeys: string[] = [];
    const levels = new Set<"L1" | "L2" | "L3">();

    for (const fileChange of fileChanges) {
      const result = await this.invalidateForFileChange(fileChange);
      allKeys.push(...result.affectedKeys);
      result.levels.forEach((level) => levels.add(level));
    }

    const result: InvalidationResult = {
      invalidatedCount: allKeys.length,
      affectedKeys: allKeys,
      levels: Array.from(levels),
      durationMs: Date.now() - startTime,
      reason: "file_change",
    };

    this.logger.info("Batch cache invalidation completed", {
      fileCount: fileChanges.length,
      invalidatedCount: result.invalidatedCount,
      durationMs: result.durationMs,
    });

    return result;
  }

  /**
   * Invalidate cache for changes from watch mode
   * Converts watch mode change set to file change info
   *
   * @param changes Change set from watch mode
   * @returns Invalidation result
   */
  async invalidateForWatchChanges(changes: {
    added: string[];
    modified: string[];
    renamed: Array<{ from: string; to: string }>;
    deleted: string[];
  }): Promise<InvalidationResult> {
    const fileChanges: FileChangeInfo[] = [];
    const timestamp = Date.now();

    // Convert added files
    for (const filePath of changes.added) {
      fileChanges.push({
        filePath,
        changeType: "add",
        timestamp,
      });
    }

    // Convert modified files
    for (const filePath of changes.modified) {
      fileChanges.push({
        filePath,
        changeType: "modify",
        timestamp,
      });
    }

    // Convert renamed files
    for (const rename of changes.renamed) {
      fileChanges.push({
        filePath: rename.to,
        changeType: "rename",
        oldPath: rename.from,
        timestamp,
      });
    }

    // Convert deleted files
    for (const filePath of changes.deleted) {
      fileChanges.push({
        filePath,
        changeType: "delete",
        timestamp,
      });
    }

    this.logger.info("Invalidating cache for watch mode changes", {
      added: changes.added.length,
      modified: changes.modified.length,
      renamed: changes.renamed.length,
      deleted: changes.deleted.length,
      totalChanges: fileChanges.length,
    });

    return await this.invalidateForFileChanges(fileChanges);
  }

  /**
   * Invalidate all caches for an index rebuild
   * This clears ALL cache entries since the index structure changes
   *
   * @returns Invalidation result
   */
  async invalidateForIndexRebuild(): Promise<InvalidationResult> {
    const startTime = Date.now();

    this.logger.info("Invalidating all caches for index rebuild");

    // Clear all cache levels
    await this.cacheManager.clear();

    this.stats.totalInvalidations++;
    this.stats.indexRebuildInvalidations++;

    // Also clear file-query mappings since index structure changed
    this.fileQueryMappings.clear();

    const result: InvalidationResult = {
      invalidatedCount: 0, // We don't track individual entries during full clear
      affectedKeys: [],
      levels: ["L1", "L2", "L3"],
      durationMs: Date.now() - startTime,
      reason: "index_rebuild",
    };

    this.logger.info("Index rebuild cache invalidation completed", {
      durationMs: result.durationMs,
    });

    return result;
  }

  /**
   * Manual cache invalidation with pattern matching
   *
   * @param pattern Pattern to match cache keys (regex or glob)
   * @returns Invalidation result
   */
  async invalidateManual(pattern: string): Promise<InvalidationResult> {
    const startTime = Date.now();

    this.logger.info("Manual cache invalidation", { pattern });

    const event = await this.cacheManager.invalidate(pattern);

    this.stats.totalInvalidations++;
    this.stats.manualInvalidations++;

    const result: InvalidationResult = {
      invalidatedCount: event.keys.length,
      affectedKeys: event.keys,
      levels: event.levels,
      durationMs: Date.now() - startTime,
      reason: "manual",
    };

    this.logger.info("Manual cache invalidation completed", {
      invalidatedCount: result.invalidatedCount,
      durationMs: result.durationMs,
    });

    return result;
  }

  /**
   * Track mapping between query keys and file paths
   * This allows precise invalidation when files change
   *
   * @param queryKey Cache key for the query
   * @param filePaths Files referenced in the query
   */
  trackQueryFileMapping(queryKey: string, filePaths: string[]): void {
    for (const filePath of filePaths) {
      if (!this.fileQueryMappings.has(filePath)) {
        this.fileQueryMappings.set(filePath, new Set());
      }
      const queries = this.fileQueryMappings.get(filePath);
      if (queries) {
        queries.add(queryKey);
      }
    }

    this.logger.debug("Tracked query-file mapping", {
      queryKey,
      fileCount: filePaths.length,
    });
  }

  /**
   * Get queries affected by a file change
   *
   * @param filePath Path to changed file
   * @returns Set of query keys affected
   */
  getAffectedQueries(filePath: string): Set<string> {
    return this.fileQueryMappings.get(filePath) || new Set();
  }

  /**
   * Get invalidation statistics
   *
   * @returns Invalidation statistics
   */
  getStats() {
    return {
      ...this.stats,
      fileMappingsCount: this.fileQueryMappings.size,
      queriesTracked: Array.from(this.fileQueryMappings.values()).reduce(
        (sum, set) => sum + set.size,
        0,
      ),
    };
  }

  /**
   * Clear file-query mappings (for memory management)
   */
  clearMappings(): void {
    this.fileQueryMappings.clear();
    this.logger.info("Cleared file-query mappings");
  }

  /**
   * Build pattern to match cache keys for a file
   * Matches any query that might reference this file
   *
   * @param filePath Path to file
   * @returns Pattern to match cache keys
   */
  private buildFilePattern(filePath: string): string {
    // Match any query that includes this file path
    // This is a conservative approach - better to invalidate too much than too little
    return `.*${this.escapeRegex(filePath)}.*`;
  }

  /**
   * Escape regex special characters
   *
   * @param str String to escape
   * @returns Escaped string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Map file change type to invalidation reason
   *
   * @param changeType Type of file change
   * @returns Invalidation reason
   */
  private mapChangeTypeToReason(
    changeType: FileChangeInfo["changeType"],
  ): InvalidationReason {
    switch (changeType) {
      case "add":
      case "modify":
        return "file_change";
      case "delete":
        return "file_delete";
      case "rename":
        return "file_rename";
    }
  }
}
