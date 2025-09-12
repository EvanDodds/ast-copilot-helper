/**
 * Logging utility functions
 * Helper functions for log level parsing, logger configuration, and setup
 */

import { LogLevel } from './types.js';
import type { LoggerOptions, LogOutput } from './types.js';
import { AstLogger } from './logger.js';
import { ConsoleOutput } from './console-output.js';
import { JsonOutput } from './json-output.js';

/**
 * Parse log level from string
 */
export function parseLogLevel(level: string): LogLevel {
  const normalized = level.toUpperCase().trim();
  
  switch (normalized) {
    case 'ERROR': return LogLevel.ERROR;
    case 'WARN':
    case 'WARNING': return LogLevel.WARN;
    case 'INFO': return LogLevel.INFO;
    case 'DEBUG': return LogLevel.DEBUG;
    case 'TRACE': return LogLevel.TRACE;
    default:
      throw new Error(`Invalid log level: ${level}. Valid levels are: ERROR, WARN, INFO, DEBUG, TRACE`);
  }
}

/**
 * Get log level from environment variable
 */
export function getLogLevelFromEnv(): LogLevel {
  const envLevel = process.env.AST_COPILOT_LOG_LEVEL 
    || process.env.LOG_LEVEL 
    || 'INFO';
  
  try {
    return parseLogLevel(envLevel);
  } catch {
    console.warn(`Invalid log level in environment: ${envLevel}, using INFO`);
    return LogLevel.INFO;
  }
}

/**
 * Create logger from configuration
 */
export function createLogger(options: Partial<LoggerOptions> & {
  logFile?: string;
  jsonOutput?: boolean;
  operation?: string;
} = {}): AstLogger {
  const outputs: LogOutput[] = [];
  
  // Add console output (default)
  if (!options.jsonOutput) {
    outputs.push(new ConsoleOutput({
      useColors: process.stdout.isTTY,
      includeTimestamp: options.includeTimestamp ?? true
    }));
  }
  
  // Add JSON output
  if (options.jsonOutput) {
    outputs.push(new JsonOutput({
      filePath: options.logFile,
      pretty: false,
      maxBufferSize: 50,
      autoFlushMs: 5000
    }));
  } else if (options.logFile) {
    // Add file logging in addition to console
    outputs.push(new JsonOutput({
      filePath: options.logFile,
      pretty: true,
      maxBufferSize: 50,
      autoFlushMs: 5000
    }));
  }
  
  return new AstLogger({
    level: options.level ?? getLogLevelFromEnv(),
    includeTimestamp: options.includeTimestamp ?? true,
    includeContext: options.includeContext ?? true,
    maxContextDepth: options.maxContextDepth ?? 3,
    operation: options.operation,
    outputs,
    performanceThresholdMs: 1000
  });
}

/**
 * Setup global error handling with logger
 */
export function setupGlobalErrorHandling(logger: AstLogger): void {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
    
    // Flush logs before exit
    logger.flush().finally(() => {
      process.exit(1);
    });
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? {
        name: reason.name,
        message: reason.message,
        stack: reason.stack
      } : String(reason),
      promise: String(promise)
    });
  });
  
  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await logger.flush();
    await logger.close();
    process.exit(0);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Create a performance timing wrapper
 */
export function withPerformance<T extends (...args: any[]) => any>(
  logger: AstLogger,
  operation: string,
  fn: T
): T {
  return ((...args: any[]) => {
    const metrics = logger.startPerformance(operation, {
      args: args.length > 0 ? `${args.length} arguments` : 'no arguments'
    });
    
    try {
      const result = fn(...args);
      
      // Handle promises
      if (result && typeof result.then === 'function') {
        return result
          .then((value: any) => {
            logger.endPerformance(metrics, true);
            return value;
          })
          .catch((error: Error) => {
            logger.endPerformance(metrics, false, error);
            throw error;
          });
      } else {
        // Synchronous function
        logger.endPerformance(metrics, true);
        return result;
      }
    } catch (error) {
      logger.endPerformance(metrics, false, error as Error);
      throw error;
    }
  }) as T;
}

/**
 * Create a logger for a specific module/operation
 */
export function createModuleLogger(
  moduleName: string, 
  parentLogger?: AstLogger
): AstLogger {
  if (parentLogger) {
    return parentLogger.child({ module: moduleName }) as AstLogger;
  } else {
    return createLogger({ operation: moduleName });
  }
}

/**
 * Log level names for display
 */
export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO', 
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.TRACE]: 'TRACE'
};

/**
 * Check if log level is enabled
 */
export function isLogLevelEnabled(currentLevel: LogLevel, targetLevel: LogLevel): boolean {
  return targetLevel <= currentLevel;
}
