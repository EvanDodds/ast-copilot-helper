/**
 * File-based Query Processor
 * 
 * Implements specialized processing for file-based queries including:
 * - File path and name searches
 * - Glob pattern matching 
 * - Directory traversal
 * - File content filtering
 * - Text-based search capabilities
 */

import { EventEmitter } from 'events';
import { minimatch } from 'minimatch';
import path from 'path';
import { createLogger, LogLevel } from '../../../ast-helper/src/logging/index.js';
import { 
  FileQuery,
  ASTNodeMatch,
  AnnotationMatch,
  QueryPerformanceMetrics,
  FileMatchCriteria,
  Annotation
} from './types.js';
import { ASTDatabaseReader } from '../database/reader.js';

const logger = createLogger({ 
  level: LogLevel.INFO,
  operation: 'file-processor'
});

/**
 * Configuration for file query processing
 */
export interface FileProcessorConfig {
  /** Maximum number of file results to return */
  maxResults?: number;
  /** Enable case-sensitive matching for file paths */
  caseSensitive?: boolean;
  /** Include hidden files and directories in results */
  includeHidden?: boolean;
  /** Maximum depth for directory traversal */
  maxDepth?: number;
  /** Enable glob pattern expansion */
  enableGlobPatterns?: boolean;
  /** Enable fuzzy matching for file names */
  fuzzyMatching?: boolean;
  /** Minimum similarity score for fuzzy matching (0-1) */
  fuzzyThreshold?: number;
}

/**
 * Default configuration for file processing
 */
const DEFAULT_CONFIG: Required<FileProcessorConfig> = {
  maxResults: 100,
  caseSensitive: false,
  includeHidden: false,
  maxDepth: 10,
  enableGlobPatterns: true,
  fuzzyMatching: true,
  fuzzyThreshold: 0.6
};

/**
 * File search result with metadata
 */
interface FileSearchResult {
  /** File path relative to workspace root */
  filePath: string;
  /** File name without directory */
  fileName: string;
  /** Directory containing the file */
  directory: string;
  /** File extension */
  extension: string;
  /** Match score (0-1) */
  score: number;
  /** Match type (exact, glob, fuzzy, content) */
  matchType: 'exact' | 'glob' | 'fuzzy' | 'content';
  /** Matched content snippets if content search */
  contentMatches?: Array<{
    line: number;
    text: string;
    snippet: string;
  }>;
}

/**
 * Specialized processor for file-based queries
 */
export class FileQueryProcessor extends EventEmitter {
  private readonly config: Required<FileProcessorConfig>;
  private readonly databaseReader: ASTDatabaseReader;

