# Project Specification: ast-copilot-helper

## 1. Overview

ast-copilot-helper is a self-contained AI codebase assistant that provides deep code understanding through AST analysis and vector embeddings. The system consists of two primary components:

1. **CLI Data Processor** (`ast-copilot-helper`) - Extracts, annotates, and indexes code structure
2. **MCP Server** (`ast-mcp-server`) - Serves context to AI models via Model Context Protocol

All data is stored locally in `.astdb/` with no external dependencies. The system integrates seamlessly with existing git workflows and provides context-aware assistance to any MCP-compatible AI client.

---

## 2. Architecture & Core Principles

### 2.1 Design Philosophy

- **SQLite datastore**: All data stored in efficient SQLite databases under `.astdb/` - no cloud services, optimized queries with specialized databases per domain
- **Editor agnostic**: MCP server works with any compatible AI client (Claude, VS Code, etc.)
- **Local processing**: Code never leaves your machine, ensuring privacy and security
- **Git integration**: Seamlessly fits into existing development workflows
- **Performance focused**: Rust core engine for maximum parsing speed, annotation generation, and efficiency

### 2.2 System Architecture

```txt
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ ast-copilot-    │    │   .astdb/ Store  │    │ ast-mcp-server  │
│ helper (CLI)    │    │(Distributed DBs) │    │ (MCP Protocol)  │
│                 │    │                  │    │                 │
│ • parse (Rust)  │───▶│ factory.db       │◀───│ • query_ast     │
│ • annotate(Rust)│───▶│  └─ nodes        │◀───│ • get_node      │
│ • embed (WASM)  │───▶│ vector.db        │◀───│ • list_changes  │
│ • watch         │    │  └─ embeddings   │    │                 │
│                 │    │ annotations/     │    │                 │
│                 │    │  └─ *.json       │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       ▲                       │
         ▼                       │                       ▲
┌─────────────────┐              │              ┌─────────────────┐
│ VS Code Ext     │              │              │ AI Clients      │
│ (Optional)      │              │              │ (Claude, etc.)  │
└─────────────────┘              │              └─────────────────┘
```

**Architecture Decision: Distributed Database Design**

The system uses a distributed database approach with specialized databases per domain:

