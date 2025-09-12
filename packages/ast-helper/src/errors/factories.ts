/**
 * Error factory functions for common error scenarios
 * Provides pre-configured error instances with helpful messages and suggestions
 */

import {
  ConfigurationError,
  FileSystemError,
  ValidationError,
  ParseError,
  DatabaseError,
  NetworkError,
  PermissionError,
  TimeoutError
} from './types.js';

/**
 * Factory functions for configuration errors
 */
export const ConfigurationErrors = {
  /**
   * Invalid configuration value
   */
  invalidValue(key: string, value: any, expectedType: string): ConfigurationError {
    return new ConfigurationError(
      `Invalid configuration value for '${key}': expected ${expectedType}, got ${typeof value}`,
      { key, value, expectedType },
      [
        `Check your configuration files or environment variables`,
        `Ensure '${key}' is set to a valid ${expectedType}`,
        `Refer to the documentation for valid configuration options`
      ]
    );
  },

  /**
   * Missing required configuration
   */
  missingRequired(key: string, source?: string): ConfigurationError {
    const sourceMsg = source ? ` in ${source}` : '';
    return new ConfigurationError(
      `Missing required configuration: '${key}'${sourceMsg}`,
      { key, source },
      [
        `Set '${key}' in your configuration file or as an environment variable`,
        source ? `Check your ${source} configuration` : 'Check your configuration sources',
        `Run with --help to see configuration options`
      ]
    );
  },

  /**
   * Configuration file not found or inaccessible
   */
  fileNotAccessible(filePath: string, reason: string): ConfigurationError {
    return new ConfigurationError(
      `Configuration file not accessible: ${filePath}`,
      { filePath, reason },
      [
        `Ensure the configuration file exists at: ${filePath}`,
        `Check file permissions and ownership`,
        `Verify the file is readable by the current user`,
        `Create a default configuration file if it doesn't exist`
      ]
    );
  }
};

/**
 * Factory functions for file system errors
 */
export const FileSystemErrors = {
  /**
   * File or directory not found
   */
  notFound(path: string, operation: string): FileSystemError {
    return new FileSystemError(
      `File or directory not found: ${path}`,
      { path, operation },
      [
        `Verify the path exists: ${path}`,
        `Check for typos in the file path`,
        `Ensure the file wasn't moved or deleted`,
        `Run the parse command to create necessary files`
      ]
    );
  },

  /**
   * Permission denied
   */
  permissionDenied(path: string, operation: string): FileSystemError {
    return new FileSystemError(
      `Permission denied: cannot ${operation} ${path}`,
      { path, operation },
      [
        `Check file permissions for: ${path}`,
        `Ensure the current user has ${operation} access`,
        `Run with appropriate privileges if needed`,
        `Contact your system administrator if needed`
      ]
    );
  },

  /**
   * Disk space or quota exceeded
   */
  diskSpaceExceeded(path: string, requiredSpace?: number): FileSystemError {
    return new FileSystemError(
      `Insufficient disk space for operation at: ${path}`,
      { path, requiredSpace },
      [
        `Free up disk space on the target drive`,
        `Check available disk space with 'df -h' (Unix) or disk management (Windows)`,
        `Consider using a different location with more space`,
        requiredSpace ? `At least ${Math.round(requiredSpace / 1024 / 1024)}MB is required` : 'More disk space is required'
      ]
    );
  }
};

/**
 * Factory functions for validation errors
 */
export const ValidationErrors = {
  /**
   * Invalid input format
   */
  invalidFormat(input: string, expectedFormat: string): ValidationError {
    return new ValidationError(
      `Invalid input format: expected ${expectedFormat}`,
      { input: input.substring(0, 100), expectedFormat },
      [
        `Ensure input matches the expected format: ${expectedFormat}`,
        `Check for syntax errors or formatting issues`,
        `Refer to documentation for valid input examples`,
        `Use a linter or formatter to validate your input`
      ]
    );
  },

  /**
   * Value out of range
   */
  outOfRange(value: number, min: number, max: number, field?: string): ValidationError {
    const fieldMsg = field ? ` for ${field}` : '';
    return new ValidationError(
      `Value out of range${fieldMsg}: ${value} (must be between ${min} and ${max})`,
      { value, min, max, field },
      [
        `Use a value between ${min} and ${max}`,
        field ? `Check the ${field} configuration` : 'Check the input value',
        `Refer to documentation for valid ranges`
      ]
    );
  }
};

