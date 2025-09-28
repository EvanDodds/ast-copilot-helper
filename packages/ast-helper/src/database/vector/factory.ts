/**
 * Vector Database Factory
 * 
 * Creates vector database instances using the high-performance Rust implementation.
 * With consistent Rust builds, we no longer need complex fallback logic.
 */

import type { VectorDatabase, VectorDBConfig } from "./types.js";
import { RustVectorDatabase } from "./rust-vector-database.js";

export interface VectorDatabaseFactoryOptions {
  /** Enable verbose logging for debugging */
  verbose?: boolean;
  /** For testing: force use of HNSW implementation instead of Rust */
  forceHNSW?: boolean;
}

type RequiredFactoryOptions = Required<VectorDatabaseFactoryOptions>;

/**
 * Factory for creating vector database instances
 */
export class VectorDatabaseFactory {
  private static readonly DEFAULT_OPTIONS: RequiredFactoryOptions = {
    verbose: false,
    forceHNSW: false,
  };

  /**
   * Validate vector database configuration
   */
  private static validateConfig(config: VectorDBConfig): void {
    if (!config) {
      throw new Error("Configuration is required");
    }

    if (!Number.isInteger(config.dimensions) || config.dimensions < 1 || config.dimensions > 10000) {
      throw new Error(`Invalid embedding dimension: ${config.dimensions}. Must be between 1 and 10000`);
    }

    if (!Number.isInteger(config.maxElements) || config.maxElements < 1) {
      throw new Error(`Invalid maxElements: ${config.maxElements}. Must be a positive integer`);
    }

    if (config.M && (!Number.isInteger(config.M) || config.M < 1 || config.M > 100)) {
      throw new Error(`Invalid M parameter: ${config.M}. Must be between 1 and 100`);
    }

    if (config.efConstruction && (!Number.isInteger(config.efConstruction) || config.efConstruction < 1)) {
      throw new Error(`Invalid efConstruction: ${config.efConstruction}. Must be a positive integer`);
    }
  }

  /**
   * Create a vector database instance (Rust-first with optional HNSW fallback for testing)
   */
  static async create(
    config: VectorDBConfig,
    options: VectorDatabaseFactoryOptions = {}
  ): Promise<VectorDatabase> {
    // Validate configuration before creating any database
    this.validateConfig(config);

    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    if (opts.verbose) {
      // eslint-disable-next-line no-console
      console.log(`🔧 Creating vector database with options:`, opts);
    }

    // For testing: allow forcing HNSW implementation
    if (opts.forceHNSW) {
      if (opts.verbose) {
        // eslint-disable-next-line no-console
        console.log("🧪 Using HNSW implementation for testing");
      }
      return this.createHNSW(config, opts.verbose);
    }

    // Default: Use high-performance Rust implementation
    if (opts.verbose) {
      // eslint-disable-next-line no-console
      console.log("🦀 Using high-performance Rust vector database");
    }
    return this.createRust(config, opts.verbose);
  }

  /**
   * Create Rust vector database instance
   */
  private static async createRust(
    config: VectorDBConfig,
    verbose: boolean
  ): Promise<RustVectorDatabase> {
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log("🦀 Creating Rust vector database...");
    }

    const rustDB = new RustVectorDatabase(config);
    await rustDB.initialize();
    
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log("🚀 Rust vector database initialized successfully");
    }
    
    return rustDB;
  }

  /**
   * Create HNSW vector database instance (for testing)
   */
  private static async createHNSW(
    config: VectorDBConfig,
    verbose: boolean
  ): Promise<VectorDatabase> {
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log("📊 Creating HNSW vector database...");
    }

    // Dynamic import to avoid loading native dependencies at startup
    const { HNSWVectorDatabase } = await import("./hnsw-database.js");
    const hnswDB = new HNSWVectorDatabase(config);
    await hnswDB.initialize();
    
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log("📈 HNSW vector database initialized successfully");
    }
    
    return hnswDB;
  }

}

/**
 * Convenience function to create a vector database (uses Rust implementation)
 */
export async function createVectorDatabase(
  config: VectorDBConfig,
  options?: VectorDatabaseFactoryOptions
): Promise<VectorDatabase> {
  return VectorDatabaseFactory.create(config, options);
}

/**
 * Create vector database with Rust implementation (default behavior)
 */
export async function createRustVectorDatabase(
  config: VectorDBConfig,
  verbose = false
): Promise<VectorDatabase> {
  return VectorDatabaseFactory.create(config, { verbose });
}

/**
 * Create vector database with HNSW implementation (for testing)
 */
export async function createHNSWVectorDatabase(
  config: VectorDBConfig,
  verbose = false
): Promise<VectorDatabase> {
  return VectorDatabaseFactory.create(config, {
    forceHNSW: true,
    verbose,
  });
}