# AST Copilot Helper - Implementation Specification

## Overview

This document provides a concrete, step-by-step implementation roadmap for the ast-copilot-helper project. It transforms the architectural specification into an actionable development plan with specific tasks, timelines, and deliverables.

## Implementation Timeline: 10-Week Development Plan

### Week 1: Foundation & Project Setup

#### Day 1-2: Project Initialization
**Deliverables:**
- [ ] Initialize npm project with TypeScript configuration
- [ ] Set up directory structure matching specification
- [ ] Configure build pipeline and development tooling

**Tasks:**
```bash
# Initialize project
npm init -y
npm install -D typescript @types/node ts-node nodemon jest @types/jest ts-jest

# Set up TypeScript configuration
```

**File Structure to Create (Monorepo):**
```
ast-copilot-helper/
├─ packages/
│  ├─ ast-helper/            # CLI data processor (builds AST database)
│  │  ├─ src/
│  │  │  ├─ modules/
│  │  │  │  ├─ parser.ts     # AST parsing with Tree-sitter
│  │  │  │  ├─ annotator.ts  # Metadata generation
│  │  │  │  ├─ embedder.ts   # Vector embeddings
│  │  │  │  ├─ watcher.ts    # File system monitoring
│  │  │  │  └─ downloader.ts # Model downloads
│  │  │  ├─ cli.ts           # CLI commands (parse, embed, watch)
│  │  │  ├─ types.ts
│  │  │  └─ util/
│  │  │     ├─ fs.ts
│  │  │     ├─ git.ts
│  │  │     └─ crypto.ts
│  │  ├─ bin/
│  │  │  └─ ast-helper       # CLI executable
│  │  └─ package.json
│  ├─ ast-mcp-server/        # MCP protocol server (serves AST data)
│  │  ├─ src/
│  │  │  ├─ mcp/
│  │  │  │  ├─ server.ts     # MCP server implementation
│  │  │  │  ├─ handlers.ts   # MCP method handlers
│  │  │  │  └─ types.ts      # MCP protocol types
│  │  │  ├─ retriever.ts     # Reads from .astdb/, serves via MCP
│  │  │  ├─ server.ts        # MCP server entry point
│  │  │  └─ types.ts
│  │  ├─ bin/
│  │  │  └─ ast-mcp-server   # MCP server executable
│  │  └─ package.json
│  └─ vscode-extension/      # optional management layer
│     ├─ src/
│     │  ├─ activate.ts
│     │  ├─ astHelperManager.ts  # manages ast-helper CLI
│     │  ├─ mcpServerManager.ts  # manages ast-mcp-server
│     │  └─ ui/              # status indicators, settings
│     └─ package.json
├─ tests/
│  ├─ fixtures/              # small sample repos for testing
│  └─ benchmarks/            # 100k node performance fixture
└─ package.json              # root package.json for workspace management
```

**Configuration Files:**
- `tsconfig.json`: TypeScript compilation settings
- `jest.config.js`: Testing configuration
- `package.json`: Dependencies and scripts

#### Day 3: Configuration System Implementation
**Deliverables:**
- [ ] Configuration schema and validation
- [ ] Multi-source configuration loading (CLI > env > project > user > defaults)
- [ ] `.astdb/config.json` structure

**Implementation:**
```typescript
// src/types.ts
interface Config {
  parseGlob: string[];
  watchGlob: string[];
  reuseIndex: boolean;
  embedModelPath: string;
  modelHost: string;
  useNativeRuntime: boolean;
  topK: number;
  snippetLines: number;
  enableTelemetry: boolean;
  telemetryEndpoint: string;
  indexParams: {
    efConstruction: number;
    M: number;
  };
}

// Configuration loading logic with precedence
class ConfigManager {
  loadConfig(cliArgs: any): Config;
  validateConfig(config: Partial<Config>): Config;
  saveConfig(config: Config): void;
}
```

