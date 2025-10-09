/**
 * Performance Benchmark: JSON vs SQLite Annotation Storage
 *
 * Compares the performance of JSON file-based annotation storage
 * versus SQLite database storage across various operations.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { AnnotationDatabaseManager } from "../../packages/ast-helper/src/database/annotation-manager.js";
import { ASTDatabaseManager } from "../../packages/ast-helper/src/database/manager.js";
import type { AnnotationInsert } from "../../packages/ast-helper/src/database/annotation-manager.js";

describe("Annotation Performance Benchmarks: JSON vs SQLite", () => {
  const testDir = join(process.cwd(), "test-tmp", "annotation-perf");
  const jsonDir = join(testDir, "json");
  const sqliteDir = join(testDir, "sqlite");

  let dbManager: ASTDatabaseManager;
  let annotationManager: AnnotationDatabaseManager;

  beforeEach(async () => {
    // Clean and create test directories
    rmSync(testDir, { recursive: true, force: true });
    mkdirSync(jsonDir, { recursive: true });
    mkdirSync(sqliteDir, { recursive: true });

    // Initialize SQLite managers
    dbManager = new ASTDatabaseManager(sqliteDir);
    annotationManager = new AnnotationDatabaseManager(dbManager);
    await annotationManager.initialize();
  });

  afterEach(async () => {
    await annotationManager.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  /**
   * Generate test annotations
   */
  function generateAnnotations(count: number): AnnotationInsert[] {
    const annotations: AnnotationInsert[] = [];
    const nodeTypes = [
      "function_declaration",
      "class_declaration",
      "method_definition",
      "interface_declaration",
    ];

    for (let i = 0; i < count; i++) {
      annotations.push({
        node_id: `node-${i}`,
        file_path: `/test/file-${Math.floor(i / 10)}.ts`,
        start_line: i * 10,
        end_line: i * 10 + 5,
        node_type: nodeTypes[i % nodeTypes.length],
        signature: `function test${i}()`,
        complexity_score: Math.random() * 10,
        dependencies: [`dep-${i}`, `dep-${i + 1}`],
        metadata: { example: true, index: i },
      });
    }

    return annotations;
  }

  /**
   * JSON: Write annotations to individual files
   */
  function writeJsonAnnotations(annotations: AnnotationInsert[]): number {
    const start = performance.now();

    for (const annotation of annotations) {
      const filePath = join(jsonDir, `${annotation.node_id}.json`);
      writeFileSync(filePath, JSON.stringify(annotation, null, 2));
    }

    return performance.now() - start;
  }

  /**
   * JSON: Read annotations from individual files
   */
  function readJsonAnnotations(count: number): number {
    const start = performance.now();

    for (let i = 0; i < count; i++) {
      const filePath = join(jsonDir, `node-${i}.json`);
      const content = readFileSync(filePath, "utf-8");
      JSON.parse(content);
    }

    return performance.now() - start;
  }

  /**
   * JSON: Query annotations by file path
   */
  function queryJsonByFile(targetPath: string, totalCount: number): number {
    const start = performance.now();
    const results: AnnotationInsert[] = [];

    for (let i = 0; i < totalCount; i++) {
      const filePath = join(jsonDir, `node-${i}.json`);
      const content = readFileSync(filePath, "utf-8");
      const annotation = JSON.parse(content) as AnnotationInsert;

      if (annotation.file_path === targetPath) {
        results.push(annotation);
      }
    }

    return performance.now() - start;
  }

  describe("Batch Insert Performance", () => {
    it("should benchmark 100 annotations", async () => {
      const annotations = generateAnnotations(100);

      // SQLite batch insert
      const sqliteStart = performance.now();
      await annotationManager.insertAnnotations(annotations);
      const sqliteTime = performance.now() - sqliteStart;

      // JSON individual writes
      const jsonTime = writeJsonAnnotations(annotations);

      console.log("\n📊 100 Annotations - Batch Insert:");
      console.log(`  SQLite: ${sqliteTime.toFixed(2)}ms`);
      console.log(`  JSON:   ${jsonTime.toFixed(2)}ms`);
      console.log(`  Speedup: ${(jsonTime / sqliteTime).toFixed(2)}x`);

      // SQLite should be faster
      expect(sqliteTime).toBeLessThan(jsonTime);
    });

    it("should benchmark 500 annotations", async () => {
      const annotations = generateAnnotations(500);

      const sqliteStart = performance.now();
      await annotationManager.insertAnnotations(annotations);
      const sqliteTime = performance.now() - sqliteStart;

      const jsonTime = writeJsonAnnotations(annotations);

      console.log("\n📊 500 Annotations - Batch Insert:");
      console.log(`  SQLite: ${sqliteTime.toFixed(2)}ms`);
      console.log(`  JSON:   ${jsonTime.toFixed(2)}ms`);
      console.log(`  Speedup: ${(jsonTime / sqliteTime).toFixed(2)}x`);

      expect(sqliteTime).toBeLessThan(jsonTime);
    });

    it("should benchmark 1000 annotations", async () => {
      const annotations = generateAnnotations(1000);

      const sqliteStart = performance.now();
      await annotationManager.insertAnnotations(annotations);
      const sqliteTime = performance.now() - sqliteStart;

      const jsonTime = writeJsonAnnotations(annotations);

      console.log("\n📊 1000 Annotations - Batch Insert:");
      console.log(`  SQLite: ${sqliteTime.toFixed(2)}ms`);
      console.log(`  JSON:   ${jsonTime.toFixed(2)}ms`);
      console.log(`  Speedup: ${(jsonTime / sqliteTime).toFixed(2)}x`);

      expect(sqliteTime).toBeLessThan(jsonTime);
    });
  });

  describe("Retrieval Performance", () => {
    it("should benchmark reading 100 annotations", async () => {
      const annotations = generateAnnotations(100);

      // Prepare data
      await annotationManager.insertAnnotations(annotations);
      writeJsonAnnotations(annotations);

      // SQLite retrieval
      const sqliteStart = performance.now();
      await annotationManager.getAllAnnotations();
      const sqliteTime = performance.now() - sqliteStart;

      // JSON retrieval
      const jsonTime = readJsonAnnotations(100);

      console.log("\n📊 100 Annotations - Full Retrieval:");
      console.log(`  SQLite: ${sqliteTime.toFixed(2)}ms`);
      console.log(`  JSON:   ${jsonTime.toFixed(2)}ms`);
      console.log(`  Speedup: ${(jsonTime / sqliteTime).toFixed(2)}x`);

      expect(sqliteTime).toBeLessThan(jsonTime);
    });

    it("should benchmark reading 500 annotations", async () => {
      const annotations = generateAnnotations(500);

      await annotationManager.insertAnnotations(annotations);
      writeJsonAnnotations(annotations);

      const sqliteStart = performance.now();
      await annotationManager.getAllAnnotations();
      const sqliteTime = performance.now() - sqliteStart;

      const jsonTime = readJsonAnnotations(500);

      console.log("\n📊 500 Annotations - Full Retrieval:");
      console.log(`  SQLite: ${sqliteTime.toFixed(2)}ms`);
      console.log(`  JSON:   ${jsonTime.toFixed(2)}ms`);
      console.log(`  Speedup: ${(jsonTime / sqliteTime).toFixed(2)}x`);

      expect(sqliteTime).toBeLessThan(jsonTime);
    });
  });

  describe("Query Performance", () => {
    it("should benchmark querying by file path (500 annotations)", async () => {
      const annotations = generateAnnotations(500);
      const targetPath = "/test/file-5.ts";

      // Prepare data
      await annotationManager.insertAnnotations(annotations);
      writeJsonAnnotations(annotations);

      // SQLite indexed query
      const sqliteStart = performance.now();
      await annotationManager.getAnnotationsByFile(targetPath);
      const sqliteTime = performance.now() - sqliteStart;

      // JSON linear scan
      const jsonTime = queryJsonByFile(targetPath, 500);

      console.log("\n📊 Query by File Path (500 total):");
      console.log(`  SQLite (indexed): ${sqliteTime.toFixed(2)}ms`);
      console.log(`  JSON (scan):      ${jsonTime.toFixed(2)}ms`);
      console.log(`  Speedup: ${(jsonTime / sqliteTime).toFixed(2)}x`);

      expect(sqliteTime).toBeLessThan(jsonTime);
    });

    it("should benchmark querying with complexity filter (500 annotations)", async () => {
      const annotations = generateAnnotations(500);

      await annotationManager.insertAnnotations(annotations);

      // SQLite indexed query
      const sqliteStart = performance.now();
      await annotationManager.queryAnnotations({
        min_complexity: 5,
        max_complexity: 10,
      });
      const sqliteTime = performance.now() - sqliteStart;

      console.log("\n📊 Query by Complexity Range (500 total):");
      console.log(`  SQLite (indexed): ${sqliteTime.toFixed(2)}ms`);
      console.log(`  Note: JSON would require full scan + filter`);

      // Verify results are reasonable
      expect(sqliteTime).toBeLessThan(50);
    });
  });

  describe("Statistics Performance", () => {
    it("should benchmark statistics aggregation (1000 annotations)", async () => {
      const annotations = generateAnnotations(1000);

      await annotationManager.insertAnnotations(annotations);

      // SQLite aggregation
      const sqliteStart = performance.now();
      const stats = await annotationManager.getStatistics();
      const sqliteTime = performance.now() - sqliteStart;

      console.log("\n📊 Statistics Aggregation (1000 annotations):");
      console.log(`  SQLite: ${sqliteTime.toFixed(2)}ms`);
      console.log(
        `  Stats: ${stats.total_annotations} annotations, ${stats.files_count} files`,
      );
      console.log(`  Avg Complexity: ${stats.avg_complexity?.toFixed(2)}`);
      console.log(`  Note: JSON would require loading all files + aggregation`);

      expect(sqliteTime).toBeLessThan(100);
      expect(stats.total_annotations).toBe(1000);
    });
  });

  describe("Update Performance", () => {
    it("should benchmark updating 100 annotations", async () => {
      const annotations = generateAnnotations(100);

      // Prepare data
      await annotationManager.insertAnnotations(annotations);
      writeJsonAnnotations(annotations);

      // SQLite update
      const sqliteStart = performance.now();
      for (let i = 0; i < 100; i++) {
        const annotation = annotations[i];
        await annotationManager.updateAnnotation({
          ...annotation,
          complexity_score: Math.random() * 20,
        });
      }
      const sqliteTime = performance.now() - sqliteStart;

      // JSON update (read + modify + write)
      const jsonStart = performance.now();
      for (let i = 0; i < 100; i++) {
        const filePath = join(jsonDir, `node-${i}.json`);
        const content = readFileSync(filePath, "utf-8");
        const annotation = JSON.parse(content) as AnnotationInsert;
        annotation.complexity_score = Math.random() * 20;
        writeFileSync(filePath, JSON.stringify(annotation, null, 2));
      }
      const jsonTime = performance.now() - jsonStart;

      console.log("\n📊 100 Annotations - Individual Updates:");
      console.log(`  SQLite: ${sqliteTime.toFixed(2)}ms`);
      console.log(`  JSON:   ${jsonTime.toFixed(2)}ms`);
      console.log(`  Speedup: ${(jsonTime / sqliteTime).toFixed(2)}x`);

      expect(sqliteTime).toBeLessThan(jsonTime);
    });
  });

  describe("Delete Performance", () => {
    it("should benchmark deleting annotations by file (500 annotations)", async () => {
      const annotations = generateAnnotations(500);
      const targetPath = "/test/file-5.ts";

      // Prepare data
      await annotationManager.insertAnnotations(annotations);
      writeJsonAnnotations(annotations);

      // SQLite delete by file
      const sqliteStart = performance.now();
      await annotationManager.deleteAnnotationsByFile(targetPath);
      const sqliteTime = performance.now() - sqliteStart;

      // JSON delete by file (scan all, delete matching)
      const jsonStart = performance.now();
      for (let i = 0; i < 500; i++) {
        const filePath = join(jsonDir, `node-${i}.json`);
        const content = readFileSync(filePath, "utf-8");
        const annotation = JSON.parse(content) as AnnotationInsert;

        if (annotation.file_path === targetPath) {
          rmSync(filePath, { force: true });
        }
      }
      const jsonTime = performance.now() - jsonStart;

      console.log("\n📊 Delete by File Path (500 total):");
      console.log(`  SQLite (indexed): ${sqliteTime.toFixed(2)}ms`);
      console.log(`  JSON (scan):      ${jsonTime.toFixed(2)}ms`);
      console.log(`  Speedup: ${(jsonTime / sqliteTime).toFixed(2)}x`);

      expect(sqliteTime).toBeLessThan(jsonTime);
    });
  });
});
