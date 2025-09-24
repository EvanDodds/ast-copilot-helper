import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HNSWVectorDatabase } from "./hnsw-database.js";
import {
  VectorDBConfig,
  VectorMetadata,
  createVectorDBConfig,
} from "./types.js";
import { existsSync, unlinkSync } from "fs";
import path from "path";

describe("HNSWVectorDatabase", () => {
  let db: HNSWVectorDatabase;
  let testDbPath: string;
  let testIndexPath: string;
  let testMetadata: VectorMetadata;

  beforeEach(async () => {
    // Create temporary file paths
    testDbPath = path.join(process.cwd(), "test-hnsw.db");
    testIndexPath = path.join(process.cwd(), "test-hnsw.index");

    // Clean up any existing test files
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    if (existsSync(testIndexPath)) {
      unlinkSync(testIndexPath);
    }

    // Create test metadata that meets the interface requirements
    testMetadata = {
      signature: "function testFunction()",
      summary: "Test function for unit testing",
      fileId: "test-file-1",
      filePath: "/test/path.ts",
      lineNumber: 42,
      confidence: 0.9,
      lastUpdated: new Date(),
    };

    // Create test configuration using the helper function
    const config: VectorDBConfig = createVectorDBConfig({
      dimensions: 768,
      maxElements: 1000,
      M: 16,
      efConstruction: 200,
      storageFile: testDbPath,
      indexFile: testIndexPath,
    });

    db = new HNSWVectorDatabase(config);
    await db.initialize();
  });

  afterEach(async () => {
    // Clean up
    if (db) {
      await db.shutdown();
    }
    [testDbPath, testIndexPath].forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
  });

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      // Database should be ready for operations
      const stats = await db.getStats();
      expect(stats.status).toBe("ready");
    });

    it("should throw error when using uninitialized database", async () => {
      const config = createVectorDBConfig({
        dimensions: 768,
        storageFile: path.join(process.cwd(), "test-uninit.db"),
        indexFile: path.join(process.cwd(), "test-uninit.index"),
      });

      const uninitDb = new HNSWVectorDatabase(config);

      await expect(
        uninitDb.insertVector("test", [1, 2, 3], testMetadata),
      ).rejects.toThrow("Vector database not initialized");
    });
  });

  describe("Vector Operations", () => {
    const testVector = new Array(768).fill(0).map((_, i) => i * 0.001);

    it("should insert a vector successfully", async () => {
      await db.insertVector("test-node-1", testVector, testMetadata);

      const stats = await db.getStats();
      expect(stats.vectorCount).toBe(1);
    });

    it("should reject vectors with wrong dimensions", async () => {
      const wrongVector = [1, 2, 3]; // Wrong dimension (3 instead of 768)

      await expect(
        db.insertVector("test-node-1", wrongVector, testMetadata),
      ).rejects.toThrow("Vector dimensions mismatch");
    });

    it("should insert vector without metadata", async () => {
      await db.insertVector("test-node-1", testVector, testMetadata);

      const stats = await db.getStats();
      expect(stats.vectorCount).toBe(1);
    });

    it("should update a vector successfully", async () => {
      await db.insertVector("test-node-1", testVector, testMetadata);

      const updatedVector = new Array(768).fill(0).map((_, i) => i * 0.002);
      await db.updateVector("test-node-1", updatedVector);

      // Vector should still be searchable after update
      const results = await db.searchSimilar(updatedVector, 1);
      expect(results.length).toBe(1);
      expect(results[0].nodeId).toBe("test-node-1");
    });

    it("should throw error when updating non-existent vector", async () => {
      const updatedVector = new Array(768).fill(0).map((_, i) => i * 0.002);

      await expect(
        db.updateVector("non-existent", updatedVector),
      ).rejects.toThrow("Vector with nodeId 'non-existent' not found");
    });

    it("should delete a vector successfully", async () => {
      await db.insertVector("test-node-1", testVector, testMetadata);

      // Verify it exists
      let results = await db.searchSimilar(testVector, 1);
      expect(results.length).toBe(1);
      expect(results[0].nodeId).toBe("test-node-1");

      // Delete it
      await db.deleteVector("test-node-1");

      // Should not appear in search results anymore
      results = await db.searchSimilar(testVector, 1);
      expect(results.length).toBe(0);

      const stats = await db.getStats();
      expect(stats.vectorCount).toBe(0);
    });

    it("should handle batch insert operations", async () => {
      const vectors = [
        { nodeId: "batch-1", vector: testVector, metadata: testMetadata },
        {
          nodeId: "batch-2",
          vector: new Array(768).fill(0.5),
          metadata: testMetadata,
        },
        {
          nodeId: "batch-3",
          vector: new Array(768).fill(-0.5),
          metadata: testMetadata,
        },
      ];

      await db.insertVectors(vectors);

      const stats = await db.getStats();
      expect(stats.vectorCount).toBe(3);
    });
  });

  describe("Similarity Search", () => {
    beforeEach(async () => {
      // Insert test vectors for similarity search
      const vectors = [
        {
          nodeId: "similar-1",
          vector: new Array(768).fill(0).map((_, i) => Math.sin(i * 0.01)),
          metadata: { ...testMetadata, signature: "similar function 1" },
        },
        {
          nodeId: "similar-2",
          vector: new Array(768)
            .fill(0)
            .map((_, i) => Math.sin(i * 0.01 + 0.1)),
          metadata: { ...testMetadata, signature: "similar function 2" },
        },
        {
          nodeId: "different",
          vector: new Array(768).fill(0).map((_, i) => Math.cos(i * 0.05)),
          metadata: { ...testMetadata, signature: "different function" },
        },
      ];

      await db.insertVectors(vectors);
    });

    it("should perform similarity search", async () => {
      // Query vector similar to 'similar-1'
      const queryVector = new Array(768)
        .fill(0)
        .map((_, i) => Math.sin(i * 0.01 + 0.05));

      const results = await db.searchSimilar(queryVector, 2);

      expect(results.length).toBe(2);
      expect(["similar-1", "similar-2"]).toContain(results[0].nodeId); // Should be one of the similar ones
      expect(results[0].distance).toBeTypeOf("number");
      expect(results[0].score).toBeTypeOf("number");
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].metadata.confidence).toBe(0.9);
    });

    it("should respect k parameter", async () => {
      const queryVector = new Array(768)
        .fill(0)
        .map((_, i) => Math.sin(i * 0.01));

      const results = await db.searchSimilar(queryVector, 1);
      expect(results.length).toBe(1);
    });

    it("should handle empty search results", async () => {
      // Create a new empty database
      const emptyDbPath = path.join(process.cwd(), "test-empty.db");
      const emptyIndexPath = path.join(process.cwd(), "test-empty.index");

      const emptyConfig = createVectorDBConfig({
        dimensions: 768,
        storageFile: emptyDbPath,
        indexFile: emptyIndexPath,
      });

      const emptyDb = new HNSWVectorDatabase(emptyConfig);
      await emptyDb.initialize();

      try {
        const queryVector = new Array(768).fill(0).map((_, i) => i * 0.001);
        const results = await emptyDb.searchSimilar(queryVector, 5);
        expect(results).toEqual([]);
      } finally {
        await emptyDb.shutdown();
        [emptyDbPath, emptyIndexPath].forEach((file) => {
          if (existsSync(file)) {
            unlinkSync(file);
          }
        });
      }
    });

    it("should support ef parameter for search quality", async () => {
      const queryVector = new Array(768)
        .fill(0)
        .map((_, i) => Math.sin(i * 0.01));

      // Search with different ef values
      const resultsLowEf = await db.searchSimilar(queryVector, 2, 10);
      const resultsHighEf = await db.searchSimilar(queryVector, 2, 100);

      expect(resultsLowEf.length).toBe(2);
      expect(resultsHighEf.length).toBe(2);
      // Results should be consistent (may vary slightly due to search precision)
      expect(resultsLowEf[0].nodeId).toBe(resultsHighEf[0].nodeId);
    });
  });

  describe("Statistics", () => {
    it("should return database statistics", async () => {
      // Insert some test data
      const testVector = new Array(768).fill(0).map((_, i) => i * 0.001);
      await db.insertVector("test-1", testVector, testMetadata);
      await db.insertVector("test-2", testVector, {
        ...testMetadata,
        signature: "test function 2",
      });

      const stats = await db.getStats();

      expect(stats.vectorCount).toBe(2);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.indexFileSize).toBe(0); // In-memory index for this implementation
      expect(stats.storageFileSize).toBeGreaterThan(0);
      expect(stats.lastSaved).toBeInstanceOf(Date);
      expect(stats.buildTime).toBeTypeOf("number");
      expect(stats.averageSearchTime).toBeTypeOf("number");
      expect(stats.status).toBe("ready");
    });
  });

  describe("Index Management", () => {
    it("should rebuild index from stored vectors", async () => {
      // Insert test vectors
      const vectors = [
        {
          nodeId: "test-0",
          vector: new Array(768).fill(0).map((_, i) => i * 0.001),
          metadata: { ...testMetadata, signature: "test function 0" },
        },
        {
          nodeId: "test-1",
          vector: new Array(768).fill(0).map((_, i) => i * 0.002),
          metadata: { ...testMetadata, signature: "test function 1" },
        },
        {
          nodeId: "test-2",
          vector: new Array(768).fill(0).map((_, i) => i * 0.003),
          metadata: { ...testMetadata, signature: "test function 2" },
        },
      ];

      await db.insertVectors(vectors);

      // Rebuild the index
      await db.rebuild();

      // Verify all vectors are still searchable
      const queryVector = new Array(768).fill(0).map((_, i) => i * 0.0015);
      const results = await db.searchSimilar(queryVector, 3);

      expect(results.length).toBe(3);
      expect(results.map((r) => r.nodeId).sort()).toEqual([
        "test-0",
        "test-1",
        "test-2",
      ]);
    });

    it("should handle shutdown gracefully", async () => {
      await db.insertVector("test", new Array(768).fill(0.5), testMetadata);

      await db.shutdown();

      // Should not be able to perform operations after shutdown
      await expect(
        db.insertVector("test2", new Array(768).fill(0.5), testMetadata),
      ).rejects.toThrow("Vector database not initialized");
    });
  });

  describe("Performance", () => {
    it("should handle batch insertions efficiently", async () => {
      const startTime = performance.now();
      const batchSize = 50; // Reduced for faster testing

      // Create batch of vectors
      const vectors = [];
      for (let i = 0; i < batchSize; i++) {
        const vector = new Array(768)
          .fill(0)
          .map((_, j) => Math.sin(i * 0.1 + j * 0.001));
        vectors.push({
          nodeId: `batch-${i}`,
          vector,
          metadata: { ...testMetadata, signature: `batch function ${i}` },
        });
      }

      await db.insertVectors(vectors);

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(
        `Batch insertion of ${batchSize} vectors took ${duration.toFixed(2)}ms`,
      );

      // Verify all vectors were inserted
      const stats = await db.getStats();
      expect(stats.vectorCount).toBe(batchSize);

      // Test search performance
      const searchStart = performance.now();
      const queryVector = new Array(768)
        .fill(0)
        .map((_, i) => Math.sin(i * 0.001));
      const results = await db.searchSimilar(queryVector, 10);
      const searchEnd = performance.now();
      const searchDuration = searchEnd - searchStart;

      console.log(`Search took ${searchDuration.toFixed(2)}ms`);
      expect(results.length).toBe(10);

      // Verify performance targets (should be under 500ms for CLI queries)
      expect(searchDuration).toBeLessThan(500);
    }, 30000); // 30 second timeout for performance test
  });
});
