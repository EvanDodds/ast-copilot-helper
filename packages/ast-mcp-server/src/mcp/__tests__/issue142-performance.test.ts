/**
 * Performance tests for Issue #142 - MCP Resources Enhancement
 * Tests response times, caching, and resource serving performance
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ResourcesReadHandler } from "../resources.js";
import { MockDatabaseReader } from "../../database/mock-reader.js";
import type { JSONRPCRequest } from "../protocol.js";

describe("Issue #142 Performance Tests", () => {
  let readHandler: ResourcesReadHandler;
  let mockDb: MockDatabaseReader;

  beforeEach(() => {
    mockDb = new MockDatabaseReader("/tmp/test-db");
    readHandler = new ResourcesReadHandler(mockDb);
  });

  describe("Response Time Requirements", () => {
    it("should serve node resources within 200ms target", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: {
          uri: "ast://nodes/test-node-1",
        },
      };

      const startTime = Date.now();
      const response = await readHandler.handle(request);
      const responseTime = Date.now() - startTime;

      expect(response.error).toBeUndefined();
      expect(responseTime).toBeLessThan(200); // Target performance requirement
    });

    it("should serve file resources within 200ms target", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "resources/read",
        params: {
          uri: "ast://files/test.ts",
        },
      };

      const startTime = Date.now();
      const response = await readHandler.handle(request);
      const responseTime = Date.now() - startTime;

      expect(response.error).toBeUndefined();
      expect(responseTime).toBeLessThan(200);
    });

    it("should serve search resources within 200ms target", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: 3,
        method: "resources/read",
        params: {
          uri: "ast://search/test query",
        },
      };

      const startTime = Date.now();
      const response = await readHandler.handle(request);
      const responseTime = Date.now() - startTime;

      expect(response.error).toBeUndefined();
      expect(responseTime).toBeLessThan(200);
    });

    it("should serve changes resources within 200ms target", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: 4,
        method: "resources/read",
        params: {
          uri: "ast://changes/day",
        },
      };

      const startTime = Date.now();
      const response = await readHandler.handle(request);
      const responseTime = Date.now() - startTime;

      expect(response.error).toBeUndefined();
      expect(responseTime).toBeLessThan(200);
    });
  });

  describe("Caching Performance", () => {
    it("should cache responses for faster subsequent requests", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: {
          uri: "ast://nodes/cached-test-node",
        },
      };

      // First request - cache miss
      const startTime1 = Date.now();
      const response1 = await readHandler.handle(request);
      const responseTime1 = Date.now() - startTime1;

      expect(response1.error).toBeUndefined();

      // Second request - should be faster due to cache hit
      const startTime2 = Date.now();
      const response2 = await readHandler.handle(request);
      const responseTime2 = Date.now() - startTime2;

      expect(response2.error).toBeUndefined();
      expect(responseTime2).toBeLessThan(responseTime1); // Cache should be faster
      expect(responseTime2).toBeLessThan(50); // Cache hits should be very fast

      // Verify responses are identical
      expect(response1.result).toEqual(response2.result);
    });

    it("should manage cache size to prevent memory leaks", async () => {
      const initialStats = readHandler.getCacheStats();
      expect(initialStats.size).toBe(0);

      // Make several requests to populate cache
      for (let i = 0; i < 5; i++) {
        const request: JSONRPCRequest = {
          jsonrpc: "2.0",
          id: i,
          method: "resources/read",
          params: {
            uri: `ast://nodes/cache-test-${i}`,
          },
        };
        await readHandler.handle(request);
      }

      const statsAfter = readHandler.getCacheStats();
      expect(statsAfter.size).toBe(5);

      // Clear cache
      readHandler.clearCache();
      const statsAfterClear = readHandler.getCacheStats();
      expect(statsAfterClear.size).toBe(0);
    });
  });

  describe("Load Testing", () => {
    it("should handle concurrent requests efficiently", async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: "2.0" as const,
        id: i,
        method: "resources/read" as const,
        params: {
          uri: `ast://nodes/concurrent-test-${i}`,
        },
      }));

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map((request) => readHandler.handle(request)),
      );
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.error).toBeUndefined();
      });

      // Average response time should still be reasonable
      const avgResponseTime = totalTime / requests.length;
      expect(avgResponseTime).toBeLessThan(300); // Allow some overhead for concurrency
    });

    it("should maintain performance with mixed resource types", async () => {
      const mixedRequests = [
        { uri: "ast://nodes/mixed-test-1" },
        { uri: "ast://files/mixed-test.ts" },
        { uri: "ast://search/mixed test query" },
        { uri: "ast://changes/hour" },
        { uri: "ast://stats/server" },
      ].map((params, i) => ({
        jsonrpc: "2.0" as const,
        id: i,
        method: "resources/read" as const,
        params,
      }));

      const startTime = Date.now();
      const responses = await Promise.all(
        mixedRequests.map((request) => readHandler.handle(request)),
      );
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.error).toBeUndefined();
      });

      // Total time should be reasonable
      expect(totalTime).toBeLessThan(1000); // 1 second for 5 mixed requests
    });
  });

  describe("Memory Usage", () => {
    it("should not create memory leaks with repeated requests", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: {
          uri: "ast://nodes/memory-test",
        },
      };

      // Make many requests to the same resource
      for (let i = 0; i < 100; i++) {
        const response = await readHandler.handle(request);
        expect(response.error).toBeUndefined();
      }

      // Cache should only have one entry for this resource
      const cacheStats = readHandler.getCacheStats();
      expect(cacheStats.size).toBe(1);
    });
  });
});
