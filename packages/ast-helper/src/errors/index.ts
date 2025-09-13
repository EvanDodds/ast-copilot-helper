/**
 * Error handling module index
 * Exports all error-related functionality
 */

export {
  AstError,
  ConfigurationError,
  FileSystemError,
  ValidationError,
  ParseError,
  DatabaseError,
  NetworkError,
  PermissionError,
  TimeoutError,
  GitError,
  GlobError,
  PathError,
  isAstError,
  ErrorRecoveryStrategy
} from './types.js';

export type { AstErrorContext, ErrorRecoveryInfo } from './types.js';

export { ErrorFormatter } from './formatter.js';
export type { ErrorFormattingOptions } from './formatter.js';

export {
  ConfigurationErrors,
  FileSystemErrors,
  ValidationErrors,
  ParseErrors,
  DatabaseErrors,
  NetworkErrors,
  TimeoutErrors,
  GitErrors,
  GlobErrors,
  PathErrors
} from './factories.js';

export {
  withRetry,
  withFallback,
  withTimeout,
  withErrorHandling,
  handleErrorWithRecovery,
  sleep,
  CircuitBreaker,
  AggregateError,
  executeWithErrorCollection,
  createSafeWrapper
} from './utils.js';

export type { RetryConfig } from './utils.js';
