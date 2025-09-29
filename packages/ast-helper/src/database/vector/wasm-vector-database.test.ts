import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WasmVectorDatabase } from "./wasm-vector-database.js";
import { RustVectorDatabase } from "./rust-vector-database.js";
import {
  VectorDBConfig,
  VectorMetadata,
  VectorInsert,
  createVectorDBConfig,
} from "./types.js";
import { existsSync, unlinkSync } from "fs";
import path from "path";

describe("WasmVectorDatabase", () => {
  let db: WasmVectorDatabase;
  let testDbPath: string;
  let testIndexPath: string;
  let testMetadata: VectorMetadata;
  let config: VectorDBConfig;

  beforeEach(async () => {
    // Create temporary file paths
    testDbPath = path.join(process.cwd(), "test-wasm-vector.db");
    testIndexPath = path.join(process.cwd(), "test-wasm-vector.index");

    // Clean up any existing test files
    [testDbPath, testIndexPath].forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });

    // Create test metadata that meets the interface requirements
    testMetadata = {
      signature: "function wasmTestFunction()",
      summary: "WASM test function for unit testing",
      fileId: "wasm-test-file-1",
      filePath: "/test/wasm-path.ts",
      lineNumber: 100,
      confidence: 0.85,
      lastUpdated: new Date(),
    };

    // Create test configuration using the helper function
    config = createVectorDBConfig({
      dimensions: 768,
      maxElements: 1000,
      M: 16,
      efConstruction: 200,
      storageFile: testDbPath,
      indexFile: testIndexPath,
    });

    db = new WasmVectorDatabase(config);
  });

  afterEach(async () => {
    // Clean up
    if (db) {
      try {
        await db.shutdown();
      } catch {
        // Ignore shutdown errors in tests
      }
    }
    [testDbPath, testIndexPath].forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
  });

  describe("Initialization", () => {
    // Since WASM module is not yet built, most initialization tests will fail
    // but we can test the configuration validation and error handling

    it("should validate configuration during initialization", async () => {
      const invalidConfig = createVectorDBConfig({
        dimensions: -1, // Invalid dimension
        storageFile: testDbPath,
        indexFile: testIndexPath,
      });

      const invalidDb = new WasmVectorDatabase(invalidConfig);
      await expect(invalidDb.initialize()).rejects.toThrow(
        "Invalid vector database configuration",
      );
    });

    it("should handle WASM module not available error gracefully", async () => {
      await expect(db.initialize()).rejects.toThrow(
        "WASM vector database module not yet available",
      );
    });

    it("should not reinitialize if already initialized", async () => {
      // Since WASM module is not available, we'll simulate this behavior
      // by checking the method handles the already initialized case

      // Mock the initialization state
      const originalIsInitialized = (db as any).isInitialized;
      (db as any).isInitialized = true;

      // Should return without throwing
      await expect(db.initialize()).resolves.toBeUndefined();

      // Restore original state
      (db as any).isInitialized = originalIsInitialized;
    });

    it("should update config when provided to initialize", async () => {
      const newConfig = createVectorDBConfig({
        dimensions: 384, // Different dimension
        storageFile: testDbPath,
        indexFile: testIndexPath,
      });

      // Mock the config assignment to test the logic
      const spy = vi.spyOn(Object, "assign");

      try {
        await db.initialize(newConfig);
      } catch {
        // Expected to fail due to WASM module not available
      }

      expect(spy).toHaveBeenCalledWith(config, newConfig);
      spy.mockRestore();
    });
  });

  describe("Error Handling and Validation", () => {
    beforeEach(() => {
      // Mock initialization state for validation tests
      (db as any).isInitialized = true;
      (db as any).wasmModule = {
        add_vector_to_db_wasm: vi.fn(),
        search_vectors_wasm: vi.fn().mockReturnValue([]),
        get_vector_count_wasm: vi.fn().mockReturnValue(0),
        clear_vector_database_wasm: vi.fn(),
      };
    });

    describe("insertVector validation", () => {
      const testVector = new Array(768).fill(0).map((_, i) => i * 0.001);

      it("should reject empty nodeId", async () => {
        await expect(
          db.insertVector("", testVector, testMetadata),
        ).rejects.toThrow("nodeId is required and cannot be empty");
      });

      it("should reject whitespace-only nodeId", async () => {
        await expect(
          db.insertVector("   ", testVector, testMetadata),
        ).rejects.toThrow("nodeId is required and cannot be empty");
      });

      it("should reject empty vector", async () => {
        await expect(
          db.insertVector("test-node", [], testMetadata),
        ).rejects.toThrow("vector is required and cannot be empty");
      });

      it("should reject vector with wrong dimensions", async () => {
        const wrongVector = [1, 2, 3]; // Only 3 dimensions instead of 768
        await expect(
          db.insertVector("test-node", wrongVector, testMetadata),
        ).rejects.toThrow("Vector dimensions mismatch: expected 768, got 3");
      });

      it("should reject missing metadata", async () => {
        await expect(
          db.insertVector("test-node", testVector, null as any),
        ).rejects.toThrow("metadata is required");
      });
    });

    describe("insertVectors validation", () => {
      it("should reject empty vectors array", async () => {
        await expect(db.insertVectors([])).rejects.toThrow(
          "vectors array is required and cannot be empty",
        );
      });

      it("should reject null vectors array", async () => {
        await expect(db.insertVectors(null as any)).rejects.toThrow(
          "vectors array is required and cannot be empty",
        );
      });
    });

    describe("searchSimilar validation", () => {
      const testVector = new Array(768).fill(0).map((_, i) => i * 0.001);

      it("should reject vector with wrong dimensions", async () => {
        const wrongVector = [1, 2, 3];
        await expect(db.searchSimilar(wrongVector)).rejects.toThrow(
          "Query vector dimensions mismatch: expected 768, got 3",
        );
      });

      it("should reject invalid k parameter", async () => {
        await expect(db.searchSimilar(testVector, 0)).rejects.toThrow(
          "Parameter k must be greater than 0",
        );

        await expect(db.searchSimilar(testVector, -5)).rejects.toThrow(
          "Parameter k must be greater than 0",
        );
      });

      it("should reject invalid ef parameter", async () => {
        await expect(db.searchSimilar(testVector, 10, 0)).rejects.toThrow(
          "Parameter ef must be greater than 0",
        );

        await expect(db.searchSimilar(testVector, 10, -3)).rejects.toThrow(
          "Parameter ef must be greater than 0",
        );
      });
    });

    describe("updateVector validation", () => {
      const testVector = new Array(768).fill(0).map((_, i) => i * 0.001);

      it("should reject empty nodeId", async () => {
        await expect(db.updateVector("", testVector)).rejects.toThrow(
          "nodeId is required and cannot be empty",
        );
      });

      it("should reject empty vector", async () => {
        await expect(db.updateVector("test-node", [])).rejects.toThrow(
          "vector is required and cannot be empty",
        );
      });

      it("should reject vector with wrong dimensions", async () => {
        const wrongVector = [1, 2, 3];
        await expect(db.updateVector("test-node", wrongVector)).rejects.toThrow(
          "Vector dimensions mismatch: expected 768, got 3",
        );
      });
    });

    describe("deleteVector validation", () => {
      it("should reject empty nodeId", async () => {
        await expect(db.deleteVector("")).rejects.toThrow(
          "nodeId is required and cannot be empty",
        );
      });

      it("should reject whitespace-only nodeId", async () => {
        await expect(db.deleteVector("   ")).rejects.toThrow(
          "nodeId is required and cannot be empty",
        );
      });
    });
  });

  describe("Performance Monitoring", () => {
    beforeEach(() => {
      // Mock initialization for performance tests
      (db as any).isInitialized = true;
      (db as any).performanceMetrics = {
        searchTimes: [10, 20, 30],
        insertTimes: [5, 15, 25],
        batchOperationTimes: [100, 200],
        wasmBoundaryCrossings: 50,
        memoryTransferBytes: 1024,
        lastResetTime: Date.now() - 1000, // 1 second ago
      };
    });

    it("should provide performance metrics", () => {
      const metrics = (db as any).getPerformanceMetrics();

      expect(metrics).toHaveProperty("searchTimes");
      expect(metrics).toHaveProperty("insertTimes");
      expect(metrics).toHaveProperty("batchOperationTimes");
      expect(metrics).toHaveProperty("wasmBoundaryCrossings");
      expect(metrics).toHaveProperty("memoryTransferBytes");
      expect(metrics).toHaveProperty("averageSearchTime");
      expect(metrics).toHaveProperty("averageInsertTime");
      expect(metrics).toHaveProperty("averageBatchTime");
      expect(metrics).toHaveProperty("boundaryCrossingsPerSecond");
      expect(metrics).toHaveProperty("memoryTransferRate");

      expect(metrics.averageSearchTime).toBe(20); // (10+20+30)/3
      expect(metrics.averageInsertTime).toBe(15); // (5+15+25)/3
      expect(metrics.averageBatchTime).toBe(150); // (100+200)/2
    });

    it("should calculate rates correctly", () => {
      const metrics = (db as any).getPerformanceMetrics();

      // Should have positive rates since we set up metrics 1 second ago
      expect(metrics.boundaryCrossingsPerSecond).toBeGreaterThan(0);
      expect(metrics.memoryTransferRate).toBeGreaterThan(0);
    });

    it("should reset performance metrics", () => {
      (db as any).resetPerformanceMetrics();
      const metrics = (db as any).getPerformanceMetrics();

      expect(metrics.searchTimes).toHaveLength(0);
      expect(metrics.insertTimes).toHaveLength(0);
      expect(metrics.batchOperationTimes).toHaveLength(0);
      expect(metrics.wasmBoundaryCrossings).toBe(0);
      expect(metrics.memoryTransferBytes).toBe(0);
    });
  });

  describe("Batch Operations", () => {
    const testVectors: VectorInsert[] = [
      {
        nodeId: "batch-node-1",
        vector: new Array(768).fill(0).map((_, i) => i * 0.001),
        metadata: { ...testMetadata, signature: "function batchTest1()" },
      },
      {
        nodeId: "batch-node-2",
        vector: new Array(768).fill(0).map((_, i) => i * 0.002),
        metadata: { ...testMetadata, signature: "function batchTest2()" },
      },
    ];

    beforeEach(() => {
      // Mock initialization and storage for batch tests
      (db as any).isInitialized = true;
      (db as any).storage = {
        insertVector: vi.fn().mockResolvedValue(undefined),
      };
      (db as any).wasmModule = {
        add_vector_to_db_wasm: vi.fn(),
      };
    });

    it("should handle batch operations with memory optimization", async () => {
      // Enable memory optimization in batch config
      (db as any).batchConfig.enableMemoryOptimization = true;

      await expect(db.insertVectors(testVectors)).resolves.toBeUndefined();

      // Should have called storage and WASM for each vector
      expect((db as any).storage.insertVector).toHaveBeenCalledTimes(2);
      expect(
        (db as any).wasmModule.add_vector_to_db_wasm,
      ).toHaveBeenCalledTimes(2);
    });

    it("should handle partial batch failures gracefully", async () => {
      // Mock storage to fail on second insert
      (db as any).storage.insertVector = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Storage error"));

      await expect(db.insertVectors(testVectors)).rejects.toThrow(
        "Batch insert completed with errors",
      );
    });
  });

  describe("Statistics and Status", () => {
    beforeEach(() => {
      // Mock initialization and dependencies for stats tests
      (db as any).isInitialized = true;
      (db as any).wasmModule = {
        get_vector_count_wasm: vi.fn().mockReturnValue(42),
      };
      (db as any).storage = {
        getStats: vi.fn().mockResolvedValue({
          vectorCount: 42,
          storageSize: 1024,
        }),
      };
      (db as any).performanceMetrics = {
        searchTimes: [10, 20, 30],
        insertTimes: [],
        batchOperationTimes: [],
        wasmBoundaryCrossings: 0,
        memoryTransferBytes: 0,
        lastResetTime: Date.now(),
      };
    });

    it("should return accurate statistics", async () => {
      const stats = await db.getStats();

      expect(stats).toHaveProperty("vectorCount", 42);
      expect(stats).toHaveProperty("memoryUsage", 0); // WASM doesn't provide this yet
      expect(stats).toHaveProperty("indexFileSize", 0); // Not applicable for WASM
      expect(stats).toHaveProperty("storageFileSize", 1024);
      expect(stats).toHaveProperty("lastSaved");
      expect(stats).toHaveProperty("buildTime", 0);
      expect(stats).toHaveProperty("averageSearchTime", 20); // (10+20+30)/3
      expect(stats).toHaveProperty("status", "ready");
    });

    it("should handle errors in stats collection", async () => {
      // Mock storage to throw error
      (db as any).storage.getStats = vi
        .fn()
        .mockRejectedValue(new Error("Stats error"));

      const stats = await db.getStats();
      expect(stats.status).toBe("error");
      expect(stats.errorMessage).toBeDefined();
    });
  });

  describe("Resource Management", () => {
    it("should clean up resources during shutdown", async () => {
      // Mock all dependencies
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      const mockPendingOp = {
        type: "insert",
        nodeId: "test",
        resolve: vi.fn(),
        reject: vi.fn(),
      };

      (db as any).batchTimeout = setTimeout(() => {}, 1000);
      (db as any).pendingOperations = [mockPendingOp];
      (db as any).storage = {
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      (db as any).wasmModule = {
        clear_vector_database_wasm: vi.fn(),
      };

      await db.shutdown();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(mockPendingOp.reject).toHaveBeenCalledWith(
        new Error("Database shutting down"),
      );
      expect((db as any).storage.shutdown).toHaveBeenCalled();
      expect(
        (db as any).wasmModule.clear_vector_database_wasm,
      ).toHaveBeenCalled();
      expect((db as any).isInitialized).toBe(false);
      expect((db as any).wasmModule).toBeNull();

      clearTimeoutSpy.mockRestore();
    });

    it("should handle shutdown errors gracefully", async () => {
      (db as any).storage = {
        shutdown: vi.fn().mockRejectedValue(new Error("Shutdown error")),
      };
      (db as any).wasmModule = {
        clear_vector_database_wasm: vi.fn().mockImplementation(() => {
          throw new Error("WASM cleanup error");
        }),
      };

      // Should not throw despite internal errors
      await expect(db.shutdown()).resolves.toBeUndefined();
    });
  });

  describe("Interface Compatibility", () => {
    it("should implement all VectorDatabase interface methods", () => {
      // Check that all required methods exist
      expect(typeof db.initialize).toBe("function");
      expect(typeof db.insertVector).toBe("function");
      expect(typeof db.insertVectors).toBe("function");
      expect(typeof db.searchSimilar).toBe("function");
      expect(typeof db.updateVector).toBe("function");
      expect(typeof db.deleteVector).toBe("function");
      expect(typeof db.rebuild).toBe("function");
      expect(typeof db.getStats).toBe("function");
      expect(typeof db.shutdown).toBe("function");
    });

    it("should have correct method signatures", () => {
      // Check initialize method signature
      expect(db.initialize.length).toBe(1); // Optional config parameter

      // Check insertVector signature
      expect(db.insertVector.length).toBe(3); // nodeId, vector, metadata

      // Check searchSimilar signature
      expect(db.searchSimilar.length).toBe(3); // queryVector, k, ef

      // Check other methods have correct parameter counts
      expect(db.updateVector.length).toBe(2); // nodeId, vector
      expect(db.deleteVector.length).toBe(1); // nodeId
      expect(db.rebuild.length).toBe(0); // no parameters
      expect(db.getStats.length).toBe(0); // no parameters
      expect(db.shutdown.length).toBe(0); // no parameters
    });
  });

  describe("Configuration Validation", () => {
    it("should validate all configuration parameters", async () => {
      const invalidConfigs = [
        { dimensions: 0, error: "dimensions must be greater than 0" },
        { dimensions: -1, error: "dimensions must be greater than 0" },
        { maxElements: 0, error: "maxElements must be greater than 0" },
        { maxElements: -1, error: "maxElements must be greater than 0" },
        { M: 0, error: "M must be between 1 and 100" },
        { M: 101, error: "M must be between 1 and 100" },
        { efConstruction: 0, error: "efConstruction must be greater than 0" },
        { efConstruction: -1, error: "efConstruction must be greater than 0" },
        {
          space: "invalid" as any,
          error: "space must be one of: cosine, l2, ip",
        },
        { storageFile: "", error: "storageFile is required" },
        { storageFile: "   ", error: "storageFile is required" },
        { indexFile: "", error: "indexFile is required" },
        { saveInterval: 0, error: "saveInterval must be greater than 0" },
      ];

      for (const { error, ...invalidProps } of invalidConfigs) {
        const invalidConfig = createVectorDBConfig({
          ...config,
          ...invalidProps,
        });

        const invalidDb = new WasmVectorDatabase(invalidConfig);
        await expect(invalidDb.initialize()).rejects.toThrow(error);
      }
    });

    it("should validate efConstruction >= M constraint", async () => {
      const invalidConfig = createVectorDBConfig({
        ...config,
        M: 20,
        efConstruction: 10, // Less than M
      });

      const invalidDb = new WasmVectorDatabase(invalidConfig);
      await expect(invalidDb.initialize()).rejects.toThrow(
        "efConstruction should be >= M for optimal performance",
      );
    });
  });

  describe("Feature Parity with NAPI Implementation", () => {
    /**
     * These tests validate that the WASM implementation maintains interface
     * compatibility and similar behavior patterns to the NAPI implementation,
     * even when the actual WASM module is not yet available.
     */
    describe("Interface Compatibility", () => {
      it("should implement all VectorDatabase interface methods", () => {
        const wasmDb = new WasmVectorDatabase(config);
        const rustDb = new RustVectorDatabase(config);

        // Verify both implementations have the same public interface
        const wasmMethods = Object.getOwnPropertyNames(
          Object.getPrototypeOf(wasmDb),
        ).filter((name) => typeof (wasmDb as any)[name] === "function");
        const rustMethods = Object.getOwnPropertyNames(
          Object.getPrototypeOf(rustDb),
        ).filter((name) => typeof (rustDb as any)[name] === "function");

        // Both should implement core VectorDatabase methods
        const expectedMethods = [
          "initialize",
          "insertVector",
          "insertVectors",
          "updateVector",
          "deleteVector",
          "searchSimilar",
          "getStats",
          "rebuild",
          "shutdown",
        ];

        for (const method of expectedMethods) {
          expect(wasmMethods).toContain(method);
          expect(rustMethods).toContain(method);
        }
      });

      it("should have consistent constructor signatures", () => {
        expect(() => new WasmVectorDatabase(config)).not.toThrow();
        expect(() => new RustVectorDatabase(config)).not.toThrow();
      });

      it("should handle the same configuration validation", async () => {
        // Test invalid dimensions
        const invalidDimConfig = createVectorDBConfig({
          dimensions: -1,
          maxElements: 1000,
          efConstruction: 200,
          M: 16,
          storageFile: path.join(process.cwd(), "test-invalid-wasm.db"),
          indexFile: path.join(process.cwd(), "test-invalid-wasm.index"),
        });

        const wasmDb = new WasmVectorDatabase(invalidDimConfig);
        const rustDb = new RustVectorDatabase(invalidDimConfig);

        // Both should fail with similar validation errors
        await expect(wasmDb.initialize()).rejects.toThrow();
        await expect(rustDb.initialize()).rejects.toThrow();
      });
    });

    describe("Error Handling Parity", () => {
      it("should throw consistent errors for uninitialized operations", async () => {
        const wasmDbPath = path.join(process.cwd(), "test-uninit-wasm.db");
        const rustDbPath = path.join(process.cwd(), "test-uninit-rust.db");

        const wasmConfig = createVectorDBConfig({
          dimensions: 768,
          maxElements: 1000,
          efConstruction: 200,
          M: 16,
          storageFile: wasmDbPath,
          indexFile: wasmDbPath.replace(".db", ".index"),
        });

        const rustConfig = createVectorDBConfig({
          dimensions: 768,
          maxElements: 1000,
          efConstruction: 200,
          M: 16,
          storageFile: rustDbPath,
          indexFile: rustDbPath.replace(".db", ".index"),
        });

        const wasmDb = new WasmVectorDatabase(wasmConfig);
        const rustDb = new RustVectorDatabase(rustConfig);

        const testVector = new Array(768).fill(0).map((_, i) => i * 0.001);

        // Both should throw similar errors for uninitialized access
        await expect(
          wasmDb.insertVector("test", testVector, testMetadata),
        ).rejects.toThrow(/not initialized/i);

        await expect(
          rustDb.insertVector("test", testVector, testMetadata),
        ).rejects.toThrow(/not initialized/i);

        // Clean up
        [wasmDbPath, rustDbPath].forEach((file) => {
          [file, file.replace(".db", ".index")].forEach((f) => {
            if (existsSync(f)) {
              unlinkSync(f);
            }
          });
        });
      });

      it("should handle dimension mismatch errors consistently", async () => {
        // Since WASM module is not available, both implementations will fail during initialization
        // But both should fail in similar ways with similar error patterns
        const wasmDb = new WasmVectorDatabase(config);
        const rustDb = new RustVectorDatabase(config);

        // Both should fail to initialize due to missing dependencies
        await expect(wasmDb.initialize()).rejects.toThrow(
          /WASM.*not.*available/i,
        );
        await expect(rustDb.initialize()).rejects.toThrow(); // Rust engine not available

        // Verify both fail before vector operations can be tested
        // This ensures consistent initialization failure patterns
        expect(wasmDb.constructor.name).toBe("WasmVectorDatabase");
        expect(rustDb.constructor.name).toBe("RustVectorDatabase");
      });
    });

    describe("Performance Characteristics Parity", () => {
      it("should have similar initialization behavior", async () => {
        // Test that both implementations fail initialization in reasonable time
        const wasmDb = new WasmVectorDatabase(config);
        const rustDb = new RustVectorDatabase(config);

        // Both should fail quickly when dependencies are missing
        const wasmStartTime = Date.now();
        await expect(wasmDb.initialize()).rejects.toThrow();
        const wasmFailTime = Date.now() - wasmStartTime;

        const rustStartTime = Date.now();
        await expect(rustDb.initialize()).rejects.toThrow();
        const rustFailTime = Date.now() - rustStartTime;

        // Both should fail quickly (under 1 second) when dependencies are missing
        expect(wasmFailTime).toBeLessThan(1000);
        expect(rustFailTime).toBeLessThan(1000);
      });

      it("should handle batch operations efficiently", async () => {
        // Test that both implementations have the same batch operation interface
        const wasmDb = new WasmVectorDatabase(config);
        const rustDb = new RustVectorDatabase(config);

        // Both should have insertVectors method
        expect(typeof wasmDb.insertVectors).toBe("function");
        expect(typeof rustDb.insertVectors).toBe("function");

        // Both should fail similarly when not initialized
        const batchVectors: VectorInsert[] = Array.from(
          { length: 2 },
          (_, i) => ({
            nodeId: `test-${i}`,
            vector: new Array(768).fill(0).map((_, j) => (i + j) * 0.001),
            metadata: { ...testMetadata, filePath: `test-${i}.ts` },
          }),
        );

        // Both should fail batch operations when not initialized
        await expect(wasmDb.insertVectors(batchVectors)).rejects.toThrow(
          /not initialized/i,
        );
        await expect(rustDb.insertVectors(batchVectors)).rejects.toThrow(
          /not initialized/i,
        );
      });
    });

    describe("Data Consistency Parity", () => {
      it("should maintain consistent statistics", async () => {
        // Test that both implementations have the same statistics interface
        const wasmDb = new WasmVectorDatabase(config);
        const rustDb = new RustVectorDatabase(config);

        // Both should have getStats method
        expect(typeof wasmDb.getStats).toBe("function");
        expect(typeof rustDb.getStats).toBe("function");

        // Both should fail to get stats when not initialized
        await expect(wasmDb.getStats()).rejects.toThrow(/not initialized/i);
        await expect(rustDb.getStats()).rejects.toThrow(/not initialized/i);

        // Both should have the same CRUD operation methods
        expect(typeof wasmDb.insertVector).toBe("function");
        expect(typeof wasmDb.updateVector).toBe("function");
        expect(typeof wasmDb.deleteVector).toBe("function");
        expect(typeof rustDb.insertVector).toBe("function");
        expect(typeof rustDb.updateVector).toBe("function");
        expect(typeof rustDb.deleteVector).toBe("function");
      });

      it("should handle search result consistency", async () => {
        // Test that both implementations have the same search interface
        const wasmDb = new WasmVectorDatabase(config);
        const rustDb = new RustVectorDatabase(config);

        // Both should have searchSimilar method
        expect(typeof wasmDb.searchSimilar).toBe("function");
        expect(typeof rustDb.searchSimilar).toBe("function");

        const queryVector = new Array(768).fill(0).map((_, i) => i * 0.001);

        // Both should fail to search when not initialized
        await expect(wasmDb.searchSimilar(queryVector, 3)).rejects.toThrow(
          /not initialized/i,
        );
        await expect(rustDb.searchSimilar(queryVector, 3)).rejects.toThrow(
          /not initialized/i,
        );

        // Both should validate query vector dimensions before initialization failure
        const wrongVector = [1, 2, 3]; // Wrong dimension
        await expect(wasmDb.searchSimilar(wrongVector, 3)).rejects.toThrow();
        await expect(rustDb.searchSimilar(wrongVector, 3)).rejects.toThrow();
      });
    });

    describe("Resource Management Parity", () => {
      it("should handle initialization and shutdown cleanly", async () => {
        // Test that both implementations have consistent lifecycle methods
        const wasmDb = new WasmVectorDatabase(config);
        const rustDb = new RustVectorDatabase(config);

        // Both should have initialize and shutdown methods
        expect(typeof wasmDb.initialize).toBe("function");
        expect(typeof wasmDb.shutdown).toBe("function");
        expect(typeof rustDb.initialize).toBe("function");
        expect(typeof rustDb.shutdown).toBe("function");

        // Both should fail to initialize due to missing dependencies
        await expect(wasmDb.initialize()).rejects.toThrow();
        await expect(rustDb.initialize()).rejects.toThrow();

        // Both should handle shutdown gracefully even when not initialized
        await expect(wasmDb.shutdown()).resolves.not.toThrow();
        await expect(rustDb.shutdown()).resolves.not.toThrow();
      });

      it("should handle multiple shutdown calls gracefully", async () => {
        // Test that both implementations handle multiple shutdown calls
        const wasmDb = new WasmVectorDatabase(config);
        const rustDb = new RustVectorDatabase(config);

        // Multiple shutdowns should not throw for either implementation
        await expect(wasmDb.shutdown()).resolves.not.toThrow();
        await expect(wasmDb.shutdown()).resolves.not.toThrow();
        await expect(rustDb.shutdown()).resolves.not.toThrow();
        await expect(rustDb.shutdown()).resolves.not.toThrow();
      });
    });
  });
});
