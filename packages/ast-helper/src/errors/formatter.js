"use strict";
/**
 * Error formatting utilities
 * Provides user-friendly and developer-friendly error formatting
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorFormatter = void 0;
/**
 * Error formatter for different output formats
 */
var ErrorFormatter = /** @class */ (function () {
    function ErrorFormatter() {
        this.defaultOptions = {
            includeContext: true,
            includeSuggestions: true,
            includeStack: false,
            includeCause: true,
            maxContextDepth: 3
        };
    }
    /**
     * Format error for end users (clean, actionable)
     */
    ErrorFormatter.prototype.formatForUser = function (error, options) {
        if (options === void 0) { options = {}; }
        var opts = __assign(__assign({}, this.defaultOptions), options);
        var parts = [];
        // Main error message
        parts.push("\u274C Error: ".concat(error.message));
        // Add error code if it's an AstError
        if (this.isAstError(error)) {
            parts.push("   Code: ".concat(error.code));
            // Add context if available and requested
            if (opts.includeContext && Object.keys(error.context).length > 0) {
                parts.push('');
                parts.push('📍 Context:');
                for (var _i = 0, _a = Object.entries(error.context); _i < _a.length; _i++) {
                    var _b = _a[_i], key = _b[0], value = _b[1];
                    var formattedValue = this.formatContextValue(value, opts.maxContextDepth);
                    parts.push("   ".concat(key, ": ").concat(formattedValue));
                }
            }
            // Add suggestions if available
            if (opts.includeSuggestions && error.suggestions.length > 0) {
                parts.push('');
                parts.push('💡 Suggestions:');
                for (var _c = 0, _d = error.suggestions; _c < _d.length; _c++) {
                    var suggestion = _d[_c];
                    parts.push("   \u2022 ".concat(suggestion));
                }
            }
            // Add cause information if requested
            if (opts.includeCause && 'errorCause' in error && error.errorCause) {
                parts.push('');
                parts.push("\uD83D\uDD17 Caused by: ".concat(error.errorCause.message));
            }
        }
        return parts.join('\n');
    };
    /**
     * Format error for developers (detailed, with debugging info)
     */
    ErrorFormatter.prototype.formatForDebug = function (error, options) {
        if (options === void 0) { options = {}; }
        var opts = __assign(__assign(__assign({}, this.defaultOptions), { includeStack: true, includeCause: true }), options);
        var parts = [];
        // Error header
        parts.push("[".concat(new Date().toISOString(), "] ").concat(error.name, ": ").concat(error.message));
        // Add error code and full context for AstError
        if (this.isAstError(error)) {
            parts.push("Code: ".concat(error.code));
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
                error.suggestions.forEach(function (suggestion, index) {
                    parts.push("  ".concat(index + 1, ". ").concat(suggestion));
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
        if (opts.includeCause && error && typeof error === 'object' && 'errorCause' in error && error.errorCause instanceof Error) {
            parts.push('');
            parts.push('--- Caused by ---');
            parts.push(this.formatForDebug(error.errorCause, opts));
        }
        return parts.join('\n');
    };
    /**
     * Format error for logging (structured JSON)
     */
    ErrorFormatter.prototype.formatForLogging = function (error) {
        var logEntry = {
            timestamp: new Date().toISOString(),
            level: 'error',
            name: error.name,
            message: error.message
        };
        if (this.isAstError(error)) {
            logEntry.code = error.code;
            logEntry.context = error.context;
            logEntry.suggestions = error.suggestions;
            if ('errorCause' in error && error.errorCause) {
                logEntry.cause = {
                    name: error.errorCause.name,
                    message: error.errorCause.message
                };
            }
        }
        if (error.stack) {
            logEntry.stack = error.stack.split('\n');
        }
        return logEntry;
    };
    /**
     * Create a brief error summary (single line)
     */
    ErrorFormatter.prototype.createSummary = function (error) {
        if (this.isAstError(error)) {
            return "".concat(error.code, ": ").concat(error.message);
        }
        return "".concat(error.name, ": ").concat(error.message);
    };
    /**
     * Type guard to check if error is an AstError
     */
    ErrorFormatter.prototype.isAstError = function (error) {
        return error instanceof Error &&
            'code' in error &&
            'context' in error &&
            'suggestions' in error;
    };
    /**
     * Format context values for display
     */
    ErrorFormatter.prototype.formatContextValue = function (value, maxDepth, currentDepth) {
        if (currentDepth === void 0) { currentDepth = 0; }
        if (currentDepth >= maxDepth) {
            return '[object]';
        }
        if (value === null)
            return 'null';
        if (value === undefined)
            return 'undefined';
        if (typeof value === 'string')
            return "\"".concat(value, "\"");
        if (typeof value === 'number' || typeof value === 'boolean')
            return String(value);
        if (Array.isArray(value)) {
            if (value.length === 0)
                return '[]';
            if (value.length === 1) {
                return "[".concat(this.formatContextValue(value[0], maxDepth, currentDepth + 1), "]");
            }
            return "[".concat(value.length, " items]");
        }
        if (typeof value === 'object') {
            var keys = Object.keys(value);
            if (keys.length === 0)
                return '{}';
            if (keys.length === 1) {
                var key = keys[0];
                if (key !== undefined) {
                    var val = this.formatContextValue(value[key], maxDepth, currentDepth + 1);
                    return "{".concat(key, ": ").concat(val, "}");
                }
            }
            return "{".concat(keys.length, " properties}");
        }
        return String(value);
    };
    return ErrorFormatter;
}());
exports.ErrorFormatter = ErrorFormatter;
