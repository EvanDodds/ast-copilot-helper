"use strict";
/**
 * Logging utility functions
 * Helper functions for log level parsing, logger configuration, and setup
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_LEVEL_NAMES = void 0;
exports.parseLogLevel = parseLogLevel;
exports.getLogLevelFromEnv = getLogLevelFromEnv;
exports.createLogger = createLogger;
exports.setupGlobalErrorHandling = setupGlobalErrorHandling;
exports.withPerformance = withPerformance;
exports.createModuleLogger = createModuleLogger;
exports.isLogLevelEnabled = isLogLevelEnabled;
var types_js_1 = require("./types.js");
var logger_js_1 = require("./logger.js");
var console_output_js_1 = require("./console-output.js");
var json_output_js_1 = require("./json-output.js");
/**
 * Parse log level from string
 */
function parseLogLevel(level) {
    var normalized = level.toUpperCase().trim();
    switch (normalized) {
        case 'ERROR': return types_js_1.LogLevel.ERROR;
        case 'WARN':
        case 'WARNING': return types_js_1.LogLevel.WARN;
        case 'INFO': return types_js_1.LogLevel.INFO;
        case 'DEBUG': return types_js_1.LogLevel.DEBUG;
        case 'TRACE': return types_js_1.LogLevel.TRACE;
        default:
            throw new Error("Invalid log level: ".concat(level, ". Valid levels are: ERROR, WARN, INFO, DEBUG, TRACE"));
    }
}
/**
 * Get log level from environment variable
 */
function getLogLevelFromEnv() {
    var envLevel = process.env.AST_COPILOT_LOG_LEVEL
        || process.env.LOG_LEVEL
        || 'INFO';
    try {
        return parseLogLevel(envLevel);
    }
    catch (_a) {
        console.warn("Invalid log level in environment: ".concat(envLevel, ", using INFO"));
        return types_js_1.LogLevel.INFO;
    }
}
/**
 * Create logger from configuration
 */
function createLogger(options) {
    var _a, _b, _c, _d, _e;
    if (options === void 0) { options = {}; }
    var outputs = [];
    // Add console output (default)
    if (!options.jsonOutput) {
        outputs.push(new console_output_js_1.ConsoleOutput({
            useColors: process.stdout.isTTY,
            includeTimestamp: (_a = options.includeTimestamp) !== null && _a !== void 0 ? _a : true
        }));
    }
    // Add JSON output
    if (options.jsonOutput) {
        outputs.push(new json_output_js_1.JsonOutput({
            filePath: options.logFile,
            pretty: false,
            maxBufferSize: 50,
            autoFlushMs: 5000
        }));
    }
    else if (options.logFile) {
        // Add file logging in addition to console
        outputs.push(new json_output_js_1.JsonOutput({
            filePath: options.logFile,
            pretty: true,
            maxBufferSize: 50,
            autoFlushMs: 5000
        }));
    }
    return new logger_js_1.AstLogger({
        level: (_b = options.level) !== null && _b !== void 0 ? _b : getLogLevelFromEnv(),
        includeTimestamp: (_c = options.includeTimestamp) !== null && _c !== void 0 ? _c : true,
        includeContext: (_d = options.includeContext) !== null && _d !== void 0 ? _d : true,
        maxContextDepth: (_e = options.maxContextDepth) !== null && _e !== void 0 ? _e : 3,
        operation: options.operation,
        outputs: outputs,
        performanceThresholdMs: 1000
    });
}
/**
 * Setup global error handling with logger
 */
function setupGlobalErrorHandling(logger) {
    var _this = this;
    process.on('uncaughtException', function (error) {
        logger.error('Uncaught exception', {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
        // Flush logs before exit
        logger.flush().finally(function () {
            process.exit(1);
        });
    });
    process.on('unhandledRejection', function (reason, promise) {
        logger.error('Unhandled promise rejection', {
            reason: reason instanceof Error ? {
                name: reason.name,
                message: reason.message,
                stack: reason.stack
            } : String(reason),
            promise: String(promise)
        });
    });
    // Graceful shutdown
    var shutdown = function (signal) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger.info("Received ".concat(signal, ", shutting down gracefully..."));
                    return [4 /*yield*/, logger.flush()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, logger.close()];
                case 2:
                    _a.sent();
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    }); };
    process.on('SIGINT', function () { return shutdown('SIGINT'); });
    process.on('SIGTERM', function () { return shutdown('SIGTERM'); });
}
/**
 * Create a performance timing wrapper
 */
function withPerformance(logger, operation, fn) {
    return (function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var metrics = logger.startPerformance(operation, {
            args: args.length > 0 ? "".concat(args.length, " arguments") : 'no arguments'
        });
        try {
            var result = fn.apply(void 0, args);
            // Handle promises
            if (result && typeof result.then === 'function') {
                return result
                    .then(function (value) {
                    logger.endPerformance(metrics, true);
                    return value;
                })
                    .catch(function (error) {
                    logger.endPerformance(metrics, false, error);
                    throw error;
                });
            }
            else {
                // Synchronous function
                logger.endPerformance(metrics, true);
                return result;
            }
        }
        catch (error) {
            logger.endPerformance(metrics, false, error);
            throw error;
        }
    });
}
/**
 * Create a logger for a specific module/operation
 */
function createModuleLogger(moduleName, parentLogger) {
    if (parentLogger) {
        return parentLogger.child({ module: moduleName });
    }
    else {
        return createLogger({ operation: moduleName });
    }
}
/**
 * Log level names for display
 */
exports.LOG_LEVEL_NAMES = (_a = {},
    _a[types_js_1.LogLevel.ERROR] = 'ERROR',
    _a[types_js_1.LogLevel.WARN] = 'WARN',
    _a[types_js_1.LogLevel.INFO] = 'INFO',
    _a[types_js_1.LogLevel.DEBUG] = 'DEBUG',
    _a[types_js_1.LogLevel.TRACE] = 'TRACE',
    _a);
/**
 * Check if log level is enabled
 */
function isLogLevelEnabled(currentLevel, targetLevel) {
    return targetLevel <= currentLevel;
}
