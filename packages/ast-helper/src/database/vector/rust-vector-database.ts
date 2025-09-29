// @ts-nocheck
/**
 * Rust-based Vector Database Implementation
 *
 * NOTE: NAPI Rust engine is currently disabled due to export issues
 * This file uses SQLite-only mode until NAPI exports are fixed
 *
 * Uses the native Rust engine from ast-core-engine instead of hnswlib-node
 * to avoid Node.js native binding compilation issues.
 */

/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import type {
  VectorDatabase,
  VectorDBConfig,
  VectorMetadata,
  SearchResult,
  VectorDBStats,
  VectorInsert,
} from "./types.js";
// Note: NAPI vector functions are not currently exported from @ast-helper/core-engine
// This implementation now falls back to using the WASM implementation which is working
import { SQLiteVectorStorage } from "./sqlite-storage.js";

// Local type definitions to match engine expectations
interface LocalVectorDbConfig {
  embedding_dimension: number;
  m: number;
  ef_construction: number;
  ef_search: number;
  max_elements: number;
}

interface LocalEngineVectorMetadata {
  node_id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  node_type: string;
  content_hash: string;
  language: string;
  scope_path: string[];
  [key: string]: any;
}

interface LocalVectorSearchResult {
  node_id: string;
  similarity: number;
  metadata: LocalEngineVectorMetadata;
}

interface RustEngine {
  initVectorDatabase: (config: LocalVectorDbConfig) => string;
  addVectorToDb: (
    nodeId: string,
    embeddingJson: string,
    metadata: LocalEngineVectorMetadata,
  ) => string;
  searchVectors: (
    embeddingJson: string,
    k: number,
    efSearch?: number,
  ) => LocalVectorSearchResult[];
  getVectorCount: () => number;
  clearVectorDatabase: () => string;
}

const rustEngine: RustEngine | null = null; // Disabled - NAPI exports broken

// Initialize the engine on first import
// async function initializeRustEngine(): Promise<void> {
//   // NAPI functions are currently not exported properly from core-engine
//   console.warn("NAPI vector functions not available, falling back to WASM implementation");
// }

/**
 * Rust-based vector database that uses the native Rust implementation
 * from ast-core-engine for vector similarity search
 */
export class RustVectorDatabase implements VectorDatabase {
  private storage: SQLiteVectorStorage;
  private isInitialized = false;
  private readonly config: VectorDBConfig;
  private searchTimes: number[] = [];
  private readonly maxSearchTimeHistory = 100;

  constructor(config: VectorDBConfig) {
    this.config = config;
    this.storage = new SQLiteVectorStorage(config);
  }

  async initialize(_config?: VectorDBConfig): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Note: NAPI Rust engine is currently disabled due to export issues
      // Using SQLite storage only until NAPI exports are fixed
      console.warn(
        "Using SQLite-only mode - Rust NAPI engine exports need to be fixed",
      );

