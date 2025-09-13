/**
 * Main logger implementation
 * Provides configurable logging with multiple outputs and performance tracking
 */

import type { 
  Logger, 
  LoggerOptions, 
  LogEntry, 
  LogOutput, 
  LogLevel, 
  PerformanceMetrics 
} from './types.js';
import { LogLevel as LL } from './types.js';
import { ConsoleOutput } from './console-output.js';

export class AstLogger implements Logger {
  private readonly level: LogLevel;
  private readonly includeTimestamp: boolean;
  private readonly includeContext: boolean;
  private readonly maxContextDepth: number;
  private readonly operation?: string;
  private readonly outputs: LogOutput[];
  private readonly childContext: Record<string, any>;
  private readonly performanceThresholdMs: number;

  constructor(options: LoggerOptions & { 
    childContext?: Record<string, any>;
    performanceThresholdMs?: number;
  } = { level: LL.INFO }) {
    this.level = options.level;
    this.includeTimestamp = options.includeTimestamp ?? true;
    this.includeContext = options.includeContext ?? true;
    this.maxContextDepth = options.maxContextDepth ?? 3;
    this.operation = options.operation;
    this.childContext = options.childContext ?? {};
    this.performanceThresholdMs = options.performanceThresholdMs ?? 1000;
    
    // Set up outputs
    this.outputs = options.outputs ?? [new ConsoleOutput()];
  }

  error(message: string, context?: Record<string, any>): void {
    this.log(LL.ERROR, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LL.WARN, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LL.INFO, message, context);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LL.DEBUG, message, context);
  }

  trace(message: string, context?: Record<string, any>): void {
    this.log(LL.TRACE, message, context);
  }

  startPerformance(operation: string, context?: Record<string, any>): PerformanceMetrics {
    return {
      operation,
      startTime: performance.now(),
      success: false,
      context: { ...this.childContext, ...context }
    };
  }

  endPerformance(metrics: PerformanceMetrics, success = true, error?: Error): void {
    metrics.endTime = performance.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.success = success;
    metrics.error = error;

    // Log performance metrics if above threshold
    if (metrics.duration >= this.performanceThresholdMs) {
      const level = success ? LL.INFO : LL.WARN;
      const status = success ? 'completed' : 'failed';
      const message = `Operation ${metrics.operation} ${status}`;
      
      const context: Record<string, any> = {
        ...metrics.context,
        duration: Math.round(metrics.duration),
        success: metrics.success
      };

      if (error) {
        context.error = {
          name: error.name,
          message: error.message,
          ...(error instanceof Error && 'code' in error ? { code: (error as any).code } : {})
        };
      }

      this.log(level, message, context, metrics.duration, error);
    }
  }

  child(context: Record<string, any>): Logger {
    return new AstLogger({
      level: this.level,
      includeTimestamp: this.includeTimestamp,
      includeContext: this.includeContext,
      maxContextDepth: this.maxContextDepth,
      operation: this.operation,
      outputs: this.outputs,
      childContext: { ...this.childContext, ...context },
      performanceThresholdMs: this.performanceThresholdMs
    });
  }

  async flush(): Promise<void> {
    const flushPromises = this.outputs.map(output => 
      output.flush ? output.flush() : Promise.resolve()
    );
    await Promise.all(flushPromises);
  }

  async close(): Promise<void> {
    const closePromises = this.outputs.map(output => 
      output.close ? output.close() : Promise.resolve()
    );
    await Promise.all(closePromises);
  }

  private log(
    level: LogLevel, 
    message: string, 
    context?: Record<string, any>,
    duration?: number,
    error?: Error
  ): void {
    // Check if level should be logged
    if (level > this.level) {
      return;
    }

    // Combine contexts
    const combinedContext = this.includeContext ? {
      ...this.childContext,
      ...context
    } : undefined;

    // Create log entry
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      levelName: this.getLevelName(level),
      message,
      ...(combinedContext && Object.keys(combinedContext).length > 0 ? { 
        context: this.sanitizeContext(combinedContext) 
      } : {}),
      ...(this.operation ? { operation: this.operation } : {}),
      ...(duration !== undefined ? { duration } : {}),
      ...(error ? {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          ...(error instanceof Error && 'code' in error ? { 
            code: (error as any).code 
          } : {})
        }
      } : {})
    };

    // Write to all outputs
    for (const output of this.outputs) {
      try {
        output.write(entry);
      } catch (outputError) {
        console.error('Failed to write to log output:', outputError);
      }
    }
  }

  private getLevelName(level: LogLevel): string {
    switch (level) {
      case LL.ERROR: return 'ERROR';
      case LL.WARN:  return 'WARN';
      case LL.INFO:  return 'INFO';
      case LL.DEBUG: return 'DEBUG';
      case LL.TRACE: return 'TRACE';
      default: return 'UNKNOWN';
    }
  }

  private sanitizeContext(context: Record<string, any>, depth = 0): Record<string, any> {
    if (depth >= this.maxContextDepth) {
      return { '[max depth]': true };
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(context)) {
      if (value === null || value === undefined) {
        sanitized[key] = value;
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else if (value instanceof Error) {
        sanitized[key] = {
          name: value.name,
          message: value.message,
          ...(value.stack ? { stack: value.stack.split('\n').slice(0, 5) } : {})
        };
      } else if (Array.isArray(value)) {
        if (value.length <= 10) {
          sanitized[key] = value.map(item => 
            typeof item === 'object' && item !== null ? 
              this.sanitizeContext({ item }, depth + 1).item : 
              item
          );
        } else {
          sanitized[key] = `[Array of ${value.length} items]`;
        }
      } else if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length <= 20) {
          sanitized[key] = this.sanitizeContext(value, depth + 1);
        } else {
          sanitized[key] = `[Object with ${keys.length} properties]`;
        }
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }
}
