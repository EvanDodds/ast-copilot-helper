/**
 * @file Event Builder
 * @description Utility classes for constructing telemetry events
 */

import type { PrivacyLevel } from "../types.js";
import type {
  TelemetryEvent,
  FeatureUsageEvent,
  CommandExecutionEvent,
  PerformanceEvent,
  ErrorEvent,
  SystemMetricsEvent,
  TelemetryEventType,
} from "./types.js";

/**
 * Base event builder with common functionality
 */
abstract class BaseEventBuilder<T extends TelemetryEvent> {
  protected event: Partial<T>;

  constructor(eventType: TelemetryEventType, category: string) {
    this.event = {
      id: this.generateEventId(),
      sessionId: "", // Will be set by data collector
      userId: undefined, // Will be set by data collector
      timestamp: new Date(),
      eventType,
      category: category as any,
      privacyLevel: "balanced" as PrivacyLevel,
      metadata: {},
    } as Partial<T>;
  }

  /**
   * Set event session ID
   */
  withSessionId(sessionId: string): this {
    this.event.sessionId = sessionId;
    return this;
  }

  /**
   * Set event user ID (optional, respects privacy settings)
   */
  withUserId(userId: string): this {
    this.event.userId = userId;
    return this;
  }

  /**
   * Set event privacy level
   */
  withPrivacyLevel(privacyLevel: PrivacyLevel): this {
    this.event.privacyLevel = privacyLevel;
    return this;
  }

  /**
   * Add metadata to event
   */
  withMetadata(metadata: Record<string, any>): this {
    this.event.metadata = { ...this.event.metadata, ...metadata };
    return this;
  }

  /**
   * Set custom timestamp
   */
  withTimestamp(timestamp: Date): this {
    this.event.timestamp = timestamp;
    return this;
  }

  /**
   * Build the event
   */
  abstract build(): T;

  /**
   * Generate unique event ID
   */
  protected generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate required fields are present
   */
  protected validateRequired(fields: (keyof T)[]): void {
    const missing = fields.filter((field) => !this.event[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }
  }
}

/**
 * Builder for feature usage events
 */
export class FeatureUsageEventBuilder extends BaseEventBuilder<FeatureUsageEvent> {
  constructor() {
    super("usage", "feature");
    // Initialize data structure according to FeatureUsageEvent interface
    (this.event as any).data = {
      feature: "",
      action: "",
      success: false,
    };
  }

  /**
   * Set feature being used
   */
  withFeature(featureName: string): this {
    (this.event as any).data.feature = featureName;
    return this;
  }

  /**
   * Set feature action
   */
  withAction(action: string): this {
    (this.event as any).data.action = action;
    return this;
  }

  /**
   * Set parameters for the feature usage
   */
  withParameters(parameters: Record<string, any>): this {
    (this.event as any).data.parameters = parameters;
    return this;
  }

  /**
   * Set success/failure status
   */
  withSuccess(success: boolean): this {
    (this.event as any).data.success = success;
    return this;
  }

  /**
   * Set execution duration
   */
  withDuration(duration: number): this {
    (this.event as any).data.duration = duration;
    return this;
  }

  /**
   * Set usage context
   */
  withContext(context: {
    fileType?: string;
    projectSize?: number;
    astNodeCount?: number;
  }): this {
    (this.event as any).data.context = context;
    return this;
  }

  /**
   * Build the feature usage event
   */
  build(): FeatureUsageEvent {
    this.validateRequired(["sessionId", "timestamp"] as any[]);

    const data = (this.event as any).data;
    if (!data?.feature || !data?.action) {
      throw new Error("Feature name and action are required");
    }

    return this.event as FeatureUsageEvent;
  }
}

/**
 * Builder for command execution events
 */
export class CommandExecutionEventBuilder extends BaseEventBuilder<CommandExecutionEvent> {
  constructor() {
    super("usage", "command");
    // Initialize data structure according to CommandExecutionEvent interface
    (this.event as any).data = {
      command: "",
      executionTime: 0,
      success: false,
    };
  }

  /**
   * Set command that was executed
   */
  withCommand(commandName: string): this {
    (this.event as any).data.command = commandName;
    return this;
  }

  /**
   * Set command subcommand
   */
  withSubcommand(subcommand: string): this {
    (this.event as any).data.subcommand = subcommand;
    return this;
  }

  /**
   * Set command flags
   */
  withFlags(flags: string[]): this {
    (this.event as any).data.flags = flags;
    return this;
  }

