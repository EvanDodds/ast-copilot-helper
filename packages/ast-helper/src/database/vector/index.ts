/**
 * Vector Database Module
 *
 * Exports types, configuration, and utilities for HNSW vector database
 */

// Core types
export * from "./types.js";

// Configuration management
export * from "./vector-config.js";

// Re-export key interfaces for convenience
export type {
  VectorDatabase,
  VectorDBConfig,
  VectorMetadata,
  SearchResult,
  VectorInsert,
  VectorDBStats,
  SearchOptions,
} from "./types.js";

export {
  VectorConfigManager,
  createVectorConfig,
  loadVectorConfig,
} from "./vector-config.js";

// Storage and database implementations
export { SQLiteVectorStorage } from "./sqlite-storage.js";
export { HNSWVectorDatabase } from "./hnsw-database.js";
export { RustVectorDatabase } from "./rust-vector-database.js";

// Factory for creating vector databases with Rust-first strategy
export {
  VectorDatabaseFactory,
  createVectorDatabase,
  createRustVectorDatabase,
  createHNSWVectorDatabase,
} from "./factory.js";
export type { VectorDatabaseFactoryOptions } from "./factory.js";
