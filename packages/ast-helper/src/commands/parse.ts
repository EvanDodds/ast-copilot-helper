/**
 * Parse Command Implementation
 * Implements the parse command with support for changed files, glob patterns, and batch processing
 */

import { ValidationErrors } from "../errors/index.js";
import { FileSelectionEngine } from "../file-selection/index.js";
import { ParseGitUtils } from "../git-integration/index.js";
import { createLogger } from "../logging/index.js";
import type { Config } from "../types.js";
import { FileProcessor } from "./file-processor.js";

/**
 * Parse command options interface
 */
export interface ParseOptions {
  changed?: boolean;
  glob?: string;
  base?: string;
  staged?: boolean;
  force?: boolean;
  batchSize?: number;
  dryRun?: boolean;
  outputStats?: boolean;
  config?: string;
  workspace?: string;
  // New options for integration test compatibility
  recursive?: boolean;
  language?: string;
  languages?: string;
  output?: string;
  outputFile?: string;
  benchmark?: boolean;
  targetPath?: string; // Path argument from CLI
}

/**
 * File selection result interface
 */
export interface FileSelectionResult {
  files: string[];
  skipped: string[];
  errors: string[];
  totalSize: number;
  strategy: "changed" | "glob" | "config";
}

/**
 * Batch processing result interface
 */
export interface BatchResult {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  errorFiles: number;
  totalNodes: number;
  processingTime: number;
  errors: ProcessingError[];
  statistics: BatchStatistics;
}

/**
 * Processing error interface
 */
export interface ProcessingError {
  filePath: string;
  error: string;
  type: "parse" | "io" | "validation";
  recoverable: boolean;
}

/**
 * Batch statistics interface
 */
export interface BatchStatistics {
  averageFileSize: number;
  averageProcessingTime: number;
  averageNodesPerFile: number;
  totalBytesProcessed: number;
  filesPerSecond: number;
  memoryUsageMB: number;
}

/**
 * Command handler interface
 */
export interface CommandHandler<T = any> {
  execute(options: T, config: Config): Promise<void>;
}

/**
 * Parse command implementation with comprehensive file selection, batch processing, and Git integration
 */
export class ParseCommand implements CommandHandler<ParseOptions> {
  private logger = createLogger();
  private fileSelectionEngine: FileSelectionEngine;
  private gitUtils: ParseGitUtils;

  constructor() {
    this.fileSelectionEngine = new FileSelectionEngine();
    this.gitUtils = new ParseGitUtils();
  }

  /**
   * Process new CLI options for backward compatibility
   */
  private processNewCliOptions(options: ParseOptions): ParseOptions {
    const processedOptions = { ...options };
    
    // Handle targetPath option (positional argument)
    if (processedOptions.targetPath) {
      processedOptions.workspace = processedOptions.targetPath;
    }
    
    // Handle recursive option
    if (processedOptions.recursive) {
      // Recursive is default behavior, but we can add specific logic if needed
      this.logger.debug("Recursive parsing enabled");
    }
    
    // Handle language/languages options
    if (processedOptions.language || processedOptions.languages) {
      let languages: string[] = [];
      
      if (processedOptions.language) {
        languages = [processedOptions.language];
      } else if (processedOptions.languages) {
        languages = processedOptions.languages.split(',').map(l => l.trim());
      }
      
      // Convert to glob pattern for supported languages
      const extensionMap: Record<string, string[]> = {
        typescript: ['ts', 'tsx'],
        javascript: ['js', 'jsx', 'mjs'],
        python: ['py'],
        java: ['java'],
        rust: ['rs'],
        cpp: ['cpp', 'cxx', 'cc', 'c'],
        csharp: ['cs']
      };
      
      const extensions: string[] = [];
      for (const lang of languages) {
        const langExtensions = extensionMap[lang.toLowerCase()];
        if (langExtensions) {
          extensions.push(...langExtensions);
        }
      }
      
      if (extensions.length > 0) {
        processedOptions.glob = `**/*.{${extensions.join(',')}}`;
      }
    }
    
    // Handle output options
    if (processedOptions.output || processedOptions.outputFile) {
      this.logger.info("Output formatting options detected", {
        format: processedOptions.output,
        file: processedOptions.outputFile
      });
    }
    
    // Handle benchmark option
    if (processedOptions.benchmark) {
      this.logger.info("Benchmark mode enabled");
      processedOptions.outputStats = true; // Enable stats for benchmarking
    }
    
    return processedOptions;
  }

