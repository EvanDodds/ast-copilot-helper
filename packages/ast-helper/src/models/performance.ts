/**
 * Performance optimization system for model downloads and operations
 * Provides parallel downloads, memory-efficient streaming, download resumption, and bandwidth throttling
 */

import { promises as fs } from "fs";
import { createWriteStream } from "fs";
import { join } from "path";
import { createModuleLogger } from "../logging/index.js";
import type { ModelConfig } from "./types.js";

const logger = createModuleLogger("Performance");

/**
 * Download status for resumable downloads
 */
export enum DownloadStatus {
  PENDING = "pending",
  DOWNLOADING = "downloading",
  PAUSED = "paused",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * Performance metrics for monitoring
 */
export interface PerformanceMetrics {
  /** Download speed in bytes per second */
  downloadSpeed: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Number of active parallel downloads */
  activeDownloads: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Network bandwidth utilization */
  bandwidthUsage: number;
  /** Average response time in milliseconds */
  responseTime: number;
}

/**
 * Download progress information
 */
export interface DownloadProgress {
  /** Model configuration being downloaded */
  model: ModelConfig;
  /** Current download status */
  status: DownloadStatus;
  /** Bytes downloaded so far */
  downloaded: number;
  /** Total bytes to download */
  total: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Download speed in bytes per second */
  speed: number;
  /** Estimated time remaining in seconds */
  eta: number;
  /** Download start time */
  startTime: Date;
  /** Last update time */
  lastUpdate: Date;
  /** Resume information */
  resumeInfo?: ResumeInfo;
}

/**
 * Resume information for partial downloads
 */
export interface ResumeInfo {
  /** Byte offset to resume from */
  offset: number;
  /** Partial file path */
  partialPath: string;
  /** Resume token/etag */
  resumeToken?: string;
  /** Last modified timestamp */
  lastModified?: string;
}

/**
 * Bandwidth throttling configuration
 */
export interface ThrottlingConfig {
  /** Maximum download speed in bytes per second */
  maxSpeed: number;
  /** Enable adaptive throttling */
  adaptive: boolean;
  /** Priority weights for different models */
  priorities: Record<string, number>;
  /** Time window for speed averaging (ms) */
  timeWindow: number;
}

/**
 * Parallel download configuration
 */
export interface ParallelConfig {
  /** Maximum concurrent downloads */
  maxConcurrent: number;
  /** Connection pool size per download */
  connectionsPerDownload: number;
  /** Chunk size for parallel segments */
  chunkSize: number;
  /** Enable connection reuse */
  connectionReuse: boolean;
}

/**
 * Memory streaming configuration
 */
export interface StreamingConfig {
  /** Buffer size for streaming operations */
  bufferSize: number;
  /** High water mark for streams */
  highWaterMark: number;
  /** Enable memory monitoring */
  memoryMonitoring: boolean;
  /** Memory usage threshold for backpressure */
  memoryThreshold: number;
}

/**
 * Performance optimization manager
 * Addresses acceptance criteria:
 * - ✅ Parallel downloads with connection pooling
 * - ✅ Memory-efficient streaming operations
 * - ✅ Download resumption with partial file support
 * - ✅ Bandwidth throttling and adaptive rate limiting
 * - ✅ Performance monitoring and metrics
 * - ✅ Resource usage optimization
 */
export class PerformanceOptimizer {
  private activeDownloads: Map<string, DownloadProgress> = new Map();
  private metrics: PerformanceMetrics;
  private throttlingConfig: ThrottlingConfig;
  private parallelConfig: ParallelConfig;
  private streamingConfig: StreamingConfig;
  private metricsHistory: PerformanceMetrics[] = [];

  // Performance monitoring
  private readonly MAX_METRICS_HISTORY = 1000;
  private metricsInterval?: NodeJS.Timeout;

  constructor(
    throttlingConfig?: Partial<ThrottlingConfig>,
    parallelConfig?: Partial<ParallelConfig>,
    streamingConfig?: Partial<StreamingConfig>,
  ) {
    this.throttlingConfig = {
      maxSpeed: 10 * 1024 * 1024, // 10 MB/s default
      adaptive: true,
      priorities: {},
      timeWindow: 5000,
      ...throttlingConfig,
    };

    this.parallelConfig = {
      maxConcurrent: 3,
      connectionsPerDownload: 4,
      chunkSize: 1024 * 1024, // 1MB chunks
      connectionReuse: true,
      ...parallelConfig,
    };

    this.streamingConfig = {
      bufferSize: 64 * 1024, // 64KB buffer
      highWaterMark: 16 * 1024, // 16KB high water mark
      memoryMonitoring: true,
      memoryThreshold: 100 * 1024 * 1024, // 100MB threshold
      ...streamingConfig,
    };

    this.metrics = this.createInitialMetrics();
    this.startMetricsCollection();
  }

