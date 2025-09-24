/**
 * @file HTTP Telemetry Transmitter
 * @description HTTP-based implementation for secure telemetry data transmission
 */

import { gzip } from "zlib";
import { promisify } from "util";
import type {
  TelemetryTransmitter,
  TransmissionResult,
  ConnectionStatus,
  TransmissionStats,
  TransmissionConfig,
  TransmissionFailure,
  TransmissionMetadata,
} from "./types.js";
import { DEFAULT_TRANSMISSION_CONFIG } from "./types.js";
import type { StoredEvent } from "../storage/types.js";
import { HttpRetryManager } from "./retry.js";
import { DiskOfflineQueue } from "./offline-queue.js";
import { RateLimiter } from "./rate-limiter.js";

const gzipAsync = promisify(gzip);

/**
 * HTTP-based telemetry transmitter with comprehensive features
 */
export class HttpTelemetryTransmitter implements TelemetryTransmitter {
  private config: TransmissionConfig;
  private retryManager: HttpRetryManager;
  private offlineQueue: DiskOfflineQueue;
  private rateLimiter: RateLimiter;
  private initialized = false;
  private stats: TransmissionStats;
  private transmissionTimer?: NodeJS.Timeout;

  constructor(config?: Partial<TransmissionConfig>) {
    this.config = { ...DEFAULT_TRANSMISSION_CONFIG, ...config };
    this.retryManager = new HttpRetryManager(this.config.retry);
    this.offlineQueue = new DiskOfflineQueue(this.config.offlineQueue);
    this.rateLimiter = new RateLimiter(this.config.rateLimit);

    // Initialize statistics
    this.stats = {
      totalAttempts: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      successRate: 0,
      eventsTransmitted: 0,
      eventsPending: 0,
      totalPayloadBytes: 0,
      averageDuration: 0,
      averageBatchSize: 0,
      connectionStatus: {
        connected: false,
        lastConnected: undefined,
        error: undefined,
      },
      retryStats: {
        totalAttempts: 0,
        successfulRetries: 0,
        exhaustedRetries: 0,
        averageAttempts: 0,
        retryReasons: {},
        successRateByAttempt: {},
      },
      errorBreakdown: {},
      hourlyRates: {},
    };
  }

  /**
   * Initialize the transmitter
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize offline queue if enabled
      if (this.config.offlineQueue.enabled) {
        await this.offlineQueue.initialize();
      }

      // Check initial connection
      await this.checkConnection();

      // Start automatic transmission timer
      this.startTransmissionTimer();

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize HTTP transmitter: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Start automatic transmission timer
   */
  private startTransmissionTimer(): void {
    if (this.transmissionTimer) {
      clearInterval(this.transmissionTimer);
    }

    this.transmissionTimer = setInterval(async () => {
      try {
        await this.processOfflineQueue();
      } catch (error) {
        console.error("Automatic transmission failed:", error);
      }
    }, this.config.transmissionInterval);
  }

  /**
   * Process offline queue for transmission
   */
  private async processOfflineQueue(): Promise<void> {
    if (!this.config.offlineQueue.enabled || !this.offlineQueue.isEnabled()) {
      return;
    }

    const queueInfo = await this.offlineQueue.getQueueInfo();
    if (queueInfo.size === 0) {
      return;
    }

    // Check connection before processing
    const connectionStatus = await this.checkConnection();
    if (!connectionStatus.connected) {
      return; // Skip transmission if offline
    }

    // Process queued events in batches
    const batchSize = Math.min(this.config.maxBatchSize, queueInfo.size);
    const events = await this.offlineQueue.dequeue(batchSize);

    if (events.length > 0) {
      const result = await this.transmit(events);

      // Remove successfully transmitted events from queue
      if (result.successfulEvents.length > 0) {
        // In a real implementation, we'd need to track which events were dequeued
        // and remove only the successful ones
      }
    }
  }

