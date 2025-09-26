# TypeScript Interfaces

This document provides comprehensive type definitions for all ast-copilot-helper interfaces and types.

## Multi-Language Parser API

### `ParserFactory`

Factory for creating parser instances with automatic runtime detection.

```typescript
class ParserFactory {
  /** Create parser with automatic runtime detection */
  static createParser(
    grammarManager?: TreeSitterGrammarManager,
  ): Promise<ASTParser>;

  /** Create native parser (requires native Tree-sitter) */
  static createNativeParser(
    grammarManager?: TreeSitterGrammarManager,
  ): Promise<NativeTreeSitterParser>;

  /** Create WASM parser (fallback runtime) */
  static createWASMParser(
    grammarManager?: TreeSitterGrammarManager,
  ): Promise<WASMTreeSitterParser>;

  /** Get runtime availability information */
  static getRuntimeInfo(): Promise<{
    native: { available: boolean; error?: string };
    wasm: { available: boolean; error?: string };
    recommended: "native" | "wasm";
  }>;
}
```

### `ASTParser`

Main parser interface supporting all 15 languages.

```typescript
interface ASTParser {
  /** Parse code string for specified language */
  parseCode(
    code: string,
    language: string,
    filePath?: string,
  ): Promise<ParseResult>;

  /** Parse file from disk */
  parseFile(filePath: string): Promise<ParseResult>;

  /** Batch parse multiple files with options */
  batchParseFiles(
    files: string[],
    options?: {
      concurrency?: number;
      onProgress?: (
        completed: number,
        total: number,
        currentFile: string,
      ) => void;
      continueOnError?: boolean;
    },
  ): Promise<Map<string, ParseResult>>;

  /** Get runtime information */
  getRuntime(): ParserRuntime;

  /** Dispose parser resources */
  dispose(): Promise<void>;
}
```

### `ParseResult`

Result of parsing operation with AST nodes and metadata.

```typescript
interface ParseResult {
  /** Extracted AST nodes with normalized types */
  nodes: ASTNode[];

  /** Parse errors encountered */
  errors: ParseError[];

  /** Source language */
  language: string;

  /** Parse duration in milliseconds */
  parseTime: number;
}
```

### `ASTNode`

Normalized AST node representation across all languages.

```typescript
interface ASTNode {
  /** Deterministic node ID: sha256(filePath + position + type) */
  id: string;

  /** Normalized node type (function, class, method, etc.) */
  type: string;

  /** Identifier name if available */
  name?: string;

  /** Absolute file path */
  filePath: string;

  /** Start position */
  start: NodePosition;

  /** End position */
  end: NodePosition;

  /** Child nodes for hierarchy */
  children?: ASTNode[];

  /** Language-specific metadata */
  metadata: {
    /** Source language */
    language: string;

    /** Scope chain (module, class, function) */
    scope: string[];

    /** Access modifiers, async, static, etc. */
    modifiers: string[];

    /** Cyclomatic complexity (calculated separately) */
    complexity?: number;
  };
}
```

### `NodePosition`

Position information for AST nodes.

```typescript
interface NodePosition {
  /** Line number (1-based) */
  line: number;

  /** Column number (0-based) */
  column: number;
}
```

### `ParseError`

Parse error with detailed type information.

```typescript
interface ParseError {
  /** Error type classification */
  type:
    | "syntax"
    | "grammar"
    | "runtime"
    | "timeout"
    | "memory"
    | "file_system"
    | "network"
    | "configuration"
    | "validation";

  /** Error message */
  message: string;

  /** Error position if available */
  position?: NodePosition;

  /** Additional context */
  context?: string;
}
```

### `TreeSitterGrammarManager`

Grammar management for all 15 supported languages.

```typescript
class TreeSitterGrammarManager {
  /** Install grammar for specific language */
  installGrammar(language: string): Promise<void>;

  /** Get available grammars */
  getAvailableGrammars(): Promise<string[]>;

  /** Check if grammar is installed */
  hasGrammar(language: string): Promise<boolean>;

  /** Get grammar path */
  getGrammarPath(language: string): Promise<string>;

  /** Clear grammar cache */
  clearCache(): Promise<void>;
}
```

### `NodeClassifier`

Enhanced node classification system.

