/**
 * Signature Query Processor
 * 
 * Handles signature-based queries for exact function/method matching.
 * Implements fuzzy matching, parameter analysis, and return type filtering.
 */

import { createLogger } from '../../../ast-helper/src/logging/index.js';
import { ASTDatabaseReader } from '../database/reader.js';
import { 
  SignatureQueryOptions, 
  QueryResponse, 
  QuerySystemConfig,
  AnnotationMatch
} from './types.js';
import { ASTNodeMatch } from '../types.js';

/**
 * Signature analysis result
 */
interface SignatureAnalysis {
  functionName: string;
  parameters: SignatureParameter[];
  returnType?: string;
  isAsync?: boolean;
  isStatic?: boolean;
  visibility?: 'public' | 'private' | 'protected';
}

/**
 * Parameter in function signature
 */
interface SignatureParameter {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

/**
 * Signature matching configuration
 */
interface SignatureMatchingConfig {
  /** Weight for exact name match (0-1) */
  nameMatchWeight: number;
  
  /** Weight for parameter similarity (0-1) */
  parameterWeight: number;
  
  /** Weight for return type match (0-1) */
  returnTypeWeight: number;
  
  /** Minimum similarity threshold for fuzzy matching */
  fuzzyThreshold: number;
  
  /** Maximum Levenshtein distance for name matching */
  maxEditDistance: number;
}

/**
 * Signature Query Processor
 * 
 * Specialized processor for function/method signature queries with exact and fuzzy matching.
 * Implements parameter analysis, return type filtering, and signature similarity scoring.
 */
export class SignatureQueryProcessor {
  private logger = createLogger({ operation: 'signature-query-processor' });
  
  // Dependencies
  private annotationDatabase: ASTDatabaseReader;
  
  // Configuration
  private config: QuerySystemConfig;
  private matchingConfig: SignatureMatchingConfig;
  
  // Performance tracking
  private processedQueries = 0;
  private avgProcessingTime = 0;
  private parseTime = 0;
  private matchingTime = 0;

  constructor(
    annotationDatabase: ASTDatabaseReader,
    config: QuerySystemConfig
  ) {
    this.annotationDatabase = annotationDatabase;
    this.config = config;
    
    // Initialize matching configuration
    this.matchingConfig = {
      nameMatchWeight: 0.6,
      parameterWeight: 0.25,
      returnTypeWeight: 0.15,
      fuzzyThreshold: 0.7,
      maxEditDistance: 3,
    };
  }

