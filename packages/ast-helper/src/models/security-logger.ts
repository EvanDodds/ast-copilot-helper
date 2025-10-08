/**
 * Security Logging and Audit Trail
 *
 * Provides comprehensive security logging for model operations.
 *
 * Implements Issue #158 acceptance criteria:
 * - Comprehensive security logging
 * - Audit trail for all operations
 * - Security event tracking
 */

import { promises as fs } from "fs";
import { join } from "path";
import { createModuleLogger } from "../logging/index.js";

const logger = createModuleLogger("SecurityLogger");

/**
 * Security event types
 */
export enum SecurityEventType {
  MODEL_DOWNLOAD_STARTED = "model_download_started",
  MODEL_DOWNLOAD_COMPLETED = "model_download_completed",
  MODEL_DOWNLOAD_FAILED = "model_download_failed",
  VERIFICATION_SUCCESS = "verification_success",
  VERIFICATION_FAILED = "verification_failed",
  SIGNATURE_VERIFICATION_SUCCESS = "signature_verification_success",
  SIGNATURE_VERIFICATION_FAILED = "signature_verification_failed",
  QUARANTINE_FILE = "quarantine_file",
  UNAUTHORIZED_ACCESS_ATTEMPT = "unauthorized_access_attempt",
  SECURITY_POLICY_VIOLATION = "security_policy_violation",
}

/**
 * Security severity levels
 */
export enum SecuritySeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

/**
 * Security event data
 */
export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: SecuritySeverity;
  modelName?: string;
  modelVersion?: string;
  filePath?: string;
  userId?: string;
  ipAddress?: string;
  details: string;
  metadata?: Record<string, unknown>;
}

/**
 * Security Logger
 *
 * Logs and tracks security-related events
 */
export class SecurityLogger {
  private logDir: string;
  private logFile: string;
  private eventBuffer: SecurityEvent[] = [];
  private bufferSize = 50;
  private flushInterval = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(logDir = ".astdb/security/logs") {
    this.logDir = logDir;
    this.logFile = join(logDir, "security-audit.jsonl");
  }

  /**
   * Initialize security logger
   */
  async initialize(): Promise<void> {
    try {
      // Ensure log directory exists
      await fs.mkdir(this.logDir, { recursive: true });

      // Start flush timer
      this.startFlushTimer();

      logger.info("Security logger initialized", { logFile: this.logFile });
    } catch (error) {
      logger.error("Failed to initialize security logger", { error });
      throw error;
    }
  }

  /**
   * Log a security event
   */
  async logEvent(
    event: Omit<SecurityEvent, "id" | "timestamp">,
  ): Promise<void> {
    const fullEvent: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event,
    };

    // Add to buffer
    this.eventBuffer.push(fullEvent);

    // Log to console immediately for critical events
    if (event.severity === SecuritySeverity.CRITICAL) {
      logger.error("CRITICAL SECURITY EVENT", {
        type: event.type,
        details: event.details,
      });
    }

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Log model download started
   */
  async logDownloadStarted(
    modelName: string,
    modelVersion: string,
    url: string,
    userId?: string,
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.MODEL_DOWNLOAD_STARTED,
      severity: SecuritySeverity.INFO,
      modelName,
      modelVersion,
      userId,
      details: `Model download started from ${url}`,
      metadata: { url },
    });
  }

  /**
   * Log model download completed
   */
  async logDownloadCompleted(
    modelName: string,
    modelVersion: string,
    filePath: string,
    userId?: string,
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.MODEL_DOWNLOAD_COMPLETED,
      severity: SecuritySeverity.INFO,
      modelName,
      modelVersion,
      filePath,
      userId,
      details: `Model download completed successfully`,
    });
  }

  /**
   * Log verification success
   */
  async logVerificationSuccess(
    modelName: string,
    modelVersion: string,
    filePath: string,
    checksumMatched: boolean,
    signatureVerified: boolean,
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.VERIFICATION_SUCCESS,
      severity: SecuritySeverity.INFO,
      modelName,
      modelVersion,
      filePath,
      details: `Model verification successful`,
      metadata: {
        checksumMatched,
        signatureVerified,
      },
    });
  }

  /**
   * Log verification failure
   */
  async logVerificationFailed(
    modelName: string,
    modelVersion: string,
    filePath: string,
    reason: string,
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.VERIFICATION_FAILED,
      severity: SecuritySeverity.ERROR,
      modelName,
      modelVersion,
      filePath,
      details: `Model verification failed: ${reason}`,
    });
  }

  /**
   * Log quarantine action
   */
  async logQuarantine(
    modelName: string,
    modelVersion: string,
    filePath: string,
    reason: string,
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.QUARANTINE_FILE,
      severity: SecuritySeverity.WARNING,
      modelName,
      modelVersion,
      filePath,
      details: `File quarantined: ${reason}`,
    });
  }

  /**
   * Log unauthorized access attempt
   */
  async logUnauthorizedAccess(
    modelName: string,
    modelVersion: string,
    reason: string,
    userId?: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
      severity: SecuritySeverity.CRITICAL,
      modelName,
      modelVersion,
      userId,
      ipAddress,
      details: `Unauthorized access attempt: ${reason}`,
    });
  }

  /**
   * Log security policy violation
   */
  async logPolicyViolation(
    details: string,
    modelName?: string,
    userId?: string,
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.SECURITY_POLICY_VIOLATION,
      severity: SecuritySeverity.ERROR,
      modelName,
      userId,
      details,
    });
  }

  /**
   * Get recent security events
   */
  async getRecentEvents(
    limit = 100,
    filter?: {
      type?: SecurityEventType;
      severity?: SecuritySeverity;
      modelName?: string;
    },
  ): Promise<SecurityEvent[]> {
    try {
      const content = await fs.readFile(this.logFile, "utf-8");
      const lines = content
        .trim()
        .split("\n")
        .filter((l) => l.length > 0);

      const events = lines
        .map((line) => {
          try {
            const event = JSON.parse(line);
            return {
              ...event,
              timestamp: new Date(event.timestamp),
            } as SecurityEvent;
          } catch {
            return null;
          }
        })
        .filter((e): e is SecurityEvent => e !== null);

      // Apply filters
      let filtered = events;
      if (filter?.type) {
        filtered = filtered.filter((e) => e.type === filter.type);
      }
      if (filter?.severity) {
        filtered = filtered.filter((e) => e.severity === filter.severity);
      }
      if (filter?.modelName) {
        filtered = filtered.filter((e) => e.modelName === filter.modelName);
      }

      // Return most recent events
      return filtered.slice(-limit).reverse();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Flush buffered events to disk
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    try {
      const lines = this.eventBuffer
        .map((event) =>
          JSON.stringify({
            ...event,
            timestamp: event.timestamp.toISOString(),
          }),
        )
        .join("\n");

      await fs.appendFile(this.logFile, lines + "\n", "utf-8");

      logger.debug("Security events flushed", {
        count: this.eventBuffer.length,
      });

      this.eventBuffer = [];
    } catch (error) {
      logger.error("Failed to flush security events", { error });
    }
  }

  /**
   * Shutdown logger and flush remaining events
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
    logger.info("Security logger shut down");
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        logger.error("Auto-flush failed", { error });
      });
    }, this.flushInterval);
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Default security logger instance
 */
export const securityLogger = new SecurityLogger();
