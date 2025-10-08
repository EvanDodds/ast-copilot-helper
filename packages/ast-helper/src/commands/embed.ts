/**
 * Embed command implementation
 * Handles embedding generation for annotations
 */

import type {
  Annotation,
  EmbeddingResult,
  EmbeddingConfig,
} from "../embedder/index.js";
import { XenovaEmbeddingGenerator } from "../embedder/index.js";
import type { Logger } from "../logging/index.js";
import {
  ASTDatabaseManager,
  EmbeddingDatabaseManager,
} from "../database/index.js";
import type { Config } from "../types.js";
import path from "path";

/**
 * Options for the embed command
 */
export interface EmbedOptions {
  /** Input database path or annotation file */
  input?: string;
  /** Output path for embeddings */
  output?: string;
  /** Model name or path to use */
  model?: string;
  /** Batch size for processing */
  batchSize?: number;
  /** Maximum concurrency */
  maxConcurrency?: number;
  /** Memory limit in MB */
  memoryLimit?: number;
  /** Enable progress reporting */
  verbose?: boolean;
  /** Dry run mode (validate only) */
  dryRun?: boolean;
  /** Force re-embedding existing annotations */
  force?: boolean;
}

/**
 * Embed command class
 */
export class EmbedCommand {
  private generator: XenovaEmbeddingGenerator | null = null;
  private config: Config;
  private logger: Logger;
  private dbManager: ASTDatabaseManager | null = null;
  private embeddingDb: EmbeddingDatabaseManager | null = null;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Execute the embed command
   */
  async execute(options: EmbedOptions = {}): Promise<void> {
    const embeddingConfig = this.buildEmbeddingConfig(this.config, options);

    try {
      this.logger.info("🚀 Starting embedding generation process");

      // Validate options and configuration
      this.validateConfiguration(embeddingConfig, options);

      if (options.dryRun) {
        this.logger.info("✅ Dry run completed - configuration valid");
        return;
      }

      // Initialize embedding generator
      await this.initializeGenerator(embeddingConfig);

      // Load annotations from input source
      const annotations = await this.loadAnnotations(
        options.input,
        this.config,
      );

      if (annotations.length === 0) {
        this.logger.warn("⚠️  No annotations found to embed");
        return;
      }

      this.logger.info(`📊 Processing ${annotations.length} annotations`);

      // Filter annotations if not forcing re-embedding
      const annotationsToEmbed = options.force
        ? annotations
        : await this.filterUnembeddedAnnotations(annotations);

      if (annotationsToEmbed.length === 0) {
        this.logger.info(
          "✅ All annotations already have embeddings (use --force to re-embed)",
        );
        return;
      }

      this.logger.info(
        `🔄 Embedding ${annotationsToEmbed.length} new annotations`,
      );

      // Generate embeddings
      const results = await this.generateEmbeddings(
        annotationsToEmbed,
        embeddingConfig,
      );

      // Store results
      await this.storeResults(results, options.output);

      this.logger.info(
        `✅ Embedding generation completed: ${results.length} embeddings generated`,
      );

      // Report statistics
      this.reportStatistics(results);
    } catch (error: any) {
      this.logger.error(`❌ Embedding generation failed: ${error.message}`);
      throw error;
    } finally {
      // Clean up resources
      await this.cleanup();
    }
  }

  /**
   * Build embedding configuration from config and options
   */
  private buildEmbeddingConfig(
    config: any,
    options: EmbedOptions,
  ): EmbeddingConfig {
    const embeddingDefaults = config.embeddings || {};

    return {
      modelPath:
        options.model ||
        embeddingDefaults.modelPath ||
        ".astdb/models/codebert-base",
      modelName: embeddingDefaults.model || "codebert-base",
      defaultBatchSize: options.batchSize || embeddingDefaults.batchSize || 32,
      maxBatchSize: 128,
      memoryLimit: options.memoryLimit || embeddingDefaults.memoryLimit || 2048,
      maxConcurrency:
        options.maxConcurrency || embeddingDefaults.maxConcurrency || 2,
      enableProgressReporting:
        options.verbose ?? embeddingDefaults.showProgress ?? true,
      enableConfidenceScoring:
        embeddingDefaults.enableConfidenceScoring ?? true,
    };
  }

  /**
   * Validate configuration and options
   */
  private validateConfiguration(
    config: EmbeddingConfig,
    options: EmbedOptions,
  ): void {
    // Validate model path
    if (!config.modelPath) {
      throw new Error("Model path is required");
    }

    // Validate batch size
    if (config.defaultBatchSize < 1 || config.defaultBatchSize > 128) {
      throw new Error("Batch size must be between 1 and 128");
    }

    // Validate concurrency
    if (config.maxConcurrency < 1 || config.maxConcurrency > 8) {
      throw new Error("Max concurrency must be between 1 and 8");
    }

    // Validate memory limit
    if (config.memoryLimit < 512 || config.memoryLimit > 16384) {
      throw new Error("Memory limit must be between 512 MB and 16 GB");
    }

    this.logger.debug("✅ Configuration validation passed", {
      config,
      options,
    });
  }