  /**
   * Process signature query
   */
  async processQuery(
    signature: string, 
    options: SignatureQueryOptions = {}, 
    maxResults?: number
  ): Promise<QueryResponse> {
    const startTime = Date.now();
    this.processedQueries++;
    
    this.logger.debug('Processing signature query', {
      signature,
      exactMatch: options.exactMatch,
      includeReturnType: options.includeReturnType,
      fuzzyThreshold: options.fuzzyThreshold,
    });
    
    try {
      // Step 1: Parse the signature
      const parseStartTime = Date.now();
      const parsedSignature = this.parseSignature(signature);
      this.parseTime = Date.now() - parseStartTime;
      
      // Step 2: Search for potential matches
      const searchStartTime = Date.now();
      let candidates: ASTNodeMatch[] = [];
      
      if (options.exactMatch) {
        // Exact matching - search for the function name directly
        candidates = await this.searchExactMatches(parsedSignature, options, maxResults);
      } else {
        // Fuzzy matching - get broader search results and filter
        candidates = await this.searchFuzzyMatches(parsedSignature, options, maxResults);
      }
      
      const searchTime = Date.now() - searchStartTime;
      
      // Step 3: Score and rank matches
      const rankingStartTime = Date.now();
      const rankedResults = this.scoreAndRankMatches(
        candidates, 
        parsedSignature, 
        options
      );
      
      const rankingTime = Date.now() - rankingStartTime;
      this.matchingTime = searchTime + rankingTime;
      
      // Step 4: Apply final filtering and limits
      const finalResults = rankedResults.slice(0, maxResults || this.config.search.defaultMaxResults);
      
      // Convert ASTNodeMatch to AnnotationMatch for response
      const convertedResults = finalResults.map(match => this.convertToAnnotationMatch(match));
      
      const totalTime = Date.now() - startTime;
      this.updatePerformanceMetrics(totalTime);
      
      const response: QueryResponse = {
        results: convertedResults,
        totalMatches: rankedResults.length,
        queryTime: totalTime,
        searchStrategy: options.exactMatch ? 'signature_exact_match' : 'signature_fuzzy_match',
        metadata: {
          vectorSearchTime: 0,
          rankingTime,
          totalCandidates: candidates.length,
          appliedFilters: this.getAppliedFilters(options),
          searchParameters: {
            exactMatch: options.exactMatch ?? false,
            fuzzyThreshold: options.fuzzyThreshold || this.matchingConfig.fuzzyThreshold,
            includeReturnType: options.includeReturnType ?? true,
            parsedSignature: {
              functionName: parsedSignature.functionName,
              parameterCount: parsedSignature.parameters.length,
              hasReturnType: !!parsedSignature.returnType,
            },
          },
        },
      };
      
      this.logger.debug('Signature query completed', {
        totalResults: finalResults.length,
        totalMatches: rankedResults.length,
        totalTime,
        parseTime: this.parseTime,
        searchTime,
        rankingTime,
      });
      
      return response;
      
    } catch (error) {
      this.logger.error('Signature query processing failed', {
        error: error instanceof Error ? error.message : String(error),
        signature,
      });
      
      throw error;
    }
  }

  /**
   * Parse function signature into components
   */
  private parseSignature(signature: string): SignatureAnalysis {
    // Remove extra whitespace and normalize
    const normalized = signature.replace(/\s+/g, ' ').trim();
    
    // Extract function name and parameters
    const functionMatch = normalized.match(/(?:async\s+)?(?:function\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*(.+))?/i);
    
    if (!functionMatch) {
      // Fallback: treat entire string as function name
      return {
        functionName: normalized,
        parameters: [],
      };
    }
    
    const [, functionName, paramString, returnType] = functionMatch;
    const parameters = this.parseParameters(paramString || '');
    
    return {
      functionName: functionName || normalized,
      parameters,
      returnType: returnType?.trim(),
      isAsync: normalized.toLowerCase().includes('async'),
    };
  }

  /**
   * Parse parameter string into parameter objects
   */
  private parseParameters(paramString: string): SignatureParameter[] {
    if (!paramString.trim()) {
      return [];
    }
    
    const parameters: SignatureParameter[] = [];
    const params = paramString.split(',');
    
    for (const param of params) {
      const trimmed = param.trim();
      if (!trimmed) continue;
      
      // Parse parameter: name, type, optional, default value
      const match = trimmed.match(/(\w+)(\?)?\s*(?::\s*([^=]+))?\s*(?:=\s*(.+))?/);
      
      if (match && match[1]) {
        const [, name, optional, type, defaultValue] = match;
        parameters.push({
          name,
          type: type?.trim(),
          optional: !!optional,
          defaultValue: defaultValue?.trim(),
        });
      } else {
        // Fallback: treat as parameter name only
        parameters.push({
          name: trimmed,
        });
      }
    }
    
    return parameters;
  }

  /**
   * Search for exact signature matches
   */
  private async searchExactMatches(
    parsedSignature: SignatureAnalysis, 
    _options: SignatureQueryOptions,
    maxResults?: number
  ): Promise<ASTNodeMatch[]> {
    // Search for function name
    const nameMatches = await this.annotationDatabase.searchNodes(
      parsedSignature.functionName, 
      {
        maxResults: (maxResults || this.config.search.defaultMaxResults) * 3, // Get more candidates
        minScore: 0.9, // High threshold for exact matching
      }
    );
    
    // Filter by node types that can contain function signatures
    return nameMatches.filter(match => 
      ['function', 'method', 'arrow_function', 'function_declaration', 
       'method_definition', 'constructor'].includes(match.nodeType)
    );
  }

