/**
 * Advanced batch processing system for AST parsing with memory management,
 * detailed progress reporting, performance monitoring, and error aggregation.
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { BaseParser } from './parsers/base-parser.js';
import { parseErrorHandler } from './parse-errors.js';
import type { ParseResult, ASTNode } from './types.js';
import { isFileSupported, detectLanguage } from './languages.js';

export interface BatchProcessingOptions {
  /** Maximum number of concurrent parsing operations */
  concurrency?: number;
  /** Maximum memory usage in MB before throttling */
  maxMemoryMB?: number;
  /** Continue processing even if some files fail */
  continueOnError?: boolean;
  /** Include normalized AST nodes in results */
  includeNormalization?: boolean;
  /** Maximum file size in MB to process */
  maxFileSizeMB?: number;
  /** Timeout for individual file parsing in ms */
  parseTimeoutMs?: number;
  /** Enable detailed performance metrics */
  enableMetrics?: boolean;
  /** Chunk size for processing large batches */
  chunkSize?: number;
  /** Cache parsed results to avoid re-parsing */
  enableCache?: boolean;
  /** Include file content hashes for cache validation */
  includeContentHashes?: boolean;
}

export interface BatchProcessingProgress {
  /** Number of files completed */
  completed: number;
  /** Total number of files to process */
  total: number;
  /** Currently processing file */
  currentFile: string;
  /** Processing rate (files/second) */
  rate: number;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining: number;
  /** Current memory usage in MB */
  memoryUsageMB: number;
  /** Number of successful parses */
  successful: number;
  /** Number of failed parses */
  failed: number;
  /** Number of skipped files */
  skipped: number;
  /** Average parse time per file in ms */
  avgParseTimeMs: number;
}

export interface BatchProcessingResult {
  /** Map of file paths to parse results */
  results: Map<string, ParseResult>;
  /** Processing summary statistics */
  summary: BatchProcessingSummary;
  /** Aggregated errors by type */
  errorSummary: Map<string, AggregatedError[]>;
  /** Performance metrics if enabled */
  metrics?: BatchProcessingMetrics;
}

export interface BatchProcessingSummary {
  /** Total number of files processed */
  totalFiles: number;
  /** Number of successfully parsed files */
  successful: number;
  /** Number of failed files */
  failed: number;
  /** Number of skipped files (unsupported, too large, etc.) */
  skipped: number;
  /** Total processing time in ms */
  totalTimeMs: number;
  /** Total AST nodes generated */
  totalNodes: number;
  /** Total lines of code processed */
  totalLines: number;
  /** Memory usage statistics */
  memoryStats: {
    peakUsageMB: number;
    avgUsageMB: number;
    gcRuns: number;
  };
}

export interface AggregatedError {
  /** Error type (syntax, runtime, grammar, etc.) */
  type: string;
  /** Error message */
  message: string;
  /** Number of occurrences */
  count: number;
  /** Sample file paths where this error occurred */
  sampleFiles: string[];
  /** First occurrence context */
  context?: string;
}

export interface BatchProcessingMetrics {
  /** Processing rate over time */
  rateHistory: Array<{ timestamp: number; rate: number }>;
  /** Memory usage over time */
  memoryHistory: Array<{ timestamp: number; usage: number }>;
  /** Parse time distribution */
  parseTimeDistribution: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  /** Language-specific statistics */
  languageStats: Map<string, {
    fileCount: number;
    totalNodes: number;
    avgParseTime: number;
    errorRate: number;
  }>;
}

export class BatchProcessor extends EventEmitter {
  private parser: BaseParser;
  private cache = new Map<string, { result: ParseResult; hash: string; timestamp: number }>();
  private memoryMonitor?: NodeJS.Timeout;
  private performanceMetrics: {
    startTime: number;
    parseTimes: number[];
    rateHistory: Array<{ timestamp: number; rate: number }>;
    memoryHistory: Array<{ timestamp: number; usage: number }>;
    languageStats: Map<string, { files: number; nodes: number; parseTime: number; errors: number }>;
  } = {
    startTime: 0,
    parseTimes: [],
    rateHistory: [],
    memoryHistory: [],
    languageStats: new Map(),
  };

  constructor(parser: BaseParser) {
    super();
    this.parser = parser;
  }

