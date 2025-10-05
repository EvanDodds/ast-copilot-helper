/**
 * Test to verify Issue #17 resources are implemented and working
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ResourcesListHandler,
  ResourcesReadHandler,
  MCP_RESOURCES,
} from "../resources.js";
import type { DatabaseReader } from "../../types.js";

// Mock DatabaseReader for testing
const mockDatabaseReader: DatabaseReader = {
  initialize: () => Promise.resolve(),
  close: () => Promise.resolve(),
  queryByIntent: () => Promise.resolve([]),
  getNodeById: (id: string) => {
    if (id === "test-node") {
      return Promise.resolve({
        nodeId: "test-node",
        filePath: "/test/file.ts",
        signature: "function test()",
        summary: "Test function",
        nodeType: "FunctionDeclaration",
        startLine: 1,
        endLine: 3,
        sourceSnippet: "function test() {\n  return true;\n}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return Promise.resolve(null);
  },
  getChildNodes: () => Promise.resolve([]),
  getFileNodes: () =>
    Promise.resolve([
      {
        nodeId: "file-node-1",
        filePath: "/test/file.ts",
        signature: "export function example()",
        summary: "Example function",
        nodeType: "FunctionDeclaration",
        startLine: 5,
        endLine: 7,
        sourceSnippet: "export function example() {\n  return false;\n}",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
  searchNodes: () => Promise.resolve([]),
  getRecentChanges: () => Promise.resolve([]),
  isIndexReady: () => Promise.resolve(true),
  getIndexStats: () =>
    Promise.resolve({
      nodeCount: 150,
      fileCount: 15,
      lastUpdated: new Date(),
    }),
};

describe("Issue #17 Resources Implementation", () => {
  let listHandler: ResourcesListHandler;
  let readHandler: ResourcesReadHandler;

  beforeEach(() => {
    listHandler = new ResourcesListHandler();
    readHandler = new ResourcesReadHandler(mockDatabaseReader);
  });

  describe("Resource List Handler", () => {
    it("should list all required resources including system stats", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "resources/list",
        params: {},
      };

      const response = await listHandler.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();

      const resources = (response.result as any).resources;
      expect(resources).toHaveLength(6);

      // Check that all Issue #17 required resources are present
      const resourceUris = resources.map((r: any) => r.uri);
      expect(resourceUris).toContain("ast://nodes/{nodeId}");
      expect(resourceUris).toContain("ast://files/{filePath}");
      expect(resourceUris).toContain("ast://stats/server");
      expect(resourceUris).toContain("ast://stats/index");
    });

    it("should include proper resource definitions", () => {
      expect(MCP_RESOURCES).toHaveLength(6);

      MCP_RESOURCES.forEach((resource) => {
        expect(resource.uri).toBeDefined();
        expect(resource.name).toBeDefined();
        expect(resource.description).toBeDefined();
        expect(resource.mimeType).toBe("application/json");
      });
    });
  });

  describe("Resource Read Handler - Annotation Details", () => {
    it("should read annotation detail resources (ast://nodes/{nodeId})", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 2,
        method: "resources/read",
        params: {
          uri: "ast://nodes/test-node",
        },
      };

      const response = await readHandler.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(2);
      expect(response.result).toBeDefined();

      const result = response.result as any;
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("ast://nodes/test-node");
      expect(result.contents[0].mimeType).toBe("application/json");

      const content = JSON.parse(result.contents[0].text);
      expect(content.nodeId).toBe("test-node");
      expect(content.signature).toBe("function test()");
      expect(content.nodeType).toBe("FunctionDeclaration");
    });

    it("should handle non-existent annotation resources", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 3,
        method: "resources/read",
        params: {
          uri: "ast://nodes/non-existent",
        },
      };

      const response = await readHandler.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(3);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Node not found");
    });
  });

  describe("Resource Read Handler - File Content", () => {
    it("should read file content resources (ast://files/{filePath})", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 4,
        method: "resources/read",
        params: {
          uri: "ast://files/test.ts",
        },
      };

      const response = await readHandler.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(4);
      expect(response.result).toBeDefined();

      const result = response.result as any;
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("ast://files/test.ts");

      const content = JSON.parse(result.contents[0].text);
      expect(content.filePath).toBe("test.ts");
      expect(content.structure).toBeDefined();
      expect(content.structure.totalNodes).toBe(1);
      expect(content.statistics.totalNodes).toBe(1);
    });
  });

  describe("Resource Read Handler - System Statistics", () => {
    it("should read server statistics resources (ast://stats/server)", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 5,
        method: "resources/read",
        params: {
          uri: "ast://stats/server",
        },
      };

      const response = await readHandler.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(5);
      expect(response.result).toBeDefined();

      const result = response.result as any;
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("ast://stats/server");

      const content = JSON.parse(result.contents[0].text);
      expect(content.type).toBe("server");
      expect(content.uptime).toBeGreaterThanOrEqual(0);
      expect(content.memoryUsage).toBeDefined();
      expect(content.processInfo).toBeDefined();
      expect(content.processInfo.pid).toBeDefined();
      expect(content.timestamp).toBeDefined();
    });

    it("should read index statistics resources (ast://stats/index)", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 6,
        method: "resources/read",
        params: {
          uri: "ast://stats/index",
        },
      };

      const response = await readHandler.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(6);
      expect(response.result).toBeDefined();

      const result = response.result as any;
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("ast://stats/index");

      const content = JSON.parse(result.contents[0].text);
      expect(content.type).toBe("index");
      expect(content.ready).toBe(true);
      expect(content.nodeCount).toBe(150);
      expect(content.fileCount).toBe(15);
      expect(content.lastUpdated).toBeDefined();
      expect(content.timestamp).toBeDefined();
    });

    it("should handle invalid stats type", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 7,
        method: "resources/read",
        params: {
          uri: "ast://stats/invalid",
        },
      };

      const response = await readHandler.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(7);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Unknown stats type");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid URI format", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 8,
        method: "resources/read",
        params: {
          uri: "invalid://uri/format",
        },
      };

      const response = await readHandler.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(8);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain("Invalid resource URI format");
    });

    it("should handle missing parameters", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 9,
        method: "resources/read",
        params: {},
      };

      const response = await readHandler.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(9);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // MCPErrorCode.INVALID_PARAMS
    });
  });
});
