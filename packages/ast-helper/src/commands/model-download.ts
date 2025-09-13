/**
 * Model Download Command Handler
 * 
 * Downloads and caches AI models for embedding and processing.
 * Implements progress tracking, error handling, and verification.
 */

import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createLogger } from '../logging/index.js';
import { ModelRegistry } from '../models/config.js';
import { ModelDownloader } from '../models/downloader.js';
import { ModelCache } from '../models/cache.js';
import { FileVerifier } from '../models/verification.js';
import { ErrorHandler } from '../models/error-handling.js';
import type { Config } from '../types.js';
import type { DownloadProgress } from '../models/types.js';

/**
 * Options for model download command
 */
export interface ModelDownloadOptions {
  name: string;
  output?: string;
  force?: boolean;
  verify?: boolean;
  progress?: boolean;
  workspace?: string;
}

/**
 * Command handler for downloading models
 */
export class ModelDownloadCommandHandler {
  private logger = createLogger();
  private errorHandler = new ErrorHandler();

  async execute(options: ModelDownloadOptions, config: Config): Promise<void> {
    this.logger.info(`Downloading model: ${options.name}`);

    try {
      // Get model configuration
      const model = ModelRegistry.getModel(options.name);
      if (!model) {
        throw new Error(`Model '${options.name}' not found in registry`);
      }
      
      // Set up cache directory
      const cacheDir = options.output || join(config.outputDir, 'models');
      await mkdir(cacheDir, { recursive: true });

      // Initialize cache
      const cache = new ModelCache({
        cacheDir,
        maxCacheSize: 10 * 1024 * 1024 * 1024, // 10GB
        autoCleanup: true
      });
      await cache.initialize();

      // Check cache first (unless force)
      if (!options.force) {
        const cacheResult = await cache.checkCache(model);
        if (cacheResult.hit && cacheResult.filePath) {
          this.logger.info(`✅ Model ${options.name} already cached at: ${cacheResult.filePath}`);
          
          // Verify cached model if requested
          if (options.verify !== false) {
            await this.verifyModel(cacheResult.filePath, model);
          }
          
          return;
        }
      }

      // Set up downloader
      const downloader = new ModelDownloader();
      const filePath = join(cacheDir, `${model.name}-v${model.version}.${model.format}`);

      this.logger.info('📥 Starting download...');

      // Download the model with progress tracking
      const downloadedPath = await downloader.downloadModel(model, filePath, {
        maxRetries: 3,
        timeout: 300000, // 5 minutes
        onProgress: options.progress !== false ? this.createProgressCallback() : undefined,
        resumeDownload: true
      });

      // Verify downloaded file
      if (options.verify !== false) {
        await this.verifyModel(downloadedPath, model);
      }

      // Cache the model with metadata
      this.logger.info('💾 Caching model...');
      await cache.storeModel(model, downloadedPath);

      this.logger.info('✅ Download complete!');
      this.logger.info(`📁 Cached at: ${downloadedPath}`);

    } catch (error) {
      const errorInfo = this.errorHandler.categorizeError(error as Error, {
        modelName: options.name,
        operation: 'download'
      });
      
      // Attempt recovery
      const recovery = await this.errorHandler.attemptRecovery(errorInfo, {
        modelName: options.name,
        retryCount: 0
      });
      
      if (recovery.success) {
        this.logger.info(`✅ Recovery successful: ${recovery.message}`);
        return;
      }
      
      this.logger.error(`❌ Download failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Verify downloaded model
   */
  private async verifyModel(filePath: string, model: any): Promise<void> {
    this.logger.info('🔍 Verifying model integrity...');
    
    const verifier = new FileVerifier();
    const result = await verifier.verifyModelFile(filePath, model);
    
    if (result.valid) {
      this.logger.info('✅ Model verification passed');
    } else {
      this.logger.error('❌ Model verification failed:', result.errors);
      throw new Error(`Model verification failed: ${result.errors.join(', ')}`);
    }
  }

  /**
   * Create progress callback for downloads
   */
  private createProgressCallback(): (progress: DownloadProgress) => void {
    let lastUpdate = 0;
    const updateInterval = 1000; // Update every second

    return (progress: DownloadProgress) => {
      const now = Date.now();
      if (now - lastUpdate < updateInterval && progress.percentage < 100) {
        return;
      }
      
      lastUpdate = now;
      
      const percent = Math.round(progress.percentage);
      const speed = progress.speed.toFixed(1);
      const eta = progress.eta > 0 ? `${Math.round(progress.eta)}s` : '--';
      const downloaded = this.formatBytes(progress.bytesDownloaded);
      const total = this.formatBytes(progress.totalBytes);
      
      // Create progress bar
      const barWidth = 20;
      const filled = Math.round((progress.percentage / 100) * barWidth);
      const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
      
      process.stdout.write(`\r📥 [${bar}] ${percent}% (${downloaded}/${total}) ${speed} MB/s ETA: ${eta}`);
      
      if (progress.percentage >= 100) {
        process.stdout.write('\n');
      }
    };
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