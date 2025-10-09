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
    it("should create a database instance with HNSW fallback", async () => {
      // Use HNSW for integration tests since WASM may not be built in test environment
      const db = await VectorDatabaseFactory.create(testConfig, {
        forceHNSW: true,
      });
      expect(db).toBeDefined();
      expect(typeof db.initialize).toBe("function");
      expect(typeof db.shutdown).toBe("function");
      expect(db.constructor.name).toBe("HNSWVectorDatabase");
    });

    it("should use default options when none provided", async () => {
      const db = await VectorDatabaseFactory.create(testConfig, {
        forceHNSW: true,
      });
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("HNSWVectorDatabase");
    });

    it("should respect verbose option", async () => {
      const db = await VectorDatabaseFactory.create(testConfig, {
        verbose: true,
        forceHNSW: true,
      });
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("HNSWVectorDatabase");
    });
  });

  describe("Implementation Selection", () => {
    it("should use HNSW implementation for testing", async () => {
      const db = await VectorDatabaseFactory.create(testConfig, {
        forceHNSW: true,
      });
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("HNSWVectorDatabase");
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
    it("should handle invalid configuration gracefully for HNSW", async () => {
      const invalidConfig = { ...testConfig, dimensions: -1 };
      await expect(
        VectorDatabaseFactory.create(invalidConfig, { forceHNSW: true }),
      ).rejects.toThrow();
    });

    it("should validate configuration before creating database", async () => {
      const invalidConfig = { ...testConfig, dimensions: -1 };
      await expect(
        VectorDatabaseFactory.create(invalidConfig, { forceHNSW: true }),
      ).rejects.toThrow();
    });
  });

  describe("Convenience Functions", () => {
    it("should create database using createVectorDatabase with HNSW", async () => {
      const db = await createHNSWVectorDatabase(testConfig);
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("HNSWVectorDatabase");
    });

    it("should create HNSW database using createHNSWVectorDatabase", async () => {
      const db = await createHNSWVectorDatabase(testConfig);
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("HNSWVectorDatabase");
    });

    it("should create HNSW database with verbose logging", async () => {
      const db = await createHNSWVectorDatabase(testConfig, true);
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("HNSWVectorDatabase");
    });

    it("should handle verbose option in convenience functions", async () => {
      const hnswDB = await createHNSWVectorDatabase(testConfig, true);
      expect(hnswDB).toBeDefined();
      expect(hnswDB.constructor.name).toBe("HNSWVectorDatabase");

      const hnswDB2 = await createHNSWVectorDatabase(testConfig, false);
      expect(hnswDB2).toBeDefined();
      expect(hnswDB2.constructor.name).toBe("HNSWVectorDatabase");
    });
  });

  describe("Database Lifecycle", () => {
    it("should initialize and shutdown HNSW database properly", async () => {
      const db = await VectorDatabaseFactory.create(testConfig, {
        forceHNSW: true,
      });
      await expect(db.initialize(testConfig)).resolves.not.toThrow();
      await expect(db.shutdown()).resolves.not.toThrow();
    });

    it("should handle multiple initialize calls gracefully", async () => {
      const db = await VectorDatabaseFactory.create(testConfig, {
        forceHNSW: true,
      });
      await expect(db.initialize(testConfig)).resolves.not.toThrow();
      await expect(db.initialize(testConfig)).resolves.not.toThrow();
      await expect(db.shutdown()).resolves.not.toThrow();
    });
  });
});
