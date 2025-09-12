"use strict";
/**
 * File-based configuration loading
 * Handles loading configuration from JSON files
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
exports.loadConfigFile = loadConfigFile;
exports.resolveConfigPaths = resolveConfigPaths;
exports.loadConfigFiles = loadConfigFiles;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
/**
 * Load configuration from a JSON file
 */
function loadConfigFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var content, config, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.readFile)(filePath, 'utf-8')];
                case 1:
                    content = _a.sent();
                    config = JSON.parse(content);
                    // Validate that it's an object
                    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
                        throw new Error("Invalid configuration format in ".concat(filePath, ": must be an object"));
                    }
                    return [2 /*return*/, config];
                case 2:
                    error_1 = _a.sent();
                    if (error_1.code === 'ENOENT') {
                        // File doesn't exist, return empty config
                        return [2 /*return*/, {}];
                    }
                    // Re-throw parsing or other errors
                    throw new Error("Failed to load configuration from ".concat(filePath, ": ").concat(error_1.message));
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Resolve configuration file paths in priority order
 */
function resolveConfigPaths(workspacePath) {
    return [
        // Project config: .astdb/config.json in workspace
        (0, node_path_1.join)(workspacePath, '.astdb', 'config.json'),
        // User config: ~/.config/ast-copilot-helper/config.json
        (0, node_path_1.join)((0, node_os_1.homedir)(), '.config', 'ast-copilot-helper', 'config.json')
    ];
}
/**
 * Load configuration from multiple file sources
 */
function loadConfigFiles(workspacePath) {
    return __awaiter(this, void 0, void 0, function () {
        var configPaths, configs, _i, configPaths_1, configPath, config;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    configPaths = resolveConfigPaths(workspacePath);
                    configs = [];
                    _i = 0, configPaths_1 = configPaths;
                    _a.label = 1;
                case 1:
                    if (!(_i < configPaths_1.length)) return [3 /*break*/, 4];
                    configPath = configPaths_1[_i];
                    return [4 /*yield*/, loadConfigFile(configPath)];
                case 2:
                    config = _a.sent();
                    if (Object.keys(config).length > 0) {
                        configs.push(config);
                    }
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, configs];
            }
        });
    });
}