- **factory.db**: AST nodes and metadata (Rust-managed)
- **vector.db**: Vector embeddings and HNSW index (TypeScript-managed)
- **annotations/**: File-based annotation storage (JSON files per node)

This design provides:

- **Isolation**: Separate databases prevent lock contention between readers/writers
- **Language boundaries**: Rust core manages factory.db, TypeScript manages vector.db
- **Flexibility**: Independent schema evolution and optimization per domain
- **Resilience**: Corruption in one database doesn't affect others

### 2.3 Data Flow Pipeline

1. **Parse**: Extract AST from source files (Rust engine) → `factory.db` `nodes` table
2. **Annotate**: Generate metadata & complexity analysis (Rust backend) → `.astdb/annotations/*.json` files
3. **Embed**: Create vector embeddings (WASM-based CodeBERT) → `vector.db` `embeddings` table + HNSW index
4. **Query**: Retrieve relevant context via MCP protocol (distributed database queries + vector search)
5. **Watch**: Monitor changes and update incrementally (TypeScript coordination)

---

## 3. Language Support

### 3.1 Supported Languages

The system uses a high-performance Rust parsing engine with native tree-sitter integration:

**Tier 1 (Core Languages - Production Ready):**

- JavaScript/JSX (`.js`, `.jsx`, `.mjs`, `.cjs`) - tree-sitter 0.25.0
- TypeScript/TSX (`.ts`, `.tsx`) - tree-sitter 0.23.2
- Python (`.py`, `.pyi`, `.pyx`) - tree-sitter 0.25.0
- Rust (`.rs`) - tree-sitter 0.24.0

**Tier 2 (Popular Languages - Fully Supported):**

- Java (`.java`) - tree-sitter 0.23.5
- C++ (`.cpp`, `.cc`, `.cxx`, `.c++`, `.hpp`, `.hh`, `.hxx`, `.h++`) - tree-sitter 0.23.4
- C (`.c`, `.h`) - tree-sitter 0.24.1
- C# (`.cs`) - tree-sitter 0.23.1
- Go (`.go`) - tree-sitter 0.25.0
- Ruby (`.rb`) - tree-sitter 0.23.1
- PHP (`.php`) - tree-sitter 0.24.2

**Tier 3 (Specialized Languages - Fully Supported):**

- Kotlin (`.kt`) - tree-sitter-kotlin-ng 1.1.0
- Swift (`.swift`) - tree-sitter 0.7.1
- Scala (`.scala`) - tree-sitter 0.24.0
- Bash (`.sh`, `.bash`) - tree-sitter 0.25.0

**Disabled:**

- Dart (`.dart`) - ❌ Removed due to tree-sitter API incompatibility

**Total: 15 fully supported programming languages**

All languages provide identical capabilities:

- Full AST parsing with node-level precision
- Signature extraction for functions/methods/classes
- Complexity analysis and dependency mapping
- Consistent metadata generation across languages

### 3.2 Language Processing Pipeline

```
File → Language Detection → Rust Parser → AST Normalization → Annotation
```

The Rust core engine handles all parsing operations using tree-sitter 0.25.10 with modern API compatibility, providing superior performance and a unified parsing ecosystem across all supported languages.

---

## 4. Module Specifications

### 4.1 CLI Data Processor (`ast-copilot-helper`)

**Purpose**: Build and maintain the AST database that the MCP server reads from

**Architecture**: TypeScript CLI interface with Rust parsing and annotation engine

- TypeScript: Command dispatch, file I/O, workflow orchestration, SQLite database access
- Rust: High-performance AST parsing, annotation generation, and complexity analysis
- WASM: Secure, sandboxed embedding model execution (CodeBERT)

**Commands**:

```bash
ast-copilot-helper init [--workspace <path>]        # Initialize .astdb/

ast-copilot-helper parse [options]                  # Extract ASTs
  --changed                # Parse changed files since HEAD
  --staged                 # Parse only staged files
  --base <branch>          # Parse changed since branch
  --glob <pattern>         # Parse files matching pattern
  --force                  # Force re-parse all files
  --batch-size <n>         # Set batch processing size
  --dry-run                # Preview without changes

ast-copilot-helper annotate [options]               # Generate metadata
  --changed                # Annotate changed nodes only
  --batch                  # Enable batch processing
  --batch-size <n>         # Set batch size
  --format <type>          # Output format (json, text)
  --force                  # Force re-annotation

ast-copilot-helper embed [options]                  # Create embeddings
  --changed                # Embed changed nodes only
  --model <name>           # Specify embedding model
  --batch-size <n>         # Set batch size
  --force                  # Force re-embedding
  --dry-run                # Preview without changes

ast-copilot-helper query <intent> [options]         # Search context
  --top <n>                # Number of results (default: 5)
  --format <type>          # Output format (json, text, markdown)
  --min-score <n>          # Minimum similarity score threshold

ast-copilot-helper watch [options]                  # Live monitoring
  --glob <pattern>         # Watch files matching pattern
  --debounce <ms>          # Debounce delay in milliseconds
  --batch-size <n>         # Set batch processing size
  --changed                # Process only changed files
```

### 4.2 MCP Server (`ast-mcp-server`)

**Purpose**: Serve AST context to AI models via standard MCP protocol

**Implementation**: TypeScript server with read-only database access

**MCP Tools Exposed**:

**Core Tools:**

- `query_ast_context`: Semantic search for relevant code using vector embeddings
- `get_node_details`: Retrieve specific AST node information by ID
- `list_recent_changes`: Get recently modified nodes

**Enhanced Tools:**

- `ast_file_query`: Query all AST nodes from a specific file with filtering
- `ast_text_search`: Full-text search across annotations and signatures

**MCP Resources**:

- `ast://nodes/{nodeId}`: Individual AST node data
- `ast://files/{filePath}`: All nodes from a file
- `ast://search/{query}`: Search results

**Commands**:

```bash
ast-mcp-server start [--workspace <path>] [--port <n>]  # Launch server
ast-mcp-server stop                                     # Shutdown
ast-mcp-server status                                   # Health check
```

### 4.3 VS Code Extension (Optional)

**Purpose**: Convenient management of both CLI and MCP server processes

**Functionality**:

- Process lifecycle management
- Workspace configuration
- Status monitoring
- Command palette integration

**Not Required**: The core system works independently of any editor

---

## 5. Data Processing Pipeline

### 5.1 AST Extraction (Parse)

**Input**: Source files matching configured patterns
**Output**: Normalized AST data stored in SQLite `nodes` table

**Implementation**: Rust core engine with tree-sitter integration

**SQLite Schema**:

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,              -- Deterministic hash of file+span+type+name
  type TEXT NOT NULL,               -- Node type (function, class, if_statement, etc.)
  name TEXT,                        -- Identifier if present
  start_line INTEGER NOT NULL,      -- Source location start line
  start_column INTEGER NOT NULL,    -- Source location start column
  end_line INTEGER NOT NULL,        -- Source location end line
  end_column INTEGER NOT NULL,      -- Source location end column
  parent_id TEXT,                   -- Parent node for tree navigation
  file_path TEXT NOT NULL,          -- Absolute path to source file
  language TEXT NOT NULL,           -- Programming language
  created_at INTEGER NOT NULL,      -- Unix timestamp
  updated_at INTEGER NOT NULL       -- Unix timestamp
);
```

**TypeScript Interface** (for application layer):

```typescript
interface ASTNode {
  id: string;
  type: string;
  name?: string;
  start: Location;
  end: Location;
  parentId?: string;
  filePath: string;
  language: string;
}
```

**Processing Rules**:

- Rust engine parses files using tree-sitter for maximum performance
- Include function/class/module definitions and control-flow nodes
- Strip comments and non-essential syntax elements
- Generate deterministic node IDs for stable updates
- Store in SQLite for efficient querying and relationship management

### 5.2 Annotation Generation (Annotate)

**Input**: AST nodes from SQLite `nodes` table
**Output**: Annotated metadata in SQLite `annotations` table

**Implementation**: Rust backend for high-performance annotation generation

**Generated Metadata**:

- **Signature**: Language-aware function/method signatures (Rust-generated)
- **Summary**: Template-based descriptions ("Function X does Y") (Rust-generated)
- **Complexity**: Cyclomatic complexity (1 + decision points) (Rust-calculated)
- **Dependencies**: Imported symbols referenced in scope (Rust-analyzed)
- **Snippet**: Configurable source code excerpt (default: 10 lines)

**SQLite Schema**:

```sql
CREATE TABLE annotations (
  node_id TEXT PRIMARY KEY,         -- Foreign key to nodes.id
  file_path TEXT NOT NULL,
  signature TEXT NOT NULL,          -- Function/method signature
  summary TEXT NOT NULL,            -- Generated description
  complexity INTEGER NOT NULL,       -- Cyclomatic complexity score
  dependencies TEXT,                -- JSON array of imported symbols
  source_snippet TEXT NOT NULL,     -- Code excerpt
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);
```

**TypeScript Interface** (for application layer):

```typescript
interface Annotation {
  nodeId: string;
  filePath: string;
  signature: string;
  summary: string;
  complexity: number;
  dependencies: string[];
  sourceSnippet: string;
}
```

**Performance Benefits**:

- Rust backend processes annotations 5-10x faster than pure TypeScript
- Parallel processing of multiple files
- Direct integration with tree-sitter AST for efficient traversal

### 5.3 Vector Embeddings (Embed)

**Model**: CodeBERT-base WASM (768-dimensional embeddings)

- **WASM-based execution**: Sandboxed, secure embedding generation using WebAssembly
- Downloaded from HuggingFace on first use
- Cached locally in `.astdb/models/`
- SHA256 checksum verification for model integrity
- **Security advantage**: WASM provides isolation and prevents arbitrary code execution compared to ONNX runtime

**Index**: HNSW (Hierarchical Navigable Small World)

- Pure JavaScript/TypeScript implementation using `hnswlib-wasm`
- WASM-based for performance and security (no native dependencies)
- Configurable parameters (efConstruction=200, M=16)
- Cross-platform compatibility without native compilation

**Storage**: SQLite database for embeddings

```sql
CREATE TABLE embeddings (
  node_id TEXT PRIMARY KEY,         -- Foreign key to nodes.id
  embedding BLOB NOT NULL,          -- 768-dimensional float32 vector
  model_name TEXT NOT NULL,         -- "codebert-base-wasm"
  model_version TEXT NOT NULL,      -- Model version/hash
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX idx_embeddings_updated ON embeddings(updated_at);
```

**Process**:

1. Load annotations from SQLite `annotations` table
2. Concatenate summary + signature for embedding input
3. Generate 768-dim vectors using WASM-based CodeBERT (secure execution)
4. Store embeddings in SQLite `embeddings` table
5. Build/update HNSW index with upsert support
6. Store index metadata to disk (`index.bin`, `index.meta.json`)

**Performance & Security**:

- WASM execution: ~10-15% slower than native ONNX, but provides sandboxing and security
- SQLite storage: Efficient batch inserts and queries
- Incremental updates: Only re-embed changed nodes

### 5.4 Context Retrieval (Query)

**Input**: Natural language intent/query
**Output**: Ranked list of relevant code context

**Process**:

1. Embed query text using WASM-based CodeBERT model
2. Perform K-NN search against HNSW index
3. Retrieve corresponding annotations from SQLite database
4. Join with node data for complete context
5. Return formatted results with metadata

**SQLite Query Optimization**:

```sql
-- Efficient join query for retrieving results
SELECT
  n.id, n.type, n.name, n.file_path,
  a.signature, a.summary, a.complexity,
  a.dependencies, a.source_snippet
FROM nodes n
INNER JOIN annotations a ON n.id = a.node_id
WHERE n.id IN (?, ?, ?, ?, ?)  -- Top K from HNSW search
ORDER BY n.updated_at DESC;
```

**Output Format**:

```typescript
interface QueryResult {
  nodeId: string;
  nodeType: string;
  nodeName?: string;
  filePath: string;
  summary: string;
  signature: string;
  complexity: number;
  dependencies: string[];
  sourceSnippet: string;
  similarity: number;
}
```

**Performance Benefits**:

- SQLite indexes enable sub-millisecond lookups
- Single database query replaces multiple file reads
- Efficient caching and query planning

---

## 6. File System Structure

```txt
project-root/
├── src/                          # Your source code
├── .astdb/                       # Generated databases (gitignored)
│   ├── factory.db                # AST nodes database (Rust-managed)
│   ├── factory.db-shm            # SQLite shared memory
│   ├── factory.db-wal            # SQLite write-ahead log
│   ├── vector.db                 # Embeddings database (TypeScript-managed)
│   ├── vector.db-shm             # SQLite shared memory
│   ├── vector.db-wal             # SQLite write-ahead log
│   ├── annotations/              # Annotation JSON files (per-node)
│   │   ├── <node-id-1>.json
│   │   ├── <node-id-2>.json
│   │   └── ...
│   ├── models/                   # Downloaded WASM embedding models
│   │   └── codebert-base-wasm/
│   ├── index.bin                 # HNSW vector index (binary format)
│   ├── index.meta.json           # Index ID mappings and metadata
│   ├── config.json               # Project configuration
│   └── .lock                     # Process coordination
├── .vscode/                      # VS Code extension (optional)
└── package.json
```

**Distributed Database Structure**:

**factory.db** (Rust core engine):

- `nodes` table: AST node data with file paths, types, ranges
- Managed by Rust storage layer for optimal performance
- Read by TypeScript for coordination and queries

**vector.db** (TypeScript embedding system):

- `embeddings` table: Vector embeddings (768-dim float32)
- HNSW index for similarity search
- Managed by TypeScript vector storage layer

**annotations/** (File-based storage):

- Individual JSON files per AST node
- Contains metadata, complexity analysis, dependencies
- Fast concurrent writes during annotation phase
- File naming: `<node-id>.json` (e.g., `src_index.ts_L10-L25.json`)

**Advantages of Distributed Design**:

- **Isolation**: Separate databases prevent lock contention between Rust and TypeScript components
- **Language boundaries**: Each language manages its own domain efficiently
- **Concurrent access**: Multiple processes can read/write to different databases simultaneously
- **ACID transactions**: Per-database atomic updates prevent corruption
- **Flexible schema evolution**: Databases can evolve independently
- **Resilience**: Corruption in one database doesn't affect others
- **Performance**: Specialized optimizations per database (e.g., Rust-optimized factory.db, TypeScript-optimized vector.db)

---

## 7. Configuration

### 7.1 Configuration File (`.astdb/config.json`)

```json
{
  "parseGlob": ["src/**/*.{ts,js,py}"],
  "watchGlob": ["src/**/*.{ts,js,py}"],
  "excludePatterns": ["**/node_modules/**", "**/test/**"],
  "topK": 5,
  "snippetLines": 10,
  "embedModel": {
    "name": "microsoft/codebert-base-wasm",
    "dimensions": 768,
    "runtime": "wasm"
  },
  "indexParams": {
    "efConstruction": 200,
    "M": 16,
    "ef": 64
  },
  "database": {
    "factoryPath": ".astdb/factory.db",
    "vectorPath": ".astdb/vector.db",
    "annotationsDir": ".astdb/annotations",
    "walMode": true,
    "cacheSize": 10000
  },
  "mcp": {
    "port": 8765,
    "autoStart": true
  }
}
```

### 7.2 Configuration Precedence

1. Command-line arguments (highest priority)
2. Environment variables (`AST_COPILOT_*`)
3. Project config (`.astdb/config.json`)
4. User config (`~/.config/ast-copilot-helper/config.json`)
5. Built-in defaults (lowest priority)

---

## 8. Git Integration & Workflow

### 8.1 Recommended Git Setup

**Gitignore Configuration**:

```gitignore
# AST Copilot Helper
.astdb/
!.astdb/config.json    # Keep configuration in repo
```

**Git Hooks (Optional)**:

```bash
# Pre-commit: Update AST for changed files
npx husky add .husky/pre-commit "ast-copilot-helper parse --changed"

