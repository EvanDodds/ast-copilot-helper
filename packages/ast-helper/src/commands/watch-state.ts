/**
 * Watch Command State Management
 *
 * Provides persistent state tracking for file watching,
 * enabling intelligent incremental updates and crash recovery.
 *
 * Implements Issue #159 acceptance criteria:
 * - Persistent watch state across sessions
 * - File hash tracking for content change detection
 * - Statistics and performance metrics
 * - Crash recovery capabilities
 */

import { promises as fs } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { createModuleLogger } from "../logging/index.js";

const logger = createModuleLogger("WatchState");

/**
 * File state information
 */
export interface FileState {
  /** Last modification timestamp */
  lastModified: number;

  /** SHA256 content hash */
  contentHash: string;

  /** Last successful processing timestamp */
  lastProcessed: number;

  /** Processing status */
  status: "pending" | "success" | "error" | "skipped";

  /** Error message if status is "error" */
  error?: string;

  /** Pipeline stages completed */
  stagesCompleted: {
    parsed: boolean;
    annotated: boolean;
    embedded: boolean;
  };
}

/**
 * Watch statistics
 */
export interface WatchStatistics {
  /** Total file changes detected */
  totalChanges: number;

  /** Total files processed successfully */
  filesProcessed: number;

  /** Total errors encountered */
  errors: number;

  /** Files skipped (unchanged content) */
  filesSkipped: number;

  /** Total processing time (ms) */
  totalProcessingTime: number;

  /** Average processing time per file (ms) */
  avgProcessingTime: number;
}

/**
 * Watch state data structure
 */
export interface WatchStateData {
  /** Last watch session start time */
  lastRun: string;

  /** Current session start time */
  sessionStart: string;

  /** Watch session ID */
  sessionId: string;

  /** File states indexed by file path */
  files: Record<string, FileState>;

  /** Statistics */
  statistics: WatchStatistics;

  /** Configuration snapshot */
  config: {
    glob: string[];
    debounce: number;
    batchSize: number;
  };
}

/**
 * Watch State Manager
 *
 * Manages persistent state for watch command
 */
export class WatchStateManager {
  private stateFile: string;
  private state: WatchStateData;
  private saveTimer: NodeJS.Timeout | null = null;
  private readonly saveInterval = 5000; // Save every 5 seconds
  private isDirty = false;

  constructor(stateDir = ".astdb") {
    this.stateFile = join(stateDir, "watch-state.json");
    this.state = this.createDefaultState();
  }

  /**
   * Initialize state manager and load existing state
   */
  async initialize(): Promise<void> {
    try {
      // Ensure state directory exists
      await fs.mkdir(join(this.stateFile, ".."), { recursive: true });

      // Try to load existing state
      try {
        const data = await fs.readFile(this.stateFile, "utf-8");
        const loaded = JSON.parse(data) as WatchStateData;

        // Validate loaded state
        if (this.isValidState(loaded)) {
          this.state = loaded;
          this.state.sessionStart = new Date().toISOString();
          this.state.sessionId = this.generateSessionId();

          logger.info("Watch state loaded", {
            filesTracked: Object.keys(this.state.files).length,
            lastRun: this.state.lastRun,
          });
        } else {
          logger.warn("Invalid state file, using default state");
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          logger.warn("Failed to load watch state, using default", { error });
        }
      }

      // Start auto-save timer
      this.startAutoSave();
    } catch (error) {
      logger.error("Failed to initialize watch state manager", { error });
      throw error;
    }
  }

  /**
   * Get file state
   */
  getFileState(filePath: string): FileState | null {
    return this.state.files[filePath] || null;
  }

  /**
   * Update file state
   */
  updateFileState(filePath: string, updates: Partial<FileState>): void {
    const existing = this.state.files[filePath];

    this.state.files[filePath] = {
      ...existing,
      ...updates,
      lastModified:
        updates.lastModified ?? existing?.lastModified ?? Date.now(),
      lastProcessed: Date.now(),
    } as FileState;

    this.isDirty = true;
  }

  /**
   * Remove file state (for deleted files)
   */
  removeFileState(filePath: string): void {
    if (this.state.files[filePath]) {
      delete this.state.files[filePath];
      this.isDirty = true;
    }
  }

