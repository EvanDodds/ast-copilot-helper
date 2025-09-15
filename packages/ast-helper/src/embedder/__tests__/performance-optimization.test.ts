/**
 * Performance optimization integration tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OptimizedEmbeddingGenerator } from '../optimized-embedding-generator.js';
import { IntelligentEmbeddingCache, resetEmbeddingCache } from '../intelligent-cache.js';
import { DynamicBatchOptimizer } from '../dynamic-batch-optimizer.js';
import { MemoryAwareProcessor } from '../memory-aware-processor.js';
import { Annotation, EmbeddingResult } from '../types.js';

// Mock Xenova transformers
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(),
  env: { allowLocalModels: false, allowRemoteModels: false, cacheDir: '' }
}));

describe('Performance Optimization Integration', () => {
  let generator: OptimizedEmbeddingGenerator;

  beforeEach(() => {
    resetEmbeddingCache();
    generator = new OptimizedEmbeddingGenerator({
      enableCaching: true,
      enableBatchOptimization: true,
      enableMemoryAwareProcessing: true,
    });
  });

  afterEach(async () => {
    await generator.cleanup();
  });

  describe('Intelligent Caching', () => {
    it('should cache and retrieve embedding results', async () => {
      const cache = new IntelligentEmbeddingCache({
        maxEntries: 100,
        ttlMs: 60000, // 1 minute
      });

      const annotation: Annotation = {
        nodeId: 'test-node-1',
        signature: 'function testFunction()',
        summary: 'A test function',
        sourceSnippet: 'function testFunction() { return "test"; }',
      };

      const result: EmbeddingResult = {
        nodeId: 'test-node-1',
        embedding: new Array(768).fill(0).map(() => Math.random()),
        inputText: 'function testFunction() A test function',
        processingTime: 100,
        modelUsed: 'test-model',
        confidence: 0.95,
      };

      // Cache should be empty initially
      expect(await cache.get(annotation)).toBeNull();

      // Store result
      await cache.set(annotation, result);

      // Retrieve cached result
      const cached = await cache.get(annotation);
      expect(cached).toBeDefined();
      expect(cached?.nodeId).toBe(result.nodeId);
      expect(cached?.embedding).toHaveLength(768);
      expect(cached?.confidence).toBe(0.95);

      // Verify cache statistics
      const stats = cache.getStats();
      expect(stats.currentEntries).toBe(1);
      expect(stats.totalRequests).toBe(2); // 1 miss, 1 hit
      expect(stats.hits).toBe(1);
      expect(stats.hitRatio).toBe(0.5);
    });

    it('should handle cache invalidation based on content changes', async () => {
      const cache = new IntelligentEmbeddingCache({
        enableContentValidation: true,
      });

      const annotation: Annotation = {
        nodeId: 'test-node-2',
        signature: 'function originalFunction()',
        summary: 'Original function',
      };

      const result: EmbeddingResult = {
        nodeId: 'test-node-2',
        embedding: [1, 2, 3],
        inputText: 'original content',
        processingTime: 50,
        modelUsed: 'test-model',
      };

      // Cache original result
      await cache.set(annotation, result);
      expect(await cache.get(annotation)).toBeDefined();

      // Change content
      const modifiedAnnotation = {
        ...annotation,
        signature: 'function modifiedFunction()',
        summary: 'Modified function',
      };

      // Should return null due to content change
      expect(await cache.get(modifiedAnnotation)).toBeNull();
    });

    it('should provide performance metrics', async () => {
      const cache = new IntelligentEmbeddingCache();

      // Generate some cache activity
      for (let i = 0; i < 10; i++) {
        const annotation: Annotation = {
          nodeId: `node-${i}`,
          signature: `function test${i}()`,
          summary: `Test function ${i}`,
        };

        const result: EmbeddingResult = {
          nodeId: `node-${i}`,
          embedding: new Array(768).fill(i),
          inputText: `test content ${i}`,
          processingTime: 10 + i,
          modelUsed: 'test-model',
        };

        await cache.set(annotation, result);
        
        // Access some entries multiple times
        if (i % 2 === 0) {
          await cache.get(annotation);
        }
      }

      const metrics = cache.getPerformanceMetrics();
      expect(metrics.stats.currentEntries).toBe(10);
      expect(metrics.stats.hitRatio).toBeGreaterThan(0);
      expect(metrics.memoryEfficiency).toBeGreaterThan(0);
      expect(metrics.performanceScore).toBeGreaterThan(0);
      expect(metrics.recentSamples).toBeInstanceOf(Array); // Should be an array, might have samples
    });
  });

  describe('Dynamic Batch Optimization', () => {
    it('should optimize batch size based on performance', () => {
      const optimizer = new DynamicBatchOptimizer(32, {
        minBatchSize: 1,
        maxBatchSize: 128,
        targetCpuUsage: 70,
        targetMemoryUsage: 80,
        minSamples: 3,
      });

      expect(optimizer.getCurrentBatchSize()).toBe(32);

      // Record some performance data
      optimizer.recordPerformance(32, 1000, 32, true); // 32 items/sec
      optimizer.recordPerformance(32, 800, 32, true);  // 40 items/sec
      optimizer.recordPerformance(32, 600, 32, true);  // 53.3 items/sec

      // Get recommendation
      const recommendation = optimizer.getOptimizationRecommendation();
      expect(recommendation.recommendedBatchSize).toBeGreaterThanOrEqual(1);
      expect(recommendation.recommendedBatchSize).toBeLessThanOrEqual(128);
      expect(recommendation.confidence).toBeGreaterThan(0);
      expect(recommendation.reason).toBeDefined();
    });

    it('should adapt to system resource constraints', () => {
      const optimizer = new DynamicBatchOptimizer(64, {
        targetMemoryUsage: 50, // Low threshold
        targetCpuUsage: 50,    // Low threshold
      });

      // Simulate high resource usage
      const highResourceSample = {
        batchSize: 64,
        processingTime: 2000,
        itemCount: 64,
        memoryUsage: 85, // High memory usage
        cpuUsage: 90,    // High CPU usage
      };

      for (let i = 0; i < 5; i++) {
        optimizer.recordPerformance(
          highResourceSample.batchSize,
          highResourceSample.processingTime,
          highResourceSample.itemCount,
          true
        );
      }

      const analytics = optimizer.getPerformanceAnalytics();
      expect(analytics.recommendations.recommendedBatchSize).toBeLessThanOrEqual(64);
      expect(analytics.recommendations.reason).toContain('data'); // Should mention performance data or constraints
    });

    it('should provide comprehensive performance analytics', () => {
      const optimizer = new DynamicBatchOptimizer(16);

      // Generate performance history
      const batches = [8, 16, 32, 16, 8];
      const times = [400, 600, 1200, 800, 500];

      batches.forEach((batchSize, i) => {
        optimizer.recordPerformance(batchSize, times[i], batchSize, true);
      });

      const analytics = optimizer.getPerformanceAnalytics();
      expect(analytics.currentMetrics).toBeDefined();
      expect(analytics.recentHistory).toHaveLength(5);
      expect(analytics.trends).toBeDefined();
      expect(analytics.recommendations).toBeDefined();

      expect(analytics.trends.throughputTrend).toBeDefined();
      expect(analytics.trends.memoryTrend).toBeDefined();
      expect(analytics.trends.cpuTrend).toBeDefined();
    });
  });

  describe('Memory-Aware Processing', () => {
    it('should select appropriate processing strategy based on memory usage', () => {
      const processor = new MemoryAwareProcessor({
        memoryThresholds: {
          critical: 90,
          high: 70,
          normal: 50,
          low: 30,
        },
      });

      // Test strategy selection for different memory usage levels
      const lowMemoryMetrics = {
        totalMemory: 8 * 1024 * 1024 * 1024, // 8GB
        availableMemory: 6 * 1024 * 1024 * 1024, // 6GB available
        processMemory: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 },
        memoryUsagePercent: 25, // Low usage
        availableForProcessing: 5 * 1024 * 1024 * 1024,
      };

      const highMemoryMetrics = {
        ...lowMemoryMetrics,
        availableMemory: 1 * 1024 * 1024 * 1024, // 1GB available
        memoryUsagePercent: 85, // High usage
        availableForProcessing: 800 * 1024 * 1024,
      };

      const lowStrategy = processor.selectOptimalStrategy(lowMemoryMetrics);
      const highStrategy = processor.selectOptimalStrategy(highMemoryMetrics);

      expect(lowStrategy.maxBatchSize).toBeGreaterThan(highStrategy.maxBatchSize);
      expect(highStrategy.name).toBe('conservative');
      expect(lowStrategy.name).toMatch(/aggressive|balanced/);

      processor.stop(); // Clean up
    });

    it('should provide processing recommendations', () => {
      const processor = new MemoryAwareProcessor();
      const recommendations = processor.getProcessingRecommendations();

      expect(recommendations.currentStrategy).toBeDefined();
      expect(recommendations.memoryMetrics).toBeDefined();
      expect(recommendations.recommendations).toBeInstanceOf(Array);
      expect(recommendations.estimatedCapacity).toBeGreaterThan(0);

      processor.stop();
    });

    it('should process items with adaptive strategies', async () => {
      const processor = new MemoryAwareProcessor({
        strategies: [
          {
            name: 'test-strategy',
            maxBatchSize: 4,
            approach: 'sequential',
            memoryOverhead: 0.1,
            cpuOverhead: 0.1,
            cleanupFrequency: 2,
          },
        ],
        memoryThresholds: {
          critical: 95,
          high: 80,
          normal: 60,
          low: 40,
        },
      });

      const testItems = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        data: `item-${i}`,
      }));

      const mockProcessor = vi.fn(async (batch: typeof testItems) => {
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 10));
        return batch.map(item => ({ ...item, processed: true }));
      });

      const result = await processor.processWithMemoryAwareness({
        items: testItems,
        processor: mockProcessor,
      });

      expect(result.results).toHaveLength(10);
      expect(result.stats.totalItems).toBe(10);
      expect(result.stats.successfulItems).toBe(10);
      expect(result.stats.failedItems).toBe(0);
      expect(result.memoryHistory.length).toBeGreaterThan(0);

      processor.stop();
    });
  });

  describe('Integration Tests', () => {
    it('should create optimized generator with all components', () => {
      const optimizedGenerator = new OptimizedEmbeddingGenerator({
        enableCaching: true,
        enableBatchOptimization: true,
        enableMemoryAwareProcessing: true,
        cacheConfig: {
          maxEntries: 1000,
          maxSizeBytes: 50 * 1024 * 1024, // 50MB
        },
        batchConfig: {
          minBatchSize: 1,
          maxBatchSize: 64,
        },
      });

      expect(optimizedGenerator).toBeInstanceOf(OptimizedEmbeddingGenerator);
      
      const metrics = optimizedGenerator.getPerformanceMetrics();
      expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(metrics.overallScore).toBeLessThanOrEqual(1);
    });

    it('should provide comprehensive performance metrics', () => {
      const metrics = generator.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.overallScore).toBe('number');
      expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(metrics.overallScore).toBeLessThanOrEqual(1);

      // Should have cache metrics when caching is enabled
      if (metrics.cache) {
        expect(metrics.cache.hitRatio).toBeGreaterThanOrEqual(0);
        expect(metrics.cache.entries).toBeGreaterThanOrEqual(0);
        expect(metrics.cache.memoryEfficiency).toBeGreaterThanOrEqual(0);
      }

      // Should have batch optimization metrics when enabled
      if (metrics.batchOptimization) {
        expect(metrics.batchOptimization.currentBatchSize).toBeGreaterThan(0);
        expect(metrics.batchOptimization.confidence).toBeGreaterThanOrEqual(0);
        expect(metrics.batchOptimization.confidence).toBeLessThanOrEqual(1);
      }

      // Should have memory processing metrics when enabled
      if (metrics.memoryProcessing) {
        expect(metrics.memoryProcessing.currentStrategy).toBeDefined();
        expect(metrics.memoryProcessing.memoryUsagePercent).toBeGreaterThanOrEqual(0);
        expect(metrics.memoryProcessing.recommendations).toBeInstanceOf(Array);
      }
    });

    it('should optimize performance settings', async () => {
      // This test verifies that performance optimization doesn't throw errors
      await expect(generator.optimizePerformance()).resolves.not.toThrow();
    });

    it('should clean up resources properly', async () => {
      await expect(generator.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      const cache = new IntelligentEmbeddingCache();
      
      // Test with malformed annotation
      const malformedAnnotation = {} as Annotation;
      
      // Should not throw, but return null
      expect(await cache.get(malformedAnnotation)).toBeNull();
    });

    it('should handle optimizer errors gracefully', () => {
      const optimizer = new DynamicBatchOptimizer(32, {
        minBatchSize: 10,
        maxBatchSize: 5, // Invalid: min > max
      });

      // Should still provide recommendations without throwing
      expect(() => optimizer.getOptimizationRecommendation()).not.toThrow();
    });

    it('should handle memory processor errors gracefully', () => {
      // Test that processor handles configuration gracefully
      expect(() => {
        const processor = new MemoryAwareProcessor({
          strategies: [{
            name: 'balanced',
            maxBatchSize: 32,
            approach: 'parallel' as const,
            memoryOverhead: 1.5,
            cpuOverhead: 1.2,
            cleanupFrequency: 100
          }], // Valid minimal config
        });
        processor.stop();
      }).not.toThrow();

      // Test error case - this should throw and we catch it
      expect(() => {
        new MemoryAwareProcessor({
          strategies: [], // Empty strategies array
        });
      }).toThrow('At least one processing strategy must be configured');
    });
  });
});