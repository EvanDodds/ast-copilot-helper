import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PerformanceMonitor } from "../../../packages/ast-mcp-server/src/query/performance-monitor";
import {
  MCPQuery,
  QueryResponse,
} from "../../../packages/ast-mcp-server/src/query/types";

describe("PerformanceMonitor", () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    performanceMonitor.clearCaches();
    performanceMonitor.shutdown();
  });

  describe("initialization", () => {
    it("should initialize successfully", () => {
      expect(performanceMonitor).toBeDefined();
      expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
    });
  });

  describe("query response caching", () => {
    it("should cache and retrieve query responses", () => {
      const mockQuery: MCPQuery = {
        type: "semantic",
        text: "test query",
        maxResults: 10,
      };

      const mockResponse: QueryResponse = {
        results: [],
        totalMatches: 0,
        queryTime: 100,
        searchStrategy: "semantic",
        metadata: {
          vectorSearchTime: 50,
          rankingTime: 25,
          totalCandidates: 0,
          appliedFilters: [],
          searchParameters: {},
        },
      };

      performanceMonitor.cacheQueryResponse(mockQuery, mockResponse);
      const cachedResponse =
        performanceMonitor.getCachedQueryResponse(mockQuery);

      expect(cachedResponse).toEqual(mockResponse);
    });

    it("should return null for uncached queries", () => {
      const mockQuery: MCPQuery = {
        type: "semantic",
        text: "uncached query",
        maxResults: 5,
      };

      const cachedResponse =
        performanceMonitor.getCachedQueryResponse(mockQuery);
      expect(cachedResponse).toBeNull();
    });

    it("should generate consistent cache keys", () => {
      const query1: MCPQuery = {
        type: "semantic",
        text: "test",
        maxResults: 10,
      };

      const query2: MCPQuery = {
        type: "semantic",
        text: "test",
        maxResults: 10,
      };

      const key1 = performanceMonitor.generateQueryCacheKey(query1);
      const key2 = performanceMonitor.generateQueryCacheKey(query2);

      expect(key1).toBe(key2);
    });
  });

  describe("embedding caching", () => {
    it("should cache and retrieve embeddings", () => {
      const text = "test embedding text";
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      performanceMonitor.cacheEmbedding(text, embedding);
      const cachedEmbedding = performanceMonitor.getCachedEmbedding(text);

      expect(cachedEmbedding).toEqual(embedding);
    });

    it("should return null for uncached text", () => {
      const cachedEmbedding =
        performanceMonitor.getCachedEmbedding("uncached text");
      expect(cachedEmbedding).toBeNull();
    });
  });

  describe("performance tracking", () => {
    it("should track query performance", () => {
      const mockQuery: MCPQuery = {
        type: "semantic",
        text: "performance test",
        maxResults: 10,
      };

      const queryTime = 150;

      // This should not throw
      expect(() => {
        performanceMonitor.trackQueryPerformance(queryTime, mockQuery);
      }).not.toThrow();
    });

    it("should handle multiple performance tracking calls", () => {
      const mockQuery: MCPQuery = {
        type: "file",
        text: "test.ts",
        maxResults: 20,
      };

      expect(() => {
        performanceMonitor.trackQueryPerformance(100, mockQuery);
        performanceMonitor.trackQueryPerformance(200, mockQuery);
        performanceMonitor.trackQueryPerformance(50, mockQuery);
      }).not.toThrow();
    });
  });

  describe("alerts system", () => {
    it("should retrieve performance alerts", () => {
      const alerts = performanceMonitor.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it("should respect alert limit parameter", () => {
      const alerts = performanceMonitor.getAlerts(5);
      expect(alerts.length).toBeLessThanOrEqual(5);
    });
  });

  describe("cache management", () => {
    it("should clear all caches", () => {
      const mockQuery: MCPQuery = {
        type: "semantic",
        text: "clear test",
        maxResults: 10,
      };

      const mockResponse: QueryResponse = {
        results: [],
        totalMatches: 0,
        queryTime: 100,
        searchStrategy: "semantic",
        metadata: {
          vectorSearchTime: 50,
          rankingTime: 25,
          totalCandidates: 0,
          appliedFilters: [],
          searchParameters: {},
        },
      };

      performanceMonitor.cacheQueryResponse(mockQuery, mockResponse);
      performanceMonitor.cacheEmbedding("test text", [0.1, 0.2]);

      // Verify items are cached
      expect(performanceMonitor.getCachedQueryResponse(mockQuery)).toEqual(
        mockResponse,
      );
      expect(performanceMonitor.getCachedEmbedding("test text")).toEqual([
        0.1, 0.2,
      ]);

      // Clear caches
      performanceMonitor.clearCaches();

      // Verify items are no longer cached
      expect(performanceMonitor.getCachedQueryResponse(mockQuery)).toBeNull();
      expect(performanceMonitor.getCachedEmbedding("test text")).toBeNull();
    });
  });

  describe("lifecycle management", () => {
    it("should shutdown gracefully", () => {
      expect(() => {
        performanceMonitor.shutdown();
      }).not.toThrow();
    });

    it("should handle multiple shutdown calls", () => {
      expect(() => {
        performanceMonitor.shutdown();
        performanceMonitor.shutdown();
      }).not.toThrow();
    });
  });

  describe("cache key generation", () => {
    it("should generate different keys for different query types", () => {
      const semanticQuery: MCPQuery = {
        type: "semantic",
        text: "test",
        maxResults: 10,
      };

      const fileQuery: MCPQuery = {
        type: "file",
        text: "test",
        maxResults: 10,
      };

      const key1 = performanceMonitor.generateQueryCacheKey(semanticQuery);
      const key2 = performanceMonitor.generateQueryCacheKey(fileQuery);

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different maxResults", () => {
      const query1: MCPQuery = {
        type: "semantic",
        text: "test",
        maxResults: 10,
      };

      const query2: MCPQuery = {
        type: "semantic",
        text: "test",
        maxResults: 20,
      };

      const key1 = performanceMonitor.generateQueryCacheKey(query1);
      const key2 = performanceMonitor.generateQueryCacheKey(query2);

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different text content", () => {
      const query1: MCPQuery = {
        type: "semantic",
        text: "hello world",
        maxResults: 10,
      };

      const query2: MCPQuery = {
        type: "semantic",
        text: "goodbye world",
        maxResults: 10,
      };

      const key1 = performanceMonitor.generateQueryCacheKey(query1);
      const key2 = performanceMonitor.generateQueryCacheKey(query2);

      expect(key1).not.toBe(key2);
    });
  });
});
