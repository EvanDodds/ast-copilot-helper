/**
 * Error formatting utilities
 * Provides user-friendly and developer-friendly error formatting
 */

import type { AstError } from './types.js';

export interface ErrorFormattingOptions {
  /** Include context information */
  includeContext?: boolean;
  
  /** Include suggestions */
  includeSuggestions?: boolean;
  
  /** Include stack trace */
  includeStack?: boolean;
  
  /** Include cause chain */
  includeCause?: boolean;
  
  /** Maximum context depth */
  maxContextDepth?: number;
}

/**
 * Error formatter for different output formats
 */
export class ErrorFormatter {
  private readonly defaultOptions: Required<ErrorFormattingOptions> = {
    includeContext: true,
    includeSuggestions: true,
    includeStack: false,
    includeCause: true,
    maxContextDepth: 3
  };

  /**
   * Format error for end users (clean, actionable)
   */
  formatForUser(error: Error | AstError, options: ErrorFormattingOptions = {}): string {
    const opts = { ...this.defaultOptions, ...options };
    const parts: string[] = [];

    // Main error message
    parts.push(`❌ Error: ${error.message}`);

    // Add error code if it's an AstError
    if (this.isAstError(error)) {
      parts.push(`   Code: ${error.code}`);

      // Add context if available and requested
      if (opts.includeContext && Object.keys(error.context).length > 0) {
        parts.push('');
        parts.push('📍 Context:');
        for (const [key, value] of Object.entries(error.context)) {
          const formattedValue = this.formatContextValue(value, opts.maxContextDepth);
          parts.push(`   ${key}: ${formattedValue}`);
        }
      }

      // Add suggestions if available
      if (opts.includeSuggestions && error.suggestions.length > 0) {
        parts.push('');
        parts.push('💡 Suggestions:');
        for (const suggestion of error.suggestions) {
          parts.push(`   • ${suggestion}`);
        }
      }

      // Add cause information if requested
      if (opts.includeCause && error.cause) {
        parts.push('');
        parts.push(`🔗 Caused by: ${error.cause.message}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Format error for developers (detailed, with debugging info)
   */
  formatForDebug(error: Error | AstError, options: ErrorFormattingOptions = {}): string {
    const opts = { 
      ...this.defaultOptions, 
      includeStack: true, 
      includeCause: true,
      ...options 
    };
    const parts: string[] = [];

    // Error header
    parts.push(`[${new Date().toISOString()}] ${error.name}: ${error.message}`);

    // Add error code and full context for AstError
    if (this.isAstError(error)) {
      parts.push(`Code: ${error.code}`);

      // Full context dump
      if (Object.keys(error.context).length > 0) {
        parts.push('');
        parts.push('Context:');
        parts.push(JSON.stringify(error.context, null, 2));
      }

      // Suggestions
      if (error.suggestions.length > 0) {
        parts.push('');
        parts.push('Suggestions:');
        error.suggestions.forEach((suggestion, index) => {
          parts.push(`  ${index + 1}. ${suggestion}`);
        });
      }
    }

    // Stack trace
    if (opts.includeStack && error.stack) {
      parts.push('');
      parts.push('Stack trace:');
      parts.push(error.stack);
    }

    // Cause chain
    if (opts.includeCause && error.cause instanceof Error) {
      parts.push('');
      parts.push('--- Caused by ---');
      parts.push(this.formatForDebug(error.cause, opts));
    }

    return parts.join('\n');
  }

  /**
   * Format error for logging (structured JSON)
   */
  formatForLogging(error: Error | AstError): Record<string, any> {
    const logEntry: Record<string, any> = {
      timestamp: new Date().toISOString(),
      level: 'error',
      name: error.name,
      message: error.message
    };

    if (this.isAstError(error)) {
      logEntry.code = error.code;
      logEntry.context = error.context;
      logEntry.suggestions = error.suggestions;
      
      if (error.cause) {
        logEntry.cause = {
          name: error.cause.name,
          message: error.cause.message
        };
      }
    }

    if (error.stack) {
      logEntry.stack = error.stack.split('\n');
    }

    return logEntry;
  }

  /**
   * Create a brief error summary (single line)
   */
  createSummary(error: Error | AstError): string {
    if (this.isAstError(error)) {
      return `${error.code}: ${error.message}`;
    }
    return `${error.name}: ${error.message}`;
  }

  /**
   * Type guard to check if error is an AstError
   */
  private isAstError(error: Error): error is AstError {
    return error instanceof Error && 
           'code' in error && 
           'context' in error && 
           'suggestions' in error;
  }

  /**
   * Format context values for display
   */
  private formatContextValue(value: any, maxDepth: number, currentDepth: number = 0): string {
    if (currentDepth >= maxDepth) {
      return '[object]';
    }

    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      if (value.length === 1) {
        return `[${this.formatContextValue(value[0], maxDepth, currentDepth + 1)}]`;
      }
      return `[${value.length} items]`;
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      if (keys.length === 1) {
        const key = keys[0];
        if (key !== undefined) {
          const val = this.formatContextValue(value[key], maxDepth, currentDepth + 1);
          return `{${key}: ${val}}`;
        }
      }
      return `{${keys.length} properties}`;
    }

    return String(value);
  }
}
