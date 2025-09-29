/**
 * Vector Database Factory
 *
 * Creates vector database instances using the high-performance WASM implementation.
 * Provides intelligent fallback to native Rust implementation if needed.
 */

import type { VectorDatabase, VectorDBConfig } from "./types.js";
import { RustVectorDatabase } from "./rust-vector-database.js";
import { WasmVectorDatabase } from "./wasm-vector-database.js";

export interface VectorDatabaseFactoryOptions {
  /** Enable verbose logging for debugging */
  verbose?: boolean;
  /** For testing: force use of HNSW implementation instead of WASM */
  forceHNSW?: boolean;
  /** Use native Rust implementation instead of WASM */
  useRust?: boolean;
}

type RequiredFactoryOptions = Required<VectorDatabaseFactoryOptions>;

/**
 * Factory for creating vector database instances
 */
export class VectorDatabaseFactory {
  private static readonly DEFAULT_OPTIONS: RequiredFactoryOptions = {
    verbose: false,
    forceHNSW: false,
    useRust: false,
  };

  /**
   * Validate vector database configuration
   */
  private static validateConfig(config: VectorDBConfig): void {
    if (!config) {
      throw new Error("Configuration is required");
    }

    if (
      !Number.isInteger(config.dimensions) ||
      config.dimensions < 1 ||
      config.dimensions > 10000
    ) {
      throw new Error(
        `Invalid embedding dimension: ${config.dimensions}. Must be between 1 and 10000`,
      );
    }

    if (!Number.isInteger(config.maxElements) || config.maxElements < 1) {
      throw new Error(
        `Invalid maxElements: ${config.maxElements}. Must be a positive integer`,
      );
    }

    if (
      config.M &&
      (!Number.isInteger(config.M) || config.M < 1 || config.M > 100)
    ) {
      throw new Error(
        `Invalid M parameter: ${config.M}. Must be between 1 and 100`,
      );
    }

    if (
      config.efConstruction &&
      (!Number.isInteger(config.efConstruction) || config.efConstruction < 1)
    ) {
      throw new Error(
        `Invalid efConstruction: ${config.efConstruction}. Must be a positive integer`,
      );
    }
  }

  /**
   * Create a vector database instance with intelligent fallback
   */
  static async create(
    config: VectorDBConfig,
    options: VectorDatabaseFactoryOptions = {},
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

    // Use native Rust implementation if explicitly requested
    if (opts.useRust) {
      if (opts.verbose) {
        // eslint-disable-next-line no-console
        console.log("🦀 Using native Rust vector database");
      }
      return this.createRust(config, opts.verbose);
    }

    // Intelligent fallback: Try WASM first, fallback to native Rust if needed
    try {
      if (opts.verbose) {
        // eslint-disable-next-line no-console
        console.log("🕸️ Attempting high-performance WASM vector database");
      }
      return await this.createWasm(config, opts.verbose);
    } catch (error) {
      if (opts.verbose) {
        // eslint-disable-next-line no-console
        console.warn(
          "⚠️ WASM implementation failed, trying native Rust fallback:",
          error,
        );
      }

      try {
        if (opts.verbose) {
          // eslint-disable-next-line no-console
          console.log("🦀 Falling back to native Rust vector database");
        }
        return await this.createRust(config, opts.verbose);
      } catch (rustError) {
        if (opts.verbose) {
          // eslint-disable-next-line no-console
          console.error("❌ Both WASM and Rust implementations failed");
          // eslint-disable-next-line no-console
          console.error("WASM error:", error);
          // eslint-disable-next-line no-console
          console.error("Rust error:", rustError);
        }

        // Throw the original WASM error as it's the preferred implementation
        throw error;
      }
    }
  }

  /**
   * Create Rust vector database instance
   */
  private static async createRust(
    config: VectorDBConfig,
    verbose: boolean,
  ): Promise<RustVectorDatabase> {
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log("🦀 Creating Rust vector database...");
    }

    try {
      const rustDB = new RustVectorDatabase(config);
      await rustDB.initialize();

      if (verbose) {
        // eslint-disable-next-line no-console
        console.log("🚀 Rust vector database initialized successfully");
      }

      return rustDB;
    } catch (error) {
      if (verbose) {
        // eslint-disable-next-line no-console
        console.error("❌ Failed to create Rust vector database:", error);
      }
      throw error;
    }
  }

  /**
   * Create WASM vector database instance
   */
  private static async createWasm(
    config: VectorDBConfig,
    verbose: boolean,
  ): Promise<WasmVectorDatabase> {
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log("🕸️ Creating WASM vector database...");
    }

    const wasmDB = new WasmVectorDatabase(config);
    await wasmDB.initialize();

    if (verbose) {
      // eslint-disable-next-line no-console
      console.log("🚀 WASM vector database initialized successfully");
    }

    return wasmDB;
  }

  /**
   * Create HNSW vector database instance (for testing)
   */
  private static async createHNSW(
    config: VectorDBConfig,
    verbose: boolean,
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
 * Convenience function to create a vector database (uses WASM implementation)
 */
export async function createVectorDatabase(
  config: VectorDBConfig,
  options?: VectorDatabaseFactoryOptions,
): Promise<VectorDatabase> {
  return VectorDatabaseFactory.create(config, options);
}

/**
 * Create vector database with WASM implementation (default behavior)
 */
export async function createWasmVectorDatabase(
  config: VectorDBConfig,
  verbose = false,
): Promise<VectorDatabase> {
  return VectorDatabaseFactory.create(config, { verbose });
}

/**
 * Create vector database with native Rust implementation
 */
export async function createRustVectorDatabase(
  config: VectorDBConfig,
  verbose = false,
): Promise<VectorDatabase> {
  return VectorDatabaseFactory.create(config, {
    useRust: true,
    verbose,
  });
}

/**
 * Create vector database with HNSW implementation (for testing)
 */
export async function createHNSWVectorDatabase(
  config: VectorDBConfig,
  verbose = false,
): Promise<VectorDatabase> {
  return VectorDatabaseFactory.create(config, {
    forceHNSW: true,
    verbose,
  });
}
