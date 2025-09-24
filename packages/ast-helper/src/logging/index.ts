/**
 * Logging module index
 * Exports all logging-related functionality
 */

export { LogLevel } from "./types.js";
export type {
  Logger,
  LogEntry,
  LogOutput,
  LoggerOptions,
  PerformanceMetrics,
} from "./types.js";

export { AstLogger } from "./logger.js";
export { ConsoleOutput } from "./console-output.js";
export { JsonOutput } from "./json-output.js";

// Enhanced logging infrastructure
export {
  CorrelationContext,
  CorrelatedLogger,
  LogMetadataCapture,
  CorrelatedLogOutput,
} from "./enhanced-logging.js";
export type { EnhancedLogContext } from "./enhanced-logging.js";

// New enhanced utilities with performance tracking
export type { PerformanceContext } from "./enhanced-utils.js";

export {
  EnhancedLogger,
  createEnhancedLogger,
  generateOperationId,
  generateCorrelationId,
  createEnhancedContext,
  createRequestLogger,
  createComponentLogger,
} from "./enhanced-utils.js";

export {
  parseLogLevel,
  getLogLevelFromEnv,
  createLogger,
  setupGlobalErrorHandling,
  withPerformance,
  createModuleLogger,
  isLogLevelEnabled,
  LOG_LEVEL_NAMES,
} from "./utils.js";
