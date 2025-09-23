/**
 * Performance benchmarking test for Issue #13 acceptance criteria
 * Tests: "Performance target: Process 1000 annotations in <60s"
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { XenovaEmbeddingGenerator } from '../XenovaEmbeddingGenerator.js';
import { Annotation } from '../../types.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { promises as fs } from 'fs';

describe('Performance Benchmarking - Issue #13 Requirements', () => {
  let generator: XenovaEmbeddingGenerator;
  let testDir: string;
  let mockAnnotations: Annotation[];

  beforeAll(async () => {
    testDir = join(tmpdir(), `performance-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create 1000 mock annotations for performance testing
    mockAnnotations = Array.from({ length: 1000 }, (_, i) => ({
      nodeId: `test-node-${i}`,
      signature: `function testFunction${i}(param: string): Promise<any>`,
      summary: `Test function ${i} that performs mock operations for performance testing`,
      sourceSnippet: `
        function testFunction${i}(param: string): Promise<any> {
          const data = processData(param);
          return Promise.resolve(data.transform());
        }
      `,
      startLine: i * 10,
      endLine: i * 10 + 5,
      filePath: `/test/file-${Math.floor(i / 100)}.ts`,
      fileId: `file-${Math.floor(i / 100)}`,
      lastModified: new Date(),
      language: 'typescript',
      confidence: 0.9,
      type: 'function',
      complexity: Math.floor(Math.random() * 10) + 1,
      dependencies: [`dep-${i % 50}`],
      tags: ['test', 'mock']
    }));

    console.log(`Created ${mockAnnotations.length} mock annotations for performance testing`);
  });

  afterAll(async () => {
    if (generator) {
      await generator.shutdown();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  it('should process 1000 annotations in less than 60 seconds', async () => {
    // This test validates Issue #13 acceptance criteria:
    // "Performance target: Process 1000 annotations in <60s"
    
    console.log('🚀 Starting performance benchmark: 1000 annotations processing...');
    
    // Initialize generator with mock model (for testing purposes)
    generator = new XenovaEmbeddingGenerator();
    
    // Mock the model initialization to avoid actual model download
    // In a real scenario, this would use an actual model
    const mockModelPath = join(testDir, 'mock-model');
    await fs.mkdir(mockModelPath, { recursive: true });
    
    // Start timing
    const startTime = Date.now();
    
    try {
      // Initialize the generator
      await generator.initialize(mockModelPath);
      
      // Process the annotations in batches
      const results = await generator.batchProcess(mockAnnotations, {
        batchSize: 32,
        maxConcurrency: 2,
        memoryLimit: 2048,
        progressCallback: (_processed, _total) => {
          if (_processed % 200 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            console.log(`📊 Progress: ${_processed}/${_total} annotations (${elapsed.toFixed(1)}s)`);
          }
        }
      });
      
      const endTime = Date.now();
      const totalTime = (endTime - startTime) / 1000; // Convert to seconds
      
      console.log(`✅ Performance test completed!`);
      console.log(`📈 Total processing time: ${totalTime.toFixed(2)} seconds`);
      console.log(`📊 Processed ${results.length} annotations`);
      console.log(`⚡ Rate: ${(results.length / totalTime).toFixed(2)} annotations/second`);
      
      // Validate the acceptance criteria
      expect(totalTime).toBeLessThan(60); // Must complete in less than 60 seconds
      expect(results.length).toBe(1000); // Must process all 1000 annotations
      
      // Additional performance metrics
      expect(results.length / totalTime).toBeGreaterThan(16); // Should be >16 annotations/second
      
      console.log(`🎯 PASS: Processed 1000 annotations in ${totalTime.toFixed(2)}s (target: <60s)`);
      
    } catch (error: any) {
      const elapsed = (Date.now() - startTime) / 1000;
      console.error(`❌ Performance test failed after ${elapsed.toFixed(2)}s: ${error.message}`);
      throw error;
    }
  }, 70000); // Allow 70 seconds for the test itself (includes setup time)

  it('should maintain consistent performance across multiple batches', async () => {
    // Additional performance validation
    console.log('🔄 Testing batch processing consistency...');
    
    generator = new XenovaEmbeddingGenerator();
    const mockModelPath = join(testDir, 'mock-model-2');
    await fs.mkdir(mockModelPath, { recursive: true });
    
    await generator.initialize(mockModelPath);
    
    // Process in smaller batches to test consistency
    const batchSizes = [50, 100, 200];
    const timings: number[] = [];
    
    for (const batchSize of batchSizes) {
      const batch = mockAnnotations.slice(0, batchSize);
      const startTime = Date.now();
      
      const results = await generator.batchProcess(batch, {
        batchSize: 16,
        maxConcurrency: 1,
        memoryLimit: 1024
      });
      
      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;
      const rate = results.length / processingTime;
      
      timings.push(rate);
      
      console.log(`📦 Batch size ${batchSize}: ${processingTime.toFixed(2)}s (${rate.toFixed(2)} ann/s)`);
      
      expect(results.length).toBe(batchSize);
      expect(rate).toBeGreaterThan(10); // Minimum rate threshold
    }
    
    // Check that performance is consistent (variance should be reasonable)
    const avgRate = timings.reduce((sum, rate) => sum + rate, 0) / timings.length;
    const variance = timings.reduce((sum, rate) => sum + Math.pow(rate - avgRate, 2), 0) / timings.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgRate;
    
    console.log(`📊 Average rate: ${avgRate.toFixed(2)} ann/s, CV: ${(coefficientOfVariation * 100).toFixed(1)}%`);
    
    // Performance should be reasonably consistent (CV < 50%)
    expect(coefficientOfVariation).toBeLessThan(0.5);
    
  }, 30000);

  it('should handle memory constraints during large batch processing', async () => {
    // Test memory management under performance pressure
    console.log('💾 Testing memory management during performance processing...');
    
    generator = new XenovaEmbeddingGenerator();
    const mockModelPath = join(testDir, 'mock-model-3');
    await fs.mkdir(mockModelPath, { recursive: true });
    
    await generator.initialize(mockModelPath);
    
    const startTime = Date.now();
    const memoryPeaks: number[] = [];
    
    const results = await generator.batchProcess(mockAnnotations, {
      batchSize: 64,
      maxConcurrency: 3,
      memoryLimit: 1024, // Lower memory limit to test management
      progressCallback: (_processed, _total) => {
        // Track memory usage during processing
        const memUsage = process.memoryUsage();
        memoryPeaks.push(memUsage.heapUsed / 1024 / 1024); // MB
      }
    });
    
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    const maxMemory = Math.max(...memoryPeaks);
    
    console.log(`⏱️  Processing time: ${totalTime.toFixed(2)}s`);
    console.log(`💾 Peak memory usage: ${maxMemory.toFixed(1)} MB`);
    console.log(`📊 Processed: ${results.length} annotations`);
    
    // Validate performance and memory constraints
    expect(totalTime).toBeLessThan(120); // Allow more time due to memory constraints
    expect(results.length).toBe(1000);
    expect(maxMemory).toBeLessThan(2048); // Should stay within memory limits
    
  }, 150000); // Allow more time for memory-constrained test
});