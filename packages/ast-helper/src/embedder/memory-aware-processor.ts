/**
 * Memory-aware processing algorithms with adaptive strategies
 * and resource-conscious batch management
 */

import os from 'os';
import { createLogger } from '../logging/index.js';

export interface MemoryMetrics {
  /** Total system memory in bytes */
  totalMemory: number;
  /** Available system memory in bytes */
  availableMemory: number;
  /** Current process memory usage */
  processMemory: {
    rss: number; // Resident Set Size
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  /** Memory usage percentage */
  memoryUsagePercent: number;
  /** Available memory for processing */
  availableForProcessing: number;
}

export interface MemoryThresholds {
  /** Critical memory usage percentage (trigger emergency cleanup) */
  critical: number;
  /** High memory usage percentage (trigger optimization) */
  high: number;
  /** Normal memory usage percentage */
  normal: number;
  /** Low memory usage percentage (allow expansion) */
  low: number;
}

export interface ProcessingStrategy {
  /** Strategy name */
  name: string;
  /** Maximum batch size for this strategy */
  maxBatchSize: number;
  /** Processing approach */
  approach: 'sequential' | 'parallel' | 'streaming' | 'chunked';
  /** Memory overhead factor */
  memoryOverhead: number;
  /** CPU overhead factor */
  cpuOverhead: number;
  /** Cleanup frequency */
  cleanupFrequency: number;
}

export interface AdaptiveProcessingConfig {
  /** Memory thresholds for different strategies */
  memoryThresholds: MemoryThresholds;
  /** Available processing strategies */
  strategies: ProcessingStrategy[];
  /** Memory monitoring interval in ms */
  monitoringInterval: number;
  /** Enable garbage collection hints */
  enableGcHints: boolean;
  /** Emergency cleanup threshold */
  emergencyCleanupThreshold: number;
  /** Buffer for memory calculations (safety margin) */
  memoryBuffer: number;
}

export interface ProcessingContext<T> {
  /** Items to process */
  items: T[];
  /** Processing function */
  processor: (batch: T[]) => Promise<any[]>;
  /** Progress callback */
  onProgress?: (completed: number, total: number) => void;
  /** Memory warning callback */
  onMemoryWarning?: (usage: MemoryMetrics) => void;
  /** Strategy change callback */
  onStrategyChange?: (oldStrategy: ProcessingStrategy, newStrategy: ProcessingStrategy) => void;
}

export interface ProcessingResult<T> {
  /** Processing results */
  results: T[];
  /** Processing statistics */
  stats: {
    totalItems: number;
    successfulItems: number;
    failedItems: number;
    totalTime: number;
    strategyChanges: number;
    memoryCleanups: number;
    peakMemoryUsage: number;
    averageMemoryUsage: number;
  };
  /** Memory usage history */
  memoryHistory: MemoryMetrics[];
}

/**
 * Default configuration for memory-aware processing
 */
const DEFAULT_CONFIG: AdaptiveProcessingConfig = {
  memoryThresholds: {
    critical: 90, // 90% memory usage
    high: 75,     // 75% memory usage
    normal: 60,   // 60% memory usage
    low: 40,      // 40% memory usage
  },
  strategies: [
    {
      name: 'emergency',
      maxBatchSize: 1,
      approach: 'sequential',
      memoryOverhead: 0.1,
      cpuOverhead: 0.2,
      cleanupFrequency: 1, // Cleanup after every batch
    },
    {
      name: 'conservative',
      maxBatchSize: 8,
      approach: 'sequential',
      memoryOverhead: 0.3,
      cpuOverhead: 0.5,
      cleanupFrequency: 3,
    },
    {
      name: 'balanced',
      maxBatchSize: 32,
      approach: 'parallel',
      memoryOverhead: 0.6,
      cpuOverhead: 1.0,
      cleanupFrequency: 5,
    },
    {
      name: 'aggressive',
      maxBatchSize: 128,
      approach: 'parallel',
      memoryOverhead: 1.2,
      cpuOverhead: 1.5,
      cleanupFrequency: 10,
    },
  ],
  monitoringInterval: 1000, // 1 second
  enableGcHints: true,
  emergencyCleanupThreshold: 95,
  memoryBuffer: 0.1, // 10% safety buffer
};

/**
 * Memory-aware adaptive processing engine
 */
export class MemoryAwareProcessor {
  private config: AdaptiveProcessingConfig;
  private currentStrategy: ProcessingStrategy;
  private memoryHistory: MemoryMetrics[] = [];
  private monitoringTimer?: NodeJS.Timeout;
  private logger = createLogger({ operation: 'MemoryAwareProcessor' });