#### Day 4-5: CLI Framework Setup
**Deliverables:**
- [ ] Commander.js integration with all subcommands
- [ ] Global options handling (--verbose, --config, --help)
- [ ] Stub implementations for all commands

**Implementation:**
```typescript
// src/cli/index.ts
import { Command } from 'commander';

const program = new Command();

program
  .name('ast-helper')
  .description('AST-based context enhancement for GitHub Copilot')
  .version('1.0.0');

program
  .command('parse')
  .description('Extract AST from source files')
  .option('-c, --changed', 'Process only changed files')
  .option('--glob <pattern>', 'File pattern to parse')
  .option('--base <ref>', 'Git reference for change detection')
  .option('--staged', 'Include only staged files')
  .option('-f, --force', 'Force reparse even if unchanged')
  .action(parseCommand);

// Additional commands: annotate, embed, query, watch
```

### Week 2: Core Parsing & AST System

#### Day 1-2: File System & Git Integration
**Deliverables:**
- [ ] Git utilities for changed file detection
- [ ] Cross-platform file system operations
- [ ] File locking mechanism (.astdb/.lock)

**Implementation Focus:**
```typescript
// src/util/git.ts
class GitUtils {
  async getChangedFiles(base?: string, staged?: boolean): Promise<string[]>;
  async isGitRepository(): Promise<boolean>;
  async getCurrentBranch(): Promise<string>;
}

// src/util/fs.ts
class FileSystemUtils {
  async acquireLock(lockFile: string, timeout: number): Promise<Lock>;
  async releaseLock(lock: Lock): void;
  async ensureDirectory(path: string): void;
  async safeWrite(file: string, content: string): void;
}
```

**Critical Decisions:**
- File locking strategy across platforms (lockfile vs flock)
- Git integration robustness (handling various git states)
- Path normalization for cross-platform compatibility

#### Day 3-4: Tree-sitter Integration
**Deliverables:**
- [ ] Tree-sitter parser setup with WASM fallback
- [ ] Grammar download and caching system
- [ ] Language detection from file extensions

**Implementation:**
```typescript
// src/modules/parser.ts
class ASTParser {
  private parsers: Map<string, any> = new Map();
  
  async getParser(language: string): Promise<any>;
  async downloadGrammar(language: string): Promise<void>;
  async parseFile(filePath: string, content: string): Promise<ASTNode>;
  normalizeAST(rawAST: any): ASTNode;
}
```

**Critical Implementation Details:**
- Grammar versioning and update strategy
- Error handling for unsupported languages
- Performance optimization for large files

#### Day 5: Parse Command Implementation
**Deliverables:**
- [ ] Full parse command functionality
- [ ] Batch processing with progress reporting
- [ ] AST storage in `.astdb/asts/`

**Features:**
- Parallel processing of multiple files
- Incremental parsing (--changed flag)
- Progress reporting for large repositories
- Error recovery for individual file failures

### Week 3: Annotation System

#### Day 1-2: Template System & Metadata Extraction
**Deliverables:**
- [ ] Template-based annotation generation
- [ ] Language-specific extractors for TS/JS/Python

**Implementation:**
```typescript
// src/modules/annotator.ts
interface AnnotationTemplate {
  extractSignature(node: ASTNode): string;
  generateSummary(node: ASTNode): string;
  calculateComplexity(node: ASTNode): number;
  extractDependencies(node: ASTNode): string[];
}

class TypeScriptAnnotator implements AnnotationTemplate {
  extractSignature(node: ASTNode): string {
    // Extract function/class signatures using Tree-sitter patterns
  }
}
```

#### Day 3: Complexity & Dependency Analysis
**Deliverables:**
- [ ] Cyclomatic complexity calculation
- [ ] Import/dependency extraction
- [ ] Source snippet generation with truncation

**Algorithm Implementation:**
- Classical cyclomatic complexity (1 + decision points)
- Symbol resolution for dependency tracking
- Smart truncation with context preservation

