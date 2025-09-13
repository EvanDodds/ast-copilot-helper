/**
 * @fileoverview Core Query Processor for MCP Server Query System
 * 
 * Main orchestrator that routes different query types to specialized processors
 * and handles query preprocessing, text normalization, and context integration.
 */

import { createLogger } from '../../../ast-helper/src/logging/index.js';
import { XenovaEmbeddingGenerator } from '../../../ast-helper/src/embedder/index.js';
import { HNSWVectorDatabase } from '../../../ast-helper/src/database/vector/index.js';
import type { ASTDatabaseReader } from '../database/reader.js';
import { SemanticQueryProcessor } from './semantic-processor.js';
import { SignatureQueryProcessor } from './signature-processor.js';
import { ResponseAssembler } from './response-assembler.js';
import { PerformanceMonitor } from './performance-monitor.js';

import type {
  QueryProcessor,
  MCPQuery,
  QueryResponse,
  SemanticQueryOptions,
  SignatureQueryOptions,  
  FileQueryOptions,
  QueryStats,
  QuerySystemConfig,
  QueryType,
  QueryContext,
} from './types.js';

/**
 * Query preprocessing utility functions
 */
class QueryPreprocessor {
  /**
   * Normalize and preprocess query text
   */
  static normalizeQueryText(text: string): string {
    // Remove excess whitespace and normalize
    let normalized = text.trim().replace(/\s+/g, ' ').toLowerCase();
    
    // Remove common stop words that don't add semantic value for code queries
    const codeStopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = normalized.split(' ');
    const filteredWords = words.filter(word => 
      word.length >= 2 && !codeStopWords.includes(word)
    );
    
    normalized = filteredWords.join(' ');
    
    // Add code context hints for better semantic understanding
    const codeKeywords = ['function', 'class', 'method', 'variable', 'interface', 'type', 'module', 'component'];
    const hasCodeContext = codeKeywords.some(keyword => normalized.includes(keyword));
    
    // For short queries without obvious code context, add a code hint
    if (!hasCodeContext && normalized.length < 30) {
      normalized = `code ${normalized}`;
    }
    
    return normalized;
  }

  /**
   * Extract query intent and classify query type
   */
  static classifyQueryType(text: string): QueryType {
    const normalizedText = text.toLowerCase().trim();
    
    // Signature-based queries (function/method signatures)
    const signaturePatterns = [
      /^\w+\([^)]*\)/, // function call pattern
      /^\w+\s*\([^)]*\)\s*:\s*\w+/, // typed function pattern
      /^[a-zA-Z_]\w*::\w+/, // class method pattern
      /^def\s+\w+/, // Python function pattern
      /^function\s+\w+/, // JavaScript function pattern
    ];
    
    if (signaturePatterns.some(pattern => pattern.test(normalizedText))) {
      return 'signature';
    }
    
    // File-scoped queries (file path patterns)
    const filePatterns = [
      /\*\*\/\*\.\w+$/, // glob patterns
      /\/[^/]+\.\w+$/, // file extensions
      /^file:/, // explicit file prefix
      /\.(ts|js|py|java|cpp|c|h|go|rs|php|rb)$/, // common code extensions
    ];
    
    if (filePatterns.some(pattern => pattern.test(normalizedText))) {
      return 'file';
    }
    
    // Contextual queries (references to current context)
    const contextualPatterns = [
      /current.*file/,
      /this.*class/,
      /related.*to/,
      /similar.*to/,
      /in.*this.*context/,
    ];
    
    if (contextualPatterns.some(pattern => pattern.test(normalizedText))) {
      return 'contextual';
    }
    
    // Default to semantic for natural language queries
    return 'semantic';
  }

  /**
   * Enhance query with context information
   */
  static enhanceWithContext(text: string, context?: QueryContext): string {
    if (!context) return text;
    
    let enhanced = text;
    
    // Add current file context
    if (context.currentFile) {
      const fileName = context.currentFile.split('/').pop();
      const fileType = fileName?.split('.').pop();
      enhanced = `${text} (current file: ${fileName}, type: ${fileType})`;
    }
    
    // Add selected text context
    if (context.selectedText && context.selectedText.length < 100) {
      enhanced = `${enhanced} (related to: "${context.selectedText}")`;
    }
    
    return enhanced;
  }
}

