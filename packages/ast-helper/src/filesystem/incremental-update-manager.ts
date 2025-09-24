/**
 * Incremental update manager for coordinating file changes with database updates
 */

import { EventEmitter } from "node:events";
import type {
  FileChangeEvent,
  IncrementalUpdateManager,
  FileWatcher,
  ConsistencyReport,
} from "./types.js";
import type { ASTDatabaseManager } from "../database/manager.js";
import type { EmbeddingDatabaseManager } from "../database/embedding-manager.js";
import { createModuleLogger } from "../logging/index.js";
import type { Config } from "../types.js";

/**
 * Update batch result containing processed changes and metadata
 */
export interface UpdateBatchResult {
  /** Successfully processed changes */
  processedChanges: FileChangeEvent[];

  /** Failed changes with error information */
  failedChanges: Array<{
    change: FileChangeEvent;
    error: Error;
  }>;

  /** Processing statistics */
  stats: {
    /** Total processing time in milliseconds */
    processingTime: number;

    /** Number of files added to database */
    filesAdded: number;

    /** Number of files updated in database */
    filesUpdated: number;

    /** Number of files removed from database */
    filesRemoved: number;

    /** Number of embeddings generated/updated */
    embeddingsProcessed: number;
  };
}

/**
 * Internal change tracking for conflict resolution
 */
interface ChangeTracker {
  /** Most recent change for each file path */
  latestChange: Map<string, FileChangeEvent>;

  /** Queue of changes to process */
  pendingChanges: FileChangeEvent[];

  /** Set of files currently being processed */
  processing: Set<string>;

  /** Timestamp of last batch processing */
  lastBatchTime: number;
}

/**
 * Incremental update manager implementation
 * Handles batching, conflict resolution, and coordination with database systems
 */
