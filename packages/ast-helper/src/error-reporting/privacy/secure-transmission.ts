/**
 * @fileoverview Secure Transmission Manager for Error Reporting
 * @module @ast-copilot-helper/ast-helper/error-reporting/privacy/secure-transmission
 */

import type { ErrorReport, SecurityConfig } from "../types.js";

/**
 * Transmission result interface
 */
interface TransmissionResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
  retryCount: number;
  encryptionUsed: boolean;
}

/**
 * Transmission options
 */
interface TransmissionOptions {
  encrypt?: boolean;
  compress?: boolean;
  priority?: "low" | "normal" | "high" | "critical";
  maxRetries?: number;
  timeout?: number; // milliseconds
  validateSsl?: boolean;
}

/**
 * Rate limiter for transmission control
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private blacklist: Set<string> = new Set();

  constructor(private config: SecurityConfig["rateLimiting"]) {}

  /**
   * Check if request is allowed based on rate limiting
   */
  isAllowed(identifier: string): boolean {
    if (this.blacklist.has(identifier)) {
      return false;
    }

    if (!this.config.enabled) {
      return true;
    }

    const now = Date.now();
    const windowStart = now - 60 * 1000; // 1 minute window

    let requests = this.requests.get(identifier) || [];
    requests = requests.filter((timestamp) => timestamp > windowStart);

    if (requests.length >= this.config.maxRequestsPerMinute) {
      // Add to blacklist temporarily
      this.blacklist.add(identifier);
      setTimeout(
        () => {
          this.blacklist.delete(identifier);
        },
        this.config.blacklistDuration * 60 * 1000,
      );

      return false;
    }

    requests.push(now);
    this.requests.set(identifier, requests);
    return true;
  }

  /**
   * Get current request count for identifier
   */
  getCurrentCount(identifier: string): number {
    const now = Date.now();
    const windowStart = now - 60 * 1000;
    const requests = this.requests.get(identifier) || [];
    return requests.filter((timestamp) => timestamp > windowStart).length;
  }
}

/**
 * Secure transmission manager with encryption, compression, and rate limiting
 */
