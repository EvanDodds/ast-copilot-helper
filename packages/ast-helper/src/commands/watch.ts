/**
 * Watch Command Implementation
 * Implements file system watching with automatic parsing and annotation of changed files
 */

import { EventEmitter } from "node:events";
import { createLogger } from "../logging/index.js";
import { createFileWatcher } from "../filesystem/file-watcher.js";
import type {
  FileWatcher,
  FileWatchConfig,
  FileChangeEvent,
} from "../filesystem/types.js";
import type { Config } from "../types.js";
import { ParseCommand } from "./parse.js";
import { AnnotateCommandHandler } from "./annotate.js";
import { EmbedCommand } from "./embed.js";

/**
 * Watch command options interface
 */
export interface WatchCommandOptions {
  glob?: string;
  debounce?: number;
  includeAnnotation?: boolean;
  batchSize?: number;
  maxBatchSize?: number;
  batch?: boolean;
  recursive?: boolean;
  followSymlinks?: boolean;
}

/**
 * File change processing result
 */
export interface WatchProcessingResult {
  processedFiles: number;
  errors: string[];
  processingTime: number;
  timestamp: Date;
}

/**
 * Watch command implementation
 * Provides real-time file system monitoring with automatic AST parsing and annotation
 */
export class WatchCommand extends EventEmitter {
  private logger = createLogger({ operation: "watch-command" });
  private fileWatcher: FileWatcher | null = null;
  private parseCommand: ParseCommand;
  private annotateHandler?: AnnotateCommandHandler;
  private embedCommand?: EmbedCommand;
  private config: Config;
  private options: WatchCommandOptions;
  private isRunning = false;
  private processedFiles = 0;
  private errors: string[] = [];
  private pendingChanges = new Map<string, FileChangeEvent>();
  private processingTimer: NodeJS.Timeout | null = null;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private stats = {
    peakMemoryMB: 0,
    totalProcessingTime: 0,
    sessionStartTime: Date.now(),
  };
  private fileModificationTimes = new Map<string, number>();
  private restartAttempts = 0;
  private readonly maxRestartAttempts = 5;

  constructor(config: Config, options: WatchCommandOptions) {
    super();
    this.config = config;
    this.options = options;
    this.parseCommand = new ParseCommand();

    if (options.includeAnnotation) {
      this.annotateHandler = new AnnotateCommandHandler();
      // Always enable embedding when annotation is enabled for complete pipeline
      this.embedCommand = new EmbedCommand(config, this.logger);
    }
  }

