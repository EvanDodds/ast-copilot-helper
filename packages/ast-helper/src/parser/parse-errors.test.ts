import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BaseParseError,
  ParseSyntaxError,
  ParseGrammarError,
  ParseRuntimeError,
  ParseFileSystemError,
  ParseNetworkError,
  ParseConfigurationError,
  ParseTimeoutError,
  ParseMemoryError,
  ParseErrorHandler,
  parseErrorHandler,
  type ParseErrorDetails,
  type ParseErrorType,
  type ErrorSeverity
} from './parse-errors.js';

describe('BaseParseError', () => {
  it('should create a basic parse error with required properties', () => {
    const error = new BaseParseError(
      'syntax',
      'Test error message',
      'TEST_ERROR',
      'error'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BaseParseError');
    expect(error.message).toBe('Test error message');
    expect(error.type).toBe('syntax');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.severity).toBe('error');
    expect(error.timestamp).toBeTypeOf('number');
    expect(error.suggestions).toEqual([]);
    expect(error.stackTrace).toBeTypeOf('string');
  });

  it('should create error with optional properties', () => {
    const position = { line: 10, column: 5, offset: 100 };
    const treeSitterInfo = {
      nodeType: 'identifier',
      parentNodeType: 'variable_declaration',
      expectedTokens: ['(', ')'],
      actualToken: '{'
    };

    const error = new BaseParseError(
      'syntax',
      'Syntax error',
      'SYNTAX_ERROR',
      'error',
      '/path/to/file.ts',
      position,
      'Context information',
      ['Fix the syntax', 'Check brackets'],
      'typescript',
      treeSitterInfo
    );

    expect(error.filePath).toBe('/path/to/file.ts');
    expect(error.position).toEqual(position);
    expect(error.context).toBe('Context information');
    expect(error.suggestions).toEqual(['Fix the syntax', 'Check brackets']);
    expect(error.language).toBe('typescript');
    expect(error.treeSitterInfo).toEqual(treeSitterInfo);
  });

  it('should implement ParseErrorDetails interface', () => {
    const error = new BaseParseError('runtime', 'Test', 'TEST');
    const errorDetails: ParseErrorDetails = error;
    
    expect(errorDetails.type).toBe('runtime');
    expect(errorDetails.message).toBe('Test');
    expect(errorDetails.code).toBe('TEST');
    expect(errorDetails.severity).toBe('error');
  });
});

describe('ParseSyntaxError', () => {
  it('should create syntax error with default suggestions', () => {
    const error = new ParseSyntaxError(
      'Unexpected token',
      '/path/to/file.ts',
      { line: 5, column: 10 },
      'In function declaration'
    );

    expect(error.type).toBe('syntax');
    expect(error.code).toBe('PARSE_SYNTAX_ERROR');
    expect(error.severity).toBe('error');
    expect(error.message).toBe('Unexpected token');
    expect(error.filePath).toBe('/path/to/file.ts');
    expect(error.suggestions.length).toBeGreaterThan(0);
    expect(error.suggestions).toContain('Check for missing brackets, parentheses, or semicolons');
  });

  it('should generate Tree-sitter specific suggestions', () => {
    const treeSitterInfo = {
      expectedTokens: ['(', ')'],
      actualToken: '{'
    };

    const error = new ParseSyntaxError(
      'Syntax error',
      '/file.ts',
      undefined,
      undefined,
      [],
      treeSitterInfo
    );

    expect(error.suggestions).toContain('Expected one of: (, )');
    expect(error.suggestions).toContain('Found unexpected token: \'{\'');
  });

  it('should use provided suggestions when given', () => {
    const customSuggestions = ['Custom suggestion 1', 'Custom suggestion 2'];
    const error = new ParseSyntaxError(
      'Syntax error',
      undefined,
      undefined,
      undefined,
      customSuggestions
    );

    expect(error.suggestions).toEqual(customSuggestions);
  });
});

