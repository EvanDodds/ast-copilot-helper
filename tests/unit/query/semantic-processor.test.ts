import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SemanticQueryProcessor } from '../../../packages/ast-mcp-server/src/query/semantic-processor';
import { SemanticQuery } from '../../../packages/ast-mcp-server/src/query/types';
import { ASTDatabaseReader } from '../../../packages/ast-mcp-server/src/database/reader';

// Mock the database reader
vi.mock('../../../packages/ast-mcp-server/src/database/reader');

describe('SemanticQueryProcessor', () => {
  let processor: SemanticQueryProcessor;
  let mockDatabaseReader: any;

  beforeEach(() => {
    mockDatabaseReader = {
      vectorSearch: vi.fn(),
      searchText: vi.fn(),
      searchNodes: vi.fn(),
      isReady: vi.fn().mockReturnValue(true)
    };

    processor = new SemanticQueryProcessor(mockDatabaseReader);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processQuery', () => {
    it('should handle basic semantic queries', async () => {
      const query: SemanticQuery = {
        type: 'semantic',
        text: 'authentication function',
        maxResults: 10
      };

      const mockResults = [
        {
          nodeId: 'node1',
          signature: 'function authenticate(user: User): boolean',
          filePath: '/src/auth.ts',
          lineNumber: 15,
          score: 0.95,
          context: 'User authentication logic'
        }
      ];

      mockDatabaseReader.vectorSearch.mockResolvedValue(mockResults);

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
      expect(result.performance.resultCount).toBeGreaterThanOrEqual(0);
      expect(mockDatabaseReader.vectorSearch).toHaveBeenCalledWith(
        'authentication function',
        expect.objectContaining({
          maxResults: 10
        })
      );
    });

    it('should handle queries with search options', async () => {
      const query: SemanticQuery = {
        type: 'semantic',
        text: 'react hooks',
        maxResults: 20,
        options: {
          searchEf: 200,
          useContextBoosting: true,
          includeSimilarResults: true
        }
      };

      const mockResults = [
        {
          nodeId: 'node1',
          signature: 'const [state, setState] = useState()',
          filePath: '/src/components/Counter.tsx',
          lineNumber: 5,
          score: 0.88,
          context: 'React hook for state management'
        }
      ];

      mockDatabaseReader.vectorSearch.mockResolvedValue(mockResults);

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(mockDatabaseReader.vectorSearch).toHaveBeenCalledWith(
        'react hooks',
        expect.objectContaining({
          maxResults: 20,
          searchEf: 200
        })
      );
    });

    it('should handle language-specific queries', async () => {
      const query: SemanticQuery = {
        type: 'semantic',
        text: 'python class definition',
        language: 'python',
        maxResults: 15
      };

      const mockResults = [
        {
          nodeId: 'node1',
          signature: 'class DatabaseConnection:',
          filePath: '/src/database.py',
          lineNumber: 10,
          score: 0.92,
          context: 'Database connection class'
        }
      ];

      mockDatabaseReader.vectorSearch.mockResolvedValue(mockResults);

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(mockDatabaseReader.vectorSearch).toHaveBeenCalledWith(
        'python class definition',
        expect.objectContaining({
          maxResults: 15,
          language: 'python'
        })
      );
    });

    it('should handle file path filters', async () => {
      const query: SemanticQuery = {
        type: 'semantic',
        text: 'utility functions',
        filePath: '/src/utils/',
        maxResults: 10
      };

      const mockResults = [
        {
          nodeId: 'node1',
          signature: 'function formatDate(date: Date): string',
          filePath: '/src/utils/date.ts',
          lineNumber: 8,
          score: 0.85,
          context: 'Date formatting utility'
        }
      ];

      mockDatabaseReader.vectorSearch.mockResolvedValue(mockResults);

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(mockDatabaseReader.vectorSearch).toHaveBeenCalledWith(
        'utility functions',
        expect.objectContaining({
          filePath: '/src/utils/'
        })
      );
    });

    it('should handle empty search results', async () => {
      const query: SemanticQuery = {
        type: 'semantic',
        text: 'non-existent-functionality-12345',
        maxResults: 10
      };

      mockDatabaseReader.vectorSearch.mockResolvedValue([]);

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toHaveLength(0);
      expect(result.performance).toBeDefined();
      expect(result.performance.resultCount).toBe(0);
    });

    it('should include performance metrics', async () => {
      const query: SemanticQuery = {
        type: 'semantic',
        text: 'test query',
        maxResults: 5
      };

      mockDatabaseReader.vectorSearch.mockResolvedValue([]);

      const result = await processor.processQuery(query);

      expect(result.performance).toBeDefined();
      expect(result.performance.totalTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.searchTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.resultCount).toBeGreaterThanOrEqual(0);
      expect(result.performance.cacheHit).toBeDefined();
      expect(result.performance.timestamp).toBeInstanceOf(Date);
    });

    it('should handle database errors gracefully', async () => {
      const query: SemanticQuery = {
        type: 'semantic',
        text: 'test query',
        maxResults: 10
      };

      mockDatabaseReader.vectorSearch.mockRejectedValue(new Error('Vector search failed'));

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toHaveLength(0);
      expect(result.performance).toBeDefined();
      expect(result.performance.error).toContain('Vector search failed');
    });

    it('should handle context boosting queries', async () => {
      const query: SemanticQuery = {
        type: 'semantic',
        text: 'error handling',
        context: 'try-catch exception management',
        options: {
          useContextBoosting: true
        },
        maxResults: 10
      };

      const mockResults = [
        {
          nodeId: 'node1',
          signature: 'try { ... } catch (error) { ... }',
          filePath: '/src/error-handler.ts',
          lineNumber: 20,
          score: 0.91,
          context: 'Exception handling block'
        }
      ];

      mockDatabaseReader.vectorSearch.mockResolvedValue(mockResults);

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(mockDatabaseReader.vectorSearch).toHaveBeenCalledWith(
        'error handling',
        expect.objectContaining({
          useContextBoosting: true
        })
      );
    });

    it('should respect maxResults parameter', async () => {
      const query: SemanticQuery = {
        type: 'semantic',
        text: 'functions',
        maxResults: 3
      };

      const mockResults = Array.from({ length: 10 }, (_, i) => ({
        nodeId: `node${i}`,
        signature: `function test${i}(): void`,
        filePath: `/src/test${i}.ts`,
        lineNumber: 10 + i,
        score: 0.9 - i * 0.05,
        context: `Test function ${i}`
      }));

      mockDatabaseReader.vectorSearch.mockResolvedValue(mockResults);

      const result = await processor.processQuery(query);

      expect(result.matches.length).toBeLessThanOrEqual(3);
      expect(mockDatabaseReader.vectorSearch).toHaveBeenCalledWith(
        'functions',
        expect.objectContaining({
          maxResults: 3
        })
      );
    });

    it('should handle minimum score thresholds', async () => {
      const query: SemanticQuery = {
        type: 'semantic',
        text: 'api endpoints',
        minScore: 0.8,
        maxResults: 10
      };

      const mockResults = [
        {
          nodeId: 'node1',
          signature: 'app.get("/api/users", handler)',
          filePath: '/src/routes.ts',
          lineNumber: 15,
          score: 0.95,
          context: 'User API endpoint'
        },
        {
          nodeId: 'node2',
          signature: 'app.post("/api/auth", handler)',
          filePath: '/src/routes.ts',
          lineNumber: 25,
          score: 0.75, // Below threshold
          context: 'Auth API endpoint'
        }
      ];

      mockDatabaseReader.vectorSearch.mockResolvedValue(mockResults);

      const result = await processor.processQuery(query);

      // Should filter out results below minScore
      expect(result.matches.every(match => match.score >= 0.8)).toBe(true);
    });

    it('should handle node type filters', async () => {
      const query: SemanticQuery = {
        type: 'semantic',
        text: 'class methods',
        nodeType: 'method',
        maxResults: 10
      };

      const mockResults = [
        {
          nodeId: 'node1',
          signature: 'getUserData(): UserData',
          filePath: '/src/user.ts',
          lineNumber: 15,
          score: 0.89,
          context: 'Method to retrieve user data'
        }
      ];

      mockDatabaseReader.vectorSearch.mockResolvedValue(mockResults);

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(mockDatabaseReader.vectorSearch).toHaveBeenCalledWith(
        'class methods',
        expect.objectContaining({
          nodeType: 'method'
        })
      );
    });
  });

  describe('initialization', () => {
    it('should initialize with database reader', () => {
      expect(processor).toBeDefined();
      expect(processor).toBeInstanceOf(SemanticQueryProcessor);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        defaultSearchEf: 150,
        cacheEnabled: true,
        maxCacheSize: 200
      };

      const customProcessor = new SemanticQueryProcessor(mockDatabaseReader, customConfig);
      expect(customProcessor).toBeDefined();
    });

    it('should inherit from EventEmitter', () => {
      expect(processor.on).toBeDefined();
      expect(processor.emit).toBeDefined();
      expect(processor.removeListener).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle invalid queries gracefully', async () => {
      const query: any = {
        type: 'semantic',
        // Missing required 'text' property
        maxResults: 10
      };

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toHaveLength(0);
      expect(result.performance.error).toBeDefined();
    });

    it('should handle database reader not ready', async () => {
      mockDatabaseReader.isReady.mockReturnValue(false);

      const query: SemanticQuery = {
        type: 'semantic',
        text: 'test query',
        maxResults: 10
      };

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toHaveLength(0);
      expect(result.performance.error).toContain('not ready');
    });
  });

  describe('caching', () => {
    it('should cache query results when enabled', async () => {
      const cacheConfig = {
        cacheEnabled: true,
        maxCacheSize: 100
      };

      const cachedProcessor = new SemanticQueryProcessor(mockDatabaseReader, cacheConfig);

      const query: SemanticQuery = {
        type: 'semantic',
        text: 'cached query',
        maxResults: 10
      };

      mockDatabaseReader.vectorSearch.mockResolvedValue([]);

      // First query
      const result1 = await cachedProcessor.processQuery(query);
      expect(result1.performance.cacheHit).toBe(false);

      // Second identical query should use cache
      const result2 = await cachedProcessor.processQuery(query);
      expect(result2.performance.cacheHit).toBe(true);
    });

    it('should invalidate cache when appropriate', async () => {
      const cacheConfig = {
        cacheEnabled: true,
        cacheTTL: 100, // 100ms TTL
        maxCacheSize: 100
      };

      const cachedProcessor = new SemanticQueryProcessor(mockDatabaseReader, cacheConfig);

      const query: SemanticQuery = {
        type: 'semantic',
        text: 'ttl query',
        maxResults: 10
      };

      mockDatabaseReader.vectorSearch.mockResolvedValue([]);

      // First query
      await cachedProcessor.processQuery(query);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second query should not use cache
      const result = await cachedProcessor.processQuery(query);
      expect(result.performance.cacheHit).toBe(false);
    });
  });
});