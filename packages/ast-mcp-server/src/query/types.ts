/**
 * @fileoverview Query system type definitions for MCP Server Query System
 */

/**
 * Main query processor interface that handles all query types
 */
export interface QueryProcessor {
  processQuery(query: MCPQuery): Promise<QueryResponse>;
  processSemanticQuery(text: string, options?: SemanticQueryOptions): Promise<QueryResponse>;
  processSignatureQuery(signature: string, options?: SignatureQueryOptions): Promise<QueryResponse>;
  processFileQuery(filePath: string, options?: FileQueryOptions): Promise<QueryResponse>;
  getQueryStats(): QueryStats;
}

/**
 * Core query types supported by the system
 */
export type QueryType = 'semantic' | 'signature' | 'file' | 'contextual';

/**
 * Main query object for MCP protocol
 */
export interface MCPQuery {
  type: QueryType;
  text: string;
  options?: QueryOptions;
  context?: QueryContext;
  maxResults?: number;
  minScore?: number;
}

/**
 * Base query options interface
 */
export interface QueryOptions {
  fileFilter?: string[];         // Filter by file paths
  languageFilter?: string[];     // Filter by programming language
  confidenceThreshold?: number;  // Minimum annotation confidence
  includePrivate?: boolean;      // Include private/internal symbols
  rankingMode?: RankingMode;     // How to rank results
}

/**
 * Ranking modes for query results
 */
export type RankingMode = 'similarity' | 'relevance' | 'recency';

/**
 * Context information for queries
 */
export interface QueryContext {
  currentFile?: string;       // User's current file
  cursorPosition?: number;    // Line number in current file
  selectedText?: string;      // User's text selection
  recentFiles?: string[];     // Recently accessed files
}

/**
 * Semantic query specific options
 */
export interface SemanticQueryOptions extends QueryOptions {
  searchEf?: number;              // HNSW search parameter for quality
  useContextBoosting?: boolean;   // Enable context-based boosting
  includeSimilarResults?: boolean; // Include similar matches
}

/**
 * Signature query specific options
 */
export interface SignatureQueryOptions extends QueryOptions {
  exactMatch?: boolean;        // Require exact signature match
  fuzzyThreshold?: number;     // Similarity threshold for fuzzy matching
  includeReturnType?: boolean; // Include return type in matching
}

/**
 * File query specific options
 */
export interface FileQueryOptions extends QueryOptions {
  recursive?: boolean;         // Search recursively in subdirectories
  includeHidden?: boolean;     // Include hidden files
  maxDepth?: number;          // Maximum directory depth
}

/**
 * Query response structure
 */
export interface QueryResponse {
  results: AnnotationMatch[];
  totalMatches: number;
  queryTime: number;          // Processing time in milliseconds
  searchStrategy: string;     // Description of search approach used
  metadata: QueryMetadata;
}

/**
 * Individual annotation match with relevance information
 */
export interface AnnotationMatch {
  annotation: Annotation;
  score: number;             // Relevance score (0-1)
  matchReason: string;       // Why this result matched
  contextSnippet?: string;   // Relevant code context
  relatedMatches?: string[]; // IDs of related annotations
}

/**
 * Annotation interface - references existing annotation system
 * This should match the annotation types from the annotation system (Issue #10)
 */
export interface Annotation {
  nodeId: string;
  signature: string;
  summary?: string;
  filePath: string;
  lineNumber: number;
  language: string;
  confidence: number;
  lastUpdated: Date;
  isPrivate?: boolean;
  nodeType?: string;
  parentId?: string;
}

/**
 * Query metadata for debugging and optimization
 */
export interface QueryMetadata {
  vectorSearchTime: number;
  rankingTime: number;
  totalCandidates: number;
  appliedFilters: string[];
  searchParameters: Record<string, any>;
}

/**
 * Query statistics for monitoring and optimization
 */
export interface QueryStats {
  totalQueries: number;
  averageQueryTime: number;
  queryTypeBreakdown: Record<QueryType, number>;
  cacheHitRatio: number;
  errorRate: number;
  performanceMetrics: PerformanceMetrics;
}

/**
 * Performance metrics for query system
 */
export interface PerformanceMetrics {
  p50QueryTime: number;       // 50th percentile query time
  p95QueryTime: number;       // 95th percentile query time
  p99QueryTime: number;       // 99th percentile query time
  memoryUsage: number;        // Current memory usage in bytes
  peakMemoryUsage: number;    // Peak memory usage in bytes
  concurrentQueries: number;  // Current concurrent query count
}

/**
 * Search result from vector database (used internally)
 */
export interface SearchResult {
  nodeId: string;
  score: number;
  metadata: SearchMetadata;
}

/**
 * Search metadata from vector operations
 */
export interface SearchMetadata {
  filePath: string;
  confidence: number;
  vectorSearchTime?: number;
  [key: string]: any;
}

/**
 * MCP response format for query results
 */
export interface MCPResponse {
  type: 'query_response';
  data: {
    matches: MCPMatch[];
    metadata: {
      totalMatches: number;
      queryTime: number;
      strategy: string;
    };
  };
}

/**
 * MCP-formatted match for protocol compliance
 */
export interface MCPMatch {
  id: string;
  signature: string;
  summary?: string;
  filePath: string;
  lineNumber: number;
  score: number;
  matchReason: string;
  context?: string;
}

/**
 * Cache entry structure for query caching
 */
export interface CacheEntry<T = QueryResponse> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  ttl: number;              // Time to live in milliseconds
}

/**
 * Query cache configuration
 */
export interface CacheConfig {
  maxSize: number;          // Maximum number of cached entries
  defaultTTL: number;       // Default time to live in milliseconds
  cleanupInterval: number;  // Cache cleanup interval in milliseconds
  enabled: boolean;         // Whether caching is enabled
}

/**
 * Batch query request for processing multiple queries
 */
export interface BatchQueryRequest {
  queries: MCPQuery[];
  options?: BatchQueryOptions;
}

/**
 * Batch query options
 */
export interface BatchQueryOptions {
  maxConcurrency?: number;  // Maximum concurrent queries
  failOnError?: boolean;    // Fail entire batch on single query error
  timeoutMs?: number;       // Timeout for entire batch in milliseconds
}

/**
 * Batch query response
 */
export interface BatchQueryResponse {
  results: (QueryResponse | QueryError)[];
  batchTime: number;
  successCount: number;
  errorCount: number;
}

/**
 * Query error structure
 */
export interface QueryError {
  error: string;
  code: string;
  query?: MCPQuery;
  timestamp: number;
}

/**
 * Query system configuration
 */
export interface QuerySystemConfig {
  cache: CacheConfig;
  performance: {
    maxQueryTime: number;     // Maximum allowed query time in milliseconds
    maxMemoryUsage: number;   // Maximum memory usage in bytes
    maxConcurrentQueries: number; // Maximum concurrent queries
  };
  ranking: {
    defaultMode: RankingMode;
    contextBoostFactor: number;   // How much to boost contextual results
    confidenceWeight: number;     // Weight for confidence in ranking
    recencyWeight: number;        // Weight for recency in ranking
    diversityThreshold: number;   // Threshold for result diversity
  };
  search: {
    defaultMaxResults: number;
    defaultMinScore: number;
    defaultSearchEf: number;      // Default HNSW search parameter
  };
}