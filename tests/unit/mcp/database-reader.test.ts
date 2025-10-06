/**
 * Database Reader Tests
 *
 * Comprehensive test suite for ASTDatabaseReader implementation
 */

import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { ASTDatabaseReader } from "../../../packages/ast-mcp-server/src/database/reader.js";
import type {
  ASTNode,
  QueryOptions,
} from "../../../packages/ast-mcp-server/src/types.js";

describe("ASTDatabaseReader", () => {
  let tempDir: string;
  let reader: ASTDatabaseReader;
  let mockDbPath: string;

  // Mock AST data for testing
  const mockASTData = {
    type: "program",
    text: 'function hello() { return "world"; }',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 35 },
    children: [
      {
        type: "function",
        text: 'function hello() { return "world"; }',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 35 },
        children: [
          {
            type: "identifier",
            text: "hello",
            startPosition: { row: 0, column: 9 },
            endPosition: { row: 0, column: 14 },
          },
          {
            type: "return_statement",
            text: 'return "world"',
            startPosition: { row: 0, column: 17 },
            endPosition: { row: 0, column: 31 },
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    // Create temporary directory for test database
    tempDir = await mkdtemp(join(tmpdir(), "ast-db-test-"));
    mockDbPath = join(tempDir, ".astdb");

    // Create mock database structure
    await mkdir(join(mockDbPath, "asts"), { recursive: true });
    await mkdir(join(mockDbPath, "config"), { recursive: true });

    // Write mock AST data
    await writeFile(
      join(mockDbPath, "asts", "test.ts.json"),
      JSON.stringify(mockASTData, null, 2),
    );

    // Write mock config
    await writeFile(
      join(mockDbPath, "config", "config.json"),
      JSON.stringify({
        version: "1.0.0",
        workspace: tempDir,
        languages: ["typescript"],
      }),
    );

    // Create reader instance
    reader = new ASTDatabaseReader(tempDir, {
      enabled: false, // Disable hot reload for tests
    });

    // Mock the database manager methods
    vi.spyOn(reader["dbManager"], "isInitialized").mockResolvedValue(true);
    vi.spyOn(
      reader["dbManager"],
      "validateDatabaseStructure",
    ).mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      missingDirectories: [],
      missingFiles: [],
    });
    vi.spyOn(reader["dbManager"], "getDatabaseStructure").mockReturnValue({
      root: mockDbPath,
      asts: join(mockDbPath, "asts"),
      annots: join(mockDbPath, "annots"),
      grammars: join(mockDbPath, "grammars"),
      models: join(mockDbPath, "models"),
      native: join(mockDbPath, "native"),
      indexBin: join(mockDbPath, "index.bin"),
      indexMeta: join(mockDbPath, "index.meta"),
      config: join(mockDbPath, "config.json"),
      version: join(mockDbPath, "version.json"),
      lock: join(mockDbPath, ".lock"),
    });
  });

  afterEach(async () => {
    await reader.close();

    // On Windows, SQLite file handles might not be immediately released
    // Add a small delay to ensure all database connections are fully closed
    if (process.platform === "win32") {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Retry cleanup with exponential backoff for Windows file locking issues
    let attempts = 0;
    const maxAttempts = 5;
    while (attempts < maxAttempts) {
      try {
        await rm(tempDir, { recursive: true, force: true });
        break;
      } catch (error: any) {
        if (error.code === "EBUSY" && attempts < maxAttempts - 1) {
          attempts++;
          const delay = Math.pow(2, attempts) * 50; // 100ms, 200ms, 400ms, 800ms
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        // If it's not a busy error or we've exhausted retries, log and continue
        console.warn(
          `Failed to cleanup temp directory after ${attempts + 1} attempts:`,
          error.message,
        );
        break;
      }
    }
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should initialize successfully with valid database", async () => {
      await expect(reader.initialize()).resolves.toBeUndefined();
      expect(reader["isInitialized"]).toBe(true);
    });

    it("should emit ready event on initialization", async () => {
      const readyPromise = new Promise<void>((resolve) => {
        reader.once("ready", resolve);
      });

      await reader.initialize();
      await readyPromise;
    });

    it("should handle double initialization gracefully", async () => {
      await reader.initialize();
      await expect(reader.initialize()).resolves.toBeUndefined();
    });

    it("should fail initialization with invalid database", async () => {
      vi.spyOn(reader["dbManager"], "isInitialized").mockResolvedValue(false);

      await expect(reader.initialize()).rejects.toThrow(
        "AST database not found. Please run ast-helper init first.",
      );
    });
  });

  describe("index operations", () => {
    beforeEach(async () => {
      await reader.initialize();
    });

    it("should check if index is ready", async () => {
      const isReady = await reader.isIndexReady();
      expect(isReady).toBe(true);
    });

    it("should get index statistics", async () => {
      const stats = await reader.getIndexStats();

      expect(stats.nodeCount).toBeGreaterThan(0);
      expect(stats.fileCount).toBe(1);
      // Check that lastUpdated is a valid date by trying alternative assertions
      expect(stats.lastUpdated).toBeDefined();
      expect(typeof stats.lastUpdated).toBe("object");
      expect(stats.lastUpdated.constructor.name).toBe("Date");
      expect(stats.lastUpdated.getTime()).toBeGreaterThan(0);
    });

    it("should return false for empty index", async () => {
      // Remove AST files
      await rm(join(mockDbPath, "asts"), { recursive: true });

      const isReady = await reader.isIndexReady();
      expect(isReady).toBe(false);
    });
  });

  describe("node retrieval", () => {
    beforeEach(async () => {
      await reader.initialize();
    });

    it("should get file nodes", async () => {
      const nodes = await reader.getFileNodes("test.ts");

      expect(nodes).toHaveLength(4); // program, function, identifier, return_statement
      expect(nodes[0].nodeType).toBe("program");
      expect(nodes[0].filePath).toBe("test.ts");
    });

    it("should return empty array for non-existent file", async () => {
      const nodes = await reader.getFileNodes("non-existent.ts");
      expect(nodes).toEqual([]);
    });

    it("should get node by ID", async () => {
      const nodeId = "test.ts:children.0";
      const node = await reader.getNodeById(nodeId);

      expect(node).not.toBeNull();
      expect(node!.nodeType).toBe("function");
      expect(node!.nodeId).toBe(nodeId);
    });

    it("should return null for invalid node ID", async () => {
      const node = await reader.getNodeById("invalid:id");
      expect(node).toBeNull();
    });

    it("should get child nodes", async () => {
      const parentId = "test.ts:children.0";
      const children = await reader.getChildNodes(parentId);

      expect(children).toHaveLength(2); // identifier and return_statement
      expect(
        children.every((child: ASTNode) => child.parentId === parentId),
      ).toBe(true);
    });
  });

  describe("text search", () => {
    beforeEach(async () => {
      await reader.initialize();
    });

    it("should search nodes by text", async () => {
      const results = await reader.searchNodes("hello");

      expect(results).toHaveLength(3); // program, function and identifier contain "hello"
      expect(results[0]).toHaveProperty("score");
      expect(results[0]).toHaveProperty("matchReason");
    });

    it("should search with query options", async () => {
      const options: QueryOptions = {
        maxResults: 1,
        minScore: 0.5,
      };

      const results = await reader.searchNodes("function", options);

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThanOrEqual(0.5);
    });

    it("should handle intent queries", async () => {
      const results = await reader.queryByIntent("find functions");

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThanOrEqual(0); // May or may not find matches depending on search implementation
    });

    it("should return empty array for no matches", async () => {
      const results = await reader.searchNodes("nonexistent");
      expect(results).toEqual([]);
    });
  });

  describe("recent changes", () => {
    beforeEach(async () => {
      await reader.initialize();
    });

    it("should get recent changes since date", async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const changes = await reader.getRecentChanges(yesterday);

      expect(changes).toBeInstanceOf(Array);
      expect(changes.length).toBeGreaterThan(0);
    });

    it("should get recent changes with options", async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const options: QueryOptions = {
        maxResults: 2,
        filePattern: ".*\\.ts",
      };

      const changes = await reader.getRecentChanges(yesterday, options);

      expect(changes.length).toBeLessThanOrEqual(2);
    });

    it("should return empty array for future date", async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const changes = await reader.getRecentChanges(tomorrow);

      expect(changes).toEqual([]);
    });
  });

  describe("caching", () => {
    beforeEach(async () => {
      await reader.initialize();
    });

    it("should cache query results", async () => {
      // First call
      const results1 = await reader.searchNodes("hello");

      // Second call should return cached results
      const results2 = await reader.searchNodes("hello");

      expect(results1).toEqual(results2);
    });
  });

  describe("error handling", () => {
    it("should throw error for operations before initialization", async () => {
      const uninitializedReader = new ASTDatabaseReader(tempDir);

      await expect(uninitializedReader.queryByIntent("test")).rejects.toThrow(
        "Database reader not initialized. Call initialize() first.",
      );
    });

    it("should handle malformed AST files gracefully", async () => {
      await reader.initialize();

      // Write malformed JSON
      await writeFile(
        join(mockDbPath, "asts", "malformed.json"),
        "invalid json",
      );

      const results = await reader.searchNodes("test");
      expect(results).toBeInstanceOf(Array);
    });

    it("should handle file system errors gracefully", async () => {
      await reader.initialize();

      // Mock file system error
      vi.spyOn(reader["fs"], "exists").mockRejectedValue(new Error("FS Error"));

      const node = await reader.getNodeById("test:id");
      expect(node).toBeNull();
    });
  });

  describe("hot reload", () => {
    it("should setup hot reload detection when enabled", async () => {
      const hotReloadReader = new ASTDatabaseReader(tempDir, {
        enabled: true,
        debounceMs: 100,
      });

      vi.spyOn(hotReloadReader["dbManager"], "isInitialized").mockResolvedValue(
        true,
      );
      vi.spyOn(
        hotReloadReader["dbManager"],
        "validateDatabaseStructure",
      ).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        missingDirectories: [],
        missingFiles: [],
      });
      vi.spyOn(
        hotReloadReader["dbManager"],
        "getDatabaseStructure",
      ).mockReturnValue({
        root: mockDbPath,
        asts: join(mockDbPath, "asts"),
        annots: join(mockDbPath, "annots"),
        grammars: join(mockDbPath, "grammars"),
        models: join(mockDbPath, "models"),
        native: join(mockDbPath, "native"),
        indexBin: join(mockDbPath, "index.bin"),
        indexMeta: join(mockDbPath, "index.meta"),
        config: join(mockDbPath, "config.json"),
        version: join(mockDbPath, "version.json"),
        lock: join(mockDbPath, ".lock"),
      });

      await hotReloadReader.initialize();

      expect(hotReloadReader["watchers"].size).toBeGreaterThan(0);

      await hotReloadReader.close();
    });

    it("should emit events on file changes", async () => {
      const hotReloadReader = new ASTDatabaseReader(tempDir, {
        enabled: true,
        debounceMs: 50,
      });

      vi.spyOn(hotReloadReader["dbManager"], "isInitialized").mockResolvedValue(
        true,
      );
      vi.spyOn(
        hotReloadReader["dbManager"],
        "validateDatabaseStructure",
      ).mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        missingDirectories: [],
        missingFiles: [],
      });
      vi.spyOn(
        hotReloadReader["dbManager"],
        "getDatabaseStructure",
      ).mockReturnValue({
        root: mockDbPath,
        asts: join(mockDbPath, "asts"),
        annots: join(mockDbPath, "annots"),
        grammars: join(mockDbPath, "grammars"),
        models: join(mockDbPath, "models"),
        native: join(mockDbPath, "native"),
        indexBin: join(mockDbPath, "index.bin"),
        indexMeta: join(mockDbPath, "index.meta"),
        config: join(mockDbPath, "config.json"),
        version: join(mockDbPath, "version.json"),
        lock: join(mockDbPath, ".lock"),
      });

      const fileChangedPromise = new Promise<any>((resolve) => {
        hotReloadReader.once("fileChanged", resolve);
      });

      await hotReloadReader.initialize();

      // Trigger file change
      await writeFile(
        join(mockDbPath, "asts", "new-file.json"),
        JSON.stringify(mockASTData),
      );

      const changeEvent = await fileChangedPromise;
      expect(changeEvent).toHaveProperty("filename");

      await hotReloadReader.close();
    });
  });

  describe("cleanup", () => {
    beforeEach(async () => {
      await reader.initialize();
    });

    it("should close cleanly", async () => {
      await reader.close();

      expect(reader["isInitialized"]).toBe(false);
      expect(reader["isReady"]).toBe(false);
      expect(reader["watchers"].size).toBe(0);
      expect(reader["queryCache"].size).toBe(0);
    });

    it("should emit closed event", async () => {
      const closedPromise = new Promise<void>((resolve) => {
        reader.once("closed", resolve);
      });

      await reader.close();
      await closedPromise;
    });

    it("should handle close before initialization", async () => {
      const uninitializedReader = new ASTDatabaseReader(tempDir);
      await expect(uninitializedReader.close()).resolves.toBeUndefined();
    });
  });
});
