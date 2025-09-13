/**
 * Vector Database Module
 * 
 * Exports types, configuration, and utilities for HNSW vector database
 */

// Core types
export * from './types.js';

// Configuration management
export * from './vector-config.js';

// Re-export key interfaces for convenience
export type {
  VectorDatabase,
  VectorDBConfig,
  VectorMetadata,
  SearchResult,
  VectorInsert,
  VectorDBStats,
  SearchOptions,
} from './types.js';

export {
  VectorConfigManager,
  createVectorConfig,
  loadVectorConfig,
} from './vector-config.js';