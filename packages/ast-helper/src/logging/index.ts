/**
 * Logging module index
 * Exports all logging-related functionality
 */

export { LogLevel } from './types.js';
export type { 
  Logger, 
  LogEntry, 
  LogOutput, 
  LoggerOptions, 
  PerformanceMetrics 
} from './types.js';

export { AstLogger } from './logger.js';
export { ConsoleOutput } from './console-output.js';
export { JsonOutput } from './json-output.js';

export {
  parseLogLevel,
  getLogLevelFromEnv,
  createLogger,
  setupGlobalErrorHandling,
  withPerformance,
  createModuleLogger,
  isLogLevelEnabled,
  LOG_LEVEL_NAMES
} from './utils.js';
