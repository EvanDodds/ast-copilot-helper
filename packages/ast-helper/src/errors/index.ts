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
  TimeoutError
} from './types.js';

export { ErrorFormatter } from './formatter.js';
export type { ErrorFormattingOptions } from './formatter.js';

export {
  ConfigurationErrors,
  FileSystemErrors,
  ValidationErrors,
  ParseErrors,
  DatabaseErrors,
  NetworkErrors,
  TimeoutErrors
} from './factories.js';
