/**
 * Model Verification Command Handler
 *
 * Verifies integrity and security of downloaded models.
 */

import { createLogger } from "../logging/index.js";
import { ModelRegistry } from "../models/config.js";
import { FileVerifier } from "../models/verification.js";
import { ModelCache } from "../models/cache.js";
import type { Config } from "../types.js";

/**
 * Options for model verification command
 */
export interface ModelVerifyOptions {
  name?: string;
  all?: boolean;
  force?: boolean;
  workspace?: string;
}

/**
 * Command handler for verifying models
 */
export class ModelVerifyCommandHandler {
  private logger = createLogger();

  async execute(options: ModelVerifyOptions, config: Config): Promise<void> {
    try {
      const cache = new ModelCache({
        cacheDir: config.model?.modelsDir || `${config.outputDir}/models`,
        autoCleanup: false,
      });
      await cache.initialize();

      if (options.all) {
        await this.verifyAllModels(cache);
      } else if (options.name) {
        await this.verifySingleModel(options.name, cache);
      } else {
        this.logger.error("❌ Please specify --name <model> or --all");
        throw new Error("Model name or --all flag required");
      }
    } catch (error) {
      this.logger.error(`❌ Verification failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Verify a single model
   */
  private async verifySingleModel(
    modelName: string,
    cache: ModelCache,
  ): Promise<void> {
    this.logger.info(`🔍 Verifying model: ${modelName}`);

    const model = ModelRegistry.getModel(modelName);
    if (!model) {
      throw new Error(`Model '${modelName}' not found in registry`);
    }

    const cacheResult = await cache.checkCache(model);
    if (!cacheResult.hit || !cacheResult.filePath) {
      throw new Error(`Model '${modelName}' not found in cache`);
    }

    const verifier = new FileVerifier();
    const result = await verifier.verifyModelFile(cacheResult.filePath, model);

    if (result.valid) {
      this.logger.info(`✅ ${modelName} verification passed`);
    } else {
      this.logger.error(`❌ ${modelName} verification failed:`);
      result.errors.forEach((error) => this.logger.error(`  - ${error}`));
      throw new Error(`Verification failed for ${modelName}`);
    }
  }

  /**
   * Verify all cached models
   */
  private async verifyAllModels(cache: ModelCache): Promise<void> {
    this.logger.info("🔍 Verifying all cached models...");

    const stats = await cache.getStats();
    if (stats.totalModels === 0) {
      this.logger.info("No models found in cache");
      return;
    }

    let verified = 0;
    let failed = 0;

    for (const modelName of ModelRegistry.listModels()) {
      const model = ModelRegistry.getModel(modelName);
      if (!model) {
        continue;
      }

      try {
        const cacheResult = await cache.checkCache(model);
        if (!cacheResult.hit || !cacheResult.filePath) {
          this.logger.warn(`⚠️ ${modelName} not in cache, skipping`);
          continue;
        }

        const verifier = new FileVerifier();
        const result = await verifier.verifyModelFile(
          cacheResult.filePath,
          model,
        );

        if (result.valid) {
          this.logger.info(`✅ ${modelName} - Valid`);
          verified++;
        } else {
          this.logger.error(`❌ ${modelName} - Invalid: ${result.errors[0]}`);
          failed++;
        }
      } catch (error) {
        this.logger.error(
          `❌ ${modelName} - Error: ${(error as Error).message}`,
        );
        failed++;
      }
    }

    this.logger.info(
      `📊 Verification complete: ${verified} passed, ${failed} failed`,
    );
  }
}