#### Day 4-5: Annotation Command
**Deliverables:**
- [ ] Complete annotate command functionality
- [ ] Incremental updates for changed files
- [ ] Annotation storage in `.astdb/annots/`

### Week 4-5: Embedding & Indexing (Complex Phase)

#### Week 4, Day 1-2: Model Management
**Deliverables:**
- [ ] Secure model download with verification
- [ ] Model caching in `.astdb/models/`
- [ ] Fallback mechanisms for network issues

**Implementation:**
```typescript
// src/modules/downloader.ts
class ModelDownloader {
  async downloadModel(modelUrl: string, checksumUrl: string): Promise<string>;
  async verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean>;
  async getCachedModelPath(modelName: string): Promise<string>;
}
```

#### Week 4, Day 3-4: Embedding Integration
**Deliverables:**
- [ ] @xenova/transformers integration
- [ ] Batch processing for embeddings
- [ ] Memory management for large datasets

**Key Implementation:**
```typescript
// src/modules/embedder.ts
class EmbeddingGenerator {
  private model: any;
  
  async initialize(modelPath: string): Promise<void>;
  async generateEmbeddings(texts: string[]): Promise<number[][]>;
  async batchProcess(annotations: Annotation[]): Promise<EmbeddingResult[]>;
}
```

#### Week 4, Day 5: HNSW Index Setup
**Deliverables:**
- [ ] HNSW library integration (pure JS version)
- [ ] Index serialization/deserialization
- [ ] Metadata mapping system

#### Week 5: Embedding Command & Index Operations
**Deliverables:**
- [ ] Complete embed command functionality
- [ ] Incremental updates (upsert mechanism)
- [ ] Index integrity checking
- [ ] Performance optimization

**Critical Performance Targets:**
- Process 1000 annotations in <60s with WASM
- Memory usage scales linearly with dataset size
- Index build for 100k nodes in <10 minutes

### Week 6: Query System & CLI Enhancement

#### Day 1-2: Query Processing via MCP
**Deliverables:**
- [ ] Vector similarity search through MCP tools
- [ ] Result ranking and scoring
- [ ] Multiple MCP response formats (structured data)

**Implementation:**
```typescript
// src/modules/retriever.ts
class QueryProcessor {
  async query(intent: string, topK: number): Promise<QueryResult[]>;
  async embedQuery(text: string): Promise<number[]>;
  async searchIndex(queryVector: number[], topK: number): Promise<SearchResult[]>;
  formatResults(results: QueryResult[], format: string): string;
}
```

#### Day 3-4: Enhanced CLI & Query Commands
**Deliverables:**
- [ ] Complete query command functionality (CLI)
- [ ] MCP server query optimization to meet <200ms target
- [ ] Query result caching for both CLI and MCP
- [ ] Debugging and verbose output modes

#### Day 5: File Watching & Live Updates
**Deliverables:**
- [ ] Chokidar integration for file watching
- [ ] Debouncing (200ms) and batch processing
- [ ] Live update pipeline via MCP (parse→annotate→embed)

### Week 4-5: MCP Server Development (Primary Integration)

#### Week 4, Day 1-2: MCP Server Architecture
**Deliverables:**
- [ ] MCP server foundation and protocol implementation
- [ ] Core MCP method handlers for AST operations
- [ ] Standalone server binary architecture (`ast-mcp-server`)

**MCP Server Structure (Monorepo Package):**
```
packages/ast-mcp-server/
├─ src/
│  ├─ server.ts            # CLI entry point & server launcher
│  ├─ mcp/
│  │  ├─ server.ts         # Main MCP server implementation
│  │  ├─ handlers.ts       # MCP method implementations  
│  │  └─ types.ts          # MCP protocol types
│  ├─ retriever.ts         # Reads from .astdb/, serves via MCP
│  └─ types.ts             # Server-specific types
├─ bin/
│  └─ ast-mcp-server       # Executable
└─ package.json            # MCP server package.json
```

