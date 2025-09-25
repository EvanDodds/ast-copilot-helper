/**
 * Error factory functions for common error scenarios
 * Provides pre-configured error instances with helpful messages and suggestions
 */

import {
  ConfigurationError,
  DatabaseError,
  FileSystemError,
  GitError,
  GlobError,
  NetworkError,
  ParseError,
  PathError,
  TimeoutError,
  ValidationError,
} from "./types.js";

/**
 * Factory functions for configuration errors
 */
export const ConfigurationErrors = {
  /**
   * Invalid configuration value
   */
  invalidValue(
    key: string,
    value: any,
    expectedType: string,
  ): ConfigurationError {
    return new ConfigurationError(
      `Invalid configuration value for '${key}': expected ${expectedType}, got ${typeof value}`,
      { key, value, expectedType },
      [
        `Check your configuration files or environment variables`,
        `Ensure '${key}' is set to a valid ${expectedType}`,
        `Refer to the documentation for valid configuration options`,
      ],
    );
  },

  /**
   * Missing required configuration
   */
  missingRequired(key: string, source?: string): ConfigurationError {
    const sourceMsg = source ? ` in ${source}` : "";
    return new ConfigurationError(
      `Missing required configuration: '${key}'${sourceMsg}`,
      { key, source },
      [
        `Set '${key}' in your configuration file or as an environment variable`,
        source
          ? `Check your ${source} configuration`
          : "Check your configuration sources",
        `Run with --help to see configuration options`,
      ],
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
        `Create a default configuration file if it doesn't exist`,
      ],
    );
  },

  /**
   * Failed to load configuration
   */
  loadFailed(message: string, cause?: Error): ConfigurationError {
    return new ConfigurationError(message, { cause: cause?.message }, [
      `Check your configuration files for syntax errors`,
      `Verify all configuration sources are accessible`,
      `Check environment variables and CLI arguments`,
      `Use --debug to see detailed error information`,
    ]);
  },
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
        `Run the parse command to create necessary files`,
      ],
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
        `Contact your system administrator if needed`,
      ],
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
        requiredSpace
          ? `At least ${Math.round(requiredSpace / 1024 / 1024)}MB is required`
          : "More disk space is required",
      ],
    );
  },
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
        `Use a linter or formatter to validate your input`,
      ],
    );
  },

  /**
   * Value out of range
   */
  outOfRange(
    value: number,
    min: number,
    max: number,
    field?: string,
  ): ValidationError {
    const fieldMsg = field ? ` for ${field}` : "";
    return new ValidationError(
      `Value out of range${fieldMsg}: ${value} (must be between ${min} and ${max})`,
      { value, min, max, field },
      [
        `Use a value between ${min} and ${max}`,
        field ? `Check the ${field} configuration` : "Check the input value",
        `Refer to documentation for valid ranges`,
      ],
    );
  },

  /**
   * Missing required value
   */
  missingValue(field: string, expectedType: string): ValidationError {
    return new ValidationError(
      `Missing value for ${field}: expected ${expectedType}`,
      { field, expectedType },
      [
        `Provide a value for ${field}`,
        `Check your command line arguments or configuration`,
        `Use --help to see usage information`,
      ],
    );
  },

  /**
   * Invalid value
   */
  invalidValue(field: string, value: string, reason: string): ValidationError {
    return new ValidationError(
      `Invalid value for ${field}: ${value}. ${reason}`,
      { field, value, reason },
      [
        `Provide a valid value for ${field}`,
        reason,
        `Use --help to see usage information`,
      ],
    );
  },
};

/**
 * Factory functions for parse errors
 */
