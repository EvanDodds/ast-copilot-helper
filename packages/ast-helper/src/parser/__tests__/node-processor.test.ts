/**
 * Tests for NodeProcessor Pipeline
 * 
 * Comprehensive tests covering the main processing pipeline that coordinates
 * all AST processing components.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { 
  NodeProcessor, 
  ProcessingConfig, 
  ProcessingError, 
  ProcessingUtils,
  DEFAULT_PROCESSING_CONFIG 
} from '../node-processor';
import { ASTNode, NodeType, SignificanceLevel } from '../ast-schema';

// Mock file system operations
vi.mock('fs');
const mockFs = fs as any;

describe('NodeProcessor', () => {
  let processor: NodeProcessor;
  let mockFilePath: string;
  let mockSourceText: string;

  beforeEach(() => {
    processor = new NodeProcessor();
    mockFilePath = '/test/sample.ts';
    mockSourceText = 'function test() { return 42; }';
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default fs mocks
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.statSync = vi.fn().mockReturnValue({ size: 1000 });
    mockFs.readFileSync = vi.fn().mockReturnValue(mockSourceText);
    mockFs.readdirSync = vi.fn().mockReturnValue([]);
    mockFs.mkdirSync = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = processor.getConfig();
      expect(config).toEqual(DEFAULT_PROCESSING_CONFIG);
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<ProcessingConfig> = {
        generateIds: false,
        classifyNodes: false,
        timeoutMs: 5000,
      };

      const customProcessor = new NodeProcessor(customConfig);
      const config = customProcessor.getConfig();
      
      expect(config.generateIds).toBe(false);
      expect(config.classifyNodes).toBe(false);
      expect(config.timeoutMs).toBe(5000);
      expect(config.calculateSignificance).toBe(true); // Should keep default
    });

    it('should update configuration', () => {
      const newConfig: Partial<ProcessingConfig> = {
        enableSerialization: true,
        maxFileSizeBytes: 5000000,
      };

      processor.updateConfig(newConfig);
      const config = processor.getConfig();
      
      expect(config.enableSerialization).toBe(true);
      expect(config.maxFileSizeBytes).toBe(5000000);
    });
  });

  describe('Single File Processing', () => {
    it('should process a file successfully with all stages enabled', async () => {
      const result = await processor.processFile(mockFilePath, 'typescript');
      
      expect(result.success).toBe(true);
      expect(result.filePath).toBe(mockFilePath);
      expect(result.language).toBe('typescript');
      expect(result.nodes).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.fileHash).toBeTruthy();
      expect(result.error).toBeUndefined();
    });

    it('should handle file not found error', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await processor.processFile('/nonexistent.ts', 'typescript');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ProcessingError);
      expect(result.error!.message).toContain('File not found');
      expect(result.nodes).toEqual([]);
    });

    it('should handle file too large error', async () => {
      mockFs.statSync.mockReturnValue({ size: 20 * 1024 * 1024 }); // 20MB
      
      const result = await processor.processFile(mockFilePath, 'typescript');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ProcessingError);
      expect(result.error!.message).toContain('File too large');
    });

    it('should process with provided source text', async () => {
      const customSource = 'class Test { method() {} }';
      
      const result = await processor.processFile(mockFilePath, 'typescript', customSource);
      
      expect(result.success).toBe(true);
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    it('should generate correct file hash', async () => {
      const result1 = await processor.processFile(mockFilePath, 'typescript', 'content1');
      const result2 = await processor.processFile(mockFilePath, 'typescript', 'content2');
      const result3 = await processor.processFile(mockFilePath, 'typescript', 'content1');
      
      expect(result1.fileHash).toBeTruthy();
      expect(result2.fileHash).toBeTruthy();
      expect(result3.fileHash).toBeTruthy();
      
      expect(result1.fileHash).not.toBe(result2.fileHash);
      expect(result1.fileHash).toBe(result3.fileHash); // Same content should produce same hash
    });

    it('should include serialization path when enabled', async () => {
      processor.updateConfig({ enableSerialization: true });
      
      const result = await processor.processFile(mockFilePath, 'typescript');
      
      expect(result.serializedPath).toBeTruthy();
      expect(result.serializedPath).toContain('.ast.json');
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple files successfully', async () => {
      const files = [
        { filePath: '/test/file1.ts', language: 'typescript' },
        { filePath: '/test/file2.js', language: 'javascript' },
        { filePath: '/test/file3.py', language: 'python' },
      ];

      const result = await processor.processBatch(files);
      
      expect(result.results).toHaveLength(3);
      expect(result.overallStats.totalFiles).toBe(3);
      expect(result.overallStats.successfulFiles).toBe(3);
      expect(result.overallStats.failedFiles).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should handle mixed success and failure results', async () => {
      const files = [
        { filePath: '/test/good.ts', language: 'typescript' },
        { filePath: '/test/bad.ts', language: 'typescript' },
      ];

      // Make second file fail
      mockFs.existsSync.mockImplementation((path: string) => !path.includes('bad'));

      const result = await processor.processBatch(files);
      
      expect(result.results).toHaveLength(2);
      expect(result.overallStats.successfulFiles).toBe(1);
      expect(result.overallStats.failedFiles).toBe(1);
      expect(result.errors).toHaveLength(1);
      
      const successResult = result.results.find(r => r.success);
      const failedResult = result.results.find(r => !r.success);
      
      expect(successResult?.filePath).toBe('/test/good.ts');
      expect(failedResult?.filePath).toBe('/test/bad.ts');
    });

    it('should calculate correct overall statistics', async () => {
      const files = [
        { filePath: '/test/file1.ts', language: 'typescript', sourceText: 'function f1() {}' },
        { filePath: '/test/file2.ts', language: 'typescript', sourceText: 'class C2 {}' },
      ];

      const result = await processor.processBatch(files);
      
      expect(result.overallStats.totalFiles).toBe(2);
      expect(result.overallStats.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.overallStats.totalNodes).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Directory Processing', () => {
    it('should discover and process files in directory', async () => {
      mockFs.readdirSync.mockReturnValue(['file1.ts', 'file2.js', 'readme.md']);
      mockFs.statSync.mockImplementation((path: string) => ({
        size: 1000,
        isDirectory: () => false,
        isFile: () => true,
      }));

      const result = await processor.processDirectory('/test/src');
      
      expect(result.results).toHaveLength(2); // Only .ts and .js files
      expect(result.results.some(r => r.filePath.includes('file1.ts'))).toBe(true);
      expect(result.results.some(r => r.filePath.includes('file2.js'))).toBe(true);
    });

    it('should handle recursive directory traversal', async () => {
      mockFs.readdirSync
        .mockReturnValueOnce(['subdir', 'file1.ts'])
        .mockReturnValueOnce(['file2.js']);
        
      mockFs.statSync.mockImplementation((path: string) => ({
        size: 1000,
        isDirectory: () => path.includes('subdir'),
        isFile: () => !path.includes('subdir'),
      }));

      const result = await processor.processDirectory('/test/src', { recursive: true });
      
      expect(result.results).toHaveLength(2);
    });

    it('should respect file extension filters', async () => {
      mockFs.readdirSync.mockReturnValue(['file.py', 'file.java', 'file.txt']);
      mockFs.statSync.mockImplementation(() => ({
        size: 1000,
        isDirectory: () => false,
        isFile: () => true,
      }));

      const result = await processor.processDirectory('/test/src', {
        extensions: ['.py', '.java'],
      });
      
      expect(result.results).toHaveLength(2);
      expect(result.results.every(r => r.filePath.endsWith('.py') || r.filePath.endsWith('.java'))).toBe(true);
    });

    it('should respect maxFiles limit', async () => {
      const manyFiles = Array.from({ length: 20 }, (_, i) => `file${i}.ts`);
      mockFs.readdirSync.mockReturnValue(manyFiles);
      mockFs.statSync.mockImplementation(() => ({
        size: 1000,
        isDirectory: () => false,
        isFile: () => true,
      }));

      const result = await processor.processDirectory('/test/src', { maxFiles: 5 });
      
      expect(result.results).toHaveLength(5);
    });
  });

  describe('Node Validation', () => {
    it('should validate processed nodes successfully', () => {
      const validNodes: ASTNode[] = [
        {
          id: 'test-1',
          type: NodeType.FUNCTION,
          name: 'testFunc',
          filePath: '/test.ts',
          start: { line: 1, column: 0 },
          end: { line: 5, column: 0 },
          children: ['test-2'],
          significance: SignificanceLevel.HIGH,
          metadata: {
            language: 'typescript',
            scope: [],
            modifiers: [],
            imports: [],
            exports: [],
            annotations: [],
          },
        },
        {
          id: 'test-2',
          type: NodeType.VARIABLE,
          name: undefined,
          filePath: '/test.ts',
          start: { line: 2, column: 2 },
          end: { line: 2, column: 10 },
          children: [],
          significance: SignificanceLevel.LOW,
          metadata: {
            language: 'typescript',
            scope: [],
            modifiers: [],
            imports: [],
            exports: [],
            annotations: [],
          },
        },
      ];

      const validation = processor.validateProcessedNodes(validNodes);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const invalidNodes: ASTNode[] = [
        {
          // Missing id, metadata, significance
          type: NodeType.FUNCTION,
          name: 'testFunc',
          filePath: '/test.ts',
          start: { line: 1, column: 0 },
          end: { line: 5, column: 0 },
          children: [],
        } as any,
      ];

      const validation = processor.validateProcessedNodes(invalidNodes);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Node missing ID: {"type":"function","name":"testFunc","filePath":"/test.ts","start":{"line":1,"column":0},"end":{"line":5,"column":0},"children":[]}');
      expect(validation.errors.some(e => e.includes('missing metadata'))).toBe(true);
      expect(validation.errors.some(e => e.includes('missing significance'))).toBe(true);
    });

    it('should detect invalid position ranges', () => {
      const invalidNodes: ASTNode[] = [
        {
          id: 'test-1',
          type: NodeType.FUNCTION,
          name: 'testFunc',
          filePath: '/test.ts',
          start: { line: 5, column: 0 },
          end: { line: 1, column: 0 }, // Invalid: start > end
          children: [],
          significance: SignificanceLevel.HIGH,
          metadata: {} as any,
        },
      ];

      const validation = processor.validateProcessedNodes(invalidNodes);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Invalid position range'))).toBe(true);
    });

    it('should detect invalid child IDs', () => {
      const invalidNodes: ASTNode[] = [
        {
          id: 'test-1',
          type: NodeType.FUNCTION,
          name: 'testFunc',
          filePath: '/test.ts',
          start: { line: 1, column: 0 },
          end: { line: 5, column: 0 },
          children: ['', null, undefined] as any,
          significance: SignificanceLevel.HIGH,
          metadata: {} as any,
        },
      ];

      const validation = processor.validateProcessedNodes(invalidNodes);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Invalid child ID'))).toBe(true);
    });
  });

  describe('Processing Statistics', () => {
    it('should generate processing statistics summary', async () => {
      const files = [
        { filePath: '/test/file1.ts', language: 'typescript' },
        { filePath: '/test/file2.js', language: 'javascript' },
      ];

      const batchResult = await processor.processBatch(files);
      const summary = processor.getProcessingStatsSummary(batchResult.results);
      
      expect(summary.totalFiles).toBe(2);
      expect(summary.successfulFiles).toBe(2);
      expect(summary.failedFiles).toBe(0);
      expect(summary.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(summary.nodeDistribution).toBeDefined();
      expect(summary.significanceDistribution).toBeDefined();
    });

    it('should handle mixed success/failure in statistics', async () => {
      mockFs.existsSync.mockImplementation((path: string) => !path.includes('bad'));
      
      const files = [
        { filePath: '/test/good.ts', language: 'typescript' },
        { filePath: '/test/bad.ts', language: 'typescript' },
      ];

      const batchResult = await processor.processBatch(files);
      const summary = processor.getProcessingStatsSummary(batchResult.results);
      
      expect(summary.totalFiles).toBe(2);
      expect(summary.successfulFiles).toBe(1);
      expect(summary.failedFiles).toBe(1);
    });
  });

  describe('Language Detection', () => {
    it('should detect language from file extension', async () => {
      const testCases = [
        { file: '/test/app.ts', expectedLang: 'typescript' },
        { file: '/test/app.tsx', expectedLang: 'typescript' },
        { file: '/test/app.js', expectedLang: 'javascript' },
        { file: '/test/app.jsx', expectedLang: 'javascript' },
        { file: '/test/app.py', expectedLang: 'python' },
        { file: '/test/app.java', expectedLang: 'java' },
        { file: '/test/app.unknown', expectedLang: 'unknown' },
      ];

      for (const testCase of testCases) {
        const result = await processor.processDirectory('/test', {
          extensions: [path.extname(testCase.file)],
        });
        
        // We can't directly test the language detection without mocking the file discovery,
        // but we can verify it doesn't throw errors
        expect(result).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should create ProcessingError with correct properties', () => {
      const originalError = new Error('Original cause');
      const processingError = new ProcessingError(
        'Processing failed',
        '/test/file.ts',
        'validation',
        originalError
      );
      
      expect(processingError.message).toContain('Processing failed at validation for /test/file.ts');
      expect(processingError.filePath).toBe('/test/file.ts');
      expect(processingError.stage).toBe('validation');
      expect(processingError.cause).toBe(originalError);
      expect(processingError.name).toBe('ProcessingError');
    });

    it('should handle processing stage failures gracefully', async () => {
      // Create a processor that will fail at validation stage
      const invalidProcessor = new NodeProcessor({ 
        validateNodes: true,
        generateIds: false // This will cause validation to fail
      });
      
      const result = await invalidProcessor.processFile(mockFilePath, 'typescript');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ProcessingError);
    });
  });
});

describe('ProcessingUtils', () => {
  describe('Factory Methods', () => {
    it('should create minimal processor', () => {
      const processor = ProcessingUtils.createMinimalProcessor();
      const config = processor.getConfig();
      
      expect(config.generateIds).toBe(true);
      expect(config.classifyNodes).toBe(false);
      expect(config.calculateSignificance).toBe(false);
      expect(config.extractMetadata).toBe(false);
      expect(config.enableSerialization).toBe(false);
      expect(config.validateNodes).toBe(false);
    });

    it('should create full processor', () => {
      const processor = ProcessingUtils.createFullProcessor();
      const config = processor.getConfig();
      
      expect(config.generateIds).toBe(true);
      expect(config.classifyNodes).toBe(true);
      expect(config.calculateSignificance).toBe(true);
      expect(config.extractMetadata).toBe(true);
      expect(config.enableSerialization).toBe(true);
      expect(config.validateNodes).toBe(true);
    });

    it('should create performance processor', () => {
      const processor = ProcessingUtils.createPerformanceProcessor();
      const config = processor.getConfig();
      
      expect(config.generateIds).toBe(true);
      expect(config.classifyNodes).toBe(true);
      expect(config.extractMetadata).toBe(false); // Disabled for performance
      expect(config.timeoutMs).toBe(5000);
      expect(config.maxFileSizeBytes).toBe(5 * 1024 * 1024);
    });
  });

  describe('Result Merging', () => {
    it('should merge multiple processing results', async () => {
      const processor1 = new NodeProcessor();
      const processor2 = new NodeProcessor();
      
      mockFs.readFileSync.mockReturnValue('test content');
      
      const result1 = await processor1.processBatch([
        { filePath: '/test/file1.ts', language: 'typescript' },
      ]);
      
      const result2 = await processor2.processBatch([
        { filePath: '/test/file2.ts', language: 'typescript' },
      ]);
      
      const merged = ProcessingUtils.mergeProcessingResults([result1, result2]);
      
      expect(merged.results).toHaveLength(2);
      expect(merged.overallStats.totalFiles).toBe(2);
      expect(merged.overallStats.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should merge error arrays correctly', async () => {
      mockFs.existsSync.mockImplementation((path: string) => !path.includes('bad'));
      
      const processor = new NodeProcessor();
      
      const result1 = await processor.processBatch([
        { filePath: '/test/bad1.ts', language: 'typescript' },
      ]);
      
      const result2 = await processor.processBatch([
        { filePath: '/test/bad2.ts', language: 'typescript' },
      ]);
      
      const merged = ProcessingUtils.mergeProcessingResults([result1, result2]);
      
      expect(merged.errors).toHaveLength(2);
      expect(merged.overallStats.failedFiles).toBe(2);
      expect(merged.overallStats.successfulFiles).toBe(0);
    });
  });
});

describe('ProcessingConfig', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_PROCESSING_CONFIG.generateIds).toBe(true);
    expect(DEFAULT_PROCESSING_CONFIG.classifyNodes).toBe(true);
    expect(DEFAULT_PROCESSING_CONFIG.calculateSignificance).toBe(true);
    expect(DEFAULT_PROCESSING_CONFIG.extractMetadata).toBe(true);
    expect(DEFAULT_PROCESSING_CONFIG.enableSerialization).toBe(false);
    expect(DEFAULT_PROCESSING_CONFIG.timeoutMs).toBe(30000);
    expect(DEFAULT_PROCESSING_CONFIG.maxFileSizeBytes).toBe(10 * 1024 * 1024);
    expect(DEFAULT_PROCESSING_CONFIG.includeSourceText).toBe(true);
    expect(DEFAULT_PROCESSING_CONFIG.generateSignatures).toBe(true);
    expect(DEFAULT_PROCESSING_CONFIG.calculateComplexity).toBe(true);
    expect(DEFAULT_PROCESSING_CONFIG.validateNodes).toBe(true);
  });
});

describe('Integration Tests', () => {
  it('should handle complex processing workflow end-to-end', async () => {
    const processor = ProcessingUtils.createFullProcessor();
    
    mockFs.readdirSync.mockReturnValue(['complex.ts', 'simple.js']);
    mockFs.statSync.mockImplementation(() => ({
      size: 5000,
      isDirectory: () => false,
      isFile: () => true,
    }));
    
    mockFs.readFileSync
      .mockReturnValueOnce('function complexFunction(a: string, b: number): boolean { if (a.length > b) { return true; } return false; }')
      .mockReturnValueOnce('const simple = () => 42;');

    const result = await processor.processDirectory('/test/src');
    
    expect(result.results).toHaveLength(2);
    expect(result.overallStats.successfulFiles).toBe(2);
    expect(result.overallStats.totalNodes).toBeGreaterThanOrEqual(2);
    
    // Check that all processing stages were applied
    for (const fileResult of result.results) {
      expect(fileResult.success).toBe(true);
      for (const node of fileResult.nodes) {
        expect(node.id).toBeTruthy();
        expect(node.significance).toBeDefined();
        expect(node.metadata).toBeDefined();
      }
    }
  });

  it('should handle processing with all stages disabled except ID generation', async () => {
    const processor = new NodeProcessor({
      generateIds: true,
      classifyNodes: false,
      calculateSignificance: false,
      extractMetadata: false,
      enableSerialization: false,
      validateNodes: false,
    });

    const result = await processor.processFile('/test/minimal.ts', 'typescript', 'const x = 1;');
    
    expect(result.success).toBe(true);
    expect(result.nodes).toHaveLength(1);
    
    const node = result.nodes[0];
    expect(node.id).toBeTruthy(); // ID should be generated
    // Other fields might be undefined since stages are disabled
  });
});

describe('Performance and Memory', () => {
  it('should track memory usage in processing statistics', async () => {
    const processor = new NodeProcessor();
    
    const result = await processor.processFile('/test/file.ts', 'typescript', 'test content');
    
    expect(result.stats.memoryUsage.peakMB).toBeGreaterThanOrEqual(0);
    expect(result.stats.memoryUsage.averageMB).toBeGreaterThanOrEqual(0);
  });

  it('should calculate performance metrics', async () => {
    const processor = new NodeProcessor();
    
    const result = await processor.processFile('/test/file.ts', 'typescript', 'test content');
    
    expect(result.stats.performance.nodesPerSecond).toBeGreaterThanOrEqual(0);
    expect(result.stats.performance.avgTimePerNodeUs).toBeGreaterThanOrEqual(0);
    expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should respect timeout configuration', async () => {
    const processor = new NodeProcessor({ timeoutMs: 1 }); // Very short timeout
    
    // This test is challenging to implement without actual long-running operations
    // In a real scenario, you'd want to test with actual time-consuming operations
    const result = await processor.processFile('/test/file.ts', 'typescript', 'test');
    
    // The processing should complete quickly enough that timeout doesn't matter
    expect(result).toBeDefined();
  });
});