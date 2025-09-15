/**
 * Embedding generation module
 * 
 * This module provides embedding generation capabilities using @xenova/transformers
 * with CodeBERT model integration for code-specific embeddings.
 */

export * from './types.js';
export { XenovaEmbeddingGenerator } from './XenovaEmbeddingGenerator.js';
export { CodeTextProcessor } from './TextProcessor.js';

// Performance optimization components
export { OptimizedEmbeddingGenerator } from './optimized-embedding-generator.js';
export { IntelligentEmbeddingCache, getEmbeddingCache, resetEmbeddingCache } from './intelligent-cache.js';
export { DynamicBatchOptimizer } from './dynamic-batch-optimizer.js';
export { MemoryAwareProcessor } from './memory-aware-processor.js';

// Re-export the main interfaces for convenience
export type {
  EmbeddingGenerator,
  EmbeddingResult,
  BatchProcessOptions,
  Annotation,
  EmbeddingConfig,
} from './types.js';

// Performance optimization types
export type {
  PerformanceOptimizationConfig,
  PerformanceMetrics,
} from './optimized-embedding-generator.js';

export type {
  CacheConfig,
  CacheStats,
  CachePerformanceMetrics,
} from './intelligent-cache.js';

export type {
  SystemResourceMetrics,
  OptimizationConfig,
  OptimizationRecommendation,
} from './dynamic-batch-optimizer.js';

export type {
  MemoryMetrics,
  ProcessingStrategy,
  AdaptiveProcessingConfig,
} from './memory-aware-processor.js';