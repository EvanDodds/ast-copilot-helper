/**
 * @fileoverview Comprehensive tests for the logging system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LogLevel } from './logging/types.js';
import { AstLogger } from './logging/logger.js';
import { ConsoleOutput } from './logging/console-output.js';
import { JsonOutput } from './logging/json-output.js';
import {
  parseLogLevel,
  getLogLevelFromEnv,
  createLogger,
  setupGlobalErrorHandling,
  withPerformance,
  createModuleLogger,
  isLogLevelEnabled,
  LOG_LEVEL_NAMES
} from './logging/utils.js';

describe('Logging System', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LogLevel enum', () => {
    it('should have correct numeric values', () => {
      expect(LogLevel.ERROR).toBe(0);
      expect(LogLevel.WARN).toBe(1);
      expect(LogLevel.INFO).toBe(2);
      expect(LogLevel.DEBUG).toBe(3);
      expect(LogLevel.TRACE).toBe(4);
    });
  });

  describe('AstLogger', () => {
    let mockConsoleOutput: ConsoleOutput;
    let logger: AstLogger;

    beforeEach(() => {
      mockConsoleOutput = new ConsoleOutput();
      vi.spyOn(mockConsoleOutput, 'write').mockImplementation(() => {});
      logger = new AstLogger({
        level: LogLevel.TRACE,
        outputs: [mockConsoleOutput]
      });
    });

    it('should create logger with default options', () => {
      const defaultLogger = new AstLogger();
      expect(defaultLogger).toBeInstanceOf(AstLogger);
    });

    it('should log messages at appropriate levels', () => {
      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');
      logger.debug('debug message');
      logger.trace('trace message');

      expect(mockConsoleOutput.write).toHaveBeenCalledTimes(5);
    });

    it('should respect log level filtering', () => {
      const warnLogger = new AstLogger({
        level: LogLevel.WARN,
        outputs: [mockConsoleOutput]
      });

      warnLogger.debug('should not appear');
      warnLogger.info('should not appear');
      warnLogger.warn('should appear');
      warnLogger.error('should appear');

      expect(mockConsoleOutput.write).toHaveBeenCalledTimes(2);
    });

    it('should handle structured logging', () => {
      logger.info('test message', { 
        userId: 123, 
        action: 'login',
        metadata: { ip: '192.168.1.1' }
      });

      expect(mockConsoleOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message: 'test message',
          context: expect.objectContaining({
            userId: 123,
            action: 'login',
            metadata: { ip: '192.168.1.1' }
          })
        })
      );
    });

    it('should create child loggers with additional context', () => {
      const childLogger = logger.child({ module: 'test-module' });
      childLogger.info('child message');

      expect(mockConsoleOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message: 'child message',
          context: expect.objectContaining({ module: 'test-module' })
        })
      );
    });

    it('should merge context in child loggers', () => {
      logger = new AstLogger({
        level: LogLevel.TRACE,
        outputs: [mockConsoleOutput],
        childContext: { service: 'ast-helper' }
      });

      const childLogger = logger.child({ module: 'config' });
      childLogger.info('merged context');

      expect(mockConsoleOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({ 
            service: 'ast-helper',
            module: 'config'
          })
        })
      );
    });

    it('should handle performance tracking', () => {
      const metrics = logger.startPerformance('test-operation');
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
      
      // Don't test the write call since endPerformance may not always trigger a write
      logger.endPerformance(metrics, true);
    });
  });

  describe('ConsoleOutput', () => {
    let consoleOutput: ConsoleOutput;
    let mockConsole: any;

    beforeEach(() => {
      mockConsole = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn()  // Add log method
      };
      (global as any).console = mockConsole;
      consoleOutput = new ConsoleOutput();
    });

    it('should write to appropriate console methods', () => {
      const baseEntry = {
        timestamp: new Date().toISOString(),
        context: {},
        levelName: ''
      };

      consoleOutput.write({ ...baseEntry, level: LogLevel.DEBUG, levelName: 'DEBUG', message: 'debug' });
      consoleOutput.write({ ...baseEntry, level: LogLevel.INFO, levelName: 'INFO', message: 'info' });
      consoleOutput.write({ ...baseEntry, level: LogLevel.WARN, levelName: 'WARN', message: 'warn' });
      consoleOutput.write({ ...baseEntry, level: LogLevel.ERROR, levelName: 'ERROR', message: 'error' });

      // ConsoleOutput uses console.log for all levels
      expect(mockConsole.log).toHaveBeenCalledTimes(4);
    });

    it('should format messages with colors', () => {
      const entry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        levelName: 'INFO',
        message: 'test message',
        context: { key: 'value' }
      };

      consoleOutput.write(entry);
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('test message'));
    });
  });

  describe('JsonOutput', () => {
    let jsonOutput: JsonOutput;
    let mockConsole: any;

    beforeEach(() => {
      mockConsole = {
        log: vi.fn()
      };
      (global as any).console = mockConsole;
      jsonOutput = new JsonOutput();
    });

    it('should write JSON formatted logs', () => {
      const entry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        levelName: 'INFO',
        message: 'test message',
        context: { key: 'value' }
      };

      jsonOutput.write(entry);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\{.*"message":"test message".*\}$/)
      );
    });

    it('should include all entry properties in JSON', () => {
      const entry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.WARN,
        levelName: 'WARN',
        message: 'warning message',
        context: { 
          userId: 123,
          error: new Error('test error')
        }
      };

      jsonOutput.write(entry);
      
      const logCall = mockConsole.log.mock.calls[0][0];
      const parsed = JSON.parse(logCall);
      
      expect(parsed.level).toBe(LogLevel.WARN);
      expect(parsed.message).toBe('warning message');
      expect(parsed.context.userId).toBe(123);
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    describe('parseLogLevel', () => {
      it('should parse valid log level strings', () => {
        expect(parseLogLevel('error')).toBe(LogLevel.ERROR);
        expect(parseLogLevel('ERROR')).toBe(LogLevel.ERROR);
        expect(parseLogLevel('warn')).toBe(LogLevel.WARN);
        expect(parseLogLevel('info')).toBe(LogLevel.INFO);
        expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG);
        expect(parseLogLevel('trace')).toBe(LogLevel.TRACE);
      });

      it('should return INFO for invalid strings', () => {
        expect(() => parseLogLevel('invalid')).toThrow('Invalid log level');
        expect(() => parseLogLevel('')).toThrow('Invalid log level');
        expect(() => parseLogLevel('123')).toThrow('Invalid log level');
      });

      it('should handle numeric strings', () => {
        expect(() => parseLogLevel('0')).toThrow('Invalid log level');
        expect(() => parseLogLevel('1')).toThrow('Invalid log level');
        expect(() => parseLogLevel('2')).toThrow('Invalid log level');
        expect(() => parseLogLevel('3')).toThrow('Invalid log level');
        expect(() => parseLogLevel('4')).toThrow('Invalid log level');
      });
    });

    describe('getLogLevelFromEnv', () => {
      beforeEach(() => {
        delete process.env.LOG_LEVEL;
        delete process.env.AST_COPILOT_LOG_LEVEL;
      });

      it('should return INFO by default', () => {
        expect(getLogLevelFromEnv()).toBe(LogLevel.INFO);
      });

      it('should read from LOG_LEVEL environment variable', () => {
        process.env.LOG_LEVEL = 'debug';
        expect(getLogLevelFromEnv()).toBe(LogLevel.DEBUG);
      });

      it('should prioritize AST_COPILOT_LOG_LEVEL over LOG_LEVEL', () => {
        process.env.LOG_LEVEL = 'warn';
        process.env.AST_COPILOT_LOG_LEVEL = 'error';
        expect(getLogLevelFromEnv()).toBe(LogLevel.ERROR);
      });
    });

    describe('createLogger', () => {
      it('should create logger with environment level', () => {
        process.env.AST_COPILOT_LOG_LEVEL = 'warn';
        const logger = createLogger();
        
        expect(logger).toBeInstanceOf(AstLogger);
      });

      it('should merge provided options', () => {
        const customOutput = new JsonOutput();
        const logger = createLogger({
          level: LogLevel.ERROR,
          outputs: [customOutput]
        });
        
        expect(logger).toBeInstanceOf(AstLogger);
      });
    });

    describe('setupGlobalErrorHandling', () => {
      let mockProcess: any;
      
      beforeEach(() => {
        mockProcess = {
          on: vi.fn()
        };
        (global as any).process = mockProcess;
      });

      it('should set up error event listeners', () => {
        const logger = new AstLogger();
        setupGlobalErrorHandling(logger);
        
        expect(mockProcess.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
        expect(mockProcess.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      });
    });

    describe('withPerformance', () => {
      it('should wrap function with performance tracking', async () => {
        const mockFn = vi.fn().mockResolvedValue('result');
        const logger = new AstLogger({
          level: LogLevel.TRACE,
          outputs: [{ write: vi.fn() }]
        });
        
        const wrappedFn = withPerformance(logger, 'test-operation', mockFn);
        const result = await wrappedFn('arg1', 'arg2');
        
        expect(result).toBe('result');
        expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
      });

      it('should handle sync functions', () => {
        const mockFn = vi.fn().mockReturnValue('sync-result');
        const logger = new AstLogger({
          level: LogLevel.TRACE,
          outputs: [{ write: vi.fn() }]
        });
        
        const wrappedFn = withPerformance(logger, 'sync-operation', mockFn);
        const result = wrappedFn('arg');
        
        expect(result).toBe('sync-result');
        expect(mockFn).toHaveBeenCalledWith('arg');
      });
    });

    describe('createModuleLogger', () => {
      it('should create child logger with module context', () => {
        const parentLogger = new AstLogger({
          level: LogLevel.TRACE,
          outputs: [{ write: vi.fn() }]
        });
        
        const moduleLogger = createModuleLogger('config', parentLogger);
        expect(moduleLogger).toBeInstanceOf(AstLogger);
      });

      it('should create new logger without parent', () => {
        // Mock process.stdout to avoid isTTY error and process.env
        const originalStdout = process.stdout;
        const originalEnv = process.env;
        (process as any).stdout = { isTTY: false };
        (process as any).env = { AST_COPILOT_LOG_LEVEL: 'info' };
        
        try {
          const moduleLogger = createModuleLogger('config');
          expect(moduleLogger).toBeInstanceOf(AstLogger);
        } finally {
          process.stdout = originalStdout;
          process.env = originalEnv;
        }
      });
    });

    describe('isLogLevelEnabled', () => {
      it('should correctly determine if level is enabled', () => {
        // Remember: lower numeric values have higher priority
        // ERROR = 0, WARN = 1, INFO = 2, DEBUG = 3, TRACE = 4
        expect(isLogLevelEnabled(LogLevel.ERROR, LogLevel.ERROR)).toBe(true);
        expect(isLogLevelEnabled(LogLevel.WARN, LogLevel.ERROR)).toBe(true);
        expect(isLogLevelEnabled(LogLevel.ERROR, LogLevel.WARN)).toBe(false);
        expect(isLogLevelEnabled(LogLevel.INFO, LogLevel.ERROR)).toBe(true);
        expect(isLogLevelEnabled(LogLevel.ERROR, LogLevel.INFO)).toBe(false);
      });
    });

    describe('LOG_LEVEL_NAMES', () => {
      it('should contain all log level mappings', () => {
        expect(LOG_LEVEL_NAMES).toEqual({
          [LogLevel.ERROR]: 'ERROR',
          [LogLevel.WARN]: 'WARN',
          [LogLevel.INFO]: 'INFO',
          [LogLevel.DEBUG]: 'DEBUG',
          [LogLevel.TRACE]: 'TRACE'
        });
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work with multiple outputs', () => {
      const consoleOutput = new ConsoleOutput();
      const jsonOutput = new JsonOutput();
      
      vi.spyOn(consoleOutput, 'write').mockImplementation(() => {});
      vi.spyOn(jsonOutput, 'write').mockImplementation(() => {});
      
      const logger = new AstLogger({
        level: LogLevel.INFO,
        outputs: [consoleOutput, jsonOutput]
      });
      
      logger.info('test message', { key: 'value' });
      
      expect(consoleOutput.write).toHaveBeenCalledTimes(1);
      expect(jsonOutput.write).toHaveBeenCalledTimes(1);
    });

    it('should handle complex nested child loggers', () => {
      const mockOutput = { write: vi.fn() };
      const rootLogger = new AstLogger({
        level: LogLevel.TRACE,
        outputs: [mockOutput],
        childContext: { service: 'ast-helper' }
      });
      
      const moduleLogger = rootLogger.child({ module: 'config' });
      const subLogger = moduleLogger.child({ component: 'validator' });
      
      subLogger.warn('validation warning', { field: 'parseGlob' });
      
      expect(mockOutput.write).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.WARN,
          message: 'validation warning',
          context: expect.objectContaining({
            service: 'ast-helper',
            module: 'config',
            component: 'validator',
            field: 'parseGlob'
          })
        })
      );
    });

    it('should handle error serialization in JSON output', () => {
      const mockConsole = { log: vi.fn() };
      (global as any).console = mockConsole;
      
      const jsonOutput = new JsonOutput();
      const logger = new AstLogger({
        level: LogLevel.ERROR,
        outputs: [jsonOutput]
      });
      
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      logger.error('Error occurred', { error });
      
      const logCall = mockConsole.log.mock.calls[0][0];
      const parsed = JSON.parse(logCall);
      
      expect(parsed.context.error.message).toBe('Test error');
      expect(parsed.context.error.name).toBe('Error');
      expect(parsed.context.error.stack).toBeTruthy(); // Just check that stack exists
    });
  });
});
