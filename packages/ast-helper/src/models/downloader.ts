/**
 * HTTP download infrastructure with retry logic and progress tracking
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { ModelConfig, DownloadProgress } from './types.js';

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Download options
 */
export interface DownloadOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  
  /** Timeout in milliseconds */
  timeout?: number;
  
  /** Progress callback */
  onProgress?: ProgressCallback;
  
  /** Resume partial downloads */
  resumeDownload?: boolean;
}

/**
 * Download error with retry information
 */
export class DownloadError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly attempts: number,
    public readonly lastError?: Error
  ) {
    super(message);
    this.name = 'DownloadError';
  }
}

/**
 * Progress tracking utility class
 */
export class ProgressTracker {
  private startTime: number;
  private lastUpdate: number;
  private lastBytes: number;
  private speedHistory: number[] = [];
  private readonly maxSpeedHistory = 10;

  constructor(
    private totalBytes: number,
    private bytesDownloaded: number = 0
  ) {
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
    this.lastBytes = bytesDownloaded;
  }

  /**
   * Update progress with new downloaded bytes
   */
  updateProgress(bytesDownloaded: number): DownloadProgress {
    const now = Date.now();
    const timeDiff = now - this.lastUpdate;
    
    if (timeDiff >= 1000) { // Update speed calculation every second
      const bytesDiff = bytesDownloaded - this.lastBytes;
      const speed = bytesDiff / (timeDiff / 1000);
      
      // Maintain speed history for smoothing
      this.speedHistory.push(speed);
      if (this.speedHistory.length > this.maxSpeedHistory) {
        this.speedHistory.shift();
      }
      
      this.lastUpdate = now;
      this.lastBytes = bytesDownloaded;
    }
    
    this.bytesDownloaded = bytesDownloaded;
    return this.getProgress();
  }

  /**
   * Get current progress information
   */
  getProgress(): DownloadProgress {
    const percentage = this.totalBytes > 0 ? (this.bytesDownloaded / this.totalBytes) * 100 : 0;
    const speed = this.calculateSpeed();
    const eta = this.calculateETA(speed);

    return {
      bytesDownloaded: this.bytesDownloaded,
      totalBytes: this.totalBytes,
      percentage,
      speed,
      eta,
      phase: 'downloading'
    };
  }

  /**
   * Calculate average download speed
   */
  private calculateSpeed(): number {
    if (this.speedHistory.length === 0) {
      const elapsed = Date.now() - this.startTime;
      return elapsed > 0 ? this.bytesDownloaded / (elapsed / 1000) : 0;
    }
    
    // Return average of recent speed measurements
    return this.speedHistory.reduce((sum, speed) => sum + speed, 0) / this.speedHistory.length;
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateETA(speed: number): number {
    if (speed <= 0) return Infinity;
    const remaining = this.totalBytes - this.bytesDownloaded;
    return remaining / speed;
  }
}

/**
 * Core model downloader with retry logic and progress tracking
 */
export class ModelDownloader {
  private readonly defaultOptions: Required<DownloadOptions> = {
    maxRetries: 3,
    timeout: 300000, // 5 minutes
    onProgress: () => {}, // No-op default
    resumeDownload: true
  };

  constructor(
    private logger?: Console
  ) {}

  /**
   * Download a model file with retry logic and progress tracking
   */
  async downloadModel(
    modelConfig: ModelConfig, 
    destinationPath: string,
    options: DownloadOptions = {}
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    
    this.log(`Starting download: ${modelConfig.name} from ${modelConfig.url}`);
    this.log(`Destination: ${destinationPath}`);
    this.log(`Expected size: ${this.formatBytes(modelConfig.size)}`);

    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });

    try {
      await this.downloadWithRetry(
        modelConfig.url,
        destinationPath,
        modelConfig.size,
        opts
      );

      this.log(`Download completed: ${modelConfig.name}`);
      return destinationPath;

    } catch (error) {
      // Cleanup partial download on final failure
      try {
        await fs.unlink(destinationPath);
      } catch {
        // Ignore cleanup errors
      }

      throw new DownloadError(
        `Failed to download ${modelConfig.name} after ${opts.maxRetries} attempts`,
        modelConfig.url,
        opts.maxRetries,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Download with exponential backoff retry logic
   */
  private async downloadWithRetry(
    url: string,
    destinationPath: string,
    expectedSize: number,
    options: Required<DownloadOptions>
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        // Check if partial file exists and should be resumed
        let resumeFrom = 0;
        if (options.resumeDownload && attempt > 1) {
          try {
            const stats = await fs.stat(destinationPath);
            resumeFrom = stats.size;
            this.log(`Resuming download from byte ${resumeFrom}`);
          } catch {
            // File doesn't exist or can't be read, start from beginning
            resumeFrom = 0;
          }
        }

        await this.downloadFile(url, destinationPath, expectedSize, resumeFrom, options);
        return; // Success!

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log(`Download attempt ${attempt} failed: ${lastError.message}`);

        if (attempt < options.maxRetries) {
          // Exponential backoff: 2^attempt seconds
          const delayMs = Math.pow(2, attempt) * 1000;
          this.log(`Retrying in ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      }
    }

    throw lastError || new Error('Download failed for unknown reason');
  }

  /**
   * Download a file with progress tracking and timeout handling
   */
  private async downloadFile(
    url: string,
    destinationPath: string,
    expectedSize: number,
    resumeFrom: number,
    options: Required<DownloadOptions>
  ): Promise<void> {
    const controller = new AbortController();
    
    // Setup timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, options.timeout);

    try {
      // Prepare request headers for resuming
      const headers: Record<string, string> = {};
      if (resumeFrom > 0) {
        headers['Range'] = `bytes=${resumeFrom}-`;
      }

      // Make HTTP request
      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get content length and validate
      const contentLengthStr = response.headers.get('content-length');
      const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;
      const totalExpectedSize = resumeFrom > 0 ? expectedSize : contentLength;

      // Validate expected size
      if (resumeFrom === 0 && contentLength > 0 && Math.abs(contentLength - expectedSize) / expectedSize > 0.1) {
        this.log(`Warning: Content-Length (${contentLength}) differs significantly from expected size (${expectedSize})`);
      }

      // Setup progress tracking
      const progressTracker = new ProgressTracker(totalExpectedSize, resumeFrom);
      let downloadedBytes = resumeFrom;

      // Open file for writing (append mode if resuming)
      const fileStream = createWriteStream(destinationPath, { 
        flags: resumeFrom > 0 ? 'a' : 'w'
      });

      try {
        if (!response.body) {
          throw new Error('Response body is null');
        }

        // Stream the response body
        const reader = response.body.getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          // Write chunk to file
          await new Promise<void>((resolve, reject) => {
            fileStream.write(value, (error) => {
              if (error) reject(error);
              else resolve();
            });
          });

          downloadedBytes += value.length;
          
          // Update progress
          const progress = progressTracker.updateProgress(downloadedBytes);
          options.onProgress(progress);
        }

      } finally {
        fileStream.end();
      }

      // Final progress update
      const finalProgress = progressTracker.updateProgress(downloadedBytes);
      finalProgress.phase = 'complete';
      options.onProgress(finalProgress);

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Utility to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Log message if logger is available
   */
  private log(message: string): void {
    if (this.logger) {
      this.logger.log(`[ModelDownloader] ${message}`);
    }
  }
}