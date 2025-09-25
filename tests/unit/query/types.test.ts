/**
 * @fileoverview Tests for query system type definitions
 */

import { describe, it, expect } from "vitest";
import type {
  MCPQuery,
  QueryResponse,
  AnnotationMatch,
  QueryOptions,
  QueryContext,
  SemanticQueryOptions,
  SignatureQueryOptions,
  FileQueryOptions,
  QueryMetadata,
  QueryStats,
  MCPResponse,
  BatchQueryRequest,
  QuerySystemConfig,
} from "../../../packages/ast-mcp-server/src/query/types.js";

describe("Query System Types", () => {
  it("should define MCPQuery with required properties", () => {
    const query: MCPQuery = {
      type: "semantic",
      text: "find function that handles user authentication",
    };

    expect(query.type).toBe("semantic");
    expect(query.text).toBe("find function that handles user authentication");
  });

  it("should define MCPQuery with optional properties", () => {
    const query: MCPQuery = {
      type: "semantic",
      text: "find function that handles user authentication",
      options: {
        fileFilter: ["src/**/*.ts"],
        languageFilter: ["typescript"],
        confidenceThreshold: 0.8,
        includePrivate: false,
        rankingMode: "relevance",
      },
      context: {
        currentFile: "src/auth/auth.service.ts",
        cursorPosition: 42,
        selectedText: "authenticateUser",
        recentFiles: ["src/auth/auth.service.ts", "src/user/user.model.ts"],
      },
      maxResults: 20,
      minScore: 0.7,
    };

    expect(query.options?.fileFilter).toEqual(["src/**/*.ts"]);
    expect(query.context?.currentFile).toBe("src/auth/auth.service.ts");
    expect(query.maxResults).toBe(20);
    expect(query.minScore).toBe(0.7);
  });

  it("should define QueryResponse structure correctly", () => {
    const response: QueryResponse = {
      results: [
        {
          annotation: {
            nodeId: "node_123",
            signature:
              "authenticateUser(username: string, password: string): Promise<User>",
            summary: "Authenticates a user with username and password",
            filePath: "src/auth/auth.service.ts",
            lineNumber: 25,
            language: "typescript",
            confidence: 0.95,
            lastUpdated: new Date(),
          },
          score: 0.89,
          matchReason: "High semantic similarity to query text",
          contextSnippet:
            "export class AuthService {\n  async authenticateUser(...)",
          relatedMatches: ["node_124", "node_125"],
        },
      ],
      totalMatches: 5,
      queryTime: 145,
      searchStrategy: "semantic_vector_search",
      metadata: {
        vectorSearchTime: 45,
        rankingTime: 32,
        totalCandidates: 50,
        appliedFilters: ["confidence_threshold", "file_filter"],
        searchParameters: {
          embedding: "codebert-base",
          similarity: "cosine",
          k: 50,
          ef: 100,
        },
      },
    };

    expect(response.results).toHaveLength(1);
    expect(response.queryTime).toBe(145);
    expect(response.searchStrategy).toBe("semantic_vector_search");
    expect(response.metadata.vectorSearchTime).toBe(45);
    expect(response.results[0].score).toBe(0.89);
  });

  it("should define semantic query options with HNSW parameters", () => {
    const options: SemanticQueryOptions = {
      fileFilter: ["src/**/*.ts"],
      confidenceThreshold: 0.8,
      rankingMode: "relevance",
      searchEf: 200,
      useContextBoosting: true,
      includeSimilarResults: true,
    };

    expect(options.searchEf).toBe(200);
    expect(options.useContextBoosting).toBe(true);
    expect(options.includeSimilarResults).toBe(true);
  });

  it("should define signature query options correctly", () => {
    const options: SignatureQueryOptions = {
      exactMatch: true,
      fuzzyThreshold: 0.9,
      includeReturnType: true,
      languageFilter: ["typescript", "javascript"],
    };

    expect(options.exactMatch).toBe(true);
    expect(options.fuzzyThreshold).toBe(0.9);
    expect(options.includeReturnType).toBe(true);
  });

  it("should define file query options correctly", () => {
    const options: FileQueryOptions = {
      recursive: true,
      includeHidden: false,
      maxDepth: 3,
      fileFilter: ["**/*.ts", "**/*.js"],
    };

    expect(options.recursive).toBe(true);
    expect(options.includeHidden).toBe(false);
    expect(options.maxDepth).toBe(3);
  });

  it("should define MCP response format for protocol compliance", () => {
    const mcpResponse: MCPResponse = {
      type: "query_response",
      data: {
        matches: [
          {
            id: "node_123",
            signature:
              "authenticateUser(username: string, password: string): Promise<User>",
            summary: "Authenticates a user with username and password",
            filePath: "src/auth/auth.service.ts",
            lineNumber: 25,
            score: 0.89,
            matchReason: "High semantic similarity to query text",
            context:
              "export class AuthService {\n  async authenticateUser(...)",
          },
        ],
        metadata: {
          totalMatches: 5,
          queryTime: 145,
          strategy: "semantic_vector_search",
        },
      },
    };

    expect(mcpResponse.type).toBe("query_response");
    expect(mcpResponse.data.matches).toHaveLength(1);
    expect(mcpResponse.data.metadata.totalMatches).toBe(5);
  });

  it("should define batch query request structure", () => {
    const batchRequest: BatchQueryRequest = {
      queries: [
        {
          type: "semantic",
          text: "authentication function",
        },
        {
          type: "signature",
          text: "authenticateUser",
        },
      ],
      options: {
        maxConcurrency: 5,
        failOnError: false,
        timeoutMs: 30000,
      },
    };

    expect(batchRequest.queries).toHaveLength(2);
    expect(batchRequest.options?.maxConcurrency).toBe(5);
    expect(batchRequest.options?.failOnError).toBe(false);
  });

  it("should define query system configuration structure", () => {
    const config: QuerySystemConfig = {
      cache: {
        maxSize: 1000,
        defaultTTL: 300000, // 5 minutes
        cleanupInterval: 60000, // 1 minute
        enabled: true,
      },
      performance: {
        maxQueryTime: 200,
        maxMemoryUsage: 500 * 1024 * 1024, // 500MB
        maxConcurrentQueries: 10,
      },
      ranking: {
        defaultMode: "relevance",
        contextBoostFactor: 0.3,
        confidenceWeight: 0.2,
        recencyWeight: 0.1,
        diversityThreshold: 0.8,
      },
      search: {
        defaultMaxResults: 20,
        defaultMinScore: 0.5,
        defaultSearchEf: 100,
      },
    };

    expect(config.cache.maxSize).toBe(1000);
    expect(config.performance.maxQueryTime).toBe(200);
    expect(config.ranking.defaultMode).toBe("relevance");
    expect(config.search.defaultMaxResults).toBe(20);
  });

  it("should handle query stats structure for monitoring", () => {
    const stats: QueryStats = {
      totalQueries: 1234,
      averageQueryTime: 156.7,
      queryTypeBreakdown: {
        semantic: 800,
        signature: 300,
        file: 100,
        contextual: 34,
      },
      cacheHitRatio: 0.73,
      errorRate: 0.02,
      performanceMetrics: {
        p50QueryTime: 120,
        p95QueryTime: 280,
        p99QueryTime: 450,
        memoryUsage: 256 * 1024 * 1024,
        peakMemoryUsage: 380 * 1024 * 1024,
        concurrentQueries: 3,
      },
    };

    expect(stats.totalQueries).toBe(1234);
    expect(stats.queryTypeBreakdown.semantic).toBe(800);
    expect(stats.cacheHitRatio).toBe(0.73);
    expect(stats.performanceMetrics.p95QueryTime).toBe(280);
  });
});
