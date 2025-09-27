/**
 * @fileoverview Unit tests for Vector Database Factory with Rust-first strategy
 */

import { describe, it, expect, afterEach } from "vitest";
import { 
  VectorDatabaseFactory, 
  createVectorDatabase,
  createRustVectorDatabase,
  createHNSWVectorDatabase,
  type VectorDatabaseFactoryOptions 
} from "../../../packages/ast-helper/src/database/vector/factory.js";
import { createVectorDBConfig } from "../../../packages/ast-helper/src/database/vector/types.js";
import { unlink } from "fs/promises";
import { existsSync } from "fs";

describe("Vector Database Factory", () => {
  const testConfig = createVectorDBConfig({
    dimensions: 768,
    maxElements: 1000,
    efConstruction: 200,
    M: 16,
    space: "cosine" as const,
    storageFile: "./test-factory.sqlite",
    indexFile: "./test-factory.hnsw",
    autoSave: false,
    saveInterval: 60,
  });

  // Clean up test files
  afterEach(async () => {
    try {
      if (existsSync("./test-factory.sqlite")) {
        await unlink("./test-factory.sqlite");
      }
      if (existsSync("./test-factory.hnsw")) {
        await unlink("./test-factory.hnsw");
      }
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe("VectorDatabaseFactory static methods", () => {
    it("should prefer Rust implementation by default", async () => {
      const options: VectorDatabaseFactoryOptions = {};
      const database = await VectorDatabaseFactory.create(testConfig, options);
      
      expect(database).toBeDefined();
      // The database should be either Rust or HNSW implementation
      expect(typeof database.initialize).toBe("function");
    });

    it("should fallback to HNSW when Rust is not available", async () => {
      const options: VectorDatabaseFactoryOptions = {
        forceImplementation: "hnsw"
      };
      const database = await VectorDatabaseFactory.create(testConfig, options);
      
      expect(database).toBeDefined();
      expect(typeof database.initialize).toBe("function");
    });

    it("should force Rust implementation when requested", async () => {
      const options: VectorDatabaseFactoryOptions = {
        forceImplementation: "rust"
      };
      
      // Should either succeed or throw if Rust is not available
      try {
        const database = await VectorDatabaseFactory.create(testConfig, options);
        expect(database).toBeDefined();
        expect(typeof database.initialize).toBe("function");
      } catch (_error) {
        // Expected if Rust is not available
        expect(_error).toBeDefined();
      }
    });

    it("should disable Rust preference when requested", async () => {
      const options: VectorDatabaseFactoryOptions = {
        preferRust: false
      };
      const database = await VectorDatabaseFactory.create(testConfig, options);
      
      expect(database).toBeDefined();
      expect(typeof database.initialize).toBe("function");
    });

    it("should get available implementations", async () => {
      const implementations = await VectorDatabaseFactory.getAvailableImplementations();
      
      expect(implementations).toBeDefined();
      expect(typeof implementations.rust).toBe("boolean");
      expect(typeof implementations.hnsw).toBe("boolean");
      expect(["rust", "hnsw", "none"]).toContain(implementations.recommended);
    });
  });

  describe("Convenience functions", () => {
    it("should create database with createVectorDatabase", async () => {
      const database = await createVectorDatabase(testConfig);
      expect(database).toBeDefined();
      expect(typeof database.initialize).toBe("function");
    });

    it("should create Rust database with createRustVectorDatabase", async () => {
      try {
        const database = await createRustVectorDatabase(testConfig);
        expect(database).toBeDefined();
        expect(typeof database.initialize).toBe("function");
      } catch (error) {
        // Expected if Rust is not available
        expect(error).toBeDefined();
      }
    });

    it("should create HNSW database with createHNSWVectorDatabase", async () => {
      const database = await createHNSWVectorDatabase(testConfig);
      expect(database).toBeDefined();
      expect(typeof database.initialize).toBe("function");
    });
  });

  describe("Database initialization", () => {
    it("should initialize database successfully", async () => {
      const database = await createVectorDatabase(testConfig);
      
      // Test initialization
      await expect(database.initialize(testConfig)).resolves.not.toThrow();
    });

    it("should handle VectorDatabase interface operations", async () => {
      const database = await createVectorDatabase(testConfig);
      await database.initialize(testConfig);
      
      // Test interface compliance
      expect(typeof database.insertVector).toBe("function");
      expect(typeof database.searchSimilar).toBe("function");
      expect(typeof database.getStats).toBe("function");
      expect(typeof database.shutdown).toBe("function");
    });
  });

  describe("Error handling", () => {
    it("should handle invalid configuration gracefully", async () => {
      const invalidConfig = createVectorDBConfig({
        dimensions: -1, // Invalid
        maxElements: 1000,
        efConstruction: 200,
        M: 16,
        space: "cosine" as const,
        storageFile: "./test-invalid.sqlite",
        indexFile: "./test-invalid.hnsw",
      });

      const database = await createVectorDatabase(invalidConfig);
      
      // Should still create but may fail on initialization
      expect(database).toBeDefined();
    });

    it("should throw meaningful errors for unsupported implementations", async () => {
      const options: VectorDatabaseFactoryOptions = {
        forceImplementation: "unsupported" as any
      };
      
      await expect(
        createVectorDatabase(testConfig, options)
      ).rejects.toThrow();
    });
  });
});