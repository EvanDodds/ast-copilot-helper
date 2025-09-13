/**
 * Parse Batch Orchestrator
 * Enhanced batch processing system specifically designed for parse command workflow
 * Wraps and orchestrates the existing BatchProcessor with additional features
 */

import { EventEmitter } from 'events';
import { BatchProcessor } from '../parser/batch-processor.js';
import type { 
  BatchProcessingOptions, 
  BatchProcessingResult,
  BatchProcessingProgress
} from '../parser/batch-processor.js';
import type { Config } from '../types.js';
import type { ParseOptions } from './parse.js';
import { createLogger } from '../logging/index.js';
import { createParser } from '../parser/parsers/index.js';
import { TreeSitterGrammarManager } from '../parser/grammar-manager.js';

/**
 * Enhanced batch processing options for parse command
 */
export interface ParseBatchOptions extends BatchProcessingOptions {
  /** Enable real-time progress display */
  showProgress?: boolean;
  
  /** Progress update interval in milliseconds */
  progressInterval?: number;
  
  /** Enable detailed performance metrics */
  enablePerformanceMetrics?: boolean;
  
  /** Memory threshold for garbage collection trigger (MB) */
  memoryThresholdMB?: number;
  
  /** Enable automatic memory cleanup */
  autoMemoryCleanup?: boolean;
  
  /** Chunk processing delay for memory relief (ms) */
  chunkDelay?: number;
  
  /** Priority queue for file processing order */
  processingPriority?: 'size' | 'complexity' | 'modified' | 'alphabetical';
}

/**
 * Enhanced progress information for parse command
 */
export interface ParseBatchProgress extends BatchProcessingProgress {
  /** Processing phase */
  phase: 'validation' | 'parsing' | 'output' | 'cleanup';
  
  /** Current chunk being processed */
  currentChunk: number;
  
  /** Total chunks to process */
  totalChunks: number;
  
  /** Files per second processing rate */
  filesPerSecond: number;
  
  /** Estimated completion time */
  estimatedCompletion: Date;
  
  /** Memory pressure level */
  memoryPressure: 'low' | 'medium' | 'high';
}

/**
 * Parse batch orchestrator events interface
 */
export interface ParseBatchOrchestratorEvents {
  'progress': [ParseBatchProgress];
  'chunk-complete': [{ chunk: number; totalChunks: number; files: number }];
  'memory-warning': [{ memoryUsageMB: number; threshold: number }];
  'performance-update': [{ 
    rate: number; 
    avgParseTime: number; 
    memoryUsage: number;
    cacheHitRate: number;
  }];
  'phase-change': [{ 
    from: ParseBatchProgress['phase']; 
    to: ParseBatchProgress['phase'] 
  }];
}

/**
 * Parse batch orchestrator for enhanced batch processing
 */
export class ParseBatchOrchestrator extends EventEmitter<ParseBatchOrchestratorEvents> {
  private logger = createLogger();
  private batchProcessor: BatchProcessor;
  private currentPhase: ParseBatchProgress['phase'] = 'validation';
  private progressInterval?: NodeJS.Timeout;
  private memoryMonitor?: NodeJS.Timeout;
  private startTime = 0;
  private lastProgressTime = 0;
  private processedChunks = 0;
  private totalChunks = 0;
  
  // Performance tracking
  private performanceMetrics = {
    totalFilesProcessed: 0,
    totalParseTime: 0,
    totalMemoryUsage: 0,
    cacheHits: 0,
    cacheRequests: 0,
    chunksProcessed: 0,
    gcRuns: 0
  };

  private constructor(batchProcessor: BatchProcessor) {
    super();
    this.batchProcessor = batchProcessor;
    this.setupEventListeners();
  }

  /**
   * Create a new ParseBatchOrchestrator instance
   */
  static async create(): Promise<ParseBatchOrchestrator> {
    const grammarManager = new TreeSitterGrammarManager();
    const parser = await createParser(grammarManager);
    const batchProcessor = new BatchProcessor(parser as any);
    
    return new ParseBatchOrchestrator(batchProcessor);
  }