  /**
   * Execute the parse command with the given options and configuration
   */
  async execute(options: ParseOptions, config: Config): Promise<void> {
    const startTime = Date.now();

    try {
      // Handle new CLI options for integration test compatibility
      const processedOptions = this.processNewCliOptions(options);
      
      this.logger.info("Parse command started", {
        options: this.sanitizeOptionsForLogging(processedOptions),
        workingDirectory: process.cwd(),
      });

      // Validate preconditions
      await this.validatePreconditions(processedOptions, config);

      // Step 1: Resolve file selection strategy and get files to process
      const fileSelection = await this.selectFiles(processedOptions, config);

      this.logger.info("File selection completed", {
        strategy: fileSelection.strategy,
        totalFiles: fileSelection.files.length,
        skippedFiles: fileSelection.skipped.length,
        errorCount: fileSelection.errors.length,
        totalSize: fileSelection.totalSize,
      });

      // Step 2: Handle dry-run mode
      if (processedOptions.dryRun) {
        await this.handleDryRun(fileSelection, processedOptions);
        return;
      }

      // Step 3: Execute parsing with progress reporting
      const result = await this.executeParsing(fileSelection, processedOptions, config);

      // Step 4: Report final results
      this.reportResults(result, processedOptions);

      const totalTime = Date.now() - startTime;
      this.logger.info("Parse command completed successfully", {
        totalTime: totalTime,
        filesProcessed: result.processedFiles,
        totalNodes: result.totalNodes,
      });
    } catch (error) {
      const totalTime = Date.now() - startTime;
      this.logger.error("Parse command failed", {
        error: (error as Error).message,
        totalTime: totalTime,
        stack: (error as Error).stack,
      });

      throw error;
    }
  }

  /**
   * Validate preconditions before executing parse command
   */
  private async validatePreconditions(
    options: ParseOptions,
    config: Config,
  ): Promise<void> {
    // Validate that required dependencies are available
    // This will be implemented in later subtasks when we have the actual dependencies

    if (!config.outputDir) {
      throw ValidationErrors.invalidValue(
        "outputDir",
        "undefined",
        'Output directory must be configured. Run "ast-helper init" to initialize the database structure.',
      );
    }

    if (options.changed && !options.workspace) {
      throw ValidationErrors.invalidValue(
        "--changed",
        "no workspace specified",
        "Workspace directory must be specified when using --changed flag.",
      );
    }

    // Validate Git-specific preconditions
    if (options.changed || options.staged) {
      await this.gitUtils.validateGitPreconditions(options);
    }

    this.logger.debug("Preconditions validated", {
      outputDir: config.outputDir,
      workspace: options.workspace || process.cwd(),
      hasGitOptions: !!(options.changed || options.staged),
    });
  }

  /**
   * Select files to process based on the specified strategy
   */
  private async selectFiles(
    options: ParseOptions,
    config: Config,
  ): Promise<FileSelectionResult> {
    // Use the FileSelectionEngine which will route to appropriate selector (git, glob, or config)
    return await this.fileSelectionEngine.selectFiles(options, config);
  }