  /**
   * Transmit a batch of telemetry events
   */
  async transmit(events: StoredEvent[]): Promise<TransmissionResult> {
    if (!this.initialized) {
      throw new Error("Transmitter not initialized");
    }

    if (events.length === 0) {
      return this.createEmptyResult();
    }

    const startTime = Date.now();
    this.stats.totalAttempts++;

    try {
      // Check rate limiting
      await this.rateLimiter.checkLimit(events.length);

      // Prepare payload
      const payload = await this.preparePayload(events);

      // Perform transmission with retry logic
      const result = await this.retryManager.execute(
        () => this.performHttpTransmission(payload, events),
        {
          operationId: `transmission-${Date.now()}`,
          maxAttempts: this.config.retry.maxAttempts,
          baseDelay: this.config.retry.baseDelay,
          maxDelay: this.config.retry.maxDelay,
          strategy: this.config.retry.strategy,
        },
      );

      const duration = Date.now() - startTime;

      // Update statistics
      this.updateStatistics(result, duration, payload.length);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const failureResult = this.createFailureResult(
        events,
        error instanceof Error ? error : new Error("Unknown error"),
        duration,
      );

      // Queue failed events for offline transmission if enabled
      if (this.config.offlineQueue.enabled) {
        await this.offlineQueue.enqueue(events);
      }

      this.updateStatistics(failureResult, duration, 0);
      return failureResult;
    }
  }

  /**
   * Prepare payload for transmission
   */
  private async preparePayload(events: StoredEvent[]): Promise<string> {
    // Convert events to transmission format
    const transmissionEvents = events.map((event) => ({
      id: event.id,
      sessionId: event.sessionId,
      timestamp: event.timestamp.toISOString(),
      eventType: event.eventType,
      category: event.category,
      privacyLevel: event.privacyLevel,
      data: (event as any).data || {},
      metadata: event.metadata,
    }));

    const payload = JSON.stringify({
      version: "1.0",
      timestamp: new Date().toISOString(),
      events: transmissionEvents,
      metadata: {
        batchSize: events.length,
        compression: this.config.enableCompression,
        source: "ast-copilot-helper",
      },
    });

    // Apply compression if enabled and payload is large enough
    if (
      this.config.enableCompression &&
      payload.length > this.config.compressionThreshold
    ) {
      const compressed = await gzipAsync(Buffer.from(payload, "utf8"));
      return compressed.toString("base64");
    }

    return payload;
  }

