/**
 * Rust-based Vector Database Implementation (via WASM)
 *
 * This is a wrapper around WasmVectorDatabase that provides a cleaner API
 * and maintains compatibility with the VectorDatabase interface.
 *
 * The Rust vector operations are compiled to WebAssembly and used here
 * for high performance without Node.js native binding issues.
 */

import { WasmVectorDatabase } from "./wasm-vector-database.js";
import type {
  VectorDatabase,
  VectorDBConfig,
  VectorMetadata,
  SearchResult,
  VectorDBStats,
  VectorInsert,
} from "./types.js";

/**
 * Rust-based vector database using WebAssembly
 *
 * This implementation uses the Rust core engine compiled to WASM
 * for high-performance vector similarity search.
 */
export class RustVectorDatabase implements VectorDatabase {
  private wasmDb: WasmVectorDatabase;

  constructor(config: VectorDBConfig) {
    // Simply wrap the WASM implementation
    this.wasmDb = new WasmVectorDatabase(config);
  }

  async initialize(config?: VectorDBConfig): Promise<void> {
    return this.wasmDb.initialize(config);
  }

  async insertVector(
    nodeId: string,
    vector: number[],
    metadata?: VectorMetadata,
  ): Promise<void> {
    // WasmVectorDatabase requires metadata, provide default if not given
    const meta: VectorMetadata = metadata || {
      signature: "",
      summary: "",
      fileId: "",
      filePath: "",
      lineNumber: 0,
      confidence: 0,
      lastUpdated: new Date(),
    };
    return this.wasmDb.insertVector(nodeId, vector, meta);
  }

  async insertVectors(vectors: VectorInsert[]): Promise<void> {
    return this.wasmDb.insertVectors(vectors);
  }

  async searchSimilar(
    queryVector: number[],
    k?: number,
    ef?: number,
  ): Promise<SearchResult[]> {
    // WasmVectorDatabase requires k, default to 10 if not provided
    return this.wasmDb.searchSimilar(queryVector, k || 10, ef);
  }

  async updateVector(nodeId: string, vector: number[]): Promise<void> {
    return this.wasmDb.updateVector(nodeId, vector);
  }

  async deleteVector(nodeId: string): Promise<void> {
    return this.wasmDb.deleteVector(nodeId);
  }

  async rebuild(): Promise<void> {
    return this.wasmDb.rebuild();
  }

  async getStats(): Promise<VectorDBStats> {
    return this.wasmDb.getStats();
  }

  async shutdown(): Promise<void> {
    return this.wasmDb.shutdown();
  }
}
