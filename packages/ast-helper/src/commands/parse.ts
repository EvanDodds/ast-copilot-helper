/**
 * Parse Command Implementation
 * Implements the parse command with support for changed files, glob patterns, and batch processing
 */

import type { Config } from '../types.js';
import { createLogger } from '../logging/index.js';
import { ValidationErrors } from '../errors/index.js';

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
}

/**
 * File selection result interface
 */
export interface FileSelectionResult {
  files: string[];
  skipped: string[];
  errors: string[];
  totalSize: number;
  strategy: 'changed' | 'glob' | 'config';
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
  type: 'parse' | 'io' | 'validation';
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

  constructor() {
    // Constructor implementation will be added in later subtasks
  }

  /**
   * Execute the parse command with the given options and configuration
   */
  async execute(options: ParseOptions, config: Config): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Parse command started', {
        options: this.sanitizeOptionsForLogging(options),
        workingDirectory: process.cwd()
      });

      // Validate preconditions
      await this.validatePreconditions(options, config);

      // Step 1: Resolve file selection strategy and get files to process
      const fileSelection = await this.selectFiles(options, config);
      
      this.logger.info('File selection completed', {
        strategy: fileSelection.strategy,
        totalFiles: fileSelection.files.length,
        skippedFiles: fileSelection.skipped.length,
        errorCount: fileSelection.errors.length,
        totalSize: fileSelection.totalSize
      });

      // Step 2: Handle dry-run mode
      if (options.dryRun) {
        await this.handleDryRun(fileSelection, options);
        return;
      }

      // Step 3: Execute parsing with progress reporting
      const result = await this.executeParsing(fileSelection, options, config);

      // Step 4: Report final results
      this.reportResults(result, options);

      const totalTime = Date.now() - startTime;
      this.logger.info('Parse command completed successfully', {
        totalTime: totalTime,
        filesProcessed: result.processedFiles,
        totalNodes: result.totalNodes
      });

    } catch (error) {
      const totalTime = Date.now() - startTime;
      this.logger.error('Parse command failed', {
        error: (error as Error).message,
        totalTime: totalTime,
        stack: (error as Error).stack
      });

      throw error;
    }
  }

  /**
   * Validate preconditions before executing parse command
   */
  private async validatePreconditions(options: ParseOptions, config: Config): Promise<void> {
    // Validate that required dependencies are available
    // This will be implemented in later subtasks when we have the actual dependencies
    
    if (!config.outputDir) {
      throw ValidationErrors.invalidValue(
        'outputDir',
        'undefined',
        'Output directory must be configured. Run "ast-helper init" to initialize the database structure.'
      );
    }

    if (options.changed && !options.workspace) {
      throw ValidationErrors.invalidValue(
        '--changed',
        'no workspace specified',
        'Workspace directory must be specified when using --changed flag.'
      );
    }

    this.logger.debug('Preconditions validated', {
      outputDir: config.outputDir,
      workspace: options.workspace || process.cwd()
    });
  }

  /**
   * Select files to process based on the specified strategy
   */
  private async selectFiles(options: ParseOptions, _config: Config): Promise<FileSelectionResult> {
    // This method will be implemented in Subtask 2 (File Selection Engine) and Subtask 3 (Git Integration)
    
    if (options.changed) {
      // Git-based file selection - will be implemented in Subtask 3
      throw new Error('Git integration not yet implemented');
    } else if (options.glob) {
      // Glob pattern file selection - will be implemented in Subtask 2
      throw new Error('Glob pattern selection not yet implemented');
    } else {
      // Configuration-based file selection - will be implemented in Subtask 2
      throw new Error('Configuration-based file selection not yet implemented');
    }
  }

  /**
   * Handle dry-run mode by showing what would be processed
   */
  private async handleDryRun(fileSelection: FileSelectionResult, options: ParseOptions): Promise<void> {
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
      displayFiles.forEach(file => console.log(`   ✓ ${file}`));
      
      if (fileSelection.files.length > 10) {
        console.log(`   ... and ${fileSelection.files.length - 10} more files`);
      }
    }

    if (fileSelection.skipped.length > 0) {
      console.log(`\n⏭️  Files to be skipped (up-to-date):`);
      const displaySkipped = fileSelection.skipped.slice(0, 5);
      displaySkipped.forEach(file => console.log(`   - ${file}`));
      
      if (fileSelection.skipped.length > 5) {
        console.log(`   ... and ${fileSelection.skipped.length - 5} more files`);
      }
    }

    if (fileSelection.errors.length > 0) {
      console.log(`\n❌ Files with selection errors:`);
      fileSelection.errors.forEach(error => console.log(`   ! ${error}`));
    }

    console.log(`\n💡 To execute parsing, remove the --dry-run flag.\n`);

    this.logger.info('Dry run completed', {
      filesToProcess: fileSelection.files.length,
      filesToSkip: fileSelection.skipped.length,
      selectionErrors: fileSelection.errors.length
    });
  }

  /**
   * Execute parsing with batch processing and progress reporting
   */
  private async executeParsing(
    _fileSelection: FileSelectionResult, 
    _options: ParseOptions, 
    _config: Config
  ): Promise<BatchResult> {
    // This method will be implemented in Subtask 4 (AST Processing), Subtask 5 (Batch Processing),
    // and Subtask 6 (Progress Reporting)
    throw new Error('Batch processing not yet implemented');
  }

  /**
   * Report final parsing results
   */
  private reportResults(result: BatchResult, options: ParseOptions): void {
    const { processedFiles, skippedFiles, errorFiles, totalNodes, processingTime } = result;
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
      console.log(`   Average file size: ${this.formatBytes(result.statistics.averageFileSize)}`);
      console.log(`   Average processing time: ${result.statistics.averageProcessingTime.toFixed(2)}ms/file`);
      console.log(`   Average nodes per file: ${result.statistics.averageNodesPerFile.toFixed(0)}`);
      console.log(`   Total bytes processed: ${this.formatBytes(result.statistics.totalBytesProcessed)}`);
      console.log(`   Peak memory usage: ${result.statistics.memoryUsageMB.toFixed(1)}MB`);
    }

    if (errorFiles > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      result.errors.slice(0, 5).forEach(error => {
        console.log(`   ${error.filePath}: ${error.error}`);
      });

      if (result.errors.length > 5) {
        console.log(`   ... and ${result.errors.length - 5} more errors`);
      }

      console.log(`\nRun with --debug for detailed error information.`);
    }

    console.log(`\n🎯 Next steps: Run 'ast-helper annotate' to generate metadata for the parsed AST nodes.\n`);
  }

  /**
   * Sanitize options for logging (remove sensitive information)
   */
  private sanitizeOptionsForLogging(options: ParseOptions): Partial<ParseOptions> {
    // Remove sensitive or large data from options before logging
    return {
      changed: options.changed,
      glob: options.glob,
      base: options.base,
      staged: options.staged,
      force: options.force,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
      outputStats: options.outputStats
      // Exclude workspace and config paths as they might be sensitive
    };
  }

  /**
   * Format bytes in human-readable format
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
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