  constructor(config: Partial<AdaptiveProcessingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Ensure we have at least one strategy
    if (this.config.strategies.length === 0) {
      throw new Error('At least one processing strategy must be configured');
    }
    
    this.currentStrategy = this.config.strategies.find(s => s.name === 'balanced') 
      || this.config.strategies[0]!;
    
    this.logger.info('Memory-aware processor initialized', {
      initialStrategy: this.currentStrategy.name,
      memoryThresholds: this.config.memoryThresholds
    });

    // Start memory monitoring
    this.startMemoryMonitoring();
  }

  /**
   * Process items with memory-aware adaptive strategies
   */
  async processWithMemoryAwareness<T, R>(
    context: ProcessingContext<T>
  ): Promise<ProcessingResult<R>> {
    const startTime = Date.now();
    const results: R[] = [];
    let successfulItems = 0;
    let failedItems = 0;
    let strategyChanges = 0;
    let memoryCleanups = 0;
    let peakMemoryUsage = 0;
    let totalMemoryUsage = 0;
    let memoryMeasurements = 0;

    this.logger.info('Starting memory-aware processing', {
      totalItems: context.items.length,
      initialStrategy: this.currentStrategy.name
    });

    try {
      const batches = this.createAdaptiveBatches(context.items);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        if (!batch) continue; // Skip undefined batches
        
        const memoryBefore = this.getCurrentMemoryMetrics();
        
        // Check if strategy needs to change
        const newStrategy = this.selectOptimalStrategy(memoryBefore);
        if (newStrategy.name !== this.currentStrategy.name) {
          this.logger.info('Strategy changed', {
            from: this.currentStrategy.name,
            to: newStrategy.name,
            memoryUsage: `${memoryBefore.memoryUsagePercent.toFixed(1)}%`
          });
          
          if (context.onStrategyChange) {
            context.onStrategyChange(this.currentStrategy, newStrategy);
          }
          
          this.currentStrategy = newStrategy;
          strategyChanges++;

          // Recreate remaining batches with new strategy
          const remainingItems = context.items.slice(i * this.currentStrategy.maxBatchSize);
          const newBatches = this.createAdaptiveBatches(remainingItems);
          batches.splice(i, batches.length - i, ...newBatches);
        }

        // Process batch with current strategy
        try {
          const batchResults = await this.processBatchWithStrategy(
            batch,
            context.processor,
            this.currentStrategy
          );
          
          results.push(...batchResults);
          successfulItems += batchResults.length;
          
        } catch (error: any) {
          this.logger.error('Batch processing failed', {
            batchSize: batch.length,
            strategy: this.currentStrategy.name,
            error: error.message
          });
          
          failedItems += batch.length;
        }

        // Memory monitoring and cleanup
        const memoryAfter = this.getCurrentMemoryMetrics();
        this.memoryHistory.push(memoryAfter);
        
        peakMemoryUsage = Math.max(peakMemoryUsage, memoryAfter.memoryUsagePercent);
        totalMemoryUsage += memoryAfter.memoryUsagePercent;
        memoryMeasurements++;

        // Check for memory warnings
        if (memoryAfter.memoryUsagePercent > this.config.memoryThresholds.high) {
          if (context.onMemoryWarning) {
            context.onMemoryWarning(memoryAfter);
          }
        }

        // Perform cleanup if needed
        if (this.shouldPerformCleanup(i, memoryAfter)) {
          await this.performMemoryCleanup();
          memoryCleanups++;
        }

        // Report progress
        if (context.onProgress) {
          const completed = Math.min((i + 1) * this.currentStrategy.maxBatchSize, context.items.length);
          context.onProgress(completed, context.items.length);
        }

        this.logger.debug('Batch completed', {
          batchIndex: i + 1,
          totalBatches: batches.length,
          batchSize: batch.length,
          memoryUsage: `${memoryAfter.memoryUsagePercent.toFixed(1)}%`,
          strategy: this.currentStrategy.name
        });
      }

    } catch (error: any) {
      this.logger.error('Processing failed', { error: error.message });
      throw error;
    }

