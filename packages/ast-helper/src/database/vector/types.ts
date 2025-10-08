/**
 * Vector Database Types
 *
 * TypeScript interfaces and types for HNSW vector database implementation
 * with SQLite storage integration.
 */

// ===== Core Database Interface =====

/**
 * Main vector database interface defining all operations
 */
export interface VectorDatabase {
  initialize(config: VectorDBConfig): Promise<void>;
  insertVector(
    nodeId: string,
    vector: number[],
    metadata?: VectorMetadata,
  ): Promise<void>;
  insertVectors(vectors: VectorInsert[]): Promise<void>;
  searchSimilar(
    queryVector: number[],
    k?: number,
    ef?: number,
  ): Promise<SearchResult[]>;
  updateVector(nodeId: string, vector: number[]): Promise<void>;
  deleteVector(nodeId: string): Promise<void>;
  rebuild(): Promise<void>;
  getStats(): Promise<VectorDBStats>;
  shutdown(): Promise<void>;
}

// ===== Configuration Types =====

/**
 * Callback for notifying external systems (like MCP server cache) of index rebuild
 */
export type IndexRebuildCallback = () => Promise<void> | void;

/**
 * Vector database configuration parameters
 */
export interface VectorDBConfig {
  /** Vector dimensions - 768 for CodeBERT embeddings */
  dimensions: number;

  /** Maximum number of vectors in index (default: 100000) */
  maxElements: number;

  /** HNSW parameter M - max connections per layer (default: 16) */
  M: number;

  /** HNSW build parameter efConstruction (default: 200) */
  efConstruction: number;

  /** Optional callback to notify of index rebuild (for cache invalidation) */
  onIndexRebuild?: IndexRebuildCallback;

  /** Distance metric for similarity calculations */
  space: "cosine" | "l2" | "ip";

  /** SQLite database file path for metadata storage */
  storageFile: string;

  /** HNSW index binary file path */
  indexFile: string;

  /** Enable automatic index saving */
  autoSave: boolean;

  /** Auto-save interval in seconds */
  saveInterval: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_VECTOR_DB_CONFIG: Partial<VectorDBConfig> = {
  dimensions: 768,
  maxElements: 100000,
  M: 16,
  efConstruction: 200,
  space: "cosine",
  autoSave: true,
  saveInterval: 300, // 5 minutes
};

// ===== Vector Data Types =====

/**
 * Vector metadata stored in SQLite
 */
export interface VectorMetadata {
  /** Function/class signature */
  signature: string;

  /** Brief description or summary */
  summary: string;

  /** Associated file ID */
  fileId: string;

  /** File path */
  filePath: string;

  /** Line number in file */
  lineNumber: number;

  /** Embedding confidence score */
  confidence: number;

  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Vector insertion data structure
 */
export interface VectorInsert {
  nodeId: string;
  vector: number[];
  metadata: VectorMetadata;
}

// ===== Search Results =====

/**
 * Search result with distance, score, and metadata
 */
export interface SearchResult {
  /** Node identifier */
  nodeId: string;

  /** Raw distance (lower = more similar) */
  distance: number;

  /** Normalized similarity score (0-1, higher = more similar) */
  score: number;

  /** Associated metadata */
  metadata: VectorMetadata;

  /** Optional: return vector data */
  vector?: number[];
}

// ===== Database Statistics =====

/**
 * Vector database statistics and health information
 */
export interface VectorDBStats {
  /** Total number of vectors in index */
  vectorCount: number;

  /** Index memory usage in bytes */
  memoryUsage: number;

  /** Index file size in bytes */
  indexFileSize: number;

  /** SQLite database file size in bytes */
  storageFileSize: number;

  /** Last save timestamp */
  lastSaved: Date;

  /** Index build time in milliseconds */
  buildTime: number;

  /** Average search time in milliseconds (last 100 searches) */
  averageSearchTime: number;

  /** Current index status */
  status: "initializing" | "ready" | "rebuilding" | "error";

  /** Error message if status is error */
  errorMessage?: string;
}

// ===== Search Options =====

/**
 * Advanced search options for fine-tuning results
 */
export interface SearchOptions {
  /** Number of results to return */
  k?: number;

  /** Search accuracy parameter (higher = more accurate, slower) */
  ef?: number;

  /** Include vector data in results */
  includeVectors?: boolean;

  /** Filter by minimum similarity score */
  minScore?: number;

  /** Filter by file paths (regex pattern) */
  filePathFilter?: string;

  /** Filter by confidence threshold */
  minConfidence?: number;
}

// ===== Internal Types =====

/**
 * Internal label mapping for HNSW index
 */
export interface LabelMapping {
  nodeIdToLabel: Map<string, number>;
  labelToNodeId: Map<number, string>;
  nextLabel: number;
}

/**
 * Batch operation result
 */
export interface BatchResult {
  successCount: number;
  failureCount: number;
  errors: Array<{
    nodeId: string;
    error: string;
  }>;
}

// ===== Configuration Validation =====

/**
 * Validates vector database configuration
 */
export function validateVectorDBConfig(config: VectorDBConfig): string[] {
  const errors: string[] = [];

  if (config.dimensions <= 0) {
    errors.push("dimensions must be greater than 0");
  }

  if (config.maxElements <= 0) {
    errors.push("maxElements must be greater than 0");
  }

  if (config.M <= 0 || config.M > 100) {
    errors.push("M must be between 1 and 100");
  }

  if (config.efConstruction <= 0) {
    errors.push("efConstruction must be greater than 0");
  }

  if (config.efConstruction < config.M) {
    errors.push("efConstruction should be >= M for optimal performance");
  }

  if (!["cosine", "l2", "ip"].includes(config.space)) {
    errors.push("space must be one of: cosine, l2, ip");
  }

  if (!config.storageFile?.trim()) {
    errors.push("storageFile is required");
  }

  if (!config.indexFile?.trim()) {
    errors.push("indexFile is required");
  }

  if (config.saveInterval <= 0) {
    errors.push("saveInterval must be greater than 0");
  }

  return errors;
}

/**
 * Creates a complete configuration with defaults applied
 */
export function createVectorDBConfig(
  partial: Partial<VectorDBConfig>,
): VectorDBConfig {
  return {
    ...DEFAULT_VECTOR_DB_CONFIG,
    ...partial,
  } as VectorDBConfig;
}
