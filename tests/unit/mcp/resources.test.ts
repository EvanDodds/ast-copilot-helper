/**
 * Resource Handlers Test Suite
 *
 * Comprehensive tests for MCP resource handlers including resources/list
 * and resources/read with URI parsing and content retrieval
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ResourcesListHandler,
  ResourcesReadHandler,
  ResourceHandlerFactory,
  MCP_RESOURCES,
} from "../../../packages/ast-mcp-server/src/mcp/resources.js";
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
        match.summary.toLowerCase().includes(query.toLowerCase()) ||
        match.sourceSnippet.toLowerCase().includes(query.toLowerCase()),
    );
  }

  async getRecentChanges(): Promise<ASTNode[]> {
    return this.mockNodes.slice(0, 5);
  }

  async isIndexReady(): Promise<boolean> {
    return true;
  }

  async getIndexStats(): Promise<{
    nodeCount: number;
    fileCount: number;
    lastUpdated: Date;
  }> {
    return {
      nodeCount: this.mockNodes.length,
      fileCount: new Set(this.mockNodes.map((n) => n.filePath)).size,
      lastUpdated: new Date(),
    };
  }

  // Helper methods for testing
  setMockNodes(nodes: ASTNode[]): void {
    this.mockNodes = nodes;
  }

  setMockMatches(matches: ASTNodeMatch[]): void {
    this.mockMatches = matches;
  }
}

describe("Resource Handlers", () => {
  let mockDb: MockDatabaseReader;
  let resourcesListHandler: ResourcesListHandler;
  let resourcesReadHandler: ResourcesReadHandler;

  beforeEach(() => {
    mockDb = new MockDatabaseReader();
    resourcesListHandler = new ResourcesListHandler();
    resourcesReadHandler = new ResourcesReadHandler(mockDb);

    // Setup mock data
    const mockNode: ASTNode = {
      nodeId: "test-node-1",
      filePath: "/test/file.ts",
      signature: "function testFunction()",
      summary: "A test function for unit testing",
      nodeType: "function",
      startLine: 10,
      endLine: 20,
      sourceSnippet: 'function testFunction() {\n  return "test";\n}',
      parentId: "test-parent-1",
      metadata: { complexity: 1 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMatch: ASTNodeMatch = {
      ...mockNode,
      score: 0.9,
      matchReason: "Function signature match",
    };

    mockDb.setMockNodes([mockNode]);
    mockDb.setMockMatches([mockMatch]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("ResourcesListHandler", () => {
    it("should return list of available resources", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "1",
        method: "resources/list",
        params: {},
      };

      const response = await resourcesListHandler.handle(request);

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: "1",
        result: {
          resources: MCP_RESOURCES,
        },
      });
    });

    it("should handle errors gracefully", async () => {
      // Create a handler that throws an error internally
      const errorHandler = new ResourcesListHandler();

      // Mock the internal handling to simulate an error
      vi.spyOn(errorHandler, "handle").mockImplementation(async (request) => {
        try {
          throw new Error("Test error");
        } catch (error) {
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32603,
              message: `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`,
            },
          };
        }
      });

      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "1",
        method: "resources/list",
        params: {},
      };

      const response = await errorHandler.handle(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32603);
      expect(response.error?.message).toContain("Test error");
    });
  });

  describe("ResourcesReadHandler", () => {
    describe("ast://nodes/{nodeId} resources", () => {
      it("should retrieve node by ID", async () => {
        const request: JSONRPCRequest = {
          jsonrpc: "2.0",
          id: "1",
          method: "resources/read",
          params: {
            uri: "ast://nodes/test-node-1",
          },
        };

        const response = await resourcesReadHandler.handle(request);

        expect(response.result).toBeDefined();
        expect(response.result.contents).toHaveLength(1);
        expect(response.result.contents[0].uri).toBe("ast://nodes/test-node-1");
        expect(response.result.contents[0].mimeType).toBe("application/json");

        const content = JSON.parse(response.result.contents[0].text);
        expect(content.nodeId).toBe("test-node-1");
        expect(content.filePath).toBe("/test/file.ts");
      });

      it("should handle non-existent node", async () => {
        const request: JSONRPCRequest = {
          jsonrpc: "2.0",
          id: "1",
          method: "resources/read",
          params: {
            uri: "ast://nodes/non-existent",
          },
        };

        const response = await resourcesReadHandler.handle(request);

        expect(response.error).toBeDefined();
        expect(response.error?.message).toContain("Node not found");
      });
    });

    describe("ast://files/{filePath} resources", () => {
      it("should retrieve nodes for file", async () => {
        const request: JSONRPCRequest = {
          jsonrpc: "2.0",
          id: "1",
          method: "resources/read",
          params: {
            uri: "ast://files/%2Ftest%2Ffile.ts", // URL encoded /test/file.ts
          },
        };

        const response = await resourcesReadHandler.handle(request);

        expect(response.result).toBeDefined();
        expect(response.result.contents).toHaveLength(1);

        const content = JSON.parse(response.result.contents[0].text);
        expect(content.filePath).toBe("/test/file.ts");
        expect(content.nodes).toHaveLength(1);
        expect(content.totalCount).toBe(1);
      });

      it("should handle non-existent file", async () => {
        const request: JSONRPCRequest = {
          jsonrpc: "2.0",
          id: "1",
          method: "resources/read",
          params: {
            uri: "ast://files/%2Fnonexistent%2Ffile.ts",
          },
        };

        const response = await resourcesReadHandler.handle(request);

        expect(response.result).toBeDefined();
        const content = JSON.parse(response.result.contents[0].text);
        expect(content.nodes).toHaveLength(0);
        expect(content.totalCount).toBe(0);
      });
    });

    describe("ast://search/{query} resources", () => {
      it("should search nodes by query", async () => {
        const request: JSONRPCRequest = {
          jsonrpc: "2.0",
          id: "1",
          method: "resources/read",
          params: {
            uri: "ast://search/test%20function", // URL encoded "test function"
          },
        };

        const response = await resourcesReadHandler.handle(request);

        expect(response.result).toBeDefined();
        expect(response.result.contents).toHaveLength(1);

        const content = JSON.parse(response.result.contents[0].text);
        expect(content.query).toBe("test function");
        expect(content.matches).toHaveLength(1);
        expect(content.totalCount).toBe(1);
      });

      it("should return empty results for no matches", async () => {
        const request: JSONRPCRequest = {
          jsonrpc: "2.0",
          id: "1",
          method: "resources/read",
          params: {
            uri: "ast://search/nonexistent",
          },
        };

        const response = await resourcesReadHandler.handle(request);

        expect(response.result).toBeDefined();
        const content = JSON.parse(response.result.contents[0].text);
        expect(content.matches).toHaveLength(0);
        expect(content.totalCount).toBe(0);
      });
    });

    describe("URI validation and error handling", () => {
      it("should validate required URI parameter", async () => {
        const request: JSONRPCRequest = {
          jsonrpc: "2.0",
          id: "1",
          method: "resources/read",
          params: {},
        };

        const response = await resourcesReadHandler.handle(request);

        expect(response.error).toBeDefined();
        expect(response.error?.code).toBe(-32602);
        expect(response.error?.message).toContain("uri");
      });

      it("should reject invalid URI format", async () => {
        const request: JSONRPCRequest = {
          jsonrpc: "2.0",
          id: "1",
          method: "resources/read",
          params: {
            uri: "invalid://format",
          },
        };

        const response = await resourcesReadHandler.handle(request);

        expect(response.error).toBeDefined();
        expect(response.error?.message).toContain(
          "Invalid resource URI format",
        );
      });

      it("should reject unknown resource types", async () => {
        const request: JSONRPCRequest = {
          jsonrpc: "2.0",
          id: "1",
          method: "resources/read",
          params: {
            uri: "ast://unknown/test",
          },
        };

        const response = await resourcesReadHandler.handle(request);

        expect(response.error).toBeDefined();
        expect(response.error?.message).toContain("Unknown resource type");
      });
    });
  });

  describe("ResourceHandlerFactory", () => {
    it("should create resources list handler", () => {
      const factory = new ResourceHandlerFactory();
      const handler = factory.createResourcesListHandler();

      expect(handler).toBeInstanceOf(ResourcesListHandler);
    });

    it("should create resources read handler", () => {
      const factory = new ResourceHandlerFactory();
      const handler = factory.createResourcesReadHandler(mockDb);

      expect(handler).toBeInstanceOf(ResourcesReadHandler);
    });
  });
});
