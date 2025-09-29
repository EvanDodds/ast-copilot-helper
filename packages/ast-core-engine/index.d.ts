/**
 * AST Core Engine TypeScript Definitions
 * WASM-based high-performance AST processing and vector operations
 */

// Re-export everything from the generated WASM bindings
export * from "./pkg/ast_core_engine";

// Additional type definitions for the WASM engine
export interface WasmEngineFeatures {
  hasTreeSitter: boolean;
  hasVectorOps: boolean;
  hasFileSystem: boolean;
}

export interface WasmEngineConfig {
  maxMemoryMb?: number;
  enableOptimizations?: boolean;
}

// Vector database compatibility types (for compatibility with existing code)
export interface VectorDbConfig {
  dimensions: number;
  maxElements: number;
  m: number;
  efConstruction: number;
  efSearch: number;
  seed: number;
}

export interface VectorMetadata {
  node_type: string;
  file_path: string;
  language: string;
  start_line: number;
  end_line: number;
  semantic_context?: string;
}

export interface VectorSearchResult {
  node_id: string;
  score: number;
  metadata: VectorMetadata;
}
