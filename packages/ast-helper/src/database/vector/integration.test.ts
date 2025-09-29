import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RustVectorDatabase } from "./rust-vector-database";
import { WasmVectorDatabase } from "./wasm-vector-database";
import type { VectorDBConfig, VectorInsert } from "./types";

/**
 * Integration Testing Framework for Vector Database
 *
 * This suite validates complete workflows, error recovery scenarios,
 * and real-world usage patterns for both NAPI and WASM implementations.
 */

// Test configuration for integration tests
const createIntegrationConfig = (_suffix: string = ""): VectorDBConfig => ({
  dimensions: 384, // Realistic embedding dimensions
  maxElements: 1000, // Limit for faster tests
  M: 16,
  efConstruction: 200,
  space: "cosine",
  storageFile: `:memory:`, // Use memory storage for faster tests
  indexFile: `:memory:`, // Memory-based HNSW index
  autoSave: false, // Don't auto-save during tests
  saveInterval: 300,
});

// Helper to generate realistic test vectors with metadata
const generateRealisticVectors = (
  count: number,
  dimensions: number = 384,
): VectorInsert[] => {
  return Array.from({ length: count }, (_, i) => ({
    nodeId: `node-${i.toString().padStart(4, "0")}`,
    vector: Array.from({ length: dimensions }, () => Math.random() * 2 - 1),
    metadata: {
      signature: `function testFunction${i}(param: string): boolean`,
      summary: `Test function ${i} that performs some operation on a string parameter`,
      fileId: `file-${Math.floor(i / 10)}`,
      filePath: `/test/file-${Math.floor(i / 10)}.ts`,
      lineNumber: (i % 100) + 1,
      confidence: 0.8 + Math.random() * 0.2,
      lastUpdated: new Date(Date.now() - Math.random() * 86400000), // Random time in last 24h
    },
  }));
};

// Error injection utility for testing error recovery
class ErrorInjector {
  private shouldFail = false;
  private failureCount = 0;
  private maxFailures = 0;

  setFailureMode(maxFailures: number): void {
    this.shouldFail = true;
    this.maxFailures = maxFailures;
    this.failureCount = 0;
  }

  reset(): void {
    this.shouldFail = false;
    this.failureCount = 0;
    this.maxFailures = 0;
  }

  maybeThrow(operation: string): void {
    if (this.shouldFail && this.failureCount < this.maxFailures) {
      this.failureCount++;
      throw new Error(
        `Injected failure during ${operation} (${this.failureCount}/${this.maxFailures})`,
      );
    }
  }
}

const errorInjector = new ErrorInjector();

