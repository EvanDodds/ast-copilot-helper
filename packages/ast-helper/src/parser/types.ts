/**
 * Core types and interfaces for the Tree-sitter AST parsing system
 */

import { createHash } from 'crypto';

export interface ASTNode {
  id: string;                    // Deterministic hash: sha256(filePath + position + type)
  type: string;                  // Normalized node type (function, class, method, etc.)
  name?: string;                 // Identifier name if available
  filePath: string;              // Absolute file path
  start: { line: number; column: number };
  end: { line: number; column: number };
  children?: string[];           // Child node IDs for hierarchy
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
  type: 'syntax' | 'grammar' | 'runtime';
  message: string;
  position?: { line: number; column: number };
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
  parseFile(filePath: string): Promise<ASTNode[]>;
  batchParseFiles(files: string[]): Promise<Map<string, ASTNode[]>>;
  detectLanguage(filePath: string): string | null;
  isLanguageSupported(language: string): boolean;
}

export interface GrammarManager {
  downloadGrammar(language: string): Promise<string>;
  getCachedGrammarPath(language: string): Promise<string>;
  verifyGrammarIntegrity(language: string): Promise<boolean>;
  loadParser(language: string): Promise<any>;
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