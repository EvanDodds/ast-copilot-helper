"use strict";
/**
 * File locking module index
 * Exports all locking-related functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupStaleLocks = exports.removeLockFile = exports.writeLockFile = exports.readLockFile = exports.isLockExpired = exports.isProcessRunning = exports.parseLockContent = exports.createLockContent = exports.generateLockId = exports.LockConflictError = exports.LockTimeoutError = exports.LockError = exports.LockManager = void 0;
var manager_js_1 = require("./manager.js");
Object.defineProperty(exports, "LockManager", { enumerable: true, get: function () { return manager_js_1.LockManager; } });
var types_js_1 = require("./types.js");
Object.defineProperty(exports, "LockError", { enumerable: true, get: function () { return types_js_1.LockError; } });
Object.defineProperty(exports, "LockTimeoutError", { enumerable: true, get: function () { return types_js_1.LockTimeoutError; } });
Object.defineProperty(exports, "LockConflictError", { enumerable: true, get: function () { return types_js_1.LockConflictError; } });
var utils_js_1 = require("./utils.js");
Object.defineProperty(exports, "generateLockId", { enumerable: true, get: function () { return utils_js_1.generateLockId; } });
Object.defineProperty(exports, "createLockContent", { enumerable: true, get: function () { return utils_js_1.createLockContent; } });
Object.defineProperty(exports, "parseLockContent", { enumerable: true, get: function () { return utils_js_1.parseLockContent; } });
Object.defineProperty(exports, "isProcessRunning", { enumerable: true, get: function () { return utils_js_1.isProcessRunning; } });
Object.defineProperty(exports, "isLockExpired", { enumerable: true, get: function () { return utils_js_1.isLockExpired; } });
Object.defineProperty(exports, "readLockFile", { enumerable: true, get: function () { return utils_js_1.readLockFile; } });
Object.defineProperty(exports, "writeLockFile", { enumerable: true, get: function () { return utils_js_1.writeLockFile; } });
Object.defineProperty(exports, "removeLockFile", { enumerable: true, get: function () { return utils_js_1.removeLockFile; } });
Object.defineProperty(exports, "cleanupStaleLocks", { enumerable: true, get: function () { return utils_js_1.cleanupStaleLocks; } });
