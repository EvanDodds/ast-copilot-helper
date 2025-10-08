/**
 * Incremental Update Manager
 *
 * Optimizes file processing by detecting unchanged files,
 * batching related changes, and managing dependencies.
 *
 * Implements Issue #159 acceptance criteria:
 * - Smart delta processing
 * - File rename detection
 * - Batch optimization
 * - Dependency tracking
 */

import { promises as fs } from "fs";
import { extname } from "path";
import { createModuleLogger } from "../logging/index.js";
import type { WatchStateManager } from "./watch-state.js";

const logger = createModuleLogger("IncrementalUpdate");

/**
 * Change types
 */
export enum ChangeType {
  ADDED = "added",
  MODIFIED = "modified",
  RENAMED = "renamed",
  DELETED = "deleted",
  UNCHANGED = "unchanged",
}

/**
 * File change information
 */
export interface FileChange {
  path: string;
  type: ChangeType;
  previousPath?: string; // For renames
  timestamp: number;
}

/**
 * Change set with categorized files
 */
export interface ChangeSet {
  added: string[];
  modified: string[];
  renamed: Array<{ from: string; to: string }>;
  deleted: string[];
  unchanged: string[];
  dependencies: Map<string, Set<string>>; // file -> dependent files
}

/**
 * Update result
 */
export interface UpdateResult {
  processedFiles: string[];
  skippedFiles: string[];
  errors: Array<{ file: string; error: string }>;
  processingTime: number;
  stats: {
    added: number;
    modified: number;
    renamed: number;
    deleted: number;
    skipped: number;
  };
}

/**
 * Incremental Update Manager
 *
 * Handles intelligent delta processing for watch command
 */
export class IncrementalUpdateManager {
  private stateManager: WatchStateManager;
  private fileHashes = new Map<string, string>();
  private recentRenames = new Map<string, string>(); // hash -> path
  private readonly renameWindow = 5000; // 5 seconds
  private deletedFileHashes = new Map<string, string>(); // hash -> deleted path

