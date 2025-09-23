/**
 * @fileoverview Response Assembly and Formatting System
 * 
 * Converts internal query results into MCP protocol-compliant responses.
 * Handles result aggregation, formatting, metadata enrichment, and pagination.
 */

import { createLogger } from '../../../ast-helper/src/logging/index.js';

import type {
  QueryResponse,
  AnnotationMatch,
  QueryMetadata,
  MCPQuery,
  Annotation,
  QuerySystemConfig,
} from './types.js';

/**
 * Response formatting options
 */
interface ResponseFormattingOptions {
  /** Include source code snippets in responses */
  includeSnippets: boolean;
  
  /** Maximum snippet length in characters */
  maxSnippetLength: number;
  
  /** Include relevance explanations */
  includeRelevanceExplanation: boolean;
  
  /** Format for code snippets (markdown, plain) */
  snippetFormat: 'markdown' | 'plain';
  
  /** Include file context information */
  includeFileContext: boolean;
  
  /** Maximum number of related matches to include */
  maxRelatedMatches: number;
}

/**
 * MCP Resource structure for protocol compliance
 */
interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP Tool structure for protocol compliance
 */
interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

/**
 * MCP-compliant query response format
 */
export interface MCPQueryResponse {
  /** Response type for MCP protocol */
  _meta: {
    responseType: 'query_results';
    timestamp: string;
    requestId?: string;
    processingTime: number;
  };
  
  /** Main result data */
  content: Array<{
    type: 'code' | 'text' | 'resource';
    text?: string;
    code?: string;
    language?: string;
    resource?: MCPResource;
    metadata: {
      score: number;
      filePath: string;
      lineNumber: number;
      signature?: string;
      summary?: string;
      matchReason: string;
      relevanceFactors?: Record<string, number>;
    };
  }>;
  
  /** Pagination information */
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    nextCursor?: string;
  };
  
  /** Query execution metadata */
  queryMetadata: QueryMetadata & {
    queryType: string;
    queryText: string;
    performanceMetrics: {
      totalTime: number;
      vectorSearchTime?: number;
      rankingTime?: number;
      formattingTime: number;
    };
  };
  
  /** Available tools and resources */
  capabilities: {
    availableTools: MCPTool[];
    supportedQueryTypes: string[];
    maxResultsPerQuery: number;
  };
}

/**
 * Response Assembly and Formatting System
 * 
 * Central component for converting internal query results into MCP protocol-compliant
 * responses with proper formatting, metadata, and pagination support.
 */
export class ResponseAssembler {
  private logger = createLogger({ operation: 'response-assembler' });
  
  private config: QuerySystemConfig;
  private formattingOptions: ResponseFormattingOptions;
  
  // Performance tracking
  private processedResponses = 0;
  private avgFormattingTime = 0;

  constructor(config: QuerySystemConfig) {
    this.config = config;
    
    // Initialize formatting options with defaults
    this.formattingOptions = {
      includeSnippets: true,
      maxSnippetLength: 500,
      includeRelevanceExplanation: true,
      snippetFormat: 'markdown',
      includeFileContext: true,
      maxRelatedMatches: 3,
    };
  }

  /**
   * Assemble and format query response for MCP protocol
   */
  async assembleResponse(
    queryResponse: QueryResponse,
    originalQuery: MCPQuery,
    requestId?: string,
    page = 1,
    pageSize = 50
  ): Promise<MCPQueryResponse> {
    const startTime = Date.now();
    
    this.logger.debug('Assembling response', {
      resultCount: queryResponse.results.length,
      queryType: originalQuery.type,
      page,
      pageSize,
    });
    
    try {
      // Calculate pagination
      const pagination = this.calculatePagination(
        queryResponse.results.length,
        queryResponse.totalMatches,
        page,
        pageSize
      );
      
      // Slice results for current page
      const paginatedResults = queryResponse.results.slice(
        (page - 1) * pageSize,
        page * pageSize
      );
      
      // Format each result
      const formattedContent = await Promise.all(
        paginatedResults.map(result => this.formatAnnotationMatch(result))
      );
      
      // Build performance metadata
      const formattingTime = Date.now() - startTime;
      const performanceMetrics = {
        totalTime: queryResponse.queryTime + formattingTime,
        vectorSearchTime: queryResponse.metadata.vectorSearchTime,
        rankingTime: queryResponse.metadata.rankingTime,
        formattingTime,
      };
      
      // Assemble final MCP response
      const mcpResponse: MCPQueryResponse = {
        _meta: {
          responseType: 'query_results',
          timestamp: new Date().toISOString(),
          requestId,
          processingTime: performanceMetrics.totalTime,
        },
        content: formattedContent,
        pagination,
        queryMetadata: {
          ...queryResponse.metadata,
          queryType: originalQuery.type,
          queryText: originalQuery.text,
          performanceMetrics,
        },
        capabilities: {
          availableTools: this.getAvailableTools(),
          supportedQueryTypes: ['semantic', 'signature', 'file', 'contextual'],
          maxResultsPerQuery: this.config.search.defaultMaxResults,
        },
      };
      
      // Update performance tracking
      this.updatePerformanceMetrics(formattingTime);
      
      this.logger.info('Response assembled successfully', {
        contentItems: formattedContent.length,
        totalMatches: queryResponse.totalMatches,
        formattingTime,
        page,
        pageSize,
      });
      
      return mcpResponse;
      
    } catch (error) {
      this.logger.error('Response assembly failed', {
        error: error instanceof Error ? error.message : String(error),
        queryType: originalQuery.type,
        resultCount: queryResponse.results.length,
      });
      throw error;
    }
  }

