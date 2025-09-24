/**
 * Privacy-respecting telemetry manager implementation
 */

import crypto from "crypto";
import os from "os";
import { MAX_BUFFER_SIZE } from "./types.js";
import {
  mergeTelemetryConfig,
  getEnvironmentConfig,
  validateTelemetryConfig,
  isTelemetryEnabled,
  getTelemetryFeatures,
} from "./config.js";

/**
 * Privacy-respecting telemetry manager implementation
 */
export class PrivacyRespectingTelemetryManager implements TelemetryManager {
  private config: TelemetryConfig;
  private buffer: TelemetryEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private retryTimer?: NodeJS.Timeout;
  private sessionId: string;
  private isInitialized = false;
  private isShutdown = false;
  private features: TelemetryFeatures;

  // Component dependencies (will be injected)
  private consentManager?: IConsentManager;
  private dataCollector?: DataCollector;
  private anonymizer?: IDataAnonymizer;
  private sender?: TelemetrySender;

  constructor(config?: Partial<TelemetryConfig>) {
    // Merge user config with defaults and environment overrides
    const envConfig = getEnvironmentConfig();
    this.config = mergeTelemetryConfig({ ...config, ...envConfig });

    // Generate session ID
    this.sessionId = this.generateSessionId();

    // Set features based on privacy level
    this.features = getTelemetryFeatures(this.config.privacyLevel);
  }

  /**
   * Initialize the telemetry system
   */
  async initialize(config?: TelemetryConfig): Promise<void> {
    if (this.isInitialized && !this.isShutdown) {
      throw new Error("Telemetry manager is already initialized");
    }

    if (this.isShutdown) {
      throw new Error("Telemetry manager has been shutdown");
    }

    // Validate configuration before trying to initialize
    if (config) {
      const validationErrors = validateTelemetryConfig(config);
      if (validationErrors.length > 0) {
        throw new Error(
          `Invalid telemetry configuration: ${validationErrors.join(", ")}`,
        );
      }
    }

    try {
      console.log("Initializing telemetry system...");

      // Update configuration if provided
      if (config) {
        this.config = mergeTelemetryConfig(config, this.config);
      }

      // Update features based on privacy level
      this.features = getTelemetryFeatures(this.config.privacyLevel);

      // Initialize consent management with real implementation
      try {
        this.consentManager = new PrivacyRespectingConsentManager(
          this.config,
          "1.0.0",
          "1.0.0",
        );
        await this.consentManager.initialize();
      } catch (error: any) {
        console.warn(
          "Failed to initialize PrivacyRespectingConsentManager, using stub:",
          error.message,
        );
        this.consentManager = new ConsentManager(this.config);
        await this.consentManager.initialize();
      }

      // Check if telemetry should be enabled
      if (!this.config.enabled || !isTelemetryEnabled(this.config)) {
        console.log(
          "Telemetry disabled or not available - running in privacy mode",
        );
        this.isInitialized = true;
        return;
      }

      // Check user consent
      if (!(await this.hasUserConsent())) {
        console.log("Telemetry disabled - no user consent");
        this.isInitialized = true;
        return;
      }

      // Initialize data collector (stub for now)
      this.dataCollector = new DataCollector(this.config, this.features);
      await this.dataCollector.initialize();

      // Initialize data anonymizer with real implementation
      try {
        this.anonymizer = new PrivacyRespectingDataAnonymizer({
          privacyLevel: this.config.privacyLevel,
        });
        await this.anonymizer.initialize();
      } catch (error: any) {
        console.warn(
          "Failed to initialize PrivacyRespectingDataAnonymizer, using stub:",
          error.message,
        );
        this.anonymizer = new DataAnonymizer(this.config.anonymization);
        await this.anonymizer.initialize();
      }

      // Initialize telemetry sender (stub for now)
      this.sender = new TelemetrySender(this.config);
      await this.sender.initialize();

      // Start periodic flush
      this.startPeriodicFlush();

      this.isInitialized = true;
      console.log("Telemetry system initialized successfully");
    } catch (error) {
      console.error("Failed to initialize telemetry system:", error);
      // Don't throw - fail gracefully and continue without telemetry
      this.isInitialized = true;
    }
  }

