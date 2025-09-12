"use strict";
/**
 * Error handling module index
 * Exports all error-related functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutErrors = exports.NetworkErrors = exports.DatabaseErrors = exports.ParseErrors = exports.ValidationErrors = exports.FileSystemErrors = exports.ConfigurationErrors = exports.ErrorFormatter = exports.TimeoutError = exports.PermissionError = exports.NetworkError = exports.DatabaseError = exports.ParseError = exports.ValidationError = exports.FileSystemError = exports.ConfigurationError = exports.AstError = void 0;
var types_js_1 = require("./types.js");
Object.defineProperty(exports, "AstError", { enumerable: true, get: function () { return types_js_1.AstError; } });
Object.defineProperty(exports, "ConfigurationError", { enumerable: true, get: function () { return types_js_1.ConfigurationError; } });
Object.defineProperty(exports, "FileSystemError", { enumerable: true, get: function () { return types_js_1.FileSystemError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return types_js_1.ValidationError; } });
Object.defineProperty(exports, "ParseError", { enumerable: true, get: function () { return types_js_1.ParseError; } });
Object.defineProperty(exports, "DatabaseError", { enumerable: true, get: function () { return types_js_1.DatabaseError; } });
Object.defineProperty(exports, "NetworkError", { enumerable: true, get: function () { return types_js_1.NetworkError; } });
Object.defineProperty(exports, "PermissionError", { enumerable: true, get: function () { return types_js_1.PermissionError; } });
Object.defineProperty(exports, "TimeoutError", { enumerable: true, get: function () { return types_js_1.TimeoutError; } });
var formatter_js_1 = require("./formatter.js");
Object.defineProperty(exports, "ErrorFormatter", { enumerable: true, get: function () { return formatter_js_1.ErrorFormatter; } });
var factories_js_1 = require("./factories.js");
Object.defineProperty(exports, "ConfigurationErrors", { enumerable: true, get: function () { return factories_js_1.ConfigurationErrors; } });
Object.defineProperty(exports, "FileSystemErrors", { enumerable: true, get: function () { return factories_js_1.FileSystemErrors; } });
Object.defineProperty(exports, "ValidationErrors", { enumerable: true, get: function () { return factories_js_1.ValidationErrors; } });
Object.defineProperty(exports, "ParseErrors", { enumerable: true, get: function () { return factories_js_1.ParseErrors; } });
Object.defineProperty(exports, "DatabaseErrors", { enumerable: true, get: function () { return factories_js_1.DatabaseErrors; } });
Object.defineProperty(exports, "NetworkErrors", { enumerable: true, get: function () { return factories_js_1.NetworkErrors; } });
Object.defineProperty(exports, "TimeoutErrors", { enumerable: true, get: function () { return factories_js_1.TimeoutErrors; } });
