# AST Copilot Helper - Implementation Specification

## Overview

This document provides a concrete, step-by-step implementation roadmap for the ast-copilot-helper project. It transforms the architectural specification into an actionable development plan with specific tasks, timelines, and deliverables.

**Key Architecture Reminder:**
- **ast-helper** (CLI): Builds `.astdb/` database (parse → annotate → embed)  
- **ast-mcp-server** (Binary): Reads `.astdb/`, serves data via MCP protocol
- **VS Code Extension** (Optional): Manages both external processes

**Critical Dependencies:**
1. Core data processing must be complete before MCP server development
2. Both binaries must be functional before VS Code extension development
3. Performance validation should happen incrementally, not at the end

## Implementation Timeline: 8-Week Development Plan

### Week 1-2: Foundation & Core Data Processing (ast-helper)

#### Week 1, Day 1-2: Monorepo Setup & Project Initialization

**Deliverables:**
- [ ] Initialize monorepo with proper workspace structure
- [ ] Set up TypeScript configuration for all packages
- [ ] Configure build pipeline and development tooling

**Monorepo Structure (Complete Setup):**

```bash
# Initialize monorepo
npm init -y
npm install -D typescript @types/node ts-node lerna vitest @vitest/coverage-v8

# Create workspace packages
mkdir -p packages/ast-helper/src/{modules,util,cli}
mkdir -p packages/ast-mcp-server/src/{mcp,retriever}
mkdir -p packages/vscode-extension/src
mkdir -p tests/{fixtures,benchmarks}
```

**Configuration Files:**
- Root `package.json`: Workspace management, shared dependencies
- Package-specific `package.json`: Individual package dependencies
- `tsconfig.json`: TypeScript compilation settings for monorepo
- `vitest.config.ts`: Testing configuration

#### Week 1, Day 3-5: Core Infrastructure (ast-helper package)

**Deliverables:**
- [ ] Configuration system with multi-source loading
- [ ] CLI framework with Commander.js
- [ ] File system utilities and Git integration
- [ ] Error handling and logging framework

**Key Implementation Focus:**

```typescript
// packages/ast-helper/src/types.ts - Shared types
interface Config {
  parseGlob: string[];
  watchGlob: string[];
  topK: number;
  snippetLines: number;
  indexParams: { efConstruction: number; M: number; };
}

interface ASTNode {
  id: string;               // deterministic hash
  type: string;             // function, class, etc.
  name?: string;           // identifier
  filePath: string;
  start: { line: number; column: number };
  end: { line: number; column: number };
}
```

**Priority Tasks:**
1. Git utilities for changed file detection (`--changed` flag support)
2. File locking mechanism (`.astdb/.lock`)
3. Configuration precedence (CLI > env > project > defaults)
4. Basic CLI structure with all subcommands defined

#### Week 2, Day 1-3: AST Parsing System

**Deliverables:**
- [ ] Tree-sitter integration with WASM fallback
- [ ] Grammar download and caching system  
- [ ] Language detection from file extensions
- [ ] Parse command implementation with batch processing

**Critical Implementation:**

```typescript
// packages/ast-helper/src/modules/parser.ts
class ASTParser {
  async parseFile(filePath: string): Promise<ASTNode[]>;
  async batchParseFiles(files: string[]): Promise<Map<string, ASTNode[]>>;
  normalizeAST(rawAST: any): ASTNode[];
}
```

**Performance Validation:** Parse 1000 TypeScript files in <30s

#### Week 2, Day 4-5: Annotation System  

**Deliverables:**
- [ ] Template-based annotation generation
- [ ] Language-specific extractors for TS/JS/Python
- [ ] Cyclomatic complexity calculation
- [ ] Annotation command implementation

**Implementation:**

```typescript
// packages/ast-helper/src/modules/annotator.ts
interface Annotation {
  nodeId: string;
  signature: string;        // extracted function/class signature
  summary: string;          // "Function X does Y"
  complexity: number;       // cyclomatic complexity
  dependencies: string[];   // imported symbols
  sourceSnippet: string;    // code excerpt
}
```