/**
 * Factory functions for parse errors
 */
export const ParseErrors = {
  /**
   * Syntax error in source code
   */
  syntaxError(filePath: string, line: number, column: number, details: string): ParseError {
    return new ParseError(
      `Syntax error in ${filePath}:${line}:${column} - ${details}`,
      { filePath, line, column, details },
      [
        `Fix the syntax error in ${filePath} at line ${line}, column ${column}`,
        `Check for missing brackets, semicolons, or other syntax issues`,
        `Use a code editor with syntax highlighting`,
        `Run a linter to identify and fix syntax issues`
      ]
    );
  },

  /**
   * Unsupported language or file type
   */
  unsupportedLanguage(filePath: string, detectedType: string): ParseError {
    return new ParseError(
      `Unsupported language or file type: ${detectedType} for ${filePath}`,
      { filePath, detectedType },
      [
        `Use a supported file type (TypeScript, JavaScript, Python)`,
        `Check the file extension and content`,
        `Add support for ${detectedType} if needed`,
        `Update parseGlob configuration to include supported file types`
      ]
    );
  }
};

/**
 * Factory functions for database errors
 */
export const DatabaseErrors = {
  /**
   * Database corruption detected
   */
  corruption(dbPath: string, details?: string): DatabaseError {
    return new DatabaseError(
      `Database corruption detected in ${dbPath}${details ? ': ' + details : ''}`,
      { dbPath, details },
      [
        `Delete the corrupted database: ${dbPath}`,
        `Re-run the parse command to rebuild the database`,
        `Check for disk space issues that might cause corruption`,
        `Backup your source code before rebuilding`
      ]
    );
  },

  /**
   * Database version mismatch
   */
  versionMismatch(currentVersion: string, expectedVersion: string, dbPath: string): DatabaseError {
    return new DatabaseError(
      `Database version mismatch: found ${currentVersion}, expected ${expectedVersion}`,
      { currentVersion, expectedVersion, dbPath },
      [
        `Delete the old database: ${dbPath}`,
        `Re-run the parse command to create a new database`,
        `Upgrade to the latest version of ast-copilot-helper`,
        `Backup your configuration before upgrading`
      ]
    );
  }
};

/**
 * Factory functions for network errors
 */
export const NetworkErrors = {
  /**
   * Connection timeout
   */
  timeout(url: string, timeoutMs: number): NetworkError {
    return new NetworkError(
      `Network timeout connecting to ${url} after ${timeoutMs}ms`,
      { url, timeoutMs },
      [
        `Check your internet connection`,
        `Verify the URL is correct: ${url}`,
        `Try increasing the timeout value`,
        `Check if the service is temporarily unavailable`
      ]
    );
  },

  /**
   * Service unavailable
   */
  serviceUnavailable(serviceName: string, statusCode?: number): NetworkError {
    return new NetworkError(
      `Service unavailable: ${serviceName}${statusCode ? ` (HTTP ${statusCode})` : ''}`,
      { serviceName, statusCode },
      [
        `Check if ${serviceName} is currently available`,
        `Try again later as the service might be temporarily down`,
        `Verify your API credentials if required`,
        `Check service status page or documentation`
      ]
    );
  }
};

/**
 * Factory functions for timeout errors
 */
export const TimeoutErrors = {
  /**
   * Operation timeout
   */
  operationTimeout(operation: string, timeoutMs: number): TimeoutError {
    return new TimeoutError(
      `Operation timeout: ${operation} exceeded ${timeoutMs}ms`,
      { operation, timeoutMs },
      [
        `Increase the timeout value for ${operation}`,
        `Check if the operation is stuck or inefficient`,
        `Reduce the scope of the operation if possible`,
        `Check system resources (CPU, memory, disk I/O)`
      ]
    );
  }
};
