/**
 * @file Data Collection Types
 * @description Type definitions for comprehensive telemetry data collection
 */

import type { PrivacyLevel, ErrorSeverity } from '../types.js';

// ============================================================================
// Core Collection Interfaces
// ============================================================================

/**
 * Base interface for all telemetry events
 */
export interface TelemetryEvent {
  id: string;
  sessionId: string;
  timestamp: Date;
  userId?: string;  // Optional, privacy-dependent
  eventType: TelemetryEventType;
  category: TelemetryEventCategory;
  privacyLevel: PrivacyLevel;
  metadata: Record<string, any>;
}

/**
 * Event types for categorizing telemetry data
 */
export type TelemetryEventType = 
  | 'usage'        // Feature usage, command execution
  | 'performance'  // Performance metrics, timing data
  | 'error'        // Error reports, exception tracking
  | 'system'       // System information, environment data
  | 'custom';      // Custom events for specific tracking

/**
 * Event categories for organizing telemetry data
 */
export type TelemetryEventCategory =
  | 'ast_analysis'      // AST parsing and analysis operations
  | 'code_generation'   // Code generation and transformation
  | 'cli_operations'    // Command-line interface usage
  | 'vscode_extension'  // VS Code extension interactions
  | 'mcp_server'        // Model Context Protocol server operations
  | 'file_operations'   // File system operations
  | 'configuration'     // Configuration management
  | 'network'           // Network requests and responses
  | 'ui_interactions'   // User interface interactions
  | 'system_events';    // System-level events

// ============================================================================
// Usage Analytics Events
// ============================================================================

/**
 * Feature usage tracking event
 */
export interface FeatureUsageEvent extends TelemetryEvent {
  eventType: 'usage';
  data: {
    feature: string;              // Feature identifier
    action: string;               // Specific action taken
    duration?: number;            // Time spent using feature (ms)
    success: boolean;             // Whether action succeeded
    parameters?: Record<string, any>; // Action parameters (sanitized)
    context?: {
      fileType?: string;          // File type being processed
      projectSize?: number;       // Number of files in project
      astNodeCount?: number;      // Number of AST nodes processed
    };
  };
}

/**
 * Command execution tracking event
 */
export interface CommandExecutionEvent extends TelemetryEvent {
  eventType: 'usage';
  data: {
    command: string;              // Command name/identifier
    subcommand?: string;          // Subcommand if applicable
    flags?: string[];             // Command flags used
    executionTime: number;        // Command execution time (ms)
    success: boolean;             // Whether command succeeded
    exitCode?: number;            // Exit code for CLI commands
    inputSize?: number;           // Size of input data
    outputSize?: number;          // Size of output data
  };
}

// ============================================================================
// Performance Analytics Events  
// ============================================================================

/**
 * Performance metrics tracking event
 */
export interface PerformanceEvent extends TelemetryEvent {
  eventType: 'performance';
  data: {
    operation: string;            // Operation being measured
    duration: number;             // Operation duration (ms)
    memoryUsage?: {
      heapUsed: number;           // Heap memory used (bytes)
      heapTotal: number;          // Total heap memory (bytes)
      external: number;           // External memory (bytes)
    };
    cpuUsage?: {
      user: number;               // User CPU time (microseconds)
      system: number;             // System CPU time (microseconds)
    };
    fileMetrics?: {
      filesProcessed: number;     // Number of files processed
      linesOfCode: number;        // Total lines of code processed
      astNodes: number;           // Total AST nodes processed
    };
    networkMetrics?: {
      requestCount: number;       // Number of network requests
      totalBytes: number;         // Total bytes transferred
      avgResponseTime: number;    // Average response time (ms)
    };
  };
}

/**
 * System resource monitoring event
 */
export interface SystemMetricsEvent extends TelemetryEvent {
  eventType: 'system';
  data: {
    platform: string;            // Operating system platform
    nodeVersion: string;          // Node.js version
    memoryTotal: number;          // Total system memory (bytes)
    memoryFree: number;           // Free system memory (bytes)
    cpuCount: number;             // Number of CPU cores
    loadAverage?: number[];       // System load average
    diskSpace?: {
      total: number;              // Total disk space (bytes)
      free: number;               // Free disk space (bytes)
      used: number;               // Used disk space (bytes)
    };
  };
}