/**
 * Main Query Processor implementation
 */
export class MCPQueryProcessor implements QueryProcessor {
  private logger = createLogger({ operation: 'query-processor' });
  private isInitialized = false;
  
  // Dependencies
  private embeddingGenerator?: XenovaEmbeddingGenerator;
  private vectorDatabase?: HNSWVectorDatabase;
  private annotationDatabase: ASTDatabaseReader;
  
  // Specialized processors
  private semanticProcessor?: SemanticQueryProcessor;
  private signatureProcessor: SignatureQueryProcessor;
  private responseAssembler: ResponseAssembler;
  private performanceMonitor: PerformanceMonitor;
  
  // Configuration
  private config: QuerySystemConfig;
  
  // Performance tracking
  private stats: QueryStats = {
    totalQueries: 0,
    averageQueryTime: 0,
    queryTypeBreakdown: {
      semantic: 0,
      signature: 0, 
      file: 0,
      contextual: 0,
    },
    cacheHitRatio: 0,
    errorRate: 0,
    performanceMetrics: {
      p50QueryTime: 0,
      p95QueryTime: 0,
      p99QueryTime: 0,
      memoryUsage: 0,
      peakMemoryUsage: 0,
      concurrentQueries: 0,
    },
  };
  
  private queryTimes: number[] = [];
  private concurrentQueryCount = 0;

  constructor(
    annotationDatabase: ASTDatabaseReader,
    config: QuerySystemConfig,
    embeddingGenerator?: XenovaEmbeddingGenerator,
    vectorDatabase?: HNSWVectorDatabase
  ) {
    this.annotationDatabase = annotationDatabase;
    this.config = config;
    this.embeddingGenerator = embeddingGenerator;
    this.vectorDatabase = vectorDatabase;
    
    // Initialize response assembler
    this.responseAssembler = new ResponseAssembler(config);
    
    // Initialize performance monitor
    this.performanceMonitor = new PerformanceMonitor();
    
    // Initialize signature processor
    this.signatureProcessor = new SignatureQueryProcessor(
      this.annotationDatabase,
      this.config
    );
  }

