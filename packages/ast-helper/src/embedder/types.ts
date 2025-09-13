/**
 * Core types and interfaces for the embedding generation system
 */

/**
 * Result of embedding generation for a single annotation
 */
export interface EmbeddingResult {
  /** Unique identifier for the AST node */
  nodeId: string;
  /** Generated embedding vector (768 dimensions for CodeBERT) */
  embedding: number[];
  /** Original text that was embedded */
  inputText: string;
  /** Time taken to generate this embedding in milliseconds */
  processingTime: number;
  /** Name/version of the model used */
  modelUsed: string;
  /** Quality confidence score (0-1) */
  confidence?: number;
}

/**
 * Configuration options for batch processing
 */
export interface BatchProcessOptions {
  /** Number of texts to process in each batch (default: 32) */
  batchSize: number;
  /** Maximum number of parallel batches (default: 2) */
  maxConcurrency: number;
  /** Memory limit in MB for batch processing (default: 2048) */
  memoryLimit: number;
  /** Progress callback function */
  progressCallback?: (processed: number, total: number) => void;
}

/**
 * Memory usage information
 */
export interface MemoryUsage {
  /** Current memory usage in bytes */
  usage: number;
  /** Available memory in bytes */
  available: number;
  /** Whether cleanup is recommended */
  shouldCleanup: boolean;
}

/**
 * Annotation interface for embedding input
 * This should match the structure from the annotation system (Issue #10)
 */
export interface Annotation {
  /** Unique identifier for the node */
  nodeId: string;
  /** Function/class signature */
  signature: string;
  /** Generated summary text */
  summary: string;
  /** Source code snippet */
  sourceSnippet?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Core embedding generator interface
 */
export interface EmbeddingGenerator {
  /**
   * Initialize the embedding model
   * @param modelPath Path to the model files
   */
  initialize(modelPath: string): Promise<void>;

  /**
   * Generate embeddings for an array of texts
   * @param texts Array of input texts
   * @returns Promise resolving to array of embedding vectors
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;

  /**
   * Process annotations in batches with memory management
   * @param annotations Array of annotations to process
   * @param options Batch processing configuration
   * @returns Promise resolving to array of embedding results
   */
  batchProcess(annotations: Annotation[], options?: Partial<BatchProcessOptions>): Promise<EmbeddingResult[]>;

  /**
   * Shutdown the embedding generator and cleanup resources
   */
  shutdown(): Promise<void>;

  /**
   * Check if the generator is initialized and ready
   */
  isReady(): boolean;
}

/**
 * Configuration for embedding system
 */
export interface EmbeddingConfig {
  /** Path to the embedding model */
  modelPath: string;
  /** Model name identifier */
  modelName: string;
  /** Default batch size */
  defaultBatchSize: number;
  /** Maximum batch size allowed */
  maxBatchSize: number;
  /** Default memory limit in MB */
  memoryLimit: number;
  /** Maximum concurrency for batch processing */
  maxConcurrency: number;
  /** Whether to enable progress reporting */
  enableProgressReporting: boolean;
  /** Whether to enable confidence scoring */
  enableConfidenceScoring: boolean;
}

/**
 * Error types for embedding operations
 */
export class EmbeddingError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: any) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

export class ModelInitializationError extends EmbeddingError {
  constructor(message: string, details?: any) {
    super(message, 'MODEL_INIT_FAILED', details);
    this.name = 'ModelInitializationError';
  }
}

export class EmbeddingGenerationError extends EmbeddingError {
  constructor(message: string, details?: any) {
    super(message, 'EMBEDDING_GENERATION_FAILED', details);
    this.name = 'EmbeddingGenerationError';
  }
}

export class MemoryLimitError extends EmbeddingError {
  constructor(message: string, details?: any) {
    super(message, 'MEMORY_LIMIT_EXCEEDED', details);
    this.name = 'MemoryLimitError';
  }
}