  /**
   * Search for fuzzy signature matches
   */
  private async searchFuzzyMatches(
    parsedSignature: SignatureAnalysis, 
    options: SignatureQueryOptions,
    maxResults?: number
  ): Promise<ASTNodeMatch[]> {
    // Search with lower threshold for broader results
    const fuzzyMatches = await this.annotationDatabase.searchNodes(
      parsedSignature.functionName, 
      {
        maxResults: (maxResults || this.config.search.defaultMaxResults) * 5, // Even more candidates
        minScore: options.fuzzyThreshold || this.matchingConfig.fuzzyThreshold,
      }
    );
    
    // Filter by function-related node types
    return fuzzyMatches.filter(match => 
      ['function', 'method', 'arrow_function', 'function_declaration', 
       'method_definition', 'constructor', 'identifier'].includes(match.nodeType)
    );
  }

  /**
   * Score and rank signature matches
   */
  private scoreAndRankMatches(
    candidates: ASTNodeMatch[], 
    targetSignature: SignatureAnalysis,
    options: SignatureQueryOptions
  ): ASTNodeMatch[] {
    const scoredMatches = candidates.map(match => {
      const score = this.calculateSignatureScore(match, targetSignature, options);
      
      return {
        ...match,
        score,
        // Add signature-specific metadata
        metadata: {
          ...match.metadata,
          signatureScore: score,
          nameMatch: this.calculateNameSimilarity(match.sourceSnippet, targetSignature.functionName),
          parameterMatch: this.estimateParameterMatch(match, targetSignature),
        },
      };
    });
    
    // Sort by score (highest first)
    return scoredMatches
      .filter(match => match.score > (options.fuzzyThreshold || this.matchingConfig.fuzzyThreshold))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate signature similarity score
   */
  private calculateSignatureScore(
    match: ASTNodeMatch, 
    targetSignature: SignatureAnalysis,
    options: SignatureQueryOptions
  ): number {
    let totalScore = 0;
    let totalWeight = 0;
    
    // Name similarity
    const nameSimilarity = this.calculateNameSimilarity(match.sourceSnippet, targetSignature.functionName);
    totalScore += nameSimilarity * this.matchingConfig.nameMatchWeight;
    totalWeight += this.matchingConfig.nameMatchWeight;
    
    // Parameter similarity (if we can extract parameter info from match)
    const parameterSimilarity = this.estimateParameterMatch(match, targetSignature);
    totalScore += parameterSimilarity * this.matchingConfig.parameterWeight;
    totalWeight += this.matchingConfig.parameterWeight;
    
    // Return type similarity (if requested)
    if (options.includeReturnType && targetSignature.returnType) {
      const returnTypeSimilarity = this.estimateReturnTypeMatch(match, targetSignature);
      totalScore += returnTypeSimilarity * this.matchingConfig.returnTypeWeight;
      totalWeight += this.matchingConfig.returnTypeWeight;
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Calculate name similarity using Levenshtein distance
   */
  private calculateNameSimilarity(text: string, targetName: string): number {
    // Extract potential function name from text
    const nameMatch = text.match(/(\w+)(?:\s*\()/);
    const extractedName = nameMatch ? nameMatch[1] : text;
    
    if (!extractedName) {
      return 0;
    }
    
    const distance = this.levenshteinDistance(
      extractedName.toLowerCase(), 
      targetName.toLowerCase()
    );
    
    const maxLength = Math.max(extractedName.length, targetName.length);
    return maxLength > 0 ? Math.max(0, 1 - distance / maxLength) : 0;
  }

  /**
   * Estimate parameter match quality
   */
  private estimateParameterMatch(match: ASTNodeMatch, targetSignature: SignatureAnalysis): number {
    // Count parentheses and commas to estimate parameter count
    const paramCount = (match.sourceSnippet.match(/,/g) || []).length + (match.sourceSnippet.includes('(') ? 1 : 0);
    const targetParamCount = targetSignature.parameters.length;
    
    if (targetParamCount === 0 && paramCount === 0) {
      return 1.0; // Perfect match for no parameters
    }
    
    if (targetParamCount === 0 || paramCount === 0) {
      return 0.5; // Partial match if one has no parameters
    }
    
    // Calculate similarity based on parameter count difference
    const diff = Math.abs(paramCount - targetParamCount);
    const maxParams = Math.max(paramCount, targetParamCount);
    
    return Math.max(0, 1 - diff / maxParams);
  }

  /**
   * Estimate return type match quality
   */
  private estimateReturnTypeMatch(match: ASTNodeMatch, targetSignature: SignatureAnalysis): number {
    if (!targetSignature.returnType) {
      return 1.0; // No return type to match
    }
    
    // Look for return type indicators in the match text
    const hasReturnType = match.sourceSnippet.includes(':') || match.sourceSnippet.includes('=>');
    
    if (hasReturnType) {
      // Extract potential return type
      const returnTypeMatch = match.sourceSnippet.match(/:\s*([^,;)]+)/);
      if (returnTypeMatch && returnTypeMatch[1]) {
        const extractedType = returnTypeMatch[1].trim();
        return this.calculateNameSimilarity(extractedType, targetSignature.returnType);
      }
    }
    
    return 0.5; // Neutral score if no return type info available
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix: number[][] = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));
    
    for (let i = 0; i <= a.length; i++) matrix[0]![i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j]![0] = j;
    
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1, // insertion
          matrix[j - 1]![i]! + 1, // deletion
          matrix[j - 1]![i - 1]! + substitutionCost // substitution
        );
      }
    }
    
