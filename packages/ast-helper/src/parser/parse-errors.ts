/**
 * Comprehensive error handling system for AST parsing operations.
 * Provides detailed error types, context, recovery suggestions, and logging integration.
 */

/**
 * Base interface for all parsing-related errors
 */
export interface ParseErrorDetails {
  /** Error type category */
  type: ParseErrorType;
  /** Human-readable error message */
  message: string;
  /** File path where error occurred */
  filePath?: string;
  /** Position in the file where error occurred */
  position?: { line: number; column: number; offset?: number };
  /** Additional error context */
  context?: string;
  /** Suggested recovery actions */
  suggestions?: string[];
  /** Error severity level */
  severity: ErrorSeverity;
  /** Timestamp when error occurred */
  timestamp: number;
  /** Error code for programmatic handling */
  code: string;
  /** Stack trace if available */
  stackTrace?: string;
  /** Related errors or warnings */
  relatedErrors?: ParseErrorDetails[];
  /** Language being parsed when error occurred */
  language?: string;
  /** Tree-sitter specific information */
  treeSitterInfo?: {
    nodeType?: string;
    parentNodeType?: string;
    expectedTokens?: string[];
    actualToken?: string;
  };
}

export type ParseErrorType = 
  | 'syntax'
  | 'grammar' 
  | 'runtime'
  | 'timeout'
  | 'memory'
  | 'file_system'
  | 'network'
  | 'configuration'
  | 'validation';

export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Base error class for all parsing errors
 */
export class BaseParseError extends Error implements ParseErrorDetails {
  public override readonly name: string;
  public readonly type: ParseErrorType;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: number;
  public readonly code: string;
  public readonly filePath?: string;
  public readonly position?: { line: number; column: number; offset?: number };
  public readonly context?: string;
  public readonly suggestions: string[];
  public readonly language?: string;
  public readonly treeSitterInfo?: {
    nodeType?: string;
    parentNodeType?: string;
    expectedTokens?: string[];
    actualToken?: string;
  };
  public readonly relatedErrors?: ParseErrorDetails[];
  public readonly stackTrace?: string;

  constructor(
    type: ParseErrorType,
    message: string,
    code: string,
    severity: ErrorSeverity = 'error',
    filePath?: string,
    position?: { line: number; column: number; offset?: number },
    context?: string,
    suggestions: string[] = [],
    language?: string,
    treeSitterInfo?: {
      nodeType?: string;
      parentNodeType?: string;
      expectedTokens?: string[];
      actualToken?: string;
    },
    relatedErrors?: ParseErrorDetails[]
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.severity = severity;
    this.timestamp = Date.now();
    this.code = code;
    this.filePath = filePath;
    this.position = position;
    this.context = context;
    this.suggestions = suggestions;
    this.language = language;
    this.treeSitterInfo = treeSitterInfo;
    this.relatedErrors = relatedErrors;
    this.stackTrace = this.stack;
  }
}

/**
 * Syntax error in source code
 */
export class ParseSyntaxError extends BaseParseError {
  constructor(
    message: string,
    filePath?: string,
    position?: { line: number; column: number; offset?: number },
    context?: string,
    suggestions: string[] = [],
    treeSitterInfo?: {
      nodeType?: string;
      parentNodeType?: string;
      expectedTokens?: string[];
      actualToken?: string;
    },
    language?: string
  ) {
    const finalSuggestions = suggestions.length > 0 
      ? suggestions 
      : ParseSyntaxError.generateSyntaxSuggestions(treeSitterInfo);

    super(
      'syntax',
      message,
      'PARSE_SYNTAX_ERROR',
      'error',
      filePath,
      position,
      context,
      finalSuggestions,
      language,
      treeSitterInfo
    );
  }