  /**
   * Process files with enhanced batch orchestration
   */
  async processFiles(
    files: string[],
    parseOptions: ParseOptions,
    config: Config,
    progressCallback?: (progress: ParseBatchProgress) => void
  ): Promise<BatchProcessingResult> {
    this.startTime = Date.now();
    this.lastProgressTime = this.startTime;
    this.processedChunks = 0;
    
    try {
      // Create enhanced batch options
      const batchOptions = this.createEnhancedBatchOptions(parseOptions, config);
      
      // Calculate chunks for progress tracking
      const chunkSize = batchOptions.chunkSize || 50;
      this.totalChunks = Math.ceil(files.length / chunkSize);
      
      // Setup progress monitoring if requested
      if (batchOptions.showProgress && progressCallback) {
        this.setupProgressMonitoring(progressCallback, batchOptions.progressInterval);
      }
      
      // Setup memory monitoring
      if (batchOptions.autoMemoryCleanup) {
        this.setupMemoryMonitoring(batchOptions);
      }

      this.logger.info('Starting enhanced batch processing', {
        totalFiles: files.length,
        totalChunks: this.totalChunks,
        chunkSize,
        concurrency: batchOptions.concurrency,
        memoryThreshold: batchOptions.memoryThresholdMB
      });

      // Phase 1: Validation
      await this.setPhase('validation');
      
      // Phase 2: Processing with orchestration
      await this.setPhase('parsing');
      const result = await this.orchestratedProcessing(files, batchOptions);
      
      // Phase 3: Cleanup
      await this.setPhase('cleanup');
      await this.cleanup();

      this.logger.info('Enhanced batch processing completed', {
        totalFiles: files.length,
        successful: result.summary.successful,
        failed: result.summary.failed,
        totalTimeMs: Date.now() - this.startTime,
        chunksProcessed: this.processedChunks,
        gcRuns: this.performanceMetrics.gcRuns
      });

      return result;

    } catch (error) {
      this.logger.error('Enhanced batch processing failed', {
        error: (error as Error).message,
        totalFiles: files.length,
        processedChunks: this.processedChunks
      });
      throw error;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Orchestrated processing with enhanced features
   */
  private async orchestratedProcessing(
    files: string[],
    options: ParseBatchOptions
  ): Promise<BatchProcessingResult> {
    // Prioritize files if requested
    const prioritizedFiles = this.prioritizeFiles(files, options.processingPriority);
    
    // Process with the existing BatchProcessor
    const result = await this.batchProcessor.processBatch(prioritizedFiles, options);
    
    // Update performance metrics
    this.updatePerformanceMetrics(result);
    
    return result;
  }

  /**
   * Create enhanced batch processing options
   */
  private createEnhancedBatchOptions(
    parseOptions: ParseOptions,
    config: Config
  ): ParseBatchOptions {
    const baseOptions: ParseBatchOptions = {
      concurrency: config.concurrency || 4,
      maxMemoryMB: 1024,
      continueOnError: !parseOptions.force,
      includeNormalization: true,
      maxFileSizeMB: 10,
      parseTimeoutMs: 30000,
      enableMetrics: parseOptions.outputStats || false,
      chunkSize: parseOptions.batchSize || 50,
      enableCache: true,
      includeContentHashes: true,
      
      // Enhanced options
      showProgress: parseOptions.outputStats || false,
      progressInterval: 1000, // 1 second
      enablePerformanceMetrics: parseOptions.outputStats || false,
      memoryThresholdMB: 512,
      autoMemoryCleanup: true,
      chunkDelay: 100, // 100ms delay between chunks
      processingPriority: 'size' // Process smaller files first for faster feedback
    };

    return baseOptions;
  }

  /**
   * Prioritize files based on processing strategy
   */
  private prioritizeFiles(files: string[], priority?: ParseBatchOptions['processingPriority']): string[] {
    if (!priority || priority === 'alphabetical') {
      return [...files].sort();
    }

    // For now, just return sorted files
    // In a full implementation, we would sort by file size, complexity, etc.
    return [...files].sort();
  }

  /**
   * Setup progress monitoring with intervals
   */
  private setupProgressMonitoring(
    callback: (progress: ParseBatchProgress) => void,
    interval = 1000
  ): void {
    this.progressInterval = setInterval(() => {
      const progress = this.createCurrentProgress();
      callback(progress);
    }, interval);
  }

  /**
   * Setup memory monitoring and cleanup
   */
  private setupMemoryMonitoring(options: ParseBatchOptions): void {
    const checkInterval = 5000; // Check every 5 seconds
    
    this.memoryMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      const memoryUsageMB = memUsage.heapUsed / (1024 * 1024);
      
      if (options.memoryThresholdMB && memoryUsageMB > options.memoryThresholdMB) {
        this.emit('memory-warning', {
          memoryUsageMB,
          threshold: options.memoryThresholdMB
        });
        
        // Trigger garbage collection if available
        if (global.gc) {
          global.gc();
          this.performanceMetrics.gcRuns++;
          
          this.logger.debug('Triggered garbage collection', {
            beforeMB: memoryUsageMB,
            afterMB: process.memoryUsage().heapUsed / (1024 * 1024),
            threshold: options.memoryThresholdMB
          });
        }
      }
    }, checkInterval);
  }

