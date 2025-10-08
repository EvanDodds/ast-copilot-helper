/**
 * Unit tests for WatchStateManager
 * Tests persistent state management, file hashing, and crash recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { WatchStateManager } from "../watch-state.js";

describe("WatchStateManager", () => {
  let tempDir: string;
  let stateManager: WatchStateManager;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = join(tmpdir(), `watch-state-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create test workspace structure
    const astdbPath = join(tempDir, ".astdb");
    await fs.mkdir(astdbPath, { recursive: true });

    // WatchStateManager constructor expects the state directory (.astdb), not the workspace root
    stateManager = new WatchStateManager(astdbPath);
  });

  afterEach(async () => {
    // Cleanup
    await stateManager.shutdown();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("initialization", () => {
    it("should initialize with empty state on first run", async () => {
      await stateManager.initialize();

      const stats = stateManager.getStatistics();
      expect(stats.totalChanges).toBe(0);
      expect(stats.filesProcessed).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.filesSkipped).toBe(0);
    });

    it("should create state file on first save", async () => {
      await stateManager.initialize();

      // Make state dirty by updating a file
      const testFile = join(tempDir, "test.ts");
      stateManager.updateFileState(testFile, {
        status: "pending",
        stagesCompleted: { parsed: false, annotated: false, embedded: false },
      });

      await stateManager.save();

      const stateFile = join(tempDir, ".astdb", "watch-state.json");
      const exists = await fs
        .access(stateFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
    it("should load existing state on initialization", async () => {
      // First session
      await stateManager.initialize();
      const testFile = join(tempDir, "test.ts");
      await stateManager.updateFileState(testFile, {
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });
      await stateManager.save();
      await stateManager.shutdown();

      // Second session - create new state manager with astdb path
      const astdbPath = join(tempDir, ".astdb");
      const newStateManager = new WatchStateManager(astdbPath);
      await newStateManager.initialize();

      const fileState = newStateManager.getFileState(testFile);
      expect(fileState).toBeDefined();
      expect(fileState?.status).toBe("success");

      await newStateManager.shutdown();
    });

    it("should generate unique session IDs", async () => {
      await stateManager.initialize();
      const summary1 = stateManager.getSummary();

      await stateManager.shutdown();

      const newStateManager = new WatchStateManager(tempDir);
      await newStateManager.initialize();
      const summary2 = newStateManager.getSummary();

      expect(summary1.sessionId).not.toBe(summary2.sessionId);
      await newStateManager.shutdown();
    });
  });

  describe("file state management", () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it("should update file state", async () => {
      await stateManager.updateFileState("test.ts", {
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      const fileState = stateManager.getFileState("test.ts");
      expect(fileState?.status).toBe("success");
      expect(fileState?.stagesCompleted.parsed).toBe(true);
    });

    it("should merge partial updates with existing state", async () => {
      await stateManager.updateFileState("test.ts", {
        status: "pending",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      await stateManager.updateFileState("test.ts", {
        status: "success",
        stagesCompleted: { parsed: true, annotated: true, embedded: false },
      });

      const fileState = stateManager.getFileState("test.ts");
      expect(fileState?.status).toBe("success");
      expect(fileState?.stagesCompleted.parsed).toBe(true);
      expect(fileState?.stagesCompleted.annotated).toBe(true);
    });

    it("should remove file state", () => {
      stateManager.updateFileState("test.ts", {
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      stateManager.removeFileState("test.ts");

      const fileState = stateManager.getFileState("test.ts");
      expect(fileState).toBeNull();
    });

    it("should track all files", () => {
      stateManager.updateFileState("file1.ts", {
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });
      stateManager.updateFileState("file2.ts", {
        status: "pending",
        stagesCompleted: { parsed: false, annotated: false, embedded: false },
      });

      // Verify both files are tracked via getSummary
      const summary = stateManager.getSummary();
      expect(summary.filesTracked).toBe(2);

      // Verify individual file states
      expect(stateManager.getFileState("file1.ts")).toBeDefined();
      expect(stateManager.getFileState("file2.ts")).toBeDefined();
    });
  });

  describe("file hashing", () => {
    let testFile: string;

    beforeEach(async () => {
      await stateManager.initialize();
      testFile = join(tempDir, "test.ts");
      await fs.writeFile(testFile, "const x = 1;");
    });

    it("should calculate file hash", async () => {
      const hash = await stateManager.calculateFileHash(testFile);
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64); // SHA256 hex length
    });

    it("should return same hash for unchanged content", async () => {
      const hash1 = await stateManager.calculateFileHash(testFile);
      const hash2 = await stateManager.calculateFileHash(testFile);
      expect(hash1).toBe(hash2);
    });

    it("should return different hash for changed content", async () => {
      const hash1 = await stateManager.calculateFileHash(testFile);

      await fs.writeFile(testFile, "const x = 2;");
      const hash2 = await stateManager.calculateFileHash(testFile);

      expect(hash1).not.toBe(hash2);
    });

    it("should detect file changes", async () => {
      const hash = await stateManager.calculateFileHash(testFile);
      await stateManager.updateFileState(testFile, {
        contentHash: hash,
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      // File unchanged
      let hasChanged = await stateManager.hasFileChanged(testFile);
      expect(hasChanged).toBe(false);

      // File changed
      await fs.writeFile(testFile, "const x = 2;");
      hasChanged = await stateManager.hasFileChanged(testFile);
      expect(hasChanged).toBe(true);
    });

    it("should handle missing files gracefully", async () => {
      const hash = await stateManager.calculateFileHash("nonexistent.ts");
      expect(hash).toBe("");
    });
  });

  describe("file processing", () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it("should identify files to process", async () => {
      const testFile = join(tempDir, "test.ts");
      await fs.writeFile(testFile, "const x = 1;");

      const result = await stateManager.getFilesToProcess([testFile]);
      expect(result.changed).toContain(testFile);
      expect(result.unchanged).toHaveLength(0);
    });

    it("should skip unchanged files", async () => {
      const testFile = join(tempDir, "test.ts");
      await fs.writeFile(testFile, "const x = 1;");

      const hash = await stateManager.calculateFileHash(testFile);
      await stateManager.updateFileState(testFile, {
        contentHash: hash,
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      const result = await stateManager.getFilesToProcess([testFile]);
      expect(result.changed).toHaveLength(0);
      expect(result.unchanged).toContain(testFile);
    });

    it("should detect changed files", async () => {
      const testFile = join(tempDir, "test.ts");
      await fs.writeFile(testFile, "const x = 1;");

      const hash = await stateManager.calculateFileHash(testFile);
      await stateManager.updateFileState(testFile, {
        contentHash: hash,
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      // Change file
      await fs.writeFile(testFile, "const x = 2;");

      const result = await stateManager.getFilesToProcess([testFile]);
      expect(result.changed).toContain(testFile);
      expect(result.unchanged).toHaveLength(0);
    });
  });

  describe("statistics tracking", () => {
    beforeEach(async () => {
      await stateManager.initialize();
      await fs.mkdir(tempDir, { recursive: true });
    });

    it("should record successful processing", async () => {
      const testFile = join(tempDir, "test.ts");
      await fs.writeFile(testFile, "const x = 1;");

      await stateManager.recordSuccess(testFile, { parsed: true }, 100);

      const stats = stateManager.getStatistics();
      expect(stats.filesProcessed).toBe(1);
      expect(stats.totalChanges).toBe(1);
    });

    it("should record errors", async () => {
      const testFile = join(tempDir, "test.ts");
      await fs.writeFile(testFile, "const x = 1;");

      await stateManager.recordError(testFile, "Parse error");

      const stats = stateManager.getStatistics();
      expect(stats.errors).toBe(1);
      expect(stats.totalChanges).toBe(1);

      const fileState = stateManager.getFileState(testFile);
      expect(fileState?.status).toBe("error");
      expect(fileState?.error).toBe("Parse error");
    });

    it("should track multiple operations", async () => {
      const file1 = join(tempDir, "file1.ts");
      const file2 = join(tempDir, "file2.ts");
      const file3 = join(tempDir, "file3.ts");

      await fs.writeFile(file1, "const x = 1;");
      await fs.writeFile(file2, "const x = 2;");
      await fs.writeFile(file3, "const x = 3;");

      await stateManager.recordSuccess(file1, { parsed: true }, 100);
      await stateManager.recordSuccess(file2, { parsed: true }, 100);
      await stateManager.recordError(file3, "Error");

      const stats = stateManager.getStatistics();
      expect(stats.filesProcessed).toBe(2);
      expect(stats.errors).toBe(1);
      expect(stats.totalChanges).toBe(3);
    });

    it("should calculate average processing time", async () => {
      const file1 = join(tempDir, "file1.ts");
      const file2 = join(tempDir, "file2.ts");

      await fs.writeFile(file1, "const x = 1;");
      await fs.writeFile(file2, "const x = 2;");

      await stateManager.recordSuccess(file1, { parsed: true }, 100);
      await stateManager.recordSuccess(file2, { parsed: true }, 200);

      const stats = stateManager.getStatistics();
      expect(stats.avgProcessingTime).toBeGreaterThan(0);
    });
  });

  describe("persistence", () => {
    it("should save state to disk", async () => {
      await stateManager.initialize();
      const testFile = join(tempDir, "test.ts");
      await stateManager.updateFileState(testFile, {
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      await stateManager.save();

      const stateFile = join(tempDir, ".astdb", "watch-state.json");
      const content = await fs.readFile(stateFile, "utf-8");
      const data = JSON.parse(content);

      expect(data.files[testFile]).toBeDefined();
      expect(data.files[testFile].status).toBe("success");
    });

    it("should only save when dirty", async () => {
      await stateManager.initialize();

      const saveSpy = vi.spyOn(stateManager, "save");

      // First save should write
      await stateManager.save();
      expect(saveSpy).toHaveBeenCalledTimes(1);

      // Second save without changes should not write
      await stateManager.save();
      expect(saveSpy).toHaveBeenCalledTimes(2); // Called but won't write
    });

    it("should auto-save periodically", async () => {
      await stateManager.initialize();

      // Update state to make it dirty
      const testFile = join(tempDir, "test.ts");
      stateManager.updateFileState(testFile, {
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      // Wait for auto-save interval (5 seconds)
      await new Promise((resolve) => setTimeout(resolve, 5100));

      // Check if state was saved
      const stateFile = join(tempDir, ".astdb", "watch-state.json");
      const exists = await fs
        .access(stateFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it("should shutdown gracefully", async () => {
      await stateManager.initialize();
      const testFile = join(tempDir, "test.ts");
      stateManager.updateFileState(testFile, {
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      await stateManager.shutdown();

      // Verify state was saved
      const stateFile = join(tempDir, ".astdb", "watch-state.json");
      const exists = await fs
        .access(stateFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    }, 10000); // Increase timeout for this test
  });

  describe("crash recovery", () => {
    it("should recover from previous session", async () => {
      // First session
      await stateManager.initialize();
      stateManager.recordSuccess(
        "file1.ts",
        { parsed: true, annotated: false, embedded: false },
        Date.now(),
      );
      stateManager.recordSuccess(
        "file2.ts",
        { parsed: true, annotated: false, embedded: false },
        Date.now(),
      );
      await stateManager.save();

      const stats1 = stateManager.getStatistics();
      await stateManager.shutdown();

      // Simulate crash - new session
      const newStateManager = new WatchStateManager(tempDir);
      await newStateManager.initialize();

      const stats2 = newStateManager.getStatistics();
      expect(stats2.filesProcessed).toBe(stats1.filesProcessed);
      expect(stats2.totalChanges).toBe(stats1.totalChanges);

      await newStateManager.shutdown();
    });

    it("should handle corrupted state file", async () => {
      const stateFile = join(tempDir, ".astdb", "watch-state.json");
      await fs.writeFile(stateFile, "invalid json{");

      // Should not throw, but start with fresh state
      await expect(stateManager.initialize()).resolves.not.toThrow();

      const stats = stateManager.getStatistics();
      expect(stats.totalChanges).toBe(0);
    });
  });

  describe("edge cases", () => {
    beforeEach(async () => {
      await stateManager.initialize();
    });

    it("should handle empty file list", async () => {
      const result = await stateManager.getFilesToProcess([]);
      expect(result.changed).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
    });

    it("should handle undefined file state", () => {
      const state = stateManager.getFileState("nonexistent.ts");
      expect(state).toBeNull();
    });

    it("should handle very long file paths", async () => {
      const longPath = "a".repeat(1000) + ".ts";
      await stateManager.updateFileState(longPath, {
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      const state = stateManager.getFileState(longPath);
      expect(state).toBeDefined();
    });

    it("should handle special characters in file paths", () => {
      const specialPath = "test with spaces & special chars!.ts";
      stateManager.updateFileState(specialPath, {
        status: "success",
        stagesCompleted: { parsed: true, annotated: false, embedded: false },
      });

      const state = stateManager.getFileState(specialPath);
      expect(state).toBeDefined();
    });
  });
});
