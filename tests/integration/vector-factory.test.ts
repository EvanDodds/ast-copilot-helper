/**
 * Integration Tests for Vector Database Factory
 *
 * These integration tests verify the factory's ability to create vector database instances
 * using the high-performance Rust implementation with native bindings (with HNSW available for testing).
 * Moved to integration tests due to native module compatibility with test runners.
 */

import { describe, it, expect } from "vitest";
import {
  VectorDatabaseFactory,
  createVectorDatabase,
  createRustVectorDatabase,
  createHNSWVectorDatabase,
} from "../../packages/ast-helper/src/database/vector/factory";
import { createVectorDBConfig } from "../../packages/ast-helper/src/database/vector/types";

const testConfig = createVectorDBConfig({
  dimensions: 384,
  maxElements: 1000,
  efConstruction: 200,
  M: 16,
  storageFile: "test-output/test-factory.sqlite",
  indexFile: "test-output/test-factory.hnsw",
});

describe("Vector Database Factory", () => {
  describe("Basic Factory Creation", () => {
    it("should create a Rust database instance by default", async () => {
      const db = await VectorDatabaseFactory.create(testConfig);
      expect(db).toBeDefined();
      expect(typeof db.initialize).toBe("function");
      expect(typeof db.shutdown).toBe("function");
      expect(db.constructor.name).toBe("RustVectorDatabase");
    });

    it("should use default options when none provided", async () => {
      const db = await VectorDatabaseFactory.create(testConfig);
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("RustVectorDatabase");
    });

    it("should respect verbose option", async () => {
      const db = await VectorDatabaseFactory.create(testConfig, {
        verbose: true,
      });
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("RustVectorDatabase");
    });
  });

  describe("Implementation Selection", () => {
    it("should create Rust implementation by default", async () => {
      const db = await VectorDatabaseFactory.create(testConfig);
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("RustVectorDatabase");
    });

    it("should create HNSW implementation when forced for testing", async () => {
      const db = await VectorDatabaseFactory.create(testConfig, {
        forceHNSW: true,
      });
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("HNSWVectorDatabase");
    });

    it("should handle verbose logging for HNSW", async () => {
      const db = await VectorDatabaseFactory.create(testConfig, {
        forceHNSW: true,
        verbose: true,
      });
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("HNSWVectorDatabase");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid configuration gracefully for Rust", async () => {
      const invalidConfig = { ...testConfig, dimensions: -1 };
      await expect(
        VectorDatabaseFactory.create(invalidConfig),
      ).rejects.toThrow();
    });

    it("should handle invalid configuration gracefully for HNSW", async () => {
      const invalidConfig = { ...testConfig, dimensions: -1 };
      await expect(
        VectorDatabaseFactory.create(invalidConfig, { forceHNSW: true }),
      ).rejects.toThrow();
    });
  });

  describe("Convenience Functions", () => {
    it("should create database using createVectorDatabase", async () => {
      const db = await createVectorDatabase(testConfig);
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("RustVectorDatabase");
    });

    it("should create Rust database using createRustVectorDatabase", async () => {
      const db = await createRustVectorDatabase(testConfig);
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("RustVectorDatabase");
    });

    it("should create HNSW database using createHNSWVectorDatabase", async () => {
      const db = await createHNSWVectorDatabase(testConfig);
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("HNSWVectorDatabase");
    });

    it("should handle verbose option in convenience functions", async () => {
      const rustDB = await createRustVectorDatabase(testConfig, true);
      expect(rustDB).toBeDefined();
      expect(rustDB.constructor.name).toBe("RustVectorDatabase");

      const hnswDB = await createHNSWVectorDatabase(testConfig, true);
      expect(hnswDB).toBeDefined();
      expect(hnswDB.constructor.name).toBe("HNSWVectorDatabase");
    });
  });

  describe("Database Lifecycle", () => {
    it("should initialize and shutdown Rust database properly", async () => {
      const db = await VectorDatabaseFactory.create(testConfig);
      await expect(db.initialize(testConfig)).resolves.not.toThrow();
      await expect(db.shutdown()).resolves.not.toThrow();
    });

    it("should initialize and shutdown HNSW database properly", async () => {
      const db = await VectorDatabaseFactory.create(testConfig, {
        forceHNSW: true,
      });
      await expect(db.initialize(testConfig)).resolves.not.toThrow();
      await expect(db.shutdown()).resolves.not.toThrow();
    });
  });
});
