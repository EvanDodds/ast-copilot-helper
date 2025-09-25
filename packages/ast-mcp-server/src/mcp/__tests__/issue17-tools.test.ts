/**
 * Test to verify Issue #17 specific tools are implemented and working
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Issue17ToolRegistry } from "../issue17-tools.js";
import type { DatabaseReader } from "../../types.js";

// Mock DatabaseReader for testing
const mockDatabaseReader: DatabaseReader = {
  initialize: () => Promise.resolve(),
  close: () => Promise.resolve(),
  queryByIntent: () => Promise.resolve([]),
  getNodeById: () => Promise.resolve(null),
  getChildNodes: () => Promise.resolve([]),
  getFileNodes: () => Promise.resolve([]),
  searchNodes: () => Promise.resolve([]),
  getRecentChanges: () => Promise.resolve([]),
  isIndexReady: () => Promise.resolve(true),
  getIndexStats: () =>
    Promise.resolve({
      nodeCount: 100,
      fileCount: 10,
      lastUpdated: new Date(),
    }),
};

describe("Issue #17 Tool Registry", () => {
  let toolRegistry: Issue17ToolRegistry;

  beforeEach(() => {
    toolRegistry = new Issue17ToolRegistry(mockDatabaseReader);
  });

  describe("Tool Registration", () => {
    it("should register all 5 required tools", () => {
      const toolNames = toolRegistry.getToolNames();
      const expectedTools = [
        "search-similar",
        "search-signature",
        "get-annotation",
        "list-files",
        "get-file-stats",
      ];

      expect(toolNames).toEqual(expectedTools);
    });

    it("should provide tool definitions for all tools", () => {
      const definitions = toolRegistry.getAllToolDefinitions();
      expect(definitions).toHaveLength(5);

      // Check that each tool has proper schema
      definitions.forEach((def) => {
        expect(def.name).toBeDefined();
        expect(def.description).toBeDefined();
        expect(def.inputSchema).toBeDefined();
        expect(def.inputSchema.type).toBe("object");
        expect(def.inputSchema.properties).toBeDefined();
      });
    });

    it("should retrieve handlers for each tool", () => {
      const expectedTools = [
        "search-similar",
        "search-signature",
        "get-annotation",
        "list-files",
        "get-file-stats",
      ];

      expectedTools.forEach((toolName) => {
        const handler = toolRegistry.getHandler(toolName);
        expect(handler).toBeTruthy();
      });
    });
  });

  describe("Tool Definitions Compliance", () => {
    it("should have search-similar tool with correct schema", () => {
      const handler = toolRegistry.getHandler("search-similar");
      expect(handler).toBeTruthy();

      const definitions = toolRegistry.getAllToolDefinitions();
      const searchSimilarDef = definitions.find(
        (def) => def.name === "search-similar",
      );

      expect(searchSimilarDef).toBeDefined();
      expect(searchSimilarDef?.description).toContain("similar");
      expect(searchSimilarDef?.inputSchema.properties?.text).toBeDefined();
      expect(searchSimilarDef?.inputSchema.required).toContain("text");
    });

    it("should have search-signature tool with correct schema", () => {
      const handler = toolRegistry.getHandler("search-signature");
      expect(handler).toBeTruthy();

      const definitions = toolRegistry.getAllToolDefinitions();
      const searchSignatureDef = definitions.find(
        (def) => def.name === "search-signature",
      );

      expect(searchSignatureDef).toBeDefined();
      expect(searchSignatureDef?.description).toContain("signature");
      expect(
        searchSignatureDef?.inputSchema.properties?.signature,
      ).toBeDefined();
      expect(searchSignatureDef?.inputSchema.required).toContain("signature");
    });

    it("should have get-annotation tool with correct schema", () => {
      const handler = toolRegistry.getHandler("get-annotation");
      expect(handler).toBeTruthy();

      const definitions = toolRegistry.getAllToolDefinitions();
      const getAnnotationDef = definitions.find(
        (def) => def.name === "get-annotation",
      );

      expect(getAnnotationDef).toBeDefined();
      expect(getAnnotationDef?.description).toContain("annotation");
      expect(getAnnotationDef?.inputSchema.properties?.id).toBeDefined();
      expect(getAnnotationDef?.inputSchema.required).toContain("id");
    });

    it("should have list-files tool with correct schema", () => {
      const handler = toolRegistry.getHandler("list-files");
      expect(handler).toBeTruthy();

      const definitions = toolRegistry.getAllToolDefinitions();
      const listFilesDef = definitions.find((def) => def.name === "list-files");

      expect(listFilesDef).toBeDefined();
      expect(listFilesDef?.description).toContain("files");
      expect(listFilesDef?.inputSchema.required).toEqual([]);
    });

    it("should have get-file-stats tool with correct schema", () => {
      const handler = toolRegistry.getHandler("get-file-stats");
      expect(handler).toBeTruthy();

      const definitions = toolRegistry.getAllToolDefinitions();
      const getFileStatsDef = definitions.find(
        (def) => def.name === "get-file-stats",
      );

      expect(getFileStatsDef).toBeDefined();
      expect(getFileStatsDef?.description).toContain("statistics");
      expect(getFileStatsDef?.inputSchema.required).toEqual([]);
    });
  });

  describe("Tool Handler Execution", () => {
    it("should handle search-similar requests", async () => {
      const handler = toolRegistry.getHandler("search-similar");
      expect(handler).toBeTruthy();

      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "search-similar",
        params: {
          text: "test query",
        },
      };

      const response = await handler!.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
    });

    it("should handle search-signature requests", async () => {
      const handler = toolRegistry.getHandler("search-signature");
      expect(handler).toBeTruthy();

      const request = {
        jsonrpc: "2.0" as const,
        id: 2,
        method: "search-signature",
        params: {
          signature: "function test()",
        },
      };

      const response = await handler!.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(2);
      expect(response.result).toBeDefined();
    });

    it("should handle get-annotation requests", async () => {
      const handler = toolRegistry.getHandler("get-annotation");
      expect(handler).toBeTruthy();

      const request = {
        jsonrpc: "2.0" as const,
        id: 3,
        method: "get-annotation",
        params: {
          id: "test-id",
        },
      };

      const response = await handler!.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(3);
      // This should return an error since the node doesn't exist in our mock
      expect(response.error).toBeDefined();
    });

    it("should handle list-files requests", async () => {
      const handler = toolRegistry.getHandler("list-files");
      expect(handler).toBeTruthy();

      const request = {
        jsonrpc: "2.0" as const,
        id: 4,
        method: "list-files",
        params: {},
      };

      const response = await handler!.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(4);
      expect(response.result).toBeDefined();
    });

    it("should handle get-file-stats requests", async () => {
      const handler = toolRegistry.getHandler("get-file-stats");
      expect(handler).toBeTruthy();

      const request = {
        jsonrpc: "2.0" as const,
        id: 5,
        method: "get-file-stats",
        params: {},
      };

      const response = await handler!.handle(request);
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(5);
      expect(response.result).toBeDefined();
    });
  });
});
