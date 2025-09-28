/**
 * Rust-based Vector Database Implementation
 *
 * Uses the native Rust vector database from ast-core-engine instead of hnswlib-node
 * to avoid Node.js native binding compilation issues.
 */

/* eslint-disable no-console */

import type {
  VectorDatabase,
  VectorDBConfig,
  VectorMetadata,
  SearchResult,
  VectorDBStats,
  VectorInsert,
} from "./types.js";
import { SQLiteVectorStorage } from "./sqlite-storage.js";

// Import Rust engine functions
interface RustConfig {
  embeddingDimension: number;
  m: number;
  efConstruction: number;
  efSearch: number;
  maxElements: number;
}

interface RustMetadata {
  node_id: string;
  file_path: string;
  node_type: string;
  signature: string;
  language: string;
  embedding_model: string;
  timestamp: number;
}

interface RustSearchResult {
  node_id: string;
  similarity: number;
  distance: number;
  file_path: string;
  node_type: string;
}

interface RustEngine {
  initVectorDatabase: (config: RustConfig) => string;
  addVectorToDb: (
    nodeId: string,
    embeddingJson: string,
    metadata: RustMetadata,
  ) => string;
  searchVectors: (
    embeddingJson: string,
    k: number,
    efSearch?: number,
  ) => RustSearchResult[];
  getVectorCount: () => number;
  clearVectorDatabase: () => string;
}

let rustEngine: RustEngine | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  rustEngine = require("@ast-helper/core-engine") as RustEngine;
} catch (_error) {
  // Rust engine not available - will be handled in initialize()
}

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

    if (!rustEngine) {
      throw new Error(
        "Rust engine not available. Run 'cargo build --release' in packages/ast-core-engine",
      );
    }

    try {
      // Initialize SQLite storage
      await this.storage.initialize();

      // Initialize Rust vector database
      const rustConfig = {
        embeddingDimension: this.config.dimensions,
        m: this.config.M || 16,
        efConstruction: this.config.efConstruction || 200,
        efSearch: 50,
        maxElements: this.config.maxElements || 100000,
      };

      const result = rustEngine.initVectorDatabase(rustConfig);
      console.log("Rust vector database initialized:", result);

      // Rebuild index from storage if vectors exist
      await this.rebuildFromStorage();

      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize Rust vector database: ${(error as Error).message}`,
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
            rustEngine.addVectorToDb(nodeId, embeddingJson, rustMetadata);
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
            distance: rustResult.distance,
            score: rustResult.similarity,
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