```typescript
class NodeClassifier {
  /** Classify raw node to normalized type */
  classifyNode(rawNode: RawNodeData): ClassificationResult;

  /** Get classification statistics */
  getStats(): ClassificationStats;

  /** Clear classification cache */
  clearCache(): void;
}
```

### `RawNodeData`

Raw node data from Tree-sitter parsers.

```typescript
interface RawNodeData {
  /** Raw node type from parser */
  type: string;

  /** Node name or identifier */
  name?: string;

  /** Source language */
  language: string;

  /** Parser-specific properties */
  properties?: Record<string, unknown>;

  /** Child nodes */
  children?: RawNodeData[];

  /** Parent node */
  parent?: RawNodeData;

  /** Position information */
  position?: {
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
  };

  /** Text content */
  text?: string;

  /** AST depth */
  depth?: number;
}
```

### `ClassificationResult`

Enhanced classification result with confidence.

```typescript
interface ClassificationResult {
  /** Normalized node type */
  nodeType: NodeType;

  /** Confidence level (0-1) */
  confidence: number;

  /** Classification reason */
  reason: string;

  /** Alternative classifications */
  alternatives?: Array<{
    nodeType: NodeType;
    confidence: number;
    reason: string;
  }>;

  /** Language-specific metadata */
  languageMetadata?: Record<string, unknown>;
}
```

### Supported Languages

```typescript
/** All 15 supported languages organized by tier */
const SUPPORTED_LANGUAGES = {
  /** Tier 1: Enterprise Languages (6) */
  TIER_1_ENTERPRISE: [
    "typescript", // TypeScript (.ts, .tsx)
    "javascript", // JavaScript (.js, .jsx)
    "python", // Python (.py, .pyi)
    "java", // Java (.java)
    "cpp", // C++ (.cpp, .hpp, .cc, .h)
    "c_sharp", // C# (.cs)
  ],

  /** Tier 2: Developer Languages (5) */
  TIER_2_DEVELOPER: [
    "go", // Go (.go)
    "rust", // Rust (.rs)
    "php", // PHP (.php)
    "ruby", // Ruby (.rb)
    "swift", // Swift (.swift)
  ],

  /** Tier 3: Specialized Languages (4) */
  TIER_3_SPECIALIZED: [
    "kotlin", // Kotlin (.kt, .kts)
    "scala", // Scala (.scala)
    "dart", // Dart (.dart)
    "lua", // Lua (.lua)
  ],
} as const;

/** Union type of all supported languages */
type SupportedLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "java"
  | "cpp"
  | "c_sharp"
  | "go"
  | "rust"
  | "php"
  | "ruby"
  | "swift"
  | "kotlin"
  | "scala"
  | "dart"
  | "lua";
```

## Core Types

### `ASTAnnotation`

Represents a single AST annotation extracted from source code.

```typescript
interface ASTAnnotation {
  /** Unique identifier for the annotation */
  id: string;

  /** Type of code element (function, class, interface, etc.) */
  type: AnnotationType;

  /** Name of the code element */
  name: string;

  /** File path relative to project root */
  file: string;

  /** Line number (1-indexed) */
  line: number;

  /** Column number (0-indexed) */
  column: number;

  /** Human-readable description */
  description?: string;

  /** Function parameters (for function types) */
  parameters?: Parameter[];

  /** Return type (for functions) */
  returnType?: string;

  /** Type information (for variables, properties) */
  typeInfo?: TypeInfo;

  /** JSDoc or similar annotations */
  annotations?: string[];

  /** Semantic embedding vector */
  embedding?: number[];

  /** Parent element ID (for nested elements) */
  parentId?: string;

  /** Child element IDs */
  children?: string[];

  /** Additional metadata */
  metadata?: Record<string, any>;
}
```

### `AnnotationType`

Enumeration of supported code element types.

```typescript
type AnnotationType =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "variable"
  | "const"
  | "property"
  | "method"
  | "constructor"
  | "getter"
  | "setter"
  | "import"
  | "export"
  | "namespace"
  | "module";
```

### `Parameter`

Represents a function or method parameter.