    return matrix[b.length]![a.length]!;
  }

  /**
   * Get applied filters for metadata
   */
  private getAppliedFilters(options: SignatureQueryOptions): string[] {
    const filters: string[] = [];
    
    if (options.exactMatch) {
      filters.push('exact_match');
    }
    
    if (options.includeReturnType) {
      filters.push('return_type_matching');
    }
    
    if (options.fuzzyThreshold) {
      filters.push(`fuzzy_threshold_${options.fuzzyThreshold}`);
    }
    
    return filters;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(queryTime: number): void {
    this.avgProcessingTime = (
      (this.avgProcessingTime * (this.processedQueries - 1)) + queryTime
    ) / this.processedQueries;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      processedQueries: this.processedQueries,
      avgProcessingTime: this.avgProcessingTime,
      avgParseTime: this.parseTime,
      avgMatchingTime: this.matchingTime,
    };
  }

  /**
   * Convert ASTNodeMatch to AnnotationMatch for response formatting
   */
  private convertToAnnotationMatch(match: ASTNodeMatch): AnnotationMatch {
    return {
      annotation: {
        nodeId: match.nodeId,
        signature: match.signature,
        summary: match.summary,
        filePath: match.filePath,
        lineNumber: match.startLine,
        language: this.extractLanguageFromPath(match.filePath),
        confidence: Math.min(1.0, match.score * 1.2), // Scale score to confidence
        lastUpdated: match.updatedAt,
        isPrivate: false, // Could be inferred from node context
        nodeType: match.nodeType,
        parentId: match.parentId,
      },
      score: match.score,
      matchReason: match.matchReason || 'signature_similarity',
      contextSnippet: match.sourceSnippet,
    };
  }

  /**
   * Extract programming language from file path
   */
  private extractLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'js': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
    };
    
    return languageMap[ext || ''] || 'unknown';
  }
}