"use strict";
/**
 * Lock Manager for coordinating concurrent access to .astdb directory
 * Provides exclusive locks for write operations and shared locks for read operations
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
exports.LockManager = void 0;
var node_path_1 = require("node:path");
var types_js_1 = require("./types.js");
var utils_js_1 = require("./utils.js");
var LockManager = /** @class */ (function () {
    function LockManager(workspacePath, options) {
        if (options === void 0) { options = {}; }
        var _a, _b, _c;
        this.activeLocks = new Map();
        this.lockFilePath = (0, node_path_1.join)(workspacePath, '.astdb', '.lock');
        this.defaultOptions = {
            timeoutMs: (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : 30000,
            maxRetries: (_b = options.maxRetries) !== null && _b !== void 0 ? _b : 10,
            retryDelayMs: (_c = options.retryDelayMs) !== null && _c !== void 0 ? _c : 100
        };
    }
    /**
     * Acquire an exclusive lock for write operations
     * Only one exclusive lock can be held at a time
     */
    LockManager.prototype.acquireExclusiveLock = function (operation_1) {
        return __awaiter(this, arguments, void 0, function (operation, options) {
            var mergedOptions, attempt, existingLock, lock, error_1;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mergedOptions = __assign(__assign({}, this.defaultOptions), options);
                        attempt = 0;
                        _a.label = 1;
                    case 1:
                        if (!(attempt < mergedOptions.maxRetries)) return [3 /*break*/, 13];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 9, , 12]);
                        // Clean up stale locks first
                        return [4 /*yield*/, (0, utils_js_1.cleanupStaleLocks)(this.lockFilePath)];
                    case 3:
                        // Clean up stale locks first
                        _a.sent();
                        return [4 /*yield*/, (0, utils_js_1.readLockFile)(this.lockFilePath)];
                    case 4:
                        existingLock = _a.sent();
                        if (!existingLock) return [3 /*break*/, 7];
                        if (!((0, utils_js_1.isLockExpired)(existingLock) || !(0, utils_js_1.isProcessRunning)(existingLock.pid))) return [3 /*break*/, 6];
                        return [4 /*yield*/, (0, utils_js_1.removeLockFile)(this.lockFilePath)];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 6: 
                    // Active lock exists - cannot acquire exclusive lock
                    throw new types_js_1.LockConflictError(operation, existingLock);
                    case 7: return [4 /*yield*/, (0, utils_js_1.writeLockFile)(this.lockFilePath, {
                            type: 'exclusive',
                            operation: operation,
                            acquiredAt: new Date(),
                            timeoutMs: mergedOptions.timeoutMs,
                            pid: process.pid
                        })];
                    case 8:
                        lock = _a.sent();
                        this.activeLocks.set(lock.id, lock);
                        return [2 /*return*/, lock];
                    case 9:
                        error_1 = _a.sent();
                        if (!(error_1 instanceof types_js_1.LockConflictError && attempt < mergedOptions.maxRetries - 1)) return [3 /*break*/, 11];
                        // Wait and retry
                        return [4 /*yield*/, (0, utils_js_1.sleep)(mergedOptions.retryDelayMs)];
                    case 10:
                        // Wait and retry
                        _a.sent();
                        return [3 /*break*/, 12];
                    case 11:
                        // If we've exhausted retries, throw timeout error
                        if (attempt === mergedOptions.maxRetries - 1) {
                            throw new types_js_1.LockTimeoutError(operation, mergedOptions.timeoutMs);
                        }
                        throw error_1;
                    case 12:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 13: throw new types_js_1.LockTimeoutError(operation, mergedOptions.timeoutMs);
                }
            });
        });
    };
    /**
     * Acquire a shared lock for read operations
     * Multiple shared locks can be held simultaneously
     * Shared locks cannot coexist with exclusive locks
     */
    LockManager.prototype.acquireSharedLock = function (operation_1) {
        return __awaiter(this, arguments, void 0, function (operation, options) {
            var mergedOptions, attempt, existingLock, lock, error_2;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mergedOptions = __assign(__assign({}, this.defaultOptions), options);
                        attempt = 0;
                        _a.label = 1;
                    case 1:
                        if (!(attempt < mergedOptions.maxRetries)) return [3 /*break*/, 13];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 9, , 12]);
                        // Clean up stale locks first
                        return [4 /*yield*/, (0, utils_js_1.cleanupStaleLocks)(this.lockFilePath)];
                    case 3:
                        // Clean up stale locks first
                        _a.sent();
                        return [4 /*yield*/, (0, utils_js_1.readLockFile)(this.lockFilePath)];
                    case 4:
                        existingLock = _a.sent();
                        if (!existingLock) return [3 /*break*/, 7];
                        if (!((0, utils_js_1.isLockExpired)(existingLock) || !(0, utils_js_1.isProcessRunning)(existingLock.pid))) return [3 /*break*/, 6];
                        return [4 /*yield*/, (0, utils_js_1.removeLockFile)(this.lockFilePath)];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        if (existingLock.type === 'exclusive') {
                            // Exclusive lock exists - cannot acquire shared lock
                            throw new types_js_1.LockConflictError(operation, existingLock);
                        }
                        _a.label = 7;
                    case 7: return [4 /*yield*/, (0, utils_js_1.writeLockFile)(this.lockFilePath, {
                            type: 'shared',
                            operation: operation,
                            acquiredAt: new Date(),
                            timeoutMs: mergedOptions.timeoutMs,
                            pid: process.pid
                        })];
                    case 8:
                        lock = _a.sent();
                        this.activeLocks.set(lock.id, lock);
                        return [2 /*return*/, lock];
                    case 9:
                        error_2 = _a.sent();
                        if (!(error_2 instanceof types_js_1.LockConflictError && attempt < mergedOptions.maxRetries - 1)) return [3 /*break*/, 11];
                        // Wait and retry
                        return [4 /*yield*/, (0, utils_js_1.sleep)(mergedOptions.retryDelayMs)];
                    case 10:
                        // Wait and retry
                        _a.sent();
                        return [3 /*break*/, 12];
                    case 11:
                        // If we've exhausted retries, throw timeout error
                        if (attempt === mergedOptions.maxRetries - 1) {
                            throw new types_js_1.LockTimeoutError(operation, mergedOptions.timeoutMs);
                        }
                        throw error_2;
                    case 12:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 13: throw new types_js_1.LockTimeoutError(operation, mergedOptions.timeoutMs);
                }
            });
        });
    };
    /**
     * Release a lock
     */
    LockManager.prototype.releaseLock = function (lock) {
        return __awaiter(this, void 0, void 0, function () {
            var currentLock, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        // Verify the lock belongs to this process
                        if (lock.pid !== process.pid) {
                            throw new types_js_1.LockError("Cannot release lock owned by different process (PID: ".concat(lock.pid, ")"), 'INVALID_OWNER');
                        }
                        // Check if we have this lock active
                        if (!this.activeLocks.has(lock.id)) {
                            throw new types_js_1.LockError("Lock ".concat(lock.id, " is not active in this manager"), 'LOCK_NOT_ACTIVE');
                        }
                        return [4 /*yield*/, (0, utils_js_1.readLockFile)(this.lockFilePath)];
                    case 1:
                        currentLock = _a.sent();
                        if (!(currentLock && currentLock.id === lock.id)) return [3 /*break*/, 3];
                        return [4 /*yield*/, (0, utils_js_1.removeLockFile)(this.lockFilePath)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        // Remove from active locks
                        this.activeLocks.delete(lock.id);
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _a.sent();
                        throw new types_js_1.LockError("Failed to release lock: ".concat(error_3.message), 'RELEASE_FAILED');
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all active locks managed by this instance
     */
    LockManager.prototype.getActiveLocks = function () {
        return Array.from(this.activeLocks.values());
    };
    /**
     * Clean up all active locks on process exit
     */
    LockManager.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            var locks, _i, locks_1, lock, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        locks = Array.from(this.activeLocks.values());
                        _i = 0, locks_1 = locks;
                        _a.label = 1;
                    case 1:
                        if (!(_i < locks_1.length)) return [3 /*break*/, 6];
                        lock = locks_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.releaseLock(lock)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_4 = _a.sent();
                        // Log error but continue cleanup
                        console.error("Failed to release lock ".concat(lock.id, ": ").concat(error_4.message));
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return LockManager;
}());
exports.LockManager = LockManager;
