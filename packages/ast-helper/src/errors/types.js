"use strict";
/**
 * Base error classes and types for AST Copilot Helper
 * Provides structured error handling with context and user-friendly messages
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutError = exports.PermissionError = exports.NetworkError = exports.DatabaseError = exports.ParseError = exports.ValidationError = exports.FileSystemError = exports.ConfigurationError = exports.AstError = void 0;
/**
 * Base error class for all AST Copilot Helper errors
 * Provides structured error information for both users and developers
 */
var AstError = /** @class */ (function (_super) {
    __extends(AstError, _super);
    function AstError(message, code, context, suggestions, cause) {
        if (context === void 0) { context = {}; }
        if (suggestions === void 0) { suggestions = []; }
        var _this = _super.call(this, message) || this;
        /** Marker property to identify AST errors */
        _this.isAstError = true;
        _this.name = _this.constructor.name;
        _this.code = code;
        _this.context = context;
        _this.suggestions = suggestions;
        _this.errorCause = cause;
        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(_this, _this.constructor);
        }
        return _this;
    }
    /**
     * Convert error to JSON for logging/reporting
     */
    AstError.prototype.toJSON = function () {
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
    };
    return AstError;
}(Error));
exports.AstError = AstError;
/**
 * Configuration-related errors
 */
var ConfigurationError = /** @class */ (function (_super) {
    __extends(ConfigurationError, _super);
    function ConfigurationError(message, context, suggestions, cause) {
        if (context === void 0) { context = {}; }
        if (suggestions === void 0) { suggestions = []; }
        return _super.call(this, message, 'CONFIGURATION_ERROR', context, suggestions, cause) || this;
    }
    return ConfigurationError;
}(AstError));
exports.ConfigurationError = ConfigurationError;
/**
 * File system operation errors
 */
var FileSystemError = /** @class */ (function (_super) {
    __extends(FileSystemError, _super);
    function FileSystemError(message, context, suggestions, cause) {
        if (context === void 0) { context = {}; }
        if (suggestions === void 0) { suggestions = []; }
        return _super.call(this, message, 'FILESYSTEM_ERROR', context, suggestions, cause) || this;
    }
    return FileSystemError;
}(AstError));
exports.FileSystemError = FileSystemError;
/**
 * Validation errors for input data
 */
var ValidationError = /** @class */ (function (_super) {
    __extends(ValidationError, _super);
    function ValidationError(message, context, suggestions, cause) {
        if (context === void 0) { context = {}; }
        if (suggestions === void 0) { suggestions = []; }
        return _super.call(this, message, 'VALIDATION_ERROR', context, suggestions, cause) || this;
    }
    return ValidationError;
}(AstError));
exports.ValidationError = ValidationError;
/**
 * Parsing and AST processing errors
 */
var ParseError = /** @class */ (function (_super) {
    __extends(ParseError, _super);
    function ParseError(message, context, suggestions, cause) {
        if (context === void 0) { context = {}; }
        if (suggestions === void 0) { suggestions = []; }
        return _super.call(this, message, 'PARSE_ERROR', context, suggestions, cause) || this;
    }
    return ParseError;
}(AstError));
exports.ParseError = ParseError;
/**
 * Database and indexing errors
 */
var DatabaseError = /** @class */ (function (_super) {
    __extends(DatabaseError, _super);
    function DatabaseError(message, context, suggestions, cause) {
        if (context === void 0) { context = {}; }
        if (suggestions === void 0) { suggestions = []; }
        return _super.call(this, message, 'DATABASE_ERROR', context, suggestions, cause) || this;
    }
    return DatabaseError;
}(AstError));
exports.DatabaseError = DatabaseError;
/**
 * Network and external service errors
 */
var NetworkError = /** @class */ (function (_super) {
    __extends(NetworkError, _super);
    function NetworkError(message, context, suggestions, cause) {
        if (context === void 0) { context = {}; }
        if (suggestions === void 0) { suggestions = []; }
        return _super.call(this, message, 'NETWORK_ERROR', context, suggestions, cause) || this;
    }
    return NetworkError;
}(AstError));
exports.NetworkError = NetworkError;
/**
 * Permission and access errors
 */
var PermissionError = /** @class */ (function (_super) {
    __extends(PermissionError, _super);
    function PermissionError(message, context, suggestions, cause) {
        if (context === void 0) { context = {}; }
        if (suggestions === void 0) { suggestions = []; }
        return _super.call(this, message, 'PERMISSION_ERROR', context, suggestions, cause) || this;
    }
    return PermissionError;
}(AstError));
exports.PermissionError = PermissionError;
/**
 * Operation timeout errors
 */
var TimeoutError = /** @class */ (function (_super) {
    __extends(TimeoutError, _super);
    function TimeoutError(message, context, suggestions, cause) {
        if (context === void 0) { context = {}; }
        if (suggestions === void 0) { suggestions = []; }
        return _super.call(this, message, 'TIMEOUT_ERROR', context, suggestions, cause) || this;
    }
    return TimeoutError;
}(AstError));
exports.TimeoutError = TimeoutError;
