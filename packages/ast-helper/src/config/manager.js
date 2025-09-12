"use strict";
/**
 * Configuration Manager
 * Handles loading and merging configuration from multiple sources
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
var defaults_js_1 = require("./defaults.js");
var environment_js_1 = require("./environment.js");
var cli_js_1 = require("./cli.js");
var files_js_1 = require("./files.js");
/**
 * Configuration Manager class
 * Loads configuration from multiple sources in priority order:
 * 1. CLI Arguments (highest priority)
 * 2. Environment Variables
 * 3. Project Config (.astdb/config.json)
 * 4. User Config (~/.config/ast-copilot-helper/config.json)
 * 5. Built-in Defaults (lowest priority)
 */
var ConfigManager = /** @class */ (function () {
    function ConfigManager() {
    }
    /**
     * Load complete configuration from all sources
     */
    ConfigManager.prototype.loadConfig = function (workspacePath_1) {
        return __awaiter(this, arguments, void 0, function (workspacePath, cliArgs) {
            var sources, fileConfigs, envConfig, cliConfig, mergedConfig, error_1;
            if (cliArgs === void 0) { cliArgs = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        sources = [];
                        return [4 /*yield*/, (0, files_js_1.loadConfigFiles)(workspacePath)];
                    case 1:
                        fileConfigs = _a.sent();
                        sources.push.apply(sources, fileConfigs.reverse()); // Reverse to get user config first, then project
                        envConfig = (0, environment_js_1.parseEnvironmentConfig)();
                        if (Object.keys(envConfig).length > 0) {
                            sources.push(envConfig);
                        }
                        cliConfig = (0, cli_js_1.parseCliArgs)(cliArgs);
                        if (Object.keys(cliConfig).length > 0) {
                            sources.push(cliConfig);
                        }
                        mergedConfig = this.mergeConfigs(sources);
                        // Validate and return complete configuration with defaults
                        return [2 /*return*/, (0, defaults_js_1.validateConfig)(mergedConfig)];
                    case 2:
                        error_1 = _a.sent();
                        throw new Error("Failed to load configuration: ".concat(error_1.message));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Merge multiple partial configurations with proper precedence
     * Later sources override earlier sources
     */
    ConfigManager.prototype.mergeConfigs = function (sources) {
        var result = {};
        for (var _i = 0, sources_1 = sources; _i < sources_1.length; _i++) {
            var source = sources_1[_i];
            // Merge simple properties
            if (source.parseGlob !== undefined)
                result.parseGlob = source.parseGlob;
            if (source.watchGlob !== undefined)
                result.watchGlob = source.watchGlob;
            if (source.topK !== undefined)
                result.topK = source.topK;
            if (source.snippetLines !== undefined)
                result.snippetLines = source.snippetLines;
            if (source.modelHost !== undefined)
                result.modelHost = source.modelHost;
            if (source.enableTelemetry !== undefined)
                result.enableTelemetry = source.enableTelemetry;
            if (source.concurrency !== undefined)
                result.concurrency = source.concurrency;
            if (source.batchSize !== undefined)
                result.batchSize = source.batchSize;
            // Merge nested indexParams object
            if (source.indexParams) {
                if (!result.indexParams) {
                    result.indexParams = {};
                }
                if (source.indexParams.efConstruction !== undefined) {
                    result.indexParams.efConstruction = source.indexParams.efConstruction;
                }
                if (source.indexParams.M !== undefined) {
                    result.indexParams.M = source.indexParams.M;
                }
            }
        }
        return result;
    };
    /**
     * Get configuration file paths for the given workspace
     */
    ConfigManager.prototype.getConfigPaths = function (workspacePath) {
        var resolveConfigPaths = require('./files.js').resolveConfigPaths;
        return resolveConfigPaths(workspacePath);
    };
    return ConfigManager;
}());
exports.ConfigManager = ConfigManager;