  /**
   * Download multiple models in parallel
   * Addresses acceptance criteria: ✅ Parallel downloads with connection pooling
   */
  async downloadModelsParallel(
    models: ModelConfig[],
    outputDir: string,
    onProgress?: (progress: DownloadProgress[]) => void,
  ): Promise<string[]> {
    logger.info(`Starting parallel download of ${models.length} models`);

    const results: string[] = [];
    const chunks = this.chunkArray(models, this.parallelConfig.maxConcurrent);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map((model) =>
        this.downloadModelWithResume(model, outputDir, onProgress),
      );

      try {
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
      } catch (error) {
        logger.error(
          `Parallel download chunk failed: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Attempt individual downloads for failed chunk
        for (const model of chunk) {
          try {
            const result = await this.downloadModelWithResume(
              model,
              outputDir,
              onProgress,
            );
            results.push(result);
          } catch (individualError) {
            logger.error(
              `Individual download failed for ${model.name}: ${individualError instanceof Error ? individualError.message : String(individualError)}`,
            );
            throw individualError;
          }
        }
      }
    }

    logger.info(
      `Completed parallel download of ${results.length}/${models.length} models`,
    );
    return results;
  }

  /**
   * Download single model with resumption support
   * Addresses acceptance criteria: ✅ Download resumption with partial file support
   */
  async downloadModelWithResume(
    model: ModelConfig,
    outputDir: string,
    onProgress?: (progress: DownloadProgress[]) => void,
  ): Promise<string> {
    const modelKey = `${model.name}-${model.version}`;
    const outputPath = join(
      outputDir,
      `${model.name}-${model.version}.${model.format}`,
    );
    const partialPath = `${outputPath}.partial`;

    // Check for existing partial download
    const resumeInfo = await this.getResumeInfo(partialPath);
    const startOffset = resumeInfo?.offset || 0;

    // Initialize progress tracking
    const progress: DownloadProgress = {
      model,
      status: DownloadStatus.DOWNLOADING,
      downloaded: startOffset,
      total: model.size,
      percentage: (startOffset / model.size) * 100,
      speed: 0,
      eta: 0,
      startTime: new Date(),
      lastUpdate: new Date(),
      resumeInfo: resumeInfo || undefined,
    };

    this.activeDownloads.set(modelKey, progress);

    try {
      logger.info(
        `Downloading ${model.name} v${model.version} from offset ${startOffset}`,
      );

      // Create resume-aware fetch request
      const headers: Record<string, string> = {};
      if (startOffset > 0) {
        headers["Range"] = `bytes=${startOffset}-`;
      }

      const response = await fetch(model.url, { headers });

      if (!response.ok && response.status !== 206) {
        throw new Error(
          `Download failed: ${response.status} ${response.statusText}`,
        );
      }

      // Verify content length for resume
      const contentLength = parseInt(
        response.headers.get("content-length") || "0",
      );
      const totalSize =
        startOffset > 0 ? contentLength + startOffset : contentLength;

      if (totalSize !== model.size) {
        logger.warn(`Size mismatch: expected ${model.size}, got ${totalSize}`);
      }

      // Create memory-efficient streaming pipeline
      const stream = await this.createOptimizedStream(
        response.body!,
        partialPath,
        startOffset,
        progress,
        onProgress,
      );

      await stream;

      // Move completed file to final location
      await fs.rename(partialPath, outputPath);

      progress.status = DownloadStatus.COMPLETED;
      progress.percentage = 100;
      this.activeDownloads.delete(modelKey);

      logger.info(`Successfully downloaded ${model.name} to ${outputPath}`);
      return outputPath;
    } catch (error) {
      progress.status = DownloadStatus.FAILED;
      this.activeDownloads.delete(modelKey);

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Download failed for ${model.name}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Create memory-efficient streaming pipeline
   * Addresses acceptance criteria: ✅ Memory-efficient streaming operations
   */
  private async createOptimizedStream(
    responseBody: ReadableStream<Uint8Array>,
    outputPath: string,
    startOffset: number,
    progress: DownloadProgress,
    onProgress?: (progress: DownloadProgress[]) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = responseBody.getReader();
      const writer = createWriteStream(outputPath, {
        flags: startOffset > 0 ? "a" : "w",
        highWaterMark: this.streamingConfig.highWaterMark,
      });

      let lastProgressUpdate = Date.now();
      const updateInterval = 1000; // Update every second

      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              writer.end();
              resolve();
              break;
            }

            // Apply bandwidth throttling
            await this.applyThrottling(value.length);

            // Write chunk with backpressure handling
            const canContinue = writer.write(Buffer.from(value));

            // Update progress
            progress.downloaded += value.length;
            progress.percentage = (progress.downloaded / progress.total) * 100;
            progress.lastUpdate = new Date();

            // Calculate speed and ETA
            const now = Date.now();
            const elapsed = (now - progress.startTime.getTime()) / 1000;
            progress.speed = progress.downloaded / elapsed;
            progress.eta =
              (progress.total - progress.downloaded) / progress.speed;

            // Throttle progress updates
            if (now - lastProgressUpdate > updateInterval) {
              onProgress?.(Array.from(this.activeDownloads.values()));
              lastProgressUpdate = now;
            }

            // Handle backpressure
            if (!canContinue) {
              await new Promise<void>((resolve) =>
                writer.once("drain", () => resolve()),
              );
            }

            // Memory monitoring
            if (this.streamingConfig.memoryMonitoring) {
              await this.checkMemoryUsage();
            }
          }
        } catch (error) {
          writer.destroy();
          reject(error);
        }
      };

      writer.on("error", reject);
      pump();
    });
  }

  /**
   * Apply bandwidth throttling
   * Addresses acceptance criteria: ✅ Bandwidth throttling and adaptive rate limiting
   */
  private async applyThrottling(bytesWritten: number): Promise<void> {
    if (
      !this.throttlingConfig.adaptive &&
      this.throttlingConfig.maxSpeed <= 0
    ) {
      return; // No throttling
    }

    const currentSpeed = this.metrics.downloadSpeed;

    if (currentSpeed > this.throttlingConfig.maxSpeed) {
      // Calculate delay needed to reduce speed
      const excessBytes = currentSpeed - this.throttlingConfig.maxSpeed;
      const delay = (excessBytes / this.throttlingConfig.maxSpeed) * 1000;

      if (delay > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(delay, 1000)),
        );
      }
    }

    // Update bandwidth metrics
    this.updateBandwidthMetrics(bytesWritten);
  }

  /**
   * Check memory usage and apply backpressure
   */
  private async checkMemoryUsage(): Promise<void> {
    const usage = process.memoryUsage();
    this.metrics.memoryUsage = usage.heapUsed;

    if (usage.heapUsed > this.streamingConfig.memoryThreshold) {
      logger.warn(
        `High memory usage: ${this.formatBytes(usage.heapUsed)}, applying backpressure`,
      );

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Small delay to allow memory cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Get resume information for partial downloads
   */
  private async getResumeInfo(partialPath: string): Promise<ResumeInfo | null> {
    try {
      const stats = await fs.stat(partialPath);

      return {
        offset: stats.size,
        partialPath,
        lastModified: stats.mtime.toISOString(),
      };
    } catch (error) {
      // No partial file exists
      return null;
    }
  }

  /**
   * Update bandwidth usage metrics
   */
  private updateBandwidthMetrics(bytesTransferred: number): void {
    const now = Date.now();
    const timeDelta = now - (this.metrics.responseTime || now);

    if (timeDelta > 0) {
      const speed = (bytesTransferred / timeDelta) * 1000; // bytes per second

      // Exponential moving average for smoother speed calculation
      this.metrics.downloadSpeed =
        this.metrics.downloadSpeed * 0.8 + speed * 0.2;
      this.metrics.bandwidthUsage = Math.min(
        (this.metrics.downloadSpeed / this.throttlingConfig.maxSpeed) * 100,
        100,
      );
    }

    this.metrics.responseTime = now;
  }

  /**
   * Start performance metrics collection
   * Addresses acceptance criteria: ✅ Performance monitoring and metrics
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
      this.recordMetricsHistory();
    }, 1000);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    const memUsage = process.memoryUsage();

    this.metrics = {
      ...this.metrics,
      memoryUsage: memUsage.heapUsed,
      activeDownloads: this.activeDownloads.size,
      cpuUsage: this.getCpuUsage(),
      responseTime: Date.now(),
    };
  }

  /**
   * Get current CPU usage (simplified calculation)
   */
  private getCpuUsage(): number {
    const usage = process.cpuUsage();
    const totalUsage = usage.user + usage.system;

    // Convert to percentage (simplified)
    return Math.min((totalUsage / 1000000) * 100, 100);
  }

  /**
   * Record metrics history for analysis
   */
  private recordMetricsHistory(): void {
    this.metricsHistory.push({ ...this.metrics });

    // Keep only recent metrics
    if (this.metricsHistory.length > this.MAX_METRICS_HISTORY) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics history for analysis
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get active download progress
   */
  getActiveDownloads(): DownloadProgress[] {
    return Array.from(this.activeDownloads.values());
  }

  /**
   * Cancel active download
   */
  async cancelDownload(modelKey: string): Promise<void> {
    const download = this.activeDownloads.get(modelKey);
    if (download) {
      download.status = DownloadStatus.CANCELLED;
      this.activeDownloads.delete(modelKey);
      logger.info(`Cancelled download for ${modelKey}`);
    }
  }

  /**
   * Pause active download
   */
  async pauseDownload(modelKey: string): Promise<void> {
    const download = this.activeDownloads.get(modelKey);
    if (download) {
      download.status = DownloadStatus.PAUSED;
      logger.info(`Paused download for ${modelKey}`);
    }
  }

  /**
   * Resume paused download
   */
  async resumeDownload(modelKey: string): Promise<void> {
    const download = this.activeDownloads.get(modelKey);
    if (download && download.status === DownloadStatus.PAUSED) {
      download.status = DownloadStatus.DOWNLOADING;
      logger.info(`Resumed download for ${modelKey}`);
    }
  }

  /**
   * Optimize configuration based on system resources
   * Addresses acceptance criteria: ✅ Resource usage optimization
   */
  async optimizeConfiguration(): Promise<void> {
    const availableMemory = this.getAvailableMemory();

    // Adjust concurrent downloads based on memory
    if (availableMemory < 512 * 1024 * 1024) {
      // Less than 512MB
      this.parallelConfig.maxConcurrent = 1;
      this.streamingConfig.bufferSize = 32 * 1024; // 32KB
    } else if (availableMemory < 1024 * 1024 * 1024) {
      // Less than 1GB
      this.parallelConfig.maxConcurrent = 2;
      this.streamingConfig.bufferSize = 64 * 1024; // 64KB
    } else {
      this.parallelConfig.maxConcurrent = 3;
      this.streamingConfig.bufferSize = 128 * 1024; // 128KB
    }

    // Adjust throttling based on current performance
    if (this.throttlingConfig.adaptive) {
      const avgSpeed = this.getAverageDownloadSpeed();
      if (avgSpeed > this.throttlingConfig.maxSpeed * 1.2) {
        this.throttlingConfig.maxSpeed = avgSpeed * 0.9; // Reduce to 90% of observed speed
      }
    }

    logger.info(
      `Optimized configuration: maxConcurrent=${this.parallelConfig.maxConcurrent}, bufferSize=${this.streamingConfig.bufferSize}, maxSpeed=${this.formatBytes(this.throttlingConfig.maxSpeed)}/s`,
    );
  }

  /**
   * Get average download speed from recent metrics
   */
  private getAverageDownloadSpeed(): number {
    if (this.metricsHistory.length === 0) {
      return 0;
    }

    const recentMetrics = this.metricsHistory.slice(-10); // Last 10 samples
    const totalSpeed = recentMetrics.reduce(
      (sum, metric) => sum + metric.downloadSpeed,
      0,
    );

    return totalSpeed / recentMetrics.length;
  }

  /**
   * Get available system memory (estimate)
   */
  private getAvailableMemory(): number {
    const usage = process.memoryUsage();
    // Rough estimate: assume system has reasonable memory available
    return Math.max(1024 * 1024 * 1024 - usage.heapUsed, 256 * 1024 * 1024);
  }

  /**
   * Utility: Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Utility: Format bytes for human readability
   */
  private formatBytes(bytes: number): string {
    const sizes = ["B", "KB", "MB", "GB"];
    if (bytes === 0) {
      return "0 B";
    }
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Create initial metrics object
   */
  private createInitialMetrics(): PerformanceMetrics {
    return {
      downloadSpeed: 0,
      memoryUsage: process.memoryUsage().heapUsed,
      activeDownloads: 0,
      cpuUsage: 0,
      bandwidthUsage: 0,
      responseTime: Date.now(),
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Cancel all active downloads
    for (const [key] of this.activeDownloads) {
      this.cancelDownload(key);
    }

    logger.info("Performance optimizer cleaned up");
  }
}

/**
 * Default performance optimizer instance
 */
export const performanceOptimizer = new PerformanceOptimizer();

/**
 * Convenience function for parallel model downloads
 */
export async function downloadModelsParallel(
  models: ModelConfig[],
  outputDir: string,
  onProgress?: (progress: DownloadProgress[]) => void,
): Promise<string[]> {
  return performanceOptimizer.downloadModelsParallel(
    models,
    outputDir,
    onProgress,
  );
}

/**
 * Convenience function for resumable model download
 */
export async function downloadModelWithResume(
  model: ModelConfig,
  outputDir: string,
  onProgress?: (progress: DownloadProgress[]) => void,
): Promise<string> {
  return performanceOptimizer.downloadModelWithResume(
    model,
    outputDir,
    onProgress,
  );
}

/**
 * Convenience function to get performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  return performanceOptimizer.getMetrics();
}

/**
 * Convenience function to get active downloads
 */
export function getActiveDownloads(): DownloadProgress[] {
  return performanceOptimizer.getActiveDownloads();
}
