/**
 * @fileoverview Semantic Query Processor - Vector similarity search implementation
 *
 * Handles natural language queries by converting text to embeddings and performing
 * vector similarity search using HNSW algorithm for fast approximate nearest neighbor lookup.
 */

import { createLogger } from "../../../ast-helper/src/logging/index.js";
import type { XenovaEmbeddingGenerator } from "../../../ast-helper/src/embedder/index.js";
import type { HNSWVectorDatabase } from "../../../ast-helper/src/database/vector/index.js";
import type { ASTDatabaseReader } from "../database/reader.js";
import type {
  AstCoreEngineApi,
  NodeMetadata,
} from "../../../ast-core-engine/index.js";

import type {
  SemanticQueryOptions,
  SemanticQuery,
  QueryResponse,
  AnnotationMatch,
  QueryMetadata,
  QuerySystemConfig,
  MCPQuery,
} from "./types.js";

/**
 * Result ranking strategies for semantic search
 */
interface SemanticRankingConfig {
  /** Weight for vector similarity score (0-1) */
  similarityWeight: number;

  /** Weight for context relevance boost (0-1) */
  contextWeight: number;

  /** Weight for recency (when available) (0-1) */
  recencyWeight: number;

  /** Minimum similarity threshold for results */
  minSimilarity: number;

  /** Maximum results to return */
  maxResults: number;
}

/**
 * Context-aware boosting for semantic queries
 */
interface ContextBoostConfig {
  /** Boost for results from current file */
  currentFileBoost: number;

  /** Boost for results containing selected text */
  selectedTextBoost: number;

  /** Boost for results from recently accessed files */
  recentFilesBoost: number;

  /** Language-specific boost */
  languageBoost: number;
}

/**
 * Semantic Query Processor
 *
 * Specialized processor for natural language queries using vector similarity search.
 * Implements context-aware ranking, result filtering, and performance optimizations.
 */
export class SemanticQueryProcessor {
  private logger = createLogger({ operation: "semantic-query-processor" });

  // Dependencies
  private embeddingGenerator: XenovaEmbeddingGenerator;
  private annotationDatabase: ASTDatabaseReader;
  private rustEngine?: AstCoreEngineApi;

  // Configuration
  private config: QuerySystemConfig;
  private rankingConfig: SemanticRankingConfig;
  private contextBoostConfig: ContextBoostConfig;
  private performanceMonitor?: any;

  // Performance tracking
  private processedQueries = 0;
  private avgProcessingTime = 0;
  private vectorSearchTime = 0;
  private rankingTime = 0;

  constructor(
    embeddingGenerator: XenovaEmbeddingGenerator,
    _vectorDatabase: HNSWVectorDatabase, // Unused but kept for API compatibility
    annotationDatabase: ASTDatabaseReader,
    config: QuerySystemConfig,
    performanceMonitor?: any, // Using any to avoid circular import for now
    rustEngine?: AstCoreEngineApi,
  ) {
    this.embeddingGenerator = embeddingGenerator;
    this.annotationDatabase = annotationDatabase;
    this.config = config;
    this.performanceMonitor = performanceMonitor;
    this.rustEngine = rustEngine;

    // Initialize default ranking configuration
    this.rankingConfig = {
      similarityWeight: 0.7,
      contextWeight: 0.2,
      recencyWeight: 0.1,
      minSimilarity: 0.3,
      maxResults: config.search.defaultMaxResults,
    };

    // Initialize context boosting configuration
    this.contextBoostConfig = {
      currentFileBoost: 0.2,
      selectedTextBoost: 0.3,
      recentFilesBoost: 0.1,
      languageBoost: 0.15,
    };
  }

