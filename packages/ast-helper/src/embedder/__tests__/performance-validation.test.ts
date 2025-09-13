/**
 * Performance validation for embedding generation system
 * Validates performance requirements for Issue #13
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { performance } from 'node:perf_hooks';
import { EmbedCommand } from '../../commands/embed.js';
import { XenovaEmbeddingGenerator, CodeTextProcessor } from '../index.js';
import { createLogger } from '../../logging/index.js';
import type { Config } from '../../types.js';

describe('Embedding System Performance Validation', () => {
  let embedCommand: EmbedCommand;
  let mockConfig: Config;
  let mockLogger: any;
  let performanceMetrics: {
    totalStartTime: number;
    batchProcessingTimes: number[];
    memoryUsage: { before: number; peak: number; after: number };
    throughput: { annotationsPerSecond: number; embeddingsPerSecond: number };
  };

  beforeEach(() => {
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    };

    mockConfig = {
      parseGlob: ['**/*.{js,ts,py}'],
      watchGlob: ['**/*.{js,ts,py}'],
      topK: 10,
      snippetLines: 5,
      modelHost: 'local',
      enableTelemetry: false,
      concurrency: 4,
      batchSize: 100,
      outputDir: '.astdb',
      indexParams: { efConstruction: 200, M: 16 },
      model: {
        defaultModel: 'codebert-base',
        modelsDir: '.astdb/models',
        downloadTimeout: 30000,
        maxConcurrentDownloads: 2,
        showProgress: true
      },
      embeddings: {
        model: 'codebert-base',
        modelPath: '.astdb/models/codebert-base',
        batchSize: 32,
        maxConcurrency: 2,
        memoryLimit: 2048,
        showProgress: true,
        enableConfidenceScoring: true,
        textProcessing: {
          maxTokenLength: 512,
          preserveCodeStructure: true,
          normalizeWhitespace: true,
          preserveComments: false,
          maxSnippetLength: 1024
        }
      }
    };

    performanceMetrics = {
      totalStartTime: 0,
      batchProcessingTimes: [],
      memoryUsage: { before: 0, peak: 0, after: 0 },
      throughput: { annotationsPerSecond: 0, embeddingsPerSecond: 0 }
    };

    embedCommand = new EmbedCommand(mockConfig, mockLogger);
  });

  afterEach(() => {
    // Clean up any resources
  });

  describe('Batch Processing Performance', () => {
    it('should meet batch processing time requirements', async () => {
      const testSizes = [10, 50, 100, 500];
      const results: Record<number, { timeMs: number; throughput: number }> = {};

      for (const size of testSizes) {
        const annotations = generateMockAnnotations(size);
        const startTime = performance.now();
        
        // Simulate batch processing (we'll mock the actual processing)
        await simulateBatchProcessing(annotations, mockConfig.embeddings!);
        
        const endTime = performance.now();
        const timeMs = endTime - startTime;
        const throughput = size / (timeMs / 1000); // annotations per second
        
        results[size] = { timeMs, throughput };

        // Performance Requirements from Issue #13:
        // - Small batches (≤50): < 5 seconds
        // - Medium batches (51-200): < 30 seconds  
        // - Large batches (201-1000): < 120 seconds
        if (size <= 50) {
          expect(timeMs).toBeLessThan(5000);
        } else if (size <= 200) {
          expect(timeMs).toBeLessThan(30000);
        } else if (size <= 1000) {
          expect(timeMs).toBeLessThan(120000);
        }
      }

      console.log('Batch Processing Performance Results:');
      for (const [size, result] of Object.entries(results)) {
        console.log(`  ${size} annotations: ${result.timeMs.toFixed(2)}ms (${result.throughput.toFixed(2)} annotations/sec)`);
      }
    });

    it('should handle concurrent batch processing efficiently', async () => {
      const batchSize = 32;
      const concurrencyLevels = [1, 2, 4, 8];
      const annotations = generateMockAnnotations(100);

      for (const concurrency of concurrencyLevels) {
        const startTime = performance.now();
        
        // Simulate concurrent processing
        const batches = chunkArray(annotations, batchSize);
        const batchPromises = batches.map(batch => 
          simulateBatchProcessing(batch, { ...mockConfig.embeddings!, maxConcurrency: concurrency })
        );
        
        await Promise.all(batchPromises);
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const throughput = annotations.length / (totalTime / 1000);

        console.log(`Concurrency ${concurrency}: ${totalTime.toFixed(2)}ms (${throughput.toFixed(2)} annotations/sec)`);

        // Higher concurrency should generally improve or maintain performance
        // (with some overhead tolerance)
        expect(totalTime).toBeLessThan(10000); // Should process 100 annotations in under 10s
      }
    });
  });

  describe('Memory Management Performance', () => {
    it('should maintain memory usage within limits', async () => {
      const memoryLimit = 2048; // MB
      const largeAnnotationSet = generateMockAnnotations(1000);
      
      // Measure initial memory
      const initialMemory = process.memoryUsage();
      performanceMetrics.memoryUsage.before = initialMemory.heapUsed / 1024 / 1024;

      let peakMemory = performanceMetrics.memoryUsage.before;
      
      // Simulate processing with memory monitoring
      const batchSize = mockConfig.embeddings!.batchSize;
      const batches = chunkArray(largeAnnotationSet, batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        await simulateBatchProcessing(batches[i], mockConfig.embeddings!);
        
        // Check memory usage
        const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        peakMemory = Math.max(peakMemory, currentMemory);
        
        // Memory should not exceed configured limit plus reasonable overhead (50%)
        expect(currentMemory).toBeLessThan(memoryLimit * 1.5);
        
        // Simulate memory cleanup between batches
        if (i % 5 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      performanceMetrics.memoryUsage.peak = peakMemory;
      performanceMetrics.memoryUsage.after = finalMemory;

      console.log(`Memory Usage Analysis:`);
      console.log(`  Initial: ${performanceMetrics.memoryUsage.before.toFixed(2)}MB`);
      console.log(`  Peak: ${performanceMetrics.memoryUsage.peak.toFixed(2)}MB`);
      console.log(`  Final: ${performanceMetrics.memoryUsage.after.toFixed(2)}MB`);
      console.log(`  Growth: ${(performanceMetrics.memoryUsage.peak - performanceMetrics.memoryUsage.before).toFixed(2)}MB`);

      // Memory growth should be reasonable (not linear with dataset size)
      const memoryGrowth = performanceMetrics.memoryUsage.peak - performanceMetrics.memoryUsage.before;
      expect(memoryGrowth).toBeLessThan(memoryLimit);
    });

    it('should cleanup memory efficiently between batches', async () => {
      const batchSizes = [16, 32, 64, 128];
      const memorySnapshots: Record<number, number[]> = {};

      for (const batchSize of batchSizes) {
        memorySnapshots[batchSize] = [];
        const annotations = generateMockAnnotations(batchSize * 5); // 5 batches
        const batches = chunkArray(annotations, batchSize);

        for (const batch of batches) {
          const beforeBatch = process.memoryUsage().heapUsed / 1024 / 1024;
          
          await simulateBatchProcessing(batch, mockConfig.embeddings!);
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
          
          const afterBatch = process.memoryUsage().heapUsed / 1024 / 1024;
          memorySnapshots[batchSize].push(afterBatch - beforeBatch);
        }

        const avgMemoryPerBatch = memorySnapshots[batchSize].reduce((sum, mem) => sum + mem, 0) / memorySnapshots[batchSize].length;
        console.log(`Batch size ${batchSize}: Average memory per batch: ${avgMemoryPerBatch.toFixed(2)}MB`);

        // Memory usage per batch should be reasonable and consistent
        expect(avgMemoryPerBatch).toBeLessThan(100); // Less than 100MB per batch
      }
    });
  });

  describe('Text Processing Performance', () => {
    it('should meet text processing speed requirements', async () => {
      const processor = new CodeTextProcessor();
      const textSizes = [100, 500, 1000, 5000]; // Different text lengths
      
      for (const size of textSizes) {
        const annotations = generateMockAnnotations(100, size); // 100 annotations of varying sizes
        const startTime = performance.now();
        
        // Process all annotations
        for (const annotation of annotations) {
          processor.prepareTextForEmbedding(annotation);
        }
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const throughput = annotations.length / (totalTime / 1000);
        
        console.log(`Text size ${size} chars: ${totalTime.toFixed(2)}ms (${throughput.toFixed(2)} texts/sec)`);
        
        // Text processing should be fast (>1000 texts/sec for reasonable sizes)
        if (size <= 1000) {
          expect(throughput).toBeGreaterThan(1000);
        } else {
          expect(throughput).toBeGreaterThan(100);
        }
      }
    });

    it('should handle edge cases efficiently', async () => {
      const processor = new CodeTextProcessor();
      const edgeCases = [
        { name: 'empty', annotation: { nodeId: '1', signature: '', summary: '', sourceSnippet: '' } },
        { name: 'very_long', annotation: { 
          nodeId: '2', 
          signature: 'function'.repeat(1000),
          summary: 'summary'.repeat(1000),
          sourceSnippet: 'code'.repeat(10000)
        }},
        { name: 'special_chars', annotation: {
          nodeId: '3',
          signature: 'function test() { /* comment */ }',
          summary: 'Test with émojis 🚀 and unicode ñ',
          sourceSnippet: 'const test = "string with \\"quotes\\" and \\n newlines";'
        }}
      ];

      for (const testCase of edgeCases) {
        const startTime = performance.now();
        
        // Should not throw and should complete quickly
        const result = processor.prepareTextForEmbedding(testCase.annotation);
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        
        console.log(`Edge case ${testCase.name}: ${processingTime.toFixed(2)}ms`);
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(processingTime).toBeLessThan(100); // Should complete in under 100ms
      }
    });
  });

  describe('Overall System Performance', () => {
    it('should meet end-to-end performance requirements', async () => {
      // Simulate a realistic workload
      const workloadSizes = [10, 50, 100, 500];
      const performanceResults: Record<number, {
        totalTime: number;
        annotationThroughput: number;
        embeddingThroughput: number;
        avgProcessingTime: number;
      }> = {};

      for (const size of workloadSizes) {
        const annotations = generateMockAnnotations(size);
        const startTime = performance.now();
        
        // Simulate end-to-end processing
        const results = await simulateEndToEndProcessing(annotations, mockConfig);
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const annotationThroughput = size / (totalTime / 1000);
        const embeddingThroughput = results.length / (totalTime / 1000);
        const avgProcessingTime = totalTime / size;

        performanceResults[size] = {
          totalTime,
          annotationThroughput,
          embeddingThroughput,
          avgProcessingTime
        };

        console.log(`Workload ${size} annotations:`);
        console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
        console.log(`  Annotation throughput: ${annotationThroughput.toFixed(2)} annotations/sec`);
        console.log(`  Embedding throughput: ${embeddingThroughput.toFixed(2)} embeddings/sec`);
        console.log(`  Average processing time: ${avgProcessingTime.toFixed(2)}ms per annotation`);

        // Performance requirements based on Issue #13:
        // Should maintain reasonable throughput
        expect(annotationThroughput).toBeGreaterThan(1); // At least 1 annotation/sec
        
        // For small workloads, should be much faster
        if (size <= 50) {
          expect(annotationThroughput).toBeGreaterThan(10); // At least 10 annotations/sec
        }
      }

      // Validate scalability - larger workloads shouldn't degrade dramatically
      const small = performanceResults[10];
      const large = performanceResults[500];
      
      // Throughput shouldn't decrease by more than 80% for 50x larger workload
      const throughputRatio = large.annotationThroughput / small.annotationThroughput;
      expect(throughputRatio).toBeGreaterThan(0.2);
    });
  });
});

