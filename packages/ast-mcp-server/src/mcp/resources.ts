/**
 * MCP Resource Handlers for AST Data Access
 *
 * Implements MCP resource handlers that provide access to AST data
 * via URI-based resource requests as specified in MCP 1.0 protocol.
 */

import { BaseHandler } from "./handlers.js";
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  MCPResourceDefinition,
} from "./protocol.js";
import { MCPErrorCode } from "./protocol.js";

import type { DatabaseReader, ASTNode } from "../types.js";
import { createLogger } from "@ast-copilot-helper/ast-helper/logging";

// Resource content types
interface NodeResourceContent {
  nodeId: string;
  filePath: string;
  nodeType: string;
  signature: string;
  summary: string;
  sourceCode: {
    snippet: string;
    startLine: number;
    endLine: number;
    language: string;
  };
  metadata: Record<string, unknown>;
  children: Array<{
    nodeId: string;
    nodeType: string;
    signature: string;
    summary: string;
    startLine: number;
    endLine: number;
  }>;
  childCount: number;
  timestamp: string;
}

interface FileResourceContent {
  filePath: string;
  language: string;
  structure: {
    rootNodes: TreeNode[];
    totalNodes: number;
    nodeTypes: string[];
    lastModified: string;
  };
  statistics: {
    totalNodes: number;
    nodeTypeDistribution: Record<string, number>;
    linesOfCode: number;
  };
  timestamp: string;
}

interface TreeNode {
  nodeId: string;
  nodeType: string;
  signature: string;
  summary: string;
  sourceCode: {
    snippet: string;
    startLine: number;
    endLine: number;
  };
  metadata: Record<string, unknown>;
  children: TreeNode[];
}

interface SearchResourceContent {
  query: string;
  searchOptions: {
    maxResults: number;
    minScore: number;
    includeContext: boolean;
  };
  results: {
    matches: Array<{
      nodeId: string;
      score: number;
      matchReason?: string;
      node: {
        filePath: string;
        nodeType: string;
        signature: string;
        summary: string;
        sourceCode: {
          snippet: string;
          startLine: number;
          endLine: number;
          language: string;
        };
      };
      metadata: Record<string, unknown>;
    }>;
    totalCount: number;
    performance: {
      queryTimeMs: number;
      resultsPerSecond: number;
    };
  };
  timestamp: string;
}

interface StatsResourceContent {
  type: string;
  [key: string]: unknown;
}

interface ChangesResourceContent {
  timeframe: {
    since: string;
    until: string;
    description: string;
  };
  summary: {
    totalChanges: number;
    affectedFiles: number;
    changeTypes: Record<string, number>;
  };
  changes: Array<{
    nodeId: string;
    filePath: string;
    nodeType: string;
    signature: string;
    summary: string;
    changeType: string;
    sourceCode: {
      snippet: string;
      startLine: number;
      endLine: number;
    };
    timestamp: string;
  }>;
  groupedByFile: Record<
    string,
    {
      changeCount: number;
      changes: Array<{
        nodeId: string;
        nodeType: string;
        signature: string;
        changeType: string;
      }>;
    }
  >;
  timestamp: string;
}

type ResourceContent =
  | NodeResourceContent
  | FileResourceContent
  | SearchResourceContent
  | StatsResourceContent
  | ChangesResourceContent;

interface ParsedResourceURI {
  type: "nodes" | "files" | "search" | "stats" | "changes";
  identifier: string;
}

/**
 * MCP Resources provided by the AST server
 */
export const MCP_RESOURCES: MCPResourceDefinition[] = [
  {
    uri: "ast://nodes/{nodeId}",
    name: "AST Node",
    description: "Individual AST node data with annotations",
    mimeType: "application/json",
  },
  {
    uri: "ast://files/{filePath}",
    name: "File AST Nodes",
    description: "All AST nodes for a specific file",
    mimeType: "application/json",
  },
  {
    uri: "ast://search/{query}",
    name: "Search Results",
    description: "AST nodes matching semantic search query",
    mimeType: "application/json",
  },
  {
    uri: "ast://stats/server",
    name: "Server Statistics",
    description: "Server performance metrics and runtime statistics",
    mimeType: "application/json",
  },
  {
    uri: "ast://stats/index",
    name: "Index Statistics",
    description: "Database index status and statistics",
    mimeType: "application/json",
  },
  {
    uri: "ast://changes",
    name: "Recent Changes",
    description: "Recent AST modifications and updates",
    mimeType: "application/json",
  },
];

/**
 * Resources list handler
 * Returns the list of available MCP resources
 */
