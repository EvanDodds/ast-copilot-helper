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
import { EmbedCommand } from "./embed.js";
import type { WatchStateManager } from "./watch-state.js";
import type { IncrementalUpdateManager } from "./incremental-update.js";
import type { ChangeSet } from "./incremental-update.js";

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

  /** Enable full pipeline (parse → annotate → embed) */
  fullPipeline?: boolean;

  /** Disable embedding step (useful for faster parsing-only mode) */
  noEmbed?: boolean;

  /** Enable concurrent batch processing */
  concurrent?: boolean;

  /** Maximum concurrent batches (default: 2) */
  maxConcurrent?: number;

  /** Maximum batch processing delay in ms (default: 1000) */
  maxBatchDelay?: number;
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

  // Enhanced state management and incremental processing
  private stateManager: WatchStateManager;
  private incrementalManager: IncrementalUpdateManager;

  constructor(config: Config, options: WatchCommandOptions) {
    super();
    this.config = config;
    this.options = options;
    this.parseCommand = new ParseCommand();

    // Determine if embedding should be enabled based on options
    const enableEmbedding =
      (options.includeAnnotation || options.fullPipeline) && !options.noEmbed;

    if (enableEmbedding) {
      // Annotation is now handled by Rust CLI (ast-parser annotate)
      // Enable embedding for complete pipeline
      this.embedCommand = new EmbedCommand(config, this.logger);
    }

    // Initialize state management and incremental processing
    // Will be fully initialized in start() method
    this.stateManager = null as unknown as WatchStateManager;
    this.incrementalManager = null as unknown as IncrementalUpdateManager;
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
        fullPipeline: this.options.fullPipeline,
        noEmbed: this.options.noEmbed,
        concurrent: this.options.concurrent,
        pipelineStages: {
          parse: true,
          annotate: this.options.includeAnnotation || this.options.fullPipeline,
          embed: this.embedCommand !== undefined,
        },
      });

      // Initialize state manager and incremental update manager
      const { WatchStateManager: StateManager } = await import(
        "./watch-state.js"
      );
      const { IncrementalUpdateManager: UpdateManager } = await import(
        "./incremental-update.js"
      );

      const workspacePath = this.config.outputDir || process.cwd();
      this.stateManager = new StateManager(workspacePath);
      await this.stateManager.initialize();

      this.incrementalManager = new UpdateManager(this.stateManager);

      // Get file processing statistics
      const filesToProcess = await this.stateManager.getFilesToProcess([]);
      this.logger.info("Initialized state management for watch session", {
        workspacePath,
        changedFiles: filesToProcess.changed.length,
        unchangedFiles: filesToProcess.unchanged.length,
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

      // Shutdown state manager (saves final state)
      if (this.stateManager) {
        await this.stateManager.shutdown();
        this.logger.info("State manager shutdown complete");
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
   * Run annotation via Rust CLI (ast-parser annotate)
   */
  private async runAnnotation(files: string[]): Promise<void> {
    if (files.length === 0) {
      return;
    }

    try {
      this.logger.info("Running annotation via Rust CLI", {
        fileCount: files.length,
      });

      const { promisify } = await import("node:util");
      const execAsync = promisify((await import("node:child_process")).exec);

      // Build annotation command
      const astParserPath = "ast-parser"; // Assuming ast-parser is in PATH
      const workspacePath = this.config.outputDir || process.cwd();

      // Run annotation for all files in batch
      const command = `${astParserPath} annotate --workspace "${workspacePath}" ${files.map((f) => `"${f}"`).join(" ")}`;

      this.logger.debug("Executing annotation command", { command });

      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (stdout) {
        this.logger.debug("Annotation stdout", { output: stdout.trim() });
      }

      if (stderr) {
        this.logger.warn("Annotation stderr", { output: stderr.trim() });
      }

      this.logger.info("Annotation complete", {
        fileCount: files.length,
      });

      // Update state manager for annotated files
      if (this.stateManager) {
        for (const filePath of files) {
          const currentState = this.stateManager.getFileState(filePath);
          await this.stateManager.updateFileState(filePath, {
            stagesCompleted: {
              parsed: currentState?.stagesCompleted?.parsed || true,
              annotated: true,
              embedded: currentState?.stagesCompleted?.embedded || false,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error("Annotation failed", {
        error: error instanceof Error ? error.message : String(error),
        files,
      });
      throw error;
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

      // Use incremental update manager to analyze changes
      let changeSet: ChangeSet | null = null;
      if (this.incrementalManager && changedFiles.length > 0) {
        changeSet = await this.incrementalManager.analyzeChanges(changedFiles);

        this.logger.info("Incremental change analysis complete", {
          added: changeSet.added.length,
          modified: changeSet.modified.length,
          renamed: changeSet.renamed.length,
          unchanged: changeSet.unchanged.length,
          deleted: changeSet.deleted.length,
          dependencies: changeSet.dependencies.size,
        });

        // Skip processing unchanged files
        if (changeSet.unchanged.length > 0) {
          this.logger.debug("Skipping unchanged files", {
            count: changeSet.unchanged.length,
            files: changeSet.unchanged.slice(0, 10), // Log first 10
          });
        }
      }

      // Process changed/added files (only those that actually need processing)
      // Extract file paths from renamed files (they have {from, to} structure)
      const renamedFilePaths = changeSet
        ? changeSet.renamed.map((r) => (typeof r === "string" ? r : r.to))
        : [];
      const filesToProcess = changeSet
        ? [...changeSet.added, ...changeSet.modified, ...renamedFilePaths]
        : changedFiles;

      if (filesToProcess.length > 0) {
        try {
          this.logger.info("Parsing changed files", {
            fileCount: filesToProcess.length,
            skipped: changeSet ? changeSet.unchanged.length : 0,
          });

          const effectiveBatchSize = Math.min(
            this.options.batchSize || 50,
            this.options.maxBatchSize || 200,
          );

          // Use parse command to process files
          await this.parseCommand.execute(
            {
              glob: filesToProcess.join(","),
              force: true,
              batchSize: effectiveBatchSize,
            },
            this.config,
          );

          // Update state manager for successfully processed files
          if (this.stateManager) {
            for (const filePath of filesToProcess) {
              const currentState = this.stateManager.getFileState(filePath);
              await this.stateManager.updateFileState(filePath, {
                stagesCompleted: {
                  parsed: true,
                  annotated: currentState?.stagesCompleted?.annotated || false,
                  embedded: currentState?.stagesCompleted?.embedded || false,
                },
              });
              this.stateManager.recordSuccess(
                filePath,
                { parsed: true, annotated: false, embedded: false },
                Date.now(),
              );
            }
          }

          processedCount += filesToProcess.length;

          // Run annotation via Rust CLI if enabled
          if (
            (this.options.includeAnnotation || this.options.fullPipeline) &&
            processedCount > 0
          ) {
            try {
              await this.runAnnotation(filesToProcess);
            } catch (error) {
              this.logger.warn("Annotation failed, continuing with embedding", {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // Run embedding if enabled for the pipeline
          if (this.embedCommand && processedCount > 0) {
            this.logger.info("Generating embeddings for files");
            await this.embedCommand.execute({
              force: true,
              batchSize: effectiveBatchSize,
              verbose: false, // Keep quiet for watch mode
            });

            // Update state manager for embedding completion
            if (this.stateManager) {
              for (const filePath of filesToProcess) {
                const currentState = this.stateManager.getFileState(filePath);
                await this.stateManager.updateFileState(filePath, {
                  stagesCompleted: {
                    parsed: currentState?.stagesCompleted?.parsed || true,
                    annotated:
                      currentState?.stagesCompleted?.annotated || false,
                    embedded: true,
                  },
                });
              }
            }
          }
        } catch (error) {
          const errorMsg = `Failed to process changed files: ${error instanceof Error ? error.message : String(error)}`;
          processingErrors.push(errorMsg);
          this.logger.error(errorMsg, { error, files: filesToProcess });

          // Record errors for failed files
          if (this.stateManager) {
            for (const filePath of filesToProcess) {
              this.stateManager.recordError(
                filePath,
                error instanceof Error ? error.message : String(error),
              );
            }
          }
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
