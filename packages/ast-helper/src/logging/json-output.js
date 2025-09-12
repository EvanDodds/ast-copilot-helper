"use strict";
/**
 * JSON log output implementation
 * Provides structured JSON output for programmatic consumption
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
exports.JsonOutput = void 0;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var promises_2 = require("node:fs/promises");
var JsonOutput = /** @class */ (function () {
    function JsonOutput(options) {
        if (options === void 0) { options = {}; }
        var _this = this;
        var _a, _b;
        this.buffer = [];
        this.filePath = options.filePath;
        this.pretty = (_a = options.pretty) !== null && _a !== void 0 ? _a : false;
        this.maxBufferSize = (_b = options.maxBufferSize) !== null && _b !== void 0 ? _b : 100;
        // Auto-flush timer
        if (options.autoFlushMs) {
            this.flushTimer = setInterval(function () {
                _this.flush().catch(console.error);
            }, options.autoFlushMs);
        }
    }
    JsonOutput.prototype.write = function (entry) {
        if (this.filePath) {
            // Buffer for file output
            this.buffer.push(entry);
            if (this.buffer.length >= this.maxBufferSize) {
                this.flush().catch(console.error);
            }
        }
        else {
            // Direct console output as JSON
            var json = this.formatEntry(entry);
            console.log(json);
        }
    };
    JsonOutput.prototype.flush = function () {
        return __awaiter(this, void 0, void 0, function () {
            var lines, content, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.filePath || this.buffer.length === 0) {
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        // Ensure directory exists
                        return [4 /*yield*/, (0, promises_2.mkdir)((0, node_path_1.dirname)(this.filePath), { recursive: true })];
                    case 2:
                        // Ensure directory exists
                        _a.sent();
                        lines = this.buffer.map(function (entry) { return _this.formatEntry(entry); });
                        content = lines.join('\n') + '\n';
                        // Append to file
                        return [4 /*yield*/, (0, promises_1.appendFile)(this.filePath, content, 'utf-8')];
                    case 3:
                        // Append to file
                        _a.sent();
                        // Clear buffer
                        this.buffer = [];
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error('Failed to flush JSON log output:', error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    JsonOutput.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.flushTimer) {
                            clearInterval(this.flushTimer);
                        }
                        return [4 /*yield*/, this.flush()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    JsonOutput.prototype.formatEntry = function (entry) {
        if (this.pretty) {
            return JSON.stringify(entry, null, 2);
        }
        else {
            return JSON.stringify(entry);
        }
    };
    return JsonOutput;
}());
exports.JsonOutput = JsonOutput;
