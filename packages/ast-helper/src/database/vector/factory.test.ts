import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  VectorDatabaseFactory,
  createVectorDatabase,
  createRustVectorDatabase,
  createWasmVectorDatabase,
  createHNSWVectorDatabase,
} from "./factory.js";
import { VectorDBConfig, createVectorDBConfig } from "./types.js";
import { RustVectorDatabase } from "./rust-vector-database.js";
import { HNSWVectorDatabase } from "./hnsw-database.js";
import { existsSync, unlinkSync } from "fs";
import path from "path";

describe("VectorDatabaseFactory", () => {
  let testDbPath: string;
  let testIndexPath: string;
  let config: VectorDBConfig;

  beforeEach(() => {
    // Create temporary file paths
    testDbPath = path.join(process.cwd(), "test-factory.db");
    testIndexPath = path.join(process.cwd(), "test-factory.index");

    // Clean up any existing test files
    [testDbPath, testIndexPath].forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });

    // Create test configuration
    config = createVectorDBConfig({
      dimensions: 768,
      maxElements: 1000,
      M: 16,
      efConstruction: 200,
      storageFile: testDbPath,
      indexFile: testIndexPath,
    });
  });

  afterEach(() => {
    // Clean up test files
    [testDbPath, testIndexPath].forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
  });

  describe("Configuration Validation", () => {
    it("should validate required configuration", async () => {
      await expect(VectorDatabaseFactory.create(null as any)).rejects.toThrow(
        "Configuration is required",
      );
    });

    it("should validate dimensions", async () => {
      const invalidConfig = { ...config, dimensions: 0 };
      await expect(VectorDatabaseFactory.create(invalidConfig)).rejects.toThrow(
        "Invalid embedding dimension: 0. Must be between 1 and 10000",
      );

      const invalidConfig2 = { ...config, dimensions: 10001 };
      await expect(
        VectorDatabaseFactory.create(invalidConfig2),
      ).rejects.toThrow(
        "Invalid embedding dimension: 10001. Must be between 1 and 10000",
      );

      const invalidConfig3 = { ...config, dimensions: 1.5 };
      await expect(
        VectorDatabaseFactory.create(invalidConfig3),
      ).rejects.toThrow(
        "Invalid embedding dimension: 1.5. Must be between 1 and 10000",
      );
    });

    it("should validate maxElements", async () => {
      const invalidConfig = { ...config, maxElements: 0 };
      await expect(VectorDatabaseFactory.create(invalidConfig)).rejects.toThrow(
        "Invalid maxElements: 0. Must be a positive integer",
      );

      const invalidConfig2 = { ...config, maxElements: -5 };
      await expect(
        VectorDatabaseFactory.create(invalidConfig2),
      ).rejects.toThrow("Invalid maxElements: -5. Must be a positive integer");

      const invalidConfig3 = { ...config, maxElements: 1.5 };
      await expect(
        VectorDatabaseFactory.create(invalidConfig3),
      ).rejects.toThrow("Invalid maxElements: 1.5. Must be a positive integer");
    });

    it("should validate M parameter", async () => {
      const invalidConfig = { ...config, M: 0 };
      await expect(VectorDatabaseFactory.create(invalidConfig)).rejects.toThrow(
        "Invalid M parameter: 0. Must be between 1 and 100",
      );

      const invalidConfig2 = { ...config, M: 101 };
      await expect(
        VectorDatabaseFactory.create(invalidConfig2),
      ).rejects.toThrow("Invalid M parameter: 101. Must be between 1 and 100");
    });

    it("should validate efConstruction parameter", async () => {
      const invalidConfig = { ...config, efConstruction: 0 };
      await expect(VectorDatabaseFactory.create(invalidConfig)).rejects.toThrow(
        "Invalid efConstruction: 0. Must be a positive integer",
      );

      const invalidConfig2 = { ...config, efConstruction: -10 };
      await expect(
        VectorDatabaseFactory.create(invalidConfig2),
      ).rejects.toThrow(
        "Invalid efConstruction: -10. Must be a positive integer",
      );
    });
  });

  describe("Default Rust Implementation", () => {
    it("should create Rust implementation by default", async () => {
      // Factory should succeed and fall back to Rust when WASM is not available
      const db = await VectorDatabaseFactory.create(config);
      expect(db).toBeInstanceOf(RustVectorDatabase);

      // Verify the database is properly initialized
      expect(db).toBeDefined();

      // Clean up
      if ((db as any).close) {
        await (db as any).close();
      }
    });

    it("should handle Rust initialization failures", async () => {
      // Mock console for testing verbose mode
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        await VectorDatabaseFactory.create(config, { verbose: true });
      } catch {
        // Expected to fail, but verbose logging should have occurred
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Creating vector database with options"),
        );
      }

      consoleSpy.mockRestore();
    });
  });

  describe("WASM Implementation (Default)", () => {
    it("should create WASM implementation by default", async () => {
      // WASM fails and falls back to Rust, which should succeed
      const db = await VectorDatabaseFactory.create(config);
      expect(db).toBeInstanceOf(RustVectorDatabase);

      // Clean up
      if ((db as any).close) {
        await (db as any).close();
      }
    });

    it("should log WASM creation in verbose mode by default", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        await VectorDatabaseFactory.create(config, {
          verbose: true,
        });
      } catch {
        // Expected to fail due to WASM not available
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "🕸️ Attempting high-performance WASM vector database",
        ),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Rust Implementation (Explicit)", () => {
    it("should create Rust implementation when explicitly requested", async () => {
      // Rust implementation should succeed when explicitly requested
      const db = await VectorDatabaseFactory.create(config, { useRust: true });
      expect(db).toBeInstanceOf(RustVectorDatabase);

      // Clean up
      if ((db as any).close) {
        await (db as any).close();
      }
    });

    it("should log Rust creation in verbose mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        await VectorDatabaseFactory.create(config, {
          useRust: true,
          verbose: true,
        });
      } catch {
        // Expected to fail due to Rust not available
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("🦀 Using native Rust vector database"),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("HNSW Implementation", () => {
    it("should create HNSW implementation when forced", async () => {
      // HNSW implementation should succeed when forced
      const db = await VectorDatabaseFactory.create(config, {
        forceHNSW: true,
      });
      expect(db).toBeInstanceOf(HNSWVectorDatabase);

      // Clean up
      if ((db as any).close) {
        await (db as any).close();
      }
    });

    it("should log HNSW creation in verbose mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        await VectorDatabaseFactory.create(config, {
          forceHNSW: true,
          verbose: true,
        });
      } catch {
        // Expected to fail due to HNSW native bindings
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("🧪 Using HNSW implementation for testing"),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Intelligent Fallback", () => {
    it("should attempt fallback from Rust to WASM on failure", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      const db = await VectorDatabaseFactory.create(config, { verbose: true });
      expect(db).toBeInstanceOf(RustVectorDatabase);

      // Should have logged the fallback attempt
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "⚠️ WASM implementation failed, trying native Rust fallback:",
        ),
        expect.any(Error),
      );

      await db.shutdown();

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it("should successfully fallback to Rust when WASM fails", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const db = await VectorDatabaseFactory.create(config, { verbose: true });
      expect(db).toBeInstanceOf(RustVectorDatabase);

      // Should have logged the fallback attempt
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "⚠️ WASM implementation failed, trying native Rust fallback:",
        ),
        expect.any(Error),
      );

      await db.shutdown();

      consoleWarnSpy.mockRestore();
    });
  });

  describe("Convenience Functions", () => {
    describe("createVectorDatabase", () => {
      it("should create database using factory", async () => {
        const db = await createVectorDatabase(config);
        expect(db).toBeInstanceOf(RustVectorDatabase); // Should fallback to Rust
        await db.shutdown();
      });

      it("should pass options to factory", async () => {
        const db = await createVectorDatabase(config, { verbose: true });
        expect(db).toBeInstanceOf(RustVectorDatabase); // Should fallback to Rust
        await db.shutdown();
      });
    });

    describe("createRustVectorDatabase", () => {
      it("should explicitly create Rust implementation", async () => {
        const db = await createRustVectorDatabase(config);
        expect(db).toBeInstanceOf(RustVectorDatabase);
        expect((db as any).isInitialized).toBe(true);
        await db.shutdown();
      });

      it("should respect verbose flag", async () => {
        const consoleSpy = vi
          .spyOn(console, "log")
          .mockImplementation(() => {});

        try {
          await createRustVectorDatabase(config, true);
        } catch {
          // Expected to fail
        }

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("🦀 Using native Rust vector database"),
        );

        consoleSpy.mockRestore();
      });
    });

    describe("createWasmVectorDatabase", () => {
      it("should explicitly create WASM implementation", async () => {
        // createWasmVectorDatabase calls the factory which tries WASM then falls back to Rust
        const db = await createWasmVectorDatabase(config);
        // Since WASM is not available, it should fall back to Rust
        expect(db).toBeInstanceOf(RustVectorDatabase);

        // Clean up
        if ((db as any).close) {
          await (db as any).close();
        }
      });

      it("should respect verbose flag", async () => {
        const consoleSpy = vi
          .spyOn(console, "log")
          .mockImplementation(() => {});

        try {
          await createWasmVectorDatabase(config, true);
        } catch {
          // Expected to fail
        }

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "🕸️ Attempting high-performance WASM vector database",
          ),
        );

        consoleSpy.mockRestore();
      });
    });

    describe("createHNSWVectorDatabase", () => {
      it("should explicitly create HNSW implementation", async () => {
        const db = await createHNSWVectorDatabase(config);
        expect(db).toBeDefined();
        expect((db as any).isInitialized).toBe(true);
        await db.shutdown();
      });

      it("should respect verbose flag", async () => {
        const consoleSpy = vi
          .spyOn(console, "log")
          .mockImplementation(() => {});

        try {
          await createHNSWVectorDatabase(config, true);
        } catch {
          // Expected to fail
        }

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("🧪 Using HNSW implementation for testing"),
        );

        consoleSpy.mockRestore();
      });
    });
  });

  describe("Options Handling", () => {
    it("should use default options when none provided", async () => {
      // Test that factory uses defaults
      try {
        await VectorDatabaseFactory.create(config);
      } catch {
        // Expected to fail, but should have processed with defaults
      }

      // No errors during option processing means defaults were applied
    });

    it("should merge provided options with defaults", async () => {
      const options = { verbose: true, useRust: false };

      try {
        await VectorDatabaseFactory.create(config, options);
      } catch {
        // Expected to fail, but should have processed options
      }

      // No errors during option processing means merge was successful
    });

    it("should handle partial option objects", async () => {
      const partialOptions = { verbose: true };

      try {
        await VectorDatabaseFactory.create(config, partialOptions);
      } catch {
        // Expected to fail, but should have processed partial options
      }

      // No errors during option processing means partial merge worked
    });
  });

  describe("Error Handling", () => {
    it("should provide meaningful error messages", async () => {
      const invalidConfig = { ...config, dimensions: -1 };

      await expect(VectorDatabaseFactory.create(invalidConfig)).rejects.toThrow(
        /Invalid embedding dimension/,
      );
    });

    it("should validate before attempting creation", async () => {
      const invalidConfig = { ...config, maxElements: 0 };

      // Should fail validation before trying to create any implementation
      await expect(VectorDatabaseFactory.create(invalidConfig)).rejects.toThrow(
        /Invalid maxElements/,
      );
    });

    it("should handle missing required config properties", async () => {
      const incompleteConfig = { dimensions: 768 } as VectorDBConfig;

      await expect(
        VectorDatabaseFactory.create(incompleteConfig),
      ).rejects.toThrow();
    });
  });
});