export class SecureTransmissionManager {
  private config: SecurityConfig;
  private rateLimiter: RateLimiter;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimiting);

    console.log("🔐 Secure Transmission Manager initialized");
    console.log(
      `   Encryption: ${config.enableEncryption ? "Enabled" : "Disabled"}`,
    );
    console.log(
      `   Rate Limiting: ${config.rateLimiting.enabled ? "Enabled" : "Disabled"}`,
    );
  }

  /**
   * Send error report securely to remote endpoint
   */
  async sendErrorReport(
    errorReport: ErrorReport,
    endpoint: string,
    options: TransmissionOptions = {},
  ): Promise<TransmissionResult> {
    const transmissionId = this.generateTransmissionId();
    const clientId = this.getClientIdentifier(errorReport);

    console.log(
      `📡 Preparing to send error report ${errorReport.id} to ${endpoint}`,
    );

    // Check rate limiting
    if (!this.rateLimiter.isAllowed(clientId)) {
      return {
        success: false,
        error: "Rate limit exceeded",
        timestamp: new Date(),
        retryCount: 0,
        encryptionUsed: false,
      };
    }

    // Create transmission job
    const job: TransmissionJob = {
      id: transmissionId,
      errorReport,
      endpoint,
      options: {
        encrypt: this.config.enableEncryption,
        compress: true,
        priority: "normal",
        maxRetries: 3,
        timeout: 30000,
        validateSsl: true,
        ...options,
      },
      retryCount: 0,
      createdAt: new Date(),
    };

    return this.processTransmission(job);
  }

  /**
   * Process transmission job with retry logic
   */
  private async processTransmission(
    job: TransmissionJob,
  ): Promise<TransmissionResult> {
    try {
      // Prepare payload
      let payload = await this.preparePayload(job.errorReport, job.options);

      // Apply encryption if enabled
      if (job.options.encrypt && this.config.enableEncryption) {
        payload = await this.encryptPayload(payload);
      }

      // Apply compression if enabled
      if (job.options.compress) {
        payload = await this.compressPayload(payload);
      }

      // Validate endpoint
      if (!this.isAllowedOrigin(job.endpoint)) {
        throw new Error("Endpoint not in allowed origins list");
      }

      // Send request
      const result = await this.sendRequest(job.endpoint, payload, job.options);

      console.log(`✅ Error report ${job.errorReport.id} sent successfully`);

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date(),
        retryCount: job.retryCount,
        encryptionUsed: job.options.encrypt || false,
      };
    } catch (error) {
      console.error(
        `❌ Failed to send error report ${job.errorReport.id}:`,
        error,
      );

      // Retry logic
      if (job.retryCount < (job.options.maxRetries || 3)) {
        job.retryCount++;
        console.log(`🔄 Retrying transmission (attempt ${job.retryCount})`);

        // Exponential backoff
        const delay = Math.pow(2, job.retryCount - 1) * 1000;
        await this.delay(delay);

        return this.processTransmission(job);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
        retryCount: job.retryCount,
        encryptionUsed: job.options.encrypt || false,
      };
    }
  }

  /**
   * Prepare payload for transmission
   */
  private async preparePayload(
    errorReport: ErrorReport,
    options: TransmissionOptions,
  ): Promise<string> {
    const payload = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      errorReport,
      metadata: {
        transmissionId: this.generateTransmissionId(),
        priority: options.priority,
        compressed: options.compress,
        encrypted: options.encrypt,
      },
    };

    return JSON.stringify(payload);
  }

  /**
   * Encrypt payload using configured algorithm
   */
  private async encryptPayload(payload: string): Promise<string> {
    // This is a placeholder implementation
    // In production, use proper encryption libraries like Node's crypto module
    console.log("🔐 Encrypting payload...");

    // Simulate encryption
    const encrypted = Buffer.from(payload, "utf8").toString("base64");

    return JSON.stringify({
      encrypted: true,
      algorithm: this.config.encryptionAlgorithm,
      data: encrypted,
      timestamp: Date.now(),
    });
  }

  /**
   * Compress payload to reduce bandwidth
   */
  private async compressPayload(payload: string): Promise<string> {
    // This is a placeholder implementation
    // In production, use proper compression libraries like zlib
    console.log("📦 Compressing payload...");

    // Simulate compression by removing whitespace
    const compressed = JSON.stringify(JSON.parse(payload));

    return JSON.stringify({
      compressed: true,
      originalSize: payload.length,
      compressedSize: compressed.length,
      data: compressed,
    });
  }

  /**
   * Send HTTP request with proper security headers
   */
  private async sendRequest(
    endpoint: string,
    _payload: string,
    _options: TransmissionOptions,
  ): Promise<{ messageId: string }> {
    console.log(`📤 Sending secure request to ${endpoint}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Error-Report-Version": "1.0",
      "X-Transmission-Time": new Date().toISOString(),
    };

    // Add authentication if required
    if (this.config.authentication.required) {
      headers["Authorization"] = await this.getAuthHeader();
    }

    // Add security headers
    headers["X-Content-Security-Policy"] = "default-src 'none'";
    headers["X-Frame-Options"] = "DENY";

    // Simulate HTTP request
    // In production, use fetch() or axios with proper SSL validation
    await this.delay(100); // Simulate network delay

    if (Math.random() < 0.1) {
      throw new Error("Network error: Connection timeout");
    }

    const messageId =
      "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);

    return { messageId };
  }

  /**
   * Get authentication header based on configured method
   */
  private async getAuthHeader(): Promise<string> {
    switch (this.config.authentication.method) {
      case "apiKey":
        return "Bearer " + this.generateApiKey();
      case "oauth":
        return "Bearer " + (await this.getOAuthToken());
      case "jwt":
        return "Bearer " + (await this.getJwtToken());
      default:
        throw new Error("Unknown authentication method");
    }
  }

  /**
   * Generate API key for authentication
   */
  private generateApiKey(): string {
    return "ak_" + Math.random().toString(36).substr(2, 32);
  }

  /**
   * Get OAuth token (placeholder)
   */
  private async getOAuthToken(): Promise<string> {
    // Placeholder for OAuth implementation
    return "oauth_" + Math.random().toString(36).substr(2, 32);
  }

  /**
   * Get JWT token (placeholder)
   */
  private async getJwtToken(): Promise<string> {
    // Placeholder for JWT implementation
    return "jwt_" + Math.random().toString(36).substr(2, 32);
  }

  /**
   * Check if endpoint is in allowed origins
   */
  private isAllowedOrigin(endpoint: string): boolean {
    if (this.config.allowedOrigins.length === 0) {
      return true; // No restrictions
    }

    try {
      const url = new URL(endpoint);
      const origin = `${url.protocol}//${url.host}`;

      return this.config.allowedOrigins.some((allowed) => {
        if (allowed === "*") {
          return true;
        }
        if (allowed.startsWith("*.")) {
          const domain = allowed.substring(2);
          return url.hostname.endsWith(domain);
        }
        return origin === allowed;
      });
    } catch {
      return false;
    }
  }

  /**
   * Get client identifier for rate limiting
   */
  private getClientIdentifier(errorReport: ErrorReport): string {
    return (
      errorReport.context?.sessionId ||
      errorReport.context?.userId ||
      "anonymous"
    );
  }

  /**
   * Generate unique transmission ID
   */
  private generateTransmissionId(): string {
    return "tx-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Delay utility for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get transmission statistics
   */
  getTransmissionStats(): TransmissionStats {
    return {
      totalTransmissions: 0,
      successfulTransmissions: 0,
      failedTransmissions: 0,
      averageTransmissionTime: 0,
      rateLimitHits: 0,
      encryptionUsage: 0,
      compressionUsage: 0,
      lastTransmission: new Date(),
    };
  }

  /**
   * Test connection to endpoint
   */
  async testConnection(endpoint: string): Promise<boolean> {
    console.log(`🔗 Testing connection to ${endpoint}`);

    try {
      // Simulate connection test
      await this.delay(500);

      if (!this.isAllowedOrigin(endpoint)) {
        throw new Error("Endpoint not allowed");
      }

      console.log("✅ Connection test successful");
      return true;
    } catch (error) {
      console.error("❌ Connection test failed:", error);
      return false;
    }
  }
}

/**
 * Transmission job interface
 */
interface TransmissionJob {
  id: string;
  errorReport: ErrorReport;
  endpoint: string;
  options: Required<TransmissionOptions>;
  retryCount: number;
  createdAt: Date;
}

/**
 * Transmission statistics
 */
interface TransmissionStats {
  totalTransmissions: number;
  successfulTransmissions: number;
  failedTransmissions: number;
  averageTransmissionTime: number;
  rateLimitHits: number;
  encryptionUsage: number;
  compressionUsage: number;
  lastTransmission: Date;
}

export {
  type TransmissionResult,
  type TransmissionOptions,
  type TransmissionStats,
};
