"use strict";
/**
 * Error factory functions for common error scenarios
 * Provides pre-configured error instances with helpful messages and suggestions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutErrors = exports.NetworkErrors = exports.DatabaseErrors = exports.ParseErrors = exports.ValidationErrors = exports.FileSystemErrors = exports.ConfigurationErrors = void 0;
var types_js_1 = require("./types.js");
/**
 * Factory functions for configuration errors
 */
exports.ConfigurationErrors = {
    /**
     * Invalid configuration value
     */
    invalidValue: function (key, value, expectedType) {
        return new types_js_1.ConfigurationError("Invalid configuration value for '".concat(key, "': expected ").concat(expectedType, ", got ").concat(typeof value), { key: key, value: value, expectedType: expectedType }, [
            "Check your configuration files or environment variables",
            "Ensure '".concat(key, "' is set to a valid ").concat(expectedType),
            "Refer to the documentation for valid configuration options"
        ]);
    },
    /**
     * Missing required configuration
     */
    missingRequired: function (key, source) {
        var sourceMsg = source ? " in ".concat(source) : '';
        return new types_js_1.ConfigurationError("Missing required configuration: '".concat(key, "'").concat(sourceMsg), { key: key, source: source }, [
            "Set '".concat(key, "' in your configuration file or as an environment variable"),
            source ? "Check your ".concat(source, " configuration") : 'Check your configuration sources',
            "Run with --help to see configuration options"
        ]);
    },
    /**
     * Configuration file not found or inaccessible
     */
    fileNotAccessible: function (filePath, reason) {
        return new types_js_1.ConfigurationError("Configuration file not accessible: ".concat(filePath), { filePath: filePath, reason: reason }, [
            "Ensure the configuration file exists at: ".concat(filePath),
            "Check file permissions and ownership",
            "Verify the file is readable by the current user",
            "Create a default configuration file if it doesn't exist"
        ]);
    },
    /**
     * Failed to load configuration
     */
    loadFailed: function (message, cause) {
        return new types_js_1.ConfigurationError(message, { cause: cause === null || cause === void 0 ? void 0 : cause.message }, [
            "Check your configuration files for syntax errors",
            "Verify all configuration sources are accessible",
            "Check environment variables and CLI arguments",
            "Use --debug to see detailed error information"
        ]);
    }
};
/**
 * Factory functions for file system errors
 */
exports.FileSystemErrors = {
    /**
     * File or directory not found
     */
    notFound: function (path, operation) {
        return new types_js_1.FileSystemError("File or directory not found: ".concat(path), { path: path, operation: operation }, [
            "Verify the path exists: ".concat(path),
            "Check for typos in the file path",
            "Ensure the file wasn't moved or deleted",
            "Run the parse command to create necessary files"
        ]);
    },
    /**
     * Permission denied
     */
    permissionDenied: function (path, operation) {
        return new types_js_1.FileSystemError("Permission denied: cannot ".concat(operation, " ").concat(path), { path: path, operation: operation }, [
            "Check file permissions for: ".concat(path),
            "Ensure the current user has ".concat(operation, " access"),
            "Run with appropriate privileges if needed",
            "Contact your system administrator if needed"
        ]);
    },
    /**
     * Disk space or quota exceeded
     */
    diskSpaceExceeded: function (path, requiredSpace) {
        return new types_js_1.FileSystemError("Insufficient disk space for operation at: ".concat(path), { path: path, requiredSpace: requiredSpace }, [
            "Free up disk space on the target drive",
            "Check available disk space with 'df -h' (Unix) or disk management (Windows)",
            "Consider using a different location with more space",
            requiredSpace ? "At least ".concat(Math.round(requiredSpace / 1024 / 1024), "MB is required") : 'More disk space is required'
        ]);
    }
};
/**
 * Factory functions for validation errors
 */
exports.ValidationErrors = {
    /**
     * Invalid input format
     */
    invalidFormat: function (input, expectedFormat) {
        return new types_js_1.ValidationError("Invalid input format: expected ".concat(expectedFormat), { input: input.substring(0, 100), expectedFormat: expectedFormat }, [
            "Ensure input matches the expected format: ".concat(expectedFormat),
            "Check for syntax errors or formatting issues",
            "Refer to documentation for valid input examples",
            "Use a linter or formatter to validate your input"
        ]);
    },
    /**
     * Value out of range
     */
    outOfRange: function (value, min, max, field) {
        var fieldMsg = field ? " for ".concat(field) : '';
        return new types_js_1.ValidationError("Value out of range".concat(fieldMsg, ": ").concat(value, " (must be between ").concat(min, " and ").concat(max, ")"), { value: value, min: min, max: max, field: field }, [
            "Use a value between ".concat(min, " and ").concat(max),
            field ? "Check the ".concat(field, " configuration") : 'Check the input value',
            "Refer to documentation for valid ranges"
        ]);
    },
    /**
     * Missing required value
     */
    missingValue: function (field, expectedType) {
        return new types_js_1.ValidationError("Missing value for ".concat(field, ": expected ").concat(expectedType), { field: field, expectedType: expectedType }, [
            "Provide a value for ".concat(field),
            "Check your command line arguments or configuration",
            "Use --help to see usage information"
        ]);
    },
    /**
     * Invalid value
     */
    invalidValue: function (field, value, reason) {
        return new types_js_1.ValidationError("Invalid value for ".concat(field, ": ").concat(value, ". ").concat(reason), { field: field, value: value, reason: reason }, [
            "Provide a valid value for ".concat(field),
            reason,
            "Use --help to see usage information"
        ]);
    }
};
/**
 * Factory functions for parse errors
 */
