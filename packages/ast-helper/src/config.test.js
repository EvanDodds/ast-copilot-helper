"use strict";
/**
 * Tests for configuration system
 * Covers configuration loading, validation, and precedence
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
var manager_js_1 = require("../src/config/manager.js");
var defaults_js_1 = require("../src/config/defaults.js");
var environment_js_1 = require("../src/config/environment.js");
var cli_js_1 = require("../src/config/cli.js");
(0, vitest_1.describe)('Configuration System', function () {
    var originalEnv;
    (0, vitest_1.beforeEach)(function () {
        // Save original environment
        originalEnv = __assign({}, process.env);
    });
    (0, vitest_1.afterEach)(function () {
        // Restore original environment
        process.env = originalEnv;
    });
    (0, vitest_1.describe)('Default Configuration', function () {
        (0, vitest_1.it)('should provide valid default configuration', function () {
            (0, vitest_1.expect)(defaults_js_1.DEFAULT_CONFIG).toBeDefined();
            (0, vitest_1.expect)(defaults_js_1.DEFAULT_CONFIG.parseGlob).toEqual(['src/**/*.ts', 'src/**/*.js', 'src/**/*.py']);
            (0, vitest_1.expect)(defaults_js_1.DEFAULT_CONFIG.watchGlob).toEqual(['src/**/*']);
            (0, vitest_1.expect)(defaults_js_1.DEFAULT_CONFIG.topK).toBe(5);
            (0, vitest_1.expect)(defaults_js_1.DEFAULT_CONFIG.snippetLines).toBe(10);
            (0, vitest_1.expect)(defaults_js_1.DEFAULT_CONFIG.indexParams.efConstruction).toBe(200);
            (0, vitest_1.expect)(defaults_js_1.DEFAULT_CONFIG.indexParams.M).toBe(16);
            (0, vitest_1.expect)(defaults_js_1.DEFAULT_CONFIG.modelHost).toBe('https://huggingface.co');
            (0, vitest_1.expect)(defaults_js_1.DEFAULT_CONFIG.enableTelemetry).toBe(false);
            (0, vitest_1.expect)(defaults_js_1.DEFAULT_CONFIG.concurrency).toBe(4);
            (0, vitest_1.expect)(defaults_js_1.DEFAULT_CONFIG.batchSize).toBe(100);
        });
        (0, vitest_1.it)('should validate and fill missing values with defaults', function () {
            var config = (0, defaults_js_1.validateConfig)({});
            (0, vitest_1.expect)(config).toEqual(defaults_js_1.DEFAULT_CONFIG);
        });
        (0, vitest_1.it)('should preserve valid configuration values', function () {
            var input = {
                topK: 10,
                snippetLines: 20,
                enableTelemetry: true
            };
            var config = (0, defaults_js_1.validateConfig)(input);
            (0, vitest_1.expect)(config.topK).toBe(10);
            (0, vitest_1.expect)(config.snippetLines).toBe(20);
            (0, vitest_1.expect)(config.enableTelemetry).toBe(true);
            // Other values should be defaults
            (0, vitest_1.expect)(config.parseGlob).toEqual(defaults_js_1.DEFAULT_CONFIG.parseGlob);
        });
    });
    (0, vitest_1.describe)('Configuration Validation', function () {
        (0, vitest_1.it)('should throw error for invalid topK', function () {
            (0, vitest_1.expect)(function () { return (0, defaults_js_1.validateConfig)({ topK: 0 }); }).toThrow('topK must be an integer between 1 and 100');
            (0, vitest_1.expect)(function () { return (0, defaults_js_1.validateConfig)({ topK: 101 }); }).toThrow('topK must be an integer between 1 and 100');
        });
        (0, vitest_1.it)('should throw error for invalid snippetLines', function () {
            (0, vitest_1.expect)(function () { return (0, defaults_js_1.validateConfig)({ snippetLines: 0 }); }).toThrow('snippetLines must be an integer between 1 and 50');
            (0, vitest_1.expect)(function () { return (0, defaults_js_1.validateConfig)({ snippetLines: 51 }); }).toThrow('snippetLines must be an integer between 1 and 50');
        });
        (0, vitest_1.it)('should throw error for invalid concurrency', function () {
            (0, vitest_1.expect)(function () { return (0, defaults_js_1.validateConfig)({ concurrency: 0 }); }).toThrow('concurrency must be an integer between 1 and 16');
            (0, vitest_1.expect)(function () { return (0, defaults_js_1.validateConfig)({ concurrency: 17 }); }).toThrow('concurrency must be an integer between 1 and 16');
        });
        (0, vitest_1.it)('should throw error for invalid index parameters', function () {
            (0, vitest_1.expect)(function () { return (0, defaults_js_1.validateConfig)({ indexParams: { efConstruction: 15 } }); }).toThrow('efConstruction must be an integer between 16 and 800');
            (0, vitest_1.expect)(function () { return (0, defaults_js_1.validateConfig)({ indexParams: { M: 3 } }); }).toThrow('M must be an integer between 4 and 64');
        });
        (0, vitest_1.it)('should throw error for invalid modelHost', function () {
            (0, vitest_1.expect)(function () { return (0, defaults_js_1.validateConfig)({ modelHost: '' }); }).toThrow('modelHost must be a non-empty string');
            (0, vitest_1.expect)(function () { return (0, defaults_js_1.validateConfig)({ modelHost: '   ' }); }).toThrow('modelHost must be a non-empty string');
        });
    });
    (0, vitest_1.describe)('Environment Variable Parsing', function () {
        (0, vitest_1.it)('should parse numeric environment variables', function () {
            process.env.AST_COPILOT_TOP_K = '15';
            process.env.AST_COPILOT_SNIPPET_LINES = '25';
            process.env.AST_COPILOT_CONCURRENCY = '8';
            var config = (0, environment_js_1.parseEnvironmentConfig)();
            (0, vitest_1.expect)(config.topK).toBe(15);
            (0, vitest_1.expect)(config.snippetLines).toBe(25);
            (0, vitest_1.expect)(config.concurrency).toBe(8);
        });
        (0, vitest_1.it)('should parse boolean environment variables', function () {
            process.env.AST_COPILOT_ENABLE_TELEMETRY = 'true';
            var config = (0, environment_js_1.parseEnvironmentConfig)();
            (0, vitest_1.expect)(config.enableTelemetry).toBe(true);
            process.env.AST_COPILOT_ENABLE_TELEMETRY = 'false';
            var config2 = (0, environment_js_1.parseEnvironmentConfig)();
            (0, vitest_1.expect)(config2.enableTelemetry).toBe(false);
        });
        (0, vitest_1.it)('should parse string environment variables', function () {
            process.env.AST_COPILOT_MODEL_HOST = 'https://example.com';
            var config = (0, environment_js_1.parseEnvironmentConfig)();
            (0, vitest_1.expect)(config.modelHost).toBe('https://example.com');
        });
        (0, vitest_1.it)('should parse array environment variables', function () {
            process.env.AST_COPILOT_PARSE_GLOB = 'src/**/*.ts,lib/**/*.js,test/**/*.py';
            var config = (0, environment_js_1.parseEnvironmentConfig)();
            (0, vitest_1.expect)(config.parseGlob).toEqual(['src/**/*.ts', 'lib/**/*.js', 'test/**/*.py']);
        });
        (0, vitest_1.it)('should parse index parameters', function () {
            var _a, _b;
            process.env.AST_COPILOT_EF_CONSTRUCTION = '400';
            process.env.AST_COPILOT_M = '32';
            var config = (0, environment_js_1.parseEnvironmentConfig)();
            (0, vitest_1.expect)((_a = config.indexParams) === null || _a === void 0 ? void 0 : _a.efConstruction).toBe(400);
            (0, vitest_1.expect)((_b = config.indexParams) === null || _b === void 0 ? void 0 : _b.M).toBe(32);
        });
    });
    (0, vitest_1.describe)('CLI Argument Parsing', function () {
        (0, vitest_1.it)('should parse CLI arguments correctly', function () {
            var args = {
                'top-k': 20,
                'snippet-lines': 15,
                'enable-telemetry': true,
                'parse-glob': 'src/**/*.ts,lib/**/*.js'
            };
            var config = (0, cli_js_1.parseCliArgs)(args);
            (0, vitest_1.expect)(config.topK).toBe(20);
            (0, vitest_1.expect)(config.snippetLines).toBe(15);
            (0, vitest_1.expect)(config.enableTelemetry).toBe(true);
            (0, vitest_1.expect)(config.parseGlob).toEqual(['src/**/*.ts', 'lib/**/*.js']);
        });
        (0, vitest_1.it)('should handle index parameters', function () {
            var _a, _b;
            var args = {
                'ef-construction': 300,
                'M': 24
            };
            var config = (0, cli_js_1.parseCliArgs)(args);
            (0, vitest_1.expect)((_a = config.indexParams) === null || _a === void 0 ? void 0 : _a.efConstruction).toBe(300);
            (0, vitest_1.expect)((_b = config.indexParams) === null || _b === void 0 ? void 0 : _b.M).toBe(24);
        });
    });
    (0, vitest_1.describe)('ConfigManager Integration', function () {
        var configManager;
        (0, vitest_1.beforeEach)(function () {
            configManager = new manager_js_1.ConfigManager();
        });
        (0, vitest_1.it)('should load configuration with defaults only', function () { return __awaiter(void 0, void 0, void 0, function () {
            var config;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, configManager.loadConfig('/tmp/test-workspace')];
                    case 1:
                        config = _a.sent();
                        (0, vitest_1.expect)(config).toEqual(defaults_js_1.DEFAULT_CONFIG);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should merge CLI arguments with defaults', function () { return __awaiter(void 0, void 0, void 0, function () {
            var cliArgs, config;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cliArgs = {
                            'top-k': 15,
                            'enable-telemetry': true
                        };
                        return [4 /*yield*/, configManager.loadConfig('/tmp/test-workspace', cliArgs)];
                    case 1:
                        config = _a.sent();
                        (0, vitest_1.expect)(config.topK).toBe(15);
                        (0, vitest_1.expect)(config.enableTelemetry).toBe(true);
                        // Other values should be defaults
                        (0, vitest_1.expect)(config.snippetLines).toBe(defaults_js_1.DEFAULT_CONFIG.snippetLines);
                        (0, vitest_1.expect)(config.parseGlob).toEqual(defaults_js_1.DEFAULT_CONFIG.parseGlob);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should handle configuration loading errors gracefully', function () { return __awaiter(void 0, void 0, void 0, function () {
            var invalidArgs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        invalidArgs = {
                            'top-k': 999 // Invalid value
                        };
                        return [4 /*yield*/, (0, vitest_1.expect)(configManager.loadConfig('/tmp/test-workspace', invalidArgs))
                                .rejects.toThrow('Failed to load configuration')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