#### Week 4, Day 3-4: Core MCP Methods
**Deliverables:**
- [ ] Essential MCP tool implementations
- [ ] AST query and retrieval via MCP protocol
- [ ] Cross-editor compatibility foundation

**Core MCP Methods:**
```typescript
// src/mcp/handlers.ts
export const handlers = {
    'querySemanticContext': async (params: any) => {
        const retriever = new SemanticRetriever();
        return retriever.searchByIntent(params.intent, params.maxResults);
    },
    'getFileAST': async (params: any) => {
        const parser = new ASTParser();
        return parser.parseFile(params.filePath);
    },
    'searchCodePatterns': async (params: any) => {
        const searcher = new PatternSearcher();
        return searcher.findPatterns(params.pattern, params.scope);
    }
};
```

#### Week 4, Day 5: MCP Server Testing & Integration
**Deliverables:**
- [ ] MCP protocol compliance testing
- [ ] Server lifecycle management (start/stop/restart)
- [ ] Multi-client connection support

#### Week 5: Embedding Integration & MCP Enhancement

#### Week 5, Day 1-2: Model Management for MCP
**Deliverables:**
- [ ] Secure model download with verification
- [ ] Model caching in `.astdb/models/`
- [ ] MCP-integrated embedding generation

**Implementation:**
```typescript
// src/modules/downloader.ts
class ModelDownloader {
  async downloadModel(modelUrl: string, checksumUrl: string): Promise<string>;
  async verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean>;
  async getCachedModelPath(modelName: string): Promise<string>;
}
```

#### Week 5, Day 3-4: Embedding Integration
**Deliverables:**
- [ ] @xenova/transformers integration
- [ ] Batch processing for embeddings
- [ ] MCP methods for embedding operations

**Key Implementation:**
```typescript
// src/modules/embedder.ts
class EmbeddingGenerator {
  private model: any;
  
  async initialize(modelPath: string): Promise<void>;
  async generateEmbeddings(texts: string[]): Promise<number[][]>;
  async batchProcess(annotations: Annotation[]): Promise<EmbeddingResult[]>;
}
```

#### Week 5, Day 5: Index Operations via MCP
**Deliverables:**
- [ ] HNSW index integration through MCP
- [ ] Index serialization/deserialization
- [ ] MCP tools for index operations

**Critical Performance Targets:**
- Process 1000 annotations in <60s with WASM
- MCP response time <200ms for queries
### Week 7: Optional VS Code Extension & MCP Testing

#### Day 1-2: Lightweight VS Code Extension (Server Manager)
**Deliverables:**
- [ ] Optional VS Code extension for server management only
- [ ] Server lifecycle controls (start/stop/restart)
- [ ] Basic status indicators and workspace settings
- [ ] MCP server installation guidance

**Extension Implementation (Simplified):**
```typescript
// packages/vscode-extension/src/serverManager.ts
export class ServerManager {
    private serverProcess: ChildProcess | null = null;
    
    async startServer(workspaceRoot: string): Promise<void> {
        const serverPath = vscode.workspace.getConfiguration()
            .get('astCopilotHelper.serverPath', 'ast-mcp-server');
            
        this.serverProcess = spawn(serverPath, ['start', '--workspace', workspaceRoot]);
        vscode.window.showInformationMessage('AST MCP Server started');
    }
    
    async stopServer(): Promise<void> {
        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
            vscode.window.showInformationMessage('AST MCP Server stopped');
        }
    }
}
```

#### Day 3-4: MCP Protocol Testing & Validation
**Deliverables:**
- [ ] MCP protocol compliance testing
- [ ] Tool method validation and response formatting
- [ ] Cross-platform MCP server compatibility testing
- [ ] Multi-editor integration validation

**Testing Implementation:**
```typescript
// tests/mcp-integration.test.ts
describe('MCP Server Integration', () => {
  test('querySemanticContext returns proper format', async () => {
    const response = await mcpClient.call('querySemanticContext', {
      intent: 'find authentication methods',
      maxResults: 3
    });
    expect(response).toHaveProperty('matches');
    expect(response.matches).toBeArray();
  });
});
```