  /**
   * Process a batch of files with advanced features and monitoring
   */
  async processBatch(
    files: string[],
    options: BatchProcessingOptions = {}
  ): Promise<BatchProcessingResult> {
    const opts = this.mergeOptions(options);
    const startTime = performance.now();
    this.performanceMetrics.startTime = startTime;

    // Initialize monitoring
    if (opts.enableMetrics) {
      this.startMemoryMonitoring();
    }

    const results = new Map<string, ParseResult>();
    const errorSummary = new Map<string, AggregatedError[]>();
    const summary: BatchProcessingSummary = {
      totalFiles: files.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      totalTimeMs: 0,
      totalNodes: 0,
      totalLines: 0,
      memoryStats: {
        peakUsageMB: 0,
        avgUsageMB: 0,
        gcRuns: 0,
      },
    };

    try {
      // Filter and validate files
      const { supportedFiles, unsupportedFiles, oversizedFiles } = await this.validateFiles(files, opts);
      
      // Handle unsupported files
      this.handleUnsupportedFiles(unsupportedFiles, 'unsupported', results, summary);
      this.handleUnsupportedFiles(oversizedFiles, 'oversized', results, summary);

      // Process supported files in chunks
      await this.processFileChunks(supportedFiles, opts, results, summary, errorSummary);

      // Calculate final metrics
      summary.totalTimeMs = performance.now() - startTime;
      this.calculateMemoryStats(summary);

      const metrics = opts.enableMetrics ? this.generateMetrics() : undefined;

      return {
        results,
        summary,
        errorSummary,
        metrics,
      };

    } finally {
      if (this.memoryMonitor) {
        clearInterval(this.memoryMonitor);
      }
    }
  }