describe('ParseGrammarError', () => {
  it('should create grammar error with language-specific suggestions', () => {
    const error = new ParseGrammarError(
      'Grammar not found',
      'rust',
      '/file.rs',
      'Loading grammar'
    );

    expect(error.type).toBe('grammar');
    expect(error.code).toBe('PARSE_GRAMMAR_ERROR');
    expect(error.language).toBe('rust');
    expect(error.suggestions).toContain('Ensure Tree-sitter grammar for \'rust\' is installed');
    expect(error.suggestions).toContain('Clear grammar cache and retry: delete .astdb/grammars folder');
  });

  it('should create grammar error without language', () => {
    const error = new ParseGrammarError(
      'Generic grammar error',
      undefined,
      undefined,
      'General context'
    );

    expect(error.language).toBeUndefined();
    expect(error.suggestions).toContain('Verify internet connection for grammar downloads');
    expect(error.suggestions).not.toContain('Ensure Tree-sitter grammar for');
  });
});

describe('ParseRuntimeError', () => {
  it('should create runtime error with context-aware suggestions', () => {
    const error = new ParseRuntimeError(
      'Out of memory during parsing',
      '/large-file.ts',
      'Processing large file'
    );

    expect(error.type).toBe('runtime');
    expect(error.code).toBe('PARSE_RUNTIME_ERROR');
    expect(error.suggestions).toContain('Reduce batch size or enable memory throttling');
    expect(error.suggestions).toContain('Close other applications to free memory');
  });

  it('should generate timeout-specific suggestions', () => {
    const error = new ParseRuntimeError(
      'Operation timeout exceeded',
      '/file.ts',
      'Parsing timeout'
    );

    expect(error.suggestions).toContain('Increase parsing timeout limit');
    expect(error.suggestions).toContain('Check if file is unusually large or complex');
  });

  it('should generate module-specific suggestions', () => {
    const error = new ParseRuntimeError(
      'Missing module: tree-sitter-typescript',
      undefined,
      'Module loading'
    );

    expect(error.suggestions).toContain('Install required Tree-sitter modules');
    expect(error.suggestions).toContain('Check Node.js version compatibility');
  });

  it('should support custom severity levels', () => {
    const warningError = new ParseRuntimeError(
      'Performance warning',
      undefined,
      undefined,
      [],
      'warning'
    );

    expect(warningError.severity).toBe('warning');
  });
});

describe('ParseFileSystemError', () => {
  it('should create file not found error with appropriate suggestions', () => {
    const error = new ParseFileSystemError(
      'ENOENT: no such file or directory',
      '/missing/file.ts',
      'File access'
    );

    expect(error.type).toBe('file_system');
    expect(error.code).toBe('PARSE_FILE_SYSTEM_ERROR');
    expect(error.suggestions).toContain('Verify the file path exists');
    expect(error.suggestions).toContain('Check file permissions');
  });

  it('should create permission error with appropriate suggestions', () => {
    const error = new ParseFileSystemError(
      'EACCES: permission denied',
      '/restricted/file.ts'
    );

    expect(error.suggestions).toContain('Check file read permissions');
    expect(error.suggestions).toContain('Run with appropriate user privileges');
  });

  it('should create too many files error with appropriate suggestions', () => {
    const error = new ParseFileSystemError(
      'EMFILE: too many open files'
    );

    expect(error.suggestions).toContain('Reduce batch processing concurrency');
    expect(error.suggestions).toContain('Close unused file handles');
  });
});

describe('ParseNetworkError', () => {
  it('should create network error with connectivity suggestions', () => {
    const error = new ParseNetworkError(
      'Failed to download grammar',
      'Grammar download from GitHub'
    );

    expect(error.type).toBe('network');
    expect(error.code).toBe('PARSE_NETWORK_ERROR');
    expect(error.suggestions).toContain('Check internet connection');
    expect(error.suggestions).toContain('Verify proxy settings if behind corporate firewall');
    expect(error.suggestions).toContain('Check if GitHub or grammar repository is accessible');
  });

  it('should support custom suggestions', () => {
    const customSuggestions = ['Use offline mode', 'Try different mirror'];
    const error = new ParseNetworkError(
      'Network failure',
      undefined,
      customSuggestions
    );

    expect(error.suggestions).toEqual(customSuggestions);
  });
});

