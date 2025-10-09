/**
 * HTTP download infrastructure with retry logic and progress tracking
 */

import * as fs from "fs/promises";
import * as path from "path";
import { createWriteStream } from "fs";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { ModelConfig, DownloadProgress } from "./types.js";
import { SecurityHooksManager } from "./security-hooks.js";
import { securityLogger } from "./security-logger.js";
import type { SignedModelConfig } from "./signature.js";

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Proxy configuration for HTTP requests
 */
export interface ProxyConfig {
  /** Proxy host */
  host: string;

  /** Proxy port */
  port: number;

  /** Proxy protocol (http or https) */
  protocol?: "http" | "https";

  /** Authentication credentials */
  auth?: {
    username: string;
    password: string;
  };
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum bytes per second (0 = unlimited) */
  maxBytesPerSecond?: number;

  /** Minimum delay between chunks in milliseconds */
  minChunkDelay?: number;

  /** Chunk size for rate limiting in bytes */
  chunkSize?: number;
}

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

  /** HTTP proxy configuration */
  proxy?: ProxyConfig;

  /** Bandwidth throttling configuration */
  rateLimit?: RateLimitConfig;
}

/**
 * Download error with retry information
 */
export class DownloadError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly attempts: number,
    public readonly lastError?: Error,
  ) {
    super(message);
    this.name = "DownloadError";
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
    private bytesDownloaded = 0,
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

    if (timeDiff >= 1000) {
      // Update speed calculation every second
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
    const percentage =
      this.totalBytes > 0 ? (this.bytesDownloaded / this.totalBytes) * 100 : 0;
    const speed = this.calculateSpeed();
    const eta = this.calculateETA(speed);

    return {
      bytesDownloaded: this.bytesDownloaded,
      totalBytes: this.totalBytes,
      percentage,
      speed,
      eta,
      phase: "downloading",
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
    return (
      this.speedHistory.reduce((sum, speed) => sum + speed, 0) /
      this.speedHistory.length
    );
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateETA(speed: number): number {
    if (speed <= 0) {
      return Infinity;
    }
    const remaining = this.totalBytes - this.bytesDownloaded;
    return remaining / speed;
  }
}

/**
 * Rate limiting utility class
 */
export class RateLimiter {
  private lastChunkTime = 0;
  private readonly config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      maxBytesPerSecond: config.maxBytesPerSecond || 0, // 0 = unlimited
      minChunkDelay: config.minChunkDelay || 0,
      chunkSize: config.chunkSize || 64 * 1024, // 64KB default
    };
  }

  /**
   * Apply rate limiting delay based on chunk size
   */
  async throttle(chunkSize: number): Promise<void> {
    const now = Date.now();

    // Apply minimum chunk delay
    if (this.config.minChunkDelay > 0) {
      const timeSinceLastChunk = now - this.lastChunkTime;
      if (timeSinceLastChunk < this.config.minChunkDelay) {
        await this.delay(this.config.minChunkDelay - timeSinceLastChunk);
      }
    }

    // Apply bandwidth limiting
    if (this.config.maxBytesPerSecond > 0) {
      const expectedDurationMs =
        (chunkSize / this.config.maxBytesPerSecond) * 1000;
      const actualDurationMs = Date.now() - this.lastChunkTime;

      if (actualDurationMs < expectedDurationMs) {
        await this.delay(expectedDurationMs - actualDurationMs);
      }
    }

    this.lastChunkTime = Date.now();
  }

  /**
   * Get optimal chunk size based on rate limiting configuration
   */
  getOptimalChunkSize(): number {
    return this.config.chunkSize;
  }

  /**
   * Utility to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Core model downloader with retry logic and progress tracking
 */
export class ModelDownloader {
  private readonly defaultOptions: DownloadOptions = {
    maxRetries: 3,
    timeout: 300000, // 5 minutes
    onProgress: () => {
      // No-op default progress callback
    },
    resumeDownload: true,
    proxy: undefined,
    rateLimit: {},
  };

  private rateLimiter?: RateLimiter;
  private securityHooks: SecurityHooksManager;

  constructor(private logger?: Console) {
    this.securityHooks = new SecurityHooksManager();
  }

  /**
   * Download a model file with retry logic and progress tracking
   */
  async downloadModel(
    modelConfig: ModelConfig,
    destinationPath: string,
    options: DownloadOptions = {},
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };

    // Initialize rate limiter if needed
    if (opts.rateLimit && Object.keys(opts.rateLimit).length > 0) {
      this.rateLimiter = new RateLimiter(opts.rateLimit);
    } else {
      this.rateLimiter = undefined;
    }

    this.log(`Starting download: ${modelConfig.name} from ${modelConfig.url}`);
    this.log(`Destination: ${destinationPath}`);
    this.log(`Expected size: ${this.formatBytes(modelConfig.size)}`);

    // Log download started
    await securityLogger.logDownloadStarted(
      modelConfig.name,
      modelConfig.version || "unknown",
      modelConfig.url,
    );

    // Execute pre-download security hooks
    const signedModelConfig: SignedModelConfig =
      modelConfig as SignedModelConfig;
    const preHookResult =
      await this.securityHooks.executePreDownloadHooks(signedModelConfig);

    if (!preHookResult.allowed) {
      const errors = preHookResult.errors.join(", ");

      await securityLogger.logPolicyViolation(
        `Pre-download checks failed: ${errors}`,
        modelConfig.name,
      );

      throw new Error(`Security validation failed: ${errors}`);
    }

    if (opts.proxy) {
      this.log(
        `Using proxy: ${opts.proxy.protocol || "http"}://${opts.proxy.host}:${opts.proxy.port}`,
      );
    }

    if (this.rateLimiter) {
      const config = opts.rateLimit ?? {};
      const maxBytesPerSecond = config.maxBytesPerSecond ?? 0;
      this.log(
        `Rate limiting enabled: ${maxBytesPerSecond > 0 ? this.formatBytes(maxBytesPerSecond) + "/s" : "no bandwidth limit"}`,
      );
    }

    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });

    try {
      await this.downloadWithRetry(
        modelConfig.url,
        destinationPath,
        modelConfig.size,
        opts,
      );

      // Execute post-download security hooks
      const postHookResult = await this.securityHooks.executePostDownloadHooks(
        signedModelConfig,
        destinationPath,
      );

      if (!postHookResult.allowed) {
        const errors = postHookResult.errors.join(", ");

        await securityLogger.logVerificationFailed(
          modelConfig.name,
          modelConfig.version || "unknown",
          destinationPath,
          errors,
        );

        // Cleanup failed download
        try {
          await fs.unlink(destinationPath);
        } catch {
          // Ignore cleanup errors
        }

        throw new Error(`Post-download validation failed: ${errors}`);
      }

      // Log successful download and verification
      await securityLogger.logDownloadCompleted(
        modelConfig.name,
        modelConfig.version || "unknown",
        destinationPath,
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

      const maxRetries = opts.maxRetries ?? this.defaultOptions.maxRetries ?? 3;

      throw new DownloadError(
        `Failed to download ${modelConfig.name} after ${maxRetries} attempts`,
        modelConfig.url,
        maxRetries,
        error instanceof Error ? error : new Error(String(error)),
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
    options: DownloadOptions,
  ): Promise<void> {
    const maxRetries =
      options.maxRetries ?? this.defaultOptions.maxRetries ?? 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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

        await this.downloadFile(
          url,
          destinationPath,
          expectedSize,
          resumeFrom,
          options,
        );
        return; // Success!
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log(`Download attempt ${attempt} failed: ${lastError.message}`);

        if (attempt < maxRetries) {
          // Exponential backoff: 2^attempt seconds
          const delayMs = Math.pow(2, attempt) * 1000;
          this.log(`Retrying in ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      }
    }

    throw lastError || new Error("Download failed for unknown reason");
  }

  /**
   * Download a file with progress tracking and timeout handling
   */
  private async downloadFile(
    url: string,
    destinationPath: string,
    expectedSize: number,
    resumeFrom: number,
    options: DownloadOptions,
  ): Promise<void> {
    const timeout = options.timeout ?? this.defaultOptions.timeout ?? 300000;
    const controller = new AbortController();

    // Setup timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      // Prepare request headers for resuming
      const headers: Record<string, string> = {};
      if (resumeFrom > 0) {
        headers["Range"] = `bytes=${resumeFrom}-`;
      }

      // Create fetch options with proxy support
      const fetchOptions: RequestInit = {
        headers,
        signal: controller.signal,
      };

      // Configure proxy if provided
      if (options.proxy) {
        const proxyProtocol = options.proxy.protocol || "http";
        let proxyUrl = `${proxyProtocol}://${options.proxy.host}:${options.proxy.port}`;

        // Include authentication in URL if provided
        if (options.proxy.auth) {
          const { username, password } = options.proxy.auth;
          proxyUrl = `${proxyProtocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${options.proxy.host}:${options.proxy.port}`;
        }

        this.log(
          `Using proxy: ${proxyProtocol}://${options.proxy.host}:${options.proxy.port}`,
        );

        // Create proxy agent for HTTPS requests
        const proxyAgent = new HttpsProxyAgent(proxyUrl);

        // Add agent to fetch options (Node.js fetch supports agent via dispatcher)
        // @ts-expect-error - agent is supported by undici/node fetch but not in types
        fetchOptions.dispatcher = proxyAgent;
      }

      // Make HTTP request
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get content length and validate
      const contentLengthStr = response.headers.get("content-length");
      const contentLength = contentLengthStr
        ? parseInt(contentLengthStr, 10)
        : 0;
      const totalExpectedSize = resumeFrom > 0 ? expectedSize : contentLength;

      // Validate expected size
      if (
        resumeFrom === 0 &&
        contentLength > 0 &&
        Math.abs(contentLength - expectedSize) / expectedSize > 0.1
      ) {
        this.log(
          `Warning: Content-Length (${contentLength}) differs significantly from expected size (${expectedSize})`,
        );
      }

      // Setup progress tracking
      const progressTracker = new ProgressTracker(
        totalExpectedSize,
        resumeFrom,
      );
      let downloadedBytes = resumeFrom;

      // Open file for writing (append mode if resuming)
      const fileStream = createWriteStream(destinationPath, {
        flags: resumeFrom > 0 ? "a" : "w",
      });

      try {
        if (!response.body) {
          throw new Error("Response body is null");
        }

        // Stream the response body with rate limiting
        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Apply rate limiting if configured
          if (this.rateLimiter) {
            await this.rateLimiter.throttle(value.length);
          }

          // Write chunk to file
          await new Promise<void>((resolve, reject) => {
            fileStream.write(value, (error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          });

          downloadedBytes += value.length;

          // Update progress
          const progress = progressTracker.updateProgress(downloadedBytes);
          const onProgress =
            options.onProgress ??
            this.defaultOptions.onProgress ??
            (() => {
              // Default no-op
            });
          onProgress(progress);
        }
      } finally {
        fileStream.end();
      }

      // Final progress update
      const finalProgress = progressTracker.updateProgress(downloadedBytes);
      finalProgress.phase = "complete";
      const onProgress =
        options.onProgress ??
        this.defaultOptions.onProgress ??
        (() => {
          // Default no-op
        });
      onProgress(finalProgress);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Utility to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
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