**Performance Validation:** Annotate 15k AST nodes in <3 minutes

### Week 3: Embedding & Indexing System

#### Week 3, Day 1-2: Model Management & Download Infrastructure

**Deliverables:**
- [ ] Secure model download with SHA256 verification
- [ ] Model caching in `.astdb/models/` with version tracking
- [ ] Fallback mechanisms for network issues

**Implementation:**

```typescript
// packages/ast-helper/src/modules/downloader.ts
class ModelDownloader {
  async downloadModel(modelName: string): Promise<string>;
  async verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean>;
  async getCachedModelPath(modelName: string): Promise<string>;
}
```

**Model Specifications:**
- Primary: CodeBERT-base ONNX (768-dim embeddings)
- Source: HuggingFace with verified checksums
- Fallback: sentence-transformers/all-MiniLM-L6-v2

#### Week 3, Day 3-4: Embedding Generation

**Deliverables:**
- [ ] @xenova/transformers integration with WASM runtime
- [ ] Batch processing for embeddings (configurable batch sizes)
- [ ] Memory management for large datasets

**Implementation:**

```typescript
// packages/ast-helper/src/modules/embedder.ts
class EmbeddingGenerator {
  private model: any;
  
  async initialize(modelPath: string): Promise<void>;
  async generateEmbeddings(texts: string[]): Promise<number[][]>;
  async batchProcess(annotations: Annotation[]): Promise<EmbeddingResult[]>;
}
```

**Performance Targets:**
- Process 1000 annotations in <60s with WASM
- Memory usage scales linearly with dataset size

#### Week 3, Day 5: Vector Index & Embed Command

**Deliverables:**
- [ ] HNSW index integration (pure JS with optional native)
- [ ] Index serialization/deserialization to `.astdb/index.bin`
- [ ] Complete embed command with incremental updates
- [ ] Metadata mapping system (`index.meta.json`)

**Key Features:**
- Upsert mechanism for changed annotations
- Index integrity checking and recovery
- Performance optimization for 100k significant nodes target

### Week 4: File Watching & CLI Completion

#### Week 4, Day 1-3: Watch System & Live Updates

**Deliverables:**
- [ ] Chokidar integration for file system monitoring
- [ ] Debouncing (200ms) and batch processing for rapid changes
- [ ] Complete watch command with pipeline orchestration
- [ ] Integration testing of full parse→annotate→embed pipeline

**Implementation:**

```typescript
// packages/ast-helper/src/modules/watcher.ts
class FileWatcher {
  async startWatching(patterns: string[], options: WatchOptions): Promise<void>;
  async handleFileChange(filePath: string, changeType: 'add' | 'change' | 'unlink'): Promise<void>;
  async processChangeBatch(changes: FileChange[]): Promise<void>;
}
```

**Key Features:**
- Pipeline coordination: parse → annotate → embed sequence
- Error recovery for individual file failures
- Progress reporting for batch operations
- Integration with .astdb file locking

#### Week 4, Day 4-5: Query System & CLI Enhancement

**Deliverables:**
- [ ] Query command implementation (CLI version)
- [ ] Vector similarity search with HNSW index
- [ ] Result ranking and formatting (plain, JSON, markdown)
- [ ] Performance optimization for <500ms query latency

**Implementation:**

```typescript
// packages/ast-helper/src/modules/retriever.ts
class QueryProcessor {
  async query(intent: string, options: QueryOptions): Promise<QueryResult[]>;
  async embedQuery(text: string): Promise<number[]>;
  async searchIndex(queryVector: number[], topK: number): Promise<SearchResult[]>;
}
```

**Performance Validation:** Query 100k indexed nodes in <500ms for development testing

### Week 5: MCP Server Development (ast-mcp-server package)

#### Week 5, Day 1-3: MCP Protocol Server Foundation

