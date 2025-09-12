"use strict";
/**
 * Main logger implementation
 * Provides configurable logging with multiple outputs and performance tracking
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstLogger = void 0;
var types_js_1 = require("./types.js");
var console_output_js_1 = require("./console-output.js");
var AstLogger = /** @class */ (function () {
    function AstLogger(options) {
        if (options === void 0) { options = { level: types_js_1.LogLevel.INFO }; }
        var _a, _b, _c, _d, _e, _f;
        this.level = options.level;
        this.includeTimestamp = (_a = options.includeTimestamp) !== null && _a !== void 0 ? _a : true;
        this.includeContext = (_b = options.includeContext) !== null && _b !== void 0 ? _b : true;
        this.maxContextDepth = (_c = options.maxContextDepth) !== null && _c !== void 0 ? _c : 3;
        this.operation = options.operation;
        this.childContext = (_d = options.childContext) !== null && _d !== void 0 ? _d : {};
        this.performanceThresholdMs = (_e = options.performanceThresholdMs) !== null && _e !== void 0 ? _e : 1000;
        // Set up outputs
        this.outputs = (_f = options.outputs) !== null && _f !== void 0 ? _f : [new console_output_js_1.ConsoleOutput()];
    }
    AstLogger.prototype.error = function (message, context) {
        this.log(types_js_1.LogLevel.ERROR, message, context);
    };
    AstLogger.prototype.warn = function (message, context) {
        this.log(types_js_1.LogLevel.WARN, message, context);
    };
    AstLogger.prototype.info = function (message, context) {
        this.log(types_js_1.LogLevel.INFO, message, context);
    };
    AstLogger.prototype.debug = function (message, context) {
        this.log(types_js_1.LogLevel.DEBUG, message, context);
    };
    AstLogger.prototype.trace = function (message, context) {
        this.log(types_js_1.LogLevel.TRACE, message, context);
    };
    AstLogger.prototype.startPerformance = function (operation, context) {
        return {
            operation: operation,
            startTime: performance.now(),
            success: false,
            context: __assign(__assign({}, this.childContext), context)
        };
    };
    AstLogger.prototype.endPerformance = function (metrics, success, error) {
        if (success === void 0) { success = true; }
        metrics.endTime = performance.now();
        metrics.duration = metrics.endTime - metrics.startTime;
        metrics.success = success;
        metrics.error = error;
        // Log performance metrics if above threshold
        if (metrics.duration >= this.performanceThresholdMs) {
            var level = success ? types_js_1.LogLevel.INFO : types_js_1.LogLevel.WARN;
            var status_1 = success ? 'completed' : 'failed';
            var message = "Operation ".concat(metrics.operation, " ").concat(status_1);
            var context = __assign(__assign({}, metrics.context), { duration: Math.round(metrics.duration), success: metrics.success });
            if (error) {
                context.error = __assign({ name: error.name, message: error.message }, (error instanceof Error && 'code' in error ? { code: error.code } : {}));
            }
            this.log(level, message, context, metrics.duration, error);
        }
    };
    AstLogger.prototype.child = function (context) {
        return new AstLogger({
            level: this.level,
            includeTimestamp: this.includeTimestamp,
            includeContext: this.includeContext,
            maxContextDepth: this.maxContextDepth,
            operation: this.operation,
            outputs: this.outputs,
            childContext: __assign(__assign({}, this.childContext), context),
            performanceThresholdMs: this.performanceThresholdMs
        });
    };
    AstLogger.prototype.flush = function () {
        return __awaiter(this, void 0, void 0, function () {
            var flushPromises;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        flushPromises = this.outputs.map(function (output) {
                            return output.flush ? output.flush() : Promise.resolve();
                        });
                        return [4 /*yield*/, Promise.all(flushPromises)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AstLogger.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            var closePromises;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        closePromises = this.outputs.map(function (output) {
                            return output.close ? output.close() : Promise.resolve();
                        });
                        return [4 /*yield*/, Promise.all(closePromises)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AstLogger.prototype.log = function (level, message, context, duration, error) {
        // Check if level should be logged
        if (level > this.level) {
            return;
        }
        // Combine contexts
        var combinedContext = this.includeContext ? __assign(__assign({}, this.childContext), context) : undefined;
        // Create log entry
        var entry = __assign(__assign(__assign(__assign({ timestamp: new Date().toISOString(), level: level, levelName: this.getLevelName(level), message: message }, (combinedContext && Object.keys(combinedContext).length > 0 ? {
            context: this.sanitizeContext(combinedContext)
        } : {})), (this.operation ? { operation: this.operation } : {})), (duration !== undefined ? { duration: duration } : {})), (error ? {
            error: __assign({ name: error.name, message: error.message, stack: error.stack }, (error instanceof Error && 'code' in error ? {
                code: error.code
            } : {}))
        } : {}));
        // Write to all outputs
        for (var _i = 0, _a = this.outputs; _i < _a.length; _i++) {
            var output = _a[_i];
            try {
                output.write(entry);
            }
            catch (outputError) {
                console.error('Failed to write to log output:', outputError);
            }
        }
    };
    AstLogger.prototype.getLevelName = function (level) {
        switch (level) {
            case types_js_1.LogLevel.ERROR: return 'ERROR';
            case types_js_1.LogLevel.WARN: return 'WARN';
            case types_js_1.LogLevel.INFO: return 'INFO';
            case types_js_1.LogLevel.DEBUG: return 'DEBUG';
            case types_js_1.LogLevel.TRACE: return 'TRACE';
            default: return 'UNKNOWN';
        }
    };
    AstLogger.prototype.sanitizeContext = function (context, depth) {
        var _this = this;
        if (depth === void 0) { depth = 0; }
        if (depth >= this.maxContextDepth) {
            return { '[max depth]': true };
        }
        var sanitized = {};
        for (var _i = 0, _a = Object.entries(context); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            if (value === null || value === undefined) {
                sanitized[key] = value;
            }
            else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                sanitized[key] = value;
            }
            else if (value instanceof Date) {
                sanitized[key] = value.toISOString();
            }
            else if (value instanceof Error) {
                sanitized[key] = __assign({ name: value.name, message: value.message }, (value.stack ? { stack: value.stack.split('\n').slice(0, 5) } : {}));
            }
            else if (Array.isArray(value)) {
                if (value.length <= 10) {
                    sanitized[key] = value.map(function (item) {
                        return typeof item === 'object' && item !== null ?
                            _this.sanitizeContext({ item: item }, depth + 1).item :
                            item;
                    });
                }
                else {
                    sanitized[key] = "[Array of ".concat(value.length, " items]");
                }
            }
            else if (typeof value === 'object') {
                var keys = Object.keys(value);
                if (keys.length <= 20) {
                    sanitized[key] = this.sanitizeContext(value, depth + 1);
                }
                else {
                    sanitized[key] = "[Object with ".concat(keys.length, " properties]");
                }
            }
            else {
                sanitized[key] = String(value);
            }
        }
        return sanitized;
    };
    return AstLogger;
}());
exports.AstLogger = AstLogger;