  /**
   * Perform actual HTTP transmission
   */
  private async performHttpTransmission(
    payload: string,
    events: StoredEvent[],
  ): Promise<TransmissionResult> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "ast-copilot-helper/1.0",
      ...this.config.headers,
    };

    // Add compression header if payload is compressed
    if (payload.startsWith("{")) {
      // Not compressed
    } else {
      headers["Content-Encoding"] = "gzip";
      headers["Content-Type"] = "application/json; charset=utf-8";
    }

    // Add authentication if available
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const startTime = Date.now();

    try {
      // Use fetch for HTTP request (available in Node.js 18+)
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      const responseText = await response.text();

      if (response.ok) {
        // Parse successful response
        let responseData: any = {};
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          // Response might not be JSON, that's okay
        }

        const metadata: TransmissionMetadata = {
          transmissionId: responseData.transmissionId || `tx-${Date.now()}`,
          serverTimestamp: responseData.timestamp
            ? new Date(responseData.timestamp)
            : new Date(),
          serverDuration: responseData.processingTime,
          warnings: responseData.warnings,
          rateLimit: this.parseRateLimitHeaders(response),
        };

        return {
          success: true,
          transmitted: events.length,
          failed: 0,
          successfulEvents: events.map((e) => e.id),
          failedEvents: [],
          duration: Date.now() - startTime,
          payloadSize: payload.length,
          metadata,
        };
      } else {
        // Handle HTTP error
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }
    } catch (error) {
      throw new Error(
        `Transmission failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Parse rate limit headers from response
   */
  private parseRateLimitHeaders(
    response: Response,
  ): TransmissionMetadata["rateLimit"] {
    const remaining = response.headers.get("X-RateLimit-Remaining");
    const limit = response.headers.get("X-RateLimit-Limit");
    const reset = response.headers.get("X-RateLimit-Reset");

    if (remaining && limit) {
      return {
        remaining: parseInt(remaining, 10),
        limit: parseInt(limit, 10),
        resetAt: reset ? new Date(parseInt(reset, 10) * 1000) : new Date(),
      };
    }

    return undefined;
  }

  /**
   * Check connection status to transmission endpoint
   */
  async checkConnection(): Promise<ConnectionStatus> {
    try {
      const startTime = Date.now();

      // Perform a lightweight health check
      const healthCheckUrl = `${this.config.endpoint.replace(/\/+$/, "")}/health`;
      const response = await fetch(healthCheckUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(this.config.timeout / 2),
        headers: this.config.apiKey
          ? {
              Authorization: `Bearer ${this.config.apiKey}`,
            }
          : {},
      });

      const latency = Date.now() - startTime;
      const connected = response.ok;

      let serverInfo;
      if (connected) {
        try {
          const infoResponse = await fetch(
            `${this.config.endpoint.replace(/\/+$/, "")}/info`,
            {
              method: "GET",
              signal: AbortSignal.timeout(this.config.timeout / 2),
              headers: this.config.apiKey
                ? {
                    Authorization: `Bearer ${this.config.apiKey}`,
                  }
                : {},
            },
          );

          if (infoResponse.ok) {
            const info: any = await infoResponse.json();
            serverInfo = {
              version: info.version || "unknown",
              capabilities: info.capabilities || [],
              limits: {
                maxBatchSize:
                  info.limits?.maxBatchSize || this.config.maxBatchSize,
                maxPayloadSize:
                  info.limits?.maxPayloadSize || this.config.maxPayloadSize,
                rateLimitPerMinute:
                  info.limits?.rateLimitPerMinute ||
                  this.config.rateLimit.requestsPerMinute,
              },
            };
          }
        } catch (infoError) {
          // Server info is optional
        }
      }

      const status: ConnectionStatus = {
        connected,
        latency: connected ? latency : undefined,
        lastConnected: connected
          ? new Date()
          : this.stats.connectionStatus.lastConnected,
        error: connected ? undefined : `HTTP ${response.status}`,
        serverInfo,
      };

      this.stats.connectionStatus = status;
      return status;
    } catch (error) {
      const status: ConnectionStatus = {
        connected: false,
        lastConnected: this.stats.connectionStatus.lastConnected,
        error: error instanceof Error ? error.message : "Connection failed",
      };

      this.stats.connectionStatus = status;
      return status;
    }
  }

  /**
   * Get transmission statistics
   */
  async getStats(): Promise<TransmissionStats> {
    // Update retry stats from retry manager
    this.stats.retryStats = await this.retryManager.getRetryStats();

    // Calculate derived statistics
    this.stats.successRate =
      this.stats.totalAttempts > 0
        ? (this.stats.totalSuccessful / this.stats.totalAttempts) * 100
        : 0;

    this.stats.averageBatchSize =
      this.stats.totalSuccessful > 0
        ? this.stats.eventsTransmitted / this.stats.totalSuccessful
        : 0;

    return { ...this.stats };
  }

  /**
   * Update transmission configuration
   */
  async updateConfig(config: Partial<TransmissionConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    // Update dependent components
    if (config.retry) {
      this.retryManager.updateConfig(config.retry);
    }

    if (config.rateLimit) {
      this.rateLimiter.updateConfig(config.rateLimit);
    }

    if (config.transmissionInterval && this.transmissionTimer) {
      this.startTransmissionTimer(); // Restart with new interval
    }
  }

  /**
   * Close transmitter and cleanup resources
   */
  async close(): Promise<void> {
    if (this.transmissionTimer) {
      clearInterval(this.transmissionTimer);
      this.transmissionTimer = undefined;
    }

    if (this.offlineQueue) {
      await this.offlineQueue.clear();
    }

    this.initialized = false;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Create empty transmission result
   */
  private createEmptyResult(): TransmissionResult {
    return {
      success: true,
      transmitted: 0,
      failed: 0,
      successfulEvents: [],
      failedEvents: [],
      duration: 0,
      payloadSize: 0,
    };
  }

  /**
   * Create failure transmission result
   */
  private createFailureResult(
    events: StoredEvent[],
    error: Error,
    duration: number,
  ): TransmissionResult {
    const failures: TransmissionFailure[] = events.map((event) => ({
      eventId: event.id,
      error: error.message,
      retryable: this.isRetryableError(error),
      retryAfter: this.calculateRetryDelay(error),
    }));

    return {
      success: false,
      transmitted: 0,
      failed: events.length,
      successfulEvents: [],
      failedEvents: failures,
      duration,
      payloadSize: 0,
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Network errors are generally retryable
    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("connection")
    ) {
      return true;
    }

    // HTTP 5xx errors are retryable
    const httpMatch = message.match(/http (\d{3})/);
    if (httpMatch && httpMatch[1]) {
      const statusCode = parseInt(httpMatch[1], 10);
      return this.config.retry.retryableStatusCodes.includes(statusCode);
    }

    // Specific error codes
    return this.config.retry.retryableErrors.some((retryableError) =>
      message.includes(retryableError.toLowerCase()),
    );
  }

  /**
   * Calculate retry delay for error
   */
  private calculateRetryDelay(error: Error): number {
    // Extract retry-after header if present in error message
    const retryAfterMatch = error.message.match(/retry-after: (\d+)/i);
    if (retryAfterMatch && retryAfterMatch[1]) {
      return parseInt(retryAfterMatch[1], 10) * 1000;
    }

    // Use default base delay
    return this.config.retry.baseDelay;
  }

  /**
   * Update transmission statistics
   */
  private updateStatistics(
    result: TransmissionResult,
    duration: number,
    payloadSize: number,
  ): void {
    if (result.success) {
      this.stats.totalSuccessful++;
      this.stats.eventsTransmitted += result.transmitted;
      this.stats.lastSuccessfulTransmission = new Date();
    } else {
      this.stats.totalFailed++;

      // Update error breakdown
      for (const failure of result.failedEvents) {
        const errorType = this.categorizeError(failure.error);
        this.stats.errorBreakdown[errorType] =
          (this.stats.errorBreakdown[errorType] || 0) + 1;
      }
    }

    this.stats.lastAttempt = new Date();

    // Update averages
    const totalDuration =
      this.stats.averageDuration * (this.stats.totalAttempts - 1) + duration;
    this.stats.averageDuration = totalDuration / this.stats.totalAttempts;

    this.stats.totalPayloadBytes += payloadSize;

    // Update hourly rates
    const currentHour = new Date().toISOString().substr(0, 13); // YYYY-MM-DDTHH
    this.stats.hourlyRates[currentHour] =
      (this.stats.hourlyRates[currentHour] || 0) + result.transmitted;
  }

  /**
   * Categorize error for statistics
   */
  private categorizeError(error: string): string {
    const lowerError = error.toLowerCase();

    if (lowerError.includes("timeout")) {
      return "timeout";
    }
    if (lowerError.includes("network") || lowerError.includes("connection")) {
      return "network";
    }
    if (lowerError.includes("401") || lowerError.includes("unauthorized")) {
      return "auth";
    }
    if (lowerError.includes("429") || lowerError.includes("rate limit")) {
      return "rate_limit";
    }
    if (lowerError.includes("500") || lowerError.includes("internal server")) {
      return "server_error";
    }
    if (lowerError.includes("400") || lowerError.includes("bad request")) {
      return "client_error";
    }

    return "unknown";
  }
}

/**
 * Factory for creating HTTP transmitters
 */
export class TransmitterFactory {
  /**
   * Create HTTP transmitter with custom configuration
   */
  static createHttpTransmitter(
    config?: Partial<TransmissionConfig>,
  ): HttpTelemetryTransmitter {
    return new HttpTelemetryTransmitter(config);
  }

  /**
   * Create development transmitter (local endpoint)
   */
  static createDevelopmentTransmitter(): HttpTelemetryTransmitter {
    return new HttpTelemetryTransmitter({
      endpoint: "http://localhost:8080/telemetry",
      timeout: 5000,
      retry: {
        enabled: true,
        maxAttempts: 1,
        baseDelay: 100,
        maxDelay: 1000,
        strategy: "fixed",
        jitter: 0,
        retryableStatusCodes: [429, 500, 502, 503, 504],
        retryableErrors: ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND"],
      },
      offlineQueue: {
        enabled: false,
        maxSize: 100,
        maxSizeBytes: 1024 * 1024,
        storageType: "memory",
        persistent: false,
        cleanupOnStartup: true,
      },
    });
  }

  /**
   * Create production transmitter
   */
  static createProductionTransmitter(
    endpoint: string,
    apiKey: string,
  ): HttpTelemetryTransmitter {
    return new HttpTelemetryTransmitter({
      endpoint,
      apiKey,
      timeout: 30000,
      retry: {
        enabled: true,
        maxAttempts: 5,
        baseDelay: 2000,
        maxDelay: 120000,
        strategy: "jittered",
        jitter: 0.2,
        retryableStatusCodes: [429, 500, 502, 503, 504],
        retryableErrors: ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND"],
      },
      offlineQueue: {
        enabled: true,
        maxSize: 50000,
        maxSizeBytes: 100 * 1024 * 1024, // 100MB
        storageType: "disk",
        persistent: true,
        cleanupOnStartup: true,
      },
      rateLimit: {
        enabled: true,
        requestsPerMinute: 120,
        bytesPerMinute: 50 * 1024 * 1024, // 50MB
        strategy: "delay",
        burstLimit: 10,
      },
    });
  }
}
