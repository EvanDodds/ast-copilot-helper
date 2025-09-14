# API Documentation

This document provides comprehensive API documentation for the AST MCP Server, including all available tools, resources, and their usage patterns.

## Table of Contents

- [Tools API](#tools-api)
- [Resources API](#resources-api)
- [Configuration API](#configuration-api)
- [Error Handling](#error-handling)
- [Request/Response Examples](#requestresponse-examples)

## Tools API

All tools follow the MCP (Model Context Protocol) specification for tool calling. Each tool has a name, description, and input schema that defines the expected parameters.

### Core Analysis Tools

#### `parse_file`

Parses a file into its Abstract Syntax Tree representation.

**Parameters:**
```typescript
{
  filePath: string;              // Path to the file to parse
  language?: string;             // Language hint (auto-detected if omitted)
  includeComments?: boolean;     // Include comment nodes (default: false)
  includePositions?: boolean;    // Include source positions (default: true)
  parseOptions?: {               // Language-specific parsing options
    ecmaVersion?: number;        // For JavaScript/TypeScript
    sourceType?: 'module' | 'script';
    allowImportExportEverywhere?: boolean;
    allowReturnOutsideFunction?: boolean;
  };
}
```

**Returns:**
```typescript
{
  success: boolean;
  ast: ASTNode;                  // The parsed AST
  language: string;              // Detected/used language
  parseTime: number;             // Parse duration in ms
  nodeCount: number;             // Total number of AST nodes
  errors?: ParseError[];         // Parse errors if any
}
```

**Example:**
```json
{
  "name": "parse_file",
  "arguments": {
    "filePath": "./src/utils/parser.ts",
    "includeComments": true,
    "parseOptions": {
      "ecmaVersion": 2022,
      "sourceType": "module"
    }
  }
}
```

#### `analyze_functions`

Extracts and analyzes function definitions from a file or AST.

**Parameters:**
```typescript
{
  filePath?: string;             // File to analyze (exclusive with ast)
  ast?: ASTNode;                 // Pre-parsed AST (exclusive with filePath)
  includePrivate?: boolean;      // Include private functions (default: true)
  includeAnonymous?: boolean;    // Include anonymous functions (default: false)
  includeArrowFunctions?: boolean; // Include arrow functions (default: true)
  extractDocumentation?: boolean; // Extract JSDoc/comments (default: false)
  analyzeComplexity?: boolean;   // Calculate cyclomatic complexity (default: false)
}
```

**Returns:**
```typescript
{
  success: boolean;
  functions: FunctionInfo[];     // Array of function information
  totalFunctions: number;        // Total count
  analysisTime: number;          // Analysis duration in ms
}

interface FunctionInfo {
  name: string;                  // Function name
  type: 'function' | 'method' | 'constructor' | 'arrow' | 'anonymous';
  visibility: 'public' | 'private' | 'protected';
  async: boolean;                // Is async function
  generator: boolean;            // Is generator function
  parameters: ParameterInfo[];   // Function parameters
  returnType?: string;           // Return type (if available)
  documentation?: string;        // Extracted documentation
  complexity?: number;           // Cyclomatic complexity
  startLine: number;            // Start line number
  endLine: number;              // End line number
  startColumn: number;          // Start column
  endColumn: number;            // End column
}
```

#### `analyze_classes`

Extracts and analyzes class definitions from a file or AST.

**Parameters:**
```typescript
{
  filePath?: string;             // File to analyze
  ast?: ASTNode;                 // Pre-parsed AST
  includePrivate?: boolean;      // Include private classes (default: true)
  includeAbstract?: boolean;     // Include abstract classes (default: true)
  analyzeInheritance?: boolean;  // Analyze inheritance chain (default: false)
  extractMembers?: boolean;      // Extract class members (default: true)
  extractDocumentation?: boolean; // Extract documentation (default: false)
}
```

**Returns:**
```typescript
{
  success: boolean;
  classes: ClassInfo[];          // Array of class information
  totalClasses: number;
  analysisTime: number;
}

interface ClassInfo {
  name: string;                  // Class name
  type: 'class' | 'interface' | 'abstract';
  visibility: 'public' | 'private' | 'protected';
  extends?: string[];            // Parent classes
  implements?: string[];         // Implemented interfaces
  members: MemberInfo[];         // Class members
  documentation?: string;        // Extracted documentation
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}
```

#### `extract_imports`

Analyzes import/require statements and dependencies.

**Parameters:**
```typescript
{
  filePath?: string;             // File to analyze
  ast?: ASTNode;                 // Pre-parsed AST
  resolveModules?: boolean;      // Resolve module paths (default: false)
  includeBuiltins?: boolean;     // Include built-in modules (default: true)
  groupByType?: boolean;         // Group by import type (default: false)
}
```

**Returns:**
```typescript
{
  success: boolean;
  imports: ImportInfo[];         // Array of import information
  exports: ExportInfo[];         // Array of export information
  dependencies: string[];        // List of dependencies
  analysisTime: number;
}

interface ImportInfo {
  source: string;                // Module/file path
  type: 'import' | 'require' | 'dynamic';
  specifiers: ImportSpecifier[]; // Imported names
  isBuiltin: boolean;           // Is built-in module
  resolved?: string;            // Resolved file path
  startLine: number;
  endLine: number;
}
```

### Search & Query Tools

#### `semantic_search`

Performs semantic search across the codebase using embeddings.

**Parameters:**
```typescript
{
  query: string;                 // Search query
  fileTypes?: string[];          // File extensions to search
  directories?: string[];        // Directories to search in
  excludePatterns?: string[];    // Glob patterns to exclude
  maxResults?: number;           // Maximum results (default: 50)
  threshold?: number;            // Similarity threshold (0-1, default: 0.7)
  includeContext?: boolean;      // Include surrounding context (default: true)
  contextLines?: number;         // Context lines before/after (default: 3)
}
```

**Returns:**
```typescript
{
  success: boolean;
  results: SearchResult[];       // Search results
  totalMatches: number;          // Total matches found
  searchTime: number;            // Search duration in ms
  queryId: string;              // Unique query ID for persistence
}

interface SearchResult {
  filePath: string;              // File path
  score: number;                 // Similarity score (0-1)
  matches: TextMatch[];          // Matched text segments
  context?: string[];           // Surrounding context lines
}
```

#### `find_definitions`

Locates function, class, or variable definitions.

**Parameters:**
```typescript
{
  symbol: string;                // Symbol name to find
  symbolType?: 'function' | 'class' | 'variable' | 'type' | 'interface';
  filePath?: string;             // Specific file to search in
  scope?: 'file' | 'directory' | 'workspace'; // Search scope
  exactMatch?: boolean;          // Exact name match (default: false)
  includeDeclarations?: boolean; // Include type declarations (default: true)
}
```

**Returns:**
```typescript
{
  success: boolean;
  definitions: DefinitionInfo[];  // Found definitions
  totalFound: number;
  searchTime: number;
}

interface DefinitionInfo {
  symbol: string;                // Symbol name
  type: 'function' | 'class' | 'variable' | 'type' | 'interface';
  filePath: string;             // File containing definition
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  context: string;              // Code context
  documentation?: string;       // Associated documentation
}
```

#### `find_references`

Finds all references to a specific symbol.

**Parameters:**
```typescript
{
  symbol: string;                // Symbol to find references for
  filePath?: string;             // File containing the symbol definition
  includeDeclaration?: boolean;  // Include the declaration itself
  scope?: 'file' | 'directory' | 'workspace';
  groupByFile?: boolean;         // Group results by file
}
```

**Returns:**
```typescript
{
  success: boolean;
  references: ReferenceInfo[];   // Found references
  totalReferences: number;
  searchTime: number;
}
```

### File Operation Tools

#### `read_file_smart`

Intelligently reads files with AST context and analysis.

**Parameters:**
```typescript
{
  filePath: string;              // File to read
  includeAST?: boolean;          // Include parsed AST
  includeAnalysis?: boolean;     // Include file analysis
  maxSize?: number;              // Max file size in bytes
  encoding?: string;             // Text encoding (default: 'utf-8')
  highlightSyntax?: boolean;     // Add syntax highlighting
}
```

**Returns:**
```typescript
{
  success: boolean;
  content: string;               // File content
  size: number;                  // File size in bytes
  encoding: string;              // Used encoding
  language?: string;             // Detected language
  ast?: ASTNode;                 // Parsed AST (if requested)
  analysis?: FileAnalysis;       // File analysis (if requested)
  highlighted?: string;          // Syntax-highlighted content
}
```

#### `analyze_repository`

Performs comprehensive analysis of an entire repository.

**Parameters:**
```typescript
{
  repositoryPath: string;        // Path to repository root
  includeHidden?: boolean;       // Include hidden files/directories
  maxDepth?: number;             // Maximum directory depth
  fileTypes?: string[];          // File types to analyze
  excludePatterns?: string[];    // Patterns to exclude
  analyzeGit?: boolean;          // Include Git analysis
  generateEmbeddings?: boolean;  // Generate semantic embeddings
  extractDocumentation?: boolean; // Extract documentation
}
```

**Returns:**
```typescript
{
  success: boolean;
  repository: RepositoryInfo;    // Repository analysis
  files: FileInfo[];            // File-level information
  statistics: RepoStatistics;    // Overall statistics
  analysisTime: number;
}
```

## Resources API

Resources provide read-only access to analyzed data using URI-based addressing.

### Resource URI Patterns

All resources follow the pattern: `{scheme}://{type}/{path}?{params}`

### AST Resources

#### `ast://file/{path}`

Returns the parsed AST for a specific file.

**Parameters (query string):**
- `includeComments=true/false` - Include comment nodes
- `includePositions=true/false` - Include source positions
- `format=json/yaml` - Response format

**Example:**
```
ast://file/src/utils/parser.ts?includeComments=true&format=json
```

#### `ast://directory/{path}`

Returns ASTs for all files in a directory.

**Parameters:**
- `recursive=true/false` - Include subdirectories
- `fileTypes=.ts,.js` - Comma-separated file extensions

### Structure Resources

#### `structure://file/{path}`

Returns structural overview of a file.

**Returns:**
```typescript
{
  filePath: string;
  language: string;
  size: number;
  lineCount: number;
  functions: FunctionSummary[];
  classes: ClassSummary[];
  imports: ImportSummary[];
  exports: ExportSummary[];
  complexity: ComplexityMetrics;
}
```

#### `structure://repository/{path}`

Returns structural overview of entire repository.

### Analysis Resources

#### `analysis://complexity/{path}`

Returns code complexity metrics.

**Returns:**
```typescript
{
  filePath: string;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  functionComplexity: FunctionComplexity[];
  classComplexity: ClassComplexity[];
  recommendations: string[];
}
```

#### `analysis://dependencies/{path}`

Returns dependency analysis.

**Returns:**
```typescript
{
  filePath: string;
  imports: DependencyInfo[];
  exports: ExportInfo[];
  circularDependencies: CircularDependency[];
  unusedImports: UnusedImport[];
  missingDependencies: MissingDependency[];
}
```

### Search Resources

#### `search://results/{queryId}`

Returns persistent search results.

#### `search://history`

Returns search query history.

#### `search://suggestions`

Returns search suggestions based on codebase analysis.

## Configuration API

Configuration can be managed through environment variables, configuration files, or programmatically.

### Environment Variables

All configuration options can be set via environment variables with the `MCP_SERVER_` prefix:

```bash
# Server identity
MCP_SERVER_NAME="My AST Server"
MCP_SERVER_VERSION="1.0.0"
MCP_SERVER_DESCRIPTION="Custom AST analysis server"

# Transport configuration  
MCP_SERVER_TRANSPORT_TYPE=websocket
MCP_SERVER_PORT=3001
MCP_SERVER_HOST=localhost
MCP_SERVER_MAX_CONNECTIONS=100

# Performance settings
MCP_SERVER_MAX_CONCURRENT_REQUESTS=50
MCP_SERVER_CACHE_SIZE=1000
MCP_SERVER_CACHE_ENABLED=true
MCP_SERVER_GC_THRESHOLD=0.8

# Logging configuration
MCP_SERVER_LOG_LEVEL=info
MCP_SERVER_LOG_FILE=./logs/server.log
MCP_SERVER_LOG_REQUEST_BODY=false

# Security settings
MCP_SERVER_ENABLE_CORS=true
MCP_SERVER_ENABLE_TLS=false
MCP_SERVER_ENABLE_AUTH=false
MCP_SERVER_RATE_LIMIT_REQUESTS=1000

# Feature toggles
MCP_SERVER_ENABLE_TOOLS=true
MCP_SERVER_ENABLE_RESOURCES=true
MCP_SERVER_ENABLE_HOT_RELOAD=true

# Database settings
MCP_SERVER_DATABASE_PATH=./ast-analysis.db
```

### Configuration File Format

JSON configuration file example:

```json
{
  "name": "Production AST Server",
  "version": "1.2.0",
  "description": "High-performance AST analysis server",
  
  "transport": {
    "type": "websocket",
    "port": 3001,
    "host": "0.0.0.0",
    "maxConnections": 200,
    "timeout": 30000
  },
  
  "performance": {
    "maxConcurrentRequests": 100,
    "requestTimeout": 60000,
    "maxQueryResults": 1000,
    "cacheSize": 2048,
    "cacheEnabled": true,
    "gcThreshold": 0.7
  },
  
  "logging": {
    "level": "warn",
    "enableFile": true,
    "filePath": "./logs/production.log",
    "enableRequestLogging": false,
    "logRequestBody": false,
    "enableStructuredLogging": true
  },
  
  "security": {
    "enableAuthentication": true,
    "enableRateLimit": true,
    "rateLimitRequests": 1000,
    "rateLimitWindow": 60000,
    "enableCors": true,
    "enableTls": true,
    "allowedOrigins": ["https://app.example.com"]
  },
  
  "features": {
    "enableTools": true,
    "enableResources": true,
    "enableHotReload": false,
    "enableTestEndpoints": false,
    "enableMetricsEndpoint": true
  },
  
  "database": {
    "path": "./data/production.db",
    "hotReload": false,
    "backupInterval": 3600000,
    "maxSize": "10GB"
  },
  
  "environment": {
    "nodeEnv": "production",
    "debugMode": false
  }
}
```

## Error Handling

All API responses follow a consistent error format:

### Success Response
```typescript
{
  success: true,
  data: any,                     // Response data
  metadata?: {                   // Optional metadata
    timestamp: string,
    duration: number,
    version: string
  }
}
```

### Error Response
```typescript
{
  success: false,
  error: {
    code: string,                // Error code (e.g., "PARSE_ERROR")
    message: string,             // Human-readable error message
    details?: any,               // Additional error details
    stack?: string               // Stack trace (in development)
  },
  metadata?: {
    timestamp: string,
    requestId: string
  }
}
```

### Error Codes

Common error codes used throughout the API:

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Request format is invalid |
| `MISSING_PARAMETER` | Required parameter is missing |
| `INVALID_PARAMETER` | Parameter value is invalid |
| `FILE_NOT_FOUND` | Requested file doesn't exist |
| `PERMISSION_DENIED` | Access to resource denied |
| `PARSE_ERROR` | Failed to parse file/AST |
| `ANALYSIS_ERROR` | Analysis operation failed |
| `SEARCH_ERROR` | Search operation failed |
| `TIMEOUT_ERROR` | Operation timed out |
| `INTERNAL_ERROR` | Internal server error |
| `RATE_LIMITED` | Request rate limit exceeded |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

## Request/Response Examples

### Example: Parse File Tool Call

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "parse_file",
    "arguments": {
      "filePath": "./src/components/Button.tsx",
      "includeComments": true,
      "parseOptions": {
        "ecmaVersion": 2022,
        "sourceType": "module"
      }
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Successfully parsed ./src/components/Button.tsx"
      }
    ],
    "isError": false,
    "_meta": {
      "success": true,
      "ast": {
        "type": "Program",
        "sourceType": "module",
        "body": [
          {
            "type": "ImportDeclaration",
            "specifiers": [
              {
                "type": "ImportDefaultSpecifier",
                "local": {
                  "type": "Identifier",
                  "name": "React"
                }
              }
            ],
            "source": {
              "type": "Literal",
              "value": "react"
            }
          }
        ]
      },
      "language": "typescript",
      "parseTime": 15,
      "nodeCount": 127
    }
  }
}
```

### Example: Resource Access

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/read",
  "params": {
    "uri": "structure://file/src/utils/helpers.ts"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "contents": [
      {
        "uri": "structure://file/src/utils/helpers.ts",
        "mimeType": "application/json",
        "text": "{\"filePath\":\"src/utils/helpers.ts\",\"language\":\"typescript\",\"size\":2547,\"lineCount\":89,\"functions\":[{\"name\":\"formatDate\",\"type\":\"function\",\"startLine\":12,\"endLine\":18},{\"name\":\"validateEmail\",\"type\":\"function\",\"startLine\":25,\"endLine\":31}],\"classes\":[],\"imports\":[{\"source\":\"date-fns\",\"type\":\"import\"}],\"exports\":[{\"name\":\"formatDate\",\"type\":\"named\"},{\"name\":\"validateEmail\",\"type\":\"named\"}],\"complexity\":{\"cyclomatic\":8,\"cognitive\":12,\"maintainabilityIndex\":68.4}}"
      }
    ]
  }
}
```

### Example: Semantic Search

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "semantic_search",
    "arguments": {
      "query": "user authentication and authorization logic",
      "fileTypes": [".ts", ".tsx"],
      "maxResults": 5,
      "threshold": 0.8,
      "includeContext": true,
      "contextLines": 2
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text", 
        "text": "Found 5 semantic matches for 'user authentication and authorization logic'"
      }
    ],
    "isError": false,
    "_meta": {
      "success": true,
      "results": [
        {
          "filePath": "src/auth/AuthService.ts",
          "score": 0.94,
          "matches": [
            {
              "text": "async authenticateUser(credentials: LoginCredentials): Promise<AuthResult>",
              "startLine": 45,
              "endLine": 45
            }
          ],
          "context": [
            "export class AuthService {",
            "  private tokenManager: TokenManager;",
            "  async authenticateUser(credentials: LoginCredentials): Promise<AuthResult> {",
            "    const result = await this.validateCredentials(credentials);",
            "    if (result.success) {"
          ]
        }
      ],
      "totalMatches": 23,
      "searchTime": 156,
      "queryId": "search_20241210_150234_auth"
    }
  }
}
```

This API documentation provides comprehensive coverage of all available tools, resources, and configuration options, making it easy for developers to integrate and use the AST MCP Server effectively.