/**
 * Mock LLM and Embedding Providers for Performance Testing
 *
 * These mocks simulate realistic API behavior without making actual API calls:
 * - Realistic latency (based on token count and model speed)
 * - Deterministic output (for reproducible benchmarks)
 * - Quality metrics calculation (for validation)
 */

import type { AnnotationInsert } from "../../packages/ast-helper/src/database/annotation-manager.js";

/**
 * Configuration for mock LLM provider
 */
export interface MockLLMConfig {
  /** Average milliseconds per token generated */
  msPerToken: number;
  /** Base latency for API call (network + overhead) */
  baseLatencyMs: number;
  /** Whether to add realistic variance to timing */
  addVariance: boolean;
}

/**
 * Configuration for mock embedding provider
 */
export interface MockEmbeddingConfig {
  /** Average milliseconds per token embedded */
  msPerToken: number;
  /** Base latency for API call (network + overhead) */
  baseLatencyMs: number;
  /** Dimensionality of embedding vectors */
  dimensions: number;
  /** Whether to add realistic variance to timing */
  addVariance: boolean;
}

/**
 * Mock LLM Provider
 *
 * Simulates OpenAI/Anthropic/etc API behavior for annotation generation.
 * Provides deterministic, realistic annotations for benchmarking.
 */
export class MockLLMProvider {
  private config: MockLLMConfig;

  constructor(config?: Partial<MockLLMConfig>) {
    this.config = {
      msPerToken: 20, // GPT-4 Turbo speed: ~50 tokens/second
      baseLatencyMs: 200, // Network latency + API overhead
      addVariance: true,
      ...config,
    };
  }