exports.ParseErrors = {
    /**
     * Syntax error in source code
     */
    syntaxError: function (filePath, line, column, details) {
        return new types_js_1.ParseError("Syntax error in ".concat(filePath, ":").concat(line, ":").concat(column, " - ").concat(details), { filePath: filePath, line: line, column: column, details: details }, [
            "Fix the syntax error in ".concat(filePath, " at line ").concat(line, ", column ").concat(column),
            "Check for missing brackets, semicolons, or other syntax issues",
            "Use a code editor with syntax highlighting",
            "Run a linter to identify and fix syntax issues"
        ]);
    },
    /**
     * Unsupported language or file type
     */
    unsupportedLanguage: function (filePath, detectedType) {
        return new types_js_1.ParseError("Unsupported language or file type: ".concat(detectedType, " for ").concat(filePath), { filePath: filePath, detectedType: detectedType }, [
            "Use a supported file type (TypeScript, JavaScript, Python)",
            "Check the file extension and content",
            "Add support for ".concat(detectedType, " if needed"),
            "Update parseGlob configuration to include supported file types"
        ]);
    }
};
/**
 * Factory functions for database errors
 */
exports.DatabaseErrors = {
    /**
     * Database corruption detected
     */
    corruption: function (dbPath, details) {
        return new types_js_1.DatabaseError("Database corruption detected in ".concat(dbPath).concat(details ? ': ' + details : ''), { dbPath: dbPath, details: details }, [
            "Delete the corrupted database: ".concat(dbPath),
            "Re-run the parse command to rebuild the database",
            "Check for disk space issues that might cause corruption",
            "Backup your source code before rebuilding"
        ]);
    },
    /**
     * Database version mismatch
     */
    versionMismatch: function (currentVersion, expectedVersion, dbPath) {
        return new types_js_1.DatabaseError("Database version mismatch: found ".concat(currentVersion, ", expected ").concat(expectedVersion), { currentVersion: currentVersion, expectedVersion: expectedVersion, dbPath: dbPath }, [
            "Delete the old database: ".concat(dbPath),
            "Re-run the parse command to create a new database",
            "Upgrade to the latest version of ast-copilot-helper",
            "Backup your configuration before upgrading"
        ]);
    }
};
/**
 * Factory functions for network errors
 */
exports.NetworkErrors = {
    /**
     * Connection timeout
     */
    timeout: function (url, timeoutMs) {
        return new types_js_1.NetworkError("Network timeout connecting to ".concat(url, " after ").concat(timeoutMs, "ms"), { url: url, timeoutMs: timeoutMs }, [
            "Check your internet connection",
            "Verify the URL is correct: ".concat(url),
            "Try increasing the timeout value",
            "Check if the service is temporarily unavailable"
        ]);
    },
    /**
     * Service unavailable
     */
    serviceUnavailable: function (serviceName, statusCode) {
        return new types_js_1.NetworkError("Service unavailable: ".concat(serviceName).concat(statusCode ? " (HTTP ".concat(statusCode, ")") : ''), { serviceName: serviceName, statusCode: statusCode }, [
            "Check if ".concat(serviceName, " is currently available"),
            "Try again later as the service might be temporarily down",
            "Verify your API credentials if required",
            "Check service status page or documentation"
        ]);
    }
};
/**
 * Factory functions for timeout errors
 */
exports.TimeoutErrors = {
    /**
     * Operation timeout
     */
    operationTimeout: function (operation, timeoutMs) {
        return new types_js_1.TimeoutError("Operation timeout: ".concat(operation, " exceeded ").concat(timeoutMs, "ms"), { operation: operation, timeoutMs: timeoutMs }, [
            "Increase the timeout value for ".concat(operation),
            "Check if the operation is stuck or inefficient",
            "Reduce the scope of the operation if possible",
            "Check system resources (CPU, memory, disk I/O)"
        ]);
    }
};
