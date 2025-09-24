/**
 * Model List Command Handler
 *
 * Lists available models and their details.
 */

import { createLogger } from "../logging/index.js";
import { ModelRegistry } from "../models/config.js";
import { ModelCache } from "../models/cache.js";
import type { Config } from "../types.js";

/**
 * Options for model list command
 */
export interface ModelListOptions {
  format?: string;
  cached?: boolean;
  available?: boolean;
  detailed?: boolean;
  workspace?: string;
}

/**
 * Command handler for listing models
 */
export class ModelListCommandHandler {
  private logger = createLogger();

  async execute(options: ModelListOptions, config: Config): Promise<void> {
    try {
      if (options.cached) {
        await this.listCachedModels(config);
      } else {
        await this.listAvailableModels(options);
      }
    } catch (error) {
      this.logger.error(
        `❌ List operation failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * List all available models
   */
  private async listAvailableModels(options: ModelListOptions): Promise<void> {
    this.logger.info("📋 Available Models:");

    const models = ModelRegistry.getAllModels();

    if (options.format) {
      const filteredModels = models.filter((m) => m.format === options.format);
      if (filteredModels.length === 0) {
        this.logger.info(`  No models found with format: ${options.format}`);
        return;
      }
      this.displayModels(filteredModels, options.detailed || false);
    } else {
      this.displayModels(models, options.detailed || false);
    }
  }

  /**
   * List cached models
   */
  private async listCachedModels(config: Config): Promise<void> {
    this.logger.info("💾 Cached Models:");

    const cache = new ModelCache({
      cacheDir: config.model?.modelsDir || `${config.outputDir}/models`,
      autoCleanup: false,
    });
    await cache.initialize();

    const stats = await cache.getStats();

    if (stats.totalModels === 0) {
      this.logger.info("  No models currently cached");
      return;
    }

    this.logger.info(
      `  Total cached: ${stats.totalModels} models (${this.formatBytes(stats.totalSize)})`,
    );
    this.logger.info(
      `  Valid: ${stats.validModels}, Invalid: ${stats.invalidModels}`,
    );

    // Check which models are cached
    for (const modelName of ModelRegistry.listModels()) {
      const model = ModelRegistry.getModel(modelName);
      if (!model) {
        continue;
      }

      const cacheResult = await cache.checkCache(model);
      if (cacheResult.hit) {
        const status = cacheResult.status === "valid" ? "✅" : "❌";
        this.logger.info(
          `  ${status} ${model.name} v${model.version} - ${model.format.toUpperCase()}`,
        );
      }
    }
  }

  /**
   * Display models with formatting
   */
  private displayModels(models: any[], detailed: boolean): void {
    for (const model of models) {
      this.logger.info(`  ${model.name} v${model.version}`);
      this.logger.info(`    Format: ${model.format.toUpperCase()}`);
      this.logger.info(`    Size: ${this.formatBytes(model.size)}`);
      this.logger.info(`    Dimensions: ${model.dimensions}`);

      if (detailed) {
        this.logger.info(`    URL: ${model.url}`);
        this.logger.info(
          `    Description: ${model.description || "No description"}`,
        );

        if (model.requirements) {
          this.logger.info(`    Requirements:`);
          if (model.requirements.memoryMB) {
            this.logger.info(`      Memory: ${model.requirements.memoryMB} MB`);
          }
          if (model.requirements.architecture) {
            this.logger.info(
              `      Architecture: ${model.requirements.architecture.join(", ")}`,
            );
          }
          if (model.requirements.platforms) {
            this.logger.info(
              `      Platforms: ${model.requirements.platforms.join(", ")}`,
            );
          }
        }
      }

      console.log(); // Empty line for readability
    }
  }

  /**
   * Format bytes to human-readable string
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
}