  /**
   * Initialize the embedding generator
   */
  private async initializeGenerator(config: EmbeddingConfig): Promise<void> {
    this.logger.info(`🔧 Initializing embedding model: ${config.modelName}`);

    this.generator = new XenovaEmbeddingGenerator();

    // Resolve absolute model path
    const modelPath = path.resolve(config.modelPath);

    try {
      await this.generator.initialize(modelPath);
      this.logger.info("✅ Embedding model initialized successfully");
    } catch (error: any) {
      throw new Error(`Failed to initialize embedding model: ${error.message}`);
    }
  }

  /**
   * Load annotations from input source
   */
  private async loadAnnotations(
    inputPath?: string,
    config?: Config,
  ): Promise<Annotation[]> {
    // If no input specified, try to load from database
    if (!inputPath) {
      return await this.loadAnnotationsFromDatabase(config);
    }

    // Check if input is a file or database path
    if (inputPath.endsWith(".json")) {
      return await this.loadAnnotationsFromFile(inputPath);
    } else {
      return await this.loadAnnotationsFromDatabase(config, inputPath);
    }
  }

  /**
   * Load annotations from database
   */
  private async loadAnnotationsFromDatabase(
    config?: Config,
    dbPath?: string,
  ): Promise<Annotation[]> {
    try {
      // Initialize database managers if needed
      if (!this.dbManager) {
        const outputDir = dbPath || config?.outputDir || ".astdb";
        this.dbManager = new ASTDatabaseManager(outputDir);
        this.embeddingDb = new EmbeddingDatabaseManager(this.dbManager);
      }

      // Load real annotations from the database
      const annotations = await this.loadAnnotationsFromDatabaseFiles();

      if (annotations.length === 0) {
        this.logger.warn(
          "No annotations found in database. Run 'ast-helper annotate' first to generate annotations.",
        );
      } else {
        this.logger.info(
          `Loaded ${annotations.length} annotations from database`,
        );
      }

      return annotations;
    } catch (error: any) {
      throw new Error(
        `Failed to load annotations from database: ${error.message}`,
      );
    }
  }

  /**
   * Load annotations from database files
   */
  private async loadAnnotationsFromDatabaseFiles(): Promise<Annotation[]> {
    try {
      if (!this.dbManager) {
        throw new Error("Database manager not initialized");
      }

      const fs = await import("fs/promises");
      const annotationsDir = path.join(this.dbManager.astdbPath, "annotations");

      // Check if annotations directory exists
      try {
        await fs.access(annotationsDir);
      } catch {
        // Annotations directory doesn't exist, return empty array
        return [];
      }

      const files = await fs.readdir(annotationsDir);
      const jsonFiles = files.filter((file) => file.endsWith(".json"));

      if (jsonFiles.length === 0) {
        return [];
      }

      const annotations: Annotation[] = [];

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(annotationsDir, file);
          const data = await fs.readFile(filePath, "utf-8");
          const fileAnnotations = JSON.parse(data);

          if (Array.isArray(fileAnnotations)) {
            // Convert from stored format to embed format
            for (const annotation of fileAnnotations) {
              annotations.push({
                nodeId:
                  annotation.node_id ||
                  `${file}-${annotation.signature || "unknown"}`,
                signature: annotation.signature || annotation.name || "Unknown",
                summary:
                  annotation.summary ||
                  annotation.description ||
                  "No summary available",
                sourceSnippet:
                  annotation.code_snippet || annotation.source_snippet || "",
              });
            }
          }
        } catch (parseError) {
          this.logger.warn(
            `Failed to parse annotation file ${file}: ${parseError}`,
          );
        }
      }