  /**
   * Process files in manageable chunks with concurrency control
   */
  private async processFileChunks(
    files: string[],
    options: BatchProcessingOptions,
    results: Map<string, ParseResult>,
    summary: BatchProcessingSummary,
    errorSummary: Map<string, AggregatedError[]>
  ): Promise<void> {
    const chunkSize = options.chunkSize || options.concurrency || 4;
    let processedCount = 0;

    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      
      // Check memory before processing chunk
      if (await this.shouldThrottleForMemory(options.maxMemoryMB)) {
        await this.waitForMemoryRelief();
      }

      await this.processFileChunk(chunk, options, results, summary, errorSummary, processedCount);
      processedCount += chunk.length;

      // Force garbage collection periodically if available
      if (global.gc && processedCount % (chunkSize * 4) === 0) {
        global.gc();
        summary.memoryStats.gcRuns++;
      }
    }
  }

  /**
   * Process a single chunk of files concurrently
   */
  private async processFileChunk(
    files: string[],
    options: BatchProcessingOptions,
    results: Map<string, ParseResult>,
    summary: BatchProcessingSummary,
    errorSummary: Map<string, AggregatedError[]>,
    baseCompletedCount: number
  ): Promise<void> {
    const promises = files.map(async (file, index) => {
      const completedCount = baseCompletedCount + index + 1;
      return this.processFile(file, options, completedCount, files.length + baseCompletedCount);
    });

    const fileResults = options.continueOnError
      ? await Promise.allSettled(promises)
      : await Promise.all(promises);

    // Process results
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) {
continue;
} // Skip undefined files
      
      const absolutePath = path.resolve(file);
      
      if (options.continueOnError) {
        const settledResult = fileResults[i] as PromiseSettledResult<ParseResult>;
        if (settledResult && settledResult.status === 'rejected') {
          const error = (settledResult as PromiseRejectedResult).reason;
          results.set(absolutePath, this.createErrorResult(file, error));
          summary.failed++;
          this.aggregateError(errorSummary, 'runtime', error.message, file);
        } else if (settledResult && settledResult.status === 'fulfilled') {
          const result = (settledResult as PromiseFulfilledResult<ParseResult>).value;
          this.processParseResult(file, absolutePath, result, results, summary, errorSummary);
        }
      } else {
        const result = fileResults[i] as ParseResult;
        this.processParseResult(file, absolutePath, result, results, summary, errorSummary);
      }
    }
  }

  /**
   * Process a successful parse result and update statistics
   */
  private processParseResult(
    file: string,
    absolutePath: string,
    result: ParseResult,
    results: Map<string, ParseResult>,
    summary: BatchProcessingSummary,
    errorSummary: Map<string, AggregatedError[]>
  ): void {
    results.set(absolutePath, result);
    
    if (result.errors.length > 0) {
      summary.failed++;
      for (const error of result.errors) {
        this.aggregateError(errorSummary, error.type, error.message, file);
      }
    } else {
      summary.successful++;
    }
    
    summary.totalNodes += result.nodes.length;
    summary.totalLines += this.estimateLineCount(result.nodes);
    this.updateLanguageStats(result.language, result);
  }

  /**
   * Process a single file with timeout and caching
   */
  private async processFile(
    file: string,
    options: BatchProcessingOptions,
    completed: number,
    total: number
  ): Promise<ParseResult> {
    const absolutePath = path.resolve(file);

    try {
      // Check cache if enabled
      if (options.enableCache) {
        const cached = await this.getCachedResult(absolutePath, options.includeContentHashes);
        if (cached) {
          this.emitProgress(completed, total, file, cached);
          return cached;
        }
      }

      // Apply timeout if specified
      const parsePromise = this.parser.parseFile(absolutePath);
      const result = options.parseTimeoutMs
        ? await this.withTimeout(parsePromise, options.parseTimeoutMs, file)
        : await parsePromise;

      // Cache result if enabled
      if (options.enableCache) {
        await this.cacheResult(absolutePath, result, options.includeContentHashes);
      }

      this.emitProgress(completed, total, file, result);
      return result;

    } catch (error) {
      const errorResult = this.createErrorResult(file, error);
      this.emitProgress(completed, total, file, errorResult);
      throw error;
    }
  }

  /**
   * Validate files before processing
   */
  private async validateFiles(
    files: string[],
    options: BatchProcessingOptions
  ): Promise<{
    supportedFiles: string[];
    unsupportedFiles: string[];
    oversizedFiles: string[];
  }> {
    const supportedFiles: string[] = [];
    const unsupportedFiles: string[] = [];
    const oversizedFiles: string[] = [];

    for (const file of files) {
      try {
        // Check if file type is supported
        if (!isFileSupported(file)) {
          unsupportedFiles.push(file);
          continue;
        }

        // Check file size if limit specified
        if (options.maxFileSizeMB) {
          const stats = await fs.stat(file);
          const sizeMB = stats.size / (1024 * 1024);
          if (sizeMB > options.maxFileSizeMB) {
            oversizedFiles.push(file);
            continue;
          }
        }

        supportedFiles.push(file);
      } catch (error) {
        // File doesn't exist or can't be accessed
        unsupportedFiles.push(file);
      }
    }

    return { supportedFiles, unsupportedFiles, oversizedFiles };
  }

  /**
   * Handle unsupported files by creating appropriate error results
   */
  private handleUnsupportedFiles(
    files: string[],
    reason: 'unsupported' | 'oversized',
    results: Map<string, ParseResult>,
    summary: BatchProcessingSummary
  ): void {
    for (const file of files) {
      const absolutePath = path.resolve(file);
      const message = reason === 'unsupported' 
        ? `Unsupported file type: ${path.extname(file)}`
        : `File too large: exceeds size limit`;
      
      results.set(absolutePath, {
        nodes: [],
        errors: [{
          type: 'runtime',
          message,
          position: { line: 0, column: 0 },
          context: `filePath: ${file}`,
        }],
        language: detectLanguage(file) || '',
        parseTime: 0,
      });
      
      summary.skipped++;
    }
  }

  /**
   * Check if processing should be throttled due to memory constraints
   */
  private async shouldThrottleForMemory(maxMemoryMB?: number): Promise<boolean> {
    if (!maxMemoryMB) {
return false;
}
    
    const memUsage = process.memoryUsage();
    const currentMB = memUsage.heapUsed / (1024 * 1024);
    return currentMB > maxMemoryMB;
  }

  /**
   * Wait for memory usage to decrease
   */
  private async waitForMemoryRelief(): Promise<void> {
    return new Promise((resolve) => {
      const checkMemory = () => {
        if (global.gc) {
global.gc();
}
        
        setTimeout(() => {
          resolve();
        }, 100);
      };
      
      checkMemory();
    });
  }

  /**
   * Start monitoring memory usage for metrics
   */
  private startMemoryMonitoring(): void {
    this.memoryMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      const usageMB = memUsage.heapUsed / (1024 * 1024);
      
      this.performanceMetrics.memoryHistory.push({
        timestamp: Date.now(),
        usage: usageMB,
      });

      // Keep only last 1000 entries
      if (this.performanceMetrics.memoryHistory.length > 1000) {
        this.performanceMetrics.memoryHistory = this.performanceMetrics.memoryHistory.slice(-1000);
      }
    }, 1000);
  }

  /**
   * Execute a promise with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    context: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Parse timeout: ${context} (${timeoutMs}ms)`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Get cached result if valid
   */
  private async getCachedResult(
    filePath: string,
    includeContentHashes?: boolean
  ): Promise<ParseResult | null> {
    const cached = this.cache.get(filePath);
    if (!cached) {
return null;
}

    // If content hashes are not included, return cached result
    if (!includeContentHashes) {
return cached.result;
}

    // Validate content hasn't changed
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const hash = this.calculateContentHash(content);
      
      return hash === cached.hash ? cached.result : null;
    } catch {
      // File no longer exists or can't be read
      this.cache.delete(filePath);
      return null;
    }
  }

  /**
   * Cache a parse result
   */
  private async cacheResult(
    filePath: string,
    result: ParseResult,
    includeContentHashes?: boolean
  ): Promise<void> {
    let hash = '';
    
    if (includeContentHashes) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        hash = this.calculateContentHash(content);
      } catch {
        // Can't read file, don't cache
        return;
      }
    }

    this.cache.set(filePath, {
      result,
      hash,
      timestamp: Date.now(),
    });
  }

  /**
   * Calculate content hash for cache validation
   */
  private calculateContentHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Create error result for failed files
   */
  private createErrorResult(file: string, error: any): ParseResult {
    // Use the new error handling system to log and categorize errors
    let parsedError;
    
    if (error instanceof Error) {
      // Determine error type based on error message patterns
      if (error.message.includes('timeout')) {
        parsedError = parseErrorHandler.createTimeoutError(
          error.message,
          file,
          undefined,
          'Batch processing timeout'
        );
      } else if (error.message.includes('ENOENT') || error.message.includes('no such file')) {
        parsedError = parseErrorHandler.createFileSystemError(
          error.message,
          file,
          'File access during batch processing'
        );
      } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
        parsedError = parseErrorHandler.createFileSystemError(
          error.message,
          file,
          'Permission error during batch processing'
        );
      } else if (error.message.includes('memory') || error.message.includes('heap')) {
        parsedError = parseErrorHandler.createMemoryError(
          error.message,
          file,
          undefined,
          'Memory error during batch processing'
        );
      } else {
        parsedError = parseErrorHandler.createRuntimeError(
          error.message,
          file,
          'Batch processing runtime error'
        );
      }
    } else {
      parsedError = parseErrorHandler.createRuntimeError(
        `Processing error: ${String(error)}`,
        file,
        'Unknown error during batch processing'
      );
    }

    // Log the error using the error handling system
    parseErrorHandler.logError(parsedError);

    return {
      nodes: [],
      errors: [parsedError],
      language: detectLanguage(file) || '',
      parseTime: 0,
    };
  }

  /**
   * Aggregate error information for summary
   */
  private aggregateError(
    errorSummary: Map<string, AggregatedError[]>,
    type: string,
    message: string,
    file: string
  ): void {
    if (!errorSummary.has(type)) {
      errorSummary.set(type, []);
    }

    const errors = errorSummary.get(type)!;
    let existing = errors.find(e => e.message === message);
    
    if (!existing) {
      existing = {
        type,
        message,
        count: 0,
        sampleFiles: [],
        context: file,
      };
      errors.push(existing);
    }

    existing.count++;
    if (existing.sampleFiles.length < 5) {
      existing.sampleFiles.push(file);
    }
  }

  /**
   * Emit progress event with current status
   */
  private emitProgress(
    completed: number,
    total: number,
    currentFile: string,
    result?: ParseResult
  ): void {
    const now = performance.now();
    const elapsed = now - this.performanceMetrics.startTime;
    const rate = completed / (elapsed / 1000);
    const estimatedTimeRemaining = (total - completed) / rate;

    if (result) {
      this.performanceMetrics.parseTimes.push(result.parseTime);
    }

    // Update rate history
    this.performanceMetrics.rateHistory.push({
      timestamp: Date.now(),
      rate,
    });

    const memUsage = process.memoryUsage();
    const progress: BatchProcessingProgress = {
      completed,
      total,
      currentFile,
      rate: Math.round(rate * 100) / 100,
      estimatedTimeRemaining: Math.round(estimatedTimeRemaining),
      memoryUsageMB: Math.round(memUsage.heapUsed / (1024 * 1024) * 100) / 100,
      successful: 0, // Will be updated by caller
      failed: 0,     // Will be updated by caller
      skipped: 0,    // Will be updated by caller
      avgParseTimeMs: this.performanceMetrics.parseTimes.length > 0
        ? this.performanceMetrics.parseTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.parseTimes.length
        : 0,
    };

    this.emit('progress', progress);
  }

  /**
   * Update language-specific statistics
   */
  private updateLanguageStats(language: string, result: ParseResult): void {
    if (!this.performanceMetrics.languageStats.has(language)) {
      this.performanceMetrics.languageStats.set(language, {
        files: 0,
        nodes: 0,
        parseTime: 0,
        errors: 0,
      });
    }

    const stats = this.performanceMetrics.languageStats.get(language)!;
    stats.files++;
    stats.nodes += result.nodes.length;
    stats.parseTime += result.parseTime;
    stats.errors += result.errors.length;
  }

  /**
   * Estimate line count from AST nodes
   */
  private estimateLineCount(nodes: ASTNode[]): number {
    if (nodes.length === 0) {
return 0;
}
    
    let maxLine = 0;
    const countLines = (node: ASTNode) => {
      if (node.end && node.end.line > maxLine) {
        maxLine = node.end.line;
      }
      node.children?.forEach(countLines);
    };

    nodes.forEach(countLines);
    return maxLine + 1;
  }

  /**
   * Calculate memory usage statistics
   */
  private calculateMemoryStats(summary: BatchProcessingSummary): void {
    if (this.performanceMetrics.memoryHistory.length === 0) {
return;
}

    const usages = this.performanceMetrics.memoryHistory.map(h => h.usage);
    summary.memoryStats.peakUsageMB = Math.max(...usages);
    summary.memoryStats.avgUsageMB = usages.reduce((a, b) => a + b, 0) / usages.length;
  }

  /**
   * Generate comprehensive performance metrics
   */
  private generateMetrics(): BatchProcessingMetrics {
    const parseTimes = this.performanceMetrics.parseTimes.sort((a, b) => a - b);
    const parseTimeDistribution = {
      min: parseTimes.length > 0 ? (parseTimes[0] ?? 0) : 0,
      max: parseTimes.length > 0 ? (parseTimes[parseTimes.length - 1] ?? 0) : 0,
      avg: parseTimes.length > 0 ? parseTimes.reduce((a, b) => a + b, 0) / parseTimes.length : 0,
      p50: parseTimes.length > 0 ? (parseTimes[Math.floor(parseTimes.length * 0.5)] ?? 0) : 0,
      p95: parseTimes.length > 0 ? (parseTimes[Math.floor(parseTimes.length * 0.95)] ?? 0) : 0,
      p99: parseTimes.length > 0 ? (parseTimes[Math.floor(parseTimes.length * 0.99)] ?? 0) : 0,
    };

    const languageStats = new Map();
    for (const [language, stats] of this.performanceMetrics.languageStats) {
      languageStats.set(language, {
        fileCount: stats.files,
        totalNodes: stats.nodes,
        avgParseTime: stats.files > 0 ? stats.parseTime / stats.files : 0,
        errorRate: stats.files > 0 ? stats.errors / stats.files : 0,
      });
    }

    return {
      rateHistory: [...this.performanceMetrics.rateHistory],
      memoryHistory: [...this.performanceMetrics.memoryHistory],
      parseTimeDistribution,
      languageStats,
    };
  }

  /**
   * Merge user options with defaults
   */
  private mergeOptions(options: BatchProcessingOptions): Required<BatchProcessingOptions> {
    return {
      concurrency: options.concurrency ?? Math.min(8, Math.max(1, require('os').cpus().length)),
      maxMemoryMB: options.maxMemoryMB ?? 1024, // 1GB default
      continueOnError: options.continueOnError ?? true,
      includeNormalization: options.includeNormalization ?? false,
      maxFileSizeMB: options.maxFileSizeMB ?? 10, // 10MB default
      parseTimeoutMs: options.parseTimeoutMs ?? 30000, // 30s default
      enableMetrics: options.enableMetrics ?? true,
      chunkSize: options.chunkSize ?? (options.concurrency ?? 8),
      enableCache: options.enableCache ?? false,
      includeContentHashes: options.includeContentHashes ?? false,
    };
  }

  /**
   * Clear the internal cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    // This would need more sophisticated tracking for accurate hit rate
    return {
      size: this.cache.size,
      hitRate: 0, // Placeholder - would need hit/miss counters
    };
  }
}