/**
 * Enhanced embedding generator with performance optimizations
 */

import { XenovaEmbeddingGenerator } from './XenovaEmbeddingGenerator.js';
import { IntelligentEmbeddingCache, getEmbeddingCache } from './intelligent-cache.js';
import { DynamicBatchOptimizer } from './dynamic-batch-optimizer.js';
import { MemoryAwareProcessor } from './memory-aware-processor.js';
import { EmbeddingResult, Annotation, BatchProcessOptions } from './types.js';
import { createLogger } from '../logging/index.js';

export interface PerformanceOptimizationConfig {
  /** Enable intelligent caching */
  enableCaching: boolean;
  /** Enable dynamic batch optimization */
  enableBatchOptimization: boolean;
  /** Enable memory-aware processing */
  enableMemoryAwareProcessing: boolean;
  /** Cache configuration */
  cacheConfig?: {
    maxEntries?: number;
    maxSizeBytes?: number;
    ttlMs?: number;
  };
  /** Batch optimization configuration */
  batchConfig?: {
    minBatchSize?: number;
    maxBatchSize?: number;
    targetCpuUsage?: number;
    targetMemoryUsage?: number;
  };
  /** Memory-aware processing configuration */
  memoryConfig?: {
    memoryThresholds?: {
      critical?: number;
      high?: number;
      normal?: number;
      low?: number;
    };
    enableGcHints?: boolean;
  };
}

export interface PerformanceMetrics {
  /** Cache performance */
  cache?: {
    hitRatio: number;
    entries: number;
    sizeBytes: number;
    memoryEfficiency: number;
  };
  /** Batch optimization metrics */
  batchOptimization?: {
    currentBatchSize: number;
    throughputTrend: number;
    memoryTrend: number;
    cpuTrend: number;
    recommendedBatchSize: number;
    confidence: number;
  };
  /** Memory processing metrics */
  memoryProcessing?: {
    currentStrategy: string;
    memoryUsagePercent: number;
    availableMemory: number;
    recommendations: string[];
  };
  /** Overall performance score (0-1) */
  overallScore: number;
}

/**
 * Default performance optimization configuration
 */
const DEFAULT_PERF_CONFIG: PerformanceOptimizationConfig = {
  enableCaching: true,
  enableBatchOptimization: true,
  enableMemoryAwareProcessing: true,
  cacheConfig: {
    maxEntries: 10000,
    maxSizeBytes: 256 * 1024 * 1024, // 256MB
    ttlMs: 20 * 60 * 1000, // 20 minutes
  },
  batchConfig: {
    minBatchSize: 1,
    maxBatchSize: 128,
    targetCpuUsage: 70,
    targetMemoryUsage: 75,
  },
  memoryConfig: {
    memoryThresholds: {
      critical: 85,
      high: 70,
      normal: 55,
      low: 35,
    },
    enableGcHints: true,
  },
};

/**
 * High-performance embedding generator with advanced optimizations
 */
export class OptimizedEmbeddingGenerator extends XenovaEmbeddingGenerator {
  private performanceConfig: PerformanceOptimizationConfig;
  private cache: IntelligentEmbeddingCache | null = null;
  private batchOptimizer: DynamicBatchOptimizer | null = null;
  private memoryProcessor: MemoryAwareProcessor | null = null;
  private logger = createLogger({ operation: 'OptimizedEmbeddingGenerator' });

  constructor(config: Partial<PerformanceOptimizationConfig> = {}) {
    super();
    this.performanceConfig = { ...DEFAULT_PERF_CONFIG, ...config };
    this.initializeOptimizers();
  }

  /**
   * Initialize performance optimizers
   */
  private initializeOptimizers(): void {
    // Initialize cache if enabled
    if (this.performanceConfig.enableCaching) {
      this.cache = getEmbeddingCache(this.performanceConfig.cacheConfig);
      this.logger.info('Intelligent caching enabled');
    }

    // Initialize batch optimizer if enabled
    if (this.performanceConfig.enableBatchOptimization) {
      this.batchOptimizer = new DynamicBatchOptimizer(32, {
        minBatchSize: this.performanceConfig.batchConfig?.minBatchSize || 1,
        maxBatchSize: this.performanceConfig.batchConfig?.maxBatchSize || 128,
        targetCpuUsage: this.performanceConfig.batchConfig?.targetCpuUsage || 70,
        targetMemoryUsage: this.performanceConfig.batchConfig?.targetMemoryUsage || 75,
      });
      this.logger.info('Dynamic batch optimization enabled');
    }

    // Initialize memory-aware processor if enabled
    if (this.performanceConfig.enableMemoryAwareProcessing) {
      const memoryThresholds = this.performanceConfig.memoryConfig?.memoryThresholds;
      this.memoryProcessor = new MemoryAwareProcessor({
        memoryThresholds: memoryThresholds ? {
          critical: memoryThresholds.critical || 85,
          high: memoryThresholds.high || 70,
          normal: memoryThresholds.normal || 55,
          low: memoryThresholds.low || 35,
        } : undefined,
        enableGcHints: this.performanceConfig.memoryConfig?.enableGcHints,
      });
      this.logger.info('Memory-aware processing enabled');
    }
  }

