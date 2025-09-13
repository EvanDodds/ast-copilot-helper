import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileQueryProcessor } from '../../../packages/ast-mcp-server/src/query/file-processor';
import { FileQuery } from '../../../packages/ast-mcp-server/src/query/types';
import { ASTDatabaseReader } from '../../../packages/ast-mcp-server/src/database/reader';

// Mock the database reader
vi.mock('../../../packages/ast-mcp-server/src/database/reader');

describe('FileQueryProcessor', () => {
  let processor: FileQueryProcessor;
  let mockDatabaseReader: any;

  beforeEach(() => {
    mockDatabaseReader = {
      isReady: vi.fn().mockReturnValue(true)
    };

    processor = new FileQueryProcessor(mockDatabaseReader);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processQuery', () => {
    it('should handle basic file queries', async () => {
      const query: FileQuery = {
        type: 'file',
        text: 'test.ts'
      };

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
      expect(result.performance.resultCount).toBeGreaterThanOrEqual(0);
      expect(result.performance.totalTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle queries with file criteria', async () => {
      const query: FileQuery = {
        type: 'file',
        text: '*.test.ts',
        criteria: {
          extensions: ['.ts', '.tsx'],
          includeContent: false
        }
      };

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.performance.resultCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle content search queries', async () => {
      const query: FileQuery = {
        type: 'file',
        text: 'useState',
        criteria: {
          includeContent: true
        }
      };

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.performance.resultCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle queries with directory filters', async () => {
      const query: FileQuery = {
        type: 'file',
        text: 'component',
        criteria: {
          directories: ['/src/components'],
          extensions: ['.tsx', '.ts']
        }
      };

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.performance.resultCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle queries with exclude patterns', async () => {
      const query: FileQuery = {
        type: 'file',
        text: '*.js',
        criteria: {
          excludePatterns: ['*.test.js', '*.spec.js']
        }
      };

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.performance.resultCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty search results gracefully', async () => {
      const query: FileQuery = {
        type: 'file',
        text: 'nonexistent-file-123456'
      };

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toHaveLength(0);
      expect(result.performance).toBeDefined();
      expect(result.performance.resultCount).toBe(0);
    });

    it('should handle queries with file size limits', async () => {
      const query: FileQuery = {
        type: 'file',
        text: '*.ts',
        criteria: {
          maxFileSize: 10000 // 10KB limit
        }
      };

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.performance.resultCount).toBeGreaterThanOrEqual(0);
    });

    it('should include performance metrics in all responses', async () => {
      const query: FileQuery = {
        type: 'file',
        text: 'test'
      };

      const result = await processor.processQuery(query);

      expect(result.performance).toBeDefined();
      expect(result.performance.totalTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.searchTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.resultCount).toBeGreaterThanOrEqual(0);
      expect(result.performance.cacheHit).toBe(false);
      expect(result.performance.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('initialization', () => {
    it('should initialize with database reader', () => {
      expect(processor).toBeDefined();
      expect(processor).toBeInstanceOf(FileQueryProcessor);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        maxResults: 50,
        caseSensitive: true,
        includeHidden: true
      };

      const customProcessor = new FileQueryProcessor(mockDatabaseReader, customConfig);
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
        type: 'file',
        // Missing required 'text' property
      };

      const result = await processor.processQuery(query);

      expect(result).toBeDefined();
      expect(result.matches).toHaveLength(0);
      expect(result.performance.error).toBeDefined();
    });
  });

  describe('private utility methods', () => {
    it('should calculate Levenshtein distance correctly', () => {
      // Access private method through type assertion for testing
      const processorAny = processor as any;
      
      expect(processorAny.levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(processorAny.levenshteinDistance('hello', 'hello')).toBe(0);
      expect(processorAny.levenshteinDistance('abc', 'def')).toBe(3);
      expect(processorAny.levenshteinDistance('', 'test')).toBe(4);
      expect(processorAny.levenshteinDistance('test', '')).toBe(4);
    });

    it('should calculate similarity scores correctly', () => {
      const processorAny = processor as any;
      
      expect(processorAny.calculateSimilarityScore('hello', 'hello')).toBe(1.0);
      expect(processorAny.calculateSimilarityScore('hello', 'helo')).toBeGreaterThan(0.8);
      expect(processorAny.calculateSimilarityScore('abc', 'xyz')).toBe(0.0);
    });

    it('should detect language from file extension correctly', () => {
      const processorAny = processor as any;
      
      expect(processorAny.detectLanguage('.ts')).toBe('typescript');
      expect(processorAny.detectLanguage('.js')).toBe('javascript');
      expect(processorAny.detectLanguage('.py')).toBe('python');
      expect(processorAny.detectLanguage('.java')).toBe('java');
      expect(processorAny.detectLanguage('.unknown')).toBe('unknown');
    });
  });
});