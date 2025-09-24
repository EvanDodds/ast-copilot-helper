/**
 * Core AST Schema Definition
 *
 * Defines the normalized AST schema and types used across all supported
 * programming languages for consistent data structures.
 */

/**
 * Position information within source code
 */
export interface Position {
  /** 1-based line number */
  line: number;
  /** 0-based column number */
  column: number;
  /** Byte offset from file start (optional for performance) */
  offset?: number;
}

/**
 * Normalized node types for AST nodes across all supported languages
 */
export enum NodeType {
  // Top-level constructs
  FILE = "file",
  MODULE = "module",
  NAMESPACE = "namespace",

  // Class-related
  CLASS = "class",
  INTERFACE = "interface",
  ENUM = "enum",
  TYPE_ALIAS = "type_alias",

  // Function-related
  FUNCTION = "function",
  METHOD = "method",
  CONSTRUCTOR = "constructor",
  GETTER = "getter",
  SETTER = "setter",
  ARROW_FUNCTION = "arrow_function",

  // Variable-related
  VARIABLE = "variable",
  PARAMETER = "parameter",
  PROPERTY = "property",
  FIELD = "field",

  // Control flow
  IF_STATEMENT = "if_statement",
  FOR_LOOP = "for_loop",
  WHILE_LOOP = "while_loop",
  SWITCH_STATEMENT = "switch_statement",
  TRY_CATCH = "try_catch",

  // Imports and exports
  IMPORT = "import",
  EXPORT = "export",

  // Other significant constructs
  DECORATOR = "decorator",
  COMMENT = "comment",
  STRING_LITERAL = "string_literal",
}

/**
 * Significance levels for AST nodes indicating importance for indexing
 */
export enum SignificanceLevel {
  /** Classes, functions, modules - most important */
  CRITICAL = 5,
  /** Methods, interfaces, major control flow */
  HIGH = 4,
  /** Properties, smaller functions, imports */
  MEDIUM = 3,
  /** Variables, parameters, simple statements */
  LOW = 2,
  /** Comments, literals, trivial expressions */
  MINIMAL = 1,
}

/**
 * Metadata container for language-specific and contextual information
 */
export interface NodeMetadata {
  /** Source programming language */
  language: string;
  /** Scope chain from root to this node */
  scope: string[];
  /** Access modifiers, keywords (static, async, etc.) */
  modifiers: string[];
  /** Imported symbols referenced by this node */
  imports: string[];
  /** Symbols exported by this node */
  exports: string[];
  /** Extracted documentation (docstrings, comments) */
  docstring?: string;
  /** Language-specific annotations (@override, decorators) */
  annotations: string[];
  /** Language-specific data that doesn't fit standard categories */
  languageSpecific?: Record<string, any>;
}

/**
 * Complete normalized AST node representation
 */
export interface ASTNode {
  // Identity and classification
  /** Deterministic hash: sha256(filePath + position + type + name) */
  id: string;
  /** Normalized node type */
  type: NodeType;
  /** Identifier name (function name, class name, etc.) */
  name?: string;

  // Location information
  /** Absolute file path */
  filePath: string;
  /** Start position in source */
  start: Position;
  /** End position in source */
  end: Position;

  // Hierarchy and relationships
  /** Parent node ID */
  parent?: string;
  /** Child node IDs */
  children: string[];

  // Metadata and context
  /** Language-specific and contextual information */
  metadata: NodeMetadata;

  // Content and analysis
  /** Raw source code (for small nodes, max 500 chars) */
  sourceText?: string;
  /** Generated signature (functions, classes) */
  signature?: string;

  // Quality and significance metrics
  /** How important this node is for indexing */
  significance: SignificanceLevel;
  /** Cyclomatic complexity (if applicable) */
  complexity?: number;
}

/**
 * Processing context for AST node creation
 */
export interface ProcessingContext {
  /** File path being processed */
  filePath: string;
  /** Programming language */
  language: string;
  /** Complete source text of file */
  sourceText: string;
  /** Current scope chain */
  parentScope: string[];
  /** Import mapping for symbol resolution */
  imports: Map<string, string>;
  /** Set of exported symbols */
  exports: Set<string>;
}

/**
 * Version information for schema compatibility
 */
export const AST_SCHEMA_VERSION = "1.0.0";

/**
 * Configuration constants
 */
export const AST_CONFIG = {
  /** Maximum source text length to include in nodes */
  MAX_SOURCE_TEXT_LENGTH: 500,
  /** Hash algorithm for node IDs */
  HASH_ALGORITHM: "sha256" as const,
  /** File extension for serialized AST nodes */
  AST_FILE_EXTENSION: ".json",
} as const;

/**
 * Type guard to check if an object is a valid Position
 */
export function isValidPosition(obj: any): obj is Position {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.line === "number" &&
    typeof obj.column === "number" &&
    obj.line >= 1 &&
    obj.column >= 0 &&
    (obj.offset === undefined || typeof obj.offset === "number")
  );
}

/**
 * Type guard to check if an object is a valid ASTNode
 */
export function isValidASTNode(obj: any): obj is ASTNode {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.id === "string" &&
    obj.id.length === 64 && // SHA-256 hex length
    Object.values(NodeType).includes(obj.type) &&
    typeof obj.filePath === "string" &&
    isValidPosition(obj.start) &&
    isValidPosition(obj.end) &&
    Array.isArray(obj.children) &&
    typeof obj.metadata === "object" &&
    obj.metadata !== null &&
    Object.values(SignificanceLevel).includes(obj.significance)
  );
}

/**
 * Type guard to check if a string is a valid NodeType
 */
export function isValidNodeType(type: string): type is NodeType {
  return Object.values(NodeType).includes(type as NodeType);
}

/**
 * Type guard to check if a number is a valid SignificanceLevel
 */
export function isValidSignificanceLevel(
  level: number,
): level is SignificanceLevel {
  return Object.values(SignificanceLevel).includes(level as SignificanceLevel);
}