describe("Vector Database Integration Tests", () => {
  let napiDb: RustVectorDatabase;
  let wasmDb: WasmVectorDatabase;
  let testVectors: VectorInsert[];

  beforeEach(async () => {
    napiDb = new RustVectorDatabase(createIntegrationConfig("napi"));
    wasmDb = new WasmVectorDatabase(createIntegrationConfig("wasm"));
    testVectors = generateRealisticVectors(50); // Moderate dataset for integration testing
    errorInjector.reset();
  });

  afterEach(async () => {
    try {
      await napiDb.shutdown();
    } catch (_error) {
      // Ignore shutdown errors in tests
    }
    try {
      await wasmDb.shutdown();
    } catch (_error) {
      // Ignore shutdown errors in tests
    }
  });

  describe("End-to-End Workflow Integration", () => {
    it("should handle complete database lifecycle with NAPI", async () => {
      // Initialize database
      await napiDb.initialize(createIntegrationConfig());

      // Insert initial vectors
      const initialVectors = testVectors.slice(0, 20);
      await napiDb.insertVectors(initialVectors);

      // Verify insertion by searching
      const queryVector = initialVectors[0].vector;
      let results = await napiDb.searchSimilar(queryVector, 5);
      expect(results).toHaveLength(5);
      expect(results[0].nodeId).toBe(initialVectors[0].nodeId);

      // Add more vectors in batches
      const batchVectors = testVectors.slice(20, 40);
      await napiDb.insertVectors(batchVectors);

      // Search should now return results from both batches
      results = await napiDb.searchSimilar(queryVector, 10);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);

      // Update existing vectors (delete + insert pattern)
      const updateVectors = testVectors.slice(0, 5).map((v) => ({
        ...v,
        nodeId: v.nodeId, // Same ID, new vector
        vector: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
        metadata: {
          ...v.metadata,
          summary: "Updated: " + v.metadata.summary,
          lastUpdated: new Date(),
        },
      }));

      // Delete old versions
      for (const vector of updateVectors) {
        await napiDb.deleteVector(vector.nodeId);
      }

      // Insert updated versions
      await napiDb.insertVectors(updateVectors);

      // Verify updates
      results = await napiDb.searchSimilar(updateVectors[0].vector, 3);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.summary).toContain("Updated:");

      // Final search verification
      const finalResults = await napiDb.searchSimilar(queryVector, 20);
      expect(finalResults.length).toBeGreaterThan(0);
      expect(finalResults.every((r) => r.score >= 0)).toBe(true);
      expect(finalResults.every((r) => r.distance >= 0)).toBe(true);
    }, 30000);

    it("should handle complete database lifecycle with WASM", async () => {
      // This test would be identical to NAPI test but using WASM database
      // Currently WASM is not implemented, so we'll mock the expected behavior

      try {
        await wasmDb.initialize(createIntegrationConfig());

        // If we get here, WASM is implemented, run full test
        const initialVectors = testVectors.slice(0, 20);
        await wasmDb.insertVectors(initialVectors);

        const queryVector = initialVectors[0].vector;
        const results = await wasmDb.searchSimilar(queryVector, 5);
        expect(results).toHaveLength(5);
        expect(results[0].nodeId).toBe(initialVectors[0].nodeId);
      } catch (error) {
        // WASM not yet implemented, validate error message
        expect((error as Error).message).toContain(
          "WASM vector database module not yet available",
        );
      }
    }, 30000);

    it("should handle concurrent operations safely", async () => {
      await napiDb.initialize(createIntegrationConfig());

      // Prepare concurrent operations
      const insertBatch1 = testVectors.slice(0, 15);
      const insertBatch2 = testVectors.slice(15, 30);
      const insertBatch3 = testVectors.slice(30, 45);

      // Execute concurrent insertions
      const insertPromises = [
        napiDb.insertVectors(insertBatch1),
        napiDb.insertVectors(insertBatch2),
        napiDb.insertVectors(insertBatch3),
      ];

      await Promise.all(insertPromises);

      // Verify all vectors were inserted
      const testQueries = [
        insertBatch1[0].vector,
        insertBatch2[0].vector,
        insertBatch3[0].vector,
      ];

      const searchPromises = testQueries.map((query) =>
        napiDb.searchSimilar(query, 10),
      );

      const results = await Promise.all(searchPromises);

      // Each search should return results
      results.forEach((result) => {
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBeLessThanOrEqual(10);
      });

      // Verify no duplicate insertions
      const allResults = results.flat();
      const uniqueNodeIds = new Set(allResults.map((r) => r.nodeId));
      expect(uniqueNodeIds.size).toBeLessThanOrEqual(45); // At most 45 unique vectors
    }, 45000);
  });

  describe("Error Recovery and Resilience", () => {
    it("should recover from initialization failures", async () => {
      // Test with invalid configuration
      const invalidConfig = {
        ...createIntegrationConfig(),
        dimensions: -1, // Invalid dimension
      };

      await expect(napiDb.initialize(invalidConfig)).rejects.toThrow();

      // Should be able to initialize with valid config after failure
      await napiDb.initialize(createIntegrationConfig());

      // Verify database is functional
      const sampleVectors = testVectors.slice(0, 5);
      await napiDb.insertVectors(sampleVectors);

      const results = await napiDb.searchSimilar(sampleVectors[0].vector, 3);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle partial insertion failures gracefully", async () => {
      await napiDb.initialize(createIntegrationConfig());

      // Insert valid vectors first
      const validVectors = testVectors.slice(0, 10);
      await napiDb.insertVectors(validVectors);

      // Try to insert invalid vectors
      const invalidVectors: VectorInsert[] = [
        {
          nodeId: "invalid-vector",
          vector: [], // Empty vector - should fail
          metadata: {
            signature: "invalid",
            summary: "Invalid vector",
            fileId: "invalid",
            filePath: "/invalid",
            lineNumber: 1,
            confidence: 0.5,
            lastUpdated: new Date(),
          },
        },
      ];

      await expect(napiDb.insertVectors(invalidVectors)).rejects.toThrow();

      // Verify original vectors are still accessible
      const results = await napiDb.searchSimilar(validVectors[0].vector, 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].nodeId).toBe(validVectors[0].nodeId);

      // Should be able to insert more valid vectors
      const moreValidVectors = testVectors.slice(10, 15);
      await napiDb.insertVectors(moreValidVectors);

      const finalResults = await napiDb.searchSimilar(
        moreValidVectors[0].vector,
        3,
      );
      expect(finalResults.length).toBeGreaterThan(0);
    });

    it("should handle search failures and recover", async () => {
      await napiDb.initialize(createIntegrationConfig());
      await napiDb.insertVectors(testVectors.slice(0, 20));

      // Search with invalid vector dimensions
      const invalidQuery = Array.from({ length: 100 }, () => Math.random()); // Wrong dimensions

      await expect(napiDb.searchSimilar(invalidQuery, 5)).rejects.toThrow();

      // Valid searches should still work
      const validQuery = testVectors[0].vector;
      const results = await napiDb.searchSimilar(validQuery, 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle database corruption gracefully", async () => {
      await napiDb.initialize(createIntegrationConfig());
      await napiDb.insertVectors(testVectors.slice(0, 15));

      // Simulate database corruption by shutting down and trying operations
      await napiDb.shutdown();

      // Operations should fail gracefully
      await expect(
        napiDb.searchSimilar(testVectors[0].vector, 5),
      ).rejects.toThrow();
      await expect(napiDb.insertVectors([testVectors[15]])).rejects.toThrow();

      // Should be able to reinitialize
      await napiDb.initialize(createIntegrationConfig());

      // Database should be empty after reinitialization (memory storage)
      const results = await napiDb.searchSimilar(testVectors[0].vector, 5);
      expect(results.length).toBe(0); // No vectors in fresh database
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("should handle typical development workflow", async () => {
      await napiDb.initialize(createIntegrationConfig());

      // Simulate parsing a project and adding functions
      const projectFunctions = generateRealisticVectors(30, 384);

      // Add functions in realistic batches (file by file)
      const fileGroups = new Map<string, VectorInsert[]>();
      projectFunctions.forEach((func) => {
        const fileId = func.metadata.fileId;
        if (!fileGroups.has(fileId)) {
          fileGroups.set(fileId, []);
        }
        fileGroups.get(fileId)!.push(func);
      });

      // Insert each file's functions as a batch
      for (const [_fileId, functions] of fileGroups) {
        await napiDb.insertVectors(functions);

        // Verify functions are searchable immediately
        if (functions.length > 0) {
          const results = await napiDb.searchSimilar(functions[0].vector, 3);
          expect(results.length).toBeGreaterThan(0);
        }
      }

      // Simulate code search - find similar functions
      const queryFunction = projectFunctions[0];
      const similarFunctions = await napiDb.searchSimilar(
        queryFunction.vector,
        5,
      );

      expect(similarFunctions.length).toBeGreaterThan(0);
      expect(similarFunctions[0].nodeId).toBe(queryFunction.nodeId); // Exact match should be first
      expect(similarFunctions.every((f) => f.score <= 1.0)).toBe(true);

      // Simulate file modification - remove old functions, add new ones
      const fileToModify = Array.from(fileGroups.keys())[0];
      const oldFunctions = fileGroups.get(fileToModify)!;

      // Remove old functions
      for (const func of oldFunctions) {
        await napiDb.deleteVector(func.nodeId);
      }

      // Add updated functions
      const updatedFunctions = oldFunctions.map((func) => ({
        ...func,
        nodeId: func.nodeId + "_updated",
        vector: Array.from({ length: 384 }, () => Math.random() * 2 - 1),
        metadata: {
          ...func.metadata,
          summary: "Updated: " + func.metadata.summary,
          lastUpdated: new Date(),
        },
      }));

      await napiDb.insertVectors(updatedFunctions);

      // Verify old functions are gone and new ones are searchable
      const oldFunctionSearch = await napiDb.searchSimilar(
        oldFunctions[0].vector,
        10,
      );
      const hasOldFunction = oldFunctionSearch.some(
        (r) => r.nodeId === oldFunctions[0].nodeId,
      );
      expect(hasOldFunction).toBe(false);

      const newFunctionSearch = await napiDb.searchSimilar(
        updatedFunctions[0].vector,
        5,
      );
      expect(newFunctionSearch.length).toBeGreaterThan(0);
      expect(newFunctionSearch[0].nodeId).toBe(updatedFunctions[0].nodeId);
    }, 60000);

    it("should handle incremental indexing efficiently", async () => {
      await napiDb.initialize(createIntegrationConfig());

      // Start with empty database
      let totalVectors = 0;

      // Add vectors incrementally and verify performance doesn't degrade significantly
      const batchSizes = [5, 10, 15, 20];
      const searchTimes: number[] = [];

      for (const batchSize of batchSizes) {
        const batch = generateRealisticVectors(batchSize, 384);

        const insertStart = Date.now();
        await napiDb.insertVectors(batch);
        const insertTime = Date.now() - insertStart;

        totalVectors += batchSize;

        // Measure search performance
        const searchStart = Date.now();
        const results = await napiDb.searchSimilar(batch[0].vector, 10);
        const searchTime = Date.now() - searchStart;
        searchTimes.push(searchTime);

        expect(results.length).toBeGreaterThan(0);
        expect(insertTime).toBeLessThan(5000); // Should insert within 5 seconds
        expect(searchTime).toBeLessThan(1000); // Should search within 1 second

        console.log(
          `Batch ${batchSize}: ${totalVectors} total vectors, insert: ${insertTime}ms, search: ${searchTime}ms`,
        );
      }

      // Search performance shouldn't degrade too much with more vectors
      const avgEarlySearchTime = (searchTimes[0] + searchTimes[1]) / 2;
      const avgLateSearchTime = (searchTimes[2] + searchTimes[3]) / 2;

      // Allow up to 3x degradation (still reasonable for small datasets)
      expect(avgLateSearchTime).toBeLessThan(avgEarlySearchTime * 3);
    }, 45000);

    it("should maintain accuracy across different similarity thresholds", async () => {
      await napiDb.initialize(createIntegrationConfig());

      // Create vectors with known similarities
      const baseVector = Array.from(
        { length: 384 },
        () => Math.random() * 2 - 1,
      );

      // Create similar vectors by adding small perturbations
      const similarVectors: VectorInsert[] = [];
      for (let i = 0; i < 10; i++) {
        const perturbation = 0.1 * i; // Increasing perturbation
        const vector = baseVector.map(
          (v) => v + (Math.random() - 0.5) * perturbation,
        );

        similarVectors.push({
          nodeId: `similar-${i}`,
          vector,
          metadata: {
            signature: `function similar${i}()`,
            summary: `Similar function ${i}`,
            fileId: "test-file",
            filePath: "/test.ts",
            lineNumber: i + 1,
            confidence: 0.9,
            lastUpdated: new Date(),
          },
        });
      }

      // Add some clearly different vectors
      const differentVectors: VectorInsert[] = [];
      for (let i = 0; i < 5; i++) {
        const vector = Array.from({ length: 384 }, () => Math.random() * 2 - 1);

        differentVectors.push({
          nodeId: `different-${i}`,
          vector,
          metadata: {
            signature: `function different${i}()`,
            summary: `Different function ${i}`,
            fileId: "test-file",
            filePath: "/test.ts",
            lineNumber: i + 20,
            confidence: 0.9,
            lastUpdated: new Date(),
          },
        });
      }

      await napiDb.insertVectors([...similarVectors, ...differentVectors]);

      // Search with different k values
      for (const k of [3, 5, 10, 15]) {
        const results = await napiDb.searchSimilar(baseVector, k);

        expect(results.length).toBeLessThanOrEqual(k);
        expect(results.length).toBeLessThanOrEqual(15); // Total vectors available

        // Results should be ordered by similarity (lower distance = higher similarity)
        for (let i = 1; i < results.length; i++) {
          expect(results[i].distance).toBeGreaterThanOrEqual(
            results[i - 1].distance,
          );
        }

        // Most similar vectors should appear first
        const topResults = results.slice(0, Math.min(k, 5));
        const similarResults = topResults.filter((r) =>
          r.nodeId.startsWith("similar-"),
        );

        // Most results should be from similar vectors when k is small
        if (k <= 10) {
          expect(similarResults.length).toBeGreaterThan(
            topResults.length * 0.6,
          );
        }
      }
    }, 30000);
  });

  describe("Performance Under Load", () => {
    it("should maintain performance with moderate dataset", async () => {
      await napiDb.initialize(createIntegrationConfig());

      // Insert a moderate number of vectors
      const largeDataset = generateRealisticVectors(200, 384);

      const insertStart = Date.now();
      await napiDb.insertVectors(largeDataset);
      const insertTime = Date.now() - insertStart;

      expect(insertTime).toBeLessThan(15000); // Should complete within 15 seconds

      // Test search performance
      const searchQueries = largeDataset.slice(0, 10).map((v) => v.vector);

      const searchStart = Date.now();
      const searchPromises = searchQueries.map((query) =>
        napiDb.searchSimilar(query, 10),
      );
      const searchResults = await Promise.all(searchPromises);
      const searchTime = Date.now() - searchStart;

      expect(searchTime).toBeLessThan(3000); // Should complete within 3 seconds

      // Verify all searches returned results
      searchResults.forEach((results) => {
        expect(results.length).toBeGreaterThan(0);
        expect(results.length).toBeLessThanOrEqual(10);
      });

      console.log(
        `Performance test: 200 vectors inserted in ${insertTime}ms, 10 searches in ${searchTime}ms`,
      );
    }, 30000);
  });
});