# Pre-push: Update embeddings
npx husky add .husky/pre-push "ast-copilot-helper embed --changed"
```

### 8.2 Change Detection

The system supports multiple change detection modes:

```bash
ast-copilot-helper parse --changed              # Changed since HEAD
ast-copilot-helper parse --staged               # Only staged files
ast-copilot-helper parse --base main            # Changed since main branch
ast-copilot-helper parse --glob "src/**/*.ts"   # Specific pattern
```

### 8.3 Team Collaboration

**Individual Databases (Recommended)**:

- Each developer maintains their own `.astdb/`
- Shared configuration via `.astdb/config.json`
- Fast incremental updates
- No coordination overhead

**Shared Snapshots (Optional)**:

- Periodic snapshot distribution via releases
- Faster onboarding for new team members
- Fallback to individual maintenance after initial setup

---

## 9. Performance & Scaling

### 9.1 Performance Targets

**Repository Scale**: 100,000 significant AST nodes (~667,000 lines of code)

**Benchmarks** (2-CPU 8GB CI runner):

- Parse: <10 minutes for full repository (Rust engine)
- Annotate: <5 minutes for full repository (Rust backend)
- Embed: <15 minutes for full repository (WASM-based CodeBERT)
- Query: <200ms P95 latency for top-5 results (SQLite + HNSW)
- Memory: <4GB peak usage
- Database size: <200MB on disk (SQLite with compression)

**Performance Improvements over File-Based Design**:

- **SQLite storage**: 10-20x faster queries than JSON file scanning
- **Rust annotation backend**: 5-10x faster than pure TypeScript
- **WASM embeddings**: Secure sandboxing with only 10-15% performance overhead vs. native ONNX
- **Batch operations**: Efficient transaction-based updates reduce I/O overhead

**Language Density Estimates**:

- TypeScript/JavaScript: ~1 significant node per 6-8 LOC
- Python: ~1 significant node per 8-12 LOC
- Java: ~1 significant node per 10-15 LOC

### 9.2 Optimization Strategies

**Large Repositories**:

- Use `--changed` flag for incremental updates
- Adjust batch sizes in configuration
- Consider repository splitting for >1M LOC

**Query Performance**:

- Tune HNSW parameters based on dataset size
- Implement query result caching
- Use similarity threshold filtering

---

## 10. Installation & Usage

### 10.1 Quick Start

```bash
# Install globally
npm install -g ast-copilot-helper ast-mcp-server

