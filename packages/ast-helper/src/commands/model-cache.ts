/**
 * Model Cache Command Handler
 * 
 * Manages local model cache including listing, verification, and cleanup.
 */

import { createLogger } from '../logging/index.js';
import { ModelCache } from '../models/cache.js';
import type { Config } from '../types.js';

/**
 * Options for model cache command
 */
export interface ModelCacheOptions {
  list?: boolean;
  clean?: boolean;
  stats?: boolean;
  verify?: boolean;
  size?: boolean;
  workspace?: string;
}

/**
 * Command handler for model cache management
 */
export class ModelCacheCommandHandler {
  private logger = createLogger();

  async execute(options: ModelCacheOptions, config: Config): Promise<void> {
    try {
      // Initialize cache
      const cache = new ModelCache({
        cacheDir: config.model?.modelsDir || `${config.outputDir}/models`,
        maxCacheSize: 10 * 1024 * 1024 * 1024, // 10GB
        autoCleanup: true
      });
      await cache.initialize();

      // Handle different cache operations
      if (options.list) {
        await this.listCachedModels(cache);
      } else if (options.stats) {
        await this.showCacheStats(cache);
      } else if (options.clean) {
        await this.cleanCache(cache);
      } else if (options.verify) {
        await this.verifyCache(cache);
      } else {
        // Default: show cache status
        await this.showCacheStatus(cache);
      }

    } catch (error) {
      this.logger.error(`❌ Cache operation failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * List all cached models
   */
  private async listCachedModels(cache: ModelCache): Promise<void> {
    this.logger.info('📋 Cached Models:');
    
    const stats = await cache.getStats();
    
    if (stats.totalModels === 0) {
      this.logger.info('  No models cached');
      return;
    }

    this.logger.info(`  Found ${stats.totalModels} cached models`);
    this.logger.info(`  Total cache size: ${this.formatBytes(stats.totalSize)}`);
  }

  /**
   * Show cache statistics
   */
  private async showCacheStats(cache: ModelCache): Promise<void> {
    this.logger.info('📊 Cache Statistics:');
    
    const stats = await cache.getStats();
    
    this.logger.info(`  Total models: ${stats.totalModels}`);
    this.logger.info(`  Total size: ${this.formatBytes(stats.totalSize)}`);
    this.logger.info(`  Valid models: ${stats.validModels}`);
    this.logger.info(`  Invalid models: ${stats.invalidModels}`);
    
    const utilizationPercent = stats.totalSize > 0 
      ? ((stats.totalSize / (10 * 1024 * 1024 * 1024)) * 100).toFixed(1)
      : '0';
    this.logger.info(`  Cache utilization: ${utilizationPercent}%`);
  }

  /**
   * Clean the cache (remove old/invalid entries)
   */
  private async cleanCache(cache: ModelCache): Promise<void> {
    this.logger.info('🧹 Cleaning cache...');
    
    const beforeStats = await cache.getStats();
    
    // Cleanup old/invalid models
    const removed = await cache.cleanup();
    
    const afterStats = await cache.getStats();
    const freedSpace = beforeStats.totalSize - afterStats.totalSize;
    
    this.logger.info(`✅ Cache cleanup complete!`);
    this.logger.info(`  Removed ${removed} entries`);
    this.logger.info(`  Freed ${this.formatBytes(freedSpace)} of space`);
  }

  /**
   * Verify all cached models
   */
  private async verifyCache(cache: ModelCache): Promise<void> {
    this.logger.info('🔍 Verifying cached models...');
    
    const stats = await cache.getStats();
    
    if (stats.totalModels === 0) {
      this.logger.info('  No models to verify');
      return;
    }
    
    this.logger.info(`📊 Verification complete: ${stats.validModels} valid, ${stats.invalidModels} invalid`);
  }

  /**
   * Show general cache status
   */
  private async showCacheStatus(cache: ModelCache): Promise<void> {
    this.logger.info('📦 Cache Status:');
    
    const stats = await cache.getStats();
    
    this.logger.info(`  Total models: ${stats.totalModels}`);
    this.logger.info(`  Total size: ${this.formatBytes(stats.totalSize)}`);
    
    const utilizationPercent = ((stats.totalSize / (10 * 1024 * 1024 * 1024)) * 100).toFixed(1);
    this.logger.info(`  Cache utilization: ${utilizationPercent}% of 10GB limit`);
  }

  /**
   * Format bytes to human-readable string
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
}