export const ParseErrors = {
  /**
   * Syntax error in source code
   */
  syntaxError(
    filePath: string,
    line: number,
    column: number,
    details: string,
  ): ParseError {
    return new ParseError(
      `Syntax error in ${filePath}:${line}:${column} - ${details}`,
      { filePath, line, column, details },
      [
        `Fix the syntax error in ${filePath} at line ${line}, column ${column}`,
        `Check for missing brackets, semicolons, or other syntax issues`,
        `Use a code editor with syntax highlighting`,
        `Run a linter to identify and fix syntax issues`,
      ],
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
        `Update parseGlob configuration to include supported file types`,
      ],
    );
  },
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
      `Database corruption detected in ${dbPath}${details ? ": " + details : ""}`,
      { dbPath, details },
      [
        `Delete the corrupted database: ${dbPath}`,
        `Re-run the parse command to rebuild the database`,
        `Check for disk space issues that might cause corruption`,
        `Backup your source code before rebuilding`,
      ],
    );
  },

  /**
   * Database version mismatch
   */
  versionMismatch(
    currentVersion: string,
    expectedVersion: string,
    dbPath: string,
  ): DatabaseError {
    return new DatabaseError(
      `Database version mismatch: found ${currentVersion}, expected ${expectedVersion}`,
      { currentVersion, expectedVersion, dbPath },
      [
        `Delete the old database: ${dbPath}`,
        `Re-run the parse command to create a new database`,
        `Upgrade to the latest version of ast-copilot-helper`,
        `Backup your configuration before upgrading`,
      ],
    );
  },

  /**
   * Database not initialized
   */
  notInitialized(workspacePath: string): DatabaseError {
    return new DatabaseError(
      `AST database not initialized in ${workspacePath}`,
      { workspacePath },
      [
        `Run 'ast-helper init' to initialize the database`,
        `Verify you're in the correct workspace directory`,
        `Check if .astdb directory exists`,
        `Use --workspace option to specify the correct path`,
      ],
    );
  },

  /**
   * Directory creation failed
   */
  directoryCreationFailed(dirPath: string, cause: Error): DatabaseError {
    return new DatabaseError(
      `Failed to create database directory: ${dirPath}`,
      { dirPath, cause: cause.message },
      [
        `Check directory permissions for: ${dirPath}`,
        `Ensure sufficient disk space is available`,
        `Verify the parent directory exists and is writable`,
        `Check for conflicts with existing files or directories`,
      ],
    );
  },

  /**
   * Insufficient disk space
   */
  insufficientSpace(targetPath: string, details?: string): DatabaseError {
    return new DatabaseError(
      `Insufficient disk space for database operations at: ${targetPath}`,
      { targetPath, details },
      [
        `Free up disk space on the target drive`,
        `Check available space with 'df -h' (Unix) or disk management (Windows)`,
        `Consider using a different location with more space`,
        `Clean up temporary files and unused data`,
      ],
    );
  },

  /**
   * Database initialization failed
   */
  initializationFailed(workspacePath: string, cause?: Error): DatabaseError {
    return new DatabaseError(
      `Database initialization failed in ${workspacePath}`,
      { workspacePath, cause: cause?.message },
      [
        `Check workspace permissions and disk space`,
        `Ensure the workspace path is valid and accessible`,
        `Try using --force to overwrite existing database`,
        `Check logs for detailed error information`,
      ],
    );
  },
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
        `Check if the service is temporarily unavailable`,
      ],
    );
  },

  /**
   * Service unavailable
   */
  serviceUnavailable(serviceName: string, statusCode?: number): NetworkError {
    return new NetworkError(
      `Service unavailable: ${serviceName}${statusCode ? ` (HTTP ${statusCode})` : ""}`,
      { serviceName, statusCode },
      [
        `Check if ${serviceName} is currently available`,
        `Try again later as the service might be temporarily down`,
        `Verify your API credentials if required`,
        `Check service status page or documentation`,
      ],
    );
  },
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
        `Check system resources (CPU, memory, disk I/O)`,
      ],
    );
  },
};

/**
 * Factory functions for Git errors
 */
export const GitErrors = {
  /**
   * Not a Git repository
   */
  notARepository(path: string): GitError {
    return new GitError(
      `Not a Git repository: ${path}`,
      { path, operation: "git-check" },
      [
        `Initialize a Git repository with: git init`,
        `Verify you're in the correct directory`,
        `Check if the .git directory exists`,
        `Clone a repository if working with remote code`,
      ],
    );
  },

  /**
   * Git command failed
   */
  commandFailed(
    command: string,
    exitCode: number,
    stderr: string,
    cwd?: string,
  ): GitError {
    return new GitError(
      `Git command failed: ${command} (exit code ${exitCode})`,
      {
        command,
        exitCode,
        stderr: stderr.substring(0, 500),
        cwd,
        operation: "git-command",
      },
      [
        `Check the git command syntax: ${command}`,
        `Ensure you have the necessary permissions`,
        `Verify the repository state is clean`,
        `Check Git configuration and credentials`,
      ],
    );
  },

  /**
   * Invalid Git reference
   */
  invalidReference(ref: string, repoPath: string): GitError {
    return new GitError(
      `Invalid Git reference: ${ref}`,
      { ref, repoPath, operation: "git-ref-validation" },
      [
        `Use a valid Git reference (branch, tag, or commit hash)`,
        `Check available branches with: git branch -a`,
        `Check available tags with: git tag -l`,
        `Ensure the reference exists in the repository`,
      ],
    );
  },

  /**
   * Git repository not found
   */
  repositoryNotFound(path: string): GitError {
    return new GitError(
      `Git repository not found at: ${path}`,
      { path, operation: "git-repo-access" },
      [
        `Verify the path points to a Git repository`,
        `Check if the repository was moved or deleted`,
        `Clone the repository if it's remote`,
        `Initialize a new repository if needed`,
      ],
    );
  },

  /**
   * Git operation permission denied
   */
  permissionDenied(operation: string, path: string): GitError {
    return new GitError(
      `Permission denied for Git operation: ${operation} at ${path}`,
      { operation, path },
      [
        `Check file and directory permissions`,
        `Ensure you have write access to the repository`,
        `Run with appropriate user privileges`,
        `Check Git configuration for user access`,
      ],
    );
  },
};