  private static generateSyntaxSuggestions(treeSitterInfo?: {
    nodeType?: string;
    parentNodeType?: string;
    expectedTokens?: string[];
    actualToken?: string;
  }): string[] {
    const suggestions: string[] = [];
    
    if (treeSitterInfo?.expectedTokens?.length) {
      suggestions.push(`Expected one of: ${treeSitterInfo.expectedTokens.join(', ')}`);
    }
    
    if (treeSitterInfo?.actualToken) {
      suggestions.push(`Found unexpected token: '${treeSitterInfo.actualToken}'`);
    }
    
    suggestions.push('Check for missing brackets, parentheses, or semicolons');
    suggestions.push('Verify proper syntax for the current language');
    
    return suggestions;
  }
}

/**
 * Grammar loading or initialization error
 */
export class ParseGrammarError extends BaseParseError {
  constructor(
    message: string,
    language?: string,
    filePath?: string,
    context?: string,
    suggestions: string[] = []
  ) {
    const finalSuggestions = suggestions.length > 0 
      ? suggestions 
      : ParseGrammarError.generateGrammarSuggestions(language);

    super(
      'grammar',
      message,
      'PARSE_GRAMMAR_ERROR',
      'error',
      filePath,
      undefined,
      context,
      finalSuggestions,
      language
    );
  }

  private static generateGrammarSuggestions(language?: string): string[] {
    const suggestions: string[] = [];
    
    if (language) {
      suggestions.push(`Ensure Tree-sitter grammar for '${language}' is installed`);
      suggestions.push(`Check if language '${language}' is supported`);
    }
    
    suggestions.push('Verify internet connection for grammar downloads');
    suggestions.push('Clear grammar cache and retry: delete .astdb/grammars folder');
    suggestions.push('Check grammar SHA256 checksums for corruption');
    
    return suggestions;
  }
}

/**
 * Runtime or system-level error
 */
export class ParseRuntimeError extends BaseParseError {
  constructor(
    message: string,
    filePath?: string,
    context?: string,
    suggestions: string[] = [],
    severity: ErrorSeverity = 'error',
    stackTrace?: string
  ) {
    const finalSuggestions = suggestions.length > 0 
      ? suggestions 
      : ParseRuntimeError.generateRuntimeSuggestions(message);

    super(
      'runtime',
      message,
      'PARSE_RUNTIME_ERROR',
      severity,
      filePath,
      undefined,
      context,
      finalSuggestions
    );
    
    if (stackTrace) {
      (this as any).stackTrace = stackTrace;
    }
  }

  private static generateRuntimeSuggestions(message: string): string[] {
    const suggestions: string[] = [];
    
    if (message.includes('memory')) {
      suggestions.push('Reduce batch size or enable memory throttling');
      suggestions.push('Close other applications to free memory');
      suggestions.push('Consider processing files in smaller chunks');
    } else if (message.includes('timeout')) {
      suggestions.push('Increase parsing timeout limit');
      suggestions.push('Check if file is unusually large or complex');
      suggestions.push('Verify system performance and available resources');
    } else if (message.includes('module')) {
      suggestions.push('Install required Tree-sitter modules');
      suggestions.push('Check Node.js version compatibility');
      suggestions.push('Verify installation integrity');
    }
    
    suggestions.push('Check system logs for additional details');
    suggestions.push('Retry the operation');
    
    return suggestions;
  }
}

/**
 * File system related error
 */
export class ParseFileSystemError extends BaseParseError {
  constructor(
    message: string,
    filePath?: string,
    context?: string,
    suggestions: string[] = []
  ) {
    const finalSuggestions = suggestions.length > 0 
      ? suggestions 
      : ParseFileSystemError.generateFileSystemSuggestions(message);

    super(
      'file_system',
      message,
      'PARSE_FILE_SYSTEM_ERROR',
      'error',
      filePath,
      undefined,
      context,
      finalSuggestions
    );
  }

