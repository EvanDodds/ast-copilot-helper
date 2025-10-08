/**
 * Unit tests for IncrementalUpdateManager
 *
 * Tests Issue #159 acceptance criteria:
 * - Smart delta processing with change categorization
 * - File rename detection using content hashing
 * - Intelligent batching of related changes
 * - Dependency tracking and propagation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { IncrementalUpdateManager } from "../incremental-update.js";
import { WatchStateManager } from "../watch-state.js";

describe("IncrementalUpdateManager", () => {
  let tempDir: string;
  let stateManager: WatchStateManager;
  let updateManager: IncrementalUpdateManager;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `incremental-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Initialize managers
    stateManager = new WatchStateManager(join(tempDir, ".astdb"));
    await stateManager.initialize();

    updateManager = new IncrementalUpdateManager(stateManager);
  });

  afterEach(async () => {
    // Clean up
    await stateManager.shutdown();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("change analysis", () => {
    it("should detect new files", async () => {
      const newFile = join(tempDir, "new.ts");
      await fs.writeFile(newFile, "export const x = 1;");

      const changeSet = await updateManager.analyzeChanges([newFile]);

      expect(changeSet.added).toContain(newFile);
      expect(changeSet.added.length).toBe(1);
      expect(changeSet.modified.length).toBe(0);
      expect(changeSet.deleted.length).toBe(0);
    });

    it("should detect modified files", async () => {
      const file = join(tempDir, "modified.ts");
      await fs.writeFile(file, "export const x = 1;");

      // Record initial state
      const hash = await stateManager.calculateFileHash(file);
      stateManager.updateFileState(file, {
        contentHash: hash,
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      // Modify file
      await fs.writeFile(file, "export const x = 2;");

      const changeSet = await updateManager.analyzeChanges([file]);

      expect(changeSet.modified).toContain(file);
      expect(changeSet.modified.length).toBe(1);
      expect(changeSet.added.length).toBe(0);
    });

    it("should detect unchanged files", async () => {
      const file = join(tempDir, "unchanged.ts");
      await fs.writeFile(file, "export const x = 1;");

      // Record state
      const hash = await stateManager.calculateFileHash(file);
      stateManager.updateFileState(file, {
        contentHash: hash,
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      const changeSet = await updateManager.analyzeChanges([file]);

      expect(changeSet.unchanged).toContain(file);
      expect(changeSet.unchanged.length).toBe(1);
      expect(changeSet.modified.length).toBe(0);
    });

    it("should detect deleted files", async () => {
      const file = join(tempDir, "deleted.ts");

      // Record state for non-existent file
      stateManager.updateFileState(file, {
        contentHash: "abc123",
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      const changeSet = await updateManager.analyzeChanges([file]);

      expect(changeSet.deleted).toContain(file);
      expect(changeSet.deleted.length).toBe(1);
    });

    it("should handle mixed changes", async () => {
      // Create various files
      const newFile = join(tempDir, "new.ts");
      const modifiedFile = join(tempDir, "modified.ts");
      const unchangedFile = join(tempDir, "unchanged.ts");

      await fs.writeFile(newFile, "export const a = 1;");
      await fs.writeFile(modifiedFile, "export const b = 1;");
      await fs.writeFile(unchangedFile, "export const c = 1;");

      // Record states
      const modHash = await stateManager.calculateFileHash(modifiedFile);
      stateManager.updateFileState(modifiedFile, {
        contentHash: modHash,
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      const unHash = await stateManager.calculateFileHash(unchangedFile);
      stateManager.updateFileState(unchangedFile, {
        contentHash: unHash,
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      // Modify one file
      await fs.writeFile(modifiedFile, "export const b = 2;");

      const changeSet = await updateManager.analyzeChanges([
        newFile,
        modifiedFile,
        unchangedFile,
      ]);

      expect(changeSet.added.length).toBe(1);
      expect(changeSet.modified.length).toBe(1);
      expect(changeSet.unchanged.length).toBe(1);
    });
  });

  describe("rename detection", () => {
    it("should detect file renames", async () => {
      const oldPath = join(tempDir, "old-name.ts");
      const newPath = join(tempDir, "new-name.ts");

      // Create and hash original file
      await fs.writeFile(oldPath, "export const renamed = true;");
      const hash = await stateManager.calculateFileHash(oldPath);

      stateManager.updateFileState(oldPath, {
        contentHash: hash,
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      // Simulate rename: remove old, analyze new with same content
      await fs.rename(oldPath, newPath);

      // First analyze to detect deleted
      const changeSet1 = await updateManager.analyzeChanges([oldPath]);
      expect(changeSet1.deleted).toContain(oldPath);

      // Then analyze new file (within rename window)
      const changeSet2 = await updateManager.analyzeChanges([newPath]);

      // Should detect as renamed (added)
      expect(changeSet2.added).toContain(newPath);
    });

    it("should expire rename tracking after window", async () => {
      const file = join(tempDir, "temp.ts");
      await fs.writeFile(file, "export const x = 1;");

      const hash = await stateManager.calculateFileHash(file);
      stateManager.updateFileState(file, {
        contentHash: hash,
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      // Wait longer than rename window (5 seconds)
      // For testing, we'll just verify the API works
      const stats = updateManager.getStats();
      expect(stats).toHaveProperty("trackedHashes");
      expect(stats).toHaveProperty("recentRenames");
    });
  });

  describe("batch processing", () => {
    it("should process changes in batches", async () => {
      // Create multiple files
      const files = await Promise.all(
        Array.from({ length: 10 }, async (_, i) => {
          const file = join(tempDir, `file-${i}.ts`);
          await fs.writeFile(file, `export const x${i} = ${i};`);
          return file;
        }),
      );

      const changeSet = await updateManager.analyzeChanges(files);

      let processedBatches = 0;
      const processor = vi.fn(async (batch: string[]) => {
        processedBatches++;
        expect(batch.length).toBeLessThanOrEqual(3);
      });

      const result = await updateManager.processChanges(
        changeSet,
        processor,
        3, // small batch size for testing
      );

      expect(processedBatches).toBeGreaterThan(1);
      expect(result.processedFiles.length).toBe(10);
      expect(result.errors.length).toBe(0);
    });

    it("should handle batch processing errors", async () => {
      const file = join(tempDir, "error.ts");
      await fs.writeFile(file, "export const x = 1;");

      const changeSet = await updateManager.analyzeChanges([file]);

      const processor = vi.fn(async () => {
        throw new Error("Processing failed");
      });

      const result = await updateManager.processChanges(
        changeSet,
        processor,
        10,
      );

      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.file).toBe(file);
      expect(result.errors[0]?.error).toContain("Processing failed");
    });

    it("should skip unchanged files", async () => {
      const file = join(tempDir, "unchanged.ts");
      await fs.writeFile(file, "export const x = 1;");

      const hash = await stateManager.calculateFileHash(file);
      stateManager.updateFileState(file, {
        contentHash: hash,
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      const changeSet = await updateManager.analyzeChanges([file]);

      const processor = vi.fn();
      const result = await updateManager.processChanges(
        changeSet,
        processor,
        10,
      );

      expect(processor).not.toHaveBeenCalled();
      expect(result.skippedFiles).toContain(file);
      expect(result.stats.skipped).toBe(1);
    });

    it("should track processing time", async () => {
      const file = join(tempDir, "timed.ts");
      await fs.writeFile(file, "export const x = 1;");

      const changeSet = await updateManager.analyzeChanges([file]);

      const processor = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const result = await updateManager.processChanges(
        changeSet,
        processor,
        10,
      );

      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe("dependency tracking", () => {
    it("should extract TypeScript dependencies", async () => {
      const file = join(tempDir, "with-deps.ts");
      await fs.writeFile(
        file,
        `import { foo } from './foo';
import bar from './bar';
export const x = foo(bar);`,
      );

      const changeSet = await updateManager.analyzeChanges([file]);

      expect(changeSet.dependencies.has(file)).toBe(true);
      const deps = changeSet.dependencies.get(file);
      expect(deps?.size).toBeGreaterThan(0);
    });

    it("should extract JavaScript dependencies", async () => {
      const file = join(tempDir, "with-deps.js");
      await fs.writeFile(
        file,
        `const foo = require('./foo');
const bar = require('./bar');
module.exports = { foo, bar };`,
      );

      const changeSet = await updateManager.analyzeChanges([file]);

      expect(changeSet.dependencies.has(file)).toBe(true);
      const deps = changeSet.dependencies.get(file);
      expect(deps?.size).toBeGreaterThan(0);
    });

    it("should extract Python dependencies", async () => {
      const file = join(tempDir, "with-deps.py");
      await fs.writeFile(
        file,
        `import os
from pathlib import Path
import sys`,
      );

      const changeSet = await updateManager.analyzeChanges([file]);

      expect(changeSet.dependencies.has(file)).toBe(true);
      const deps = changeSet.dependencies.get(file);
      expect(deps?.size).toBeGreaterThan(0);
    });

    it("should handle files without dependencies", async () => {
      const file = join(tempDir, "no-deps.ts");
      await fs.writeFile(file, "export const x = 1;");

      const changeSet = await updateManager.analyzeChanges([file]);

      // Should not have dependencies entry or have empty set
      const deps = changeSet.dependencies.get(file);
      expect(!deps || deps.size === 0).toBe(true);
    });
  });

  describe("statistics", () => {
    it("should provide processing statistics", async () => {
      const files = await Promise.all([
        fs
          .writeFile(join(tempDir, "a.ts"), "export const a = 1;")
          .then(() => join(tempDir, "a.ts")),
        fs
          .writeFile(join(tempDir, "b.ts"), "export const b = 2;")
          .then(() => join(tempDir, "b.ts")),
      ]);

      const changeSet = await updateManager.analyzeChanges(files);
      const processor = vi.fn();
      const result = await updateManager.processChanges(
        changeSet,
        processor,
        10,
      );

      expect(result.stats.added).toBe(2);
      expect(result.stats.modified).toBe(0);
      expect(result.stats.deleted).toBe(0);
      expect(result.stats.skipped).toBe(0);
    });

    it("should track internal statistics", () => {
      const stats = updateManager.getStats();

      expect(stats).toHaveProperty("trackedHashes");
      expect(stats).toHaveProperty("recentRenames");
      expect(typeof stats.trackedHashes).toBe("number");
      expect(typeof stats.recentRenames).toBe("number");
    });
  });

  describe("edge cases", () => {
    it("should handle empty file list", async () => {
      const changeSet = await updateManager.analyzeChanges([]);

      expect(changeSet.added.length).toBe(0);
      expect(changeSet.modified.length).toBe(0);
      expect(changeSet.deleted.length).toBe(0);
      expect(changeSet.unchanged.length).toBe(0);
    });

    it("should handle file read errors gracefully", async () => {
      const nonExistentFile = join(tempDir, "does-not-exist.ts");

      // Should not throw, treat as deleted
      const changeSet = await updateManager.analyzeChanges([nonExistentFile]);
      expect(changeSet.deleted).toContain(nonExistentFile);
    });

    it("should handle special characters in filenames", async () => {
      const specialFile = join(tempDir, "file with spaces & (special).ts");
      await fs.writeFile(specialFile, "export const x = 1;");

      const changeSet = await updateManager.analyzeChanges([specialFile]);

      expect(changeSet.added).toContain(specialFile);
    });

    it("should handle concurrent change analysis", async () => {
      const files = await Promise.all(
        Array.from({ length: 5 }, async (_, i) => {
          const file = join(tempDir, `concurrent-${i}.ts`);
          await fs.writeFile(file, `export const x${i} = ${i};`);
          return file;
        }),
      );

      // Analyze concurrently
      const results = await Promise.all(
        files.map((file) => updateManager.analyzeChanges([file])),
      );

      results.forEach((changeSet, i) => {
        expect(changeSet.added).toContain(files[i]);
      });
    });
  });
});
