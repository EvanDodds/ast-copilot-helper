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

/**
 * Watch command options interface
 */
export interface WatchCommandOptions {
  glob?: string;
  debounce?: number;
  includeAnnotation?: boolean;
  batchSize?: number;
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
  private config: Config;
  private options: WatchCommandOptions;
  private isRunning = false;
  private processedFiles = 0;
  private errors: string[] = [];
  private pendingChanges = new Map<string, FileChangeEvent>();
  private processingTimer: NodeJS.Timeout | null = null;

  constructor(config: Config, options: WatchCommandOptions) {
    super();
    this.config = config;
    this.options = options;
    this.parseCommand = new ParseCommand();

    if (options.includeAnnotation) {
      this.annotateHandler = new AnnotateCommandHandler();
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
        batchSize: this.options.batchSize || 50,
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

          // Use parse command to process files
          await this.parseCommand.execute(
            {
              glob: changedFiles.join(","),
              force: true,
              batchSize: this.options.batchSize || 50,
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
                batchSize: this.options.batchSize || 50,
              },
              this.config,
            );
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
        const stats = this.watchCommand?.getStats();
        logger.info("\n📊 Watch session summary:");
        logger.info(`   Files processed: ${stats?.processedFiles || 0}`);
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
