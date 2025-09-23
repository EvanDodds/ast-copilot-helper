/**
 * Base abstract parser class for Tree-sitter AST parsing
 * Defines the common interface for all parser implementations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ParseResult, ParseError, ASTNode, LanguageConfig, ParserRuntime } from '../types.js';
import { detectLanguage, getLanguageConfig, isFileSupported } from '../languages.js';

/**
 * Abstract base class for all Tree-sitter parser implementations
 */
export abstract class BaseParser {
  protected runtime: ParserRuntime;
  protected initializedLanguages: Map<string, any> = new Map();

  constructor(runtime: ParserRuntime) {
    this.runtime = runtime;
  }

  /**
   * Parse a file and return the AST
   */
  async parseFile(filePath: string): Promise<ParseResult> {
    const startTime = performance.now();
    
    try {
      // Validate file exists and is supported
      const absolutePath = path.resolve(filePath);
      
      try {
        await fs.access(absolutePath);
      } catch (error) {
        return {
          nodes: [],
          errors: [{
            type: 'runtime',
            message: `File not found: ${absolutePath}`,
            position: { line: 0, column: 0 },
            context: `filePath: ${absolutePath}`,
          }],
          language: '',
          parseTime: performance.now() - startTime,
        };
      }

      // Detect language
      const detectedLanguage = detectLanguage(absolutePath);
      if (!detectedLanguage) {
        return {
          nodes: [],
          errors: [{
            type: 'runtime',
            message: `Unsupported file type: ${path.extname(absolutePath)}`,
            position: { line: 0, column: 0 },
            context: `extension: ${path.extname(absolutePath)}`,
          }],
          language: '',
          parseTime: performance.now() - startTime,
        };
      }

      // Read file content
      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch (error) {
        return {
          nodes: [],
          errors: [{
            type: 'runtime',
            message: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            position: { line: 0, column: 0 },
            context: `filePath: ${absolutePath}`,
          }],
          language: detectedLanguage,
          parseTime: performance.now() - startTime,
        };
      }

      // Parse content
      return this.parseCode(content, detectedLanguage, absolutePath);

    } catch (error) {
      return {
        nodes: [],
        errors: [{
          type: 'runtime',
          message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          position: { line: 0, column: 0 },
          context: 'system error during file parsing',
        }],
        language: '',
        parseTime: performance.now() - startTime,
      };
    }
  }

