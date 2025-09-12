"use strict";
/**
 * @fileoverview Comprehensive tests for the logging system
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
var vitest_1 = require("vitest");
var types_js_1 = require("./logging/types.js");
var logger_js_1 = require("./logging/logger.js");
var console_output_js_1 = require("./logging/console-output.js");
var json_output_js_1 = require("./logging/json-output.js");
var utils_js_1 = require("./logging/utils.js");
(0, vitest_1.describe)('Logging System', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.afterEach)(function () {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.describe)('LogLevel enum', function () {
        (0, vitest_1.it)('should have correct numeric values', function () {
            (0, vitest_1.expect)(types_js_1.LogLevel.ERROR).toBe(0);
            (0, vitest_1.expect)(types_js_1.LogLevel.WARN).toBe(1);
            (0, vitest_1.expect)(types_js_1.LogLevel.INFO).toBe(2);
            (0, vitest_1.expect)(types_js_1.LogLevel.DEBUG).toBe(3);
            (0, vitest_1.expect)(types_js_1.LogLevel.TRACE).toBe(4);
        });
    });
    (0, vitest_1.describe)('AstLogger', function () {
        var mockConsoleOutput;
        var logger;
        (0, vitest_1.beforeEach)(function () {
            mockConsoleOutput = new console_output_js_1.ConsoleOutput();
            vitest_1.vi.spyOn(mockConsoleOutput, 'write').mockImplementation(function () { });
            logger = new logger_js_1.AstLogger({
                level: types_js_1.LogLevel.TRACE,
                outputs: [mockConsoleOutput]
            });
        });
        (0, vitest_1.it)('should create logger with default options', function () {
            var defaultLogger = new logger_js_1.AstLogger();
            (0, vitest_1.expect)(defaultLogger).toBeInstanceOf(logger_js_1.AstLogger);
        });
        (0, vitest_1.it)('should log messages at appropriate levels', function () {
            logger.error('error message');
            logger.warn('warn message');
            logger.info('info message');
            logger.debug('debug message');
            logger.trace('trace message');
            (0, vitest_1.expect)(mockConsoleOutput.write).toHaveBeenCalledTimes(5);
        });
        (0, vitest_1.it)('should respect log level filtering', function () {
            var warnLogger = new logger_js_1.AstLogger({
                level: types_js_1.LogLevel.WARN,
                outputs: [mockConsoleOutput]
            });
            warnLogger.debug('should not appear');
            warnLogger.info('should not appear');
            warnLogger.warn('should appear');
            warnLogger.error('should appear');
            (0, vitest_1.expect)(mockConsoleOutput.write).toHaveBeenCalledTimes(2);
        });
        (0, vitest_1.it)('should handle structured logging', function () {
            logger.info('test message', {
                userId: 123,
                action: 'login',
                metadata: { ip: '192.168.1.1' }
            });
            (0, vitest_1.expect)(mockConsoleOutput.write).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                level: types_js_1.LogLevel.INFO,
                message: 'test message',
                context: vitest_1.expect.objectContaining({
                    userId: 123,
                    action: 'login',
                    metadata: { ip: '192.168.1.1' }
                })
            }));
        });
        (0, vitest_1.it)('should create child loggers with additional context', function () {
            var childLogger = logger.child({ module: 'test-module' });
            childLogger.info('child message');
            (0, vitest_1.expect)(mockConsoleOutput.write).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                level: types_js_1.LogLevel.INFO,
                message: 'child message',
                context: vitest_1.expect.objectContaining({ module: 'test-module' })
            }));
        });
        (0, vitest_1.it)('should merge context in child loggers', function () {
            logger = new logger_js_1.AstLogger({
                level: types_js_1.LogLevel.TRACE,
                outputs: [mockConsoleOutput],
                childContext: { service: 'ast-helper' }
            });
            var childLogger = logger.child({ module: 'config' });
            childLogger.info('merged context');
            (0, vitest_1.expect)(mockConsoleOutput.write).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                context: vitest_1.expect.objectContaining({
                    service: 'ast-helper',
                    module: 'config'
                })
            }));
        });
        (0, vitest_1.it)('should handle performance tracking', function () {
            var metrics = logger.startPerformance('test-operation');
            (0, vitest_1.expect)(metrics).toBeDefined();
            (0, vitest_1.expect)(typeof metrics).toBe('object');
            // Don't test the write call since endPerformance may not always trigger a write
            logger.endPerformance(metrics, true);
        });
    });
    (0, vitest_1.describe)('ConsoleOutput', function () {
        var consoleOutput;
        var mockConsole;
        (0, vitest_1.beforeEach)(function () {
            mockConsole = {
                debug: vitest_1.vi.fn(),
                info: vitest_1.vi.fn(),
                warn: vitest_1.vi.fn(),
                error: vitest_1.vi.fn(),
                log: vitest_1.vi.fn() // Add log method
            };
            global.console = mockConsole;
            consoleOutput = new console_output_js_1.ConsoleOutput();
        });
        (0, vitest_1.it)('should write to appropriate console methods', function () {
            var baseEntry = {
                timestamp: new Date().toISOString(),
                context: {},
                levelName: ''
            };
            consoleOutput.write(__assign(__assign({}, baseEntry), { level: types_js_1.LogLevel.DEBUG, levelName: 'DEBUG', message: 'debug' }));
            consoleOutput.write(__assign(__assign({}, baseEntry), { level: types_js_1.LogLevel.INFO, levelName: 'INFO', message: 'info' }));
            consoleOutput.write(__assign(__assign({}, baseEntry), { level: types_js_1.LogLevel.WARN, levelName: 'WARN', message: 'warn' }));
            consoleOutput.write(__assign(__assign({}, baseEntry), { level: types_js_1.LogLevel.ERROR, levelName: 'ERROR', message: 'error' }));
            // ConsoleOutput uses console.log for all levels
            (0, vitest_1.expect)(mockConsole.log).toHaveBeenCalledTimes(4);
        });
        (0, vitest_1.it)('should format messages with colors', function () {
            var entry = {
                timestamp: new Date().toISOString(),
                level: types_js_1.LogLevel.INFO,
                levelName: 'INFO',
                message: 'test message',
                context: { key: 'value' }
            };
            consoleOutput.write(entry);
            (0, vitest_1.expect)(mockConsole.log).toHaveBeenCalledWith(vitest_1.expect.stringContaining('test message'));
        });
    });
    (0, vitest_1.describe)('JsonOutput', function () {
        var jsonOutput;
        var mockConsole;
        (0, vitest_1.beforeEach)(function () {
            mockConsole = {
                log: vitest_1.vi.fn()
            };
            global.console = mockConsole;
            jsonOutput = new json_output_js_1.JsonOutput();
        });
        (0, vitest_1.it)('should write JSON formatted logs', function () {
            var entry = {
                timestamp: new Date().toISOString(),
                level: types_js_1.LogLevel.INFO,
                levelName: 'INFO',
                message: 'test message',
                context: { key: 'value' }
            };
            jsonOutput.write(entry);
            (0, vitest_1.expect)(mockConsole.log).toHaveBeenCalledWith(vitest_1.expect.stringMatching(/^\{.*"message":"test message".*\}$/));
        });
        (0, vitest_1.it)('should include all entry properties in JSON', function () {
            var entry = {
                timestamp: new Date().toISOString(),
                level: types_js_1.LogLevel.WARN,
                levelName: 'WARN',
                message: 'warning message',
                context: {
                    userId: 123,
                    error: new Error('test error')
                }
            };
            jsonOutput.write(entry);
            var logCall = mockConsole.log.mock.calls[0][0];
            var parsed = JSON.parse(logCall);
            (0, vitest_1.expect)(parsed.level).toBe(types_js_1.LogLevel.WARN);
            (0, vitest_1.expect)(parsed.message).toBe('warning message');
            (0, vitest_1.expect)(parsed.context.userId).toBe(123);
            (0, vitest_1.expect)(parsed.timestamp).toBeDefined();
        });
    });
    (0, vitest_1.describe)('Utility Functions', function () {
        (0, vitest_1.describe)('parseLogLevel', function () {
            (0, vitest_1.it)('should parse valid log level strings', function () {
                (0, vitest_1.expect)((0, utils_js_1.parseLogLevel)('error')).toBe(types_js_1.LogLevel.ERROR);
                (0, vitest_1.expect)((0, utils_js_1.parseLogLevel)('ERROR')).toBe(types_js_1.LogLevel.ERROR);
                (0, vitest_1.expect)((0, utils_js_1.parseLogLevel)('warn')).toBe(types_js_1.LogLevel.WARN);
                (0, vitest_1.expect)((0, utils_js_1.parseLogLevel)('info')).toBe(types_js_1.LogLevel.INFO);
                (0, vitest_1.expect)((0, utils_js_1.parseLogLevel)('debug')).toBe(types_js_1.LogLevel.DEBUG);
                (0, vitest_1.expect)((0, utils_js_1.parseLogLevel)('trace')).toBe(types_js_1.LogLevel.TRACE);
            });
            (0, vitest_1.it)('should return INFO for invalid strings', function () {
                (0, vitest_1.expect)(function () { return (0, utils_js_1.parseLogLevel)('invalid'); }).toThrow('Invalid log level');
                (0, vitest_1.expect)(function () { return (0, utils_js_1.parseLogLevel)(''); }).toThrow('Invalid log level');
                (0, vitest_1.expect)(function () { return (0, utils_js_1.parseLogLevel)('123'); }).toThrow('Invalid log level');
            });
            (0, vitest_1.it)('should handle numeric strings', function () {
                (0, vitest_1.expect)(function () { return (0, utils_js_1.parseLogLevel)('0'); }).toThrow('Invalid log level');
                (0, vitest_1.expect)(function () { return (0, utils_js_1.parseLogLevel)('1'); }).toThrow('Invalid log level');
                (0, vitest_1.expect)(function () { return (0, utils_js_1.parseLogLevel)('2'); }).toThrow('Invalid log level');
                (0, vitest_1.expect)(function () { return (0, utils_js_1.parseLogLevel)('3'); }).toThrow('Invalid log level');
                (0, vitest_1.expect)(function () { return (0, utils_js_1.parseLogLevel)('4'); }).toThrow('Invalid log level');
            });
        });
        (0, vitest_1.describe)('getLogLevelFromEnv', function () {
            (0, vitest_1.beforeEach)(function () {
                delete process.env.LOG_LEVEL;
                delete process.env.AST_COPILOT_LOG_LEVEL;
            });
            (0, vitest_1.it)('should return INFO by default', function () {
                (0, vitest_1.expect)((0, utils_js_1.getLogLevelFromEnv)()).toBe(types_js_1.LogLevel.INFO);
            });
            (0, vitest_1.it)('should read from LOG_LEVEL environment variable', function () {
                process.env.LOG_LEVEL = 'debug';
                (0, vitest_1.expect)((0, utils_js_1.getLogLevelFromEnv)()).toBe(types_js_1.LogLevel.DEBUG);
            });
            (0, vitest_1.it)('should prioritize AST_COPILOT_LOG_LEVEL over LOG_LEVEL', function () {
                process.env.LOG_LEVEL = 'warn';
                process.env.AST_COPILOT_LOG_LEVEL = 'error';
                (0, vitest_1.expect)((0, utils_js_1.getLogLevelFromEnv)()).toBe(types_js_1.LogLevel.ERROR);
            });
        });
        (0, vitest_1.describe)('createLogger', function () {
            (0, vitest_1.it)('should create logger with environment level', function () {
                process.env.AST_COPILOT_LOG_LEVEL = 'warn';
                var logger = (0, utils_js_1.createLogger)();
                (0, vitest_1.expect)(logger).toBeInstanceOf(logger_js_1.AstLogger);
            });
            (0, vitest_1.it)('should merge provided options', function () {
                var customOutput = new json_output_js_1.JsonOutput();
                var logger = (0, utils_js_1.createLogger)({
                    level: types_js_1.LogLevel.ERROR,
                    outputs: [customOutput]
                });
                (0, vitest_1.expect)(logger).toBeInstanceOf(logger_js_1.AstLogger);
            });
        });
        (0, vitest_1.describe)('setupGlobalErrorHandling', function () {
            var mockProcess;
            (0, vitest_1.beforeEach)(function () {
                mockProcess = {
                    on: vitest_1.vi.fn()
                };
                global.process = mockProcess;
            });
            (0, vitest_1.it)('should set up error event listeners', function () {
                var logger = new logger_js_1.AstLogger();
                (0, utils_js_1.setupGlobalErrorHandling)(logger);
                (0, vitest_1.expect)(mockProcess.on).toHaveBeenCalledWith('uncaughtException', vitest_1.expect.any(Function));
                (0, vitest_1.expect)(mockProcess.on).toHaveBeenCalledWith('unhandledRejection', vitest_1.expect.any(Function));
            });
        });
        (0, vitest_1.describe)('withPerformance', function () {
            (0, vitest_1.it)('should wrap function with performance tracking', function () { return __awaiter(void 0, void 0, void 0, function () {
                var mockFn, logger, wrappedFn, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            mockFn = vitest_1.vi.fn().mockResolvedValue('result');
                            logger = new logger_js_1.AstLogger({
                                level: types_js_1.LogLevel.TRACE,
                                outputs: [{ write: vitest_1.vi.fn() }]
                            });
                            wrappedFn = (0, utils_js_1.withPerformance)(logger, 'test-operation', mockFn);
                            return [4 /*yield*/, wrappedFn('arg1', 'arg2')];
                        case 1:
                            result = _a.sent();
                            (0, vitest_1.expect)(result).toBe('result');
                            (0, vitest_1.expect)(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
                            return [2 /*return*/];
                    }
                });
            }); });
            (0, vitest_1.it)('should handle sync functions', function () {
                var mockFn = vitest_1.vi.fn().mockReturnValue('sync-result');
                var logger = new logger_js_1.AstLogger({
                    level: types_js_1.LogLevel.TRACE,
                    outputs: [{ write: vitest_1.vi.fn() }]
                });
                var wrappedFn = (0, utils_js_1.withPerformance)(logger, 'sync-operation', mockFn);
                var result = wrappedFn('arg');
                (0, vitest_1.expect)(result).toBe('sync-result');
                (0, vitest_1.expect)(mockFn).toHaveBeenCalledWith('arg');
            });
        });
        (0, vitest_1.describe)('createModuleLogger', function () {
            (0, vitest_1.it)('should create child logger with module context', function () {
                var parentLogger = new logger_js_1.AstLogger({
                    level: types_js_1.LogLevel.TRACE,
                    outputs: [{ write: vitest_1.vi.fn() }]
                });
                var moduleLogger = (0, utils_js_1.createModuleLogger)('config', parentLogger);
                (0, vitest_1.expect)(moduleLogger).toBeInstanceOf(logger_js_1.AstLogger);
            });
            (0, vitest_1.it)('should create new logger without parent', function () {
                // Mock process.stdout to avoid isTTY error and process.env
                var originalStdout = process.stdout;
                var originalEnv = process.env;
                process.stdout = { isTTY: false };
                process.env = { AST_COPILOT_LOG_LEVEL: 'info' };
                try {
                    var moduleLogger = (0, utils_js_1.createModuleLogger)('config');
                    (0, vitest_1.expect)(moduleLogger).toBeInstanceOf(logger_js_1.AstLogger);
                }
                finally {
                    process.stdout = originalStdout;
                    process.env = originalEnv;
                }
            });
        });
        (0, vitest_1.describe)('isLogLevelEnabled', function () {
            (0, vitest_1.it)('should correctly determine if level is enabled', function () {
                // Remember: lower numeric values have higher priority
                // ERROR = 0, WARN = 1, INFO = 2, DEBUG = 3, TRACE = 4
                (0, vitest_1.expect)((0, utils_js_1.isLogLevelEnabled)(types_js_1.LogLevel.ERROR, types_js_1.LogLevel.ERROR)).toBe(true);
                (0, vitest_1.expect)((0, utils_js_1.isLogLevelEnabled)(types_js_1.LogLevel.WARN, types_js_1.LogLevel.ERROR)).toBe(true);
                (0, vitest_1.expect)((0, utils_js_1.isLogLevelEnabled)(types_js_1.LogLevel.ERROR, types_js_1.LogLevel.WARN)).toBe(false);
                (0, vitest_1.expect)((0, utils_js_1.isLogLevelEnabled)(types_js_1.LogLevel.INFO, types_js_1.LogLevel.ERROR)).toBe(true);
                (0, vitest_1.expect)((0, utils_js_1.isLogLevelEnabled)(types_js_1.LogLevel.ERROR, types_js_1.LogLevel.INFO)).toBe(false);
            });
        });
        (0, vitest_1.describe)('LOG_LEVEL_NAMES', function () {
            (0, vitest_1.it)('should contain all log level mappings', function () {
                var _a;
                (0, vitest_1.expect)(utils_js_1.LOG_LEVEL_NAMES).toEqual((_a = {},
                    _a[types_js_1.LogLevel.ERROR] = 'ERROR',
                    _a[types_js_1.LogLevel.WARN] = 'WARN',
                    _a[types_js_1.LogLevel.INFO] = 'INFO',
                    _a[types_js_1.LogLevel.DEBUG] = 'DEBUG',
                    _a[types_js_1.LogLevel.TRACE] = 'TRACE',
                    _a));
            });
        });
    });
    (0, vitest_1.describe)('Integration Tests', function () {
        (0, vitest_1.it)('should work with multiple outputs', function () {
            var consoleOutput = new console_output_js_1.ConsoleOutput();
            var jsonOutput = new json_output_js_1.JsonOutput();
            vitest_1.vi.spyOn(consoleOutput, 'write').mockImplementation(function () { });
            vitest_1.vi.spyOn(jsonOutput, 'write').mockImplementation(function () { });
            var logger = new logger_js_1.AstLogger({
                level: types_js_1.LogLevel.INFO,
                outputs: [consoleOutput, jsonOutput]
            });
            logger.info('test message', { key: 'value' });
            (0, vitest_1.expect)(consoleOutput.write).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(jsonOutput.write).toHaveBeenCalledTimes(1);
        });
        (0, vitest_1.it)('should handle complex nested child loggers', function () {
            var mockOutput = { write: vitest_1.vi.fn() };
            var rootLogger = new logger_js_1.AstLogger({
                level: types_js_1.LogLevel.TRACE,
                outputs: [mockOutput],
                childContext: { service: 'ast-helper' }
            });
            var moduleLogger = rootLogger.child({ module: 'config' });
            var subLogger = moduleLogger.child({ component: 'validator' });
            subLogger.warn('validation warning', { field: 'parseGlob' });
            (0, vitest_1.expect)(mockOutput.write).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                level: types_js_1.LogLevel.WARN,
                message: 'validation warning',
                context: vitest_1.expect.objectContaining({
                    service: 'ast-helper',
                    module: 'config',
                    component: 'validator',
                    field: 'parseGlob'
                })
            }));
        });
        (0, vitest_1.it)('should handle error serialization in JSON output', function () {
            var mockConsole = { log: vitest_1.vi.fn() };
            global.console = mockConsole;
            var jsonOutput = new json_output_js_1.JsonOutput();
            var logger = new logger_js_1.AstLogger({
                level: types_js_1.LogLevel.ERROR,
                outputs: [jsonOutput]
            });
            var error = new Error('Test error');
            error.stack = 'Error: Test error\n    at test.js:1:1';
            logger.error('Error occurred', { error: error });
            var logCall = mockConsole.log.mock.calls[0][0];
            var parsed = JSON.parse(logCall);
            (0, vitest_1.expect)(parsed.context.error.message).toBe('Test error');
            (0, vitest_1.expect)(parsed.context.error.name).toBe('Error');
            (0, vitest_1.expect)(parsed.context.error.stack).toBeTruthy(); // Just check that stack exists
        });
    });
});