  /**
   * Initialize the query processor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    this.logger.info('Initializing query processor', {
      hasEmbeddingGenerator: !!this.embeddingGenerator,
      hasVectorDatabase: !!this.vectorDatabase,
      config: this.config,
    });
    
    // Initialize dependencies if available
    if (this.embeddingGenerator && !this.embeddingGenerator.isReady()) {
      await this.embeddingGenerator.initialize('microsoft/codebert-base');
    }
    
    if (this.vectorDatabase) {
      await this.vectorDatabase.initialize({
        dimensions: 768, // CodeBERT dimensions
        maxElements: 100000,
        efConstruction: 200,
        M: 16,
        space: 'cosine' as const,
        storageFile: './data/vectors/metadata.sqlite',
        indexFile: './data/vectors/index.hnsw',
        autoSave: true,
        saveInterval: 300,
      });
    }
    
    await this.annotationDatabase.initialize();
    
    // Initialize specialized processors
    if (this.embeddingGenerator && this.vectorDatabase) {
      this.semanticProcessor = new SemanticQueryProcessor(
        this.embeddingGenerator,
        this.vectorDatabase,
        this.annotationDatabase,
        this.config,
        this.performanceMonitor
      );
    }
    
    this.isInitialized = true;
    this.logger.info('Query processor initialized successfully');
  }

  /**
   * Process any type of query
   */
  async processQuery(query: MCPQuery): Promise<QueryResponse> {
    const startTime = Date.now();
    this.concurrentQueryCount++;
    
    try {
      this.validateQuery(query);
      
      // Check cache first
      const cachedResult = this.performanceMonitor.getCachedQueryResponse(query);
      if (cachedResult) {
        const queryTime = Date.now() - startTime;
        this.performanceMonitor.trackQueryPerformance(queryTime, query);
        return cachedResult;
      }
      
      // Update statistics
      this.stats.totalQueries++;
      this.stats.queryTypeBreakdown[query.type]++;
      this.stats.performanceMetrics.concurrentQueries = Math.max(
        this.stats.performanceMetrics.concurrentQueries,
        this.concurrentQueryCount
      );
      
      // Preprocess query
      const preprocessedText = QueryPreprocessor.normalizeQueryText(query.text);
      const enhancedText = QueryPreprocessor.enhanceWithContext(preprocessedText, query.context);
      
      this.logger.debug('Processing query', {
        type: query.type,
        originalText: query.text,
        preprocessedText,
        enhancedText,
        hasContext: !!query.context,
      });
      
      // Route to appropriate processor
      let response: QueryResponse;
      switch (query.type) {
        case 'semantic':
          response = await this.processSemanticQuery(enhancedText, query.options as SemanticQueryOptions, query.maxResults);
          break;
        case 'signature':
          response = await this.processSignatureQuery(enhancedText, query.options as SignatureQueryOptions, query.maxResults);
          break;
        case 'file':
          response = await this.processFileQuery(enhancedText, query.options as FileQueryOptions, query.maxResults);
          break;
        case 'contextual':
          response = await this.processContextualQuery(enhancedText, query);
          break;
        default:
          throw new Error(`Unsupported query type: ${query.type}`);
      }
      
      const queryTime = Date.now() - startTime;
      response.queryTime = queryTime;
      
      // Cache the response for future queries
      this.performanceMonitor.cacheQueryResponse(query, response);
      
      // Track performance metrics
      this.performanceMonitor.trackQueryPerformance(queryTime, query);
      
      // Update performance metrics
      this.updatePerformanceMetrics(queryTime);
      
      // Enforce performance requirements
      if (queryTime > this.config.performance.maxQueryTime) {
        this.logger.warn('Query exceeded maximum time', {
          queryTime,
          maxAllowed: this.config.performance.maxQueryTime,
          queryType: query.type,
        });
      }
      
      this.logger.info('Query processed successfully', {
        type: query.type,
        queryTime,
        resultCount: response.results.length,
        totalMatches: response.totalMatches,
      });
      
      return response;
      
    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.stats.errorRate = (this.stats.errorRate * (this.stats.totalQueries - 1) + 1) / this.stats.totalQueries;
      
      this.logger.error('Query processing failed', {
        error: error instanceof Error ? error.message : String(error),
        queryType: query.type,
        queryTime,
      });
      
      throw error;
    } finally {
      this.concurrentQueryCount--;
    }
  }

  /**
   * Process semantic queries with vector similarity search
   */
  async processSemanticQuery(text: string, options: SemanticQueryOptions = {}, maxResults?: number): Promise<QueryResponse> {
    if (!this.semanticProcessor) {
      throw new Error('Semantic queries require embedding generator and vector database');
    }
    
    // Extract context from options if available
    const currentFile = options.fileFilter?.[0]; // Assuming first file filter is current file
    
    return this.semanticProcessor.processQuery(
      text, 
      options, 
      maxResults,
      currentFile
    );
  }

  /**
   * Process signature-based queries for exact matching
   */
  async processSignatureQuery(signature: string, options: SignatureQueryOptions = {}, maxResults?: number): Promise<QueryResponse> {
    return this.signatureProcessor.processQuery(signature, options, maxResults);
  }

