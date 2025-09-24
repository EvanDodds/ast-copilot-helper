/**
 * @file Data Collector
 * @description Comprehensive data collection implementation with privacy-respecting features
 */

import { EventEmitter } from "events";
import type { PrivacyLevel } from "../types.js";
import type {
  TelemetryEvent,
  DataCollector as IDataCollector,
  CollectionConfig,
  CollectionStats,
  CollectionSession,
  CollectionContext,
  FeatureUsageEvent,
  CommandExecutionEvent,
  PerformanceEvent,
  ErrorEvent,
} from "./types.js";
import { PrivacyRespectingEventSanitizer } from "./sanitizer.js";
import { EventBuilderFactory } from "./builder.js";

/**
 * Privacy-first telemetry data collector
 */
export class TelemetryDataCollector
  extends EventEmitter
  implements IDataCollector {
  private readonly sanitizer: PrivacyRespectingEventSanitizer;
  private config: CollectionConfig;
  private stats: CollectionStats;
  private currentSession?: CollectionSession;
  private readonly eventBuffer: TelemetryEvent[] = [];
  private isInitialized = false;
  private flushTimer?: NodeJS.Timeout;

  constructor(config?: Partial<CollectionConfig>) {
    super();

    this.config = {
      ...this.getDefaultConfig(),
      ...(config || {}),
    };

    this.sanitizer = new PrivacyRespectingEventSanitizer();

    this.stats = {
      eventsCollected: 0,
      eventsDropped: 0,
      eventsSent: 0,
      eventsRetried: 0,
      lastCollectionTime: new Date(),
      lastTransmissionTime: new Date(),
      bufferSize: 0,
      bufferUtilization: 0,
    };
  }

  // ============================================================================
  // DataCollector Interface Implementation
  // ============================================================================

  /**
   * Initialize the data collector
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Start flush timer
    if (this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch((error) => {
          this.emit("error", error);
        });
      }, this.config.flushInterval);
    }

    this.isInitialized = true;
    this.emit("initialized");
  }

  /**
   * Start a new collection session
   */
  async startSession(context?: Partial<CollectionContext>): Promise<string> {
    const sessionId = this.generateSessionId();

    this.currentSession = {
      sessionId,
      startTime: new Date(),
      platform: context?.platform || process.platform,
      version: context?.session?.version || "1.0.0",
      environment: context?.session?.environment || "development",
      totalEvents: 0,
      features: [],
      commands: [],
      errors: 0,
      userId: context?.session?.userId,
    };

    this.emit("sessionStarted", this.currentSession);
    return sessionId;
  }

  /**
   * End the current collection session
   */
  async endSession(sessionId?: string): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    if (sessionId && this.currentSession.sessionId !== sessionId) {
      return;
    }

    this.currentSession.endTime = new Date();
    if (this.currentSession.startTime && this.currentSession.endTime) {
      this.currentSession.totalDuration =
        this.currentSession.endTime.getTime() -
        this.currentSession.startTime.getTime();
    }

    // Flush any remaining events
    await this.flush();

    this.emit("sessionEnded", this.currentSession);
    this.currentSession = undefined;
  }

  /**
   * Collect a telemetry event
   */
  async collect(event: TelemetryEvent): Promise<void> {
    if (!this.config.enabled || !this.isInitialized) {
      return;
    }

    try {
      // Set session ID if not present
      if (!event.sessionId && this.currentSession) {
        event.sessionId = this.currentSession.sessionId;
      }

      // Validate event structure
      if (!this.sanitizer.validate(event)) {
        this.stats.eventsDropped++;
        this.emit("eventDropped", { event, reason: "validation_failed" });
        return;
      }

      // Check if event should be collected based on filters
      if (!this.sanitizer.shouldCollect(event, this.config)) {
        this.stats.eventsDropped++;
        this.emit("eventDropped", { event, reason: "filtered_out" });
        return;
      }

      // Sanitize event for privacy
      const sanitizedEvent = this.sanitizer.sanitize(
        event,
        this.config.privacyLevel,
      );

      // Add to buffer
      await this.addToBuffer(sanitizedEvent);

      // Update statistics
      this.updateStats(sanitizedEvent);

      // Update session statistics
      this.updateSessionStats(sanitizedEvent);

      // Emit collection event
      this.emit("eventCollected", sanitizedEvent);

      // Check if buffer should be flushed
      if (this.eventBuffer.length >= this.config.bufferSize) {
        await this.flush();
      }
    } catch (error) {
      this.emit("collectionError", { event, error });
    }
  }

  /**
   * Collect feature usage data
   */
  async collectFeatureUsage(
    _feature: string,
    data: FeatureUsageEvent["data"],
  ): Promise<void> {
    if (!this.currentSession) {
      await this.startSession();
    }

    const event = EventBuilderFactory.createFeatureUsageBuilder()
      .withSessionId(this.currentSession!.sessionId)
      .withFeature(data.feature)
      .withAction(data.action)
      .withSuccess(data.success)
      .withPrivacyLevel(this.config.privacyLevel);

    if (data.duration !== undefined) {
      event.withDuration(data.duration);
    }

    if (data.parameters) {
      event.withParameters(data.parameters);
    }

    if (data.context) {
      event.withContext(data.context);
    }

    await this.collect(event.build());
  }

  /**
   * Collect command execution data
   */
  async collectCommandExecution(
    _command: string,
    data: CommandExecutionEvent["data"],
  ): Promise<void> {
    if (!this.currentSession) {
      await this.startSession();
    }

    const event = EventBuilderFactory.createCommandExecutionBuilder()
      .withSessionId(this.currentSession!.sessionId)
      .withCommand(data.command)
      .withExecutionTime(data.executionTime)
      .withSuccess(data.success)
      .withPrivacyLevel(this.config.privacyLevel);

    if (data.subcommand) {
      event.withSubcommand(data.subcommand);
    }

    if (data.flags) {
      event.withFlags(data.flags);
    }

    if (data.exitCode !== undefined) {
      event.withExitCode(data.exitCode);
    }

    if (data.inputSize !== undefined) {
      event.withInputSize(data.inputSize);
    }

    if (data.outputSize !== undefined) {
      event.withOutputSize(data.outputSize);
    }

    await this.collect(event.build());
  }

  /**
   * Collect performance metrics
   */
  async collectPerformanceMetrics(
    _operation: string,
    data: PerformanceEvent["data"],
  ): Promise<void> {
    if (!this.currentSession) {
      await this.startSession();
    }

    const event = EventBuilderFactory.createPerformanceBuilder()
      .withSessionId(this.currentSession!.sessionId)
      .withOperation(data.operation)
      .withDuration(data.duration)
      .withPrivacyLevel(this.config.privacyLevel);

    if (data.memoryUsage) {
      event.withMemoryUsage(data.memoryUsage);
    }

    if (data.cpuUsage) {
      event.withCpuUsage(data.cpuUsage);
    }

    if (data.fileMetrics) {
      event.withFileMetrics(data.fileMetrics);
    }

    if (data.networkMetrics) {
      event.withNetworkMetrics(data.networkMetrics);
    }

    await this.collect(event.build());
  }

  /**
   * Collect error information
   */
  async collectError(
    error: Error,
    context: ErrorEvent["data"]["context"],
  ): Promise<void> {
    if (!this.currentSession) {
      await this.startSession();
    }

    const errorEvent = EventBuilderFactory.createErrorBuilder()
      .withSessionId(this.currentSession!.sessionId)
      .withMessage(error.message)
      .withErrorType(error.constructor.name)
      .withSeverity("medium")
      .withContext(context)
      .withHandled(true)
      .withRecoverable(true)
      .withUserImpact("low")
      .withPrivacyLevel(this.config.privacyLevel);

    if (error.stack && this.config.includeStackTraces) {
      errorEvent.withStackTrace(error.stack);
    }

    await this.collect(errorEvent.build());
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics(): Promise<void> {
    if (!this.config.collectSystem) {
      return;
    }

    if (!this.currentSession) {
      await this.startSession();
    }

    const event = EventBuilderFactory.createSystemMetricsBuilder()
      .withSessionId(this.currentSession!.sessionId)
      .withPrivacyLevel(this.config.privacyLevel);

    // Get system information
    try {
      const os = await import("os");
      event.withMemoryMetrics(os.totalmem(), os.freemem());
      event.withCpuCount(os.cpus().length);

      if (os.loadavg) {
        event.withLoadAverage(os.loadavg());
      }
    } catch {
      // Fallback to process information
      const memUsage = process.memoryUsage();
      event.withMemoryMetrics(
        memUsage.rss + memUsage.heapTotal,
        memUsage.heapTotal - memUsage.heapUsed,
      );
      event.withCpuCount(1);
    }

    await this.collect(event.build());
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<CollectionStats> {
    this.stats.bufferSize = this.eventBuffer.length;
    this.stats.bufferUtilization =
      this.config.bufferSize > 0
        ? (this.eventBuffer.length / this.config.bufferSize) * 100
        : 0;

    return { ...this.stats };
  }

  /**
   * Flush collected data
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = [...this.eventBuffer];
    this.eventBuffer.length = 0;

    try {
      // In a real implementation, this would send events to a remote endpoint
      // For now, we just emit them
      this.emit("eventsBatched", events);

      this.stats.eventsSent += events.length;
      this.stats.lastTransmissionTime = new Date();
    } catch (error) {
      // Put events back in buffer for retry
      this.eventBuffer.unshift(...events);
      this.stats.eventsRetried += events.length;
      this.emit("transmissionError", { events, error });
    }
  }

  /**
   * Shutdown the data collector
   */
  async shutdown(): Promise<void> {
    // End current session if active
    if (this.currentSession) {
      await this.endSession();
    }

    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Final flush
    await this.flush();

    // Clear resources
    this.eventBuffer.length = 0;
    this.removeAllListeners();
    this.isInitialized = false;

    this.emit("shutdown");
  }

  // ============================================================================
  // Configuration and Utilities
  // ============================================================================

  /**
   * Update collection configuration
   */
  updateConfig(newConfig: Partial<CollectionConfig>): void {
    Object.assign(this.config, newConfig);
    this.emit("configUpdated", this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): CollectionConfig {
    return { ...this.config };
  }

  /**
   * Get current session
   */
  getCurrentSession(): CollectionSession | undefined {
    return this.currentSession ? { ...this.currentSession } : undefined;
  }

  /**
   * Set privacy level
   */
  setPrivacyLevel(privacyLevel: PrivacyLevel): void {
    this.config.privacyLevel = privacyLevel;
    this.emit("privacyLevelChanged", privacyLevel);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get default collection configuration
   */
  private getDefaultConfig(): CollectionConfig {
    return {
      enabled: true,
      privacyLevel: "balanced" as PrivacyLevel,
      collectUsage: true,
      collectPerformance: true,
      collectErrors: true,
      collectSystem: true,
      collectCustom: false,
      samplingRate: 1.0,
      maxEventsPerSession: 1000,
      maxEventSize: 64 * 1024,
      bufferSize: 100,
      flushInterval: 5 * 60 * 1000,
      maxRetries: 3,
      localRetentionDays: 7,
      includeStackTraces: false,
      includePII: false,
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add event to buffer
   */
  private async addToBuffer(event: TelemetryEvent): Promise<void> {
    // Check event size
    const eventSize = JSON.stringify(event).length;
    if (eventSize > this.config.maxEventSize) {
      this.stats.eventsDropped++;
      this.emit("eventDropped", { event, reason: "size_exceeded" });
      return;
    }

    // Check session limits
    if (
      this.currentSession &&
      this.currentSession.totalEvents >= this.config.maxEventsPerSession
    ) {
      this.stats.eventsDropped++;
      this.emit("eventDropped", { event, reason: "session_limit_exceeded" });
      return;
    }

    // Check buffer space
    if (this.eventBuffer.length >= this.config.bufferSize) {
      // Remove oldest event
      const removedEvent = this.eventBuffer.shift();
      this.stats.eventsDropped++;
      this.emit("eventDropped", { event: removedEvent, reason: "buffer_full" });
    }

    this.eventBuffer.push(event);
  }

  /**
   * Update collection statistics
   */
  private updateStats(event: TelemetryEvent): void {
    this.stats.eventsCollected++;
    this.stats.lastCollectionTime = event.timestamp;
  }

  /**
   * Update session statistics
   */
  private updateSessionStats(event: TelemetryEvent): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.totalEvents++;

    // Track features used
    if (event.eventType === "usage" && event.category === "vscode_extension") {
      const featureEvent = event as FeatureUsageEvent;
      const feature = featureEvent.data.feature;
      if (feature && !this.currentSession.features.includes(feature)) {
        this.currentSession.features.push(feature);
      }
    }

    // Track commands executed
    if (event.eventType === "usage" && event.category === "cli_operations") {
      const commandEvent = event as CommandExecutionEvent;
      const command = commandEvent.data.command;
      if (command && !this.currentSession.commands.includes(command)) {
        this.currentSession.commands.push(command);
      }
    }

    // Count errors
    if (event.eventType === "error") {
      this.currentSession.errors++;
    }
  }
}

/**
 * Factory for creating data collectors
 */
export class DataCollectorFactory {
  /**
   * Create a new telemetry data collector
   */
  static create(config?: Partial<CollectionConfig>): TelemetryDataCollector {
    return new TelemetryDataCollector(config);
  }

  /**
   * Create a data collector with strict privacy settings
   */
  static createStrictPrivacy(
    config?: Partial<CollectionConfig>,
  ): TelemetryDataCollector {
    return new TelemetryDataCollector({
      ...config,
      privacyLevel: "strict",
      collectSystem: false,
      includeStackTraces: false,
      includePII: false,
    });
  }

  /**
   * Create a data collector with permissive settings for development
   */
  static createDevelopment(
    config?: Partial<CollectionConfig>,
  ): TelemetryDataCollector {
    return new TelemetryDataCollector({
      ...config,
      privacyLevel: "permissive",
      collectUsage: true,
      collectPerformance: true,
      collectErrors: true,
      collectSystem: true,
      collectCustom: true,
      includeStackTraces: true,
    });
  }
}

/**
 * Performance monitoring helper
 */
export class PerformanceCollector {
  constructor(private dataCollector: TelemetryDataCollector) {}

  /**
   * Measure and collect performance data for a function
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T> | T,
    options?: {
      includeMemory?: boolean;
      context?: Record<string, any>;
    },
  ): Promise<T> {
    const startTime = performance.now();
    const startMemory = options?.includeMemory
      ? process.memoryUsage()
      : undefined;

    try {
      const result = await fn();
      const duration = performance.now() - startTime;

      const performanceData: PerformanceEvent["data"] = {
        operation,
        duration,
      };

      if (startMemory && options?.includeMemory) {
        const endMemory = process.memoryUsage();
        performanceData.memoryUsage = {
          heapUsed: endMemory.heapUsed,
          heapTotal: endMemory.heapTotal,
          external: endMemory.external,
        };
      }

      await this.dataCollector.collectPerformanceMetrics(
        operation,
        performanceData,
      );

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Collect performance data for failed operation
      await this.dataCollector.collectPerformanceMetrics(
        `${operation}_failed`,
        {
          operation: `${operation}_failed`,
          duration,
        },
      );

      // Also collect error
      if (error instanceof Error) {
        await this.dataCollector.collectError(error, {
          operation,
          ...options?.context,
        });
      }

      throw error;
    }
  }
}
