/**
 * Mock Database Reader for CLI testing
 * Temporary implementation for testing CLI functionality without full database integration
 */

import type {
  DatabaseReader,
  ASTNode,
  ASTNodeMatch,
  QueryOptions,
} from "../types";

/**
 * Mock implementation of DatabaseReader for CLI testing
 */
export class MockDatabaseReader implements DatabaseReader {
  private databasePath: string;

  constructor(databasePath: string) {
    this.databasePath = databasePath;
  }

  async initialize(): Promise<void> {
    // Mock initialization - just check if path exists
    try {
      const { access } = await import("fs/promises");
      await access(this.databasePath);
    } catch (_error) {
      // Expected - malformed query
    }
  }

  async close(): Promise<void> {
    // Mock close - nothing to cleanup
  }

  async queryByIntent(
    _intent: string,
    _options?: QueryOptions,
  ): Promise<ASTNodeMatch[]> {
    // Mock query - return empty results
    return [];
  }

  async getNodeById(_nodeId: string): Promise<ASTNode | null> {
    // Mock get node - return null
    return null;
  }

  async getChildNodes(_nodeId: string): Promise<ASTNode[]> {
    // Mock get children - return empty array
    return [];
  }

  async getFileNodes(_filePath: string): Promise<ASTNode[]> {
    // Mock file nodes - return empty array
    return [];
  }

  async getRecentChanges(
    _since: Date | string,
    _options?: QueryOptions,
  ): Promise<ASTNode[]> {
    // Mock recent changes - return empty array
    return [];
  }

  async searchNodes(
    _query: string,
    _options?: QueryOptions,
  ): Promise<ASTNodeMatch[]> {
    // Mock search - return empty results
    return [];
  }

  async isIndexReady(): Promise<boolean> {
    // Mock index ready - return true
    return true;
  }

  async getIndexStats(): Promise<{
    nodeCount: number;
    fileCount: number;
    lastUpdated: Date;
  }> {
    // Mock stats
    return {
      nodeCount: 0,
      fileCount: 0,
      lastUpdated: new Date(),
    };
  }
}