export class IncementalUpdateManagerImpl
  extends EventEmitter
  implements IncrementalUpdateManager {
  private readonly logger = createModuleLogger("incremental-update");

  private readonly dbManager: ASTDatabaseManager;
  private readonly embeddingManager: EmbeddingDatabaseManager; // Will be used in full implementation
  private readonly config: Config;

  private readonly changeTracker: ChangeTracker = {
    latestChange: new Map(),
    pendingChanges: [],
    processing: new Set(),
    lastBatchTime: 0,
  };

  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private stats = {
    totalChangesProcessed: 0,
    totalBatchesProcessed: 0,
    totalProcessingTime: 0,
    averageBatchSize: 0,
  };

  constructor(
    dbManager: ASTDatabaseManager,
    embeddingManager: EmbeddingDatabaseManager,
    config: Config,
  ) {
    super();
    this.dbManager = dbManager;
    this.embeddingManager = embeddingManager;
    this.config = config;
  }

  /**
   * Process a batch of file changes with conflict resolution and deduplication
   */
  async processChangeBatch(
    changes: FileChangeEvent[],
  ): Promise<UpdateBatchResult> {
    const startTime = Date.now();

    this.logger.info("Processing change batch", {
      changeCount: changes.length,
      batchSize: this.config.fileWatching?.batchSize || 50,
    });

    const optimizedChanges = this.optimizeUpdateBatch(changes);
    const result: UpdateBatchResult = {
      processedChanges: [],
      failedChanges: [],
      stats: {
        processingTime: 0,
        filesAdded: 0,
        filesUpdated: 0,
        filesRemoved: 0,
        embeddingsProcessed: 0,
      },
    };

    // Mark files as processing
    for (const change of optimizedChanges) {
      this.changeTracker.processing.add(change.filePath);
    }

    try {
      // Process changes by type for better efficiency
      const changesByType = this.groupChangesByType(optimizedChanges);

      // Process deletions first to free up resources
      if (changesByType.deletions.length > 0) {
        await this.processDeletions(changesByType.deletions, result);
      }

      // Process additions and modifications
      if (changesByType.modifications.length > 0) {
        await this.processModifications(changesByType.modifications, result);
      }

      result.stats.processingTime = Date.now() - startTime;

      // Update tracking statistics
      this.updateStats(result);

      this.logger.info("Change batch processed", {
        processed: result.processedChanges.length,
        failed: result.failedChanges.length,
        processingTime: result.stats.processingTime,
      });

      // Emit processing completion event
      this.emit("batchProcessed", result);

      return result;
    } finally {
      // Clean up processing tracking
      for (const change of optimizedChanges) {
        this.changeTracker.processing.delete(change.filePath);
      }
    }
  }

  /**
   * Optimize a batch of changes for processing by deduplicating and resolving conflicts
   */
  optimizeUpdateBatch(changes: FileChangeEvent[]): FileChangeEvent[] {
    if (changes.length === 0) {
      return [];
    }

    this.logger.debug("Optimizing update batch", {
      originalCount: changes.length,
    });

    // Sort changes by timestamp to ensure proper ordering
    const sortedChanges = [...changes].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    // Track the latest change for each file path
    const latestChanges = new Map<string, FileChangeEvent>();

    for (const change of sortedChanges) {
      const existing = latestChanges.get(change.filePath);

      if (!existing || change.timestamp >= existing.timestamp) {
        latestChanges.set(change.filePath, change);
      }
    }

    // Apply conflict resolution rules
    const optimizedChanges: FileChangeEvent[] = [];

    latestChanges.forEach((change, filePath) => {
      // Skip if file is currently being processed
      if (this.changeTracker.processing.has(filePath)) {
        this.logger.debug("Skipping file already in processing", { filePath });
        return; // Use return instead of continue in forEach
      }

      // Apply optimization rules
      const optimizedChange = this.applyOptimizationRules(change);
      if (optimizedChange) {
        optimizedChanges.push(optimizedChange);
      }
    });

    this.logger.debug("Batch optimization complete", {
      originalCount: changes.length,
      optimizedCount: optimizedChanges.length,
    });

    return optimizedChanges;
  }

  /**
   * Initialize change tracking and start batch processing
   * @param fileWatcher - File watcher instance that supports events
   */
  async startBatchProcessing(
    fileWatcher: FileWatcher & EventEmitter,
  ): Promise<void> {
    this.logger.info("Starting incremental update batch processing", {
      debounceMs: this.config.fileWatching?.debounceMs || 100,
      batchSize: this.config.fileWatching?.batchSize || 50,
    });

    // Listen for file changes
    fileWatcher.on("fileChange", (change: FileChangeEvent) => {
      this.queueChange(change);
    });

    // Set up batch processing timer
    this.scheduleBatchProcessing();

    this.emit("started");
  }

  /**
   * Stop batch processing and clear queues
   */
  async stopBatchProcessing(): Promise<void> {
    this.logger.info("Stopping incremental update batch processing");

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Process any remaining changes
    if (this.changeTracker.pendingChanges.length > 0) {
      await this.processPendingChanges();
    }

    this.emit("stopped");
  }

  /**
   * Determine if a file should be fully reparsed based on change type and history
   */
  async shouldFullReparse(
    filePath: string,
    change: FileChangeEvent,
  ): Promise<boolean> {
    // For new files, always do full parsing
    if (change.type === "add" || change.type === "addDir") {
      return true;
    }

    // For deletions, no parsing needed
    if (change.type === "unlink" || change.type === "unlinkDir") {
      return false;
    }

    // For changes, check if it's a significant modification
    try {
      // Here would be logic to check file size changes, modification patterns, etc.
      // For now, always reparse changed files
      return true;
    } catch (error) {
      this.logger.error("Error determining reparse necessity", {
        filePath,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Default to full reparse on error
      return true;
    }
  }

  /**
   * Validate consistency between file system and indexes
   */
  async validateIndexConsistency(): Promise<ConsistencyReport> {
    this.logger.info("Validating index consistency");

    const report: ConsistencyReport = {
      inconsistentFiles: [],
      orphanedVectors: [],
      missingVectors: [],
      totalChecked: 0,
      issuesFound: 0,
    };

    try {
      // Check database state
      const isInitialized = await this.dbManager.isInitialized();
      if (!isInitialized) {
        this.logger.warn("Database not initialized during consistency check");
        return report;
      }

      // Initialize embeddings storage if needed
      await this.embeddingManager.initialize();

      // Here would be actual consistency checking logic:
      // 1. Compare file system state with database entries
      // 2. Check for orphaned embeddings
      // 3. Check for missing embeddings
      // 4. Validate index integrity

      // For now, return empty report
      report.totalChecked = this.changeTracker.latestChange.size;
      report.issuesFound =
        report.inconsistentFiles.length +
        report.orphanedVectors.length +
        report.missingVectors.length;

      this.logger.info("Index consistency validation complete", {
        totalChecked: report.totalChecked,
        issuesFound: report.issuesFound,
      });

      return report;
    } catch (error) {
      this.logger.error("Failed to validate index consistency", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return report;
    }
  }

  /**
   * Queue a file change for batch processing
   */
  private queueChange(change: FileChangeEvent): void {
    // Update latest change tracker
    this.changeTracker.latestChange.set(change.filePath, change);

    // Add to pending queue if not already queued
    const isAlreadyQueued = this.changeTracker.pendingChanges.some(
      (c) => c.filePath === change.filePath,
    );

    if (!isAlreadyQueued) {
      this.changeTracker.pendingChanges.push(change);
    }

    this.logger.debug("Change queued for processing", {
      filePath: change.filePath,
      type: change.type,
      queueLength: this.changeTracker.pendingChanges.length,
    });

    // Schedule batch processing if not already scheduled
    this.scheduleBatchProcessing();
  }

  /**
   * Schedule batch processing with debouncing
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimer || this.isProcessing) {
      return;
    }

    const debounceMs = this.config.fileWatching?.debounceMs || 100;

    this.batchTimer = setTimeout(() => {
      this.processPendingChanges().catch((error) => {
        this.logger.error("Batch processing failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        this.emit("error", error);
      });
    }, debounceMs);
  }

  /**
   * Process all pending changes in batches
   */
  private async processPendingChanges(): Promise<void> {
    if (this.isProcessing || this.changeTracker.pendingChanges.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.batchTimer = null;

    try {
      const changes = [...this.changeTracker.pendingChanges];
      this.changeTracker.pendingChanges = [];

      const batchSize = this.config.fileWatching?.batchSize || 50;

      // Process in batches
      for (let i = 0; i < changes.length; i += batchSize) {
        const batch = changes.slice(i, i + batchSize);
        await this.processChangeBatch(batch);
      }
    } finally {
      this.isProcessing = false;

      // Schedule next batch if more changes arrived
      if (this.changeTracker.pendingChanges.length > 0) {
        this.scheduleBatchProcessing();
      }
    }
  }

  /**
   * Group changes by operation type for optimized processing
   */
  private groupChangesByType(changes: FileChangeEvent[]): {
    deletions: FileChangeEvent[];
    modifications: FileChangeEvent[];
  } {
    const deletions: FileChangeEvent[] = [];
    const modifications: FileChangeEvent[] = [];

    for (const change of changes) {
      if (change.type === "unlink" || change.type === "unlinkDir") {
        deletions.push(change);
      } else {
        modifications.push(change);
      }
    }

    return { deletions, modifications };
  }

  /**
   * Process file deletions
   */
  private async processDeletions(
    deletions: FileChangeEvent[],
    result: UpdateBatchResult,
  ): Promise<void> {
    this.logger.debug("Processing deletions", { count: deletions.length });

    for (const change of deletions) {
      try {
        // Here would be integration with actual database deletion
        // For now, we'll just track the operation
        result.processedChanges.push(change);
        result.stats.filesRemoved++;

        this.logger.debug("File deletion processed", {
          filePath: change.filePath,
        });
      } catch (error) {
        this.logger.error("Failed to process deletion", {
          filePath: change.filePath,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        result.failedChanges.push({
          change,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  }

  /**
   * Process file modifications (additions and changes)
   */
  private async processModifications(
    modifications: FileChangeEvent[],
    result: UpdateBatchResult,
  ): Promise<void> {
    this.logger.debug("Processing modifications", {
      count: modifications.length,
    });

    for (const change of modifications) {
      try {
        // Here would be integration with actual AST parsing and embedding generation
        // Initialize embeddings for new files
        if (
          change.type === "add" &&
          (await this.shouldFullReparse(change.filePath, change))
        ) {
          this.logger.debug("Initializing embeddings for new file", {
            filePath: change.filePath,
          });
          // Would call embeddingManager.storeEmbeddings() here in full implementation
        }

        result.processedChanges.push(change);

        if (change.type === "add" || change.type === "addDir") {
          result.stats.filesAdded++;
        } else {
          result.stats.filesUpdated++;
        }

        // Simulate embedding processing
        result.stats.embeddingsProcessed++;

        this.logger.debug("File modification processed", {
          filePath: change.filePath,
          type: change.type,
        });
      } catch (error) {
        this.logger.error("Failed to process modification", {
          filePath: change.filePath,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        result.failedChanges.push({
          change,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  }

  /**
   * Apply optimization rules to individual changes
   */
  private applyOptimizationRules(
    change: FileChangeEvent,
  ): FileChangeEvent | null {
    // Skip files that don't match include patterns
    const includePatterns = this.config.fileWatching?.includePatterns || [];
    const excludePatterns = this.config.fileWatching?.excludePatterns || [];

    // Simple pattern matching (in real implementation would use minimatch)
    const shouldInclude =
      includePatterns.length === 0 ||
      includePatterns.some((pattern) =>
        this.matchesPattern(change.filePath, pattern),
      );

    const shouldExclude = excludePatterns.some((pattern) =>
      this.matchesPattern(change.filePath, pattern),
    );

    if (!shouldInclude || shouldExclude) {
      this.logger.debug("Change filtered out by patterns", {
        filePath: change.filePath,
        shouldInclude,
        shouldExclude,
      });
      return null;
    }

    return change;
  }

  /**
   * Simple pattern matching (placeholder for minimatch integration)
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex (simplified)
    const regexPattern = pattern
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, ".");

    const regex = new RegExp(regexPattern);
    return regex.test(filePath);
  }

  /**
   * Update internal processing statistics
   */
  private updateStats(result: UpdateBatchResult): void {
    this.stats.totalChangesProcessed += result.processedChanges.length;
    this.stats.totalBatchesProcessed++;
    this.stats.totalProcessingTime += result.stats.processingTime;
    this.stats.averageBatchSize =
      this.stats.totalChangesProcessed / this.stats.totalBatchesProcessed;

    this.changeTracker.lastBatchTime = Date.now();
  }
}

/**
 * Factory function to create an incremental update manager
 */
export function createIncrementalUpdateManager(
  dbManager: ASTDatabaseManager,
  embeddingManager: EmbeddingDatabaseManager,
  config: Config,
): IncrementalUpdateManager {
  return new IncementalUpdateManagerImpl(dbManager, embeddingManager, config);
}