// ============================================================================
// Error Analytics Events
// ============================================================================

/**
 * Error reporting event
 */
export interface ErrorEvent extends TelemetryEvent {
  eventType: 'error';
  data: {
    errorType: string;            // Error class/type name
    message: string;              // Error message (sanitized)
    severity: ErrorSeverity;      // Error severity level
    stackTrace?: string;          // Stack trace (sanitized)
    context: {
      operation?: string;         // Operation being performed
      fileName?: string;          // File being processed (sanitized)
      lineNumber?: number;        // Line number where error occurred
      columnNumber?: number;      // Column number where error occurred
    };
    recoverable: boolean;         // Whether error was recoverable
    handled: boolean;             // Whether error was properly handled
    userImpact: 'none' | 'low' | 'medium' | 'high'; // Impact on user experience
  };
}

/**
 * Exception details for advanced error tracking
 */
export interface ExceptionDetails {
  name: string;                   // Exception name
  message: string;                // Exception message
  stack?: string;                 // Stack trace
  cause?: ExceptionDetails;       // Nested exception
  code?: string | number;         // Error code
  errno?: number;                 // System error number
  syscall?: string;               // System call that failed
  path?: string;                  // File path related to error
}

// ============================================================================
// Data Collection Configuration
// ============================================================================

/**
 * Configuration for data collection behavior
 */
export interface CollectionConfig {
  enabled: boolean;               // Whether collection is enabled
  privacyLevel: PrivacyLevel;     // Privacy level for data sanitization
  
  // Event type filters
  collectUsage: boolean;          // Collect usage analytics
  collectPerformance: boolean;    // Collect performance metrics
  collectErrors: boolean;         // Collect error reports
  collectSystem: boolean;         // Collect system information
  collectCustom: boolean;         // Collect custom events
  
  // Sampling and limits
  samplingRate: number;           // Sampling rate (0.0-1.0)
  maxEventsPerSession: number;    // Maximum events per session
  maxEventSize: number;           // Maximum size per event (bytes)
  
  // Buffer configuration
  bufferSize: number;             // Maximum events in buffer
  flushInterval: number;          // Buffer flush interval (ms)
  maxRetries: number;             // Maximum retry attempts
  
  // Data retention
  localRetentionDays: number;     // Days to keep local data
  includeStackTraces: boolean;    // Include stack traces in errors
  includePII: boolean;            // Include personally identifiable info
}

/**
 * Data collection statistics and monitoring
 */
export interface CollectionStats {
  eventsCollected: number;        // Total events collected
  eventsDropped: number;          // Events dropped due to limits
  eventsSent: number;             // Events successfully sent
  eventsRetried: number;          // Events that required retries
  lastCollectionTime: Date;       // Last collection timestamp
  lastTransmissionTime: Date;     // Last transmission timestamp
  bufferSize: number;             // Current buffer size
  bufferUtilization: number;      // Buffer utilization percentage
}

// ============================================================================
// Collection Context and Session Management
// ============================================================================

/**
 * Session context for telemetry collection
 */
export interface CollectionSession {
  sessionId: string;              // Unique session identifier
  userId?: string;                // User identifier (privacy-dependent)
  startTime: Date;                // Session start time
  endTime?: Date;                 // Session end time
  platform: string;              // Operating system platform
  version: string;                // Application version
  environment: 'development' | 'production' | 'testing'; // Environment type
  
  // Session statistics
  totalEvents: number;            // Total events in session
  totalDuration?: number;         // Session duration (ms)
  features: string[];             // Features used in session
  commands: string[];             // Commands executed in session
  errors: number;                 // Number of errors in session
}

/**
 * Collection context for individual events
 */
export interface CollectionContext {
  session: CollectionSession;     // Current session
  userAgent?: string;             // User agent string
  locale?: string;                // User locale
  timezone?: string;              // User timezone
  
