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

/**
 * Git repository and version control errors
 */
export class GitError extends AstError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(message, 'GIT_ERROR', context, suggestions, cause);
  }
}

/**
 * Glob pattern matching and file filtering errors
 */
export class GlobError extends AstError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(message, 'GLOB_ERROR', context, suggestions, cause);
  }
}

/**
 * Path resolution and normalization errors
 */
export class PathError extends AstError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    suggestions: string[] = [],
    cause?: Error
  ) {
    super(message, 'PATH_ERROR', context, suggestions, cause);
  }
}

/**
 * Type guard to check if error is an AST error
 */
export function isAstError(error: unknown): error is AstError {
  return error instanceof Error && 'isAstError' in error && error.isAstError === true;
}

/**
 * Error recovery strategies
 */
export enum ErrorRecoveryStrategy {
  /** Retry the operation with exponential backoff */
  RETRY = 'retry',
  /** Ignore the error and continue */
  IGNORE = 'ignore',
  /** Use fallback logic */
  FALLBACK = 'fallback',
  /** Fail fast and propagate */
  FAIL_FAST = 'fail_fast',
  /** Show user prompt for input */
  PROMPT_USER = 'prompt_user'
}

/**
 * Error recovery information
 */
export interface ErrorRecoveryInfo {
  /** Suggested recovery strategy */
  strategy: ErrorRecoveryStrategy;
  /** Maximum retry attempts (for RETRY strategy) */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Fallback value or function (for FALLBACK strategy) */
  fallbackValue?: any;
  /** Custom recovery function */
  customRecovery?: () => Promise<any> | any;
}

/**
 * Enhanced error context with recovery information
 */
export interface AstErrorContext extends Record<string, any> {
  /** File path or resource involved */
  path?: string;
  /** Operation that failed */
  operation?: string;
  /** Command or method called */
  command?: string;
  /** Parameters passed to the operation */
  parameters?: Record<string, any>;
  /** Current working directory */
  cwd?: string;
  /** Environment variables */
  environment?: Record<string, string>;
  /** Recovery information */
  recovery?: ErrorRecoveryInfo;
}