  constructor(
    databaseReader: ASTDatabaseReader,
    config: FileProcessorConfig = {}
  ) {
    super();
    this.databaseReader = databaseReader;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process a file-based query
   */
  async processQuery(query: FileQuery): Promise<{
    matches: AnnotationMatch[];
    performance: QueryPerformanceMetrics;
  }> {
    const startTime = Date.now();

    try {
      // Search for matching files based on criteria
      const fileResults = await this.searchFiles(query);

      // Convert file results to AST node matches if needed
      const astMatches = await this.convertToASTMatches(fileResults);

      // Convert AST matches to annotation matches
      const annotationMatches = this.convertToAnnotationMatches(astMatches);

      const endTime = Date.now();
      const performance: QueryPerformanceMetrics = {
        totalTime: endTime - startTime,
        searchTime: endTime - startTime,
        processingTime: 0,
        resultCount: annotationMatches.length,
        cacheHit: false,
        timestamp: new Date()
      };

      return {
        matches: annotationMatches,
        performance
      };

    } catch (error) {
      const endTime = Date.now();
      const performance: QueryPerformanceMetrics = {
        totalTime: endTime - startTime,
        searchTime: 0,
        processingTime: 0,
        resultCount: 0,
        cacheHit: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error)
      };

      logger.error('File query processing failed', { 
        query: query.text,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        matches: [],
        performance
      };
    }
  }

  /**
   * Search for files matching the query criteria
   */
  private async searchFiles(query: FileQuery): Promise<FileSearchResult[]> {
    const results: FileSearchResult[] = [];
    const searchText = query.text.toLowerCase();
    const criteria = query.criteria || {};

    // Get all files from database
    const allFiles = await this.getAllFiles();

    for (const fileInfo of allFiles) {
      const matches = this.evaluateFileMatch(fileInfo, searchText, criteria);
      
      if (matches.length > 0) {
        results.push(...matches);
      }
    }

    // Sort by relevance score (highest first)
    results.sort((a, b) => b.score - a.score);

    // Apply result limit
    return results.slice(0, this.config.maxResults);
  }

  /**
   * Get all available files from the database
   */
  private async getAllFiles(): Promise<Array<{
    path: string;
    name: string;
    directory: string;
    extension: string;
  }>> {
    try {
      // Get file paths from the database - this is a simplified approach
      // In a real implementation, we'd have a dedicated file index
      const files: Array<{
        path: string;
        name: string;
        directory: string;
        extension: string;
      }> = [];

      // For now, return empty array - this would be populated from database file index
      return files;

    } catch (error) {
      logger.error('Failed to get files from database', { error });
      return [];
    }
  }

  /**
   * Evaluate if a file matches the search criteria
   */
  private evaluateFileMatch(
    fileInfo: {
      path: string;
      name: string;
      directory: string;
      extension: string;
    },
    searchText: string,
    criteria: FileMatchCriteria
  ): FileSearchResult[] {
    const results: FileSearchResult[] = [];
    const fileName = this.config.caseSensitive ? fileInfo.name : fileInfo.name.toLowerCase();
    const filePath = this.config.caseSensitive ? fileInfo.path : fileInfo.path.toLowerCase();
    
    // Skip hidden files if not included
    if (!this.config.includeHidden && fileInfo.name.startsWith('.')) {
      return results;
    }

    // Check file extension filters
    if (criteria.extensions && criteria.extensions.length > 0) {
      const matchesExtension = criteria.extensions.some((ext: string) => 
        fileInfo.extension.toLowerCase() === ext.toLowerCase()
      );
      if (!matchesExtension) {
        return results;
      }
    }

    // Check directory filters
    if (criteria.directories && criteria.directories.length > 0) {
      const matchesDirectory = criteria.directories.some((dir: string) => {
        const dirPattern = this.config.caseSensitive ? dir : dir.toLowerCase();
        const fileDir = this.config.caseSensitive ? fileInfo.directory : fileInfo.directory.toLowerCase();
        return fileDir.includes(dirPattern);
      });
      if (!matchesDirectory) {
        return results;
      }
    }

    // 1. Exact filename match
    if (fileName === searchText) {
      results.push({
        filePath: fileInfo.path,
        fileName: fileInfo.name,
        directory: fileInfo.directory,
        extension: fileInfo.extension,
        score: 1.0,
        matchType: 'exact'
      });
    }

    // 2. Exact path match
    if (filePath === searchText) {
      results.push({
        filePath: fileInfo.path,
        fileName: fileInfo.name,
        directory: fileInfo.directory,
        extension: fileInfo.extension,
        score: 0.95,
        matchType: 'exact'
      });
    }

    // 3. Glob pattern matching
    if (this.config.enableGlobPatterns && this.isGlobPattern(searchText)) {
      const globOptions = { 
        nocase: !this.config.caseSensitive,
        matchBase: true
      };
      
      if (minimatch(fileName, searchText, globOptions) || 
          minimatch(filePath, searchText, globOptions)) {
        results.push({
          filePath: fileInfo.path,
          fileName: fileInfo.name,
          directory: fileInfo.directory,
          extension: fileInfo.extension,
          score: 0.9,
          matchType: 'glob'
        });
      }
    }

    // 4. Partial filename match
    if (fileName.includes(searchText)) {
      const score = searchText.length / fileName.length; // Longer matches score higher
      results.push({
        filePath: fileInfo.path,
        fileName: fileInfo.name,
        directory: fileInfo.directory,
        extension: fileInfo.extension,
        score: Math.max(0.8, score),
        matchType: 'exact'
      });
    }

    // 5. Fuzzy filename matching
    if (this.config.fuzzyMatching) {
      const fuzzyScore = this.calculateFuzzyScore(fileName, searchText);
      if (fuzzyScore >= this.config.fuzzyThreshold) {
        results.push({
          filePath: fileInfo.path,
          fileName: fileInfo.name,
          directory: fileInfo.directory,
          extension: fileInfo.extension,
          score: fuzzyScore * 0.7, // Reduce score for fuzzy matches
          matchType: 'fuzzy'
        });
      }
    }

    // Remove duplicates and return highest scoring match per file
    const uniqueResults = new Map<string, FileSearchResult>();
    for (const result of results) {
      const existing = uniqueResults.get(result.filePath);
      if (!existing || result.score > existing.score) {
        uniqueResults.set(result.filePath, result);
      }
    }

    return Array.from(uniqueResults.values());
  }

  /**
   * Check if a string contains glob pattern characters
   */
  private isGlobPattern(pattern: string): boolean {
    return /[*?[\]{}]/.test(pattern);
  }

  /**
   * Calculate fuzzy similarity score using Levenshtein distance
   */
  private calculateFuzzyScore(str1: string, str2: string): number {
    if (str1.length === 0) return str2.length === 0 ? 1 : 0;
    if (str2.length === 0) return 0;

    const matrix: number[][] = [];
    
    // Initialize matrix with proper size
    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = new Array(str2.length + 1);
    }
    
    // Initialize first row and column
    for (let i = 0; i <= str2.length; i++) {
      matrix[0]![i] = i;
    }
    
    for (let j = 1; j <= str1.length; j++) {
      matrix[j]![0] = j;
    }

    // Fill the matrix
    for (let j = 1; j <= str1.length; j++) {
      for (let i = 1; i <= str2.length; i++) {
        if (str1[j - 1] === str2[i - 1]) {
          matrix[j]![i] = matrix[j - 1]![i - 1]!;
        } else {
          matrix[j]![i] = Math.min(
            matrix[j - 1]![i]! + 1,     // deletion
            matrix[j]![i - 1]! + 1,     // insertion
            matrix[j - 1]![i - 1]! + 1  // substitution
          );
        }
      }
    }

    const maxLength = Math.max(str1.length, str2.length);
    const distance = matrix[str1.length]![str2.length]!;
    return 1 - (distance / maxLength);
  }

