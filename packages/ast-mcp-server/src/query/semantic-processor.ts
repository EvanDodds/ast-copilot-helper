/**
 * @fileoverview Semantic Query Processor - Vector similarity search implementation
 * 
 * Handles natural language queries by converting text to embeddings and performing
 * vector similarity search using HNSW algorithm for fast approximate nearest neighbor lookup.
 */

import { createLogger } from '../../../ast-helper/src/logging/index.js';
import { XenovaEmbeddingGenerator } from '../../../ast-helper/src/embedder/index.js';
import { HNSWVectorDatabase } from '../../../ast-helper/src/database/vector/index.js';
import type { ASTDatabaseReader } from '../database/reader.js';

import type {
  SemanticQueryOptions,
  QueryResponse,
  AnnotationMatch,
  QueryMetadata,
  QuerySystemConfig,
  Annotation,
} from './types.js';

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
  private logger = createLogger({ operation: 'semantic-query-processor' });
  
  // Dependencies
  private embeddingGenerator: XenovaEmbeddingGenerator;
  private vectorDatabase: HNSWVectorDatabase;
  private annotationDatabase: ASTDatabaseReader;
  
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
    vectorDatabase: HNSWVectorDatabase,
    annotationDatabase: ASTDatabaseReader,
    config: QuerySystemConfig,
    performanceMonitor?: any // Using any to avoid circular import for now
  ) {
    this.embeddingGenerator = embeddingGenerator;
    this.vectorDatabase = vectorDatabase;
    this.annotationDatabase = annotationDatabase;
    this.config = config;
    this.performanceMonitor = performanceMonitor;
    
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
    queryText: string, 
    options: SemanticQueryOptions = {},
    maxResults?: number,
    currentFile?: string,
    selectedText?: string,
    recentFiles?: string[]
  ): Promise<QueryResponse> {
    const startTime = Date.now();
    
    this.logger.debug('Processing semantic query', {
      queryText,
      options,
      maxResults,
      hasCurrentFile: !!currentFile,
      hasSelectedText: !!selectedText,
      recentFilesCount: recentFiles?.length || 0,
    });
    
    try {
      // Step 1: Generate query embedding (with caching)
      const queryEmbeddingStartTime = Date.now();
      let queryEmbedding: number[];
      
      // Try to get cached embedding first
      if (this.performanceMonitor) {
        const cachedEmbedding = this.performanceMonitor.getCachedEmbedding(queryText);
        if (cachedEmbedding) {
          queryEmbedding = cachedEmbedding;
        } else {
          // Generate new embedding and cache it
          const embeddings = await this.embeddingGenerator.generateEmbeddings([queryText]);
          
          if (embeddings.length === 0) {
            throw new Error('Failed to generate query embedding');
          }
          
          const embedding = embeddings[0];
          if (!embedding) {
            throw new Error('Generated embedding is undefined');
          }
          queryEmbedding = embedding;
          
          // Cache the embedding for future use
          this.performanceMonitor.cacheEmbedding(queryText, queryEmbedding);
        }
      } else {
        // Fallback without caching
        const embeddings = await this.embeddingGenerator.generateEmbeddings([queryText]);
        
        if (embeddings.length === 0) {
          throw new Error('Failed to generate query embedding');
        }
        
        const embedding = embeddings[0];
        if (!embedding) {
          throw new Error('Generated embedding is undefined');
        }
        queryEmbedding = embedding;
      }
      
      const embeddingTime = Date.now() - queryEmbeddingStartTime;
      
      // Step 2: Vector similarity search
      const vectorSearchStartTime = Date.now();
      const vectorResults = await this.vectorDatabase.searchSimilar(
        queryEmbedding,
        Math.min(
          maxResults || this.rankingConfig.maxResults,
          1000 // hard-coded candidate limit
        ),
        options.searchEf || this.config.search.defaultSearchEf
      );
      
      this.vectorSearchTime = Date.now() - vectorSearchStartTime;
      
      // Step 3: Convert vector results to annotation matches
      const conversionStartTime = Date.now();
      const candidateMatches = await this.convertVectorResultsToAnnotations(vectorResults);
      const conversionTime = Date.now() - conversionStartTime;
      
      // Step 4: Apply context-aware ranking and filtering
      const rankingStartTime = Date.now();
      const rankedMatches = await this.rankAndFilterResults(
        candidateMatches,
        queryText,
        options,
        currentFile,
        selectedText,
        recentFiles
      );
      
      this.rankingTime = Date.now() - rankingStartTime;
      
      // Step 5: Apply final result limits and formatting
      const finalResults = rankedMatches.slice(0, maxResults || this.rankingConfig.maxResults);
      
      const totalTime = Date.now() - startTime;
      
      // Update performance metrics
      this.updatePerformanceMetrics(totalTime);
      
      // Build response metadata
      const metadata: QueryMetadata = {
        vectorSearchTime: this.vectorSearchTime,
        rankingTime: this.rankingTime,
        totalCandidates: vectorResults.length,
        appliedFilters: this.getAppliedFilters(options),
        searchParameters: {
          embedding: 'codebert-base',
          similarity: 'cosine',
          k: maxResults || this.rankingConfig.maxResults,
          ef: options.searchEf || this.config.search.defaultSearchEf,
          contextBoosting: options.useContextBoosting ?? false,
          embeddingTime,
          conversionTime,
        },
      };
      
      this.logger.info('Semantic query processed successfully', {
        queryLength: queryText.length,
        totalResults: finalResults.length,
        vectorCandidates: vectorResults.length,
        totalTime,
        vectorSearchTime: this.vectorSearchTime,
        rankingTime: this.rankingTime,
      });
      
      return {
        results: finalResults,
        totalMatches: rankedMatches.length,
        queryTime: totalTime,
        searchStrategy: 'semantic_vector_search',
        metadata,
      };
      
    } catch (error) {
      this.logger.error('Semantic query processing failed', {
        error: error instanceof Error ? error.message : String(error),
        queryText,
        options,
      });
      throw error;
    }
  }

  /**
   * Convert vector search results to annotation matches with metadata
   */
  private async convertVectorResultsToAnnotations(
    vectorResults: Array<{ nodeId: string; score: number }>
  ): Promise<Array<AnnotationMatch & { vectorScore: number }>> {
    const matches: Array<AnnotationMatch & { vectorScore: number }> = [];
    
    // For now, fetch nodes individually until we have a batch method
    for (const vectorResult of vectorResults) {
      const node = await this.annotationDatabase.getNodeById(vectorResult.nodeId);
      if (!node) {
        this.logger.warn('Vector result node not found in annotation database', {
          nodeId: vectorResult.nodeId,
        });
        continue;
      }
      
      // Convert ASTNode to Annotation
      const annotation: Annotation = {
        nodeId: node.nodeId,
        signature: node.signature,
        summary: node.summary,
        filePath: node.filePath,
        lineNumber: node.startLine,
        language: this.getLanguageFromFilePath(node.filePath) || 'unknown',
        confidence: 1.0, // Default confidence
        lastUpdated: node.updatedAt,
      };
      
      matches.push({
        annotation,
        score: vectorResult.score,
        matchReason: 'vector_similarity_search',
        contextSnippet: node.sourceSnippet,
        vectorScore: vectorResult.score,
      });
    }
    
    return matches;
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
    recentFiles?: string[]
  ): Promise<AnnotationMatch[]> {
    const rankedMatches: AnnotationMatch[] = [];
    
    for (const match of candidateMatches) {
      let boostedScore = match.vectorScore * this.rankingConfig.similarityWeight;
      let contextRelevance = 0;
      
      // Apply context boosting if enabled
      if (options.useContextBoosting) {
        // Current file boost
        if (currentFile && match.annotation.filePath === currentFile) {
          boostedScore += this.contextBoostConfig.currentFileBoost;
          contextRelevance += this.contextBoostConfig.currentFileBoost;
        }
        
        // Selected text boost (fuzzy match against signature)
        if (selectedText && this.fuzzyMatch(match.annotation.signature, selectedText)) {
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
        const fileLanguage = this.getLanguageFromFilePath(match.annotation.filePath);
        if (queryLanguage && fileLanguage && queryLanguage === fileLanguage) {
          boostedScore += this.contextBoostConfig.languageBoost;
          contextRelevance += this.contextBoostConfig.languageBoost;
        }
      }
      
      // Apply filters
      if (options.fileFilter && !this.matchesFileFilter(match.annotation.filePath, options.fileFilter)) {
        continue;
      }
      
      if (options.languageFilter && !this.matchesLanguageFilter(match.annotation.filePath, options.languageFilter)) {
        continue;
      }
      
      if (options.confidenceThreshold && match.annotation.confidence < options.confidenceThreshold) {
        continue;
      }
      
      // Filter by minimum similarity
      if (boostedScore < this.rankingConfig.minSimilarity) {
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
    
    if (longer.length === 0) return true;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length >= threshold;
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0]![i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j]![0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1,      // deletion
          matrix[j - 1]![i]! + 1,      // insertion
          matrix[j - 1]![i - 1]! + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length]![str1.length]!;
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
   * Get programming language from file path
   */
  private getLanguageFromFilePath(filePath: string): string | null {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    const extensionMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'cpp',
      'h': 'cpp',
      'hpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
    };
    
    return extension ? extensionMap[extension] || null : null;
  }

  /**
   * Check if file path matches filter patterns
   */
  private matchesFileFilter(filePath: string, fileFilter: string[]): boolean {
    return fileFilter.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filePath);
      }
      return filePath.includes(pattern);
    });
  }

  /**
   * Check if file path matches language filter
   */
  private matchesLanguageFilter(filePath: string, languageFilter: string[]): boolean {
    const language = this.getLanguageFromFilePath(filePath);
    return language ? languageFilter.includes(language) : false;
  }

  /**
   * Get list of applied filters for metadata
   */
  private getAppliedFilters(options: SemanticQueryOptions): string[] {
    const filters: string[] = [];
    
    if (options.fileFilter) filters.push('file_filter');
    if (options.languageFilter) filters.push('language_filter');
    if (options.confidenceThreshold) filters.push('confidence_threshold');
    if (options.useContextBoosting) filters.push('context_boosting');
    if (options.includeSimilarResults) filters.push('similar_results');
    
    return filters;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(processingTime: number): void {
    this.processedQueries++;
    this.avgProcessingTime = (this.avgProcessingTime * (this.processedQueries - 1) + processingTime) / this.processedQueries;
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
    
    this.logger.info('Ranking configuration updated', {
      newConfig: this.rankingConfig,
    });
  }

  /**
   * Update context boosting configuration
   */
  updateContextBoostConfig(config: Partial<ContextBoostConfig>): void {
    this.contextBoostConfig = { ...this.contextBoostConfig, ...config };
    
    this.logger.info('Context boost configuration updated', {
      newConfig: this.contextBoostConfig,
    });
  }
}