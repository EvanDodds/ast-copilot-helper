/**
 * Enhanced logging utilities for better operation tracing and debugging
 */

import { randomUUID } from 'crypto';
import type { Logger } from './types.js';

/**
 * Enhanced context interface for better operation tracking
 */
export interface EnhancedLogContext {
  operationId?: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  component?: string;
  method?: string;
  requestId?: string;
  traceId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

/**
 * Performance tracking context
 */
export interface PerformanceContext extends EnhancedLogContext {
  startTime: number;
  checkpoints?: Array<{
    name: string;
    timestamp: number;
    duration: number;
    metadata?: Record<string, any>;
  }>;
}

/**
 * Generate a unique operation ID for request tracking
 */
export function generateOperationId(): string {
  return `op_${randomUUID().substring(0, 8)}_${Date.now()}`;
}

/**
 * Generate a correlation ID for distributed tracing
 */
export function generateCorrelationId(): string {
  return `corr_${randomUUID().substring(0, 12)}`;
}

/**
 * Create enhanced context with automatic ID generation
 */
export function createEnhancedContext(
  baseContext: Partial<EnhancedLogContext> = {}
): EnhancedLogContext {
  return {
    operationId: baseContext.operationId || generateOperationId(),
    correlationId: baseContext.correlationId || generateCorrelationId(),
    timestamp: new Date().toISOString(),
    ...baseContext,
  };
}

/**
 * Enhanced logger wrapper with automatic context management
 */
export class EnhancedLogger {
  private baseContext: EnhancedLogContext;
  
  constructor(
    private logger: Logger,
    context: Partial<EnhancedLogContext> = {}
  ) {
    this.baseContext = createEnhancedContext(context);
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: Partial<EnhancedLogContext>): EnhancedLogger {
    return new EnhancedLogger(this.logger, {
      ...this.baseContext,
      ...additionalContext,
    });
  }

  /**
   * Log with enhanced context
   */
  private logWithContext(
    level: 'error' | 'warn' | 'info' | 'debug' | 'trace',
    message: string,
    context?: Record<string, any>
  ): void {
    const enhancedContext = {
      ...this.baseContext,
      ...context,
      timestamp: new Date().toISOString(),
    };

    this.logger[level](message, enhancedContext);
  }

  error(message: string, context?: Record<string, any>): void {
    this.logWithContext('error', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.logWithContext('warn', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.logWithContext('info', message, context);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.logWithContext('debug', message, context);
  }

  trace(message: string, context?: Record<string, any>): void {
    this.logWithContext('trace', message, context);
  }

  /**
   * Start operation with performance tracking (convenience method)
   */
  startOperation(
    operation: string, 
    context?: Record<string, any>
  ): PerformanceContext {
    return this.startPerformanceTracking(operation, context);
  }

  /**
   * Start performance tracking with checkpoints
   */
  startPerformanceTracking(
    operation: string,
    context?: Partial<EnhancedLogContext>
  ): PerformanceContext {
    const performanceContext: PerformanceContext = {
      ...this.baseContext,
      ...context,
      operationId: context?.operationId || generateOperationId(),
      startTime: Date.now(),
      checkpoints: [],
    };

    this.info(`Started operation: ${operation}`, {
      ...performanceContext,
      operation,
      event: 'operation_start',
    });

    return performanceContext;
  }

  /**
   * Add checkpoint to performance tracking
   */
  addCheckpoint(
    context: PerformanceContext,
    checkpointName: string,
    metadata?: Record<string, any>
  ): void {
    const now = Date.now();
    const checkpoint = {
      name: checkpointName,
      timestamp: now,
      duration: now - context.startTime,
      metadata,
    };

    context.checkpoints!.push(checkpoint);

    this.debug(`Checkpoint: ${checkpointName}`, {
      ...context,
      checkpoint,
      event: 'checkpoint',
    });
  }

  /**
   * End performance tracking with summary
   */
  endPerformanceTracking(
    context: PerformanceContext,
    operation: string,
    success = true,
    error?: Error
  ): void {
    const endTime = Date.now();
    const totalDuration = endTime - context.startTime;

    const summary: any = {
      ...context,
      operation,
      success,
      totalDuration,
      endTime,
      checkpointCount: context.checkpoints?.length || 0,
      event: 'operation_complete',
    };

    if (error) {
      summary.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (success) {
      this.info(`Completed operation: ${operation} (${totalDuration}ms)`, summary);
    } else {
      this.error(`Failed operation: ${operation} (${totalDuration}ms)`, summary);
    }
  }

  /**
   * Log operation with automatic timing
   */
  async withOperation<T>(
    operationName: string,
    operation: (context: PerformanceContext) => Promise<T>,
    context?: Partial<EnhancedLogContext>
  ): Promise<T> {
    const perfContext = this.startPerformanceTracking(operationName, context);
    
    try {
      const result = await operation(perfContext);
      this.endPerformanceTracking(perfContext, operationName, true);
      return result;
    } catch (error) {
      this.endPerformanceTracking(perfContext, operationName, false, error as Error);
      throw error;
    }
  }

  /**
   * Log structured error with enhanced context
   */
  logError(
    error: Error,
    operation: string,
    context?: Record<string, any>
  ): void {
    this.error(`Error in ${operation}: ${error.message}`, {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      operation,
      event: 'error',
    });
  }

  /**
   * Get current context
   */
  getContext(): EnhancedLogContext {
    return { ...this.baseContext };
  }
}

/**
 * Create enhanced logger with automatic context
 */
export function createEnhancedLogger(
  baseLogger: Logger,
  context?: Partial<EnhancedLogContext>
): EnhancedLogger {
  return new EnhancedLogger(baseLogger, context);
}

/**
 * Middleware for HTTP-like request context
 */
export function createRequestLogger(
  baseLogger: Logger,
  requestId: string,
  userId?: string
): EnhancedLogger {
  return createEnhancedLogger(baseLogger, {
    requestId,
    userId,
    component: 'http-request',
  });
}

/**
 * Create component-specific logger
 */
export function createComponentLogger(
  baseLogger: Logger,
  component: string,
  method?: string
): EnhancedLogger {
  return createEnhancedLogger(baseLogger, {
    component,
    method,
  });
}