#### Day 5: Integration Testing & Documentation
**Deliverables:**
- [ ] End-to-end MCP workflow testing
- [ ] VS Code extension marketplace preparation
- [ ] MCP server deployment documentation
- [ ] Cross-editor usage examples

### Week 8: Testing & Validation

#### Day 1-2: Test Infrastructure
**Deliverables:**
- [ ] Jest testing framework setup
- [ ] Unit tests for all core modules (>90% coverage)
- [ ] Integration tests for workflows

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

#### Day 3: Performance & Scale Testing
**Deliverables:**
- [ ] 100k significant node synthetic test repository (~667k LOC)
- [ ] Performance benchmarking suite
- [ ] Memory usage validation

#### Day 4-5: Cross-platform Testing
**Deliverables:**
- [ ] Windows, macOS, Linux compatibility tests
- [ ] VS Code extension testing across platforms
- [ ] Installation and deployment validation

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
- [ ] Complete security audit
- [ ] Performance target validation
- [ ] Cross-platform installation testing
- [ ] NPM package preparation
- [ ] VS Code marketplace submission

## Implementation Milestones & Success Criteria

### Milestone 1 (Week 2): Basic Parsing
- [ ] Parse 1000+ TypeScript files successfully
- [ ] Git integration working across platforms
- [ ] AST storage and retrieval functional

### Milestone 2 (Week 3): Annotation System
- [ ] Generate meaningful annotations for TS/JS/Python
- [ ] Template system extensible to new languages
- [ ] Incremental updates working correctly

### Milestone 3 (Week 5): Embedding & Indexing  
- [ ] Index 10k+ code fragments
- [ ] Query latency <500ms for development
- [ ] Memory usage linear with dataset size

### Milestone 4 (Week 5): MCP Server & Embedding Integration
- [ ] MCP server operational as standalone binary
- [ ] Core MCP methods for AST operations functional
- [ ] Embedding generation integrated with MCP
- [ ] Cross-editor compatibility demonstrated

### Milestone 4.5 (Week 7): Optional Extension & MCP Validation
- [ ] Optional VS Code extension for server management
- [ ] Multi-client MCP protocol support working
- [ ] MCP server performance targets met

### Milestone 5 (Week 8): Performance Validation
- [ ] Index 100k significant nodes in <10 minutes
- [ ] Query latency <200ms average
- [ ] Memory usage <4GB for large repositories

### Final Milestone (Week 10): Production Ready
- [ ] All performance targets met
- [ ] Cross-platform compatibility verified
- [ ] Documentation complete
- [ ] Security audit passed

## Risk Mitigation Strategies

### High-Risk Items
1. **Performance Targets**: Begin performance testing early, have fallback optimizations ready
2. **Model Integration**: Test embedding generation early, have backup model options
3. **Cross-platform Issues**: Test on all platforms throughout development
4. **VS Code Integration**: Have multiple integration strategies prepared

### Technical Debt Management
- Prioritize functionality over optimization in early phases
- Plan refactoring windows after major milestones
- Maintain comprehensive test coverage to enable safe refactoring
- Document technical debt decisions for future resolution

## Development Resources & Prerequisites

### Required Skills
- TypeScript/Node.js development
- VS Code extension development  
- Git and file system operations
- Vector databases and machine learning basics
- Cross-platform development experience

### Development Environment
- Node.js 18+ with TypeScript
- VS Code with extension development tools
- Git repository with sample codebases
- Testing environments for Windows/macOS/Linux

### External Dependencies
- Tree-sitter grammar availability
- CodeBERT-base model downloaded from HuggingFace
- GitHub Actions/CI availability
- NPM and VS Code marketplace access

This implementation specification provides a concrete roadmap for building the ast-copilot-helper system. Each week has specific deliverables and success criteria, making it possible to track progress and adjust timelines as needed.