```typescript
interface Parameter {
  /** Parameter name */
  name: string;

  /** Parameter type */
  type: string;

  /** Whether parameter is optional */
  optional?: boolean;

  /** Default value */
  defaultValue?: string;

  /** Parameter description from JSDoc */
  description?: string;

  /** Whether parameter is a rest parameter */
  rest?: boolean;
}
```

### `TypeInfo`

Detailed type information for variables and properties.

```typescript
interface TypeInfo {
  /** Primary type */
  type: string;

  /** Whether type is nullable */
  nullable?: boolean;

  /** Whether type is optional */
  optional?: boolean;

  /** Generic type parameters */
  generics?: string[];

  /** Union type members */
  unionTypes?: string[];

  /** Array element type */
  arrayElementType?: string;

  /** Object properties (for object types) */
  properties?: Record<string, TypeInfo>;
}
```

## Configuration Types

### `Configuration`

Main configuration interface for ast-copilot-helper.

```typescript
interface Configuration {
  /** Parser configuration */
  parser: ParserConfig;

  /** Database configuration */
  database: DatabaseConfig;

  /** Server configuration */
  server: ServerConfig;

  /** AI/ML configuration */
  ai: AIConfig;

  /** Logging configuration */
  logging: LoggingConfig;
}
```

### `ParserConfig`

Configuration for the code parser.

```typescript
interface ParserConfig {
  /** File patterns to include */
  includePatterns: string[];

  /** File patterns to exclude */
  excludePatterns: string[];

  /** Maximum file size to process (MB) */
  maxFileSize: number;

  /** Maximum number of files to process */
  maxFiles: number;

  /** Supported programming languages */
  languages: SupportedLanguage[];

  /** Whether to extract comments */
  includeComments: boolean;

  /** Whether to generate embeddings */
  generateEmbeddings: boolean;

  /** Custom parser configurations per language */
  languageConfigs: Record<SupportedLanguage, LanguageConfig>;
}
```

### `DatabaseConfig`

Configuration for the annotation database.

```typescript
interface DatabaseConfig {
  /** Database file path */
  path: string;

  /** SQLite cache size */
  cacheSize: number;

  /** Enable Write-Ahead Logging */
  enableWAL: boolean;

  /** Backup configuration */
  backup: {
    enabled: boolean;
    interval: number; // minutes
    retainCount: number;
  };
}
```

### `ServerConfig`

Configuration for the MCP server.

```typescript
interface ServerConfig {
  /** Server port */
  port: number;

  /** Server host */
  host: string;

  /** Transport type */
  transport: TransportType;

  /** CORS configuration */
  cors: CORSConfig;

  /** Authentication configuration */
  auth: AuthConfig;

  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;
}
```

### `AIConfig`

Configuration for AI/ML features.

```typescript
interface AIConfig {
  /** Embedding model name */
  embeddingModel: string;

  /** Embedding vector dimensions */
  embeddingDimensions: number;

  /** Similarity threshold for queries */
  similarityThreshold: number;

  /** Batch size for processing */
  batchSize: number;

  /** API configuration for external AI services */
  apiConfig?: {
    endpoint: string;
    apiKey: string;
    timeout: number;
  };
}
```

## Parser Types

### `SupportedLanguage`

Enumeration of supported programming languages.

```typescript
type SupportedLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "java"
  | "csharp"
  | "go"
  | "rust"
  | "cpp"
  | "php"
  | "ruby";
```

### `LanguageConfig`

Configuration for parsing a specific language.

```typescript
interface LanguageConfig {
  /** File extensions for this language */
  extensions: string[];

  /** Tree-sitter grammar path */
  grammarPath?: string;

  /** Custom parser options */
  parserOptions: Record<string, any>;

  /** Whether to extract type information */
  extractTypes: boolean;

  /** Whether to extract comments */
  extractComments: boolean;
}
```

### `ParseResult`

Result of parsing operations.

```typescript
interface ParseResult {
  /** Parse operation success */
  success: boolean;

  /** Number of files processed */
  filesProcessed: number;

  /** Number of annotations extracted */
  annotationsExtracted: number;

  /** Processing duration (ms) */
  duration: number;

  /** Errors encountered during parsing */
  errors: ParseError[];

  /** Warnings encountered during parsing */
  warnings: ParseWarning[];

  /** Extracted annotations */
  annotations: ASTAnnotation[];
}
```

