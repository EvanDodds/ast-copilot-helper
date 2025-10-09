/**
 * Tests for AnnotationDatabaseManager
 * Tests annotation database CRUD operations, queries, and statistics
 */

import { randomBytes } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ASTDatabaseManager } from "./manager.js";
import {
  AnnotationDatabaseManager,
  type AnnotationInsert,
} from "./annotation-manager.js";

describe("AnnotationDatabaseManager", () => {
  let tempWorkspace: string;
  let dbManager: ASTDatabaseManager;
  let annotationManager: AnnotationDatabaseManager;

  beforeEach(async () => {
    // Create temporary workspace
    const tempName = `annotation-test-${randomBytes(6).toString("hex")}`;
    tempWorkspace = join(tmpdir(), tempName);
    await mkdir(tempWorkspace, { recursive: true });

    // Create .astdb directory
    const astdbPath = join(tempWorkspace, ".astdb");
    await mkdir(astdbPath, { recursive: true });

    // Initialize managers
    dbManager = new ASTDatabaseManager(tempWorkspace);
    annotationManager = new AnnotationDatabaseManager(dbManager);
  });

  afterEach(async () => {
    // Close database connection
    await annotationManager.close();

    // Clean up temporary workspace
    if (tempWorkspace) {
      await rm(tempWorkspace, { recursive: true, force: true });
    }
  });

  describe("initialization", () => {
    it("should create database file on initialization", async () => {
      await annotationManager.initialize();

      const dbPath = annotationManager.getDatabasePath();
      expect(dbPath).toContain("annotations.sqlite");
      expect(annotationManager.isReady()).toBe(true);
    });

    it("should be idempotent (safe to call multiple times)", async () => {
      await annotationManager.initialize();
      await annotationManager.initialize();
      await annotationManager.initialize();

      expect(annotationManager.isReady()).toBe(true);
    });

    it("should create annotations table with correct schema", async () => {
      await annotationManager.initialize();

      // Try to insert a valid annotation to verify schema
      const annotation: AnnotationInsert = {
        node_id: "test-node-1",
        file_path: "/test/file.ts",
        start_line: 1,
        end_line: 10,
        node_type: "function",
        signature: "function test()",
        complexity_score: 5,
      };

      await expect(
        annotationManager.insertAnnotation(annotation),
      ).resolves.not.toThrow();
    });
  });

  describe("CRUD operations - insert", () => {
    beforeEach(async () => {
      await annotationManager.initialize();
    });

    it("should insert a simple annotation", async () => {
      const annotation: AnnotationInsert = {
        node_id: "node-1",
        file_path: "/src/index.ts",
        start_line: 1,
        end_line: 5,
        node_type: "function",
      };

      await annotationManager.insertAnnotation(annotation);

      const retrieved = await annotationManager.getAnnotation("node-1");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.node_id).toBe("node-1");
      expect(retrieved?.file_path).toBe("/src/index.ts");
      expect(retrieved?.node_type).toBe("function");
    });

    it("should insert annotation with all fields", async () => {
      const annotation: AnnotationInsert = {
        node_id: "node-full",
        file_path: "/src/complex.ts",
        start_line: 10,
        end_line: 50,
        node_type: "class",
        signature: "class ComplexClass { ... }",
        complexity_score: 12.5,
        dependencies: ["dependency-1", "dependency-2"],
        metadata: { important: true, category: "core" },
      };

      await annotationManager.insertAnnotation(annotation);

      const retrieved = await annotationManager.getAnnotation("node-full");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.signature).toBe("class ComplexClass { ... }");
      expect(retrieved?.complexity_score).toBe(12.5);

      // Verify JSON fields are stored correctly
      const dependencies = JSON.parse(retrieved?.dependencies ?? "[]");
      expect(dependencies).toEqual(["dependency-1", "dependency-2"]);

      const metadata = JSON.parse(retrieved?.metadata ?? "{}");
      expect(metadata).toEqual({ important: true, category: "core" });
    });

    it("should replace annotation on duplicate node_id", async () => {
      const annotation1: AnnotationInsert = {
        node_id: "node-replace",
        file_path: "/src/original.ts",
        start_line: 1,
        end_line: 10,
        node_type: "function",
      };

      await annotationManager.insertAnnotation(annotation1);

      const annotation2: AnnotationInsert = {
        node_id: "node-replace",
        file_path: "/src/updated.ts",
        start_line: 20,
        end_line: 30,
        node_type: "method",
      };

      await annotationManager.insertAnnotation(annotation2);

      const retrieved = await annotationManager.getAnnotation("node-replace");
      expect(retrieved?.file_path).toBe("/src/updated.ts");
      expect(retrieved?.node_type).toBe("method");
      expect(retrieved?.start_line).toBe(20);
    });
  });

  describe("CRUD operations - batch insert", () => {
    beforeEach(async () => {
      await annotationManager.initialize();
    });

    it("should insert multiple annotations in a batch", async () => {
      const annotations: AnnotationInsert[] = [
        {
          node_id: "batch-1",
          file_path: "/src/file1.ts",
          start_line: 1,
          end_line: 10,
          node_type: "function",
        },
        {
          node_id: "batch-2",
          file_path: "/src/file1.ts",
          start_line: 15,
          end_line: 25,
          node_type: "class",
        },
        {
          node_id: "batch-3",
          file_path: "/src/file2.ts",
          start_line: 1,
          end_line: 100,
          node_type: "module",
        },
      ];

      await annotationManager.insertAnnotations(annotations);

      const retrieved1 = await annotationManager.getAnnotation("batch-1");
      const retrieved2 = await annotationManager.getAnnotation("batch-2");
      const retrieved3 = await annotationManager.getAnnotation("batch-3");

      expect(retrieved1).not.toBeNull();
      expect(retrieved2).not.toBeNull();
      expect(retrieved3).not.toBeNull();
    });

    it("should handle empty array gracefully", async () => {
      await expect(
        annotationManager.insertAnnotations([]),
      ).resolves.not.toThrow();
    });

    it("should be faster than individual inserts for large batches", async () => {
      const batchSize = 100;
      const annotations: AnnotationInsert[] = Array.from(
        { length: batchSize },
        (_, i) => ({
          node_id: `perf-${i}`,
          file_path: `/src/file${Math.floor(i / 10)}.ts`,
          start_line: i * 10,
          end_line: (i + 1) * 10,
          node_type: "function",
          complexity_score: Math.random() * 10,
        }),
      );

      const batchStart = Date.now();
      await annotationManager.insertAnnotations(annotations);
      const batchTime = Date.now() - batchStart;

      // Verify all were inserted
      const stats = await annotationManager.getStatistics();
      expect(stats.total_annotations).toBe(batchSize);

      // Batch insert should complete in reasonable time (< 1 second for 100 items)
      expect(batchTime).toBeLessThan(1000);
    });
  });

  describe("CRUD operations - update", () => {
    beforeEach(async () => {
      await annotationManager.initialize();

      // Insert initial annotation
      await annotationManager.insertAnnotation({
        node_id: "update-test",
        file_path: "/src/original.ts",
        start_line: 1,
        end_line: 10,
        node_type: "function",
        complexity_score: 5,
      });
    });

    it("should update existing annotation", async () => {
      const updated: AnnotationInsert = {
        node_id: "update-test",
        file_path: "/src/modified.ts",
        start_line: 20,
        end_line: 30,
        node_type: "method",
        complexity_score: 8,
      };

      await annotationManager.updateAnnotation(updated);

      const retrieved = await annotationManager.getAnnotation("update-test");
      expect(retrieved?.file_path).toBe("/src/modified.ts");
      expect(retrieved?.node_type).toBe("method");
      expect(retrieved?.complexity_score).toBe(8);
    });

    it("should update timestamp on update", async () => {
      const initial = await annotationManager.getAnnotation("update-test");
      const initialTimestamp = initial?.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await annotationManager.updateAnnotation({
        node_id: "update-test",
        file_path: "/src/modified.ts",
        start_line: 1,
        end_line: 10,
        node_type: "function",
      });

      const updated = await annotationManager.getAnnotation("update-test");
      expect(updated?.updated_at).toBeGreaterThan(initialTimestamp!);
    });
  });

  describe("CRUD operations - delete", () => {
    beforeEach(async () => {
      await annotationManager.initialize();

      // Insert test annotations
      await annotationManager.insertAnnotations([
        {
          node_id: "delete-1",
          file_path: "/src/file1.ts",
          start_line: 1,
          end_line: 10,
          node_type: "function",
        },
        {
          node_id: "delete-2",
          file_path: "/src/file1.ts",
          start_line: 20,
          end_line: 30,
          node_type: "class",
        },
        {
          node_id: "delete-3",
          file_path: "/src/file2.ts",
          start_line: 1,
          end_line: 50,
          node_type: "module",
        },
      ]);
    });

    it("should delete annotation by node_id", async () => {
      await annotationManager.deleteAnnotation("delete-1");

      const retrieved = await annotationManager.getAnnotation("delete-1");
      expect(retrieved).toBeNull();

      // Others should still exist
      expect(await annotationManager.getAnnotation("delete-2")).not.toBeNull();
      expect(await annotationManager.getAnnotation("delete-3")).not.toBeNull();
    });

    it("should delete all annotations for a file", async () => {
      await annotationManager.deleteAnnotationsByFile("/src/file1.ts");

      const file1Annotations =
        await annotationManager.getAnnotationsByFile("/src/file1.ts");
      expect(file1Annotations).toHaveLength(0);

      // file2.ts annotations should still exist
      const file2Annotations =
        await annotationManager.getAnnotationsByFile("/src/file2.ts");
      expect(file2Annotations).toHaveLength(1);
    });

    it("should handle deleting non-existent annotation gracefully", async () => {
      await expect(
        annotationManager.deleteAnnotation("non-existent"),
      ).resolves.not.toThrow();
    });
  });

  describe("queries", () => {
    beforeEach(async () => {
      await annotationManager.initialize();

      // Insert test data with variety
      await annotationManager.insertAnnotations([
        {
          node_id: "query-1",
          file_path: "/src/utils.ts",
          start_line: 1,
          end_line: 20,
          node_type: "function",
          complexity_score: 3,
        },
        {
          node_id: "query-2",
          file_path: "/src/utils.ts",
          start_line: 25,
          end_line: 50,
          node_type: "function",
          complexity_score: 7,
        },
        {
          node_id: "query-3",
          file_path: "/src/models.ts",
          start_line: 1,
          end_line: 100,
          node_type: "class",
          complexity_score: 12,
        },
        {
          node_id: "query-4",
          file_path: "/src/models.ts",
          start_line: 105,
          end_line: 150,
          node_type: "class",
          complexity_score: 8,
        },
        {
          node_id: "query-5",
          file_path: "/src/index.ts",
          start_line: 1,
          end_line: 10,
          node_type: "module",
          complexity_score: 2,
        },
      ]);
    });

    it("should get all annotations for a file", async () => {
      const annotations =
        await annotationManager.getAnnotationsByFile("/src/utils.ts");

      expect(annotations).toHaveLength(2);
      expect(annotations[0].start_line).toBe(1); // Should be ordered by start_line
      expect(annotations[1].start_line).toBe(25);
    });

    it("should get all annotations", async () => {
      const annotations = await annotationManager.getAllAnnotations();

      expect(annotations).toHaveLength(5);
    });

    it("should query by file_path", async () => {
      const annotations = await annotationManager.queryAnnotations({
        file_path: "/src/models.ts",
      });

      expect(annotations).toHaveLength(2);
      expect(annotations.every((a) => a.file_path === "/src/models.ts")).toBe(
        true,
      );
    });

    it("should query by node_type", async () => {
      const annotations = await annotationManager.queryAnnotations({
        node_type: "function",
      });

      expect(annotations).toHaveLength(2);
      expect(annotations.every((a) => a.node_type === "function")).toBe(true);
    });

    it("should query by complexity range", async () => {
      const annotations = await annotationManager.queryAnnotations({
        min_complexity: 5,
        max_complexity: 10,
      });

      expect(annotations).toHaveLength(2); // 7, 8 (3 is below min, 12 is above max, 2 is below min)
      expect(
        annotations.every(
          (a) => a.complexity_score! >= 5 && a.complexity_score! <= 10,
        ),
      ).toBe(true);
    });

    it("should query with combined filters", async () => {
      const annotations = await annotationManager.queryAnnotations({
        file_path: "/src/models.ts",
        node_type: "class",
        min_complexity: 10,
      });

      expect(annotations).toHaveLength(1);
      expect(annotations[0].node_id).toBe("query-3");
    });

    it("should support limit and offset for pagination", async () => {
      const page1 = await annotationManager.queryAnnotations({
        limit: 2,
        offset: 0,
      });

      const page2 = await annotationManager.queryAnnotations({
        limit: 2,
        offset: 2,
      });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].node_id).not.toBe(page2[0].node_id);
    });
  });

  describe("statistics", () => {
    beforeEach(async () => {
      await annotationManager.initialize();
    });

    it("should return zero statistics for empty database", async () => {
      const stats = await annotationManager.getStatistics();

      expect(stats.total_annotations).toBe(0);
      expect(stats.files_count).toBe(0);
      expect(stats.node_types).toEqual({});
      expect(stats.avg_complexity).toBeNull();
      expect(stats.last_updated).toBeNull();
    });

    it("should calculate statistics correctly", async () => {
      await annotationManager.insertAnnotations([
        {
          node_id: "stat-1",
          file_path: "/src/file1.ts",
          start_line: 1,
          end_line: 10,
          node_type: "function",
          complexity_score: 5,
        },
        {
          node_id: "stat-2",
          file_path: "/src/file1.ts",
          start_line: 15,
          end_line: 25,
          node_type: "function",
          complexity_score: 7,
        },
        {
          node_id: "stat-3",
          file_path: "/src/file2.ts",
          start_line: 1,
          end_line: 50,
          node_type: "class",
          complexity_score: 10,
        },
      ]);

      const stats = await annotationManager.getStatistics();

      expect(stats.total_annotations).toBe(3);
      expect(stats.files_count).toBe(2);
      expect(stats.node_types).toEqual({
        function: 2,
        class: 1,
      });
      expect(stats.avg_complexity).toBeCloseTo(7.33, 1); // (5+7+10)/3
      expect(stats.last_updated).toBeGreaterThan(0);
    });

    it("should handle null complexity scores in average calculation", async () => {
      await annotationManager.insertAnnotations([
        {
          node_id: "null-1",
          file_path: "/src/file.ts",
          start_line: 1,
          end_line: 10,
          node_type: "function",
          complexity_score: 5,
        },
        {
          node_id: "null-2",
          file_path: "/src/file.ts",
          start_line: 15,
          end_line: 25,
          node_type: "function",
          // No complexity_score
        },
      ]);

      const stats = await annotationManager.getStatistics();

      expect(stats.avg_complexity).toBe(5); // Only counts non-null values
    });
  });

  describe("database lifecycle", () => {
    it("should close database connection", async () => {
      await annotationManager.initialize();

      await expect(annotationManager.close()).resolves.not.toThrow();
      expect(annotationManager.isReady()).toBe(false);
    });

    it("should reinitialize after close when operations are performed", async () => {
      await annotationManager.initialize();
      expect(annotationManager.isReady()).toBe(true);

      await annotationManager.close();
      expect(annotationManager.isReady()).toBe(false);

      // After close, operations should reinitialize the database
      await annotationManager.insertAnnotation({
        node_id: "post-close",
        file_path: "/src/test.ts",
        start_line: 1,
        end_line: 10,
        node_type: "function",
      });

      // Database should be ready again
      expect(annotationManager.isReady()).toBe(true);

      // Verify the annotation was inserted
      const retrieved = await annotationManager.getAnnotation("post-close");
      expect(retrieved).not.toBeNull();
    });
  });

  describe("error handling", () => {
    it("should handle invalid database path", async () => {
      // Try to create database with invalid path (null byte in path is invalid)
      const invalidManager = new ASTDatabaseManager("/tmp/invalid\0path");
      const invalidAnnotationManager = new AnnotationDatabaseManager(
        invalidManager,
      );

      await expect(invalidAnnotationManager.initialize()).rejects.toThrow();
    });

    it("should handle invalid JSON in dependencies field", async () => {
      await annotationManager.initialize();

      const annotation: AnnotationInsert = {
        node_id: "json-test",
        file_path: "/src/test.ts",
        start_line: 1,
        end_line: 10,
        node_type: "function",
        dependencies: ["valid", "array"],
      };

      await annotationManager.insertAnnotation(annotation);

      const retrieved = await annotationManager.getAnnotation("json-test");
      expect(retrieved).not.toBeNull();

      // Should be able to parse back to array
      const deps = JSON.parse(retrieved?.dependencies ?? "[]");
      expect(Array.isArray(deps)).toBe(true);
    });
  });

  describe("performance", () => {
    beforeEach(async () => {
      await annotationManager.initialize();
    });

    it("should handle large batch inserts efficiently", async () => {
      const batchSize = 1000;
      const annotations: AnnotationInsert[] = Array.from(
        { length: batchSize },
        (_, i) => ({
          node_id: `large-${i}`,
          file_path: `/src/file${Math.floor(i / 100)}.ts`,
          start_line: i * 10,
          end_line: (i + 1) * 10,
          node_type: i % 2 === 0 ? "function" : "class",
          complexity_score: Math.random() * 20,
          dependencies: [`dep-${i}`, `dep-${i + 1}`],
          metadata: { index: i },
        }),
      );

      const start = Date.now();
      await annotationManager.insertAnnotations(annotations);
      const duration = Date.now() - start;

      // Should complete in reasonable time (< 5 seconds for 1000 items)
      expect(duration).toBeLessThan(5000);

      // Verify all were inserted
      const stats = await annotationManager.getStatistics();
      expect(stats.total_annotations).toBe(batchSize);
    });

    it("should query efficiently with indexes", async () => {
      // Insert test data
      const annotations: AnnotationInsert[] = Array.from(
        { length: 100 },
        (_, i) => ({
          node_id: `index-${i}`,
          file_path: `/src/file${i % 10}.ts`,
          start_line: i * 10,
          end_line: (i + 1) * 10,
          node_type: "function",
          complexity_score: i,
        }),
      );

      await annotationManager.insertAnnotations(annotations);

      // Query by file_path (indexed)
      const start = Date.now();
      const results = await annotationManager.queryAnnotations({
        file_path: "/src/file5.ts",
      });
      const duration = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      // Should be very fast due to index (< 50ms)
      expect(duration).toBeLessThan(50);
    });
  });
});