  // Technical context
  nodeVersion: string;            // Node.js version
  platform: string;              // Operating system
  architecture: string;          // CPU architecture
  
  // Project context (sanitized)
  projectType?: string;           // Type of project being worked on
  fileCount?: number;             // Number of files in project
  languageDistribution?: Record<string, number>; // Programming languages used
}

// ============================================================================
// Collection Interfaces
// ============================================================================

/**
 * Interface for data collection implementations
 */
export interface DataCollector {
  /**
   * Initialize the data collector
   */
  initialize(): Promise<void>;

  /**
   * Start a new collection session
   */
  startSession(context?: Partial<CollectionContext>): Promise<string>;

  /**
   * End the current collection session
   */
  endSession(sessionId?: string): Promise<void>;

  /**
   * Collect a telemetry event
   */
  collect(event: TelemetryEvent): Promise<void>;

  /**
   * Collect feature usage data
   */
  collectFeatureUsage(feature: string, data: FeatureUsageEvent['data']): Promise<void>;

  /**
   * Collect command execution data
   */
  collectCommandExecution(command: string, data: CommandExecutionEvent['data']): Promise<void>;

  /**
   * Collect performance metrics
   */
  collectPerformanceMetrics(operation: string, data: PerformanceEvent['data']): Promise<void>;

  /**
   * Collect error information
   */
  collectError(error: Error, context: ErrorEvent['data']['context']): Promise<void>;

  /**
   * Collect system metrics
   */
  collectSystemMetrics(): Promise<void>;

  /**
   * Get collection statistics
   */
  getStats(): Promise<CollectionStats>;

  /**
   * Flush collected data
   */
  flush(): Promise<void>;

  /**
   * Shutdown the data collector
   */
  shutdown(): Promise<void>;
}

/**
 * Interface for event sanitization and filtering
 */
export interface EventSanitizer {
  /**
   * Sanitize an event based on privacy settings
   */
  sanitize(event: TelemetryEvent, privacyLevel: PrivacyLevel): TelemetryEvent;

  /**
   * Check if an event should be collected based on filters
   */
  shouldCollect(event: TelemetryEvent, config: CollectionConfig): boolean;

  /**
   * Anonymize sensitive data in an event
   */
  anonymize(event: TelemetryEvent): TelemetryEvent;

  /**
   * Validate event structure and content
   */
  validate(event: TelemetryEvent): boolean;
}

// ============================================================================
// Collection Utilities and Helpers
// ============================================================================

/**
 * Event builder for creating telemetry events
 */
export interface EventBuilder {
  /**
   * Create a base event with common properties
   */
  createBaseEvent(type: TelemetryEventType, category: TelemetryEventCategory): TelemetryEvent;

  /**
   * Create a feature usage event
   */
  createFeatureUsageEvent(feature: string, data: FeatureUsageEvent['data']): FeatureUsageEvent;

  /**
   * Create a performance event
   */
  createPerformanceEvent(operation: string, data: PerformanceEvent['data']): PerformanceEvent;

  /**
   * Create an error event
   */
  createErrorEvent(error: Error, context: ErrorEvent['data']['context']): ErrorEvent;

  /**
   * Create a system metrics event
   */
  createSystemMetricsEvent(data: SystemMetricsEvent['data']): SystemMetricsEvent;
}

/**
 * Default configuration values
 */
export const DEFAULT_COLLECTION_CONFIG: CollectionConfig = {
  enabled: false,
  privacyLevel: 'strict',
  
  // Event types
  collectUsage: true,
  collectPerformance: true,
  collectErrors: true,
  collectSystem: false,
  collectCustom: false,
  
  // Sampling and limits
  samplingRate: 1.0,
  maxEventsPerSession: 1000,
  maxEventSize: 64 * 1024, // 64KB
  
  // Buffer configuration
  bufferSize: 100,
  flushInterval: 5 * 60 * 1000, // 5 minutes
  maxRetries: 3,
  
  // Data retention
  localRetentionDays: 7,
  includeStackTraces: false,
  includePII: false,
};