### `ParseError`

Error information from parsing operations.

```typescript
interface ParseError {
  /** Error type */
  type: "file-not-found" | "parse-failed" | "invalid-syntax" | "timeout";

  /** Error message */
  message: string;

  /** File path where error occurred */
  file: string;

  /** Line number (if applicable) */
  line?: number;

  /** Column number (if applicable) */
  column?: number;

  /** Stack trace (if applicable) */
  stack?: string;
}
```

### `ParseWarning`

Warning information from parsing operations.

```typescript
interface ParseWarning {
  /** Warning type */
  type: "large-file" | "unsupported-feature" | "deprecated-syntax";

  /** Warning message */
  message: string;

  /** File path where warning occurred */
  file: string;

  /** Line number (if applicable) */
  line?: number;
}
```

## Query Types

### `QueryResult`

Result of semantic queries.

```typescript
interface QueryResult {
  /** Query that was executed */
  query: string;

  /** Number of results found */
  totalResults: number;

  /** Query execution time (ms) */
  executionTime: number;

  /** Matching annotations */
  results: QueryMatch[];

  /** Query explanation (if requested) */
  explanation?: QueryExplanation;
}
```

### `QueryMatch`

A single query result match.

```typescript
interface QueryMatch {
  /** Matching annotation */
  annotation: ASTAnnotation;

  /** Similarity score (0-1) */
  score: number;

  /** Matching text snippets */
  highlights: string[];

  /** Context around the match */
  context: {
    before: string;
    after: string;
  };
}
```

### `QueryOptions`

Options for semantic queries.

```typescript
interface QueryOptions {
  /** Maximum number of results */
  limit?: number;

  /** Minimum similarity threshold */
  threshold?: number;

  /** Filter by annotation type */
  type?: AnnotationType;

  /** Filter by file pattern */
  filePattern?: string;

  /** Include query explanation */
  explain?: boolean;

  /** Sort order for results */
  sortBy?: "relevance" | "name" | "file" | "type";

  /** Sort direction */
  sortDirection?: "asc" | "desc";
}
```

### `QueryExplanation`

Explanation of how a query was processed.

```typescript
interface QueryExplanation {
  /** Original query */
  originalQuery: string;

  /** Processed/normalized query */
  processedQuery: string;

  /** Query vector (embedding) */
  queryVector: number[];

  /** Search strategy used */
  strategy: "semantic" | "keyword" | "hybrid";

  /** Filters applied */
  filtersApplied: string[];

  /** Processing steps */
  steps: QueryStep[];
}
```

### `QueryStep`

Individual step in query processing.

```typescript
interface QueryStep {
  /** Step name */
  name: string;

  /** Step description */
  description: string;

  /** Step duration (ms) */
  duration: number;

  /** Step result/output */
  result: any;
}
```

## Server Types

### `TransportType`

MCP server transport types.

```typescript
type TransportType = "stdio" | "sse" | "websocket";
```

### `CORSConfig`

CORS configuration for HTTP transports.

```typescript
interface CORSConfig {
  /** Enable CORS */
  enabled: boolean;

  /** Allowed origins */
  origins: string[];

  /** Allowed methods */
  methods: string[];

  /** Allowed headers */
  headers: string[];

  /** Allow credentials */
  credentials: boolean;
}
```

### `AuthConfig`

Authentication configuration.

```typescript
interface AuthConfig {
  /** Enable authentication */
  enabled: boolean;

  /** Authentication type */
  type: "bearer" | "basic" | "custom";

  /** Authentication token/secret */
  token?: string;

  /** Custom authentication function */
  customAuth?: (request: any) => boolean;
}
```

### `RateLimitConfig`

Rate limiting configuration.

```typescript
interface RateLimitConfig {
  /** Enable rate limiting */
  enabled: boolean;

  /** Maximum requests */
  requests: number;

  /** Time window (ms) */
  window: number;

  /** Rate limit key generator */
  keyGenerator?: (request: any) => string;
}
```

## MCP Protocol Types

### `MCPRequest`

Base MCP request structure.

```typescript
interface MCPRequest {
  /** JSON-RPC version */
  jsonrpc: "2.0";

  /** Request ID */
  id: string | number;

  /** Method name */
  method: string;

  /** Method parameters */
  params?: Record<string, any>;
}
```