  /**
   * Process file-scoped queries with path filtering
   */
  async processFileQuery(filePath: string, options: FileQueryOptions = {}, maxResults?: number): Promise<QueryResponse> {
    const startTime = Date.now();
    
    // Get nodes from specific file or pattern
    let matches = [];
    
    if (filePath.includes('*')) {
      // Handle glob patterns
      matches = await this.annotationDatabase.searchNodes('*', {
        maxResults: maxResults || this.config.search.defaultMaxResults,
        filePattern: filePath,
      });
    } else {
      // Handle specific file path
      const fileNodes = await this.annotationDatabase.getFileNodes(filePath);
      matches = fileNodes.map(node => ({ ...node, score: 1.0 })); // Perfect match score for file queries
    }
    
    const searchTime = Date.now() - startTime;
    
    const response: QueryResponse = {
      results: [], // Will be populated by response formatter  
      totalMatches: matches.length,
      queryTime: 0, // Will be set by caller
      searchStrategy: 'file_path_filter',
      metadata: {
        vectorSearchTime: 0,
        rankingTime: searchTime,
        totalCandidates: matches.length,
        appliedFilters: this.getAppliedFilters(options),
        searchParameters: {
          filePath,
          recursive: options.recursive ?? true,
          includeHidden: options.includeHidden ?? false,
          maxDepth: options.maxDepth,
        },
      },
    };
    
    this.logger.debug('File query processed', {
      matches: matches.length,
      searchTime,
      filePath,
    });
    
    return response;
  }

  /**
   * Process contextual queries using current context
   */
  private async processContextualQuery(text: string, query: MCPQuery): Promise<QueryResponse> {
    // For contextual queries, we primarily use semantic search but boost results
    // based on the context information
    const options: SemanticQueryOptions = {
      ...query.options as SemanticQueryOptions,
      useContextBoosting: true,
    };
    
    return this.processSemanticQuery(text, options);
  }

  /**
   * Process query and return MCP-compliant response
   */
  async processQueryWithFormatting(
    query: MCPQuery, 
    requestId?: string,
    page = 1,
    pageSize = 50
  ) {
    const response = await this.processQuery(query);
    return this.responseAssembler.assembleResponse(response, query, requestId, page, pageSize);
  }

  /**
   * Get query statistics
   */
  getQueryStats(): QueryStats {
    // Update memory usage
    const memoryUsage = process.memoryUsage();
    this.stats.performanceMetrics.memoryUsage = memoryUsage.heapUsed;
    this.stats.performanceMetrics.peakMemoryUsage = Math.max(
      this.stats.performanceMetrics.peakMemoryUsage,
      memoryUsage.heapUsed
    );
    
    return { ...this.stats };
  }

  /**
   * Validate query input
   */
  private validateQuery(query: MCPQuery): void {
    if (!query.text?.trim()) {
      throw new Error('Query text is required');
    }
    
    if (!['semantic', 'signature', 'file', 'contextual'].includes(query.type)) {
      throw new Error(`Invalid query type: ${query.type}`);
    }
    
    if (query.maxResults && query.maxResults > 1000) {
      throw new Error('Maximum result limit is 1000');
    }
    
    if (query.minScore && (query.minScore < 0 || query.minScore > 1)) {
      throw new Error('Minimum score must be between 0 and 1');
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(queryTime: number): void {
    this.queryTimes.push(queryTime);
    
    // Keep only recent query times for percentile calculations
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }
    
    // Update average
    this.stats.averageQueryTime = this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
    
    // Calculate percentiles
    const sortedTimes = [...this.queryTimes].sort((a, b) => a - b);
    const count = sortedTimes.length;
    
    this.stats.performanceMetrics.p50QueryTime = sortedTimes[Math.floor(count * 0.5)] ?? 0;
    this.stats.performanceMetrics.p95QueryTime = sortedTimes[Math.floor(count * 0.95)] ?? 0;
    this.stats.performanceMetrics.p99QueryTime = sortedTimes[Math.floor(count * 0.99)] ?? 0;
  }

  /**
   * Get list of applied filters for metadata
   */
  private getAppliedFilters(options: any): string[] {
    const filters: string[] = [];
    
    if (options.fileFilter) filters.push('file_filter');
    if (options.languageFilter) filters.push('language_filter');
    if (options.confidenceThreshold) filters.push('confidence_threshold');
    if (options.minScore) filters.push('min_score');
    
    return filters;
  }
}