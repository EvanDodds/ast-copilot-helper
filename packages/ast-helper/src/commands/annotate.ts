/**
 * Annotate Command Implementation
 * Provides TypeScript CLI interface to Rust annotation functionality
 */

import { performance } from "perf_hooks";
import { createLogger } from "../logging/index.js";
import type { Config } from "../types.js";
import { rustParser, type RustAnnotateResult } from "../parser/rust-cli.js";
import { ASTDatabaseManager } from "../database/manager.js";
import { FileSelectionEngine } from "../file-selection/index.js";
import { ValidationErrors } from "../errors/index.js";
import * as path from "path";
import * as fs from "fs/promises";

/**
 * Options for the annotate command
 */
export interface AnnotateOptions {
  /** File glob pattern or specific file paths */
  glob?: string;
  /** Single file to annotate */
  file?: string;
  /** Language override */
  language?: string;
  /** Batch size for processing multiple files */
  batchSize?: number;
  /** Maximum concurrency */
  maxConcurrency?: number;
  /** Force re-annotation of existing files */
  force?: boolean;
  /** Show detailed output */
  verbose?: boolean;
  /** Dry run mode */
  dryRun?: boolean;
  /** Output format */
  format?: "json" | "yaml" | "summary";
  /** Output file path */
  outputFile?: string;
  /** Only process changed files */
  changed?: boolean;
  /** Workspace directory */
  workspace?: string;
  /** Config file path */
  config?: string;
  /** Store results in database */
  storeResults?: boolean;
}

/**
 * Annotation processing result
 */
export interface AnnotationResult {
  filePath: string;
  success: boolean;
  annotations?: RustAnnotateResult;
  error?: string;
  processingTime: number;
}

/**
 * Batch annotation results
 */
export interface BatchAnnotationResult {
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  totalAnnotations: number;
  totalProcessingTime: number;
  results: AnnotationResult[];
  errors: string[];
}

/**
 * Annotate command implementation
 */
export class AnnotateCommand {
  private logger = createLogger({ operation: "annotate" });
  private fileSelectionEngine: FileSelectionEngine;
  private dbManager?: ASTDatabaseManager;

  constructor() {
    this.fileSelectionEngine = new FileSelectionEngine();
  }

