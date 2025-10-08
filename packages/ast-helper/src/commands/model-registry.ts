/**
 * Model Registry Command Handler
 *
 * Manages model verification registry and displays verification status.
 * Addresses Issue #158 acceptance criteria:
 * - View model registry status
 * - List verified models
 * - View verification history
 * - Identify models needing re-verification
 */

import { createLogger } from "../logging/index.js";
import { getModelRegistry } from "../models/registry-storage.js";
import type { Config } from "../types.js";

const logger = createLogger();

/**
 * Options for model registry commands
 */
export interface ModelRegistryOptions {
  /** List all registered models */
  list?: boolean;
  /** Show details for a specific model */
  model?: string;
  /** Show verification history */
  history?: boolean;
  /** Show models needing re-verification */
  needsVerification?: boolean;
  /** Maximum age in days for re-verification check */
  maxAge?: number;
  /** Show registry statistics */
  stats?: boolean;
  /** Remove a model from registry */
  remove?: string;
}

/**
 * Command handler for model registry operations
 */
export class ModelRegistryCommandHandler {
  async execute(options: ModelRegistryOptions, config: Config): Promise<void> {
    try {
      const baseDir = config.model?.modelsDir || `${config.outputDir}/models`;
      const registry = getModelRegistry(baseDir);
      await registry.initialize();

      if (options.list) {
        await this.listModels(registry);
      } else if (options.model) {
        await this.showModelDetails(registry, options.model, options.history);
      } else if (options.needsVerification) {
        await this.showModelsNeedingVerification(
          registry,
          options.maxAge || 30,
        );
      } else if (options.stats) {
        await this.showStatistics(registry);
      } else if (options.remove) {
        await this.removeModel(registry, options.remove);
      } else {
        logger.error(
          "Please specify an operation: --list, --model, --needs-verification, --stats, or --remove",
        );
        throw new Error("No operation specified");
      }
    } catch (error) {
      logger.error(`❌ Registry operation failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * List all registered models
   */
  private async listModels(
    registry: Awaited<ReturnType<typeof getModelRegistry>>,
  ): Promise<void> {
    logger.info("📋 Registered Models:");
    logger.info("");

    const models = await registry.getAllModels();

    if (models.length === 0) {
      logger.info("No models registered yet.");
      return;
    }

    for (const model of models) {
      const statusIcon = model.checksumVerified ? "✅" : "❌";
      const date = new Date(model.downloadDate).toLocaleDateString();
      const size = this.formatBytes(model.fileSize);

      logger.info(`${statusIcon} ${model.modelName} (${model.version})`);
      logger.info(`   Downloaded: ${date}`);
      logger.info(`   Size: ${size}`);
      logger.info(`   Format: ${model.format}`);
      logger.info(
        `   Checksum Verified: ${model.checksumVerified ? "Yes" : "No"}`,
      );

      if (model.lastVerification) {
        const lastVerified = new Date(
          model.lastVerification,
        ).toLocaleDateString();
        logger.info(`   Last Verified: ${lastVerified}`);
      } else {
        logger.info(`   Last Verified: Never`);
      }

      logger.info("");
    }

    logger.info(`Total: ${models.length} model(s)`);
  }

  /**
   * Show details for a specific model
   */
  private async showModelDetails(
    registry: Awaited<ReturnType<typeof getModelRegistry>>,
    modelName: string,
    showHistory?: boolean,
  ): Promise<void> {
    const model = await registry.getModel(modelName);

    if (!model) {
      logger.error(`Model '${modelName}' not found in registry`);
      throw new Error(`Model not found: ${modelName}`);
    }

    logger.info(`📦 Model Details: ${model.modelName}`);
    logger.info("");
    logger.info(`Version: ${model.version}`);
    logger.info(`Format: ${model.format}`);
    logger.info(`Size: ${this.formatBytes(model.fileSize)}`);
    logger.info(`Downloaded: ${new Date(model.downloadDate).toLocaleString()}`);
    logger.info(`File Path: ${model.filePath}`);
    logger.info(`URL: ${model.url}`);
    logger.info("");
    logger.info(`Verification Status:`);
    logger.info(
      `  Checksum Verified: ${model.checksumVerified ? "✅ Yes" : "❌ No"}`,
    );
    logger.info(
      `  Signature Verified: ${model.signatureVerified ? "✅ Yes" : "❌ No"}`,
    );
    logger.info(`  Expected Checksum: ${model.checksum}`);

    if (model.lastVerification) {
      logger.info(
        `  Last Verification: ${new Date(model.lastVerification).toLocaleString()}`,
      );
    } else {
      logger.info(`  Last Verification: Never`);
    }

    if (showHistory) {
      logger.info("");
      logger.info("📜 Verification History:");
      const history = await registry.getVerificationHistory(modelName, 10);

      if (history.length === 0) {
        logger.info("  No verification history");
      } else {
        for (const entry of history) {
          const resultIcon = entry.result === "success" ? "✅" : "❌";
          const timestamp = new Date(entry.timestamp).toLocaleString();
          logger.info(`  ${resultIcon} ${timestamp} - ${entry.result}`);
          logger.info(
            `     Checksum Match: ${entry.checksumMatch ? "Yes" : "No"}`,
          );
          if (entry.signatureMatch !== null) {
            logger.info(
              `     Signature Match: ${entry.signatureMatch ? "Yes" : "No"}`,
            );
          }
          if (entry.errorMessage) {
            logger.info(`     Error: ${entry.errorMessage}`);
          }
        }
      }
    }
  }

  /**
   * Show models needing re-verification
   */
  private async showModelsNeedingVerification(
    registry: Awaited<ReturnType<typeof getModelRegistry>>,
    maxAgeDays: number,
  ): Promise<void> {
    logger.info(
      `🔍 Models needing re-verification (older than ${maxAgeDays} days):`,
    );
    logger.info("");

    const modelNames = await registry.getModelsNeedingVerification(maxAgeDays);

    if (modelNames.length === 0) {
      logger.info("All models are up to date!");
      return;
    }

    for (const modelName of modelNames) {
      const model = await registry.getModel(modelName);
      if (model) {
        if (model.lastVerification) {
          const daysAgo = Math.floor(
            (Date.now() - model.lastVerification) / (1000 * 60 * 60 * 24),
          );
          logger.info(`⚠️ ${modelName} - Last verified ${daysAgo} days ago`);
        } else {
          logger.info(`⚠️ ${modelName} - Never verified`);
        }
      }
    }

    logger.info("");
    logger.info(`Total: ${modelNames.length} model(s) need re-verification`);
    logger.info(`Run: ast-helper model-verify --all`);
  }

  /**
   * Show registry statistics
   */
  private async showStatistics(
    registry: Awaited<ReturnType<typeof getModelRegistry>>,
  ): Promise<void> {
    logger.info("📊 Model Registry Statistics:");
    logger.info("");

    const stats = await registry.getStatistics();

    logger.info(`Total Models: ${stats.totalModels}`);
    logger.info(`Verified Models: ${stats.verifiedModels} ✅`);
    logger.info(`Unverified Models: ${stats.unverifiedModels} ❌`);
    logger.info(`Total Storage Used: ${this.formatBytes(stats.totalSize)}`);

    if (stats.totalModels > 0) {
      const verifiedPercent = Math.round(
        (stats.verifiedModels / stats.totalModels) * 100,
      );
      logger.info(`Verification Rate: ${verifiedPercent}%`);
    }
  }

  /**
   * Remove a model from registry
   */
  private async removeModel(
    registry: Awaited<ReturnType<typeof getModelRegistry>>,
    modelName: string,
  ): Promise<void> {
    logger.info(`🗑️ Removing model from registry: ${modelName}`);

    const model = await registry.getModel(modelName);
    if (!model) {
      logger.error(`Model '${modelName}' not found in registry`);
      throw new Error(`Model not found: ${modelName}`);
    }

    await registry.deleteModel(modelName);
    logger.info(`✅ Model '${modelName}' removed from registry`);
    logger.info(`Note: Model file still exists at: ${model.filePath}`);
    logger.info(`To delete the file, run: rm "${model.filePath}"`);
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) {
      return "0 B";
    }

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
