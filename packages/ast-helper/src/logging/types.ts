/**
 * Logging types and interfaces
 * Defines the contract for structured logging in AST Copilot Helper
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  levelName: string;
  message: string;
  context?: Record<string, any>;
  operation?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface LogOutput {
  write(entry: LogEntry): void | Promise<void>;
  flush?(): void | Promise<void>;
  close?(): void | Promise<void>;
}

export interface LoggerOptions {
  /** Minimum log level to output */
  level: LogLevel;
  
  /** Include timestamp in logs */
  includeTimestamp?: boolean;
  
  /** Include context in logs */
  includeContext?: boolean;
  
  /** Maximum depth for context serialization */
  maxContextDepth?: number;
  
  /** Operation name for context */
  operation?: string;
  
  /** Additional outputs for logs */
  outputs?: LogOutput[];
}

export interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: Error;
  context?: Record<string, any>;
}

/**
 * Logger interface
 */
export interface Logger {
  error(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  debug(message: string, context?: Record<string, any>): void;
  trace(message: string, context?: Record<string, any>): void;
  
  /** Start performance measurement */
  startPerformance(operation: string, context?: Record<string, any>): PerformanceMetrics;
  
  /** End performance measurement and log if > threshold */
  endPerformance(metrics: PerformanceMetrics, success?: boolean, error?: Error): void;
  
  /** Create child logger with additional context */
  child(context: Record<string, any>): Logger;
  
  /** Flush all outputs */
  flush(): Promise<void>;
  
  /** Close logger and all outputs */
  close(): Promise<void>;
}