/**
 * Factory functions for Glob pattern errors
 */
export const GlobErrors = {
  /**
   * Invalid glob pattern syntax
   */
  invalidPattern(pattern: string, reason: string): GlobError {
    return new GlobError(
      `Invalid glob pattern: ${pattern} - ${reason}`,
      { pattern, reason, operation: "glob-pattern-validation" },
      [
        `Check glob pattern syntax: ${pattern}`,
        `Use valid glob characters: *, ?, [], {}, **`,
        `Escape special characters if they're meant literally`,
        `Refer to glob pattern documentation for examples`,
      ],
    );
  },

  /**
   * Glob pattern compilation failed
   */
  compilationFailed(pattern: string, error: string): GlobError {
    return new GlobError(
      `Glob pattern compilation failed: ${pattern}`,
      { pattern, error, operation: "glob-compilation" },
      [
        `Simplify the glob pattern if it's too complex`,
        `Check for unmatched brackets or braces`,
        `Verify brace expansion syntax: {a,b,c}`,
        `Test pattern with a simpler version first`,
      ],
    );
  },

  /**
   * Glob expansion timeout
   */
  expansionTimeout(patterns: string[], timeoutMs: number): GlobError {
    return new GlobError(
      `Glob expansion timeout: patterns took longer than ${timeoutMs}ms`,
      { patterns, timeoutMs, operation: "glob-expansion" },
      [
        `Reduce the number of patterns to process`,
        `Use more specific patterns to limit file scope`,
        `Increase the timeout if processing large directories`,
        `Consider using exclude patterns to filter results`,
      ],
    );
  },

  /**
   * Too many files matched
   */
  tooManyMatches(
    patterns: string[],
    matchCount: number,
    maxFiles: number,
  ): GlobError {
    return new GlobError(
      `Glob pattern matched too many files: ${matchCount} (limit: ${maxFiles})`,
      { patterns, matchCount, maxFiles, operation: "glob-expansion" },
      [
        `Use more specific glob patterns to reduce matches`,
        `Add exclude patterns to filter out unwanted files`,
        `Increase the file limit if processing is intentional`,
        `Process files in smaller batches`,
      ],
    );
  },

  /**
   * Glob expansion failed
   */
  expansionFailed(patterns: string[], error: string): GlobError {
    return new GlobError(
      `Glob pattern expansion failed: ${error}`,
      { patterns, error, operation: "glob-expansion" },
      [
        `Check if the base directory exists and is accessible`,
        `Verify file system permissions`,
        `Ensure patterns are valid before expansion`,
        `Try with simpler patterns to isolate the issue`,
      ],
    );
  },
};

/**
 * Factory functions for Path errors
 */
export const PathErrors = {
  /**
   * Invalid path format
   */
  invalidFormat(path: string, reason: string): PathError {
    return new PathError(
      `Invalid path format: ${path} - ${reason}`,
      { path, reason, operation: "path-validation" },
      [
        `Use valid path separators for your platform`,
        `Check for invalid characters in the path`,
        `Ensure path length doesn't exceed system limits`,
        `Use absolute or properly relative paths`,
      ],
    );
  },

  /**
   * Path resolution failed
   */
  resolutionFailed(path: string, basePath: string, error: string): PathError {
    return new PathError(
      `Path resolution failed: ${path} (base: ${basePath})`,
      { path, basePath, error, operation: "path-resolution" },
      [
        `Check if the path exists: ${path}`,
        `Verify the base path is correct: ${basePath}`,
        `Use absolute paths to avoid resolution issues`,
        `Check file system permissions`,
      ],
    );
  },

  /**
   * Cross-platform path conversion failed
   */
  conversionFailed(
    path: string,
    targetPlatform: string,
    error: string,
  ): PathError {
    return new PathError(
      `Cross-platform path conversion failed: ${path} to ${targetPlatform}`,
      { path, targetPlatform, error, operation: "path-conversion" },
      [
        `Use path.resolve() or path.normalize() for cross-platform paths`,
        `Check for platform-specific path characters`,
        `Ensure path separators are handled correctly`,
        `Test on the target platform if possible`,
      ],
    );
  },

  /**
   * Path too long for system
   */
  pathTooLong(path: string, maxLength: number): PathError {
    return new PathError(
      `Path too long: ${path.length} characters (limit: ${maxLength})`,
      {
        path: path.substring(0, 100) + "...",
        pathLength: path.length,
        maxLength,
        operation: "path-validation",
      },
      [
        `Use shorter file and directory names`,
        `Move files closer to the root directory`,
        `Use symbolic links to shorten paths`,
        `Consider using a different file organization structure`,
      ],
    );
  },
};