  /**
   * Set execution time
   */
  withExecutionTime(executionTime: number): this {
    (this.event as any).data.executionTime = executionTime;
    return this;
  }

  /**
   * Set success/failure status
   */
  withSuccess(success: boolean): this {
    (this.event as any).data.success = success;
    return this;
  }

  /**
   * Set exit code
   */
  withExitCode(exitCode: number): this {
    (this.event as any).data.exitCode = exitCode;
    return this;
  }

  /**
   * Set input size
   */
  withInputSize(inputSize: number): this {
    (this.event as any).data.inputSize = inputSize;
    return this;
  }

  /**
   * Set output size
   */
  withOutputSize(outputSize: number): this {
    (this.event as any).data.outputSize = outputSize;
    return this;
  }

  /**
   * Build the command execution event
   */
  build(): CommandExecutionEvent {
    this.validateRequired(["sessionId", "timestamp"] as any[]);

    const data = (this.event as any).data;
    if (!data?.command) {
      throw new Error("Command name is required");
    }

    return this.event as CommandExecutionEvent;
  }
}

/**
 * Builder for performance events
 */
export class PerformanceEventBuilder extends BaseEventBuilder<PerformanceEvent> {
  constructor() {
    super("performance", "metrics");
    // Initialize data structure according to PerformanceEvent interface
    (this.event as any).data = {
      operation: "",
      duration: 0,
    };
  }

  /**
   * Set operation being measured
   */
  withOperation(operation: string): this {
    (this.event as any).data.operation = operation;
    return this;
  }

  /**
   * Set operation duration
   */
  withDuration(duration: number): this {
    (this.event as any).data.duration = duration;
    return this;
  }

  /**
   * Set memory usage metrics
   */
  withMemoryUsage(memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  }): this {
    (this.event as any).data.memoryUsage = memoryUsage;
    return this;
  }

  /**
   * Set CPU usage metrics
   */
  withCpuUsage(cpuUsage: { user: number; system: number }): this {
    (this.event as any).data.cpuUsage = cpuUsage;
    return this;
  }

  /**
   * Set file metrics
   */
  withFileMetrics(fileMetrics: {
    filesProcessed: number;
    linesOfCode: number;
    astNodes: number;
  }): this {
    (this.event as any).data.fileMetrics = fileMetrics;
    return this;
  }

  /**
   * Set network metrics
   */
  withNetworkMetrics(networkMetrics: {
    requestCount: number;
    totalBytes: number;
    avgResponseTime: number;
  }): this {
    (this.event as any).data.networkMetrics = networkMetrics;
    return this;
  }

  /**
   * Build the performance event
   */
  build(): PerformanceEvent {
    this.validateRequired(["sessionId", "timestamp"] as any[]);

    const data = (this.event as any).data;
    if (!data?.operation || data?.duration === undefined) {
      throw new Error("Operation name and duration are required");
    }

    return this.event as PerformanceEvent;
  }
}

/**
 * Builder for error events
 */
export class ErrorEventBuilder extends BaseEventBuilder<ErrorEvent> {
  constructor() {
    super("error", "application");
    // Initialize data structure according to ErrorEvent interface
    (this.event as any).data = {
      errorType: "",
      message: "",
      severity: "medium",
      context: {},
      recoverable: false,
      handled: false,
      userImpact: "low",
    };
  }

  /**
   * Set error message
   */
  withMessage(message: string): this {
    (this.event as any).data.message = message;
    return this;
  }

  /**
   * Set error type
   */
  withErrorType(errorType: string): this {
    (this.event as any).data.errorType = errorType;
    return this;
  }

  /**
   * Set error severity
   */
  withSeverity(severity: "low" | "medium" | "high" | "critical"): this {
    (this.event as any).data.severity = severity;
    return this;
  }

  /**
   * Set stack trace
   */
  withStackTrace(stackTrace: string): this {
    (this.event as any).data.stackTrace = stackTrace;
    return this;
  }

  /**
   * Set error context
   */
  withContext(context: {
    operation?: string;
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
  }): this {
    (this.event as any).data.context = context;
    return this;
  }

  /**
   * Set whether error was recoverable
   */
  withRecoverable(recoverable: boolean): this {
    (this.event as any).data.recoverable = recoverable;
    return this;
  }

  /**
   * Set whether error was handled
   */
  withHandled(handled: boolean): this {
    (this.event as any).data.handled = handled;
    return this;
  }