    const totalTime = Date.now() - startTime;
    const averageMemoryUsage = memoryMeasurements > 0 ? totalMemoryUsage / memoryMeasurements : 0;

    const result: ProcessingResult<R> = {
      results,
      stats: {
        totalItems: context.items.length,
        successfulItems,
        failedItems,
        totalTime,
        strategyChanges,
        memoryCleanups,
        peakMemoryUsage,
        averageMemoryUsage,
      },
      memoryHistory: [...this.memoryHistory],
    };

    this.logger.info('Processing completed', {
      totalItems: context.items.length,
      successful: successfulItems,
      failed: failedItems,
      totalTime: `${totalTime}ms`,
      strategyChanges,
      memoryCleanups,
      peakMemoryUsage: `${peakMemoryUsage.toFixed(1)}%`
    });

    return result;
  }

  /**
   * Get current memory metrics
   */
  getCurrentMemoryMetrics(): MemoryMetrics {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const availableMemory = freeMemory;
    const processMemory = process.memoryUsage();
    const memoryUsagePercent = ((totalMemory - availableMemory) / totalMemory) * 100;
    const availableForProcessing = availableMemory * (1 - this.config.memoryBuffer);

    return {
      totalMemory,
      availableMemory,
      processMemory,
      memoryUsagePercent,
      availableForProcessing,
    };
  }

  /**
   * Select optimal processing strategy based on current memory usage
   */
  selectOptimalStrategy(memoryMetrics: MemoryMetrics): ProcessingStrategy {
    const usage = memoryMetrics.memoryUsagePercent;

    if (usage >= this.config.memoryThresholds.critical) {
      return this.config.strategies.find(s => s.name === 'emergency') 
        || this.config.strategies[0]!;
    } else if (usage >= this.config.memoryThresholds.high) {
      return this.config.strategies.find(s => s.name === 'conservative') 
        || this.config.strategies[0]!;
    } else if (usage >= this.config.memoryThresholds.normal) {
      return this.config.strategies.find(s => s.name === 'balanced') 
        || this.config.strategies[Math.min(1, this.config.strategies.length - 1)]!;
    } else {
      return this.config.strategies.find(s => s.name === 'aggressive') 
        || this.config.strategies[Math.min(2, this.config.strategies.length - 1)]!;
    }
  }

  /**
   * Get processing recommendations based on current state
   */
  getProcessingRecommendations(): {
    currentStrategy: ProcessingStrategy;
    memoryMetrics: MemoryMetrics;
    recommendations: string[];
    estimatedCapacity: number;
  } {
    const memoryMetrics = this.getCurrentMemoryMetrics();
    const recommendations: string[] = [];
    
    if (memoryMetrics.memoryUsagePercent > this.config.memoryThresholds.critical) {
      recommendations.push('CRITICAL: Memory usage is very high, consider emergency cleanup');
      recommendations.push('Switch to sequential processing with batch size 1');
      recommendations.push('Enable aggressive garbage collection');
    } else if (memoryMetrics.memoryUsagePercent > this.config.memoryThresholds.high) {
      recommendations.push('HIGH: Memory usage is elevated, reduce batch sizes');
      recommendations.push('Increase cleanup frequency');
      recommendations.push('Monitor for memory leaks');
    } else if (memoryMetrics.memoryUsagePercent < this.config.memoryThresholds.low) {
      recommendations.push('LOW: Memory usage is low, can increase batch sizes');
      recommendations.push('Consider parallel processing strategies');
      recommendations.push('Opportunity for performance optimization');
    }

    // Estimate processing capacity
    const estimatedItemSize = 1024; // Rough estimate per item in bytes
    const estimatedCapacity = Math.floor(memoryMetrics.availableForProcessing / estimatedItemSize);

    return {
      currentStrategy: this.currentStrategy,
      memoryMetrics,
      recommendations,
      estimatedCapacity,
    };
  }

  /**
   * Stop memory monitoring
   */
  stop(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
    this.logger.info('Memory-aware processor stopped');
  }