  /**
   * Execute the annotate command
   */
  async execute(options: AnnotateOptions, config: Config): Promise<void> {
    const startTime = performance.now();

    try {
      this.logger.info("Annotate command started", {
        options: this.sanitizeOptionsForLogging(options),
      });

      // Validate options and configuration
      await this.validateOptions(options, config);

      // Initialize database manager if needed
      if (!options.dryRun) {
        await this.initializeDatabaseManager(config);
      }

      // Get files to annotate
      const files = await this.selectFiles(options, config);

      if (files.length === 0) {
        this.logger.warn("No files found to annotate");
        return;
      }

      this.logger.info(`Found ${files.length} files to annotate`);

      // Handle dry run
      if (options.dryRun) {
        this.logger.info(
          "Dry run mode - showing files that would be annotated:",
        );
        files.forEach((file, index) => {
          // eslint-disable-next-line no-console
          console.log(`  ${index + 1}. ${file}`);
        });
        return;
      }

      // Process annotations
      const result = await this.processAnnotations(files, options, config);

      // Store results in database
      if (options.storeResults !== false) {
        await this.storeAnnotations(result.results);
      }

      // Output results
      await this.outputResults(result, options);

      const totalTime = performance.now() - startTime;
      this.logger.info("Annotate command completed", {
        totalFiles: result.totalFiles,
        processedFiles: result.processedFiles,
        totalAnnotations: result.totalAnnotations,
        totalTime: Math.round(totalTime),
      });
    } catch (error) {
      this.logger.error("Annotate command failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Validate options and configuration
   */
  private async validateOptions(
    options: AnnotateOptions,
    config: Config,
  ): Promise<void> {
    // Check if Rust CLI is available
    const cliAvailable = await rustParser.checkCliAvailable();
    if (!cliAvailable) {
      throw new Error(
        "Rust CLI binary not found. Please ensure ast-parser is built and available in PATH.",
      );
    }

    // Validate batch size
    if (
      options.batchSize &&
      (options.batchSize < 1 || options.batchSize > 100)
    ) {
      throw ValidationErrors.invalidValue(
        "batchSize",
        options.batchSize.toString(),
        "Batch size must be between 1 and 100",
      );
    }

    // Validate concurrency
    if (
      options.maxConcurrency &&
      (options.maxConcurrency < 1 || options.maxConcurrency > 20)
    ) {
      throw ValidationErrors.invalidValue(
        "maxConcurrency",
        options.maxConcurrency.toString(),
        "Max concurrency must be between 1 and 20",
      );
    }

    // Validate output directory exists if not dry run
    if (!options.dryRun && !config.outputDir) {
      throw ValidationErrors.invalidValue(
        "outputDir",
        "undefined",
        'Output directory must be configured. Run "ast-helper init" first.',
      );
    }
  }

  /**
   * Initialize database manager
   */
  private async initializeDatabaseManager(config: Config): Promise<void> {
    if (!config.outputDir) {
      throw new Error("Output directory not configured");
    }

    this.dbManager = new ASTDatabaseManager(config.outputDir);

    // Ensure annotation directory exists
    const annotationDir = path.join(config.outputDir, "annotations");
    try {
      await fs.mkdir(annotationDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's fine
    }
  }

  /**
   * Select files to annotate
   */
  private async selectFiles(
    options: AnnotateOptions,
    config: Config,
  ): Promise<string[]> {
    let files: string[] = [];

    if (options.file) {
      // Single file specified
      files = [path.resolve(options.file)];
    } else {
      // Use file selection engine
      const selectionOptions = {
        glob: options.glob,
        changed: options.changed,
        workspace: options.workspace || process.cwd(),
      };

      const selectionResult = await this.fileSelectionEngine.selectFiles(
        selectionOptions,
        config,
      );

      files = selectionResult.files;
    }

    // Filter out files that don't exist
    const existingFiles: string[] = [];
    for (const file of files) {
      try {
        await fs.access(file);
        existingFiles.push(file);
      } catch {
        this.logger.warn(`File not found: ${file}`);
      }
    }

    return existingFiles;
  }

  /**
   * Process annotations for all files
   */
  private async processAnnotations(
    files: string[],
    options: AnnotateOptions,
    _config: Config,
  ): Promise<BatchAnnotationResult> {
    const results: AnnotationResult[] = [];
    const errors: string[] = [];
    let totalAnnotations = 0;
    const startTime = performance.now();

    const batchSize = options.batchSize || 10;
    const concurrency = options.maxConcurrency || 4;

    this.logger.info(
      `Processing ${files.length} files in batches of ${batchSize}`,
    );

    // Process files in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      this.logger.debug(
        `Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} files`,
      );

      try {
        // Use Rust CLI batch processing
        const batchResult = await rustParser.annotateFiles(batch, {
          language: options.language,
          maxConcurrency: concurrency,
        });

        // Convert results
        for (const [filePath, result] of Object.entries(batchResult.results)) {
          const annotationResult: AnnotationResult = {
            filePath,
            success: result.success,
            processingTime: 0, // Individual timing not available from batch
          };

          if (result.success && result.result) {
            annotationResult.annotations = result.result;
            totalAnnotations += result.result.annotations.length;
          } else {
            annotationResult.error = result.error || "Unknown error";
            errors.push(`${filePath}: ${annotationResult.error}`);
          }

          results.push(annotationResult);
        }
      } catch (error) {
        // Handle batch failure by processing files individually
        this.logger.warn(
          `Batch processing failed, falling back to individual processing: ${error}`,
        );

        for (const filePath of batch) {
          try {
            const fileStartTime = performance.now();
            const annotations = await rustParser.annotateFile(
              filePath,
              options.language,
            );
            const processingTime = performance.now() - fileStartTime;

            results.push({
              filePath,
              success: true,
              annotations,
              processingTime,
            });

            totalAnnotations += annotations.annotations.length;
          } catch (fileError) {
            const errorMsg =
              fileError instanceof Error
                ? fileError.message
                : String(fileError);
            errors.push(`${filePath}: ${errorMsg}`);

            results.push({
              filePath,
              success: false,
              error: errorMsg,
              processingTime: 0,
            });
          }
        }
      }
    }

    const totalTime = performance.now() - startTime;
    const successfulResults = results.filter((r) => r.success);

    return {
      totalFiles: files.length,
      processedFiles: successfulResults.length,
      failedFiles: files.length - successfulResults.length,
      totalAnnotations,
      totalProcessingTime: totalTime,
      results,
      errors,
    };
  }

  /**
   * Store annotations in database
   */
  private async storeAnnotations(results: AnnotationResult[]): Promise<void> {
    if (!this.dbManager) {
      throw new Error("Database manager not initialized");
    }

    for (const result of results) {
      if (!result.success || !result.annotations) {
        continue;
      }

      try {
        // Create annotation file path
        const relativePath = path.relative(process.cwd(), result.filePath);
        const safePath = relativePath.replace(/[/\\]/g, "_");
        const annotationsDir = path.join(
          this.dbManager.astdbPath,
          "annotations",
        );
        const annotationPath = path.join(annotationsDir, `${safePath}.json`);

        // Ensure annotations directory exists
        await fs.mkdir(annotationsDir, { recursive: true });

        // Store annotation data
        await fs.writeFile(
          annotationPath,
          JSON.stringify(result.annotations, null, 2),
          "utf-8",
        );

        this.logger.debug(`Stored annotations for ${result.filePath}`);
      } catch (error) {
        this.logger.error(
          `Failed to store annotations for ${result.filePath}:`,
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }
  }

  /**
   * Output results in the specified format
   */
  private async outputResults(
    result: BatchAnnotationResult,
    options: AnnotateOptions,
  ): Promise<void> {
    const format = options.format || "summary";

    let output: string;

    switch (format) {
      case "json":
        output = JSON.stringify(result, null, 2);
        break;

      case "yaml":
        // Simple YAML-like output
        output = `total_files: ${result.totalFiles}\n`;
        output += `processed_files: ${result.processedFiles}\n`;
        output += `failed_files: ${result.failedFiles}\n`;
        output += `total_annotations: ${result.totalAnnotations}\n`;
        output += `processing_time_ms: ${Math.round(result.totalProcessingTime)}\n`;
        break;

      case "summary":
      default:
        output = this.formatSummary(result);
        break;
    }

    if (options.outputFile) {
      await fs.writeFile(options.outputFile, output, "utf-8");
      this.logger.info(`Results written to ${options.outputFile}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(output);
    }
  }

  /**
   * Format summary output
   */
  private formatSummary(result: BatchAnnotationResult): string {
    let output = "\n✅ Annotation Summary:\n";
    output += `   Files processed: ${result.processedFiles}/${result.totalFiles}\n`;
    output += `   Total annotations: ${result.totalAnnotations}\n`;
    output += `   Processing time: ${Math.round(result.totalProcessingTime)}ms\n`;

    if (result.errors.length > 0) {
      output += `\n❌ Errors (${result.errors.length}):\n`;
      result.errors.slice(0, 5).forEach((error) => {
        output += `   ${error}\n`;
      });
      if (result.errors.length > 5) {
        output += `   ... and ${result.errors.length - 5} more\n`;
      }
    }

    return output;
  }

  /**
   * Sanitize options for logging
   */
  private sanitizeOptionsForLogging(
    options: AnnotateOptions,
  ): Record<string, unknown> {
    const sanitized = { ...options };

    // Remove potentially sensitive data
    delete sanitized.config;

    return sanitized;
  }
}

/**
 * Annotate command handler for CLI integration
 */
export class AnnotateCommandHandler {
  async execute(options: AnnotateOptions, config: Config): Promise<void> {
    const command = new AnnotateCommand();
    await command.execute(options, config);
  }
}
