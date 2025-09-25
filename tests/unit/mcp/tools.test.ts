/**
 * Tool Handlers Test Suite
 *
 * Comprehensive tests for MCP tool handlers including intent-based
 * queries, node operations, file queries, text search, and index status
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  IntentQueryHandler,
  NodeLookupHandler,
  FileQueryHandler,
  TextSearchHandler,
  IndexStatusHandler,
  RecentChangesHandler,
  ToolHandlerRegistry,
} from "../../../packages/ast-mcp-server/src/mcp/tools.js";
import { JSONRPCRequest } from "../../../packages/ast-mcp-server/src/mcp/protocol.js";
import type {
  DatabaseReader,
  ASTNode,
  ASTNodeMatch,
} from "../../../packages/ast-mcp-server/src/types.js";

// Mock database reader implementation
class MockDatabaseReader implements DatabaseReader {
  private mockNodes: ASTNode[] = [];
  private mockMatches: ASTNodeMatch[] = [];

  async initialize(): Promise<void> {
    // Mock initialization
  }

  async close(): Promise<void> {
    // Mock close
  }

  async queryByIntent(intent: string): Promise<ASTNodeMatch[]> {
    return this.mockMatches.filter(
      (match) =>
        match.matchReason?.includes(intent) || match.summary.includes(intent),
    );
  }

  async getNodeById(nodeId: string): Promise<ASTNode | null> {
    return this.mockNodes.find((node) => node.nodeId === nodeId) || null;
  }

  async getChildNodes(nodeId: string): Promise<ASTNode[]> {
    return this.mockNodes.filter((node) => node.parentId === nodeId);
  }

  async getFileNodes(filePath: string): Promise<ASTNode[]> {
    return this.mockNodes.filter((node) => node.filePath === filePath);
  }

  async searchNodes(query: string): Promise<ASTNodeMatch[]> {
    return this.mockMatches.filter(
      (match) =>
        match.sourceSnippet.includes(query) || match.summary.includes(query),
    );
  }

  async getRecentChanges(): Promise<ASTNode[]> {
    return this.mockNodes.filter(
      (node) => node.updatedAt > new Date(Date.now() - 24 * 60 * 60 * 1000),
    );
  }

  async isIndexReady(): Promise<boolean> {
    return true;
  }

  async getIndexStats(): Promise<{
    nodeCount: number;
    fileCount: number;
    lastUpdated: Date;
  }> {
    const uniqueFiles = new Set(this.mockNodes.map((node) => node.filePath));
    return {
      nodeCount: this.mockNodes.length,
      fileCount: uniqueFiles.size,
      lastUpdated: new Date(),
    };
  }

  // Test helper methods
  setMockNodes(nodes: ASTNode[]): void {
    this.mockNodes = nodes;
  }

  setMockMatches(matches: ASTNodeMatch[]): void {
    this.mockMatches = matches;
  }
}

describe("Tool Handlers", () => {
  let mockDb: MockDatabaseReader;
  let registry: ToolHandlerRegistry;
  let intentHandler: IntentQueryHandler;
  let nodeHandler: NodeLookupHandler;
  let fileHandler: FileQueryHandler;
  let textHandler: TextSearchHandler;
  let statusHandler: IndexStatusHandler;
  let changesHandler: RecentChangesHandler;

  beforeEach(() => {
    mockDb = new MockDatabaseReader();
    registry = new ToolHandlerRegistry(mockDb);

    // Create individual handlers for direct testing
    intentHandler = new IntentQueryHandler(mockDb);
    nodeHandler = new NodeLookupHandler(mockDb);
    fileHandler = new FileQueryHandler(mockDb);
    textHandler = new TextSearchHandler(mockDb);
    statusHandler = new IndexStatusHandler(mockDb);
    changesHandler = new RecentChangesHandler(mockDb);

    // Set up test data
    const testNodes: ASTNode[] = [
      {
        nodeId: "node-1",
        filePath: "src/utils.ts",
        signature: "function processData(data: any[]): void",
        summary: "Function that processes array data",
        nodeType: "FunctionDeclaration",
        startLine: 10,
        endLine: 25,
        sourceSnippet:
          "function processData(data: any[]) {\n  // Process data here\n  return data.map(item => item.value);\n}",
        parentId: "node-root",
        metadata: { complexity: 5 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        nodeId: "node-2",
        filePath: "src/utils.ts",
        signature: "class DataProcessor",
        summary: "Class for processing various data types",
        nodeType: "ClassDeclaration",
        startLine: 30,
        endLine: 60,
        sourceSnippet:
          "class DataProcessor {\n  process() {\n    // Implementation\n  }\n}",
        parentId: "node-root",
        metadata: { methods: 3 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        nodeId: "node-3",
        filePath: "src/auth.ts",
        signature: "function authenticate(token: string): boolean",
        summary: "Authentication function that validates tokens",
        nodeType: "FunctionDeclaration",
        startLine: 5,
        endLine: 15,
        sourceSnippet:
          "function authenticate(token: string): boolean {\n  return validateToken(token);\n}",
        metadata: { security: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const testMatches: ASTNodeMatch[] = testNodes.map((node) => ({
      ...node,
      score: 0.8,
      matchReason: "Test match for " + node.summary,
    }));

    mockDb.setMockNodes(testNodes);
    mockDb.setMockMatches(testMatches);
  });

  describe("IntentQueryHandler", () => {
    it("should handle valid intent queries", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-1",
        method: "query_ast_context",
        params: {
          intent: "data processing functions",
          maxResults: 5,
        },
      };

      const response = await intentHandler.handle(request);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe("test-1");
      expect(response.result).toBeDefined();

      const result = JSON.parse(response.result!.content[0].text);
      expect(result.intent).toBe("data processing functions");
      expect(result.matches).toBeInstanceOf(Array);
      expect(result.matchCount).toBe(result.matches.length);
    });

    it("should validate required parameters", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-2",
        method: "query_ast_context",
        params: {},
      };

      const response = await intentHandler.handle(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602); // INVALID_PARAMS
      expect(response.error!.message).toContain("intent");
    });

    it("should apply default parameters", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-3",
        method: "query_ast_context",
        params: {
          intent: "test query",
        },
      };

      const response = await intentHandler.handle(request);

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result!.content[0].text);
      expect(result.matches.length).toBeLessThanOrEqual(10); // default maxResults
    });

    it("should validate numeric ranges", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-4",
        method: "query_ast_context",
        params: {
          intent: "test query",
          maxResults: 150, // exceeds max of 100
        },
      };

      const response = await intentHandler.handle(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602); // INVALID_PARAMS
      expect(response.error!.message).toContain("maxResults");
    });
  });

  describe("NodeLookupHandler", () => {
    it("should retrieve existing nodes", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-5",
        method: "get_node_details",
        params: {
          nodeId: "node-1",
          includeChildren: false,
          includeText: true,
        },
      };

      const response = await nodeHandler.handle(request);

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result!.content[0].text);
      expect(result.node.nodeId).toBe("node-1");
      expect(result.node.type).toBe("FunctionDeclaration");
      expect(result.node.sourceSnippet).toBeDefined();
    });

    it("should handle non-existent nodes", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-6",
        method: "get_node_details",
        params: {
          nodeId: "non-existent",
        },
      };

      const response = await nodeHandler.handle(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32001); // RESOURCE_NOT_FOUND
    });

    it("should include children when requested", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-7",
        method: "get_node_details",
        params: {
          nodeId: "node-root",
          includeChildren: true,
        },
      };

      const response = await nodeHandler.handle(request);

      if (response.result) {
        const result = JSON.parse(response.result.content[0].text);
        expect(result.children).toBeDefined();
        expect(result.children).toBeInstanceOf(Array);
      }
    });
  });

  describe("FileQueryHandler", () => {
    it("should retrieve nodes for specific files", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-8",
        method: "ast_file_query",
        params: {
          filePath: "src/utils.ts",
        },
      };

      const response = await fileHandler.handle(request);

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result!.content[0].text);
      expect(result.filePath).toBe("src/utils.ts");
      expect(result.nodes).toBeInstanceOf(Array);
      expect(result.nodes.length).toBeGreaterThan(0);
    });

    it("should filter by node types", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-9",
        method: "ast_file_query",
        params: {
          filePath: "src/utils.ts",
          nodeTypes: ["FunctionDeclaration"],
        },
      };

      const response = await fileHandler.handle(request);

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result!.content[0].text);
      result.nodes.forEach((node: any) => {
        expect(node.type).toBe("FunctionDeclaration");
      });
    });
  });

  describe("TextSearchHandler", () => {
    it("should search text in AST nodes", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-10",
        method: "ast_text_search",
        params: {
          query: "processData",
          maxResults: 10,
        },
      };

      const response = await textHandler.handle(request);

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result!.content[0].text);
      expect(result.query).toBe("processData");
      expect(result.matches).toBeInstanceOf(Array);
    });

    it("should validate search parameters", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-11",
        method: "ast_text_search",
        params: {
          maxResults: 150, // exceeds limit
        },
      };

      const response = await textHandler.handle(request);

      expect(response.error).toBeDefined();
      expect(response.error!.message).toContain("query");
    });
  });

  describe("IndexStatusHandler", () => {
    it("should return index status", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-12",
        method: "ast_index_status",
        params: {},
      };

      const response = await statusHandler.handle(request);

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result!.content[0].text);
      expect(result.ready).toBeDefined();
      expect(result.statistics).toBeDefined();
      expect(result.statistics.nodeCount).toBeGreaterThan(0);
      expect(result.statistics.fileCount).toBeGreaterThan(0);
      expect(result.statistics.lastUpdated).toBeDefined();
    });
  });

  describe("RecentChangesHandler", () => {
    it("should return recent changes with defaults", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-13",
        method: "list_recent_changes",
        params: {},
      };

      const response = await changesHandler.handle(request);

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result!.content[0].text);
      expect(result.since).toBeDefined();
      expect(result.changes).toBeInstanceOf(Array);
    });

    it("should accept custom since parameter", async () => {
      const customSince = new Date(
        Date.now() - 2 * 60 * 60 * 1000,
      ).toISOString(); // 2 hours ago

      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-14",
        method: "list_recent_changes",
        params: {
          since: customSince,
          maxResults: 20,
        },
      };

      const response = await changesHandler.handle(request);

      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result!.content[0].text);
      expect(result.since).toBe(customSince);
    });
  });

  describe("ToolHandlerRegistry", () => {
    it("should register all tool handlers", () => {
      const toolNames = registry.getToolNames();

      expect(toolNames).toContain("query_ast_context");
      expect(toolNames).toContain("get_node_details");
      expect(toolNames).toContain("ast_file_query");
      expect(toolNames).toContain("ast_text_search");
      expect(toolNames).toContain("ast_index_status");
      expect(toolNames).toContain("list_recent_changes");
    });

    it("should return handler for valid tool names", () => {
      const handler = registry.getHandler("query_ast_context");
      expect(handler).toBeInstanceOf(IntentQueryHandler);
    });

    it("should return null for invalid tool names", () => {
      const handler = registry.getHandler("invalid_tool");
      expect(handler).toBeNull();
    });

    it("should provide all tool definitions", () => {
      const definitions = registry.getAllToolDefinitions();

      expect(definitions.length).toBe(6);
      expect(
        definitions.every(
          (def: any) => def.name && def.description && def.inputSchema,
        ),
      ).toBe(true);
    });

    it("should have properly structured tool definitions", () => {
      const definitions = registry.getAllToolDefinitions();

      definitions.forEach((def: any) => {
        expect(def.name).toBeDefined();
        expect(def.description).toBeDefined();
        expect(def.inputSchema).toBeDefined();
        expect(def.inputSchema.type).toBe("object");
        expect(def.inputSchema.properties).toBeDefined();
        expect(def.inputSchema.required).toBeInstanceOf(Array);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock database error
      vi.spyOn(mockDb, "queryByIntent").mockRejectedValue(
        new Error("Database connection failed"),
      );

      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-error",
        method: "query_ast_context",
        params: {
          intent: "test query",
        },
      };

      const response = await intentHandler.handle(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32002); // TOOL_EXECUTION_ERROR
      expect(response.error!.message).toContain("Database connection failed");
    });

    it("should validate parameter types", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-type-error",
        method: "query_ast_context",
        params: {
          intent: 123, // should be string
          maxResults: "invalid", // should be number
        },
      };

      const response = await intentHandler.handle(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602); // INVALID_PARAMS
    });
  });
});