  /**
   * Set user impact level
   */
  withUserImpact(userImpact: "none" | "low" | "medium" | "high"): this {
    (this.event as any).data.userImpact = userImpact;
    return this;
  }

  /**
   * Build the error event
   */
  build(): ErrorEvent {
    this.validateRequired(["sessionId", "timestamp"] as any[]);

    const data = (this.event as any).data;
    if (!data?.message || !data?.errorType || !data?.severity) {
      throw new Error("Message, error type, and severity are required");
    }

    return this.event as ErrorEvent;
  }
}

/**
 * Builder for system metrics events
 */
export class SystemMetricsEventBuilder extends BaseEventBuilder<SystemMetricsEvent> {
  constructor() {
    super("system", "metrics");
    // Initialize data structure according to SystemMetricsEvent interface
    (this.event as any).data = {
      platform: process.platform,
      nodeVersion: process.version,
      memoryTotal: 0,
      memoryFree: 0,
      cpuCount: 0,
    };
  }

  /**
   * Set platform information
   */
  withPlatform(platform: string): this {
    (this.event as any).data.platform = platform;
    return this;
  }

  /**
   * Set Node.js version
   */
  withNodeVersion(nodeVersion: string): this {
    (this.event as any).data.nodeVersion = nodeVersion;
    return this;
  }

  /**
   * Set memory metrics
   */
  withMemoryMetrics(memoryTotal: number, memoryFree: number): this {
    (this.event as any).data.memoryTotal = memoryTotal;
    (this.event as any).data.memoryFree = memoryFree;
    return this;
  }

  /**
   * Set CPU count
   */
  withCpuCount(cpuCount: number): this {
    (this.event as any).data.cpuCount = cpuCount;
    return this;
  }

  /**
   * Set load average
   */
  withLoadAverage(loadAverage: number[]): this {
    (this.event as any).data.loadAverage = loadAverage;
    return this;
  }

  /**
   * Set disk space metrics
   */
  withDiskSpace(diskSpace: {
    total: number;
    free: number;
    used: number;
  }): this {
    (this.event as any).data.diskSpace = diskSpace;
    return this;
  }

  /**
   * Build the system metrics event
   */
  build(): SystemMetricsEvent {
    this.validateRequired(["sessionId", "timestamp"] as any[]);

    const data = (this.event as any).data;
    if (!data?.nodeVersion || !data?.platform) {
      throw new Error("Node version and platform are required");
    }

    return this.event as SystemMetricsEvent;
  }
}

/**
 * Factory class for creating event builders
 */
export class EventBuilderFactory {
  /**
   * Create a feature usage event builder
   */
  static createFeatureUsageBuilder(): FeatureUsageEventBuilder {
    return new FeatureUsageEventBuilder();
  }

  /**
   * Create a command execution event builder
   */
  static createCommandExecutionBuilder(): CommandExecutionEventBuilder {
    return new CommandExecutionEventBuilder();
  }

  /**
   * Create a performance event builder
   */
  static createPerformanceBuilder(): PerformanceEventBuilder {
    return new PerformanceEventBuilder();
  }

  /**
   * Create an error event builder
   */
  static createErrorBuilder(): ErrorEventBuilder {
    return new ErrorEventBuilder();
  }

  /**
   * Create a system metrics event builder
   */
  static createSystemMetricsBuilder(): SystemMetricsEventBuilder {
    return new SystemMetricsEventBuilder();
  }

  /**
   * Create a builder based on event type
   */
  static createBuilder(
    eventType: TelemetryEventType,
  ): BaseEventBuilder<TelemetryEvent> {
    switch (eventType) {
      case "usage":
        return new FeatureUsageEventBuilder() as any;
      case "performance":
        return new PerformanceEventBuilder() as any;
      case "error":
        return new ErrorEventBuilder() as any;
      case "system":
        return new SystemMetricsEventBuilder() as any;
      default:
        throw new Error(`Unknown event type: ${eventType}`);
    }
  }
}

/**
 * Utility functions for common event creation patterns
 */