# Initialize in your project
cd your-project
ast-copilot-helper init

# Build initial database
ast-copilot-helper parse
ast-copilot-helper annotate
ast-copilot-helper embed

# Start MCP server for AI integration
ast-mcp-server start

# Query for context
ast-copilot-helper query "error handling patterns"
```

### 10.2 Development Workflow

```bash
# Live monitoring during development
ast-copilot-helper watch

# Update specific files
ast-copilot-helper parse --changed
ast-copilot-helper annotate --changed
ast-copilot-helper embed --changed

# Search for relevant code
ast-copilot-helper query "authentication logic" --top 8
```

### 10.3 VS Code Integration

1. Install optional VS Code extension from marketplace
2. Extension manages `ast-mcp-server` lifecycle
3. Configure AI client to connect to MCP server
4. Enjoy context-aware assistance

---

## 11. Error Handling & Recovery

### 11.1 Common Error Scenarios

**Parse Failures**:

- Individual file errors logged, processing continues
- Syntax error files skipped with detailed logging
- Grammar download retries with exponential backoff

**Index Corruption**:

- Automatic detection via checksum validation
- User-prompted rebuild from annotations
- Atomic updates with backup/rollback

**Model Download Issues**:

- Retry with exponential backoff (3 attempts max)
- Graceful fallback to cached models
- Clear error messages and resolution guidance

### 11.2 File Locking & Concurrency

```typescript
interface LockManager {
  acquireExclusiveLock(operation: string): Promise<Lock>;
  acquireSharedLock(operation: string): Promise<Lock>;
  releaseLock(lock: Lock): void;
}
```

**Coordination Rules**:

- Exclusive locks for write operations (parse, embed)
- Shared locks for read operations (query)
- 30-second timeout with clear error messages
- Automatic cleanup of stale locks

---

## 12. Security & Privacy

### 12.1 Privacy Guarantees

- **Complete Local Processing**: Code never transmitted to external services
- **No Telemetry by Default**: Optional, user-controlled analytics only
- **Sensitive Data Protection**: Respects `.gitignore` and custom exclusion patterns
- **Model Verification**: SHA256 checksums and signature validation

### 12.2 Security Hardening

- Input validation and path sanitization
- Minimal required file system permissions
- Model download verification (checksums + signatures)
- **WASM-based model execution**: Sandboxed, isolated embedding generation prevents arbitrary code execution
- **SQLite security**: Parameterized queries prevent SQL injection
- **No network dependencies**: All processing happens locally after initial model download

---

## 13. Testing & Quality Assurance

### 13.1 Testing Strategy

**Unit Tests**: 90%+ coverage for core modules using Vitest
**Integration Tests**: Multi-language repository scenarios
**Performance Tests**: Automated benchmarking against synthetic 100k node repositories
**End-to-End Tests**: Complete workflow validation including VS Code integration

### 13.2 Quality Gates

**Performance Requirements**:

- Parse 100k nodes in <10 minutes (CI environment)
- Query latency <200ms P95 across indexed nodes
- Memory usage scales linearly with repository size
- Zero-dependency install success rate >95%

**Functional Requirements**:

- Support for all specified languages
- MCP protocol compliance
- Git workflow integration
- Error recovery and graceful degradation

---

## 14. Implementation Roadmap

### 14.1 Core Development (Weeks 1-4)

**Phase 1**: Foundation

- Rust parsing engine integration (tree-sitter)
- TypeScript CLI framework
- SQLite database schema and storage layer
- Basic AST extraction and storage

**Phase 2**: Analysis Pipeline

- Rust annotation backend implementation
- Template-based summary creation (Rust-generated)
- Complexity and dependency analysis (Rust-calculated)
- SQLite schema for annotations table

### 14.2 Advanced Features (Weeks 5-6)

**Phase 3**: Vector Embeddings

- WASM-based CodeBERT integration and model management
- Security-hardened embedding generation
- HNSW index implementation
- SQLite embeddings table and query optimization
- Query and retrieval system

**Phase 4**: MCP Integration

- MCP server implementation
- Protocol compliance and testing
- AI client integration validation

### 14.3 Polish & Distribution (Weeks 7-8)

**Phase 5**: VS Code Extension

- Process management and UI
- Configuration and status monitoring
- Marketplace preparation and publishing

**Phase 6**: Production Readiness

- Performance optimization and benchmarking
- Security audit and hardening
- Documentation and user guides

---

## 15. Success Metrics

### 15.1 Technical Success Criteria

- Parse 100k LOC repository in <10 minutes on standard CI hardware
- Achieve <200ms P95 query latency across 15k indexed nodes
- Maintain <4GB peak memory usage for large repositories
- Support zero-dependency installation across all target platforms

### 15.2 User Experience Goals

- Single-command installation and setup
- Seamless git workflow integration
- Context-aware AI assistance with minimal configuration
- Comprehensive error recovery and user guidance

### 15.3 Ecosystem Integration

- VS Code extension with >1000 marketplace installs
- MCP protocol compliance with major AI clients
- Community adoption and contribution
- Integration examples and documentation

---

This specification provides a comprehensive blueprint for building ast-copilot-helper as a production-ready AI codebase assistant. The system balances performance, security, and ease of use while maintaining compatibility with existing development workflows and AI tooling ecosystems.
