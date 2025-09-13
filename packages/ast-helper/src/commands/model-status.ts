/**
 * Model Status Command Handler
 * 
 * Shows comprehensive status of model management system.
 */

import { createLogger } from '../logging/index.js';
import { ModelRegistry } from '../models/config.js';
import { ModelCache } from '../models/cache.js';
import { PerformanceOptimizer } from '../models/performance.js';
import type { Config } from '../types.js';

/**
 * Options for model status command
 */
export interface ModelStatusOptions {
  name?: string;
  detailed?: boolean;
  performance?: boolean;
  workspace?: string;
}

/**
 * Command handler for showing model status
 */
export class ModelStatusCommandHandler {
  private logger = createLogger();

  async execute(options: ModelStatusOptions, config: Config): Promise<void> {
    try {
      if (options.name) {
        await this.showModelStatus(options.name, config, options.detailed || false);
      } else {
        await this.showSystemStatus(config, options);
      }

    } catch (error) {
      this.logger.error(`❌ Status check failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Show status for a specific model
   */
  private async showModelStatus(modelName: string, config: Config, detailed: boolean): Promise<void> {
    this.logger.info(`📊 Status for model: ${modelName}`);

    const model = ModelRegistry.getModel(modelName);
    if (!model) {
      this.logger.error(`❌ Model '${modelName}' not found in registry`);
      return;
    }

    this.logger.info('Registry Information:');
    this.logger.info(`  Name: ${model.name}`);
    this.logger.info(`  Version: ${model.version}`);
    this.logger.info(`  Format: ${model.format.toUpperCase()}`);
    this.logger.info(`  Size: ${this.formatBytes(model.size)}`);
    this.logger.info(`  Dimensions: ${model.dimensions}`);

    if (detailed && model.description) {
      this.logger.info(`  Description: ${model.description}`);
    }

    // Check cache status
    const cache = new ModelCache({
      cacheDir: config.model?.modelsDir || `${config.outputDir}/models`,
      autoCleanup: false
    });
    await cache.initialize();

    const cacheResult = await cache.checkCache(model);
    this.logger.info('Cache Status:');
    if (cacheResult.hit) {
      this.logger.info(`  ✅ Cached at: ${cacheResult.filePath}`);
      this.logger.info(`  Status: ${cacheResult.status}`);
      
      if (cacheResult.metadata) {
        const metadata = cacheResult.metadata;
        this.logger.info(`  Downloaded: ${metadata.downloadedAt.toLocaleString()}`);
        this.logger.info(`  Verified: ${metadata.verified ? 'Yes' : 'No'}`);
        
        if (metadata.usageStats) {
          this.logger.info(`  Usage: ${metadata.usageStats.loadCount} loads`);
          this.logger.info(`  Last used: ${metadata.usageStats.lastUsed.toLocaleString()}`);
        }
      }
    } else {
      this.logger.info(`  ❌ Not cached`);
      this.logger.info(`  Reason: ${cacheResult.reason || 'Unknown'}`);
    }
  }

  /**
   * Show overall system status
   */
  private async showSystemStatus(config: Config, options: ModelStatusOptions): Promise<void> {
    this.logger.info('🏗️ Model Management System Status');

    // Registry information
    const models = ModelRegistry.getAllModels();
    this.logger.info('Registry:');
    this.logger.info(`  Available models: ${models.length}`);
    
    const formatCounts = models.reduce((acc, model) => {
      acc[model.format] = (acc[model.format] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(formatCounts).forEach(([format, count]) => {
      this.logger.info(`    ${format.toUpperCase()}: ${count} models`);
    });

    // Cache information
    const cache = new ModelCache({
      cacheDir: config.model?.modelsDir || `${config.outputDir}/models`,
      autoCleanup: false
    });
    await cache.initialize();

    const cacheStats = await cache.getStats();
    this.logger.info('Cache:');
    this.logger.info(`  Total models: ${cacheStats.totalModels}`);
    this.logger.info(`  Total size: ${this.formatBytes(cacheStats.totalSize)}`);
    this.logger.info(`  Valid models: ${cacheStats.validModels}`);
    this.logger.info(`  Invalid models: ${cacheStats.invalidModels}`);
    
    const maxCacheSize = 10 * 1024 * 1024 * 1024; // 10GB
    const utilization = (cacheStats.totalSize / maxCacheSize * 100).toFixed(1);
    this.logger.info(`  Utilization: ${utilization}% (${this.formatBytes(cacheStats.totalSize)} / 10GB)`);

    // Configuration
    this.logger.info('Configuration:');
    this.logger.info(`  Models directory: ${config.model?.modelsDir || 'Default'}`);
    this.logger.info(`  Download timeout: ${config.model?.downloadTimeout || 'Default'} ms`);
    this.logger.info(`  Max concurrent downloads: ${config.model?.maxConcurrentDownloads || 'Default'}`);
    this.logger.info(`  Progress reporting: ${config.model?.showProgress !== false ? 'Enabled' : 'Disabled'}`);

    // Performance metrics
    if (options.performance) {
      const optimizer = new PerformanceOptimizer();
      const metrics = optimizer.getMetrics();
      
      this.logger.info('Performance Metrics:');
      this.logger.info(`  Active downloads: ${metrics.activeDownloads}`);
      this.logger.info(`  Download speed: ${this.formatBytes(metrics.downloadSpeed)}/s`);
      this.logger.info(`  Memory usage: ${this.formatBytes(metrics.memoryUsage)}`);
      this.logger.info(`  Response time: ${metrics.responseTime.toFixed(2)}ms`);
    }

    // Health status
    const healthStatus = this.calculateHealthStatus(cacheStats, models.length);
    this.logger.info(`Overall Health: ${healthStatus}`);
  }

  /**
   * Calculate overall system health
   */
  private calculateHealthStatus(cacheStats: any, totalModels: number): string {
    if (cacheStats.invalidModels > 0) {
      return '⚠️ Warning (invalid models detected)';
    }
    
    if (cacheStats.totalModels === 0) {
      return '💤 Idle (no models cached)';
    }
    
    const cacheRatio = cacheStats.totalModels / totalModels;
    if (cacheRatio > 0.8) {
      return '✅ Excellent (most models cached)';
    } else if (cacheRatio > 0.5) {
      return '👍 Good (some models cached)';
    } else {
      return '🟡 Fair (few models cached)';
    }
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