      return annotations;
    } catch (error: any) {
      throw new Error(
        `Failed to load annotations from database: ${error.message}`,
      );
    }
  }

  /**
   * Load annotations from JSON file
   */
  private async loadAnnotationsFromFile(
    filePath: string,
  ): Promise<Annotation[]> {
    try {
      const fs = await import("fs/promises");
      const data = await fs.readFile(filePath, "utf-8");
      const annotations = JSON.parse(data);

      if (!Array.isArray(annotations)) {
        throw new Error("Annotations file must contain an array");
      }

      // Validate annotation structure
      for (const annotation of annotations) {
        if (!annotation.nodeId || typeof annotation.nodeId !== "string") {
          throw new Error("Each annotation must have a nodeId string");
        }
      }

      return annotations;
    } catch (error: any) {
      throw new Error(`Failed to load annotations from file: ${error.message}`);
    }
  }

  /**
   * Filter annotations that don't have embeddings yet
   */
  private async filterUnembeddedAnnotations(
    annotations: Annotation[],
  ): Promise<Annotation[]> {
    if (!this.embeddingDb) {
      this.logger.debug(
        "📝 Embedding database not initialized - processing all annotations",
      );
      return annotations;
    }

    try {
      // Get existing embeddings for these node IDs
      const nodeIds = annotations.map((a) => a.nodeId);
      const existingEmbeddings =
        await this.embeddingDb.getExistingEmbeddings(nodeIds);

      // Filter out annotations that already have embeddings
      const unembeddedAnnotations = annotations.filter((annotation) => {
        return !existingEmbeddings[annotation.nodeId];
      });

      const skippedCount = annotations.length - unembeddedAnnotations.length;
      if (skippedCount > 0) {
        this.logger.info(
          `📝 Found ${skippedCount} existing embeddings, processing ${unembeddedAnnotations.length} new annotations`,
        );
      }

      return unembeddedAnnotations;
    } catch (error: any) {
      this.logger.warn(
        `⚠️  Error checking existing embeddings: ${error.message} - processing all annotations`,
      );
      return annotations;
    }
  }

  /**
   * Generate embeddings for annotations
   */
  private async generateEmbeddings(
    annotations: Annotation[],
    config: EmbeddingConfig,
  ): Promise<EmbeddingResult[]> {
    if (!this.generator) {
      throw new Error("Embedding generator not initialized");
    }

    const batchOptions = {
      batchSize: config.defaultBatchSize,
      maxConcurrency: config.maxConcurrency,
      memoryLimit: config.memoryLimit,
      progressCallback: config.enableProgressReporting
        ? (processed: number, total: number) => {
            const percent = ((processed / total) * 100).toFixed(1);
            this.logger.info(
              `📊 Progress: ${processed}/${total} (${percent}%)`,
            );
          }
        : undefined,
    };

    return await this.generator.batchProcess(annotations, batchOptions);
  }

  /**
   * Store embedding results
   */
  private async storeResults(
    results: EmbeddingResult[],
    outputPath?: string,
  ): Promise<void> {
    if (outputPath) {
      // Store to specified file
      await this.storeResultsToFile(results, outputPath);
    } else {
      // Store to database
      await this.storeResultsToDatabase(results);
    }
  }

  /**
   * Store results to JSON file
   */
  private async storeResultsToFile(
    results: EmbeddingResult[],
    filePath: string,
  ): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const data = JSON.stringify(results, null, 2);
      await fs.writeFile(filePath, data, "utf-8");
      this.logger.info(`💾 Results saved to: ${filePath}`);
    } catch (error: any) {
      throw new Error(`Failed to save results to file: ${error.message}`);
    }
  }

  /**
   * Store results to database
   */
  private async storeResultsToDatabase(
    results: EmbeddingResult[],
  ): Promise<void> {
    if (!this.embeddingDb) {
      throw new Error("Embedding database not initialized");
    }

    try {
      // Prepare model information
      const modelInfo = {
        name: results[0]?.modelUsed || "unknown",
        version: "1.0.0", // TODO: Get actual model version
        dimensions: results[0]?.embedding.length || 768,
      };

      // Store embeddings with configuration
      await this.embeddingDb.storeEmbeddings(
        results,
        modelInfo,
        this.config.embeddings,
      );

      this.logger.info(`� Stored ${results.length} embeddings to database`);
    } catch (error: any) {
      throw new Error(
        `Failed to store embeddings to database: ${error.message}`,
      );
    }
  }

  /**
   * Report embedding statistics
   */
  private reportStatistics(results: EmbeddingResult[]): void {
    if (results.length === 0) {
      return;
    }

    const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    const avgTime = totalTime / results.length;
    const avgConfidence =
      results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length;

    const stats = {
      totalEmbeddings: results.length,
      averageProcessingTime: `${avgTime.toFixed(2)}ms`,
      totalProcessingTime: `${totalTime.toFixed(2)}ms`,
      averageConfidence: avgConfidence.toFixed(3),
      embeddingDimensions: results[0]?.embedding.length || 0,
      modelUsed: results[0]?.modelUsed || "unknown",
    };

    this.logger.info("📈 Embedding Statistics:", stats);
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.generator) {
        await this.generator.shutdown();
        this.generator = null;
      }
    } catch (error: any) {
      this.logger.warn(`⚠️  Warning during cleanup: ${error.message}`);
    }
  }
}