  /**
   * Process semantic query with vector similarity search
   */
  async processQuery(
    queryOrText: string | MCPQuery | SemanticQuery,
    options: SemanticQueryOptions = {},
    maxResults?: number,
    currentFile?: string,
    selectedText?: string,
    recentFiles?: string[],
  ): Promise<QueryResponse> {
    // Handle both query object and text string inputs
    let queryText: string;
    let queryOptions: SemanticQueryOptions;
    let queryMaxResults: number | undefined;

    if (typeof queryOrText === "object") {
      // Handle MCPQuery object
      queryText = queryOrText.text;
      queryOptions = { ...options, ...queryOrText.options };
      queryMaxResults = queryOrText.maxResults || maxResults;
    } else {
      // Handle string input (legacy)
      queryText = queryOrText;
      queryOptions = options;
      queryMaxResults = maxResults;
    }

    // Validate required fields
    if (
      !queryText ||
      typeof queryText !== "string" ||
      queryText.trim().length === 0
    ) {
      throw new Error(
        "Invalid query: text field is required and must be a non-empty string",
      );
    }

    const startTime = Date.now();

    this.logger.debug("Processing semantic query", {
      queryText,
      options: queryOptions,
      maxResults: queryMaxResults,
      hasCurrentFile: !!currentFile,
      hasSelectedText: !!selectedText,
      recentFilesCount: recentFiles?.length || 0,
    });

    // Check for cached query response first
    // Extract minScore from the query if available
    const queryMinScore =
      typeof queryOrText === "object" && "minScore" in queryOrText
        ? queryOrText.minScore
        : undefined;

    const query: MCPQuery = {
      type: "semantic",
      text: queryText,
      maxResults: queryMaxResults,
      minScore: queryMinScore,
      options: Object.keys(queryOptions).length > 0 ? queryOptions : undefined,
    };

    if (this.performanceMonitor) {
      const cachedResponse =
        this.performanceMonitor.getCachedQueryResponse(query);
      if (cachedResponse) {
        // Update the metadata to reflect cache hit
        const cachedResponseWithMeta = {
          ...cachedResponse,
          metadata: {
            ...cachedResponse.metadata,
            cacheHit: true,
            timestamp: new Date(),
          },
        };

        this.logger.debug("Returning cached query response", {
          queryText,
          cachedResultsCount: cachedResponse.results.length,
        });

        return cachedResponseWithMeta;
      }
    }

    try {
      // Step 1: Generate query embedding (with caching)
      const queryEmbeddingStartTime = Date.now();
      let queryEmbedding: number[];

      // Try to get cached embedding first
      if (this.performanceMonitor) {
        const cachedEmbedding =
          this.performanceMonitor.getCachedEmbedding(queryText);
        if (cachedEmbedding) {
          queryEmbedding = cachedEmbedding;
        } else {
          // Generate new embedding and cache it
          const embeddings = await this.embeddingGenerator.generateEmbeddings([
            queryText,
          ]);

          if (embeddings.length === 0) {
            throw new Error("Failed to generate query embedding");
          }

          const embedding = embeddings[0];
          if (!embedding) {
            throw new Error("Generated embedding is undefined");
          }
          queryEmbedding = embedding;

          // Cache the embedding for future use
          this.performanceMonitor.cacheEmbedding(queryText, queryEmbedding);
        }
      } else {
        // Fallback without caching
        const embeddings = await this.embeddingGenerator.generateEmbeddings([
          queryText,
        ]);

        if (embeddings.length === 0) {
          throw new Error("Failed to generate query embedding");
        }

        const embedding = embeddings[0];
        if (!embedding) {
          throw new Error("Generated embedding is undefined");
        }
        queryEmbedding = embedding;
      }

      const embeddingTime = Date.now() - queryEmbeddingStartTime;

      // Step 2: Vector similarity search using database reader
      const vectorSearchStartTime = Date.now();

      // Build options object based on query type and properties
      const vectorSearchOptions: any = {
        maxResults: Math.min(
          queryMaxResults || this.rankingConfig.maxResults,
          1000, // hard-coded candidate limit
        ),
        searchEf: queryOptions.searchEf || this.config.search.defaultSearchEf,
        ef: queryOptions.searchEf || this.config.search.defaultSearchEf, // Legacy compatibility
      };

      // For SemanticQuery, map direct properties
      if (
        typeof queryOrText === "object" &&
        "language" in queryOrText &&
        queryOrText.language
      ) {
        vectorSearchOptions.language = queryOrText.language;
      }
      if (
        typeof queryOrText === "object" &&
        "filePath" in queryOrText &&
        queryOrText.filePath
      ) {
        vectorSearchOptions.filePath = queryOrText.filePath;
      }
      if (
        typeof queryOrText === "object" &&
        "nodeType" in queryOrText &&
        queryOrText.nodeType
      ) {
        vectorSearchOptions.nodeType = queryOrText.nodeType;
      }

      // Also check languageFilter and fileFilter for older API compatibility
      if (
        queryOptions.languageFilter &&
        queryOptions.languageFilter.length > 0
      ) {
        vectorSearchOptions.language = queryOptions.languageFilter[0];
      }
      if (queryOptions.fileFilter && queryOptions.fileFilter.length > 0) {
        vectorSearchOptions.filePath = queryOptions.fileFilter[0];
      }

      // Add context boosting if enabled
      if (queryOptions.useContextBoosting) {
        vectorSearchOptions.useContextBoosting =
          queryOptions.useContextBoosting;
      }

      let vectorResults: any;

      // Prefer Rust engine if available for faster vector search
      if (this.rustEngine) {
        try {
          this.logger.debug("Using Rust engine for semantic search", {
            queryText,
          });
          const rustResults = await this.rustEngine.searchSimilar(
            queryText,
            queryMaxResults || 50,
          );

          // Convert Rust engine results to expected format
          vectorResults = rustResults.map((result: NodeMetadata) => ({
            nodeId: result.nodeId,
            filePath: result.filePath,
            signature: result.signature,
            summary: result.summary,
            sourceSnippet: result.sourceSnippet,
            similarity: 1.0, // Rust engine provides normalized results
            language: result.language,
            complexity: result.complexity,
          }));

          this.logger.debug("Rust engine search completed", {
            resultCount: vectorResults.length,
          });
        } catch (error) {
          this.logger.warn(
            "Rust engine search failed, falling back to TypeScript",
            {
              error: String(error),
            },
          );
          // Fall back to original implementation
          vectorResults = await this.annotationDatabase.vectorSearch(
            queryText,
            vectorSearchOptions,
          );
        }
      } else {
        // Use original TypeScript implementation
        vectorResults = await this.annotationDatabase.vectorSearch(
          queryText,
          vectorSearchOptions,
        );
      }

      this.vectorSearchTime = Date.now() - vectorSearchStartTime;

      // Handle case where vectorResults might be undefined
      if (!vectorResults || !Array.isArray(vectorResults)) {
        this.logger.warn(
          "Vector search returned no results or invalid format",
          {
            queryText: queryText.substring(0, 100),
            vectorResults,
          },
        );

        const totalTime = Date.now() - startTime;
        return {
          results: [],
          totalMatches: 0,
          queryTime: totalTime,
          searchStrategy: "semantic-vector-search" as const,
          metadata: {
            vectorSearchTime: this.vectorSearchTime,
            rankingTime: 0,
            totalCandidates: 0,
            appliedFilters: this.getAppliedFilters(queryOptions),
            searchParameters: {},
            totalTime,
            searchTime: totalTime,
            cacheHit: false,
            timestamp: new Date(),
            error: "No valid results from vector search",
          },
        };
      }

      // Step 3: Convert to expected format (ASTNodeMatch -> AnnotationMatch with vectorScore)
      const conversionStartTime = Date.now();
      const candidateMatches = vectorResults.map((match) => ({
        annotation: {
          nodeId: match.nodeId,
          signature: match.signature,
          summary: match.summary,
          filePath: match.filePath,
          lineNumber: match.startLine,
          language: this.getLanguageFromFilePath(match.filePath) || "unknown",
          confidence: match.score,
          lastUpdated: new Date(match.updatedAt),
          nodeType: match.nodeType,
        },
        score: match.score,
        matchReason: match.matchReason || "Vector similarity match",
        contextSnippet: match.sourceSnippet,
        vectorScore: match.score,
      }));
      const conversionTime = Date.now() - conversionStartTime; // Step 4: Apply context-aware ranking and filtering
      const rankingStartTime = Date.now();

      // Extract minScore from query if available
      const minScore =
        typeof queryOrText === "object" && "minScore" in queryOrText
          ? queryOrText.minScore
          : undefined;

      const rankedMatches = await this.rankAndFilterResults(
        candidateMatches,
        queryText,
        queryOptions,
        currentFile,
        selectedText,
        recentFiles,
        minScore,
      );

      this.rankingTime = Date.now() - rankingStartTime;

      // Step 5: Apply final result limits and formatting
      const finalResults = rankedMatches.slice(
        0,
        queryMaxResults || this.rankingConfig.maxResults,
      );

      const totalTime = Date.now() - startTime;

      // Update performance metrics
      this.updatePerformanceMetrics(totalTime);

      // Build response metadata
      const metadata: QueryMetadata = {
        vectorSearchTime: this.vectorSearchTime,
        rankingTime: this.rankingTime,
        totalCandidates: vectorResults.length,
        appliedFilters: this.getAppliedFilters(queryOptions),
        searchParameters: {
          embedding: "codebert-base",
          similarity: "cosine",
          k: queryMaxResults || this.rankingConfig.maxResults,
          ef: queryOptions.searchEf || this.config.search.defaultSearchEf,
          contextBoosting: queryOptions.useContextBoosting ?? false,
          embeddingTime,
          conversionTime,
        },
        totalTime,
        searchTime: totalTime,
        cacheHit: false, // Default to false, will be updated by cache logic if applicable
        timestamp: new Date(),
      };

      this.logger.info("Semantic query processed successfully", {
        queryLength: queryText.length,
        totalResults: finalResults.length,
        vectorCandidates: vectorResults.length,
        totalTime,
        vectorSearchTime: this.vectorSearchTime,
        rankingTime: this.rankingTime,
      });

      const response: QueryResponse = {
        results: finalResults,
        totalMatches: rankedMatches.length,
        queryTime: totalTime,
        searchStrategy: "semantic_vector_search",
        metadata,
      };

      // Cache the response for future use
      if (this.performanceMonitor) {
        this.performanceMonitor.cacheQueryResponse(query, response);
      }

      return response;
    } catch (error) {
      this.logger.error("Semantic query processing failed", {
        error: error instanceof Error ? error.message : String(error),
        queryText,
        queryOptions,
      });

      // Return error response instead of throwing
      const totalTime = Date.now() - startTime;
      return {
        results: [],
        totalMatches: 0,
        queryTime: totalTime,
        searchStrategy: "semantic-vector-search",
        metadata: {
          vectorSearchTime: 0,
          rankingTime: 0,
          totalCandidates: 0,
          appliedFilters: [],
          searchParameters: {},
          totalTime,
          searchTime: totalTime,
          cacheHit: false,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Apply context-aware ranking and filtering to results
   */
  private async rankAndFilterResults(
    candidateMatches: Array<AnnotationMatch & { vectorScore: number }>,
    queryText: string,
    options: SemanticQueryOptions,
    currentFile?: string,
    selectedText?: string,
    recentFiles?: string[],
    minScore?: number,
  ): Promise<AnnotationMatch[]> {
    const rankedMatches: AnnotationMatch[] = [];

    for (const match of candidateMatches) {
      let boostedScore =
        match.vectorScore * this.rankingConfig.similarityWeight;
      let contextRelevance = 0;

      // Apply context boosting if enabled
      if (options.useContextBoosting) {
        // Current file boost
        if (currentFile && match.annotation.filePath === currentFile) {
          boostedScore += this.contextBoostConfig.currentFileBoost;
          contextRelevance += this.contextBoostConfig.currentFileBoost;
        }

        // Selected text boost (fuzzy match against signature)
        if (
          selectedText &&
          this.fuzzyMatch(match.annotation.signature, selectedText)
        ) {
          boostedScore += this.contextBoostConfig.selectedTextBoost;
          contextRelevance += this.contextBoostConfig.selectedTextBoost;
        }

        // Recent files boost
        if (recentFiles && recentFiles.includes(match.annotation.filePath)) {
          boostedScore += this.contextBoostConfig.recentFilesBoost;
          contextRelevance += this.contextBoostConfig.recentFilesBoost;
        }

        // Language-specific boost
        const queryLanguage = this.detectLanguageFromQuery(queryText);
        const fileLanguage = this.getLanguageFromFilePath(
          match.annotation.filePath,
        );
        if (queryLanguage && fileLanguage && queryLanguage === fileLanguage) {
          boostedScore += this.contextBoostConfig.languageBoost;
          contextRelevance += this.contextBoostConfig.languageBoost;
        }
      }

      // Apply filters
      if (
        options.fileFilter &&
        !this.matchesFileFilter(match.annotation.filePath, options.fileFilter)
      ) {
        continue;
      }

      if (
        options.languageFilter &&
        !this.matchesLanguageFilter(
          match.annotation.filePath,
          options.languageFilter,
        )
      ) {
        continue;
      }

      if (
        options.confidenceThreshold &&
        match.annotation.confidence < options.confidenceThreshold
      ) {
        continue;
      }

      // Filter by minimum similarity
      if (boostedScore < this.rankingConfig.minSimilarity) {
        continue;
      }

      // Filter by user-provided minimum score (from SemanticQuery.minScore)
      if (minScore !== undefined && boostedScore < minScore) {
        continue;
      }

      // Update match with final score and context relevance
      const finalMatch: AnnotationMatch = {
        ...match,
        score: boostedScore,
        matchReason: `vector_similarity_with_context_boost_${contextRelevance.toFixed(2)}`,
      };

      rankedMatches.push(finalMatch);
    }

    // Sort by boosted score (descending)
    rankedMatches.sort((a, b) => b.score - a.score);

    return rankedMatches;
  }

  /**
   * Fuzzy string matching for context boosting
   */
  private fuzzyMatch(text1: string, text2: string, threshold = 0.7): boolean {
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;

    if (longer.length === 0) {
      return true;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length >= threshold;
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) {
      const row = matrix[0];
      if (row) {
        row[i] = i;
      }
    }

    for (let j = 0; j <= str2.length; j++) {
      const row = matrix[j];
      if (row) {
        row[0] = j;
      }
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        const currentRow = matrix[j];
        const prevRow = matrix[j - 1];
        if (currentRow && prevRow) {
          const deletion = (currentRow[i - 1] ?? 0) + 1;
          const insertion = (prevRow[i] ?? 0) + 1;
          const substitution = (prevRow[i - 1] ?? 0) + indicator;
          currentRow[i] = Math.min(deletion, insertion, substitution);
        }
      }
    }

    const finalRow = matrix[str2.length];
    return finalRow?.[str1.length] ?? Math.max(str1.length, str2.length);
  }

  /**
   * Detect programming language from query text
   */
  private detectLanguageFromQuery(queryText: string): string | null {
    const languagePatterns = {
      typescript: /typescript|\.ts|interface|type|export|import/i,
      javascript: /javascript|\.js|function|const|let|var/i,
      python: /python|\.py|def|class|import|from/i,
      java: /java|\.java|public|private|class|interface/i,
      cpp: /c\+\+|\.cpp|\.h|include|namespace/i,
      csharp: /c#|\.cs|public|private|class|namespace/i,
      go: /golang|\.go|func|package|import/i,
      rust: /rust|\.rs|fn|struct|impl|use/i,
    };

    for (const [language, pattern] of Object.entries(languagePatterns)) {
      if (pattern.test(queryText)) {
        return language;
      }
    }

    return null;
  }

  /**
   * Check if file path matches filter patterns
   */
  private matchesFileFilter(filePath: string, fileFilter: string[]): boolean {
    return fileFilter.some((pattern) => {
      if (pattern.includes("*")) {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(filePath);
      }
      return filePath.includes(pattern);
    });
  }

  /**
   * Check if file path matches language filter
   */
  private matchesLanguageFilter(
    filePath: string,
    languageFilter: string[],
  ): boolean {
    const language = this.getLanguageFromFilePath(filePath);
    return language ? languageFilter.includes(language) : false;
  }

  /**
   * Get list of applied filters for metadata
   */
  private getAppliedFilters(options: SemanticQueryOptions): string[] {
    const filters: string[] = [];

    if (options.fileFilter) {
      filters.push("file_filter");
    }
    if (options.languageFilter) {
      filters.push("language_filter");
    }
    if (options.confidenceThreshold) {
      filters.push("confidence_threshold");
    }
    if (options.useContextBoosting) {
      filters.push("context_boosting");
    }
    if (options.includeSimilarResults) {
      filters.push("similar_results");
    }

    return filters;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(processingTime: number): void {
    this.processedQueries++;
    this.avgProcessingTime =
      (this.avgProcessingTime * (this.processedQueries - 1) + processingTime) /
      this.processedQueries;
  }

  /**
   * Get processor-specific performance statistics
   */
  getPerformanceStats() {
    return {
      processedQueries: this.processedQueries,
      avgProcessingTime: this.avgProcessingTime,
      avgVectorSearchTime: this.vectorSearchTime,
      avgRankingTime: this.rankingTime,
      rankingConfig: this.rankingConfig,
      contextBoostConfig: this.contextBoostConfig,
    };
  }

  /**
   * Update ranking configuration
   */
  updateRankingConfig(config: Partial<SemanticRankingConfig>): void {
    this.rankingConfig = { ...this.rankingConfig, ...config };

    this.logger.info("Ranking configuration updated", {
      config: this.rankingConfig,
    });
  }

  /**
   * Update context boosting configuration
   */
  updateContextBoostConfig(config: Partial<ContextBoostConfig>): void {
    this.contextBoostConfig = { ...this.contextBoostConfig, ...config };

    this.logger.info("Context boost configuration updated", {
      newConfig: this.contextBoostConfig,
    });
  }

  /**
   * Get programming language from file path
   */
  private getLanguageFromFilePath(filePath: string): string | null {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: "typescript",
      js: "javascript",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
      cs: "csharp",
      go: "go",
      rs: "rust",
      php: "php",
      rb: "ruby",
      swift: "swift",
      kt: "kotlin",
    };
    return ext ? languageMap[ext] || ext : null;
  }
}