  /**
   * Handle dry-run mode by showing what would be processed
   */
  private async handleDryRun(
    fileSelection: FileSelectionResult,
    options: ParseOptions,
  ): Promise<void> {
    console.log(`\n🔍 Dry run mode - showing what would be parsed:\n`);

    console.log(`📊 File Selection Summary:`);
    console.log(`   Strategy: ${fileSelection.strategy}`);
    console.log(`   Files to process: ${fileSelection.files.length}`);
    console.log(`   Files to skip: ${fileSelection.skipped.length}`);
    console.log(`   Total size: ${this.formatBytes(fileSelection.totalSize)}`);

    if (options.batchSize) {
      console.log(`   Batch size: ${options.batchSize} files`);
      const batches = Math.ceil(fileSelection.files.length / options.batchSize);
      console.log(`   Estimated batches: ${batches}`);
    }

    if (fileSelection.files.length > 0) {
      console.log(`\n📁 Files to be processed:`);
      const displayFiles = fileSelection.files.slice(0, 10);
      displayFiles.forEach((file) => console.log(`   ✓ ${file}`));

      if (fileSelection.files.length > 10) {
        console.log(`   ... and ${fileSelection.files.length - 10} more files`);
      }
    }

    if (fileSelection.skipped.length > 0) {
      console.log(`\n⏭️  Files to be skipped (up-to-date):`);
      const displaySkipped = fileSelection.skipped.slice(0, 5);
      displaySkipped.forEach((file) => console.log(`   - ${file}`));

      if (fileSelection.skipped.length > 5) {
        console.log(
          `   ... and ${fileSelection.skipped.length - 5} more files`,
        );
      }
    }

    if (fileSelection.errors.length > 0) {
      console.log(`\n❌ Files with selection errors:`);
      fileSelection.errors.forEach((error) => console.log(`   ! ${error}`));
    }

    console.log(`\n💡 To execute parsing, remove the --dry-run flag.\n`);

    this.logger.info("Dry run completed", {
      filesToProcess: fileSelection.files.length,
      filesToSkip: fileSelection.skipped.length,
      selectionErrors: fileSelection.errors.length,
    });
  }

