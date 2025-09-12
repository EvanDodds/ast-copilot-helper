"use strict";
/**
 * Cross-platform file locking utilities
 * Provides file locking functionality that works on Windows, macOS, and Linux
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
exports.generateLockId = generateLockId;
exports.createLockContent = createLockContent;
exports.parseLockContent = parseLockContent;
exports.isProcessRunning = isProcessRunning;
exports.isLockExpired = isLockExpired;
exports.ensureLockDirectory = ensureLockDirectory;
exports.readLockFile = readLockFile;
exports.writeLockFile = writeLockFile;
exports.removeLockFile = removeLockFile;
exports.cleanupStaleLocks = cleanupStaleLocks;
exports.sleep = sleep;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_crypto_1 = require("node:crypto");
/**
 * Generate a unique lock ID
 */
function generateLockId() {
    return (0, node_crypto_1.randomBytes)(8).toString('hex');
}
/**
 * Create lock file content with metadata
 */
function createLockContent(lock) {
    return JSON.stringify({
        id: generateLockId(),
        type: lock.type,
        operation: lock.operation,
        acquiredAt: lock.acquiredAt.toISOString(),
        timeoutMs: lock.timeoutMs,
        pid: lock.pid
    }, null, 2);
}
/**
 * Parse lock file content
 */
function parseLockContent(content) {
    try {
        var data = JSON.parse(content);
        return {
            id: data.id,
            type: data.type,
            filePath: '', // Will be set by caller
            operation: data.operation,
            acquiredAt: new Date(data.acquiredAt),
            timeoutMs: data.timeoutMs,
            pid: data.pid
        };
    }
    catch (error) {
        throw new Error("Invalid lock file content: ".concat(error.message));
    }
}
/**
 * Check if a process is still running
 */
function isProcessRunning(pid) {
    try {
        // Sending signal 0 checks if process exists without actually sending a signal
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        // Process doesn't exist or we don't have permission
        return false;
    }
}
/**
 * Check if a lock has expired
 */
function isLockExpired(lock) {
    var now = new Date();
    var expiredAt = new Date(lock.acquiredAt.getTime() + lock.timeoutMs);
    return now > expiredAt;
}
/**
 * Ensure directory exists for lock file
 */
function ensureLockDirectory(lockFilePath) {
    return __awaiter(this, void 0, void 0, function () {
        var dir, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dir = (0, node_path_1.dirname)(lockFilePath);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, promises_1.mkdir)(dir, { recursive: true })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    if (error_1.code !== 'EEXIST') {
                        throw new Error("Failed to create lock directory ".concat(dir, ": ").concat(error_1.message));
                    }
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Try to read existing lock file
 */
function readLockFile(lockFilePath) {
    return __awaiter(this, void 0, void 0, function () {
        var content, lock, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.readFile)(lockFilePath, 'utf-8')];
                case 1:
                    content = _a.sent();
                    lock = parseLockContent(content);
                    lock.filePath = lockFilePath;
                    return [2 /*return*/, lock];
                case 2:
                    error_2 = _a.sent();
                    if (error_2.code === 'ENOENT') {
                        return [2 /*return*/, null]; // File doesn't exist
                    }
                    throw new Error("Failed to read lock file ".concat(lockFilePath, ": ").concat(error_2.message));
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Write lock file atomically
 */
function writeLockFile(lockFilePath, lock) {
    return __awaiter(this, void 0, void 0, function () {
        var lockWithPath, lockContent, lockData, tempPath, renameError_1, _a, error_3;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, ensureLockDirectory(lockFilePath)];
                case 1:
                    _b.sent();
                    lockWithPath = __assign(__assign({}, lock), { filePath: lockFilePath });
                    lockContent = createLockContent(lockWithPath);
                    lockData = parseLockContent(lockContent);
                    lockData.filePath = lockFilePath;
                    tempPath = "".concat(lockFilePath, ".tmp.").concat(process.pid);
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 12, , 13]);
                    return [4 /*yield*/, (0, promises_1.writeFile)(tempPath, lockContent, 'utf-8')];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 6, , 11]);
                    return [4 /*yield*/, require('fs').promises.rename(tempPath, lockFilePath)];
                case 5:
                    _b.sent();
                    return [3 /*break*/, 11];
                case 6:
                    renameError_1 = _b.sent();
                    _b.label = 7;
                case 7:
                    _b.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, (0, promises_1.unlink)(tempPath)];
                case 8:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 9:
                    _a = _b.sent();
                    return [3 /*break*/, 10];
                case 10: throw renameError_1;
                case 11: return [2 /*return*/, lockData];
                case 12:
                    error_3 = _b.sent();
                    throw new Error("Failed to write lock file ".concat(lockFilePath, ": ").concat(error_3.message));
                case 13: return [2 /*return*/];
            }
        });
    });
}
/**
 * Remove lock file
 */
function removeLockFile(lockFilePath) {
    return __awaiter(this, void 0, void 0, function () {
        var error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, promises_1.unlink)(lockFilePath)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _a.sent();
                    if (error_4.code !== 'ENOENT') {
                        throw new Error("Failed to remove lock file ".concat(lockFilePath, ": ").concat(error_4.message));
                    }
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Clean up stale locks (expired or from dead processes)
 */
function cleanupStaleLocks(lockFilePath) {
    return __awaiter(this, void 0, void 0, function () {
        var existingLock, isExpired, isProcessDead;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, readLockFile(lockFilePath)];
                case 1:
                    existingLock = _a.sent();
                    if (!existingLock) {
                        return [2 /*return*/]; // No lock file exists
                    }
                    isExpired = isLockExpired(existingLock);
                    isProcessDead = !isProcessRunning(existingLock.pid);
                    if (!(isExpired || isProcessDead)) return [3 /*break*/, 3];
                    return [4 /*yield*/, removeLockFile(lockFilePath)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