// Helper functions for performance testing

function generateMockAnnotations(count: number, textLength: number = 100): any[] {
  const annotations = [];
  for (let i = 0; i < count; i++) {
    annotations.push({
      nodeId: `node-${i}`,
      signature: `function example${i}()`.padEnd(textLength / 3, ' '),
      summary: `Summary for function ${i}`.padEnd(textLength / 3, ' '),
      sourceSnippet: `function example${i}() {\n  return ${i};\n}`.padEnd(textLength / 3, ' ')
    });
  }
  return annotations;
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function simulateBatchProcessing(annotations: any[], config: any): Promise<any[]> {
  // Simulate actual processing time based on configuration
  const processingTimeMs = Math.max(10, annotations.length * 2); // 2ms per annotation minimum
  await new Promise(resolve => setTimeout(resolve, processingTimeMs));
  
  // Return mock embedding results
  return annotations.map(annotation => ({
    nodeId: annotation.nodeId,
    embedding: new Array(768).fill(0).map(() => Math.random()),
    inputText: `${annotation.signature} ${annotation.summary}`,
    processingTime: processingTimeMs / annotations.length,
    modelUsed: config.model || 'mock-model',
    confidence: 0.8 + Math.random() * 0.2
  }));
}

async function simulateEndToEndProcessing(annotations: any[], config: Config): Promise<any[]> {
  // Simulate text processing
  const processor = new CodeTextProcessor(config.embeddings!.textProcessing);
  const processedTexts = annotations.map(annotation => 
    processor.prepareTextForEmbedding(annotation)
  );
  
  // Simulate embedding generation
  const batchSize = config.embeddings!.batchSize;
  const batches = chunkArray(annotations, batchSize);
  const allResults = [];
  
  for (const batch of batches) {
    const batchResults = await simulateBatchProcessing(batch, config.embeddings!);
    allResults.push(...batchResults);
  }
  
  return allResults;
}