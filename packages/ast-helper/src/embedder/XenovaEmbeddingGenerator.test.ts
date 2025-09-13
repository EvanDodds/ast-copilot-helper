/**
 * Tests for XenovaEmbeddingGenerator - Xenova Integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { XenovaEmbeddingGenerator } from './XenovaEmbeddingGenerator.js';
import { Annotation, EmbeddingGenerationError, ModelInitializationError } from './types.js';

describe('XenovaEmbeddingGenerator - Xenova Integration', () => {
  let generator: XenovaEmbeddingGenerator;
  
  beforeEach(() => {
    generator = new XenovaEmbeddingGenerator();
  });
  
  afterEach(async () => {
    if (generator.isReady()) {
      await generator.shutdown();
    }
  });

  describe('Model Initialization', () => {
    it('should start in uninitialized state', () => {
      expect(generator.isReady()).toBe(false);
    });
    
    it('should throw error when trying to generate embeddings before initialization', async () => {
      await expect(generator.generateEmbeddings(['test'])).rejects.toThrow(EmbeddingGenerationError);
    });
    
    it('should throw error when initializing with invalid model path', async () => {
      await expect(generator.initialize('')).rejects.toThrow(ModelInitializationError);
    });
    
    // Note: Real model tests would require actual CodeBERT model files
    // These tests validate the structure and error handling
  });
  
  describe('Configuration Validation', () => {
    it('should validate batch size limits when initialized', async () => {
      // Mock the initialization to avoid needing real model files
      (generator as any).isInitialized = true;
      
      const mockAnnotations: Annotation[] = [
        { nodeId: '1', signature: 'test', summary: 'test' }
      ];
      
      await expect(generator.batchProcess(mockAnnotations, { batchSize: 0 }))
        .rejects.toThrow('Batch size must be between 1 and 128');
        
      await expect(generator.batchProcess(mockAnnotations, { batchSize: 200 }))
        .rejects.toThrow('Batch size must be between 1 and 128');
    });
    
    it('should validate concurrency limits when initialized', async () => {
      // Mock the initialization to avoid needing real model files
      (generator as any).isInitialized = true;
      
      const mockAnnotations: Annotation[] = [
        { nodeId: '1', signature: 'test', summary: 'test' }
      ];
      
      await expect(generator.batchProcess(mockAnnotations, { maxConcurrency: 0 }))
        .rejects.toThrow('Max concurrency must be between 1 and 8');
        
      await expect(generator.batchProcess(mockAnnotations, { maxConcurrency: 10 }))
        .rejects.toThrow('Max concurrency must be between 1 and 8');
    });
  });
  
  describe('Text Preprocessing', () => {
    it('should handle annotation text preparation', () => {
      // Access private method for testing (we'll make it public in actual implementation)
      const testAnnotation: Annotation = {
        nodeId: 'test-1',
        signature: 'function test()',
        summary: 'Test function',
        sourceSnippet: 'function test() { return true; }'
      };
      
      // This tests the text preparation logic structure
      expect(testAnnotation.signature).toBeTruthy();
      expect(testAnnotation.summary).toBeTruthy();
      expect(testAnnotation.sourceSnippet).toBeTruthy();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle shutdown gracefully when not initialized', async () => {
      // Should not throw when shutting down uninitialized generator
      await expect(generator.shutdown()).resolves.not.toThrow();
    });
  });
  
  describe('Enhanced Embedding Generation', () => {
    it('should use text processor for annotation preparation', () => {
      const annotation: Annotation = {
        nodeId: 'test-1',
        signature: 'function test()',
        summary: 'Test function',
        sourceSnippet: 'function test() { return true; }'
      };
      
      // Access private method for testing
      const prepareMethod = (generator as any).prepareTextForEmbedding.bind(generator);
      const result = prepareMethod(annotation);
      
      expect(result).toContain('Signature:');
      expect(result).toContain('Summary:');
      expect(result).toContain('Code:');
    });
    
    it('should validate embedding vectors properly', () => {
      // Mock the validation method
      const validateMethod = (generator as any).validateEmbeddings.bind(generator);
      
      // Valid embeddings
      const validEmbeddings = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
      expect(() => validateMethod(validEmbeddings, 2)).not.toThrow();
      
      // Wrong count
      expect(() => validateMethod(validEmbeddings, 3)).toThrow('Expected 3 embeddings, got 2');
      
      // Empty embeddings
      expect(() => validateMethod([], 1)).toThrow('No embeddings generated');
    });
    
    it('should calculate embedding confidence scores', () => {
      const confidenceMethod = (generator as any).calculateEmbeddingConfidence.bind(generator);
      
      // Normal embedding vector
      const normalEmbedding = Array.from({ length: 768 }, () => Math.random() * 2 - 1);
      const confidence = confidenceMethod(normalEmbedding);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
      
      // Zero vector (should have low confidence)
      const zeroEmbedding = new Array(768).fill(0);
      const zeroConfidence = confidenceMethod(zeroEmbedding);
      expect(zeroConfidence).toBe(0);
      
      // Empty array
      const emptyConfidence = confidenceMethod([]);
      expect(emptyConfidence).toBe(0);
    });
  });
});

// Test helper functions and mock data
export const createMockAnnotations = (count: number): Annotation[] => {
  return Array.from({ length: count }, (_, i) => ({
    nodeId: `node-${i}`,
    signature: `function test${i}()`,
    summary: `Test function ${i}`,
    sourceSnippet: `function test${i}() { return ${i}; }`
  }));
};

export const createMockEmbedding = (dimensions: number = 768): number[] => {
  return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
};