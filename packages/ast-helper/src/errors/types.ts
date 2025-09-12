/**
 * Base error classes and types for AST Copilot Helper
 * Provides structured error handling with context and user-friendly messages
 */

/**
 * Base error class for all AST Copilot Helper errors
 * Provides structured error information for both users and developers
 */
export abstract class AstError extends Error {
  /** Error code for programmatic handling */
  readonly code: string;
  
  /** Additional context information */
  readonly context: Record<string, any>;
  
  /** User-friendly suggestions for resolving the error */
  readonly suggestions: string[];
  
  /** Original error that caused this error (if any) */
  readonly errorCause?: Error;
  
  /** Marker property to identify AST errors */
  readonly isAstError: true = true;
  
  constructor(
    message: string,
    code: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.suggestions = suggestions;
    this.errorCause = cause;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Convert error to JSON for logging/reporting
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      suggestions: this.suggestions,
      stack: this.stack,
      cause: this.errorCause ? {
        name: this.errorCause.name,
        message: this.errorCause.message,
        stack: this.errorCause.stack
      } : undefined
    };
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends AstError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(message, 'CONFIGURATION_ERROR', context, suggestions, cause);
  }
}

/**
 * File system operation errors
 */
export class FileSystemError extends AstError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(message, 'FILESYSTEM_ERROR', context, suggestions, cause);
  }
}

/**
 * Validation errors for input data
 */
export class ValidationError extends AstError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(message, 'VALIDATION_ERROR', context, suggestions, cause);
  }
}

/**
 * Parsing and AST processing errors
 */
export class ParseError extends AstError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(message, 'PARSE_ERROR', context, suggestions, cause);
  }
}

/**
 * Database and indexing errors
 */
export class DatabaseError extends AstError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(message, 'DATABASE_ERROR', context, suggestions, cause);
  }
}

/**
 * Network and external service errors
 */
export class NetworkError extends AstError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(message, 'NETWORK_ERROR', context, suggestions, cause);
  }
}

/**
 * Permission and access errors
 */
export class PermissionError extends AstError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(message, 'PERMISSION_ERROR', context, suggestions, cause);
  }
}

/**
 * Operation timeout errors
 */
export class TimeoutError extends AstError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(message, 'TIMEOUT_ERROR', context, suggestions, cause);
  }
}