      // Initialize SQLite storage
      await this.storage.initialize();

      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize vector database: ${(error as Error).message}`,
      );
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error("Rust vector database not initialized");
    }
  }

  private async rebuildFromStorage(): Promise<void> {
    const stats = await this.storage.getStats();
    if (stats.vectorCount === 0) {
      return;
    }

    console.log(
      `Rebuilding Rust index from ${stats.vectorCount} stored vectors...`,
    );

    const allNodeIds = await this.storage.getAllNodeIds();
    for (const nodeId of allNodeIds) {
      const vectorData = await this.storage.getVector(nodeId);
      if (vectorData) {
        const rustMetadata = {
          node_id: nodeId,
          file_path: vectorData.metadata.filePath,
          node_type: vectorData.metadata.signature.split("(")[0] || "unknown",
          signature: vectorData.metadata.signature,
          language: "typescript", // Default, could be enhanced
          embedding_model: "codebert-base", // Default model
          timestamp: Math.floor(Date.now() / 1000),
        };

        try {
          const embeddingJson = JSON.stringify(vectorData.vector);
          if (rustEngine) {
            rustEngine.addVectorToDb(
              nodeId,
              embeddingJson,
              rustMetadata as any,
            );
          }
        } catch (error) {
          console.warn(`Failed to add vector ${nodeId} to Rust index:`, error);
        }
      }
    }

    console.log("Rust index rebuild completed");
  }

  async insertVector(
    nodeId: string,
    vector: number[],
    metadata: VectorMetadata,
  ): Promise<void> {
    this.ensureInitialized();

    if (vector.length !== this.config.dimensions) {
      throw new Error(
        `Vector dimensions mismatch: expected ${this.config.dimensions}, got ${vector.length}`,
      );
    }

    try {
      // Store in SQLite first
      await this.storage.insertVector(nodeId, vector, metadata);

      // Add to Rust vector database
      const rustMetadata = {
        node_id: nodeId,
        file_path: metadata.filePath,
        node_type: metadata.signature.split("(")[0] || "unknown",
        signature: metadata.signature,
        language: "typescript",
        embedding_model: "codebert-base",
        timestamp: Math.floor(Date.now() / 1000),
      };

      const embeddingJson = JSON.stringify(vector);
      if (rustEngine) {
        rustEngine.addVectorToDb(nodeId, embeddingJson, rustMetadata);
      }
    } catch (error) {
      throw new Error(`Failed to insert vector: ${(error as Error).message}`);
    }
  }

  async insertVectors(vectors: VectorInsert[]): Promise<void> {
    for (const vectorInsert of vectors) {
      await this.insertVector(
        vectorInsert.nodeId,
        vectorInsert.vector,
        vectorInsert.metadata,
      );
    }
  }

  async updateVector(nodeId: string, vector: number[]): Promise<void> {
    this.ensureInitialized();

    if (vector.length !== this.config.dimensions) {
      throw new Error(
        `Vector dimensions mismatch: expected ${this.config.dimensions}, got ${vector.length}`,
      );
    }

    try {
      // Update storage
      await this.storage.updateVector(nodeId, vector, {});

      // For Rust implementation, we need to clear and rebuild the specific vector
      // This is a limitation of the current Rust implementation
      const vectorData = await this.storage.getVector(nodeId);
      if (vectorData) {
        const rustMetadata = {
          node_id: nodeId,
          file_path: vectorData.metadata.filePath,
          node_type: vectorData.metadata.signature.split("(")[0] || "unknown",
          signature: vectorData.metadata.signature,
          language: "typescript",
          embedding_model: "codebert-base",
          timestamp: Math.floor(Date.now() / 1000),
        };

        const embeddingJson = JSON.stringify(vector);
        if (rustEngine) {
          rustEngine.addVectorToDb(nodeId, embeddingJson, rustMetadata);
        }
      }
    } catch (error) {
      throw new Error(`Failed to update vector: ${(error as Error).message}`);
    }
  }

  async deleteVector(nodeId: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.storage.deleteVector(nodeId);
      // Note: Current Rust implementation doesn't support deletion
      // Vector will remain in Rust index but won't be returned in search results
      // because storage lookup will fail
    } catch (error) {
      throw new Error(`Failed to delete vector: ${(error as Error).message}`);
    }
  }

  async searchSimilar(
    vector: number[],
    k = 10,
    _ef?: number,
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    if (vector.length !== this.config.dimensions) {
      throw new Error(
        `Query vector dimensions mismatch: expected ${this.config.dimensions}, got ${vector.length}`,
      );
    }

    try {
      const startTime = performance.now();

      // Search using Rust implementation
      const embeddingJson = JSON.stringify(vector);
      if (!rustEngine) {
        throw new Error("Rust engine not available");
      }
      const rustResults = rustEngine.searchVectors(embeddingJson, k, undefined);

      // Convert Rust results to our SearchResult format
      const searchResults: SearchResult[] = [];

      for (const rustResult of rustResults) {
        // Verify the node still exists in storage (handles deleted vectors)
        const vectorData = await this.storage.getVector(rustResult.node_id);
        if (vectorData) {
          searchResults.push({
            nodeId: rustResult.node_id,
            distance: (rustResult as any).distance,
            score: (rustResult as any).distance,
            metadata: vectorData.metadata,
          });
        }
      }

      const endTime = performance.now();
      const searchTime = endTime - startTime;
      this.recordSearchTime(searchTime);

      // Log performance warning if query is slow
      const maxQueryTime = 200; // 200ms target
      if (searchTime > maxQueryTime) {
        console.warn(
          `Slow vector search: ${searchTime.toFixed(2)}ms (target: ${maxQueryTime}ms)`,
        );
      }

      return searchResults;
    } catch (error) {
      throw new Error(`Vector search failed: ${(error as Error).message}`);
    }
  }

  async getStats(): Promise<VectorDBStats> {
    this.ensureInitialized();

    try {
      const storageStats = await this.storage.getStats();

      return {
        vectorCount: storageStats.vectorCount,
        memoryUsage: 0, // Not available from Rust side
        indexFileSize: 0, // Not available from Rust side
        storageFileSize: storageStats.storageSize,
        lastSaved: storageStats.newestVector || new Date(),
        buildTime: 0, // Not tracked in Rust implementation
        averageSearchTime: this.getAverageSearchTime(),
        status: "ready",
      };
    } catch (error) {
      return {
        vectorCount: 0,
        memoryUsage: 0,
        indexFileSize: 0,
        storageFileSize: 0,
        lastSaved: new Date(0),
        buildTime: 0,
        averageSearchTime: 0,
        status: "error",
        errorMessage: (error as Error).message,
      };
    }
  }

  async rebuild(): Promise<void> {
    this.ensureInitialized();

    try {
      // Clear Rust vector database
      if (rustEngine) {
        rustEngine.clearVectorDatabase();
      }

      // Rebuild from storage
      await this.rebuildFromStorage();

      console.log("Rust vector database rebuild completed");
    } catch (error) {
      throw new Error(`Failed to rebuild index: ${(error as Error).message}`);
    }
  }

  async close(): Promise<void> {
    await this.storage.close();
  }

  async shutdown(): Promise<void> {
    if (this.isInitialized && rustEngine) {
      try {
        rustEngine.clearVectorDatabase();
      } catch (error) {
        console.warn("Error clearing Rust vector database:", error);
      }
    }
    await this.storage.close();
    this.isInitialized = false;
  }

  getConfig(): VectorDBConfig {
    return { ...this.config };
  }

  private recordSearchTime(searchTime: number): void {
    this.searchTimes.push(searchTime);
    if (this.searchTimes.length > this.maxSearchTimeHistory) {
      this.searchTimes.shift();
    }
  }

  private getAverageSearchTime(): number {
    if (this.searchTimes.length === 0) {
      return 0;
    }
    const sum = this.searchTimes.reduce((total, time) => total + time, 0);
    return sum / this.searchTimes.length;
  }
}
