/**
 * Embedding generation module
 * 
 * This module provides embedding generation capabilities using @xenova/transformers
 * with CodeBERT model integration for code-specific embeddings.
 */

export * from './types.js';
export { XenovaEmbeddingGenerator } from './XenovaEmbeddingGenerator.js';

// Re-export the main interfaces for convenience
export type {
  EmbeddingGenerator,
  EmbeddingResult,
  BatchProcessOptions,
  Annotation,
  EmbeddingConfig,
} from './types.js';