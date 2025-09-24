/**
 * SQLite Vector Storage Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { SQLiteVectorStorage } from "../vector/sqlite-storage.js";
import {
  createVectorDBConfig,
  VectorMetadata,
  VectorInsert,
} from "../vector/types.js";

describe("SQLiteVectorStorage", () => {
  let storage: SQLiteVectorStorage;
  let tempDir: string;
  let storageFile: string;
  let indexFile: string;

  beforeEach(async () => {
    tempDir = join(process.cwd(), "temp-test-sqlite-vectors");
    storageFile = join(tempDir, "test-vectors.sqlite");
    indexFile = join(tempDir, "test-vectors.hnsw");

    // Clean up any existing test directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }

    await fs.mkdir(tempDir, { recursive: true });

    const config = createVectorDBConfig({
      dimensions: 768,
      storageFile,
      indexFile,
      maxElements: 1000,
      autoSave: false,
    });

    storage = new SQLiteVectorStorage(config);
    await storage.initialize();
  });

  afterEach(async () => {
    if (storage) {
      await storage.shutdown();
    }

    // Clean up test directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  describe("initialization", () => {
    it("should initialize SQLite database and create tables", async () => {
      const stats = await storage.getStats();
      expect(stats.vectorCount).toBe(0);
      expect(stats.averageConfidence).toBe(0);
    });

    it("should create database file", async () => {
      const stats = await fs.stat(storageFile);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe("single vector operations", () => {
    const sampleVector = Array.from(
      { length: 768 },
      (_, i) => Math.random() - 0.5,
    );
    const sampleMetadata: VectorMetadata = {
      signature: "function testFunction()",
      summary: "A test function for vector storage",
      fileId: "test-file-123",
      filePath: "/path/to/test.ts",
      lineNumber: 42,
      confidence: 0.95,
      lastUpdated: new Date(),
    };

    it("should insert a vector successfully", async () => {
      const label = await storage.insertVector(
        "test-node-1",
        sampleVector,
        sampleMetadata,
      );

      expect(label).toBe(1); // First label should be 1

      const stats = await storage.getStats();
      expect(stats.vectorCount).toBe(1);
    });

    it("should retrieve inserted vector correctly", async () => {
      await storage.insertVector("test-node-1", sampleVector, sampleMetadata);

      const result = await storage.getVector("test-node-1");
      expect(result).not.toBeNull();
      expect(result!.vector).toHaveLength(sampleVector.length);
      // Use approximate equality for floating-point comparisons
      for (let i = 0; i < sampleVector.length; i++) {
        expect(result!.vector[i]).toBeCloseTo(sampleVector[i], 5);
      }
      expect(result!.metadata.signature).toBe(sampleMetadata.signature);
      expect(result!.metadata.fileId).toBe(sampleMetadata.fileId);
    });

    it("should update vector data", async () => {
      await storage.insertVector("test-node-1", sampleVector, sampleMetadata);

      const newVector = Array.from({ length: 768 }, () => Math.random() - 0.5);
      const newMetadata = { signature: "function updatedFunction()" };

      await storage.updateVector("test-node-1", newVector, newMetadata);

      const result = await storage.getVector("test-node-1");
      expect(result!.vector).toHaveLength(newVector.length);
      // Use approximate equality for floating-point comparisons
      for (let i = 0; i < newVector.length; i++) {
        expect(result!.vector[i]).toBeCloseTo(newVector[i], 5);
      }
      expect(result!.metadata.signature).toBe("function updatedFunction()");
      expect(result!.metadata.fileId).toBe(sampleMetadata.fileId); // Should preserve unchanged fields
    });

    it("should delete vector successfully", async () => {
      await storage.insertVector("test-node-1", sampleVector, sampleMetadata);

      const deleted = await storage.deleteVector("test-node-1");
      expect(deleted).toBe(true);

      const result = await storage.getVector("test-node-1");
      expect(result).toBeNull();

      const stats = await storage.getStats();
      expect(stats.vectorCount).toBe(0);
    });

    it("should handle non-existent vector deletion", async () => {
      const deleted = await storage.deleteVector("non-existent");
      expect(deleted).toBe(false);
    });

    it("should reject vector with wrong dimensions", async () => {
      const wrongSizeVector = [1, 2, 3]; // Only 3 dimensions instead of 768

      await expect(
        storage.insertVector("test-node-1", wrongSizeVector, sampleMetadata),
      ).rejects.toThrow("Vector dimensions mismatch");
    });

    it("should reject duplicate node IDs", async () => {
      await storage.insertVector("test-node-1", sampleVector, sampleMetadata);

      await expect(
        storage.insertVector("test-node-1", sampleVector, sampleMetadata),
      ).rejects.toThrow("already exists");
    });
  });

  describe("batch operations", () => {
    it("should insert multiple vectors in batch", async () => {
      const vectors: VectorInsert[] = [];

      for (let i = 0; i < 5; i++) {
        vectors.push({
          nodeId: `test-node-${i}`,
          vector: Array.from({ length: 768 }, () => Math.random() - 0.5),
          metadata: {
            signature: `function testFunction${i}()`,
            summary: `Test function ${i}`,
            fileId: `test-file-${i}`,
            filePath: `/path/to/test${i}.ts`,
            lineNumber: 10 + i,
            confidence: 0.9,
            lastUpdated: new Date(),
          },
        });
      }

      const result = await storage.insertVectors(vectors);

      expect(result.successCount).toBe(5);
      expect(result.failureCount).toBe(0);
      expect(result.errors).toHaveLength(0);

      const stats = await storage.getStats();
      expect(stats.vectorCount).toBe(5);
    });

    it("should handle partial batch failures", async () => {
      // First insert one vector to create a conflict
      const existingVector = Array.from(
        { length: 768 },
        () => Math.random() - 0.5,
      );
      await storage.insertVector("test-node-1", existingVector, {
        signature: "existing function",
        summary: "existing",
        fileId: "existing",
        filePath: "/existing.ts",
        lineNumber: 1,
        confidence: 0.9,
        lastUpdated: new Date(),
      });

      const vectors: VectorInsert[] = [
        {
          nodeId: "test-node-1", // This should fail (duplicate)
          vector: Array.from({ length: 768 }, () => Math.random() - 0.5),
          metadata: {
            signature: "duplicate function",
            summary: "duplicate",
            fileId: "duplicate",
            filePath: "/duplicate.ts",
            lineNumber: 1,
            confidence: 0.9,
            lastUpdated: new Date(),
          },
        },
        {
          nodeId: "test-node-2", // This should succeed
          vector: Array.from({ length: 768 }, () => Math.random() - 0.5),
          metadata: {
            signature: "new function",
            summary: "new",
            fileId: "new",
            filePath: "/new.ts",
            lineNumber: 1,
            confidence: 0.9,
            lastUpdated: new Date(),
          },
        },
        {
          nodeId: "test-node-3", // This should fail (wrong dimensions)
          vector: [1, 2, 3],
          metadata: {
            signature: "wrong dimensions function",
            summary: "wrong",
            fileId: "wrong",
            filePath: "/wrong.ts",
            lineNumber: 1,
            confidence: 0.9,
            lastUpdated: new Date(),
          },
        },
      ];

      const result = await storage.insertVectors(vectors);

      expect(result.successCount).toBe(1); // Only test-node-2 should succeed
      expect(result.failureCount).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].nodeId).toBe("test-node-1");
      expect(result.errors[1].nodeId).toBe("test-node-3");
    });
  });

  describe("label mappings", () => {
    it("should create and retrieve label mappings", async () => {
      const vectors = ["node-1", "node-2", "node-3"];

      for (let i = 0; i < vectors.length; i++) {
        await storage.insertVector(
          vectors[i],
          Array.from({ length: 768 }, () => Math.random() - 0.5),
          {
            signature: `function test${i}()`,
            summary: `Test function ${i}`,
            fileId: `file-${i}`,
            filePath: `/path/to/file${i}.ts`,
            lineNumber: 10,
            confidence: 0.9,
            lastUpdated: new Date(),
          },
        );
      }

      const mappings = await storage.getLabelMappings();

      expect(mappings.nodeIdToLabel.size).toBe(3);
      expect(mappings.labelToNodeId.size).toBe(3);
      expect(mappings.nextLabel).toBe(4); // Next available label

      // Check that mappings are consistent
      for (const nodeId of vectors) {
        const label = mappings.nodeIdToLabel.get(nodeId);
        expect(label).toBeDefined();
        expect(mappings.labelToNodeId.get(label!)).toBe(nodeId);
      }
    });

    it("should maintain label consistency when reusing node IDs", async () => {
      // Insert first vector
      const label1 = await storage.insertVector(
        "test-node-1",
        Array.from({ length: 768 }, () => Math.random() - 0.5),
        {
          signature: "function test1()",
          summary: "Test function 1",
          fileId: "file-1",
          filePath: "/path/to/file.ts",
          lineNumber: 10,
          confidence: 0.9,
          lastUpdated: new Date(),
        },
      );

      // Delete it
      const deleteResult = await storage.deleteVector("test-node-1");
      expect(deleteResult).toBe(true);

      // Check that the vector is actually deleted
      const checkVector = await storage.getVector("test-node-1");
      expect(checkVector).toBeNull();

      // Insert again with same node ID
      const label2 = await storage.insertVector(
        "test-node-1",
        Array.from({ length: 768 }, () => Math.random() - 0.5),
        {
          signature: "function test2()",
          summary: "Test function 2",
          fileId: "file-1",
          filePath: "/path/to/file.ts",
          lineNumber: 20,
          confidence: 0.8,
          lastUpdated: new Date(),
        },
      );

      expect(label2).toBeGreaterThan(label1); // Should get a new label, not reuse the old one
    });
  });

  describe("multiple vector retrieval", () => {
    it("should retrieve multiple vectors efficiently", async () => {
      const nodeIds = ["node-1", "node-2", "node-3"];
      const vectors = nodeIds.map(() =>
        Array.from({ length: 768 }, () => Math.random() - 0.5),
      );

      // Insert vectors
      for (let i = 0; i < nodeIds.length; i++) {
        await storage.insertVector(nodeIds[i], vectors[i], {
          signature: `function test${i}()`,
          summary: `Test function ${i}`,
          fileId: `file-${i}`,
          filePath: `/path/to/file${i}.ts`,
          lineNumber: 10 + i,
          confidence: 0.9 - i * 0.1,
          lastUpdated: new Date(),
        });
      }

      // Retrieve multiple vectors
      const results = await storage.getVectors(nodeIds);

      expect(results.size).toBe(3);

      for (let i = 0; i < nodeIds.length; i++) {
        const result = results.get(nodeIds[i]);
        expect(result).toBeDefined();
        expect(result!.vector).toHaveLength(vectors[i].length);
        // Use approximate equality for floating-point comparisons
        for (let j = 0; j < vectors[i].length; j++) {
          expect(result!.vector[j]).toBeCloseTo(vectors[i][j], 5);
        }
        expect(result!.metadata.signature).toBe(`function test${i}()`);
      }
    });

    it("should handle empty nodeId list", async () => {
      const results = await storage.getVectors([]);
      expect(results.size).toBe(0);
    });

    it("should skip non-existent node IDs", async () => {
      await storage.insertVector(
        "existing-node",
        Array.from({ length: 768 }, () => Math.random() - 0.5),
        {
          signature: "function existing()",
          summary: "Existing function",
          fileId: "file-1",
          filePath: "/path/to/file.ts",
          lineNumber: 10,
          confidence: 0.9,
          lastUpdated: new Date(),
        },
      );

      const results = await storage.getVectors([
        "existing-node",
        "non-existent-node",
      ]);

      expect(results.size).toBe(1);
      expect(results.has("existing-node")).toBe(true);
      expect(results.has("non-existent-node")).toBe(false);
    });
  });

  describe("search metadata retrieval", () => {
    it("should retrieve metadata for search results", async () => {
      const nodeIds = ["node-1", "node-2"];

      for (let i = 0; i < nodeIds.length; i++) {
        await storage.insertVector(
          nodeIds[i],
          Array.from({ length: 768 }, () => Math.random() - 0.5),
          {
            signature: `function test${i}()`,
            summary: `Test function ${i}`,
            fileId: `file-${i}`,
            filePath: `/path/to/file${i}.ts`,
            lineNumber: 10 + i,
            confidence: 0.9 - i * 0.1,
            lastUpdated: new Date(),
          },
        );
      }

      const metadata = await storage.getSearchMetadata(nodeIds);

      expect(metadata.size).toBe(2);
      expect(metadata.get("node-1")?.signature).toBe("function test0()");
      expect(metadata.get("node-2")?.signature).toBe("function test1()");
    });
  });

  describe("statistics", () => {
    it("should calculate accurate statistics", async () => {
      const nodeIds = ["node-1", "node-2", "node-3"];

      for (let i = 0; i < nodeIds.length; i++) {
        await storage.insertVector(
          nodeIds[i],
          Array.from({ length: 768 }, () => Math.random() - 0.5),
          {
            signature: `function test${i}()`,
            summary: `Test function ${i}`,
            fileId: `file-${i}`,
            filePath: `/path/to/file${i}.ts`,
            lineNumber: 10 + i,
            confidence: 0.8 + i * 0.1, // 0.8, 0.9, 1.0
            lastUpdated: new Date(),
          },
        );
      }

      const stats = await storage.getStats();

      expect(stats.vectorCount).toBe(3);
      expect(stats.averageConfidence).toBeCloseTo(0.9, 1); // (0.8 + 0.9 + 1.0) / 3
      expect(stats.storageSize).toBeGreaterThan(0);
      expect(stats.oldestVector).toBeInstanceOf(Date);
      expect(stats.newestVector).toBeInstanceOf(Date);
    });

    it("should handle empty database statistics", async () => {
      const stats = await storage.getStats();

      expect(stats.vectorCount).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(stats.oldestVector).toBeNull();
      expect(stats.newestVector).toBeNull();
    });
  });

  describe("error handling", () => {
    it("should throw error when accessing uninitialized storage", async () => {
      const uninitializedStorage = new SQLiteVectorStorage(
        createVectorDBConfig({
          dimensions: 768,
          storageFile: join(tempDir, "uninitialized.sqlite"),
          indexFile: join(tempDir, "uninitialized.hnsw"),
        }),
      );

      await expect(
        uninitializedStorage.insertVector(
          "test",
          [1, 2, 3],
          {} as VectorMetadata,
        ),
      ).rejects.toThrow("not initialized");
    });

    it("should handle update of non-existent vector", async () => {
      await expect(
        storage.updateVector(
          "non-existent",
          Array.from({ length: 768 }, () => 0.5),
        ),
      ).rejects.toThrow("not found");
    });
  });
});
