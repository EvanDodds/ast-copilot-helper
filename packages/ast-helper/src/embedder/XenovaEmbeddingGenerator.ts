/**
 * Xenova Transformers-based embedding generator implementation
 */

import { pipeline, env } from '@xenova/transformers';
import path from 'path';
import {
  EmbeddingGenerator,
  EmbeddingResult,
  BatchProcessOptions,
  Annotation,
  MemoryUsage,
  ModelInitializationError,
  EmbeddingGenerationError,
} from './types.js';

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
  private isInitialized: boolean = false;
  private modelName: string = '';
  private initializationTime: number = 0;

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
      
      // Validate output dimensions
      if (embeddings.length > 0 && embeddings[0] && embeddings[0].length !== DEFAULT_CONFIG.modelDimensions) {
        console.warn(`⚠️  Expected ${DEFAULT_CONFIG.modelDimensions} dimensions, got ${embeddings[0].length}`);
      }
      
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
    
    try {
      // Prepare input texts for embedding
      const inputTexts = annotations.map(annotation => 
        this.prepareTextForEmbedding(annotation)
      );
      
      // Generate embeddings for the batch
      const embeddings = await this.generateEmbeddings(inputTexts);
      
      const processingTime = Date.now() - startTime;
      const avgTimePerItem = processingTime / annotations.length;
      
      console.log(`📦 Batch ${batchNumber}/${totalBatches} completed in ${processingTime}ms (${avgTimePerItem.toFixed(2)}ms per item)`);
      
      // Create embedding results
      const results: EmbeddingResult[] = annotations.map((annotation, index) => {
        const embedding = embeddings[index];
        const inputText = inputTexts[index];
        
        if (!embedding || !inputText) {
          throw new EmbeddingGenerationError(`Missing embedding or input text for annotation ${annotation.nodeId}`);
        }
        
        return {
          nodeId: annotation.nodeId,
          embedding,
          inputText,
          processingTime: avgTimePerItem,
          modelUsed: this.modelName,
          confidence: this.calculateEmbeddingConfidence(embedding),
        };
      });
      
      return results;
      
    } catch (error: any) {
      console.error(`❌ Batch ${batchNumber} failed:`, error.message);
      throw new EmbeddingGenerationError(
        `Batch processing failed for batch ${batchNumber}: ${error.message}`,
        { batchNumber, batchSize: annotations.length }
      );
    }
  }

  private prepareTextForEmbedding(annotation: Annotation): string {
    // Combine signature, summary, and source snippet for rich context
    const components: string[] = [];
    
    if (annotation.signature) {
      components.push(`Signature: ${annotation.signature}`);
    }
    
    if (annotation.summary) {
      components.push(`Summary: ${annotation.summary}`);
    }
    
    if (annotation.sourceSnippet) {
      // Limit snippet size to prevent token overflow
      const snippet = annotation.sourceSnippet.length > 500 
        ? annotation.sourceSnippet.substring(0, 500) + '...'
        : annotation.sourceSnippet;
      components.push(`Code: ${snippet}`);
    }
    
    let combinedText = components.join(' | ');
    
    // Ensure text is within token limits
    if (combinedText.length > DEFAULT_CONFIG.maxTokens) {
      combinedText = combinedText.substring(0, DEFAULT_CONFIG.maxTokens - 3) + '...';
    }
    
    // Validate that we have some content
    if (!combinedText.trim()) {
      combinedText = `Node: ${annotation.nodeId}`; // Fallback content
    }
    
    return combinedText;
  }

  private calculateEmbeddingConfidence(embedding: number[]): number {
    if (!embedding || embedding.length === 0) {
      return 0;
    }
    
    // Calculate confidence based on embedding magnitude and distribution
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const mean = embedding.reduce((sum, val) => sum + val, 0) / embedding.length;
    const variance = embedding.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / embedding.length;
    
    // Normalize metrics to 0-1 range
    const normalizedMagnitude = Math.min(magnitude, 1.0);
    const normalizedVariance = Math.min(variance * 10, 1.0); // Scale variance
    
    // Combine metrics for confidence score
    const confidence = (normalizedMagnitude + normalizedVariance) / 2;
    
    return Math.max(0, Math.min(1, confidence)); // Ensure 0-1 range
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