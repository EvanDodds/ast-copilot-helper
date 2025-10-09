/**
 * Integration tests for annotation SQLite storage
 * Tests the complete workflow: annotate command → SQLite storage → embed command retrieval
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { AnnotationDatabaseManager } from "../../packages/ast-helper/src/database/annotation-manager.js";
import { ASTDatabaseManager } from "../../packages/ast-helper/src/database/manager.js";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Annotation SQLite Integration Tests", () => {
  const testDir = path.join(__dirname, "../test-tmp/annotation-sqlite-test");
  const astdbDir = path.join(testDir, ".astdb");
  const testFilePath = path.join(testDir, "sample.ts");

  let dbManager: ASTDatabaseManager;
  let annotationManager: AnnotationDatabaseManager;

  beforeAll(async () => {
    // Create test directory structure
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(astdbDir, { recursive: true });

    // Create a sample TypeScript file for testing
    await fs.writeFile(
      testFilePath,
      `
/**
 * Sample function for testing annotations
 */
export function calculateSum(a: number, b: number): number {
  if (a < 0 || b < 0) {
    throw new Error("Negative numbers not allowed");
  }
  return a + b;
}

/**
 * Sample class for testing annotations
 */
export class Calculator {
  constructor(private initialValue: number = 0) {}

  add(value: number): number {
    return this.initialValue + value;
  }