  /**
   * Convert file search results to AST node matches
   */
  private async convertToASTMatches(fileResults: FileSearchResult[]): Promise<ASTNodeMatch[]> {
    const astMatches: ASTNodeMatch[] = [];

    for (const fileResult of fileResults) {
      try {
        // Get AST nodes for this file
        const nodes = await this.databaseReader.getFileNodes(fileResult.filePath);
        
        if (nodes && nodes.length > 0) {
          // Find the root/file node
          const fileNode = nodes.find(node => node.nodeType === 'file' || node.parentId === null);
          
          if (fileNode) {
            astMatches.push({
              id: fileNode.nodeId,
              type: fileNode.nodeType,
              name: fileResult.fileName,
              filePath: fileResult.filePath,
              startLine: fileNode.startLine,
              endLine: fileNode.endLine,
              sourceSnippet: fileNode.sourceSnippet || fileResult.fileName,
              score: fileResult.score,
              metadata: {
                matchType: fileResult.matchType,
                directory: fileResult.directory,
                extension: fileResult.extension,
                contentMatches: fileResult.contentMatches
              }
            });
          }
        } else {
          // Create a virtual file match if no AST nodes exist
          astMatches.push({
            id: `file-${fileResult.filePath}`,
            type: 'file',
            name: fileResult.fileName,
            filePath: fileResult.filePath,
            startLine: 1,
            endLine: 1,
            sourceSnippet: fileResult.fileName,
            score: fileResult.score,
            metadata: {
              matchType: fileResult.matchType,
              directory: fileResult.directory,
              extension: fileResult.extension,
              contentMatches: fileResult.contentMatches
            }
          });
        }

      } catch (error) {
        logger.warn('Failed to get AST nodes for file', {
          file: fileResult.filePath,
          error: error instanceof Error ? error.message : String(error)
        });

        // Create virtual match for files without AST data
        astMatches.push({
          id: `file-${fileResult.filePath}`,
          type: 'file',
          name: fileResult.fileName,
          filePath: fileResult.filePath,
          startLine: 1,
          endLine: 1,
          sourceSnippet: fileResult.fileName,
          score: fileResult.score,
          metadata: {
            matchType: fileResult.matchType,
            directory: fileResult.directory,
            extension: fileResult.extension,
            contentMatches: fileResult.contentMatches
          }
        });
      }
    }

    return astMatches;
  }