  /**
   * Execute parsing with batch processing and progress reporting
   */
  private async executeParsing(
    fileSelection: FileSelectionResult,
    options: ParseOptions,
    config: Config,
  ): Promise<BatchResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting AST parsing", {
        totalFiles: fileSelection.files.length,
        batchSize: options.batchSize,
        outputDir: config.outputDir,
      });

      // Create FileProcessor instance
      const fileProcessor = await FileProcessor.create(config);

      // Process files with progress reporting
      const progressCallback = options.outputStats
        ? (progress: {
            completed: number;
            total: number;
            currentFile: string;
            rate: number;
            estimatedTimeRemaining: number;
            memoryUsageMB: number;
          }) => {
            if (
              progress.completed %
                Math.max(1, Math.floor(progress.total / 10)) ===
              0
            ) {
              const percent = Math.round(
                (progress.completed / progress.total) * 100,
              );
              const etaSeconds = Math.round(
                progress.estimatedTimeRemaining / 1000,
              );
              console.log(
                `🔄 Processing: ${percent}% (${progress.completed}/${progress.total}) - ETA: ${etaSeconds}s - Memory: ${progress.memoryUsageMB.toFixed(1)}MB`,
              );
            }
          }
        : undefined;

      // Process files
      const results = await fileProcessor.processFiles(
        fileSelection.files,
        options,
        config,
        progressCallback,
      );

      // Clean up
      await fileProcessor.dispose();

      const processingTime = Date.now() - startTime;

      this.logger.info("AST parsing completed", {
        totalFiles: results.totalFiles,
        successful: results.successful,
        failed: results.failed,
        totalTimeMs: processingTime,
        totalNodes: results.totalNodes,
      });

      // Transform results to BatchResult format
      const batchResult: BatchResult = {
        totalFiles: results.totalFiles,
        processedFiles: results.successful,
        skippedFiles: results.skipped,
        errorFiles: results.failed,
        totalNodes: results.totalNodes,
        processingTime,
        errors: results.errors.map((error) => ({
          filePath: error.split(":")[0] || "unknown",
          error: error.split(":").slice(1).join(":").trim() || "Unknown error",
          type: "parse" as const,
          recoverable: true,
        })),
        statistics: options.outputStats
          ? {
              averageFileSize: 0, // Would need to calculate from file metadata
              averageProcessingTime:
                results.totalTimeMs / Math.max(1, results.totalFiles),
              averageNodesPerFile:
                results.totalNodes / Math.max(1, results.successful),
              totalBytesProcessed: 0, // Would need to calculate from file metadata
              filesPerSecond:
                results.totalFiles / Math.max(1, results.totalTimeMs / 1000),
              memoryUsageMB: results.memoryStats.peakUsageMB,
            }
          : {
              averageFileSize: 0,
              averageProcessingTime: 0,
              averageNodesPerFile: 0,
              totalBytesProcessed: 0,
              filesPerSecond: 0,
              memoryUsageMB: 0,
            },
      };

      return batchResult;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error("AST parsing failed", {
        error: (error as Error).message,
        processingTime,
        totalFiles: fileSelection.files.length,
      });

      // Return error result
      return {
        totalFiles: fileSelection.files.length,
        processedFiles: 0,
        skippedFiles: 0,
        errorFiles: fileSelection.files.length,
        totalNodes: 0,
        processingTime,
        errors: [
          {
            filePath: "batch",
            error: `Batch processing failed: ${(error as Error).message}`,
            type: "parse" as const,
            recoverable: false,
          },
        ],
        statistics: {
          averageFileSize: 0,
          averageProcessingTime: 0,
          averageNodesPerFile: 0,
          totalBytesProcessed: 0,
          filesPerSecond: 0,
          memoryUsageMB: 0,
        },
      };
    }
  }

  /**
   * Report final parsing results
   */
  private reportResults(result: BatchResult, options: ParseOptions): void {
    const {
      processedFiles,
      skippedFiles,
      errorFiles,
      totalNodes,
      processingTime,
    } = result;
    const duration = processingTime / 1000;

    console.log(`\n✅ Parse command completed successfully!\n`);

    console.log(`📊 Processing Summary:`);
    console.log(`   Files processed: ${processedFiles}`);
    console.log(`   Files skipped: ${skippedFiles}`);
    console.log(`   Files with errors: ${errorFiles}`);
    console.log(`   Total AST nodes: ${totalNodes.toLocaleString()}`);
    console.log(`   Processing time: ${this.formatDuration(duration)}`);

    if (processedFiles > 0) {
      const rate = processedFiles / duration;
      console.log(`   Average rate: ${rate.toFixed(1)} files/second`);
    }

    if (options.outputStats && result.statistics) {
      console.log(`\n📈 Detailed Statistics:`);
      console.log(
        `   Average file size: ${this.formatBytes(result.statistics.averageFileSize)}`,
      );
      console.log(
        `   Average processing time: ${result.statistics.averageProcessingTime.toFixed(2)}ms/file`,
      );
      console.log(
        `   Average nodes per file: ${result.statistics.averageNodesPerFile.toFixed(0)}`,
      );
      console.log(
        `   Total bytes processed: ${this.formatBytes(result.statistics.totalBytesProcessed)}`,
      );
      console.log(
        `   Peak memory usage: ${result.statistics.memoryUsageMB.toFixed(1)}MB`,
      );
    }

    if (errorFiles > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      result.errors.slice(0, 5).forEach((error) => {
        console.log(`   ${error.filePath}: ${error.error}`);
      });

      if (result.errors.length > 5) {
        console.log(`   ... and ${result.errors.length - 5} more errors`);
      }

      console.log(`\nRun with --debug for detailed error information.`);
    }

    console.log(
      `\n🎯 Next steps: Run 'ast-helper annotate' to generate metadata for the parsed AST nodes.\n`,
    );
  }

  /**
   * Sanitize options for logging (remove sensitive information)
   */
  private sanitizeOptionsForLogging(
    options: ParseOptions,
  ): Partial<ParseOptions> {
    // Remove sensitive or large data from options before logging
    return {
      changed: options.changed,
      glob: options.glob,
      base: options.base,
      staged: options.staged,
      force: options.force,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
      outputStats: options.outputStats,
      // Exclude workspace and config paths as they might be sensitive
    };
  }

  /**
   * Format bytes in human-readable format
   */
  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }
}