describe('ParseConfigurationError', () => {
  it('should create configuration error with validation suggestions', () => {
    const error = new ParseConfigurationError(
      'Invalid configuration format',
      'JSON parsing failed'
    );

    expect(error.type).toBe('configuration');
    expect(error.code).toBe('PARSE_CONFIGURATION_ERROR');
    expect(error.suggestions).toContain('Check configuration file syntax and structure');
    expect(error.suggestions).toContain('Verify all required configuration fields are present');
    expect(error.suggestions).toContain('Reset to default configuration and try again');
  });
});

describe('ParseTimeoutError', () => {
  it('should create timeout error with timing information', () => {
    const error = new ParseTimeoutError(
      'Parse operation timed out',
      '/large-file.ts',
      5000,
      'Parsing large file'
    );

    expect(error.type).toBe('timeout');
    expect(error.code).toBe('PARSE_TIMEOUT_ERROR');
    expect(error.suggestions).toContain('Consider increasing timeout from 5000ms');
    expect(error.suggestions).toContain('Check if file is extremely large or complex');
  });

  it('should create timeout error without timing information', () => {
    const error = new ParseTimeoutError(
      'Operation timed out',
      '/file.ts'
    );

    expect(error.suggestions).not.toContain('Consider increasing timeout from');
    expect(error.suggestions).toContain('Verify system performance and available resources');
  });
});

describe('ParseMemoryError', () => {
  it('should create memory error with usage information', () => {
    const error = new ParseMemoryError(
      'Out of memory',
      '/file.ts',
      512,
      'High memory usage'
    );

    expect(error.type).toBe('memory');
    expect(error.code).toBe('PARSE_MEMORY_ERROR');
    expect(error.suggestions).toContain('Memory usage was 512MB when error occurred');
    expect(error.suggestions).toContain('Enable memory throttling in batch processor');
    expect(error.suggestions).toContain('Process files in smaller batches');
  });

  it('should create memory error without usage information', () => {
    const error = new ParseMemoryError(
      'Memory allocation failed'
    );

    expect(error.suggestions).not.toContain('Memory usage was');
    expect(error.suggestions).toContain('Consider increasing available system memory');
  });
});