  /**
   * Create adaptive batches based on current strategy
   */
  private createAdaptiveBatches<T>(items: T[]): T[][] {
    const batches: T[][] = [];
    const batchSize = this.currentStrategy.maxBatchSize;

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Process batch with specific strategy
   */
  private async processBatchWithStrategy<T, R>(
    batch: T[],
    processor: (batch: T[]) => Promise<R[]>,
    strategy: ProcessingStrategy
  ): Promise<R[]> {
    switch (strategy.approach) {
      case 'sequential':
        return await this.processSequentially(batch, processor);
      case 'parallel':
        return await this.processParallel(batch, processor);
      case 'streaming':
        return await this.processStreaming(batch, processor);
      case 'chunked':
        return await this.processChunked(batch, processor);
      default:
        return await processor(batch);
    }
  }

  /**
   * Sequential processing (memory-safe)
   */
  private async processSequentially<T, R>(
    batch: T[],
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      if (item === undefined) continue; // Skip undefined items
      
      const singleItem = [item];
      const singleResult = await processor(singleItem);
      results.push(...singleResult);
      
      // Memory cleanup for very small batches
      if (i % 5 === 0 && this.config.enableGcHints && global.gc) {
        global.gc();
      }
    }
    
    return results;
  }

  /**
   * Parallel processing (performance-oriented)
   */
  private async processParallel<T, R>(
    batch: T[],
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    // Split into smaller parallel chunks if batch is large
    const chunkSize = Math.max(1, Math.floor(batch.length / os.cpus().length));
    const chunks: T[][] = [];
    
    for (let i = 0; i < batch.length; i += chunkSize) {
      chunks.push(batch.slice(i, i + chunkSize));
    }
    
    const chunkPromises = chunks.map(chunk => processor(chunk));
    const chunkResults = await Promise.all(chunkPromises);
    
    return chunkResults.flat();
  }

  /**
   * Streaming processing (memory-efficient for large batches)
   */
  private async processStreaming<T, R>(
    batch: T[],
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    // Process in small streaming chunks
    const streamingChunkSize = 4;
    const results: R[] = [];
    
    for (let i = 0; i < batch.length; i += streamingChunkSize) {
      const chunk = batch.slice(i, i + streamingChunkSize);
      const chunkResults = await processor(chunk);
      results.push(...chunkResults);
      
      // Allow event loop to process other tasks
      await new Promise(resolve => setImmediate(resolve));
    }
    
    return results;
  }

  /**
   * Chunked processing (balanced approach)
   */
  private async processChunked<T, R>(
    batch: T[],
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    const chunkSize = Math.max(1, Math.floor(batch.length / 4));
    const results: R[] = [];
    
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      const chunkResults = await processor(chunk);
      results.push(...chunkResults);
    }
    
    return results;
  }

  /**
   * Check if memory cleanup should be performed
   */
  private shouldPerformCleanup(batchIndex: number, memoryMetrics: MemoryMetrics): boolean {
    // Emergency cleanup
    if (memoryMetrics.memoryUsagePercent >= this.config.emergencyCleanupThreshold) {
      return true;
    }

    // Strategy-based cleanup frequency
    if ((batchIndex + 1) % this.currentStrategy.cleanupFrequency === 0) {
      return true;
    }

    // High memory usage cleanup
    if (memoryMetrics.memoryUsagePercent > this.config.memoryThresholds.high) {
      return true;
    }

    return false;
  }

  /**
   * Perform memory cleanup
   */
  private async performMemoryCleanup(): Promise<void> {
    this.logger.debug('Performing memory cleanup');

    // Trigger garbage collection if available
    if (this.config.enableGcHints && global.gc) {
      global.gc();
    }

    // Allow event loop to process
    await new Promise(resolve => setImmediate(resolve));

    // Clear old memory history
    if (this.memoryHistory.length > 100) {
      this.memoryHistory.splice(0, this.memoryHistory.length - 50);
    }
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      const metrics = this.getCurrentMemoryMetrics();
      this.memoryHistory.push(metrics);

      // Keep only recent history
      if (this.memoryHistory.length > 1000) {
        this.memoryHistory.shift();
      }

      // Log warnings for high memory usage
      if (metrics.memoryUsagePercent > this.config.memoryThresholds.critical) {
        this.logger.warn('Critical memory usage detected', {
          usage: `${metrics.memoryUsagePercent.toFixed(1)}%`,
          strategy: this.currentStrategy.name
        });
      }
    }, this.config.monitoringInterval);
  }
}