"use strict";
/**
 * File locking types and interfaces
 * Defines the contract for cross-platform file locking
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockConflictError = exports.LockTimeoutError = exports.LockError = void 0;
var LockError = /** @class */ (function (_super) {
    __extends(LockError, _super);
    function LockError(message, code) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.name = 'LockError';
        return _this;
    }
    return LockError;
}(Error));
exports.LockError = LockError;
var LockTimeoutError = /** @class */ (function (_super) {
    __extends(LockTimeoutError, _super);
    function LockTimeoutError(operation, timeoutMs) {
        return _super.call(this, "Lock timeout after ".concat(timeoutMs, "ms for operation: ").concat(operation), 'LOCK_TIMEOUT') || this;
    }
    return LockTimeoutError;
}(LockError));
exports.LockTimeoutError = LockTimeoutError;
var LockConflictError = /** @class */ (function (_super) {
    __extends(LockConflictError, _super);
    function LockConflictError(operation, existingLock) {
        return _super.call(this, "Lock conflict for operation '".concat(operation, "'. ") +
            "Existing ".concat(existingLock.type, " lock held by PID ").concat(existingLock.pid, " ") +
            "for operation '".concat(existingLock.operation, "' since ").concat(existingLock.acquiredAt.toISOString()), 'LOCK_CONFLICT') || this;
    }
    return LockConflictError;
}(LockError));
exports.LockConflictError = LockConflictError;