  /**
   * Start the file watching system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Watch command is already running");
      return;
    }

    try {
      this.logger.info("Starting watch command", {
        glob: this.options.glob || this.config.watchGlob,
        debounce: this.options.debounce || 200,
        includeAnnotation: this.options.includeAnnotation,
      });

      // Create file watcher configuration
      const watchPaths = [process.cwd()];
      const watchConfig: FileWatchConfig = {
        watchPaths,
        includePatterns: this.options.glob
          ? [this.options.glob]
          : this.config.watchGlob || ["**/*.{js,ts,py}"],
        excludePatterns: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.astdb/**",
          "**/dist/**",
          "**/build/**",
          "**/*.min.js",
        ],
        enableRecursive: this.options.recursive !== false,
        debounceMs: this.options.debounce || 200,
        batchSize: Math.min(
          this.options.batchSize || 50,
          this.options.maxBatchSize || 200,
        ),
        followSymlinks: this.options.followSymlinks || false,
      };

      // Initialize file watcher
      this.fileWatcher = createFileWatcher();
      await this.fileWatcher.initialize(watchConfig);

      // Set up event handlers
      this.setupFileWatcherEvents();

      // Start watching
      await this.fileWatcher.start();
      this.isRunning = true;

      // Start memory monitoring for long-running sessions
      this.startMemoryMonitoring();

      // Reset restart attempts on successful start
      this.restartAttempts = 0;

      this.logger.info("File watcher started successfully", {
        watchPaths,
        patterns: watchConfig.includePatterns,
      });

      this.emit("started");

      // Keep the process alive
      process.on("SIGINT", this.stop.bind(this));
      process.on("SIGTERM", this.stop.bind(this));
    } catch (error) {
      this.logger.error("Failed to start watch command", { error });
      throw error;
    }
  }

  /**
   * Stop the file watching system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info("Stopping watch command");

    try {
      // Clear any pending processing
      if (this.processingTimer) {
        clearTimeout(this.processingTimer);
        this.processingTimer = null;
      }

      // Stop memory monitoring
      if (this.memoryCheckInterval) {
        clearInterval(this.memoryCheckInterval);
        this.memoryCheckInterval = null;
      }

      // Process any remaining changes
      if (this.pendingChanges.size > 0) {
        await this.processChanges();
      }

      // Stop file watcher
      if (this.fileWatcher) {
        await this.fileWatcher.stop();
        this.fileWatcher = null;
      }

      this.isRunning = false;
      this.emit("stopped");

      this.logger.info("Watch command stopped", {
        processedFiles: this.processedFiles,
        errors: this.errors.length,
      });
    } catch (error) {
      this.logger.error("Error stopping watch command", { error });
      throw error;
    }
  }

  /**
   * Get current watch statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      processedFiles: this.processedFiles,
      errors: this.errors.length,
      pendingChanges: this.pendingChanges.size,
      watcherStats: this.fileWatcher?.getWatchStats() || null,
    };
  }

  /**
   * Clean up database entries for deleted files
   */
  private async cleanupDeletedFiles(deletedFiles: string[]): Promise<void> {
    const { ASTDatabaseManager } = await import("../database/manager.js");
    const { join, resolve } = await import("node:path");
    const { readdir, unlink, access } = await import("node:fs/promises");
    const { constants } = await import("node:fs");

    try {
      // Initialize database managers
      const workspacePath = this.config.outputDir || process.cwd();
      const dbManager = new ASTDatabaseManager(workspacePath);

      const structure = dbManager.getDatabaseStructure();

      for (const deletedFile of deletedFiles) {
        const relativePath = resolve(deletedFile).replace(
          resolve(workspacePath) + "/",
          "",
        );

        this.logger.debug("Cleaning up database entries for deleted file", {
          file: deletedFile,
          relativePath,
        });

        // Clean up AST files
        const astDir = structure.asts;
        const astFileName = relativePath.replace(/[/\\]/g, "_") + ".json";
        const astFilePath = join(astDir, astFileName);

        try {
          await access(astFilePath, constants.F_OK);
          await unlink(astFilePath);
          this.logger.debug("Removed AST file", { path: astFilePath });
        } catch {
          // File doesn't exist, that's ok
        }

        // Clean up annotation files
        const annotDir = structure.annots;
        const annotFileName = relativePath.replace(/[/\\]/g, "_") + ".json";
        const annotFilePath = join(annotDir, annotFileName);

        try {
          await access(annotFilePath, constants.F_OK);
          await unlink(annotFilePath);
          this.logger.debug("Removed annotation file", { path: annotFilePath });
        } catch {
          // File doesn't exist, that's ok
        }

        // Clean up embedding files (this is more complex as embeddings are stored by timestamp)
        try {
          const embeddingsPath = join(dbManager.astdbPath, "embeddings");
          const files = await readdir(embeddingsPath).catch(() => []);

          // Look for embedding files that reference this file path
          const embeddingFiles = files.filter(
            (f) => f.startsWith("embeddings-") && f.endsWith(".json"),
          );

          for (const embeddingFile of embeddingFiles) {
            const { readFile } = await import("node:fs/promises");
            try {
              const embeddingData = JSON.parse(
                await readFile(join(embeddingsPath, embeddingFile), "utf-8"),
              );

              // Filter out embeddings for the deleted file
              const filteredEmbeddings = embeddingData.filter(
                (embedding: { inputText?: string; nodeId?: string }) => {
                  return (
                    !embedding.inputText?.includes(relativePath) &&
                    !embedding.nodeId?.includes(relativePath)
                  );
                },
              );

              // If embeddings were removed, update the file
              if (filteredEmbeddings.length !== embeddingData.length) {
                const { writeFile } = await import("node:fs/promises");
                await writeFile(
                  join(embeddingsPath, embeddingFile),
                  JSON.stringify(filteredEmbeddings, null, 2),
                );
                this.logger.debug(
                  "Updated embedding file, removed entries for deleted file",
                  {
                    embeddingFile,
                    removedCount:
                      embeddingData.length - filteredEmbeddings.length,
                  },
                );
              }
            } catch (error) {
              this.logger.warn("Failed to clean embedding file", {
                file: embeddingFile,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        } catch (error) {
          this.logger.warn("Failed to clean embeddings for deleted file", {
            file: deletedFile,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      this.logger.error("Failed to cleanup deleted files from database", {
        error: error instanceof Error ? error.message : String(error),
        files: deletedFiles,
      });
      throw error;
    }
  }

  /**
   * Set up file watcher event handlers
   */
  private setupFileWatcherEvents(): void {
    if (!this.fileWatcher) {
      return;
    }

    // FileWatcher interface doesn't extend EventEmitter, so we assume it has event methods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const watcherEmitter = this.fileWatcher as any;
    watcherEmitter.on("fileChange", this.handleFileChange.bind(this));
    watcherEmitter.on("error", this.handleWatchError.bind(this));
    watcherEmitter.on("ready", () => {
      this.logger.info("File watcher is ready and monitoring for changes");
    });
  }

  /**
   * Handle individual file change events
   */
  private handleFileChange(event: FileChangeEvent): void {
    this.logger.debug("File change detected", {
      path: event.filePath,
      type: event.type,
      stats: event.stats
        ? { size: event.stats.size, mtime: event.stats.mtime }
        : null,
    });

    // Track modification times for delta updates
    if (event.stats?.mtime) {
      const currentModTime = this.fileModificationTimes.get(event.filePath);
      const newModTime = event.stats.mtime.getTime();

      // Only process if file has actually changed (avoid duplicate processing)
      if (currentModTime && currentModTime >= newModTime) {
        this.logger.debug("Skipping file - not actually modified", {
          path: event.filePath,
          currentModTime: new Date(currentModTime),
          newModTime: event.stats.mtime,
        });
        return;
      }

      this.fileModificationTimes.set(event.filePath, newModTime);
    }

    // Add to pending changes (debouncing)
    this.pendingChanges.set(event.filePath, event);

    // Clear existing timer and set new one
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }

    this.processingTimer = setTimeout(async () => {
      await this.processChanges();
    }, this.options.debounce || 200);
  }

  /**
   * Handle file watcher errors
   */
  private handleWatchError(error: Error): void {
    this.logger.error("File watcher error", { error });
    this.errors.push(error.message);
    this.emit("error", error);

    // Consider restarting the watcher for certain types of errors
    if (error.message.includes("ENOSPC") || error.message.includes("EMFILE")) {
      this.logger.warn("Resource limit error detected", {
        error: error.message,
        restartAttempts: this.restartAttempts,
        maxRestartAttempts: this.maxRestartAttempts,
      });

      if (this.restartAttempts < this.maxRestartAttempts) {
        this.restartAttempts++;
        this.logger.info("Attempting to restart watcher", {
          attempt: this.restartAttempts,
        });

        // Stop current watcher and restart after delay
        this.stop();
        setTimeout(() => {
          this.start().catch((restartError) => {
            this.logger.error("Failed to restart watcher", restartError);
          });
        }, 2000 * this.restartAttempts); // Exponential backoff
      } else {
        this.logger.warn("Maximum restart attempts reached, stopping watcher");
        this.stop();
      }
    }
  }

  /**
   * Process all pending file changes
   */
  private async processChanges(): Promise<void> {
    if (this.pendingChanges.size === 0) {
      return;
    }

    const startTime = Date.now();
    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();

    this.logger.info("Processing file changes", {
      changeCount: changes.length,
      files: changes.map((c) => ({ path: c.filePath, type: c.type })),
    });

    try {
      // Group changes by type
      const changedFiles = changes
        .filter((c) => c.type === "change" || c.type === "add")
        .map((c) => c.filePath);

      const deletedFiles = changes
        .filter((c) => c.type === "unlink")
        .map((c) => c.filePath);
      let processedCount = 0;
      const processingErrors: string[] = [];

      // Process changed/added files
      if (changedFiles.length > 0) {
        try {
          this.logger.info("Parsing changed files", {
            fileCount: changedFiles.length,
          });

          const effectiveBatchSize = Math.min(
            this.options.batchSize || 50,
            this.options.maxBatchSize || 200,
          );

          // Use parse command to process files
          await this.parseCommand.execute(
            {
              glob: changedFiles.join(","),
              force: true,
              batchSize: effectiveBatchSize,
            },
            this.config,
          );

          processedCount += changedFiles.length;

          // Run annotation if enabled
          if (this.annotateHandler && processedCount > 0) {
            this.logger.info("Annotating parsed files");
            await this.annotateHandler.execute(
              {
                force: true,
                batchSize: effectiveBatchSize,
              },
              this.config,
            );

            // Run embedding after successful annotation for complete pipeline
            if (this.embedCommand) {
              this.logger.info("Generating embeddings for annotated files");
              await this.embedCommand.execute({
                force: true,
                batchSize: effectiveBatchSize,
                verbose: false, // Keep quiet for watch mode
              });
            }
          }
        } catch (error) {
          const errorMsg = `Failed to process changed files: ${error instanceof Error ? error.message : String(error)}`;
          processingErrors.push(errorMsg);
          this.logger.error(errorMsg, { error, files: changedFiles });
        }
      }

      // Handle deleted files (remove from database)
      if (deletedFiles.length > 0) {
        this.logger.info("Handling deleted files", {
          fileCount: deletedFiles.length,
        });

        try {
          await this.cleanupDeletedFiles(deletedFiles);

          // Clean up modification time tracking for deleted files
          deletedFiles.forEach((filePath) => {
            this.fileModificationTimes.delete(filePath);
          });

          this.logger.info(
            "Successfully cleaned up database entries for deleted files",
            {
              cleanedFiles: deletedFiles.length,
            },
          );
        } catch (error) {
          const errorMsg = `Failed to cleanup deleted files from database: ${error instanceof Error ? error.message : String(error)}`;
          processingErrors.push(errorMsg);
          this.logger.error(errorMsg, { error, files: deletedFiles });
        }
      }

      const processingTime = Date.now() - startTime;
      this.processedFiles += processedCount;
      this.errors.push(...processingErrors);
      this.stats.totalProcessingTime += processingTime;

      const result: WatchProcessingResult = {
        processedFiles: processedCount,
        errors: processingErrors,
        processingTime,
        timestamp: new Date(),
      };

      this.logger.info("File changes processed", {
        processedFiles: processedCount,
        errors: processingErrors.length,
        processingTime,
        totalProcessed: this.processedFiles,
      });

      this.emit("processed", result);
    } catch (error) {
      const errorMsg = `Failed to process file changes: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMsg, { error });
      this.errors.push(errorMsg);
      this.emit("error", error);
    }
  }

  /**
   * Start memory monitoring for long-running watch sessions
   */
  private startMemoryMonitoring(): void {
    // Check memory usage every 30 seconds
    this.memoryCheckInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

      if (memoryMB > this.stats.peakMemoryMB) {
        this.stats.peakMemoryMB = memoryMB;
      }

      // Log memory warnings if usage is high
      if (memoryMB > 512) {
        this.logger.warn("High memory usage detected", {
          currentMemoryMB: memoryMB,
          peakMemoryMB: this.stats.peakMemoryMB,
          sessionDurationMin: Math.round((Date.now() - this.startTime) / 60000),
        });

        // Suggest garbage collection if memory is very high
        if (memoryMB > 1024 && global.gc) {
          this.logger.info("Running garbage collection to free memory");
          global.gc();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get enhanced statistics including memory and session info
   */
  getEnhancedStats() {
    const sessionDurationMs = Date.now() - this.startTime;
    return {
      ...this.getStats(),
      sessionDurationMs,
      sessionDurationMin: Math.round(sessionDurationMs / 60000),
      peakMemoryMB: this.stats.peakMemoryMB,
      totalProcessingTime: this.stats.totalProcessingTime,
      averageProcessingTimePerFile:
        this.processedFiles > 0
          ? Math.round(this.stats.totalProcessingTime / this.processedFiles)
          : 0,
    };
  }
}

/**
 * Watch command handler for CLI integration
 */
export class WatchCommandHandler {
  private watchCommand: WatchCommand | null = null;

  async execute(options: WatchCommandOptions, config: Config): Promise<void> {
    const logger = createLogger({ operation: "watch-handler" });

    try {
      logger.info("Starting watch command", {
        options,
      });

      // Create and start watch command
      this.watchCommand = new WatchCommand(config, options);

      // Set up event handlers
      this.watchCommand.on("started", () => {
        logger.info("🔍 Watching for file changes...");
        logger.info("   Press Ctrl+C to stop watching");
      });

      this.watchCommand.on("processed", (result: WatchProcessingResult) => {
        if (result.processedFiles > 0) {
          logger.info(
            `✅ Processed ${result.processedFiles} files in ${result.processingTime}ms`,
          );
        }
        if (result.errors.length > 0) {
          logger.warn(`❌ ${result.errors.length} errors encountered:`);
          result.errors.forEach((error) => logger.error(`   ${error}`));
        }
      });

      this.watchCommand.on("error", (error: Error) => {
        logger.error(`❌ Watch error: ${error.message}`);
      });

      this.watchCommand.on("stopped", () => {
        const stats = this.watchCommand?.getEnhancedStats();
        logger.info("\n📊 Watch session summary:");
        logger.info(`   Files processed: ${stats?.processedFiles || 0}`);
        logger.info(
          `   Session duration: ${stats?.sessionDurationMin || 0} minutes`,
        );
        logger.info(`   Peak memory usage: ${stats?.peakMemoryMB || 0} MB`);
        logger.info(
          `   Total processing time: ${Math.round((stats?.totalProcessingTime || 0) / 1000)}s`,
        );
        logger.info(
          `   Average time per file: ${stats?.averageProcessingTimePerFile || 0}ms`,
        );
        logger.info(`   Errors: ${stats?.errors || 0}`);
        logger.info("👋 Watch stopped");
        process.exit(0);
      });

      // Start watching
      await this.watchCommand.start();

      // Keep process alive until stopped
      await new Promise<void>((resolve) => {
        this.watchCommand?.on("stopped", resolve);
      });
    } catch (error) {
      logger.error("Watch command failed", { error });
      throw error;
    }
  }

  /**
   * Stop the watch command
   */
  async stop(): Promise<void> {
    if (this.watchCommand) {
      await this.watchCommand.stop();
      this.watchCommand = null;
    }
  }
}
