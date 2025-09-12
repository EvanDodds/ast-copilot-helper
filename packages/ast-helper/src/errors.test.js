"use strict";
/**
 * Tests for error handling framework
 * Covers error types, formatting, and factory functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var index_js_1 = require("../src/errors/index.js");
(0, vitest_1.describe)('Error Handling Framework', function () {
    (0, vitest_1.describe)('Base AstError Class', function () {
        (0, vitest_1.it)('should create error with basic properties', function () {
            var error = new index_js_1.ConfigurationError('Test error message');
            (0, vitest_1.expect)(error).toBeInstanceOf(Error);
            (0, vitest_1.expect)(error).toBeInstanceOf(index_js_1.AstError);
            (0, vitest_1.expect)(error).toBeInstanceOf(index_js_1.ConfigurationError);
            (0, vitest_1.expect)(error.name).toBe('ConfigurationError');
            (0, vitest_1.expect)(error.message).toBe('Test error message');
            (0, vitest_1.expect)(error.code).toBe('CONFIGURATION_ERROR');
            (0, vitest_1.expect)(error.context).toEqual({});
            (0, vitest_1.expect)(error.suggestions).toEqual([]);
        });
        (0, vitest_1.it)('should create error with context and suggestions', function () {
            var context = { key: 'topK', value: 'invalid' };
            var suggestions = ['Use a number between 1 and 100', 'Check the configuration file'];
            var error = new index_js_1.ValidationError('Invalid topK value', context, suggestions);
            (0, vitest_1.expect)(error.context).toEqual(context);
            (0, vitest_1.expect)(error.suggestions).toEqual(suggestions);
            (0, vitest_1.expect)(error.code).toBe('VALIDATION_ERROR');
        });
        (0, vitest_1.it)('should create error with cause chain', function () {
            var cause = new Error('Original error');
            var error = new index_js_1.FileSystemError('File operation failed', { path: '/test/path' }, ['Check file permissions'], cause);
            (0, vitest_1.expect)(error.errorCause).toBe(cause);
            (0, vitest_1.expect)(error.context.path).toBe('/test/path');
        });
        (0, vitest_1.it)('should serialize to JSON correctly', function () {
            var _a, _b;
            var cause = new Error('Original error');
            var error = new index_js_1.ConfigurationError('Config error', { setting: 'timeout' }, ['Increase timeout value'], cause);
            var json = error.toJSON();
            (0, vitest_1.expect)(json.name).toBe('ConfigurationError');
            (0, vitest_1.expect)(json.message).toBe('Config error');
            (0, vitest_1.expect)(json.code).toBe('CONFIGURATION_ERROR');
            (0, vitest_1.expect)(json.context).toEqual({ setting: 'timeout' });
            (0, vitest_1.expect)(json.suggestions).toEqual(['Increase timeout value']);
            (0, vitest_1.expect)(json.cause).toBeDefined();
            (0, vitest_1.expect)((_a = json.cause) === null || _a === void 0 ? void 0 : _a.name).toBe('Error');
            (0, vitest_1.expect)((_b = json.cause) === null || _b === void 0 ? void 0 : _b.message).toBe('Original error');
            (0, vitest_1.expect)(json.stack).toBeDefined();
        });
    });
    (0, vitest_1.describe)('Error Formatter', function () {
        var formatter;
        (0, vitest_1.beforeEach)(function () {
            formatter = new index_js_1.ErrorFormatter();
        });
        (0, vitest_1.it)('should format basic error for users', function () {
            var error = new index_js_1.ConfigurationError('Invalid configuration value');
            var formatted = formatter.formatForUser(error);
            (0, vitest_1.expect)(formatted).toContain('❌ Error: Invalid configuration value');
            (0, vitest_1.expect)(formatted).toContain('Code: CONFIGURATION_ERROR');
        });
        (0, vitest_1.it)('should format error with context for users', function () {
            var error = new index_js_1.ValidationError('Value out of range', { value: 150, min: 1, max: 100 }, ['Use a value between 1 and 100']);
            var formatted = formatter.formatForUser(error);
            (0, vitest_1.expect)(formatted).toContain('📍 Context:');
            (0, vitest_1.expect)(formatted).toContain('value: 150');
            (0, vitest_1.expect)(formatted).toContain('min: 1');
            (0, vitest_1.expect)(formatted).toContain('max: 100');
            (0, vitest_1.expect)(formatted).toContain('💡 Suggestions:');
            (0, vitest_1.expect)(formatted).toContain('• Use a value between 1 and 100');
        });
        (0, vitest_1.it)('should format error with cause for users', function () {
            var cause = new Error('File not found');
            var error = new index_js_1.FileSystemError('Cannot read configuration', { path: '/config.json' }, ['Check if file exists'], cause);
            var formatted = formatter.formatForUser(error);
            (0, vitest_1.expect)(formatted).toContain('🔗 Caused by: File not found');
        });
        (0, vitest_1.it)('should format error for debugging', function () {
            var error = new index_js_1.DatabaseError('Database corruption', { dbPath: '/data/ast.db', version: '1.0' });
            var formatted = formatter.formatForDebug(error);
            (0, vitest_1.expect)(formatted).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
            (0, vitest_1.expect)(formatted).toContain('DatabaseError: Database corruption');
            (0, vitest_1.expect)(formatted).toContain('Code: DATABASE_ERROR');
            (0, vitest_1.expect)(formatted).toContain('Context:');
            (0, vitest_1.expect)(formatted).toContain('"dbPath": "/data/ast.db"');
            (0, vitest_1.expect)(formatted).toContain('Stack trace:');
        });
        (0, vitest_1.it)('should format error for logging', function () {
            var error = new index_js_1.NetworkError('Connection timeout', { url: 'https://api.example.com', timeout: 5000 }, ['Check internet connection']);
            var logEntry = formatter.formatForLogging(error);
            (0, vitest_1.expect)(logEntry.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
            (0, vitest_1.expect)(logEntry.level).toBe('error');
            (0, vitest_1.expect)(logEntry.name).toBe('NetworkError');
            (0, vitest_1.expect)(logEntry.message).toBe('Connection timeout');
            (0, vitest_1.expect)(logEntry.code).toBe('NETWORK_ERROR');
            (0, vitest_1.expect)(logEntry.context).toEqual({ url: 'https://api.example.com', timeout: 5000 });
            (0, vitest_1.expect)(logEntry.suggestions).toEqual(['Check internet connection']);
            (0, vitest_1.expect)(logEntry.stack).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(logEntry.stack)).toBe(true);
        });
        (0, vitest_1.it)('should create brief error summary', function () {
            var error = new index_js_1.TimeoutError('Operation timed out');
            var summary = formatter.createSummary(error);
            (0, vitest_1.expect)(summary).toBe('TIMEOUT_ERROR: Operation timed out');
        });
        (0, vitest_1.it)('should handle regular errors', function () {
            var error = new Error('Regular error');
            var formatted = formatter.formatForUser(error);
            (0, vitest_1.expect)(formatted).toContain('❌ Error: Regular error');
            (0, vitest_1.expect)(formatted).not.toContain('Code:');
            (0, vitest_1.expect)(formatted).not.toContain('Context:');
            var summary = formatter.createSummary(error);
            (0, vitest_1.expect)(summary).toBe('Error: Regular error');
        });
        (0, vitest_1.it)('should format complex context values', function () {
            var error = new index_js_1.ValidationError('Complex validation error', {
                simpleValue: 'string',
                numberValue: 42,
                arrayValue: [1, 2, 3, 4, 5],
                objectValue: { a: 1, b: 2, c: 3 },
                nestedObject: {
                    deep: {
                        deeper: {
                            value: 'test'
                        }
                    }
                }
            });
            var formatted = formatter.formatForUser(error);
            (0, vitest_1.expect)(formatted).toContain('simpleValue: "string"');
            (0, vitest_1.expect)(formatted).toContain('numberValue: 42');
            (0, vitest_1.expect)(formatted).toContain('arrayValue: [5 items]');
            (0, vitest_1.expect)(formatted).toContain('objectValue: {3 properties}');
        });
    });
    (0, vitest_1.describe)('Error Factory Functions', function () {
        (0, vitest_1.describe)('ConfigurationErrors', function () {
            (0, vitest_1.it)('should create invalid value error', function () {
                var error = index_js_1.ConfigurationErrors.invalidValue('topK', 'invalid', 'number');
                (0, vitest_1.expect)(error).toBeInstanceOf(index_js_1.ConfigurationError);
                (0, vitest_1.expect)(error.message).toContain("Invalid configuration value for 'topK'");
                (0, vitest_1.expect)(error.context.key).toBe('topK');
                (0, vitest_1.expect)(error.context.value).toBe('invalid');
                (0, vitest_1.expect)(error.suggestions.length).toBeGreaterThan(0);
            });
            (0, vitest_1.it)('should create missing required error', function () {
                var error = index_js_1.ConfigurationErrors.missingRequired('apiKey', 'environment variables');
                (0, vitest_1.expect)(error.message).toContain("Missing required configuration: 'apiKey'");
                (0, vitest_1.expect)(error.context.key).toBe('apiKey');
                (0, vitest_1.expect)(error.context.source).toBe('environment variables');
            });
            (0, vitest_1.it)('should create file not accessible error', function () {
                var error = index_js_1.ConfigurationErrors.fileNotAccessible('/config.json', 'Permission denied');
                (0, vitest_1.expect)(error.message).toContain('Configuration file not accessible: /config.json');
                (0, vitest_1.expect)(error.context.filePath).toBe('/config.json');
                (0, vitest_1.expect)(error.context.reason).toBe('Permission denied');
            });
        });
        (0, vitest_1.describe)('FileSystemErrors', function () {
            (0, vitest_1.it)('should create not found error', function () {
                var error = index_js_1.FileSystemErrors.notFound('/missing/file.txt', 'read');
                (0, vitest_1.expect)(error).toBeInstanceOf(index_js_1.FileSystemError);
                (0, vitest_1.expect)(error.message).toContain('File or directory not found: /missing/file.txt');
                (0, vitest_1.expect)(error.context.path).toBe('/missing/file.txt');
                (0, vitest_1.expect)(error.context.operation).toBe('read');
            });
            (0, vitest_1.it)('should create permission denied error', function () {
                var error = index_js_1.FileSystemErrors.permissionDenied('/protected/file.txt', 'write');
                (0, vitest_1.expect)(error.message).toContain('Permission denied: cannot write /protected/file.txt');
                (0, vitest_1.expect)(error.suggestions.some(function (s) { return s.includes('file permissions'); })).toBe(true);
            });
            (0, vitest_1.it)('should create disk space exceeded error', function () {
                var error = index_js_1.FileSystemErrors.diskSpaceExceeded('/tmp', 1024 * 1024 * 100);
                (0, vitest_1.expect)(error.message).toContain('Insufficient disk space for operation at: /tmp');
                (0, vitest_1.expect)(error.context.requiredSpace).toBe(1024 * 1024 * 100);
                (0, vitest_1.expect)(error.suggestions.some(function (s) { return s.includes('100MB'); })).toBe(true);
            });
        });
        (0, vitest_1.describe)('ValidationErrors', function () {
            (0, vitest_1.it)('should create invalid format error', function () {
                var error = index_js_1.ValidationErrors.invalidFormat('invalid-json', 'JSON');
                (0, vitest_1.expect)(error).toBeInstanceOf(index_js_1.ValidationError);
                (0, vitest_1.expect)(error.message).toContain('Invalid input format: expected JSON');
                (0, vitest_1.expect)(error.context.expectedFormat).toBe('JSON');
            });
            (0, vitest_1.it)('should create out of range error', function () {
                var error = index_js_1.ValidationErrors.outOfRange(150, 1, 100, 'topK');
                (0, vitest_1.expect)(error.message).toContain('Value out of range for topK: 150 (must be between 1 and 100)');
                (0, vitest_1.expect)(error.context.value).toBe(150);
                (0, vitest_1.expect)(error.context.min).toBe(1);
                (0, vitest_1.expect)(error.context.max).toBe(100);
                (0, vitest_1.expect)(error.context.field).toBe('topK');
            });
        });
        (0, vitest_1.describe)('ParseErrors', function () {
            (0, vitest_1.it)('should create syntax error', function () {
                var error = index_js_1.ParseErrors.syntaxError('/src/file.ts', 42, 15, 'Missing semicolon');
                (0, vitest_1.expect)(error).toBeInstanceOf(index_js_1.ParseError);
                (0, vitest_1.expect)(error.message).toContain('Syntax error in /src/file.ts:42:15 - Missing semicolon');
                (0, vitest_1.expect)(error.context.filePath).toBe('/src/file.ts');
                (0, vitest_1.expect)(error.context.line).toBe(42);
                (0, vitest_1.expect)(error.context.column).toBe(15);
            });
            (0, vitest_1.it)('should create unsupported language error', function () {
                var error = index_js_1.ParseErrors.unsupportedLanguage('/src/file.rb', 'Ruby');
                (0, vitest_1.expect)(error.message).toContain('Unsupported language or file type: Ruby for /src/file.rb');
                (0, vitest_1.expect)(error.context.detectedType).toBe('Ruby');
            });
        });
        (0, vitest_1.describe)('DatabaseErrors', function () {
            (0, vitest_1.it)('should create corruption error', function () {
                var error = index_js_1.DatabaseErrors.corruption('/data/ast.db', 'Invalid magic number');
                (0, vitest_1.expect)(error).toBeInstanceOf(index_js_1.DatabaseError);
                (0, vitest_1.expect)(error.message).toContain('Database corruption detected in /data/ast.db: Invalid magic number');
                (0, vitest_1.expect)(error.context.dbPath).toBe('/data/ast.db');
                (0, vitest_1.expect)(error.context.details).toBe('Invalid magic number');
            });
            (0, vitest_1.it)('should create version mismatch error', function () {
                var error = index_js_1.DatabaseErrors.versionMismatch('1.0', '2.0', '/data/ast.db');
                (0, vitest_1.expect)(error.message).toContain('Database version mismatch: found 1.0, expected 2.0');
                (0, vitest_1.expect)(error.context.currentVersion).toBe('1.0');
                (0, vitest_1.expect)(error.context.expectedVersion).toBe('2.0');
            });
        });
        (0, vitest_1.describe)('NetworkErrors', function () {
            (0, vitest_1.it)('should create timeout error', function () {
                var error = index_js_1.NetworkErrors.timeout('https://api.example.com', 5000);
                (0, vitest_1.expect)(error).toBeInstanceOf(index_js_1.NetworkError);
                (0, vitest_1.expect)(error.message).toContain('Network timeout connecting to https://api.example.com after 5000ms');
                (0, vitest_1.expect)(error.context.url).toBe('https://api.example.com');
                (0, vitest_1.expect)(error.context.timeoutMs).toBe(5000);
            });
            (0, vitest_1.it)('should create service unavailable error', function () {
                var error = index_js_1.NetworkErrors.serviceUnavailable('API Service', 503);
                (0, vitest_1.expect)(error.message).toContain('Service unavailable: API Service (HTTP 503)');
                (0, vitest_1.expect)(error.context.statusCode).toBe(503);
            });
        });
        (0, vitest_1.describe)('TimeoutErrors', function () {
            (0, vitest_1.it)('should create operation timeout error', function () {
                var error = index_js_1.TimeoutErrors.operationTimeout('database query', 30000);
                (0, vitest_1.expect)(error).toBeInstanceOf(index_js_1.TimeoutError);
                (0, vitest_1.expect)(error.message).toContain('Operation timeout: database query exceeded 30000ms');
                (0, vitest_1.expect)(error.context.operation).toBe('database query');
                (0, vitest_1.expect)(error.context.timeoutMs).toBe(30000);
            });
        });
    });
});