  /**
   * Format individual annotation match into MCP content
   */
  private async formatAnnotationMatch(
    match: AnnotationMatch
  ): Promise<MCPQueryResponse['content'][0]> {
    const annotation = match.annotation;
    
    // Determine content type based on annotation
    let contentType: 'code' | 'text' | 'resource' = 'code';
    let formattedText = '';
    let codeContent = '';
    const language = this.detectLanguage(annotation.filePath);
    
    // Format main content
    if (this.formattingOptions.includeSnippets && match.contextSnippet) {
      if (this.formattingOptions.snippetFormat === 'markdown') {
        codeContent = this.formatCodeSnippet(
          match.contextSnippet,
          language,
          annotation.lineNumber
        );
        contentType = 'code';
      } else {
        formattedText = this.truncateSnippet(
          match.contextSnippet, 
          this.formattingOptions.maxSnippetLength
        );
        contentType = 'text';
      }
    } else {
      // Fallback to signature and summary
      formattedText = this.formatSignatureAndSummary(annotation);
      contentType = 'text';
    }
    
    // Build metadata
    const metadata = {
      score: match.score,
      filePath: annotation.filePath,
      lineNumber: annotation.lineNumber,
      signature: annotation.signature,
      summary: annotation.summary,
      matchReason: match.matchReason,
      ...(this.formattingOptions.includeRelevanceExplanation && {
        relevanceExplanation: this.generateRelevanceExplanation(match),
      }),
    };
    
    return {
      type: contentType,
      ...(contentType === 'code' ? { code: codeContent, language } : { text: formattedText }),
      metadata,
    };
  }

  /**
   * Format code snippet with syntax highlighting metadata
   */
  private formatCodeSnippet(snippet: string, language: string, lineNumber: number): string {
    const lines = snippet.split('\n');
    const startLine = Math.max(1, lineNumber - Math.floor(lines.length / 2));
    
    // Add line numbers for context
    const numberedLines = lines.map((line, index) => {
      const currentLine = startLine + index;
      const marker = currentLine === lineNumber ? '→' : ' ';
      return `${marker}${currentLine.toString().padStart(4)}: ${line}`;
    });
    
    return `\`\`\`${language}\n${numberedLines.join('\n')}\n\`\`\``;
  }

  /**
   * Format signature and summary as fallback content
   */
  private formatSignatureAndSummary(annotation: Annotation): string {
    let formatted = annotation.signature;
    
    if (annotation.summary) {
      formatted += `\n\n${annotation.summary}`;
    }
    
    return formatted;
  }

  /**
   * Generate human-readable relevance explanation
   */
  private generateRelevanceExplanation(match: AnnotationMatch): string {
    const score = Math.round(match.score * 100);
    let explanation = `${score}% relevance`;
    
    // Add specific reasons based on match reason
    const reasons: string[] = [];
    
    if (match.matchReason.includes('vector_similarity')) {
      reasons.push('semantic similarity');
    }
    
    if (match.matchReason.includes('context_boost')) {
      reasons.push('context relevance');
    }
    
    if (match.matchReason.includes('exact_match')) {
      reasons.push('exact match');
    }
    
    if (match.matchReason.includes('fuzzy_match')) {
      reasons.push('partial match');
    }
    
    if (reasons.length > 0) {
      explanation += ` (${reasons.join(', ')})`;
    }
    
    return explanation;
  }

  /**
   * Detect programming language from file path
   */
  private detectLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
    };
    
    return extension ? languageMap[extension] || extension : 'text';
  }

  /**
   * Truncate text snippet to maximum length
   */
  private truncateSnippet(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
return text;
}
    
    // Try to break at word boundary
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Calculate pagination metadata
   */
  private calculatePagination(
    _currentResultCount: number,
    totalMatches: number,
    page: number,
    pageSize: number
  ) {
    const totalPages = Math.ceil(totalMatches / pageSize);
    const hasMore = page < totalPages;
    
    return {
      total: totalMatches,
      page,
      pageSize,
      hasMore,
      ...(hasMore && {
        nextCursor: `page_${page + 1}`,
      }),
    };
  }

  /**
   * Get available MCP tools
   */
  private getAvailableTools(): MCPTool[] {
    return [
      {
        name: 'semantic_query',
        description: 'Search code using natural language queries',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Natural language query' },
            maxResults: { type: 'number', description: 'Maximum results to return' },
          },
          required: ['text'],
        },
      },
      {
        name: 'signature_query',
        description: 'Search for specific function or method signatures',
        inputSchema: {
          type: 'object',
          properties: {
            signature: { type: 'string', description: 'Function or method signature' },
            exactMatch: { type: 'boolean', description: 'Require exact match' },
          },
          required: ['signature'],
        },
      },
      {
        name: 'file_query',
        description: 'Search within specific files or file patterns',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'File path or glob pattern' },
            recursive: { type: 'boolean', description: 'Search recursively' },
          },
          required: ['filePath'],
        },
      },
    ];
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(formattingTime: number): void {
    this.processedResponses++;
    this.avgFormattingTime = (this.avgFormattingTime * (this.processedResponses - 1) + formattingTime) / this.processedResponses;
  }

  /**
   * Get response assembler performance statistics
   */
  getPerformanceStats() {
    return {
      processedResponses: this.processedResponses,
      avgFormattingTime: this.avgFormattingTime,
      formattingOptions: this.formattingOptions,
    };
  }

  /**
   * Update formatting options
   */
  updateFormattingOptions(options: Partial<ResponseFormattingOptions>): void {
    this.formattingOptions = { ...this.formattingOptions, ...options };
    
    this.logger.info('Formatting options updated', {
      newOptions: this.formattingOptions,
    });
  }
}