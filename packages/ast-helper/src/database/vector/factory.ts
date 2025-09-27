/**
 * Vector Database Factory
 * 
 * Creates vector database instances with intelligent fallback:
 * 1. Primary: RustVectorDatabase (high-performance native Rust implementation)
 * 2. Fallback: HNSWVectorDatabase (TypeScript implementation with hnswlib-node)
 */

import type { VectorDatabase, VectorDBConfig } from "./types.js";
import { RustVectorDatabase } from "./rust-vector-database.js";
import { HNSWVectorDatabase } from "./hnsw-database.js";

export interface VectorDatabaseFactoryOptions {
  /** Prefer Rust implementation (default: true) */
  preferRust?: boolean;
  /** Force specific implementation */
  forceImplementation?: "rust" | "hnsw";
  /** Enable verbose logging for debugging */
  verbose?: boolean;
}

type RequiredFactoryOptions = Required<Omit<VectorDatabaseFactoryOptions, 'forceImplementation'>> & {
  forceImplementation?: "rust" | "hnsw";
};

/**
 * Factory for creating vector database instances with intelligent selection
 */
export class VectorDatabaseFactory {
  private static readonly DEFAULT_OPTIONS: RequiredFactoryOptions = {
    preferRust: true,
    forceImplementation: undefined,
    verbose: false,
  };

  /**
   * Create a vector database instance with intelligent implementation selection
   */
  static async create(
    config: VectorDBConfig,
    options: VectorDatabaseFactoryOptions = {}
  ): Promise<VectorDatabase> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    if (opts.verbose) {
      // eslint-disable-next-line no-console
      console.log(`🔧 Creating vector database with options:`, opts);
    }

    // Force specific implementation if requested
    if (opts.forceImplementation) {
      return this.createSpecific(config, opts.forceImplementation, opts.verbose);
    }

    // Try Rust implementation first (high-performance primary choice)
    if (opts.preferRust) {
      try {
        const rustDB = await this.tryCreateRust(config, opts.verbose);
        if (rustDB) {
          if (opts.verbose) {
            // eslint-disable-next-line no-console
            console.log("✅ Using high-performance Rust vector database");
          }
          return rustDB;
        }
      } catch (error) {
        if (opts.verbose) {
          // eslint-disable-next-line no-console
          console.warn("⚠️ Rust vector database unavailable:", (error as Error).message);
        }
      }
    }

    // Fallback to HNSW TypeScript implementation
    try {
      const hnswDB = await this.tryCreateHNSW(config, opts.verbose);
      if (opts.verbose) {
        // eslint-disable-next-line no-console
        console.log("📦 Using HNSW TypeScript vector database as fallback");
      }
      return hnswDB;
    } catch (error) {
      if (opts.verbose) {
        // eslint-disable-next-line no-console
        console.error("❌ HNSW vector database also failed:", (error as Error).message);
      }
      throw new Error(
        `Failed to create vector database. Both Rust and HNSW implementations failed. ` +
        `Rust error: ${opts.preferRust ? 'attempted first' : 'not attempted'}. ` +
        `HNSW error: ${(error as Error).message}`
      );
    }
  }

  /**
   * Create specific implementation (for testing or forced selection)
   */
  private static async createSpecific(
    config: VectorDBConfig,
    implementation: "rust" | "hnsw",
    verbose: boolean
  ): Promise<VectorDatabase> {
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log(`🎯 Forcing ${implementation} implementation`);
    }

    if (implementation === "rust") {
      const rustDB = await this.tryCreateRust(config, verbose);
      if (!rustDB) {
        throw new Error("Rust vector database implementation not available");
      }
      return rustDB;
    } else {
      return this.tryCreateHNSW(config, verbose);
    }
  }

  /**
   * Try creating Rust vector database instance
   */
  private static async tryCreateRust(
    config: VectorDBConfig,
    verbose: boolean
  ): Promise<RustVectorDatabase | null> {
    try {
      if (verbose) {
        // eslint-disable-next-line no-console
        console.log("🦀 Attempting to create Rust vector database...");
      }

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
        console.warn("🔧 Rust vector database initialization failed:", (error as Error).message);
      }
      return null;
    }
  }

  /**
   * Try creating HNSW vector database instance
   */
  private static async tryCreateHNSW(
    config: VectorDBConfig,
    verbose: boolean
  ): Promise<HNSWVectorDatabase> {
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log("📊 Creating HNSW vector database...");
    }

    const hnswDB = new HNSWVectorDatabase(config);
    await hnswDB.initialize();
    
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log("📈 HNSW vector database initialized successfully");
    }
    
    return hnswDB;
  }

  /**
   * Check if Rust implementation is available
   */
  static async isRustAvailable(): Promise<boolean> {
    try {
      // Try to load the Rust engine
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const engine = require("../../../ast-core-engine/index.js");
      return !!(engine?.AstCoreEngineApi);
    } catch {
      return false;
    }
  }

  /**
   * Check if HNSW implementation is available
   */
  static async isHNSWAvailable(): Promise<boolean> {
    try {
      // Try to load hnswlib-node
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("hnswlib-node");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get available implementations
   */
  static async getAvailableImplementations(): Promise<{
    rust: boolean;
    hnsw: boolean;
    recommended: "rust" | "hnsw" | "none";
  }> {
    const rust = await this.isRustAvailable();
    const hnsw = await this.isHNSWAvailable();
    
    let recommended: "rust" | "hnsw" | "none";
    if (rust) {
      recommended = "rust"; // Prefer high-performance Rust
    } else if (hnsw) {
      recommended = "hnsw"; // Fallback to TypeScript
    } else {
      recommended = "none"; // No implementations available
    }

    return { rust, hnsw, recommended };
  }
}

/**
 * Convenience function to create a vector database with Rust-first strategy
 */
export async function createVectorDatabase(
  config: VectorDBConfig,
  options?: VectorDatabaseFactoryOptions
): Promise<VectorDatabase> {
  return VectorDatabaseFactory.create(config, options);
}

/**
 * Create vector database with explicit Rust preference
 */
export async function createRustVectorDatabase(
  config: VectorDBConfig,
  verbose = false
): Promise<VectorDatabase> {
  return VectorDatabaseFactory.create(config, {
    preferRust: true,
    verbose,
  });
}

/**
 * Create vector database with HNSW fallback only
 */
export async function createHNSWVectorDatabase(
  config: VectorDBConfig,
  verbose = false
): Promise<VectorDatabase> {
  return VectorDatabaseFactory.create(config, {
    forceImplementation: "hnsw",
    verbose,
  });
}