  /**
   * Create current progress snapshot
   */
  private createCurrentProgress(): ParseBatchProgress {
    const now = Date.now();
    const elapsed = now - this.startTime;
    const memUsage = process.memoryUsage();
    const memoryUsageMB = memUsage.heapUsed / (1024 * 1024);
    
    // Calculate rates and estimates
    const filesPerSecond = this.performanceMetrics.totalFilesProcessed / Math.max(1, elapsed / 1000);
    const estimatedCompletion = new Date(now + (elapsed / Math.max(1, this.processedChunks)) * (this.totalChunks - this.processedChunks));
    
    // Determine memory pressure
    let memoryPressure: ParseBatchProgress['memoryPressure'] = 'low';
    if (memoryUsageMB > 256) memoryPressure = 'medium';
    if (memoryUsageMB > 512) memoryPressure = 'high';

    return {
      completed: this.performanceMetrics.totalFilesProcessed,
      total: this.totalChunks * 50, // Estimate based on chunk size
      currentFile: 'processing...',
      rate: filesPerSecond,
      estimatedTimeRemaining: Math.max(0, estimatedCompletion.getTime() - now),
      memoryUsageMB,
      successful: 0, // Will be updated by actual processing
      failed: 0,
      skipped: 0,
      avgParseTimeMs: this.performanceMetrics.totalFilesProcessed > 0 
        ? this.performanceMetrics.totalParseTime / this.performanceMetrics.totalFilesProcessed 
        : 0,
      
      // Enhanced fields
      phase: this.currentPhase,
      currentChunk: this.processedChunks,
      totalChunks: this.totalChunks,
      filesPerSecond,
      estimatedCompletion,
      memoryPressure
    };
  }

  /**
   * Set current processing phase
   */
  private async setPhase(newPhase: ParseBatchProgress['phase']): Promise<void> {
    const oldPhase = this.currentPhase;
    this.currentPhase = newPhase;
    
    this.emit('phase-change', { from: oldPhase, to: newPhase });
    
    this.logger.debug('Processing phase changed', {
      from: oldPhase,
      to: newPhase,
      elapsedMs: Date.now() - this.startTime
    });
  }

  /**
   * Setup event listeners for the batch processor
   */
  private setupEventListeners(): void {
    this.batchProcessor.on('progress', (progress: BatchProcessingProgress) => {
      this.performanceMetrics.totalFilesProcessed = progress.completed;
      
      // Emit performance updates periodically
      if (Date.now() - this.lastProgressTime > 5000) { // Every 5 seconds
        this.emit('performance-update', {
          rate: progress.rate,
          avgParseTime: progress.avgParseTimeMs,
          memoryUsage: progress.memoryUsageMB,
          cacheHitRate: this.performanceMetrics.cacheRequests > 0 
            ? this.performanceMetrics.cacheHits / this.performanceMetrics.cacheRequests 
            : 0
        });
        
        this.lastProgressTime = Date.now();
      }
    });
  }

  /**
   * Update performance metrics from batch result
   */
  private updatePerformanceMetrics(result: BatchProcessingResult): void {
    this.performanceMetrics.totalFilesProcessed = result.summary.totalFiles;
    this.performanceMetrics.totalParseTime = result.summary.totalTimeMs;
    this.performanceMetrics.totalMemoryUsage = result.summary.memoryStats.peakUsageMB;
    this.performanceMetrics.chunksProcessed = this.processedChunks;
  }

  /**
   * Clean up resources and timers
   */
  private async cleanup(): Promise<void> {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = undefined;
    }
    
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = undefined;
    }
    
    // Force a final garbage collection if available
    if (global.gc) {
      global.gc();
      this.performanceMetrics.gcRuns++;
    }
    
    this.logger.debug('Parse batch orchestrator cleanup completed', {
      totalTimeMs: Date.now() - this.startTime,
      gcRuns: this.performanceMetrics.gcRuns
    });
  }

  /**
   * Get performance metrics summary
   */
  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Dispose of the orchestrator and underlying batch processor
   */
  async dispose(): Promise<void> {
    await this.cleanup();
    this.removeAllListeners();
  }
}