  private static generateFileSystemSuggestions(message: string): string[] {
    const suggestions: string[] = [];
    
    if (message.includes('ENOENT') || message.includes('not found')) {
      suggestions.push('Verify the file path exists');
      suggestions.push('Check file permissions');
      suggestions.push('Ensure the file has not been moved or deleted');
    } else if (message.includes('EACCES') || message.includes('permission')) {
      suggestions.push('Check file read permissions');
      suggestions.push('Run with appropriate user privileges');
      suggestions.push('Verify directory access permissions');
    } else if (message.includes('EMFILE') || message.includes('too many files')) {
      suggestions.push('Reduce batch processing concurrency');
      suggestions.push('Close unused file handles');
      suggestions.push('Increase system file descriptor limits');
    }
    
    suggestions.push('Check available disk space');
    suggestions.push('Verify file system health');
    
    return suggestions;
  }
}

/**
 * Network related error for grammar downloads
 */
export class ParseNetworkError extends BaseParseError {
  constructor(
    message: string,
    context?: string,
    suggestions: string[] = []
  ) {
    const finalSuggestions = suggestions.length > 0 
      ? suggestions 
      : ParseNetworkError.generateNetworkSuggestions();

    super(
      'network',
      message,
      'PARSE_NETWORK_ERROR',
      'error',
      undefined,
      undefined,
      context,
      finalSuggestions
    );
  }

  private static generateNetworkSuggestions(): string[] {
    return [
      'Check internet connection',
      'Verify proxy settings if behind corporate firewall',
      'Try again later in case of temporary server issues',
      'Check if GitHub or grammar repository is accessible',
      'Consider using local grammar files if available',
      'Verify DNS resolution is working correctly',
    ];
  }
}

/**
 * Configuration or validation error
 */
export class ParseConfigurationError extends BaseParseError {
  constructor(
    message: string,
    context?: string,
    suggestions: string[] = []
  ) {
    const finalSuggestions = suggestions.length > 0 
      ? suggestions 
      : ParseConfigurationError.generateConfigurationSuggestions();

    super(
      'configuration',
      message,
      'PARSE_CONFIGURATION_ERROR',
      'error',
      undefined,
      undefined,
      context,
      finalSuggestions
    );
  }

  private static generateConfigurationSuggestions(): string[] {
    return [
      'Check configuration file syntax and structure',
      'Verify all required configuration fields are present',
      'Validate configuration values against expected types',
      'Review documentation for proper configuration format',
      'Reset to default configuration and try again',
      'Check for conflicting configuration options',
    ];
  }
}

/**
 * Timeout error during parsing operations
 */
export class ParseTimeoutError extends BaseParseError {
  constructor(
    message: string,
    filePath?: string,
    timeoutMs?: number,
    context?: string,
    suggestions: string[] = []
  ) {
    const finalSuggestions = suggestions.length > 0 
      ? suggestions 
      : ParseTimeoutError.generateTimeoutSuggestions(timeoutMs);

    super(
      'timeout',
      message,
      'PARSE_TIMEOUT_ERROR',
      'error',
      filePath,
      undefined,
      context,
      finalSuggestions
    );
  }

  private static generateTimeoutSuggestions(timeoutMs?: number): string[] {
    const suggestions: string[] = [];
    
    if (timeoutMs) {
      suggestions.push(`Consider increasing timeout from ${timeoutMs}ms`);
    }
    
    suggestions.push('Check if file is extremely large or complex');
    suggestions.push('Verify system performance and available resources');
    suggestions.push('Consider breaking large files into smaller parts');
    suggestions.push('Monitor CPU and memory usage during parsing');
    
    return suggestions;
  }
}

/**
 * Memory-related error during parsing
 */
export class ParseMemoryError extends BaseParseError {
  constructor(
    message: string,
    filePath?: string,
    memoryUsageMB?: number,
    context?: string,
    suggestions: string[] = []
  ) {
    const finalSuggestions = suggestions.length > 0 
      ? suggestions 
      : ParseMemoryError.generateMemorySuggestions(memoryUsageMB);

    super(
      'memory',
      message,
      'PARSE_MEMORY_ERROR',
      'error',
      filePath,
      undefined,
      context,
      finalSuggestions
    );
  }

