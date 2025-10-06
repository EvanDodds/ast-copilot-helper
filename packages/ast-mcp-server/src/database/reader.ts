/**
 * AST Database Integration
 *
 * Implements the DatabaseReader interface to provide MCP server access
 * to the .astdb/ directory structure with hot reload detection
 */

import { join, resolve } from "node:path";
import { readdir, stat, readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { EventEmitter } from "node:events";

import { ASTDatabaseManager } from "@ast-copilot-helper/ast-helper/database";
import { FileSystemManager } from "@ast-copilot-helper/ast-helper/filesystem";
import { createLogger } from "@ast-copilot-helper/ast-helper/logging";

import type {
  DatabaseReader,
  ASTNode,
  ASTNodeMatch,
  QueryOptions,
} from "../types.js";
import type { SearchResult } from "../../../ast-helper/src/database/vector/types.js";

/**
 * Hot reload detection configuration
 */
interface HotReloadConfig {
  /** Enable file system watching */
  enabled: boolean;
  /** Debounce delay in milliseconds */
  debounceMs: number;
  /** File patterns to watch */
  watchPatterns: string[];
}

/**
 * AST Database Reader Implementation
 *
 * Provides read-only access to .astdb/ directory with hot reload detection,
 * text search capabilities, and MCP-optimized query performance
 */
export class ASTDatabaseReader extends EventEmitter implements DatabaseReader {
  private dbManager: ASTDatabaseManager;
  private fs: FileSystemManager;
  private logger = createLogger({ operation: "mcp-database" });

  // State management
  private isInitialized = false;
  private isReady = false;

  // Hot reload detection
  private watchers: Map<string, any> = new Map();
  private hotReloadConfig: HotReloadConfig;
  private lastIndexUpdate: Date | null = null;

  // Performance optimization
  private queryCache: Map<string, { result: any; timestamp: number }> =
    new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    workspacePath: string,
    hotReloadConfig?: Partial<HotReloadConfig>,
  ) {
    super();

    this.dbManager = new ASTDatabaseManager(resolve(workspacePath));
    this.fs = new FileSystemManager();

    // Hot reload configuration
    this.hotReloadConfig = {
      enabled: true,
      debounceMs: 500,
      watchPatterns: [
        "**/*.bin",
        "**/*.json",
        "**/config.json",
        "**/version.json",
      ],
      ...hotReloadConfig,
    };
  }

  /**
   * Initialize database reader with validation and setup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info("Initializing AST database reader", {
        workspace: this.dbManager.astdbPath,
      });

      // Check if database exists
      const initialized = await this.dbManager.isInitialized();
      if (!initialized) {
        throw new Error(
          "AST database not found. Please run ast-helper init first.",
        );
      }

      // Validate database structure
      const validation = await this.dbManager.validateDatabaseStructure();
      if (!validation.isValid) {
        this.logger.warn("Database validation issues found", {
          errors: validation.errors,
          warnings: validation.warnings,
        });

        if (validation.errors.length > 0) {
          throw new Error(
            `Database validation failed: ${validation.errors.join(", ")}`,
          );
        }
      }

      // Set up hot reload detection
      if (this.hotReloadConfig.enabled) {
        await this.setupHotReloadDetection();
      }

      // Update state
      this.isInitialized = true;
      this.isReady = await this.checkIndexReadiness();
      this.lastIndexUpdate = await this.getLastIndexUpdate();

      this.logger.info("AST database reader initialized successfully", {
        ready: this.isReady,
        hotReload: this.hotReloadConfig.enabled,
      });

      this.emit("ready");
    } catch (error) {
      this.logger.error("Failed to initialize database reader", { error });
      throw new Error(
        `Database initialization failed: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Close database connections and cleanup resources
   */
  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Stop file watchers
      for (const watcher of this.watchers.values()) {
        watcher.close();
      }
      this.watchers.clear();

      // Clear cache
      this.queryCache.clear();

      this.isInitialized = false;
      this.isReady = false;

      this.logger.info("Database reader closed");
      this.emit("closed");
    } catch (error) {
      this.logger.error("Error closing database reader", { error });
      throw error;
    }
  }

  /**
   * Query AST nodes by natural language intent using semantic vector search
   */
  async queryByIntent(
    intent: string,
    options: QueryOptions = {},
  ): Promise<ASTNodeMatch[]> {
    this.ensureInitialized();

    const cacheKey = `intent:${intent}:${JSON.stringify(options)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = performance.now();

    try {
      // Try vector search first if available
      const vectorSearchResults = await this.vectorSearch(intent, {
        maxResults: options.maxResults,
        ef: 50, // Good balance of speed vs accuracy
      });

      // If vector search returns good results, use them
      if (vectorSearchResults.length > 0) {
        const duration = performance.now() - startTime;
        this.logger.debug("Intent query completed (vector search)", {
          intent: intent.substring(0, 100),
          results: vectorSearchResults.length,
          duration: `${duration.toFixed(1)}ms`,
        });

        // Cache results
        this.setCachedResult(cacheKey, vectorSearchResults);
        return vectorSearchResults;
      }

      // Fallback to text search if vector search fails or returns empty
      this.logger.debug("Falling back to text search for intent query", {
        intent: intent.substring(0, 100),
      });

      const results = await this.textSearch(intent, options);

      const duration = performance.now() - startTime;
      this.logger.debug("Intent query completed (text search fallback)", {
        intent: intent.substring(0, 100),
        results: results.length,
        duration: `${duration.toFixed(1)}ms`,
      });

      // Cache results
      this.setCachedResult(cacheKey, results);

      return results;
    } catch (error) {
      this.logger.error("Intent query failed", { intent, error });
      return [];
    }
  }

  /**
   * Get AST node by unique identifier
   */
  async getNodeById(nodeId: string): Promise<ASTNode | null> {
    this.ensureInitialized();

    const cacheKey = `node:${nodeId}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const node = await this.loadASTNode(nodeId);

      if (node) {
        this.setCachedResult(cacheKey, node);
      }

      return node;
    } catch (error) {
      this.logger.error("Failed to get node by ID", { nodeId, error });
      return null;
    }
  }

  /**
   * Get child nodes for a given parent node
   */
  async getChildNodes(nodeId: string): Promise<ASTNode[]> {
    this.ensureInitialized();

    const cacheKey = `children:${nodeId}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // For this implementation, we'll search for nodes that have this node as parent
      const children = await this.findChildNodes(nodeId);

      this.setCachedResult(cacheKey, children);
      return children;
    } catch (error) {
      this.logger.error("Failed to get child nodes", { nodeId, error });
      return [];
    }
  }

  /**
   * Get all AST nodes for a specific file path
   */
  async getFileNodes(filePath: string): Promise<ASTNode[]> {
    this.ensureInitialized();

    const cacheKey = `file:${filePath}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Load database structure
      const structure = this.dbManager.getDatabaseStructure();
      if (!structure) {
        return [];
      }

      // Look for AST files in the asts directory
      const astPath = join(
        structure.asts,
        filePath.replace(/\//g, "_") + ".json",
      );

      if (!(await this.fs.exists(astPath))) {
        return [];
      }

      const astData = await readFile(astPath, "utf-8");
      const ast = JSON.parse(astData);

      // Extract all nodes from AST
      const nodes = this.extractAllNodes(ast, filePath);

      this.setCachedResult(cacheKey, nodes);
      return nodes;
    } catch (error) {
      this.logger.error("Failed to get file nodes", { filePath, error });
      return [];
    }
  }

  /**
   * Search AST nodes using text-based queries
   */
  async searchNodes(
    query: string,
    options: QueryOptions = {},
  ): Promise<ASTNodeMatch[]> {
    this.ensureInitialized();

    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const results = await this.textSearch(query, options);

      this.setCachedResult(cacheKey, results);
      return results;
    } catch (error) {
      this.logger.error("Search query failed", { query, error });
      return [];
    }
  }

  /**
   * Search AST nodes using vector similarity search
   */
  async vectorSearch(
    query: string,
    options: { maxResults?: number; ef?: number } = {},
  ): Promise<ASTNodeMatch[]> {
    this.ensureInitialized();

    const cacheKey = `vector:${query}:${JSON.stringify(options)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Try to use the actual vector database infrastructure
      const structure = this.dbManager.getDatabaseStructure();
      const vectorDBPath = structure.models; // Use models directory from database structure

      // Dynamic import to avoid loading heavy dependencies at startup
      const { VectorDatabaseFactory } = await import(
        "../../../ast-helper/src/database/vector/factory.js"
      );
      const { XenovaEmbeddingGenerator } = await import(
        "../../../ast-helper/src/embedder/XenovaEmbeddingGenerator.js"
      );

      // Initialize resources
      let vectorDB: Awaited<
        ReturnType<typeof VectorDatabaseFactory.create>
      > | null = null;
      let embeddingGenerator: InstanceType<
        typeof XenovaEmbeddingGenerator
      > | null = null;

      try {
        // Initialize vector database
        const vectorConfig = {
          dimensions: 768, // CodeBERT dimensions
          maxElements: 100000,
          M: 16,
          efConstruction: 200,
          space: "cosine" as const,
          storageFile: `${vectorDBPath}/vectors.db`,
          indexFile: `${vectorDBPath}/index.bin`,
          autoSave: false, // Read-only for queries
          saveInterval: 0,
        };

        vectorDB = await VectorDatabaseFactory.create(vectorConfig, {
          verbose: false,
        });
        await vectorDB.initialize(vectorConfig);

        // Initialize embedding generator
        embeddingGenerator = new XenovaEmbeddingGenerator();
        const modelPath = `${vectorDBPath}/codebert`;
        await embeddingGenerator.initialize(modelPath);

        // Generate query embedding
        const queryEmbeddings = await embeddingGenerator.generateEmbeddings([
          query,
        ]);
        if (queryEmbeddings.length === 0) {
          throw new Error("Failed to generate query embedding");
        }

        const queryVector = queryEmbeddings[0];
        if (!queryVector) {
          throw new Error("Query vector is undefined");
        }

        // Search for similar vectors
        const searchResults = await vectorDB.searchSimilar(
          queryVector,
          options.maxResults || 10,
          options.ef || 50,
        );

        // Convert to ASTNodeMatch format
        const matches: ASTNodeMatch[] = searchResults.map(
          (result: SearchResult) => ({
            nodeId: result.nodeId,
            nodeType: "function", // Default type since VectorMetadata doesn't have nodeType
            signature: result.metadata?.signature || "",
            summary: result.metadata?.summary || "",
            filePath: result.metadata?.filePath || "",
            startLine: result.metadata?.lineNumber || 0,
            endLine: result.metadata?.lineNumber
              ? result.metadata.lineNumber + 10
              : 10, // Approximate end line
            parentId: undefined, // VectorMetadata doesn't have parentId
            sourceSnippet: result.metadata?.signature || "", // Use signature as source
            createdAt: new Date(),
            updatedAt: new Date(),
            score: result.score, // Use the normalized score directly
            matchReason: `semantic similarity (${result.score.toFixed(3)})`,
          }),
        );

        this.setCachedResult(cacheKey, matches);
        return matches;
      } catch (vectorError) {
        this.logger.warn("Vector search failed, falling back to text search", {
          error:
            vectorError instanceof Error
              ? vectorError.message
              : String(vectorError),
        });

        // Fallback to text search
        const fallbackResults = await this.textSearch(query, {
          maxResults: options.maxResults,
          minScore: 0.3,
        });

        this.setCachedResult(cacheKey, fallbackResults);
        return fallbackResults;
      } finally {
        // Ensure cleanup always happens, even if errors occur
        try {
          if (embeddingGenerator) {
            await embeddingGenerator.shutdown();
          }
        } catch (cleanupError) {
          this.logger.warn("Error during embedding generator cleanup", {
            cleanupError,
          });
        }

        try {
          if (vectorDB) {
            await vectorDB.shutdown();
          }
        } catch (cleanupError) {
          this.logger.warn("Error during vector database cleanup", {
            cleanupError,
          });
        }
      }
    } catch (error) {
      this.logger.error("Vector search failed", { query, error });
      return [];
    }
  }

  /**
   * Get recent changes since a specific date
   */
  async getRecentChanges(
    since: Date | string,
    options: QueryOptions = {},
  ): Promise<ASTNode[]> {
    this.ensureInitialized();

    const sinceDate = typeof since === "string" ? new Date(since) : since;
    const cacheKey = `changes:${sinceDate.toISOString()}:${JSON.stringify(options)}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const nodes: ASTNode[] = [];
      const structure = this.dbManager.getDatabaseStructure();
      if (!structure) {
        return nodes;
      }

      const astsDir = structure.asts;

      // Read all AST files and check modification times
      const files = await readdir(astsDir);

      for (const file of files) {
        if (!file.endsWith(".json")) {
          continue;
        }

        const filePath = join(astsDir, file);
        const stats = await stat(filePath);

        if (stats.mtime > sinceDate) {
          const astData = await readFile(filePath, "utf-8");
          const ast = JSON.parse(astData);
          const originalPath = file.replace(".json", "").replace(/_/g, "/");

          nodes.push(...this.extractAllNodes(ast, originalPath));
        }
      }

      // Apply options
      let results = nodes;

      if (options.maxResults) {
        results = results.slice(0, options.maxResults);
      }

      if (options.filePattern) {
        results = results.filter((node) =>
          this.matchesPattern(node.filePath, options.filePattern!),
        );
      }

      this.setCachedResult(cacheKey, results);
      return results;
    } catch (error) {
      this.logger.error("Failed to get recent changes", {
        since: sinceDate,
        error,
      });
      return [];
    }
  }

  /**
   * Check if the index is ready for queries
   */
  async isIndexReady(): Promise<boolean> {
    this.ensureInitialized();

    try {
      const structure = this.dbManager.getDatabaseStructure();
      if (!structure) {
        return false;
      }

      // Check if AST files exist
      const astsExists = await this.fs.exists(structure.asts);
      if (!astsExists) {
        return false;
      }

      // Check if there are any AST files
      const files = await readdir(structure.asts);
      const astFiles = files.filter((f) => f.endsWith(".json"));

      return astFiles.length > 0;
    } catch (error) {
      this.logger.debug("Error checking index readiness", { error });
      return false;
    }
  }

  /**
   * Get index statistics and metadata
   */
  async getIndexStats(): Promise<{
    nodeCount: number;
    fileCount: number;
    lastUpdated: Date;
  }> {
    this.ensureInitialized();

    try {
      let nodeCount = 0;
      let fileCount = 0;
      let lastUpdated = new Date(0);

      const structure = this.dbManager.getDatabaseStructure();
      if (structure && (await this.fs.exists(structure.asts))) {
        const files = await readdir(structure.asts);
        fileCount = files.filter((f) => f.endsWith(".json")).length;

        // Count nodes by reading AST files
        for (const file of files) {
          if (!file.endsWith(".json")) {
            continue;
          }

          const filePath = join(structure.asts, file);
          const stats = await stat(filePath);

          if (stats.mtime > lastUpdated) {
            lastUpdated = stats.mtime;
          }

          try {
            const astData = await readFile(filePath, "utf-8");
            const ast = JSON.parse(astData);
            nodeCount += this.countNodes(ast);
          } catch {
            // Skip malformed files
          }
        }
      }

      return {
        nodeCount,
        fileCount,
        lastUpdated: lastUpdated.getTime() > 0 ? lastUpdated : new Date(),
      };
    } catch (error) {
      this.logger.error("Failed to get index stats", { error });
      return {
        nodeCount: 0,
        fileCount: 0,
        lastUpdated: new Date(),
      };
    }
  }

  // ===== Private Methods =====

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        "Database reader not initialized. Call initialize() first.",
      );
    }
  }

  private async setupHotReloadDetection(): Promise<void> {
    const structure = this.dbManager.getDatabaseStructure();
    if (!structure || !this.hotReloadConfig.enabled) {
      return;
    }

    try {
      const watchPaths = [structure.config, structure.asts];

      for (const path of watchPaths) {
        if (await this.fs.exists(path)) {
          const watcher = watch(
            path,
            { recursive: true },
            (eventType, filename) => {
              this.handleFileChange(eventType, filename, path);
            },
          );

          this.watchers.set(path, watcher);
        }
      }

      this.logger.debug("Hot reload detection setup complete", {
        watchedPaths: watchPaths.length,
      });
    } catch (error) {
      this.logger.warn("Failed to setup hot reload detection", { error });
    }
  }

  private handleFileChange = (() => {
    let debounceTimer: NodeJS.Timeout | null = null;

    return (eventType: string, filename: string | null, watchPath: string) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        try {
          this.logger.debug("File change detected", {
            eventType,
            filename,
            watchPath,
          });

          // Clear cache on changes
          this.queryCache.clear();

          // Check if index was updated
          const newIndexUpdate = await this.getLastIndexUpdate();
          if (
            newIndexUpdate &&
            (!this.lastIndexUpdate || newIndexUpdate > this.lastIndexUpdate)
          ) {
            this.lastIndexUpdate = newIndexUpdate;
            this.isReady = await this.checkIndexReadiness();
            this.emit("indexUpdated", { lastUpdated: newIndexUpdate });
          }

          // Emit change event
          this.emit("fileChanged", { eventType, filename, watchPath });
        } catch (error) {
          this.logger.error("Error handling file change", { error });
        }
      }, this.hotReloadConfig.debounceMs);
    };
  })();

  private async checkIndexReadiness(): Promise<boolean> {
    try {
      return await this.isIndexReady();
    } catch {
      return false;
    }
  }

  private async getLastIndexUpdate(): Promise<Date | null> {
    try {
      const structure = this.dbManager.getDatabaseStructure();
      if (!structure) {
        return null;
      }

      const astsDir = structure.asts;
      if (!(await this.fs.exists(astsDir))) {
        return null;
      }

      const files = await readdir(astsDir);
      let latest: Date | null = null;

      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = join(astsDir, file);
          const stats = await stat(filePath);
          if (!latest || stats.mtime > latest) {
            latest = stats.mtime;
          }
        }
      }

      return latest;
    } catch {
      return null;
    }
  }

  private async loadASTNode(nodeId: string): Promise<ASTNode | null> {
    try {
      // Node IDs typically contain file path information
      const parts = nodeId.split(":");
      if (parts.length < 2) {
        return null;
      }

      const filePath = parts[0];
      if (!filePath) {
        return null;
      }

      const structure = this.dbManager.getDatabaseStructure();
      if (!structure) {
        return null;
      }

      const astPath = join(
        structure.asts,
        filePath.replace(/\//g, "_") + ".json",
      );

      if (!(await this.fs.exists(astPath))) {
        return null;
      }

      const astData = await readFile(astPath, "utf-8");
      const ast = JSON.parse(astData);

      // Find the specific node
      return this.findNodeInAST(ast, nodeId, filePath);
    } catch {
      return null;
    }
  }

  private findNodeInAST(
    ast: any,
    nodeId: string,
    filePath: string,
  ): ASTNode | null {
    // Recursive search for node in AST
    const search = (node: any, path: string[] = []): ASTNode | null => {
      const currentNodeId = `${filePath}:${path.join(".")}`;

      if (currentNodeId === nodeId) {
        return this.astNodeToASTNode(node, filePath, path);
      }

      if (node.children && Array.isArray(node.children)) {
        for (let i = 0; i < node.children.length; i++) {
          const result = search(node.children[i], [
            ...path,
            "children",
            i.toString(),
          ]);
          if (result) {
            return result;
          }
        }
      }

      return null;
    };

    return search(ast);
  }

  private async findChildNodes(parentId: string): Promise<ASTNode[]> {
    const children: ASTNode[] = [];

    try {
      const structure = this.dbManager.getDatabaseStructure();
      if (!structure) {
        return children;
      }

      const astsDir = structure.asts;
      const files = await readdir(astsDir);

      for (const file of files) {
        if (!file.endsWith(".json")) {
          continue;
        }

        const filePath = join(astsDir, file);
        const originalPath = file.replace(".json", "").replace(/_/g, "/");

        const astData = await readFile(filePath, "utf-8");
        const ast = JSON.parse(astData);

        const fileNodes = this.extractAllNodes(ast, originalPath);
        for (const node of fileNodes) {
          if (node.parentId === parentId) {
            children.push(node);
          }
        }
      }
    } catch (error) {
      this.logger.error("Error finding child nodes", { parentId, error });
    }

    return children;
  }

  private extractAllNodes(ast: any, filePath: string): ASTNode[] {
    const nodes: ASTNode[] = [];

    const traverse = (
      node: any,
      path: string[] = [],
      parentId?: string,
    ): void => {
      const astNode = this.astNodeToASTNode(node, filePath, path, parentId);
      if (astNode) {
        nodes.push(astNode);

        // Process children with this node as parent
        if (node.children && Array.isArray(node.children)) {
          for (let i = 0; i < node.children.length; i++) {
            traverse(
              node.children[i],
              [...path, "children", i.toString()],
              astNode.nodeId,
            );
          }
        }
      }
    };

    traverse(ast);
    return nodes;
  }

  private countNodes(ast: any): number {
    let count = 0;

    const traverse = (node: any): void => {
      count++;
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(ast);
    return count;
  }

  private astNodeToASTNode(
    node: any,
    filePath: string,
    path: string[],
    parentId?: string,
  ): ASTNode | null {
    if (!node || !node.type) {
      return null;
    }

    const nodeId = `${filePath}:${path.join(".")}`;
    const now = new Date();

    return {
      nodeId,
      filePath,
      signature: this.extractSignature(node),
      summary: this.extractSummary(node),
      nodeType: node.type,
      startLine: node.startPosition?.row || 0,
      endLine: node.endPosition?.row || 0,
      sourceSnippet: node.text || "",
      parentId,
      metadata: {
        path: path.join("."),
        depth: Math.floor(path.length / 2), // Approximate depth
        startColumn: node.startPosition?.column || 0,
        endColumn: node.endPosition?.column || 0,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  private extractSignature(node: any): string {
    // Extract meaningful signature based on node type
    if (node.type === "function" || node.type === "method") {
      return node.text?.split("\n")[0] || node.type;
    }
    if (node.type === "class") {
      const match = node.text?.match(/class\s+(\w+)/);
      return match ? `class ${match[1]}` : "class";
    }
    if (node.type === "variable" || node.type === "identifier") {
      return node.text?.trim() || node.type;
    }

    return node.type;
  }

  private extractSummary(node: any): string {
    // Generate brief summary of the node
    const text = node.text || "";
    if (text.length <= 100) {
      return text.trim();
    }

    return text.substring(0, 97).trim() + "...";
  }

  private async textSearch(
    query: string,
    options: QueryOptions,
  ): Promise<ASTNodeMatch[]> {
    const matches: ASTNodeMatch[] = [];

    try {
      const structure = this.dbManager.getDatabaseStructure();
      if (!structure) {
        return matches;
      }

      const astsDir = structure.asts;
      const files = await readdir(astsDir);
      const queryLower = query.toLowerCase();

      for (const file of files) {
        if (!file.endsWith(".json")) {
          continue;
        }

        const filePath = join(astsDir, file);
        const originalPath = file.replace(".json", "").replace(/_/g, "/");

        // Apply file pattern filter
        if (
          options.filePattern &&
          !this.matchesPattern(originalPath, options.filePattern)
        ) {
          continue;
        }

        try {
          const astData = await readFile(filePath, "utf-8");
          const ast = JSON.parse(astData);
          const nodes = this.extractAllNodes(ast, originalPath);

          for (const node of nodes) {
            const signature = node.signature.toLowerCase();
            const summary = node.summary.toLowerCase();
            const nodeType = node.nodeType.toLowerCase();
            const snippet = node.sourceSnippet.toLowerCase();

            if (
              signature.includes(queryLower) ||
              summary.includes(queryLower) ||
              nodeType.includes(queryLower) ||
              snippet.includes(queryLower)
            ) {
              const score = this.calculateTextScore(query, node);

              if (options.minScore && score < options.minScore) {
                continue;
              }

              const match: ASTNodeMatch = {
                ...node,
                score,
                matchReason: this.getMatchReason(query, node),
              };

              matches.push(match);
            }
          }
        } catch {
          // Skip malformed files
        }
      }

      // Sort by score
      matches.sort((a, b) => b.score - a.score);

      // Apply limit
      if (options.maxResults) {
        matches.splice(options.maxResults);
      }
    } catch (error) {
      this.logger.error("Text search failed", { error });
    }

    return matches;
  }

  private calculateTextScore(query: string, node: ASTNode): number {
    const queryLower = query.toLowerCase();
    const signature = node.signature.toLowerCase();
    const summary = node.summary.toLowerCase();
    const nodeType = node.nodeType.toLowerCase();

    let score = 0;

    // Exact matches get higher scores
    if (signature === queryLower) {
      score += 1.0;
    } else if (signature.includes(queryLower)) {
      score += 0.7;
    }

    if (nodeType === queryLower) {
      score += 0.8;
    } else if (nodeType.includes(queryLower)) {
      score += 0.5;
    }

    if (summary.includes(queryLower)) {
      score += 0.3;
    }

    // Bonus for important node types
    if (["function", "class", "method", "variable"].includes(nodeType)) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  private getMatchReason(query: string, node: ASTNode): string {
    const queryLower = query.toLowerCase();
    const reasons: string[] = [];

    if (node.signature.toLowerCase().includes(queryLower)) {
      reasons.push("signature");
    }
    if (node.nodeType.toLowerCase().includes(queryLower)) {
      reasons.push("type");
    }
    if (node.summary.toLowerCase().includes(queryLower)) {
      reasons.push("content");
    }

    return reasons.join(", ") || "text match";
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern);
      return regex.test(filePath);
    } catch {
      // Fallback to simple string matching
      return filePath.includes(pattern);
    }
  }

  private getCachedResult(key: string): any | null {
    const cached = this.queryCache.get(key);
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.result;
  }

  private setCachedResult(key: string, result: any): void {
    // Keep cache size reasonable
    if (this.queryCache.size > 100) {
      const entries = Array.from(this.queryCache.entries());
      const oldest = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) {
        this.queryCache.delete(oldest[0]);
      }
    }

    this.queryCache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }
}