**Deliverables:**
- [ ] Standalone MCP server package setup (packages/ast-mcp-server)
- [ ] MCP protocol implementation with stdio/TCP support
- [ ] Database reader for `.astdb/` files (read-only access)
- [ ] Server lifecycle management (start/stop/status commands)

**MCP Server Structure:**

```txt
packages/ast-mcp-server/
├─ src/
│  ├─ cli.ts              # CLI commands (start, stop, status)
│  ├─ mcp/
│  │  ├─ server.ts        # Main MCP server implementation  
│  │  ├─ handlers.ts      # MCP method implementations
│  │  └─ protocol.ts      # MCP protocol types & utilities
│  ├─ database/
│  │  ├─ reader.ts        # Reads .astdb/ files safely
│  │  └─ indexLoader.ts   # Loads vector index & metadata
│  └─ types.ts            # Server-specific types
├─ bin/ast-mcp-server     # Executable
└─ package.json           # Independent package
```

**Key Implementation:**

```typescript
// packages/ast-mcp-server/src/mcp/handlers.ts
export const mcpTools = {
  'query_ast_context': async (params: { intent: string, maxResults?: number }) => {
    const db = await DatabaseReader.load();
    const results = await db.queryByIntent(params.intent, params.maxResults || 5);
    return { matches: results };
  },
  
  'get_node_details': async (params: { nodeId: string }) => {
    const db = await DatabaseReader.load();
    return await db.getNodeById(params.nodeId);
  },
  
  'list_recent_changes': async (params: { since?: string }) => {
    const db = await DatabaseReader.load();
    return await db.getRecentChanges(params.since);
  }
};
```

#### Week 5, Day 4-5: MCP Tools & Resources Implementation

**Deliverables:**
- [ ] Complete MCP tool implementations per specification
- [ ] MCP resource providers (`ast://nodes/`, `ast://search/`, etc.)
- [ ] Query performance optimization (<200ms target)
- [ ] Error handling and graceful degradation

**MCP Resources:**

```typescript
// MCP resources as defined in main spec
const mcpResources = {
  'ast://nodes/{nodeId}': (nodeId: string) => db.getNodeDetails(nodeId),
  'ast://files/{filePath}': (filePath: string) => db.getFileNodes(filePath), 
  'ast://search/{query}': (query: string) => db.searchNodes(query)
};
```
### Week 6: VS Code Extension & Integration Testing

#### Week 6, Day 1-2: VS Code Extension Development (packages/vscode-extension)

**Deliverables:**
- [ ] VS Code extension package setup with proper activation events
- [ ] Dual process manager for both ast-helper and ast-mcp-server
- [ ] Extension commands and UI integration per specification
- [ ] Configuration management and workspace integration

**Extension Architecture:**

```typescript
// packages/vscode-extension/src/extension.ts
export class ASTCopilotExtension {
  private astHelperManager: ASTHelperManager;
  private mcpServerManager: MCPServerManager;
  
  async activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize both managers
    this.astHelperManager = new ASTHelperManager();
    this.mcpServerManager = new MCPServerManager();
    
    // Register commands for both tools
    this.registerCommands(context);
    
    // Auto-start based on configuration
    if (this.shouldAutoStart()) {
      await this.ensureRepositoryIndexed();
      await this.mcpServerManager.startServer();
    }
  }
}
```

**Key Features:**
- Manages TWO separate external processes (ast-helper + ast-mcp-server)
- Coordinates database building BEFORE starting MCP server
- Provides VS Code UI for server lifecycle management
- Integrates with VS Code configuration system

#### Week 6, Day 3-4: Integration Testing & Validation

**Deliverables:**
- [ ] End-to-end workflow testing (extension → tools → MCP)
- [ ] MCP protocol compliance validation
- [ ] Multi-client MCP connection testing
- [ ] Performance validation against targets

**Testing Scenarios:**

