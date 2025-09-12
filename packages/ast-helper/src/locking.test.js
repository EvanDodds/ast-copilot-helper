"use strict";
/**
 * Tests for file locking system
 * Covers lock acquisition, release, conflict detection, and timeout handling
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
var vitest_1 = require("vitest");
var node_path_1 = require("node:path");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var manager_js_1 = require("../src/locking/manager.js");
var types_js_1 = require("../src/locking/types.js");
var utils_js_1 = require("../src/locking/utils.js");
(0, vitest_1.describe)('File Locking System', function () {
    var testWorkspace;
    var lockManager;
    (0, vitest_1.beforeEach)(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Create unique test workspace
                    testWorkspace = (0, node_path_1.join)((0, node_os_1.tmpdir)(), "ast-test-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9)));
                    return [4 /*yield*/, (0, promises_1.mkdir)(testWorkspace, { recursive: true })];
                case 1:
                    _a.sent();
                    lockManager = new manager_js_1.LockManager(testWorkspace, {
                        timeoutMs: 5000,
                        maxRetries: 3,
                        retryDelayMs: 50
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.afterEach)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, lockManager.cleanup()];
                case 1:
                    _a.sent();
                    // Clean up test workspace
                    return [4 /*yield*/, (0, promises_1.rmdir)(testWorkspace, { recursive: true })];
                case 2:
                    // Clean up test workspace
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.describe)('Lock Utilities', function () {
        (0, vitest_1.it)('should generate unique lock IDs', function () {
            var id1 = (0, utils_js_1.generateLockId)();
            var id2 = (0, utils_js_1.generateLockId)();
            (0, vitest_1.expect)(id1).toMatch(/^[a-f0-9]{16}$/);
            (0, vitest_1.expect)(id2).toMatch(/^[a-f0-9]{16}$/);
            (0, vitest_1.expect)(id1).not.toBe(id2);
        });
        (0, vitest_1.it)('should create and parse lock content', function () {
            var lock = {
                type: 'exclusive',
                filePath: '/test/.astdb/.lock',
                operation: 'test-operation',
                acquiredAt: new Date(),
                timeoutMs: 30000,
                pid: process.pid
            };
            var content = (0, utils_js_1.createLockContent)(lock);
            var jsonParsed = JSON.parse(content);
            (0, vitest_1.expect)(jsonParsed.type).toBe('exclusive');
            (0, vitest_1.expect)(jsonParsed.operation).toBe('test-operation');
            var parsed = (0, utils_js_1.parseLockContent)(content);
            (0, vitest_1.expect)(parsed.type).toBe('exclusive');
            (0, vitest_1.expect)(parsed.operation).toBe('test-operation');
            (0, vitest_1.expect)(parsed.pid).toBe(process.pid);
        });
        (0, vitest_1.it)('should check if current process is running', function () {
            var isRunning = (0, utils_js_1.isProcessRunning)(process.pid);
            (0, vitest_1.expect)(isRunning).toBe(true);
        });
        (0, vitest_1.it)('should detect non-existent process', function () {
            // Use a PID that's very unlikely to exist
            var isRunning = (0, utils_js_1.isProcessRunning)(999999);
            (0, vitest_1.expect)(isRunning).toBe(false);
        });
        (0, vitest_1.it)('should detect expired locks', function () {
            var expiredLock = {
                id: 'test-lock',
                type: 'exclusive',
                filePath: '/test/.astdb/.lock',
                operation: 'test',
                acquiredAt: new Date(Date.now() - 60000), // 1 minute ago
                timeoutMs: 30000, // 30 seconds timeout
                pid: process.pid
            };
            (0, vitest_1.expect)((0, utils_js_1.isLockExpired)(expiredLock)).toBe(true);
        });
        (0, vitest_1.it)('should detect non-expired locks', function () {
            var activeLock = {
                id: 'test-lock',
                type: 'exclusive',
                filePath: '/test/.astdb/.lock',
                operation: 'test',
                acquiredAt: new Date(), // Just acquired
                timeoutMs: 30000, // 30 seconds timeout
                pid: process.pid
            };
            (0, vitest_1.expect)((0, utils_js_1.isLockExpired)(activeLock)).toBe(false);
        });
    });
    (0, vitest_1.describe)('Lock File Operations', function () {
        (0, vitest_1.it)('should write and read lock files', function () { return __awaiter(void 0, void 0, void 0, function () {
            var lockFilePath, lockData, writtenLock, readLock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lockFilePath = (0, node_path_1.join)(testWorkspace, '.astdb', '.lock');
                        lockData = {
                            type: 'exclusive',
                            operation: 'test-write',
                            acquiredAt: new Date(),
                            timeoutMs: 30000,
                            pid: process.pid
                        };
                        return [4 /*yield*/, (0, utils_js_1.writeLockFile)(lockFilePath, lockData)];
                    case 1:
                        writtenLock = _a.sent();
                        (0, vitest_1.expect)(writtenLock.id).toBeDefined();
                        (0, vitest_1.expect)(writtenLock.type).toBe('exclusive');
                        (0, vitest_1.expect)(writtenLock.operation).toBe('test-write');
                        return [4 /*yield*/, (0, utils_js_1.readLockFile)(lockFilePath)];
                    case 2:
                        readLock = _a.sent();
                        (0, vitest_1.expect)(readLock).not.toBeNull();
                        (0, vitest_1.expect)(readLock.id).toBe(writtenLock.id);
                        (0, vitest_1.expect)(readLock.operation).toBe('test-write');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should return null when reading non-existent lock file', function () { return __awaiter(void 0, void 0, void 0, function () {
            var lockFilePath, lock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lockFilePath = (0, node_path_1.join)(testWorkspace, '.astdb', '.lock');
                        return [4 /*yield*/, (0, utils_js_1.readLockFile)(lockFilePath)];
                    case 1:
                        lock = _a.sent();
                        (0, vitest_1.expect)(lock).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should remove lock files', function () { return __awaiter(void 0, void 0, void 0, function () {
            var lockFilePath, lockData, lock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lockFilePath = (0, node_path_1.join)(testWorkspace, '.astdb', '.lock');
                        lockData = {
                            type: 'exclusive',
                            operation: 'test-remove',
                            acquiredAt: new Date(),
                            timeoutMs: 30000,
                            pid: process.pid
                        };
                        return [4 /*yield*/, (0, utils_js_1.writeLockFile)(lockFilePath, lockData)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, utils_js_1.removeLockFile)(lockFilePath)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, utils_js_1.readLockFile)(lockFilePath)];
                    case 3:
                        lock = _a.sent();
                        (0, vitest_1.expect)(lock).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('LockManager - Exclusive Locks', function () {
        (0, vitest_1.it)('should acquire exclusive lock successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
            var lock, activeLocks;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, lockManager.acquireExclusiveLock('test-operation')];
                    case 1:
                        lock = _a.sent();
                        (0, vitest_1.expect)(lock).toBeDefined();
                        (0, vitest_1.expect)(lock.type).toBe('exclusive');
                        (0, vitest_1.expect)(lock.operation).toBe('test-operation');
                        (0, vitest_1.expect)(lock.pid).toBe(process.pid);
                        activeLocks = lockManager.getActiveLocks();
                        (0, vitest_1.expect)(activeLocks).toHaveLength(1);
                        (0, vitest_1.expect)(activeLocks[0].id).toBe(lock.id);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should release exclusive lock successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
            var lock, activeLocks, lock2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, lockManager.acquireExclusiveLock('test-operation')];
                    case 1:
                        lock = _a.sent();
                        return [4 /*yield*/, lockManager.releaseLock(lock)];
                    case 2:
                        _a.sent();
                        activeLocks = lockManager.getActiveLocks();
                        (0, vitest_1.expect)(activeLocks).toHaveLength(0);
                        return [4 /*yield*/, lockManager.acquireExclusiveLock('test-operation-2')];
                    case 3:
                        lock2 = _a.sent();
                        (0, vitest_1.expect)(lock2).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should prevent multiple exclusive locks', function () { return __awaiter(void 0, void 0, void 0, function () {
            var lock1, lockManager2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, lockManager.acquireExclusiveLock('test-operation-1')];
                    case 1:
                        lock1 = _a.sent();
                        (0, vitest_1.expect)(lock1).toBeDefined();
                        lockManager2 = new manager_js_1.LockManager(testWorkspace, { timeoutMs: 1000, maxRetries: 2 });
                        return [4 /*yield*/, (0, vitest_1.expect)(lockManager2.acquireExclusiveLock('test-operation-2'))
                                .rejects.toThrow(types_js_1.LockTimeoutError)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('LockManager - Shared Locks', function () {
        (0, vitest_1.it)('should acquire shared lock successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
            var lock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, lockManager.acquireSharedLock('test-read-operation')];
                    case 1:
                        lock = _a.sent();
                        (0, vitest_1.expect)(lock).toBeDefined();
                        (0, vitest_1.expect)(lock.type).toBe('shared');
                        (0, vitest_1.expect)(lock.operation).toBe('test-read-operation');
                        (0, vitest_1.expect)(lock.pid).toBe(process.pid);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should allow multiple shared locks', function () { return __awaiter(void 0, void 0, void 0, function () {
            var lock1, lockManager2, lock2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, lockManager.acquireSharedLock('test-read-1')];
                    case 1:
                        lock1 = _a.sent();
                        (0, vitest_1.expect)(lock1).toBeDefined();
                        lockManager2 = new manager_js_1.LockManager(testWorkspace);
                        return [4 /*yield*/, lockManager2.acquireSharedLock('test-read-2')];
                    case 2:
                        lock2 = _a.sent();
                        (0, vitest_1.expect)(lock2).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should prevent shared lock when exclusive lock exists', function () { return __awaiter(void 0, void 0, void 0, function () {
            var exclusiveLock, lockManager2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, lockManager.acquireExclusiveLock('test-write')];
                    case 1:
                        exclusiveLock = _a.sent();
                        (0, vitest_1.expect)(exclusiveLock).toBeDefined();
                        lockManager2 = new manager_js_1.LockManager(testWorkspace, { timeoutMs: 1000, maxRetries: 2 });
                        return [4 /*yield*/, (0, vitest_1.expect)(lockManager2.acquireSharedLock('test-read'))
                                .rejects.toThrow(types_js_1.LockTimeoutError)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, vitest_1.describe)('Lock Cleanup and Error Handling', function () {
        (0, vitest_1.it)('should clean up stale locks from dead processes', function () { return __awaiter(void 0, void 0, void 0, function () {
            var lockFilePath, staleLock, newLock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lockFilePath = (0, node_path_1.join)(testWorkspace, '.astdb', '.lock');
                        staleLock = {
                            type: 'exclusive',
                            operation: 'stale-operation',
                            acquiredAt: new Date(),
                            timeoutMs: 30000,
                            pid: 999999 // Fake PID
                        };
                        return [4 /*yield*/, (0, utils_js_1.writeLockFile)(lockFilePath, staleLock)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, lockManager.acquireExclusiveLock('new-operation')];
                    case 2:
                        newLock = _a.sent();
                        (0, vitest_1.expect)(newLock).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should clean up expired locks', function () { return __awaiter(void 0, void 0, void 0, function () {
            var lockFilePath, expiredLock, newLock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        lockFilePath = (0, node_path_1.join)(testWorkspace, '.astdb', '.lock');
                        expiredLock = {
                            type: 'exclusive',
                            operation: 'expired-operation',
                            acquiredAt: new Date(Date.now() - 60000), // 1 minute ago
                            timeoutMs: 30000, // 30 seconds timeout (expired)
                            pid: process.pid
                        };
                        return [4 /*yield*/, (0, utils_js_1.writeLockFile)(lockFilePath, expiredLock)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, lockManager.acquireExclusiveLock('new-operation')];
                    case 2:
                        newLock = _a.sent();
                        (0, vitest_1.expect)(newLock).toBeDefined();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should handle lock file directory creation', function () { return __awaiter(void 0, void 0, void 0, function () {
            var newWorkspace, newLockManager, lock, lockDir;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        newWorkspace = (0, node_path_1.join)(testWorkspace, 'deep', 'nested', 'path');
                        newLockManager = new manager_js_1.LockManager(newWorkspace);
                        return [4 /*yield*/, newLockManager.acquireExclusiveLock('test-deep-path')];
                    case 1:
                        lock = _a.sent();
                        (0, vitest_1.expect)(lock).toBeDefined();
                        lockDir = (0, node_path_1.join)(newWorkspace, '.astdb');
                        return [4 /*yield*/, (0, vitest_1.expect)((0, promises_1.stat)(lockDir)).resolves.toBeDefined()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, vitest_1.it)('should cleanup all locks on manager cleanup', function () { return __awaiter(void 0, void 0, void 0, function () {
            var lock1, lock2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, lockManager.acquireExclusiveLock('test-1')];
                    case 1:
                        lock1 = _a.sent();
                        return [4 /*yield*/, lockManager.releaseLock(lock1)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, lockManager.acquireSharedLock('test-2')];
                    case 3:
                        lock2 = _a.sent();
                        (0, vitest_1.expect)(lockManager.getActiveLocks()).toHaveLength(1);
                        return [4 /*yield*/, lockManager.cleanup()];
                    case 4:
                        _a.sent();
                        (0, vitest_1.expect)(lockManager.getActiveLocks()).toHaveLength(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