  private static generateMemorySuggestions(memoryUsageMB?: number): string[] {
    const suggestions: string[] = [];
    
    if (memoryUsageMB) {
      suggestions.push(`Memory usage was ${memoryUsageMB}MB when error occurred`);
    }
    
    suggestions.push('Reduce batch processing concurrency');
    suggestions.push('Enable memory throttling in batch processor');
    suggestions.push('Close other memory-intensive applications');
    suggestions.push('Process files in smaller batches');
    suggestions.push('Consider increasing available system memory');
    suggestions.push('Enable garbage collection between batches');
    
    return suggestions;
  }
}

/**
 * Error handler and utilities for managing parsing errors
 */
export class ParseErrorHandler {
  private errorHistory: ParseErrorDetails[] = [];
  private maxHistorySize = 1000;
  private errorCounts = new Map<string, number>();
  
  /**
   * Log and store a parsing error
   */
  logError(error: ParseErrorDetails | Error): ParseErrorDetails {
    let errorDetails: ParseErrorDetails;
    
    if (this.isParseErrorDetails(error)) {
      errorDetails = error;
    } else if (error instanceof Error) {
      // Convert generic Error to ParseErrorDetails
      errorDetails = {
        type: 'runtime',
        message: error.message,
        severity: 'error',
        timestamp: Date.now(),
        code: 'GENERIC_ERROR',
        stackTrace: error.stack,
        suggestions: ['Check logs for additional details', 'Retry the operation'],
      };
    } else {
      errorDetails = error;
    }
    
    // Store in history
    this.errorHistory.push(errorDetails);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
    
    // Update error counts
    const errorKey = `${errorDetails.type}:${errorDetails.code}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    
    // Log to console or external logging system
    this.logToConsole(errorDetails);
    
    return errorDetails;
  }

  /**
   * Type guard to check if an error is ParseErrorDetails
   */
  private isParseErrorDetails(error: any): error is ParseErrorDetails {
    return error && 
           typeof error.type === 'string' && 
           typeof error.message === 'string' &&
           typeof error.severity === 'string' &&
           typeof error.timestamp === 'number' &&
           typeof error.code === 'string';
  }
  
  /**
   * Create a syntax error from Tree-sitter parse information
   */
  createSyntaxError(
    message: string,
    filePath?: string,
    position?: { line: number; column: number; offset?: number },
    treeSitterNode?: any,
    language?: string
  ): ParseSyntaxError {
    const context = treeSitterNode ? `Node: ${treeSitterNode.type}` : undefined;
    const treeSitterInfo = treeSitterNode ? {
      nodeType: treeSitterNode.type,
      parentNodeType: treeSitterNode.parent?.type,
    } : undefined;
    
    return new ParseSyntaxError(
      message,
      filePath,
      position,
      context,
      [],
      treeSitterInfo,
      language
    );
  }
  
  /**
   * Create a grammar error
   */
  createGrammarError(
    message: string,
    language?: string,
    filePath?: string,
    context?: string
  ): ParseGrammarError {
    return new ParseGrammarError(message, language, filePath, context);
  }
  
  /**
   * Create a runtime error
   */
  createRuntimeError(
    message: string,
    filePath?: string,
    context?: string,
    severity: ErrorSeverity = 'error'
  ): ParseRuntimeError {
    return new ParseRuntimeError(message, filePath, context, [], severity);
  }
  
  /**
   * Create a file system error
   */
  createFileSystemError(
    message: string,
    filePath?: string,
    context?: string
  ): ParseFileSystemError {
    return new ParseFileSystemError(message, filePath, context);
  }
  
  /**
   * Create a network error
   */
  createNetworkError(message: string, context?: string): ParseNetworkError {
    return new ParseNetworkError(message, context);
  }
  
  /**
   * Create a configuration error
   */
  createConfigurationError(message: string, context?: string): ParseConfigurationError {
    return new ParseConfigurationError(message, context);
  }
  
  /**
   * Create a timeout error
   */
  createTimeoutError(
    message: string,
    filePath?: string,
    timeoutMs?: number,
    context?: string
  ): ParseTimeoutError {
    return new ParseTimeoutError(message, filePath, timeoutMs, context);
  }
  
  /**
   * Create a memory error
   */
  createMemoryError(
    message: string,
    filePath?: string,
    memoryUsageMB?: number,
    context?: string
  ): ParseMemoryError {
    return new ParseMemoryError(message, filePath, memoryUsageMB, context);
  }
  
  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Map<ParseErrorType, number>;
    errorsByCode: Map<string, number>;
    recentErrors: ParseErrorDetails[];
    topErrors: Array<{ key: string; count: number }>;
  } {
    const errorsByType = new Map<ParseErrorType, number>();
    const errorsByCode = new Map<string, number>();
    
    for (const error of this.errorHistory) {
      errorsByType.set(error.type, (errorsByType.get(error.type) || 0) + 1);
      errorsByCode.set(error.code, (errorsByCode.get(error.code) || 0) + 1);
    }
    
    const topErrors = Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ key, count }));
    
    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      errorsByCode,
      recentErrors: this.errorHistory.slice(-10),
      topErrors,
    };
  }
  
  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
    this.errorCounts.clear();
  }
  
  /**
   * Log error to console with formatting
   */
  private logToConsole(error: ParseErrorDetails): void {
    const timestamp = new Date(error.timestamp).toISOString();
    const location = error.filePath 
      ? `${error.filePath}${error.position ? `:${error.position.line}:${error.position.column}` : ''}`
      : 'unknown';
    
    console.error(`[${timestamp}] ${error.severity.toUpperCase()} ${error.type}/${error.code}: ${error.message}`);
    console.error(`  Location: ${location}`);
    
    if (error.context) {
      console.error(`  Context: ${error.context}`);
    }
    
    if (error.suggestions && error.suggestions.length > 0) {
      console.error('  Suggestions:');
      error.suggestions.forEach(suggestion => {
        console.error(`    - ${suggestion}`);
      });
    }
    
    if (error.stackTrace && error.severity === 'error') {
      console.error('  Stack trace:');
      console.error(error.stackTrace);
    }
  }
  
  /**
   * Check if an error is recoverable
   */
  isRecoverable(error: ParseErrorDetails): boolean {
    // Network and timeout errors are often recoverable
    if (error.type === 'network' || error.type === 'timeout') {
      return true;
    }
    
    // File system errors might be recoverable (permissions, temp issues)
    if (error.type === 'file_system') {
      return !error.message.includes('ENOENT'); // File not found is not recoverable
    }
    
    // Memory errors might be recoverable with different settings
    if (error.type === 'memory') {
      return true;
    }
    
    // Syntax errors are generally not recoverable without code changes
    if (error.type === 'syntax') {
      return false;
    }
    
    // Configuration errors need manual intervention
    if (error.type === 'configuration') {
      return false;
    }
    
    // Grammar and runtime errors might be recoverable
    return error.type === 'grammar' || error.type === 'runtime';
  }
  
  /**
   * Suggest retry strategy for recoverable errors
   */
  getRetryStrategy(error: ParseErrorDetails): {
    shouldRetry: boolean;
    retryDelayMs: number;
    maxRetries: number;
    backoffMultiplier: number;
  } | null {
    if (!this.isRecoverable(error)) {
      return null;
    }
    
    switch (error.type) {
      case 'network':
        return {
          shouldRetry: true,
          retryDelayMs: 1000,
          maxRetries: 3,
          backoffMultiplier: 2,
        };
      
      case 'timeout':
        return {
          shouldRetry: true,
          retryDelayMs: 500,
          maxRetries: 2,
          backoffMultiplier: 1.5,
        };
      
      case 'memory':
        return {
          shouldRetry: true,
          retryDelayMs: 2000,
          maxRetries: 2,
          backoffMultiplier: 2,
        };
      
      case 'file_system':
        return {
          shouldRetry: true,
          retryDelayMs: 500,
          maxRetries: 2,
          backoffMultiplier: 1.5,
        };
      
      default:
        return {
          shouldRetry: true,
          retryDelayMs: 1000,
          maxRetries: 1,
          backoffMultiplier: 1,
        };
    }
  }
}

// Global error handler instance
export const parseErrorHandler = new ParseErrorHandler();