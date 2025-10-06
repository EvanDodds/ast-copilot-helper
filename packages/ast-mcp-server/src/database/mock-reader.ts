/**
 * Mock Database Reader for testing
 */

import type {
  DatabaseReader,
  ASTNode,
  ASTNodeMatch,
  QueryOptions,
} from "../types";

export class MockDatabaseReader implements DatabaseReader {
  private mockNodes: ASTNode[] = [];
  private mockMatches: ASTNodeMatch[] = [];
  private accessCount = new Map<string, number>();

  constructor(_databasePath: string) {
    this.setupDefaultTestData();
  }

  private setupDefaultTestData(): void {
    const testNodes: ASTNode[] = [];
    const testMatches: ASTNodeMatch[] = [];

    // Add standard test nodes
    const standardNodes = [
      { nodeId: "test-node-1", name: "testFunction" },
      { nodeId: "cached-test-node", name: "cachedFunction" },
      { nodeId: "memory-test", name: "memoryTest" },
    ];

    standardNodes.forEach(({ nodeId, name }) => {
      const node: ASTNode = {
        nodeId,
        filePath: `${nodeId}.ts`,
        signature: `function ${name}()`,
        summary: `A ${name} function for testing`,
        nodeType: "function",
        startLine: 1,
        endLine: 10,
        sourceSnippet: `function ${name}() { return "test"; }`,
        parentId: undefined,
        metadata: { complexity: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      testNodes.push(node);
      testMatches.push({
        ...node,
        score: 0.9,
        matchReason: "Standard test match",
      });
    });

    // Add concurrent test nodes
    for (let i = 0; i < 10; i++) {
      const node: ASTNode = {
        nodeId: `concurrent-test-${i}`,
        filePath: `concurrent-test-${i}.ts`,
        signature: `function concurrentTest${i}()`,
        summary: `Concurrent test function ${i}`,
        nodeType: "function",
        startLine: 1,
        endLine: 10,
        sourceSnippet: `function concurrentTest${i}() { return ${i}; }`,
        parentId: undefined,
        metadata: { complexity: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      testNodes.push(node);
      testMatches.push({
        ...node,
        score: 0.8,
        matchReason: "Concurrent test match",
      });
    }

    // Add mixed test nodes
    for (let i = 0; i < 5; i++) {
      const node: ASTNode = {
        nodeId: `mixed-test-${i}`,
        filePath: `mixed-test-${i}.ts`,
        signature: `function mixedTest${i}()`,
        summary: `Mixed test function ${i}`,
        nodeType: "function",
        startLine: 1,
        endLine: 10,
        sourceSnippet: `function mixedTest${i}() { return ${i}; }`,
        parentId: undefined,
        metadata: { complexity: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      testNodes.push(node);
      testMatches.push({
        ...node,
        score: 0.7,
        matchReason: "Mixed test match",
      });
    }

    // Add cache test nodes
    for (let i = 0; i < 10; i++) {
      const node: ASTNode = {
        nodeId: `cache-test-${i}`,
        filePath: `cache-test-${i}.ts`,
        signature: `function cacheTest${i}()`,
        summary: `Cache test function ${i}`,
        nodeType: "function",
        startLine: 1,
        endLine: 10,
        sourceSnippet: `function cacheTest${i}() { return ${i}; }`,
        parentId: undefined,
        metadata: { complexity: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      testNodes.push(node);
      testMatches.push({
        ...node,
        score: 0.8,
        matchReason: "Cache test match",
      });
    }

    this.mockNodes = testNodes;
    this.mockMatches = testMatches;
  }

  async initialize(): Promise<void> {
    // Mock initialization - no setup needed
  }

  async close(): Promise<void> {
    // Mock close - no cleanup needed
  }

  async queryByIntent(
    _intent: string,
    options?: QueryOptions,
  ): Promise<ASTNodeMatch[]> {
    const maxResults = options?.maxResults || 10;
    return this.mockMatches.slice(0, maxResults);
  }

  async getNodeById(nodeId: string): Promise<ASTNode | null> {
    // Simulate database delay for first access to test caching
    const accessCount = this.accessCount.get(nodeId) || 0;
    this.accessCount.set(nodeId, accessCount + 1);

    if (accessCount === 0) {
      // First access - simulate slower database lookup
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return this.mockNodes.find((n) => n.nodeId === nodeId) || null;
  }

  async getChildNodes(_nodeId: string): Promise<ASTNode[]> {
    return [];
  }

  async getFileNodes(filePath: string): Promise<ASTNode[]> {
    return this.mockNodes.filter((n) => n.filePath === filePath);
  }

  async searchNodes(
    _query: string,
    options?: QueryOptions,
  ): Promise<ASTNodeMatch[]> {
    const maxResults = options?.maxResults || 10;
    return this.mockMatches.slice(0, maxResults);
  }

  async getRecentChanges(
    since: Date | string,
    options?: QueryOptions,
  ): Promise<ASTNode[]> {
    const sinceDate = typeof since === "string" ? new Date(since) : since;
    const maxResults = options?.maxResults || 10;
    return this.mockNodes
      .filter((n) => n.updatedAt > sinceDate)
      .slice(0, maxResults);
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
}
