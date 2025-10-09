/**
 * Rebuild Index Command Implementation
 *
 * Forces a complete rebuild of the HNSW vector index from stored vectors.
 * Useful for fixing corruption or optimizing index structure.
 */

import { VectorDatabaseFactory } from "../database/vector/factory.js";
import type { VectorDBConfig } from "../database/vector/types.js";
import { createLogger } from "../logging/index.js";
import type { Config } from "../types.js";

const logger = createLogger({ operation: "rebuild-index" });

/**
 * Options for the rebuild-index command
 */
export interface RebuildIndexOptions {
  /** Database output directory */
  outputDir?: string;
}

/**
 * Rebuild Index command handler
 */
export class RebuildIndexCommandHandler {
  /**
   * Execute the rebuild-index command
   */
  async execute(options: RebuildIndexOptions, config: Config): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info("🔄 Starting HNSW index rebuild...");

      // Get output directory from options or config
      const outputDir = options.outputDir || config.outputDir || ".astdb";

      // Create database configuration
      const dbConfig: VectorDBConfig = {
        dimensions: 768, // CodeBERT embedding size
        maxElements: 100000,
        M: config.indexParams?.M || 16,
        efConstruction: config.indexParams?.efConstruction || 200,
        space: "cosine",
        storageFile: `${outputDir}/vectors.db`,
        indexFile: `${outputDir}/hnsw.index`,
        autoSave: false, // Disable auto-save during rebuild
        saveInterval: 0,
      };

      // Initialize database
      const vectorDB = await VectorDatabaseFactory.create(dbConfig, {
        forceHNSW: true, // Use HNSW implementation for rebuild
      });
      await vectorDB.initialize(dbConfig);

      // Get pre-rebuild stats
      const preStats = await vectorDB.getStats();
      logger.info(`Found ${preStats.vectorCount} vectors in storage`);

      // Perform rebuild
      await vectorDB.rebuild();

      // Get post-rebuild stats
      const postStats = await vectorDB.getStats();
      const buildTime = Date.now() - startTime;

      logger.info("✅ Index rebuild completed successfully");
      logger.info(`   Vectors: ${postStats.vectorCount}`);
      logger.info(`   Build time: ${buildTime}ms`);
      logger.info(
        `   Memory usage: ${(postStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
      );

      // Shutdown database
      await vectorDB.shutdown();

      process.exit(0);
    } catch (error) {
      const err = error as Error;
      logger.error("❌ Index rebuild failed");
      logger.error(err.message);
      if (err.stack) {
        logger.error(err.stack);
      }
      process.exit(1);
    }
  }
}