```typescript
// tests/integration/end-to-end.test.ts
describe('Full Workflow Integration', () => {
  test('VS Code extension coordinates full pipeline', async () => {
    // 1. Extension ensures database is built
    await extension.ensureRepositoryIndexed();
    
    // 2. Extension starts MCP server
    await extension.startMCPServer();
    
    // 3. External AI client connects via MCP
    const mcpClient = new MCPClient();
    await mcpClient.connect();
    
    // 4. Query works end-to-end
    const results = await mcpClient.call('query_ast_context', {
      intent: 'error handling patterns',
      maxResults: 5
    });
    
    expect(results.matches).toHaveLength(5);
  });
});
```

#### Week 6, Day 5: Performance Validation & Optimization

**Deliverables:**
- [ ] Performance benchmark validation against 100k node target
- [ ] Memory usage optimization and validation
- [ ] Query latency optimization (<200ms target)
- [ ] Cross-platform performance validation

### Week 7-8: Testing, Documentation & Release

#### Week 7: Comprehensive Testing & Validation

**Day 1-3: Testing Infrastructure & Coverage**

- [ ] Vitest testing framework setup across all packages
- [ ] Unit tests for all core modules (>90% coverage target)
- [ ] Integration tests for full pipeline workflows
- [ ] Synthetic 100k node test repository (~667k LOC equivalent)

**Test Categories:**

```typescript
// tests/unit/parser.test.ts
describe('ASTParser', () => {
  test('should parse TypeScript function', async () => {});
  test('should handle malformed syntax', async () => {});
  test('should normalize AST structure', async () => {});
});

// tests/integration/workflow.test.ts  
describe('End-to-End Workflow', () => {
  test('parse -> annotate -> embed -> query', async () => {});
});
```

**Day 4-5: Performance & Platform Validation**

- [ ] Performance benchmark validation against all targets
- [ ] Cross-platform testing (Windows, macOS, Linux)
- [ ] Memory usage and scalability validation
- [ ] VS Code extension testing across platforms

### Week 9: Build Pipeline & Distribution

#### Day 1-2: CI/CD Setup
**Deliverables:**
- [ ] GitHub Actions workflow for multi-platform builds
- [ ] Automated testing across platforms
- [ ] Release automation with version tagging

**GitHub Actions Workflow:**
```yaml
name: Build and Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
      - run: npm run build
```

#### Day 3-4: Native Binary Handling
**Deliverables:**
- [ ] Optional native dependency detection
- [ ] Graceful fallback to pure JS
- [ ] Performance comparison and documentation

#### Day 5: Security & Signing
**Deliverables:**
- [ ] Checksum generation for all artifacts
- [ ] Security scanning integration
- [ ] Signing infrastructure (if available)

### Week 10: Documentation & Launch

#### Day 1-3: Comprehensive Documentation
**Deliverables:**
- [ ] README with installation and quick start
- [ ] Configuration guide with examples
- [ ] Troubleshooting and FAQ
- [ ] API documentation

**Documentation Structure:**
```
docs/
├─ README.md                # Main documentation
├─ INSTALLATION.md          # Platform-specific setup
├─ CONFIGURATION.md         # Configuration options
├─ TROUBLESHOOTING.md       # Common issues
├─ API.md                   # Developer API
└─ EXAMPLES.md              # Usage examples
```

