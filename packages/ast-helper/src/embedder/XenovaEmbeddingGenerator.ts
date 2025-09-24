/**
 * Xenova Transformers-based embedding generator implementation
 */

import { pipeline, env } from '@xenova/transformers';
import path from 'path';
import type {
  EmbeddingGenerator,
  EmbeddingResult,
  BatchProcessOptions,
  Annotation,
  MemoryUsage} from './types.js';
import {
  ModelInitializationError,
  EmbeddingGenerationError,
} from './types.js';
import { CodeTextProcessor } from './TextProcessor.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  batchSize: 32,
  maxConcurrency: 2,
  memoryLimit: 2048, // 2GB in MB
  maxTokens: 2048, // Max chars for input text
  modelDimensions: 768, // CodeBERT dimensions
} as const;

/**
 * Embedding generator using Xenova Transformers with CodeBERT model
 */
export class XenovaEmbeddingGenerator implements EmbeddingGenerator {
  private model: any = null;
  private isInitialized = false;
  private modelName = '';
  private initializationTime = 0;
  private textProcessor: CodeTextProcessor;

  constructor() {
    this.textProcessor = new CodeTextProcessor();
  }

  /**
   * Initialize the embedding model
   * @param modelPath Path to the local model files
   */
  async initialize(modelPath: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('Initializing Xenova embedding model...');
      
      // Configure transformers environment for local-only operation
      env.allowLocalModels = true;
      env.allowRemoteModels = false; // Ensure no network dependency
      env.localModelPath = path.dirname(modelPath);
      env.backends.onnx.wasm.wasmPaths = path.join(path.dirname(modelPath), 'wasm/');
      
      // Force WASM backend and disable native ONNX runtime to avoid compilation issues
      env.backends.onnx.wasm.numThreads = 1;
      if (env.backends.onnx.wasm.proxy !== undefined) {
        env.backends.onnx.wasm.proxy = false;
      }
      
      // Validate model path exists
      if (!await this.validateModelPath(modelPath)) {
        throw new ModelInitializationError(
          `Model path does not exist or is not accessible: ${modelPath}`,
          { modelPath }
        );
      }
      
      console.log(`Loading model from: ${modelPath}`);
      
      // Initialize the feature extraction pipeline with CodeBERT configuration
      this.model = await pipeline('feature-extraction', modelPath, {
        quantized: false, // Use full precision for better quality
        progress_callback: undefined, // Disable progress for production
        local_files_only: true, // Enforce local-only operation
        revision: 'main',
      });
      
      this.modelName = path.basename(modelPath);
      this.initializationTime = Date.now() - startTime;
      this.isInitialized = true;
      
      console.log(`✅ Model "${this.modelName}" loaded successfully in ${this.initializationTime}ms`);
      
      // Verify model works with a test embedding
      await this.validateModelOperation();
      
    } catch (error: any) {
      this.isInitialized = false;
      const errorMessage = `Failed to initialize embedding model: ${error.message}`;
      console.error('❌ Model initialization failed:', error);
      
      throw new ModelInitializationError(errorMessage, {
        modelPath,
        originalError: error.message,
        initializationTime: Date.now() - startTime,
      });
    }
  }

  /**
   * Generate embeddings for an array of texts
   * @param texts Array of input texts (preprocessed)
   * @returns Array of embedding vectors
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized || !this.model) {
      throw new EmbeddingGenerationError('Embedding generator not initialized');
    }
    
    if (texts.length === 0) {
      return [];
    }
    
    // Validate input texts
    this.validateInputTexts(texts);
    
    try {
      const startTime = Date.now();
      
      // Process texts through the model with proper configuration
      const outputs = await this.model(texts, {
        pooling: 'mean', // Mean pooling for sentence-level embeddings
        normalize: true, // L2 normalize embeddings for better similarity computation
      });
      
      const processingTime = Date.now() - startTime;
      
      // Convert tensor outputs to standard JavaScript arrays
      const embeddings: number[][] = outputs.tolist();
      
      // Validate output embeddings
      this.validateEmbeddings(embeddings, texts.length);
      
      console.log(`Generated ${embeddings.length} embeddings in ${processingTime}ms (${(processingTime / texts.length).toFixed(2)}ms per embedding)`);
      
      return embeddings;
      
    } catch (error: any) {
      throw new EmbeddingGenerationError(
        `Embedding generation failed: ${error.message}`,
        { 
          textsCount: texts.length,
          modelName: this.modelName,
          originalError: error.message 
        }
      );
    }
  }

  /**
   * Process annotations in batches with memory management and progress reporting
   * @param annotations Array of annotations to process
   * @param options Batch processing configuration
   * @returns Array of embedding results
   */
  async batchProcess(
    annotations: Annotation[], 
    options: Partial<BatchProcessOptions> = {}
  ): Promise<EmbeddingResult[]> {
    if (!this.isInitialized) {
      throw new EmbeddingGenerationError('Embedding generator not initialized');
    }
    
    const config = {
      batchSize: options.batchSize ?? DEFAULT_CONFIG.batchSize,
      maxConcurrency: options.maxConcurrency ?? DEFAULT_CONFIG.maxConcurrency,
      memoryLimit: options.memoryLimit ?? DEFAULT_CONFIG.memoryLimit,
      progressCallback: options.progressCallback,
    };
    
    // Validate configuration
    if (config.batchSize < 1 || config.batchSize > 128) {
      throw new EmbeddingGenerationError('Batch size must be between 1 and 128');
    }
    
    if (config.maxConcurrency < 1 || config.maxConcurrency > 8) {
      throw new EmbeddingGenerationError('Max concurrency must be between 1 and 8');
    }
    
    console.log(`🚀 Processing ${annotations.length} annotations in batches of ${config.batchSize} (concurrency: ${config.maxConcurrency})`);
    
    const results: EmbeddingResult[] = [];
    const batches = this.createBatches(annotations, config.batchSize);
    const totalBatches = batches.length;
    
    // Process batches with controlled concurrency
    for (let i = 0; i < batches.length; i += config.maxConcurrency) {
      const concurrentBatches = batches.slice(i, i + config.maxConcurrency);
      
      // Check memory usage before processing batch group
      const memoryStatus = this.checkMemoryUsage(config.memoryLimit);
      if (memoryStatus.shouldCleanup) {
        console.log('🧹 Memory usage high, performing cleanup...');
        await this.performMemoryCleanup();
      }
      
      // Process batches in parallel (within concurrency limit)
      const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
        const actualBatchNumber = i + batchIndex + 1;
        return await this.processBatch(batch, actualBatchNumber, totalBatches);
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten results and add to main results array
      for (const batchResult of batchResults) {
        results.push(...batchResult);
      }
      
      // Report progress
      if (config.progressCallback) {
        config.progressCallback(results.length, annotations.length);
      }
      
      // Log progress
      const progressPercent = ((results.length / annotations.length) * 100).toFixed(1);
      console.log(`📊 Progress: ${results.length}/${annotations.length} (${progressPercent}%)`);
    }
    
    console.log(`✅ Batch processing completed: ${results.length} embeddings generated`);
    return results;
  }

  /**
   * Shutdown the embedding generator and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    try {
      console.log('🔄 Shutting down embedding generator...');
      
      // Clear model reference
      this.model = null;
      this.isInitialized = false;
      this.modelName = '';
      
      // Force garbage collection if available
      await this.performMemoryCleanup();
      
      console.log('✅ Embedding generator shutdown complete');
      
    } catch (error: any) {
      console.warn('⚠️  Error during shutdown:', error.message);
    }
  }

  /**
   * Check if the generator is initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.model !== null;
  }

  /**
   * Get model information
   */
  getModelInfo(): { name: string; initializationTime: number; dimensions: number } {
    return {
      name: this.modelName,
      initializationTime: this.initializationTime,
      dimensions: DEFAULT_CONFIG.modelDimensions,
    };
  }

  /**
   * Cleanup method for embeddings (alias for shutdown)
   */
  async cleanup(): Promise<void> {
    await this.shutdown();
  }

  // Private helper methods

  private async validateModelPath(modelPath: string): Promise<boolean> {
    try {
      // In a real implementation, this would check if the model files exist
      // For now, we'll assume the path is valid if it's not empty
      return modelPath.length > 0;
    } catch {
      return false;
    }
  }

  private async validateModelOperation(): Promise<void> {
    try {
      const testText = ['function test() { return true; }'];
      const testEmbedding = await this.generateEmbeddings(testText);
      
      if (!testEmbedding || testEmbedding.length === 0 || !testEmbedding[0] || testEmbedding[0].length === 0) {
        throw new Error('Model validation failed: no embedding generated');
      }
      
      console.log(`✅ Model validation passed (embedding dimensions: ${testEmbedding[0].length})`);
    } catch (error: any) {
      throw new ModelInitializationError(`Model validation failed: ${error.message}`);
    }
  }

  private validateInputTexts(texts: string[]): void {
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (typeof text !== 'string') {
        throw new EmbeddingGenerationError(`Invalid input at index ${i}: expected string, got ${typeof text}`);
      }
      if (text.length > DEFAULT_CONFIG.maxTokens) {
        throw new EmbeddingGenerationError(
          `Text at index ${i} exceeds maximum length of ${DEFAULT_CONFIG.maxTokens} characters`
        );
      }
    }
  }

  private async processBatch(
    annotations: Annotation[], 
    batchNumber: number, 
    totalBatches: number
  ): Promise<EmbeddingResult[]> {
    const startTime = Date.now();
    const results: EmbeddingResult[] = [];
    const errors: Array<{ nodeId: string; error: string }> = [];
    
    try {
      // Process annotations individually with error isolation
      for (let i = 0; i < annotations.length; i++) {
        const annotation = annotations[i];
        if (!annotation) {
          continue; // Skip undefined annotations
        }
        
        try {
          // Prepare input text for this annotation
          const inputText = this.prepareTextForEmbedding(annotation);
          
          // Generate embedding for this single annotation
          const embeddings = await this.generateEmbeddings([inputText]);
          
          if (embeddings && embeddings.length > 0 && embeddings[0]) {
            const embedding = embeddings[0];
            const avgTimePerItem = (Date.now() - startTime) / (i + 1);
            
            results.push({
              nodeId: annotation.nodeId,
              embedding,
              inputText,
              processingTime: avgTimePerItem,
              modelUsed: this.modelName,
              confidence: this.calculateEmbeddingConfidence(embedding),
            });
          } else {
            throw new Error('No embedding generated');
          }
          
        } catch (error: any) {
          // Isolate the error - don't let one annotation failure stop the entire batch
          const errorMsg = error.message || 'Unknown error during embedding generation';
          errors.push({ nodeId: annotation.nodeId, error: errorMsg });
          console.warn(`⚠️  Failed to process annotation ${annotation.nodeId}: ${errorMsg}`);
        }
      }
      
      const processingTime = Date.now() - startTime;
      const avgTimePerItem = processingTime / annotations.length;
      
      // Log batch completion with error summary
      if (errors.length > 0) {
        console.log(`📦 Batch ${batchNumber}/${totalBatches} completed with ${errors.length} errors in ${processingTime}ms (${avgTimePerItem.toFixed(2)}ms per item)`);
        console.log(`❌ Failed annotations: ${errors.map(e => e.nodeId).join(', ')}`);
      } else {
        console.log(`📦 Batch ${batchNumber}/${totalBatches} completed successfully in ${processingTime}ms (${avgTimePerItem.toFixed(2)}ms per item)`);
      }
      
      return results;
      
    } catch (error: any) {
      // Only throw if there's a systemic error (not individual annotation failures)
      console.error(`❌ Batch ${batchNumber} failed completely:`, error.message);
      throw new EmbeddingGenerationError(
        `Batch processing failed completely for batch ${batchNumber}: ${error.message}`,
        { batchNumber, batchSize: annotations.length, errors: errors }
      );
    }
  }

  private prepareTextForEmbedding(annotation: Annotation): string {
    // Use the specialized code text processor
    const processedText = this.textProcessor.prepareTextForEmbedding(annotation);
    
    // Validate the processed text
    const validation = this.textProcessor.validateInputText(processedText);
    if (!validation.isValid) {
      console.warn(`⚠️  Text validation issues for ${annotation.nodeId}:`, validation.issues);
      
      // Use fallback if text is invalid
      if (processedText.length === 0) {
        return `Node: ${annotation.nodeId}`;
      }
    }
    
    return processedText;
  }

  private validateEmbeddings(embeddings: number[][], expectedCount: number): void {
    if (!embeddings || embeddings.length === 0) {
      throw new EmbeddingGenerationError('No embeddings generated');
    }
    
    if (embeddings.length !== expectedCount) {
      throw new EmbeddingGenerationError(
        `Expected ${expectedCount} embeddings, got ${embeddings.length}`
      );
    }
    
    // Validate each embedding vector
    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      
      if (!embedding || !Array.isArray(embedding)) {
        throw new EmbeddingGenerationError(`Invalid embedding at index ${i}: not an array`);
      }
      
      if (embedding.length === 0) {
        throw new EmbeddingGenerationError(`Empty embedding vector at index ${i}`);
      }
      
      // Check dimensions (should be 768 for CodeBERT, but allow flexibility)
      if (i === 0) {
        if (embedding.length !== DEFAULT_CONFIG.modelDimensions) {
          console.warn(`⚠️  Expected ${DEFAULT_CONFIG.modelDimensions} dimensions, got ${embedding.length}`);
        }
      } else if (embeddings[0] && embedding.length !== embeddings[0].length) {
        throw new EmbeddingGenerationError(
          `Inconsistent embedding dimensions: expected ${embeddings[0].length}, got ${embedding.length} at index ${i}`
        );
      }
      
      // Check for valid numeric values
      for (let j = 0; j < embedding.length; j++) {
        const value = embedding[j];
        if (typeof value !== 'number' || !isFinite(value)) {
          throw new EmbeddingGenerationError(
            `Invalid embedding value at [${i}][${j}]: ${value} (not a finite number)`
          );
        }
      }
      
      // Check for reasonable value ranges (embeddings should be normalized)
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 10 || magnitude < 0.01) {
        console.warn(`⚠️  Unusual embedding magnitude ${magnitude.toFixed(4)} at index ${i}`);
      }
    }
    
    console.log(`✅ Validated ${embeddings.length} embeddings (${embeddings[0]?.length || 0} dimensions each)`);
  }

  private calculateEmbeddingConfidence(embedding: number[]): number {
    if (!embedding || embedding.length === 0) {
      return 0;
    }
    
    try {
      // Calculate statistical properties
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      const mean = embedding.reduce((sum, val) => sum + val, 0) / embedding.length;
      const variance = embedding.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / embedding.length;
      const stdDev = Math.sqrt(variance);
      
      // Check for degenerate cases
      if (magnitude === 0 || !isFinite(magnitude)) {
        return 0;
      }
      
      // Calculate entropy-like measure (higher diversity = higher confidence)
      const nonZeroValues = embedding.filter(val => Math.abs(val) > 1e-6);
      const diversityRatio = nonZeroValues.length / embedding.length;
      
      // Normalize magnitude (good embeddings typically have magnitude around 1 for normalized vectors)
      const normalizedMagnitude = Math.min(magnitude, 2.0) / 2.0;
      
      // Normalize standard deviation (measure of distribution spread)
      const normalizedStdDev = Math.min(stdDev * 2, 1.0);
      
      // Combine metrics: magnitude + distribution + diversity
      const confidence = (
        normalizedMagnitude * 0.4 +        // 40% weight on magnitude
        normalizedStdDev * 0.3 +           // 30% weight on distribution
        diversityRatio * 0.3               // 30% weight on diversity
      );
      
      return Math.max(0, Math.min(1, confidence));
      
    } catch (error) {
      console.warn('⚠️  Error calculating embedding confidence:', error);
      return 0.5; // Default confidence on error
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private checkMemoryUsage(memoryLimitMB: number): MemoryUsage {
    const memUsage = process.memoryUsage();
    const memoryThreshold = memoryLimitMB * 1024 * 1024; // Convert to bytes
    
    const usage = memUsage.heapUsed;
    const available = memoryThreshold - usage;
    const usagePercent = (usage / memoryThreshold) * 100;
    const shouldCleanup = usagePercent > 80; // Cleanup at 80% threshold
    
    return {
      usage,
      available,
      shouldCleanup,
    };
  }

  private async performMemoryCleanup(): Promise<void> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Allow event loop to process
    await new Promise(resolve => setImmediate(resolve));
  }
}