  constructor(stateManager: WatchStateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Analyze file changes and categorize them
   */
  async analyzeChanges(files: string[]): Promise<ChangeSet> {
    const changeSet: ChangeSet = {
      added: [],
      modified: [],
      renamed: [],
      deleted: [],
      unchanged: [],
      dependencies: new Map(),
    };

    logger.info("Analyzing changes", { fileCount: files.length });

    // First pass: identify deleted files and track their hashes
    const existingFiles = new Set<string>();
    for (const file of files) {
      const stats = await fs.stat(file).catch(() => null);
      if (stats) {
        existingFiles.add(file);
      } else {
        // File was deleted - save its hash for rename detection
        const fileState = this.stateManager.getFileState(file);
        if (fileState && fileState.contentHash) {
          this.deletedFileHashes.set(fileState.contentHash, file);
        }
        changeSet.deleted.push(file);
        this.stateManager.removeFileState(file);
      }
    }

    // Second pass: analyze existing files and detect renames
    for (const file of existingFiles) {
      try {
        // Get file state
        const fileState = this.stateManager.getFileState(file);
        const currentHash = await this.stateManager.calculateFileHash(file);

        if (!fileState) {
          // New file - check if it's a rename by comparing with deleted file hashes
          const renamedFrom = this.detectRename(currentHash);

          if (renamedFrom) {
            // Remove from deleted list since it was actually renamed
            const deletedIndex = changeSet.deleted.indexOf(renamedFrom);
            if (deletedIndex !== -1) {
              changeSet.deleted.splice(deletedIndex, 1);
            }

            changeSet.renamed.push({ from: renamedFrom, to: file });

            logger.debug("Detected file rename", {
              from: renamedFrom,
              to: file,
            });
          } else {
            changeSet.added.push(file);
          }

          // Track hash for potential future rename detection
          this.trackHash(currentHash, file);
          continue;
        }

        // Check if content changed
        if (currentHash === fileState.contentHash) {
          changeSet.unchanged.push(file);
          continue;
        }

        // File was modified
        changeSet.modified.push(file);
        this.trackHash(currentHash, file);
      } catch (error) {
        logger.warn("Error analyzing file", { file, error });
        // Treat as modified to be safe
        changeSet.modified.push(file);
      }
    }

    // Clean up deleted file hashes after analysis
    this.deletedFileHashes.clear();

    // Detect dependencies
    await this.analyzeDependencies(changeSet);

    logger.info("Change analysis complete", {
      added: changeSet.added.length,
      modified: changeSet.modified.length,
      renamed: changeSet.renamed.length,
      deleted: changeSet.deleted.length,
      unchanged: changeSet.unchanged.length,
    });

    return changeSet;
  }

  /**
   * Process changes with intelligent batching
   */
  async processChanges(
    changeSet: ChangeSet,
    processor: (files: string[]) => Promise<void>,
    batchSize = 50,
  ): Promise<UpdateResult> {
    const startTime = Date.now();
    const result: UpdateResult = {
      processedFiles: [],
      skippedFiles: [...changeSet.unchanged],
      errors: [],
      processingTime: 0,
      stats: {
        added: changeSet.added.length,
        modified: changeSet.modified.length,
        renamed: changeSet.renamed.length,
        deleted: changeSet.deleted.length,
        skipped: changeSet.unchanged.length,
      },
    };

    // Collect files to process
    const filesToProcess: string[] = [
      ...changeSet.added,
      ...changeSet.modified,
      ...changeSet.renamed.map((r) => r.to),
    ];

    if (filesToProcess.length === 0) {
      result.processingTime = Date.now() - startTime;
      return result;
    }

    // Add dependent files
    const withDependencies = this.addDependentFiles(
      filesToProcess,
      changeSet.dependencies,
    );

    logger.info("Processing changes with batching", {
      totalFiles: withDependencies.length,
      batchSize,
    });

    // Process in batches
    const batches = this.createBatches(withDependencies, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      if (!batch) {
        continue;
      }

      logger.debug(`Processing batch ${i + 1}/${batches.length}`, {
        batchSize: batch.length,
      });

      try {
        await processor(batch);
        result.processedFiles.push(...batch);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        logger.error("Batch processing failed", {
          batch: i + 1,
          error: errorMsg,
        });

        // Record errors for all files in batch
        for (const file of batch) {
          result.errors.push({ file, error: errorMsg });
        }
      }
    }

    result.processingTime = Date.now() - startTime;

    logger.info("Change processing complete", {
      processed: result.processedFiles.length,
      skipped: result.skippedFiles.length,
      errors: result.errors.length,
      timeMs: result.processingTime,
    });

    return result;
  }

  /**
   * Detect if a file was renamed based on content hash
   * Checks both recent time-based renames and deleted file hashes
   */
  private detectRename(contentHash: string): string | null {
    // First check time-based rename detection (for quick renames)
    const recentPath = this.recentRenames.get(contentHash);

    if (recentPath) {
      // Remove from recent renames to prevent duplicate detection
      this.recentRenames.delete(contentHash);
      return recentPath;
    }

    // Then check deleted file hashes (for cross-directory moves)
    const deletedPath = this.deletedFileHashes.get(contentHash);

    if (deletedPath) {
      // Remove from deleted hashes to prevent duplicate detection
      this.deletedFileHashes.delete(contentHash);
      return deletedPath;
    }

    return null;
  }

  /**
   * Track file hash for rename detection
   */
  private trackHash(contentHash: string, filePath: string): void {
    this.fileHashes.set(filePath, contentHash);

    // Add to recent renames map with expiration
    this.recentRenames.set(contentHash, filePath);

    setTimeout(() => {
      this.recentRenames.delete(contentHash);
    }, this.renameWindow);
  }

  /**
   * Analyze file dependencies (imports/requires)
   */
  private async analyzeDependencies(changeSet: ChangeSet): Promise<void> {
    // For now, basic implementation - can be enhanced later
    // This would parse import statements to build dependency graph

    const allFiles = [
      ...changeSet.added,
      ...changeSet.modified,
      ...changeSet.renamed.map((r) => r.to),
    ];

    for (const file of allFiles) {
      try {
        const deps = await this.extractDependencies(file);
        if (deps.length > 0) {
          changeSet.dependencies.set(file, new Set(deps));
        }
      } catch (error) {
        logger.debug("Failed to extract dependencies", { file, error });
      }
    }
  }

  /**
   * Extract dependencies from a file
   */
  private async extractDependencies(filePath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const ext = extname(filePath);
      const dependencies: string[] = [];

      if (ext === ".ts" || ext === ".js") {
        // Match import statements
        const importRegex = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g;
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;

        let match;
        while ((match = importRegex.exec(content)) !== null) {
          if (match[1]) {
            dependencies.push(match[1]);
          }
        }
        while ((match = requireRegex.exec(content)) !== null) {
          if (match[1]) {
            dependencies.push(match[1]);
          }
        }
      } else if (ext === ".py") {
        // Match Python imports
        const importRegex = /(?:from\s+([^\s]+)\s+)?import\s+([^\s]+)/g;

        let match;
        while ((match = importRegex.exec(content)) !== null) {
          const dep = match[1] || match[2];
          if (dep) {
            dependencies.push(dep);
          }
        }
      }

      return dependencies;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Add dependent files to the processing list
   */
  private addDependentFiles(
    files: string[],
    dependencies: Map<string, Set<string>>,
  ): string[] {
    const result = new Set(files);

    for (const [file, deps] of dependencies.entries()) {
      if (result.has(file)) {
        // Add all dependencies
        for (const dep of deps) {
          result.add(dep);
        }
      }
    }

    return Array.from(result);
  }

  /**
   * Create batches from file list
   */
  private createBatches(files: string[], batchSize: number): string[][] {
    const batches: string[][] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      trackedHashes: this.fileHashes.size,
      recentRenames: this.recentRenames.size,
    };
  }
}
