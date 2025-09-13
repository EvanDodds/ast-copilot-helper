/**
 * Core types and interfaces for the Tree-sitter AST parsing system
 */

import { createHash } from 'crypto';

export interface NodePosition {
  line: number;
  column: number;
}

export interface ASTNode {
  id: string;                    // Deterministic hash: sha256(filePath + position + type)
  type: string;                  // Normalized node type (function, class, method, etc.)
  name?: string;                 // Identifier name if available
  filePath: string;              // Absolute file path
  start: NodePosition;
  end: NodePosition;
  children?: ASTNode[];          // Child nodes for hierarchy
  metadata: {
    language: string;            // Source language
    scope: string[];            // Scope chain (module, class, function)
    modifiers: string[];        // Access modifiers, async, static, etc.
    complexity?: number;        // Cyclomatic complexity (calculated later)
  };
}

export interface ParseResult {
  nodes: ASTNode[];
  errors: ParseError[];
  language: string;
  parseTime: number;
}

export interface ParseError {
  type: 'syntax' | 'grammar' | 'runtime' | 'timeout' | 'memory' | 'file_system' | 'network' | 'configuration' | 'validation';
  message: string;
  position?: NodePosition;
  context?: string;
}

export interface LanguageConfig {
  name: string;
  extensions: string[];
  grammarUrl: string;
  grammarHash: string;       // SHA256 for integrity verification
  parserModule?: string;     // Node module name for native parser
  wasmPath?: string;         // WASM grammar path for fallback
}

export interface ParserRuntime {
  type: 'native' | 'wasm';
  available: boolean;
  initialize(): Promise<void>;
  createParser(language: string): Promise<any>;
}

export interface ASTParser {
  parseFile(filePath: string): Promise<ParseResult>;
  parseCode(code: string, language: string, filePath?: string): Promise<ParseResult>;
  batchParseFiles(files: string[], options?: {
    concurrency?: number;
    onProgress?: (completed: number, total: number, currentFile: string) => void;
    continueOnError?: boolean;
  }): Promise<Map<string, ParseResult>>;
  getRuntime(): ParserRuntime;
  dispose(): Promise<void>;
}

export interface GrammarManager {
  downloadGrammar(language: string): Promise<string>;
  getCachedGrammarPath(language: string): Promise<string>;
  verifyGrammarIntegrity(language: string): Promise<boolean>;
  loadParser(language: string): Promise<any>;
}

/**
 * Normalized AST node with consistent structure across languages
 */
export interface NormalizedASTNode {
  /** Deterministic unique identifier for the node */
  id: string;
  
  /** Normalized node type (language-agnostic) */
  normalizedType: string;
  
  /** Original node type from Tree-sitter */
  originalType: string;
  
  /** Source language */
  language: string;
  
  /** File path */
  filePath: string;
  
  /** Node position information */
  position: {
    start: NodePosition;
    end: NodePosition;
  };
  
  /** Normalized metadata */
  metadata: {
    /** Semantic category (declaration, statement, expression, etc.) */
    category: 'declaration' | 'statement' | 'expression' | 'literal' | 'identifier' | 'other';
    
    /** Scope depth from root */
    scopeDepth: number;
    
    /** Scope identifier for the current scope */
    scopeId: string;
    
    /** Whether this node creates a new scope */
    createsSope: boolean;
    
    /** Complexity metrics */
    complexity: {
      cyclomatic: number;
      cognitive: number;
      nesting: number;
    };
    
    /** Node attributes specific to the category */
    attributes: Record<string, any>;
  };
  
  /** Normalized child nodes */
  children: NormalizedASTNode[];
  
  /** Hash of the node content for change detection */
  contentHash: string;
}

/**
 * Utility function to generate deterministic node IDs
 */
export function generateNodeId(
  filePath: string,
  startLine: number,
  startColumn: number,
  nodeType: string
): string {
  const content = `${filePath}:${startLine}:${startColumn}:${nodeType}`;
  return createHash('sha256').update(content).digest('hex');
}