  /**
   * Enhanced batch processing with all optimizations
   */
  override async batchProcess(
    annotations: Annotation[], 
    options: Partial<BatchProcessOptions> = {}
  ): Promise<EmbeddingResult[]> {
    const startTime = performance.now();
    
    this.logger.info('Starting optimized batch processing', {
      annotationCount: annotations.length,
      cacheEnabled: !!this.cache,
      batchOptimizationEnabled: !!this.batchOptimizer,
      memoryAwareEnabled: !!this.memoryProcessor
    });

    try {
      // Step 1: Check cache for existing results
      const { cachedResults, uncachedAnnotations } = await this.checkCache(annotations);
      
      this.logger.debug('Cache check completed', {
        cached: cachedResults.length,
        uncached: uncachedAnnotations.length,
        cacheHitRatio: annotations.length > 0 
          ? (cachedResults.length / annotations.length * 100).toFixed(1) + '%'
          : '0%'
      });

      // Step 2: Process uncached annotations with optimizations
      let newResults: EmbeddingResult[] = [];
      
      if (uncachedAnnotations.length > 0) {
        if (this.memoryProcessor && this.batchOptimizer) {
          // Use advanced memory-aware processing with dynamic batching
          newResults = await this.processWithAdvancedOptimizations(
            uncachedAnnotations, 
            options
          );
        } else if (this.batchOptimizer) {
          // Use dynamic batch optimization only
          newResults = await this.processWithBatchOptimization(
            uncachedAnnotations, 
            options
          );
        } else {
          // Fallback to standard processing
          newResults = await super.batchProcess(uncachedAnnotations, options);
        }

        // Step 3: Cache new results
        await this.cacheResults(uncachedAnnotations, newResults);
      }

      // Step 4: Combine and return results
      const allResults = [...cachedResults, ...newResults];
      const totalTime = performance.now() - startTime;

      this.logger.info('Optimized batch processing completed', {
        totalResults: allResults.length,
        cacheHits: cachedResults.length,
        newResults: newResults.length,
        totalTime: `${totalTime.toFixed(2)}ms`,
        throughput: `${(allResults.length / (totalTime / 1000)).toFixed(2)} items/sec`
      });

      return allResults;

    } catch (error: any) {
      this.logger.error('Optimized batch processing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      overallScore: 0,
    };

    let scoreComponents: number[] = [];

    // Cache metrics
    if (this.cache) {
      const cacheMetrics = this.cache.getPerformanceMetrics();
      metrics.cache = {
        hitRatio: cacheMetrics.stats.hitRatio,
        entries: cacheMetrics.stats.currentEntries,
        sizeBytes: cacheMetrics.stats.currentSizeBytes,
        memoryEfficiency: cacheMetrics.memoryEfficiency,
      };
      scoreComponents.push(cacheMetrics.performanceScore);
    }

    // Batch optimization metrics
    if (this.batchOptimizer) {
      const batchAnalytics = this.batchOptimizer.getPerformanceAnalytics();
      metrics.batchOptimization = {
        currentBatchSize: this.batchOptimizer.getCurrentBatchSize(),
        throughputTrend: batchAnalytics.trends.throughputTrend,
        memoryTrend: batchAnalytics.trends.memoryTrend,
        cpuTrend: batchAnalytics.trends.cpuTrend,
        recommendedBatchSize: batchAnalytics.recommendations.recommendedBatchSize,
        confidence: batchAnalytics.recommendations.confidence,
      };
      scoreComponents.push(batchAnalytics.recommendations.confidence);
    }

    // Memory processing metrics
    if (this.memoryProcessor) {
      const memoryRecommendations = this.memoryProcessor.getProcessingRecommendations();
      metrics.memoryProcessing = {
        currentStrategy: memoryRecommendations.currentStrategy.name,
        memoryUsagePercent: memoryRecommendations.memoryMetrics.memoryUsagePercent,
        availableMemory: memoryRecommendations.memoryMetrics.availableMemory,
        recommendations: memoryRecommendations.recommendations,
      };
      
      // Score based on memory efficiency
      const memoryScore = Math.max(0, 1 - (memoryRecommendations.memoryMetrics.memoryUsagePercent / 100));
      scoreComponents.push(memoryScore);
    }

    // Calculate overall performance score
    metrics.overallScore = scoreComponents.length > 0 
      ? scoreComponents.reduce((sum, score) => sum + score, 0) / scoreComponents.length 
      : 0.5;

    return metrics;
  }

  /**
   * Optimize performance settings based on current metrics
   */
  async optimizePerformance(): Promise<void> {
    this.logger.info('Starting performance optimization');

    // Optimize cache if enabled
    if (this.cache) {
      await this.cache.optimize();
    }

    // Optimize batch size if enabled
    if (this.batchOptimizer) {
      this.batchOptimizer.optimize();
    }

    const metrics = this.getPerformanceMetrics();
    this.logger.info('Performance optimization completed', {
      overallScore: (metrics.overallScore * 100).toFixed(1) + '%'
    });
  }

  /**
   * Clean up resources
   */
  override async cleanup(): Promise<void> {
    if (this.memoryProcessor) {
      this.memoryProcessor.stop();
    }
    
    if (this.cache) {
      this.cache.clear();
    }
    
    this.logger.info('Optimized embedding generator cleanup completed');
  }

  /**
   * Check cache for existing results
   */
  private async checkCache(annotations: Annotation[]): Promise<{
    cachedResults: EmbeddingResult[];
    uncachedAnnotations: Annotation[];
  }> {
    if (!this.cache) {
      return { cachedResults: [], uncachedAnnotations: annotations };
    }

    const cachedResults: EmbeddingResult[] = [];
    const uncachedAnnotations: Annotation[] = [];

    for (const annotation of annotations) {
      const cached = await this.cache.get(annotation);
      if (cached) {
        cachedResults.push(cached);
      } else {
        uncachedAnnotations.push(annotation);
      }
    }

    return { cachedResults, uncachedAnnotations };
  }

  /**
   * Cache new results
   */
  private async cacheResults(annotations: Annotation[], results: EmbeddingResult[]): Promise<void> {
    if (!this.cache) return;

    for (let i = 0; i < Math.min(annotations.length, results.length); i++) {
      const annotation = annotations[i];
      const result = results[i];
      
      if (annotation && result) {
        await this.cache.set(annotation, result);
      }
    }
  }

  /**
   * Process with advanced memory-aware and batch optimizations
   */
  private async processWithAdvancedOptimizations(
    annotations: Annotation[],
    options: Partial<BatchProcessOptions>
  ): Promise<EmbeddingResult[]> {
    const processor = async (batch: Annotation[]) => {
      // Use optimized batch size from batch optimizer
      const optimizedBatchSize = this.batchOptimizer!.getCurrentBatchSize();
      const batchStartTime = performance.now();
      
      // Process with parent class method
      const results = await super.batchProcess(batch, {
        ...options,
        batchSize: optimizedBatchSize,
      });
      
      const processingTime = performance.now() - batchStartTime;
      
      // Record performance for batch optimizer
      this.batchOptimizer!.recordPerformance(
        batch.length,
        processingTime,
        results.length,
        true
      );
      
      return results;
    };

    const processingResult = await this.memoryProcessor!.processWithMemoryAwareness<Annotation, EmbeddingResult>({
      items: annotations,
      processor,
      onProgress: options.progressCallback,
      onMemoryWarning: (memoryMetrics) => {
        this.logger.warn('Memory warning during processing', {
          usage: `${memoryMetrics.memoryUsagePercent.toFixed(1)}%`,
          available: `${(memoryMetrics.availableMemory / 1024 / 1024).toFixed(0)}MB`
        });
      },
      onStrategyChange: (oldStrategy, newStrategy) => {
        this.logger.info('Processing strategy changed', {
          from: oldStrategy.name,
          to: newStrategy.name
        });
      },
    });

    this.logger.debug('Advanced processing completed', {
      totalItems: processingResult.stats.totalItems,
      successful: processingResult.stats.successfulItems,
      strategyChanges: processingResult.stats.strategyChanges,
      memoryCleanups: processingResult.stats.memoryCleanups,
      peakMemoryUsage: `${processingResult.stats.peakMemoryUsage.toFixed(1)}%`
    });

    return processingResult.results;
  }

  /**
   * Process with batch optimization only
   */
  private async processWithBatchOptimization(
    annotations: Annotation[],
    options: Partial<BatchProcessOptions>
  ): Promise<EmbeddingResult[]> {
    const optimizedBatchSize = this.batchOptimizer!.getCurrentBatchSize();
    const startTime = performance.now();
    
    const results = await super.batchProcess(annotations, {
      ...options,
      batchSize: optimizedBatchSize,
    });
    
    const processingTime = performance.now() - startTime;
    
    // Record performance for batch optimizer
    this.batchOptimizer!.recordPerformance(
      annotations.length,
      processingTime,
      results.length,
      true
    );
    
    return results;
  }
}