### `MCPResponse`

Base MCP response structure.

```typescript
interface MCPResponse {
  /** JSON-RPC version */
  jsonrpc: "2.0";

  /** Request ID */
  id: string | number;

  /** Response result */
  result?: any;

  /** Error information */
  error?: MCPError;
}
```

### `MCPError`

MCP error structure.

```typescript
interface MCPError {
  /** Error code */
  code: number;

  /** Error message */
  message: string;

  /** Additional error data */
  data?: any;
}
```

### `MCPResource`

MCP resource definition.

```typescript
interface MCPResource {
  /** Resource URI */
  uri: string;

  /** Resource name */
  name: string;

  /** Resource description */
  description?: string;

  /** MIME type */
  mimeType: string;
}
```

### `MCPTool`

MCP tool definition.

```typescript
interface MCPTool {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Input schema (JSON Schema) */
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}
```

## Utility Types

### `Paginated<T>`

Generic pagination wrapper.

```typescript
interface Paginated<T> {
  /** Items in current page */
  items: T[];

  /** Total number of items */
  total: number;

  /** Current page number */
  page: number;

  /** Number of items per page */
  pageSize: number;

  /** Whether there are more pages */
  hasMore: boolean;
}
```

### `TimestampedRecord<T>`

Adds timestamp metadata to any record.

```typescript
interface TimestampedRecord<T> {
  /** The actual record data */
  data: T;

  /** Creation timestamp */
  createdAt: Date;

  /** Last modification timestamp */
  updatedAt: Date;

  /** Record version */
  version: number;
}
```

### `Result<T, E>`

Generic result type for operations that can fail.

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
```

## Type Guards

Utility type guards for runtime type checking.

```typescript
/** Check if value is a valid ASTAnnotation */
function isASTAnnotation(value: any): value is ASTAnnotation {
  return (
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.name === "string" &&
    typeof value.file === "string" &&
    typeof value.line === "number"
  );
}

/** Check if value is a valid Configuration */
function isConfiguration(value: any): value is Configuration {
  return (
    typeof value === "object" &&
    value.parser &&
    value.database &&
    value.server &&
    value.ai
  );
}

/** Check if value is a valid QueryResult */
function isQueryResult(value: any): value is QueryResult {
  return (
    typeof value === "object" &&
    typeof value.query === "string" &&
    typeof value.totalResults === "number" &&
    Array.isArray(value.results)
  );
}
```

## Constants

Type-related constants and defaults.

```typescript
/** Default configuration values */
export const DEFAULT_CONFIG: Configuration = {
  parser: {
    includePatterns: ["**/*.{ts,js,py}"],
    excludePatterns: ["node_modules/**", "dist/**"],
    maxFileSize: 10,
    maxFiles: 1000,
    languages: ["typescript", "javascript"],
    includeComments: true,
    generateEmbeddings: true,
    languageConfigs: {},
  },
  database: {
    path: ".ast-copilot-helper.db",
    cacheSize: 100,
    enableWAL: true,
    backup: {
      enabled: false,
      interval: 60,
      retainCount: 5,
    },
  },
  server: {
    port: 3001,
    host: "localhost",
    transport: "stdio",
    cors: {
      enabled: false,
      origins: [],
      methods: [],
      headers: [],
      credentials: false,
    },
    auth: { enabled: false, type: "bearer" },
    rateLimit: { enabled: true, requests: 100, window: 60000 },
  },
  ai: {
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
    similarityThreshold: 0.7,
    batchSize: 100,
  },
  logging: {
    level: "info",
    file: "ast-copilot-helper.log",
  },
};

/** Supported file extensions by language */
export const FILE_EXTENSIONS: Record<SupportedLanguage, string[]> = {
  typescript: [".ts", ".tsx"],
  javascript: [".js", ".jsx", ".mjs"],
  python: [".py", ".pyi"],
  java: [".java"],
  csharp: [".cs"],
  go: [".go"],
  rust: [".rs"],
  cpp: [".cpp", ".cc", ".cxx", ".hpp", ".h"],
  php: [".php"],
  ruby: [".rb"],
};
```
