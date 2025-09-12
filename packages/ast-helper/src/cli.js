#!/usr/bin/env node
"use strict";
/**
 * CLI entry point for ast-helper
 * Integrates configuration, logging, error handling, and file locking systems
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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstHelperCli = void 0;
var index_js_1 = require("./config/index.js");
var index_js_2 = require("./logging/index.js");
var index_js_3 = require("./errors/index.js");
var index_js_4 = require("./locking/index.js");
var index_js_5 = require("./errors/index.js");
var path = require("path");
var AstHelperCli = /** @class */ (function () {
    function AstHelperCli() {
        this.logger = (0, index_js_2.createLogger)();
        this.errorFormatter = new index_js_3.ErrorFormatter();
        this.configManager = new index_js_1.ConfigManager();
        // Set up global error handling
        (0, index_js_2.setupGlobalErrorHandling)(this.logger);
    }
    /**
     * Main entry point for CLI
     */
    AstHelperCli.prototype.run = function () {
        return __awaiter(this, arguments, void 0, function (args) {
            var cliArgs, workspacePath, error_1;
            if (args === void 0) { args = process.argv.slice(2); }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 7]);
                        cliArgs = this.parseArgs(args);
                        // Handle help and version flags
                        if (cliArgs.help) {
                            this.showHelp();
                            return [2 /*return*/];
                        }
                        if (cliArgs.version) {
                            this.showVersion();
                            return [2 /*return*/];
                        }
                        workspacePath = cliArgs.source || process.cwd();
                        // Initialize LockManager with workspace path
                        this.lockManager = new index_js_4.LockManager(workspacePath);
                        // Load configuration
                        return [4 /*yield*/, this.loadConfiguration(workspacePath, cliArgs)];
                    case 1:
                        // Load configuration
                        _a.sent();
                        // Set up logging based on configuration
                        this.setupLogging();
                        // Acquire database lock
                        return [4 /*yield*/, this.acquireDatabaseLock()];
                    case 2:
                        // Acquire database lock
                        _a.sent();
                        // Create database directory structure if needed
                        return [4 /*yield*/, this.ensureDatabaseDirectory()];
                    case 3:
                        // Create database directory structure if needed
                        _a.sent();
                        // TODO: Add actual AST processing logic here
                        this.logger.info('AST Helper CLI started successfully', {
                            workspacePath: workspacePath,
                            outputDir: this.config.outputDir,
                            verbose: this.config.verbose,
                            debug: this.config.debug
                        });
                        // Release lock before exit
                        return [4 /*yield*/, this.releaseDatabaseLock()];
                    case 4:
                        // Release lock before exit
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        error_1 = _a.sent();
                        return [4 /*yield*/, this.handleError(error_1)];
                    case 6:
                        _a.sent();
                        process.exit(1);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Parse command line arguments
     */
    AstHelperCli.prototype.parseArgs = function (args) {
        var parsed = {};
        for (var i = 0; i < args.length; i++) {
            var arg = args[i];
            if (arg === '--help' || arg === '-h') {
                parsed.help = true;
            }
            else if (arg === '--version' || arg === '-v') {
                parsed.version = true;
            }
            else if (arg === '--verbose') {
                parsed.verbose = true;
            }
            else if (arg === '--debug') {
                parsed.debug = true;
            }
            else if (arg === '--json-logs') {
                parsed.jsonLogs = true;
            }
            else if (arg === '--watch') {
                parsed.watch = true;
            }
            else if (arg === '--source') {
                var nextArg = args[i + 1];
                if (!nextArg || nextArg.startsWith('-')) {
                    throw index_js_5.ValidationErrors.missingValue('--source', 'directory path');
                }
                parsed.source = nextArg;
                i++;
            }
            else if (arg === '--output') {
                var nextArg = args[i + 1];
                if (!nextArg || nextArg.startsWith('-')) {
                    throw index_js_5.ValidationErrors.missingValue('--output', 'directory path');
                }
                parsed.outputDir = nextArg;
                i++;
            }
            else if (arg === '--parse-glob') {
                var nextArg = args[i + 1];
                if (!nextArg || nextArg.startsWith('-')) {
                    throw index_js_5.ValidationErrors.missingValue('--parse-glob', 'glob pattern');
                }
                parsed.parseGlob = nextArg.split(',').map(function (p) { return p.trim(); });
                i++;
            }
            else if (arg === '--watch-glob') {
                var nextArg = args[i + 1];
                if (!nextArg || nextArg.startsWith('-')) {
                    throw index_js_5.ValidationErrors.missingValue('--watch-glob', 'glob pattern');
                }
                parsed.watchGlob = nextArg.split(',').map(function (p) { return p.trim(); });
                i++;
            }
            else if (arg === '--top-k') {
                var nextArg = args[i + 1];
                if (!nextArg || nextArg.startsWith('-')) {
                    throw index_js_5.ValidationErrors.missingValue('--top-k', 'number');
                }
                var topK = parseInt(nextArg, 10);
                if (isNaN(topK)) {
                    throw index_js_5.ValidationErrors.invalidValue('--top-k', nextArg, 'Must be a number');
                }
                parsed.topK = topK;
                i++;
            }
            else if (arg === '--log-file') {
                var nextArg = args[i + 1];
                if (!nextArg || nextArg.startsWith('-')) {
                    throw index_js_5.ValidationErrors.missingValue('--log-file', 'file path');
                }
                parsed.logFile = nextArg;
                i++;
            }
            else {
                // Handle positional arguments or unknown flags
                var currentArg = args[i];
                if (currentArg && !currentArg.startsWith('-')) {
                    // Positional argument - treat as source if not set
                    if (!parsed.source) {
                        parsed.source = currentArg;
                    }
                }
                else {
                    throw index_js_5.ValidationErrors.invalidValue('CLI argument', currentArg || '', 'Use --help for usage information');
                }
            }
        }
        return parsed;
    };
    /**
     * Load and merge configuration from all sources
     */
    AstHelperCli.prototype.loadConfiguration = function (workspacePath, cliArgs) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        _a = this;
                        return [4 /*yield*/, this.configManager.loadConfig(workspacePath, cliArgs)];
                    case 1:
                        _a.config = _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _b.sent();
                        throw index_js_5.ConfigurationErrors.loadFailed('Failed to load configuration', error_2);
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Set up logging based on configuration
     */
    AstHelperCli.prototype.setupLogging = function () {
        var logLevel = (0, index_js_2.parseLogLevel)(this.config.debug ? 'debug' : this.config.verbose ? 'info' : 'warn');
        this.logger = (0, index_js_2.createLogger)({
            level: logLevel,
            jsonOutput: this.config.jsonLogs,
            logFile: this.config.logFile,
            includeTimestamp: true
        });
    };
    /**
     * Acquire exclusive lock for database operations
     */
    AstHelperCli.prototype.acquireDatabaseLock = function () {
        return __awaiter(this, void 0, void 0, function () {
            var lockPath, _a, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.lockManager) {
                            throw index_js_5.ConfigurationErrors.invalidValue('lockManager', 'undefined', 'LockManager not initialized');
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        lockPath = path.join(this.config.outputDir, '.lock');
                        _a = this;
                        return [4 /*yield*/, this.lockManager.acquireExclusiveLock(lockPath, {
                                timeoutMs: 30000
                            })];
                    case 2:
                        _a.currentLock = _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _b.sent();
                        throw index_js_5.ConfigurationErrors.loadFailed('Failed to acquire database lock', error_3);
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Release database lock
     */
    AstHelperCli.prototype.releaseDatabaseLock = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.lockManager || !this.currentLock) {
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.lockManager.releaseLock(this.currentLock)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _a.sent();
                        this.logger.warn('Failed to release database lock', { error: error_4.message });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Ensure database directory structure exists
     */
    AstHelperCli.prototype.ensureDatabaseDirectory = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fs, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                    case 1:
                        fs = _a.sent();
                        return [4 /*yield*/, fs.mkdir(this.config.outputDir, { recursive: true })];
                    case 2:
                        _a.sent();
                        // Create subdirectories
                        return [4 /*yield*/, fs.mkdir(path.join(this.config.outputDir, 'index'), { recursive: true })];
                    case 3:
                        // Create subdirectories
                        _a.sent();
                        return [4 /*yield*/, fs.mkdir(path.join(this.config.outputDir, 'cache'), { recursive: true })];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, fs.mkdir(path.join(this.config.outputDir, 'logs'), { recursive: true })];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        error_5 = _a.sent();
                        throw index_js_5.ConfigurationErrors.loadFailed('Failed to create database directory structure', error_5);
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle errors with appropriate formatting and logging
     */
    AstHelperCli.prototype.handleError = function (error) {
        return __awaiter(this, void 0, void 0, function () {
            var userMessage, debugMessage, errorMessage;
            var _a;
            return __generator(this, function (_b) {
                if (error && typeof error === 'object' && 'isAstError' in error) {
                    userMessage = this.errorFormatter.formatForUser(error);
                    debugMessage = this.errorFormatter.formatForDebug(error);
                    console.error(userMessage);
                    if ((_a = this.config) === null || _a === void 0 ? void 0 : _a.debug) {
                        console.error('Debug details:', debugMessage);
                    }
                    // Log structured error details
                    this.logger.error('CLI error occurred', {
                        message: error.message,
                        code: error.code,
                        context: error.context
                    });
                }
                else {
                    errorMessage = error instanceof Error ? error.message : String(error);
                    console.error("Error: ".concat(errorMessage));
                    this.logger.error('Unexpected CLI error', {
                        message: errorMessage,
                        stack: error instanceof Error ? error.stack : undefined
                    });
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Display help message
     */
    AstHelperCli.prototype.showHelp = function () {
        var help = "\nAST Copilot Helper - Code Analysis and Search Tool\n\nUSAGE:\n    ast-helper [OPTIONS] [SOURCE]\n\nARGUMENTS:\n    <SOURCE>              Source directory or file to process (default: current directory)\n\nOPTIONS:\n    -h, --help           Show this help message\n    -v, --version        Show version information\n    \n    --source <PATH>      Source directory or file to process\n    --output <PATH>      Output directory for database files (default: .astdb)\n    \n    --parse-glob <GLOB>  File patterns to parse (comma-separated)\n    --watch-glob <GLOB>  File patterns to watch (comma-separated)\n    --top-k <NUMBER>     Number of search results to return\n    \n    --verbose            Enable verbose logging\n    --debug              Enable debug logging\n    --json-logs          Output logs in JSON format\n    --log-file <PATH>    Write logs to specified file\n    --watch              Enable watch mode for file changes\n\nEXAMPLES:\n    ast-helper                           # Process current directory\n    ast-helper ./src                     # Process specific directory\n    ast-helper --parse-glob \"**/*.ts\"    # Parse only TypeScript files\n    ast-helper --top-k 20 --verbose     # Increase results and enable verbose logging\n\nENVIRONMENT VARIABLES:\n    AST_COPILOT_OUTPUT_DIR              Output directory for database files\n    AST_COPILOT_TOP_K                   Number of search results\n    AST_COPILOT_PARSE_GLOB              File patterns to parse\n    AST_COPILOT_WATCH_GLOB              File patterns to watch\n    AST_COPILOT_VERBOSE                 Enable verbose logging (true/false)\n    AST_COPILOT_DEBUG                   Enable debug logging (true/false)\n    AST_COPILOT_JSON_LOGS               Output logs in JSON format (true/false)\n    AST_COPILOT_LOG_FILE                Log file path\n\nFor more information, visit: https://github.com/EvanDodds/ast-copilot-helper\n";
        console.log(help);
    };
    /**
     * Display version information
     */
    AstHelperCli.prototype.showVersion = function () {
        // TODO: Read version from package.json
        console.log('ast-helper version 0.1.0');
    };
    return AstHelperCli;
}());
exports.AstHelperCli = AstHelperCli;
// Run CLI if this file is executed directly
var isMain = ((_a = process.argv[1]) === null || _a === void 0 ? void 0 : _a.endsWith('cli.js')) || ((_b = process.argv[1]) === null || _b === void 0 ? void 0 : _b.endsWith('cli.ts'));
if (isMain) {
    var cli = new AstHelperCli();
    cli.run().catch(function (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
exports.default = AstHelperCli;