  /**
   * Collect comprehensive usage metrics
   */
  async collectUsageMetrics(): Promise<UsageMetrics> {
    if (!this.isInitialized || !(await this.hasUserConsent())) {
      return this.createEmptyMetrics();
    }

    try {
      console.log("Collecting usage metrics...");

      // Collect system information
      const systemInfo = await this.collectSystemInfo();

      // Collect usage data from data collector
      const commandUsage = this.dataCollector
        ? await this.dataCollector.collectCommandUsage()
        : [];

      const featureUsage = this.dataCollector
        ? await this.dataCollector.collectFeatureUsage()
        : [];

      const performanceData = this.dataCollector
        ? await this.dataCollector.collectPerformanceData()
        : this.createEmptyPerformanceData();

      const errorSummaries = this.dataCollector
        ? await this.dataCollector.collectErrorSummaries()
        : [];

      const metrics: UsageMetrics = {
        sessionId: this.sessionId,
        userId: await this.getAnonymousUserId(),
        timestamp: new Date(),
        version: systemInfo.version,
        platform: systemInfo.platform,
        nodeVersion: systemInfo.nodeVersion,
        commands: commandUsage,
        features: featureUsage,
        performance: performanceData,
        errors: errorSummaries,
      };

      // Anonymize sensitive data
      const anonymizedMetrics = this.anonymizer
        ? await this.anonymizer.anonymizeUsageMetrics(metrics)
        : metrics;

      console.log("Usage metrics collected successfully");
      return anonymizedMetrics;
    } catch (error) {
      console.error("Failed to collect usage metrics:", error);
      return this.createEmptyMetrics();
    }
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(feature: string, data?: any): Promise<void> {
    if (
      !this.isInitialized ||
      !(await this.hasUserConsent()) ||
      !this.features.featureAdoption
    ) {
      return;
    }

    try {
      const event: FeatureUsageEvent = {
        type: "feature_usage",
        timestamp: new Date(),
        sessionId: this.sessionId,
        eventId: this.generateEventId(),
        userId: await this.getAnonymousUserId(),
        feature,
        data: await this.anonymizeData(data || {}),
      };

      await this.bufferEvent(event);
      console.log(`Feature usage tracked: ${feature}`);
    } catch (error) {
      console.error(`Failed to track feature usage for ${feature}:`, error);
    }
  }

  /**
   * Record performance metrics
   */
  async recordPerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    if (
      !this.isInitialized ||
      !(await this.hasUserConsent()) ||
      !this.features.performanceMonitoring
    ) {
      return;
    }

    try {
      const event: PerformanceEvent = {
        type: "performance",
        timestamp: new Date(),
        sessionId: this.sessionId,
        eventId: this.generateEventId(),
        userId: await this.getAnonymousUserId(),
        operation: metrics.operation,
        duration: metrics.duration,
        memoryUsage: Math.round(metrics.memoryUsage / 1024 / 1024), // Convert to MB
        success: metrics.success,
        errorType: metrics.errorType,
        fileCountRange: this.quantifyFileCount(metrics.fileCount),
        codebaseSizeRange: this.quantifyCodebaseSize(metrics.codebaseSize),
        data: {},
      };

      await this.bufferEvent(event);
      console.log(
        `Performance metrics recorded: ${metrics.operation} (${metrics.duration}ms)`,
      );
    } catch (error) {
      console.error("Failed to record performance metrics:", error);
    }
  }

  /**
   * Report error with sanitization
   */
  async reportError(error: ErrorReport): Promise<void> {
    if (
      !this.isInitialized ||
      !(await this.hasUserConsent()) ||
      !this.features.errorReporting
    ) {
      return;
    }

    try {
      // Sanitize error report to remove sensitive information
      const sanitizedError = await this.sanitizeErrorReport(error);

      const event: ErrorEvent = {
        type: "error",
        timestamp: new Date(),
        sessionId: this.sessionId,
        eventId: this.generateEventId(),
        userId: await this.getAnonymousUserId(),
        errorType: sanitizedError.type,
        errorCode: sanitizedError.code,
        errorCategory: sanitizedError.category,
        severity: sanitizedError.severity,
        context: sanitizedError.context,
        messageHash: await this.hashMessage(error.message),
        stackHash: error.stack
          ? await this.hashStackTrace(error.stack)
          : undefined,
        data: {},
      };

      await this.bufferEvent(event);
      console.log(
        `Error reported: ${sanitizedError.type} (${sanitizedError.severity})`,
      );
    } catch (reportingError) {
      console.error("Failed to report error:", reportingError);
    }
  }

