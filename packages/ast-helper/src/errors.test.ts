/**
 * Tests for error handling framework
 * Covers error types, formatting, and factory functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AstError,
  ConfigurationError,
  FileSystemError,
  ValidationError,
  ParseError,
  DatabaseError,
  NetworkError,
  PermissionError,
  TimeoutError,
  ErrorFormatter,
  ConfigurationErrors,
  FileSystemErrors,
  ValidationErrors,
  ParseErrors,
  DatabaseErrors,
  NetworkErrors,
  TimeoutErrors
} from '../src/errors/index.js';

describe('Error Handling Framework', () => {
  describe('Base AstError Class', () => {
    it('should create error with basic properties', () => {
      const error = new ConfigurationError('Test error message');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AstError);
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.context).toEqual({});
      expect(error.suggestions).toEqual([]);
    });

    it('should create error with context and suggestions', () => {
      const context = { key: 'topK', value: 'invalid' };
      const suggestions = ['Use a number between 1 and 100', 'Check the configuration file'];
      
      const error = new ValidationError(
        'Invalid topK value',
        context,
        suggestions
      );
      
      expect(error.context).toEqual(context);
      expect(error.suggestions).toEqual(suggestions);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should create error with cause chain', () => {
      const cause = new Error('Original error');
      const error = new FileSystemError(
        'File operation failed',
        { path: '/test/path' },
        ['Check file permissions'],
        cause
      );
      
      expect(error.errorCause).toBe(cause);
      expect(error.context.path).toBe('/test/path');
    });

    it('should serialize to JSON correctly', () => {
      const cause = new Error('Original error');
      const error = new ConfigurationError(
        'Config error',
        { setting: 'timeout' },
        ['Increase timeout value'],
        cause
      );
      
      const json = error.toJSON();
      
      expect(json.name).toBe('ConfigurationError');
      expect(json.message).toBe('Config error');
      expect(json.code).toBe('CONFIGURATION_ERROR');
      expect(json.context).toEqual({ setting: 'timeout' });
      expect(json.suggestions).toEqual(['Increase timeout value']);
      expect(json.cause).toBeDefined();
      expect(json.cause?.name).toBe('Error');
      expect(json.cause?.message).toBe('Original error');
      expect(json.stack).toBeDefined();
    });
  });

  describe('Error Formatter', () => {
    let formatter: ErrorFormatter;

    beforeEach(() => {
      formatter = new ErrorFormatter();
    });

    it('should format basic error for users', () => {
      const error = new ConfigurationError('Invalid configuration value');
      const formatted = formatter.formatForUser(error);
      
      expect(formatted).toContain('❌ Error: Invalid configuration value');
      expect(formatted).toContain('Code: CONFIGURATION_ERROR');
    });

    it('should format error with context for users', () => {
      const error = new ValidationError(
        'Value out of range',
        { value: 150, min: 1, max: 100 },
        ['Use a value between 1 and 100']
      );
      
      const formatted = formatter.formatForUser(error);
      
      expect(formatted).toContain('📍 Context:');
      expect(formatted).toContain('value: 150');
      expect(formatted).toContain('min: 1');
      expect(formatted).toContain('max: 100');
      expect(formatted).toContain('💡 Suggestions:');
      expect(formatted).toContain('• Use a value between 1 and 100');
    });

    it('should format error with cause for users', () => {
      const cause = new Error('File not found');
      const error = new FileSystemError(
        'Cannot read configuration',
        { path: '/config.json' },
        ['Check if file exists'],
        cause
      );
      
      const formatted = formatter.formatForUser(error);
      
      expect(formatted).toContain('🔗 Caused by: File not found');
    });

    it('should format error for debugging', () => {
      const error = new DatabaseError(
        'Database corruption',
        { dbPath: '/data/ast.db', version: '1.0' }
      );
      
      const formatted = formatter.formatForDebug(error);
      
      expect(formatted).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      expect(formatted).toContain('DatabaseError: Database corruption');
      expect(formatted).toContain('Code: DATABASE_ERROR');
      expect(formatted).toContain('Context:');
      expect(formatted).toContain('"dbPath": "/data/ast.db"');
      expect(formatted).toContain('Stack trace:');
    });

    it('should format error for logging', () => {
      const error = new NetworkError(
        'Connection timeout',
        { url: 'https://api.example.com', timeout: 5000 },
        ['Check internet connection']
      );
      
      const logEntry = formatter.formatForLogging(error);
      
      expect(logEntry.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      expect(logEntry.level).toBe('error');
      expect(logEntry.name).toBe('NetworkError');
      expect(logEntry.message).toBe('Connection timeout');
      expect(logEntry.code).toBe('NETWORK_ERROR');
      expect(logEntry.context).toEqual({ url: 'https://api.example.com', timeout: 5000 });
      expect(logEntry.suggestions).toEqual(['Check internet connection']);
      expect(logEntry.stack).toBeDefined();
      expect(Array.isArray(logEntry.stack)).toBe(true);
    });

    it('should create brief error summary', () => {
      const error = new TimeoutError('Operation timed out');
      const summary = formatter.createSummary(error);
      
      expect(summary).toBe('TIMEOUT_ERROR: Operation timed out');
    });

    it('should handle regular errors', () => {
      const error = new Error('Regular error');
      const formatted = formatter.formatForUser(error);
      
      expect(formatted).toContain('❌ Error: Regular error');
      expect(formatted).not.toContain('Code:');
      expect(formatted).not.toContain('Context:');
      
      const summary = formatter.createSummary(error);
      expect(summary).toBe('Error: Regular error');
    });

    it('should format complex context values', () => {
      const error = new ValidationError(
        'Complex validation error',
        {
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
        }
      );
      
      const formatted = formatter.formatForUser(error);
      
      expect(formatted).toContain('simpleValue: "string"');
      expect(formatted).toContain('numberValue: 42');
      expect(formatted).toContain('arrayValue: [5 items]');
      expect(formatted).toContain('objectValue: {3 properties}');
    });
  });

  describe('Error Factory Functions', () => {
    describe('ConfigurationErrors', () => {
      it('should create invalid value error', () => {
        const error = ConfigurationErrors.invalidValue('topK', 'invalid', 'number');
        
        expect(error).toBeInstanceOf(ConfigurationError);
        expect(error.message).toContain("Invalid configuration value for 'topK'");
        expect(error.context.key).toBe('topK');
        expect(error.context.value).toBe('invalid');
        expect(error.suggestions.length).toBeGreaterThan(0);
      });

      it('should create missing required error', () => {
        const error = ConfigurationErrors.missingRequired('apiKey', 'environment variables');
        
        expect(error.message).toContain("Missing required configuration: 'apiKey'");
        expect(error.context.key).toBe('apiKey');
        expect(error.context.source).toBe('environment variables');
      });

      it('should create file not accessible error', () => {
        const error = ConfigurationErrors.fileNotAccessible('/config.json', 'Permission denied');
        
        expect(error.message).toContain('Configuration file not accessible: /config.json');
        expect(error.context.filePath).toBe('/config.json');
        expect(error.context.reason).toBe('Permission denied');
      });
    });

    describe('FileSystemErrors', () => {
      it('should create not found error', () => {
        const error = FileSystemErrors.notFound('/missing/file.txt', 'read');
        
        expect(error).toBeInstanceOf(FileSystemError);
        expect(error.message).toContain('File or directory not found: /missing/file.txt');
        expect(error.context.path).toBe('/missing/file.txt');
        expect(error.context.operation).toBe('read');
      });

      it('should create permission denied error', () => {
        const error = FileSystemErrors.permissionDenied('/protected/file.txt', 'write');
        
        expect(error.message).toContain('Permission denied: cannot write /protected/file.txt');
        expect(error.suggestions.some(s => s.includes('file permissions'))).toBe(true);
      });

      it('should create disk space exceeded error', () => {
        const error = FileSystemErrors.diskSpaceExceeded('/tmp', 1024 * 1024 * 100);
        
        expect(error.message).toContain('Insufficient disk space for operation at: /tmp');
        expect(error.context.requiredSpace).toBe(1024 * 1024 * 100);
        expect(error.suggestions.some(s => s.includes('100MB'))).toBe(true);
      });
    });

    describe('ValidationErrors', () => {
      it('should create invalid format error', () => {
        const error = ValidationErrors.invalidFormat('invalid-json', 'JSON');
        
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('Invalid input format: expected JSON');
        expect(error.context.expectedFormat).toBe('JSON');
      });

      it('should create out of range error', () => {
        const error = ValidationErrors.outOfRange(150, 1, 100, 'topK');
        
        expect(error.message).toContain('Value out of range for topK: 150 (must be between 1 and 100)');
        expect(error.context.value).toBe(150);
        expect(error.context.min).toBe(1);
        expect(error.context.max).toBe(100);
        expect(error.context.field).toBe('topK');
      });
    });

    describe('ParseErrors', () => {
      it('should create syntax error', () => {
        const error = ParseErrors.syntaxError('/src/file.ts', 42, 15, 'Missing semicolon');
        
        expect(error).toBeInstanceOf(ParseError);
        expect(error.message).toContain('Syntax error in /src/file.ts:42:15 - Missing semicolon');
        expect(error.context.filePath).toBe('/src/file.ts');
        expect(error.context.line).toBe(42);
        expect(error.context.column).toBe(15);
      });

      it('should create unsupported language error', () => {
        const error = ParseErrors.unsupportedLanguage('/src/file.rb', 'Ruby');
        
        expect(error.message).toContain('Unsupported language or file type: Ruby for /src/file.rb');
        expect(error.context.detectedType).toBe('Ruby');
      });
    });

    describe('DatabaseErrors', () => {
      it('should create corruption error', () => {
        const error = DatabaseErrors.corruption('/data/ast.db', 'Invalid magic number');
        
        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.message).toContain('Database corruption detected in /data/ast.db: Invalid magic number');
        expect(error.context.dbPath).toBe('/data/ast.db');
        expect(error.context.details).toBe('Invalid magic number');
      });

      it('should create version mismatch error', () => {
        const error = DatabaseErrors.versionMismatch('1.0', '2.0', '/data/ast.db');
        
        expect(error.message).toContain('Database version mismatch: found 1.0, expected 2.0');
        expect(error.context.currentVersion).toBe('1.0');
        expect(error.context.expectedVersion).toBe('2.0');
      });
    });

    describe('NetworkErrors', () => {
      it('should create timeout error', () => {
        const error = NetworkErrors.timeout('https://api.example.com', 5000);
        
        expect(error).toBeInstanceOf(NetworkError);
        expect(error.message).toContain('Network timeout connecting to https://api.example.com after 5000ms');
        expect(error.context.url).toBe('https://api.example.com');
        expect(error.context.timeoutMs).toBe(5000);
      });

      it('should create service unavailable error', () => {
        const error = NetworkErrors.serviceUnavailable('API Service', 503);
        
        expect(error.message).toContain('Service unavailable: API Service (HTTP 503)');
        expect(error.context.statusCode).toBe(503);
      });
    });

    describe('TimeoutErrors', () => {
      it('should create operation timeout error', () => {
        const error = TimeoutErrors.operationTimeout('database query', 30000);
        
        expect(error).toBeInstanceOf(TimeoutError);
        expect(error.message).toContain('Operation timeout: database query exceeded 30000ms');
        expect(error.context.operation).toBe('database query');
        expect(error.context.timeoutMs).toBe(30000);
      });
    });
  });
});