  /**
   * Calculate file content hash
   */
  async calculateFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return createHash("sha256").update(content).digest("hex");
    } catch (error) {
      logger.warn("Failed to calculate file hash", { filePath, error });
      return "";
    }
  }

  /**
   * Check if file content has changed
   */
  async hasFileChanged(filePath: string): Promise<boolean> {
    const state = this.getFileState(filePath);
    if (!state) {
      return true; // New file, consider it changed
    }

    const currentHash = await this.calculateFileHash(filePath);
    return currentHash !== state.contentHash;
  }

  /**
   * Get files that need processing
   */
  async getFilesToProcess(
    files: string[],
  ): Promise<{ changed: string[]; unchanged: string[] }> {
    const changed: string[] = [];
    const unchanged: string[] = [];

    for (const file of files) {
      if (await this.hasFileChanged(file)) {
        changed.push(file);
      } else {
        unchanged.push(file);

        // Update statistics
        this.state.statistics.filesSkipped++;
        this.isDirty = true;
      }
    }

    logger.info("Files analyzed for changes", {
      total: files.length,
      changed: changed.length,
      unchanged: unchanged.length,
    });

    return { changed, unchanged };
  }

  /**
   * Record successful processing
   */
  async recordSuccess(
    filePath: string,
    stages: Partial<FileState["stagesCompleted"]>,
    processingTime: number,
  ): Promise<void> {
    const contentHash = await this.calculateFileHash(filePath);
    const existing = this.getFileState(filePath);

    this.updateFileState(filePath, {
      contentHash,
      status: "success",
      error: undefined,
      stagesCompleted: {
        parsed: stages.parsed ?? existing?.stagesCompleted.parsed ?? false,
        annotated:
          stages.annotated ?? existing?.stagesCompleted.annotated ?? false,
        embedded:
          stages.embedded ?? existing?.stagesCompleted.embedded ?? false,
      },
    });

    // Update statistics
    this.state.statistics.filesProcessed++;
    this.state.statistics.totalChanges++;
    this.state.statistics.totalProcessingTime += processingTime;
    this.state.statistics.avgProcessingTime =
      this.state.statistics.totalProcessingTime /
      this.state.statistics.filesProcessed;

    this.isDirty = true;
  }

  /**
   * Record processing error
   */
  async recordError(filePath: string, error: string): Promise<void> {
    const contentHash = await this.calculateFileHash(filePath);

    this.updateFileState(filePath, {
      contentHash,
      status: "error",
      error,
    });

    // Update statistics
    this.state.statistics.errors++;
    this.state.statistics.totalChanges++;

    this.isDirty = true;
  }

  /**
   * Get current statistics
   */
  getStatistics(): WatchStatistics {
    return { ...this.state.statistics };
  }

  /**
   * Get state summary
   */
  getSummary() {
    return {
      sessionId: this.state.sessionId,
      sessionStart: this.state.sessionStart,
      lastRun: this.state.lastRun,
      filesTracked: Object.keys(this.state.files).length,
      statistics: this.getStatistics(),
    };
  }

  /**
   * Clean up stale file states
   */
  async cleanup(activeFiles: string[]): Promise<number> {
    const activeSet = new Set(activeFiles);
    const staleFiles: string[] = [];

    for (const filePath of Object.keys(this.state.files)) {
      if (!activeSet.has(filePath)) {
        staleFiles.push(filePath);
      }
    }

    for (const filePath of staleFiles) {
      this.removeFileState(filePath);
    }

    if (staleFiles.length > 0) {
      logger.info("Cleaned up stale file states", {
        removed: staleFiles.length,
      });
    }

    return staleFiles.length;
  }

  /**
   * Save state to disk
   */
  async save(): Promise<void> {
    if (!this.isDirty) {
      return;
    }

    try {
      this.state.lastRun = new Date().toISOString();

      const data = JSON.stringify(this.state, null, 2);
      await fs.writeFile(this.stateFile, data, "utf-8");

      this.isDirty = false;

      logger.debug("Watch state saved", {
        filesTracked: Object.keys(this.state.files).length,
      });
    } catch (error) {
      logger.error("Failed to save watch state", { error });
    }
  }

  /**
   * Shutdown state manager
   */
  async shutdown(): Promise<void> {
    // Stop auto-save timer
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }

    // Final save
    await this.save();

    logger.info("Watch state manager shut down");
  }

  /**
   * Create default state
   */
  private createDefaultState(): WatchStateData {
    return {
      lastRun: new Date().toISOString(),
      sessionStart: new Date().toISOString(),
      sessionId: this.generateSessionId(),
      files: {},
      statistics: {
        totalChanges: 0,
        filesProcessed: 0,
        errors: 0,
        filesSkipped: 0,
        totalProcessingTime: 0,
        avgProcessingTime: 0,
      },
      config: {
        glob: [],
        debounce: 200,
        batchSize: 50,
      },
    };
  }

  /**
   * Validate loaded state structure
   */
  private isValidState(state: unknown): state is WatchStateData {
    if (!state || typeof state !== "object") {
      return false;
    }

    const s = state as Record<string, unknown>;
    return (
      typeof s.lastRun === "string" &&
      typeof s.files === "object" &&
      typeof s.statistics === "object"
    );
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.saveTimer = setInterval(() => {
      this.save().catch((error) => {
        logger.error("Auto-save failed", { error });
      });
    }, this.saveInterval);
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `watch-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
