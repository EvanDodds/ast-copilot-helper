/**
 * Enhanced Logging Infrastructure - Contextual Logging Extensions
 * Adds operation correlation, request tracing, and enhanced metadata capture
 */

import { randomUUID } from 'crypto';
import type { Logger, LogEntry, LogOutput } from './types.js';

/**
 * Enhanced context for operation correlation
 */
export interface EnhancedLogContext {
  /** Unique operation ID for tracing across components */
  operationId?: string;
  
  /** Request ID for correlating related operations */
  requestId?: string;
  
  /** Component or module name */
  component?: string;
  
  /** User ID or session for user-specific operations */
  userId?: string;
  
  /** Performance metadata */
  performance?: {
    startTime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
  
  /** Additional custom metadata */
  metadata?: Record<string, any>;
}

/**
 * Correlation context manager for tracking operations across components
 */
export class CorrelationContext {
  private static context = new Map<string, EnhancedLogContext>();
  private static currentOperationId: string | null = null;
  
  /**
   * Start a new operation with correlation tracking
   */
  static startOperation(context: Omit<EnhancedLogContext, 'operationId'> = {}): string {
    const operationId = randomUUID();
    this.currentOperationId = operationId;
    
    this.context.set(operationId, {
      ...context,
      operationId,
      performance: {
        startTime: Date.now(),
        memoryUsage: process.memoryUsage().heapUsed,
        ...context.performance
      }
    });
    
    return operationId;
  }
  
  /**
   * Get current operation context
   */
  static getCurrentContext(): EnhancedLogContext | null {
    if (!this.currentOperationId) return null;
    return this.context.get(this.currentOperationId) || null;
  }
  
  /**
   * Update current operation context
   */
  static updateContext(updates: Partial<EnhancedLogContext>): void {
    if (!this.currentOperationId) return;
    
    const current = this.context.get(this.currentOperationId);
    if (current) {
      this.context.set(this.currentOperationId, { ...current, ...updates });
    }
  }
  
  /**
   * End current operation and cleanup context
   */
  static endOperation(): EnhancedLogContext | null {
    if (!this.currentOperationId) return null;
    
    const context = this.context.get(this.currentOperationId);
    if (context && context.performance) {
      context.performance = {
        ...context.performance,
        memoryUsage: process.memoryUsage().heapUsed
      };
    }
    
    this.context.delete(this.currentOperationId);
    this.currentOperationId = null;
    
    return context || null;
  }
  
  /**
   * Run operation with automatic context management
   */
  static async withOperation<T>(
    context: Omit<EnhancedLogContext, 'operationId'>,
    operation: (operationId: string) => Promise<T>
  ): Promise<T> {
    const operationId = this.startOperation(context);
    try {
      return await operation(operationId);
    } finally {
      this.endOperation();
    }
  }
}

/**
 * Enhanced logger wrapper with correlation support
 */
export class CorrelatedLogger {
  constructor(private baseLogger: Logger) {}
  
  /**
   * Log with automatic correlation context
   */
  private logWithCorrelation(
    method: keyof Pick<Logger, 'error' | 'warn' | 'info' | 'debug' | 'trace'>,
    message: string,
    context?: Record<string, any>
  ): void {
    const correlation = CorrelationContext.getCurrentContext();
    const enhancedContext = {
      ...context,
      ...correlation,
      timestamp: new Date().toISOString()
    };
    
    this.baseLogger[method](message, enhancedContext);
  }
  
  error(message: string, context?: Record<string, any>): void {
    this.logWithCorrelation('error', message, context);
  }
  
  warn(message: string, context?: Record<string, any>): void {
    this.logWithCorrelation('warn', message, context);
  }
  
  info(message: string, context?: Record<string, any>): void {
    this.logWithCorrelation('info', message, context);
  }
  
  debug(message: string, context?: Record<string, any>): void {
    this.logWithCorrelation('debug', message, context);
  }
  
  trace(message: string, context?: Record<string, any>): void {
    this.logWithCorrelation('trace', message, context);
  }
  
  /**
   * Start performance tracking for an operation
   */
  startPerformance(operation: string, context?: Record<string, any>) {
    const correlation = CorrelationContext.getCurrentContext();
    return this.baseLogger.startPerformance(operation, {
      ...context,
      ...correlation
    });
  }
  
  /**
   * End performance tracking
   */
  endPerformance(metrics: any, success?: boolean, error?: Error): void {
    return this.baseLogger.endPerformance(metrics, success, error);
  }
  
  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): CorrelatedLogger {
    return new CorrelatedLogger(this.baseLogger.child(context));
  }
  
  /**
   * Flush logs
   */
  async flush(): Promise<void> {
    return this.baseLogger.flush();
  }
  
  /**
   * Close logger
   */
  async close(): Promise<void> {
    return this.baseLogger.close();
  }
}

/**
 * Structured metadata capture utilities
 */
export class LogMetadataCapture {
  /**
   * Capture system performance metadata
   */
  static captureSystemMetrics(): Record<string, any> {
    const memUsage = process.memoryUsage();
    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  }
  
  /**
   * Capture error metadata with stack trace analysis
   */
  static captureErrorMetadata(error: Error): Record<string, any> {
    return {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 10), // Limit stack trace
        timestamp: Date.now()
      }
    };
  }
  
  /**
   * Capture operation timing metadata
   */
  static captureTimingMetadata(startTime: number, operation: string): Record<string, any> {
    const endTime = Date.now();
    return {
      timing: {
        operation,
        startTime,
        endTime,
        duration: endTime - startTime,
        timestamp: endTime
      }
    };
  }
}

/**
 * Enhanced log output with correlation support
 */
export class CorrelatedLogOutput implements LogOutput {
  constructor(private baseOutput: LogOutput) {}
  
  write(entry: LogEntry): void | Promise<void> {
    // Enhance entry with correlation metadata if available
    const correlation = CorrelationContext.getCurrentContext();
    if (correlation) {
      entry.context = {
        ...entry.context,
        correlation: {
          operationId: correlation.operationId,
          requestId: correlation.requestId,
          component: correlation.component,
          userId: correlation.userId
        }
      };
    }
    
    return this.baseOutput.write(entry);
  }
  
  async flush(): Promise<void> {
    if (this.baseOutput.flush) {
      return this.baseOutput.flush();
    }
  }
  
  async close(): Promise<void> {
    if (this.baseOutput.close) {
      return this.baseOutput.close();
    }
  }
}