export class ResourcesListHandler extends BaseHandler {
  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          resources: MCP_RESOURCES,
        },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.INTERNAL_ERROR,
          message: `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }
}

/**
 * Resources read handler
 * Reads specific resource content based on URI
 */
export class ResourcesReadHandler extends BaseHandler {
  private db: DatabaseReader;
  private cache = new Map<
    string,
    { content: ResourceContent; timestamp: number }
  >();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly PERFORMANCE_TARGET_MS = 200;
  private logger = createLogger({ operation: "mcp-resources" });

  constructor(db: DatabaseReader) {
    super();
    this.db = db;
  }

  async handle(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const startTime = Date.now();

    try {
      const { params } = request;

      // Validate required parameters
      const validationError = this.validateParams(params, ["uri"]);
      if (validationError) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.INVALID_PARAMS,
            message: validationError,
          },
        };
      }

      const { uri } = params;

      // Check cache first
      const cached = this.getFromCache(uri);
      if (cached) {
        const responseTime = Date.now() - startTime;
        this.logger.debug(`Cache hit for ${uri} (${responseTime}ms)`);
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(cached, null, 2),
              },
            ],
          },
        };
      }

      const parsed = this.parseResourceURI(uri);
      let content: ResourceContent;

      switch (parsed.type) {
        case "nodes":
          content = await this.handleNodesResource(parsed.identifier);
          break;
        case "files":
          content = await this.handleFilesResource(parsed.identifier);
          break;
        case "search":
          content = await this.handleSearchResource(parsed.identifier);
          break;
        case "stats":
          content = await this.handleStatsResource(parsed.identifier);
          break;
        case "changes":
          content = await this.handleChangesResource(parsed.identifier);
          break;
        default:
          throw new Error(`Unsupported resource type: ${parsed.type}`);
      }

      // Cache the result for future requests
      this.setCache(uri, content);

      const responseTime = Date.now() - startTime;

      // Performance monitoring
      if (responseTime > this.PERFORMANCE_TARGET_MS) {
        this.logger.warn(
          `Slow resource response: ${uri} took ${responseTime}ms (target: ${this.PERFORMANCE_TARGET_MS}ms)`,
        );
      } else {
        this.logger.debug(`Resource served: ${uri} (${responseTime}ms)`);
      }

      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(content, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error(
        `Error serving ${request.params?.uri || "unknown"} after ${responseTime}ms`,
        { error: error instanceof Error ? error.message : String(error) },
      );

      // Enhanced error messages based on error type
      let errorMessage = "Failed to read resource";
      let errorCode = MCPErrorCode.INTERNAL_ERROR;

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          errorCode = MCPErrorCode.INVALID_PARAMS;
          errorMessage = `Resource not found: ${error.message}`;
        } else if (error.message.includes("Invalid resource URI")) {
          errorCode = MCPErrorCode.INVALID_PARAMS;
          errorMessage = error.message;
        } else if (error.message.includes("timeout")) {
          errorCode = MCPErrorCode.INTERNAL_ERROR;
          errorMessage = `Request timeout: ${error.message}`;
        } else {
          errorMessage = `${errorMessage}: ${error.message}`;
        }
      }

      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }
  }

  /**
   * Parse resource URI into components
   */
  private parseResourceURI(uri: string): ParsedResourceURI {
    // Handle special case for changes resource without identifier
    if (uri === "ast://changes" || uri.startsWith("ast://changes/")) {
      const identifier =
        uri === "ast://changes" ? "" : uri.substring("ast://changes/".length);
      return {
        type: "changes",
        identifier: decodeURIComponent(identifier),
      };
    }

    const match = uri.match(/^ast:\/\/(\w+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid resource URI format: ${uri}`);
    }

    const [, type, identifier] = match;

    if (!type || !identifier) {
      throw new Error(`Malformed resource URI: ${uri}`);
    }

    if (!["nodes", "files", "search", "stats", "changes"].includes(type)) {
      throw new Error(`Unknown resource type: ${type}`);
    }

    return {
      type: type as "nodes" | "files" | "search" | "stats" | "changes",
      identifier: decodeURIComponent(identifier),
    };
  }

  /**
   * Handle ast://nodes/{nodeId} resource requests
   */
  private async handleNodesResource(
    nodeId: string,
  ): Promise<NodeResourceContent> {
    const node = await this.db.getNodeById(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const childNodes = await this.db.getChildNodes(nodeId);

    // Rich content with metadata and source snippets
    return {
      nodeId: node.nodeId,
      filePath: node.filePath,
      nodeType: node.nodeType,
      signature: node.signature,
      summary: node.summary,
      sourceCode: {
        snippet: node.sourceSnippet,
        startLine: node.startLine,
        endLine: node.endLine,
        language: this.inferLanguageFromPath(node.filePath),
      },
      metadata: {
        ...node.metadata,
        parentId: node.parentId,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
      },
      children: childNodes.map((child) => ({
        nodeId: child.nodeId,
        nodeType: child.nodeType,
        signature: child.signature,
        summary: child.summary,
        startLine: child.startLine,
        endLine: child.endLine,
      })),
      childCount: childNodes.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Handle ast://files/{filePath} resource requests
   */
  private async handleFilesResource(
    filePath: string,
  ): Promise<FileResourceContent> {
    const nodes = await this.db.getFileNodes(filePath);

    if (nodes.length === 0) {
      // Return empty results for files with no nodes instead of throwing
      return {
        filePath,
        language: this.inferLanguageFromPath(filePath),
        structure: {
          rootNodes: [],
          totalNodes: 0,
          nodeTypes: [],
          lastModified: new Date().toISOString(),
        },
        statistics: {
          totalNodes: 0,
          nodeTypeDistribution: {},
          linesOfCode: 0,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Build hierarchical tree structure
    const nodeMap = new Map(nodes.map((node) => [node.nodeId, node]));
    const rootNodes: TreeNode[] = [];
    const nodeTree = new Map<string, TreeNode>();

    // Transform nodes with hierarchy
    for (const node of nodes) {
      const treeNode = {
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        signature: node.signature,
        summary: node.summary,
        sourceCode: {
          snippet: node.sourceSnippet,
          startLine: node.startLine,
          endLine: node.endLine,
        },
        metadata: node.metadata || {},
        children: [] as TreeNode[],
      };

      nodeTree.set(node.nodeId, treeNode);

      if (!node.parentId || !nodeMap.has(node.parentId)) {
        rootNodes.push(treeNode);
      }
    }

    // Build parent-child relationships
    for (const node of nodes) {
      if (node.parentId && nodeTree.has(node.parentId)) {
        const parent = nodeTree.get(node.parentId);
        const child = nodeTree.get(node.nodeId);
        if (parent && child) {
          parent.children.push(child);
        }
      }
    }

    return {
      filePath,
      language: this.inferLanguageFromPath(filePath),
      structure: {
        rootNodes,
        totalNodes: nodes.length,
        nodeTypes: [...new Set(nodes.map((n) => n.nodeType))],
        lastModified: nodes
          .reduce(
            (latest, node) =>
              node.updatedAt > latest ? node.updatedAt : latest,
            new Date(0),
          )
          .toISOString(),
      },
      statistics: {
        totalNodes: nodes.length,
        nodeTypeDistribution: this.calculateNodeTypeDistribution(nodes),
        linesOfCode: this.calculateLinesOfCode(nodes),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Handle ast://search/{query} resource requests
   */
  private async handleSearchResource(
    query: string,
  ): Promise<SearchResourceContent> {
    const startTime = Date.now();
    const options = {
      maxResults: 50,
      minScore: 0.1,
      includeContext: true,
    };

    const results = await this.db.searchNodes(query, options);
    const queryTime = Date.now() - startTime;

    return {
      query,
      searchOptions: options,
      results: {
        matches: results.map((match) => ({
          nodeId: match.nodeId,
          score: match.score,
          matchReason: match.matchReason,
          node: {
            filePath: match.filePath,
            nodeType: match.nodeType,
            signature: match.signature,
            summary: match.summary,
            sourceCode: {
              snippet: match.sourceSnippet,
              startLine: match.startLine,
              endLine: match.endLine,
              language: this.inferLanguageFromPath(match.filePath),
            },
          },
          metadata: {
            ...match.metadata,
            updatedAt: match.updatedAt.toISOString(),
          },
        })),
        totalCount: results.length,
        performance: {
          queryTimeMs: queryTime,
          resultsPerSecond: results.length / (queryTime / 1000),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Handle ast://stats/{type} resource requests
   */
  private async handleStatsResource(
    statsType: string,
  ): Promise<StatsResourceContent> {
    switch (statsType) {
      case "server": {
        return {
          type: "server",
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          processInfo: {
            pid: process.pid,
            version: process.version,
            arch: process.arch,
            platform: process.platform,
          },
          timestamp: new Date().toISOString(),
        };
      }

      case "index": {
        const indexStats = await this.db.getIndexStats();
        const isReady = await this.db.isIndexReady();
        return {
          type: "index",
          ready: isReady,
          nodeCount: indexStats.nodeCount,
          fileCount: indexStats.fileCount,
          lastUpdated: indexStats.lastUpdated.toISOString(),
          timestamp: new Date().toISOString(),
        };
      }

      default: {
        throw new Error(`Unknown stats type: ${statsType}`);
      }
    }
  }

  /**
   * Handle ast://changes resource requests
   */
  private async handleChangesResource(
    timeframe?: string,
  ): Promise<ChangesResourceContent> {
    // Parse timeframe parameter (default: last 24 hours)
    let since: Date;
    switch (timeframe) {
      case "hour":
        since = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case "day":
        since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: 24 hours
    }

    const options = { maxResults: 100 };
    const changes = await this.db.getRecentChanges(since, options);

    // Group changes by file and operation type
    const changesByFile = new Map<string, ASTNode[]>();
    const changeTypes = new Map<string, number>();

    for (const change of changes) {
      // Group by file
      if (!changesByFile.has(change.filePath)) {
        changesByFile.set(change.filePath, []);
      }
      const fileChanges = changesByFile.get(change.filePath);
      if (fileChanges) {
        fileChanges.push(change);
      }

      // Count change types
      const changeType = this.classifyChange(change);
      changeTypes.set(changeType, (changeTypes.get(changeType) || 0) + 1);
    }

    return {
      timeframe: {
        since: since.toISOString(),
        until: new Date().toISOString(),
        description: timeframe || "day",
      },
      summary: {
        totalChanges: changes.length,
        affectedFiles: changesByFile.size,
        changeTypes: Object.fromEntries(changeTypes),
      },
      changes: changes.map((change) => ({
        nodeId: change.nodeId,
        filePath: change.filePath,
        nodeType: change.nodeType,
        signature: change.signature,
        summary: change.summary,
        changeType: this.classifyChange(change),
        sourceCode: {
          snippet: change.sourceSnippet,
          startLine: change.startLine,
          endLine: change.endLine,
        },
        timestamp: change.updatedAt.toISOString(),
      })),
      groupedByFile: Object.fromEntries(
        Array.from(changesByFile.entries()).map(([filePath, fileChanges]) => [
          filePath,
          {
            changeCount: fileChanges.length,
            changes: fileChanges.map((c) => ({
              nodeId: c.nodeId,
              nodeType: c.nodeType,
              signature: c.signature,
              changeType: this.classifyChange(c),
            })),
          },
        ]),
      ),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Utility methods for content enhancement
   */
  private inferLanguageFromPath(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const languageMap: Record<string, string> = {
      ts: "typescript",
      js: "javascript",
      jsx: "javascript",
      tsx: "typescript",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      cpp: "cpp",
      c: "c",
      cs: "csharp",
      php: "php",
      rb: "ruby",
    };
    return languageMap[ext] || "text";
  }

  private calculateNodeTypeDistribution(
    nodes: ASTNode[],
  ): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const node of nodes) {
      distribution[node.nodeType] = (distribution[node.nodeType] || 0) + 1;
    }
    return distribution;
  }

  private calculateLinesOfCode(nodes: ASTNode[]): number {
    return nodes.reduce((total, node) => {
      return total + (node.endLine - node.startLine + 1);
    }, 0);
  }

  private classifyChange(node: ASTNode): string {
    const updated = new Date(node.updatedAt);
    const created = new Date(node.createdAt);

    // If created recently, it's a new addition
    if (Math.abs(updated.getTime() - created.getTime()) < 60000) {
      // Within 1 minute
      return "added";
    }

    // Otherwise it's a modification
    return "modified";
  }

  /**
   * Cache management methods
   */
  private getFromCache(uri: string): ResourceContent | null {
    const cached = this.cache.get(uri);
    if (!cached) {
      return null;
    }

    const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL_MS;
    if (isExpired) {
      this.cache.delete(uri);
      return null;
    }

    return cached.content;
  }

  private setCache(uri: string, content: ResourceContent): void {
    // Prevent cache from growing too large
    if (this.cache.size > 100) {
      // Remove oldest entries (simple LRU)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(uri, {
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache (useful for testing or manual cache invalidation)
   */
  public clearCache(): void {
    this.cache.clear();
    this.logger.info("Cache cleared");
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hitRate?: number } {
    return {
      size: this.cache.size,
    };
  }
}

/**
 * Resource handler factory
 */
export class ResourceHandlerFactory {
  createResourcesListHandler(): ResourcesListHandler {
    return new ResourcesListHandler();
  }

  createResourcesReadHandler(db: DatabaseReader): ResourcesReadHandler {
    return new ResourcesReadHandler(db);
  }
}
