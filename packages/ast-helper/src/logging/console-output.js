"use strict";
/**
 * Console log output implementation
 * Provides human-readable console output with colors and formatting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleOutput = void 0;
var types_js_1 = require("./types.js");
var ConsoleOutput = /** @class */ (function () {
    function ConsoleOutput(options) {
        if (options === void 0) { options = {}; }
        var _a, _b;
        this.useColors = (_a = options.useColors) !== null && _a !== void 0 ? _a : true;
        this.includeTimestamp = (_b = options.includeTimestamp) !== null && _b !== void 0 ? _b : true;
    }
    ConsoleOutput.prototype.write = function (entry) {
        var parts = [];
        // Timestamp
        if (this.includeTimestamp) {
            var timestamp = new Date(entry.timestamp).toISOString();
            parts.push(this.colorize("[".concat(timestamp, "]"), 'gray'));
        }
        // Level indicator with color
        var levelIndicator = this.getLevelIndicator(entry.level);
        parts.push(this.colorize(levelIndicator, this.getLevelColor(entry.level)));
        // Operation context
        if (entry.operation) {
            parts.push(this.colorize("(".concat(entry.operation, ")"), 'blue'));
        }
        // Main message
        parts.push(entry.message);
        // Duration for performance logs
        if (entry.duration !== undefined) {
            var durationMs = Math.round(entry.duration);
            var color = durationMs > 1000 ? 'red' : durationMs > 500 ? 'yellow' : 'green';
            parts.push(this.colorize("+".concat(durationMs, "ms"), color));
        }
        console.log(parts.join(' '));
        // Context on separate line if present
        if (entry.context && Object.keys(entry.context).length > 0) {
            var contextStr = JSON.stringify(entry.context, null, 2)
                .split('\n')
                .map(function (line) { return "  ".concat(line); })
                .join('\n');
            console.log(this.colorize(contextStr, 'gray'));
        }
        // Error details on separate line if present
        if (entry.error) {
            console.log(this.colorize("  Error: ".concat(entry.error.message), 'red'));
            if (entry.error.code) {
                console.log(this.colorize("  Code: ".concat(entry.error.code), 'red'));
            }
            if (entry.error.stack && entry.level <= types_js_1.LogLevel.DEBUG) {
                var stackLines = entry.error.stack.split('\n').slice(1, 6); // First 5 stack frames
                for (var _i = 0, stackLines_1 = stackLines; _i < stackLines_1.length; _i++) {
                    var line = stackLines_1[_i];
                    console.log(this.colorize("    ".concat(line.trim()), 'gray'));
                }
            }
        }
    };
    ConsoleOutput.prototype.getLevelIndicator = function (level) {
        switch (level) {
            case types_js_1.LogLevel.ERROR: return '❌ ERROR';
            case types_js_1.LogLevel.WARN: return '⚠️  WARN ';
            case types_js_1.LogLevel.INFO: return 'ℹ️  INFO ';
            case types_js_1.LogLevel.DEBUG: return '🐛 DEBUG';
            case types_js_1.LogLevel.TRACE: return '🔍 TRACE';
            default: return '   UNKNOWN';
        }
    };
    ConsoleOutput.prototype.getLevelColor = function (level) {
        switch (level) {
            case types_js_1.LogLevel.ERROR: return 'red';
            case types_js_1.LogLevel.WARN: return 'yellow';
            case types_js_1.LogLevel.INFO: return 'cyan';
            case types_js_1.LogLevel.DEBUG: return 'magenta';
            case types_js_1.LogLevel.TRACE: return 'gray';
            default: return 'white';
        }
    };
    ConsoleOutput.prototype.colorize = function (text, color) {
        if (!this.useColors)
            return text;
        var colors = {
            red: '\x1b[31m',
            yellow: '\x1b[33m',
            green: '\x1b[32m',
            cyan: '\x1b[36m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            gray: '\x1b[90m',
            white: '\x1b[37m',
            reset: '\x1b[0m'
        };
        return "".concat(colors[color] || colors.white).concat(text).concat(colors.reset);
    };
    return ConsoleOutput;
}());
exports.ConsoleOutput = ConsoleOutput;