describe('ParseErrorHandler', () => {
  let errorHandler: ParseErrorHandler;

  beforeEach(() => {
    errorHandler = new ParseErrorHandler();
    vi.spyOn(console, 'error').mockImplementation(() => {}); // Silence console output
  });

  describe('logError', () => {
    it('should log ParseErrorDetails object', () => {
      const errorDetails: ParseErrorDetails = {
        type: 'syntax',
        message: 'Test error',
        severity: 'error',
        timestamp: Date.now(),
        code: 'TEST_ERROR',
        suggestions: ['Fix the issue']
      };

      const result = errorHandler.logError(errorDetails);
      expect(result).toBe(errorDetails);
      
      const stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByType.get('syntax')).toBe(1);
    });

    it('should convert generic Error to ParseErrorDetails', () => {
      const genericError = new Error('Generic error message');
      
      const result = errorHandler.logError(genericError);
      
      expect(result.type).toBe('runtime');
      expect(result.message).toBe('Generic error message');
      expect(result.code).toBe('GENERIC_ERROR');
      expect(result.severity).toBe('error');
      expect(result.suggestions).toContain('Retry the operation');
    });

    it('should handle BaseParseError instances', () => {
      const parseError = new ParseSyntaxError('Syntax error', '/file.ts');
      
      const result = errorHandler.logError(parseError);
      
      expect(result.type).toBe('syntax');
      expect(result.code).toBe('PARSE_SYNTAX_ERROR');
      expect(result.filePath).toBe('/file.ts');
    });
  });

  describe('error creation methods', () => {
    it('should create syntax error with Tree-sitter info', () => {
      const treeSitterNode = {
        type: 'identifier',
        parent: { type: 'variable_declaration' }
      };

      const error = errorHandler.createSyntaxError(
        'Invalid identifier',
        '/file.ts',
        { line: 5, column: 10 },
        treeSitterNode,
        'typescript'
      );

      expect(error).toBeInstanceOf(ParseSyntaxError);
      expect(error.treeSitterInfo?.nodeType).toBe('identifier');
      expect(error.treeSitterInfo?.parentNodeType).toBe('variable_declaration');
      expect(error.context).toBe('Node: identifier');
    });

    it('should create various error types', () => {
      const grammarError = errorHandler.createGrammarError('Grammar error', 'python');
      expect(grammarError).toBeInstanceOf(ParseGrammarError);

      const runtimeError = errorHandler.createRuntimeError('Runtime error');
      expect(runtimeError).toBeInstanceOf(ParseRuntimeError);

      const fsError = errorHandler.createFileSystemError('FS error', '/file.ts');
      expect(fsError).toBeInstanceOf(ParseFileSystemError);

      const networkError = errorHandler.createNetworkError('Network error');
      expect(networkError).toBeInstanceOf(ParseNetworkError);

      const configError = errorHandler.createConfigurationError('Config error');
      expect(configError).toBeInstanceOf(ParseConfigurationError);

      const timeoutError = errorHandler.createTimeoutError('Timeout', '/file.ts', 1000);
      expect(timeoutError).toBeInstanceOf(ParseTimeoutError);

      const memoryError = errorHandler.createMemoryError('Memory error', '/file.ts', 256);
      expect(memoryError).toBeInstanceOf(ParseMemoryError);
    });
  });

  describe('error statistics', () => {
    it('should track error statistics correctly', () => {
      // Create multiple errors
      errorHandler.logError(new ParseSyntaxError('Error 1'));
      errorHandler.logError(new ParseSyntaxError('Error 2'));
      errorHandler.logError(new ParseGrammarError('Error 3'));
      errorHandler.logError(new ParseRuntimeError('Error 4'));

      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBe(4);
      expect(stats.errorsByType.get('syntax')).toBe(2);
      expect(stats.errorsByType.get('grammar')).toBe(1);
      expect(stats.errorsByType.get('runtime')).toBe(1);
      expect(stats.errorsByCode.get('PARSE_SYNTAX_ERROR')).toBe(2);
      expect(stats.recentErrors).toHaveLength(4);
      expect(stats.topErrors).toEqual([
        { key: 'syntax:PARSE_SYNTAX_ERROR', count: 2 },
        { key: 'grammar:PARSE_GRAMMAR_ERROR', count: 1 },
        { key: 'runtime:PARSE_RUNTIME_ERROR', count: 1 }
      ]);
    });

    it('should limit error history', () => {
      // This test would be more meaningful with a lower maxHistorySize
      // but we can test the concept
      const errorHandler = new ParseErrorHandler();
      
      // Add many errors
      for (let i = 0; i < 1005; i++) {
        errorHandler.logError(new ParseSyntaxError(`Error ${i}`));
      }

      const stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(1000); // Should be capped at maxHistorySize
    });
  });

  describe('error recoverability and retry strategies', () => {
    it('should identify recoverable errors', () => {
      const recoverableErrors = [
        { type: 'network' as ParseErrorType, message: 'Network error' },
        { type: 'timeout' as ParseErrorType, message: 'Timeout error' },
        { type: 'memory' as ParseErrorType, message: 'Memory error' },
        { type: 'file_system' as ParseErrorType, message: 'EACCES error' },
        { type: 'grammar' as ParseErrorType, message: 'Grammar error' },
        { type: 'runtime' as ParseErrorType, message: 'Runtime error' }
      ];

      const nonRecoverableErrors = [
        { type: 'syntax' as ParseErrorType, message: 'Syntax error' },
        { type: 'configuration' as ParseErrorType, message: 'Config error' },
        { type: 'file_system' as ParseErrorType, message: 'ENOENT error' }
      ];

      recoverableErrors.forEach(err => {
        const errorDetails: ParseErrorDetails = {
          ...err,
          severity: 'error' as ErrorSeverity,
          timestamp: Date.now(),
          code: 'TEST_ERROR'
        };
        expect(errorHandler.isRecoverable(errorDetails)).toBe(true);
      });

      nonRecoverableErrors.forEach(err => {
        const errorDetails: ParseErrorDetails = {
          ...err,
          severity: 'error' as ErrorSeverity,
          timestamp: Date.now(),
          code: 'TEST_ERROR'
        };
        expect(errorHandler.isRecoverable(errorDetails)).toBe(err.message.includes('ENOENT') ? false : err.type !== 'syntax' && err.type !== 'configuration');
      });
    });

    it('should provide retry strategies for recoverable errors', () => {
      const networkError: ParseErrorDetails = {
        type: 'network',
        message: 'Network error',
        severity: 'error',
        timestamp: Date.now(),
        code: 'NETWORK_ERROR'
      };

      const strategy = errorHandler.getRetryStrategy(networkError);
      expect(strategy).toBeDefined();
      expect(strategy!.shouldRetry).toBe(true);
      expect(strategy!.retryDelayMs).toBe(1000);
      expect(strategy!.maxRetries).toBe(3);
      expect(strategy!.backoffMultiplier).toBe(2);
    });

    it('should return null retry strategy for non-recoverable errors', () => {
      const syntaxError: ParseErrorDetails = {
        type: 'syntax',
        message: 'Syntax error',
        severity: 'error',
        timestamp: Date.now(),
        code: 'SYNTAX_ERROR'
      };

      const strategy = errorHandler.getRetryStrategy(syntaxError);
      expect(strategy).toBeNull();
    });
  });

  describe('clearHistory', () => {
    it('should clear error history and counts', () => {
      errorHandler.logError(new ParseSyntaxError('Test error'));
      
      let stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);

      errorHandler.clearHistory();
      
      stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(0);
      expect(stats.errorsByType.size).toBe(0);
      expect(stats.topErrors).toHaveLength(0);
    });
  });
});