  /**
   * Convert AST node matches to annotation matches
   */
  private convertToAnnotationMatches(astMatches: ASTNodeMatch[]): AnnotationMatch[] {
    return astMatches.map(match => {
      // Create a minimal annotation from AST match
      const annotation: Annotation = {
        nodeId: match.id,
        signature: match.name,
        summary: `File: ${match.name}`,
        filePath: match.filePath,
        lineNumber: match.startLine,
        language: this.getLanguageFromExtension(match.filePath),
        confidence: match.score,
        lastUpdated: new Date(),
        nodeType: match.type
      };

      return {
        annotation,
        score: match.score,
        matchReason: match.metadata?.matchType || 'file-match',
        contextSnippet: match.sourceSnippet,
        relatedMatches: []
      };
    });
  }

  /**
   * Get programming language from file extension
   */
  private getLanguageFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin'
    };
    return languageMap[ext] || 'unknown';
  }

  /**
   * Search for content within files
   */
  async searchFileContent(
    query: string,
    filePaths?: string[]
  ): Promise<Array<{
    filePath: string;
    matches: Array<{
      line: number;
      text: string;
      snippet: string;
    }>;
  }>> {
    const results: Array<{
      filePath: string;
      matches: Array<{
        line: number;
        text: string;
        snippet: string;
      }>;
    }> = [];

    try {
      // Use database text search to find content matches
      const textMatches = await this.databaseReader.searchNodes(query, {
        maxResults: this.config.maxResults
      });

      // Group matches by file
      const fileMatches = new Map<string, Array<{
        line: number;
        text: string;
        snippet: string;
      }>>();

      for (const match of textMatches) {
        if (!filePaths || filePaths.includes(match.filePath)) {
          let matches = fileMatches.get(match.filePath);
          if (!matches) {
            matches = [];
            fileMatches.set(match.filePath, matches);
          }

          matches.push({
            line: match.startLine,
            text: match.sourceSnippet || '',
            snippet: match.sourceSnippet || ''
          });
        }
      }

      // Convert to results format
      for (const [filePath, matches] of fileMatches) {
        results.push({ filePath, matches });
      }

    } catch (error) {
      logger.error('Content search failed', { 
        query,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return results;
  }

  /**
   * Get file information including metadata
   */
  async getFileInfo(filePath: string): Promise<{
    path: string;
    name: string;
    directory: string;
    extension: string;
    size?: number;
    modified?: Date;
    nodeCount?: number;
  } | null> {
    try {
      const fileName = path.basename(filePath);
      const directory = path.dirname(filePath);
      const extension = path.extname(fileName);

      // Get AST node count for this file
      const nodes = await this.databaseReader.getFileNodes(filePath);
      const nodeCount = nodes?.length || 0;

      return {
        path: filePath,
        name: fileName,
        directory,
        extension,
        nodeCount
      };

    } catch (error) {
      logger.error('Failed to get file info', {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
}