  /**
   * Generate annotation for a code node
   */
  async generateAnnotation(
    nodeId: string,
    filePath: string,
    nodeType: string,
    signature: string,
    codeContext: string,
  ): Promise<AnnotationInsert> {
    // Calculate realistic timing
    const estimatedTokens = Math.ceil(codeContext.length / 4); // ~4 chars per token
    const generationTime = estimatedTokens * this.config.msPerToken;
    const totalLatency =
      this.config.baseLatencyMs +
      generationTime +
      (this.config.addVariance ? Math.random() * 50 - 25 : 0);

    // Simulate API call delay
    await this.sleep(totalLatency);

    // Generate deterministic annotation based on node characteristics
    const complexity = this.calculateComplexity(signature, codeContext);
    const dependencies = this.extractDependencies(codeContext);

    return {
      node_id: nodeId,
      file_path: filePath,
      start_line: 0,
      end_line: 0,
      node_type: nodeType,
      signature,
      complexity_score: complexity,
      dependencies,
      metadata: {
        model: "mock-gpt-4-turbo",
        latency_ms: totalLatency,
        estimated_tokens: estimatedTokens,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate annotations for multiple nodes in batch
   */
  async generateAnnotationsBatch(
    nodes: Array<{
      nodeId: string;
      filePath: string;
      nodeType: string;
      signature: string;
      codeContext: string;
    }>,
  ): Promise<AnnotationInsert[]> {
    // Batch requests have better efficiency (reduced per-request overhead)
    const batchOverhead = this.config.baseLatencyMs; // Single API call overhead
    const totalTokens = nodes.reduce(
      (sum, node) => sum + Math.ceil(node.codeContext.length / 4),
      0,
    );
    const totalLatency =
      batchOverhead +
      totalTokens * this.config.msPerToken +
      (this.config.addVariance ? Math.random() * 100 - 50 : 0);

    await this.sleep(totalLatency);

    return Promise.all(
      nodes.map((node) => {
        const complexity = this.calculateComplexity(
          node.signature,
          node.codeContext,
        );
        const dependencies = this.extractDependencies(node.codeContext);

        return Promise.resolve({
          node_id: node.nodeId,
          file_path: node.filePath,
          start_line: 0,
          end_line: 0,
          node_type: node.nodeType,
          signature: node.signature,
          complexity_score: complexity,
          dependencies,
          metadata: {
            model: "mock-gpt-4-turbo-batch",
            batch_size: nodes.length,
            total_latency_ms: totalLatency,
            estimated_tokens: totalTokens,
            timestamp: new Date().toISOString(),
          },
        });
      }),
    );
  }

  /**
   * Calculate quality metrics for annotations
   */
  calculateQualityMetrics(annotations: AnnotationInsert[]): {
    accuracy: number;
    relevance: number;
    completeness: number;
    averageScore: number;
  } {
    // Mock quality metrics based on annotation characteristics
    let totalAccuracy = 0;
    let totalRelevance = 0;
    let totalCompleteness = 0;

    for (const annotation of annotations) {
      // Accuracy: Based on complexity score reasonableness (0-10 scale)
      const accuracy =
        annotation.complexity_score >= 0 && annotation.complexity_score <= 10
          ? 1.0
          : 0.5;
      totalAccuracy += accuracy;

      // Relevance: Based on dependencies count (having dependencies shows context understanding)
      const relevance =
        annotation.dependencies.length > 0
          ? Math.min(1.0, annotation.dependencies.length / 5)
          : 0.5;
      totalRelevance += relevance;

      // Completeness: Based on metadata presence and signature
      const completeness =
        annotation.signature && annotation.metadata ? 1.0 : 0.7;
      totalCompleteness += completeness;
    }

    const count = annotations.length || 1;
    const accuracy = totalAccuracy / count;
    const relevance = totalRelevance / count;
    const completeness = totalCompleteness / count;
    const averageScore = (accuracy + relevance + completeness) / 3;

    return {
      accuracy,
      relevance,
      completeness,
      averageScore,
    };
  }

  /**
   * Calculate complexity score for code
   */
  private calculateComplexity(signature: string, code: string): number {
    // Simple heuristic based on code characteristics
    let complexity = 1;

    // Add complexity for control structures
    complexity += (code.match(/if|while|for|switch/g) || []).length * 0.5;

    // Add complexity for nested functions/classes
    complexity += (code.match(/function|class/g) || []).length * 0.3;

    // Add complexity for parameter count
    const paramCount = (signature.match(/,/g) || []).length + 1;
    complexity += paramCount * 0.2;

    return Math.min(10, Math.max(1, complexity));
  }

  /**
   * Extract dependencies from code
   */
  private extractDependencies(code: string): string[] {
    const dependencies = new Set<string>();

    // Extract import statements
    const importMatches = code.match(/import\s+.*?\s+from\s+['"](.+?)['"]/g);
    if (importMatches) {
      for (const match of importMatches) {
        const dep = match.match(/from\s+['"](.+?)['"]/)?.[1];
        if (dep) dependencies.add(dep);
      }
    }

    // Extract require statements
    const requireMatches = code.match(/require\(['"](.+?)['"]\)/g);
    if (requireMatches) {
      for (const match of requireMatches) {
        const dep = match.match(/require\(['"](.+?)['"]\)/)?.[1];
        if (dep) dependencies.add(dep);
      }
    }

    return Array.from(dependencies).slice(0, 10); // Limit to 10 dependencies
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Mock Embedding Provider
 *
 * Simulates OpenAI/Cohere/etc embedding API behavior.
 * Generates deterministic vectors for benchmarking.
 */
export class MockEmbeddingProvider {
  private config: MockEmbeddingConfig;

  constructor(config?: Partial<MockEmbeddingConfig>) {
    this.config = {
      msPerToken: 2, // Embedding is faster than generation
      baseLatencyMs: 150,
      dimensions: 1536, // text-embedding-3-small dimensions
      addVariance: true,
      ...config,
    };
  }

  /**
   * Generate embedding vector for text
   */
  async generateEmbedding(text: string): Promise<{
    vector: number[];
    metadata: {
      model: string;
      dimensions: number;
      latency_ms: number;
      estimated_tokens: number;
      timestamp: string;
    };
  }> {
    const estimatedTokens = Math.ceil(text.length / 4);
    const processingTime = estimatedTokens * this.config.msPerToken;
    const totalLatency =
      this.config.baseLatencyMs +
      processingTime +
      (this.config.addVariance ? Math.random() * 30 - 15 : 0);

    await this.sleep(totalLatency);

    // Generate deterministic vector based on text content
    const vector = this.generateDeterministicVector(text);

    return {
      vector,
      metadata: {
        model: "mock-text-embedding-3-small",
        dimensions: this.config.dimensions,
        latency_ms: totalLatency,
        estimated_tokens: estimatedTokens,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<
    Array<{
      vector: number[];
      metadata: {
        model: string;
        dimensions: number;
        batch_size: number;
        total_latency_ms: number;
        estimated_tokens: number;
        timestamp: string;
      };
    }>
  > {
    const batchOverhead = this.config.baseLatencyMs;
    const totalTokens = texts.reduce(
      (sum, text) => sum + Math.ceil(text.length / 4),
      0,
    );
    const totalLatency =
      batchOverhead +
      totalTokens * this.config.msPerToken +
      (this.config.addVariance ? Math.random() * 50 - 25 : 0);

    await this.sleep(totalLatency);

    return texts.map((text) => {
      const vector = this.generateDeterministicVector(text);

      return {
        vector,
        metadata: {
          model: "mock-text-embedding-3-small-batch",
          dimensions: this.config.dimensions,
          batch_size: texts.length,
          total_latency_ms: totalLatency,
          estimated_tokens: totalTokens,
          timestamp: new Date().toISOString(),
        },
      };
    });
  }

  /**
   * Calculate quality metrics for embeddings
   */
  calculateQualityMetrics(embeddings: Array<{ vector: number[] }>): {
    dimensionality: number;
    avgMagnitude: number;
    vectorSimilarity: number;
    searchRelevance: number;
    averageScore: number;
  } {
    if (embeddings.length === 0) {
      return {
        dimensionality: 0,
        avgMagnitude: 0,
        vectorSimilarity: 0,
        searchRelevance: 0,
        averageScore: 0,
      };
    }

    // Dimensionality check
    const dimensionality = embeddings[0].vector.length;
    const dimensionalityScore =
      dimensionality === this.config.dimensions ? 1.0 : 0.5;

    // Calculate average magnitude
    let totalMagnitude = 0;
    for (const embedding of embeddings) {
      const magnitude = Math.sqrt(
        embedding.vector.reduce((sum, val) => sum + val * val, 0),
      );
      totalMagnitude += magnitude;
    }
    const avgMagnitude = totalMagnitude / embeddings.length;
    const magnitudeScore = Math.abs(1.0 - avgMagnitude) < 0.1 ? 1.0 : 0.7; // Expect normalized vectors

    // Calculate pairwise similarity (should be moderate for diverse texts)
    let totalSimilarity = 0;
    let pairCount = 0;
    for (let i = 0; i < Math.min(embeddings.length, 10); i++) {
      for (let j = i + 1; j < Math.min(embeddings.length, 10); j++) {
        const similarity = this.cosineSimilarity(
          embeddings[i].vector,
          embeddings[j].vector,
        );
        totalSimilarity += similarity;
        pairCount++;
      }
    }
    const vectorSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0.5;
    const similarityScore =
      vectorSimilarity > 0.3 && vectorSimilarity < 0.9 ? 1.0 : 0.7;

    // Search relevance (mock: assume vectors can find related content)
    const searchRelevance = 0.85; // Mock value

    const averageScore =
      (dimensionalityScore +
        magnitudeScore +
        similarityScore +
        searchRelevance) /
      4;

    return {
      dimensionality,
      avgMagnitude,
      vectorSimilarity,
      searchRelevance,
      averageScore,
    };
  }

  /**
   * Generate deterministic vector based on text content
   */
  private generateDeterministicVector(text: string): number[] {
    const vector: number[] = [];

    // Use text hash as seed for deterministic generation
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }

    // Generate vector components using seeded random
    let seed = Math.abs(hash);
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return (seed / 4294967296) * 2 - 1; // Range [-1, 1]
    };

    for (let i = 0; i < this.config.dimensions; i++) {
      vector.push(random());
    }

    // Normalize to unit length
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0),
    );
    return vector.map((val) => val / magnitude);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