#### Day 4-5: Final Validation & Release
**Deliverables:**
- [ ] Complete security audit (per Open Issues #11 - required for production)
- [ ] Legal and licensing compliance review (per Open Issues #12 - required for distribution)
- [ ] Performance target validation (per Open Issues #17 - standardized methodology)
- [ ] Cross-platform installation testing
- [ ] NPM package preparation
- [ ] VS Code marketplace submission

**Open Issues Resolution:** 
- Security audit and legal review (Issues #11-12) must complete before release
- New MCP architecture issues (#13-18) should be monitored during implementation

## Implementation Milestones & Success Criteria

### Milestone 1 (End of Week 2): Core Data Processing Complete

- [ ] Parse 15k+ AST nodes (~100k LOC) in <10 minutes
- [ ] Annotation system working for TS/JS/Python
- [ ] Git integration working across platforms
- [ ] Configuration system fully functional

### Milestone 2 (End of Week 3): Embedding & Indexing Complete

- [ ] Index 15k+ significant nodes (~100k LOC) in <10 minutes
- [ ] Query latency <500ms for development testing
- [ ] Memory usage <4GB for target repository size
- [ ] Incremental updates (embed --changed) working

### Milestone 3 (End of Week 4): CLI Tools Complete

- [ ] Watch system with live updates functional
- [ ] Query command with multiple output formats
- [ ] Performance optimization meeting targets
- [ ] Error handling and recovery procedures working

### Milestone 4 (End of Week 5): MCP Server Complete  

- [ ] Standalone MCP server operational
- [ ] All MCP tools and resources implemented per specification
- [ ] Cross-editor compatibility demonstrated
- [ ] Query latency <200ms via MCP protocol

### Milestone 5 (End of Week 6): Integration Complete

- [ ] VS Code extension managing both tools
- [ ] End-to-end workflow fully functional
- [ ] Performance targets validated on 100k node scale
- [ ] Cross-platform compatibility verified

### Final Milestone (End of Week 8): Production Ready

- [ ] Comprehensive testing coverage >90%
- [ ] Documentation complete with examples
- [ ] CI/CD pipeline with automated releases
- [ ] NPM and VS Code marketplace ready for publication

## Critical Implementation Dependencies & Risks

### High-Priority Dependencies

**Week 1-2 (Critical Path):**
- Tree-sitter WASM integration working reliably
- Git integration across all target platforms  
- File locking mechanism robust on Windows/Linux/macOS

**Week 3-5 (Performance-Critical):**
- CodeBERT model download and verification infrastructure
- HNSW index performance meeting 100k node targets
- MCP protocol implementation compliance

**Week 6-8 (Integration-Critical):**
- VS Code extension API integration with external processes
- Cross-platform testing infrastructure and validation
- NPM/marketplace publication readiness

### Risk Mitigation

**Performance Risks:**
- Validate performance incrementally at each milestone
- Have pure-JS fallbacks for all optional native dependencies
- Use synthetic test repositories for consistent benchmarking

**Integration Risks:**
- Test MCP protocol compliance early and continuously
- Maintain multiple VS Code integration strategies
- Plan for graceful degradation when tools unavailable

### Success Criteria Summary

**Technical:** 100k significant node processing in <10 minutes, <200ms query latency
**Integration:** Full MCP protocol compliance, VS Code extension managing both tools
**Quality:** >90% test coverage, cross-platform compatibility verified
**Delivery:** NPM and VS Code marketplace ready for publication

## Implementation Summary

This revised 8-week implementation plan addresses the critical issues identified in the original specification:

### Key Improvements Made

**1. Proper Dependency Ordering:**
- Core data processing (ast-helper) completed BEFORE MCP server development
- MCP server development BEFORE VS Code extension
- Performance validation happening incrementally, not at the end

**2. Monorepo Architecture Recognition:**
- Clear separation of packages/ast-helper and packages/ast-mcp-server
- Independent development paths with defined integration points
- Proper build and testing strategies for each package

**3. Realistic Timeline:**
- Reduced from 10 weeks to 8 weeks by eliminating redundant phases
- Focus on critical path items with clear deliverables
- Parallel development opportunities clearly identified

**4. MCP Protocol Focus:**
- Dedicated time for MCP protocol learning and implementation
- Specific MCP tools and resources implementation per main specification
- Cross-editor compatibility validation

**5. Performance-First Approach:**
- Performance targets validated incrementally at each milestone
- 100k significant node target used consistently throughout
- Memory and latency optimization built into the development process

### Ready for Development

This implementation specification now provides a practical, dependency-aware roadmap that development teams can execute efficiently while delivering all functionality described in the main ast-copilot-helper specification.