  multiply(value: number): number {
    return this.initialValue * value;
  }
}
`.trim(),
      "utf-8",
    );

    // Initialize database managers
    dbManager = new ASTDatabaseManager(astdbDir);
    annotationManager = new AnnotationDatabaseManager(dbManager);
    await annotationManager.initialize();
  });

  afterAll(async () => {
    // Close database connections
    annotationManager.close();

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clear annotations before each test
    const allAnnotations = await annotationManager.getAllAnnotations();
    for (const annotation of allAnnotations) {
      await annotationManager.deleteAnnotation(annotation.node_id);
    }
  });

  describe("End-to-end annotation workflow", () => {
    it("should store annotations in SQLite via annotate command", async () => {
      // Note: This is a simplified test - actual execution would require:
      // - Rust CLI binary to be available
      // - Proper file selection and parsing setup
      // For now, we'll test the database operations directly

      // Simulate annotation results that would come from Rust CLI
      const testAnnotations = [
        {
          node_id: `${testFilePath}:7:11:function`,
          file_path: testFilePath,
          start_line: 7,
          end_line: 11,
          node_type: "function",
          signature: "calculateSum(a: number, b: number): number",
          complexity_score: 2,
          dependencies: ["Error"],
          metadata: {
            summary: "Sample function for testing annotations",
            language: "typescript",
            parameters: [
              { name: "a", type: "number" },
              { name: "b", type: "number" },
            ],
            return_type: "number",
            modifiers: ["export"],
            semantic_tags: ["function", "arithmetic"],
          },
        },
        {
          node_id: `${testFilePath}:16:28:class`,
          file_path: testFilePath,
          start_line: 16,
          end_line: 28,
          node_type: "class",
          signature: "class Calculator",
          complexity_score: 3,
          dependencies: [],
          metadata: {
            summary: "Sample class for testing annotations",
            language: "typescript",
            parameters: [],
            return_type: null,
            modifiers: ["export"],
            semantic_tags: ["class", "calculator"],
          },
        },
      ];

      // Insert annotations directly (simulating annotate command behavior)
      await annotationManager.insertAnnotations(testAnnotations);

      // Verify annotations were stored
      const stored = await annotationManager.getAllAnnotations();
      expect(stored).toHaveLength(2);

      const funcAnnotation = stored.find((a) => a.node_id.includes("function"));
      expect(funcAnnotation).toBeDefined();
      expect(funcAnnotation?.signature).toBe(
        "calculateSum(a: number, b: number): number",
      );
      expect(funcAnnotation?.complexity_score).toBe(2);

      const classAnnotation = stored.find((a) => a.node_id.includes("class"));
      expect(classAnnotation).toBeDefined();
      expect(classAnnotation?.signature).toBe("class Calculator");
      expect(classAnnotation?.complexity_score).toBe(3);
    });

    it("should retrieve annotations from SQLite via embed command format", async () => {
      // Insert test annotations
      const testAnnotations = [
        {
          node_id: `${testFilePath}:7:11:function`,
          file_path: testFilePath,
          start_line: 7,
          end_line: 11,
          node_type: "function",
          signature: "calculateSum(a: number, b: number): number",
          complexity_score: 2,
          dependencies: ["Error"],
          metadata: {
            summary: "Calculates the sum of two numbers",
            language: "typescript",
            parameters: [
              { name: "a", type: "number" },
              { name: "b", type: "number" },
            ],
            return_type: "number",
          },
        },
      ];

      await annotationManager.insertAnnotations(testAnnotations);

      // Retrieve and verify in embed format
      const stored = await annotationManager.getAllAnnotations();
      expect(stored).toHaveLength(1);

      // Transform to embed format (simulating what embed command does)
      const annotation = stored[0];
      const metadata =
        typeof annotation.metadata === "string"
          ? JSON.parse(annotation.metadata)
          : annotation.metadata || {};

      const embedFormat = {
        nodeId: annotation.node_id,
        signature: annotation.signature || "Unknown",
        summary: metadata.summary || "No summary available",
        sourceSnippet: "",
        metadata: {
          file_path: annotation.file_path,
          node_type: annotation.node_type,
          start_line: annotation.start_line,
          end_line: annotation.end_line,
          complexity_score: annotation.complexity_score,
          ...metadata,
        },
      };

      expect(embedFormat.nodeId).toBe(`${testFilePath}:7:11:function`);
      expect(embedFormat.signature).toBe(
        "calculateSum(a: number, b: number): number",
      );
      expect(embedFormat.summary).toBe("Calculates the sum of two numbers");
      expect(embedFormat.metadata.complexity_score).toBe(2);
    });

    it("should handle batch annotation insertion correctly", async () => {
      // Create multiple test annotations
      const batchSize = 50;
      const testAnnotations = Array.from({ length: batchSize }, (_, i) => ({
        node_id: `${testFilePath}:${i}:${i + 5}:function`,
        file_path: testFilePath,
        start_line: i,
        end_line: i + 5,
        node_type: "function",
        signature: `testFunction${i}()`,
        complexity_score: i % 10,
        dependencies: [`dep${i}`],
        metadata: {
          summary: `Test function ${i}`,
          language: "typescript",
        },
      }));

      // Insert in batch
      const startTime = performance.now();
      await annotationManager.insertAnnotations(testAnnotations);
      const duration = performance.now() - startTime;

      // Verify all were inserted
      const stored = await annotationManager.getAllAnnotations();
      expect(stored).toHaveLength(batchSize);

      // Verify performance (batch insert should be fast)
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second

      // Verify some random items
      const midAnnotation = stored.find(
        (a) => a.signature === "testFunction25()",
      );
      expect(midAnnotation).toBeDefined();
      expect(midAnnotation?.complexity_score).toBe(5); // 25 % 10 = 5
    });

    it("should query annotations by file path", async () => {
      const file1 = path.join(testDir, "file1.ts");
      const file2 = path.join(testDir, "file2.ts");

      const testAnnotations = [
        {
          node_id: `${file1}:1:5:function`,
          file_path: file1,
          start_line: 1,
          end_line: 5,
          node_type: "function",
          signature: "func1()",
          complexity_score: 1,
        },
        {
          node_id: `${file1}:10:15:function`,
          file_path: file1,
          start_line: 10,
          end_line: 15,
          node_type: "function",
          signature: "func2()",
          complexity_score: 2,
        },
        {
          node_id: `${file2}:1:5:function`,
          file_path: file2,
          start_line: 1,
          end_line: 5,
          node_type: "function",
          signature: "func3()",
          complexity_score: 3,
        },
      ];

      await annotationManager.insertAnnotations(testAnnotations);

      // Query file1 annotations
      const file1Annotations =
        await annotationManager.getAnnotationsByFile(file1);
      expect(file1Annotations).toHaveLength(2);
      expect(file1Annotations[0].signature).toBe("func1()");
      expect(file1Annotations[1].signature).toBe("func2()");

      // Query file2 annotations
      const file2Annotations =
        await annotationManager.getAnnotationsByFile(file2);
      expect(file2Annotations).toHaveLength(1);
      expect(file2Annotations[0].signature).toBe("func3()");
    });

    it("should handle annotation updates correctly", async () => {
      const testAnnotation = {
        node_id: `${testFilePath}:1:5:function`,
        file_path: testFilePath,
        start_line: 1,
        end_line: 5,
        node_type: "function",
        signature: "testFunc()",
        complexity_score: 5,
        metadata: {
          summary: "Original summary",
        },
      };

      // Insert initial annotation
      await annotationManager.insertAnnotation(testAnnotation);

      // Update annotation
      const updatedAnnotation = {
        ...testAnnotation,
        complexity_score: 8,
        metadata: {
          summary: "Updated summary",
        },
      };

      await annotationManager.updateAnnotation(updatedAnnotation);

      // Verify update
      const stored = await annotationManager.getAnnotation(
        testAnnotation.node_id,
      );
      expect(stored).toBeDefined();
      expect(stored?.complexity_score).toBe(8);

      const metadata =
        typeof stored?.metadata === "string"
          ? JSON.parse(stored.metadata)
          : stored?.metadata;
      expect(metadata?.summary).toBe("Updated summary");
    });

    it("should delete annotations by file path", async () => {
      const file1 = path.join(testDir, "file1.ts");
      const file2 = path.join(testDir, "file2.ts");

      const testAnnotations = [
        {
          node_id: `${file1}:1:5:function`,
          file_path: file1,
          start_line: 1,
          end_line: 5,
          node_type: "function",
          signature: "func1()",
        },
        {
          node_id: `${file2}:1:5:function`,
          file_path: file2,
          start_line: 1,
          end_line: 5,
          node_type: "function",
          signature: "func2()",
        },
      ];

      await annotationManager.insertAnnotations(testAnnotations);

      // Delete file1 annotations
      await annotationManager.deleteAnnotationsByFile(file1);

      // Verify file1 annotations deleted
      const file1Annotations =
        await annotationManager.getAnnotationsByFile(file1);
      expect(file1Annotations).toHaveLength(0);

      // Verify file2 annotations still exist
      const file2Annotations =
        await annotationManager.getAnnotationsByFile(file2);
      expect(file2Annotations).toHaveLength(1);
    });

    it("should generate accurate statistics", async () => {
      const testAnnotations = [
        {
          node_id: `${testFilePath}:1:5:function`,
          file_path: testFilePath,
          start_line: 1,
          end_line: 5,
          node_type: "function",
          signature: "func1()",
          complexity_score: 2,
        },
        {
          node_id: `${testFilePath}:10:15:class`,
          file_path: testFilePath,
          start_line: 10,
          end_line: 15,
          node_type: "class",
          signature: "TestClass",
          complexity_score: 4,
        },
        {
          node_id: `${testFilePath}:20:25:function`,
          file_path: testFilePath,
          start_line: 20,
          end_line: 25,
          node_type: "function",
          signature: "func2()",
          complexity_score: 6,
        },
      ];

      await annotationManager.insertAnnotations(testAnnotations);

      // Get statistics
      const stats = await annotationManager.getStatistics();

      expect(stats.total_annotations).toBe(3);
      expect(stats.files_count).toBe(1);
      expect(stats.node_types).toEqual({
        function: 2,
        class: 1,
      });
      expect(stats.avg_complexity).toBe(4); // (2 + 4 + 6) / 3 = 4
      expect(stats.last_updated).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should handle duplicate node_id gracefully (replace)", async () => {
      const testAnnotation = {
        node_id: `${testFilePath}:1:5:function`,
        file_path: testFilePath,
        start_line: 1,
        end_line: 5,
        node_type: "function",
        signature: "testFunc()",
        complexity_score: 5,
      };

      // Insert initial annotation
      await annotationManager.insertAnnotation(testAnnotation);

      // Insert with same node_id (should replace)
      const updatedAnnotation = {
        ...testAnnotation,
        complexity_score: 10,
      };
      await annotationManager.insertAnnotation(updatedAnnotation);

      // Verify only one exists with updated value
      const stored = await annotationManager.getAllAnnotations();
      expect(stored).toHaveLength(1);
      expect(stored[0].complexity_score).toBe(10);
    });

    it("should handle empty batch insertion", async () => {
      await expect(
        annotationManager.insertAnnotations([]),
      ).resolves.not.toThrow();

      const stored = await annotationManager.getAllAnnotations();
      expect(stored).toHaveLength(0);
    });

    it("should handle missing optional fields", async () => {
      const minimalAnnotation = {
        node_id: `${testFilePath}:1:5:function`,
        file_path: testFilePath,
        start_line: 1,
        end_line: 5,
        node_type: "function",
      };

      await annotationManager.insertAnnotation(minimalAnnotation);

      const stored = await annotationManager.getAnnotation(
        minimalAnnotation.node_id,
      );
      expect(stored).toBeDefined();
      expect(stored?.signature).toBeNull();
      expect(stored?.complexity_score).toBeNull();
    });
  });

  describe("Performance", () => {
    it("should handle large batch inserts efficiently", async () => {
      const largeCount = 1000;
      const testAnnotations = Array.from({ length: largeCount }, (_, i) => ({
        node_id: `${testFilePath}:${i}:${i + 5}:function`,
        file_path: testFilePath,
        start_line: i,
        end_line: i + 5,
        node_type: "function",
        signature: `func${i}()`,
        complexity_score: i % 20,
      }));

      const startTime = performance.now();
      await annotationManager.insertAnnotations(testAnnotations);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds

      const stored = await annotationManager.getAllAnnotations();
      expect(stored).toHaveLength(largeCount);
    });

    it("should query with indexes efficiently", async () => {
      // Insert test data
      const testAnnotations = Array.from({ length: 100 }, (_, i) => ({
        node_id: `${testFilePath}:${i}:${i + 5}:function`,
        file_path: testFilePath,
        start_line: i,
        end_line: i + 5,
        node_type: "function",
        signature: `func${i}()`,
        complexity_score: i % 20,
      }));

      await annotationManager.insertAnnotations(testAnnotations);

      // Query by file_path (indexed)
      const startTime = performance.now();
      const results =
        await annotationManager.getAnnotationsByFile(testFilePath);
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(50); // Indexed query should be very fast
    });
  });
});