describe('Global error handler', () => {
  it('should provide global parseErrorHandler instance', () => {
    expect(parseErrorHandler).toBeInstanceOf(ParseErrorHandler);
  });

  it('should be reusable across modules', () => {
    const error = new ParseSyntaxError('Global test');
    parseErrorHandler.logError(error);
    
    const stats = parseErrorHandler.getErrorStatistics();
    expect(stats.totalErrors).toBeGreaterThanOrEqual(1);
  });
});

describe('Error inheritance and type checking', () => {
  it('should properly inherit from Error and BaseParseError', () => {
    const errors = [
      new ParseSyntaxError('Syntax'),
      new ParseGrammarError('Grammar'),
      new ParseRuntimeError('Runtime'),
      new ParseFileSystemError('FS'),
      new ParseNetworkError('Network'),
      new ParseConfigurationError('Config'),
      new ParseTimeoutError('Timeout'),
      new ParseMemoryError('Memory')
    ];

    errors.forEach(error => {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseParseError);
      expect(error.name).toMatch(/Parse\w+Error/);
      expect(error.stack).toBeDefined();
      expect(typeof error.message).toBe('string');
    });
  });

  it('should have proper type discrimination', () => {
    const syntaxError = new ParseSyntaxError('Test');
    const grammarError = new ParseGrammarError('Test');

    if (syntaxError.type === 'syntax') {
      expect(syntaxError.code).toBe('PARSE_SYNTAX_ERROR');
    }

    if (grammarError.type === 'grammar') {
      expect(grammarError.code).toBe('PARSE_GRAMMAR_ERROR');
    }
  });
});