export class EventBuilderUtils {
  /**
   * Create a quick feature usage event
   */
  static createFeatureUsage(
    sessionId: string,
    featureName: string,
    action: string,
    options?: {
      success?: boolean;
      duration?: number;
      parameters?: Record<string, any>;
      context?: {
        fileType?: string;
        projectSize?: number;
        astNodeCount?: number;
      };
      privacyLevel?: PrivacyLevel;
    },
  ): FeatureUsageEvent {
    const builder = EventBuilderFactory.createFeatureUsageBuilder()
      .withSessionId(sessionId)
      .withFeature(featureName)
      .withAction(action);

    if (options?.success !== undefined) {
      builder.withSuccess(options.success);
    }

    if (options?.duration !== undefined) {
      builder.withDuration(options.duration);
    }

    if (options?.parameters) {
      builder.withParameters(options.parameters);
    }

    if (options?.context) {
      builder.withContext(options.context);
    }

    if (options?.privacyLevel) {
      builder.withPrivacyLevel(options.privacyLevel);
    }

    return builder.build();
  }

  /**
   * Create a quick error event
   */
  static createError(
    sessionId: string,
    message: string,
    errorType: string,
    severity: "low" | "medium" | "high" | "critical",
    options?: {
      stackTrace?: string;
      context?: {
        operation?: string;
        fileName?: string;
        lineNumber?: number;
        columnNumber?: number;
      };
      recoverable?: boolean;
      handled?: boolean;
      userImpact?: "none" | "low" | "medium" | "high";
      privacyLevel?: PrivacyLevel;
    },
  ): ErrorEvent {
    const builder = EventBuilderFactory.createErrorBuilder()
      .withSessionId(sessionId)
      .withMessage(message)
      .withErrorType(errorType)
      .withSeverity(severity);

    if (options?.stackTrace) {
      builder.withStackTrace(options.stackTrace);
    }

    if (options?.context) {
      builder.withContext(options.context);
    }

    if (options?.recoverable !== undefined) {
      builder.withRecoverable(options.recoverable);
    }

    if (options?.handled !== undefined) {
      builder.withHandled(options.handled);
    }

    if (options?.userImpact) {
      builder.withUserImpact(options.userImpact);
    }

    if (options?.privacyLevel) {
      builder.withPrivacyLevel(options.privacyLevel);
    }

    return builder.build();
  }

  /**
   * Create a quick performance event
   */
  static createPerformance(
    sessionId: string,
    operation: string,
    duration: number,
    options?: {
      memoryUsage?: { heapUsed: number; heapTotal: number; external: number };
      cpuUsage?: { user: number; system: number };
      fileMetrics?: {
        filesProcessed: number;
        linesOfCode: number;
        astNodes: number;
      };
      networkMetrics?: {
        requestCount: number;
        totalBytes: number;
        avgResponseTime: number;
      };
      privacyLevel?: PrivacyLevel;
    },
  ): PerformanceEvent {
    const builder = EventBuilderFactory.createPerformanceBuilder()
      .withSessionId(sessionId)
      .withOperation(operation)
      .withDuration(duration);

    if (options?.memoryUsage) {
      builder.withMemoryUsage(options.memoryUsage);
    }

    if (options?.cpuUsage) {
      builder.withCpuUsage(options.cpuUsage);
    }

    if (options?.fileMetrics) {
      builder.withFileMetrics(options.fileMetrics);
    }

    if (options?.networkMetrics) {
      builder.withNetworkMetrics(options.networkMetrics);
    }

    if (options?.privacyLevel) {
      builder.withPrivacyLevel(options.privacyLevel);
    }

    return builder.build();
  }

  /**
   * Create a system metrics event
   */
  static createSystemMetrics(
    sessionId: string,
    options?: {
      memoryTotal?: number;
      memoryFree?: number;
      cpuCount?: number;
      loadAverage?: number[];
      diskSpace?: { total: number; free: number; used: number };
      privacyLevel?: PrivacyLevel;
    },
  ): SystemMetricsEvent {
    const builder =
      EventBuilderFactory.createSystemMetricsBuilder().withSessionId(sessionId);

    if (
      options?.memoryTotal !== undefined &&
      options?.memoryFree !== undefined
    ) {
      builder.withMemoryMetrics(options.memoryTotal, options.memoryFree);
    }

    if (options?.cpuCount) {
      builder.withCpuCount(options.cpuCount);
    }

    if (options?.loadAverage) {
      builder.withLoadAverage(options.loadAverage);
    }

    if (options?.diskSpace) {
      builder.withDiskSpace(options.diskSpace);
    }

    if (options?.privacyLevel) {
      builder.withPrivacyLevel(options.privacyLevel);
    }

    return builder.build();
  }
}