  /**
   * Send buffered telemetry data
   */
  async sendTelemetryData(): Promise<TelemetryResult> {
    if (
      !this.isInitialized ||
      !(await this.hasUserConsent()) ||
      this.buffer.length === 0
    ) {
      return {
        success: true,
        eventsSent: 0,
        duration: 0,
        message: "No telemetry data to send",
      };
    }

    const startTime = Date.now();
    console.log(`Sending ${this.buffer.length} telemetry events...`);

    try {
      // Create telemetry payload
      const payload: TelemetryPayload = {
        timestamp: new Date(),
        clientVersion: this.config.version,
        events: [...this.buffer], // Copy buffer
      };

      // Send telemetry data
      if (!this.sender) {
        throw new Error("Telemetry sender not initialized");
      }

      const response = await this.sender.sendTelemetry(payload);

      if (response.success) {
        // Clear sent events from buffer
        this.buffer = [];

        const result: TelemetryResult = {
          success: true,
          eventsSent: payload.events.length,
          duration: Date.now() - startTime,
          message: "Telemetry data sent successfully",
        };

        console.log(
          `Telemetry sent: ${result.eventsSent} events in ${result.duration}ms`,
        );
        return result;
      } else {
        throw new Error(`Telemetry server error: ${response.error}`);
      }
    } catch (error: any) {
      console.error("Failed to send telemetry data:", error);

      // Schedule retry with exponential backoff
      await this.scheduleRetry();

      return {
        success: false,
        eventsSent: 0,
        duration: Date.now() - startTime,
        message: `Failed to send telemetry: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Get user consent status
   */
  async getUserConsent(): Promise<ConsentStatus> {
    if (!this.consentManager) {
      return {
        hasConsent: false,
        enabled: false,
        consentVersion: "1.0.0",
        settings: {},
      };
    }

    return await this.consentManager.getConsentStatus();
  }

  /**
   * Configure telemetry settings
   */
  async configureTelemetry(settings: TelemetrySettings): Promise<void> {
    console.log("Configuring telemetry settings...");

    try {
      // Validate settings
      const validationErrors = validateTelemetryConfig(settings);
      if (validationErrors.length > 0) {
        throw new Error(
          `Invalid telemetry settings: ${validationErrors.join(", ")}`,
        );
      }

      // Update consent status
      if (this.consentManager && settings.enabled !== undefined) {
        await this.consentManager.setConsent(
          settings.enabled,
          settings.consentVersion || "1.0.0",
        );
      }

      // Update configuration
      this.config = mergeTelemetryConfig(settings, this.config);

      // Update privacy level and features
      if (settings.privacyLevel) {
        this.features = getTelemetryFeatures(settings.privacyLevel);

        // Update anonymizer if available
        if (this.anonymizer) {
          await this.anonymizer.updatePrivacyLevel(settings.privacyLevel);
        }
      }

      // Update data collector settings
      if (this.dataCollector) {
        if (settings.collectPerformance !== undefined) {
          this.dataCollector.setCollectPerformance(settings.collectPerformance);
        }

        if (settings.collectErrors !== undefined) {
          this.dataCollector.setCollectErrors(settings.collectErrors);
        }

        if (settings.collectUsage !== undefined) {
          this.dataCollector.setCollectUsage(settings.collectUsage);
        }
      }

      // Save settings via consent manager
      if (this.consentManager) {
        await this.consentManager.saveSettings(settings);
      }

      console.log("Telemetry configuration updated successfully");
    } catch (error) {
      console.error("Failed to configure telemetry:", error);
      throw error;
    }
  }

  /**
   * Shutdown telemetry manager
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) {
      return;
    }

    console.log("Shutting down telemetry system...");

    try {
      // Stop periodic flush
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = undefined;
      }

      // Stop retry timer
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = undefined;
      }

      // Send remaining buffered data
      if (this.buffer.length > 0) {
        await this.sendTelemetryData();
      }

      // Shutdown components
      if (this.sender) {
        await this.sender.shutdown();
      }

      if (this.dataCollector) {
        await this.dataCollector.shutdown();
      }

      if (this.consentManager) {
        await this.consentManager.shutdown();
      }

      this.isShutdown = true;
      console.log("Telemetry system shutdown completed");
    } catch (error) {
      console.error("Error during telemetry shutdown:", error);
      this.isShutdown = true;
    }
  }

  // Private helper methods

  private async hasUserConsent(): Promise<boolean> {
    if (!this.config.consentRequired) {
      return this.config.enabled;
    }

    if (!this.consentManager) {
      return false;
    }

    const consentStatus = await this.consentManager.getConsentStatus();
    return consentStatus.hasConsent && consentStatus.enabled;
  }

  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  private generateEventId(): string {
    return crypto.randomUUID();
  }

  private async collectSystemInfo() {
    return {
      version: process.env.npm_package_version || "1.0.0",
      platform: os.platform(),
      nodeVersion: process.version,
    };
  }

  private async getAnonymousUserId(): Promise<string | undefined> {
    if (this.config.privacyLevel === "strict") {
      return undefined;
    }

    if (!this.anonymizer) {
      return undefined;
    }

    // Create stable anonymous ID based on machine characteristics
    const machineId = await this.anonymizer.generateMachineId();
    return await this.anonymizer.hashUserId(machineId);
  }

  private createEmptyMetrics(): UsageMetrics {
    return {
      sessionId: this.sessionId,
      timestamp: new Date(),
      version: "1.0.0",
      platform: "unknown",
      nodeVersion: "unknown",
      commands: [],
      features: [],
      performance: this.createEmptyPerformanceData(),
      errors: [],
    };
  }

  private createEmptyPerformanceData() {
    return {
      averageResponseTime: 0,
      memoryUsageStats: {
        average: 0,
        peak: 0,
        current: 0,
        unit: "mb" as const,
      },
      errorRate: 0,
      throughputMetrics: {
        operationsPerSecond: 0,
        filesProcessedPerSecond: 0,
        bytesProcessedPerSecond: 0,
      },
    };
  }

  private async sanitizeErrorReport(
    error: ErrorReport,
  ): Promise<SanitizedErrorReport> {
    return {
      type: error.type,
      code: error.code,
      category: this.categorizeError(error),
      severity: error.severity,
      context: await this.sanitizeContext(error.context),
    };
  }

  private categorizeError(error: ErrorReport): ErrorCategory {
    const message = error.message.toLowerCase();
    const type = error.type.toLowerCase();

    if (type.includes("parse") || message.includes("parse")) {
      return "parser";
    }
    if (
      type.includes("file") ||
      message.includes("file") ||
      message.includes("directory")
    ) {
      return "filesystem";
    }
    if (
      type.includes("network") ||
      message.includes("fetch") ||
      message.includes("request")
    ) {
      return "network";
    }
    if (type.includes("config") || message.includes("config")) {
      return "configuration";
    }
    if (type.includes("validation") || message.includes("invalid")) {
      return "validation";
    }
    if (type.includes("user") || message.includes("user input")) {
      return "user_error";
    }
    if (type.includes("external") || message.includes("external")) {
      return "external_service";
    }

    return "internal";
  }

  private async sanitizeContext(context: any): Promise<any> {
    if (!context || typeof context !== "object") {
      return {};
    }

    const sanitized: any = {};

    // Only include safe context fields
    const safeFields = [
      "operation",
      "fileType",
      "language",
      "commandName",
      "featureName",
    ];

    for (const field of safeFields) {
      if (context[field]) {
        sanitized[field] = context[field];
      }
    }

    // Anonymize file counts and sizes
    if (context.fileCount) {
      sanitized.fileCountRange = this.quantifyFileCount(context.fileCount);
    }

    if (context.codebaseSize) {
      sanitized.codebaseSizeRange = this.quantifyCodebaseSize(
        context.codebaseSize,
      );
    }

    return sanitized;
  }

  private quantifyFileCount(count?: number): string {
    if (!count) {
      return "unknown";
    }

    if (count < 10) {
      return "1-9";
    }
    if (count < 50) {
      return "10-49";
    }
    if (count < 100) {
      return "50-99";
    }
    if (count < 500) {
      return "100-499";
    }
    if (count < 1000) {
      return "500-999";
    }
    return "1000+";
  }

  private quantifyCodebaseSize(size?: number): string {
    if (!size) {
      return "unknown";
    }

    const mb = size / 1024 / 1024;

    if (mb < 1) {
      return "<1MB";
    }
    if (mb < 10) {
      return "1-10MB";
    }
    if (mb < 50) {
      return "10-50MB";
    }
    if (mb < 100) {
      return "50-100MB";
    }
    if (mb < 500) {
      return "100-500MB";
    }
    return ">500MB";
  }

  private async hashMessage(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message + this.config.anonymization.hashSalt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .substring(0, 16);
  }

  private async hashStackTrace(stack: string): Promise<string> {
    // Remove file paths and line numbers, keep only error structure
    const cleanedStack = stack
      .split("\n")
      .map((line) => {
        // Remove file paths but keep function names
        return line
          .replace(/\/.*?\//g, "/[path]/")
          .replace(/:\d+:\d+/g, ":*:*");
      })
      .join("\n");

    return this.hashMessage(cleanedStack);
  }

  private async anonymizeData(data: any): Promise<Record<string, any>> {
    if (!this.anonymizer) {
      return {};
    }

    return await this.anonymizer.anonymizeData(data);
  }

  private async bufferEvent(event: TelemetryEvent): Promise<void> {
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      // Remove oldest events to prevent memory issues
      this.buffer = this.buffer.slice(-MAX_BUFFER_SIZE / 2);
    }

    this.buffer.push(event);

    // Trigger flush if buffer is full
    if (this.buffer.length >= this.config.batchSize) {
      await this.sendTelemetryData();
    }
  }

  private startPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(async () => {
      if (this.buffer.length > 0) {
        await this.sendTelemetryData();
      }
    }, this.config.flushInterval);
  }

  private async scheduleRetry(): Promise<void> {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    // Implement exponential backoff
    const baseDelay = 60000; // 1 minute
    const retryDelay =
      baseDelay * Math.pow(2, Math.min(3, this.config.retryAttempts));

    this.retryTimer = setTimeout(async () => {
      if (this.buffer.length > 0) {
        await this.sendTelemetryData();
      }
    }, retryDelay);
  }
}

// Real implementations for Privacy and Consent Management
import { PrivacyRespectingConsentManager } from "./consent/manager.js";
import { PrivacyRespectingDataAnonymizer } from "./anonymization/anonymizer.js";

// Import the interface types
import type {
  ConsentManager as IConsentManager,
  DataAnonymizer as IDataAnonymizer,
  TelemetryManager,
  TelemetryConfig,
  UsageMetrics,
  PerformanceMetrics,
  ErrorReport,
  TelemetryResult,
  ConsentStatus,
  TelemetrySettings,
  TelemetryEvent,
  TelemetryPayload,
  FeatureUsageEvent,
  PerformanceEvent,
  ErrorEvent,
  SanitizedErrorReport,
  ErrorCategory,
  PrivacyLevel,
  TelemetryFeatures,
} from "./types.js";

// Stub implementations for dependent components
// These will be implemented in subsequent subtasks

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

class ConsentManager {
  // @ts-ignore - Stub class, parameter will be used in full implementation
  constructor(private _config: TelemetryConfig) {}

  async initialize(): Promise<void> {
    // Implementation will be added in Privacy and Consent Management subtask
  }

  async getConsentStatus(): Promise<ConsentStatus> {
    return {
      hasConsent: false,
      enabled: false,
      consentVersion: "1.0.0",
      settings: {},
    };
  }

  async setConsent(_enabled: boolean, _version: string): Promise<void> {
    // Implementation will be added in Privacy and Consent Management subtask
  }

  async saveSettings(_settings: TelemetrySettings): Promise<void> {
    // Implementation will be added in Privacy and Consent Management subtask
  }

  async shutdown(): Promise<void> {
    // Implementation will be added in Privacy and Consent Management subtask
  }
}

class DataCollector {
  // @ts-ignore - Stub class, parameters will be used in full implementation
  constructor(
    private _config: TelemetryConfig,
    private _features: TelemetryFeatures,
  ) {
    // Explicitly mark as used to avoid TS errors during development
    void this._config;
    void this._features;
  }

  async initialize(): Promise<void> {
    // Implementation will be added in Data Collection and Analytics subtask
  }

  async collectCommandUsage(): Promise<any[]> {
    return [];
  }

  async collectFeatureUsage(): Promise<any[]> {
    return [];
  }

  async collectPerformanceData(): Promise<any> {
    return {};
  }

  async collectErrorSummaries(): Promise<any[]> {
    return [];
  }

  setCollectPerformance(_enabled: boolean): void {
    // Implementation will be added in Data Collection and Analytics subtask
  }

  setCollectErrors(_enabled: boolean): void {
    // Implementation will be added in Data Collection and Analytics subtask
  }

  setCollectUsage(_enabled: boolean): void {
    // Implementation will be added in Data Collection and Analytics subtask
  }

  async shutdown(): Promise<void> {
    // Implementation will be added in Data Collection and Analytics subtask
  }
}

class DataAnonymizer {
  // @ts-ignore - Stub class, parameter will be used in full implementation
  constructor(private _config: any) {}

  async initialize(): Promise<void> {
    // Implementation will be added in Privacy and Consent Management subtask
  }

  async anonymizeUsageMetrics(metrics: any): Promise<any> {
    return metrics;
  }

  async anonymizeData(_data: any): Promise<any> {
    return {};
  }

  async generateMachineId(): Promise<string> {
    return "anonymous-machine-id";
  }

  async hashUserId(_machineId: string): Promise<string> {
    return "anonymous-user-id";
  }

  async updatePrivacyLevel(_level: PrivacyLevel): Promise<void> {
    // Implementation will be added in Privacy and Consent Management subtask
  }

  async shutdown(): Promise<void> {
    // Implementation will be added in Privacy and Consent Management subtask
  }
}

class TelemetrySender {
  private initialized = false;
  private httpClient?: any; // Would be a proper HTTP client in production

  constructor(private config: TelemetryConfig) {}

  async initialize(): Promise<void> {
    try {
      // In a real implementation, this would set up HTTP client, auth, etc.
      console.log("🔧 Initializing telemetry sender...");

      // Validate configuration
      if (!this.config.endpoint) {
        throw new Error("Telemetry endpoint not configured");
      }

      // Initialize HTTP client (mock implementation)
      this.httpClient = {
        post: async (url: string, data: any) => {
          console.log(`📤 Mock telemetry send to ${url}:`, {
            eventCount: data.events?.length || 0,
            timestamp: data.timestamp,
            clientVersion: data.clientVersion,
          });
          return { status: 200, ok: true };
        },
      };

      this.initialized = true;
      console.log("✅ Telemetry sender initialized");
    } catch (error) {
      throw new Error(
        `Failed to initialize telemetry sender: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async sendTelemetry(
    payload: TelemetryPayload,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.initialized) {
      return { success: false, error: "Telemetry sender not initialized" };
    }

    try {
      // Validate payload
      if (!payload.events || payload.events.length === 0) {
        return { success: false, error: "No events to send" };
      }

      // Filter events based on privacy settings
      const filteredEvents = payload.events.filter((event) => {
        return this.isEventAllowed(event);
      });

      if (filteredEvents.length === 0) {
        console.log("📋 All events filtered out by privacy settings");
        return { success: true };
      }

      // Prepare telemetry payload
      const sanitizedPayload = {
        ...payload,
        events: filteredEvents.map((event) => this.sanitizeEvent(event)),
      };

      // Send to telemetry endpoint
      const response = await this.httpClient!.post(
        this.config.endpoint,
        sanitizedPayload,
      );

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      console.log(
        `✅ Successfully sent ${filteredEvents.length} telemetry events`,
      );
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Failed to send telemetry:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async shutdown(): Promise<void> {
    console.log("🔧 Shutting down telemetry sender...");

    try {
      // In a real implementation, this would close connections, flush buffers, etc.
      this.httpClient = undefined;
      this.initialized = false;

      console.log("✅ Telemetry sender shutdown complete");
    } catch (error) {
      console.error("❌ Error during telemetry sender shutdown:", error);
    }
  }

  /**
   * Check if event is allowed based on privacy settings
   */
  private isEventAllowed(event: TelemetryEvent): boolean {
    // In a real implementation, this would check privacy preferences
    // Since the manager.ts uses the types.ts TelemetryEvent interface,
    // we'll check the data field for privacy level
    const privacyLevel = event.data?.privacyLevel || "basic";

    // Allow basic and functional events, filter out detailed/diagnostic
    return privacyLevel === "basic" || privacyLevel === "functional";
  }

  /**
   * Sanitize event data for transmission
   */
  private sanitizeEvent(event: TelemetryEvent): TelemetryEvent {
    // Remove or hash sensitive data from the data field
    const sanitized = { ...event };

    // Remove potentially sensitive data
    if (sanitized.data) {
      const { filePath, userName, ...safeData } = sanitized.data;
      sanitized.data = safeData;
    }

    return sanitized;
  }
}