  /**
   * Parse code string and return the AST
   */
  async parseCode(code: string, language: string, filePath?: string): Promise<ParseResult> {
    const startTime = performance.now();
    const resolvedFilePath = filePath ? path.resolve(filePath) : '<string>';

    try {
      // Get language configuration
      const languageConfig = getLanguageConfig(language);
      if (!languageConfig) {
        return {
          nodes: [],
          errors: [{
            type: 'runtime',
            message: `Unsupported language: ${language}`,
            position: { line: 0, column: 0 },
            context: `language: ${language}`,
          }],
          language,
          parseTime: performance.now() - startTime,
        };
      }

      // Initialize parser for this language if needed
      let parser;
      try {
        parser = await this.getParserForLanguage(languageConfig);
      } catch (error) {
        return {
          nodes: [],
          errors: [{
            type: 'runtime',
            message: `Failed to initialize parser for ${language}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            position: { line: 0, column: 0 },
            context: `language: ${language}`,
          }],
          language,
          parseTime: performance.now() - startTime,
        };
      }

      // Parse the code
      let tree;
      try {
        tree = parser.parse(code);
      } catch (error) {
        return {
          nodes: [],
          errors: [{
            type: 'syntax',
            message: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            position: { line: 0, column: 0 },
            context: `language: ${language}`,
          }],
          language,
          parseTime: performance.now() - startTime,
        };
      }

      // Convert tree to our AST format
      const nodes = this.treeToASTNodes(tree, code, resolvedFilePath, language);

      // Extract syntax errors from the parsed tree
      const syntaxErrors = this.extractSyntaxErrors(tree, code);
      
      return {
        nodes,
        errors: syntaxErrors,
        language,
        parseTime: performance.now() - startTime,
      };

    } catch (error) {
      return {
        nodes: [],
        errors: [{
          type: 'runtime',
          message: `Unexpected error during parsing: ${error instanceof Error ? error.message : 'Unknown error'}`,
          position: { line: 0, column: 0 },
          context: `language: ${language}`,
        }],
        language,
        parseTime: performance.now() - startTime,
      };
    }
  }

  /**
   * Parse multiple files in batch
   */
  async batchParseFiles(
    files: string[], 
    options: {
      concurrency?: number;
      onProgress?: (completed: number, total: number, currentFile: string) => void;
      continueOnError?: boolean;
    } = {}
  ): Promise<Map<string, ParseResult>> {
    const {
      concurrency = Math.min(4, Math.max(1, require('os').cpus().length)),
      onProgress,
      continueOnError = true,
    } = options;

    const results = new Map<string, ParseResult>();
    const totalFiles = files.length;
    let completedFiles = 0;

    // Filter to only supported files
    const supportedFiles = files.filter(file => isFileSupported(file));
    const unsupportedFiles = files.filter(file => !isFileSupported(file));

    // Add results for unsupported files
    for (const unsupportedFile of unsupportedFiles) {
      const absolutePath = path.resolve(unsupportedFile);
      results.set(absolutePath, {
        nodes: [],
        errors: [{
          type: 'runtime',
          message: `Unsupported file type: ${path.extname(unsupportedFile)}`,
          position: { line: 0, column: 0 },
          context: `extension: ${path.extname(unsupportedFile)}`,
        }],
        language: '',
        parseTime: 0,
      });
      completedFiles++;
      onProgress?.(completedFiles, totalFiles, unsupportedFile);
    }

    // Process supported files in batches
    const processBatch = async (batch: string[]): Promise<Array<[string, ParseResult]>> => {
      const batchPromises = batch.map(async (file): Promise<[string, ParseResult]> => {
        try {
          const result = await this.parseFile(file);
          completedFiles++;
          onProgress?.(completedFiles, totalFiles, file);
          return [path.resolve(file), result];
        } catch (error) {
          completedFiles++;
          onProgress?.(completedFiles, totalFiles, file);
          const absolutePath = path.resolve(file);
          return [absolutePath, {
            nodes: [],
            errors: [{
              type: 'runtime',
              message: `Batch processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              position: { line: 0, column: 0 },
              context: `filePath: ${file}`,
            }],
            language: detectLanguage(file) || '',
            parseTime: 0,
          }];
        }
      });

      if (continueOnError) {
        return Promise.all(batchPromises);
      } else {
        // If not continuing on error, fail fast
        const settled = await Promise.allSettled(batchPromises);
        const failed = settled.find(result => result.status === 'rejected');
        if (failed) {
          throw (failed as PromiseRejectedResult).reason;
        }
        return settled.map(result => (result as PromiseFulfilledResult<[string, ParseResult]>).value);
      }
    };

    try {
      // Process files in concurrent batches
      for (let i = 0; i < supportedFiles.length; i += concurrency) {
        const batch = supportedFiles.slice(i, i + concurrency);
        const batchResults = await processBatch(batch);
        for (const [filePath, result] of batchResults) {
          results.set(filePath, result);
        }
      }

      return results;

    } catch (error) {
      // If we get here, it means continueOnError was false and we hit an error
      throw error;
    }
  }

  /**
   * Get parser instance for a specific language
   * Implemented by subclasses for native vs WASM handling
   */
  protected abstract getParserForLanguage(config: LanguageConfig): Promise<any>;

  /**
   * Convert Tree-sitter tree to our AST format
   */
  protected abstract treeToASTNodes(tree: any, sourceCode: string, filePath: string, language: string): ASTNode[];

  /**
   * Extract syntax errors from parsed tree
   */
  protected extractSyntaxErrors(tree: any, sourceCode: string): ParseError[] {
    const errors: ParseError[] = [];
    
    // Check if the tree has any error nodes
    const cursor = tree.walk();
    const visitNode = () => {
      if (cursor.currentNode?.hasError || cursor.currentNode?.isMissing) {
        const node = cursor.currentNode;
        const startPosition = node.startPosition;
        const endPosition = node.endPosition;
        
        // Extract the problematic text
        const lines = sourceCode.split('\n');
        const errorLine = lines[startPosition.row] || '';
        const errorText = sourceCode.slice(node.startIndex, node.endIndex);
        
        errors.push({
          type: 'syntax',
          message: node.isMissing 
            ? `Missing ${node.type || 'syntax element'}` 
            : `Syntax error in ${node.type || 'code'}`,
          position: {
            line: startPosition.row + 1, // Convert to 1-based
            column: startPosition.column + 1,
          },
          context: `${errorText || errorLine.slice(startPosition.column, endPosition.column)} (${node.type || 'unknown'})`,
        });
      }

      // Visit children
      if (cursor.gotoFirstChild()) {
        do {
          visitNode();
        } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    };

    visitNode();
    
    return errors;
  }

  /**
   * Get runtime information
   */
  getRuntime(): ParserRuntime {
    return this.runtime;
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.initializedLanguages.clear();
  }
}